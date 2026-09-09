import { listTargets, pickRendererTarget, connect, evaluate } from "../../inject/cdp-client.mjs";

const targets = await listTargets(9222);
const client = await connect(pickRendererTarget(targets).webSocketDebuggerUrl);
await client.send("Runtime.enable");

async function uiState() {
  return evaluate(
    client,
    `(() => {
      const btn = document.getElementById('send-btn');
      const ta = document.querySelector('textarea.composer-input');
      return {
        sendCls: btn ? btn.className : null,
        ta: ta ? ta.value : null,
        ariaBusy: ta ? ta.getAttribute('aria-busy') : null
      };
    })()`
  );
}

const before = await evaluate(client, `(() => window.__cts.debug())()`);
console.log("start", {
  refreshCount: before.refreshCount,
  reason: before.lastRefreshReason,
  cache: before.cacheHitRate,
  plan: before.planRemainingRatio,
  input: before.input,
  cacheRead: before.cacheRead,
  strip: before.stripText,
  ui: await uiState(),
});

const t0 = Date.now();
let last = before;
let refreshed = false;
while (Date.now() - t0 < 75000) {
  await new Promise((r) => setTimeout(r, 2000));
  const d = await evaluate(client, `(() => window.__cts.debug())()`);
  last = d;
  const ui = await uiState();
  if ((d.refreshCount || 0) > (before.refreshCount || 0)) {
    refreshed = true;
    console.log("REFRESH", {
      elapsed: Math.round((Date.now() - t0) / 1000),
      refreshCount: d.refreshCount,
      reason: d.lastRefreshReason,
      cache: d.cacheHitRate,
      plan: d.planRemainingRatio,
      input: d.input,
      cacheRead: d.cacheRead,
      strip: d.stripText,
      ui,
    });
    break;
  }
  if (Math.round((Date.now() - t0) / 1000) % 10 === 0) {
    console.log("wait", {
      t: Math.round((Date.now() - t0) / 1000),
      refreshCount: d.refreshCount,
      ui,
    });
  }
}

console.log("final", {
  refreshed,
  refreshCount: last.refreshCount,
  grew: last.refreshCount > before.refreshCount,
  reason: last.lastRefreshReason,
  cache: last.cacheHitRate,
  plan: last.planRemainingRatio,
  input: last.input,
  cacheRead: last.cacheRead,
  strip: last.stripText,
  timers: last.activeTimers,
  observers: last.activeObservers,
  subs: last.activeSubscriptions,
  llm: last.additionalLLMRequests,
});
client.close();
