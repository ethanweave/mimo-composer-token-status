# MiMo Composer Token Status v2.2.0

Agent-native runtime extension for Xiaomi MiMo Desktop.

## 本版本

v2.2.0 是本项目首个 GitHub-ready 正式版本。

## 核心功能

- Composer Footer 显示 **缓存命中率**（Cache Hit Rate）
- Composer Footer 显示 **Token Plan 剩余用量**（Usage Left）
- Cache Hit Rate 使用 MiMo 会话 Usage State（`Pje` → `usageByConvo`）
- Plan Remaining 使用 MiMo Native Usage API（`window.mimo.getUserUsage()`）
- Event-driven refresh
- Agent-native deployment
- 用户级安装 / Repair / Uninstall / Rollback / Healthcheck

## 验证

- `npm run check`：PASS
- `npm run verify`：25/25 PASS
- Additional LLM Requests：0
- External Production Network Requests：0
- Timers：0
- MutationObservers：0
- app.asar：未修改
- MiMo executable：未修改
- Runtime：冻结

## 兼容性

- Windows：支持
- MiMo Desktop：支持
- macOS：暂不支持
- Linux：暂不支持

## 已知限制

- MiMo 内部结构具有版本敏感性
- 当前版本依赖安装后的 **Xiaomi MiMo** 快捷方式
- 原始 `Xiaomi MiMo.exe` 直接启动不支持 CDP 注入
- 冷启动 unattended chain 尚未进行完整无人值守验证

## 安全

- 无 Telemetry / Analytics / 云端服务
- 无额外 LLM 请求
- 不修改 `app.asar` / MiMo executable

## English Summary

MiMo Composer Token Status v2.2.0 is the first public, GitHub-ready release of this Agent-Native Runtime Extension.

It adds **Cache Hit Rate** and **Token Plan Remaining Usage** to the MiMo Composer footer using local runtime integration.

No app.asar patching. No additional LLM requests. No telemetry. No cloud service.

---

**Unofficial** — not affiliated with Xiaomi. MIT License.
