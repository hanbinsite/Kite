# API Client 开发路线图

> 基于���前进���（67.2% 完成���制定的详细开发规���  
> 生���时间：2026-05-03  
> 参考文���：18-dev-progress.md, 10-Phase2任务清���.md, 14-Phase2b协议���持任务清单.md

---

## 📊 ���前状态

| Phase | ���成率 | 状态 | 优先��� |
|-------|--------|------|--------|
| Phase 1 (���础框���) | 100% | ✅ 完成 | — |
| Phase 2 (核心请求) | 69% | 🔄 ���行中 | 🔥 ��� |
| Phase 2b (多协议) | 0% | ��� 待开始 | 🟡 ��� |
| Phase 3 (高���功能) | 0% | ⏳ ���开始 | 🟢 低 |
| Phase 4 (AI ���块) | 0% | ⏳ 待���始 | 🟢 低 |

**当前焦���**: 完��� Phase 2 剩余 8 个���务（31%）���达到���心 HTTP 功��� 100% 可���。

---

## 🎯 Sprint 1: 完��� Phase 2 ���心功能（1-2 ���）

### 目标
完成 Phase 2 ���余 8 ���任务���实现���整的 HTTP 客户���核心���能。

### 任务清���

#### 🔥 P1: Auth 配���面板���实现（3-4 天）

**P2-01 + P2-07: Auth 配置面��� + Bearer/Basic/API Key**

**Rust ���端**（已���成 ✅）:
- ✅ `http.rs::AuthConfig` 枚举已定���（Bearer/Basic/ApiKey/JWT/OAuth1/OAuth2/AWSv4）
- ✅ `send_http_request` 已支持 auth 参���

**前端���现**（待���成）:
```typescript
// 1. 创建 AuthPanel 组件
apps/desktop/src/components/request/AuthPanel.tsx
- Tab 切换���None / API Key / Bearer / Basic / OAuth 1.0 / OAuth 2.0 / JWT / AWS v4
- 每种���证类���的表���字段
- 使用 Radix UI Tabs + Form

// 2. 更��� RequestPanel
apps/desktop/src/components/workbench/RequestPanel.tsx
- 新增 "Auth" Tab（��� Params/Headers/Body 旁���）
- 集成 AuthPanel ���件

// 3. 更新 RequestStore
apps/desktop/src/stores/request-store.ts
- 添加 auth: AuthConfig 字段
- 实现 setAuth() 方法

// 4. 实现 Auth ���建逻辑
packages/core/src/http/auth-builder.ts
- buildAuthConfig(auth: AuthConfig): IpcAuthConfig
- 转换前端 AuthConfig → Rust IPC 格���
```

**���证标准**:
- [ ] Bearer Token ���证可���（Authorization: Bearer xxx）
- [ ] Basic Auth 可用（base64 编���）
- [ ] API Key 可用（Header/Query 两种���置）
- [ ] UI 表单验���（必���字段提示���
- [ ] 认���配置���保存到���合

**预估时���**: 3-4 天

---

#### 🔥 P2: 错误处理 UI 映射（2 天）

**P2-22: 错误处理 UI 映射**

**已有���础**:
- ✅ Rust `AppError` 枚举���28 种错���码）
- ✅ 错误���复策���文档���13-错误���理.md §11）

**前端实现**:
```typescript
// 1. 创��� Toast 系统
packages/ui/src/components/Toast.tsx
- 使用 Radix UI Toast
- 4 种类型：success / error / warning / info
- 自���消失���可配置时长）
- 支持操作���钮（���试/���看详���）

// 2. 创建错���处理���
packages/core/src/error/error-handler.ts
- handleError(error: AppError): void
- 根据 error.code 映射��� UI 提示
- 实��� 13-错���处理.md §11 的恢���策略

// 3. 错误���映射表
packages/core/src/error/error-messages.ts
- ERROR_MESSAGES: Record<string, { title, message, action }>
- 28 种错���码的���户友好提示

// 4. ���成到 HTTP 调用
packages/core/src/http/index.ts
- try-catch 包��� invoke('send_http_request')
- 调用 handleError() 显示 Toast
```

**错误���优先级**（先实���高频���误）:
1. `NetworkError` ��� "网���连接���败，正在重试..."（自动���试 3 次���
2. `TimeoutError` ��� "请求超时���请检���网络���增加���时时���"
3. `ValidationError` → "请求参数���误：{detail}"（高���错误字段���
4. `AuthenticationError` → "���证失败，���检查凭���"
5. `StorageError` → "保存���败，数据���缓存���内存"

**验证标准**:
- [ ] 网络错���显示 Toast + 自动重试
- [ ] ���时错误显��� Toast + 可手���重试
- [ ] 验证错误高亮���误字���
- [ ] Toast 可手动���闭
- [ ] Toast 支持"查看���情"（显���完整���误栈）

**预估���间**: 2 天

---

#### 🟡 P3: FormData 编���器（2-3 天���

**P2-03: Body 编辑��� (form-data)**

**Rust 后端**（已���成 ✅）:
- ✅ `http.rs::BodyConfig::formdata` 已定���
- ��� `FormDataParam` 支��� text/file 类型

**前端���现**:
```typescript
// 1. 创��� FormDataEditor 组件
apps/desktop/src/components/request/FormDataEditor.tsx
- Grid 布局���Key / Type (text/file) / Value / Description / Enabled
- Type 切换：Dropdown (text/file)
- File 类���：文���选择器（Tauri dialog API）
- 支持���拽排���（dnd-kit���

// 2. 文���选择���辑
- 使用 @tauri-apps/plugin-dialog ��� open()
- 显示���件名 + 大小
- 支���清除文件

// 3. 更��� RequestPanel
apps/desktop/src/components/workbench/RequestPanel.tsx
- Body Tab ��� mode="form-data" 时渲染 FormDataEditor
```

**UI 设计**:
```
┌───���───���──���────���──���──���────���───���──���──────���───���──���─────���──���────┐
│ Key          │ Type   │ Value              │ Description │ ✓ │
├─���─────���──���────���───���──���──────���──���────���──���──���──���──���────���────���─┤
│ username     ��� text   │ john_doe           ���             ��� ✓ ���
│ avatar       │ file   │ 📄 avatar.png (2MB)│             │ ✓ │
│ description  │ text   │ User bio...        │             │ ✓ │
└──���────���──���──���─────���────���──���───���──���────���───���────���──���───���──���──┘
```

**验���标准**:
- [ ] 可添加/删除 form-data 字段
- [ ] Type 可���换 text/file
- [ ] File 类型可选���文件���显示文���名和大���）
- [ ] 可���用单���字段
- [ ] ���拖拽排序
- [ ] 发送���求时���确构��� multipart/form-data

**预估时���**: 2-3 天

---

#### ���� P4: 其��� Body 编辑���（1-2 天）

**P2-05: Body 编辑器 (binary)**
```typescript
// apps/desktop/src/components/request/BinaryEditor.tsx
- 文件���择器���单文件）
- 显示文件���息（���称/大小/���型）
- 支���清除
```

**P2-06: Body 编���器 (GraphQL)**
```typescript
// apps/desktop/src/components/request/GraphQLEditor.tsx
- Query 编���器（CodeMirror GraphQL mode���
- Variables 编���器（JSON）
- ���用 SplitPane 上下分���
```

**验证���准**:
- [ ] Binary 可选择文���并发送
- [ ] GraphQL Query 有语���高亮
- [ ] GraphQL Variables 支持 JSON 编辑

**预���时间**: 1-2 天

---

#### ���� P5: 复杂认证���现（2-3 天）

**P2-08: Auth 实��� (OAuth1/OAuth2/JWT/AWSv4)**

**Rust 后端**（已定义 ���）:
- ✅ `OAuth1Auth` / `OAuth2Auth` / `JWTAuth` / `AWSV4Auth` 结构���已定义

**前端实现**:
```typescript
// 1. OAuth 2.0 面板
apps/desktop/src/components/request/auth/OAuth2Panel.tsx
- Grant Type: Authorization Code / Client Credentials / Password / Implicit
- Access Token URL / Auth URL / Client ID / Client Secret
- Scope / State
- "Get New Access Token" 按钮���打开浏览���授权）

// 2. JWT 面板
apps/desktop/src/components/request/auth/JWTPanel.tsx
- Algorithm 选择���HS256/RS256/ES256...）
- Payload (JSON 编辑���)
- Secret / Private Key
- Header Prefix (默认 "Bearer")

// 3. AWS Signature v4 面板
apps/desktop/src/components/request/auth/AWSv4Panel.tsx
- Access Key / Secret Key
- Region / Service
- Session Token (可���)
```

**OAuth 2.0 流程**:
1. 用���点击 "Get New Access Token"
2. 前端调��� Rust Command `oauth_authorize(config)`
3. Rust 打开系���浏览器 → 授权���面
4. 回���到本���服务器（localhost:8080/callback）
5. Rust 获��� code → 交换 access_token
6. ���回 token 给前��� → ���动填充到 Access Token 字段

**验证标准**:
- [ ] OAuth 2.0 Authorization Code ���程可用
- [ ] JWT 可���成并发���
- [ ] AWS v4 签名���用（���试 AWS API）

**预估���间**: 2-3 ���

---

#### 🟢 P6: 其他 Phase 2 任务���1-2 天）

**P2-10: ���响应流���渲染**
```typescript
// 监听 Tauri 事件 'http-response-chunk'
// 逐步���染响���体（���免大响应卡顿）
```

**P2-23: Save/Don't Save 对话框**
```typescript
// 检测请求���否修���（dirty 标���）
// 切换 Tab 时弹���对话���
```

**P2-24: 请求自动���存**
```typescript
// debounce 500ms 自动���存到集合
```

**P2-25: Console ���志**
```typescript
// 显示���本执���日志���Phase 3 脚本引���后实现）
```

**验���标准**:
- [ ] 大���应（>10MB）���卡顿
- [ ] ���换 Tab 时提示保���
- [ ] 请求自���保存���500ms debounce）

**���估时���**: 1-2 天

---

### Sprint 1 总结

**总预���时间**: 12-17 天（��� 2-3 ���）

**完成后状���**:
- Phase 2: 26/26 (100%) ✅
- 核心 HTTP 功能完���可用
- ���持 8 ���认证方���
- 完善的���误处���
- 完整的 Body 编辑器（JSON/Form-data/Binary/GraphQL）

---

## 🚀 Sprint 2: 多协���支持 - gRPC���2-3 周���

### 目���
实现 gRPC 客���端，支��� Unary 和 Streaming 调用���

### 技术栈
- **Rust**: `tonic` (gRPC 客户���) + `prost` (Protobuf 编���码)
- **前端**: Proto 文件解析 + 动态���单生成

### 任务清���

#### 🔥 P1: gRPC 基础���构（3-4 天）

**Rust ���端**:
```rust
// 1. 添加���赖
// Cargo.toml
tonic = "0.12"
prost = "0.13"
prost-types = "0.13"

// 2. 创建 gRPC 模块
// src-tauri/src/commands/grpc.rs
#[tauri::command]
async fn grpc_unary_call(
    endpoint: String,
    service: String,
    method: String,
    request: serde_json::Value,
    metadata: Vec<(String, String)>,
) -> Result<GrpcResponse, AppError> {
    // 使用 tonic ���送 Unary 请求
}

#[tauri::command]
async fn grpc_server_streaming(
    endpoint: String,
    service: String,
    method: String,
    request: serde_json::Value,
) -> Result<(), AppError> {
    // 使用 tonic 接收 Server Streaming
    // 通��� Tauri 事件 'grpc-stream-message' 发送每条���息
}

// 3. Proto 文件解���
#[tauri::command]
async fn parse_proto_file(
    file_path: String,
) -> Result<ProtoDescriptor, AppError> {
    // 使��� prost-reflect ���析 .proto 文件
    // 返回 services / messages / enums ���义
}
```

**���端实现**:
```typescript
// 1. gRPC Store
apps/desktop/src/stores/grpc-store.ts
- protoFiles: ProtoFile[]
- services: GrpcService[]
- activeEndpoint: string

// 2. gRPC 请���面板
apps/desktop/src/components/grpc/GrpcRequestPanel.tsx
- Endpoint ���入
- Service / Method ���择（���拉）
- Request Body (JSON 编辑���，根��� Proto 生成表单)
- Metadata (类似 Headers)
```

**验证���准**:
- [ ] 可解析 .proto 文件
- [ ] ���发送 Unary 请求
- [ ] 可���收响���并显示

**���估时间**: 3-4 天

---

#### 🟡 P2: gRPC Streaming 支持���2-3 天）

**Rust 后端**:
```rust
// src-tauri/src/commands/grpc.rs
#[tauri::command]
async fn grpc_client_streaming(...) -> Result<GrpcResponse, AppError> {
    // Client Streaming
}

#[tauri::command]
async fn grpc_bidirectional_streaming(...) -> Result<(), AppError> {
    // Bidirectional Streaming
}
```

**前端实现**:
```typescript
// apps/desktop/src/components/grpc/GrpcStreamPanel.tsx
- 显示流式���息列���
- 支���发送���条消息（Client Streaming）
- 实时���收消���（Server Streaming）
```

**验���标准**:
- [ ] Server Streaming 可用
- [ ] Client Streaming 可用
- [ ] Bidirectional Streaming 可用

**预估���间**: 2-3 天

---

#### 🟡 P3: gRPC UI 完���（2-3 天���

**功能**:
- Proto 文件���理（导入/删除/刷新���
- Service 浏览器���树形���构）
- Request 自动补全（根据 Proto 定���）
- Response 格���化显���

**预估���间**: 2-3 天

---

### Sprint 2 ���结

**总预估时���**: 7-10 天���约 2 周）

**完成后状���**:
- Phase 2b gRPC: 4/4 (100%) ✅
- ���持 Unary / Server Streaming / Client Streaming / Bidirectional Streaming
- Proto ���件解析���管理

---

## 🌐 Sprint 3: 多协���支持 - WebSocket & SSE（1-2 ���）

### 目标
实现 WebSocket 和 SSE 客户���。

### 任���清单

#### 🔥 P1: WebSocket 客户端（3-4 天���

**Rust 后端**:
```rust
// 添加���赖
tokio-tungstenite = "0.23"

// src-tauri/src/commands/websocket.rs
#[tauri::command]
async fn ws_connect(url: String) -> Result<String, AppError> {
    // 返回 connection_id
}

#[tauri::command]
async fn ws_send(connection_id: String, message: String) -> Result<(), AppError> {
    // 发送���息
}

#[tauri::command]
async fn ws_disconnect(connection_id: String) -> Result<(), AppError> {
    // 断开���接
}

// 事件: 'ws-message' / 'ws-connected' / 'ws-disconnected' / 'ws-error'
```

**前端���现**:
```typescript
// apps/desktop/src/components/websocket/WebSocketPanel.tsx
- URL 输入 + Connect 按钮
- 消���列表���发送/接收���带时���戳）
- 消息输���框 + Send ���钮
- 连���状态���示器（Connected / Disconnected）
```

**验证标���**:
- [ ] 可连��� WebSocket 服���器
- [ ] 可发���/接收消息
- [ ] ���断开���接
- [ ] 显示连���状态

**预估���间**: 3-4 天

---

#### 🟡 P2: SSE ���户端���2 天）

**Rust 后端**:
```rust
// src-tauri/src/commands/sse.rs
#[tauri::command]
async fn sse_connect(url: String) -> Result<String, AppError> {
    // ���用 reqwest EventSource
}

// 事���: 'sse-message'
```

**前端实���**:
```typescript
// apps/desktop/src/components/sse/SSEPanel.tsx
- URL 输��� + Connect 按钮
- ���件流显示（event / data / id）
```

**验证标准**:
- [ ] 可���接 SSE 服务���
- [ ] ���接收���件流
- [ ] 显���事件类型和数���

**���估时间**: 2 天

---

### Sprint 3 总���

**���预估���间**: 5-6 天（约 1 周）

**完成���状态**:
- Phase 2b WebSocket: 3/3 (100%) ✅
- Phase 2b SSE: 2/2 (100%) ✅

---

## 📡 Sprint 4: MQTT & Mock Server（1-2 周）

### 目���
实��� MQTT 客���端和 Mock 服务���。

### 任务���单

#### ���� P1: MQTT 客户端（3-4 天）

**Rust 后端**:
```rust
// ���加依���
rumqttc = "0.24"

// src-tauri/src/commands/mqtt.rs
#[tauri::command]
async fn mqtt_connect(config: MqttConfig) -> Result<String, AppError> {
    // ���接 MQTT Broker
}

#[tauri::command]
async fn mqtt_publish(connection_id: String, topic: String, payload: String) -> Result<(), AppError> {
    // 发���消息
}

#[tauri::command]
async fn mqtt_subscribe(connection_id: String, topic: String) -> Result<(), AppError> {
    // 订���主题
}
```

**前端实���**:
```typescript
// apps/desktop/src/components/mqtt/MqttPanel.tsx
- Broker 配置（Host / Port / Client ID / Username / Password���
- Publish 面���（Topic / QoS / Retain / Payload）
- Subscribe 面板���Topic / QoS）
- 消���列表（���收的���息）
```

**验证标���**:
- [ ] 可连接 MQTT Broker
- [ ] 可���布消���
- [ ] 可订���主题并接���消息

**预估时间**: 3-4 天

---

#### ���� P2: Mock 服���器（3-4 天）

**Rust ���端**:
```rust
// src-tauri/src/mock/server.rs
pub struct MockServer {
    routes: Vec<MockRoute>,
    port: u16,
}

#[tauri::command]
async fn mock_start(port: u16) -> Result<(), AppError> {
    // ���动 Mock 服务器���使用 axum）
}

#[tauri::command]
async fn mock_add_route(route: MockRoute) -> Result<(), AppError> {
    // ���加 Mock 路由
}
```

**前端���现**:
```typescript
// apps/desktop/src/components/mock/MockServerPanel.tsx
- 服务���控制���Start / Stop / Port）
- 路���列表���Method / Path / Response）
- 路由编���器（���加/���辑/删除路由���
```

**验证标准**:
- [ ] 可启��� Mock 服务���
- [ ] 可添���路由���则
- [ ] 可匹���请求并返��� Mock ���应

**预估���间**: 3-4 天

---

### Sprint 4 总结

**总预估时���**: 6-8 天（��� 1-2 ���）

**���成后���态**:
- Phase 2b MQTT: 3/3 (100%) ✅
- Phase 2b Mock: 3/3 (100%) ✅
- **Phase 2b 全���完成！**

---

## ���� Sprint 5: Phase 3 高级���能（4-6 周）

### 优���级排序

1. **脚本���擎**（最高优���级，2 周）
   - Pre-request Script
   - Post-response Script
   - pm 对象���现（使用 rquickjs）

2. **Collection Runner**（1 周）
   - 批量运行集���中的���求
   - 变量传递
   - 测试断言

3. **代���生成**（1 ���）
   - curl / Python / JavaScript / Go / Java
   - 复制到剪���板

4. **导入导���**（1 ���）
   - Postman Collection v2.1
   - OpenAPI 3.0
   - Insomnia

5. **Proxy ���持**（3-5 天）
   - HTTP/HTTPS/SOCKS5 ���理
   - 系���代理���测

6. **其他功���**（1 周）
   - 请求���（Chain Requests）
   - 批量编���
   - 快捷���自定义

---

## ���� Sprint 6: Phase 4 AI 模块（4-6 周）

### 功能���划

1. **AI Provider 集成**（1 ���）
   - OpenAI / Anthropic / Gemini
   - ���地 LLM（Ollama）

2. **���然语言���建请求**（1 周）
   - "Get user by ID from /api/users/:id"
   - ���动生成 Method / URL / Headers / Body

3. **测试脚���生成**（1 ���）
   - 根���响应自动���成断言
   - 生成 Pre/Post Script

4. **MCP Server 支���**（2 周）
   - 集成 Model Context Protocol
   - 作��� MCP Client 调用���部工���

---

## 📅 总体时���线

| Sprint | 内容 | 预估时间 | 累���时间 |
|--------|------|---------|---------|
| Sprint 1 | 完成 Phase 2 | 2-3 周 | 2-3 周 |
| Sprint 2 | gRPC 支持 | 2 周 | 4-5 周 |
| Sprint 3 | WebSocket & SSE | 1 周 | 5-6 ��� |
| Sprint 4 | MQTT & Mock | 1-2 周 | 6-8 周 |
| Sprint 5 | Phase 3 ���级功��� | 4-6 周 | 10-14 周 |
| Sprint 6 | Phase 4 AI 模块 | 4-6 周 | 14-20 周 |

**总预估时���**: 14-20 周（约 3.5-5 个���）

**里程���**:
- ✅ **M1**: Phase 1 完成（���达成）
- ���� **M2**: Phase 2 完成���2-3 周后���→ **���心 HTTP ���户端���用**
- 🎯 **M3**: Phase 2b 完���（6-8 周���）→ **多协议支���完整**
- ���� **M4**: Phase 3 完���（10-14 周���）→ **高级功能���整**
- 🎯 **M5**: Phase 4 ���成（14-20 周后���→ **AI 增���完整**

---

## 🚦 风险���缓解

| ���险 | ���响 | ���率 | 缓解���施 |
|------|------|------|---------|
| gRPC ���态调���复杂度高 | 延期 2-3 周 | 中 | 先实���静态 Proto，后���支持动��� |
| OAuth 2.0 流���调试困��� | 延��� 1 周 | ��� | 使用 Mock OAuth Server 测试 |
| ���本引���安全性问��� | 功能���限 | 低 | 使用 rquickjs 沙箱 + 超���控制 |
| AI 模块���本高 | 功能���限 | 低 | ���先支持本地 LLM（Ollama） |

---

## 📊 资源���配

**当前���队**: 1 开发者 + AI 辅助

**建议**:
- Sprint 1-2: 全职���入（完���核心���能）
- Sprint 3-4: 可���行开发���WebSocket + MQTT）
- Sprint 5-6: 根据���户反馈调���优先���

---

## 🎯 ���一步���动

### 本周（Week 1）
1. ✅ 完���文档���善（���完成）
2. 🔥 开始 P2-01 + P2-07: Auth 配置���板
3. 🔥 ���始 P2-22: 错���处理 UI

### 下周���Week 2���
1. 完��� P2-03: FormData ���辑器
2. 完��� P2-05/P2-06: Binary/GraphQL 编���器
3. 开��� P2-08: ���杂认证���现

### Week 3
1. 完成 Phase 2 剩���任务
2. 发布 v0.2.0（���心 HTTP ���能完���）
3. 开始 Sprint 2: gRPC ���持

---

**路线���版本**: v1.0  
**创建���间**: 2026-05-03  
**下���更新**: 每完���一个 Sprint 后更新
