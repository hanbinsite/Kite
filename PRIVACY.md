# Privacy Policy

**Last updated: 2026-06-15**

Kite is a local desktop application. All data is stored exclusively on your device.

## Data Collection

This application does **not** collect, transmit, or share any personal data, usage analytics, or telemetry to external servers.

## Local Data Storage

The following data is stored locally on your device:
- API request history and collections (SQLite database)
- Environment variables (JSON files)
- Authentication credentials (encrypted via AES-256-GCM with key stored in system keyring)
- Application settings (local configuration)
- AI provider API keys (stored in system keyring, never transmitted except to the provider you configure)

## Network Requests

All HTTP, WebSocket, SSE, gRPC, and MQTT requests are sent directly from your device to the servers you configure. No requests are proxied through third-party servers.

## Third-Party Services

If you configure AI providers (OpenAI, Ollama, etc.), your API keys and chat data are sent directly to those providers. Please refer to each provider's privacy policy for their data handling practices.

## Contact

For questions about this privacy policy, please open an issue on our GitHub repository.
