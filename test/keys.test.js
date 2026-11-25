const { expect } = require('chai');
const { createApp } = require('./helpers/create-app');

describe('mcp keys', () => {
  let app;

  before(async () => {
    app = await createApp();
  });

  after(async () => {
    await app.close();
  });

  it('create returns plaintext secret once; list masks secret', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/mcp-keys',
      headers: { 'x-test-user': 'u1' },
      payload: { name: 'demo' }
    });
    expect(created.statusCode).to.equal(200);
    const body = created.json();
    expect(body).to.include.keys(['id', 'secret', 'name']);
    expect(body.name).to.equal('demo');
    expect(body.secret).to.match(/^[0-9a-f]{64}$/i);

    const listed = await app.inject({
      method: 'GET',
      url: '/api/v1/mcp-keys',
      headers: { 'x-test-user': 'u1' }
    });
    expect(listed.statusCode).to.equal(200);
    const page = listed.json();
    const row = page.pageData.find(item => item.id === body.id);
    expect(row).to.exist;
    expect(row.secret).to.equal('********');
    expect(row.secret).to.not.equal(body.secret);
  });

  it('delete revokes key so Bearer auth fails', async () => {
    const key = await app.issueKey({ name: 'to-delete' });
    const guideOk = await app.inject({
      method: 'GET',
      url: '/api/v1/mcp/guide',
      headers: { authorization: key.authorization }
    });
    expect(guideOk.statusCode).to.equal(200);

    const removed = await app.inject({
      method: 'DELETE',
      url: `/api/v1/mcp-keys/${key.id}`,
      headers: { 'x-test-user': 'u1' }
    });
    expect(removed.statusCode).to.equal(200);

    const guideFail = await app.inject({
      method: 'GET',
      url: '/api/v1/mcp/guide',
      headers: { authorization: key.authorization }
    });
    expect(guideFail.statusCode).to.equal(401);
  });

  it('cannot delete another user key', async () => {
    const key = await app.issueKey({ userId: 'u1', name: 'owned' });
    const removed = await app.inject({
      method: 'DELETE',
      url: `/api/v1/mcp-keys/${key.id}`,
      headers: { 'x-test-user': 'u2' }
    });
    expect(removed.statusCode).to.equal(404);
  });

  it('guide requires valid Bearer', async () => {
    const noAuth = await app.inject({ method: 'GET', url: '/api/v1/mcp/guide' });
    expect(noAuth.statusCode).to.equal(401);

    const key = await app.issueKey({ name: 'guide' });
    const ok = await app.inject({
      method: 'GET',
      url: '/api/v1/mcp/guide',
      headers: { authorization: key.authorization }
    });
    expect(ok.statusCode).to.equal(200);
    expect(String(ok.body)).to.include('MCP');
  });
});
