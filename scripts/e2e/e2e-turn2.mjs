import { listTargets, pickRendererTarget, connect, evaluate } from "../../inject/cdp-client.mjs";

const prompt = process.argv[2] || "请只回复：OK";
const targets = await listTargets(9222);
const client = await connect(pickRendererTarget(targets).webSocketDebuggerUrl);
await client.send("Runtime.enable");

const btns = await evaluate(client, `(() => {
  const right = document.querySelector('.cb-right');
  if (!right) return null;
  return [...right.querySelectorAll('button')].map(b=>({
    aria: b.getAttribute('aria-label'),
    cls: b.className,
    html: b.outerHTML.slice(0,200),
    disabled: b.disabled
  }));
})()`);
console.log("cb-right buttons", JSON.stringify(btns, null, 2));

const sent = await evaluate(client, `(async () => {
  const prompt = ${JSON.stringify(prompt)};
  const ta = document.querySelector('textarea.composer-input');
  if (!ta) return { ok:false, reason:'no ta' };
  const desc = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
  desc.set.call(ta, prompt);
  ta.dispatchEvent(new Event('input', { bubbles: true }));

  // Call React onChange if present
  const pk = Object.keys(ta).find(k=>k.startsWith('__reactProps$'));
  const props = pk ? ta[pk] : null;
  if (props && typeof props.onChange === 'function') {
    try {
      props.onChange({ target: ta, currentTarget: ta, type: 'change' });
    } catch (e) {}
  }

  // Enter via React onKeyDown
  if (props && typeof props.onKeyDown === 'function') {
    const evt = {
      key: 'Enter', code: 'Enter', keyCode: 13, which: 13,
      preventDefault(){}, stopPropagation(){},
      target: ta, currentTarget: ta, nativeEvent: { isComposing: false },
      isDefaultPrevented: () => false,
    };
    try { props.onKeyDown(evt); return { ok:true, method:'react-onKeyDown', value: ta.value }; }
    catch (e) { return { ok:false, method:'react-onKeyDown', error: String(e) }; }
  }

  ta.dispatchEvent(new KeyboardEvent('keydown', { key:'Enter', code:'Enter', keyCode:13, bubbles:true }));
  return { ok:true, method:'dispatch-keydown', value: ta.value };
})()`);
console.log("sent", JSON.stringify(sent));

// watch strip / debug for up to 45s
const before = await evaluate(client, `(() => window.__cts.debug())()`);
console.log("before refreshCount", before.refreshCount, before.stripText, before.cacheHitRate);
const t0 = Date.now();
let last = before;
while (Date.now() - t0 < 45000) {
  await new Promise((r) => setTimeout(r, 1500));
  const d = await evaluate(client, `(() => window.__cts.debug())()`);
  last = d;
  if ((d.refreshCount || 0) > (before.refreshCount || 0)) {
    console.log("REFRESHED", {
      refreshCount: d.refreshCount,
      reason: d.lastRefreshReason,
      cache: d.cacheHitRate,
      plan: d.planRemainingRatio,
      input: d.input,
      cacheRead: d.cacheRead,
      strip: d.stripText,
    });
    break;
  }
  if (Math.floor((Date.now()-t0)/1000) % 6 === 0) {
    console.log("waiting...", {
      elapsed: Math.floor((Date.now()-t0)/1000),
      refreshCount: d.refreshCount,
      strip: d.stripText,
      ta: await evaluate(client, `(() => (document.querySelector('textarea.composer-input')||{}).value || '')()`)
    });
  }
}
console.log("final", {
  refreshCount: last.refreshCount,
  reason: last.lastRefreshReason,
  cache: last.cacheHitRate,
  plan: last.planRemainingRatio,
  input: last.input,
  cacheRead: last.cacheRead,
  strip: last.stripText,
  grew: last.refreshCount > before.refreshCount,
});

client.close();
