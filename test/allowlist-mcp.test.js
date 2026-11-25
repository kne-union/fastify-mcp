const { expect } = require('chai');
const { createApp } = require('./helpers/create-app');

const parseSseJson = body => {
  const line = String(body)
    .split('\n')
    .find(item => item.startsWith('data: '));
  if (!line) {
    throw new Error(`no sse data: ${body}`);
  }
  return JSON.parse(line.slice(6));
};

describe('allowlist + mcp tools', () => {
  let app;

  before(async () => {
    app = await createApp();
  });

  after(async () => {
    await app.close();
  });

  it('catalog hides denied secret routes and marks enabled', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/admin/mcp/mcp-catalog/operations' });
    expect(res.statusCode).to.equal(200);
    const body = res.json();
    expect(body.pageData.some(item => item.path.includes('/secret/'))).to.equal(false);
    expect(body.pageData.some(item => item.path === '/api/v1/client/project/list')).to.equal(true);
  });

  it('batch allowlist then search/call via MCP', async () => {
    const batch = await app.inject({
      method: 'PUT',
      url: '/api/v1/admin/mcp/mcp-allowlist/batch',
      payload: {
        items: [
          {
            method: 'GET',
            path: '/api/v1/client/project/list',
            scenarios: ['查项目'],
            confirm: false
          },
          {
            operationId: 'client_project_create',
            scenarios: ['建项目'],
            confirm: true
          }
        ]
      }
    });
    expect(batch.statusCode).to.equal(200);
    expect(batch.json().totalCount).to.equal(2);

    const guide = await app.inject({ method: 'GET', url: '/api/v1/mcp/guide' });
    expect(guide.statusCode).to.equal(200);
    expect(guide.headers['content-type']).to.match(/markdown/);
    expect(guide.body).to.include('search_apis');

    const init = await app.inject({
      method: 'POST',
      url: '/api/v1/mcp',
      headers: { accept: 'application/json, text/event-stream', 'content-type': 'application/json' },
      payload: {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } }
      }
    });
    expect(init.statusCode).to.be.oneOf([200, 202]);

    const tools = await app.inject({
      method: 'POST',
      url: '/api/v1/mcp',
      headers: { accept: 'application/json, text/event-stream', 'content-type': 'application/json' },
      payload: { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }
    });
    const toolsBody = tools.headers['content-type']?.includes('event-stream') ? parseSseJson(tools.body) : tools.json();
    const names = (toolsBody.result?.tools || []).map(item => item.name);
    expect(names).to.include.members(['describe_capabilities', 'search_apis', 'call_api']);

    const search = await app.inject({
      method: 'POST',
      url: '/api/v1/mcp',
      headers: { accept: 'application/json, text/event-stream', 'content-type': 'application/json' },
      payload: {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'search_apis', arguments: { query: '项目' } }
      }
    });
    const searchBody = search.headers['content-type']?.includes('event-stream') ? parseSseJson(search.body) : search.json();
    const searchText = searchBody.result?.content?.[0]?.text || '';
    expect(searchText).to.include('project/list');

    const denyInvoke = await app.inject({
      method: 'POST',
      url: '/api/v1/mcp',
      headers: { accept: 'application/json, text/event-stream', 'content-type': 'application/json' },
      payload: {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'call_api',
          arguments: { mode: 'invoke', operationId: 'client_project_create', body: { name: 'x' } }
        }
      }
    });
    const denyBody = denyInvoke.headers['content-type']?.includes('event-stream') ? parseSseJson(denyInvoke.body) : denyInvoke.json();
    expect(denyBody.result?.isError || String(denyBody.result?.content?.[0]?.text || '').includes('确认')).to.equal(true);

    const okInvoke = await app.inject({
      method: 'POST',
      url: '/api/v1/mcp',
      headers: { accept: 'application/json, text/event-stream', 'content-type': 'application/json' },
      payload: {
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: {
          name: 'call_api',
          arguments: {
            mode: 'invoke',
            operationId: 'client_project_create',
            body: { name: 'demo' },
            userConfirmed: true
          }
        }
      }
    });
    const okBody = okInvoke.headers['content-type']?.includes('event-stream') ? parseSseJson(okInvoke.body) : okInvoke.json();
    expect(okBody.result?.isError).to.not.equal(true);
    expect(String(okBody.result?.content?.[0]?.text || '')).to.include('demo');
  });

  it('rejects adding denied path to allowlist', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/mcp/mcp-allowlist',
      payload: { method: 'POST', path: '/api/v1/client/secret/create' }
    });
    expect(res.statusCode).to.equal(400);
  });
});
