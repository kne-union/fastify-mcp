#### 配置选项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `name` | string | `'mcp'` | 命名空间，通过 `fastify.<name>` 访问 |
| `prefix` | string | `'/api/v1'` | MCP / guide / mcp-keys 路由前缀 |
| `adminPrefix` | string | `` `${prefix}/admin/mcp` `` | allowlist / catalog 管理前缀 |
| `dbTableNamePrefix` | string | `'t_mcp_'` | 表名前缀（allowlist、key） |
| `deny` | string[] | 含 `secret` 相关规则 | 永远不对 MCP 开放的 path 规则 |
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
| `seedsDir` | string | `null` | 业务仓 allowlist 种子目录；sync 后自动 `includeSeeds` |

MCP 进门鉴权由库固定实现（`Authorization: Bearer <keyId>.<secret>`），**不提供**业务可覆盖的 `authenticate`。

须先注册 `@kne/fastify-intl`；本插件通过 namespace `locale` 挂载 `zh-CN` / `en-US`，service 内用 `fastify.intl.createError` 抛错，按请求语言翻译。

#### 命名空间注册

本插件通过 `@kne/fastify-namespace` 注册到 `options.name`（默认 `mcp`）命名空间。常用访问：

- `fastify.mcp.services.allowlist` — allowlist CRUD / sync / `includeSeeds`
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

await fastify.register(require('@kne/fastify-intl'), { defaultLocale: 'zh-CN' });

fastify.register(mcp, {
  name: 'mcp',
  prefix: '/api/v1',
  adminPrefix: '/api/v1/admin/mcp',
  dbTableNamePrefix: 't_mcp_',
  deny: mcp.recommendDeny,
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
| 加载时机 | sequelize `syncPromise` 完成后自动 `includeSeeds`；目录不存在则跳过 |
| 失败策略 | 单条与 swagger/deny 校验失败时打日志并跳过，不中断启动 |

#### 规则说明

1. 未进入 allowlist（或 `enabled=false` / `status=orphan`）的接口对 MCP 不可见、不可 invoke
2. deny 列表内路径不可加入 allowlist，也不进入 catalog
3. 写操作可在 allowlist 上标记 `confirm=true`，invoke 须传 `userConfirmed=true`
4. 二进制 / 文件流不要走通用 `call_api` invoke，应使用专用工具或 REST 上传换 fileId
