const path = require('node:path');
const { expect } = require('chai');
const { readGuideMarkdown } = require('../libs/utils/guide');

describe('guide', () => {
  it('reads MCP.md under root', async () => {
    const root = path.resolve(__dirname, '..');
    const doc = await readGuideMarkdown({
      guideMarkdownPath: path.join(root, 'MCP.md'),
      guideRootDir: root
    });
    expect(doc.content).to.include('describe_capabilities');
  });

  it('plugin defaults guideMarkdownPath to cwd/MCP.md', async () => {
    const { createApp } = require('./helpers/create-app');
    const app = await createApp({ useDefaultGuide: true });
    const res = await app.inject({ method: 'GET', url: '/api/v1/mcp/guide' });
    expect(res.statusCode).to.equal(200);
    expect(res.body).to.include('describe_capabilities');
    await app.close();
  });

  it('rejects path escape', async () => {
    const root = path.resolve(__dirname, '..');
    try {
      await readGuideMarkdown({
        guideMarkdownPath: path.join(root, '..', 'ai-interview-flowup', 'README.md'),
        guideRootDir: root
      });
      expect.fail('should throw');
    } catch (e) {
      expect(e.statusCode).to.equal(400);
    }
  });
});
