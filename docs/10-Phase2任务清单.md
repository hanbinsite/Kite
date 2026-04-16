# Phase 2 任务清单 — 核心请求功能（6 周）

> 本文档将 Phase 2（核心请求功能）拆解为可执行、可验收的原子任务，按周划分 Sprint。
> 前提：Phase 1 已完成，所有 09-Phase1任务清单.md 的验收标准已满足。

---

## Definition of Done（阶段完成标准）

Phase 2 视为完成，**必须同时满足**以下条件：

1. **HTTP 请求完整流通**：URL 输入 → 参数配置 → 认证 → Body → 发送 → 完整响应显示
2. **响应查看器完善**：Pretty/Raw/Preview 模式正常切换，JSON 折叠/搜索正常
3. **集合管理可用**：创建/编辑/删除/重命名集合，文件夹嵌套，拖拽排序
4. **环境变量生效**：变量替换正确工作，5 层作用域优先级正确
5. **请求历史记录**：发送的请求自动记录，按时间分组，可搜索
6. **主题系统完整**：暗色/亮色主题可切换，切换无闪烁
7. **全流程端到端**：创建集合 → 添加请求 → 发送 → 查看响应 → 保存 → 重启后数据存在

---

## Sprint 总览

| Sprint | 时间 | 任务数 | 总工时 | 核心目标 |
|--------|------|--------|--------|----------|
| Week 1-2 | Day 21-30 | 9 | 52h | HTTP 方法选择器、URL 栏变量高亮、Params/Headers 编辑器 |
| Week 3-4 | Day 31-40 | 9 | 50h | Body 编辑器（所有模式）、Auth 配置、响应查看器 |
| Week 5-6 | Day 41-50 | 8 | 46h | 集合管理、树组件、环境变量系统、历史记录 |

---

## Week 1-2：HTTP 方法选择器、URL 栏、参数编辑器

### 2.01 — HTTP 方法选择器（彩色标签）

- **依赖**：1.12（URL 栏已存在）
- **工时**：6h
- **验收标准**：
  - GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS 显示为彩色药丸标签
  - 颜色符合 02-UI设计.md 定义（GET 绿、POST 金、PUT 蓝、PATCH 紫、DELETE 红）
  - 点击展开完整方法列表（含自定义方法）
  - 选中后标签颜色跟随方法变化
  - 键盘 ↑↓ 选择，Enter 确认
- **关键文件**：`packages/ui/src/components/request/MethodSelector.tsx`
- **关联文档**：02-UI设计.md §4.2、07-视觉规范.md §2.5

### 2.02 — URL 输入框（变量高亮 + 自动补全）

- **依赖**：1.12（URL 栏 shell 已存在）
- **工时**：8h
- **验收标准**：
  - 输入 `{{variable}}` 时显示蓝色高亮（`var(--brand-muted)` 背景）
  - 悬停高亮文本显示 tooltip，提示变量当前值（来自环境/全局）
  - 输入过程中下拉自动补全建议（历史 URL、变量名）
  - 变量替换后 URL 预览显示解析后的完整 URL
  - 按 Tab 跳转到 Params 面板
- **关键文件**：`packages/ui/src/components/request/UrlInput.tsx`
- **关联文档**：02-UI设计.md §3.2、07-视觉规范.md §2.7（变量高亮）

### 2.03 — Query 参数编辑器（Key-Value）

- **依赖**：2.01、2.02
- **工时**：8h
- **验收标准**：
  - Key-Value 表格：启用复选框、Key、Value、描述（可选列）
  - 启用复选框取消后该参数显示删除线但不删除
  - 自动从 URL 解析已存在的 query params 到表格
  - 修改表格后 URL 栏 query string 实时更新
  - Bulk Edit 切换到纯文本模式，格式：`key=value&key2=value2`
  - 支持拖拽排序参数顺序
- **关键文件**：`packages/ui/src/components/editor/KeyValueEditor.tsx`
- **关联文档**：07-视觉规范.md §2.8（Key-Value 编辑器）

### 2.04 — 请求头编辑器（Key-Value + Auto 头）

- **依赖**：2.03
- **工时**：6h
- **验收标准**：
  - 同 2.03 的 Key-Value 编辑功能
  - 支持自动添加的系统头（Content-Type、User-Agent 等）以 `auto: true` 标记
  - auto 头在表格中显示为灰色，不可手动编辑
  - 发送请求时自动注入 auto 头但不在 UI 表格中显示重复
  - Bulk Edit 模式支持
- **关键文件**：`packages/ui/src/components/editor/KeyValueEditor.tsx`
- **关联文档**：03-功能设计.md §2.2（Header 类型）

### 2.05 — Auth 配置面板（Bearer/Basic/APIKey）

- **依赖**：2.01
- **工时**：8h
- **验收标准**：
  - Auth 类型下拉：None/Bearer/Basic/APIKey/JWT/OAuth1/OAuth2/AWSV4
  - 选择 Bearer 后显示 Token 输入框（密码模式）和前缀配置（默认 `Bearer `）
  - 选择 Basic 后显示 Username/Password 输入框
  - 选择 APIKey 后显示 Key 名、Value、addTo（header/query）配置
  - Auth 配置的变量（`{{token}}`）正确解析
  - 选择 Auth 类型时右侧面板实时显示生成的 Header/Query
  - 未选择认证时不注入 Authorization 头
- **关键文件**：`packages/ui/src/components/request/AuthTab.tsx`
- **关联文档**：03-功能设计.md §2.2（AuthConfig）、07-视觉规范.md §2.10

### 2.06 — Rust HTTP Client 完整实现

- **依赖**：1.20（Tauri 命令已定义）
- **工时**：10h
- **验收标准**：
  - `send_http_request` 命令完整实现 reqwest 发送逻辑：
    - 根据 method 构建请求（GET/POST/PUT/PATCH/DELETE 等）
    - 注入 Headers（包含 Auth 生成的 Header）
    - 处理 Body（form-data 用 multipart，urlencoded 用 form，raw 用 body）
    - 应用 RequestSettings（timeout、maxRedirects、followRedirects）
    - 应用 ProxyConfig（http/socks5 代理）
    - 支持 skipSSLVerification
  - 返回完整 HttpResponse（包含 timeline 计时）
  - 支持请求取消（基于 cancel_token）
  - Cookie 自动管理（reqwest cookie_store）
- **关键文件**：`apps/desktop/src-tauri/src/commands/http.rs`
- **关联文档**：08-开发指南.md §3（HttpRequestConfig 结构体）

### 2.07 — 请求设置面板（Settings Tab）

- **依赖**：2.06
- **工时**：4h
- **验收标准**：
  - Timeout 输入框（默认 30000ms）
  - Max Redirects 输入框（默认 10）
  - Follow Redirects 开关（默认开启）
  - Skip SSL Verification 开关（默认关闭）
  - 每个设置对应 RequestSettings 的字段
  - 修改设置后实时影响发送行为
- **关键文件**：`packages/ui/src/components/request/SettingsTab.tsx`
- **关联文档**：03-功能设计.md §18（RequestSettings）

### 2.08 — 变量解析引擎（前端 + Rust 协作）

- **依赖**：1.09（EnvironmentStore 已存在）
- **工时**：10h
- **验收标准**：
  - 前端渲染时解析 `{{variable}}` 为当前值显示（蓝色高亮）
  - Rust 端发送请求前二次解析（前端显示值 ≠ 实际发送值）
  - 解析顺序：Local > Data > Environment > Collection > Global > Vault > 动态变量
  - 支持嵌套变量：`{{base{{env}}Url}}`（外层解析后内层再解析）
  - 动态变量生成：`$guid`、`$timestamp`、`$randomInt`、`$randomEmail` 等
  - 变量未找到时保持原样 `{{variable}}` 而不替换
- **关键文件**：`packages/core/src/environment/resolver.ts`
- **关联文档**：03-功能设计.md §5.2（变量解析顺序）

### 2.09 — 响应状态栏（状态码药丸 + 时间 + 大小）

- **依赖**：2.06
- **工时**：4h
- **验收标准**：
  - 状态码显示为语义色药丸（2xx 绿、3xx 蓝、4xx 金、5xx 红）
  - 显示响应时间（毫秒）和响应体大小（自动 KB/MB）
  - 状态文本（OK/Created/Not Found 等）紧跟状态码
  - 工具按钮右对齐：⌘\（分屏）、全屏
  - 发送中状态显示加载动画
- **关键文件**：`packages/ui/src/components/response/ResponseStatus.tsx`
- **关联文档**：02-UI设计.md §3.4、07-视觉规范.md §2.12

---

## Week 3-4：Body 编辑器、响应查看器

### 2.10 — Body Tab 框架（模式切换）

- **依赖**：2.06
- **工时**：3h
- **验收标准**：
  - Sub-tab 切换：none/form-data/urlencoded/raw/graphql
  - none 模式：显示"此请求没有请求体"提示
  - 其他模式根据选择显示对应编辑器
- **关键文件**：`packages/ui/src/components/request/BodyTab.tsx`
- **关联文档**：07-视觉规范.md §2.9

### 2.11 — Raw Body 编辑器（JSON/Text）

- **依赖**：2.10
- **工时**：5h
- **验收标准**：
  - 语言选择下拉：JSON/XML/HTML/Text/JavaScript
  - CodeMirror 6 编辑器（轻量）用于 Raw 编辑
  - JSON 模式下自动格式化（Ctrl+Shift+F）
  - JSON 语法错误实时高亮提示
  - 变量 `{{}}` 在 Raw 中也可高亮
- **关键文件**：`packages/ui/src/components/editor/InlineEditor.tsx`
- **关联文档**：07-视觉规范.md §2.9

### 2.12 — Form Data 编辑器（支持文件上传）

- **依赖**：2.10
- **工时**：8h
- **验收标准**：
  - Key-Value 表格额外列：Type（text/file）
  - file 类型行显示文件选择按钮
  - 文件上传后显示文件名和大小
  - 大文件（>5MB）自动转为 binary 模式而非 form-data
  - 拖拽文件到编辑区可上传
- **关键文件**：`packages/ui/src/components/editor/FormDataEditor.tsx`
- **关联文档**：03-功能设计.md §2.2（FormDataParam）

### 2.13 — URL Encoded 编辑器

- **依赖**：2.10
- **工时**：3h
- **验收标准**：
  - 类似 Key-Value 编辑器
  - 自动 URL 编码/解码
  - Bulk Edit 模式
- **关键文件**：`packages/ui/src/components/editor/UrlEncodedEditor.tsx`

### 2.14 — GraphQL 编辑器

- **依赖**：2.10
- **工时**：6h
- **验收标准**：
  - Query 编辑器（CodeMirror + GraphQL 语法高亮）
  - Variables 编辑器（JSON 格式）
  - Operation Name 输入（可选）
  - Schema introspection 按钮（从 endpoint 获取 schema）
  - 点击 Variables 下的 "Prettify" 格式化 Query
- **关键文件**：`packages/ui/src/components/editor/GraphQLEditor.tsx`
- **关联文档**：03-功能设计.md §7、08-开发指南.md §5（GraphQL 组件）

### 2.15 — 响应 Body Pretty 视图（JSON 折叠/搜索）

- **依赖**：2.09
- **工时**：10h
- **验收标准**：
  - JSON 语法高亮（key 蓝、string 绿、number 金、boolean 紫）
  - 点击行号左侧折叠/展开节点
  - 深层次节点默认折叠（>3 层）
  - Ctrl+F 搜索，高亮匹配文本，支持 ↑↓ 跳转
  - JSONPath 输入框（`$.data.users[0].name`）
  - 行号显示
  - Copy 按钮（复制格式化后 JSON）
- **关键文件**：`packages/ui/src/components/response/JsonViewer.tsx`
- **关联文档**：07-视觉规范.md §2.13（JSON 查看器）

### 2.16 — 响应 Body Raw/Preview 视图

- **依赖**：2.15
- **工时**：4h
- **验收标准**：
  - Raw 视图：纯文本显示，无语法高亮
  - Preview 视图：根据 Content-Type 渲染（HTML 内嵌渲染，图片显示，PDF 显示）
  - XML 格式化显示
  - 二进制文件显示文件大小和下载按钮
- **关键文件**：`packages/ui/src/components/response/RawViewer.tsx`、`HtmlPreview.tsx`
- **关联文档**：07-视觉规范.md §2.13

### 2.17 — 响应 Headers 查看器

- **依赖**：2.09
- **工时**：3h
- **验收标准**：
  - Key-Value 表格显示所有响应头
  - 可搜索过滤
  - 复制单个 Header 或全部复制
- **关键文件**：`packages/ui/src/components/response/ResponseHeadersTab.tsx`
- **关联文档**：07-视觉规范.md §2.14

### 2.18 — 响应 Cookies 查看器

- **依赖**：2.09
- **工时**：3h
- **验收标准**：
  - 表格显示：Name/Value/Domain/Path/Expires/HttpOnly/Secure/SameSite
  - 来自 Set-Cookie 头的 cookie 自动解析
  - 复制 cookie 为 cURL 格式
- **关键文件**：`packages/ui/src/components/response/ResponseCookiesTab.tsx`

---

## Week 5-6：集合管理、环境变量、历史

### 2.19 — 集合数据模型 + 文件存储

- **依赖**：1.07（SQLite 存储已就绪）
- **工时**：6h
- **验收标准**：
  - Collection/Folder/Request 三层嵌套数据模型完整实现
  - 集合存储为 `{base}/collections/{id}/collection.json` + `requests/` 目录
  - 请求存储为 `.req.json` 文件（包含 schemaVersion 字段）
  - 集合元数据（name、description、variables）存储在 `collection.json`
  - 创建/删除/重命名集合时同步更新文件系统
- **关键文件**：`packages/core/src/collection/storage.ts`
- **关联文档**：03-功能设计.md §4、04-技术方案.md §3.5

### 2.20 — 集合树组件（展开/折叠/拖拽）

- **依赖**：2.19
- **工时**：10h
- **验收标准**：
  - 树形结构显示集合 → 文件夹 → 请求
  - 文件夹可嵌套（递归）
  - 点击文件夹名展开/折叠子节点
  - 点击请求名打开该请求 Tab
  - 右键菜单：新建请求/文件夹、复制、粘贴、删除、重命名
  - 拖拽排序（dnd-kit）—— 请求可在文件夹间移动
  - 集合树支持虚拟滚动（超过 100 项时）
  - 选中节点高亮显示
- **关键文件**：`packages/ui/src/components/layout/CollectionTree.tsx`
- **关联文档**：02-UI设计.md §3.4、07-视觉规范.md §4（集合管理）

### 2.21 — 环境变量编辑器

- **依赖**：1.09（EnvironmentStore 已存在）
- **工时**：8h
- **验收标准**：
  - 三列 Key/Initial Value/Current Value 表格
  - Current Value 可编辑，编辑后显示为红色标记（未保存）
  - Initial Value 和 Current Value 对比显示
  - secret 类型变量显示为 `****`，点击解锁查看
  - 新增/删除变量行
  - 切换环境后 Current Value 更新
  - 环境变量保存到 SQLite
- **关键文件**：`packages/ui/src/components/environment/EnvironmentEditor.tsx`
- **关联文档**：02-UI设计.md §5.5、07-视觉规范.md §6

### 2.22 — 环境选择器 UI

- **依赖**：2.21
- **工时**：4h
- **验收标准**：
  - URL 栏第二行显示当前环境药丸（颜色：Dev 绿/Staging 金/Prod 红）
  - 点击展开下拉列出所有环境
  - 新建/编辑/删除环境入口
  - 当前环境高亮显示
  - 快捷键 ⌘E 循环切换环境
- **关键文件**：`packages/ui/src/components/layout/EnvSelector.tsx`

### 2.23 — 请求历史记录

- **依赖**：2.06（发送请求后可记录）
- **工时**：6h
- **验收标准**：
  - 发送请求后自动写入 history 表（SQLite）
  - 侧边栏 History 区域按 Today/Yesterday/This Week/Last Week 分组
  - 每条记录显示：方法标签（彩色）、URL（截断）、状态码、耗时、时间
  - 点击记录重新打开该请求（在新 Tab 或覆盖当前）
  - 搜索过滤历史记录
  - 超过 1000 条自动清理最早的记录
  - 清除历史按钮（需二次确认）
- **关键文件**：`packages/core/src/history/index.ts`
- **关联文档**：02-UI设计.md §3.4（History Tab）

### 2.24 — 导入集合（Postman/OpenAPI/cURL）

- **依赖**：2.19
- **工时**：10h
- **验收标准**：
  - 导入对话框：拖放文件或点击选择
  - 支持格式自动检测：Postman v2.1/v2.0、OpenAPI 3.0/3.1、Swagger 2.0、cURL
  - 导入预览显示检测到的集合/请求数量
  - 选择目标位置：新建集合或合并到现有集合
  - 导入进度显示
  - 导入错误提示具体行号和原因
  - cURL 自动解析为 HTTP 请求
- **关键文件**：`packages/core/src/importer/index.ts`
- **关联文档**：03-功能设计.md §15

### 2.25 — 导出集合

- **依赖**：2.19
- **工时**：6h
- **验收标准**：
  - 导出格式选择：Postman Collection v2.1、OpenAPI 3.0、cURL
  - 导出选项：包含/排除环境、包含/排除脚本
  - 预览模式显示导出的 JSON
  - 复制到剪贴板或下载文件
  - 文件名为 `{collection_name}.postman_collection.json` 等
- **关键文件**：`packages/core/src/importer/exporter.ts`

### 2.26 — Collection Runner 基础 UI

- **依赖**：2.19、2.20
- **工时**：8h
- **验收标准**：
  - 打开方式：⌘K → 输入 "runner" → 选择
  - 模态框形式：选择集合下拉、环境选择、迭代次数、延迟（ms）
  - 请求队列预览（显示执行顺序，可拖拽调整）
  - 运行/停止按钮
  - 实时进度条（当前/总数）
  - 通过/失败/跳过计数
  - 完成后显示汇总报告
- **关键文件**：`packages/ui/src/components/runner/CollectionRunner.tsx`
- **关联文档**：03-功能设计.md §12、07-视觉规范.md §2.15

---

## 验收测试场景

完成 Phase 2 后，以下场景必须全部通过：

1. 创建集合 → 添加 3 个请求（GET/POST/DELETE）→ 发送 → 响应显示 → 保存 → 重启 → 数据存在
2. 创建环境（Dev/Staging/Prod）→ 设置变量 → URL 中使用 `{{base_url}}` → 切换环境 → 实际请求指向不同地址
3. cURL 导入：`curl -X GET https://api.example.com/users` → 自动创建 GET 请求
4. OpenAPI 导入：一个包含 5 个 endpoint 的 OpenAPI 3.0 文件 → 生成完整集合
5. 导出为 Postman Collection → 用 Postman 导入 → 功能完全正常
6. Collection Runner 运行 10 次迭代 → 每次迭代变量正确替换 → 汇总报告正确
7. 发送请求后历史记录中出现 → 点击历史重新打开 → 修改后保存

---

## 附录：Phase 2 任务依赖图

```
Week 1-2:
  2.01 → 2.02 → 2.03 → 2.04 → 2.05
           ↘       ↗
             2.06 ──→ 2.07
             ↑
           2.08
             ↑
           2.09

Week 3-4:
  2.10 → 2.11
       → 2.12
       → 2.13
       → 2.14
             ↑
  2.09 ────┴──→ 2.15 → 2.16 → 2.17 → 2.18

Week 5-6:
  2.19 → 2.20 ──→ 2.24 → 2.25
       ↗                ↑
  2.06 └──────→ 2.21 → 2.22 → 2.23
                              ↑
                           2.26
```

---

*文档版本: v1.0*
*创建时间: 2026-04-15*