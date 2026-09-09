# M0 决议表（v2.0.0 冻结）

状态：**已关闭** · 版本：**2.0.0** · 日期：2026-09-09

| # | 议题 | 决议 | 状态 |
|---|------|------|------|
| D1 | 剩余用量语义 | **Token Plan / Account Quota Remaining**（`getUserUsage().percent/100`） | Closed |
| D1b | 与 Context Ring 同源 | **作废** | Superseded |
| D2 | 缓存命中率 | **会话累计 Prompt Cache**，公式 = 原生 `b0e` | Closed |
| D2b | `input` 语义 | **fresh / 未命中缓存**（`TD` 作上下文占用，故不含 cacheRead） | Closed |
| D3 | 刷新 | **事件驱动** harnessDone / chatDone / usage event；microtask 合并 | Closed |
| D3b | 轮询 / MO / rAF | **禁止**（曾导致 Renderer freeze） | Closed |
| D4 | 小数 | 禁止；整数四舍五入 | Closed |
| D5 | 落位 | Composer 底栏中央 | Closed |
| D6 | 文案 | `缓存命中率 xx% · 剩余用量 xx%`（窄窗 `命中率/剩余`） | Closed |
| D7 | 空态 | 缺项省略；不伪造 0% | Closed |
| D8 | 数据通道 | usage fiber + `window.mimo.getUserUsage`；0 LLM | Closed |
| D11 | Context Ring | 仅 Context Window；永不作为 plan remaining | Closed |
| D12 | runtime | **FROZEN** rev20 / package 2.0.0 | Closed |

## 权威定义

```text
cacheHitRate       = cacheRead / max(cacheRead + cacheWrite + input, 1)
planRemainingRatio = nativeUsage.percent / 100
contextRemainingRatio = 1 - usedContext/contextBudget   // 仅 debug
```

## Token Plan 原生源

```text
window.mimo.getUserUsage()
  → { ok, usage: { percent, resetDate } }
```
