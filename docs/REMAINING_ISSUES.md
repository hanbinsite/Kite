# 待优化问题清单

> 发现时间：2026-04-16（修复26项文档缺陷后）
> 更新时间：2026-04-17（第二批修复：审计发现的9项阻断问题）

## 第一批13项 — 全部已修复 ✅（2026-04-16/17）

1. 04b duplicate send_http_request ✅
2. init_app_state 缺 cookie_jar ✅
3. 04a 重复标题 ✅
4. WssErrorPayload typo ✅
5. currentResponse → responses[tabId] ✅
6. §3.x编号跳跃 ✅
7. §4.5 → §6.x ✅
8. Storage/AppState重叠 ✅
9. 架构图sodium残留 ✅
10. .eslintrc.js → eslint.config.js ✅
11. 06深度分析保留 ✅
12. README验证 ✅
13. futures-util补充 ✅

---

## 第二批9项 — 全部已修复 ✅（2026-04-17 审计）

### HIGH-1: gRPC/WS/MQTT/Mock/SSE 无任务覆盖 ✅
- 新增 14-Phase2b协议支持任务清单.md（15个原子任务）
- 覆盖：gRPC面板(3任务)、WebSocket面板(3任务)、SSE面板(3任务)、MQTT面板(2任务)、Mock配置(1任务)、Cookie管理(1任务)

### HIGH-2: Collection Runner 无像素级视觉规范 ✅
- 在 07c-侧边栏与命令面板视觉规范.md 新增 §12（布局图 + CSS + 状态矩阵）

### HIGH-3: 08 §5 组件清单缺失 12+ 组件 ✅
- 在 08-开发指南.md 新增 §5.0b Phase 2/3 补充组件表（19个组件含 data-testid）
- 覆盖：EnvSelector, GraphQLEditor, UrlEncodedEditor, ScriptEditor, SseTab, RawViewer, HtmlPreview, ResponseError, EnvironmentEditor, CollectionRunner, RunnerResultList, RunnerProgressBar, VaultUnlockDialog, GrpcPanel, WebSocketPanel, MqttPanel, SsePanel, SettingsModal, HistoryDrawer

### HIGH-4: 07b 重复 §3-§4（与 07c 完全重复） ✅
- 删除 07b 中 §3-§4 及后续内容（3972行），仅保留 §2（请求编辑页）
- 07b 从 ~5400 行精简为 ~1480 行

### HIGH-5: task 2.26 引用 07c §2.15（不存在） ✅
- 修正为 07c §12（Collection Runner 视觉规范）

### MED-6: SSE 无像素级视觉规范 ✅
- 在 07b 新增 §2.20 SSE 面板视觉规范（布局图 + CSS + 状态矩阵）

### MED-7: MQTT/Mock/SSE 无 Rust struct 定义 ✅
- 在 08-开发指南.md §3 补充：SseConnectionConfig, SseMessage, MqttRequestConfig, MqttQos, MqttMessage, MockRoute, MockServerConfig

### MED-8: Cookie Jar 管理 UI 无任务 ✅
- 已包含在 14-Phase2b 任务清单 2b.15 中

### LOW: AGENTS.md §7 文档索引未含 14-Phase2b ✅
- 已更新 AGENTS.md 和 README.md 文档索引

---

## 文档集当前状态：可直接用于 AI 驱动开发 ✅

- 03-功能设计.md 22+ 功能模块 → 全部有任务覆盖（09/10/11/14）
- 08-开发指南.md §5 组件清单 → 全部有 data-testid（40+19=59组件）
- 07a/07b/07c 视觉规范 → 全部有像素级 CSS（含 Collection Runner、SSE）
- Rust struct 定义 → 全部有 ts-rs 导出类型（含 MQTT/Mock/SSE）
- 文档间交叉引用 → 全部正确（无 broken refs）

### 仍需注意的项（Phase 4+）：
- AI Agent 模块（03 §16）暂无任务清单，需 Phase 4 补充
- gRPC Server/Client Streaming 模式需在 Phase 2b 后续迭代中完善

*最后更新：2026-04-17*