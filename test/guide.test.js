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
