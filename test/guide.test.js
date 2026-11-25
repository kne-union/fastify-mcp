const fs = require('node:fs/promises');
const os = require('node:os');
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
    const key = await app.issueKey();
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/mcp/guide',
      headers: { authorization: key.authorization }
    });
    expect(res.statusCode).to.equal(200);
    expect(res.body).to.include('describe_capabilities');
    await app.close();
  });

  it('rejects path escape', async () => {
    const root = path.resolve(__dirname, '..');
    const outsideDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fastify-mcp-guide-'));
    const outsideFile = path.join(outsideDir, 'escape.md');
    await fs.writeFile(outsideFile, '# outside\n', 'utf8');
    try {
      await readGuideMarkdown({
        guideMarkdownPath: outsideFile,
        guideRootDir: root
      });
      expect.fail('should throw');
    } catch (e) {
      expect(e.statusCode).to.equal(400);
      expect(e.messageId).to.equal('guidePathEscape');
    } finally {
      await fs.rm(outsideDir, { recursive: true, force: true });
    }
  });
});
