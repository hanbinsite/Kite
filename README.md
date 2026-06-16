# Kite

> 🪁 一款现代、本地优先的 API 客户端 — 基于 Tauri 2、React 19 和 Rust 构建。Postman 的功能 + Bruno 的本地安全理念，所有数据留在你的设备上。

[English](README.en.md) | [![CI](https://github.com/hanbinsite/Kite/actions/workflows/release.yml/badge.svg)](https://github.com/hanbinsite/Kite/actions/workflows/release.yml)

<p align="center">
  <img src="https://img.shields.io/badge/Tauri-2-FFC131?logo=tauri&logoColor=black" alt="Tauri 2" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react" alt="React 19" />
  <img src="https://img.shields.io/badge/Rust-1.85+-DEA584?logo=rust" alt="Rust" />
</p>

## 特性

- **多协议** — 一站式支持 HTTP、GraphQL、gRPC、WebSocket、SSE、MQTT
- **AI 原生** — 自然语言创建请求、响应分析、测试脚本生成
- **本地优先** — 无需云账户，所有数据存储在本地设备
- **脚本引擎** — 请求前/响应后 JavaScript 脚本，完整 `pm.*` API
- **变量解析** — 7 层作用域链（Global > Collection > Folder > Request）
- **加密存储** — AES-256-GCM 加密 + 系统密钥链（keyring）
- **集合管理** — 文件夹层级、认证继承、集合级配置
- **代码生成** — cURL、Python、JavaScript、Go、Java、C#、PHP、Ruby、Kotlin、Swift、Dart、Node、Axios
- **导入导出** — Postman、OpenAPI、cURL、HAR
- **批量运行** — Collection Runner 支持迭代、延迟、结果表格导出

## 下载

从 [GitHub Releases](https://github.com/hanbinsite/Kite/releases) 下载最新版本。

| 平台 | 安装包 |
|------|--------|
| Windows | `.msi` / `.nsis` 安装程序 |
| macOS | `.dmg` / `.app` |
| Linux | `.deb` / `.AppImage` |

## 快速上手

1. 打开 Kite，点击侧边栏 **+** 创建新请求
2. 输入 URL（例如 `https://api.github.com`）
3. 选择请求方法，添加 Headers / Params / Body
4. 按 `Ctrl+Enter`（macOS `Cmd+Enter`）发送
5. 在 Pretty / Raw / Preview 模式查看响应

### 环境变量

按环境（开发、测试、生产）定义 `{{baseUrl}}` 等变量，一键切换。变量通过 7 层作用域链自动解析。

### 快捷键

| 快捷键 | 操作 |
|--------|------|
| `Ctrl+K` / `Cmd+K` | 命令面板 |
| `Ctrl+N` / `Cmd+N` | 新建请求 |
| `Ctrl+Enter` / `Cmd+Enter` | 发送请求 |
| `Ctrl+B` / `Cmd+B` | 切换侧边栏 |
| `Ctrl+J` / `Cmd+J` | 切换控制台 |
| `Ctrl+Shift+L` / `Cmd+Shift+L` | AI 面板 |

## 开发

### 环境要求

- [Node.js](https://nodejs.org/) ≥ 20
- [pnpm](https://pnpm.io/) ≥ 9
- [Rust](https://www.rust-lang.org/) ≥ 1.85

### 启动

```bash
pnpm install
pnpm dev              # 启动前端开发服务器
pnpm tauri dev        # 启动 Tauri 桌面应用
```

### 常用命令

```bash
pnpm build            # 构建所有子包
pnpm typecheck        # TypeScript 类型检查
pnpm lint             # ESLint 检查
pnpm test:unit        # 单元测试
pnpm test:e2e         # E2E 测试 (Playwright)
```

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Tauri 2 |
| 前端 | React 19、TypeScript、Tailwind CSS 4、Zustand |
| 后端 | Rust、reqwest、tokio、tonic、rquickjs |
| 存储 | SQLite (rusqlite)、文件系统 |
| 编辑器 | Monaco Editor、CodeMirror 6 |
| AI | OpenAI 兼容 API（DeepSeek、Qwen、Ollama...） |

## 架构

所有网络请求通过 Rust 后端发送，前端不直接发起 HTTP 请求。这确保：

- **安全** — CSP 策略在 Rust 层强制执行
- **一致** — 所有协议（HTTP、gRPC、WS、SSE、MQTT）使用统一管道
- **高性能** — 原生 TLS、连接池、流式传输

```
┌──────────────────────────────────────┐
│  React 前端（通过 Tauri IPC 通信）     │
├──────────────────────────────────────┤
│  Rust 后端                           │
│  ├─ reqwest (HTTP/SSE)               │
│  ├─ tonic (gRPC HTTP/2)              │
│  ├─ tokio-tungstenite (WebSocket)     │
│  ├─ rumqttc (MQTT)                   │
│  ├─ rquickjs (脚本引擎)               │
│  └─ SQLite + Keyring (存储/认证)      │
└──────────────────────────────────────┘
```

## 隐私

Kite 是**本地优先**设计。无遥测、无云同步、无账户。所有数据 — 请求、环境、凭据 — 保留在你的设备上。详见 [PRIVACY.md](PRIVACY.md)。

## 许可证

MIT