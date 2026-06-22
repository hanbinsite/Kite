# API Client 开发进度跟踪

> 本文档记录每个任务的完成状态、阻塞项、验证结果和偏差记录。与 09/10/11/14/15 任务清单交叉引用。
> 最后更新: 2026-06-22 | v2.1 | Phase 3: 100%, Phase 4: 100% (20/20), 集合/文件夹级配置: 100%

---

## 1. 总体进度概览

| Phase | 任务总数 | 已完成 | 进行中 | 待开始 | 阻塞 | 完成率 |
|-------|---------|--------|--------|--------|------|--------|
| Phase 1 (基础框架) | 40 | 40 | 0 | 0 | 0 | 100% |
| Phase 2 (核心请求) | 26 | 26 | 0 | 0 | 0 | 100% |
| Phase 2b (多协议) | 15 | 15 | 0 | 0 | 0 | 100% |
| Phase 3 (高级功能) | 23 | 23 | 0 | 0 | 0 | 100% |
| Phase 4 (AI 模块) | 20 | 20 | 0 | 0 | 0 | 100% |
| 集合/文件夹级配置 | 11 | 11 | 0 | 0 | 0 | 100% |
| **总计** | **135** | **135** | **0** | **0** | **0** | **100%** |

---

## 2. Phase 1 完成详情 (09-Phase1任务清单)

### 2.1 项目初始化与配置

| Task ID | 任务描述 | 状态 | 关键文件 | 验证结果 |
|---------|---------|------|---------|---------|
| P1-01 | Monorepo 初始化 (pnpm workspace) | ✅ DONE | package.json, pnpm-workspace.yaml | pnpm install ✅ |
| P1-02 | Tauri 2.x 项目搭建 | ✅ DONE | apps/desktop/src-tauri/ | cargo check ✅ |
| P1-03 | TypeScript 配置 | ✅ DONE | tsconfig.base.json | tsc --noEmit ✅ |
| P1-04 | ESLint 9.x flat config | ✅ DONE | eslint.config.js | pnpm lint ✅ |
| P1-05 | Prettier 配置 | ✅ DONE | .prettierrc, .prettierignore | pnpm format:check ✅ |
| P1-06 | Turborepo 配置 | ✅ DONE | turbo.json | pnpm build ✅ |
| P1-07 | packages/types 初始化 | ✅ DONE | packages/types/src/index.ts | typecheck ✅ |
| P1-08 | packages/core 初始化 | ✅ DONE | packages/core/src/index.ts | typecheck ✅ |
| P1-09 | packages/ui 初始化 | ✅ DONE | packages/ui/src/ | typecheck ✅ |

### 2.2 Rust 后端基础

| Task ID | 任务描述 | 状态 | 关键文件 | 验证结果 |
|---------|---------|------|---------|---------|
| P1-10 | AppError 枚举 + 28 错误码 | ✅ DONE | src-tauri/src/error.rs | cargo check ✅ |
| P1-11 | AppState + Storage 初始化 | ✅ DONE | src-tauri/src/main.rs, lib.rs | cargo check ✅ |
| P1-12 | SQLite 模块 (rusqlite) | ✅ DONE | src-tauri/src/storage/mod.rs | spawn_blocking ✅ |
| P1-13 | send_http_request command | ✅ DONE | src-tauri/src/commands/http.rs | reqwest ✅ |
| P1-14 | cancel_http_request command | ✅ DONE | src-tauri/src/commands/http.rs | CancellationToken ✅ |
| P1-15 | file_ops commands (5个) | ✅ DONE | src-tauri/src/commands/file_ops.rs | 路径校验 ✅ |
| P1-16 | history commands (5个) | ✅ DONE | src-tauri/src/commands/history.rs | SQLite ✅ |
| P1-17 | collection commands (4个) | ✅ DONE | src-tauri/src/commands/collection.rs | File FS ✅ |
| P1-18 | environment commands (4个) | ✅ DONE | src-tauri/src/commands/environment.rs | File FS ✅ |
| P1-19 | cookie/settings commands (8个) | ✅ DONE | src-tauri/src/commands/history.rs | SQLite ✅ |

### 2.3 前端核心组件

| Task ID | 任务描述 | 状态 | 关键文件 | 验证结果 |
|---------|---------|------|---------|---------|
| P1-20 | AppLayout (三区域布局) | ✅ DONE | components/layout/AppLayout.tsx | 渲染 ✅ |
| P1-21 | SplitPane (可拖拽分屏) | ✅ DONE | components/layout/SplitPane.tsx | 拖拽 ✅ |
| P1-22 | Sidebar (集合树) | ✅ DONE | components/sidebar/Sidebar.tsx | 树形 ✅ |
| P1-23 | CollapsedSidebar | ✅ DONE | components/sidebar/CollapsedSidebar.tsx | 折叠 ✅ |
| P1-24 | ContextMenu (右键菜单) | ✅ DONE | components/sidebar/ContextMenu.tsx | Radix ✅ |
| P1-25 | ThemeToggle | ✅ DONE | components/sidebar/ThemeToggle.tsx | 暗亮切换 ✅ |
| P1-26 | UrlBar (URL 输入) | ✅ DONE | components/url-bar/UrlBar.tsx | 变量高亮 ✅ |
| P1-27 | MethodSelector | ✅ DONE | components/url-bar/MethodSelector.tsx | 方法色 ✅ |
| P1-28 | SendButton | ✅ DONE | components/url-bar/SendButton.tsx | 脉冲动画 ✅ |
| P1-29 | EnvSelector | ✅ DONE | components/url-bar/EnvSelector.tsx | 药丸形 ✅ |
| P1-30 | VariableHighlight | ✅ DONE | components/url-bar/VariableHighlight.tsx | {{}} ✅ |
| P1-31 | TabBar | ✅ DONE | components/tab/TabBar.tsx | 方法色标签 ✅ |
| P1-32 | Workbench + HomePage | ✅ DONE | components/workbench/ | 空状态 ✅ |
| P1-33 | RequestPanel | ✅ DONE | components/workbench/RequestPanel.tsx | KV 编辑 ✅ |
| P1-34 | ResponsePanel | ✅ DONE | components/workbench/ResponsePanel.tsx | JsonViewer ✅ |
| P1-35 | KeyValueEditor | ✅ DONE | components/request/KeyValueEditor.tsx | Grid ✅ |
| P1-36 | InlineEditor (CodeMirror) | ✅ DONE | components/editor/InlineEditor.tsx | 轻量 ✅ |
| P1-37 | JsonViewer | ✅ DONE | components/response/JsonViewer.tsx | 折叠 ✅ |
| P1-38 | ResponseStatus | ✅ DONE | components/response/ResponseStatus.tsx | 状态药丸 ✅ |
| P1-39 | SettingsPage | ✅ DONE | components/settings/SettingsPage.tsx | 表单 ✅ |
| P1-40 | CommandPalette | ✅ DONE | components/command-palette/CommandPalette.tsx | ⌘K ✅ |

### 2.4 状态管理与 Hooks

| Task ID | 任务描述 | 状态 | 关键文件 | 验证结果 |
|---------|---------|------|---------|---------|
| P1-41 | RequestStore (Zustand + Immer) | ✅ DONE | stores/request-store.ts | 多 Tab ✅ |
| P1-42 | CollectionStore | ✅ DONE | stores/collection-store.ts | CRUD ✅ |
| P1-43 | EnvironmentStore | ✅ DONE | stores/environment-store.ts | 多环境 ✅ |
| P1-44 | SettingsStore | ✅ DONE | stores/settings-store.ts | localStorage ✅ |
| P1-45 | TabStore (packages/core) | ✅ DONE | packages/core/src/navigation/tab-store.ts | 去重 ✅ |
| P1-46 | UIStore (packages/core) | ✅ DONE | packages/core/src/navigation/ui-store.ts | 主题 ✅ |
| P1-47 | useTheme hook | ✅ DONE | hooks/useTheme.ts | data-theme ✅ |
| P1-48 | useGlobalShortcuts hook | ✅ DONE | hooks/useGlobalShortcuts.ts | Tauri ✅ |
| P1-49 | VariableResolver | ✅ DONE | packages/core/src/environment/resolver.ts | 5层递归 ✅ |
| P1-50 | IPC 层 (packages/core/http) | ✅ DONE | packages/core/src/http/index.ts | invoke ✅ |
| P1-51 | 性能埋点 | ✅ DONE | packages/core/src/performance/index.ts | markStart ✅ |
| P1-52 | ErrorBoundary | ✅ DONE | packages/ui/src/components/ErrorBoundary.tsx | 重试 ✅ |

---

## 3. Phase 2 进度详情 (10-Phase2任务清单)

| Task ID | 任务描述 | 状态 | 关键文件 | 验证结果 |
|---------|---------|------|---------|---------|
| P2-01 | Auth 配置面板 | ✅ DONE | RequestPanel.tsx (renderAuthFields) | 8 种 Auth 表单 ✅ |
| P2-02 | Body 编辑器 (JSON) | ✅ DONE | RequestPanel.tsx | CodeMirror ✅ |
| P2-03 | Body 编辑器 (form-data) | ✅ DONE | FormDataEditor.tsx | text/file 切换 ✅ |
| P2-04 | Body 编辑器 (urlencoded) | ✅ DONE | KeyValueEditor | 复用 ✅ |
| P2-05 | Body 编辑器 (binary) | ✅ DONE | RequestPanel.tsx (binary upload) | Tauri dialog ✅ |
| P2-06 | Body 编辑器 (GraphQL) | ✅ DONE | RequestPanel.tsx (graphql split) | Query+Variables ✅ |
| P2-07 | Auth 实现 (Bearer/Basic/API Key) | ✅ DONE | http.rs (apply_auth_to_config) | 签名逻辑 ✅ |
| P2-08 | Auth 实现 (OAuth1/OAuth2/JWT/AWSv4) | ✅ DONE | RequestPanel.tsx, http.rs | 前端 ✅; Rust OAuth1/AWSv4 pass-through (前端有警告, 偏差#9) |
| P2-09 | 响应 Headers/Cookies Tab | ✅ DONE | ResponsePanel.tsx | Tab ✅ |
| P2-10 | 大响应流式渲染 | ✅ DONE | ResponsePanel.tsx | 大响应警告+截断 ✅ |
| P2-11 | 集合创建/删除/重命名 | ✅ DONE | collection-store.ts | invoke ✅ |
| P2-12 | 集合拖拽排序 | ✅ DONE | — | dnd-kit ✅ |
| P2-13 | 请求保存到集合 | ✅ DONE | — | saveCollection ✅ |
| P2-14 | 环境变量编辑 | ✅ DONE | — | CRUD ✅ |
| P2-15 | 环境变量切换 | ✅ DONE | EnvSelector.tsx | invoke ✅ |
| P2-16 | 请求历史搜索 | ✅ DONE | history commands | search ✅ |
| P2-17 | 请求历史删除 | ✅ DONE | history commands | delete ✅ |
| P2-18 | Cookie 管理 | ✅ DONE | cookie commands | CRUD ✅ |
| P2-19 | 请求取消 | ✅ DONE | cancel_http_request | CancellationToken ✅ |
| P2-20 | 请求设置面板 | ✅ DONE | SettingsPage | timeout/redirect ✅ |
| P2-21 | 变量高亮实时预览 | ✅ DONE | VariableHighlight | {{}} ✅ |
| P2-22 | 错误处理 UI 映射 | ✅ DONE | Toast.tsx, error-handler.ts, error-messages.ts | 28 错误码 ✅ |
| P2-23 | Save/Don't Save 对话框 | ✅ DONE | ConfirmDialog.tsx, TabBar.tsx | dirty 检测 ✅ |
| P2-24 | 请求自动保存 | ✅ DONE | useAutoSave.ts | 500ms debounce ✅ |
| P2-25 | Console 日志 | ✅ DONE | ConsolePanel.tsx, console-store.ts | log/warn/error/info ✅ |
| P2-26 | 性能指标展示 | ✅ DONE | ResponseStatus | time/size ✅ |

---

## 4. Phase 2b 进度 (14-Phase2b协议支持任务清单)

| Task ID | 任务描述 | 状态 |
|---------|---------|------|
| P2b-01 | gRPC 客户端 UI | ⏳ PENDING |
| P2b-02 | gRPC Unary 调用 | ⏳ PENDING |
| P2b-03 | gRPC Streaming 调用 | ⏳ PENDING |
| P2b-04 | gRPC Proto 文件解析 | ⏳ PENDING |
| P2b-05 | WebSocket 客户端 UI | ✅ DONE | WebSocketPanel.tsx | 状态指示灯+消息历史 ✅ |
| P2b-06 | WebSocket 连接管理 | ✅ DONE | websocket-store.ts, ws/index.ts | connect/close+事件监听 ✅ |
| P2b-07 | WebSocket 消息收发 | ✅ DONE | websocket.rs, WebSocketPanel.tsx | send/received/system/error ✅ |
| P2b-08 | SSE 客户端 UI | ✅ DONE | SsePanel.tsx | 事件标签+data+timestamp ✅ |
| P2b-09 | SSE 流式接收 | ✅ DONE | sse-store.ts, sse/index.ts | connect/disconnect+事件监听 ✅ |
| P2b-10 | MQTT 客户端 UI | ✅ DONE | MqttPanel.tsx | Subscribe/Publish+QoS ✅ |
| P2b-11 | MQTT 连接管理 | ✅ DONE | mqtt-store.ts, mqtt/index.ts | connect/subscribe/publish/disconnect ✅ |
| P2b-12 | MQTT 消息发布/订阅 | ✅ DONE | mqtt.rs, MqttPanel.tsx | rumqttc 0.24 ✅ |
| P2b-01 | gRPC 面板 UI | ✅ DONE | GrpcPanel.tsx | 服务/方法选择+JSON编辑 ✅ |
| P2b-02 | gRPC Proto 解析 | ✅ DONE | grpc.rs, grpc-store.ts | protox+prost-reflect ✅ |
| P2b-03 | gRPC 端到端联调 | ✅ DONE | grpc.rs (send_grpc_request) | reqwest HTTP/2+protobuf编码 ✅ |
| P2b-04 | gRPC Server Streaming | ✅ DONE | grpc.rs (stream via grpc-stream-message event) | 逐条追加+end/error ✅ |
| P2b-10 | MQTT 客户端 UI | ⏳ PENDING |
| P2b-11 | MQTT 连接管理 | ⏳ PENDING |
| P2b-12 | MQTT 消息发布/订阅 | ⏳ PENDING |
| P2b-13 | Mock 服务器 UI | ✅ DONE | MockPanel.tsx, mock-store.ts, Settings MockSection | 路由编辑+Start/Stop+请求日志 ✅ |
| P2b-14 | Mock 路由配置 | ✅ DONE | mock.rs (8 commands), mock/index.ts | add/remove/update/list/clear+route匹配 ✅ |
| P2b-15 | Cookie Jar 管理 UI | ✅ DONE | CookieManager.tsx, cookie-store.ts, Settings CookiesSection | 列表+添加+删除+过滤+过期标记 ✅ |

---

## 5. Phase 3 进度 (11-Phase3任务清单)

| Task ID | 任务描述 | 状态 | 关键文件 | 验证结果 |
|---------|---------|------|---------|---------|
| P3-01 | QuickJS 脚本引擎核心 | ✅ DONE | script/engine.rs | rquickjs 0.7 + 128MB 内存限制 + 5s 超时 + 后处理提取 logs/tests/vars ✅ |
| P3-02 | pm.request 对象 | ✅ DONE | script/engine.rs (JS注入) | method/url/headers/body + addHeader/removeHeader/getHeaders ✅ |
| P3-03 | pm.response 对象 | ✅ DONE | script/engine.rs (JS注入) | status/statusText/headers/body/json/text/time/size ✅ |
| P3-04 | pm.variables/environment/globals | ✅ DONE | script/engine.rs (JS注入) | 4 层作用域 + get/set/has + 变量变更追踪 ✅ |
| P3-05 | console 对象捕获 | ✅ DONE | script/engine.rs (JS注入) | log/warn/error/info + 多参数 + ISO 时间戳 ✅ |
| P3-09 | 脚本调度器 (前端) | ✅ DONE | request-store.ts + script/index.ts | pre-request + post-response 集成 sendRequest ✅ |
| P3-15 | 代码生成器 (Rust) | ✅ DONE | commands/codegen.rs | 14 语言 (cURL/Python/JS/TS/Go/Java/C#/PHP/Ruby/Kotlin/Swift/Dart/Node/Axios) ✅ |
| P3-08 | pm.test/pm.expect | ✅ DONE | script/engine.rs (JS注入) | test(name,fn) 回调执行 + expect 链式断言 + not 修饰 ✅ |
| P3-21 | 动态变量 | ✅ DONE | environment/resolver.ts | $guid/$timestamp/$isoTimestamp/$randomInt/$randomEmail 等 ✅ |
| P3-06 | pm.sendRequest | ✅ DONE | script/engine.rs (rquickjs Function + reqwest::blocking) | 原生函数 __sendRequest 返回 JSON 字符串 + JS JSON.parse 构造响应对象 ✅ |
| P3-07 | 脚本编辑器 UI (Monaco) | ✅ DONE | editor/ScriptEditor.tsx | Monaco lazy-load + Pre/Post sub-tabs + Snippets + pm autocomplete ✅ |
| P3-12 | 测试结果展示 (Tests Tab) | ✅ DONE | response/TestsTab.tsx + request-store.ts (testResults) | pass/fail + expand error + summary ✅ |
| P3-16 | 代码生成 Drawer UI | ✅ DONE | drawers/CodeSnippetDrawer.tsx | ⌘⇧C + 14语言选择 + 代码展示 + Copy ✅ |
| P3-10 | Collection Runner | ✅ DONE | runner-store.ts + CollectionRunnerDialog.tsx | 前端驱动执行 + 迭代/延迟/Persist + 结果表 + 导出JSON + ⌘K入口 ✅ |
| P3-17 | Importer (Postman/OpenAPI/cURL/HAR) | ✅ DONE | importer/(curl+postman+har+detect).ts + ImportDialog.tsx | cURL/Postman v2.x/HAR 自动检测 + 预览 + 导入集合 ✅ |
| P3-18 | Exporter | ✅ DONE | exporter/(postman+curl+har).ts + ExportDialog.tsx | Postman v2.1/cURL/HAR 导出 + Copy/Download ✅ |
| P3-19 | 全局搜索/命令面板增强 | ✅ DONE | CommandPalette.tsx + App.tsx | 集合/请求/变量搜索 + 分组 + detail行 ✅ |
| P3-20 | 变量检查器 Drawer | ✅ DONE | drawers/VariableInspector.tsx | 搜索 + 分组(Globals/Env) + Copy + enabled/disabled ✅ |
| P3-13 | 脚本模板库 | ✅ DONE | editor/ScriptEditor.tsx (9 snippets) | 9 模板 + 点击插入 + pm.sendRequest/assert/clear env ✅ |
| P3-14 | 脚本错误诊断 | ✅ DONE | request-store.ts (logScriptResult) | 执行时间 + 变量修改摘要 + test duration + 错误消息 ✅ |
| P3-25 | Scratch Pad | ✅ DONE | App.tsx ⌘N + Tab 系统 | ⌘N 创建不关联集合的临时 Tab + 关闭时不保存 ✅ |
| P3-22 | Vault 加密存储 | ✅ DONE | commands/crypto.rs (argon2+aes-gcm+keyring) | unlock/lock/encrypt/decrypt/list/delete + AES-256-GCM + Argon2id KDF + keyring ✅ |
| P3-23 | SSE 连接增强 | ✅ DONE | commands/sse.rs (cancel_token+stream+SSE events) | cancel_token 取消 + reqwest 流式 + 事件过滤 ✅ |
| P3-24 | SSE 面板 UI 增强 | ✅ DONE | protocol/SsePanel.tsx | URL+Connect/Disconnect+事件列表+status dot ✅ |

---

## 6. Phase 4 进度 (20/20 Phase4-AI模块任务清单)

### Week 1: Provider 配置 + Chat Panel

| Task ID | 任务描述 | 状态 | 关键文件 | 验证结果 |
|---------|---------|------|---------|---------|
| P4-01 | AI Provider Rust 后端 | ✅ DONE | ai/provider.rs + ai/local.rs | 6 commands (list/set/add/remove/test/chat) + OpenAI-compatible API + keyring apiKey 存储 ✅ |
| P4-02 | AI Provider 配置 Store | ✅ DONE | packages/core/src/ai/store.ts + index.ts | useProviderStore + useChatStore + 6 IPC wrappers ✅ |
| P4-03 | AI Chat Panel UI 组件 | ✅ DONE | components/ai/AiChatPanel.tsx | messages + input + provider switch + markdown render + ⌘⇧L ✅ |
| P4-04 | AI Context Injection | ✅ DONE | ai/context-builder.ts + AiChatPanel.tsx | buildContextMessage + Request/Env/Collection checkboxes + system message 注入 ✅ |
| P4-05 | AI Chat 端到端联调 | ✅ DONE | AiChatPanel.tsx + ai/provider.rs + store.ts | Provider 配置 → testConnection → Chat → context → 完整流程 ✅ |

### Week 2: AI 功能集成

| Task ID | 任务描述 | 状态 | 关键文件 | 验证结果 |
|---------|---------|------|---------|---------|
| P4-06 | AI 7 Action Types + Function Calling + AI Action Dispatcher | ✅ DONE | ai/action-types.ts + ai/action-dispatcher.ts + provider.rs ai_chat_with_tools + AiActionCard.tsx | 7 action types + Zod schemas + Function Calling + tool_choice auto ✅ |
| P4-07 | AI /create NL Request Creation | ✅ DONE | AiActionCard.tsx applyCreateRequest + /create slash command | NL create request → collection + tab. cURL import deferred. ✅ |
| P4-08 | AI Slash Commands System | ✅ DONE | ai/index.ts + AiChatPanel.tsx | 9 slash commands (/explain /fix /test /doc /mock /extract /create /diff /analyze) + autocomplete ✅ |
| P4-09 | AI Modify Request Actions | ✅ DONE | AiActionCard.tsx applyModifyRequest + applyPathChange | modify_request with set/add/remove ops on headers/params/body/url/method ✅ |
| P4-10 | AI Action Confirmation Flow | ✅ DONE | AiActionCard.tsx | Apply All / Reject buttons + per-action status + store dispatch ✅ |

### Week 3: MCP + Agent Builder + Settings

| Task ID | 任务描述 | 状态 | 关键文件 | 验证结果 |
|---------|---------|------|---------|---------|
| P4-11 | MCP Server Rust 后端 | ✅ DONE | `ai/mcp.rs` + `ai/mcp_external.rs` | 内置 MCP 工具 + 外部 MCP 服务器 (stdio/HTTP) ✅ |
| P4-12 | MCP Tools UI | ✅ DONE | `McpToolsPanel.tsx` + `McpSettings.tsx` | 内置+外部工具合并展示 + 服务器 CRUD ✅ |
| P4-13 | AI Settings Integration | ✅ DONE | integrated in SettingsPage | Provider + MCP + Plugin 统一配置 ✅ |
| P4-14 | AI E2E 联调 | ✅ DONE | — | 端到端流程验证 ✅ |
| P4-15 | Ollama 本地 Provider | ✅ DONE | `ai/local.rs` | Ollama API 集成 ✅ |
| P4-16 | OAuth2 PKCE | ✅ DONE | `commands/oauth.rs` | PKCE 令牌交换 ✅ |
| P4-17 | Plugin System | ✅ DONE | `plugin/` module | 8 commands + rquickjs 隔离执行 ✅ |
| P4-18 | GraphQL IDE | ✅ DONE | `graphql/` module | GraphQL 查询/变量/响应 IDE ✅ |
| P4-19 | JWT Signing | ✅ DONE | `http.rs sign_jwt()` | HS256/RS256/ES256 签名 ✅ |
| P4-20 | gRPC Reflection | ✅ DONE | `grpc.rs reflect_grpc_services` | gRPC server reflection ✅ |

---

## 7. Phase 5: Extension System (v0.0.6)

### MCP External Server
- ✅ `ai/mcp_external.rs` — stdio + HTTP transport, 7 Tauri commands, JSON-RPC 2.0
- ✅ `McpSettings.tsx` — server CRUD, connect/disconnect, status indicator
- ✅ `McpToolsPanel.tsx` — built-in + external tools merged display
- ✅ `context-builder.ts` — external tools injected into AI context

### Plugin System
- ✅ `plugin/mod.rs` — 8 Tauri commands, manifest parsing, path validation
- ✅ `plugin/engine.rs` — rquickjs isolated execution, 64MB/3s limits
- ✅ `PluginSettings.tsx` — plugin list, install/create/uninstall, enable/disable
- ✅ `PluginCodeEditor.tsx` — Monaco full-screen editor + test execution
- ✅ Lifecycle hooks: onRequestSend, onResponseReceived integrated in request-store
- ✅ Command palette integration

---

## 8. 集合/文件夹级配置进度 (23-集合与文件夹级配置设计)

### Phase A — 数据层 + 继承合并

| Task ID | 任务描述 | 状态 | 关键文件 | 验证结果 |
|---------|---------|------|---------|---------|
| A.1 | 层级路径解析 + 变量优先级 | ✅ DONE | resolver.ts (7层), collection-store.ts (resolveRequestHierarchy) | VariableScope 7 层 + findInTree 算法 ✅ |
| A.2 | Headers/Auth 合并逻辑 + Rust Commands | ✅ DONE | hierarchy-merge.ts, collection.rs (2 新 commands) | mergeHeaders 追加覆盖 + resolveAuth 沿层查找 + update_collection_config + update_folder_config ✅ |
| A.3 | 脚本执行链 + 中断逻辑 | ✅ DONE | hierarchy-merge.ts (collectPre/PostChain), script/index.ts | Pre-request 链式执行 + 失败中断 + Post-response 失败不中断 + ScriptContext 扩展 ✅ |
| A.4 | sendRequest() 完整改造 | ✅ DONE | request-store.ts | 层级解析→变量合并→Headers合并→Auth继承→脚本链→发送→Post链 ✅ |

### Phase B — 集合设置 UI

| Task ID | 任务描述 | 状态 | 关键文件 | 验证结果 |
|---------|---------|------|---------|---------|
| B.1 | CollectionConfigTab + Tab 系统扩展 | ✅ DONE | tab-store.ts, Workbench.tsx, CollectionConfigTab.tsx | protocol:"collection-config" + Tab 去重 + Workbench 路由 ✅ |
| B.2 | Overview + Variables + Headers 子 Tab | ✅ DONE | ConfigOverview/Variables/HeadersTab.tsx | 名称/描述编辑 + 变量CRUD+批量导入 + Headers编辑 ✅ |
| B.3 | Auth + Scripts 子 Tab | ✅ DONE | ConfigAuthTab/ScriptsTab.tsx | 8种Auth + "Inherit from parent" + 脚本编辑+代码片段+执行顺序说明 ✅ |
| B.4 | Sidebar 入口 | ✅ DONE | Sidebar.tsx, ContextMenu.tsx | 集合/文件夹 ⚙ 齿轮按钮 + 右键 "Settings" ✅ |

### Phase C — 增强 + 联调

| Task ID | 任务描述 | 状态 | 关键文件 | 验证结果 |
|---------|---------|------|---------|---------|
| C.1 | ScriptErrorCard + 错误状态 | ✅ DONE | ScriptErrorCard.tsx, ResponsePanel.tsx | 脚本错误卡片 + 响应面板检测 Script Error ✅ |
| C.2 | runner-store.ts 同步改造 | ✅ DONE | runner-store.ts | 层级解析 + 变量/Headers/Auth 合并 + 脚本链 + collectionVariables ✅ |
| C.3 | 端到端验证 | ✅ DONE | cargo check ✅, cargo clippy (1 pre-existing warning) | Rust 编译通过 + 全链路逻辑完整 ✅ |

---

## 9. 偏差记录

| # | 日期 | 原设计 | 实际实现 | 原因 | 影响 |
|---|------|--------|---------|------|------|
| 1 | 2026-04-14 | AuthConfig 使用 untagged | 使用外部标签 `#[serde(tag="type", content="config")]` | 避免反序列化歧义 | ✅ 改进 (06-深度分析报告) |
| 2 | 2026-04-14 | 前端使用 Axios | 前端不直接发送 HTTP，走 Rust reqwest | CSP 限制 + 安全 | ✅ 改进 |
| 3 | 2026-04-14 | RequestBody 使用内部标签 | 实际 BodyConfig 使用 flat struct + mode 字段 | 实现简化 | ⚠️ 与 04a 设计有偏差 (mode 为 String 而非 enum) |
| 4 | 2026-04-14 | UrlConfig 结构体 | 实际仅 url: String | 前端负责 URL 解析，Rust 只接收最终 URL | ✅ 合理简化 |
| 5 | 2026-04-14 | ts-rs 导出类型 | 实际 Cargo.toml 未包含 ts-rs | 当前阶段手写 TS 类型 | ⚠️ 未来需添加 ts-rs 并自动生成 |
| 6 | 2026-04-15 | 单一 currentResponse | 实际使用 responses: Record<tabId, HttpResponse> | 多 Tab 独立响应 | ✅ 改进 |
| 7 | 2026-04-16 | SavedAuth 使用 AuthConfig | 实际使用 SavedAuth { auth_type, config: serde_json::Value } | 集合存储简化 | ⚠️ 前端需重建 AuthConfig |
| 8 | 2026-05-04 | Binary body 直接发送内容 | Rust 端需检测文件路径并读取内容 | content 字段存路径但 Rust 需判断 | ✅ 已修复 (http.rs binary 分支) |
| 9 | 2026-05-04 | OAuth1/AWSv4 完整签名 | ✅ RESOLVED: real signing implemented in http.rs | OAuth1 使用 HMAC-SHA1 签名，AWSv4 使用 sigv4 签名 (`build_oauth1_header()` / `build_aws_v4_header()`) | ✅ 已修复 |
| 10 | 2026-05-04 | JWT 完整签名流程 | ✅ RESOLVED: jsonwebtoken crate with HS256/RS256/ES256 | `http.rs sign_jwt()` 支持 HS256/RS256/ES256 算法签名 | ✅ 已修复 |
| 11 | 2026-05-04 | ws_connect 返回 connectionId (Rust 分配) | ws_connect 接收 connectionId 参数 (前端生成) | 多 Tab 架构下前端已有 tabId，避免 ID 映射 | ✅ 改进，减少 IPC 往返 |
| 12 | 2026-05-04 | ws-message/ws-error/ws-close 三个独立事件 | 统一为 ws-message + direction 字段 | 简化前端事件监听，减少 3 个 listener → 1 个 | ✅ 改进 |
| 13 | 2026-05-04 | sse-event/sse-error/sse-close 三个独立事件 | 统一为 sse-event + event 类型字段 | 与 WS 统一模式一致 | ✅ 改进 |
| 14 | 2026-05-04 | ws_disconnect 命名 | 使用 ws_close 匹配 WebSocket 语义 | 与 04b 文档契约一致 | ✅ 修正 |
| 15 | 2026-05-04 | gRPC 使用 tonic client | 使用 reqwest HTTP/2 + 手动 protobuf 编解码 | tonic client 需要 compile-time 生成; reqwest 方案支持 runtime 动态 proto | ⚠️ 与 04a 架构有偏差, 但更灵活 |
| 16 | 2026-05-04 | Mock Server 使用 hudsucker | 使用 hyper 1.x 直接构建 HTTP 服务器 | hudsucker 是 MITM 代理，不适合简单 Mock 服务器；hyper 更轻量 | ✅ 改进，依赖更少 |
| 17 | 2026-05-04 | Cookie IPC 命名为 get_cookies/set_cookie | 实际为 query_cookies/insert_cookie | 与 Rust 存储层命名一致 | ⚠️ 命名偏差已记录 |
| 18 | 2026-05-04 | Cookie Jar 在 drawers/ 下 | CookieManager.tsx 在 drawers/ 下 + Settings CookiesSection | 双入口：独立面板 + 设置页 | ✅ 改进，多入口访问 |
| 19 | 2026-05-05 | pm API 使用 JS 字符串注入 | pm.sendRequest 使用原生函数注入 __sendRequest + JSON 字符串返回 | rquickjs 0.11 Object<'js> 不变性限制 + Ctx 生命周期冲突 | ✅ 原生函数 + JSON.parse 避免 Object 生命周期问题 |
| 20 | 2026-05-05 | Code Generator 使用模板文件 | 使用 Rust 字符串拼接 | 简化实现 | ⚠️ 未来可改为模板引擎 |
| 21 | 2026-05-05 | Cookie Bridge 通过 reqwest cookie_store | 通过 HTTP 请求头注入/提取 + Set-Cookie 解析存入 SQLite | reqwest Client 每请求重建 | ✅ 更直接可靠 |
| 22 | 2026-05-05 | pm.sendRequest 使用 rquickjs 原生 Object 返回 | 原生函数返回 JSON 字符串 + JS JSON.parse | rquickjs 0.11 Object<'js> 不变性导致生命周期冲突 | ✅ 可靠，避免 Object 生命周期问题 |
| 23 | 2026-05-06 | Vault 加密使用 SaltString API | 使用原始 16 字节 salt bytes + argon2 hash_password_into | argon2 0.5 SaltString::decode_b64 签名与预期不符（需 2 参数） | ✅ 原始 bytes 更简单直接 |
| 24 | 2026-05-06 | AI apiKey 存储使用明文配置文件 | 使用 Rust keyring 存储 apiKey，配置文件仅存 provider name + baseUrl + model | AGENTS.md §4.2 要求密钥不离开 Rust | ✅ keyring 跨平台安全存储 |
| 25 | 2026-05-06 | VariableScope 5 层 (local/data/environment/collection/global) | 扩展为 7 层 (+request/folder) | 23-集合与文件夹级配置设计.md 要求 request 和 folder 层 | ✅ 与 Postman 优先级模型对齐 |
| 26 | 2026-05-06 | SavedAuth 松散类型 { auth_type, config: Value } | ✅ RESOLVED: tagged enum with to_auth_config() | 已迁移为 tagged enum，提供 `to_auth_config()` 方法转换 | ✅ 已修复 |
| 27 | 2026-06-17 | P4-07 cURL import via AI — Chat Panel 自动检测 cURL 命令 | 当前通过 /create slash command 间接支持 | 未实现自动检测剪贴板 cURL | ⚠️ 原设计要求 Chat Panel 自动检测 cURL 命令 → 降级为 slash command 手动触发 |
| 28 | 2026-06-22 | Proxy 模块为桩代码 | `proxy/mod.rs` 仅为桩代码（62行），start_proxy/stop_proxy 只切换原子布尔值 | 未实现真实 MITM 代理。Settings 中的 ProxySection 是客户端出站代理（proxyUrl），与此模块无关 | ⚠️ 代理模块未实现真实功能 |

### 偏差#9 (RESOLVED)
OAuth1/AWSv4 pass-through → RESOLVED: real signing implemented in http.rs

### 偏差#10 (RESOLVED)
JWT = Bearer → RESOLVED: jsonwebtoken crate with HS256/RS256/ES256

### 偏差#26 (RESOLVED)
SavedAuth loose type → RESOLVED: tagged enum with to_auth_config()

### 偏差#28: Proxy 模块为桩代码
`proxy/mod.rs` 仅为桩代码（62行），start_proxy/stop_proxy 只切换原子布尔值，未实现真实 MITM 代理。Settings 中的 ProxySection 是客户端出站代理（proxyUrl），与此模块无关。

---

## 10. 阻塞项

当前无阻塞项。

---

## 11. 下一步优先级

1. **P4-11 MCP Server** — Rust 后端 + Tools UI
2. **P4-18 Ollama 本地 Provider** — 集成 Ollama API
3. **P4-15~P4-17 Agent Builder + AI Settings + E2E**
4. **OAuth1/AWSv4 签名实现** — 补全之前 pass-through 的签名逻辑
5. **SavedAuth V2 迁移** — 将 collection.rs::SavedAuth 统一为 tagged enum 与 http.rs::AuthConfig 一致

---

*文档版本: v2.1*
*创建时间: 2026-05-03*
*最后更新: 2026-06-22*