# PROGRESS.md — API Client 开发进度与问题记录

> 本文档记录所有已完成任务、发现的问题、修复记录和待办事项。
> 每次开发会话后更新。

---

## Phase 1 完成状态

### Definition of Done 检查

| 条件 | 状态 | 说明 |
|------|------|------|
| 项目骨架可运行 | ✅ | `pnpm tauri dev` 启动暗色主题界面 |
| 布局完整 | ✅ | 侧边栏 220px/52px + 工作区 + URL 栏 + Tab 栏 + 请求/响应面板 |
| 核心导航可用 | ✅ | ⌘K 命令面板、侧边栏折叠、Tab 新建/切换/关闭 |
| 请求端到端流通 | ✅ | URL 输入 → Rust reqwest → 响应状态码/耗时/响应体显示 |
| 状态持久化 | ✅ | 侧边栏折叠、主题偏好、分屏比例 localStorage 持久化 |
| 类型安全 | ✅ | `pnpm typecheck` 零错误；`cargo check` 零错误（1 minor warning） |
| 代码规范 | ✅ | `pnpm lint` 零 error |
| 无阻塞性 Bug | ✅ | 核心交互流程无 JS 异常或 Rust panic |

---

## 已完成任务

### Sprint 1 (Week 1) — 项目骨架

| 任务 | 状态 | 备注 |
|------|------|------|
| 1.01 Monorepo 初始化 | ✅ | pnpm workspace |
| 1.02 Tauri + React 初始化 | ✅ | apps/desktop |
| 1.03 Workspace 子包骨架 | ✅ | packages/types, ui, core |
| 1.04 Vite + Turbo + TS 配置 | ✅ | |
| 1.05 ESLint + Prettier | ✅ | flat config |
| 1.06 设计 Token + CSS Variables | ✅ | 暗色/亮色全量 token |
| 1.07 Tauri Capabilities + 插件 | ✅ | 6 个插件注册 |
| 1.08 React 入口 + ErrorBoundary | ✅ | |
| 1.09 暗色主题 E2E 验证 | ✅ | Tauri 窗口启动验证 |

### Sprint 2 (Week 2) — 布局与导航

| 任务 | 状态 | 备注 |
|------|------|------|
| 1.10 AppLayout 容器 | ✅ | |
| 1.11 Sidebar 组件 | ✅ | |
| 1.12 Sidebar 折叠/展开 | ✅ | 220px → 52px |
| 1.13 URL 栏组件 | ✅ | |
| 1.14 Tab 系统组件 | ✅ | |
| 1.15 Zustand Store 架构 | ✅ | ui-store + tab-store + request-store + env-store |
| 1.16 主题系统 | ✅ | Dark/Light/System + localStorage + useTheme |
| 1.17 全局快捷键 | ✅ | |
| 1.18 Sidebar 内容 | ✅ | 真实 History 数据 + 环境 + 集合占位 |
| 1.19 HomePage | ✅ | Welcome + Quick Actions |

### Sprint 3 (Week 3) — 核心 UI 组件

| 任务 | 状态 | 备注 |
|------|------|------|
| 1.20 方法选择器 | ✅ | |
| 1.21 发送按钮 | ✅ | 4 种状态 + pulse 动画 |
| 1.22 KeyValueEditor | ✅ | 规格级 grid layout + checkbox |
| 1.23 请求 Tabs 面板 | ✅ | 6 Tab + sliding indicator + badges |
| 1.24 响应 Tabs 面板 | ✅ | 4 Tab + JSON 语法高亮 + Headers |
| 1.25 响应状态条 | ✅ | 32px status pill + time + size |
| 1.26 SplitPane | ✅ | |
| 1.27 命令面板 | ✅ | Cmd+K + 搜索 + 分组 |
| 1.28 Request/Env Store | ✅ | immer middleware + IPC config |
| 1.29 变量高亮 | ✅ | highlight overlay + autocomplete |

### Sprint 4 (Week 4) — Rust 后端 + 集成

| 任务 | 状态 | 备注 |
|------|------|------|
| 1.30 Rust HTTP 客户端 | ✅ | reqwest + HttpClientState managed |
| 1.31 请求取消机制 | ✅ | CancellationToken 完整接入 |
| 1.32 文件系统存储 | ✅ | file_ops + path validation 修复 |
| 1.33 SQLite 存储层 | ✅ | history/settings/cookie_jar |
| 1.34 Tauri Command 注册 | ✅ | 9 个 invoke handler |
| 1.35 端到端联调 | ✅ | sendRequest action + IPC 对齐 |
| 1.36 环境选择器 | ✅ | EnvSelector pill + dropdown |
| 1.37 POST Body 编辑 | ✅ | raw/json/urlencoded/form-data/graphql |
| 1.38 History 写入展示 | ✅ | Rust insert/query + Sidebar 分组显示 |
| 1.39 错误处理 | ✅ | AppError + retry + SSL skip + URL validation |
| 1.40 性能埋点 | ✅ | markStart/markEnd/measureAsync + 3 条关键路径 |

---

## 修复记录

| # | 问题 | 修复 |
|---|------|------|
| 1 | HttpClientState 未 manage() | main.rs 加 `.manage()` |
| 2 | path validation 对新文件失败 | 重写为递归查找已有祖先 |
| 3 | HttpResponse 类型不匹配 | 加 body_size，去 encoding/cookies |
| 4 | cancel 未接入 send | CancellationToken 创建/注册/清理 |
| 5 | AppError 返回 String | 创建 error.rs + AppError struct + From traits |
| 6 | ErrorBoundary Tailwind 类名 | bg-bg-base/text-fg-primary/bg-brand |
| 7 | CSS 动画未注册 | 7 个 @utility + 3 个 @keyframes |
| 8 | core/http 模块误导 | 替换为 sendHttpRequest/cancelHttpRequest |
| 9 | KeyValueEditor 未被使用 | RequestPanel 使用 KeyValueEditor |
| 10 | Cargo.toml crate-type | 改为 ["rlib"] |
| 11 | SendButton shadow | glow-brand utility |
| 12 | immer middleware | request-store 已加 immer |
| 13 | Sidebar History | 真实 SQLite 数据 + 分组显示 |
| 14 | URL 验证 | http/https 前缀检查 + 红色错误边框 |
| 15 | 响应错误 | Retry 按钮 + SSL skip checkbox |

### 视觉规范审计修复 (Session 3)

| # | 问题 | 修复 |
|---|------|------|
| 16 | hardcoded rgba 代替 CSS 变量 | ✅ EnvSelector/ResponsePanel/VariableHighlight/KeyValueEditor/ResponseStatus 全部改用 Tailwind 透明度修饰符 |
| 17 | duration-[180px] Bug | ✅ 改为 duration-[180ms] |
| 18 | 动态 Tailwind 类 bg-method-${} | ✅ HomePage 改用 METHOD_BG 静态查找表 |
| 19 | JSON 语法高亮硬编码 hex | ✅ 改用 var(--color-accent-*) CSS 变量 |
| 20 | Sidebar 重复 width 内联样式 | ✅ 移除 Sidebar.tsx 内的 style={{ width }} |
| 21 | RequestPanel auth focus shadow rgba | ✅ 改用 var(--color-brand-muted) |
| 22 | ResponseStatus.tsx 语法错误 | ✅ if 语句缺少花括号 |

### 用户反馈修复 (Session 4)

| # | 问题 | 修复 |
|---|------|------|
| 23 | URL栏在最顶部，应在TabBar下方 | ✅ Workbench.tsx 调整顺序为 TabBar → UrlBar → SplitPane |
| 24 | URL输入框字体颜色看不清 | ✅ 去掉 text-transparent overlay 技巧，直接用 text-fg-primary font-mono |
| 25 | 环境选择器在params上方 | ✅ 从URL栏row2移到TabBar右侧，下拉右对齐 |
| 26 | 设置按钮折叠了侧边栏 | ✅ 改为调用 openSettings()，打开居中模态设置页面 |
| 27 | 集合只有默认项 | ✅ 新增/双击重命名/hover删除/展开折叠/内部加请求 |

### 文档反向同步 (Session 5)

| # | 文档 | 变更 |
|---|------|------|
| 28 | 07b §2.1 布局总览 | ✅ ASCII图更新：TabBar在最顶部，URL栏在下方 |
| 29 | 07b §2.3 URL栏第二行 | ✅ 移除，改为指向07c的环境选择器说明 |
| 30 | 07b §2.4 Tab Bar | ✅ 添加 .tab-bar-env 样式 |
| 31 | 07c §4.4a | ✅ 新增集合CRUD操作CSS + 交互规格表 |
| 32 | 07c §4.5 侧边栏底部 | ✅ 新增底部栏CSS，明确设置按钮打开Settings而非折叠 |
| 33 | 07c §7 设置页面 | ✅ 已有完整规范（居中模态680x560），SettingsPage重写匹配 |
| 34 | SettingsPage实现 | ✅ 从右侧滑入(600px)重写为居中模态(680x560) |

### 用户反馈修复 (Session 6)

| # | 问题 | 修复 |
|---|------|------|
| 35 | 字体太小（13px） | ✅ 全局 --text-base 改为 15px，Settings 默认值改为 15 |
| 36 | 设置弹窗高度变化 | ✅ max-h-[560px] 改为 h-[560px] 固定高度 |
| 37 | Settings danger按钮用rgba | ✅ 改用 border-accent-danger/30 + hover:bg-accent-danger/12 |
| 38 | Settings focus shadow用rgba | ✅ 改用 var(--color-brand-muted) |

### 文档反向同步 (Session 6)

| # | 文档 | 变更 |
|---|------|------|
| 39 | 07c §4.4b 右键菜单 | ✅ 新增集合CRUD操作CSS + 交互规格表 |
| 40 | 07c §4.5 侧边栏底部 | ✅ 明确设置按钮触发 openSettings |
| 41 | 07c §16 i18n | ✅ 新增多语言支持章节 |

### 用户反馈修复 (Session 8)

| # | 问题 | 修复 |
|---|------|------|
| 42 | 右键菜单操作不生效 | ✅ mousedown事件在click之前触发导致菜单立即关闭；改用Sidebar层级的mousedown+keydown监听，ContextMenu自身用stopPropagation + data-context-menu标记 |
| 43 | 请求重命名不生效 | ✅ commitEdit只更新collection name；改为先尝试collection匹配，再遍历requests更新name |
| 44 | 集合add-folder创建的是request | ✅ add-folder改为创建新顶级collection（New Folder），而非调用addRequestToCollection |
| 45 | MethodSelector下拉被overflow裁剪 | ✅ 使用createPortal将下拉渲染到document.body，用fixed定位 + getBoundingClientRect计算位置 |
| 46 | EnvSelector下拉被overflow裁剪 | ✅ 同上Portal方案，右对齐下拉 |
| 47 | Tab去重t.url!==""导致空URL请求重复开Tab | ✅ URL非空按method+url匹配；URL为空但name非"New Request"按method+name匹配；"New Request"始终新建 |

### 类型修复 (Session 9)

| # | 问题 | 修复 |
|---|------|------|
| 48 | InlineEditor.tsx foldKeymap import 在文件中间 | ✅ 移入顶部 `@codemirror/language` import 语句 |
| 49 | Sidebar.tsx 引用 `col.requests` 但 CollectionItem 已重构为 `items: CollectionTreeNode[]` | ✅ Sidebar 重写为递归树形渲染：新增 `CollectionTreeItems` 组件 + `findNodeInTree` 辅助函数，支持 folder 嵌套展开/折叠/右键菜单 |
| 50 | ContextMenu target 类型不含 "folder" | ✅ ContextMenuTarget 扩展为 `"collection" | "request" | "folder"`，新增 FOLDER_ITEMS 菜单项 |
| 51 | collection-store.test.ts 引用 `col.requests` | ✅ 全部改为 `col.items.filter(i => i.type === "request")` |
| 52 | add-folder 右键菜单创建顶级 collection 而非 folder | ✅ 改为调用 `addFolderToCollection(collectionId, folderId, name)` |

### Rust 编译修复 (Session 9)

| # | 问题 | 修复 |
|---|------|------|
| 53 | Rust 工具链未安装 | ✅ 安装 rustup stable 1.95.0 + VS Build Tools 2022 |
| 54 | icons/icon.ico 缺失 | ✅ 创建 32x32 品牌紫色图标 |
| 55 | http.rs multipart Part::bytes + mime_str 类型不匹配 | ✅ 拆分为：先读文件 → Part::bytes → .file_name → match mime_str |
| 56 | storage/mod.rs query_cookies stmt 生命周期不足 | ✅ 先 collect 到局部变量 `rows` 再赋值，避免 stmt 被 drop 后迭代器悬空 |
| 57 | http.rs base64_engine 常量命名不规范 | ✅ 改为 `BASE64_ENGINE` |

### 用户反馈修复 (Session 10)

| # | 问题 | 修复 |
|---|------|------|
| 58 | 多Tab切换请求部分不变 | ✅ request-store 重构为 per-tab 存储：`requestDataMap: Record<tabId, RequestData>` + `switchTab()` 同步；UrlBar 的 method/url 从 tab-store 读取/写入 |
| 59 | 左侧未改名 New Request 点击多次开多个 Tab | ✅ Tab 新增 `requestId` 字段；Sidebar 传入 `requestId: item.id`；tab-store 优先按 `requestId` 去重 |
| 60 | EnvSelector 下拉点击不生效 | ✅ 修复 mousedown 关闭逻辑：dropdownRef 包含检查；改用 e.stopPropagation() |
| 61 | Env 缺少 CRUD 操作 | ✅ EnvSelector 下拉底部新增 "Add Environment" 按钮 + 每项 hover 显示删除按钮 |
| 62 | 主题切换不可见 | ✅ 已有 ThemeToggle 在侧边栏底部（Dark/Light/System 循环），无需修改 |
| 63 | 语言切换（i18n） | 📝 Phase 3+ 规划内容，当前不修复，记录在遗留问题 |

---

## 遗留低优先级问题

| # | 问题 | 优先级 |
|---|------|--------|
| 1 | ts-rs #[derive(TS)] 未添加 | 低 — Phase 2 |
| 2 | Environment/Variable 类型三处重复 | 低 |
| 3 | Tab 类型 tab-store vs types 不一致 | 低 |
| 4 | URL/method 应存 tab store 而非 useState | ✅ UrlBar 已改为从 tab-store 读写 |
| 5 | useGlobalShortcuts hook 未使用 | 低 |
| 6 | 无测试文件 | 中 — Phase 2 |
| 7 | devtools feature 应仅 debug | 低 |
| 8 | SQLite 操作未用 spawn_blocking | 中 — 数据量小时不影响 |
| 9 | Monaco/CodeMirror 编辑器未集成 | ✅ CodeMirror 6 InlineEditor 已集成 |
| 10 | i18n多语言（中/英） | 中 — Phase 3 |
| 11 | 右键菜单（集合/请求） | ✅ 已实现 |
| 11 | 右键菜单（集合/请求） | ✅ 已实现 |
| 12 | 设置持久化到localStorage/SQLite | ✅ 已实现(settings-store.ts) |
| 13 | 字体大小设置即时生效 | 高 |
| 14 | 集合持久化到文件系统 | 高 |
| 10 | Sidebar 集合区域为占位内容 | ✅ 已实现树形渲染+CRUD |

---

## 构建验证

| 检查 | 结果 |
|------|------|
| `pnpm typecheck` | ✅ 4 包零错误 (Session 9 验证) |
| `pnpm lint` | ✅ 零 error (Session 9 验证) |
| `pnpm build` | ✅ 887KB JS, 36KB CSS (Session 9 验证) |
| `cargo check` | ✅ 零 warning (Session 9 验证) |
| Rust 工具链 | ✅ rustc 1.95.0 + VS Build Tools 2022 |
| `tauri dev` | ✅ 应用窗口成功启动 (Session 9 验证) |

---

## Phase 2 展望

- gRPC UI / WebSocket UI / MQTT UI / SSE UI (docs/14-Phase2b)
- Monaco Editor 单实例集成
- Collection CRUD (文件系统持久化)
- 环境变量编辑器 Drawer
- 脚本引擎 (rquickjs)
- Cookie 管理
- 导入/导出 (Postman/OpenAPI)
- 测试框架 (Vitest + cargo test)

---

*Phase 1 完成时间: 2026-04-18*
