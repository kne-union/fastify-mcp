# fastify-mcp

### 描述

Fastify MCP host plugin: Streamable HTTP, OpenAPI index, global allowlist REST, install guide MD

### 关键词

fastify, mcp, model-context-protocol, openapi, allowlist, fastify-plugin

### 安装

```shell
npm i --save @kne/fastify-mcp
```

### 概述

#### @kne/fastify-mcp

Fastify MCP 宿主插件：无状态 Streamable HTTP、OpenAPI 能力索引、产品级全局 allowlist（REST 可维护）、根目录引导 Markdown。

##### 能力

- `POST {prefix}/mcp`：MCP 端点（官方 SDK，无状态）
- `GET {prefix}/mcp/guide`：读取宿主配置的 `MCP.md`（安装页 / 客户端）
- `GET {adminPrefix}/mcp-catalog/operations`：OpenAPI 候选目录（含 enabled）
- `GET/POST/PATCH/DELETE {adminPrefix}/mcp-allowlist`：全局开关
- `PUT {adminPrefix}/mcp-allowlist/batch`：批量 upsert
- `POST {adminPrefix}/mcp-allowlist/sync`：与 swagger 对账

默认 `prefix=/api/v1`，`adminPrefix={prefix}/admin/mcp`。

##### MCP 工具（固定 3 个）

1. `describe_capabilities` — 引导 MD + 已开启能力目录
2. `search_apis` — 搜索已开启接口
3. `call_api` — `mode=schema|invoke`

##### 快速接入

```js
const path = require('node:path');
const { flowupRecommendedAllowlist, recommendDeny } = require('@kne/fastify-mcp');

fastify.register(require('@kne/fastify-mcp'), {
  prefix: '/api/v1',
  adminPrefix: '/api/v1/admin/mcp',
  guideMarkdownPath: path.join(__dirname, '../MCP.md'),
  guideRootDir: path.join(__dirname, '..'),
  deny: recommendDeny,
  authenticate: async request => {
    /* 校验 MCP Bearer，写入 request.userInfo */
  },
  authenticateAdmin: async request => {
    /* 超管鉴权，维护 allowlist */
  },
  createInvokeHeaders: ctx => {
    /* inject 时附加内部凭证（如一次性 nonce） */
    return {};
  }
});

// 首次可导入推荐种子：
// PUT /api/v1/admin/mcp/mcp-allowlist/batch  body: { items: flowupRecommendedAllowlist }
```


### 示例

### API

#### API

##### 宿主注册选项

| 选项 | 说明 |
|------|------|
| `authenticate` | **必填**，MCP POST 认证，写入 `request.userInfo` |
| `authenticateGuide` | 引导 GET 认证，默认回退 `authenticate` |
| `authenticateAdmin` | allowlist / catalog 管理认证 |
| `createInvokeHeaders` | `(ctx) => headers`，inject 调用业务接口时附加（如内部 nonce） |
| `guideMarkdownPath` | 引导 MD 路径 |
| `guideRootDir` | 读文件允许根，默认 MD 所在目录 |
| `deny` | 永远拒绝的 path 规则 |
| `prefix` | MCP / guide 前缀，默认 `/api/v1` |
| `adminPrefix` | 管理 API 前缀，默认 `{prefix}/admin/mcp` |
| `registerExtraTools` | `(mcpServer, ctx) => void` 注册业务特例工具 |
| `getSwagger` | 默认 `fastify.swagger()` |
| `serverInfo` / `instructions` | MCP initialize 元信息 |

##### 规则

- 未进入 allowlist（或 `enabled=false` / `status=orphan`）的接口对 MCP 不可见、不可 invoke
- deny 列表内路径不可加入 allowlist，也不进 catalog
- 引导 MD 只读配置路径，禁止目录穿越；不做在线编辑
