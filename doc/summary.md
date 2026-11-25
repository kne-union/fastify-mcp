#### 功能概述

`@kne/fastify-mcp` 是专为 Fastify 业务服务设计的 MCP（Model Context Protocol）宿主插件。它以无状态 Streamable HTTP 暴露固定的三个工具（说明 / 搜索 / 执行），能力面由产品级全局 allowlist 控制，接口说明复用宿主 OpenAPI（swagger），并支持通过根目录引导 Markdown 在安装时提供给 AI 客户端。

#### 核心特性

- **固定三工具**：`describe_capabilities`、`search_apis`、`call_api`（`schema` / `invoke`），避免工具面膨胀
- **OpenAPI 能力索引**：从 `fastify.swagger()` 投影候选接口，与 allowlist 求交后对 MCP 可见
- **全局 allowlist REST**：超管可 CRUD / batch / sync，未开启即不可见、不可调用
- **MCP 密钥**：库内签发与 Bearer 验签；业务只提供 `resolveUser` / `authenticateUser`
- **安装引导**：`GET {prefix}/mcp/guide` 安全读取宿主配置的 `MCP.md`
- **可扩展**：支持 `registerExtraTools`、`createInvokeHeaders`（如内部 nonce）对接业务特例

#### 使用场景

1. 业务系统向 Cursor / Claude 等 AI 客户端开放受控操作能力
2. 用 OpenAPI + 开关维护可调用接口，减少为每个接口注册 MCP 工具
3. 安装页展示 / 复制引导文档，统一人和 Agent 的使用说明
4. 多产品复用同一 MCP 宿主壳，业务仓只接用户解析与种子 allowlist

#### 基本用法

```javascript
const path = require('node:path');
const fastify = require('fastify')();

await fastify.register(require('@fastify/swagger'), {
  openapi: { info: { title: 'app', version: '1.0.0' } }
});
await fastify.register(require('@kne/fastify-sequelize'), {
  db: { dialect: 'sqlite', storage: './data.sqlite' }
});

await fastify.register(require('@kne/fastify-mcp'), {
  prefix: '/api/v1',
  seedsDir: path.resolve(__dirname, './mcpSeeds'),
  // 密钥管理页登录，须写入 request.userInfo.id
  authenticateUser: async request => {
    /* OIDC / account */
  },
  // Bearer 验签后：subjectId → 用户
  resolveUser: async subjectId => {
    return await userModel.findByPk(subjectId);
  },
  // authenticateAdmin 默认关闭；生产建议配置超管鉴权
  createInvokeHeaders: () => {
    return {};
  }
});
```

业务仓在 `mcpSeeds/` 下放 `.js` / `.json` 种子文件，导出 allowlist 数组，例如：

```javascript
// mcpSeeds/recommended.js
module.exports = [
  { method: 'GET', path: '/api/v1/client/project/list', scenarios: ['建项目'], confirm: false },
  { method: 'POST', path: '/api/v1/client/project/create', scenarios: ['建项目'], confirm: true }
];
```

启动并完成 sequelize sync 后，插件会调用 `services.allowlist.includeSeeds(seedsDir)` 导入（也可手动调用）。

Agent 使用 `Authorization: Bearer <keyId>.<secret>` 访问 `/mcp` 与 `/mcp/guide`；密钥由登录用户通过 `POST {prefix}/mcp-keys` 签发。

#### 注意事项

1. 须先注册 `@kne/fastify-sequelize`，并建议注册 `@fastify/swagger` 以提供 OpenAPI
2. `resolveUser`、`authenticateUser` 必填；MCP 进门鉴权由库固定实现，业务不可覆盖
3. `authenticateAdmin` 默认关闭（allowlist 管理端不鉴权），生产环境建议配置
4. 默认在 Node 启动根目录（`process.cwd()`）读取 `MCP.md`；可按需覆盖 `guideMarkdownPath` / `guideRootDir`
5. allowlist 种子放在业务仓 `seedsDir`（建议 `./mcpSeeds`），不要写进本库
6. 默认 deny 含密钥等路径；导出文件流等勿放入 allowlist，应用专用工具
7. 引导 MD 只读配置路径，禁止目录穿越；不做在线编辑
8. README 由 `npm run build:md` 根据 `doc/` 生成，请勿手改 README 中由工具生成的章节

#### 许可证

[ISC](https://opensource.org/licenses/ISC)
