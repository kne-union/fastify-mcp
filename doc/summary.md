# @kne/fastify-mcp

Fastify MCP 宿主插件：无状态 Streamable HTTP、OpenAPI 能力索引、产品级全局 allowlist（REST 可维护）、根目录引导 Markdown。

## 能力

- `POST {prefix}/mcp`：MCP 端点（官方 SDK，无状态）
- `GET {prefix}/mcp/guide`：读取宿主配置的 `MCP.md`（安装页 / 客户端）
- `GET {adminPrefix}/mcp-catalog/operations`：OpenAPI 候选目录（含 enabled）
- `GET/POST/PATCH/DELETE {adminPrefix}/mcp-allowlist`：全局开关
- `PUT {adminPrefix}/mcp-allowlist/batch`：批量 upsert
- `POST {adminPrefix}/mcp-allowlist/sync`：与 swagger 对账

默认 `prefix=/api/v1`，`adminPrefix={prefix}/admin/mcp`。

## MCP 工具（固定 3 个）

1. `describe_capabilities` — 引导 MD + 已开启能力目录
2. `search_apis` — 搜索已开启接口
3. `call_api` — `mode=schema|invoke`
