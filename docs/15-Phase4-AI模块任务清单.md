# Phase 4 任务清单 — AI 模块（4 周）

> 本文档覆盖 03-功能设计.md §16 AI Agent 模块的实现任务，并整合深度分析后的扩展功能。所有 AI 请求走 Rust 后端，前端不直接调用 AI API。AgentAction 使用 OpenAI Function Calling / Structured Output 约束，不用正则解析自由文本。

---

## Sprint 总览

| Sprint | 时间 | 任务数 | 总工时 | 核心目标 |
|--------|------|--------|--------|----------|
| Week 1 | Day 1-5 | 5 | 26h | AI Provider 配置 + Streaming Chat + Context 注入 + 对话持久化 |
| Week 2 | Day 6-10 | 5 | 30h | AgentAction 体系 + 自然语言创建请求 + cURL 导入 + Slash Commands |
| Week 3 | Day 11-15 | 5 | 30h | 响应解释/修复 + 测试生成 + 智能变量提取 + Mock 数据生成 |
| Week 4 | Day 16-20 | 5 | 30h | 文档生成 + Collection 分析 + MCP Server + Ollama 本地 SLM + 全模块联调 |

### 与原规划（v1.0）的主要变更

| 变更 | 原规划 | 新规划 | 理由 |
|------|--------|--------|------|
| Sprint 周期 | 3 周 | 4 周 | 新增 5 个扩展任务 + AgentAction 架构升级 |
| Streaming | 仅在 4.01/4.03 提及 | Week 1 核心任务 | 无 streaming 体感极差，必须优先 |
| AgentAction | 正则解析自由文本 | Function Calling / Structured Output | 可靠性远高于正则，主流 AI API 均支持 |
| 对话持久化 | 无 | 4.05 新增 | 关闭 Tab 对话丢失，用户无法回顾 |
| Slash Commands | 无 | 4.08 新增 | `/explain` `/fix` `/test` 一键触发，效率翻倍 |
| 智能变量提取 | 无 | 4.12 新增 | AI 从 URL/响应自动识别可提取变量 |
| Mock 数据生成 | 无 | 4.13 新增 | 基于 Schema 生成真实感 mock 数据 |
| Collection 分析 | 无 | 4.15 新增 | 一键分析缺测试/缺文档/鉴权不一致 |
| 响应 Diff 对比 | 无 | 4.16 新增 | AI 对比两次响应差异 |
| 本地 SLM | stub 占位 | 4.18 对接 Ollama | Ollama 已实现 OpenAI-compatible API，改动最小 |
| Agent Builder | Week 3 核心 | 移除 | 过于复杂，多数用户用不上自定义 Agent，后续按需加回 |
| AI Settings | 独立任务 4.14 | 合入各功能 | 各功能自带配置，无需独立 Settings 页 |

---

## Week 1: Provider 配置 + Streaming Chat（Day 1-5）

### 4.01 — AI Provider Rust 后端（含 Streaming）
- **依赖**：Phase 1-3 完成
- **工时**：8h
- **验收标准**：
  - 重构 `ai/provider.rs`，新增 `ai_stream_chat` Command
  - `ai_stream_chat`：Rust 侧使用 `reqwest` 发送 `stream: true` 请求，逐行解析 SSE `data: {...}`，通过 `app.emit("ai-stream-chunk", AiStreamChunk)` 推送前端
  - 流结束时 emit `done: true` 的 chunk
  - 支持 OpenAI-compatible API（含 DeepSeek、Qwen、Moonshot 等）
  - `ai_chat` 保留非流式接口供简单调用
  - Provider 配置持久化到 `{app_data}/ai-providers.json`
  - apiKey 存储使用 Rust keyring（不通过 IPC 传输），配置文件仅存 provider name + baseUrl + model
  - 所有 Command 返回 `Result<T, AppError>`
  - `#[derive(TS)]` 导出 TypeScript 类型：`AiProviderConfig`、`AiChatRequest`、`AiChatResponse`、`AiStreamChunk`
  - `ai/local.rs` 模块保留 stub，Week 4 对接 Ollama
- **关键文件**：`apps/desktop/src-tauri/src/ai/provider.rs`, `apps/desktop/src-tauri/src/ai/local.rs`, `apps/desktop/src-tauri/src/ai/mod.rs`
- **关联文档**：03-功能设计.md §16; 04a-架构设计.md §3; 04b-API设计.md §6

### 4.02 — AI Provider 配置 Store（已部分实现，需补全）
- **依赖**：4.01
- **工时**：3h
- **验收标准**：
  - `packages/core/src/ai/store.ts` 中 `useProviderStore` 已有基础 CRUD
  - 补充：`testConnection()` 成功显示绿点 + 响应延迟（ms），失败显示红点 + 错误信息
  - 补充：Provider 新增时支持输入 apiKey，通过独立 Command `ai_set_api_key` 传到 Rust keyring（前端不持久化 apiKey）
  - 新增 `ai_set_api_key` / `ai_get_api_key_status` Command（返回 key 是否存在，不返回 key 值）
- **关键文件**：`packages/core/src/ai/store.ts`, `apps/desktop/src-tauri/src/ai/provider.rs`
- **关联文档**：08-开发指南.md §3; 04b-API设计.md §6

### 4.03 — AI Chat Panel UI 组件（含 Streaming）
- **依赖**：4.01, 4.02
- **工时**：8h
- **验收标准**：
  - 重构 `AiChatPanel.tsx`，集成 streaming
  - 前端通过 `listen('ai-stream-chunk', ...)` 接收 SSE chunk，逐字追加到 assistant 消息气泡
  - Streaming 期间显示光标闪烁动画，`done: true` 时停止
  - 消息列表区分 user（右对齐/fg-primary）和 assistant（左对齐/fg-secondary + bg-elevated 背景）
  - 输入框支持多行（Enter 发送，Shift+Enter 换行）
  - 对话历史按 session 存储，切换 Tab 时保留各 Tab 独立对话
  - 面板顶部显示当前 Provider 名称 + model，点击可切换
  - 支持 Markdown 渲染 assistant 回复（代码块语法高亮，使用 react-markdown + rehype-highlight）
  - Streaming 中断处理：网络中断时保留已接收内容，标记为 partial
- **关键文件**：`apps/desktop/src/components/ai/AiChatPanel.tsx`
- **关联文档**：03-功能设计.md §16.1; 07c-侧边栏与命令面板视觉规范.md §5

### 4.04 — AI Context Injection（已部分实现，需增强）
- **依赖**：4.01, 4.03
- **工时**：3h
- **验收标准**：
  - `packages/core/src/ai/context-builder.ts` 已有基础实现
  - 增强：注入当前请求完整信息（method + url + headers + body summary + auth type），不超过 2KB
  - 增强：注入当前响应状态（status code + content-type + body 前 500 字符摘要），供 `/explain` `/fix` 使用
  - 增强：注入环境变量键名（不传值，仅 `{{base_url}}` 等占位符列表）
  - 上下文以 system message 形式发送
  - 用户可在 Chat Panel 底部勾选/取消勾选上下文项（request / environment / collection / response）
- **关键文件**：`packages/core/src/ai/context-builder.ts`, `apps/desktop/src/components/ai/AiChatPanel.tsx`
- **关联文档**：03-功能设计.md §16.1 AgentContext; 04a-架构设计.md §3.7

### 4.05 — AI Chat 持久化 + 端到端联调
- **依赖**：4.01, 4.02, 4.03, 4.04
- **工时**：4h
- **验收标准**：
  - 对话历史持久化到 `{app_data}/ai-sessions/{tabId}.json`，关闭 Tab 后重新打开仍可恢复
  - 新增 Tauri Command：`ai_save_session`、`ai_load_session`、`ai_delete_session`
  - 端到端联调：
    - 配置 OpenAI provider → testConnection 显示绿点 + 延迟
    - 输入自然语言问题 → streaming 逐字显示
    - 切换 Tab → 各 Tab 对话独立保留
    - 上下文注入生效 → AI 能感知当前请求信息
    - 错误场景：apiKey 无效、网络超时、provider 连接失败 → AppError 分类展示 + toast
- **关键文件**：`packages/core/src/ai/chat-client.ts`, `apps/desktop/src-tauri/src/ai/provider.rs`
- **关联文档**：04a-架构设计.md §3; 08-开发指南.md §3

---

## Week 2: AgentAction + 请求创建 + Slash Commands（Day 6-10）

### 4.06 — AgentAction 体系 + Function Calling
- **依赖**：4.05
- **工时**：8h
- **验收标准**：
  - 新增 `packages/core/src/ai/action-types.ts`，定义 AgentAction 类型体系：
    - `create_request`: 创建 HTTP 请求
    - `modify_request`: 修改当前请求参数
    - `write_test`: 写入测试脚本
    - `generate_doc`: 生成 API 文档
    - `fix_error`: 修复请求错误
    - `extract_variables`: 提取环境变量
    - `generate_mock`: 生成 mock 数据
  - 每种 action 定义 Zod schema，AI 返回 JSON 必须通过 schema 验证
  - Rust 端新增 `ai_chat_with_tools` Command，向 AI API 发送 `tools` 参数（OpenAI Function Calling 格式）
  - AI 返回 `tool_calls` 时，前端解析为 AgentAction，渲染预览卡片，用户 Confirm/Reject
  - 新增 `packages/core/src/ai/action-dispatcher.ts`，统一 dispatch action 到对应 store
  - autoRun 标记的 action（用户在 Settings 中配置）自动执行不弹确认
  - action 执行结果反馈到 Chat Panel：成功显示 ✓ + 变更摘要，失败显示 ✗ + 错误信息
- **关键文件**：`packages/core/src/ai/action-types.ts`, `packages/core/src/ai/action-dispatcher.ts`, `apps/desktop/src/components/ai/AiActionCard.tsx`, `apps/desktop/src-tauri/src/ai/provider.rs`
- **关联文档**：03-功能设计.md §16.1 AgentAction; 04b-API设计.md §6

### 4.07 — 自然语言创建请求 + cURL 导入
- **依赖**：4.06
- **工时**：6h
- **验收标准**：
  - Chat Panel 输入 "创建一个 GET 请求到 https://api.example.com/users"，AI 返回 AgentAction（type: create_request）
  - AI 生成完整 HttpRequest 对象（method + url + headers + body + auth），前端解析并填充到新 Tab
  - 用户确认后点击 "Apply" 按钮，请求自动保存到活跃 Collection
  - 支持从 cURL 命令创建请求：
    - Chat Panel 输入 `curl -X POST https://api.example.com/users -H "Content-Type: application/json" -d '{"name":"test"}'`
    - AI 解析为完整 HttpRequest，与手动输入等效
  - cURL 导入也支持从剪贴板粘贴（Chat Panel 自动检测剪贴板中的 curl 开头文本）
  - AI 返回的 JSON 使用 Zod schema 验证，验证失败显示具体字段 diff 提示
- **关键文件**：`apps/desktop/src/components/ai/AiActionCard.tsx`, `packages/core/src/ai/action-parser.ts`
- **关联文档**：03-功能设计.md §16.1 AgentAction.create_request; 04b-API设计.md §6

### 4.08 — Slash Commands 快捷 Action
- **依赖**：4.06
- **工时**：4h
- **验收标准**：
  - Chat Panel 输入框支持 `/` 前缀触发快捷命令，弹出自动补全菜单：
    - `/explain` — 解释当前响应（等效 "解释当前请求的响应"）
    - `/fix` — 修复当前请求错误（等效 "修复当前请求"）
    - `/test` — 为当前请求生成测试脚本
    - `/doc` — 生成当前请求/Collection 的 API 文档
    - `/mock` — 为当前响应生成 mock 数据
    - `/extract` — 从当前响应提取变量
    - `/diff` — 对比当前响应与上次响应差异
  - Slash command 不走自由对话，直接构造结构化 prompt + context，减少 token 消耗
  - 命令结果仍走 AgentAction 确认流程
  - 输入 `/` 后自动弹出补全列表，支持模糊搜索
- **关键文件**：`apps/desktop/src/components/ai/SlashCommandMenu.tsx`, `packages/core/src/ai/slash-commands.ts`
- **关联文档**：03-功能设计.md §16.1

### 4.09 — AI Request Modification（Modify Request Action）
- **依赖**：4.06
- **工时**：4h
- **验收标准**：
  - Chat Panel 输入 "把请求方法改为 POST，添加 Content-Type header"，AI 返回 AgentAction（type: modify_request）
  - AI 返回修改指令：`{ path: "headers", op: "add", value: { key: "Content-Type", value: "application/json" } }` 等
  - 前端应用修改指令到当前 RequestStore，高亮变更字段
  - 支持多种修改：method / url / headers / params / body / auth
  - 修改预览卡片显示变更 diff（红删绿增），用户 Confirm 后应用
- **关键文件**：`apps/desktop/src/components/ai/AiModifyCard.tsx`, `packages/core/src/ai/action-dispatcher.ts`
- **关联文档**：03-功能设计.md §16.1 AgentAction.modify_request

### 4.10 — AI Action 确认流 + 执行反馈
- **依赖**：4.06, 4.07, 4.08, 4.09
- **工时**：8h
- **验收标准**：
  - 所有 AgentAction 统一走确认流程：AI 返回 action → 渲染预览卡片 → 用户 Confirm/Reject
  - 预览卡片根据 action type 渲染不同内容：
    - `create_request`: 显示 method + url + headers + body 摘要
    - `modify_request`: 显示变更 diff（红删绿增）
    - `write_test`: 显示生成的脚本代码（语法高亮）
    - `generate_doc`: 显示 Markdown 预览
    - `fix_error`: 显示修复建议 + diff
    - `extract_variables`: 显示提取的变量列表 + 目标环境
    - `generate_mock`: 显示生成的 mock 数据预览
  - Confirm 后 apply action 到对应 store
  - Reject 后丢弃 action，Chat Panel 记录拒绝历史
  - autoRun 标记的 action 自动执行不弹确认
  - action 执行结果反馈到 Chat Panel：成功显示 ✓ + 变更摘要，失败显示 ✗ + 错误信息
- **关键文件**：`apps/desktop/src/components/ai/AiActionConfirm.tsx`, `apps/desktop/src/components/ai/AiActionCard.tsx`, `packages/core/src/ai/action-dispatcher.ts`
- **关联文档**：03-功能设计.md §16.1 AgentAction.confirmed/autoRun

---

## Week 3: 解释/修复 + 测试生成 + 智能提取（Day 11-15）

### 4.11 — AI Response Explanation & Fix
- **依赖**：4.10
- **工时**：6h
- **验收标准**：
  - Response Panel 新增 "Explain" 按钮（Brain 图标），点击后 AI 解释当前响应（status code 含义 + body 结构分析 + 潜在问题）
  - 响应错误时（4xx/5xx），Explain 按钮变为 "Fix" 按钮（Wrench 图标），AI 自动分析请求参数/headers/body 问题并给出修改建议
  - 点击 "Fix" → AI 返回 AgentAction（type: fix_error），包含具体修改指令
  - 用户点击 "Apply Fix" → 自动修改请求参数
  - 解释和修复建议在 Chat Panel 中以 Markdown 渲染
  - 支持 SSE streaming 逐步展示解释
  - 也可通过 `/explain` `/fix` slash command 触发
- **关键文件**：`apps/desktop/src/components/ai/AiExplainButton.tsx`, `apps/desktop/src/components/ai/AiFixCard.tsx`, `packages/core/src/ai/explain-client.ts`
- **关联文档**：03-功能设计.md §16.1 AgentAction.explain_response/fix_error

### 4.12 — AI 智能变量提取
- **依赖**：4.10
- **工时**：6h
- **验收标准**：
  - Chat Panel 输入 "从响应中提取变量" 或 `/extract`，AI 分析当前响应 body，识别可提取变量
  - AI 返回 AgentAction（type: extract_variables），包含：
    - 变量名建议（如 `user_id`、`auth_token`）
    - JSONPath / 提取表达式
    - 目标环境（当前活跃环境）
  - 用户确认后，变量自动添加到当前环境的变量列表
  - 同时更新请求中对应的硬编码值为 `{{variable}}` 引用（需用户二次确认）
  - 支持批量提取：一次响应提取多个变量
  - 智能推断变量名：`response.users[0].id` → `{{user_id}}`，`response.token` → `{{auth_token}}`
- **关键文件**：`apps/desktop/src/components/ai/AiExtractCard.tsx`, `packages/core/src/ai/variable-extractor.ts`
- **关联文档**：03-功能设计.md §16.1; 03-功能设计.md §5 环境变量

### 4.13 — AI Mock 数据生成
- **依赖**：4.10
- **工时**：6h
- **验收标准**：
  - Chat Panel 输入 "为这个端点生成 mock 数据" 或 `/mock`，AI 分析当前响应 body 结构
  - AI 返回 AgentAction（type: generate_mock），包含：
    - 符合响应 Schema 的 mock 数据（JSON）
    - Mock Server 路由配置（method + path + status code + response body）
  - 用户确认后，mock 路由自动添加到 Mock Server
  - 支持多种 mock 场景：
    - 成功响应（2xx）
    - 错误响应（4xx/5xx）
    - 边界数据（空列表、最大长度、特殊字符）
  - 生成的 mock 数据具有真实感（不是 "string1"/"1" 等明显假数据）
  - 可指定生成数量：`/mock 5` 生成 5 条不同数据
- **关键文件**：`apps/desktop/src/components/ai/AiMockCard.tsx`, `packages/core/src/ai/mock-generator.ts`
- **关联文档**：03-功能设计.md §16.1; 03-功能设计.md §10 Mock Server

### 4.14 — AI Test Script Generation
- **依赖**：4.10
- **工时**：6h
- **验收标准**：
  - Chat Panel 输入 "为当前请求生成测试脚本" 或 `/test`，AI 返回 AgentAction（type: write_test）
  - AI 生成 `pm.test()` + `pm.expect()` 脚本代码，基于当前请求的 method + url + 响应 status + body 结构
  - 生成脚本通过 Zod 验证后，用户点击 "Apply" → 自动填充到 Post-response Script 编辑器
  - 支持多种测试模板：
    - 状态码断言：`pm.test("Status is 200", () => pm.expect(pm.response.status).to.equal(200))`
    - 响应结构断言：检查必需字段存在
    - 类型断言：检查字段类型
    - 业务逻辑断言：检查特定值
  - 支持 "为整个 Collection 生成测试脚本"（批量生成，每个请求一个测试）
  - 生成的脚本在 rquickjs 中可执行，断言结果正常显示
- **关键文件**：`apps/desktop/src/components/ai/AiScriptApply.tsx`, `packages/core/src/ai/test-generator.ts`
- **关联文档**：03-功能设计.md §16.1 AgentAction.write_test; 03-功能设计.md §6 pm API

### 4.15 — AI Collection 批量分析
- **依赖**：4.10
- **工时**：6h
- **验收标准**：
  - Chat Panel 输入 "分析当前 Collection"，AI 扫描整个 Collection 并生成分析报告
  - 分析报告包含：
    - 缺少测试的端点列表
    - 缺少文档描述的端点列表
    - 鉴权配置不一致的端点（如同 Collection 内有的用 Bearer 有的用 Basic）
    - 未使用环境变量的硬编码 URL
    - 重复或冲突的端点
  - 报告以 Markdown 渲染在 Chat Panel
  - 每个问题项提供快捷修复按钮（如 "为缺失测试的端点批量生成测试" → 触发 4.14 批量测试生成）
  - 分析结果可导出为 Markdown 文件
- **关键文件**：`apps/desktop/src/components/ai/AiAnalysisReport.tsx`, `packages/core/src/ai/collection-analyzer.ts`
- **关联文档**：03-功能设计.md §4 Collection; 03-功能设计.md §16.1

---

## Week 4: 文档 + Diff + MCP + Ollama + 联调（Day 16-20）

### 4.16 — AI 响应 Diff 对比
- **依赖**：4.10
- **工时**：4h
- **验收标准**：
  - Chat Panel 输入 "对比当前响应和上次响应" 或 `/diff`，AI 对比同一请求的两次响应
  - Diff 结果显示：
    - 新增字段（绿色高亮）
    - 删除字段（红色高亮）
    - 值变更字段（黄色高亮）
  - 支持选择对比基准：上次响应 / 历史记录中某次响应
  - Diff 结果在 Chat Panel 以 Markdown 表格渲染
  - 结构性变更（字段增删）+ 值变更分别标注
- **关键文件**：`apps/desktop/src/components/ai/AiDiffView.tsx`, `packages/core/src/ai/response-differ.ts`
- **关联文档**：03-功能设计.md §3 HttpResponse; 03-功能设计.md §16.1

### 4.17 — AI Documentation Generation
- **依赖**：4.10
- **工时**：6h
- **验收标准**：
  - Chat Panel 输入 "生成当前 Collection 的 API 文档" 或 `/doc`，AI 返回 AgentAction（type: generate_doc）
  - AI 生成 Markdown 文档，包含：概述 + 端点列表 + 每个端点的 method/path/params/body/response 示例
  - 用户点击 "Apply" → 文档保存到 Collection 的 README.md 文件
  - 支持单请求文档生成和整个 Collection 文档生成
  - 生成文档格式符合 OpenAPI 风格，可后续导出为 OpenAPI spec
  - 文档中自动引用环境变量（`{{base_url}}` 而非硬编码 URL）
- **关键文件**：`apps/desktop/src/components/ai/AiDocPreview.tsx`, `packages/core/src/ai/doc-generator.ts`
- **关联文档**：03-功能设计.md §16.1 AgentAction.generate_doc; 03-功能设计.md §4 Collection

### 4.18 — Ollama 本地 SLM 集成
- **依赖**：4.01
- **工时**：6h
- **验收标准**：
  - 重构 `ai/local.rs`，实现 Ollama Provider（连接 `http://localhost:11434`）
  - Ollama 已实现 OpenAI-compatible API（`/v1/chat/completions`），复用 `provider.rs` 的请求逻辑
  - 新增 Provider 类型 `ollama`，配置项：baseUrl（默认 `http://localhost:11434`）+ model（如 `llama3`、`qwen2.5`）
  - 自动检测 Ollama 是否运行：`ai_test_connection` 对 Ollama 类型发送 `GET /api/tags` 检查
  - 不需要 apiKey（本地模型）
  - Settings 中添加 "Local Model (Ollama)" 快捷配置入口
  - Ollama 不可用时显示友好提示："Ollama 未运行，请先启动 Ollama（ollama serve）"
  - Streaming 同样支持（Ollama 原生支持 SSE streaming）
- **关键文件**：`apps/desktop/src-tauri/src/ai/local.rs`, `apps/desktop/src-tauri/src/ai/provider.rs`
- **关联文档**：03-功能设计.md §16; 04a-架构设计.md §3

### 4.19 — MCP Server Rust 后端 + UI 管理
- **依赖**：4.01
- **工时**：8h
- **验收标准**：
  - 新增 `ai/mcp.rs` 模块，实现 MCP (Model Context Protocol) client：连接 MCP Server（stdio/SSE transport）、发现 tools/resources、调用 tool 并返回结果
  - 新增 Tauri Commands：`mcp_list_servers`、`mcp_add_server`、`mcp_remove_server`、`mcp_call_tool`、`mcp_list_tools`
  - MCP Server 配置持久化到 `{app_data}/mcp-servers.json`
  - MCP tool 调用结果作为 AI 上下文注入，供 AI Chat 使用
  - Settings 页新增 "MCP Servers" 入口：
    - 列表显示已配置的 MCP Server（名称 + transport 类型 + 状态指示器）
    - 支持添加/删除 MCP Server
    - "Discover Tools" 按钮 → 显示可用 tools 列表（tool name + description + input schema）
  - 所有 Command 返回 `Result<T, AppError>`
  - `#[derive(TS)]` 导出 TypeScript 类型：`McpServerConfig`、`McpTool`、`McpToolCallResult`
- **关键文件**：`apps/desktop/src-tauri/src/ai/mcp.rs`, `apps/desktop/src/components/settings/McpServerManager.tsx`
- **关联文档**：MCP Protocol Spec; 04a-架构设计.md §3; 04b-API设计.md §6

### 4.20 — AI 全模块端到端联调
- **依赖**：4.05, 4.10, 4.11, 4.14, 4.17, 4.18, 4.19
- **工时**：6h
- **验收标准**：
  - **Provider 配置**：配置 OpenAI provider → testConnection 显示绿点 + 延迟 → 配置 Ollama provider → 检测到 Ollama 运行
  - **基础对话**：输入自然语言问题 → streaming 逐字显示 → 对话历史持久化
  - **Slash Commands**：输入 `/explain` → AI 解释当前响应 → 输入 `/test` → AI 生成测试脚本
  - **请求创建**：自然语言创建请求 → 确认 → 请求填充到 Tab → 发送请求成功
  - **cURL 导入**：粘贴 cURL 命令 → AI 解析 → 请求创建 → Apply
  - **响应解释/修复**：4xx 响应 → Fix 建议 → Apply Fix → 请求参数修改 → 重新发送成功
  - **测试生成**：生成测试脚本 → 确认 → 脚本填充到 Post-response Script → 执行测试通过
  - **变量提取**：从响应提取变量 → 确认 → 变量添加到环境 → 请求中硬编码值替换为 `{{variable}}`
  - **Mock 生成**：为端点生成 mock 数据 → 确认 → mock 路由添加到 Mock Server
  - **文档生成**：生成 Collection 文档 → 确认 → 文档保存到 Collection README.md
  - **Collection 分析**：分析 Collection → 显示缺失测试/文档/鉴权不一致的报告
  - **响应 Diff**：对比两次响应 → 显示差异
  - **MCP Server**：添加 MCP Server → discover tools → tool 结果注入 AI 上下文
  - **Ollama**：配置 Ollama provider → 使用本地模型对话 → streaming 正常
  - **错误场景**：apiKey 无效 / Ollama 未运行 / MCP 连接失败 / 网络超时 → AppError 分类展示 + toast
  - 全流程无 console error，TypeScript 类型检查通过，ESLint 无 warning
- **关键文件**：所有 AI 相关文件
- **关联文档**：03-功能设计.md §16; 04a-架构设计.md §3; 08-开发指南.md §3

---

## 任务依赖关系图

```
Week 1 — 基础设施
4.01 ── 4.02 ── 4.03 ── 4.04 ── 4.05

Week 2 — AgentAction 体系
         ┌── 4.07 (创建请求 + cURL)
4.05 ── 4.06 ──┤── 4.08 (Slash Commands)
         │     └── 4.09 (修改请求)
         └──────────── 4.10 (确认流)

Week 3 — 智能功能
4.10 ── 4.11 (解释/修复)
4.10 ── 4.12 (变量提取)
4.10 ── 4.13 (Mock 生成)
4.10 ── 4.14 (测试生成)
4.10 ── 4.15 (Collection 分析)

Week 4 — 扩展 + 联调
4.10 ── 4.16 (响应 Diff)
4.10 ── 4.17 (文档生成)
4.01 ── 4.18 (Ollama)
4.01 ── 4.19 (MCP Server)
全部 ── 4.20 (端到端联调)
```

---

## AgentAction 类型速查

| Action Type | 触发方式 | 输入 | 输出 | Apply 目标 |
|-------------|----------|------|------|-----------|
| `create_request` | 对话 / cURL / `/create` | 自然语言描述 | 完整 HttpRequest 对象 | 新 Tab + RequestStore |
| `modify_request` | 对话 | 修改指令 | 变更指令列表 | 当前 Tab RequestStore |
| `write_test` | `/test` | 当前请求上下文 | pm.test() 脚本代码 | Post-response Script 编辑器 |
| `generate_doc` | `/doc` | Collection/请求上下文 | Markdown 文档 | Collection README.md |
| `fix_error` | `/fix` / Explain 按钮 | 错误响应上下文 | 修改指令列表 | 当前 Tab RequestStore |
| `extract_variables` | `/extract` | 响应 body 上下文 | 变量名 + 提取表达式列表 | EnvironmentStore |
| `generate_mock` | `/mock` | 响应 Schema 上下文 | Mock 数据 + 路由配置 | MockStore + Mock Server |
| `explain_response` | `/explain` / Explain 按钮 | 响应上下文 | Markdown 解释文本 | Chat Panel（只读） |

---

## Slash Commands 速查

| 命令 | 功能 | 等效对话 | Token 节省 |
|------|------|----------|-----------|
| `/explain` | 解释当前响应 | "解释当前请求的响应" | ~60% |
| `/fix` | 修复请求错误 | "修复当前请求的错误" | ~60% |
| `/test` | 生成测试脚本 | "为当前请求生成测试脚本" | ~50% |
| `/doc` | 生成 API 文档 | "生成当前 Collection 的 API 文档" | ~50% |
| `/mock` | 生成 Mock 数据 | "为这个端点生成 mock 数据" | ~55% |
| `/extract` | 提取变量 | "从响应中提取变量" | ~55% |
| `/diff` | 响应对比 | "对比当前响应和上次响应" | ~60% |
| `/analyze` | Collection 分析 | "分析当前 Collection 的问题" | ~40% |

---

*文档版本: v2.0*
*创建时间: 2026-04-17*
*更新时间: 2026-05-06*
*基于: 03-功能设计.md §16; 04a-架构设计.md §3.7; 04b-API设计.md §6*
*变更: v1.0→v2.0 整合深度分析扩展功能（Streaming 优先 / Function Calling / Slash Commands / 智能变量提取 / Mock 生成 / Collection 分析 / 响应 Diff / Ollama 集成），移除 Agent Builder（后续按需加回），扩展为 4 周 20 任务*
