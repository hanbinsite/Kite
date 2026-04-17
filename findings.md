# Findings & Decisions

## Requirements
- 实现一个类似 Postman 的现代化 API 客户端
- UI 现代化设计，超越 Postman 的 UI 体验
- 功能齐全，不输 Postman 核心功能
- 输出完整的设计和技术文档作为开发标准

## Research Findings

### Postman v12 UI 布局结构
- **Header**: 返回/前进导航、Home、Workspaces切换、搜索(⌘+K)、人员头像、邀请、通知、设置
- **Sidebar(左侧)**: 四个Tab - Items, Services, History, Local Files
  - Items: Collections, Environments, Specs, SDKs, Flows
  - 可自定义侧边栏面板
  - 搜索栏 + 新建按钮(+)
- **Workbench(主工作区)**:
  - Tabs: 多标签页管理，支持拖拽排序、搜索、预览模式(斜体)
  - 环境选择器 + 变量面板(右上角)
- **Right Sidebar(右侧)**: AI、Variables、PRs、Forks、Info、SDKs、Comments、Code、Changelog 等
- **Footer**: Console、Terminal、Git分支、Capture、Tools(Runner/Proxy/Cookies/Find&Replace/Trash)、Globals、Vault、Layout管理

### Postman 请求构建器
- 方法选择器: GET/POST/PUT/PATCH/DELETE + 自定义方法
- URL栏: 自动补全、变量高亮、历史建议
- Tab面板: Params, Headers, Body, Auth, Pre-request Script, Tests
- Body类型: none, form-data(file支持), x-www-form-urlencoded, raw(Text/JS/JSON/HTML/XML), binary, GraphQL
- JSON body支持注释(自动剥离)
- Bulk Edit模式

### Postman 响应查看器
- 状态码(悬停显示描述)、响应时间(毫秒+事件时间线)、响应大小(body+header拆分)
- Body: JSON/XML/HTML/JS/Raw/Base64/Hex 模式切换
- Preview: 音频/视频/脚本/图像/嵌入，JSON/XML显示为表格
- Search(⌘+F)、Filter(JSONPath/XPath，自动补全+错误提示)
- Visualize: 自定义可视化代码 + AI生成可视化
- Headers、Cookies、Test Results 标签
- SSE(Server-Sent Events)支持
- 保存响应为Example或文件
- 网络信息(本地/远程IP、HTTP版本、证书验证)

### Postman 认证类型
- No Auth, API Key, Bearer Token, JWT Bearer, Basic Auth
- OAuth 1.0, OAuth 2.0, AWS Signature, Hawk, NTLM, Akamai EdgeGrid, Digest Auth

### Postman 变量系统
- Global/Environment/Collection/Data/Local 变量
- 动态变量: {{$guid}}, {{$timestamp}}, {{$randomInt}} 等
- Postman Vault (本地敏感数据存储)
- 变量作用域优先级: Global < Collection < Environment < Data < Local

### Postman 多协议支持
- HTTP (REST), GraphQL, gRPC, WebSocket, MQTT, SSE, Socket.IO, AI Requests

### Postman AI 功能 (Agent Mode)
- 自然语言操作API、AI生成测试/文档/可视化
- MCP Server集成、AI Agent Builder、auto-run模式

### 竞品分析

| 竞品 | 技术栈 | 优势 | 劣势 |
|------|--------|------|------|
| Insomnia (Kong) | Electron | 开源、MCP Client、AI | 社区较小 |
| Hoppscotch | Vue.js (Web) | 无需安装、开源 | 桌面功能受限 |
| Bruno | Electron + Next.js | Git-native、本地安全 | 功能较基础 |

## Technical Decisions

| Decision | Rationale |
|----------|-----------|
| Tauri + React + TypeScript | 包体小、性能高、安全，Rust 后端处理所有网络请求 |
| 本地优先 + 可选云同步 | 兼顾Bruno的本地安全和Postman的协作能力 |
| 文件系统集合存储 | Git 友好、版本控制 |
| Monorepo (pnpm workspace) | 统一管理前端、后端、共享代码 |
| AuthConfig 外部标签 serde | 避免 untagged 反序列化歧义 |
| argon2 + aes-gcm 替代 sodiumoxide | OWASP/NIST 推荐，更现代更安全 |
| 文档拆分（04→3子文档, 07→3子文档） | 避免 AI 上下文溢出 |
| 本地字体打包（woff2） | 零 FOUC、离线可用 |

## Document Optimization Log (2026-04-16/17)

| 优化项 | 修复数 | 状态 |
|--------|--------|------|
| AuthConfig serde 标签策略 | 03+08 两文件 | ✅ |
| sodiumoxide → argon2+aes-gcm | 6 文件 | ✅ |
| data-testid 补充 | 08 (组件表+页面级清单) | ✅ |
| 04 拆分为 04a/04b/04c | 1→3 | ✅ |
| 07 拆分为 07a/07b/07c | 1→3 | ✅ |
| 字体打包策略 | 08 新增 §2.6b | ✅ |
| CI 类型同步工作流 | 08 扩展 §7.2 | ✅ |
| Phase 2/3 依赖和引用修复 | 10+11 两文件 | ✅ |
| Phase 1 文档引用更新 | 09 | ✅ |
| REMAINING_ISSUES 13项修复 | 全部13项 | ✅ |
| currentResponse → responses[tabId] | 08/09/12 | ✅ |
| REMAINING_ISSUES第二批9项修复 | 全部9项 | ✅ |
| 新增 14-Phase2b协议支持任务清单 | 15个原子任务 | ✅ |
| 07b删除重复§3-§4 | 3972行→精简为1480行 | ✅ |
| 07c新增§12 Collection Runner视觉规范 | 像素级CSS | ✅ |
| 07b新增§2.20 SSE面板视觉规范 | 布局+CSS+状态矩阵 | ✅ |
| 08 §5新增19个补充组件含data-testid | Phase2/3组件全覆盖 | ✅ |
| 08 §3补充MQTT/Mock/SSE Rust structs | ts-rs导出类型 | ✅ |

## Resources
- Postman: https://www.postman.com
- Insomnia: https://insomnia.rest
- Hoppscotch: https://hoppscotch.io
- Bruno: https://www.usebruno.com