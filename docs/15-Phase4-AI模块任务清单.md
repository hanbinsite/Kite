# Phase 4 任务清单 — AI 模块（3 周）

> 本文档覆盖 03-功能设计.md §16 AI Agent 模块的全部实现任务。该模块当前零实现，Phase 4 从基础设施到高级 Agent 功能逐步交付。所有 AI 请求走 Rust 后端，前端不直接调用 AI API。

---

## Sprint 总览

| Sprint | 时间 | 任务数 | 总工时 | 核心目标 |
|--------|------|--------|--------|----------|
| Week 1 | Day 1-5 | 5 | 26h | AI Provider 配置 + AI Chat Panel + 基础对话 |
| Week 2 | Day 6-10 | 5 | 30h | AI 功能集成（请求创建/测试生成/文档生成/响应解释） |
| Week 3 | Day 11-15 | 5 | 28h | MCP Server + Agent Builder + Settings 集成 + 端到端联调 |

---

## Week 1: Provider 配置 + Chat Panel（Day 1-5）

### 4.01 — AI Provider Rust 后端
- **依赖**：Phase 1-3 完成（AppError 枚举、Tauri Command 基础设施已就绪）
- **工时**：6h
- **验收标准**：
  - 新增 `commands/ai.rs`，定义 Tauri Commands：`ai_chat`、`ai_stream_chat`、`ai_list_providers`、`ai_set_provider`、`ai_test_connection`
  - 新增 `ai/provider.rs` 模块，实现 Provider 抽象 trait `AiProvider`，支持 OpenAI-compatible API（含 streaming SSE）
  - 新增 `ai/local.rs` 模块，预留本地 SLM 调用接口（先实现 stub，后续可对接 llama.cpp / ONNX Runtime）
  - Provider 配置持久化到 `{app_data}/ai-providers.json`（含 apiKey、baseUrl、model、temperature 等字段）
  - apiKey 存储使用 Rust keyring（不通过 IPC 传输），配置文件仅存储 provider name + baseUrl + model
  - 所有 Command 返回 `Result<T, AppError>`，错误按 AppError 分类
  - `#[derive(TS)]` 导出 TypeScript 类型：`AiProviderConfig`、`AiChatRequest`、`AiChatResponse`、`AiStreamChunk`
- **关键文件**：`apps/desktop/src-tauri/src/commands/ai.rs`, `apps/desktop/src-tauri/src/ai/provider.rs`, `apps/desktop/src-tauri/src/ai/local.rs`, `apps/desktop/src-tauri/src/ai/mod.rs`
- **关联文档**：03-功能设计.md §16; 04a-架构设计.md §3; 04b-API设计.md §6

### 4.02 — AI Provider 配置 Store
- **依赖**：4.01
- **工时**：4h
- **验收标准**：
  - 新增 `packages/core/src/ai/provider-store.ts`，Zustand store 管理 provider 列表和活跃 provider
  - store 提供 `loadProviders()`、`setActiveProvider()`、`addProvider()`、`removeProvider()`、`testConnection()` 方法
  - `testConnection()` invoke ai_test_connection，成功显示绿点 + 响应延迟，失败显示红点 + 错误信息
  - provider 列表持久化通过 Rust 端文件操作，前端不直接读写文件
- **关键文件**：`packages/core/src/ai/provider-store.ts`
- **关联文档**：08-开发指南.md §3; 04b-API设计.md §6

### 4.03 — AI Chat Panel UI 组件
- **依赖**：4.01, 4.02
- **工时**：8h
- **验收标准**：
  - 新增 `AiChatPanel.tsx` 组件，渲染在右侧可折叠面板区域（与 Response Panel 共享区域，Tab 切换）
  - 对话界面：消息列表 + 输入框 + 发送按钮
  - 消息列表区分 user（右对齐/fg-primary）和 assistant（左对齐/fg-secondary + bg-elevated 背景）
  - 支持 streaming 响应：前端通过 listen('ai-stream-chunk') 接收 SSE chunk，逐字追加到 assistant 消息气泡
  - 输入框支持多行（Enter 发送，Shift+Enter 换行）
  - 对话历史按 session 存储，切换 Tab 时保留各 Tab 独立对话
  - 面板顶部显示当前 Provider 名称 + model，点击可切换
  - 支持 Markdown 渲染 assistant 回复（代码块语法高亮）
- **关键文件**：`apps/desktop/src/components/ai/AiChatPanel.tsx`, `apps/desktop/src/stores/ai-chat-store.ts`
- **关联文档**：03-功能设计.md §16.1; 07c-侧边栏与命令面板视觉规范.md §5

### 4.04 — AI Context Injection
- **依赖**：4.01, 4.03
- **工时**：4h
- **验收标准**：
  - AI Chat 发送消息时自动注入当前上下文：active request（method + url + headers summary + body summary）、active environment name、collection name
  - 上下文以 system message 形式发送给 AI Provider
  - 上下文格式：精简 JSON（不超过 2KB），避免消耗过多 token
  - 用户可在 Chat Panel 底部勾选/取消勾选上下文项（request / environment / collection）
- **关键文件**：`apps/desktop/src/components/ai/AiContextToggle.tsx`, `packages/core/src/ai/context-builder.ts`
- **关联文档**：03-功能设计.md §16.1 AgentContext; 04a-架构设计.md §3.7

### 4.05 — AI Chat 端到端联调
- **依赖**：4.01, 4.02, 4.03, 4.04
- **工时**：4h
- **验收标准**：
  - 配置 OpenAI provider（baseUrl + model + apiKey），点击 testConnection 显示绿点
  - 输入自然语言问题，点击发送
  - assistant 回复 streaming 逐字显示
  - 切换 Tab，各 Tab 对话独立保留
  - 上下文注入生效：AI 能感知当前请求信息
  - 错误场景：apiKey 无效、网络超时、provider 连接失败 → AppError 分类展示
- **关键文件**：`packages/core/src/ai/chat-client.ts`
- **关联文档**：04a-架构设计.md §3; 08-开发指南.md §3

---

## Week 2: AI 功能集成（Day 6-10）

### 4.06 — AI Request Creation from Natural Language
- **依赖**：4.05
- **工时**：6h
- **验收标准**：
  - Chat Panel 输入 "创建一个 GET 请求到 https://api.example.com/users"，AI 返回 AgentAction（type: create_request）
  - AI 生成完整 HttpRequest 对象（method + url + headers + body + auth），前端解析并填充到新 Tab
  - 用户确认后点击 "Apply" 按钮，请求自动保存到活跃 Collection
  - AI 返回的 JSON 使用 Zod schema 验证，验证失败显示 diff 提示
  - 支持从 cURL 命令创建请求（AI 解析 cURL → HttpRequest）
- **关键文件**：`apps/desktop/src/components/ai/AiActionCard.tsx`, `packages/core/src/ai/action-parser.ts`
- **关联文档**：03-功能设计.md §16.1 AgentAction.create_request; 04b-API设计.md §6

### 4.07 — AI Test Script Generation
- **依赖**：4.05
- **工时**：6h
- **验收标准**：
  - Chat Panel 输入 "为当前请求生成测试脚本"，AI 返回 AgentAction（type: write_test）
  - AI 生成 pm.test() + pm.expect() 脚本代码，基于当前请求的 method + url + 响应 status + body 结构
  - 生成脚本通过 Zod 验证后，用户点击 "Apply" → 自动填充到 Post-response Script 编辑器
  - 支持 "为整个 Collection 生成测试脚本"（批量生成，每个请求一个测试）
  - 生成的脚本在 rquickjs 中可执行，断言结果正常显示
- **关键文件**：`apps/desktop/src/components/ai/AiScriptApply.tsx`, `packages/core/src/ai/test-generator.ts`
- **关联文档**：03-功能设计.md §16.1 AgentAction.write_test; 03-功能设计.md §6 pm API

### 4.08 — AI Documentation Generation
- **依赖**：4.05
- **工时**：6h
- **验收标准**：
  - Chat Panel 输入 "生成当前 Collection 的 API 文档"，AI 返回 AgentAction（type: generate_doc）
  - AI 生成 Markdown 文档，包含：概述 + 端点列表 + 每个端点的 method/path/params/body/response 示例
  - 用户点击 "Apply" → 文档保存到 Collection 的 README.md 文件
  - 支持单请求文档生成和整个 Collection 文档生成
  - 生成文档格式符合 OpenAPI 风格，可后续导出为 OpenAPI spec
- **关键文件**：`apps/desktop/src/components/ai/AiDocPreview.tsx`, `packages/core/src/ai/doc-generator.ts`
- **关联文档**：03-功能设计.md §16.1 AgentAction.generate_doc; 03-功能设计.md §4 Collection

### 4.09 — AI Response Explanation & Fix
- **依赖**：4.05
- **工时**：6h
- **验收标准**：
  - Response Panel 新增 "Explain" 按钮，点击后 AI 解释当前响应（status code 含义 + body 结构分析 + 潜在问题）
  - 响应错误时（4xx/5xx），AI 提供 "Fix" 建议：自动分析请求参数/headers/body 问题并给出修改建议
  - 用户点击 "Apply Fix" → AI 返回 AgentAction（type: fix_error），自动修改请求参数
  - 解释和修复建议在 Chat Panel 中以 Markdown 渲染
  - 支持 SSE streaming 逐步展示解释
- **关键文件**：`apps/desktop/src/components/ai/AiExplainButton.tsx`, `apps/desktop/src/components/ai/AiFixCard.tsx`, `packages/core/src/ai/explain-client.ts`
- **关联文档**：03-功能设计.md §16.1 AgentAction.explain_response/fix_error; 03-功能设计.md §3 HttpResponse

### 4.10 — AI Action Confirmation Flow
- **依赖**：4.06, 4.07, 4.08, 4.09
- **工时**：6h
- **验收标准**：
  - 所有 AgentAction 统一走确认流程：AI 返回 action → 渲染预览卡片 → 用户 Confirm/Reject
  - Confirm 后 apply action 到对应 store（create_request → RequestStore, write_test → ScriptStore, generate_doc → file write, fix_error → RequestStore）
  - Reject 后丢弃 action，Chat Panel 记录拒绝历史
  - autoRun 标记的 action（用户在 Settings 中配置）自动执行不弹确认
  - action 执行结果反馈到 Chat Panel：成功显示 ✓ + 变更摘要，失败显示 ✗ + 错误信息
- **关键文件**：`apps/desktop/src/components/ai/AiActionConfirm.tsx`, `packages/core/src/ai/action-dispatcher.ts`
- **关联文档**：03-功能设计.md §16.1 AgentAction.confirmed/autoRun

---

## Week 3: MCP + Agent Builder + Settings + 联调（Day 11-15）

### 4.11 — MCP Server Rust 后端
- **依赖**：4.01
- **工时**：6h
- **验收标准**：
  - 新增 `commands/mcp.rs`，定义 Tauri Commands：`mcp_list_servers`、`mcp_add_server`、`mcp_remove_server`、`mcp_call_tool`
  - 新增 `ai/mcp.rs` 模块，实现 MCP (Model Context Protocol) client：连接 MCP Server（stdio/SSE transport）、发现 tools/resources、调用 tool 并返回结果
  - MCP Server 配置持久化到 `{app_data}/mcp-servers.json`
  - MCP tool 调用结果作为 AI 上下文注入，供 AI Chat 使用
  - 所有 Command 返回 `Result<T, AppError>`
  - `#[derive(TS)]` 导出 TypeScript 类型：`McpServerConfig`、`McpTool`、`McpToolCallResult`
- **关键文件**：`apps/desktop/src-tauri/src/commands/mcp.rs`, `apps/desktop/src-tauri/src/ai/mcp.rs`
- **关联文档**：MCP Protocol Spec; 04a-架构设计.md §3; 04b-API设计.md §6

### 4.12 — MCP Server UI 管理
- **依赖**：4.11
- **工时**：4h
- **验收标准**：
  - Settings 页新增 "MCP Servers" 入口，列表显示已配置的 MCP Server
  - 每个 Server 显示：名称 + transport 类型 + 状态指示器（connected/disconnected/error）
  - 支持添加 MCP Server：输入名称 + 选择 transport（stdio/SSE）+ 配置参数
  - 支持删除 MCP Server（确认对话框）
  - "Discover Tools" 按钮 → 调用 mcp_list_tools → 显示可用 tools 列表
  - Tool 列表显示：tool name + description + input schema
- **关键文件**：`apps/desktop/src/components/settings/McpServerManager.tsx`
- **关联文档**：07c-侧边栏与命令面板视觉规范.md §7; 04b-API设计.md §6

### 4.13 — AI Agent Builder UI
- **依赖**：4.10, 4.11
- **工时**：8h
- **验收标准**：
  - 新增 "Agent Builder" 页面（从 Settings 或侧边栏入口）
  - Agent 配置面板：名称 + 描述 + 关联 MCP Server + 可用 actions 列表
  - Actions 列表复选框勾选：create_request / modify_request / run_request / write_test / generate_doc / fix_error / explain_response
  - 每个 action 配置：autoRun 开关 + 确认模式（always_confirm / confirm_first_time / auto）
  - Agent 可保存为预设（持久化到 `{app_data}/ai-agents.json`）
  - Chat Panel 可切换 Agent 预设，不同预设使用不同上下文 + action 权限
  - Agent 执行时根据 action 权限自动 dispatch 或等待确认
- **关键文件**：`apps/desktop/src/components/ai/AgentBuilder.tsx`, `apps/desktop/src/stores/agent-store.ts`, `packages/core/src/ai/agent-dispatcher.ts`
- **关联文档**：03-功能设计.md §16.1 AgentAction; 04a-架构设计.md §3.7

### 4.14 — AI Settings Page Integration
- **依赖**：4.02, 4.11, 4.12
- **工时**：4h
- **验收标准**：
  - Settings 页新增 "AI" section，包含子页面：
    - Provider 管理：列表 + 添加/删除/测试连接 + 设置活跃 Provider
    - MCP Servers 管理：列表 + 添加/删除 + discover tools
    - General 设置：默认 model + temperature + max_tokens + stream 开关
    - Agent 预设管理：列表 + 编辑/删除
  - 所有设置变更即时生效，无需重启应用
  - Provider apiKey 输入使用 secure input（type=password），仅传输到 Rust keyring 存储
  - Settings 持久化通过 Rust 文件操作
- **关键文件**：`apps/desktop/src/components/settings/AiSettings.tsx`, `apps/desktop/src/components/settings/AiProviderConfig.tsx`
- **关联文档**：07c-侧边栏与命令面板视觉规范.md §7; 04b-API设计.md §6

### 4.15 — AI 全模块端到端联调
- **依赖**：4.05, 4.10, 4.11, 4.13, 4.14
- **工时**：6h
- **验收标准**：
  - 配置 OpenAI provider → 测试连接成功 → AI Chat 对话流畅
  - 自然语言创建请求 → 确认 → 请求填充到 Tab → 发送请求成功
  - 生成测试脚本 → 确认 → 脚本填充到 Post-response Script → 执行测试通过
  - 生成 API 文档 → 确认 → 文档保存到 Collection README.md
  - 响应解释 → Explain 按钮点击 → AI 解释显示
  - 错误修复 → 4xx 响应 → Fix 建议 → Apply Fix → 请求参数修改 → 重新发送成功
  - MCP Server 添加 → discover tools → tool 结果注入 AI 上下文
  - Agent 预设创建 → 切换预设 → 不同权限生效
  - 本地 SLM stub 调用不崩溃（返回友好提示 "Local SLM not yet available"）
  - 全流程无 console error，TypeScript 类型检查通过，ESLint 无 warning
- **关键文件**：所有 AI 相关文件
- **关联文档**：03-功能设计.md §16; 04a-架构设计.md §3; 08-开发指南.md §3

---

## 任务依赖关系图

```
Week 1
4.01 ── 4.02 ── 4.03 ── 4.04 ── 4.05
         │              │
         │              └─── 4.04 ── 4.05

Week 2
4.05 ── 4.06 ──┐
4.05 ── 4.07 ──┤── 4.10
4.05 ── 4.08 ──┤
4.05 ── 4.09 ──┘

Week 3
4.01 ── 4.11 ── 4.12
                   │
4.10 ── 4.13 ─────┤── 4.14 ── 4.15
4.11 ─────────────┘
```

---

*文档版本: v1.0*
*创建时间: 2026-04-17*
*基于: 03-功能设计.md §16; 04a-架构设计.md §3.7; 04b-API设计.md §6*