const { expect } = require('chai');
const { createApp } = require('./helpers/create-app');

describe('allowlist CRUD + sync', () => {
  let app;

  before(async () => {
    app = await createApp();
  });

  after(async () => {
    await app.close();
  });

  it('create / get / list / patch / remove', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/mcp/mcp-allowlist',
      payload: {
        method: 'GET',
        path: '/api/v1/client/ping',
        scenarios: ['系统'],
        confirm: false
      }
    });
    expect(created.statusCode).to.equal(200);
    const row = created.json();
    expect(row.path).to.equal('/api/v1/client/ping');
    expect(row.enabled).to.equal(true);

    const detail = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/mcp/mcp-allowlist/${row.id}`
    });
    expect(detail.statusCode).to.equal(200);
    expect(detail.json().id).to.equal(row.id);

    const listed = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/mcp/mcp-allowlist?keyword=ping&enabled=true'
    });
    expect(listed.statusCode).to.equal(200);
    expect(listed.json().pageData.some(item => item.id === row.id)).to.equal(true);

    const patched = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/mcp/mcp-allowlist/${row.id}`,
      payload: { scenarios: ['系统', '健康检查'], confirm: true, enabled: true }
    });
    expect(patched.statusCode).to.equal(200);
    expect(patched.json().scenarios).to.include('健康检查');
    expect(patched.json().confirm).to.equal(true);

    const missing = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/mcp/mcp-allowlist/999999999999999999'
    });
    expect(missing.statusCode).to.equal(404);

    const removed = await app.inject({
      method: 'DELETE',
      url: `/api/v1/admin/mcp/mcp-allowlist/${row.id}`
    });
    expect(removed.statusCode).to.equal(200);

    const gone = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/mcp/mcp-allowlist/${row.id}`
    });
    expect(gone.statusCode).to.equal(404);
  });

  it('create rejects unknown openapi path and upserts existing', async () => {
    const bad = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/mcp/mcp-allowlist',
      payload: { method: 'GET', path: '/api/v1/client/not-exists' }
    });
    expect(bad.statusCode).to.equal(400);

    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/mcp/mcp-allowlist',
      payload: { method: 'GET', path: '/api/v1/client/project/list', scenarios: ['a'] }
    });
    expect(first.statusCode).to.equal(200);
    const second = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/mcp/mcp-allowlist',
      payload: { method: 'GET', path: '/api/v1/client/project/list', scenarios: ['b'], confirm: true }
    });
    expect(second.statusCode).to.equal(200);
    expect(second.json().id).to.equal(first.json().id);
    expect(second.json().scenarios).to.deep.equal(['b']);
    expect(second.json().confirm).to.equal(true);
  });

  it('sync marks missing swagger ops as orphan', async () => {
    const orphan = await app.mcp.models.allowlist.create({
      operationId: 'gone_op',
      method: 'GET',
      path: '/api/v1/client/removed-route',
      scenarios: [],
      confirm: false,
      enabled: true,
      status: 'active'
    });

    const synced = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/mcp/mcp-allowlist/sync'
    });
    expect(synced.statusCode).to.equal(200);
    const body = synced.json();
    expect(body.orphanCount).to.be.at.least(1);

    const refreshed = await app.mcp.services.allowlist.get({ id: orphan.id });
    expect(refreshed.status).to.equal('orphan');
    expect(refreshed.enabled).to.equal(false);

    const again = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/mcp/mcp-allowlist/sync'
    });
    expect(again.statusCode).to.equal(200);
  });
});

describe('authenticateAdmin default off', () => {
  let app;

  before(async () => {
    app = await createApp({ disableAdminAuth: true });
  });

  after(async () => {
    await app.close();
  });

  it('admin routes work without authenticateAdmin', async () => {
    const listed = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/mcp/mcp-allowlist'
    });
    expect(listed.statusCode).to.equal(200);
    expect(listed.json()).to.have.property('pageData');

    const catalog = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/mcp/mcp-catalog/operations'
    });
    expect(catalog.statusCode).to.equal(200);
    expect(catalog.json()).to.have.property('pageData');
  });
});
