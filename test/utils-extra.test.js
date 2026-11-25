const path = require('node:path');
const fs = require('node:fs');
const { expect } = require('chai');
const { readGuideMarkdown } = require('../libs/utils/guide');
const { truncateText } = require('../libs/utils/truncate');
const { isDenied, matchRule, normalizePath } = require('../libs/utils/deny');
const { listSwaggerOperations, findSwaggerOperation, normalizeMethod } = require('../libs/utils/openapi');

describe('utils extra', () => {
  const fixtures = path.join(__dirname, 'fixtures');

  before(() => {
    fs.mkdirSync(fixtures, { recursive: true });
  });

  it('truncateText handles objects and truncation', () => {
    expect(truncateText({ a: 1 })).to.equal('[object Object]');
    expect(truncateText('abcdef', 3)).to.include('已截断');
    expect(truncateText('short', 100)).to.equal('short');
  });

  it('deny helpers cover edge cases', () => {
    expect(normalizePath('/a?x=1')).to.equal('/a');
    expect(isDenied('/ok', ['**/x/**'])).to.equal(false);
    expect(matchRule('/api/v1/foo', '')).to.equal(false);
    expect(matchRule('/api/v1/client/secret/list', '**/secret/**')).to.equal(true);
    expect(matchRule('/api/v1/client/secret/', '**/secret/')).to.equal(true);
    expect(matchRule('/exact', '/exact')).to.equal(true);
    expect(matchRule('/exact/child', '/exact')).to.equal(true);
    expect(isDenied('/api/v1/client/secret/list')).to.equal(true);
  });

  it('guide errors: missing config, missing file, oversized, non-file', async () => {
    try {
      await readGuideMarkdown({});
      expect.fail('should throw');
    } catch (e) {
      expect(e.statusCode).to.equal(404);
    }

    try {
      await readGuideMarkdown({
        guideMarkdownPath: path.join(fixtures, 'nope.md'),
        guideRootDir: fixtures
      });
      expect.fail('should throw');
    } catch (e) {
      expect(e.statusCode).to.equal(404);
    }

    const big = path.join(fixtures, 'big.md');
    fs.writeFileSync(big, 'x'.repeat(100));
    try {
      await readGuideMarkdown({
        guideMarkdownPath: big,
        guideRootDir: fixtures,
        maxGuideBytes: 10
      });
      expect.fail('should throw');
    } catch (e) {
      expect(e.statusCode).to.equal(413);
    }

    const dirAsGuide = path.join(fixtures, 'subdir');
    fs.mkdirSync(dirAsGuide, { recursive: true });
    try {
      await readGuideMarkdown({
        guideMarkdownPath: dirAsGuide,
        guideRootDir: fixtures
      });
      expect.fail('should throw');
    } catch (e) {
      expect(e.statusCode).to.be.oneOf([400, 404]);
    }
  });

  it('openapi helpers', () => {
    expect(normalizeMethod('get')).to.equal('GET');
    try {
      normalizeMethod('TRACE');
      expect.fail('should throw');
    } catch (e) {
      expect(e.messageId).to.equal('invalidHttpMethod');
      expect(e.messageValues.methods).to.include('GET');
    }

    const spec = {
      paths: {
        '/api/a': {
          get: { operationId: 'a_get', summary: 'A', tags: ['t'] },
          post: { summary: 'create' }
        }
      }
    };
    const list = listSwaggerOperations(spec, { pathPrefix: '/api' });
    expect(list).to.have.length(2);
    expect(findSwaggerOperation(spec, { operationId: 'a_get' }).path).to.equal('/api/a');
    expect(findSwaggerOperation(spec, { method: 'POST', path: '/api/a' }).summary).to.equal('create');
    expect(findSwaggerOperation(spec, { method: 'GET', path: '/missing' })).to.equal(null);
  });
});
