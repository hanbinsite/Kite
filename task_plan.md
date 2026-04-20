# Task Plan — Phase 1 Bug 修复 + Phase 2 核心请求功能

> 目标：修复 Phase 1 遗留问题，完成 Phase 2 核心请求功能（2.01-2.22）
> 创建时间: 2026-04-20

---

## Phase 0: Phase 1 遗留 Bug 修复

### 0.1 修复 path traversal 返回错误码
- **文件**: `apps/desktop/src-tauri/src/commands/file_ops.rs:43`
- **问题**: `validate_path_within_app_data` 返回 `AppError::internal(...)` 而非 `AppError::storage_path_traversal(...)`
- **修复**: 改为 `AppError::storage_path_traversal(...)`
- **状态**: pending

### 0.2 修复 follow_redirects / verify_ssl 死代码
- **文件**: `apps/desktop/src-tauri/src/commands/http.rs`
- **问题**: `RequestSettings.follow_redirects` 和 `verify_ssl` 字段存在但从未应用到 reqwest
- **修复**: 
  - 每次请求时根据 settings 构建新 Client（或使用 `ClientBuilder` 配置 redirect policy）
  - `verify_ssl=false` 时调用 `.danger_accept_invalid_certs(true)`
  - `follow_redirects=false` 时使用 `.redirect(Policy::none())`
  - 添加 `max_redirects` 字段
- **状态**: pending

### 0.3 移除未使用的 chrono 依赖
- **文件**: `apps/desktop/src-tauri/Cargo.toml`
- **问题**: chrono 声明但从未使用
- **修复**: 从 Cargo.toml 移除 chrono
- **状态**: pending

### 0.4 添加 settings get/set Tauri Commands
- **文件**: `apps/desktop/src-tauri/src/commands/history.rs` (新建 `settings` 模块或放在 history 中)
- **问题**: `Storage::get_setting/set_setting` 方法存在但无 Tauri 命令暴露
- **修复**: 新增 `get_setting` / `set_setting` commands
- **状态**: pending

### 0.5 添加 cookie_jar CRUD 到 Storage + Commands
- **文件**: `apps/desktop/src-tauri/src/storage/mod.rs`, 新建 `commands/cookie.rs`
- **问题**: cookie_jar 表存在但无 CRUD 方法和命令
- **修复**: 添加 insert/query/delete/clear cookies + 注册 Tauri commands
- **状态**: pending

### 0.6 类型去重 — 统一 IPC 接口类型
- **文件**: `packages/types/src/index.ts`, `packages/core/src/http/index.ts`, `apps/desktop/src/stores/request-store.ts`
- **问题**: Header/QueryParam/BodyConfig 等类型在 types 和 core/http 中重复定义
- **修复**: 以 `@api-client/types` 为权威来源，core/http 的 IPC 接口只定义 snake_case 映射层
- **状态**: pending

### 0.7 补全历史命令 — search + clear + delete
- **文件**: `apps/desktop/src-tauri/src/commands/history.rs`, `storage/mod.rs`
- **问题**: 历史只有 insert/query，无 search/clear/delete
- **修复**: 添加 `search_history`, `clear_history`, `delete_history` 方法 + commands
- **状态**: pending

---

## Phase 1: Rust HTTP 客户端完整实现 (2.06 + 2.07)

### 1.1 Auth 注入到 HTTP 请求
- **文件**: `apps/desktop/src-tauri/src/commands/http.rs`
- **内容**: 
  - 新增 `AuthConfig` 结构体（使用 `#[serde(tag = "type", content = "config")]` 外部标签）
  - `HttpRequestConfig` 添加 `auth` 字段
  - send_http_request 中根据 auth type 注入 Header/Query：
    - Bearer → `Authorization: Bearer {token}`
    - Basic → `Authorization: Basic base64(user:pass)`
    - APIKey → 根据 addTo 注入 header 或 query param
- **状态**: pending

### 1.2 Multipart/form-data Body 支持
- **文件**: `apps/desktop/src-tauri/src/commands/http.rs`
- **内容**:
  - BodyConfig 新增 `formdata: Vec<FormDataParam>` 字段
  - mode=formdata 时构建 `reqwest::multipart::Form`
  - text 字段用 `.text()`, file 字段用 `.file()` 或 `.part()`
- **状态**: pending

### 1.3 URL-encoded Body 支持
- **文件**: `apps/desktop/src-tauri/src/commands/http.rs`
- **内容**:
  - BodyConfig 新增 `urlencoded: Vec<UrlEncodedParam>` 字段
  - mode=urlencoded 时构建 `reqwest::Body::from(urlencoded_string)`
- **状态**: pending

### 1.4 请求设置完全生效
- **文件**: `apps/desktop/src-tauri/src/commands/http.rs`
- **内容**:
  - RequestSettings 新增 `max_redirects: u32` 字段
  - follow_redirects=false → `.redirect(Policy::none())`
  - follow_redirects=true → `.redirect(Policy::limited(max_redirects))`
  - verify_ssl=false → `.danger_accept_invalid_certs(true)`
  - 每次请求构建新的 Client（因 redirect/SSL 是 Client 级别配置）
- **状态**: pending

### 1.5 前端 Auth 配置接入 Store + IPC
- **文件**: `apps/desktop/src/stores/request-store.ts`, `apps/desktop/src/components/workbench/RequestPanel.tsx`
- **内容**:
  - RequestData 新增 `auth: AuthConfig` 字段
  - Auth tab 表单绑定到 store
  - sendRequest 时将 auth 传入 IpcHttpRequestConfig
- **状态**: pending

### 1.6 前端 RequestSettings 接入 maxRedirects
- **文件**: 同上
- **内容**: Settings tab 添加 Max Redirects 输入框
- **状态**: pending

---

## Phase 2: Body 编辑器实现 (2.10-2.14)

### 2.1 form-data 编辑器
- **文件**: `apps/desktop/src/components/request/FormDataEditor.tsx` (新建)
- **内容**: Key-Value 表格 + Type(text/file) 列 + 文件选择按钮
- **状态**: pending

### 2.2 urlencoded 编辑器
- **文件**: 复用 KeyValueEditor，添加 URL 编码/解码 + Bulk Edit
- **状态**: pending

### 2.3 Raw Body 编辑器 — CodeMirror 6 集成
- **文件**: `apps/desktop/src/components/editor/InlineEditor.tsx` (新建)
- **内容**: CodeMirror 6 + JSON/XML/HTML 语法高亮 + JSON 格式化 + 变量高亮
- **状态**: pending

### 2.4 GraphQL 编辑器
- **文件**: `apps/desktop/src/components/editor/GraphQLEditor.tsx` (新建)
- **内容**: Query + Variables 编辑器（基于 CodeMirror）
- **状态**: pending

### 2.5 Body Tab 各模式编辑器接入
- **文件**: `apps/desktop/src/components/workbench/RequestPanel.tsx`
- **内容**: 将 2.1-2.4 的编辑器接入 Body Tab，替换 textarea
- **状态**: pending

---

## Phase 3: 变量解析引擎 (2.08)

### 3.1 5 层变量解析引擎
- **文件**: `packages/core/src/environment/resolver.ts` (新建)
- **内容**:
  - 解析顺序: Local > Data > Environment > Collection > Global
  - 嵌套变量 `{{base{{env}}Url}}` 两轮解析
  - 动态变量: `$guid`, `$timestamp`, `$randomInt`, `$randomEmail`
  - 未找到变量保持原样
- **状态**: pending

### 3.2 变量解析接入 sendRequest 流程
- **文件**: `apps/desktop/src/stores/request-store.ts`
- **内容**: 发送前用 resolver 解析 URL/Headers/Body 中的 `{{var}}`
- **状态**: pending

---

## Phase 4: 响应查看器增强 (2.15-2.18)

### 4.1 JSON 查看器（折叠/搜索）
- **文件**: `apps/desktop/src/components/response/JsonViewer.tsx` (新建)
- **内容**: 树形 JSON 渲染 + 折叠/展开 + Ctrl+F 搜索 + 行号 + Copy
- **状态**: pending

### 4.2 Response Cookies 解析
- **文件**: `apps/desktop/src/components/workbench/ResponsePanel.tsx`
- **内容**: 从 Set-Cookie 响应头解析 cookies，在 Cookies tab 展示
- **状态**: pending

### 4.3 Response Headers 搜索 + 复制
- **文件**: `apps/desktop/src/components/response/ResponseHeadersTab.tsx` (新建)
- **内容**: Headers 表格 + 搜索过滤 + 单个/全部复制
- **状态**: pending

---

## Phase 5: 集合管理 + 环境变量 (2.19-2.22)

### 5.1 集合数据模型重构 — 文件夹嵌套
- **文件**: `apps/desktop/src-tauri/src/commands/collection.rs`
- **内容**: CollectionFile.requests → CollectionFile.items: Vec<CollectionItem>，支持 folder 嵌套
- **状态**: pending

### 5.2 集合树组件
- **文件**: `apps/desktop/src/components/sidebar/CollectionTree.tsx` (新建)
- **内容**: 树形渲染 + 展开/折叠 + dnd-kit 拖拽 + 虚拟滚动
- **状态**: pending

### 5.3 环境变量编辑器
- **文件**: `apps/desktop/src/components/environment/EnvironmentEditor.tsx` (新建)
- **内容**: 三列(Key/Initial/Current)表格 + secret 类型 + 对比显示
- **状态**: pending

### 5.4 环境选择器增强
- **文件**: `apps/desktop/src/components/url-bar/EnvSelector.tsx`
- **内容**: 新建/编辑/删除入口 + ⌘E 快捷键
- **状态**: pending

---

## Phase 6: 验证

### 6.1 构建验证
- `pnpm typecheck` 零错误
- `pnpm lint` 零 error
- `cargo check` 零错误
- `cargo clippy` 零 warning
- **状态**: pending

---

## Errors Encountered

| Error | Attempt | Resolution |
|-------|---------|------------|
| (none yet) | | |

---

## Decisions

1. **Client per request vs shared Client**: 因 reqwest 的 redirect/SSL 是 Client 级配置，选择每次请求构建 Client（带连接池复用的优化可后续考虑）
2. **CodeMirror vs Monaco**: Raw/GraphQL 编辑用 CodeMirror 6（轻量），脚本编辑用 Monaco（Phase 3）
3. **变量解析位置**: 前端渲染层 + Rust 发送前二次解析（两层都需要）
4. **AuthConfig serde**: 使用 `#[serde(tag = "type", content = "config")]` 外部标签（AGENTS.md 要求）
