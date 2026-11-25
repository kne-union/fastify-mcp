# MCP 使用引导

本服务通过 **3 个工具** 暴露已开启的业务接口（全局 allowlist），不要假设所有 OpenAPI 都可调用。

## 工具

1. `describe_capabilities` — 阅读本引导与已开启能力目录  
2. `search_apis` — 按关键词 / 场景搜索已开启接口  
3. `call_api` — `mode=schema` 看参数；`mode=invoke` 执行  

## 用法

```text
describe_capabilities
  → search_apis({ query: "..." })
  → call_api({ mode: "schema", operationId 或 method+path })
  → 向用户确认（若 confirm=true）
  → call_api({ mode: "invoke", ..., userConfirmed: true })
```

## 禁忌

- 不要调用未出现在 search 结果中的路径  
- 密钥管理、文件流导出等接口默认不可用  
- 写操作（邀请、创建、删除等）执行前必须向用户确认  
