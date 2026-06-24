# Dev Log — API Client 全部问题修复

**项目根**: K:\trae\自研客户端\api-client
**Contract**: contract.md
**模式**: Full Mode
**开始**: 2026-06-23

---

## Session 1 — Batch 1: Critical (M1-M5) + High (M6-M11)

### M1: tauri.conf.json 图标配置
- **验证**: macOS targets (dmg, app) 存在但缺少 icon.icns
- **修复**: 移除 macOS/linux targets，仅保留 Windows (msi, nsis)
- **文件**: `tauri.conf.json:37`

### M2: AiChatPanel XSS
- **验证**: `dangerouslySetInnerHTML` 在 L292-294，renderMarkdown 内部已 escapeHtml 但缺乏防御层
- **修复**: 添加 `sanitizeHtml()` 函数（移除 script 标签/on* 属性/javascript: URI）；添加 `renderMessageHtml()` 统一入口；替换直接使用 `dangerouslySetInnerHTML` 为经过 sanitize 的内容
- **文件**: `AiChatPanel.tsx:14-40, 303`

### M3: Cmd+W dirty tab 确认
- **验证**: L80 静默 return，与 TabBar 关闭按钮的 ConfirmDialog 不一致
- **修复**: 添加 `shortcutConfirmClose` state；dirty tab 时弹出 ConfirmDialog (Save/Discard/Cancel)；实现完整关闭流程（disconnect + removeConnection + closeTab + removeTabData）
- **文件**: `App.tsx:39, 70-72, 76-88, 415-449`

### M4: WS/MQTT/SSE 连接清理
- **验证**: `removeConnection()` 在 3 个 store 中定义但无 .tsx 调用
- **修复**: App.tsx 的 Cmd+W handler + ConfirmDialog 两个分支，TabBar.tsx 的 forceCloseTab 均添加 `removeConnection()` 调用
- **文件**: `App.tsx:83-85, 428-432, 441-445`; `TabBar.tsx:49-51`

### M5: Proxy host 限制
- **验证**: 用户可配置 host 为 "0.0.0.0"
- **修复**: 添加 `addr.ip().is_loopback()` 检查，非 loopback 返回错误
- **文件**: `proxy/mod.rs:193-197`

### M6: SQLite schema_version 迁移
- **验证**: schema_version 表在 L62 创建但无任何读写代码
- **修复**: 添加 `CURRENT_SCHEMA_VERSION = 1`；添加 `run_migrations()` 读取当前版本并顺序执行迁移
- **文件**: `storage/mod.rs:73-90`

### M7: Cookie domain 精确匹配 + path 过滤
- **验证**: `query_cookies` L224 使用 `LIKE '%domain%'`，a-example.com 匹配 example.com；`load_cookie_header` 无 path 过滤
- **修复**: SQL 改为 `WHERE domain = ?1 OR domain LIKE ?2` (子域匹配)；load_cookie_header 添加 request_path.starts_with(cookie_path) 过滤
- **文件**: `storage/mod.rs:223-226`; `http.rs:983, 1022-1025`

### M8: reqwest::Client 连接池复用
- **验证**: `build_client()` 每次请求创建新 Client
- **修复**: 添加 `DEFAULT_CLIENT` (LazyLock)，无自定义 settings 时复用
- **文件**: `http.rs:4, 294-306`

### M9: 错误 per-tab 隔离
- **验证**: `errors` 字段已是 `Record<string, string>`（L299），11 处使用均按 tabId 索引
- **结论**: 无需修复，审计过时

### M10: 硬编码中文字符串
- **验证**: request-store.ts L93 "执行失败"，L123 "执行失败"，L775 "Request cancelled"
- **修复**: 添加 `errors.scriptError` 和 `errors.requestCancelled` i18n key（en/zh-CN）；store 中导入 i18n 并用 t() 替换
- **文件**: `request-store.ts:6, 94, 124, 777`; `messages.ts:60-61, 883-884`

### M11: 无障碍
- **验证**: TabBar 已有 role="tablist"/role="tab"/aria-selected；关闭按钮是 span 嵌套在 button 内
- **修复**: 关闭 span 改为 role="button" + tabIndex={0} + aria-label + onKeyDown(Enter/Space)
- **文件**: `TabBar.tsx:180-187`

---

## Session 2 — Batch 2: High (M12-M23) + Medium (M24-M43) + Release (M44-M45)

### M12: 前进/后退按钮实现
- 实现 URL 导航历史栈，前进/后退按钮不再永久 disabled
- **文件**: `UrlBar.tsx`

### M13: Command Palette 空 action 修复
- 移除无实现的 "Open Collection"/"View History" 空 action
- **文件**: `App.tsx`

### M14: Copy Body 图标修复
- ResponsePanel Copy Body 按钮改用 Copy 图标
- **文件**: `ResponsePanel.tsx`

### M15: 二进制响应下载按钮
- 二进制/Base64 响应体添加下载按钮
- **文件**: `ResponsePanel.tsx`

### M16: ResponsePanel 结构化错误码
- 错误检测改为结构化错误码，不再 string sniffing
- **文件**: `ResponsePanel.tsx`

### M17: encrypt_vault_secret name 路径校验
- 对齐 delete_vault_secret，添加 name 不含路径分隔符校验
- **文件**: `crypto.rs`

### M18: Console store 上限截断
- Tab 关闭时清理 console 条目，总量上限 5000
- **文件**: `console-store.ts`

### M19: KeyValueEditor 稳定 key
- 使用稳定 key 替代 crypto.randomUUID，避免输入失焦
- **文件**: `RequestPanel.tsx`

### M20: GlobalConsole sourceToFilter 修复
- "system" 来源修复为 "request"
- **文件**: `GlobalConsole.tsx`

### M21: 删除无效文件
- 移除 `功能现状报告.md`（中文乱码名）
- **文件**: 仓库根

### M22: Monaco Editor 单实例
- 通过 EditorManager 管理 Monaco 单实例，切换 Tab 时替换 Model
- **文件**: `ScriptEditor.tsx`

### M23: Settings 存储迁移 File System
- Settings 从 localStorage 迁移到 File System 持久化
- **文件**: `settings-store.ts`

### M24: 生产路径 unwrap 替换
- crypto.rs / http.rs / engine.rs 中 unwrap 替换为 ? 或 expect with context
- **文件**: `crypto.rs`, `http.rs`, `engine.rs`

### M25: 静默吞错误 catch 日志化
- 空的 invoke().catch(() => {}) 替换为至少 console.error
- **文件**: `Sidebar.tsx`, `HomePage.tsx`

### M26: Sidebar History 定期刷新
- 侧边栏 History 添加定期轮询/刷新机制
- **文件**: `Sidebar.tsx`

### M27: Cmd+T 快捷键注册
- 注册 Cmd+T 快捷键创建新 Tab
- **文件**: `App.tsx`

### M28: Monaco Editor 单实例 (合并入 M22)
- 与 M22 合并实现
- **文件**: `ScriptEditor.tsx`

### M29: 确认 dialog 统一 Radix
- SettingsPage 中确认 dialog 统一使用 Radix ConfirmDialog
- **文件**: `SettingsPage.tsx`

### M30: Effect 依赖数组补充
- App.tsx / Workbench.tsx useEffect 依赖数组补充完整
- **文件**: `App.tsx`, `Workbench.tsx`

### M31: 自动保存去抖动优化
- 避免每次 keystroke 序列化，添加去抖动
- **文件**: `useAutoSave.ts`

### M32: 移除无用 tonic-build
- Cargo.toml 移除无用的 tonic-build build dependency
- **文件**: `Cargo.toml`

### M33: hudsucker HttpHandler 实现
- 实现自定义 CaptureHandler 以捕获 intercepted 流量
- **文件**: `proxy/mod.rs`

### M34: ProxyPanel CA 导出按钮
- 前端 ProxyPanel 添加 CA 证书导出按钮，调用 export_proxy_ca
- **文件**: `ProxyPanel.tsx`

### M35: 默认环境移除 fake key
- 默认环境种子数据移除 fake/sample key
- **文件**: `environment-store.ts`

### M36: Zustand 订阅粒度优化
- CollectionRunnerDialog / ResponsePanel 按需订阅 selector
- **文件**: `CollectionRunnerDialog.tsx`, `ResponsePanel.tsx`

### M37: JsonViewer jsonPath 过滤
- JsonViewer 添加 jsonPath 过滤/导航功能
- **文件**: `JsonViewer.tsx`

### M38: TabBar Cmd+T label
- TabBar 添加按钮 label 与实际快捷键 Cmd+T 一致
- **文件**: `TabBar.tsx`

### M39: Sidebar History 刷新 (合并入 M26)
- 与 M26 合并实现
- **文件**: `Sidebar.tsx`

### M40: Monaco 单例 (合并入 M22)
- 与 M22 合并实现
- **文件**: `ScriptEditor.tsx`

### M41: Cookie path 过滤
- Cookie 系统添加 path 属性过滤
- **文件**: `storage/mod.rs`, `http.rs`

### M42: 移除 repo 过期文件
- 移除 task_plan.md, findings.md, progress.md, .claude/ 等过期文件
- **文件**: 仓库根

### M43: gRPC Sidebar 入口确认
- gRPC 面板可到达性确认通过
- **文件**: `Sidebar.tsx`

### M44: LICENSE 文件
- 添加 MIT LICENSE 文件
- **文件**: 仓库根

### M45: CHANGELOG + 版本同步
- 添加 CHANGELOG.md 并同步版本号
- **文件**: 仓库根