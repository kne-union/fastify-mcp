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
- **全局 allowlist REST**：超管可 CRUD / batch / sync，未开启即不可见、不可调用
- **安装引导**：`GET {prefix}/mcp/guide` 安全读取宿主配置的 `MCP.md`
- **可扩展**：支持 `registerExtraTools`、`createInvokeHeaders`（如内部 nonce）对接业务特例

#### 使用场景

1. 业务系统向 Cursor / Claude 等 AI 客户端开放受控操作能力
2. 用 OpenAPI + 开关维护可调用接口，减少为每个接口注册 MCP 工具
3. 安装页展示 / 复制引导文档，统一人和 Agent 的使用说明
4. 多产品复用同一 MCP 宿主壳，业务仓只接认证与种子 allowlist

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
  guideMarkdownPath: path.join(__dirname, '../MCP.md'),
  guideRootDir: path.join(__dirname, '..'),
  authenticate: async request => {
    // 校验 MCP Bearer，写入 request.userInfo
  },
  authenticateAdmin: async request => {
    // 超管鉴权，维护 allowlist
  },
  createInvokeHeaders: () => {
    // inject 调用业务接口时附加内部凭证
    return {};
  }
});
```

#### 注意事项

1. 须先注册 `@kne/fastify-sequelize`，并建议注册 `@fastify/swagger` 以提供 OpenAPI
2. `authenticate` 必填；管理端接口依赖 `authenticateAdmin`
3. 默认 deny 含密钥等路径；导出文件流等勿放入 allowlist，应用专用工具
4. 引导 MD 只读配置路径，禁止目录穿越；不做在线编辑
5. README 由 `npm run build:md` 根据 `doc/` 生成，请勿手改 README 中由工具生成的章节

#### 许可证

[ISC](https://opensource.org/licenses/ISC)


### 示例

### API

#### 配置选项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `name` | string | `'mcp'` | 命名空间，通过 `fastify.<name>` 访问 |
| `prefix` | string | `'/api/v1'` | MCP / guide 路由前缀 |
| `adminPrefix` | string | `` `${prefix}/admin/mcp` `` | allowlist / catalog 管理前缀 |
| `dbTableNamePrefix` | string | `'t_mcp_'` | allowlist 表名前缀 |
| `deny` | string[] | 含 `secret` 相关规则 | 永远不对 MCP 开放的 path 规则 |
| `catalogPathPrefix` | string | `undefined` | Catalog 仅保留此前缀下的 OpenAPI path |
| `guideMarkdownPath` | string | `undefined` | 引导 Markdown 文件路径 |
| `guideRootDir` | string | MD 所在目录 | 读文件允许根，防目录穿越 |
| `maxGuideBytes` | number | `262144` | 引导文件大小上限（字节） |
| `maxDescribeGuideChars` | number | `8000` | `describe_capabilities` 内嵌引导截断长度 |
| `bodyLimit` | number | `15MB` | MCP POST body 上限 |
| `serverInfo` | object | `{ name, version }` | MCP initialize 的 serverInfo |
| `instructions` | string | 内置短说明 | MCP initialize instructions |
| `authenticate` | function | — | **必填**，MCP POST 认证，写入 `request.userInfo` |
| `authenticateGuide` | function | 回退 `authenticate` | `GET .../mcp/guide` 认证 |
| `authenticateAdmin` | function | — | allowlist / catalog 管理认证 |
| `createInvokeHeaders` | function | — | `(ctx) => headers`，inject 时附加 |
| `registerExtraTools` | function | — | `(mcpServer, ctx) => void` 注册特例工具 |
| `getSwagger` | function | `() => fastify.swagger()` | 自定义 OpenAPI 文档来源 |

#### 命名空间注册

本插件通过 `@kne/fastify-namespace` 注册到 `options.name`（默认 `mcp`）命名空间。常用访问：

- `fastify.mcp.services.allowlist` — allowlist CRUD / sync
- `fastify.mcp.services.capability` — 索引 / 搜索 / describe
- `fastify.mcp.services.invoke` — `callApi`
- `fastify.mcp.models.allowlist` — 数据模型

导出辅助：

- `require('@kne/fastify-mcp').recommendDeny`
- `require('@kne/fastify-mcp').flowupRecommendedAllowlist`
- `require('@kne/fastify-mcp').readGuideMarkdown`

#### HTTP 路由

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `{prefix}/mcp` | MCP Streamable HTTP（无状态） |
| `GET` / `DELETE` | `{prefix}/mcp` | 固定 405 |
| `GET` | `{prefix}/mcp/guide` | 返回引导 Markdown |
| `GET` | `{adminPrefix}/mcp-catalog/operations` | OpenAPI 候选目录（含 enabled） |
| `GET` | `{adminPrefix}/mcp-allowlist` | allowlist 分页列表 |
| `GET` | `{adminPrefix}/mcp-allowlist/:id` | 详情 |
| `POST` | `{adminPrefix}/mcp-allowlist` | 开启一条 |
| `PATCH` | `{adminPrefix}/mcp-allowlist/:id` | 更新 |
| `DELETE` | `{adminPrefix}/mcp-allowlist/:id` | 删除 |
| `PUT` | `{adminPrefix}/mcp-allowlist/batch` | 批量 upsert |
| `POST` | `{adminPrefix}/mcp-allowlist/sync` | 与 swagger 对账 |

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

fastify.register(mcp, {
  name: 'mcp',
  prefix: '/api/v1',
  adminPrefix: '/api/v1/admin/mcp',
  dbTableNamePrefix: 't_mcp_',
  deny: mcp.recommendDeny,
  guideMarkdownPath: path.join(__dirname, '../MCP.md'),
  guideRootDir: path.join(__dirname, '..'),
  authenticate: async request => {
    /* Bearer 校验后 request.userInfo = ... */
  },
  authenticateAdmin: async request => {
    /* 超管校验 */
  },
  createInvokeHeaders: ctx => ({ 'x-mcp-internal-auth': '...' }),
  registerExtraTools: (mcpServer, { ctx }) => {
    /* 如 get_report_pdf 等业务特例 */
  }
});

// 首次导入推荐种子（flowup 场景）
// PUT /api/v1/admin/mcp/mcp-allowlist/batch
// body: { items: mcp.flowupRecommendedAllowlist }
```

#### 规则说明

1. 未进入 allowlist（或 `enabled=false` / `status=orphan`）的接口对 MCP 不可见、不可 invoke
2. deny 列表内路径不可加入 allowlist，也不进入 catalog
3. 写操作可在 allowlist 上标记 `confirm=true`，invoke 须传 `userConfirmed=true`
4. 二进制 / 文件流不要走通用 `call_api` invoke，应使用专用工具或 REST 上传换 fileId
