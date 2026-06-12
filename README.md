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
- **Build**: Vite, Turborepo, pnpm

## License

MIT