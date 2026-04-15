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
- No Auth
- API Key (Header/Query Params)
- Bearer Token
- JWT Bearer (HS/RS/ES/PS算法，Payload编辑，Advanced配置)
- Basic Auth
- OAuth 1.0
- OAuth 2.0
- AWS Signature
- Hawk Authentication
- NTLM
- Akamai EdgeGrid
- Digest Auth

### Postman 变量系统
- Global变量 (Footer中快速访问)
- Environment变量 (环境选择器)
- Collection变量
- Data变量
- 动态变量: {{$guid}}, {{$timestamp}}, {{$randomInt}}, {{$randomFullName}} 等
- Postman Vault (本地敏感数据存储)
- 变量作用域优先级: Global < Collection < Environment < Data < Local

### Postman 多协议支持
- HTTP (REST)
- GraphQL (Query/Mutation/Subscription, Schema探索, Autocomplete)
- gRPC (Protobuf服务定义, Unary/Server/Client streaming)
- WebSocket (双向通信, 消息收发)
- MQTT (IoT协议, Broker连接, Topic订阅/发布)
- SSE (Server-Sent Events)
- Socket.IO
- AI Requests (OpenAI兼容模型, MCP Server集成)

### Postman AI 功能 (Agent Mode)
- 自然语言操作API
- AI生成测试脚本
- AI生成文档
- AI生成可视化
- AI请求(交互AI模型)
- MCP Server集成
- AI Agent Builder
- 自动运行模式(auto-run)
- 深度API上下文理解

### Postman Flows
- 可视化API工作流
- 拖拽式画布
- 从集合生成Flow
- AI单提示生成Flow
- 错误处理自动化
- 部署到Postman Cloud

### Postman v12 新特性
- Unified Workbench(统一工作台)
- 本地Mock服务器
- 本地Flows
- 性能测试(负载测试)
- CLI工作流
- 多协议自动化执行
- CI一致工作流
- SDK Generator
- Postman Shared Vault
- API报告
- Private API Monitoring
- 本地秘密保护

### 竞品分析

#### Insomnia (Kong)
- 技术: Electron
- 支持: REST, GraphQL, gRPC, WebSocket, SSE, Socket.IO
- 特点: MCP Client支持、AI能力、插件系统
- 存储: 本地/Git/Cloud三种模式
- 优势: 开源、UI简洁、无需账户即可本地使用
- 劣势: 社区较小、功能不如Postman全面

#### Hoppscotch
- 技术: Web-based (Vue.js)
- 特点: 开源、轻量、实时协作
- 优势: 无需安装、开源、社区活跃
- 劣势: 需浏览器、桌面功能受限

#### Bruno
- 技术: Electron + Next.js
- 特点: Git-native、文件系统集合、纯文本文件
- 优势: 纯本地无云同步、Git协作、安全、轻量
- 劣势: 无团队协作云功能、功能较基础

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Tauri + React + TypeScript | 现代化桌面应用方案，包体小、性能高、安全 |
| 本地优先 + 可选云同步 | 兼顾Bruno的本地安全和Postman的协作能力 |
| 文件系统集合存储 | 兼容Git、便于版本控制，参考Bruno理念 |
| Monorepo | 统一管理前端、后端、共享代码 |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| Postman文档部分页面404 | 使用替代页面和主页信息补充 |

## Resources
- Postman 官网: https://www.postman.com
- Postman 文档: https://learning.postman.com
- Insomnia: https://insomnia.rest
- Hoppscotch: https://hoppscotch.io
- Bruno: https://www.usebruno.com

## Visual/Browser Findings
- Postman v12采用统一工作台(United Workbench)设计
- 侧边栏分为4个Tab：Items/Services/History/Local Files
- 右侧边栏根据元素类型动态显示工具
- Footer集成Console/Terminal/Git/Tools/Globals/Vault
- Postman主题色: 橙色(#FF6C37)为主色调
- 竞品Insomnia v12.4也支持MCP Client
- Bruno强调Git-native和本地安全

---
*Update this file after every 2 view/browser/search operations*
