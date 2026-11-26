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

  fastify.get(
    `${adminPrefix}/mcp-catalog/operations`,
    {
      onRequest: [adminAuth],
      schema: {
        tags: ['MCP Admin'],
        summary: 'OpenAPI 候选接口目录（含 enabled 标记）',
        querystring: {
          type: 'object',
          properties: {
            keyword: { type: 'string' },
            tag: { type: 'string' },
            // 多选：逗号分隔或重复 query（scenario=a&scenario=b）
            scenario: { anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] },
            enabled: { type: 'boolean' },
            limit: { type: 'number' },
            perPage: { type: 'number' },
            currentPage: { type: 'number' }
          }
        }
      }
    },
    async request => {
      const query = { ...(request.query || {}) };
      if (query.enabled === 'true') query.enabled = true;
      if (query.enabled === 'false') query.enabled = false;
      return await services.capability.buildCatalog(query);
    }
  );
});
