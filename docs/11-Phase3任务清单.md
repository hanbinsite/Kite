# Phase 3 任务清单 — 高级功能（6 周）

> 本文档将 Phase 3（高级功能）拆解为可执行、可验收的原子任务，按周划分 Sprint。
> 前提：Phase 1 和 Phase 2 已完成，所有 09-Phase1任务清单.md 和 10-Phase2任务清单.md 的验收标准已满足。

---

## Definition of Done（阶段完成标准）

Phase 3 视为完成，**必须同时满足**以下条件：

1. **脚本引擎可用**：Pre-request / Post-response 脚本可编写、执行、调试；pm 对象 API 核心方法全部可用
2. **测试断言生效**：pm.test + pm.expect 断言可在 Post-response 脚本中运行，结果展示在 Tests Tab
3. **Collection Runner 可用**：批量运行集合请求，迭代/延迟/数据文件配置正常，汇总报告正确
4. **代码生成可用**：请求可生成 cURL / Python / JavaScript / Go 等 ≥10 种语言的代码片段
5. **导入导出可用**：Postman Collection / OpenAPI / cURL / HAR 格式导入导出正确
6. **全局搜索可用**：⌘K 可搜索集合/请求/变量/操作，模糊匹配正常
7. **命令面板完善**：所有操作可通过 ⌘K 访问，支持最近使用/操作分类/AI 入口
8. **Console 面板可用**：⌘J 打开 Console，请求/响应/脚本日志实时显示

---

## Sprint 总览

| Sprint | 时间 | 任务数 | 总工时 | 核心目标 |
|--------|------|--------|--------|----------|
| Week 1-2 | Day 51-60 | 10 | 58h | QuickJS 脚本引擎、pm 对象核心 API、脚本编辑器 UI |
| Week 3-4 | Day 61-70 | 10 | 56h | 测试断言引擎、Collection Runner、Console 面板 |
| Week 5-6 | Day 71-80 | 9 | 52h | 代码生成器、导入导出、全局搜索/命令面板 |

---

## Week 1-2：脚本引擎与编辑器

### 3.01 — QuickJS 脚本引擎核心（Rust 侧）

- **依赖**：Phase 2 完成
- **工时**：12h
- **验收标准**：
  - `src-tauri/src/script/engine.rs` 实现 `ScriptEngine` 结构体
  - 使用 `rquickjs` 创建隔离的 QuickJS Runtime
  - 内存限制 128MB（`runtime.set_memory_limit`）
  - 栈大小限制 1MB（`runtime.set_max_stack_size`）
  - 超时控制：通过 `tokio::time::timeout` 包裹脚本执行，超时返回 `AppError::ScriptTimeout`
  - 脚本执行后返回 `ScriptResult`：success / logs / variables / error / test_results
  - `execute_script` Tauri Command 接受 code + context + timeout_ms 参数
  - `cargo test` 包含基础脚本执行测试（简单赋值、数学运算、字符串操作）
  - 脚本崩溃（无限循环、栈溢出）不阻塞主进程
- **关键文件**：`src-tauri/src/script/engine.rs`, `src-tauri/src/script/mod.rs`
- **关联文档**：04a-架构设计.md §3.3; 08-开发指南.md §3

### 3.02 — pm.request 对象实现

- **依赖**：3.01
- **工时**：8h
- **验收标准**：
  - `src-tauri/src/script/pm_api.rs` 实现 `pm.request` 对象注入
  - `pm.request.method` — 读取/修改请求方法
  - `pm.request.url` — 读取/修改请求 URL（字符串形式）
  - `pm.request.headers` — 提供 `getHeaders()`, `addHeader(key, value)`, `removeHeader(key)` 方法
  - `pm.request.body` — 提供 `getBody()` 方法（返回字符串）
  - Pre-request 脚本中 `pm.request.addHeader('X-Custom', 'value')` 执行后，实际请求包含该 Header
  - `pm.request.addHeader` 添加的 Header 不与 UI 中的 Header 重复（按 key 去重，后添加覆盖先添加）
  - 脚本中修改的 request 属性通过 `ScriptResult.modified_request` 返回给前端
- **关键文件**：`src-tauri/src/script/pm_api.rs`
- **关联文档**：03-功能设计.md §6.2

### 3.03 — pm.response 对象实现

- **依赖**：3.01
- **工时**：6h
- **验收标准**：
  - `pm.response.status` — 状态码（number）
  - `pm.response.statusText` — 状态文本（string）
  - `pm.response.headers` — 提供 `get(key)` 方法
  - `pm.response.body` — 原始响应体字符串
  - `pm.response.json()` — 解析响应体为 JSON 对象（解析失败抛出 ScriptRuntimeError）
  - `pm.response.text()` — 同 `pm.response.body`
  - `pm.response.time` — 响应耗时（number，ms）
  - `pm.response.size()` — 响应体大小（number，bytes）
  - Post-response 脚本中可正常读取上述属性
- **关键文件**：`src-tauri/src/script/pm_api.rs`
- **关联文档**：03-功能设计.md §6.2

### 3.04 — pm.variables / pm.environment / pm.globals 对象实现

- **依赖**：3.01
- **工时**：8h
- **验收标准**：
  - `pm.variables.get(name)` — 按优先级（Local > Data > Env > Collection > Global > Vault）查找变量
  - `pm.variables.set(name, value)` — 设置变量到当前作用域
  - `pm.variables.has(name)` — 判断变量是否存在
  - `pm.environment.get(name)` — 仅查找环境变量
  - `pm.environment.set(name, value)` — 设置环境变量（立即生效，持久化到 SQLite）
  - `pm.environment.unset(name)` — 删除环境变量
  - `pm.environment.clear()` — 清空当前环境所有变量
  - `pm.globals.get(name)` — 仅查找全局变量
  - `pm.globals.set(name, value)` — 设置全局变量
  - `pm.globals.unset(name)` — 删除全局变量
  - `pm.collectionVariables.get(name)` — 仅查找集合变量
  - `pm.collectionVariables.set(name, value)` — 设置集合变量
  - 脚本中 `pm.variables.set('token', 'abc')` 执行后，后续请求中 `{{token}}` 解析为 `abc`
  - 变量修改通过 `ScriptResult.variables` Map 返回，前端接收后更新对应 Store
- **关键文件**：`src-tauri/src/script/pm_api.rs`, `packages/core/src/script/dispatcher.ts`
- **关联文档**：03-功能设计.md §6.2; 04a-架构设计.md §5.2

### 3.05 — console 对象捕获

- **依赖**：3.01
- **工时**：4h
- **验收标准**：
  - `console.log(msg)` — 捕获并返回（level: "log"）
  - `console.warn(msg)` — 捕获并返回（level: "warn"）
  - `console.error(msg)` — 捕获并返回（level: "error"）
  - `console.info(msg)` — 捕获并返回（level: "info"）
  - 支持多参数：`console.log('a', 1, {k: 'v'})` — 多参数用空格连接
  - 对象参数自动 `JSON.stringify`（深度限制 3 层，超出显示 `[Object]`）
  - 日志条目包含 timestamp（ISO 8601）
  - 日志通过 `ScriptResult.logs` 返回，同时通过 `script-console` Tauri Event 实时推送
- **关键文件**：`src-tauri/src/script/pm_api.rs`

### 3.06 — pm.sendRequest 实现

- **依赖**：3.02, 3.04
- **工时**：10h
- **验收标准**：
  - `pm.sendRequest(url, callback)` — 发送 GET 请求
  - `pm.sendRequest(requestConfig, callback)` — 发送自定义请求
  - `requestConfig` 支持：url, method, header, body 字段
  - callback 签名：`(err: Error | null, response: Response) => void`
  - 返回 Promise：`const response = await pm.sendRequest(url)`
  - sendRequest 发出的请求不写入 History（标记为 `script_generated: true`）
  - sendRequest 发出的请求受脚本超时限制（总执行时间不超过 timeout_ms）
  - 递归调用保护：sendRequest 中不可再次调用 sendRequest（返回错误）
- **关键文件**：`src-tauri/src/script/pm_api.rs`, `src-tauri/src/commands/http.rs`

### 3.07 — 脚本编辑器 UI（Monaco Editor 延迟加载）

- **依赖**：Phase 2 完成
- **工时**：10h
- **验收标准**：
  - Scripts Tab 包含 Pre-request / Post-response 子 Tab
  - 每个子 Tab 内嵌 Monaco Editor（延迟加载：首次打开 Scripts Tab 时加载）
  - Monaco 使用单实例 EditorManager（04a-架构设计.md §4.4），切换 Tab 时替换 Model
  - JavaScript 语法高亮 + 自动补全（pm. 对象方法补全）
  - 右上角 "Snippets" 按钮，点击弹出常用脚本模板列表：
    - 设置时间戳变量
    - 从响应提取 token
    - 添加自定义 Header
    - 发送额外请求
    - 基础断言模板
  - 编辑器底部显示脚本执行结果面板（console 输出 + 测试结果）
  - ⌘S 保存脚本内容到请求配置
  - 加载中显示 "Loading editor..." 占位文本
- **关键文件**：`packages/ui/src/components/editor/ScriptEditor.tsx`, `apps/desktop/src/utils/EditorManager.ts`
- **关联文档**：04a-架构设计.md §4.4; 07b-请求编辑视觉规范.md §2.9

---

## Week 3-4：测试断言、Collection Runner、Console

### 3.08 — pm.test / pm.expect 断言引擎

- **依赖**：3.03, 3.05
- **工时**：12h
- **验收标准**：
  - `pm.test(name, fn)` — 注册测试用例，name 为测试名，fn 为测试函数
  - `pm.expect(actual)` — 返回 Chai 风格 Assertion 对象
  - 支持的断言方法：
    - `.to.eql(expected)` — 深度相等
    - `.to.deep.equal(expected)` — 深度相等
    - `.to.have.property(name)` — 属性存在
    - `.to.be.a(type)` — 类型检查（'string'/'number'/'object'/'array'/'boolean'）
    - `.to.be.true` / `.to.be.false` — 布尔断言
    - `.to.be.above(n)` / `.to.be.below(n)` — 数值比较
    - `.to.include(value)` — 包含检查（字符串/数组）
    - `.not` 链式修饰：`.not.to.eql(expected)`
  - 测试结果通过 `ScriptResult.test_results` 返回
  - 每个测试结果包含：name, passed, error(可选), duration
  - 断言失败时 error 包含期望值和实际值对比信息
  - 某个测试失败不阻止后续测试执行
  - Post-response 脚本中的测试结果展示在响应面板 Tests Tab
- **关键文件**：`src-tauri/src/script/pm_api.rs`, `src-tauri/src/script/assertion.rs`
- **关联文档**：03-功能设计.md §6.2; 05-UI操作流程.md §6.2

### 3.09 — 脚本调度器（前端）

- **依赖**：3.02, 3.03, 3.04, 3.06, 3.08
- **工时**：8h
- **验收标准**：
  - `packages/core/src/script/dispatcher.ts` 实现 `ScriptDispatcher`
  - 请求发送流程：
    1. 前端构建 `HttpRequestConfig`
    2. 调用 `executeScript(preRequestScript, { request, variables })` 执行前置脚本
    3. 合并脚本修改到请求配置（修改的 headers、变量等）
    4. 调用 `send_http_request` Tauri Command 发送请求
    5. 收到响应后调用 `executeScript(postResponseScript, { request, response, variables })` 执行后置脚本
    6. 应用脚本变量修改到 EnvironmentStore
    7. 返回最终响应 + 脚本结果
  - 脚本执行失败时：
    - Pre-request 脚本失败：显示错误但继续发送请求（用户可在设置中配置为中止）
    - Post-response 脚本失败：显示错误但不影响响应查看
  - 脚本执行超时时：返回 `AppError::ScriptTimeout`，请求不发送
- **关键文件**：`packages/core/src/script/dispatcher.ts`, `packages/core/src/http/client.ts`
- **关联文档**：04a-架构设计.md §5.2; 03-功能设计.md §6.3

### 3.10 — Collection Runner 完整实现

- **依赖**：3.08, 3.09, 2.26
- **工时**：14h
- **验收标准**：
  - Runner 模态框配置：
    - 选择集合/文件夹
    - 选择环境
    - 迭代次数（默认 1，最大 1000）
    - 迭代延迟（默认 0ms）
    - 数据文件（CSV/JSON，可选）
    - Persist Variables 开关（迭代间保持变量修改）
  - 运行逻辑：
    - 按顺序执行集合中每个请求（Pre-script → 请求 → Post-script）
    - 每次迭代结束后等待 delay ms
    - CSV 数据文件按行分配给每次迭代（第 N 行 = 第 N 次迭代的 data 变量）
    - 支持中途停止（Cancel 按钮）
  - 结果展示：
    - 汇总：总请求数/通过/失败/跳过、总耗时
    - 每次迭代的请求列表：状态图标(✓/✗/⊘) + 方法 + URL + 耗时
    - 点击请求行展开详情（请求/响应/测试结果/Console 输出）
    - 导出报告按钮（JSON 格式）
  - Runner 执行在后台线程，不阻塞 UI
- **关键文件**：`packages/ui/src/components/runner/CollectionRunner.tsx`, `packages/core/src/runner/index.ts`
- **关联文档**：03-功能设计.md §12; 05-UI操作流程.md §7

### 3.11 — Console 面板（⌘J）

- **依赖**：3.05, 3.09
- **工时**：10h
- **验收标准**：
  - ⌘J 从底部滑入 Console 面板（高度 200px，可拖拽调整 100-400px）
  - 面板内容按时间排序显示：
    - 请求发送：`[12:34:56] → GET https://api.example.com/users`
    - 请求 Headers（折叠）：`[12:34:56] → Headers: { "Authorization": "Bearer ***" }`
    - 响应接收：`[12:34:56] ← 200 OK 245ms`
    - 脚本日志：`[12:34:56] 🔧 [Pre-request] Setting timestamp variable`
    - 测试结果：`[12:34:56] ✓ Status code is 200`
    - 错误信息：`[12:34:56] ✗ Script error on line 5: TypeError...`
  - 过滤按钮：All / Request / Response / Script / Error
  - 搜索框：实时过滤日志内容
  - 清除按钮：清空当前 Console 内容
  - Console 内容不持久化（重启后清空）
  - 最大保留 1000 条日志，超出自动清理最早的
  - Vitest 包含 console 输出格式化测试
- **关键文件**：`packages/ui/src/components/drawers/ConsolePanel.tsx`, `packages/core/src/console/index.ts`
- **关联文档**：02-UI设计.md §3.5; 05-UI操作流程.md §3.7

### 3.12 — 脚本执行结果展示（Tests Tab）

- **依赖**：3.08, 3.11
- **工时**：6h
- **验收标准**：
  - 响应面板 Tests Tab 显示所有 `pm.test` 的结果
  - 通过的测试：绿色 ✓ 图标 + 测试名 + 耗时
  - 失败的测试：红色 ✗ 图标 + 测试名 + 错误信息（包含期望 vs 实际）
  - 顶部汇总：`3/4 Passed` — 通过/总数
  - 点击失败测试可展开查看详细错误栈
  - 无测试时显示 "No tests found" 空状态
  - 脚本执行错误显示在 Console 面板而非 Tests Tab
- **关键文件**：`packages/ui/src/components/response/TestsTab.tsx`
- **关联文档**：07b-请求编辑视觉规范.md §2.16

### 3.13 — 脚本模板库

- **依赖**：3.07
- **工时**：4h
- **验收标准**：
  - Snippets 按钮弹出模板列表：
    - 设置时间戳：`pm.variables.set('timestamp', new Date().toISOString())`
    - 从响应提取 token：`pm.variables.set('token', pm.response.json().access_token)`
    - 添加自定义 Header：`pm.request.addHeader('X-Request-ID', crypto.randomUUID())`
    - 状态码断言：`pm.test('Status is 200', () => pm.expect(pm.response.status).to.eql(200))`
    - 响应体断言：`pm.test('Has users array', () => pm.expect(pm.response.json()).to.have.property('users'))`
    - 发送额外请求：`pm.sendRequest('https://...', (err, res) => { ... })`
  - 点击模板插入到编辑器光标位置
  - 模板存储为 JSON 文件，支持用户自定义模板
- **关键文件**：`packages/core/src/script/snippets.ts`, `apps/desktop/src/data/script-snippets.json`

### 3.14 — 脚本错误诊断与调试

- **依赖**：3.07, 3.11
- **工时**：6h
- **验收标准**：
  - 脚本语法错误：在编辑器中显示红色波浪线 + 错误消息
  - 运行时错误：在 Console 中显示错误行号 + 错误类型 + 错误消息
  - 点击 Console 中的错误行号跳转到编辑器对应行
  - 变量调试：脚本执行后 Console 显示所有被修改的变量列表
  - 脚本执行耗时显示在 Console 中
  - cargo test 包含脚本错误诊断逻辑测试
- **关键文件**：`packages/ui/src/components/editor/ScriptEditor.tsx`, `packages/ui/src/components/drawers/ConsolePanel.tsx`

---

## Week 5-6：代码生成、导入导出、搜索

### 3.15 — 代码生成器（Rust 侧）

- **依赖**：Phase 2 完成
- **工时**：12h
- **验收标准**：
  - `src-tauri/src/commands/codegen.rs` 实现 `generate_code` Tauri Command
  - 支持语言：cURL, Python(requests), JavaScript(fetch), JavaScript(axios), TypeScript(fetch), Go(net/http), Java(HttpURLConnection), PHP(curl), Ruby(net/http), Swift(URLSession), Kotlin(okhttp), C#(HttpClient), Dart(http), Perl(LWP), Node.js(undici)
  - 输入：`HttpRequestConfig` + `CodeLanguage` + `CodeGeneratorConfig`
  - 输出：`{ code: string, language: string }`
  - 生成规则：
    - 所有 `{{variable}}` 保持原样（不解析）
    - Auth 自动注入（Bearer Token → Authorization Header）
    - Headers 包含 Content-Type
    - Body 格式正确（JSON 缩进、form-data 边界标记）
    - 超时设置生成（如有自定义值）
  - 每种语言的代码可直接复制运行
  - `cargo test` 包含每种语言至少 1 个测试用例
- **关键文件**：`src-tauri/src/commands/codegen.rs`, `src-tauri/src/codegen/mod.rs`, `src-tauri/src/codegen/templates/`
- **关联文档**：03-功能设计.md §14

### 3.16 — 代码生成抽屉 UI（⌘⇧C）

- **依赖**：3.15
- **工时**：8h
- **验收标准**：
  - ⌘⇧C 或 Tab 栏 ⋮ 菜单 → "Generate Code" 打开右侧抽屉
  - 抽屉宽度 400px，从右侧滑入，毛玻璃效果
  - 顶部语言选择器（横向滚动 Tab）：cURL | Python | JavaScript | Go | ...
  - 更多语言通过 "More ▼" 下拉选择
  - 代码展示区：Monaco Editor 只读模式，语法高亮
  - 底部工具栏：📋 Copy 按钮（点击后显示 "Copied!" 1s）+ 语言切换
  - 右上角 ✕ 关闭抽屉
  - 切换语言时代码实时重新生成
  - 代码中 `{{variable}}` 保持原样，品牌色高亮
- **关键文件**：`packages/ui/src/components/drawers/CodeSnippetDrawer.tsx`
- **关联文档**：02-UI设计.md §3.5; 07c-侧边栏与命令面板视觉规范.md §5

### 3.17 — 导入器（Postman / OpenAPI / cURL / HAR）

- **依赖**：Phase 2 集合管理完成
- **备注**：此任务将 Phase 2 中 TypeScript 实现的导入器迁移至 Rust 侧
- **工时**：16h
- **验收标准**：
  - 导入入口：侧边栏 [+ Import] 按钮 或 ⌘K → "Import Collection"
  - 支持导入方式：选择文件 / 拖放文件 / 从剪贴板粘贴 / 从 URL 输入
  - 自动格式检测：
    - Postman Collection v2.1 / v2.0 / v1.0（JSON，检测 `info._postman_id` 或 `info.schema`）
    - OpenAPI 3.0 / 3.1 / Swagger 2.0（JSON/YAML，检测 `openapi` 或 `swagger` 字段）
    - cURL 命令（检测 `curl` 开头）
    - HAR 1.2（检测 `log.entries` 结构）
    - Insomnia v7/v8（检测 `_type: "export"`）
  - 导入预览：
    - 显示检测到的格式
    - 显示将导入的集合名和请求数量
    - 选择目标：新建集合 / 合并到现有集合
  - 导入逻辑在 Rust 侧执行（文件解析为大文件场景优化）
  - 导入错误显示具体行号和原因
  - `cargo test` 包含每种格式至少 1 个导入测试
- **关键文件**：`src-tauri/src/commands/importer.rs`, `src-tauri/src/importer/mod.rs`, `src-tauri/src/importer/postman.rs`, `src-tauri/src/importer/openapi.rs`, `src-tauri/src/importer/curl.rs`, `src-tauri/src/importer/har.rs`
- **关联文档**：03-功能设计.md §15; 05-UI操作流程.md §8.1

### 3.18 — 导出器

- **依赖**：3.17
- **备注**：此任务将 Phase 2 中 TypeScript 实现的导出器迁移至 Rust 侧
- **工时**：8h
- **验收标准**：
  - 导出入口：集合右键 → Export / ⌘K → "Export Collection"
  - 支持格式：Postman Collection v2.1, OpenAPI 3.0, cURL, HAR
  - 导出选项：
    - [✓] 包含环境变量（Postman 格式）
    - [✓] 包含脚本（Pre/Post scripts）
    - [ ] 密码保护（可选）
  - 预览区显示导出 JSON 内容
  - 操作：Copy to Clipboard / Download File
  - 文件名自动生成为 `{collection_name}.{format}.json`
- **关键文件**：`src-tauri/src/importer/exporter.rs`
- **关联文档**：03-功能设计.md §15; 05-UI操作流程.md §8.2

### 3.19 — 全局搜索与命令面板完善

- **依赖**：Phase 1 命令面板 Shell 已完成
- **工时**：12h
- **验收标准**：
  - ⌘K 打开命令面板，输入即搜索（150ms 防抖）
  - 搜索范围：
    - 集合/文件夹/请求名（模糊匹配）
    - 请求 URL（部分匹配）
    - 环境变量 key
    - 操作命令（新建/导入/切换主题/打开设置等）
  - 搜索结果分组显示：
    - "最近" — 最近打开的 5 个请求
    - "集合" — 匹配的请求项，显示 集合名 > 文件夹名 > 请求名 路径
    - "变量" — 匹配的环境/全局变量
    - "操作" — 匹配的命令（显示快捷键提示）
    - "AI" — AI 相关操作入口（Phase 4 实现，暂为占位）
  - ↑↓ 键选择，Enter 执行
  - 执行操作：
    - 请求项 → 打开请求 Tab
    - 变量项 → 打开环境编辑器并聚焦到该变量
    - 操作项 → 执行对应命令
  - ESC 关闭
  - 搜索无结果时显示 "No results found" + 建议操作
- **关键文件**：`packages/ui/src/components/command-palette/CommandPalette.tsx`, `packages/core/src/search/index.ts`
- **关联文档**：02-UI设计.md §3.6; 07c-侧边栏与命令面板视觉规范.md §3

### 3.20 — 变量检查抽屉（⌘⇧V）

- **依赖**：3.04, 3.19
- **工时**：6h
- **验收标准**：
  - ⌘⇧V 打开变量检查抽屉（右侧 400px）
  - 显示当前请求中使用的所有变量及其解析结果
  - 表格列：变量名 | 当前值 | 来源（Global/Environment/Collection/Vault/Dynamic）
  - 未定义变量以红色标记，值显示为 `—`
  - Vault 变量值显示为 `****`，来源标记为 🔒
  - 点击变量行跳转到对应编辑器（环境编辑器/全局变量编辑器）
  - 右上角 ✕ 关闭抽屉
- **关键文件**：`packages/ui/src/components/drawers/VariablesDrawer.tsx`
- **关联文档**：02-UI设计.md §3.5

### 3.21 — 动态变量生成器

- **依赖**：3.04
- **工时**：6h
- **验收标准**：
  - 支持 `{{$guid}}` — 生成 UUID v4
  - 支持 `{{$timestamp}}` — 生成 Unix 时间戳（秒）
  - 支持 `{{$isoTimestamp}}` — 生成 ISO 8601 时间戳
  - 支持 `{{$randomInt}}` — 生成 0-1000 随机整数
  - 支持 `{{$randomUuid}}` — 同 `$guid`
  - 支持 `{{$randomFullName}}` — 生成随机姓名
  - 支持 `{{$randomEmail}}` — 生成随机邮箱
  - 支持 `{{$randomAlphaNumeric}}` — 生成 8 位随机字母数字
  - 动态变量每次请求发送时重新生成（不缓存）
  - URL/Headers/Body 中的动态变量均正确解析
  - cargo test 包含每种动态变量类型的单元测试（UUID v4 格式、ISO 8601 时间戳、随机整数范围等）
- **关键文件**：`packages/core/src/environment/dynamic-variables.ts`
- **关联文档**：03-功能设计.md §5.1

### 3.22 — Vault 加密存储（Rust 侧 + UI）

- **依赖**：Phase 2 完成
- **工时**：10h
- **验收标准**：
  - `src-tauri/src/commands/crypto.rs` 实现 Vault 功能：
    - `unlock_vault(master_password)` — 派生密钥，存入 keyring
    - `lock_vault()` — 清除内存密钥，删除 keyring 凭证
    - `is_vault_unlocked()` — 检查密钥是否在内存中
    - `encrypt_vault_secret(name, plaintext)` — 加密后存入 `{vault}/{name}.enc.json`
    - `decrypt_vault_secret(name)` — 从 keyring 读取密钥，解密返回明文
    - `delete_vault_secret(name)` — 删除加密文件
    - `list_vault_secrets()` — 返回所有 secret 名称列表
  - 安全保证：
    - 密钥不离开 Rust（通过 keyring 管理，不经过 IPC）
    - 加密使用 AES-256-GCM (aes-gcm crate)
    - 密钥派生使用 Argon2id (argon2 crate)
  - UI：
    - 环境编辑器中 secret 类型变量旁显示 🔒 图标
    - 点击 🔒 打开 Vault 解锁对话框（输入主密码）
    - 解锁后 secret 值可查看/编辑
    - 应用启动时 Vault 默认锁定
    - 设置页面提供 "Lock Vault" 按钮
- **关键文件**：`src-tauri/src/commands/crypto.rs`, `packages/ui/src/components/vault/VaultUnlockDialog.tsx`
- **关联文档**：04a-架构设计.md §3.4, §6; 03-功能设计.md §5.1

### 3.23 — 快捷请求（Scratch Pad）

- **依赖**：Phase 2 完成
- **工时**：4h
- **验收标准**：
  - 点击 URL 栏 + 按钮或 ⌘N 创建新 Tab，不关联任何集合
  - 临时请求存储在内存中（不写入文件系统）
  - Tab 标题显示 URL 路径（而非请求名）
  - 右键 Tab → "Save to Collection" 可将临时请求保存到集合
  - 关闭 Tab 时如未保存，弹出确认对话框
  - 应用重启后临时请求丢失
- **关键文件**：`packages/core/src/collection/scratch-pad.ts`
- **关联文档**：03-功能设计.md §22

---

## 验收测试场景

完成 Phase 3 后，以下场景必须全部通过：

1. 在 Pre-request Script 中 `pm.variables.set('ts', new Date().toISOString())` → 发送请求 → URL 中 `{{ts}}` 被替换为时间戳
2. 在 Post-response Script 中 `pm.test('Status 200', () => pm.expect(pm.response.status).to.eql(200))` → Tests Tab 显示 ✓
3. Pre-request 脚本 `pm.request.addHeader('X-Auth', 'token123')` → 实际请求包含该 Header
4. Collection Runner 运行 3 次迭代 → 汇总显示 3x 请求结果，变量在迭代间正确保持
5. 生成 cURL 代码 → 复制到终端可直接运行
6. 导入 Postman Collection v2.1 文件 → 集合树显示所有请求 → 发送其中一个请求成功
7. 导入 OpenAPI 3.0 YAML 文件 → 自动创建集合和所有 endpoint
8. ⌘K 输入 "user" → 搜索结果显示包含 "user" 的请求 → Enter 打开
9. ⌘J Console 显示最近 5 次请求的日志
10. ⌘⇧C 生成 Python requests 代码 → 代码可直接运行

---

## 任务依赖关系图

```
Week 1-2 (脚本引擎):
  3.01 ──┬── 3.02 ──┬── 3.06
         ├── 3.03    │
         ├── 3.04 ──┤
         └── 3.05   └── 3.07 ── 3.13
                                              3.21 (动态变量)

Week 3-4 (测试/Runner/Console):
  3.02 + 3.03 + 3.04 + 3.06 + 3.08 ── 3.09 + 2.26 ── 3.10
  3.05 + 3.09 ── 3.11
  3.08 + 3.11 ── 3.12
  3.07 + 3.11 ── 3.14

Week 5-6 (生成/导入/搜索):
  Phase2 ── 3.15 ── 3.16
  Phase2 ── 3.17 ── 3.18
  3.04 + Phase1 ── 3.19 ── 3.20
  3.04 ── 3.21
  Phase2 ── 3.22
  Phase2 ── 3.23
```

---

## 风险与缓解

| 风险 | 影响 | 缓解策略 |
|------|------|----------|
| rquickjs API 复杂 | 高 | 先实现最小可用 pm 子集，逐步扩展 |
| pm.test 异步执行 | 中 | QuickJS 中 test 使用同步执行模式，fn 内不允许 async |
| Collection Runner 大量请求性能 | 中 | 每次迭代间 yield 到 UI 线程，避免冻结 |
| 导入器格式兼容性 | 高 | 优先实现 Postman/cURL，OpenAPI 使用开源解析库 |
| 代码生成器语法正确性 | 中 | 每种语言至少 5 个测试用例，覆盖各种请求场景 |
| Monaco 加载影响启动 | 低 | 延迟到首次打开 Scripts Tab 时加载，使用 EditorManager 单实例 |

---

*文档版本: v1.0*
*创建时间: 2026-04-16*
*基于: 01-整体规划.md / 03-功能设计.md / 04a-架构设计.md / 04b-API设计.md / 04c-安全与性能.md / 08-开发指南.md*
