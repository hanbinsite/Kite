## v0.0.6 Release Notes

> **89 files changed, +8,189/−368 lines** · TS 554 tests · Rust 243 tests · Clippy 0 · ESLint 0

### 🆕 New Features

**Authentication**
- **JWT Real Signing** — HS256/RS256/ES256 algorithms, auto-generate payload + expiry
- **OAuth 2.0 PKCE Flow** — Browser redirect + local callback server + automatic token exchange

**Multi-Protocol**
- **gRPC Server Reflection** — Discover button auto-finds services and methods
- **gRPC Enhancements** — Timeout propagation, gzip compression, trailer error details
- **GraphQL IDE** — SDL schema parser + CodeMirror field/arg/enum autocomplete + Schema tree (click to insert)
- **MQTT** — Unsubscribe, wildcard tooltip, disconnect cleanup

**Request & Response**
- **HTTP Streaming Download** — Progress bar for large files, non-blocking UI
- **pm.sendRequest Cookie + Auth Sharing** — Script requests now share the main cookie jar and auth config

**Collection**
- **Postman 2.1 Folder Export** — Auto-group by URL path prefix
- **Environment Variable Inheritance** — parent_id recursive resolution, child overrides parent

**UX**
- **Protocol Panel Status Labels** — Text labels (Connected/Disconnected/Error) next to status dot
- **Tab Close Connection Confirmation** — Confirm dialog for active WS/SSE/MQTT/gRPC connections
- **Runner Script Error Display** — Red error badge + expandable error details
- **Large Collection Hint** — Ctrl+K shortcut prompt for >200 items
- **i18n Full Coverage** — +80 translation keys, 12 components fully localized (en/zh-CN)

### 🔧 Fixes & Optimizations
- **AI Single-Call Optimization** — detectActions from dual LLM API to text-based JSON parsing
- **Clippy 0 Warnings** — Fixed all 4 Rust lint warnings
- **SQLite WAL Tuning** — busy_timeout=5000ms, wal_autocheckpoint=1000
- **Orphan Type Cleanup** — Removed unused explain_response type
- **Settings Proxy Type Docs** — Clarified client proxy vs MITM proxy

### 🧪 Testing
- **TypeScript**: 554 passed, 39 files (+47 tests)
- **Rust**: 243 passed, 18 modules (+73 tests)
- New: oauth, history, curl/postman/har/detect importers, wiremock HTTP/gRPC/crypto integration tests

### 📊 Quality
| Metric | Value |
|--------|-------|
| TypeScript Typecheck | 0 errors |
| ESLint | 0 warnings |
| Clippy | 0 warnings |
| Unhandled Rejections | 0 |

---

### 📦 Install
| Platform | Download |
|----------|----------|
| Windows | `.msi` / `.nsis` |
| macOS (Apple Silicon) | `.dmg` |
| Linux | `.deb` / `.AppImage` |
