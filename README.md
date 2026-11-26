# fastify-mcp

### 描述

Fastify MCP 宿主插件：Streamable HTTP、OpenAPI 能力索引、全局 allowlist REST、安装引导 Markdown

### 关键词

fastify, mcp, model-context-protocol, openapi, allowlist, fastify-plugin

### 安装

```shell
npm i --save @kne/fastify-mcp
```

### 概述

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


### 示例

### API

#### 配置选项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `name` | string | `'mcp'` | 命名空间，通过 `fastify.<name>` 访问 |
| `prefix` | string | `'/api/v1'` | MCP / guide / mcp-keys 路由前缀 |
| `adminPrefix` | string | `` `${prefix}/admin/mcp` `` | allowlist / catalog 管理前缀 |
| `dbTableNamePrefix` | string | `'t_mcp_'` | 表名前缀（allowlist、key） |
| `deny` | string[] | `recommendDeny`（secret + export-**） | 永远不对 MCP 开放的 path 规则；未传即用推荐默认，业务一般不必再传 |
| `catalogPathPrefix` | string | `undefined` | Catalog 仅保留此前缀下的 OpenAPI path |
| `guideMarkdownPath` | string | `` `path.resolve(process.cwd(), 'MCP.md')` `` | 引导 Markdown；默认 Node 启动根目录下的 `MCP.md` |
| `guideRootDir` | string | `process.cwd()` | 读文件允许根，防目录穿越；默认与启动根一致 |
| `maxGuideBytes` | number | `262144` | 引导文件大小上限（字节） |
| `maxDescribeGuideChars` | number | `8000` | `describe_capabilities` 内嵌引导截断长度 |
| `bodyLimit` | number | `15MB` | MCP POST body 上限 |
| `serverInfo` | object | `{ name, version }` | MCP initialize 的 serverInfo |
| `instructions` | string | 内置短说明 | MCP initialize instructions |
| `resolveUser` | function | — | **必填**，`(subjectId) => userInfo`；Bearer 验签后写入 `request.userInfo` |
| `authenticateUser` | function | — | **必填**，密钥管理页登录鉴权，须写入 `request.userInfo.id` |
| `authenticateAdmin` | function | 关闭 | allowlist / catalog 管理认证；未配置时不鉴权 |
| `createInvokeHeaders` | function | — | `(ctx) => headers`，inject 时附加 |
| `registerExtraTools` | function | — | `(mcpServer, ctx) => void` 注册特例工具 |
| `getSwagger` | function | `() => fastify.swagger()` | 自定义 OpenAPI 文档来源 |
| `seedsDir` | string | `null` | 业务仓 allowlist 种子目录；ready 后自动 `includeSeeds` |
| `seedFromSwagger` | boolean \| object | `null` | ready 后按 swagger 投影写入 allowlist；见下方约定 |

MCP 进门鉴权由库固定实现（`Authorization: Bearer <keyId>.<secret>`），**不提供**业务可覆盖的 `authenticate`。

须先注册 `@kne/fastify-intl`；本插件通过 namespace `locale` 挂载 `zh-CN` / `en-US`，service 内用 `fastify.intl.createError` 抛错，按请求语言翻译。

#### 命名空间注册

本插件通过 `@kne/fastify-namespace` 注册到 `options.name`（默认 `mcp`）命名空间。常用访问：

- `fastify.mcp.services.allowlist` — allowlist CRUD / `includeSeeds` / `seedFromSwagger`
- `fastify.mcp.services.key` — MCP 密钥 create / list / remove / verifyBearer
- `fastify.mcp.services.capability` — 索引 / 搜索 / describe
- `fastify.mcp.services.invoke` — `callApi`
- `fastify.mcp.models.allowlist` / `fastify.mcp.models.key` — 数据模型

导出辅助：

- `require('@kne/fastify-mcp').recommendDeny`
- `require('@kne/fastify-mcp').readGuideMarkdown`

#### HTTP 路由

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `{prefix}/mcp` | MCP Streamable HTTP（无状态）；须 Bearer |
| `GET` / `DELETE` | `{prefix}/mcp` | 固定 405 |
| `GET` | `{prefix}/mcp/guide` | 返回引导 Markdown；须 Bearer |
| `POST` | `{prefix}/mcp-keys` | 创建密钥（明文 secret 仅一次）；须 `authenticateUser` |
| `GET` | `{prefix}/mcp-keys` | 当前用户密钥列表（secret 打码） |
| `DELETE` | `{prefix}/mcp-keys/:id` | 删除（作废）密钥 |
| `GET` | `{adminPrefix}/mcp-catalog/operations` | OpenAPI 候选目录（含 enabled） |
| `GET` | `{adminPrefix}/mcp-allowlist` | allowlist 分页列表 |
| `GET` | `{adminPrefix}/mcp-allowlist/:id` | 详情 |
| `POST` | `{adminPrefix}/mcp-allowlist` | 开启一条 |
| `PATCH` | `{adminPrefix}/mcp-allowlist/:id` | 更新 |
| `DELETE` | `{adminPrefix}/mcp-allowlist/:id` | 删除 |
| `PUT` | `{adminPrefix}/mcp-allowlist/batch` | 批量 upsert |
#### MCP 工具

| 工具 | 说明 |
|------|------|
| `describe_capabilities` | 引导 MD + 已开启能力目录 |
| `search_apis` | 按 query / tag / scenario 搜索已开启接口 |
| `call_api` | `mode=schema` 看参数；`mode=invoke` 执行（`confirm` 须 `userConfirmed`） |

#### 自定义配置示例

```javascript
const path = require('node:path');
const mcp = require('@kne/fastify-mcp');

await fastify.register(require('@kne/fastify-intl'), { defaultLocale: 'zh-CN' });

fastify.register(mcp, {
  name: 'mcp',
  prefix: '/api/v1',
  adminPrefix: '/api/v1/admin/mcp',
  dbTableNamePrefix: 't_mcp_',
  // deny 默认即 recommendDeny，业务一般不必再传
  seedsDir: path.resolve(__dirname, './mcpSeeds'),
  authenticateUser: async request => {
    /* 登录校验后 request.userInfo = { id, ... } */
  },
  resolveUser: async subjectId => {
    return await userModel.findByPk(subjectId);
  },
  // authenticateAdmin 默认关闭；生产建议配置超管鉴权
  createInvokeHeaders: ctx => ({ 'x-mcp-internal-auth': '...' }),
  registerExtraTools: (mcpServer, { ctx }) => {
    /* 如 get_report_pdf 等业务特例 */
  }
});
```

#### 密钥约定

| 项 | 说明 |
|----|------|
| Bearer | `Authorization: Bearer <keyId>.<secret>` |
| 存储 | 仅存 `sha256(secret)`；创建响应含一次性明文 secret |
| 主体 | `subjectId = String(request.userInfo.id)`（由 `authenticateUser` 写入） |
| 作废 | `DELETE {prefix}/mcp-keys/:id` |

#### seedsDir 约定

| 项 | 说明 |
|----|------|
| 目录位置 | **业务仓**内，建议 `./mcpSeeds`；通过 `seedsDir` 传入绝对路径 |
| 文件类型 | `.js`（`module.exports = [...]`）或 `.json`（数组） |
| 条目字段 | `{ method, path, scenarios?, confirm?, enabled?, operationId? }` |
| 加载时机 | **Fastify ready 之后**（需 `.swagger()`）由库内 `runAfterReady` 后台执行；完成态见 `fastify.mcp.seedPromise` |
| upsert | 走 `upsertSeed`：`source=seed`；已有 `source=manual` 只刷 `operationId`，不覆盖 `enabled` / `scenarios` / `confirm` |
| disableMissing | 默认 `true`（对齐 message `includeTemplate`）：本次未出现的同组种子标 `status=missing` 且 `enabled=false` |
| 失败策略 | 单条与 swagger/deny 校验失败时打日志并跳过，不中断启动 |

#### seedFromSwagger 约定

| 项 | 说明 |
|----|------|
| 配置 | `seedFromSwagger: true` 或 `{ pathPrefix?, getScenarios?, getConfirm?, enabled?, disableMissing? }` |
| 默认场景 | 读 `x-mcp-scenarios` / `mcp.scenarios`，否则 OpenAPI `tags`；`getScenarios` 可覆盖 |
| 默认 confirm | `x-mcp-confirm` / `mcp.confirm`，否则非 GET 为 `true`；`getConfirm` 可覆盖 |
| 默认 enabled | `false`（对 MCP 开放默认全关；显式 `enabled: true` 才整批打开） |
| 作用 | ready 后按 OpenAPI 投影 `upsertSeed`（`seedGroup=swagger`）；与 `seedsDir` 可同时开 |
| 完成态 | `await fastify.mcp.seedPromise`；MCP 读能力面（`listActive`）会 `ensureSeeded`，避免首波空目录 |
| 注意 | 宿主**不要**再写 `onReady + setImmediate`；长耗时 seed 不阻塞 pluginTimeout |

路由 schema 示例（场景优先 `x-mcp-scenarios`，否则 `tags`）：

```javascript
fastify.get('/api/v1/client/project/list', {
  schema: {
    tags: ['项目'],
    'x-mcp-scenarios': ['建项目'],
    'x-mcp-confirm': false
  }
}, handler);
```

#### allowlist 字段（种子对账）

| 字段 | 说明 |
|------|------|
| `source` | `seed` \| `manual`；管理端 create/patch 配置后记为 `manual` |
| `seedKey` | 稳定键，如 `GET /api/v1/client/ping` |
| `seedGroup` | `swagger` \| `file`；`disableMissing` 只对账同组 |
| `status` | `active` \| `orphan`（swagger 对账）\| `missing`（种子对账未命中） |

#### 规则说明

1. 未进入 allowlist（或 `enabled=false` / `status` 非 `active`）的接口对 MCP 不可见、不可 invoke
2. deny 列表内路径不可加入 allowlist，也不进入 catalog
3. 写操作可在 allowlist 上标记 `confirm=true`，invoke 须传 `userConfirmed=true`
4. 二进制 / 文件流不要走通用 `call_api` invoke，应使用专用工具或 REST 上传换 fileId
5. 种子重启**不会**覆盖人工禁用或人工改过的场景；删掉种子条目后同组残留会被标 `missing`
