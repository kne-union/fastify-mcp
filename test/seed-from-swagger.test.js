const { expect } = require('chai');
const { createApp } = require('./helpers/create-app');
const { scenariosFromOperation, confirmFromOperation } = require('../libs/utils/scenarios');

describe('seedFromSwagger', () => {
  it('imports swagger operations with custom getScenarios after ready', async () => {
    const app = await createApp({
      seedFromSwagger: {
        pathPrefix: '/api/v1/client',
        getScenarios: op => (op.path.includes('project') ? ['建项目'] : ['系统']),
        getConfirm: op => op.method !== 'GET'
      }
    });
    try {
      const listed = await app.mcp.services.allowlist.list({ perPage: 50 });
      const byPath = Object.fromEntries(listed.pageData.map(item => [item.path, item]));
      expect(byPath['/api/v1/client/ping'].scenarios).to.deep.equal(['系统']);
      expect(byPath['/api/v1/client/project/list'].scenarios).to.deep.equal(['建项目']);
      expect(byPath['/api/v1/client/project/create'].confirm).to.equal(true);
      expect(byPath['/api/v1/client/ping'].source).to.equal('seed');
      expect(byPath['/api/v1/client/ping'].seedGroup).to.equal('swagger');
      expect(byPath['/api/v1/client/ping'].enabled).to.equal(false);
      // deny 默认挡住 secret
      expect(byPath['/api/v1/client/secret/create']).to.equal(undefined);
    } finally {
      await app.close();
    }
  });

  it('defaults scenarios from x-mcp-scenarios / tags and confirm from schema', async () => {
    const app = await createApp({ seedFromSwagger: { pathPrefix: '/api/v1/client' } });
    try {
      const listed = await app.mcp.services.allowlist.list({ perPage: 50 });
      const byPath = Object.fromEntries(listed.pageData.map(item => [item.path, item]));
      expect(byPath['/api/v1/client/project/list'].scenarios).to.deep.equal(['建项目']);
      expect(byPath['/api/v1/client/project/create'].scenarios).to.deep.equal(['建项目']);
      expect(byPath['/api/v1/client/project/create'].confirm).to.equal(true);
      // ping 无 x-mcp-scenarios，回退 tags
      expect(byPath['/api/v1/client/ping'].scenarios).to.deep.equal(['系统']);
      expect(byPath['/api/v1/client/ping'].confirm).to.equal(false);
      expect(byPath['/api/v1/client/ping'].enabled).to.equal(false);
    } finally {
      await app.close();
    }
  });

  it('keeps manually edited fields on reseed', async () => {
    const app = await createApp({ seedFromSwagger: { pathPrefix: '/api/v1/client' } });
    try {
      const listed = await app.mcp.services.allowlist.list({ keyword: 'ping' });
      const row = listed.pageData.find(item => item.path === '/api/v1/client/ping');
      expect(row).to.exist;
      await app.mcp.services.allowlist.patch({
        id: row.id,
        enabled: true,
        scenarios: ['人工场景']
      });
      await app.mcp.services.allowlist.seedFromSwagger({ pathPrefix: '/api/v1/client' });
      const after = await app.mcp.services.allowlist.get({ id: row.id });
      expect(after.enabled).to.equal(true);
      expect(after.scenarios).to.deep.equal(['人工场景']);
      expect(after.source).to.equal('seed');
      expect(after.manualFields).to.have.members(['enabled', 'scenarios']);
    } finally {
      await app.close();
    }
  });

  it('refreshes untouched seed fields on reseed, even after toggling enabled', async () => {
    const app = await createApp({ seedFromSwagger: { pathPrefix: '/api/v1/client' } });
    try {
      const listed = await app.mcp.services.allowlist.list({ keyword: 'ping' });
      const row = listed.pageData.find(item => item.path === '/api/v1/client/ping');
      // 模拟管理端开关：全量提交，仅 enabled 与现值不同
      await app.mcp.services.allowlist.create({
        method: row.method,
        path: row.path,
        scenarios: row.scenarios,
        confirm: row.confirm,
        enabled: true
      });
      // 模拟 schema 变更后的旧值
      const model = await app.mcp.models.allowlist.findByPk(row.id);
      await model.update({ scenarios: ['旧场景'], confirm: true });
      await app.mcp.services.allowlist.seedFromSwagger({ pathPrefix: '/api/v1/client' });
      const after = await app.mcp.services.allowlist.get({ id: row.id });
      expect(after.manualFields).to.deep.equal(['enabled']);
      expect(after.enabled).to.equal(true);
      expect(after.scenarios).to.deep.equal(['系统']);
      expect(after.confirm).to.equal(false);
    } finally {
      await app.close();
    }
  });

  it('disableMissing marks removed swagger seeds as missing', async () => {
    const app = await createApp({ seedFromSwagger: { pathPrefix: '/api/v1/client' } });
    try {
      const before = await app.mcp.services.allowlist.list({ keyword: 'ping' });
      const ping = before.pageData.find(item => item.path === '/api/v1/client/ping');
      expect(ping.status).to.equal('active');
      await app.mcp.services.allowlist.patch({ id: ping.id, enabled: true });

      const result = await app.mcp.services.allowlist.seedFromSwagger({
        pathPrefix: '/api/v1/client/project',
        disableMissing: true
      });
      expect(result.disabled).to.be.greaterThan(0);
      const after = await app.mcp.services.allowlist.get({ id: ping.id });
      expect(after.status).to.equal('missing');

      await app.mcp.services.allowlist.seedFromSwagger({ pathPrefix: '/api/v1/client' });
      const restored = await app.mcp.services.allowlist.get({ id: ping.id });
      expect(restored.status).to.equal('active');
      expect(restored.enabled).to.equal(true);
    } finally {
      await app.close();
    }
  });

  it('exposes seedPromise that resolves after background seed', async () => {
    const app = await createApp({ seedFromSwagger: true });
    try {
      expect(app.mcp.seedPromise).to.be.a('promise');
      const result = await app.mcp.seedPromise;
      expect(result.seedFromSwagger.imported).to.be.greaterThan(0);
    } finally {
      await app.close();
    }
  });
});

describe('scenariosFromOperation', () => {
  it('prefers x-mcp-scenarios over tags', () => {
    expect(
      scenariosFromOperation({
        method: 'GET',
        tags: ['项目'],
        operation: { tags: ['项目'], 'x-mcp-scenarios': ['建项目'] }
      })
    ).to.deep.equal(['建项目']);
  });

  it('falls back to tags', () => {
    expect(scenariosFromOperation({ method: 'GET', tags: ['系统'], operation: { tags: ['系统'] } })).to.deep.equal(['系统']);
  });

  it('confirm defaults by method when schema omits x-mcp-confirm', () => {
    expect(confirmFromOperation({ method: 'GET', operation: {} })).to.equal(false);
    expect(confirmFromOperation({ method: 'POST', operation: {} })).to.equal(true);
    expect(confirmFromOperation({ method: 'POST', operation: { 'x-mcp-confirm': false } })).to.equal(false);
  });
});
