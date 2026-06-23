# Progress — API Client 全部问题修复

## Critical (5/5)

| ID | 任务 | 状态 | 优先级 |
|----|------|------|--------|
| M1 | tauri.conf.json 图标配置修复 | ✅ completed | critical |
| M2 | AiChatPanel XSS 修复 | ✅ completed | critical |
| M3 | Cmd+W dirty tab 确认对话框 | ✅ completed | critical |
| M4 | WS/MQTT/SSE 连接在 Tab 关闭时清理 | ✅ completed | critical |
| M5 | Proxy host 限制 localhost | ✅ completed | critical |

## High (11/18 completed, 7 pending)

| ID | 任务 | 状态 | 优先级 |
|----|------|------|--------|
| M6 | SQLite schema_version 迁移逻辑 | ✅ completed | high |
| M7 | Cookie LIKE 改为精确 domain 匹配 + path 过滤 | ✅ completed | high |
| M8 | reqwest::Client 连接池复用 | ✅ completed | high |
| M9 | 错误信息 per-tab 隔离 | ✅ verified (已是 Record<string,string>) | high |
| M10 | 硬编码中文字符串 i18n 化 | ✅ completed | high |
| M11 | 基础无障碍 (role/aria) | ✅ completed | high |
| M12 | 前进/后退按钮实现 | ⏳ pending | high |
| M13 | Command Palette 空 action 修复 | ⏳ pending | high |
| M14 | Copy Body 图标修复 | ⏳ pending | high |
| M15 | 二进制响应下载按钮 | ⏳ pending | high |
| M16 | ResponsePanel 结构化错误码 | ⏳ pending | high |
| M17 | encrypt_vault_secret name 路径校验 | ⏳ pending | high |
| M18 | Console store 上限截断 | ⏳ pending | high |
| M19 | KeyValueEditor 稳定 key | ⏳ pending | high |
| M20 | GlobalConsole sourceToFilter 修复 | ⏳ pending | high |
| M21 | 删除无效文件 | ⏳ pending | high |
| M22 | Monaco Editor 单实例 | ⏳ pending | high |
| M23 | Settings 存储迁移 File System | ⏳ pending | high |

## Medium (20/20)

| ID | 任务 | 状态 | 优先级 |
|----|------|------|--------|
| M24 | 生产路径 unwrap 替换 | ⏳ pending | medium |
| M25 | 静默吞错误 catch 日志化 | ⏳ pending | medium |
| M26 | Sidebar History 定期刷新 | ⏳ pending | medium |
| M27 | Cmd+T 快捷键注册 | ⏳ pending | medium |
| M28 | Monaco Editor 单实例 (合并入 M22) | ⏳ pending | medium |
| M29 | 确认 dialog 统一 Radix | ⏳ pending | medium |
| M30 | Effect 依赖数组补充 | ⏳ pending | medium |
| M31 | 自动保存去抖动优化 | ⏳ pending | medium |
| M32 | 移除无用 tonic-build | ⏳ pending | medium |
| M33 | hudsucker HttpHandler 实现 | ⏳ pending | medium |
| M34 | ProxyPanel CA 导出按钮 | ⏳ pending | medium |
| M35 | 默认环境移除 fake key | ⏳ pending | medium |
| M36 | Zustand 订阅粒度优化 | ⏳ pending | medium |
| M37 | JsonViewer jsonPath 过滤 | ⏳ pending | medium |
| M38 | TabBar Cmd+T label | ⏳ pending | medium |
| M39 | Sidebar History 刷新（合并入 M26） | ⏳ pending | medium |
| M40 | Monaco 单例（合并入 M22） | ⏳ pending | medium |
| M41 | Cookie path 过滤 | ⏳ pending | medium |
| M42 | 移除 repo 过期文件 | ⏳ pending | medium |
| M43 | gRPC Sidebar 入口确认 | ⏳ pending | medium |

## Release Engineering (2/2)

| ID | 任务 | 状态 | 优先级 |
|----|------|------|--------|
| M44 | LICENSE 文件 | ⏳ pending | medium |
| M45 | CHANGELOG + 版本同步 | ⏳ pending | medium |

---

## 跳过（有理由）

| ID | 原因 |
|----|------|
| C3 | 已确认 key 通过 argon2id 正确派生 |
| C8 | 已验证协议 Tab 链路完整 |
| H4 | pm.sendRequest 阻塞 — 高风险重构 |
| H6-c | reqwest cookie_store 有意禁用 |
| H11 | script env scope 需深入理解语义 |
| H13 | virtualization 工程量巨大 |
| R1-R12 | 发布工程配置需用户参与 |