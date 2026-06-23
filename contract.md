# Contract — API Client 全部问题修复

**创建时间**: 2026-06-23
**状态**: LOCKED (用户已确认全部修复方案)
**范围**: 47 个审计问题 + 已知偏差的修复

---

## 已验证的问题状态

| 问题 | 验证结果 |
|------|---------|
| C1 | EXISTS — tauri.conf.json 图标数组缺少 icon.icns，macOS 打包失败 |
| C2 | EXISTS — AiChatPanel.tsx:292 使用 dangerouslySetInnerHTML，AI markdown 输出未 HTML 净化 |
| C3 | CLARIFIED — vault key 通过 argon2id 正确派生，但派生后的 key 通过 keyring 持久化到系统密钥链（非明文密码） |
| C4 | EXISTS — proxy bind host 可由用户配置为 0.0.0.0 |
| C6 | EXISTS — Cmd+W 对 dirty tab 静默拦截无提示，与 TabBar 关闭按钮行为不一致 |
| C7 | EXISTS — removeConnection 定义了但从无 .tsx 调用，仅 disconnect() 被调用 |
| C8 | FALSE — 协议 Tab 在 Sidebar 已有完整入口，整个链路正常工作 |

---

## Must Do (M1-M45)

### Critical 级别 (5 items)

| ID | 修复内容 | 文件 |
|----|---------|------|
| M1 | 修复 tauri.conf.json 图标配置，补充 macOS icon.icns（或移除 macOS target） | `tauri.conf.json` |
| M2 | AiChatPanel dangerouslySetInnerHTML 替换为安全渲染——AI markdown 输出先做 HTML sanitize 再注入 | `AiChatPanel.tsx` |
| M3 | Cmd+W 快捷键行为对齐 TabBar 关闭按钮——dirty tab 时弹出 confirmClose 对话框而非静默拦截 | `App.tsx` |
| M4 | Tab 关闭时清理 WS/MQTT/SSE 连接——closeTab 中调用 removeConnection | `tab-store.ts`, `websocket-store.ts`, `mqtt-store.ts`, `sse-store.ts` |
| M5 | Proxy host 限制 localhost/127.0.0.1，禁止 0.0.0.0 | `proxy/mod.rs` |

### High 级别 (18 items)

| ID | 修复内容 | 文件 |
|----|---------|------|
| M6 | SQLite schema_version 表增加读写逻辑，提供基础的 schema migration 检测 | `storage/mod.rs` |
| M7 | Cookie 查询 LIKE 模糊匹配改为精确 domain 匹配 + path 过滤 | `storage/mod.rs` |
| M8 | 复用 reqwest::Client 实例（连接池），避免每次新建 TLS 连接 | `commands/http.rs` |
| M9 | 错误信息 error 改为 per-tab 隔离（Record<tabId, string>），对齐架构原则#7 | `request-store.ts` |
| M10 | 修复硬编码中文字符串——"执行失败"/"Request cancelled" 等走 i18n | `request-store.ts`, `ErrorBoundary.tsx`, `JsonViewer.tsx` |
| M11 | 基础无障碍——Tab 按钮 role/aria 属性，图标按钮 aria-label | `TabBar.tsx`, `Sidebar.tsx` |
| M12 | 修复前进/后退按钮永久 disabled——实现 URL 导航历史 | `UrlBar.tsx` |
| M13 | Command Palette 空 action 修复——"Open Collection"/"View History" 移除或实现 | `App.tsx` |
| M14 | ResponsePanel Copy Body 图标修复——使用 Copy 图标 | `ResponsePanel.tsx` |
| M15 | 二进制响应处理——添加 base64 内容下载/预览按钮 | `ResponsePanel.tsx` |
| M16 | ResponsePanel 错误检测改用结构化错误码而非 string sniffing | `ResponsePanel.tsx` |
| M17 | encrypt_vault_secret 添加 name 路径校验（对齐 delete_vault_secret） | `crypto.rs` |
| M18 | Console store 添加上限截断——Tab 关闭时清理，总量上限 5000 | `console-store.ts` |
| M19 | KeyValueEditor 改用稳定 key（非 crypto.randomUUID），避免输入失焦 | `RequestPanel.tsx` |
| M20 | GlobalConsole sourceToFilter "system" → "request" 修复 | `GlobalConsole.tsx` |
| M21 | 移除无效文件——`功能现状报告.md`（中文乱码名） | 仓库根 |
| M22 | Monaco Editor 复用单实例——通过 EditorManager 管理 | `ScriptEditor.tsx` |
| M23 | Settings 存储从 localStorage 迁移到 File System | `settings-store.ts` |

### Medium 级别 (20 items)

| ID | 修复内容 | 文件 |
|----|---------|------|
| M24 | 生产路径 unwrap 替换为 ? 或 expect with context | `crypto.rs`, `http.rs`, `engine.rs` |
| M25 | 静默吞错误 invoke().catch(() => {}) 替换为至少 console.error | `Sidebar.tsx`, `HomePage.tsx`, 等 |
| M26 | 侧边栏 History 定期刷新 | `Sidebar.tsx` |
| M27 | Cmd+T 快捷键注册 | `App.tsx` |
| M28 | Monaco Editor 多实例 → 单实例 | `ScriptEditor.tsx` |
| M29 | 确认 dialog 统一使用 Radix ConfirmDialog | `SettingsPage.tsx` |
| M30 | Effect 依赖数组补充完整 | `App.tsx`, `Workbench.tsx` |
| M31 | 自动保存优化——避免每次 keystroke 序列化 | `useAutoSave.ts` |
| M32 | Cargo.toml 移除无用 tonic-build build dependency | `Cargo.toml` |
| M33 | hudsucker HttpHandler trait 兼容——实现自定义 CaptureHandler 以捕获 intercepted 流量 | `proxy/mod.rs` |
| M34 | 前端 ProxyPanel 添加 CA 证书导出按钮（调用 export_proxy_ca） | `ProxyPanel.tsx` |
| M35 | 默认环境种子数据移除 fake key | `environment-store.ts` |
| M36 | Zustand 订阅粒度优化 | `CollectionRunnerDialog.tsx`, `ResponsePanel.tsx` |
| M37 | JsonViewer jsonPath 支持过滤/导航 | `JsonViewer.tsx` |
| M38 | TabBar Cmd+T 标签与实际快捷键一致 | `TabBar.tsx` |
| M39 | Sidebar History 无数据时刷新 | `Sidebar.tsx` |
| M40 | Monaco ScriptEditor 单例 | `ScriptEditor.tsx` |
| M41 | cookie 系统 path 过滤 | `storage/mod.rs`, `http.rs` |
| M42 | 移除 repo root 过期文件（task_plan.md, findings.md, progress.md, .claude/） | 仓库根 |
| M43 | gRPC 面板可到达性确认 | `Sidebar.tsx` |

### 发布工程 (2 items)

| ID | 修复内容 | 文件 |
|----|---------|------|
| M44 | 添加 LICENSE 文件 (MIT) | 仓库根 |
| M45 | CHANGELOG.md 版本同步 | 仓库根 |

---

## 排除项（有理由不修复）

| 问题 | 原因 |
|------|------|
| C4 (proxy bind 0.0.0.0) | 合并入 M5 — limit to localhost |
| C5 (Tauri permissions) | 已修复，CSP 已收紧 |
| H2 (OAuth1/AWSv4) | 已验证已实现 |
| H5 (JS injection) | 已验证已修复 |
| H9 (salt_bytes panic) | 已验证已修复 |
| M4 (cookie_store) | 审计过时，实际为 false |
| M5 (pm_api.rs) | 文件不存在，已在 engine.rs 内联 |
| H4 (pm.sendRequest 阻塞) | 高风险重构，跳过本次 |
| H6-c (reqwest cookie_store) | 设计上有意禁用 reqwest cookie jar，保留手动 SQLite |
| H13 (virtualization) | 工程量巨大，跳过本次 |
| H11 (script env scope) | 需深入理解 pm API 语义，跳过本次 |
| R1-R12 (发布工程) | 仅处理 M44/M45，其余跳过（需用户后续配置） |
| M10 (i18n 全覆盖) | 仅修复已发现的硬编码，不全量 i18n |
| M15 (二进制下载) | 添加基础下载按钮，不做完整二进制预览 |
| M8 (reqwest 客户端复用) | 简单添加 LazyLock 全局 Client，不作连接池高级配置 |
| M22/M28/M40 (Monaco 单例) | 合并为一个任务 |
| M16 (ResponsePanel string sniffing) | 改为结构化错误码 |
| M21 (中文乱码文件) | 删除 |

---

## 验收标准

- cargo check 0 errors
- cargo clippy 0 warnings
- pnpm typecheck 0 errors
- pnpm lint 0 warnings
- pnpm test:unit 全部通过
- 无 regressions