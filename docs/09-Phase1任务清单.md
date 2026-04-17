# Phase 1 任务清单 — 基础框架（4 周）

> 本文档将 Phase 1（基础框架）拆解为可执行、可验收的原子任务，按周划分 Sprint。

---

## Definition of Done（阶段完成标准）

Phase 1 视为完成，**必须同时满足**以下条件：

1. **项目骨架可运行**：`pnpm tauri dev` 启动后呈现暗色主题界面，无白屏、无报错
2. **布局完整**：侧边栏（220px / 52px 折叠）+ 工作区（URL 栏 + Tab 栏 + 请求/响应面板）渲染正确
3. **核心导航可用**：⌘K 命令面板可打开/关闭；侧边栏三个区域可折叠/展开；Tab 可新建/切换/关闭
4. **请求端到端流通**：在 URL 栏输入地址、选择方法、点击发送 → Rust 后端实际发出 HTTP 请求 → 响应状态码、耗时、响应体显示在响应面板
5. **状态持久化**：侧边栏折叠状态、主题偏好、分屏比例在重启后保留
6. **类型安全**：`pnpm typecheck` 零错误；Rust 侧 `cargo check` 零错误
7. **代码规范**：`pnpm lint` 零 warning；`cargo clippy` 零 warning
8. **无阻塞性 Bug**：核心交互流程（发送请求、切换 Tab、折叠侧边栏、切换主题）无 JS 异常或 Rust panic

---

## Sprint 总览

| Sprint | 时间 | 任务数 | 总工时 | 核心目标 |
|--------|------|--------|--------|----------|
| Week 1 | Day 1-5 | 9 | 48h | 项目骨架、构建配置、设计 Token、暗色主题验证 |
| Week 2 | Day 6-10 | 10 | 54h | 布局系统、侧边栏、URL 栏、Tab 系统、Zustand Store |
| Week 3 | Day 11-15 | 10 | 58h | 核心编辑组件、请求/响应面板、分屏、命令面板 Shell |
| Week 4 | Day 16-20 | 10 | 56h | Rust HTTP 客户端、存储层、Tauri 桥接、端到端联调 |

---

## Week 1：Project Skeleton（Day 1-5）

### 1.01 — Monorepo 初始化与 pnpm workspace

- **依赖**：无
- **工时**：4h
- **验收标准**：
  - 根目录 `pnpm-workspace.yaml` 声明 `apps/*` 和 `packages/*`
  - `pnpm install` 在根目录成功执行，零错误
  - `pnpm -r list` 能列出所有 workspace 子包
- **关键文件**：`pnpm-workspace.yaml`, `package.json`, `.npmrc`
- **关联文档**：08-开发指南.md §1.2

### 1.02 — Tauri + React 应用初始化

- **依赖**：1.01
- **工时**：6h
- **验收标准**：
  - `apps/desktop` 目录包含 `src/`（React 前端）和 `src-tauri/`（Rust 后端）
  - `src-tauri/Cargo.toml` 包含 reqwest、rusqlite、serde、tokio 等核心依赖
  - `src-tauri/tauri.conf.json` 窗口配置为 1440×900，最小 1024×640，identifier 为 `com.apiclient.app`
  - `pnpm tauri dev` 启动后，WebView 渲染出默认 React 页面
- **关键文件**：`apps/desktop/package.json`, `apps/desktop/src-tauri/Cargo.toml`, `apps/desktop/src-tauri/tauri.conf.json`
- **关联文档**：08-开发指南.md §1.3, §2.5, §2.8, §2.10

### 1.03 — Workspace 子包骨架（ui / core / types）

- **依赖**：1.01
- **工时**：4h
- **验收标准**：
  - `packages/ui/src/components/`, `packages/ui/src/hooks/`, `packages/ui/src/styles/tokens/` 目录存在
  - `packages/core/src/http/`, `packages/core/src/collection/`, `packages/core/src/environment/`, `packages/core/src/navigation/` 目录存在
  - `packages/types/src/index.ts` 导出基础类型占位
  - 三个子包 `package.json` 均使用 `workspace:*` 引用 `@api-client/types`
  - 各子包 `pnpm typecheck` 通过（允许空导出）
- **关键文件**：`packages/ui/package.json`, `packages/core/package.json`, `packages/types/package.json`, 各 `src/index.ts`
- **关联文档**：08-开发指南.md §1.4, §2.11, §2.12, §2.13; 04a-架构设计.md §2.2

### 1.04 — 构建与开发配置（Vite + Turbo + TypeScript）

- **依赖**：1.02, 1.03
- **工时**：5h
- **验收标准**：
  - `turbo.json` 配置 build/dev/lint/typecheck/test 任务管道
  - `tsconfig.base.json` 配置 strict 模式、ES2022 target、bundler moduleResolution、paths 别名（`@ui/*`, `@core/*`, `@types/*`）
  - `apps/desktop/vite.config.ts` 配置 `@tailwindcss/vite` 插件、路径别名、Tauri HMR
  - `apps/desktop/tsconfig.json` 继承 `tsconfig.base.json`
  - 根目录 `pnpm build` 成功；`pnpm typecheck` 成功
- **关键文件**：`turbo.json`, `tsconfig.base.json`, `apps/desktop/vite.config.ts`, `apps/desktop/tsconfig.json`
- **关联文档**：08-开发指南.md §2.2, §2.3, §2.6

### 1.05 — ESLint + Prettier 配置

- **依赖**：1.03
- **工时**：3h
- **验收标准**：
  - `eslint.config.js` 配置 TypeScript ESLint 插件，规则：`no-explicit-any: warn`、`consistent-type-imports: error`、`no-console: warn`
  - `.prettierrc` 配置 semi: true, singleQuote: false, tabWidth: 2, printWidth: 100
  - `pnpm lint` 在根目录执行成功，对现有文件无 error
  - `pnpm format:check` 执行成功
- **关键文件**：`eslint.config.js`, `.prettierrc`, `.prettierignore`
- **关联文档**：08-开发指南.md §2.14, §2.15

### 1.06 — 设计 Token 与 CSS Variables（暗色主题）

- **依赖**：1.04
- **工时**：6h
- **验收标准**：
  - `apps/desktop/src/styles/index.css` 使用 `@import "tailwindcss"` + `@theme {}` 声明全部 design token
  - 品牌色 `--color-brand: #6c5ce7`、7 种方法色、4 种状态码色、6 级背景色、3 级前景色、6 级阴影、5 级圆角、5 级动画时长、10 级 z-index 全部定义
  - 布局变量 `--spacing-sidebar: 220px`, `--spacing-sidebar-collapsed: 52px`, `--spacing-url-bar: 44px` 等定义
  - 自定义 utility：`glow-brand`, `glow-success`, `glow-danger`, `glass-bg`, `glass-border` 可用
  - 关键帧动画：`slide-in-right`, `fade-in-up`, `pulse-glow`, `send-pulse` 定义
  - `body` 背景色为 `#0c0c12`，字体为 Geist / JetBrains Mono 栈，滚动条 6px 宽
- **关键文件**：`apps/desktop/src/styles/index.css`
- **关联文档**：08-开发指南.md §2.7; 02-UI设计.md §2.1-2.6; 07b-请求编辑视觉规范.md "Design Token 速查"

### 1.07 — Tauri Capabilities 与插件注册

- **依赖**：1.02
- **工时**：3h
- **验收标准**：
  - `src-tauri/capabilities/default.json` 声明所有必需权限：`core:default`, `fs:default`, `dialog:default`, `global-shortcut:allow-register`, `process:allow-restart` 等
  - `src-tauri/src/main.rs` 注册所有 Tauri 插件：shell, fs, dialog, notification, global-shortcut, process, deep-link
  - `src-tauri/src/main.rs` 定义 `AppState` 结构体并 `manage()` 注入
  - `pnpm tauri dev` 启动后无权限相关报错
- **关键文件**：`apps/desktop/src-tauri/capabilities/default.json`, `apps/desktop/src-tauri/src/main.rs`
- **关联文档**：08-开发指南.md §2.9, §2.16

### 1.08 — React 入口与 ErrorBoundary

- **依赖**：1.04, 1.06
- **工时**：4h
- **验收标准**：
  - `main.tsx` 挂载 `<ErrorBoundary><App /></ErrorBoundary>` 到 DOM
  - `ErrorBoundary` 捕获子组件渲染错误，展示 "Retry" 按钮；点击 Retry 重置错误状态
  - `App.tsx` 渲染空壳布局（暂仅 `<div>API Client</div>`），背景色为 `--color-bg-base`
  - `pnpm tauri dev` 启动后显示暗色背景 + "API Client" 文字
- **关键文件**：`apps/desktop/src/main.tsx`, `apps/desktop/src/App.tsx`, `packages/ui/src/ErrorBoundary.tsx`
- **关联文档**：04a-架构设计.md §4.3

### 1.09 — 暗色主题端到端验证

- **依赖**：1.06, 1.07, 1.08
- **工时**：3h
- **验收标准**：
  - `pnpm tauri dev` 启动后，窗口标题为 "API Client"，窗口居中显示
  - 整体背景为 `#0c0c12`，文字为 `#e8e6f0`
  - 在 DevTools Console 执行 `getComputedStyle(document.body).backgroundColor` 返回 `rgb(12, 12, 18)`
  - 在 DevTools Console 执行 `getComputedStyle(document.documentElement).getPropertyValue('--color-brand')` 返回 `#6c5ce7`
  - 无控制台错误（React / Tauri 插件加载错误除外）
  - Rust 后端编译零 warning
- **关键文件**：集成验证，不新增文件
- **关联文档**：02-UI设计.md §1.1; 07a-首页视觉规范.md §1

---

## Week 2：Layout & Navigation（Day 6-10）

### 1.10 — AppLayout 容器组件（Sidebar + Workbench 分割）

- **依赖**：1.09
- **工时**：6h
- **验收标准**：
  - `<AppLayout>` 渲染 `<Sidebar />` + `<Workbench />` 水平排列
  - Sidebar 默认宽度 220px，Workbench 占据剩余空间（`flex: 1`）
  - Sidebar 与 Workbench 之间有 1px `--color-border-muted` 分隔线
  - 整体高度 100vh，无滚动条
  - 窗口宽度 >= 1024px 时布局正常；缩小到 1024px 时不溢出
- **关键文件**：`apps/desktop/src/components/layout/AppLayout.tsx`, `packages/ui/src/components/layout/AppLayout.tsx`
- **关联文档**：02-UI设计.md §3.1; 07b-请求编辑视觉规范.md §2.1

### 1.11 — Sidebar 组件（搜索栏 + 3 个可折叠区域）

- **依赖**：1.10
- **工时**：8h
- **验收标准**：
  - 顶部搜索栏 44px 高：左侧搜索图标 + 搜索输入框 + 右侧 `+` 新建按钮
  - 三个可折叠区域纵向排列：COLLECTIONS / HISTORY / ENVIRONMENTS
  - 每个区域 header 28px 高，包含大写标题 + 折叠箭头；点击 header 折叠/展开 body
  - 折叠时箭头旋转 -90 度，body `display: none`
  - COLLECTIONS 区域默认展开，占据剩余空间；HISTORY 和 ENVIRONMENTS 默认折叠
  - 侧边栏底部无 Footer
- **关键文件**：`apps/desktop/src/components/sidebar/Sidebar.tsx`, `SidebarSearch.tsx`, `SidebarSection.tsx`
- **关联文档**：02-UI设计.md §3.3; 07c-侧边栏与命令面板视觉规范.md §4.1-4.3

### 1.12 — Sidebar 折叠/展开与状态记忆

- **依赖**：1.11
- **工时**：4h
- **验收标准**：
  - 点击侧边栏切换按钮，Sidebar 宽度从 220px 过渡到 52px，动画时长 180ms
  - 折叠态仅显示图标列（搜索/集合/历史/环境/设置）
  - 切换动画使用 `--animate-duration-normal` + ease-smooth
  - 折叠状态持久化到 localStorage；重启应用后侧边栏记忆上次状态
  - 折叠态点击图标可临时展开 Sidebar
- **关键文件**：`apps/desktop/src/components/sidebar/Sidebar.tsx`, `packages/core/src/navigation/index.ts`
- **关联文档**：02-UI设计.md §6.1; 07c-侧边栏与命令面板视觉规范.md §4.7

### 1.13 — URL 栏组件（方法选择器 + URL 输入 + 发送按钮）

- **依赖**：1.10
- **工时**：8h
- **验收标准**：
  - URL 栏 44px 高，水平排列：侧边栏切换（36px）+ 导航按钮（左右各 28px）+ 方法选择器 + URL 输入框（flex:1）+ 发送按钮（40px）
  - 方法选择器显示当前方法名，文字颜色匹配方法色（GET=绿），背景为方法色 12% 透明度
  - 点击方法选择器弹出下拉列表，列出 GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS；选中后关闭下拉并更新方法色
  - URL 输入框背景 `--color-bg-input`，聚焦时边框变为 `--color-border-focus` + 3px 品牌色外发光
  - 发送按钮 40x32px，背景 `--color-brand`，hover 时品牌色辉光 + scale(1.02)
  - URL 栏第二行：环境选择器药丸 + 命令面板图标 + 菜单图标
- **关键文件**：`apps/desktop/src/components/url-bar/UrlBar.tsx`, `MethodSelector.tsx`, `SendButton.tsx`, `UrlInput.tsx`
- **关联文档**：02-UI设计.md §3.2; 07b-请求编辑视觉规范.md §2.2-2.3

### 1.14 — Tab 系统组件

- **依赖**：1.10
- **工时**：8h
- **验收标准**：
  - Tab 栏 36px 高，水平排列：Tab 项 + `+` 新建按钮 + 右侧工具按钮
  - 每个 Tab 显示：方法色标签 + 请求名 + 关闭按钮（hover 时出现）
  - 活跃 Tab 底部有 2px `--color-brand` 指示条，切换 Tab 时指示条滑动动画 180ms
  - Tab 最小宽度 80px，最大 180px，超出部分文字省略号截断
  - Tab 数量超出容器宽度时，出现滚动箭头
  - 点击 `+` 创建新 Tab；点击 `x` 关闭 Tab；关闭当前 Tab 时自动激活相邻 Tab
  - 右键 Tab 出现上下文菜单：关闭、关闭其他、关闭全部
- **关键文件**：`apps/desktop/src/components/tab/TabBar.tsx`, `TabItem.tsx`, `TabContextMenu.tsx`
- **关联文档**：02-UI设计.md §3.4, §6.3; 07b-请求编辑视觉规范.md §2.4

### 1.15 — Zustand Store 基础架构（UI / Tab / Navigation）

- **依赖**：1.10
- **工时**：8h
- **验收标准**：
  - `useUIStore`：theme / sidebar.visible / sidebar.width / splitRatio / drawers 状态；提供 setTheme / toggleSidebar / setSplitRatio action
  - `useTabStore`：tabs 数组 / activeTabId；提供 openTab / closeTab / closeOtherTabs / closeAllTabs / setActiveTab / moveTab action
  - `useNavigationStore`：activeView ('home'|'request'|'environment'|'settings')；提供 navigateTo action
  - 所有 Store 使用 `immer` middleware，支持嵌套对象不可变更新
  - `useUIStore.sidebar.visible` 变更时，Sidebar 组件响应式更新宽度
  - `useTabStore` 的 openTab/closeTab 调用后，TabBar 组件响应式更新
- **关键文件**：`packages/core/src/navigation/index.ts`, `apps/desktop/src/stores/ui-store.ts`, `apps/desktop/src/stores/tab-store.ts`, `apps/desktop/src/stores/navigation-store.ts`
- **关联文档**：04a-架构设计.md §4.2

### 1.16 — 主题系统（Dark / Light / System）

- **依赖**：1.15
- **工时**：6h
- **验收标准**：
  - `useUIStore.theme` 默认 `'dark'`
  - 切换为 `'light'` 时，`<html>` 标签添加 `data-theme="light"` class；CSS 变量覆盖为亮色色板
  - 切换为 `'system'` 时，跟随 `prefers-color-scheme` 媒体查询
  - 主题切换无闪烁（FOUC）：切换时 body 背景色在 100ms 内过渡
  - 主题偏好持久化到 localStorage；重启后恢复
  - URL 栏菜单包含 "切换主题" 选项，循环切换 dark -> light -> system
- **关键文件**：`apps/desktop/src/stores/ui-store.ts`, `apps/desktop/src/styles/index.css`, `apps/desktop/src/hooks/useTheme.ts`
- **关联文档**：02-UI设计.md §2.1

### 1.17 — 全局快捷键注册

- **依赖**：1.15
- **工时**：4h
- **验收标准**：
  - Cmd+K 打开命令面板（暂为 console.log 占位）
  - Cmd+B 切换侧边栏显隐
  - Cmd+T 新建 Tab
  - Cmd+W 关闭当前 Tab
  - Cmd+Enter 发送请求（暂为 console.log 占位）
  - ESC 关闭命令面板 / 退出焦点
  - 使用 `@tauri-apps/plugin-global-shortcut` 注册，快捷键不与系统冲突
  - 窗口失焦后快捷键不触发
- **关键文件**：`apps/desktop/src/hooks/useGlobalShortcuts.ts`
- **关联文档**：02-UI设计.md §5.1

### 1.18 — Sidebar 集合/历史/环境区域占位内容

- **依赖**：1.11, 1.15
- **工时**：4h
- **验收标准**：
  - COLLECTIONS 区域显示 2 个 mock 集合项（文件夹图标 + 名称），点击后打开对应 Tab
  - HISTORY 区域按日期分组（Today / Yesterday），每行显示方法色标签 + 路径 + 时间
  - ENVIRONMENTS 区域显示 3 个环境（Development / Staging / Production），当前环境有品牌色圆点标记
  - 点击环境项切换 `useEnvironmentStore.activeEnvironmentId`，URL 栏环境药丸同步更新
- **关键文件**：`apps/desktop/src/components/sidebar/CollectionSection.tsx`, `HistorySection.tsx`, `EnvironmentSection.tsx`
- **关联文档**：02-UI设计.md §3.3; 07c-侧边栏与命令面板视觉规范.md §4.4-4.6

### 1.19 — Workbench 空状态与首页

- **依赖**：1.10, 1.14, 1.15
- **工时**：6h
- **验收标准**：
  - 无打开 Tab 时，Workbench 显示首页空状态：品牌色几何图标 + "Welcome Back" 标题 + 副标题
  - 双栏卡片布局：左侧 "Recent"（最近请求列表），右侧 "Quick Actions"（新建请求 / 命令面板）
  - Quick Actions 行 hover 时图标变为品牌色
  - 底部 "Collections" 网格区域显示 mock 集合卡片
  - 打开 Tab 后首页消失，切换为请求编辑视图
- **关键文件**：`apps/desktop/src/components/workbench/HomePage.tsx`, `RecentCard.tsx`, `QuickActionsCard.tsx`
- **关联文档**：07a-首页视觉规范.md §1

---

## Week 3：Core UI Components（Day 11-15）

### 1.20 — 方法选择器（彩色标签 + 下拉列表）

- **依赖**：1.13
- **工时**：4h
- **验收标准**：
  - 方法选择器 trigger 为圆角药丸标签，文字用 `--font-mono` 12px 600
  - GET 标签为绿色文字 + 12% 绿色背景；POST 为金色；PUT 为蓝色；PATCH 为紫色；DELETE 为红色
  - 点击 trigger 弹出下拉列表（160px 宽），8 个方法项，每项 30px 高
  - 当前选中项背景为 `--color-brand-muted`
  - 下拉出现动画 fadeInUp 100ms ease-smooth
  - 点击下拉项后关闭下拉并更新 trigger 方法和颜色
  - 点击下拉外部区域关闭下拉
- **关键文件**：`apps/desktop/src/components/url-bar/MethodSelector.tsx`
- **关联文档**：02-UI设计.md §4.2; 07b-请求编辑视觉规范.md §2.2

### 1.21 — 发送按钮（脉冲动画 + 状态变化）

- **依赖**：1.13
- **工时**：4h
- **验收标准**：
  - 默认态：40x32px，`--color-brand` 背景，白色 Send 图标，hover 时辉光 + scale(1.02)
  - 点击/发送中：pulseGlow 动画（1.5s ease-in-out infinite），pointer-events: none
  - 请求成功：背景变为 `--color-accent-success` 持续 1s，显示勾选图标，然后恢复品牌色
  - 请求失败：背景变为 `--color-accent-danger` 持续 1s，显示叉号图标，然后恢复品牌色
  - URL 为空时：按钮 disabled，opacity: 0.4
- **关键文件**：`apps/desktop/src/components/url-bar/SendButton.tsx`
- **关联文档**：02-UI设计.md §4.1; 07b-请求编辑视觉规范.md §2.2

### 1.22 — Key-Value 编辑器组件

- **依赖**：1.10
- **工时**：8h
- **验收标准**：
  - Header 行 28px 高：5 列网格（20px checkbox | 200px KEY | 1fr VALUE | 180px DESCRIPTION | 28px delete）
  - 数据行 32px 高，相同网格；hover 时背景 `--color-bg-hover`
  - Checkbox 为 14px 自定义圆角方框；勾选时品牌色填充 + 白色勾选标记
  - 取消勾选时整行 opacity: 0.4，输入文字添加删除线
  - 每行输入框无边框，聚焦时无外发光
  - 最后一行始终为空行，输入内容后自动新增行
  - "Add Row" 按钮在底部，hover 时品牌色文字 + 品牌色淡底
  - Delete 按钮 hover 时显示，hover 时红色底 + 红色图标
  - 空状态显示 "No items added yet" 提示
- **关键文件**：`packages/ui/src/components/editor/KeyValueEditor.tsx`, `KVRow.tsx`
- **关联文档**：02-UI设计.md §4.3; 07b-请求编辑视觉规范.md §2.6

### 1.23 — 请求 Tabs 面板（Params / Headers / Body / Auth / Scripts / Settings）

- **依赖**：1.22, 1.15
- **工时**：8h
- **验收标准**：
  - 请求 Tab 栏 36px 高，6 个 Tab 项水平排列
  - 活跃 Tab 底部 2px 品牌色指示条，切换时滑动动画 180ms ease-smooth
  - Params Tab：使用 KeyValueEditor，显示 Query 参数
  - Headers Tab：使用 KeyValueEditor，显示请求头
  - Body Tab：顶部类型选择行（none / form-data / urlencoded / raw / binary / graphql），选中项品牌色高亮
  - Auth Tab：顶部下拉选择认证类型（None / API Key / Bearer / Basic），选择后展示对应字段
  - Scripts Tab：Pre-request / Post-response 子 Tab + 代码编辑区占位
  - Settings Tab：Timeout / Redirects / SSL 验证等开关项
  - Params/Headers Tab 右上角显示已启用项数量 badge
- **关键文件**：`apps/desktop/src/components/request/RequestPanel.tsx`, `RequestTabs.tsx`, `ParamsTab.tsx`, `HeadersTab.tsx`, `BodyTab.tsx`, `AuthTab.tsx`, `ScriptsTab.tsx`, `SettingsTab.tsx`
- **关联文档**：07b-请求编辑视觉规范.md §2.5, §2.7, §2.8, §2.9, AGENTS.md §3 (AuthConfig 使用 #[serde(tag = "type", content = "config")])

### 1.24 — 响应 Tabs 面板（Body / Headers / Cookies / Tests）

- **依赖**：1.22
- **工时**：6h
- **验收标准**：
  - 响应 Tab 栏 36px 高，4 个 Tab 项
  - Body Tab：工具栏（Pretty / Raw / Preview 切换）+ JSON 查看器
  - JSON 查看器：key=蓝色, string=绿色, number=金色, boolean=紫色, null=灰色斜体
  - JSON 支持折叠/展开（点击大括号或中括号行）
  - Headers Tab：240px key 列 + 1fr value 列，hover 高亮
  - Cookies Tab：暂显示 "No cookies" 空状态
  - Tests Tab：暂显示 "No test results" 空状态
  - 响应区空状态：品牌色图标 + "Hit Send to get a response" + Cmd+Enter 快捷键提示
- **关键文件**：`apps/desktop/src/components/response/ResponsePanel.tsx`, `ResponseTabs.tsx`, `ResponseBodyTab.tsx`, `ResponseHeadersTab.tsx`, `JsonViewer.tsx`
- **关联文档**：07b-请求编辑视觉规范.md §2.12-2.14, §2.17

### 1.25 — 响应状态条

- **依赖**：1.24
- **工时**：4h
- **验收标准**：
  - 状态条 32px 高，水平排列：状态码药丸 + 耗时 + 大小 + 右侧工具按钮
  - 状态码药丸：2xx 绿色、3xx 蓝色、4xx 金色、5xx 红色
  - 耗时和大小为 `--color-fg-tertiary` 次要文字
  - 右侧工具：分屏切换 + 全屏按钮
  - 未发送请求时状态条不显示
  - 发送中时显示 spinner + 计时器
- **关键文件**：`apps/desktop/src/components/response/ResponseStatus.tsx`
- **关联文档**：02-UI设计.md §4.6; 07b-请求编辑视觉规范.md §2.11

### 1.26 — 可拖拽分屏（SplitPane）

- **依赖**：1.23, 1.24
- **工时**：6h
- **验收标准**：
  - 请求面板在上，响应面板在下，中间 4px 分割条
  - 拖拽分割条可调整上下面板高度比，默认 50:50
  - 分割条 hover 时显示品牌色背景；拖拽中品牌色背景 + 白色中心线
  - 拖拽时面板最小高度 120px（`--spacing-min-pane`）
  - 分屏比例持久化到 `useUIStore.splitRatio`，重启后恢复
  - 双击分割条恢复 50:50 默认比例
  - 分割条有 cursor: row-resize
- **关键文件**：`apps/desktop/src/components/layout/SplitPane.tsx`, `apps/desktop/src/hooks/useResizable.ts`
- **关联文档**：02-UI设计.md §6.4; 07b-请求编辑视觉规范.md §2.10

### 1.27 — 命令面板 Shell（Cmd+K 浮层）

- **依赖**：1.15, 1.17
- **工时**：8h
- **验收标准**：
  - Cmd+K 打开命令面板，ESC 关闭
  - 面板居中、顶部 20vh 位置，宽 560px，最大高 480px
  - 遮罩层 rgba(0,0,0,0.6) + backdrop-filter: blur(4px)
  - 面板使用毛玻璃效果：glass-bg + glass-border + 12px 圆角
  - 搜索输入区 48px 高：搜索图标 + 输入框 + ESC 标签
  - 结果列表分为 "最近" / "操作" / "AI" 三个分组
  - 上下键选择项目，选中项品牌色淡底高亮
  - Enter 执行选中项；输入文字实时模糊过滤（150ms 防抖）
  - 面板打开动画 cmdSlideIn 180ms ease-smooth；关闭动画淡出 100ms
  - 点击遮罩关闭面板
  - z-index: `--z-command-palette` (500)
- **关键文件**：`apps/desktop/src/components/command-palette/CommandPalette.tsx`, `SearchInput.tsx`, `ResultList.tsx`, `ResultItem.tsx`
- **关联文档**：02-UI设计.md §3.6; 07c-侧边栏与命令面板视觉规范.md §3

### 1.28 — Request Store 与 Environment Store

- **依赖**：1.15
- **工时**：6h
- **验收标准**：
  - `useRequestStore`：isLoading, responses (Record<tabId, HttpResponse>), error 状态；sendRequest action（暂为 mock 数据）
  - `useEnvironmentStore`：globals 数组, environments 数组, activeEnvironmentId；setVariable / setActiveEnvironment action
  - sendRequest 调用后：isLoading=true -> 500ms 后 -> isLoading=false, responses[activeTabId]=mock 响应
  - 发送按钮、响应面板、状态条均绑定 Store 响应式更新
  - Environment Store 的 activeEnvironmentId 变更时，URL 栏环境药丸同步更新
- **关键文件**：`apps/desktop/src/stores/request-store.ts`, `apps/desktop/src/stores/environment-store.ts`
- **关联文档**：04a-架构设计.md §4.2

### 1.29 — 变量高亮（URL 输入框变量渲染）

- **依赖**：1.13, 1.28
- **工时**：4h
- **验收标准**：
  - URL 输入框中 `{{base_url}}` 自动渲染为品牌色文字 + 品牌色淡底
  - 变量高亮区域有 cursor: pointer
  - hover 变量时显示 tooltip，内容为变量当前值
  - 输入 `{{` 时自动弹出环境变量补全下拉
  - 选中补全项后替换为 `{{variable_name}}`
  - 未定义变量（环境/全局中找不到）显示红色警告样式
- **关键文件**：`apps/desktop/src/components/url-bar/UrlInput.tsx`, `VariableHighlight.tsx`
- **关联文档**：02-UI设计.md §6.5; 07b-请求编辑视觉规范.md §2.2

---

## Week 4：Rust Backend + Integration（Day 16-20）

### 1.30 — Rust HTTP 客户端（reqwest）实现

- **依赖**：1.07
- **工时**：8h
- **验收标准**：
  - `src-tauri/src/commands/http.rs` 实现 `send_http_request` command
  - 接收 `HttpRequestConfig` 参数，构建 reqwest 请求（method, url, headers, params, body, auth, settings）
  - 支持 GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS 方法
  - 返回 `HttpResponse`：status, status_text, headers, body (Vec\<u8\>), time, content_type
  - 支持 Bearer / Basic 认证自动注入 Header
  - 支持 redirect 跟随（max_redirects）、timeout、SSL 验证控制
  - `cargo check` 通过；`cargo test` 包含基础单元测试（mock HTTP server）
- **关键文件**：`apps/desktop/src-tauri/src/commands/http.rs`, `apps/desktop/src-tauri/src/commands/mod.rs`
- **关联文档**：08-开发指南.md §2.16, §3; 04a-架构设计.md §3.1-3.2

### 1.31 — 请求取消机制（CancellationToken）

- **依赖**：1.30
- **工时**：4h
- **验收标准**：
  - `cancel_http_request` command 接受 `request_id`，调用 CancellationToken.cancel()
  - `HttpClientState` 使用 `RwLock<HashMap<String, CancellationToken>>` 管理活跃请求
  - 请求发送前创建 token 并存入 map；请求完成后（无论成功/失败）移除 token
  - 取消时 reqwest 请求立即中断，返回 `AppError::NetRequestCancelled`
  - 前端发送按钮点击后变为 Cancel 按钮；再次点击调用 cancel command
- **关键文件**：`apps/desktop/src-tauri/src/commands/http.rs`
- **关联文档**：04a-架构设计.md §3.1

### 1.32 — 文件系统存储（JSON 集合/环境）

- **依赖**：1.07
- **工时**：6h
- **验收标准**：
  - `src-tauri/src/storage/file.rs` 实现集合和环境的文件系统读写
  - 集合目录结构：`{app_data}/collections/{collection_id}/collection.json` + 请求 JSON 文件
  - 环境目录结构：`{app_data}/environments/{env_id}.json`
  - `read_file` / `write_file` / `delete_file` / `list_directory` / `create_directory` 命令实现
  - 文件不存在时返回空列表（而非错误）
  - 写入操作使用原子写入（先写临时文件，再 rename）
  - 所有文件操作命令调用 validate_path_within_app_data() 校验路径在 {app_data}/ 内，防止路径遍历（AGENTS.md §10）
  - `cargo test` 包含文件操作单元测试
- **关键文件**：`apps/desktop/src-tauri/src/storage/file.rs`, `apps/desktop/src-tauri/src/storage/mod.rs`
- **关联文档**：04a-架构设计.md §3.5; 08-开发指南.md §2.16

### 1.33 — SQLite 存储层（History / Cookies / Settings）

- **依赖**：1.07
- **工时**：8h
- **验收标准**：
  - `src-tauri/src/storage/sqlite.rs` 初始化 SQLite 数据库，创建表：history, cookie_jar, settings, schema_version
  - history 表包含索引 `idx_history_created_at` 和 `idx_history_url`
  - cookie_jar 表包含索引 `idx_cookie_domain`
  - 提供方法：`insert_history()`, `query_history()`, `insert_cookie()`, `query_cookies()`, `get_setting()`, `set_setting()`
  - 应用启动时自动执行数据库迁移（`Storage::migrate()`）
  - 所有 SQLite 操作通过 tokio::task::spawn_blocking 执行，不在 async 上下文中直接持有 Connection（AGENTS.md §8）
  - `cargo test` 包含 CRUD 单元测试
- **关键文件**：`apps/desktop/src-tauri/src/storage/sqlite.rs`
- **关联文档**：04a-架构设计.md §3.5; 08-开发指南.md §3

### 1.34 — Tauri Command 注册与前端 invoke 封装

- **依赖**：1.30, 1.32, 1.33
- **工时**：4h
- **验收标准**：
  - `main.rs` 的 `invoke_handler` 注册：`send_http_request`, `cancel_http_request`, `read_file`, `write_file`, `delete_file`, `list_directory`, `create_directory`
  - `packages/core/src/http/client.ts` 封装 `invoke('send_http_request', { config })` 等 Tauri IPC 调用
  - 所有 invoke 函数使用 TypeScript 泛型确保类型安全
  - 前端调用 `sendHttpRequest(config)` 返回 `Promise<HttpResponse>`，类型与 Rust 侧 `HttpResponse` 一致
  - `pnpm typecheck` 通过
- **关键文件**：`apps/desktop/src-tauri/src/main.rs`, `packages/core/src/http/client.ts`, `packages/core/src/http/types.ts`
- **关联文档**：04b-API设计.md §5.1-5.2

### 1.35 — 请求发送端到端联调

- **依赖**：1.21, 1.23, 1.24, 1.25, 1.28, 1.34
- **工时**：8h
- **验收标准**：
  - 在 URL 栏输入 `https://httpbin.org/get`，方法选 GET，点击发送按钮
  - 发送按钮进入 pulseGlow 动画状态，isLoading=true
  - Rust 后端实际发出 HTTP 请求，返回响应
  - 响应状态条显示 `[200 OK] [xxx ms] [xxx B]`，状态码绿色药丸
  - 响应 Body Tab 显示格式化 JSON，key=蓝色, string=绿色
  - 响应 Headers Tab 显示 header 列表
  - 点击 Cancel 按钮后请求中断，响应面板显示 "Request cancelled" 错误提示
  - 网络错误（如 DNS 解析失败）在响应面板显示错误状态：红色图标 + 错误消息
  - 请求完成后自动写入 History（SQLite）
- **关键文件**：`apps/desktop/src/stores/request-store.ts`, `apps/desktop/src/components/workbench/Workbench.tsx`
- **关联文档**：04a-架构设计.md §4.2; 05-UI操作流程.md

### 1.36 — 环境选择器与变量解析

- **依赖**：1.28, 1.34
- **工时**：6h
- **验收标准**：
  - URL 栏环境药丸点击弹出下拉列表，列出所有环境
  - 选中环境后药丸文字和颜色更新（Development=绿, Staging=金, Production=红）
  - 发送请求前，`{{base_url}}` 等变量被当前环境的值替换
  - 变量替换支持嵌套（如 `{{api_url}}` 引用 `{{base_url}}/v1`）
  - 未定义变量保持 `{{variable_name}}` 原样发送（不报错）
  - URL 栏第二行环境药丸样式：药丸形（radius-full）+ 环境色边框 + 环境色文字
- **关键文件**：`apps/desktop/src/components/url-bar/EnvSelector.tsx`, `packages/core/src/http/builder.ts`
- **关联文档**：02-UI设计.md §3.2; 07b-请求编辑视觉规范.md §2.3

### 1.37 — POST 请求与 Body 编辑器联调

- **依赖**：1.35, 1.23
- **工时**：6h
- **验收标准**：
  - 方法切换为 POST，Body Tab 选择 `raw -> JSON`
  - 在编辑区输入 JSON 内容
  - 点击发送，Rust 后端实际以 POST + JSON body 发送请求
  - 切换为 `form-data` body，添加 2 个字段，发送后 `httpbin.org/post` 响应中包含 form 字段
  - 切换为 `x-www-form-urlencoded` body，发送后响应中包含 urlencoded 字段
  - Body 为空时（none 模式），不发送 body
- **关键文件**：`apps/desktop/src/components/request/BodyTab.tsx`, `packages/core/src/http/builder.ts`
- **关联文档**：07b-请求编辑视觉规范.md §2.7

### 1.38 — History 写入与侧边栏历史展示

- **依赖**：1.33, 1.35
- **工时**：4h
- **验收标准**：
  - 每次请求完成后，自动写入 SQLite history 表（method, url, status, duration, created_at）
  - 侧边栏 HISTORY 区域展开后显示最近请求，按 Today / Yesterday / Earlier 分组
  - 每行显示方法色标签 + URL 路径 + 状态码 + 相对时间（"2m ago"）
  - 点击历史项打开对应请求 Tab，填充 method + URL
  - 历史列表最多显示 50 条，超出部分自动清理
- **关键文件**：`apps/desktop/src/components/sidebar/HistorySection.tsx`, `packages/core/src/http/client.ts`
- **关联文档**：07c-侧边栏与命令面板视觉规范.md §4.5

### 1.39 — 基础错误处理与用户反馈

- **依赖**：1.35, 1.31
- **工时**：4h
- **验收标准**：
  - 网络错误（DNS 失败、连接拒绝、超时）在响应面板显示：红色错误图标 + 错误类型 + 错误详情 + 重试按钮
  - Rust 侧返回的 `AppError` 正确序列化到前端，按 code 分类显示
  - 请求超时（>30s）自动取消，显示 "Request timed out" 提示
  - SSL 错误显示特定提示（"SSL certificate verification failed"）+ 跳过验证选项
  - URL 格式错误在发送前拦截，输入框边框变红 + 错误提示
- **关键文件**：`apps/desktop/src/components/response/ResponseError.tsx`, `packages/core/src/http/client.ts`
- **关联文档**：08-开发指南.md §3 "AppError"; 07b-请求编辑视觉规范.md §2.19

---

## 任务依赖关系图

```
Week 1 (基础)
1.01 ──┬── 1.02 ──┬── 1.04 ──┬── 1.06 ──┬── 1.08 ── 1.09
       │          │          │          │
       ├── 1.03 ─┤          │          └── 1.07
       │          │          │
       └── 1.05 ─┘          └── 1.07

Week 2 (布局)
1.09 ── 1.10 ──┬── 1.11 ── 1.12
               ├── 1.13
               ├── 1.14
               └── 1.15 ──┬── 1.16
                          ├── 1.17
                          ├── 1.18
                          └── 1.19

Week 3 (组件)
1.13 ──┬── 1.20
       ├── 1.21
       └── 1.29
1.10 ──── 1.22 ──┬── 1.23 ── 1.26
                 └── 1.24 ──┬── 1.25
                            └── 1.26
1.15 + 1.17 ── 1.27
1.15 ────────── 1.28

Week 4 (后端)
1.07 ──┬── 1.30 ── 1.31
       ├── 1.32
       └── 1.33
1.30 + 1.32 + 1.33 ── 1.34
1.21 + 1.23 + 1.24 + 1.25 + 1.28 + 1.34 ── 1.35
1.28 + 1.34 ── 1.36
1.35 + 1.23 ── 1.37
1.33 + 1.35 ── 1.38
1.35 + 1.31 ── 1.39
1.06 ── 1.40
```

---

## Week 4 新增任务

### 1.40 — 性能埋点基础设施

- **依赖**：1.06（设计 Token 已完成，CSS Variables 可用）
- **工时**：4h
- **验收标准**：
  - `packages/core/src/performance/index.ts` 实现 `measureAsync` 和 `measurePerformance` 工具函数
  - 关键路径已埋点：冷启动（`app:ready`）、请求发送（`request:send` → `request:response`）、侧边栏展开/折叠（`sidebar:toggle`）
  - 开发环境（`import.meta.env.DEV`）输出 `console.debug` 日志
  - 生产环境预留 Sentry performance 上报接口（暂不集成）
  - Rust 侧 `app.ready` 事件时间戳可通过 `performance.now()` 计算冷启动耗时
- **关键文件**：`packages/core/src/performance/index.ts`, `apps/desktop/src/main.tsx`, `apps/desktop/src/App.tsx`
- **关联文档**：01-整体规划.md §15（性能埋点与监控）

---

## 风险与缓解

| 风险 | 影响 | 缓解策略 |
|------|------|----------|
| Tauri 2.x API 变更 | 高 | 锁定 minor 版本；参考官方文档而非第三方教程 |
| reqwest 跨平台编译问题 | 中 | 使用 rustls-tls 而非 native-tls；CI 多平台测试 |
| CSS Variables 在 WebView2 兼容性 | 低 | WebView2 基于 Chromium，CSS Variables 兼容性良好 |
| Zustand + Immer 性能问题 | 低 | Phase 1 数据量小；仅在请求/响应大对象时使用 Immer |
| Monaco Editor 包体过大 | 中 | Phase 1 使用 CodeMirror 轻量编辑器；Monaco 延迟到 Phase 3 |
| SQLite 首次初始化阻塞 | 中 | 在 Rust setup 阶段异步初始化；前端显示 loading 状态 |

---

*文档版本: v1.0*
*创建时间: 2026-04-15*
*基于: 01-整体规划.md / 02-UI设计.md / 04a-架构设计.md / 04b-API设计.md / 04c-安全与性能.md / 07a-首页视觉规范.md / 07b-请求编辑视觉规范.md / 07c-侧边栏与命令面板视觉规范.md / 08-开发指南.md*
