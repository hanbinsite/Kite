# Kite

A modern, local-first API client built with Tauri 2, React 19, and Rust. Postman-like features with Bruno-like local security — all data stays on your device.

[![CI](https://github.com/hanbinsite/Kite/actions/workflows/release.yml/badge.svg)](https://github.com/hanbinsite/Kite/actions/workflows/release.yml)

<p align="center">
  <img src="https://img.shields.io/badge/Tauri-2-FFC131?logo=tauri&logoColor=black" alt="Tauri 2" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react" alt="React 19" />
  <img src="https://img.shields.io/badge/Rust-1.85+-DEA584?logo=rust" alt="Rust" />
</p>

## Features

- **Multi-Protocol** — HTTP, GraphQL, gRPC, WebSocket, SSE, MQTT in one app
- **AI-Powered** — Natural language to requests, response analysis, test generation
- **Local-First** — No cloud account required, all data stored on your machine
- **Scripting** — Pre-request and post-response JavaScript with full `pm.*` API
- **Variable Resolution** — 7-tier scope chain (Global > Collection > Folder > Request)
- **Vault** — AES-256-GCM encrypted secret storage with system keyring
- **Collections** — Folder hierarchy, auth inheritance, config per collection
- **Code Generation** — cURL, Python, JS, Go, Java, C#, PHP, Ruby, Kotlin, Swift, Dart, Node, Axios
- **Import/Export** — Postman, OpenAPI, cURL, HAR
- **Collection Runner** — Batch execution with iteration, delay, and result tables

## Download

Download the latest version from [GitHub Releases](https://github.com/hanbinsite/Kite/releases).

| Platform | Package |
|----------|---------|
| Windows | `.msi` / `.nsis` installer |
| macOS | `.dmg` / `.app` |
| Linux | `.deb` / `.AppImage` |

## Quick Start

1. Open Kite and create a new request (`Ctrl+N` / `Cmd+N`)
2. Enter a URL (e.g., `https://api.github.com`)
3. Choose a method and add headers/params/body as needed
4. Press `Ctrl+Enter` (`Cmd+Enter`) to send
5. View the response in Pretty, Raw, or Preview mode

### Environments

Define variables like `{{baseUrl}}` per environment (Dev, Staging, Prod) and switch with one click. Variables resolve through a 7-tier chain.

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+K` / `Cmd+K` | Command palette |
| `Ctrl+N` / `Cmd+N` | New request |
| `Ctrl+Enter` / `Cmd+Enter` | Send request |
| `Ctrl+B` / `Cmd+B` | Toggle sidebar |
| `Ctrl+J` / `Cmd+J` | Toggle console |
| `Ctrl+Shift+L` / `Cmd+Shift+L` | AI panel |

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) ≥ 20
- [pnpm](https://pnpm.io/) ≥ 9
- [Rust](https://www.rust-lang.org/) ≥ 1.85

### Setup

```bash
pnpm install
pnpm dev              # Start frontend dev server
pnpm tauri dev        # Start Tauri desktop app
```

### Scripts

```bash
pnpm build            # Build all packages
pnpm typecheck        # TypeScript type check
pnpm lint             # ESLint check
pnpm test:unit        # Unit tests
pnpm test:e2e         # E2E tests (Playwright)
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Desktop Shell | Tauri 2 |
| Frontend | React 19, TypeScript, Tailwind CSS 4, Zustand |
| Backend | Rust, reqwest, tokio, tonic, rquickjs |
| Storage | SQLite (rusqlite), File System |
| Editors | Monaco Editor, CodeMirror 6 |
| AI | OpenAI-compatible API (DeepSeek, Qwen, Ollama...) |

## Architecture

All network traffic flows through the Rust backend — the frontend never sends HTTP requests directly. This ensures:

- **Security** — CSP restrictions enforced at the Rust layer
- **Consistency** — All protocols (HTTP, gRPC, WS, SSE, MQTT) use the same pipeline
- **Performance** — Native TLS, connection pooling, streaming

```
┌──────────────────────────────────────┐
│  React Frontend (IPC via Tauri)      │
├──────────────────────────────────────┤
│  Rust Backend                        │
│  ├─ reqwest (HTTP/SSE)               │
│  ├─ tonic (gRPC HTTP/2)              │
│  ├─ tokio-tungstenite (WebSocket)     │
│  ├─ rumqttc (MQTT)                   │
│  ├─ rquickjs (Script Engine)         │
│  └─ SQLite + Keyring (Storage/Auth)  │
└──────────────────────────────────────┘
```

## Privacy

Kite is **local-first** by design. No telemetry, no cloud sync, no accounts. All data — requests, environments, credentials — stays on your device. See [PRIVACY.md](PRIVACY.md).

## License

MIT
