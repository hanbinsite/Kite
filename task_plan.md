# Task Plan: API Client - Postman-like Modern API Client

## Goal
设计并规划一个类似 Postman 的现代化 API 客户端应用，包含完整的 UI 设计、功能设计、技术方案和操作流程文档。

## Current Phase
全部完成 ✅ → 进入开发阶段

## Phases

### Phase 1: Postman 研究 & 需求分析
- [x] 深入研究最新版 Postman 的 UI 布局和交互设计
- [x] 研究最新版 Postman 的核心功能模块
- [x] 研究最新版 Postman 的新特性 (AI, GraphQL, WebSocket 等)
- [x] 分析竞品 (Insomnia, Thunder Client, Hoppscotch)
- [x] 整理研究成果到 findings.md
- **Status:** completed

### Phase 2: 整体规划文档
- [x] 编写项目整体规划文档 (01-整体规划.md)
- [x] 定义项目愿景、目标用户、核心价值
- [x] 规划开发阶段和里程碑
- **Status:** completed

### Phase 3: UI 设计文档
- [x] 编写 UI 设计文档 (02-UI设计.md)
- [x] 设计整体布局和导航结构
- [x] 设计各页面和组件
- [x] 定义设计系统 (颜色、字体、间距、组件库)
- **Status:** completed

### Phase 4: 功能设计文档
- [x] 编写功能设计文档 (03-功能设计.md)
- [x] 详细设计每个功能模块
- [x] 定义数据模型和接口
- [x] 设计工作流和状态管理
- **Status:** completed

### Phase 5: 技术方案文档
- [x] 编写技术方案文档（拆分为 04a-架构设计.md + 04b-API设计.md + 04c-安全与性能.md）
- [x] 选定技术栈
- [x] 设计架构和目录结构
- [x] 规划性能、安全、测试方案
- **Status:** completed

### Phase 6: UI 操作流程文档
- [x] 编写 UI 操作流程文档 (05-UI操作流程.md)
- [x] 设计核心用户流程
- [x] 设计交互细节和动画
- [x] 定义快捷键和操作规范
- **Status:** completed

### Phase 7: 评审 & 交付
- [x] 评审所有文档的完整性和一致性
- [x] 确保文档间交叉引用正确
- [x] 交付最终文档集
- **Status:** completed

### Phase 8: 优化 & 最终校验（额外）
- [x] 创建 AGENTS.md（AI 开发入口文件）
- [x] 修正 AuthConfig serde 标签策略（untagged → externally tagged）
- [x] 替换 sodiumoxide 为 argon2 + aes-gcm（全文档集）
- [x] 添加 data-testid 到组件清单 + 页面级 testid 补充表
- [x] 拆分 04-技术方案.md → 04a/04b/04c（避免 AI 上下文溢出）
- [x] 拆分 07-核心页面视觉规范.md → 07a/07b/07c（避免 AI 上下文溢出）
- [x] 补充字体打包策略（Geist + JetBrains Mono 本地 woff2）
- [x] 补充 CI 类型同步校验完整工作流（GitHub Actions + pre-commit）
- [x] 审查并修正 Phase 2/3 任务清单（依赖缺失、路径错误、文档引用更新）
- [x] 更新 README.md 文档索引反映拆分后的结构
- [x] 更新所有文档间交叉引用（04→04a/04b/04c, 07→07a/07b/07c）
- [x] 更新 06-深度分析报告中的 sodiumoxide 引用
- [x] 更新 01-整体规划中的加密库版本
- [x] 更新 03-功能设计中 AuthConfig TypeScript 定义（配合 Rust serde 变更）
- **Status:** completed

## Key Decisions Made
| Decision | Rationale |
|----------|-----------|
| 桌面端应用 | API 调试工具需要本地网络访问能力 |
| 现代化 UI | 参考 Postman 最新设计，超越其 UI 体验 |
| Tauri 2.x + React 19.x | 包体小、性能高、安全，Rust 后端处理所有网络请求 |
| AuthConfig 使用外部标签 `#[serde(tag="type", content="config")]` | 避免 untagged 枚举反序列化歧义 |
| argon2 + aes-gcm 替代 sodiumoxide | OWASP 推荐 KDF + NIST 推荐 AEAD，更现代更安全 |
| 文档拆分（04→04a/04b/04c, 07→07a/07b/07c） | 单文档超 2000/6000 行，AI 上下文易溢出 |
| 本地字体打包（woff2） | 零 FOUC、离线可用、不依赖外部 CDN |

## Final Document Structure
```
docs/
├── README.md                           # 文档索引
├── 01-整体规划.md                        # 项目愿景、选型
├── 02-UI设计.md                          # 设计系统
├── 03-功能设计.md                         # 数据模型、业务逻辑
├── 04a-架构设计.md                        # 技术栈、架构、Rust/前端
├── 04b-API设计.md                        # Tauri Commands、事件定义
├── 04c-安全与性能.md                      # 安全、OAuth、性能、测试
├── 05-UI操作流程.md                       # 交互流程
├── 06-技术方案深度分析报告.md               # 问题修正记录
├── 07a-首页视觉规范.md                     # 首页像素级CSS
├── 07b-请求编辑视觉规范.md                  # 请求/响应编辑像素级CSS
├── 07c-侧边栏与命令面板视觉规范.md           # 侧边栏/命令面板像素级CSS
├── 08-开发指南.md                         # 初始化、配置、结构体、组件、testid
├── 09-Phase1任务清单.md                    # 基础框架40任务
├── 10-Phase2任务清单.md                    # 核心请求26任务
├── 11-Phase3任务清单.md                    # 高级功能23任务
├── 12-状态持久化与变量同步策略.md            # 数据同步协议
├── 13-错误处理与用户反馈完整设计.md          # 28种错误码UI映射
└── AGENTS.md                             # AI开发入口（根目录）
```

## Notes
- 参考对象为 Postman 最新版 (v11+)
- UI 要求现代化、简洁、高效
- 功能齐全，不输 Postman 核心功能
- 所有文档已作为后续开发标准，可直接开始 Phase 1 开发
- 文档集已通过完整审查和优化，所有交叉引用、依赖关系、代码约定一致