import { listTargets, pickRendererTarget, connect, evaluate } from "../../inject/cdp-client.mjs";

const targets = await listTargets(9222);
const client = await connect(pickRendererTarget(targets).webSocketDebuggerUrl);
await client.send("Runtime.enable");

async function snap() {
  return evaluate(client, `(() => {
    const d = window.__cts && window.__cts.debug ? window.__cts.debug() : null;
    const btn = document.getElementById('send-btn');
    return d ? {
      strip: d.stripText,
      cache: d.cacheHitRate,
      plan: d.planRemainingRatio,
      input: d.input,
      cacheRead: d.cacheRead,
      output: d.output,
      refreshCount: d.refreshCount,
      reason: d.lastRefreshReason,
      timers: d.activeTimers,
      observers: d.activeObservers,
      subs: d.activeSubscriptions,
      llm: d.additionalLLMRequests,
      sendCls: btn ? btn.className : null
    } : null;
  })()`);
}

// Stop any stuck turn
await evaluate(client, `(() => {
  const btn = document.getElementById('send-btn');
  if (btn && /stop/.test(btn.className || '')) { btn.click(); return 'stopped'; }
  return 'idle';
})()`).then((r) => console.log("stop:", r));
await new Promise((r) => setTimeout(r, 1500));
console.log("after stop", await snap());

async function sendAndWait(label, prompt, waitMs = 50000) {
  const before = await snap();
  console.log("====", label, "BEFORE ====");
  console.log(JSON.stringify(before, null, 2));

  const sent = await evaluate(client, `(async () => {
    const prompt = ${JSON.stringify(prompt)};
    const ta = document.querySelector('textarea.composer-input');
    if (!ta) return { ok:false, reason:'no ta' };
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(ta, prompt);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    const pk = Object.keys(ta).find(k => k.startsWith('__reactProps$'));
    const props = pk ? ta[pk] : null;
    if (props && props.onChange) {
      try { props.onChange({ target: ta, currentTarget: ta }); } catch (e) {}
    }
    // small settle then Enter
    await new Promise(r => setTimeout(r, 50));
    if (props && props.onKeyDown) {
      const evt = {
        key: 'Enter', code: 'Enter', keyCode: 13, which: 13,
        preventDefault(){}, stopPropagation(){},
        target: ta, currentTarget: ta, nativeEvent: { isComposing: false },
        isDefaultPrevented: () => false,
      };
      try { props.onKeyDown(evt); return { ok:true, method:'enter', value: ta.value }; }
      catch (e) { return { ok:false, error:String(e) }; }
    }
    return { ok:false, reason:'no onKeyDown' };
  })()`);
  console.log("send", sent);

  const t0 = Date.now();
  let last = before;
  while (Date.now() - t0 < waitMs) {
    await new Promise((r) => setTimeout(r, 1500));
    last = await snap();
    if ((last.refreshCount || 0) > (before.refreshCount || 0)) {
      // wait for send button to leave stop mode if possible
      await new Promise((r) => setTimeout(r, 2000));
      last = await snap();
      console.log("====", label, "AFTER ====");
      console.log(JSON.stringify(last, null, 2));
      return { before, after: last, elapsed: Date.now() - t0 };
    }
  }
  console.log("====", label, "TIMEOUT ====");
  console.log(JSON.stringify(last, null, 2));
  return { before, after: last, timeout: true };
}

const r1 = await sendAndWait("ROUND1", "请只回复两个字：收到");
const r2 = await sendAndWait("ROUND2", "请只回复两个字：完成");
const r3 = await sendAndWait("ROUND3", "请只回复数字�?");

function cmp(r) {
  if (!r) return null;
  return {
    cacheBefore: r.before?.cache,
    cacheAfter: r.after?.cache,
    cacheChanged: r.before?.cache !== r.after?.cache,
    inputBefore: r.before?.input,
    inputAfter: r.after?.input,
    inputChanged: r.before?.input !== r.after?.input,
    planBefore: r.before?.plan,
    planAfter: r.after?.plan,
    reason: r.after?.reason,
    stripAfter: r.after?.strip,
    refreshGrew: (r.after?.refreshCount || 0) > (r.before?.refreshCount || 0),
    timeout: !!r.timeout,
  };
}

console.log("======== SUMMARY ========");
console.log(JSON.stringify({ r1: cmp(r1), r2: cmp(r2), r3: cmp(r3) }, null, 2));
console.log("final", await snap());
client.close();
