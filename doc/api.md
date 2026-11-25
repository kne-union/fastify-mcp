# API

## 宿主注册选项

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

## 规则

- 未进入 allowlist（或 `enabled=false` / `status=orphan`）的接口对 MCP 不可见、不可 invoke
- deny 列表内路径不可加入 allowlist，也不进 catalog
- 引导 MD 只读配置路径，禁止目录穿越；不做在线编辑
