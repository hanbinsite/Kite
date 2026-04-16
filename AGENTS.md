# AGENTS.md — AI 开发指引

> 本文件是 AI 编码助手的项目上下文入口。开始编码前必读。

---

## 1. 关键命令

```bash
# 安装依赖
pnpm install

# 开发
pnpm dev                  # 启动前端 dev server
cd apps/desktop && pnpm tauri dev   # 启动 Tauri 桌面应用

# 构建
pnpm build                # 构建所有 workspace 子包

# 代码质量
pnpm lint                 # ESLint 检查（零 warning）
pnpm typecheck            # TypeScript 类型检查（零错误）
cd apps/desktop/src-tauri && cargo check    # Rust 编译检查
cd apps/desktop/src-tauri && cargo clippy   # Rust lint（零 warning）

# 测试
pnpm test                 # 运行所有测试
pnpm test:unit            # 前端单元测试（Vitest）
cd apps/desktop/src-tauri && cargo test      # Rust 单元测试

# 格式化
pnpm format               # Prettier 格式化
pnpm format:check         # Prettier 格式检查

# 类型同步
cd apps/desktop/src-tauri && cargo build    # 触发 ts-rs 生成 TypeScript 类型
# 生成后检查：diff -r src-tauri/generated/ ../../packages/types/src/generated/
```

---

## 2. 项目结构速查

```
api-client/
├── apps/desktop/                  # Tauri 桌面应用
│   ├── src/                       # React 前端
│   │   ├── main.tsx               # 入口
│   │   ├── App.tsx                # 根组件
│   │   ├── components/            # 页面组件
│   │   ├── stores/                # Zustand stores
│   │   ├── hooks/                 # 自定义 hooks
│   │   └── styles/index.css      # Tailwind @theme 令牌
│   └── src-tauri/                 # Rust 后端
│       ├── src/
│       │   ├── main.rs            # Rust 入口 + AppState
│       │   ├── commands/          # Tauri commands
│       │   │   ├── http.rs        # HTTP 请求 (reqwest)
│       │   │   ├── grpc.rs        # gRPC (tonic)
│       │   │   ├── websocket.rs   # WebSocket (tokio-tungstenite)
│       │   │   ├── file_ops.rs    # 文件操作
│       │   │   ├── crypto.rs      # Vault 加密 (argon2 + aes-gcm)
│       │   │   ├── proxy_cmd.rs   # 代理
│       │   │   ├── script.rs      # 脚本执行 (rquickjs)
│       │   │   └── oauth.rs       # OAuth 令牌交换
│       │   ├── storage/           # 存储层
│       │   │   ├── sqlite.rs      # SQLite 操作
│       │   │   └── file.rs        # 文件系统操作
│       │   ├── script/            # 脚本引擎
│       │   │   ├── engine.rs      # QuickJS 引擎
│       │   │   └── pm_api.rs      # pm 对象实现
│       │   ├── proxy/             # HTTP 代理
│       │   └── mock/              # Mock 服务器
│       ├── Cargo.toml
│       ├── tauri.conf.json
│       └── capabilities/default.json
│
├── packages/
│   ├── ui/                        # 共享 UI 组件库
│   │   └── src/components/        # Button, Input, Dialog...
│   ├── core/                      # 核心业务逻辑
│   │   └── src/
│   │       ├── http/              # HTTP 调度（调用 Tauri Command）
│   │       ├── collection/        # 集合管理
│   │       ├── environment/       # 环境变量
│   │       ├── navigation/        # 状态驱动导航
│   │       └── performance/      # 性能埋点
│   └── types/                     # 共享类型定义
│       └── src/
│           ├── generated/         # ts-rs 自动生成（勿手动编辑）
│           └── *.ts               # 前端扩展类型
│
├── docs/                          # 设计文档
└── AGENTS.md                      # 本文件
```

---

## 3. 代码约定

### TypeScript / React

- **严格模式**：`tsconfig.json` 开启 `strict: true`
- **导入风格**：`import type { X } from 'y'` — 类型导入使用 `type` 关键字
- **组件风格**：函数组件 + hooks，不使用 class 组件
- **样式**：Tailwind CSS 4.x utility classes + `@theme` CSS 变量
- **状态管理**：Zustand + Immer middleware
  ```typescript
  import { create } from 'zustand';
  import { immer } from 'zustand/middleware/immer';
  const useStore = create(immer<StoreState>((set) => ({ ... })));
  ```
- **命名**：
  - 组件文件：PascalCase（`UrlBar.tsx`）
  - Store 文件：kebab-case（`request-store.ts`）
  - Hook 文件：camelCase（`useGlobalShortcuts.ts`）
  - CSS 变量：`--color-brand`、`--spacing-sidebar`（通过 `@theme` 前缀注册）
  - Tailwind 使用：`text-brand`、`bg-bg-surface`、`w-sidebar`
- **注释**：除非用户要求，不添加注释
- **变量高亮**：URL 输入中 `{{variable}}` 使用 `.variable-highlight` CSS 类
- **错误处理**：Rust 端 `AppError` 枚举 → JSON `{code, detail}` → 前端 `handleError()` 分类展示

### Rust

- **错误类型**：使用 `AppError` 枚举，通过 `From` trait 转换底层错误
- **命令返回**：`Result<T, AppError>`，Tauri 自动序列化为 JSON
- **结构体**：所有 IPC 通信结构体使用 `#[derive(TS)]` + `ts-rs` 导出 TypeScript 类型
- **serde 标签**：`AuthConfig` 使用外部标签 `#[serde(tag = "type", content = "config")]`，**不用** `#[serde(untagged)]`
- **命名**：snake_case（Rust 惯例）
- **测试**：内联 `#[cfg(test)] mod tests` 在文件底部

### Tauri IPC

- **Command 命名**：snake_case（`send_http_request`）
- **事件命名**：kebab-case，`{domain}-{action}`（`ws-message`、`http-response-chunk`）
- **方向**：大多数 Rust → Frontend（`app.emit()`）
- **前端调用**：`invoke('command_name', { args })` — 使用 `@tauri-apps/api/core`

---

## 4. 核心架构原则

1. **所有网络请求走 Rust 后端** — 前端不直接发送 HTTP/gRPC/WebSocket/SSE/GraphQL 请求，全部通过 Tauri IPC 调用 Rust
2. **密钥不离开 Rust** — Vault 密钥通过 keyring 管理，不经过 IPC 传输
3. **脚本在 Rust 侧执行** — 使用 rquickjs (QuickJS)，进程级隔离，超时控制 5s（可配置）
4. **状态驱动导航** — 不使用 React Router，使用 Zustand NavigationStore
5. **Monaco 单实例** — 切换 Tab 时替换 Model，不创建新 Editor 实例
6. **CSS 变量映射**：设计令牌（`--brand`）→ 实现变量（`--color-brand`）→ Tailwind（`text-brand`）
7. **多 Tab 独立响应** — RequestStore 使用 `responses: Record<tabId, HttpResponse>`，而非单一 `currentResponse`
8. **SQLite 查询用 spawn_blocking** — `rusqlite::Connection` 未实现 `Send`，必须通过 `tokio::task::spawn_blocking` 执行
9. **环境变量存 File System** — 权威存储为 `environments/{id}.json`，SQLite 不存环境变量
10. **文件操作必须校验路径** — 所有文件 Command 校验路径在 `{app_data}/` 内，防止路径遍历

---

## 5. 设计令牌速查（暗色主题）

| 令牌 | 实现变量 | 值 | Tailwind |
|------|---------|-----|----------|
| brand | --color-brand | #6C5CE7 | text-brand |
| bg-base | --color-bg-base | #0C0C12 | bg-bg-base |
| bg-surface | --color-bg-surface | #13131B | bg-bg-surface |
| bg-elevated | --color-bg-elevated | #1A1A25 | bg-bg-elevated |
| fg-primary | --color-fg-primary | #E8E6F0 | text-fg-primary |
| fg-secondary | --color-fg-secondary | #908EA0 | text-fg-secondary |
| accent-success | --color-accent-success | #00D68F | text-accent-success |
| accent-danger | --color-accent-danger | #FF4757 | text-accent-danger |
| method-get | --color-method-get | #00D68F | text-method-get |
| method-post | --color-method-post | #FFB800 | text-method-post |
| sidebar-width | --spacing-sidebar | 220px | w-sidebar |
| url-bar-height | --spacing-url-bar | 44px | h-url-bar |

完整令牌表见 `apps/desktop/src/styles/index.css`

---

## 6. 依赖版本（权威）

### 前端核心

| 库 | 版本 |
|----|------|
| React | 19.x |
| Tauri API | 2.x |
| Zustand | 5.x |
| Immer | 10.x |
| Tailwind CSS | 4.x |
| Radix UI | latest |
| Monaco Editor | 0.52.x（延迟加载）|
| CodeMirror 6 | 6.x（轻量编辑）|
| Framer Motion | 11.x |
| Lucide React | 0.460.x |
| dnd-kit | 6.x |
| Zod | 3.x |
| graphql-request | 7.x |
| react-i18next | 15.x |

### Rust 核心

| 库 | 版本 | 用途 |
|----|------|------|
| reqwest | 0.12.x | HTTP 请求 |
| tonic + prost | 0.12.x + 0.13.x | gRPC |
| tokio-tungstenite | 0.23.x | WebSocket |
| rquickjs | 0.7.x | 脚本引擎 |
| rusqlite | 0.31.x | SQLite |
| keyring | 3.x | 系统密钥链 |
| argon2 | 0.5.x | 密钥派生（KDF） |
| aes-gcm | 0.10.x | 数据加密（AES-256-GCM） |
| hudsucker | 0.22.x | HTTP 代理 |
| rumqttc | 0.24.x | MQTT |
| ts-rs | 10.x | TypeScript 类型生成 |

---

## 7. 文档索引

| 文档 | 核心内容 | 何时阅读 |
|------|---------|---------|
| 01-整体规划 | 愿景、选型、阶段规划 | 首次了解项目 |
| 02-UI设计 | 设计系统、布局、组件规范 | 实现UI时 |
| 03-功能设计 | 数据模型、业务逻辑、类型定义 | 实现功能时 |
| 04a-架构设计 | 整体架构、Rust后端、前端架构 | 理解架构时 |
| 04b-API设计 | Tauri Commands、事件定义 | 实现IPC通信时 |
| 04c-安全与性能 | 安全设计、性能优化 | 安全/性能相关时 |
| 05-UI操作流程 | 交互流程、状态转换 | 实现交互时 |
| 06-深度分析报告 | 早期问题修正记录 | 排查问题时 |
| 07a-首页视觉规范 | 首页像素级CSS | 实现首页时 |
| 07b-请求编辑视觉规范 | 请求编辑页像素级CSS | 实现请求编辑时 |
| 07c-侧边栏与命令面板视觉规范 | 侧边栏/命令面板/Console/Settings | 实现对应页面时 |
| 08-开发指南 | 初始化、配置、结构体、组件清单 | 开发全流程 |
| 09-Phase1任务清单 | 基础框架40个原子任务 | Phase 1 开发时 |
| 10-Phase2任务清单 | 核心请求26个任务 | Phase 2 开发时 |
| 11-Phase3任务清单 | 高级功能23个任务 | Phase 3 开发时 |
| 12-状态持久化 | 数据同步协议、冲突解决 | 存储相关时 |
| 13-错误处理 | 28种错误码UI映射 | 错误处理时 |

---

## 8. 常见陷阱

- **不要使用 Axios** — HTTP 请求全部通过 Rust reqwest 发送
- **不要使用 React Router** — 使用 Zustand NavigationStore
- **不要使用 vm2 / isolated-vm** — 脚本在 Rust rquickjs 执行
- **不要使用 @improbable-eng/grpc-web** — gRPC 通过 Rust tonic
- **不要使用 ws 库** — WebSocket 通过 Rust tokio-tungstenite
- **不要使用 @apollo/client** — 使用 graphql-request
- **不要在 IPC 中传递密钥** — 密钥只存储在 Rust 端 keyring
- **不要创建多个 Monaco 实例** — 使用 EditorManager 单实例管理
- **AuthConfig 不要用 untagged 枚举** — 使用外部标签 `#[serde(tag = "type", content = "config")]`
- **CSS 变量使用 @theme 前缀** — `--color-brand` 而非 `--brand`
- **不要在 async 中直接持有 SQLite Connection** — 使用 `spawn_blocking` + `blocking_lock()`
- **不要在 RequestStore 中使用单一 `currentResponse`** — 使用 `responses: Record<tabId, HttpResponse>` 支持多 Tab
- **不要在文件操作中接受未校验的路径** — 必须调用 `validate_path_within_app_data()`
- **GraphQL 请求也走 Rust 后端** — 作为 `RequestBody::graphql` 变体，复用 `send_http_request`
- **ESLint 使用 flat config** — `eslint.config.js`（ESLint 9.x），不用 `.eslintrc.js`
- **环境变量不要存 SQLite** — 权威存储为 File System: `environments/{id}.json`
