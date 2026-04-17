# API Client API 设计

> 本文档拆分自原 04-技术方案.md，涵盖 Tauri Commands、事件定义和 IPC 协议。架构设计见 04a-架构设计.md，安全与性能见 04c-安全与性能.md。
## 5. API 设计

### 5.1 Tauri Commands (Frontend → Backend)

```typescript
import { invoke } from '@tauri-apps/api/core';

// HTTP 请求操作
export async function sendHttpRequest(
  config: HttpRequestConfig,
): Promise<HttpResponse> {
  return invoke('send_http_request', { config });
}

export async function cancelHttpRequest(
  requestId: string,
): Promise<void> {
  return invoke('cancel_http_request', { requestId });
}

// gRPC 请求操作
export async function sendGrpcRequest(
  config: GrpcRequestConfig,
): Promise<GrpcResponse> {
  return invoke('send_grpc_request', { config });
}

export async function parseProtoFile(
  path: string,
): Promise<ProtoFileDescriptor> {
  return invoke('parse_proto_file', { path });
}

// WebSocket 操作
export async function wsConnect(
  url: string,
  headers?: Record<string, string>,
): Promise<string> {
  return invoke('ws_connect', { url, headers: headers ?? {} });
}

export async function wsSend(
  connectionId: string,
  message: string,
): Promise<void> {
  return invoke('ws_send', { connectionId, message });
}

export async function wsClose(
  connectionId: string,
): Promise<void> {
  return invoke('ws_close', { connectionId });
}

// 文件操作
export async function readFile(path: string): Promise<string> {
  return invoke('read_file', { path });
}

export async function writeFile(
  path: string,
  content: string,
): Promise<void> {
  return invoke('write_file', { path, content });
}

export async function deleteFile(path: string): Promise<void> {
  return invoke('delete_file', { path });
}

export async function listDirectory(
  path: string,
): Promise<FileEntry[]> {
  return invoke('list_directory', { path });
}

// Vault 操作（密钥不经过 IPC）
export async function unlockVault(
  masterPassword: string,
): Promise<void> {
  return invoke('unlock_vault', { masterPassword });
}

export async function lockVault(): Promise<void> {
  return invoke('lock_vault');
}

export async function isVaultUnlocked(): Promise<boolean> {
  return invoke('is_vault_unlocked');
}

export async function encryptVaultSecret(
  name: string,
  plaintext: string,
): Promise<void> {
  return invoke('encrypt_vault_secret', { name, plaintext });
}

export async function decryptVaultSecret(
  name: string,
): Promise<string> {
  return invoke('decrypt_vault_secret', { name });
}

export async function deleteVaultSecret(
  name: string,
): Promise<void> {
  return invoke('delete_vault_secret', { name });
}

export async function listVaultSecrets(): Promise<string[]> {
  return invoke('list_vault_secrets');
}

// 代理操作
export async function startProxyServer(
  config: ProxyConfig,
): Promise<void> {
  return invoke('start_proxy', { config });
}

export async function stopProxyServer(): Promise<void> {
  return invoke('stop_proxy');
}

export async function getProxyStatus(): Promise<ProxyStatus> {
  return invoke('get_proxy_status');
}

// 脚本执行
export async function executeScript(
  code: string,
  context: ScriptContext,
  timeoutMs?: number,
): Promise<ScriptResult> {
  return invoke('execute_script', { code, context, timeoutMs });
}

export async function cancelScript(
  executionId: string,
): Promise<void> {
  return invoke('cancel_script', { executionId });
}

// 系统操作
export async function openExternal(url: string): Promise<void> {
  return invoke('open_external', { url });
}

export async function getAppVersion(): Promise<string> {
  return invoke('get_version');
}

// 集合操作
export async function getCollections(): Promise<CollectionSummary[]> {
  return invoke('get_collections');
}

export async function getCollectionDetail(
  collectionId: string,
): Promise<CollectionDetail> {
  return invoke('get_collection_detail', { collectionId });
}

export async function createCollection(
  name: string,
  description?: string,
): Promise<CollectionSummary> {
  return invoke('create_collection', { name, description });
}

export async function deleteCollection(
  collectionId: string,
): Promise<void> {
  return invoke('delete_collection', { collectionId });
}

export async function renameCollection(
  collectionId: string,
  newName: string,
): Promise<void> {
  return invoke('rename_collection', { collectionId, newName });
}

// 请求操作
export async function getRequest(
  requestId: string,
): Promise<SavedRequest> {
  return invoke('get_request', { requestId });
}

export async function saveRequest(
  requestId: string,
  data: SavedRequestData,
): Promise<void> {
  return invoke('save_request', { requestId, data });
}

export async function createRequest(
  collectionId: string,
  folderId: string | null,
  data: SavedRequestData,
): Promise<SavedRequest> {
  return invoke('create_request', { collectionId, folderId, data });
}

export async function deleteRequest(requestId: string): Promise<void> {
  return invoke('delete_request', { requestId });
}

export async function moveRequest(
  requestId: string,
  targetCollectionId: string,
  targetFolderId: string | null,
): Promise<void> {
  return invoke('move_request', { requestId, targetCollectionId, targetFolderId });
}

// 环境操作
export async function getEnvironments(): Promise<EnvironmentSummary[]> {
  return invoke('get_environments');
}

export async function getEnvironmentVariables(
  environmentId: string,
): Promise<EnvironmentVariable[]> {
  return invoke('get_environment_variables', { environmentId });
}

export async function setEnvironmentVariable(
  environmentId: string,
  key: string,
  value: string,
): Promise<void> {
  return invoke('set_environment_variable', { environmentId, key, value });
}

export async function createEnvironment(
  name: string,
): Promise<EnvironmentSummary> {
  return invoke('create_environment', { name });
}

export async function deleteEnvironment(
  environmentId: string,
): Promise<void> {
  return invoke('delete_environment', { environmentId });
}

// 全局变量
export async function getGlobalVariables(): Promise<EnvironmentVariable[]> {
  return invoke('get_global_variables');
}

export async function setGlobalVariable(
  key: string,
  value: string,
): Promise<void> {
  return invoke('set_global_variable', { key, value });
}

// 历史记录
export async function getRecentHistory(
  limit: number,
): Promise<HistoryEntry[]> {
  return invoke('get_recent_history', { limit });
}

export async function insertHistory(
  entry: Omit<HistoryEntry, 'id' | 'created_at'>,
): Promise<void> {
  return invoke('insert_history', { entry });
}

export async function clearHistory(): Promise<void> {
  return invoke('clear_history');
}

// Cookie 操作
export async function getCookies(
  domain?: string,
): Promise<CookieEntry[]> {
  return invoke('get_cookies', { domain });
}

export async function setCookie(cookie: CookieEntry): Promise<void> {
  return invoke('set_cookie', { cookie });
}

export async function deleteCookie(cookieId: string): Promise<void> {
  return invoke('delete_cookie', { cookieId });
}

// 文件元信息
export async function getFileMtime(path: string): Promise<number> {
  return invoke('get_file_mtime', { path });
}

// SSE 操作
export async function sseConnect(
  url: string,
  headers?: Record<string, string>,
  requestId?: string,
): Promise<string> {
  return invoke('sse_connect', { url, headers: headers ?? {}, requestId: requestId ?? '' });
}

export async function sseDisconnect(requestId: string): Promise<void> {
  return invoke('sse_disconnect', { requestId });
}

// GraphQL Schema 探索
export async function graphqlIntrospect(
  url: string,
  headers?: Record<string, string>,
): Promise<GraphqlSchema> {
  return invoke('graphql_introspect', { url, headers: headers ?? {} });
}
```

### 5.2 服务层 (Frontend Services)

```typescript
export class HttpService {
  async send(request: HttpRequest): Promise<HttpResponse> {
    const resolvedRequest = await this.resolveVariables(request);

    if (resolvedRequest.preRequestScript) {
      const scriptResult = await executeScript(
        resolvedRequest.preRequestScript,
        {
          request: resolvedRequest,
          variables: this.getVariables(),
        },
        5000,
      );
      this.applyScriptResult(scriptResult);
    }

    const response = await sendHttpRequest(resolvedRequest);

    if (resolvedRequest.postResponseScript) {
      const scriptResult = await executeScript(
        resolvedRequest.postResponseScript,
        {
          request: resolvedRequest,
          response,
          variables: this.getVariables(),
        },
        5000,
      );
      this.applyScriptResult(scriptResult);
    }

    return response;
  }

  async cancel(requestId: string): Promise<void> {
    await cancelHttpRequest(requestId);
  }

  private async resolveVariables(
    request: HttpRequest,
  ): Promise<HttpRequest> {
    // 变量替换逻辑
  }

  private applyScriptResult(result: ScriptResult): void {
    if (result.variables) {
      for (const [key, value] of Object.entries(result.variables)) {
        useEnvironmentStore.getState().setVariable(key, value);
      }
    }
  }

  private getVariables(): Record<string, string> {
    const env = useEnvironmentStore.getState();
    const vars: Record<string, string> = {};
    for (const v of env.globals) {
      if (!v.disabled) vars[v.key] = v.value;
    }
    const activeEnv = env.environments.find(
      (e) => e.id === env.activeEnvironmentId,
    );
    if (activeEnv) {
      for (const v of activeEnv.values) {
        if (v.enabled) vars[v.key] = v.value;
      }
    }
    return vars;
  }
}
```

### 5.3 Tauri 事件定义 (Backend → Frontend)

> 事件命名规范：`{domain}-{action}`，kebab-case。
> 所有事件 payload 使用 `#[derive(Serialize)]` + `ts-rs` 导出类型。

#### 5.3.1 事件总览

| 事件名 | Payload 类型 | 触发时机 | 消费方 |
|--------|-------------|---------|--------|
| `http-response-chunk` | `ResponseChunkPayload` | 流式响应收到分块 | ResponsePanel |
| `ws-message` | `WsMessagePayload` | WebSocket 收到消息 | WebSocketPanel |
| `ws-error` | `WsErrorPayload` | WebSocket 连接错误 | WebSocketPanel |
| `ws-close` | `WsClosePayload` | WebSocket 连接关闭 | WebSocketPanel |
| `sse-event` | `SsePayload` | SSE 收到事件 | SSEPanel |
| `sse-error` | `SsePayload` | SSE 连接错误 | SSEPanel |
| `sse-close` | `SsePayload` | SSE 连接关闭 | SSEPanel |
| `grpc-stream-message` | `GrpcStreamPayload` | gRPC 流式响应 | GrpcPanel |
| `grpc-stream-error` | `GrpcStreamPayload` | gRPC 流错误 | GrpcPanel |
| `grpc-stream-end` | `GrpcStreamPayload` | gRPC 流结束 | GrpcPanel |
| `environment-changed` | `EnvironmentChangedPayload` | 环境变量变更（Rust → 前端） | EnvironmentStore |
| `environment-write-failed` | `EnvWriteFailedPayload` | 环境变量写入失败 | Toast |
| `oauth-callback` | `string` | OAuth 回调到达 | OAuth2Service |
| `proxy-status-changed` | `ProxyStatusPayload` | 代理状态变更 | ProxyPanel |
| `script-console` | `ScriptConsolePayload` | 脚本 console.log | ConsolePanel |

#### 5.3.2 Payload 类型定义

```rust
#[derive(Clone, Serialize, TS)]
pub struct ResponseChunkPayload {
    pub request_id: String,
    pub data: String,          // UTF-8 文本分块
    pub chunk_index: u32,
    pub is_last: bool,
}

#[derive(Clone, Serialize, TS)]
pub struct WsMessagePayload {
    pub connection_id: String,
    pub data: String,
    pub is_binary: bool,
    pub timestamp: String,
}

#[derive(Clone, Serialize, TS)]
pub struct WsErrorPayload {
    pub connection_id: String,
    pub error: String,
}

#[derive(Clone, Serialize, TS)]
pub struct WsClosePayload {
    pub connection_id: String,
    pub code: Option<u16>,
    pub reason: Option<String>,
}

#[derive(Clone, Serialize, TS)]
pub struct SsePayload {
    pub request_id: String,
    pub data: String,
    pub event_type: String,    // "message" | "error" | "close"
}

#[derive(Clone, Serialize, TS)]
pub struct GrpcStreamPayload {
    pub request_id: String,
    pub data: String,
    pub stream_type: String,   // "data" | "error" | "end"
}

#[derive(Clone, Serialize, TS)]
pub struct EnvironmentChangedPayload {
    pub change_type: String,   // "variable_update" | "environment_switch" | "environment_created" | "environment_deleted"
    pub environment_id: Option<String>,
    pub variable_key: Option<String>,
    pub variable_value: Option<String>,
}

#[derive(Clone, Serialize, TS)]
pub struct EnvWriteFailedPayload {
    pub key: String,
    pub error: String,
}

#[derive(Clone, Serialize, TS)]
pub struct ProxyStatusPayload {
    pub running: bool,
    pub port: Option<u16>,
}

#[derive(Clone, Serialize, TS)]
pub struct ScriptConsolePayload {
    pub execution_id: String,
    pub level: String,         // "log" | "warn" | "error" | "info"
    pub args: Vec<String>,
}
```

#### 5.3.3 前端事件监听封装

```typescript
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export function onHttpResponseChunk(
  handler: (payload: ResponseChunkPayload) => void,
): Promise<UnlistenFn> {
  return listen<ResponseChunkPayload>('http-response-chunk', (e) => handler(e.payload));
}

export function onWsMessage(
  handler: (payload: WsMessagePayload) => void,
): Promise<UnlistenFn> {
  return listen<WsMessagePayload>('ws-message', (e) => handler(e.payload));
}

export function onWsError(
  handler: (payload: WsErrorPayload) => void,
): Promise<UnlistenFn> {
  return listen<WsErrorPayload>('ws-error', (e) => handler(e.payload));
}

export function onWsClose(
  handler: (payload: WsClosePayload) => void,
): Promise<UnlistenFn> {
  return listen<WsClosePayload>('ws-close', (e) => handler(e.payload));
}

export function onSseEvent(
  handler: (payload: SsePayload) => void,
): Promise<UnlistenFn> {
  return listen<SsePayload>('sse-event', (e) => handler(e.payload));
}

export function onEnvironmentChanged(
  handler: (payload: EnvironmentChangedPayload) => void,
): Promise<UnlistenFn> {
  return listen<EnvironmentChangedPayload>('environment-changed', (e) => handler(e.payload));
}

export function onOAuthCallback(
  handler: (payload: string) => void,
): Promise<UnlistenFn> {
  return listen<string>('oauth-callback', (e) => handler(e.payload));
}

export function onScriptConsole(
  handler: (payload: ScriptConsolePayload) => void,
): Promise<UnlistenFn> {
  return listen<ScriptConsolePayload>('script-console', (e) => handler(e.payload));
}
```

### 5.4 流式响应架构

对于大响应体（> 1MB），使用流式传输代替一次性返回：

**决策规则**：

| 响应体大小 | 传输模式 | 前端处理 |
|-----------|---------|---------|
| ≤ 1MB | 一次性 `HttpResponse` | 直接渲染 |
| > 1MB | 事件流 `http-response-chunk` | 分块接收 + 增量渲染 |

**Rust 侧流式实现**：

```rust
#[tauri::command]
pub async fn send_http_request(
    state: tauri::State<'_, AppState>,
    app: tauri::AppHandle,
    config: HttpRequestConfig,
    cancel_token: Option<String>,
) -> Result<HttpResponse, String> {
    // ... 构建请求 ...

    let response = client.send(request).await.map_err(|e| e.to_string())?;
    let content_length = response.content_length().unwrap_or(0);

    if content_length > STREAM_THRESHOLD {
        // 流式模式：先返回 header 信息，body 通过事件分块推送
        let header_response = HttpResponse {
            request_id: request_id.clone(),
            status: response.status().as_u16(),
            status_text: response.status().canonical_reason().unwrap_or("").to_string(),
            headers: extract_headers(&response),
            body: String::new(),
            body_is_binary: false,
            body_size: content_length,
            content_type: response.content_type().map(|ct| ct.to_string()).unwrap_or_default(),
            encoding: String::new(),
            time_ms: 0,
            timeline: None,
        };

        // 异步流式推送 body
        let app_clone = app.clone();
        let request_id_clone = request_id.clone();
        tokio::spawn(async move {
            let mut stream = response.bytes_stream();
            let mut chunk_index = 0u32;
            use futures_util::StreamExt;

            while let Some(chunk) = stream.next().await {
                match chunk {
                    Ok(bytes) => {
                        let data = String::from_utf8_lossy(&bytes).to_string();
                        let is_last = bytes.len() < 8192; // 简化判断
                        let _ = app_clone.emit("http-response-chunk", ResponseChunkPayload {
                            request_id: request_id_clone.clone(),
                            data,
                            chunk_index,
                            is_last,
                        });
                        chunk_index += 1;
                    }
                    Err(e) => {
                        let _ = app_clone.emit("http-response-chunk", ResponseChunkPayload {
                            request_id: request_id_clone.clone(),
                            data: format!("STREAM_ERROR: {}", e),
                            chunk_index,
                            is_last: true,
                        });
                        break;
                    }
                }
            }
        });

        Ok(header_response)
    } else {
        // 一次性模式：全部加载到内存
        let full_response = parse_response(response).await?;
        Ok(full_response)
    }
}

const STREAM_THRESHOLD: u64 = 1024 * 1024; // 1MB
```

**前端流式接收**：

```typescript
async function sendRequest(tabId: string, config: HttpRequestConfig) {
  const response = await invoke<HttpResponse>('send_http_request', { config, cancelToken: tabId });

  if (response.body_size > STREAM_THRESHOLD) {
    // 流式模式：监听分块事件
    let chunks: string[] = [];
    const unlisten = await onHttpResponseChunk((payload) => {
      if (payload.request_id !== tabId) return;
      chunks.push(payload.data);
      updateStreamPreview(tabId, chunks);

      if (payload.is_last) {
        unlisten();
        finalizeStreamResponse(tabId, chunks);
      }
    });
  }
  // 正常模式直接使用 response
}
```

## 6. AppState 生命周期管理

### 6.1 Rust AppState 定义

AppState 是所有 Tauri Command 共享的全局状态，在应用启动时初始化，通过 `tauri::Manager::state()` 注入到每个 Command。

```rust
use std::sync::Arc;
use tokio::sync::{Mutex, RwLock};
use rusqlite::Connection;

pub struct AppState {
    pub data_dir: std::path::PathBuf,
    pub app_handle: tauri::AppHandle,

    pub http_client: HttpClientState,

    // SQLite 使用 Mutex<Connection> 但在阻塞线程池中执行查询
    // 参见 §6.6 — rusqlite::Connection 未实现 Send
    pub db: Arc<Mutex<rusqlite::Connection>>,

    pub fs_lock: Arc<Mutex<()>>,

    pub vault: Arc<RwLock<VaultService>>,

    pub script_engine: Arc<Mutex<ScriptEngine>>,

    pub active_websockets: Arc<RwLock<HashMap<String, WebSocketConnection>>>,

    pub proxy_state: Arc<RwLock<ProxyState>>,

    pub cancel_tokens: Arc<RwLock<HashMap<String, tokio_util::sync::CancellationToken>>>,
}

pub struct HttpClientState {
    pub client: reqwest::Client,
    pub cookie_jar: Arc<reqwest::cookie::Jar>,
}

pub struct ProxyState {
    pub running: bool,
    pub port: Option<u16>,
}

pub struct WebSocketConnection {
    pub url: String,
    pub connected_at: chrono::DateTime<chrono::Utc>,
    pub sender: tokio::sync::mpsc::Sender<String>,
}
```

### 6.2 锁粒度选择

| 字段 | 锁类型 | 原因 |
|------|--------|------|
| `db` | `Mutex` | SQLite 写入需串行化；Connection 未实现 Send，通过 tokio::task::spawn_blocking 在阻塞线程池执行（见 §6.6） |
| `fs_lock` | `Mutex` | 文件系统写入需串行化，防止并发覆盖 |
| `vault` | `RwLock` | 读多写少（解锁后只读密钥），允许并发读 |
| `script_engine` | `Mutex` | QuickJS Runtime 非线程安全，需互斥 |
| `active_websockets` | `RwLock` | 读多写少（遍历连接列表），允许并发读 |
| `cancel_tokens` | `RwLock` | 注册/取消并发，但读取频率更高 |
| `http_client` | 无锁 (Arc) | reqwest::Client 内部已线程安全 |
| `http_client.cookie_jar` | `Arc (无内部 mut)` | reqwest::cookie::Jar 内部线程安全，Arc 共享引用 |

### 6.3 初始化流程

> **注意**：`AppState.db` (Arc<Mutex<Connection>) 与 `Storage` (04c-安全与性能.md §3.5) 的关系：`Storage` 是数据库操作的封装层，`AppState.db` 是底层连接。Command 不直接操作 `db`，而是通过 `Storage` 的方法（如 `insert_history`, `query_cookies`）间接操作，由 `Storage` 内部通过 `spawn_blocking` + `blocking_lock()` 执行查询。

```rust
pub fn init_app_state(data_dir: &Path) -> Result<AppState, String> {
    std::fs::create_dir_all(data_dir.join("collections"))
        .map_err(|e| e.to_string())?;
    std::fs::create_dir_all(data_dir.join("environments"))
        .map_err(|e| e.to_string())?;
    std::fs::create_dir_all(data_dir.join("vault"))
        .map_err(|e| e.to_string())?;

    let db_path = data_dir.join("app.db");
    let db = Connection::open(&db_path)
        .map_err(|e| e.to_string())?;
    Storage::new(data_dir.to_path_buf())?.migrate()?;

    let http_client = HttpClientState {
        client: reqwest::Client::builder()
            .cookie_store(true)
            .build()
            .map_err(|e| e.to_string())?,
        cookie_jar: Arc::new(reqwest::cookie::Jar::default()),
    };

    Ok(AppState {
        data_dir: data_dir.to_path_buf(),
        http_client,
        db: Arc::new(Mutex::new(db)),
        fs_lock: Arc::new(Mutex::new(())),
        vault: Arc::new(RwLock::new(VaultService::new(data_dir.join("vault")))),
        script_engine: Arc::new(Mutex::new(ScriptEngine::new()?)),
        active_websockets: Arc::new(RwLock::new(HashMap::new())),
        proxy_state: Arc::new(RwLock::new(ProxyState { running: false, port: None })),
        cancel_tokens: Arc::new(RwLock::new(HashMap::new())),
    })
}
```

### 6.4 在 Tauri 中注册

```rust
fn main() {
    let data_dir = app_data_dir().expect("failed to resolve app data dir");
    let state = init_app_state(&data_dir).expect("failed to init app state");

    tauri::Builder::default()
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            commands::http::send_http_request,
            commands::http::cancel_http_request,
            commands::grpc::send_grpc_request,
            commands::grpc::parse_proto_file,
            commands::grpc::graphql_introspect,
            commands::websocket::ws_connect,
            commands::websocket::ws_send,
            commands::websocket::ws_close,
            commands::file::read_file,
            commands::file::write_file,
            commands::file::delete_file,
            commands::file::list_directory,
            commands::file::create_directory,
            commands::file::get_file_mtime,
            commands::crypto::unlock_vault,
            commands::crypto::lock_vault,
            commands::crypto::is_vault_unlocked,
            commands::crypto::encrypt_vault_secret,
            commands::crypto::decrypt_vault_secret,
            commands::crypto::delete_vault_secret,
            commands::crypto::list_vault_secrets,
            commands::proxy_cmd::start_proxy,
            commands::proxy_cmd::stop_proxy,
            commands::proxy_cmd::get_proxy_status,
            commands::script::execute_script,
            commands::script::cancel_script,
            commands::oauth::exchange_oauth_token,
            commands::collection::get_collections,
            commands::collection::get_collection_detail,
            commands::collection::create_collection,
            commands::collection::delete_collection,
            commands::collection::rename_collection,
            commands::request::get_request,
            commands::request::save_request,
            commands::request::create_request,
            commands::request::delete_request,
            commands::request::move_request,
            commands::environment::get_environments,
            commands::environment::get_environment_variables,
            commands::environment::set_environment_variable,
            commands::environment::create_environment,
            commands::environment::delete_environment,
            commands::environment::get_global_variables,
            commands::environment::set_global_variable,
            commands::history::get_recent_history,
            commands::history::insert_history,
            commands::history::clear_history,
            commands::cookie::get_cookies,
            commands::cookie::set_cookie,
            commands::cookie::delete_cookie,
            commands::sse::sse_connect,
            commands::sse::sse_disconnect,
            commands::mqtt::mqtt_connect,
            commands::mqtt::mqtt_disconnect,
            commands::mqtt::mqtt_publish,
            commands::mqtt::mqtt_subscribe,
            commands::system::open_external,
            commands::system::get_version,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

> **注意**：`send_http_request` 的完整流式实现见 §5.4（包含大响应体流式推送、Cookie 注入、Auth 注入、变量解析等）。此处仅展示 AppState 基本模式，不重复定义 Command 逻辑。

### 6.6 SQLite Connection 与 async Tauri Command 的兼容方案

`rusqlite::Connection` **未实现 `Send`**，不能直接在 `tokio::sync::Mutex` 中跨 await 持有。解决方案：

**使用 `tokio::task::spawn_blocking` 在阻塞线程池中执行 SQLite 查询**：

```rust
use tokio::sync::Mutex;
use rusqlite::Connection;

pub struct AppState {
    pub db: Arc<Mutex<Connection>>,
    // ...
}

#[tauri::command]
pub async fn get_recent_history(
    state: tauri::State<'_, AppState>,
    limit: u32,
) -> Result<Vec<HistoryEntry>, String> {
    let db = state.db.clone();
    tokio::task::spawn_blocking(move || {
        let conn = db.blocking_lock();
        let mut stmt = conn
            .prepare("SELECT id, method, url, status, duration, created_at FROM history ORDER BY created_at DESC LIMIT ?1")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([limit], |row| {
                Ok(HistoryEntry {
                    id: row.get(0)?,
                    method: row.get(1)?,
                    url: row.get(2)?,
                    status: row.get(3)?,
                    duration_ms: row.get(4)?,
                    created_at: row.get(5)?,
                })
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}
```

**关键约束**：
- 所有 SQLite 操作必须通过 `spawn_blocking` 执行，不能在 async 上下文中直接持有 Connection
- `blocking_lock()` 而非 `lock().await`，确保在阻塞线程池中获取锁
- 单写者场景：所有写操作通过 `fs_lock` 或 `db` Mutex 串行化
