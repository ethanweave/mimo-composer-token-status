import { listTargets, pickRendererTarget, connect, evaluate } from "../../inject/cdp-client.mjs";

const targets = await listTargets(9222);
const client = await connect(pickRendererTarget(targets).webSocketDebuggerUrl);
await client.send("Runtime.enable");

// Wait briefly for IPC fetch
await new Promise((r) => setTimeout(r, 1500));

const debug = await evaluate(client, `(() => window.__cts && window.__cts.debug ? window.__cts.debug() : {error:"no __cts"})()`);
console.log(JSON.stringify(debug, null, 2));

// Extra probes
const probe = await evaluate(client, `(() => {
  const el = document.getElementById('cts-token-status');
  const bar = document.querySelector('.composer-bar');
  const acct = document.querySelector('[data-account-menu]');
  const usagePct = document.querySelector('[data-usage-percent]');
  let mimoUsage = null, mimoErr = null;
  try {
    if (window.mimo && typeof window.mimo.getUserUsage === 'function') {
      // sync shape check only; actual call already in injector
      mimoUsage = typeof window.mimo.getUserUsage;
    }
  } catch (e) { mimoErr = String(e); }
  return {
    stripText: el ? el.textContent : null,
    stripAria: el ? el.getAttribute('aria-label') : null,
    stripCount: document.querySelectorAll('#cts-token-status').length,
    hasComposer: !!bar,
    hasAccountMenu: !!acct,
    hasUsagePercentDom: !!usagePct,
    mimoGetUserUsage: mimoUsage,
    mimoKeys: window.mimo ? Object.keys(window.mimo).filter(k => /usage|account|user|auth/i.test(k)) : null
  };
})()`);
console.log("--- probe ---");
console.log(JSON.stringify(probe, null, 2));

// Direct getUserUsage
const guu = await evaluate(client, `(async () => {
  try {
    const r = await window.mimo.getUserUsage();
    return r;
  } catch (e) {
    return { error: String(e && e.message || e) };
  }
})()`);
console.log("--- getUserUsage ---");
console.log(JSON.stringify(guu, null, 2));

client.close();
