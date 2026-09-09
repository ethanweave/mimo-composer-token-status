import { listTargets, pickRendererTarget, connect, evaluate } from "../../inject/cdp-client.mjs";

const prompt = process.argv[2] || "请用一句话介绍人工智能�?;
const targets = await listTargets(9222);
const client = await connect(pickRendererTarget(targets).webSocketDebuggerUrl);
await client.send("Runtime.enable");

async function snap(tag) {
  const d = await evaluate(
    client,
    `(() => (window.__cts && window.__cts.debug ? window.__cts.debug() : null))()`
  );
  console.log("====", tag, "====");
  console.log(
    JSON.stringify(
      {
        stripText: d?.stripText,
        cacheHitRate: d?.cacheHitRate,
        planRemainingRatio: d?.planRemainingRatio,
        conversationId: d?.conversationId,
        lastRefreshReason: d?.lastRefreshReason,
        lastRefreshAt: d?.lastRefreshAt,
        refreshCount: d?.refreshCount,
        input: d?.input,
        cacheRead: d?.cacheRead,
        activeTimers: d?.activeTimers,
        activeObservers: d?.activeObservers,
        activeSubscriptions: d?.activeSubscriptions,
        additionalLLMRequests: d?.additionalLLMRequests,
        failure: d?.failure,
      },
      null,
      2
    )
  );
  return d;
}

const before = await snap("BEFORE");

// Try to submit via composer DOM
const sent = await evaluate(
  client,
  `(async () => {
    const prompt = ${JSON.stringify(prompt)};
    const ta =
      document.querySelector("textarea.composer-input") ||
      document.querySelector("textarea") ||
      document.querySelector('[contenteditable="true"]');
    if (!ta) return { ok: false, reason: "no textarea" };

    // React-friendly set
    const proto = Object.getPrototypeOf(ta);
    const desc = proto && Object.getOwnPropertyDescriptor(proto, "value");
    if (ta.tagName === "TEXTAREA" || ta.tagName === "INPUT") {
      const setter = desc && desc.set;
      if (setter) setter.call(ta, prompt);
      else ta.value = prompt;
      ta.dispatchEvent(new Event("input", { bubbles: true }));
      ta.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      ta.focus();
      ta.textContent = prompt;
      ta.dispatchEvent(new InputEvent("input", { bubbles: true, data: prompt }));
    }

    // Prefer Enter, else click send
    let sendBtn =
      document.querySelector('button[aria-label="发�?]') ||
      document.querySelector('.composer-bar .cb-right button:last-of-type') ||
      document.querySelector('button[aria-label*="Send"]');
    if (sendBtn) {
      sendBtn.click();
      return { ok: true, method: "click-send", hasBtn: true };
    }
    ta.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true })
    );
    return { ok: true, method: "enter", hasBtn: false, value: ta.value || ta.textContent };
  })()`
);
console.log("send result", JSON.stringify(sent));

// Wait for completion event-driven refresh (poll debug lightly via CDP, not inject)
const deadline = Date.now() + 90000;
let after = null;
let sawChange = false;
while (Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 2000));
  const d = await evaluate(
    client,
    `(() => (window.__cts && window.__cts.debug ? window.__cts.debug() : null))()`
  );
  if (!d) continue;
  const changed =
    d.refreshCount !== before?.refreshCount ||
    d.cacheHitRate !== before?.cacheHitRate ||
    (d.input !== before?.input && d.input != null);
  if (changed) {
    sawChange = true;
    // wait a bit more for settle
    await new Promise((r) => setTimeout(r, 1500));
    after = await evaluate(
      client,
      `(() => (window.__cts && window.__cts.debug ? window.__cts.debug() : null))()`
    );
    break;
  }
  // if strip still same and no refresh growth after 20s, keep waiting
}

if (!after) after = await snap("AFTER_TIMEOUT");
else {
  console.log("==== AFTER ====");
  console.log(
    JSON.stringify(
      {
        stripText: after.stripText,
        cacheHitRate: after.cacheHitRate,
        planRemainingRatio: after.planRemainingRatio,
        conversationId: after.conversationId,
        lastRefreshReason: after.lastRefreshReason,
        lastRefreshAt: after.lastRefreshAt,
        refreshCount: after.refreshCount,
        input: after.input,
        cacheRead: after.cacheRead,
        output: after.output,
        sawChange,
      },
      null,
      2
    )
  );
}

const cacheChanged =
  before?.cacheHitRate !== after?.cacheHitRate ||
  before?.input !== after?.input ||
  before?.cacheRead !== after?.cacheRead;
const planChanged = before?.planRemainingRatio !== after?.planRemainingRatio;
console.log("--- verdict ---");
console.log({
  cacheChanged,
  planChanged,
  refreshGrew: (after?.refreshCount || 0) > (before?.refreshCount || 0),
  lastRefreshReason: after?.lastRefreshReason,
});

client.close();
