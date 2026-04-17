# Phase 2b 任务清单 — 协议支持（与 Phase 2 并行，2 周）

> 本文档补充 Phase 2/3 中缺失的多协议 UI 任务。gRPC/WebSocket/MQTT/SSE/Mock 的 Rust 后端已在 Phase 1 实现（04a §3），此阶段聚焦前端 UI 和端到端联调。

---

## Sprint 总览

| Sprint | 时间 | 任务数 | 总工时 | 核心目标 |
|--------|------|--------|--------|----------|
| Week 1 | Day 1-5 | 8 | 40h | gRPC + WebSocket UI 面板 |
| Week 2 | Day 6-10 | 7 | 36h | SSE + MQTT + Mock UI 面板 |

---

## Week 1: gRPC + WebSocket（Day 1-5）

### 2b.01 — gRPC 面板 UI 组件
- **依赖**：Phase 1 完成（Rust grpc command 已实现）
- **工时**：6h
- **验收标准**：
  - 侧边栏 COLLECTIONS 区域新增 "gRPC Request" 类型项（紫色标签）
  - GrpcPanel 组件渲染：服务名输入 + 方法选择下拉 + 请求消息 JSON 编辑器 + Metadata KV 编辑器
  - Proto 文件路径输入框 + "Parse Proto" 按钮
  - 响应面板显示 gRPC 响应（JSON 格式化）
  - 支持 Unary 调用模式
- **关键文件**：`apps/desktop/src/components/protocol/GrpcPanel.tsx`, `packages/core/src/grpc/client.ts`
- **关联文档**：03-功能设计.md §8; 04a-架构设计.md §3.1; 07c-侧边栏与命令面板视觉规范.md §4

### 2b.02 — gRPC Proto 文件解析 UI
- **依赖**：2b.01
- **工时**：4h
- **验收标准**：
  - 点击 "Parse Proto" 按钮，前端 invoke parse_proto_file
  - 解析成功后自动填充服务名下拉和方法下拉
  - 解析失败显示错误提示（AppError::ImportParseError）
- **关键文件**：`apps/desktop/src/components/protocol/ProtoSelector.tsx`
- **关联文档**：03-功能设计.md §8.4; 04b-API设计.md §5.1

### 2b.03 — gRPC 端到端联调
- **依赖**：2b.01, 2b.02
- **工时**：6h
- **验收标准**：
  - 输入 proto 文件路径，解析得到服务和方法列表
  - 选择方法、编辑请求消息 JSON，点击发送
  - Rust 后端通过 tonic 发出 gRPC 请求
  - 响应面板正确显示 JSON 格式化响应
  - 错误处理：连接失败、解析错误等按 AppError 分类展示
- **关键文件**：`packages/core/src/grpc/client.ts`, `apps/desktop/src/stores/grpc-store.ts`
- **关联文档**：04a-架构设计.md §3.1; 08-开发指南.md §3

### 2b.04 — WebSocket 面板 UI 组件
- **依赖**：Phase 1 完成（Rust ws_connect/ws_send/ws_close 已实现）
- **工时**：6h
- **验收标准**：
  - 侧边栏新增 "WebSocket" 类型项（蓝色标签）
  - WebSocketPanel 组件渲染：URL 输入 + Connect/Disconnect 按钮 + 消息输入框 + 发送按钮
  - 消息历史区：时间戳 + 方向箭头（↑发送/↓接收）+ 消息内容
  - 支持文本和二进制消息发送
  - 连接状态指示器：绿点=已连接/灰点=断开/红点=错误
- **关键文件**：`apps/desktop/src/components/protocol/WebSocketPanel.tsx`, `packages/core/src/websocket/client.ts`
- **关联文档**：03-功能设计.md §9; 07c-侧边栏与命令面板视觉规范.md §4

### 2b.05 — WebSocket 事件监听与消息显示
- **依赖**：2b.04
- **工时**：4h
- **验收标准**：
  - 前端通过 listen('ws-message') 接收消息，追加到消息历史
  - 前端通过 listen('ws-error') 和 listen('ws-close') 处理异常
  - 消息历史按时间排序，最新消息在底部（自动滚动）
  - 超过 500 条消息时自动截断顶部旧消息
- **关键文件**：`apps/desktop/src/stores/websocket-store.ts`
- **关联文档**：08-开发指南.md §4; 04b-API设计.md §5.3

### 2b.06 — WebSocket 端到端联调
- **依赖**：2b.04, 2b.05
- **工时**：4h
- **验收标准**：
  - 输入 ws://echo.websocket.org 地址，点击 Connect
  - 连接成功后状态指示器变为绿点
  - 发送文本消息，收到回显消息
  - 点击 Disconnect，状态变为灰点
  - 错误场景：URL 无效、连接拒绝等按 AppError 分类展示
- **关键文件**：`packages/core/src/websocket/client.ts`
- **关联文档**：04a-架构设计.md §3; 08-开发指南.md §4

### 2b.07 — gRPC Server Streaming 支持
- **依赖**：2b.03
- **工时**：4h
- **验收标准**：
  - 支持 Server Streaming 模式选择
  - 流式响应逐条追加到响应面板
  - 流式响应完成时显示 "[Stream Complete]" 标记
- **关键文件**：`apps/desktop/src/components/protocol/GrpcPanel.tsx`
- **关联文档**：03-功能设计.md §8.3

### 2b.08 — WebSocket Headers/Protocols 配置
- **依赖**：2b.04
- **工时**：6h
- **验收标准**：
  - WebSocket 面板增加 Headers tab（自定义请求头）
  - 增加 Protocols tab（Sec-WebSocket-Protocol 配置）
  - 连接时携带自定义 Headers 和 Sub-protocols
- **关键文件**：`apps/desktop/src/components/protocol/WsConfigTabs.tsx`
- **关联文档**：03-功能设计.md §9.3

---

## Week 2: SSE + MQTT + Mock（Day 6-10）

### 2b.09 — SSE 面板 UI 组件
- **依赖**：Phase 1 完成（Rust SSE 模块已实现）
- **工时**：4h
- **验收标准**：
  - 侧边栏新增 "SSE" 类型项（青色标签）
  - SsePanel 组件渲染：URL 输入 + Connect/Disconnect 按钮 + 自定义 Headers
  - 事件历史区：event name + data + timestamp 三列
  - 支持 Last-Event-ID 恢复连接
- **关键文件**：`apps/desktop/src/components/protocol/SsePanel.tsx`
- **关联文档**：03-功能设计.md §10/§25; 07c-侧边栏与命令面板视觉规范.md §4

### 2b.10 — SSE 事件监听与显示
- **依赖**：2b.09
- **工时**：4h
- **验收标准**：
  - 前端通过 listen('sse-event') 接收事件
  - 前端通过 listen('sse-error') 处理连接错误
  - 事件按时间排序，最新事件在底部
  - 超过 200 条事件时自动截断
- **关键文件**：`apps/desktop/src/stores/sse-store.ts`
- **关联文档**：04b-API设计.md §5.3; 08-开发指南.md §4

### 2b.11 — SSE 端到端联调
- **依赖**：2b.09, 2b.10
- **工时**：4h
- **验收标准**：
  - 输入 SSE endpoint URL，点击 Connect
  - 实时接收事件并在面板中显示
  - Disconnect 时关闭连接
  - 重连机制：自动携带 Last-Event-ID
- **关键文件**：`packages/core/src/sse/client.ts`
- **关联文档**：04a-架构设计.md §3.5; 08-开发指南.md §3

### 2b.12 — MQTT 面板 UI 组件
- **依赖**：Phase 1 完成（Rust MQTT command 已实现）
- **工时**：6h
- **验收标准**：
  - 侧边栏新增 "MQTT" 类型项（橙色标签）
  - MqttPanel 组件渲染：Broker URL + Port + Topic + QoS 选择 + Message 编辑器
  - 支持 Publish 和 Subscribe 模式切换
  - 订阅消息历史区：Topic + Payload + QoS + Timestamp
  - 连接配置：Client ID + Username + Password + Clean Session
- **关键文件**：`apps/desktop/src/components/protocol/MqttPanel.tsx`
- **关联文档**：03-功能设计.md §11; 07c-侧边栏与命令面板视觉规范.md §4

### 2b.13 — MQTT 端到端联调
- **依赖**：2b.12
- **工时**：4h
- **验收标准**：
  - 输入 MQTT broker 地址，点击 Connect
  - Subscribe 成功后收到消息显示在历史区
  - Publish 消息后对方收到确认
  - Disconnect 正常关闭连接
- **关键文件**：`packages/core/src/mqtt/client.ts`
- **关联文档**：04a-架构设计.md §3; 08-开发指南.md §3

### 2b.14 — Mock Server UI 配置面板
- **依赖**：Phase 1 完成（Rust mock 模块已实现）
- **工时**：4h
- **验收标准**：
  - Settings 页新增 "Mock Server" 入口
  - Mock 配置面板：Port 输入 + Route 列表编辑器
  - 每个 Route 编辑：Method + Path + Status + Headers + Body + Delay
  - "Start Mock" 按钮 → Rust 启动 Mock Server → 显示端口和状态
  - "Stop Mock" 按钮 → Rust 停止 Mock Server
  - Mock Server 运行状态指示器
- **关键文件**：`apps/desktop/src/components/settings/MockConfigPanel.tsx`
- **关联文档**：03-功能设计.md §13; 07c-侧边栏与命令面板视觉规范.md §7

### 2b.15 — Cookie Jar 管理 UI
- **依赖**：Phase 1 完成（Rust cookie_jar 已实现）
- **工时**：4h
- **验收标准**：
  - Console 面板新增 "Cookies" tab
  - 显示所有 Cookie 列表：Name + Value + Domain + Path + Expires
  - 支持手动添加/编辑/删除 Cookie
  - "Clear All" 按钮清空 Cookie Jar
  - 过期 Cookie 自动标记灰色 + 删除线
- **关键文件**：`apps/desktop/src/components/drawers/CookieManager.tsx`
- **关联文档**：03-功能设计.md §20; 07c-侧边栏与命令面板视觉规范.md §6

---

## 任务依赖关系图

```
Week 1
2b.01 ── 2b.02 ── 2b.03 ── 2b.07
2b.04 ── 2b.05 ── 2b.06
                  2b.04 ── 2b.08

Week 2
2b.09 ── 2b.10 ── 2b.11
2b.12 ── 2b.13
2b.14
2b.15
```

---

*文档版本: v1.0*
*创建时间: 2026-04-17*
*基于: 03-功能设计.md §8-§11/§13/§20/§25; 04a-架构设计.md §3; 04b-API设计.md §5*