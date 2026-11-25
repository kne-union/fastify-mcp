const fp = require('fastify-plugin');

module.exports = fp(async (fastify, options) => {
  const { services } = fastify[options.name];
  const adminPrefix = options.adminPrefix || `${options.prefix}/admin/mcp`;

  // 默认关闭：未配置 authenticateAdmin 时管理端不鉴权
  const adminAuth = async request => {
    if (typeof options.authenticateAdmin === 'function') {
      await options.authenticateAdmin(request);
    }
  };

  const sendError = (reply, e) => reply.code(e.statusCode || 500).send({ error: e.message || String(e) });

  fastify.get(
    `${adminPrefix}/mcp-allowlist`,
    {
      onRequest: [adminAuth],
      schema: {
        tags: ['MCP Admin'],
        summary: 'allowlist 分页列表',
        querystring: {
          type: 'object',
          properties: {
            perPage: { type: 'number', default: 20 },
            currentPage: { type: 'number', default: 1 },
            keyword: { type: 'string' },
            enabled: { type: 'boolean' },
            status: { type: 'string' }
          }
        }
      }
    },
    async (request, reply) => {
      try {
        const query = { ...request.query };
        if (query.enabled === 'true') query.enabled = true;
        if (query.enabled === 'false') query.enabled = false;
        return await services.allowlist.list(query);
      } catch (e) {
        return sendError(reply, e);
      }
    }
  );

  fastify.get(
    `${adminPrefix}/mcp-allowlist/:id`,
    {
      onRequest: [adminAuth],
      schema: { tags: ['MCP Admin'], summary: 'allowlist 详情' }
    },
    async (request, reply) => {
      try {
        return await services.allowlist.get({ id: request.params.id });
      } catch (e) {
        return sendError(reply, e);
      }
    }
  );

  fastify.post(
    `${adminPrefix}/mcp-allowlist`,
    {
      onRequest: [adminAuth],
      schema: {
        tags: ['MCP Admin'],
        summary: '开启一条 allowlist',
        body: {
          type: 'object',
          properties: {
            operationId: { type: 'string' },
            method: { type: 'string' },
            path: { type: 'string' },
            scenarios: { type: 'array', items: { type: 'string' } },
            confirm: { type: 'boolean' },
            enabled: { type: 'boolean' }
          }
        }
      }
    },
    async (request, reply) => {
      try {
        return await services.allowlist.create(request.body || {});
      } catch (e) {
        return sendError(reply, e);
      }
    }
  );

  fastify.patch(
    `${adminPrefix}/mcp-allowlist/:id`,
    {
      onRequest: [adminAuth],
      schema: {
        tags: ['MCP Admin'],
        summary: '更新 allowlist',
        body: {
          type: 'object',
          properties: {
            scenarios: { type: 'array', items: { type: 'string' } },
            confirm: { type: 'boolean' },
            enabled: { type: 'boolean' },
            status: { type: 'string' }
          }
        }
      }
    },
    async (request, reply) => {
      try {
        return await services.allowlist.patch({ id: request.params.id, ...(request.body || {}) });
      } catch (e) {
        return sendError(reply, e);
      }
    }
  );

  fastify.delete(
    `${adminPrefix}/mcp-allowlist/:id`,
    {
      onRequest: [adminAuth],
      schema: { tags: ['MCP Admin'], summary: '删除 allowlist' }
    },
    async (request, reply) => {
      try {
        return await services.allowlist.remove({ id: request.params.id });
      } catch (e) {
        return sendError(reply, e);
      }
    }
  );

  fastify.put(
    `${adminPrefix}/mcp-allowlist/batch`,
    {
      onRequest: [adminAuth],
      schema: {
        tags: ['MCP Admin'],
        summary: '批量 upsert allowlist',
        body: {
          type: 'object',
          properties: {
            items: { type: 'array', items: { type: 'object' } }
          },
          required: ['items']
        }
      }
    },
    async (request, reply) => {
      try {
        return await services.allowlist.batchUpsert(request.body || {});
      } catch (e) {
        return sendError(reply, e);
      }
    }
  );

  fastify.post(
    `${adminPrefix}/mcp-allowlist/sync`,
    {
      onRequest: [adminAuth],
      schema: { tags: ['MCP Admin'], summary: '与 swagger 对账，失效标 orphan' }
    },
    async (request, reply) => {
      try {
        return await services.allowlist.sync();
      } catch (e) {
        return sendError(reply, e);
      }
    }
  );
});
