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

### 4.5 AppState 生命周期管理

#### 4.5.1 Rust AppState 定义

AppState 是所有 Tauri Command 共享的全局状态，在应用启动时初始化，通过 `tauri::Manager::state()` 注入到每个 Command。

```rust
use std::sync::Arc;
use tokio::sync::{Mutex, RwLock};
use rusqlite::Connection;

pub struct AppState {
    pub data_dir: std::path::PathBuf,

    pub http_client: HttpClientState,

    pub db: Arc<Mutex<Connection>>,

    pub fs_lock: Arc<Mutex<()>>,

    pub vault: Arc<RwLock<VaultService>>,

    pub script_engine: Arc<Mutex<ScriptEngine>>,

    pub active_websockets: Arc<RwLock<HashMap<String, WebSocketConnection>>>,

    pub proxy_state: Arc<RwLock<ProxyState>>,

    pub cancel_tokens: Arc<RwLock<HashMap<String, tokio_util::sync::CancellationToken>>>,
}

pub struct HttpClientState {
    pub client: reqwest::Client,
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

#### 4.5.2 锁粒度选择

| 字段 | 锁类型 | 原因 |
|------|--------|------|
| `db` | `Mutex` | SQLite 写入需串行化，单写者场景 |
| `fs_lock` | `Mutex` | 文件系统写入需串行化，防止并发覆盖 |
| `vault` | `RwLock` | 读多写少（解锁后只读密钥），允许并发读 |
| `script_engine` | `Mutex` | QuickJS Runtime 非线程安全，需互斥 |
| `active_websockets` | `RwLock` | 读多写少（遍历连接列表），允许并发读 |
| `cancel_tokens` | `RwLock` | 注册/取消并发，但读取频率更高 |
| `http_client` | 无锁 (Arc) | reqwest::Client 内部已线程安全 |

#### 4.5.3 初始化流程

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

#### 4.5.4 在 Tauri 中注册

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
            commands::websocket::ws_connect,
            commands::websocket::ws_send,
            commands::websocket::ws_close,
            commands::file::read_file,
            commands::file::write_file,
            commands::crypto::unlock_vault,
            commands::crypto::lock_vault,
            commands::script::execute_script,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

#### 4.5.5 在 Command 中使用

```rust
#[tauri::command]
pub async fn send_http_request(
    state: tauri::State<'_, AppState>,
    config: HttpRequestConfig,
    cancel_token: Option<String>,
) -> Result<HttpResponse, String> {
    if let Some(token_id) = cancel_token {
        let token = tokio_util::sync::CancellationToken::new();
        state.cancel_tokens.write().await.insert(token_id, token.clone());
    }

    let response = state.http_client.client
        .request(config.method.parse().map_err(|e| e.to_string())?, &config.url)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    Ok(parse_response(response).await?)
}
```
