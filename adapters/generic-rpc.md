# 宿主如何推送 Usage Snapshot

目标：输入框底栏**实时**更新两个整数百分比，且 **零 LLM 轮询**。

## 推荐通道

1. **进程内事件**（Electron renderer ← preload ← main）  
2. **本地 IPC / WebSocket**（仅 127.0.0.1）  
3. **落盘 JSON + fs watch**（最后手段）

不要：让 Agent 每隔 N 分钟执行 `stats` 类命令展示“假实时”。

## 触发时机

| 时机 | 行为 |
|------|------|
| 模型流式结束 | 必推完整 `UsageSnapshot` |
| 流式过程中 | 可选 1 Hz 节流推送 |
| 会话切换 / 清空 | 推空态或 `remainingRatio` 重置 |
| 错误中断 | 保留上一帧或清空；勿弹错误条 |

## 负载

与 [SPEC.md](../SPEC.md) §4 相同：

```json
{
  "schemaVersion": 1,
  "session": {
    "cacheHitRate": 0.96,
    "remainingRatio": 0.38
  }
}
```

详情字段（tokens / cost / model）可选，仅供 hover 弹层。

## 与上下文环

- `remainingRatio` 与环使用 **同一预算数据源**。  
- 若环表示 context window，就不要用账号配额去算「剩余」，除非产品明确改语义并更新 tooltip。

## 最小伪代码

```js
// main or session store
sessionBus.on("usage", (snapshot) => {
  renderer.send("cts:usage", snapshot);
});

// renderer
window.cts.onUsage((snapshot) => {
  footer.update(snapshot.session);
});
```
