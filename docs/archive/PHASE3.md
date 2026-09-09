# Phase 3 Report

日期：2026-09-09  
状态：**READY（工具链与安全注入）· 真机端到端需用户开启 9222 后复验**

## 1. 实现了什么

将 PoC 收成 **可一键连接** 的轻量工具：

1. 检测 `localhost:9222`  
2. 自动发现 MiMo renderer  
3. 注入正式 `runtime-inject.js`  
4. 确认 Composer 与 Status  
5. **0 additional LLM**

## 2. 新增/修改文件

| 路径 | 说明 |
|------|------|
| `inject/runtime-inject.js` | **正式**注入：幂等、安全失败、真数据、空态隐藏 |
| `inject/cdp-client.mjs` | 零依赖 CDP（Node fetch + WebSocket） |
| `inject/launcher.mjs` | `npm run connect` 入口 |
| `package.json` | `connect` / `verify` scripts |
| `README.md` | 使用说明 |
| `docs/PHASE3.md` | 本报告 |
| `preview/index.html` | 预览（mock，非 runtime） |
| `examples/usage-snapshot.json` | 契约样例 |

未使用：不改 `app.asar`（哈希已记录：`5A4A1793…`）。

## 3. 运行方式

```text
Xiaomi MiMo.exe --remote-debugging-port=9222
cd composer-token-status
npm run connect
```

本机验证：未开 9222 时输出  
`MiMo Renderer Debugging Port 9222 not found.`（符合预期）。

## 4. Adapter / UsageSnapshot

语义边界仍在：UI 不直接依赖 fiber 字段名；`runtime-inject` 内将内部结构映射为  
`{ schemaVersion:1, session:{ cacheHitRate, remainingRatio, … } }`。  
`inject/adapter.mjs` 保留为可测纯函数参考。

## 5. Runtime Injection

- 目标：`.composer-bar` 的 `cb-left` / `cb-right` **之间**  
- 幂等：全局仅一个 `#cts-token-status`  
- 失败：隐藏条、不抛未捕获异常到宿主主路径  

## 6. 实时更新

- `setInterval(1000)` + `MutationObserver`  
- 优先 fiber/store 中与环同源字段  
- fallback：环 `stroke-dasharray` → remaining  
- **禁止** LLM polling；仅读本地  

## 7–9. 指标

与 Phase 2 核实一致（`b0e` / `TD` / context limit）。  
剩余 = **上下文预算**，非账号配额。

## 10. Context Ring 一致性

同一 `usage` 对象与同一 limit 语义；fallback 直接读环弧长，避免第二套预算。

## 11–14. UI / 主题 / 窄窗 / 切换会话

- 颜色：`var(--text-mut, var(--mut, …))` 语义 token  
- 窄屏：`max-width:520px` 缩小字号；布局为 flex 居中，不撑高  
- 会话切换：fiber/store 变则 1s 内刷新  
- 重复注入：launcher/`__cts` 均幂等  

（真机浅色/窄窗/多轮需在开调试口后目视勾选。）

## 15. Additional LLM Request

**0**

代码路径：无 `fetch` 到模型、无 harness/chat 发送、无账号 API。  
CDP 仅 `Runtime.evaluate` 注入 UI。  
验证边界：静态代码审查 + launcher 源；**未**做抓包（无流量目标）。

## 16. app.asar

Phase 3 **零写入**。SHA256：`5A4A179371B91AE271ADF8BB078967336E4248192F19C98B436F0286A4F4A702`

## 17. 已知限制

1. 必须 `--remote-debugging-port=9222`  
2. 重启 MiMo 后需再 `npm run connect`  
3. 无官方 extension point；fiber 随版本可能失效（安全失败）  
4. 本回合 **未** 对运行中 MiMo 做端到端注入（端口未开）  

## 18. 是否「可实际使用」

| 项 | 状态 |
|----|------|
| CLI + 注入代码 | 完成 |
| 无端口错误提示 | 本机已验 |
| 真机 9222 注入 | **待用户开调试口后执行** |
| 多轮/切换/主题目视 | **待真机** |

### Phase 3 Status: **NOT READY**（阻塞项如下）

1. **阻塞：** 当前 MiMo 未以 `--remote-debugging-port=9222` 运行，无法完成端到端注入与 UI 验收。  
2. **阻塞：** 需要用户在真实 Composer 上确认：真百分比、与环一致、多轮更新、重复注入、空态隐藏。  

解除方式（用户）：

```text
关闭 MiMo → 带 9222 启动 → 打开对话 → npm run connect
```

连接成功且验收勾选后，可改为 **READY**。

## 19. 完成后理想路径（已实现到 CLI）

```text
启动 MiMo --remote-debugging-port=9222
npm run connect
Composer Footer → 缓存 xx% · 剩余 xx%
```
