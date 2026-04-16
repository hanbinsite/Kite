# 待优化问题清单

> 发现时间：2026-04-16（修复26项文档缺陷后）

## 高优先级（影响 AI 正确生成代码）

### 1. 04b: §5.4 与 §4.5.5 的 send_http_request 重复且矛盾
**位置**：`04b-API设计.md` §5.4（流式版本，完整代码） vs §4.5.5（旧版本，不完整）
**问题**：§4.5.5 的 send_http_request 没有流式逻辑，与 §5.4 的流式架构矛盾
**建议**：删除 §4.5.5，保留 §5.4 流式版本

### 2. 04b: init_app_state 缺少 cookie_jar 和 app_handle
**位置**：`04b-API设计.md` §4.5.3 `init_app_state` 函数
**问题**：
- `cookie_jar` 未在 `HttpClientState` 初始化中设置
- `app_handle` 未在 `AppState` 初始化中设置（但 §4.5.1 定义了）
**建议**：补充：
```rust
let http_client = HttpClientState {
    client: reqwest::Client::builder()
        .cookie_store(true)
        .build()
        .map_err(|e| e.to_string())?,
    cookie_jar: Arc::new(reqwest::cookie::Jar::default()),
};

Ok(AppState {
    data_dir: data_dir.to_path_buf(),
    app_handle: app.clone(), // 需要传入 app handle
    http_client,
    ...
})
```

### 3. 04a: # API Client 技术方案 重复标题
**位置**：`04a-架构设计.md` 第 1-4 行
**问题**：文档前 4 行有重复标题：
```markdown
# API Client 架构设计
> 本文档拆分自原 04-技术方案.md...
# API Client 技术方案
```
**建议**：删除第 4 行的 `# API Client 技术方案`

### 4. 04b: WssErrorPayload 拼写错误
**位置**：`04b-API设计.md` line 517
**问题**：`WssErrorPayload` 应为 `WsErrorPayload`
```typescript
return listen<WssErrorPayload>('ws-error', (e) => handler(e.payload));
//                    ↑ 多了一个 s
```

### 5. 多处 currentResponse 引用旧模式
| 位置 | 行号 | 说明 |
|------|------|------|
| `08-开发指南.md` | 2658, 2660 | §9.3 RequestStore 示例用 `currentResponse` 而非 `responses[tabId]` |
| `09-Phase1任务清单.md` | 425, 427 | 任务 1.14 描述用 `currentResponse` |
| `12-状态持久化.md` | 110 | "更新 RequestStore.currentResponse" 描述 |

**建议**：全部更新为多 Tab 模式 `responses[tabId]`

---

## 中优先级（文档一致性/可读性）

### 6. 04a: §3.1/§3.2 编号跳跃（3.1 → 3.6）
**位置**：`04a-架构设计.md`
**问题**：§3.1 HTTP 请求实现、§3.2 结束，然后直接跳到 §3.6（中间缺 §3.3-§3.5）
**原因**：原本的 §3.x 被拆分或重排，但编号未重新整理
**建议**：后续整理时统一编号，或将 §3.6/§3.7/§3.8 改为 §3.3/§3.4/§3.5

### 7. 04b: §5.4 后直接接 §4.5（编号体系混乱）
**位置**：`04b-API设计.md`
**问题**：§5.1 → §5.2 → §5.3 → §5.4，然后突然是 §4.5.1 → §4.5.2... 编号体系不一致
**原因**：API 设计部分编号从 §5 开始，AppState 部分编号从 §4.5 开始
**建议**：统一为一种编号体系（建议 §5.1 → §5.x，§6 AppState）

### 8. 04c: Storage 结构与 AppState.db 重复定义
**位置**：`04c-安全与性能.md` §3.5 Storage 定义 vs `04b-API设计.md` §4.5.1 AppState
**问题**：两个地方都定义了 `db: rusqlite::Connection` 相关内容，可能导致维护歧义
**建议**：Storage 作为独立模块，AppState 通过组合使用 Storage

### 9. 04a: 架构图 sodium 残留
**位置**：`04a-架构设计.md` line 123
**问题**：架构图注释写的是 `sodium` 但实际使用 `argon2 + aes-gcm`
```markdown
│ │ │ │ │ File FS) │ │ sodium) │ │
```
**建议**：改为 `│ │ │ │ │ File FS) │ │ argon2) │ │`

---

## 低优先级（可后续改进）

### 10. 04a: .eslintrc.js 应为 eslint.config.js
**位置**：`04a-架构设计.md` line 238
**问题**：目录结构列出了 `.eslintrc.js`，但项目使用 ESLint 9.x flat config
**建议**：改为 `eslint.config.js`

### 11. 06-技术方案深度分析报告.md: 引用旧技术选型
**位置**：`06-技术方案深度分析报告.md` 多处
**问题**：该文档描述了"现状问题"（Axios, grpc-web, vm2 等），但这些已被修复
**建议**：
- 方案 A：保留该文档作为历史记录，标注"已修复"
- 方案 B：删除或更新该文档，反映当前正确选型

### 12. README.md: 文档列表中可能有过期引用
**建议**：检查 README.md 中各文档的描述是否与实际内容匹配

### 13. 代码示例中 futures-util 未在 imports 中说明
**位置**：`04a-架构设计.md` §3.8 SSE 示例
**问题**：`use futures_util::StreamExt;` 但 Cargo.toml 未列出 futures-util
**建议**：在 Cargo.toml 注释中说明 `futures-util = "0.3"`（已在 04c 修复，但可能需要同步）

---

## 已确认无问题（无需修复）

- graphql-request ✅ 正确使用（非 Apollo Client）
- rquickjs ✅ 正确使用（非 vm2/isolated-vm）
- reqwest ✅ 正确使用（非 Axios）
- tonic ✅ 正确使用（非 grpc-web）
- 路径校验 ✅ 已添加
- 多 Tab RequestStore ✅ 已修复
- SQLite spawn_blocking ✅ 已修复
- Cookie Jar 桥接 ✅ 已添加
- SSE 模块 ✅ 已添加
- 脚本超时 ✅ 已修复
- 亮色主题 CSS ✅ 已添加
- i18n 方案 ✅ 已添加

---

*最后更新：2026-04-16*