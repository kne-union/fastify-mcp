const path = require('node:path');
const fs = require('node:fs/promises');
const os = require('node:os');
const { expect } = require('chai');
const { createApp } = require('./helpers/create-app');

describe('seedsDir / includeSeeds', () => {
  it('loads allowlist from business seedsDir on sync', async () => {
    const seedsDir = path.join(__dirname, 'fixtures/mcpSeeds');
    const app = await createApp({ seedsDir });
    try {
      const listed = await app.mcp.services.allowlist.list({ perPage: 50 });
      const paths = listed.pageData.map(item => item.path);
      expect(paths).to.include('/api/v1/client/ping');
      expect(paths).to.include('/api/v1/client/project/list');
    } finally {
      await app.close();
    }
  });

  it('skips missing seedsDir without error', async () => {
    const app = await createApp({ seedsDir: path.join(__dirname, 'fixtures/not-exists') });
    try {
      const result = await app.mcp.services.allowlist.includeSeeds(path.join(__dirname, 'fixtures/not-exists'));
      expect(result).to.deep.equal({ imported: 0, skipped: 0 });
    } finally {
      await app.close();
    }
  });

  it('skips deny / unknown swagger items and imports valid ones', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-seeds-'));
    await fs.writeFile(
      path.join(dir, 'mixed.json'),
      JSON.stringify([
        { method: 'GET', path: '/api/v1/client/ping', scenarios: ['系统'] },
        { method: 'POST', path: '/api/v1/client/secret/create', scenarios: ['密钥'] },
        { method: 'GET', path: '/api/v1/client/missing', scenarios: [] }
      ])
    );
    const app = await createApp();
    try {
      const result = await app.mcp.services.allowlist.includeSeeds(dir);
      expect(result.imported).to.equal(1);
      expect(result.skipped).to.equal(2);
      const listed = await app.mcp.services.allowlist.list({ keyword: 'ping' });
      expect(listed.pageData.some(item => item.path === '/api/v1/client/ping')).to.equal(true);
    } finally {
      await app.close();
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
