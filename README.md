# API Client

A powerful desktop API client built with Tauri 2, React 19, and Rust.

## Features

- HTTP, gRPC, WebSocket, SSE, MQTT, GraphQL support
- AI-powered request generation and response analysis
- Environment variables with 7-tier priority resolution
- Pre-request and post-response scripting (JavaScript)
- Vault for encrypted secret storage
- Mock server with custom routes
- Cookie management
- Import/Export (Postman, cURL, HAR, OpenAPI)

## Development

```bash
pnpm install
pnpm dev          # Start dev server
pnpm tauri dev    # Start Tauri desktop app
pnpm build        # Build all packages
pnpm typecheck    # TypeScript type check
pnpm lint         # ESLint check
```

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS 4, Zustand, CodeMirror 6, Monaco Editor
- **Backend**: Rust, Tauri 2, reqwest, rquickjs, rusqlite, tokio

## Getting Started

### Download

Download the latest release from the [Releases](https://github.com/hanbin/api-client/releases) page.

### Sending Your First Request

1. Open the app and click the **+** button in the sidebar to create a new request
2. Enter a URL (e.g., `https://api.github.com`)
3. Select the HTTP method (GET, POST, etc.)
4. Click **Send** or press `Ctrl+Enter` (`Cmd+Enter` on macOS)

### Working with Environments

Create environments (Development, Staging, Production) in the Environment selector dropdown. Define variables like `{{baseUrl}}` and use them in your request URLs, headers, and body.

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+K` / `Cmd+K` | Command palette |
| `Ctrl+N` / `Cmd+N` | New request |
| `Ctrl+Enter` / `Cmd+Enter` | Send request |
| `Ctrl+B` / `Cmd+B` | Toggle sidebar |
| `Ctrl+J` / `Cmd+J` | Toggle console |
| `Ctrl+Shift+L` / `Cmd+Shift+L` | Toggle AI panel |

### Privacy

All data stays on your device. No telemetry, no cloud sync. See [PRIVACY.md](PRIVACY.md).
- **Build**: Vite, Turborepo, pnpm

## License

MIT