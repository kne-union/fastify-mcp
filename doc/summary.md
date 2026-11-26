#### 功能概述

`@kne/fastify-mcp` 是专为 Fastify 业务服务设计的 MCP（Model Context Protocol）宿主插件。它以无状态 Streamable HTTP 暴露固定的三个工具（说明 / 搜索 / 执行），能力面由产品级全局 allowlist 控制，接口说明复用宿主 OpenAPI（swagger），并支持通过根目录引导 Markdown 在安装时提供给 AI 客户端。

#### 核心特性

- **固定三工具**：`describe_capabilities`、`search_apis`、`call_api`（`schema` / `invoke`），避免工具面膨胀
- **OpenAPI 能力索引**：从 `fastify.swagger()` 投影候选接口，与 allowlist 求交后对 MCP 可见
- **全局 allowlist REST**：超管可 CRUD / batch；接口增删与默认场景由启动时 `seedFromSwagger` 对账，未开启即不可见、不可调用
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
await fastify.register(require('@kne/fastify-intl'), { defaultLocale: 'zh-CN' });
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

业务仓可二选一或同时用：

1. **`seedFromSwagger`**：按 OpenAPI 投影播种；默认场景取 `x-mcp-scenarios`（否则 `tags`），confirm 取 `x-mcp-confirm`（缺省则非 GET 为 true）
2. **`seedsDir`**：业务仓 `mcpSeeds/` 下放 `.js` / `.json` 显式条目

```javascript
// 推荐：在路由 schema 声明场景（seedFromSwagger 会读到）
fastify.get('/api/v1/client/project/list', {
  schema: {
    tags: ['项目'],
    'x-mcp-scenarios': ['建项目'],
    'x-mcp-confirm': false
  }
}, handler);

// 或 mcpSeeds/recommended.js 显式种子
module.exports = [
  { method: 'GET', path: '/api/v1/client/project/list', scenarios: ['建项目'], confirm: false }
];
```

Fastify ready 之后插件后台 `includeSeeds` / `seedFromSwagger`（`upsertSeed`，不覆盖 `source=manual`）；完成态见 `fastify.mcp.seedPromise`。MCP 读能力面会 `ensureSeeded`，避免首波空目录。种子对账默认 `disableMissing`：同组未再出现的条目标 `missing` 并禁用。

Agent 使用 `Authorization: Bearer <keyId>.<secret>` 访问 `/mcp` 与 `/mcp/guide`；密钥由登录用户通过 `POST {prefix}/mcp-keys` 签发。

#### Agent 使用指引（业务接入必读）

接入方与 Agent 均应按下列约定使用三工具，避免「目录为空 / 找不到接口 / 调错接口」：

1. **顺序**：`describe_capabilities` → `search_apis` → `call_api mode=schema` → `call_api mode=invoke`。不要凭记忆拼 path。
2. **禁止只靠无参 `search_apis`**：不传 `query` / `tag` / `scenario` 时返回按场景分组的目录，**每个场景最多展示 5 条**。接口多时目录会严重不全，必须带关键词搜索。
3. **allowlist 必须有 `scenarios`**：`seedFromSwagger` 默认从 `x-mcp-scenarios` / `tags` 带出；`seedsDir` / REST 创建时也要写场景标签。空场景会落入「未分类」，目录几乎不可用；`search_apis` 的 `query` 也会匹配 scenarios。
4. **检索词要对齐业务语义**：用场景名或接口 summary 里会出现的词；避免过宽单字。业务引导 `MCP.md` 应写清推荐 `scenario` / `query`，**不必罗列具体 path**。
5. **写操作**：allowlist `confirm=true` 时，Agent 须先向用户确认再传 `userConfirmed=true`。
6. **文件流 / 二进制**：默认 deny 已挡住 `**/export-**` 等；报告下载、上传等用 `registerExtraTools` 专用工具，不要塞进通用 `call_api`。

#### 注意事项

1. 须先注册 `@kne/fastify-intl`、`@kne/fastify-sequelize`，并建议注册 `@fastify/swagger` 以提供 OpenAPI
2. `resolveUser`、`authenticateUser` 必填；MCP 进门鉴权由库固定实现，业务不可覆盖；错误文案通过 intl 语言包（`zh-CN` / `en-US`）翻译
3. `authenticateAdmin` 默认关闭（allowlist 管理端不鉴权），生产环境建议配置
4. 默认在 Node 启动根目录（`process.cwd()`）读取 `MCP.md`；可按需覆盖 `guideMarkdownPath` / `guideRootDir`
5. 种子用 `seedsDir` 或 `seedFromSwagger`；重启不覆盖人工禁用/场景；宿主不要再写 `onReady + setImmediate`
6. 默认 `deny` 即 `recommendDeny`（密钥路径 + `**/export-**`）；业务通常不必再传；导出文件流等勿放入 allowlist，应用专用工具
7. 引导 MD 只读配置路径，禁止目录穿越；不做在线编辑
8. README 由 `npm run build:md` 根据 `doc/` 生成，请勿手改 README 中由工具生成的章节

#### 许可证

[ISC](https://opensource.org/licenses/ISC)
