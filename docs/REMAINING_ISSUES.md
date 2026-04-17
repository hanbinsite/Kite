# 待优化问题清单

> 发现时间：2026-04-16（修复26项文档缺陷后）
> 更新时间：2026-04-17（批量修复后）

## 高优先级（影响 AI 正确生成代码）— 全部已修复 ✅

### 1. 04b: §5.4 与 §4.5.5 的 send_http_request 重复且矛盾 ✅ 已修复
- 删除了 §4.5.5 旧版简化实现，改为引用 §5.4 流式版本的说明

### 2. 04b: init_app_state 缺少 cookie_jar 和 app_handle ✅ 已修复
- 补充了 `cookie_jar: Arc::new(reqwest::cookie::Jar::default())`
- `app_handle` 已在 §6.1 AppState 定义中声明

### 3. 04a: 重复标题 ✅ 已修复
- 删除了多余的 `# API Client 技术方案` 行

### 4. 04b: WssErrorPayload 拼写错误 ✅ 已修复
- 修正为 `WsErrorPayload`

### 5. 多处 currentResponse 引用旧模式 ✅ 已修复
- `08-开发指南.md` §9.3: 改为 `responses[tabId]` + immer set 模式
- `09-Phase1任务清单.md`: 改为 `responses (Record<tabId, HttpResponse>)`
- `12-状态持久化.md`: 改为 `RequestStore.responses[activeTabId]`

---

## 中优先级 — 全部已修复 ✅

### 6. 04a: §3.1/§3.2 编号跳跃 ✅ 已修复
- §3.6→§3.3, §3.7→§3.4, §3.8→§3.5，编号连续

### 7. 04b: §5→§4.5 编号体系混乱 ✅ 已修复
- §4.5 全部改为 §6.x（§6.1~§6.6），统一编号体系

### 8. 04c/04b Storage 与 AppState.db 重复定义 ✅ 已修复
- 在 §6.3 初始化流程添加了澄清注释：Command 不直接操作 db，通过 Storage 间接操作

### 9. 04a: 架构图 sodium 残留 ✅ 已修复
- 改为 `argon2`

---

## 低优先级 — 全部已修复 ✅

### 10. 04a: .eslintrc.js ✅ 已修复
- 改为 `eslint.config.js`（ESLint 9.x flat config）

### 11. 06-深度分析报告 ✅ 保留作为历史记录
- 该文档记录了早期问题修正过程，有历史价值，保留不变

### 12. README.md ✅ 已验证
- 已更新为拆分后的文档结构，描述与内容匹配

### 13. futures-util ✅ 已修复
- 在 04a Cargo.toml 中添加了 `futures-util = "0.3"`（SSE 流式处理依赖）

---

## 全部问题已修复，文档集可直接用于开发

*最后更新：2026-04-17*