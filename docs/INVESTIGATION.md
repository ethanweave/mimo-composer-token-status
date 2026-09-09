# MiMo Desktop 架构调查 — Composer Token Status（FINAL）

日期：2026-09-09  
结论摘要：**无正式 Composer Extension Point**；缓存来自会话 usage；**剩余用量来自 Token Plan 账户链路**，与 Context Ring 完全独立。

## 1. 运行形态

| 项 | 值 |
|----|-----|
| 安装 | `%LOCALAPPDATA%\Programs\Xiaomi MiMo`（动态发现） |
| 渲染包 | `resources\app.asar`（约 99MB） |
| 版本 | 26.909.91205 · Electron 41.7.2 |
| asar SHA256 | `5A4A179371B91AE271ADF8BB078967336E4248192F19C98B436F0286A4F4A702` |
| 远程调试 | 需显式 `--remote-debugging-port=9222` |

## 2. Composer DOM

```text
.composer-bar
  ├── .cb-left
  ├── （中央空隙 → Token Status 注入点）
  └── .cb-right   # ctx-hud 环 / 模型 / 麦克风 / 发送
```

## 3. 两个指标、两条数据链路

### A. Cache Hit Rate（会话）

```text
usageByConvo[convoId]
  { input, output, reasoning, cacheRead, cacheWrite, modelId?, providerId? }
        │
        └─ Pje / Context Ring hooks
             cacheHit = cacheRead / (cacheRead + cacheWrite + input)
```

### B. Token Plan Remaining（账户「剩余用量」）

```text
账户菜单「剩余用量」 / 设置 · 使用情况和计费
        │
        ▼
STe hook → Bl (zustand) .usage
        │
        ▼
ii.account.usage() → window.mimo.getUserUsage()
        │
        ▼
IPC mimo:getUserUsage
        │
        ▼
GET {accountBase}/user/usage
        │
        ▼
{ percent: number≥0, resetDate: string }   // Sle zod schema
        │
        ▼
UI: Math.round(percent)%   [data-usage-percent]
文案: 剩余 {{percent}}%
```

**关键澄清**

- 原生 `percent` **已经是剩余百分比**，不是已用比例。  
- 账户菜单入口标签：`剩余用量` / `Remaining usage`。  
- 计费页：`使用情况和计费` / `通用使用限额` / `每周使用限额`。  
- `Bl` 仅在菜单展开或 `load()/loadIfStale()` 时填充；注入器可在未展开时通过同一 IPC 只读拉取（账户 API，非 LLM），TTL 与原生一致 300s。

## 4. Context Ring（禁止作为 Plan Remaining）

| 能力 | 用途 |
|------|------|
| 环形图 | Context Window 占用 |
| `1 - total/limit` | contextRemainingRatio（仅 debug） |
| `.ctx-hud-ring-fg` / `stroke-dasharray` | **不得**作为 Token Plan 数据源 |

## 5. 方案优先级

| 优先级 | 方式 | 本机可行性 |
|--------|------|------------|
| P1 | 正式 Composer Extension Point | **不存在** |
| P2 | 源码改 composer-bar | 无源码仓库 |
| P3 | 修改 app.asar | **禁止**（本项目不做） |
| P4 | CDP Runtime 注入 | **采用** |

## 6. 额外请求边界

| 类型 | 是否允许 |
|------|----------|
| LLM / 模型推理请求 | **禁止（=0）** |
| 复用 `getUserUsage` 账户 API | **允许**（与原生 UI 同链路） |
| 修改 app.asar | **禁止** |

## 7. 视觉基线

- 位置：composer-bar 中央  
- 文案：`缓存 xx% · 剩余用量 xx%`  
- 11–12px、次要色、主题 token  
- 窄窗缩短/隐藏，不遮挡 disclaimer  
