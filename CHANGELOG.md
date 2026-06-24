# Changelog

## v0.0.7 (2026-06-24)

### UX & Quality
- **Confirm Dialogs**: Replaced native `window.confirm()` with unified `ConfirmDialog` component in Vault, MCP, and environment delete flows
- **Cache Invalidation**: Collection file save triggers immediate re-render of sidebar tree via hash-based cache busting
- **Zustand Subscription Optimization**: Applied selective selectors in runner dialog and response panel
- **Auto-Save Debounce**: Increased to 1000ms with content snapshot comparison to avoid redundant writes
- **Sidebar History Refresh**: Periodic 30-second refresh for history entries
- **Proxy CA Export**: Added "Export CA Certificate" button to ProxyPanel with PEM download
- **Keyboard Shortcuts**: Added Cmd+T / Ctrl+T for new tab

### Internals
- **Rust**: Replaced Mutex `.unwrap()` with `.unwrap_or_else()` in script engine for poisoned lock safety
- **Rust**: Removed unused `tonic-build` from build dependencies
- **Clippy**: Fixed `unnecessary_map_or` warning in HTTP client builder

---

## v0.0.6 (2026-06-23)

### New Features
- **JWT Real Signing**: HS256/RS256/ES256 algorithms, auto-generate payload + expiry
- **OAuth 2.0 PKCE Flow**: Browser redirect + local callback server + automatic token exchange
- **gRPC Server Reflection**: Discover button auto-finds services and methods, gzip compression, trailer error details
- **GraphQL IDE**: SDL schema parser + CodeMirror field/arg/enum autocomplete + Schema tree
- **MQTT**: Unsubscribe, wildcard tooltip, disconnect cleanup
- **HTTP Streaming Download**: Progress bar for large files, non-blocking UI
- **pm.sendRequest Cookie + Auth Sharing**: Script requests share main cookie jar and auth
- **Postman 2.1 Folder Export**: Auto-group by URL path prefix
- **Environment Variable Inheritance**: parent_id recursive resolution, child overrides parent
- **Protocol Panel Status Labels**: Text labels (Connected/Disconnected/Error) next to status dot
- **Tab Close Connection Confirmation**: Confirm dialog for active WS/SSE/MQTT/gRPC connections
- **Runner Script Error Display**: Red error badge + expandable error details
- **i18n Full Coverage**: +80 translation keys, 12 components fully localized (en/zh-CN)

### Fixes & Optimizations
- AI Single-Call Optimization: detectActions from dual LLM API to text-based JSON parsing
- SQLite WAL Tuning: busy_timeout=5000ms, wal_autocheckpoint=1000
- Removed unused explain_response type

### Testing
- TypeScript: 554 passed, 39 files
- Rust: 243 passed, 18 modules

---

## v0.0.4 (2026-06-17)

### UX Improvements
- **GraphQL Introspection UI**: "Introspect Schema" button in GraphQL body editor with collapsible schema viewer
- **Tab Persistence**: Tabs are now saved to localStorage and restored on app restart
- **History Full-Text Search**: Sidebar history search now queries all stored entries via backend `searchHistoryEntries` (300ms debounce, up to 100 results)
- **Monaco Variable Autocomplete**: ScriptEditor now provides `{{variable}}` completion suggestions from active environment/collection/global variables

### Import/Export
- **OpenAPI 3.0 Import**: Full parser for OpenAPI/Swagger specs — extracts paths, methods, parameters, request bodies, security schemes, and server URLs

### Stability
- **Error Boundary**: Already present from `@api-client/ui` — prevents white-screen crashes with reload button
- **Offline Graceful Degradion**: AI panel and GraphQL introspection show friendly error messages on network failure

---

## v0.0.3 (2026-06-17)

### Features
- **AI Action Dispatch**: All 7 action types fully wired (create_request, modify_request, write_test, fix_error, extract_variables, generate_mock, generate_doc)
- **Ollama Local SLM**: Native API support (test/list/chat/stream) replacing NOT_IMPLEMENTED stub
- **API Key Storage**: Migrated from JSON file to system keyring with legacy migration
- **Keyboard Shortcuts**: Ctrl+R resend, Ctrl+/ focus URL bar, Ctrl+Shift+N new collection, Ctrl+1-9 tab switch
- **Response Diff**: JSON line-by-line diff viewer comparing current vs previous response
- **Variable Autocomplete**: CodeMirror `{{}}` trigger with env/collection/global variable completion
- **GraphQL Introspection**: Rust command + IPC wrapper for schema introspection
- **Collection Runner**: CSV/JSON data-driven testing support
- **Memory**: previousResponses cleanup on tab close

---

## v0.0.2 (2026-06-17)

### AI Module (Phase 4)
- **Action Dispatch & Confirmation Flow**: All 7 AI action types fully wired — create_request opens new tab, write_test applies script to active request, extract_variables adds to globals, generate_mock adds mock route. Action results shown as assistant messages in chat.
- **AI Settings Page**: Full provider management (add/edit/delete), API key configuration, connection testing with detailed diagnostics, provider switching. Already complete — no new UI needed.
- **Ollama Local SLM**: Native Ollama API support (`/api/chat`, `/api/tags`) with `test_ollama_connection`, `list_ollama_models`, `ollama_chat`, `ollama_stream_chat`. Replaces NOT_IMPLEMENTED stub.
- **API Key Storage**: Migrated from plain JSON file (`ai-api-keys.json`) to system keyring, with automatic legacy data migration on first load.
- **AgentAction Schemas**: 7 Zod-validated schemas (create_request, modify_request, write_test, generate_doc, fix_error, extract_variables, generate_mock) with OpenAI Function Calling tool definitions.
- **Context Builder**: Injects active request/response, environments, and collections as system messages for AI context.
- **Chat Panel**: Streaming support, slash commands (`/create_request`, `/write_test`, `/fix_error`, `/explain`, `/generate_mock`, `/extract_environments`, `/generate_doc`, `/optimize`), copy/retry message buttons.
- **Rust Backend**: 9 Tauri commands — `ai_list_providers`, `ai_set_provider`, `ai_add_provider`, `ai_remove_provider`, `ai_set_api_key`, `ai_get_api_key_status`, `ai_test_connection`, `ai_chat`, `ai_stream_chat`, `ai_chat_with_tools`, `ai_save_session`, `ai_load_session`, `ai_delete_session`.

### Testing
- **TypeScript**: 358 tests across 25 files (+79 tests, +10 files)
  - `performance/index.test.ts` — 13 tests (markStart/markEnd/measureAsync/measureSync)
  - `http/index.test.ts` — 9 tests (buildIpcAuth validation)
  - `ai/context-builder.test.ts` — 10 tests (context message builder)
  - `ai/store.test.ts` — 13 tests (chat state, provider state mutations)
  - `ai/action-types.test.ts` — 311 tests (Zod schema validation for 7 action types)
  - `cookie-store.test.ts` — 3 tests (filter domain)
  - `grpc-store.test.ts` — 6 tests (pushStreamMessage, clearResponse)
  - `mock-store.test.ts` — 6 tests (pushLog cap, route CRUD)
  - `mqtt-store.test.ts` — 7 tests (pushMessage, error/disconnected status)
  - `sse-store.test.ts` — 6 tests (pushEvent, error/disconnected status)
  - `websocket-store.test.ts` — 6 tests (pushMessage, system closed)
  - Error handling, navigation, environment resolver, hierarchy merge, exporter/importer — already covered
- **Rust**: 170 tests across 13 test modules (+27 tests, +3 modules)
  - `grpc_test.rs` — 10 tests (serde roundtrip, encode/decode frame, error cases)
  - `mqtt_test.rs` — 5 tests (serde, connect config with/without auth)
  - `mock_test.rs` — 12 tests (serde, match_route exact/case-insensitive/no-match/empty)
  - `storage/mod.rs` — 8 tests (history CRUD, concurrent access, settings, cookies)
  - `crypto.rs` — 14 tests (derive_key, lock/unlock vault, path validation)
  - `script/engine_test.rs` — 16 tests (PM API, console, crypto, timeout)
  - `http_integration_tests.rs` — 20 tests (GET/POST/DELETE/PATCH, headers, auth, proxy, timeout, cancel, binary, redirect, graphql, form-urlencoded, SSE)
  - `codegen_test.rs` — 18 tests (curl, Python, JS fetch/axios, TypeScript, Go, Java, Kotlin, PHP, Ruby, Swift, C#, Dart, Node undici)
  - `provider_test.rs` — 11 tests (AI provider serde, chat/stream/tool messages)
  - `ws_message_test.rs` — 2 tests (WebSocket message serde)
  - `sse_test.rs` — 3 tests (SSE event serde, edge cases)
  - `environment_test.rs` — 6 tests (environment serde, variables enabled/disabled)
  - `error.rs` — 11 tests (error codes, display, conversions)

### Documentation
- AGENTS.md updated: gRPC status (reqwest → tonic HTTP/2), API key storage (JSON → keyring), numbering fix.

---

## v0.0.1 (2026-06-16)

- Initial Phase 1-3 completion
- HTTP request engine: all methods, headers, params, body modes (JSON, text, form, binary, GraphQL), auth types (Bearer, Basic, API Key, JWT, OAuth2)
- gRPC with tonic HTTP/2 + prost-reflect dynamic message handling
- WebSocket, SSE, MQTT, Mock Server
- Script engine (rquickjs) with full PM API (request, response, environment, globals, tests, expect)
- Collection & folder hierarchy with inheritance (7-layer variable priority)
- Vault encryption (Argon2 + AES-256-GCM)
- Environment variable management
- Code generation (curl, 13 languages)
- Cookie management
- Command palette
- Error handling (28 codes)