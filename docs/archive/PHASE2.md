# Phase 2 — 真数据接入报告

日期：2026-09-09  
约束：不改 `app.asar` · **0 additional LLM**

## 1. `Le.usageByConvo` 真实结构（已从 bundle 核实）

`A0e`（从最近一条 assistant 的 `info.tokens` 抽取）：

```js
{
  input: number,        // tokens.input
  output: number,       // tokens.output
  reasoning: number,    // tokens.reasoning
  cacheRead: number,    // tokens.cache.read
  cacheWrite: number,   // tokens.cache.write
  modelId?: string,     // info.modelID
  providerId?: string,  // info.providerID
}
```

Store：`usageByConvo: Record<convoId, UsageEntry>`（zustand harness store `Le`）。

当前会话定位：`zs(view, active)` → `convoId`，再取 `usageByConvo[convoId]`。

## 2. 与 Context Ring 同一套计算

| 量 | 函数 | 公式 |
|----|------|------|
| total | `TD` | `input + cacheRead + cacheWrite + output` |
| cache hit | `b0e` | `cacheRead / (cacheRead + cacheWrite + input)` |
| used% | `x0e` | `total / limit * 100`（limit 来自 `y0e(limits, modelId, providerId)`） |
| remaining | UI | `100 - used%`（**上下文预算**，不是账号配额） |
| ring dash | `jD` | `round(total/limit*100)`，上限 100 |

**Cache Hit 来源**：已有 `b0e(usage)`；环详情已展示 `usageHud.cacheHit`。  
**Remaining 含义**：**context budget remaining**（与环同源）。

更新时机：引擎 harness/chat 事件写入 store → React 重渲染环；无独立公开 event 名，注入侧用 **轮询 + MutationObserver**。

## 3. Adapter

`inject/adapter.mjs` — 纯函数 `toUsageSnapshot` / `formatStrip`，UI 不直接碰 MiMo 内部结构。

## 4. CDP 注入（不改 asar）

`inject/runtime-inject-phase2.js`：

1. 插入 `.cb-center[data-token-status]`  
2. 从 `.ctx-hud` **React fiber** 尝试取 `cacheRead/input/...` 与 limit  
3. 失败则读环 `stroke-dasharray` 得 remaining  
4. 每 1s 刷新 + MutationObserver  
5. `window.__cts.debug() / getSnapshot() / destroy()`

## 5. 移动预览 App

工作区根目录 `index.html`：手机宽度自适应，仿真 Composer 底栏中央双百分比，可调缓存/剩余并查看 `UsageSnapshot` JSON。供模拟器试用；**不是**改 Desktop 生产包。

## 6. 0 LLM 证明

- 无 `fetch`/模型 API  
- 无 harness/chat 发送  
- 仅读 DOM / fiber / 本地 store 镜像  

## 7. 建议验收

1. 用 `--remote-debugging-port=9222` 启动 MiMo（用户操作）  
2. 对 renderer 执行 `runtime-inject-phase2.js`  
3. 对话一轮后看底栏中央是否与环 hover 的 remaining 一致  
4. `__cts.debug()` 应打印 `source: "fiber"`（或仅 ring）
