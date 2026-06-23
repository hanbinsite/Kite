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

## 待继续
- M12-M23: 剩余 12 个 High 修复
- M24-M43: 20 个 Medium 修复
- M44-M45: 2 个 Release Engineering