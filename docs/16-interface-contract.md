# API Client 接口契约文档

> 本文档定义 Rust 后端与 React 前端之间所有 IPC 接口的契约规范，确保两端数据结构、命名、序列化行为完全一致。

---

## 1. 接口验证清单

### 1.1 已实现命令（37 个）

| # | Rust Command | IPC 名称 | 前端 Wrapper | 请求类型 | 响应类型 | 验证状态 |
|---|-------------|---------|-------------|---------|---------|---------|
| 1 | send_http_request | `send_http_request` | `sendHttpRequest` | HttpRequestConfig | HttpResponse | ✅ 已验证 |
| 2 | cancel_http_request | `cancel_http_request` | `cancelHttpRequest` | String | () | ✅ 已验证 |
| 3 | read_file | `read_file` | — | String | String | ✅ 已验证 |
| 4 | write_file | `write_file` | — | String, String | () | ✅ 已验证 |
| 5 | delete_file | `delete_file` | — | String | () | ✅ 已验证 |
| 6 | list_directory | `list_directory` | — | String | Vec<DirEntry> | ✅ 已验证 |
| 7 | create_directory | `create_directory` | — | String | () | ✅ 已验证 |
| 8 | insert_history_entry | `insert_history_entry` | `insertHistoryEntry` | InsertHistoryRequest | i64 | ✅ 已验证 |
| 9 | query_history_entries | `query_history_entries` | `queryHistoryEntries` | i32 | Vec<HistoryEntry> | ✅ 已验证 |
| 10 | search_history_entries | `search_history_entries` | `searchHistoryEntries` | String, i32 | Vec<HistoryEntry> | ✅ 已验证 |
| 11 | delete_history_entry | `delete_history_entry` | `deleteHistoryEntry` | i64 | () | ✅ 已验证 |
| 12 | clear_history | `clear_history` | `clearHistory` | — | () | ✅ 已验证 |
| 13 | get_setting | `get_setting` | `getSetting` | String | Option<String> | ✅ 已验证 |
| 14 | set_setting | `set_setting` | `setSetting` | String, String | () | ✅ 已验证 |
| 15 | insert_cookie | `insert_cookie` | `insertCookie` | CookieEntry | i64 | ✅ 已验证 |
| 16 | query_cookies | `query_cookies` | `queryCookies` | Option<String> | Vec<CookieEntry> | ✅ 已验证 |
| 17 | delete_cookie | `delete_cookie` | `deleteCookie` | i64 | () | ✅ 已验证 |
| 18 | clear_cookies | `clear_cookies` | `clearCookies` | — | () | ✅ 已验证 |
| 19 | list_collections | `list_collections` | `listCollections` | — | Vec<CollectionSummary> | ✅ 已验证 |
| 20 | get_collection | `get_collection` | `getCollection` | String | CollectionFile | ✅ 已验证 |
| 21 | save_collection | `save_collection` | `saveCollection` | CollectionFile | () | ✅ 已验证 |
| 22 | delete_collection | `delete_collection` | `deleteCollection` | String | () | ✅ 已验证 |
| 23 | list_environments | `list_environments` | `listEnvironments` | — | Vec<EnvironmentSummary> | ✅ 已验证 |
| 24 | get_environment | `get_environment` | `getEnvironment` | String | EnvironmentFile | ✅ 已验证 |
| 25 | save_environment | `save_environment` | `saveEnvironment` | EnvironmentFile | () | ✅ 已验证 |
| 26 | delete_environment | `delete_environment` | `deleteEnvironment` | String | () | ✅ 已验证 |
| 27 | ws_connect | `ws_connect` | `wsConnect` | String, String, Option<Vec<(String,String)>> | () | ✅ 已验证 |
| 28 | ws_send | `ws_send` | `wsSend` | String, String | () | ✅ 已验证 |
| 29 | ws_close | `ws_close` | `wsClose` | String | () | ✅ 已验证 |
| 30 | sse_connect | `sse_connect` | `sseConnect` | String, String, Option<Vec<(String,String)>> | () | ✅ 已验证 |
| 31 | sse_disconnect | `sse_disconnect` | `sseDisconnect` | String | () | ✅ 已验证 |
| 32 | mqtt_connect | `mqtt_connect` | `mqttConnect` | String, MqttConnectConfig | () | ✅ 已验证 |
| 33 | mqtt_subscribe | `mqtt_subscribe` | `mqttSubscribe` | String, String, u8 | () | ✅ 已验证 |
| 34 | mqtt_publish | `mqtt_publish` | `mqttPublish` | String, String, String, u8 | () | ✅ 已验证 |
| 35 | mqtt_disconnect | `mqtt_disconnect` | `mqttDisconnect` | String | () | ✅ 已验证 |
| 36 | parse_proto_file | `parse_proto_file` | `parseProtoFile` | String, String | Vec<GrpcMethodInfo> | ✅ 已验证 |
| 37 | send_grpc_request | `send_grpc_request` | `sendGrpcRequest` | GrpcRequestConfig | GrpcResponse | ✅ 已验证 |

### 1.2 规划中命令（未实现）

| # | Rust Command | IPC 名称 | 来源文档 | 优先级 |
|---|-------------|---------|---------|--------|
| 38 | unlock_vault | `unlock_vault` | 04b-API设计 | P2 |
| 39 | lock_vault | `lock_vault` | 04b-API设计 | P2 |
| 40 | is_vault_unlocked | `is_vault_unlocked` | 04b-API设计 | P2 |
| 41 | encrypt_vault_secret | `encrypt_vault_secret` | 04b-API设计 | P2 |
| 42 | decrypt_vault_secret | `decrypt_vault_secret` | 04b-API设计 | P2 |
| 43 | delete_vault_secret | `delete_vault_secret` | 04b-API设计 | P2 |
| 44 | list_vault_secrets | `list_vault_secrets` | 04b-API设计 | P2 |
| 45 | start_proxy | `start_proxy` | 04b-API设计 | P2 |
| 46 | stop_proxy | `stop_proxy` | 04b-API设计 | P2 |
| 47 | get_proxy_status | `get_proxy_status` | 04b-API设计 | P2 |
| 48 | execute_script | `execute_script` | 04b-API设计 | P1 |
| 49 | cancel_script | `cancel_script` | 04b-API设计 | P1 |
| 50 | exchange_oauth_token | `exchange_oauth_token` | 04b-API设计 | P1 |
| 51 | graphql_introspect | `graphql_introspect` | 04a-架构设计 §4.6 | P1 |

---

## 2. 多语言契约交叉引用表

### 2.1 HTTP 请求/响应类型

| Rust Struct | TS Type (packages/types) | IPC Command | Frontend Wrapper | Serde 约定 |
|------------|-------------------------|-------------|-----------------|-----------|
| HttpRequestConfig | HttpRequestConfig | send_http_request | sendHttpRequest | rename_all = "camelCase" |
| Header | Header | send_http_request | sendHttpRequest | — |
| QueryParam | QueryParam | send_http_request | sendHttpRequest | — |
| BodyConfig | BodyConfig | send_http_request | sendHttpRequest | skip_serializing_if |
| FormDataParam | FormDataParam | send_http_request | sendHttpRequest | default = "text" |
| UrlEncodedParam | UrlEncodedParam | send_http_request | sendHttpRequest | — |
| AuthConfig | AuthConfig | send_http_request | sendHttpRequest | **外部标签** tag="type", content="config" |
| RequestSettings | RequestSettings | send_http_request | sendHttpRequest | rename_all = "camelCase" |
| HttpResponse | HttpResponse | send_http_request (response) | sendHttpRequest | rename_all = "camelCase" |
| ResponseHeader | ResponseHeader | send_http_request (response) | sendHttpRequest | — |

### 2.2 Auth 配置变体对照

| Rust Variant | #[serde(rename)] | TS Discriminator | JSON 示例 |
|-------------|-----------------|-----------------|----------|
| None(EmptyAuth) | "none" | `{ type: "none" }` | `{"type":"none","config":{}}` |
| ApiKey(ApiKeyAuth) | "apikey" | `{ type: "apikey" }` | `{"type":"apikey","config":{"key":"X-API","value":"123","addTo":"header"}}` |
| Bearer(BearerAuth) | "bearer" | `{ type: "bearer" }` | `{"type":"bearer","config":{"token":"abc","prefix":"Bearer"}}` |
| Basic(BasicAuth) | "basic" | `{ type: "basic" }` | `{"type":"basic","config":{"username":"u","password":"p"}}` |
| Jwt(JwtAuth) | "jwt" | `{ type: "jwt" }` | `{"type":"jwt","config":{"token":"abc","secret":"s"}}` |
| OAuth1(OAuth1Auth) | "oauth1" | `{ type: "oauth1" }` | `{"type":"oauth1","config":{"consumerKey":"k","consumerSecret":"s","token":"t","tokenSecret":"ts","signatureMethod":"HMAC-SHA1"}}` |
| OAuth2(OAuth2Auth) | "oauth2" | `{ type: "oauth2" }` | `{"type":"oauth2","config":{"accessToken":"at","tokenType":"Bearer","refreshToken":"rt","expiresIn":3600}}` |
| AwsV4(AwsV4Auth) | "awsv4" | `{ type: "awsv4" }` | `{"type":"awsv4","config":{"accessKeyId":"ak","secretAccessKey":"sk","service":"s3","region":"us-east-1"}}` |

### 2.3 集合类型

| Rust Struct | TS Type | IPC Command | Serde 约定 |
|------------|---------|-------------|-----------|
| CollectionFile | Collection | list/get/save/delete | — |
| CollectionItem | CollectionItem | get_collection | **内部标签** tag="type", rename_all="lowercase" |
| CollectionFolder | CollectionFolder | get_collection | — |
| SavedRequest | SavedRequest | get_collection | — |
| CollectionSummary | CollectionSummary | list_collections | — |
| CollectionVariable | Variable | get_collection | default enabled=true |

### 2.4 环境类型

| Rust Struct | TS Type | IPC Command | Serde 约定 |
|------------|---------|-------------|-----------|
| EnvironmentFile | Environment | list/get/save/delete | rename "env_type" |
| EnvironmentVariable | Variable | get_environment | default enabled=true |
| EnvironmentSummary | EnvironmentSummary | list_environments | — |

### 2.5 历史/Cookie 类型

| Rust Struct | TS Type | IPC Command | Serde 约定 |
|------------|---------|-------------|-----------|
| InsertHistoryRequest | — (内部) | insert_history_entry | — |
| HistoryEntry | HistoryEntry | query/search_history | — |
| CookieEntry | CookieEntry | insert/query/delete/clear_cookies | default path="/", same_site="Lax" |

### 2.6 文件操作类型

| Rust Struct | TS Type | IPC Command | Serde 约定 |
|------------|---------|-------------|-----------|
| DirEntry | — | list_directory | — |

### 2.7 WebSocket/SSE/MQTT/gRPC 类型

| Rust Struct | TS Type | IPC Command/Event | Serde 约定 |
|------------|---------|-------------------|-----------|
| WsMessage | WsMessage | ws-message event | rename_all = "camelCase" |
| SseEvent | SseEvent | sse-event event | rename_all = "camelCase" |
| MqttMessage | MqttMessage | mqtt-message event | rename_all = "camelCase" |
| MqttConnectConfig | MqttConnectConfig | mqtt_connect | rename_all = "camelCase" |
| GrpcMethodInfo | GrpcMethodInfo | parse_proto_file | rename_all = "camelCase" |
| GrpcResponse | GrpcResponse | send_grpc_request | rename_all = "camelCase" |
| GrpcStreamMessage | GrpcStreamMessage | grpc-stream-message event | rename_all = "camelCase" |
| GrpcRequestConfig | GrpcRequestConfig | send_grpc_request | rename_all = "camelCase" |

---

## 3. Mock 数据示例

### 3.1 send_http_request — 请求示例

```json
{
  "id": "req_abc123",
  "method": "POST",
  "url": "https://api.example.com/users",
  "headers": [
    { "key": "Content-Type", "value": "application/json", "disabled": false },
    { "key": "Authorization", "value": "{{token}}", "disabled": false }
  ],
  "params": [
    { "key": "page", "value": "1", "disabled": false },
    { "key": "limit", "value": "20", "disabled": true }
  ],
  "body": {
    "mode": "raw",
    "content": "{\"name\": \"John\", \"email\": \"john@example.com\"}",
    "contentType": "application/json",
    "formdata": [],
    "urlencoded": [],
    "graphqlQuery": null,
    "graphqlVariables": null
  },
  "auth": {
    "type": "bearer",
    "config": {
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
      "prefix": "Bearer"
    }
  },
  "settings": {
    "timeoutMs": 30000,
    "followRedirects": true,
    "maxRedirects": 10,
    "verifySsl": true
  }
}
```

### 3.2 send_http_request — 响应示例

```json
{
  "id": "resp_xyz789",
  "requestId": "req_abc123",
  "status": 201,
  "statusText": "Created",
  "headers": [
    { "key": "Content-Type", "value": "application/json" },
    { "key": "X-Request-Id", "value": "srv-001" }
  ],
  "body": "{\"id\":1,\"name\":\"John\",\"email\":\"john@example.com\"}",
  "bodySize": 52,
  "time": 245,
  "contentType": "application/json"
}
```

### 3.3 send_http_request — 错误响应示例

```json
{
  "code": "NET_CONNECT_FAILED",
  "detail": "Connection refused: https://api.example.com (error code 61)"
}
```

### 3.4 AuthConfig 变体示例

```json
// None
{"type": "none", "config": {}}

// API Key (header)
{"type": "apikey", "config": {"key": "X-API-Key", "value": "secret123", "addTo": "header"}}

// API Key (query)
{"type": "apikey", "config": {"key": "api_key", "value": "secret123", "addTo": "query"}}

// Bearer
{"type": "bearer", "config": {"token": "my-token", "prefix": "Bearer"}}

// Basic
{"type": "basic", "config": {"username": "admin", "password": "pass123"}}

// JWT
{"type": "jwt", "config": {"token": "eyJ...", "secret": "my-secret"}}

// OAuth1
{"type": "oauth1", "config": {"consumerKey": "ck", "consumerSecret": "cs", "token": "t", "tokenSecret": "ts", "signatureMethod": "HMAC-SHA1"}}

// OAuth2
{"type": "oauth2", "config": {"accessToken": "at", "tokenType": "Bearer", "refreshToken": "rt", "expiresIn": 3600}}

// AWS V4
{"type": "awsv4", "config": {"accessKeyId": "AKIAIOSFODNN7EXAMPLE", "secretAccessKey": "wJalrXUtnFEMI/K7MDENG/bPxRfiCY", "service": "s3", "region": "us-east-1"}}
```

### 3.5 BodyConfig 变体示例

```json
// None
{"mode": "none", "formdata": [], "urlencoded": []}

// Raw JSON
{"mode": "raw", "content": "{\"key\": \"value\"}", "contentType": "application/json", "formdata": [], "urlencoded": []}

// Form Data
{"mode": "formdata", "content": null, "contentType": null, "formdata": [
  {"key": "field1", "value": "value1", "paramType": "text", "disabled": false, "contentType": null},
  {"key": "file1", "value": "/path/to/file", "paramType": "file", "disabled": false, "contentType": "application/pdf"}
], "urlencoded": []}

// URL Encoded
{"mode": "urlencoded", "content": null, "contentType": null, "formdata": [], "urlencoded": [
  {"key": "username", "value": "john", "disabled": false}
]}

// GraphQL
{"mode": "graphql", "content": null, "contentType": null, "formdata": [], "urlencoded": [], "graphqlQuery": "query { users { id name } }", "graphqlVariables": "{\"limit\": 10}"}
```

### 3.6 CollectionFile 示例

```json
{
  "id": "col_001",
  "name": "My API",
  "description": "Example collection",
  "items": [
    {
      "type": "folder",
      "id": "folder_001",
      "name": "Users",
      "items": [
        {
          "type": "request",
          "id": "req_001",
          "name": "Get Users",
          "method": "GET",
          "url": "https://api.example.com/users",
          "headers": [],
          "params": [],
          "body": null,
          "auth": null,
          "scripts": { "preRequest": null, "postResponse": null },
          "settings": { "timeoutMs": 30000, "followRedirects": true, "maxRedirects": 10, "verifySsl": true }
        }
      ],
      "description": "User endpoints"
    }
  ],
  "variables": [
    { "key": "base_url", "value": "https://api.example.com", "enabled": true }
  ],
  "createdAt": "2026-04-14T00:00:00Z",
  "updatedAt": "2026-04-16T00:00:00Z"
}
```

### 3.7 EnvironmentFile 示例

```json
{
  "id": "env_dev",
  "name": "Development",
  "variables": [
    { "key": "base_url", "value": "https://dev.api.example.com", "enabled": true },
    { "key": "token", "value": "{{vault:dev_token}}", "enabled": true }
  ],
  "envType": "dev",
  "createdAt": "2026-04-14T00:00:00Z",
  "updatedAt": "2026-04-16T00:00:00Z"
}
```

### 3.8 HistoryEntry / CookieEntry 示例

```json
// HistoryEntry
{ "id": 1, "method": "GET", "url": "https://api.example.com/users", "status": 200, "duration": 245, "createdAt": "2026-04-16T12:00:00Z" }

// InsertHistoryRequest
{ "method": "GET", "url": "https://api.example.com/users", "status": 200, "duration": 245 }

// CookieEntry
{ "id": 1, "domain": ".example.com", "name": "session", "value": "abc123", "path": "/", "expires": "2026-12-31T00:00:00Z", "secure": true, "httpOnly": true, "sameSite": "Lax" }
```

---

## 4. 契约测试代码骨架

### 4.1 Rust 契约测试

```rust
#[cfg(test)]
mod contract_tests {
    use super::*;
    use serde_json;

    #[test]
    fn auth_config_serialization_roundtrip() {
        let auth = AuthConfig::Bearer(BearerAuth {
            token: "test-token".to_string(),
            prefix: "Bearer".to_string(),
        });
        let json = serde_json::to_string(&auth).unwrap();
        assert!(json.contains("\"type\":\"bearer\""));
        assert!(json.contains("\"config\""));
        let deserialized: AuthConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(auth, deserialized);
    }

    #[test]
    fn collection_item_internal_tag_roundtrip() {
        let item = CollectionItem::Folder(CollectionFolder {
            id: "f1".to_string(),
            name: "Test".to_string(),
            items: vec![],
            description: None,
        });
        let json = serde_json::to_string(&item).unwrap();
        assert!(json.contains("\"type\":\"folder\""));
        let deserialized: CollectionItem = serde_json::from_str(&json).unwrap();
        assert_eq!(item, deserialized);
    }

    #[test]
    fn http_request_config_camelcase_fields() {
        let config = HttpRequestConfig {
            id: "req1".to_string(),
            method: "GET".to_string(),
            url: "https://example.com".to_string(),
            headers: vec![],
            params: vec![],
            body: None,
            auth: None,
            settings: RequestSettings::default(),
        };
        let json = serde_json::to_string(&config).unwrap();
        // Verify camelCase: timeoutMs, followRedirects, maxRedirects, verifySsl
        assert!(json.contains("\"timeoutMs\""));
        assert!(json.contains("\"followRedirects\""));
    }

    #[test]
    fn default_values_verification() {
        let settings = RequestSettings::default();
        assert_eq!(settings.timeout_ms, 30000);
        assert_eq!(settings.follow_redirects, true);
        assert_eq!(settings.max_redirects, 10);
        assert!(settings.verify_ssl);
    }
}
```

### 4.2 TypeScript 契约测试

```typescript
import { describe, it, expect } from 'vitest';

describe('IPC Contract', () => {
  it('AuthConfig discriminated union serialization', () => {
    const auth: AuthConfig = { type: 'bearer', config: { token: 'test', prefix: 'Bearer' } };
    const json = JSON.stringify(auth);
    expect(json).toContain('"type":"bearer"');
    expect(json).toContain('"config"');
    const parsed = JSON.parse(json) as AuthConfig;
    expect(parsed.type).toBe('bearer');
  });

  it('HttpRequestConfig field naming', () => {
    const settings: RequestSettings = { timeoutMs: 30000, followRedirects: true, maxRedirects: 10, verifySsl: true };
    const json = JSON.stringify(settings);
    expect(json).toContain('"timeoutMs"');
    expect(json).toContain('"followRedirects"');
  });

  it('HttpResponse field naming', () => {
    const response: HttpResponse = {
      id: 'r1', requestId: 'req1', status: 200, statusText: 'OK',
      headers: [], body: '{}', bodySize: 2, time: 100, contentType: 'application/json'
    };
    const json = JSON.stringify(response);
    expect(json).toContain('"requestId"');
    expect(json).toContain('"statusText"');
    expect(json).toContain('"bodySize"');
  });

  it('CollectionItem type discriminator', () => {
    const item = { type: 'folder', id: 'f1', name: 'Test', items: [] };
    const json = JSON.stringify(item);
    expect(json).toContain('"type":"folder"');
  });
});
```

### 4.3 IPC 调用集成测试骨架

```typescript
import { describe, it, expect, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('IPC Integration', () => {
  it('sendHttpRequest calls correct command', async () => {
    const mockResponse: HttpResponse = {
      id: 'r1', requestId: 'req1', status: 200, statusText: 'OK',
      headers: [], body: '{}', bodySize: 2, time: 100, contentType: 'application/json'
    };
    (invoke as any).mockResolvedValue(mockResponse);
    const result = await sendHttpRequest(config);
    expect(invoke).toHaveBeenCalledWith('send_http_request', { config });
  });

  it('listCollections calls correct command', async () => {
    (invoke as any).mockResolvedValue([]);
    await listCollections();
    expect(invoke).toHaveBeenCalledWith('list_collections');
  });
});
```

---

## 5. 命名约定映射

### 5.1 Rust ↔ TypeScript 字段名映射

| Rust 字名 | TS 字名 | serde 策略 | 备注 |
|----------|---------|-----------|------|
| timeout_ms | timeoutMs | rename_all = "camelCase" | RequestSettings, SavedSettings |
| follow_redirects | followRedirects | rename_all = "camelCase" | RequestSettings |
| max_redirects | maxRedirects | rename_all = "camelCase" | RequestSettings |
| verify_ssl | verifySsl | rename_all = "camelCase" | RequestSettings |
| request_id | requestId | rename_all = "camelCase" | HttpResponse |
| status_text | statusText | rename_all = "camelCase" | HttpResponse |
| body_size | bodySize | rename_all = "camelCase" | HttpResponse |
| content_type | contentType | rename_all = "camelCase" | HttpResponse |
| consumer_key | consumerKey | rename_all = "camelCase" | OAuth1Auth |
| consumer_secret | consumerSecret | rename_all = "camelCase" | OAuth1Auth |
| token_secret | tokenSecret | rename_all = "camelCase" | OAuth1Auth |
| signature_method | signatureMethod | rename_all = "camelCase" | OAuth1Auth |
| access_token | accessToken | rename_all = "camelCase" | OAuth2Auth |
| token_type | tokenType | rename_all = "camelCase" | OAuth2Auth |
| refresh_token | refreshToken | rename_all = "camelCase" | OAuth2Auth |
| expires_in | expiresIn | rename_all = "camelCase" | OAuth2Auth |
| access_key_id | accessKeyId | rename_all = "camelCase" | AwsV4Auth |
| secret_access_key | secretAccessKey | rename_all = "camelCase" | AwsV4Auth |
| session_token | sessionToken | rename_all = "camelCase" | AwsV4Auth |
| add_to | addTo | rename_all = "camelCase" | ApiKeyAuth |
| param_type | paramType | — | FormDataParam (无 rename_all) |
| pre_request | preRequest | — | SavedScripts |
| post_response | postResponse | — | SavedScripts |
| graphql_query | graphqlQuery | — | BodyConfig (无 rename_all) |
| graphql_variables | graphqlVariables | — | BodyConfig (无 rename_all) |
| request_count | requestCount | — | CollectionSummary |
| variable_count | variableCount | — | EnvironmentSummary |
| created_at | createdAt | — | 所有时间字段 |
| updated_at | updatedAt | — | 所有时间字段 |
| http_only | httpOnly | — | CookieEntry |
| same_site | sameSite | — | CookieEntry |
| env_type | envType | rename = "env_type" | EnvironmentFile (注意：Rust 侧保持 env_type) |
| auth_type | authType | rename = "type" | SavedAuth |

### 5.2 Command 命名映射

| Rust Command | IPC invoke 名 | 前端 Wrapper | 规则 |
|-------------|-------------|-------------|------|
| send_http_request | `send_http_request` | `sendHttpRequest` | snake_case → camelCase |
| cancel_http_request | `cancel_http_request` | `cancelHttpRequest` | snake_case → camelCase |
| insert_history_entry | `insert_history_entry` | `insertHistoryEntry` | snake_case → camelCase |
| query_history_entries | `query_history_entries` | `queryHistoryEntries` | snake_case → camelCase |
| search_history_entries | `search_history_entries` | `searchHistoryEntries` | snake_case → camelCase |
| delete_history_entry | `delete_history_entry` | `deleteHistoryEntry` | snake_case → camelCase |
| list_collections | `list_collections` | `listCollections` | snake_case → camelCase |
| get_collection | `get_collection` | `getCollection` | snake_case → camelCase |
| save_collection | `save_collection` | `saveCollection` | snake_case → camelCase |
| delete_collection | `delete_collection` | `deleteCollection` | snake_case → camelCase |

---

## 6. Serde 约定验证

### 6.1 AuthConfig — 外部标签 ✅

```rust
#[serde(tag = "type", content = "config")]
pub enum AuthConfig { ... }
```

**JSON 形式**: `{"type":"bearer","config":{"token":"xxx"}}`
**前端匹配**: `type AuthConfig = { type: "bearer"; config: BearerAuth } | ...`
**结论**: ✅ 契约一致。**禁止使用 untagged 枚举。**

### 6.2 CollectionItem — 内部标签 ✅

```rust
#[serde(tag = "type", rename_all = "lowercase")]
pub enum CollectionItem {
    Folder(CollectionFolder),
    Request(Box<SavedRequest>),
}
```

**JSON 形式**: `{"type":"folder","id":"...","name":"...","items":[...]}`
**前端匹配**: `{ type: "folder"; id; name; items } | { type: "request"; id; method; name; url }`
**结论**: ✅ 契约一致。

### 6.3 skip_serializing_if 约定

| Struct | 字段 | skip_serializing_if | 效果 |
|--------|------|--------------------|---- |
| BodyConfig | content | "Option::is_none" | none 时省略 |
| BodyConfig | content_type | "Option::is_none" | none 时省略 |
| BodyConfig | graphql_query | "Option::is_none" | none 时省略 |
| BodyConfig | graphql_variables | "Option::is_none" | none 时省略 |
| HttpRequestConfig | body | "Option::is_none" | 无 body 时省略 |
| HttpRequestConfig | auth | "Option::is_none" | 无 auth 时省略 |
| CollectionFile | description | "Option::is_none" | 无描述时省略 |
| CollectionFile | variables | "Option::is_none" | 无变量时省略 |
| SavedRequest | body | "Option::is_none" | 无 body 时省略 |
| SavedRequest | auth | "Option::is_none" | 无 auth 时省略 |
| BearerAuth | prefix | (default "Bearer") | 前端需注意默认值 |
| FormDataParam | content_type | "Option::is_none" | 文本类型省略 |

### 6.4 default 值约定

| Struct | 字段 | 默认值 | 前端需处理 |
|--------|------|--------|----------|
| Header | disabled | false | ✅ |
| QueryParam | disabled | false | ✅ |
| FormDataParam | param_type | "text" | ✅ 前端默认 "text" |
| FormDataParam | disabled | false | ✅ |
| UrlEncodedParam | disabled | false | ✅ |
| RequestSettings | timeout_ms | 30000 | ✅ |
| RequestSettings | follow_redirects | true | ✅ |
| RequestSettings | max_redirects | 10 | ✅ |
| RequestSettings | verify_ssl | true | ✅ |
| CollectionVariable | enabled | true | ✅ |
| EnvironmentVariable | enabled | true | ✅ |
| CookieEntry | path | "/" | ✅ |
| CookieEntry | same_site | "Lax" | ✅ |

---

## 7. Tauri 事件契约

### 7.1 已实现事件

| 事件名 | 方向 | Payload 类型 | 触发时机 |
|--------|------|-------------|---------|
| ws-message | Rust → Frontend | WsMessage | WS 消息/连接/关闭/错误（统一事件，通过 direction 字段区分） |
| sse-event | Rust → Frontend | SseEvent | SSE 事件/连接/关闭/错误（统一事件，通过 event 字段区分） |
| mqtt-message | Rust → Frontend | MqttMessage | MQTT 消息/订阅/断开/错误（统一事件，通过 direction 字段区分） |
| grpc-stream-message | Rust → Frontend | GrpcStreamMessage | gRPC Server Streaming 数据/错误/结束 |

**WsMessage Payload**:
```rust
pub struct WsMessage {
    pub connection_id: String,
    pub data: String,
    pub direction: String,   // "sent" | "received" | "system" | "error"
    pub timestamp: u64,
}
```

**SseEvent Payload**:
```rust
pub struct SseEvent {
    pub connection_id: String,
    pub event: String,        // "connected" | "disconnected" | "error" | "message" | 自定义事件名
    pub data: String,
    pub id: Option<String>,
    pub timestamp: u64,
}
```

**设计偏差说明**：04b-API设计.md 原规划 ws-message/ws-error/ws-close 三个独立事件和 sse-event/sse-error/sse-close 三个独立事件。实际实现采用统一事件+类型字段方案，简化前端监听逻辑，减少事件监听器数量。此偏差已记录在 18-dev-progress.md。

### 7.2 已规划事件（未实现）

| 事件名 | 方向 | Payload 类型 | 触发时机 |
|--------|------|-------------|---------|
| http-response-chunk | Rust → Frontend | { requestId, data, chunkIndex, isLast } | 大响应流式分块 |
| script-console | Rust → Frontend | { executionId, level, args } | 脚本 console 输出 |
| grpc-stream-message | Rust → Frontend | { requestId, data } | gRPC 流式响应 |
| environment-changed | Rust → Frontend | { changeType, environmentId, variableKey } | 环境变量变更 |

### 7.2 事件命名规则

- 格式: `{domain}-{action}` (kebab-case)
- 方向: 绝大多数 Rust → Frontend (`app.emit()`)
- 前端监听: `listen('ws-message', handler)` — 使用 `@tauri-apps/api/event`

---

## 8. CSP 安全约束

当前 CSP 策略（来自 `tauri.conf.json`）：

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
connect-src 'self' https://api.openai.com;
img-src 'self' data: asset: https://asset.localhost;
font-src 'self' data:
```

**约束影响**：
- 前端不能直接发起外部 HTTP 请求（connect-src 仅限 self + OpenAI）→ 所有网络请求必须走 Rust
- `unsafe-inline` 仅允许 style（CSS），禁止 inline script
- AI 模块可直接连接 `https://api.openai.com`（未来可能扩展其他 AI endpoint）

---

*文档版本: v1.1*
*创建时间: 2026-05-03*
*最后更新: 2026-05-04*