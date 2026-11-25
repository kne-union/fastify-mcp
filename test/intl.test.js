const { expect } = require('chai');
const { createApp } = require('./helpers/create-app');

describe('intl errors', () => {
  let app;

  before(async () => {
    app = await createApp();
  });

  after(async () => {
    await app.close();
  });

  it('translates authenticationFailed by X-User-Locale', async () => {
    const zh = await app.inject({
      method: 'GET',
      url: '/api/v1/mcp/guide',
      headers: { 'x-user-locale': 'zh-CN' }
    });
    expect(zh.statusCode).to.equal(401);
    // onRequest 抛错走 Fastify 默认序列化：message 为文案，error 为 HTTP 短语
    expect(zh.json().message).to.equal('认证失败');

    const en = await app.inject({
      method: 'GET',
      url: '/api/v1/mcp/guide',
      headers: { 'x-user-locale': 'en-US' }
    });
    expect(en.statusCode).to.equal(401);
    expect(en.json().message).to.equal('Authentication failed');
  });

  it('translates allowlistNotFound', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/mcp/mcp-allowlist/999999999999999999',
      headers: { 'x-user-locale': 'en-US' }
    });
    expect(res.statusCode).to.equal(404);
    expect(res.json().error).to.equal('Allowlist record not found');
  });
});
