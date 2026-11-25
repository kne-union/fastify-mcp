const fp = require('fastify-plugin');
const { McpServer } = require('@modelcontextprotocol/server');
const { NodeStreamableHTTPServerTransport } = require('@modelcontextprotocol/node');
const { registerCoreTools } = require('../utils/register-tools');
const { readGuideMarkdown } = require('../utils/guide');

module.exports = fp(async (fastify, options) => {
  const { services } = fastify[options.name];
  const mcpPath = `${options.prefix}/mcp`;
  const guidePath = `${options.prefix}/mcp/guide`;

  const runAuthenticate = async (request, kind) => {
    const hook = kind === 'guide' ? options.authenticateGuide || options.authenticate : options.authenticate;
    if (typeof hook !== 'function') {
      throw Object.assign(new Error('未配置 authenticate'), { statusCode: 500 });
    }
    await hook(request);
  };

  fastify.get(
    guidePath,
    {
      onRequest: [async request => runAuthenticate(request, 'guide')],
      schema: {
        tags: ['MCP'],
        summary: 'MCP 安装/使用引导 Markdown（读项目根 MCP.md）',
        hide: true
      }
    },
    async (request, reply) => {
      try {
        const doc = await readGuideMarkdown({
          guideMarkdownPath: options.guideMarkdownPath,
          guideRootDir: options.guideRootDir,
          maxGuideBytes: options.maxGuideBytes
        });
        reply.type('text/markdown; charset=utf-8');
        return reply.send(doc.content);
      } catch (e) {
        return reply.code(e.statusCode || 500).send({ error: e.message || String(e) });
      }
    }
  );

  const methodNotAllowed = async (request, reply) => reply.code(405).header('allow', 'POST').send({ error: 'Method Not Allowed' });

  fastify.get(mcpPath, { schema: { tags: ['MCP'], summary: 'MCP SSE（不支持）', hide: true } }, methodNotAllowed);
  fastify.delete(mcpPath, { schema: { tags: ['MCP'], summary: 'MCP 会话终止（不支持）', hide: true } }, methodNotAllowed);

  fastify.post(
    mcpPath,
    {
      onRequest: [async request => runAuthenticate(request, 'mcp')],
      bodyLimit: options.bodyLimit || 15 * 1024 * 1024,
      schema: {
        tags: ['MCP'],
        summary: 'MCP 端点（JSON-RPC over Streamable HTTP）',
        hide: true
      }
    },
    async (request, reply) => {
      const serverInfo = options.serverInfo || { name: 'fastify-mcp', version: '0.1.0' };
      const instructions =
        options.instructions || ['先调用 describe_capabilities 阅读引导与已开启能力。', '再用 search_apis 找接口，call_api mode=schema 看参数，mode=invoke 执行。', '标记 confirm 的写操作须先向用户确认并传 userConfirmed=true。'].join(' ');

      const mcpServer = new McpServer({
        name: serverInfo.name,
        version: serverInfo.version,
        instructions
      });

      const ctx = {
        userInfo: request.userInfo,
        openApiPayload: request.openApiPayload,
        request
      };
      registerCoreTools(mcpServer, { services, ctx });
      if (typeof options.registerExtraTools === 'function') {
        await options.registerExtraTools(mcpServer, { fastify, services, ctx, options });
      }

      const transport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      await mcpServer.connect(transport);

      reply.raw.on('close', () => {
        transport.close();
        mcpServer.close();
      });

      reply.hijack();
      await transport.handleRequest(request.raw, reply.raw, request.body);
    }
  );
});
