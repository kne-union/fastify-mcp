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
            limit: { type: 'number' }
          }
        }
      }
    },
    async request => {
      const items = await services.capability.buildCatalog(request.query || {});
      return { pageData: items, totalCount: items.length };
    }
  );
});
