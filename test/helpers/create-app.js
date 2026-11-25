const path = require('node:path');
const Fastify = require('fastify');
const fp = require('fastify-plugin');

const createApp = async ({
  guideMarkdownPath,
  guideRootDir,
  deny,
  authenticateAdmin,
  authenticateUser,
  resolveUser,
  useDefaultGuide,
  disableAdminAuth,
  seedsDir,
  users
} = {}) => {
  const fastify = Fastify({ logger: false });
  const userStore = users || {
    u1: { id: 'u1', name: 'user-1' },
    admin: { id: 'admin', name: 'admin' }
  };

  await fastify.register(require('@fastify/swagger'), {
    openapi: {
      info: { title: 'test', version: '1.0.0' }
    }
  });

  await fastify.register(
    fp(async f => {
      f.get(
        '/api/v1/client/project/list',
        {
          schema: {
            operationId: 'client_project_list',
            summary: '项目列表',
            tags: ['项目'],
            querystring: {
              type: 'object',
              properties: { perPage: { type: 'number' } }
            }
          }
        },
        async () => ({ code: 0, data: { pageData: [], totalCount: 0 } })
      );
      f.post(
        '/api/v1/client/project/create',
        {
          schema: {
            operationId: 'client_project_create',
            summary: '创建项目',
            tags: ['项目'],
            body: {
              type: 'object',
              properties: { name: { type: 'string' } }
            }
          }
        },
        async request => ({ code: 0, data: { id: 'p1', name: request.body?.name } })
      );
      f.post(
        '/api/v1/client/secret/create',
        {
          schema: {
            operationId: 'client_secret_create',
            summary: '创建密钥',
            tags: ['密钥']
          }
        },
        async () => ({ code: 0, data: {} })
      );
      f.get('/api/v1/client/ping', { schema: { summary: 'ping', tags: ['系统'] } }, async () => ({ ok: true }));
    })
  );

  await fastify.register(require('@kne/fastify-intl'), {
    defaultLocale: 'zh-CN'
  });

  await fastify.register(require('@kne/fastify-sequelize'), {
    db: {
      dialect: 'sqlite',
      storage: ':memory:',
      logging: false
    },
    modelsPath: false,
    sqlPath: path.join(__dirname, 'empty-sql')
  });

  const mcpOptions = {
    name: 'mcp',
    prefix: '/api/v1',
    adminPrefix: '/api/v1/admin/mcp',
    dbTableNamePrefix: 't_mcp_',
    ...(deny ? { deny } : {}),
    authenticateUser:
      authenticateUser ||
      (async request => {
        const header = String(request.headers['x-test-user'] || 'u1');
        request.userInfo = userStore[header] || { id: header };
      }),
    resolveUser:
      resolveUser ||
      (async subjectId => {
        const id = String(subjectId);
        return userStore[id] || { id };
      }),
    createInvokeHeaders: () => ({ 'x-test-auth': '1' })
  };
  if (!disableAdminAuth) {
    mcpOptions.authenticateAdmin =
      authenticateAdmin ||
      (async request => {
        request.userInfo = { id: 'admin' };
      });
  }
  if (!useDefaultGuide) {
    mcpOptions.guideMarkdownPath = guideMarkdownPath || path.resolve(__dirname, '../../MCP.md');
    mcpOptions.guideRootDir = guideRootDir || path.resolve(__dirname, '../..');
  }
  if (seedsDir) {
    mcpOptions.seedsDir = seedsDir;
  }
  await fastify.register(require('../../index'), mcpOptions);

  await fastify.register(
    fp(async f => {
      await f.sequelize.sync();
    })
  );

  await fastify.ready();
  await fastify.sequelize.syncPromise;
  await fastify.mcp.seedsReady;

  const issueKey = async ({ userId = 'u1', name = 'test-key' } = {}) => {
    const created = await fastify.inject({
      method: 'POST',
      url: '/api/v1/mcp-keys',
      headers: { 'x-test-user': userId },
      payload: { name }
    });
    if (created.statusCode !== 200) {
      throw new Error(`issueKey failed: ${created.statusCode} ${created.body}`);
    }
    const body = created.json();
    return {
      ...body,
      authorization: `Bearer ${body.id}.${body.secret}`
    };
  };

  fastify.issueKey = issueKey;
  return fastify;
};

module.exports = { createApp };
