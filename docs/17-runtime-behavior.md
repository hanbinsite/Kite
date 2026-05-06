# API Client 运行时行为文档

> 本文档定义应用运行时的操作序列、并发规范、资源约束、降级行为及性能基准。

---

## 1. 操作序列图

### 1.1 应用启动序列

```
进程启动 (Tauri)
  │
  ├─ 1. Rust: main.rs — 初始化 AppState { storage: Arc<RwLock<Option<Storage>>> }
  │     ├─ register_all_commands() — 注册 23 个 IPC command
  │     └─ setup() — 初始化 SQLite Connection (spawn_blocking)
  │
  ├─ 2. WebView 加载 frontendDist (../dist)
  │     ├─ main.tsx — React root render
  │     ├─ useTheme() — 恢复主题 (localStorage → data-theme)
  │     ├─ UIStore.restore() — 侧边栏状态/宽度
  │     └─ SettingsStore.load() — localStorage "api-client-settings"
  │
  ├─ 3. 前端 Store 初始化
  │     ├─ EnvironmentStore.loadFromDisk() — invoke list_environments
  │     ├─ CollectionStore.loadFromDisk() — invoke list_collections
  │     └─ RequestStore — 空状态 (不预加载)
  │
  └─ 4. 首屏渲染
       ├─ AppLayout → Sidebar + Workbench
       ├─ HomePage (空状态) — 品牌插画
       └─ 性能埋点: markStart("app-ready")
```

**启动性能目标**:
| 指标 | 目标 | 测量点 |
|------|------|--------|
| 冷启动 (点击图标 → 首屏可用) | < 2s | `app.ready` 事件 |
| Store 数据加载 | < 200ms | `loadFromDisk()` Promise resolve |
| WebView 渲染 | < 500ms | React mount 完成 |

### 1.2 HTTP 请求发送序列

```
用户点击 Send
  │
  ├─ 1. RequestStore.sendRequest(tabId, method, url)
  │     ├─ setTabLoading(tabId, true)
  │     ├─ 性能埋点: markStart("request-{tabId}")
  │     │
  │     ├─ 2. VariableResolver.resolve(url)
  │     │     ├─ scope: local > data > environment > collection > global > dynamic
  │     │     ├─ 最多 5 层递归
  │     │     └─ 未找到 → 保持 {{var}} 原样
  │     │
  │     ├─ 3. buildIpcAuth(auth) — 验证必填字段
  │     │     └─ Bearer: token 不能为空; Basic: username/password 不能为空; 等
  │     │
  │     ├─ 4. invoke("send_http_request", { config })
  │     │     ├─ Tauri IPC → Rust send_http_request()
  │     │     ├─ Rust: 注册 CancellationToken → { request_id }
  │     │     ├─ Rust: 变量替换由前端完成，Rust 接收最终 URL
  │     │     ├─ Rust: reqwest 构建请求 → send → 等待响应
  │     │     ├─ Rust: 响应序列化为 HttpResponse JSON
  │     │     └─ Rust: 清除 CancellationToken
  │     │
  │     ├─ 5. 前端收到 HttpResponse
  │     │     ├─ setResponse(tabId, response)
  │     │     ├─ insertHistoryEntry() — 记录历史
  │     │     └─ 性能埋点: markEnd("request-{tabId}")
  │     │
  │     └─ 6. UI 渲染响应
  │          ├─ ResponseStatus — 状态码药丸 + 时间 + 大小
  │          ├─ JsonViewer — 语法高亮 + 折叠 (虚拟滚动)
  │          └─ setTabLoading(tabId, false)
  │
  ├─ 错误路径:
  │     ├─ invoke 抛出 AppError → setError(error.detail)
  │     ├─ handleError() — 分类展示 (NET_*, VALIDATION_*, etc.)
  │     └─ setTabLoading(tabId, false)
  │
  └─ 取消路径:
       ├─ 用户点击 Cancel → invoke("cancel_http_request", { requestId })
       ├─ Rust: CancellationToken.cancel()
       ├─ setTabLoading(tabId, false)
       └─ clearResponse(tabId)
```

### 1.3 集合操作序列

```
用户点击集合请求 → 打开 Tab
  │
  ├─ 1. 检查 TabStore: 同一 requestId 是否已打开
  │     ├─ 已打开 → setActiveTab(tabId)
  │     └─ 未打开 → 继续
  │
  ├─ 2. invoke("get_collection", { collectionId }) → CollectionFile
  │     └─ 从 CollectionFile.items 递归查找 SavedRequest
  │
  ├─ 3. RequestStore.initTabData(tabId, { headers, params, body, auth, settings, scripts })
  │
  ├─ 4. TabStore.openTab({ id, name, method, url, requestId, isModified: false })
  │
  └─ 5. UI 切换到 RequestPanel

用户保存编辑 → persistCollection
  │
  ├─ 1. 计算 dirtyFields hash
  ├─ 2. invoke("save_collection", { collection: CollectionFile })
  │     ├─ Rust: validate_path_within_app_data() — 路径校验
  │     ├─ Rust: 写入 {app_data}/collections/{id}/collection.json
  │     └─ Rust: 创建 .bak 备份
  └─ 3. setTabModified(tabId, false)
```

### 1.4 环境切换序列

```
用户切换环境 → EnvSelector
  │
  ├─ 1. EnvironmentStore.setActiveEnvironment(envId)
  │
  ├─ 2. invoke("get_environment", { environmentId }) → EnvironmentFile
  │     └─ variablesToRecord(variables) → Record<string, string>
  │
  ├─ 3. 所有打开的 Tab: 变量重新解析
  │     ├─ UrlInput → VariableHighlightOverlay 重新渲染
  │     └─ 未发送请求的 URL 保持 {{var}} 原样
  │
  └─ 4. 性能埋点: measureSync("env-switch")
```

---

## 2. 并发规范

### 2.1 SQLite 操作并发

**核心约束**: `rusqlite::Connection` 未实现 `Send`，必须在 `spawn_blocking` 中执行。

```rust
// ✅ 正确方式
tokio::task::spawn_blocking(|| {
    let conn = storage.conn.lock().unwrap();
    conn.execute("INSERT INTO history ...", [...])?;
}).await

// ❌ 错误方式 (编译错误)
let conn = storage.conn.lock().unwrap();
conn.execute(...); // Connection 不是 Send，不能在 async 中持有
```

| 操作 | 阻塞方式 | 最大并发 |
|------|---------|---------|
| History 写入 | spawn_blocking | 1 (Mutex lock) |
| History 查询 | spawn_blocking | 1 (Mutex lock) |
| Cookie 写入 | spawn_blocking | 1 |
| Cookie 查询 | spawn_blocking | 1 |
| Settings 读写 | spawn_blocking | 1 |

**Mutex 竞争处理**: SQLite 操作全部串行化。高并发场景下（如 Collection Runner 多迭代），写操作排队等待。预期延迟 < 5ms per operation。

### 2.2 HTTP 请求并发

| 资源 | 类型 | 最大并发 |
|------|------|---------|
| CancellationToken map | Arc<RwLock<HashMap>> | 无限 (读写锁) |
| reqwest Client | Arc 共享 | 无限 (内部连接池) |
| 单个 Tab 请求 | 1 个 | 同时只能有 1 个进行中请求 |
| 多 Tab 请求 | 每个 Tab 独立 | 每个 Tab 1 个，总并发受系统限制 |

**取消机制**: 每个请求注册 `CancellationToken`，存储在 `HttpClientState.cancellation_tokens` 中。取消时调用 `token.cancel()`，reqwest 请求立即中断。

### 2.3 文件系统并发

| 操作 | 方式 | 约束 |
|------|------|------|
| 集合保存 | invoke write_file | 路径校验 + .bak 备份 |
| 集合读取 | invoke read_file | 路径校验 |
| 环境保存 | invoke write_file | 路径校验 + .bak 备份 |
| 环境读取 | invoke read_file | 路径校验 |

**文件锁**: Tauri 文件操作无内置锁。同一集合同时写入时可能数据丢失。缓解策略：
- 前端: 同一集合的保存操作排队（debounce 300ms）
- Rust: 保存前创建 `.bak` 备份

### 2.4 WebView → Rust IPC 并发

Tauri IPC 是单线程序列化的。多个 `invoke()` 同时调用时：
- 前端可以并行发起多个 invoke
- Rust 侧按 tokio async 任务调度执行
- 无锁竞争（每个 command 独立处理）

---

## 3. 资源约束

### 3.1 内存约束

| 资源 | 限制 | 超限行为 |
|------|------|---------|
| WebView (前端) | 空闲 < 150MB, 工作 < 400MB | 1MB+ JSON 响应使用虚拟滚动 |
| Rust 后端 | < 50MB (空闲) | SQLite 连接池限制 1 个 |
| Monaco Editor | 1 个实例 | 切换 Tab 替换 Model，不创建新实例 |
| CodeMirror | 轻量编辑用 | URL/Headers 等场景，< 1MB |
| 响应体存储 | `responses: Record<tabId, HttpResponse>` | 关闭 Tab 时 clearResponse |

**大响应处理策略**:
| 响应大小 | 策略 |
|----------|------|
| < 100KB | 直接渲染，JsonViewer 折叠 |
| 100KB - 1MB | JsonViewer 虚拟滚动 (@tanstack/react-virtual) |
| > 1MB | 分块传输 (http-response-chunk 事件)，流式渲染 |
| > 10MB | 超限提示 + 仅显示前 1MB + Raw 模式下载 |

### 3.2 CPU 约束

| 操作 | CPU 影响 | 缓解 |
|------|---------|------|
| JSON 格式化 | O(n) | 虚拟滚动，仅渲染可视区域 |
| 变量解析 | O(5n) (5 层递归) | 限制递归深度 |
| 脚本执行 | 独立线程 | 5s 超时 (QuickJS) |
| SQLite 查询 | spawn_blocking | 不阻塞 async runtime |

### 3.3 存储约束

| 数据类型 | 存储位置 | 权威 | 详见 |
|----------|---------|------|------|
| Collections | `{app_data}/collections/{id}/collection.json` | File System | 12-状态持久化.md |
| Environments | `{app_data}/environments/{id}.json` | File System | 12-状态持久化.md |
| History | SQLite `app.db` | SQLite | 12-状态持久化.md |
| Cookies | SQLite `app.db` | SQLite | 12-状态持久化.md |
| Settings | SQLite `app.db` + localStorage | SQLite (权威), localStorage (前端缓存) | 08-开发指南.md |
| Vault Secrets | keyring + `{app_data}/vault/` | keyring (权威) | 04c-安全与性能.md |

---

## 4. 降级行为

### 4.1 网络降级

| 条件 | 降级策略 | 用户提示 |
|------|---------|---------|
| DNS 解析失败 | 显示错误 | `NET_DNS_ERROR` Toast |
| TLS 错误 | 显示错误 + 可选跳过验证 | `NET_TLS_ERROR` Toast + "Skip SSL" 按钮 |
| 请求超时 (30s) | 取消请求 | `NET_TIMEOUT` Toast |
| 重定向过多 (>10) | 中止请求 | `NET_REDIRECT_LIMIT` Toast |
| 响应体过大 (>10MB) | 截断显示 | `NET_BODY_TOO_LARGE` Toast + 下载选项 |
| 连接被拒 | 显示错误 | `NET_CONNECT_FAILED` Toast |

### 4.2 存储降级

| 条件 | 降级策略 | 用户提示 |
|------|---------|---------|
| SQLite 损坏 | 从 .bak 恢复 | `STORAGE_READ_FAILED` → 自动恢复 |
| 文件不存在 | 返回空数据 | `STORAGE_NOT_FOUND` → 创建默认 |
| 路径遍历攻击 | 拒绝操作 | `STORAGE_PATH_TRAVERSAL` → Toast 错误 |
| 文件写入失败 | 保持 .bak 备份 | `STORAGE_WRITE_FAILED` → Toast 错误 |

### 4.3 UI 降级

| 条件 | 降级策略 |
|------|---------|
| Monaco 加载失败 | 降级到 CodeMirror (轻量编辑) |
| 主题切换闪烁 | CSS transition 0.2s |
| 侧边栏数据加载失败 | 显示空状态 + "Retry" 按钮 |
| 响应渲染超时 (>500ms) | 显示 "Large response" 提示 + 虚拟滚动 |

### 4.4 脚本引擎降级

| 条件 | 降级策略 | 用户提示 |
|------|---------|---------|
| 脚本超时 (>5s) | 强制终止 | `SCRIPT_TIMEOUT` Toast |
| 内存超限 | 强制终止 | `SCRIPT_MEMORY_LIMIT` Toast |
| 脚本语法错误 | 显示错误详情 | `SCRIPT_ERROR` Console 输出 |

---

## 5. 性能基准

### 5.1 关键操作性能目标

| 操作 | 目标 (ms) | 测量方式 | 降级阈值 |
|------|----------|---------|---------|
| 冷启动 | < 2000 | Tauri app.ready - 进程启动 | 3000 |
| 热启动 (主题切换) | < 200 | React re-render | 500 |
| HTTP 请求发送 (点击 → IPC) | < 50 | performance.now() | 100 |
| 响应渲染 (1KB JSON) | < 100 | useEffect timing | 200 |
| 响应渲染 (1MB JSON) | < 500 | useEffect timing | 1000 |
| 集合树加载 (100 items) | < 100 | performance.now() | 200 |
| 环境切换 | < 200 | measureSync | 500 |
| 侧边栏展开/折叠 | < 200 | CSS transition | 300 |
| 命令面板打开 | < 150 | CSS transition | 300 |
| 变量解析 (10 变量) | < 10 | measureSync | 50 |
| SQLite 查询 (1000 条历史) | < 50 | spawn_blocking timing | 100 |

### 5.2 内存基准

| 场景 | 目标内存 | 测量方式 | 警告阈值 |
|------|---------|---------|---------|
| 空闲 (无 Tab) | < 150MB | performance.memory | 200MB |
| 1 个 Tab + 小响应 | < 200MB | performance.memory | 300MB |
| 5 个 Tab + 大响应 | < 400MB | performance.memory | 500MB |
| Collection Runner (10 迭代) | < 500MB | Rust heap + WebView | 700MB |

### 5.3 性能埋点实现

```typescript
// packages/core/src/performance/index.ts
const marks = new Map<string, PerformanceMark>();

export interface PerformanceMark {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, string>;
}

export function markStart(name: string, metadata?: Record<string, string>) {
  marks.set(name, { name, startTime: performance.now(), metadata });
}

export function markEnd(name: string, metadata?: Record<string, string>) {
  const mark = marks.get(name);
  if (mark) {
    mark.endTime = performance.now();
    mark.duration = mark.endTime - mark.startTime;
    if (metadata) mark.metadata = { ...mark.metadata, ...metadata };
    if (import.meta.env.DEV) {
      console.debug(`[perf] ${name}: ${mark.duration.toFixed(1)}ms`);
    }
  }
}
```

---

## 6. Tauri 生命周期约束

### 6.1 应用窗口

```json
// tauri.conf.json
{
  "width": 1440, "height": 900,
  "minWidth": 1024, "minHeight": 640
}
```

| 约束 | 值 | 影响 |
|------|------|------|
| 最小窗口宽度 | 1024px | 侧边栏 220px + 工作区 804px |
| 最小窗口高度 | 640px | URL栏 44px + 工作区 596px |
| 默认窗口 | 1440×900 | 居中显示 |
| 窗口操作 | minimize/maximize/unmaximize/close | capabilities/default.json |

### 6.2 进程生命周期

```
Tauri Main Process
  ├─ setup() — 初始化 AppState
  ├─ on_window_event(CloseRequested) — 保存状态
  ├─ beforeDevCommand — pnpm dev (启动 Vite)
  └─ beforeBuildCommand — pnpm build (构建前端)
```

---

## 7. 安全运行时约束

### 7.1 路径校验

所有文件操作 Command 必须调用 `validate_path_within_app_data()`：

```rust
fn validate_path_within_app_data(app: &AppHandle, path: &str) -> Result<PathBuf, AppError> {
    let app_data = app.path().app_data_dir()?;
    let canonical = PathBuf::from(path).canonicalize()?;
    if !canonical.starts_with(&app_data) {
        return AppError::storage_path_traversal(path);
    }
    Ok(canonical)
}
```

### 7.2 CSP 运行时约束

```
default-src 'self'
script-src 'self'
style-src 'self' 'unsafe-inline'
connect-src 'self' https://api.openai.com
img-src 'self' data: asset: https://asset.localhost
font-src 'self' data:
```

**运行时影响**:
- 前端不能 fetch() 外部 URL → 所有网络请求走 Rust invoke
- AI 模块可直接 fetch OpenAI（connect-src 允许）
- 不允许 inline script (安全)

### 7.3 密钥不离开 Rust

| 操作 | Rust 侧 | 前端侧 |
|------|---------|--------|
| Vault 解锁 | argon2 KDF + aes-gcm 解密 | invoke unlock_vault → 仅返回成功/失败 |
| Vault 加密 | argon2 KDF + aes-gcm 加密 | invoke encrypt_vault_secret → 仅传 plaintext |
| 密钥存储 | keyring (系统密钥链) | 前端不接触密钥 |
| 密钥读取 | keyring → 解密 | invoke decrypt_vault_secret → 返回 plaintext（不返回密钥） |

---

*文档版本: v1.0*
*创建时间: 2026-05-03*
*最后更新: 2026-05-03*