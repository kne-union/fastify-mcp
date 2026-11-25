const z = require('zod/v4');

const textResult = (value, isError = false) => ({
  content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }],
  isError
});

/**
 * 注册固定三工具：describe_capabilities / search_apis / call_api
 */
const registerCoreTools = (mcpServer, { services, ctx }) => {
  mcpServer.registerTool(
    'describe_capabilities',
    {
      description: '获取本 MCP 的整体功能说明（安装/使用引导 + 已开启能力目录）。开始任务前先调用；不要用它执行接口。',
      inputSchema: z.object({})
    },
    async () => {
      try {
        const text = await services.capability.describeCapabilities();
        return textResult(text);
      } catch (e) {
        return textResult(e.message || String(e), true);
      }
    }
  );

  mcpServer.registerTool(
    'search_apis',
    {
      description: '在已开启的 allowlist 接口中搜索。传 query（推荐）或 tag/scenario；不传则返回按场景分组的目录。找到后用 call_api mode=schema 看参数。',
      inputSchema: z.object({
        query: z.string().optional().describe('关键词（路径 / summary / operationId / 场景）'),
        tag: z.string().optional().describe('OpenAPI tag 过滤'),
        scenario: z.string().optional().describe('allowlist scenarios 过滤'),
        limit: z.number().optional().describe('最多返回条数，默认 8，上限 15')
      })
    },
    async args => {
      try {
        const result = await services.capability.searchApis(args || {});
        return textResult(result);
      } catch (e) {
        return textResult(e.message || String(e), true);
      }
    }
  );

  mcpServer.registerTool(
    'call_api',
    {
      description: '查看或调用已开启接口。mode=schema 返回 OpenAPI 参数说明；mode=invoke 以当前认证身份 inject 调用。confirm=true 的接口必须先向用户确认并传 userConfirmed=true。',
      inputSchema: z.object({
        mode: z.enum(['schema', 'invoke']).describe('schema=看参数；invoke=执行'),
        operationId: z.string().optional().describe('OpenAPI operationId（优先）'),
        method: z.string().optional().describe('HTTP method，与 path 二选一配合 operationId'),
        path: z.string().optional().describe('接口路径，如 /api/v1/client/project/list'),
        query: z.record(z.string(), z.unknown()).optional().describe('查询参数对象'),
        body: z.record(z.string(), z.unknown()).optional().describe('请求体 JSON 对象'),
        userConfirmed: z.boolean().optional().describe('写操作已向用户确认时为 true')
      })
    },
    async args => {
      try {
        const result = await services.invoke.callApi(args || {}, ctx);
        return textResult(result.text, !!result.isError);
      } catch (e) {
        return textResult(e.message || String(e), true);
      }
    }
  );
};

module.exports = { registerCoreTools, textResult };
