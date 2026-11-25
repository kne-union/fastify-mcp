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

const rpc = async (app, id, method, params, authorization) => {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/mcp',
    headers: {
      accept: 'application/json, text/event-stream',
      'content-type': 'application/json',
      authorization
    },
    payload: { jsonrpc: '2.0', id, method, params }
  });
  const body = res.headers['content-type']?.includes('event-stream') ? parseSseJson(res.body) : res.json();
  return { res, body };
};

describe('capability tools', () => {
  let app;
  let authorization;

  before(async () => {
    app = await createApp();
    authorization = (await app.issueKey()).authorization;
    await app.inject({
      method: 'PUT',
      url: '/api/v1/admin/mcp/mcp-allowlist/batch',
      payload: {
        items: [
          { method: 'GET', path: '/api/v1/client/project/list', scenarios: ['查项目'] },
          { method: 'POST', path: '/api/v1/client/project/create', scenarios: ['建项目'], confirm: true }
        ]
      }
    });
  });

  after(async () => {
    await app.close();
  });

  it('describe_capabilities returns guide and catalog', async () => {
    const { body } = await rpc(app, 1, 'tools/call', { name: 'describe_capabilities', arguments: {} }, authorization);
    const text = body.result?.content?.[0]?.text || '';
    expect(text).to.include('已开启能力');
    expect(text).to.include('search_apis');
    expect(text).to.include('查项目');
  });

  it('search_apis directory mode without filters', async () => {
    const { body } = await rpc(app, 2, 'tools/call', { name: 'search_apis', arguments: {} }, authorization);
    const text = body.result?.content?.[0]?.text || '';
    const parsed = JSON.parse(text);
    expect(parsed.mode).to.equal('directory');
    expect(parsed.byScenario).to.be.an('object');
  });

  it('search_apis filters by scenario and tag', async () => {
    const byScenario = await rpc(
      app,
      3,
      'tools/call',
      {
        name: 'search_apis',
        arguments: { scenario: '建项目' }
      },
      authorization
    );
    const scenarioText = byScenario.body.result?.content?.[0]?.text || '';
    expect(scenarioText).to.include('project/create');

    const byTag = await rpc(
      app,
      4,
      'tools/call',
      {
        name: 'search_apis',
        arguments: { tag: '项目', limit: 2 }
      },
      authorization
    );
    const tagParsed = JSON.parse(byTag.body.result?.content?.[0]?.text || '{}');
    expect(tagParsed.mode).to.equal('search');
    expect(tagParsed.items.length).to.be.at.most(2);
  });

  it('call_api schema and invoke by method+path', async () => {
    const schema = await rpc(
      app,
      5,
      'tools/call',
      {
        name: 'call_api',
        arguments: { mode: 'schema', method: 'GET', path: '/api/v1/client/project/list' }
      },
      authorization
    );
    const schemaText = schema.body.result?.content?.[0]?.text || '';
    expect(schemaText).to.include('parameters');
    expect(schemaText).to.include('project/list');

    const invoke = await rpc(
      app,
      6,
      'tools/call',
      {
        name: 'call_api',
        arguments: {
          mode: 'invoke',
          method: 'GET',
          path: '/api/v1/client/project/list',
          query: { perPage: 10 }
        }
      },
      authorization
    );
    expect(invoke.body.result?.isError).to.not.equal(true);
    expect(String(invoke.body.result?.content?.[0]?.text || '')).to.include('pageData');
  });

  it('call_api schema fails for unknown operation', async () => {
    const { body } = await rpc(
      app,
      7,
      'tools/call',
      {
        name: 'call_api',
        arguments: { mode: 'schema', operationId: 'not_real_op' }
      },
      authorization
    );
    expect(body.result?.isError).to.equal(true);
  });
});
