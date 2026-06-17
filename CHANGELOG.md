# Changelog

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