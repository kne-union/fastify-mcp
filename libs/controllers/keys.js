const fp = require('fastify-plugin');

module.exports = fp(async (fastify, options) => {
  const { services } = fastify[options.name];
  const keysPath = `${options.prefix}/mcp-keys`;

  const requireUserAuth = async request => {
    if (typeof options.authenticateUser !== 'function') {
      throw Object.assign(new Error('未配置 authenticateUser'), { statusCode: 500 });
    }
    await options.authenticateUser(request);
    if (!request.userInfo || request.userInfo.id == null || request.userInfo.id === '') {
      throw Object.assign(new Error('authenticateUser 须写入 request.userInfo.id'), { statusCode: 500 });
    }
  };

  const subjectIdOf = request => String(request.userInfo.id);

  const sendError = (reply, e) => reply.code(e.statusCode || 500).send({ error: e.message || String(e) });

  fastify.post(
    keysPath,
    {
      onRequest: [requireUserAuth],
      schema: {
        tags: ['MCP Keys'],
        summary: '创建 MCP 密钥（明文 secret 仅返回一次）',
        body: {
          type: 'object',
          properties: {
            name: { type: 'string' }
          }
        }
      }
    },
    async (request, reply) => {
      try {
        return await services.key.create({
          subjectId: subjectIdOf(request),
          name: request.body?.name
        });
      } catch (e) {
        return sendError(reply, e);
      }
    }
  );

  fastify.get(
    keysPath,
    {
      onRequest: [requireUserAuth],
      schema: {
        tags: ['MCP Keys'],
        summary: '当前用户 MCP 密钥列表（secret 打码）',
        querystring: {
          type: 'object',
          properties: {
            perPage: { type: 'number', default: 20 },
            currentPage: { type: 'number', default: 1 }
          }
        }
      }
    },
    async (request, reply) => {
      try {
        return await services.key.list({
          subjectId: subjectIdOf(request),
          perPage: request.query?.perPage,
          currentPage: request.query?.currentPage
        });
      } catch (e) {
        return sendError(reply, e);
      }
    }
  );

  fastify.delete(
    `${keysPath}/:id`,
    {
      onRequest: [requireUserAuth],
      schema: {
        tags: ['MCP Keys'],
        summary: '删除（作废）MCP 密钥'
      }
    },
    async (request, reply) => {
      try {
        return await services.key.remove({
          subjectId: subjectIdOf(request),
          id: request.params.id
        });
      } catch (e) {
        return sendError(reply, e);
      }
    }
  );
});
