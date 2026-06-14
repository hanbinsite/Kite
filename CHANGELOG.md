# Changelog

## [Unreleased]

### Added
- HTTP request with full method/headers/body/auth support
- RESTful API client with variable resolution
- gRPC request support (HTTP/1.1)
- WebSocket client with send/receive
- SSE (Server-Sent Events) streaming
- MQTT client (publish/subscribe)
- Mock Server with configurable routes
- Vault for secure credential storage (AES-256-GCM + argon2)
- Environment variables management
- Script engine (JavaScript via QuickJS)
- AI Assistant with streaming chat (OpenAI-compatible providers)
- Collection management (import/export/folders)
- GraphQL query support
- Cookie management (SQLite-backed)
- i18n (zh-CN / en)

### Security
- XSS protection via content escaping
- CSP (Content Security Policy) configured
- Path traversal prevention for file operations
- Vault key zeroization and idle timeout
- Binary mode path validation
- SSE line buffering and size limits

