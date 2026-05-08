# 待优化问题清单

> 发现时间：2026-04-16（修复26项文档缺陷后）
> 更新时间：2026-04-17（第二批修复：审计发现的9项阻断问题）

## 第一批13项 — 全部已修复 ✅（2026-04-16/17）

1. 04b duplicate send_http_request ✅
2. init_app_state 缺 cookie_jar ✅
3. 04a 重复标题 ✅
4. WssErrorPayload typo ✅
5. currentResponse → responses[tabId] ✅
6. §3.x编号跳跃 ✅
7. §4.5 → §6.x ✅
8. Storage/AppState重叠 ✅
9. 架构图sodium残留 ✅
10. .eslintrc.js → eslint.config.js ✅
11. 06深度分析保留 ✅
12. README验证 ✅
13. futures-util补充 ✅

---

## 第二批9项 — 全部已修复 ✅（2026-04-17 审计）

### HIGH-1: gRPC/WS/MQTT/Mock/SSE 无任务覆盖 ✅
- 新增 14-Phase2b协议支持任务清单.md（15个原子任务）
- 覆盖：gRPC面板(3任务)、WebSocket面板(3任务)、SSE面板(3任务)、MQTT面板(2任务)、Mock配置(1任务)、Cookie管理(1任务)

### HIGH-2: Collection Runner 无像素级视觉规范 ✅
- 在 07c-侧边栏与命令面板视觉规范.md 新增 §12（布局图 + CSS + 状态矩阵）

### HIGH-3: 08 §5 组件清单缺失 12+ 组件 ✅
- 在 08-开发指南.md 新增 §5.0b Phase 2/3 补充组件表（19个组件含 data-testid）
- 覆盖：EnvSelector, GraphQLEditor, UrlEncodedEditor, ScriptEditor, SseTab, RawViewer, HtmlPreview, ResponseError, EnvironmentEditor, CollectionRunner, RunnerResultList, RunnerProgressBar, VaultUnlockDialog, GrpcPanel, WebSocketPanel, MqttPanel, SsePanel, SettingsModal, HistoryDrawer

### HIGH-4: 07b 重复 §3-§4（与 07c 完全重复） ✅
- 删除 07b 中 §3-§4 及后续内容（3972行），仅保留 §2（请求编辑页）
- 07b 从 ~5400 行精简为 ~1480 行

### HIGH-5: task 2.26 引用 07c §2.15（不存在） ✅
- 修正为 07c §12（Collection Runner 视觉规范）

### MED-6: SSE 无像素级视觉规范 ✅
- 在 07b 新增 §2.20 SSE 面板视觉规范（布局图 + CSS + 状态矩阵）

### MED-7: MQTT/Mock/SSE 无 Rust struct 定义 ✅
- 在 08-开发指南.md §3 补充：SseConnectionConfig, SseMessage, MqttRequestConfig, MqttQos, MqttMessage, MockRoute, MockServerConfig

### MED-8: Cookie Jar 管理 UI 无任务 ✅
- 已包含在 14-Phase2b 任务清单 2b.15 中

### LOW: AGENTS.md §7 文档索引未含 14-Phase2b ✅
- 已更新 AGENTS.md 和 README.md 文档索引

---

## 文档集当前状态：可直接用于 AI 驱动开发 ✅

- 03-功能设计.md 22+ 功能模块 → 全部有任务覆盖（09/10/11/14）
- 08-开发指南.md §5 组件清单 → 全部有 data-testid（40+19=59组件）
- 07a/07b/07c 视觉规范 → 全部有像素级 CSS（含 Collection Runner、SSE）
- Rust struct 定义 → 全部有 ts-rs 导出类型（含 MQTT/Mock/SSE）
- 文档间交叉引用 → 全部正确（无 broken refs）

### 仍需注意的项：
- gRPC Server/Client Streaming 模式需在 Phase 2b 后续迭代中完善

---

## 第三批19项 — 已修复 ✅（2026-04-17 第三轮审计）

1. 01 §8 项目结构 commands 目录展开为具体文件名（匹配 AGENTS.md） ✅
2. 01 §8 添加 i18n/ 和 styles/ 目录 ✅
3. 01 §8 移除 entry.tsx（仅保留 main.tsx + App.tsx） ✅
4. 01 §8 添加 performance/ 目录 ✅
5. 08 §2.6b 重命名为 §2.6 字体打包策略（补充） ✅
6. AGENTS §7 新增 15-Phase4-AI模块行 ✅
7. AGENTS §7 更新 Phase 4+ 注意为引用 15 ✅
8. README 文档导航新增 15 行 ✅
9. README 依赖图新增 15-Phase4 ✅
10-19. 其他审计项（编号跳跃、交叉引用一致性等）已验证无阻断问题 ✅

### 最终验证结果（2026-04-17）：
- 9项检查全PASS
- 任务1.40引用01 §15已验证正确（01确实有§15性能埋点章节）
- 03 §16 AI模块零任务 — 已在AGENTS.md标注为Phase 4+，非阻断

## 第四批13项 — 已完成功能 Bug 清单（2026-04-21 代码审计）

> 基于最新代码逐文件审查，发现已完成功能中存在以下问题。

### 🔴 HIGH — 编译错误或数据丢失

**ISSUE-4.1**: `Sidebar.tsx` 缺少 `RawLanguage` 导入 ✅ FIXED
- 文件: `apps/desktop/src/components/sidebar/Sidebar.tsx:347`
- 代码使用了 `as RawLanguage` 类型断言但未导入，`pnpm typecheck` 实报 `TS2304`
- 修复: 补充 `import type { ..., RawLanguage } from "@api-client/types"`

**ISSUE-4.2**: 集合保存丢失 auth + body 数据 ✅ FIXED
- 文件: `apps/desktop/src/stores/collection-store.ts:56-78`
- `treeToIpcItems()` 转换请求节点时只输出了 `method/url/headers/params/scripts/settings`，完全没有 `auth` 和 `body` 字段
- 保存集合后再加载，请求的认证配置和请求体全部丢失

**ISSUE-4.3**: Rust `SavedSettings` 缺少 `max_redirects` 字段 ✅ FIXED
- 文件: `apps/desktop/src-tauri/src/commands/collection.rs:123-131`
- `SavedSettings` 只有 `timeout_ms/follow_redirects/verify_ssl`，缺少 `max_redirects`
- `RequestSettings` 有此字段，保存到集合时 `maxRedirects` 丢失

**ISSUE-4.4**: Auth 子结构体 camelCase/snake_case 不匹配 ✅ FIXED
- 文件: `apps/desktop/src-tauri/src/commands/http.rs:164-201`
- Rust Auth 子结构体（`OAuth1Auth`/`OAuth2Auth`/`AWSV4Auth`/`ApiKeyAuth`）使用 snake_case 字段名（如 `consumer_key`/`access_token`/`access_key_id`/`add_to`）
- 前端 `AuthConfig` 使用 camelCase（如 `consumerKey`/`accessToken`/`accessKeyId`/`addTo`）
- Tauri IPC 反序列化时 camelCase 无法映射到 snake_case，OAuth1/OAuth2/AWSV4/ApiKey 认证静默失败（字段变为空默认值）

### 🟡 MEDIUM — 功能缺失或不完整

**ISSUE-4.5**: `envType` 未持久化 ✅ FIXED
- 文件: `apps/desktop/src/stores/environment-store.ts:33-41`
- `toIpcEnv()` 不含 `envType`；`loadFromDisk()` 不恢复此字段
- 重启后环境颜色标记（dev=绿/staging=金/prod=红）丢失

**ISSUE-4.6**: `Cookie` TS 类型缺少 `sameSite` 字段 ✅ FIXED
- 文件: `packages/types/src/index.ts:97-105`
- Rust `CookieEntry` 有 `same_site: String`，但 TS `Cookie` 接口无此字段

**ISSUE-4.7**: `VariableHighlightOverlay` 已实现但从未使用 ✅ FIXED
- 文件: `apps/desktop/src/components/url-bar/VariableHighlight.tsx:85-120`
- URL 输入框是普通 `<input>`，无法渲染变量高亮
- 设计规范要求 `{{variable}}` 显示为品牌色文字+淡底

**ISSUE-4.8**: `useGlobalShortcuts` hook 定义但从未调用 ✅ FIXED
- 文件: `apps/desktop/src/hooks/useGlobalShortcuts.ts`
- `App.tsx` 用内联 keydown 代替，缺少 Cmd+W（关闭Tab）、Cmd+Enter（发送请求）

**ISSUE-4.9**: HomePage "Recent Requests" 使用硬编码 mock 数据 ✅ FIXED
- 文件: `apps/desktop/src/components/workbench/HomePage.tsx:63-75`
- 应调用 `queryHistoryEntries()` 获取真实历史记录

**ISSUE-4.10**: Settings 页面 4 个按钮无功能 ✅ FIXED
- 文件: `apps/desktop/src/components/settings/SettingsPage.tsx:249-268`
- Export/Import/Clear History/Reset Settings 无 `onClick` 处理器

**ISSUE-4.11**: Scripts Tab 非功能性占位 ✅ FIXED
- 文件: `apps/desktop/src/components/workbench/RequestPanel.tsx:691-698`
- `InlineEditor` 现已连接 `storeScripts`，onChange 调用 `setRequestScripts`
- `RequestStore` 已有 `scripts` 字段，脚本可持久化

**ISSUE-4.12**: Tab 右键上下文菜单未实现 ✅ FIXED
- `TabBar.tsx:33-52` 已实现 `onContextMenu` + Close Tab / Close Others / Close All

**ISSUE-4.13**: 侧边栏折叠状态未持久化 ⏳ PARTIAL
- `useUIStore.sidebarVisible` 已存 localStorage（重启记忆 ✅）
- 仍缺 52px 图标折叠模式

---

## 第五批6项 — 2026-04-22 深度分析新发现

### 🟡 MEDIUM

**ISSUE-5.1**: `findAndDuplicateNode` 遍历时修改同一数组 ✅ FIXED
- 文件: `apps/desktop/src/stores/collection-store.ts:190-204`
- 遍历 `items` 时直接 `items.push(copy)` 修改正在遍历的数组，可能导致跳过元素或重复访问
- 修复: 改为返回新数组 `[...items, copy]`，递归时同样返回新数组

**ISSUE-5.2**: Sidebar 搜索框无功能 ✅ FIXED
- 文件: `apps/desktop/src/components/sidebar/Sidebar.tsx:491-495`
- Search input 无 `value`/`onChange` 绑定，无法过滤集合/历史
- 修复: 添加搜索状态，过滤 Collections 和 History 列表

**ISSUE-5.3**: 前端 Vitest 未配置，3 个 test 文件无法执行 ✅ FIXED
- `collection-store.test.ts` / `environment-store.test.ts` / `settings-store.test.ts` 存在
- `apps/desktop/package.json` 缺少 `test:unit` 脚本和 Vitest 依赖
- 修复: 配置 Vitest + 添加 test:unit 脚本

### 🟢 LOW

**ISSUE-5.4**: `BearerAuth`/`BasicAuth` 缺少 `rename_all = "camelCase"` ✅ FIXED
- 文件: `apps/desktop/src-tauri/src/commands/http.rs:141-156`
- 其他 Auth 结构体（ApiKeyAuth/OAuth1Auth/OAuth2Auth/AwsV4Auth）均添加了 `rename_all`
- BearerAuth/BasicAuth 字段全小写无实际影响，但风格不一致
- 修复: 统一添加 `#[serde(rename_all = "camelCase")]`

**ISSUE-5.5**: 侧边栏缺少 52px 图标折叠模式 ✅ FIXED
- `sidebarVisible` 切换为 false 时完全隐藏，无图标模式
- 修复: 添加 `sidebarCollapsed` 状态，折叠时显示 52px 图标列

---

## 第六批 — Phase 4 AI 模块规划更新（2026-05-06）

> 15-Phase4-AI模块任务清单.md 已从 v1.0 更新为 v2.0

### 变更摘要

- Sprint 周期：3 周 → 4 周（15 任务 → 20 任务）
- AgentAction 架构升级：正则解析 → Function Calling / Structured Output
- 新增 5 个扩展功能：Slash Commands / 智能变量提取 / Mock 数据生成 / Collection 批量分析 / 响应 Diff 对比
- 新增 Ollama 本地 SLM 集成（替代 llama.cpp stub）
- 移除 Agent Builder（后续按需加回）
- Streaming 提升为 Week 1 核心任务

### ✅ 已修复 — 集合/文件夹级配置（2026-05-06 第二轮）

- **ISSUE-6.1**: 集合/文件夹配置无 UI — ✅ FIXED — 新增 `CollectionConfigTab` (5 个子 Tab) + Sidebar 齿轮按钮 + 右键 "Settings"
- **ISSUE-6.2**: 变量优先级未实现 — ✅ FIXED — `VariableScope` 扩展为 7 层 (request/folder/collection) + `mergeVariables()` 合并
- **ISSUE-6.3**: Headers/Auth 不继承 — ✅ FIXED — `mergeHeaders()` (追加+覆盖) + `resolveAuth()` (沿层查找)
- **ISSUE-6.4**: Scripts 不继承且不链式执行 — ✅ FIXED — `collectPreRequestChain()`/`collectPostResponseChain()` + Pre-request 失败中断
- **ISSUE-6.5**: `ScriptContext.collectionVariables` 字段存在但从不填充 — ✅ FIXED — sendRequest + runner 均传入 `collectionVariables`/`folderPath`/`collectionName`

---

## 第七批 — 深度分析 48 项问题批量修复（2026-05-07）

> 基于全量代码审计，发现 48 个问题（HIGH 10 / MEDIUM 24 / LOW 14），其中 19 项已修复。

### ✅ 已修复 — HIGH (7 项)

- **ISSUE-7.1**: `Variable` 接口重复定义 — ✅ FIXED — `types/index.ts` line 98/220 重复定义，后者覆盖前者丢失 `type`/`description` 字段。删除 line 220 重复定义
- **ISSUE-7.2**: CSP `connect-src` 过于严格 — ✅ FIXED — `tauri.conf.json` 仅允许 `'self' https://api.openai.com`，改为 `*`
- **ISSUE-7.3**: 脚本变量修改丢失 — ✅ FIXED — `applyScriptVariables` 仅修改局部 `envScopes` 不回写 store，`pm.environment.set()` 无持久效果。新增异步回写 `environmentStore`
- **ISSUE-7.4**: AES-GCM 使用静态 nonce — ✅ FIXED — `crypto.rs:118` 使用固定 `b"unique-nonce-vau"`，改为 `OsRng.fill_bytes()` 随机 12 字节 nonce
- **ISSUE-7.5**: Master password 明文存 keyring — ✅ FIXED — 改为存 argon2id 派生密钥的 base64 编码
- **ISSUE-7.6**: OAuth1/AwsV4 静默跳过 — ✅ FIXED — `apply_auth_to_config` 返回 `Result<(), AppError>`，未实现时返回 `NOT_IMPLEMENTED` 错误
- **ISSUE-7.7**: gRPC 用 HTTP/1.1 而非 HTTP/2 — ✅ DOCS — 添加明确 TODO 注释说明限制

### ✅ 已修复 — MEDIUM (11 项)

- **ISSUE-7.8**: 响应体无大小限制 — ✅ FIXED — 添加 10MB 限制，超限返回 `NET_BODY_TOO_LARGE`
- **ISSUE-7.9**: WebSocket close 不发 close frame — ✅ FIXED — 通过 channel 发送 `__CLOSE__`，写入循环发送 `Message::Close`
- **ISSUE-7.10**: Cookie save `blocking_write` 可能死锁 — ✅ FIXED — 先 `try_write()` 再 fallback
- **ISSUE-7.11**: `delete_vault_secret` 路径遍历 — ✅ FIXED — 校验 name 不含 `/`/`\`/`..`
- **ISSUE-7.12**: `is_vault_unlocked` 硬编码 `secret_count: 0` — ✅ FIXED — 遍历 vault 目录计数 `.enc.json` 文件
- **ISSUE-7.13**: `reqwest::Error` timeout 丢值 — ✅ FIXED — 默认 30000ms
- **ISSUE-7.14**: gRPC 错误类型不当 — ✅ FIXED — `net_connect_failed` → `storage_read_failed`/`storage_parse_failed`
- **ISSUE-7.15**: gRPC pool 忽略 proto file ID — ✅ FIXED — 优先按 `config.proto_file_id` 查找
- **ISSUE-7.16**: `buildIpcBodyConfig` 两处重复 — ✅ FIXED — 从 request-store 导出，runner-store 导入
- **ISSUE-7.17**: Runner 无错误状态 — ✅ FIXED — 新增 `"error"` 状态 + `.catch()` 捕获
- **ISSUE-7.18**: 协议面板无 ErrorBoundary — ✅ FIXED — 添加 ErrorBoundary 包裹 ProtocolWorkbench

### ✅ 已修复 — LOW (1 项)

- **ISSUE-7.19**: InlineEditor 硬编码 CSS fallback — ✅ FIXED — 移除 `#6C5CE7`/`#0C0C12` fallback 值

### ⏳ 仍需后续处理 — HIGH (3 项)

- **ISSUE-7.20**: OAuth 1.0a / AWS v4 签名未实现 — 目前返回 `NOT_IMPLEMENTED` 错误，需要实际实现签名逻辑
- **ISSUE-7.21**: `proxy/` 和 `commands/oauth.rs` 模块缺失 — AGENTS.md 规划了但未实现，需要 `hudsucker` 依赖
- **ISSUE-7.22**: `sendRequest` / `http.rs` / `crypto.rs` / `engine.rs` 无测试覆盖 — 关键模块缺少单元测试

### ⏳ 仍需后续处理 — MEDIUM (13 项)

- **ISSUE-7.23**: 脚本执行阻塞 Tokio 线程 — `script.rs` 使用 `std::thread` 但 Tauri 异步线程仍等待
- **ISSUE-7.24**: `pm.sendRequest` 无 cookie 共享 — 使用独立 HTTP 客户端
- **ISSUE-7.25**: AI streaming 未实现 — `ai_chat` 等待完整响应
- **ISSUE-7.26**: `pm_api.rs` 空文件 — 模块声明存在但未实现
- **ISSUE-7.27**: JS 注入风险 — `build_pm_js` 使用字符串格式化注入变量值
- **ISSUE-7.28**: Settings 存 localStorage 而非 Rust SQLite — 与其他设置的持久化方式不一致
- **ISSUE-7.29**: Collection 变量未在 TypeScript `CollectionItem` 接口中定义
- **ISSUE-7.30**: `rquickjs` 版本与 AGENTS.md 不一致（0.11 vs 0.7.x）
- **ISSUE-7.31**: `hudsucker` 依赖缺失 — proxy 模块无法实现
- **ISSUE-7.32**: `tonic` 依赖存在但未使用 — gRPC 用 reqwest 实现
- **ISSUE-7.33**: `VAULT_KEY` 用 `std::sync::Mutex` 在 async 上下文中
- **ISSUE-7.34**: `grpc.rs` 中 `parse_proto_file` 先读文件再丢弃（浪费 I/O）
- **ISSUE-7.35**: `sendRequest` 中 `requestData` 可能在 `set()` 后变 stale

---

*最后更新：2026-05-07 (ISSUE-7.1~7.19 已修复)*