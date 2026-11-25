# @kne/fastify-mcp

Fastify MCP 宿主插件：无状态 Streamable HTTP、OpenAPI 能力索引、产品级全局 allowlist（REST 可维护）、根目录 `MCP.md` 安装引导。

## 安装

```bash
npm i @kne/fastify-mcp
```

Peer：`fastify`、`@kne/fastify-sequelize`、`@kne/fastify-namespace`、`fastify-plugin`。宿主需已注册 `@fastify/swagger`（供 OpenAPI 索引）。

## 快速接入

```js
const path = require('node:path');

fastify.register(require('@kne/fastify-mcp'), {
  prefix: '/api/v1',
  adminPrefix: '/api/v1/admin/mcp',
  guideMarkdownPath: path.join(__dirname, '../MCP.md'),
  guideRootDir: path.join(__dirname, '..'),
  deny: ['**/client/secret/**'],
  authenticate: async request => {
    /* 校验 MCP Bearer，写入 request.userInfo */
  },
  authenticateAdmin: async request => {
    /* 超管鉴权，维护 allowlist */
  },
  createInvokeHeaders: ctx => {
    /* inject 时附加内部凭证（如一次性 nonce） */
    return {};
  },
  registerExtraTools: (mcpServer, { ctx }) => {
    /* 可选：PDF 等业务特例工具 */
  }
});
```

## MCP 工具（固定 3 个）

| 工具 | 作用 |
|------|------|
| `describe_capabilities` | 引导 MD + 已开启能力目录 |
| `search_apis` | 搜索 allowlist 内接口 |
| `call_api` | `schema` / `invoke` |

## HTTP

- `POST {prefix}/mcp` — MCP
- `GET {prefix}/mcp/guide` — 安装引导 Markdown
- `GET/POST/PATCH/DELETE/PUT {adminPrefix}/mcp-allowlist*` — 全局开关
- `GET {adminPrefix}/mcp-catalog/operations` — OpenAPI 候选目录

## 开发

```bash
npm test
```
