/**
 * Health check after inject. Uses CDP only (localhost).
 */
import { connect, pickRendererTarget, evaluate } from "../inject/cdp-client.mjs";
import { listCdpTargets } from "./mimo-discovery.mjs";
import { DEFAULT_CDP_PORT } from "./config.mjs";

export async function healthcheck(port = DEFAULT_CDP_PORT) {
  const targets = await listCdpTargets(port);
  const target = pickRendererTarget(targets);
  if (!target || !target.webSocketDebuggerUrl) {
    return {
      ok: false,
      reason: "no-renderer",
      details: { targetCount: targets.length },
    };
  }
  let client;
  try {
    client = await connect(target.webSocketDebuggerUrl);
    await client.send("Runtime.enable").catch(() => {});
    const probe = await evaluate(
      client,
      `(() => {
        const d = window.__cts && window.__cts.debug ? window.__cts.debug() : null;
        const el = document.getElementById('cts-token-status');
        const composer = !!document.querySelector('.composer-bar');
        return {
          composer,
          hasCts: !!window.__cts,
          rev: d ? d.rev : null,
          stripCount: d ? d.stripCount : document.querySelectorAll('#cts-token-status').length,
          stripText: el ? (el.textContent || '') : (d && d.stripText) || '',
          cacheHitRate: d ? d.cacheHitRate : null,
          planRemainingRatio: d ? d.planRemainingRatio : null,
          planRemainingSource: d ? d.planRemainingSource : null,
          additionalLLMRequests: d ? d.additionalLLMRequests : 0,
          activeTimers: d ? d.activeTimers : null,
          activeObservers: d ? d.activeObservers : null,
          activeSubscriptions: d ? d.activeSubscriptions : null,
          failure: d ? d.failure : null,
        };
      })()`
    );
    const ok =
      !!probe &&
      !!probe.composer &&
      !!probe.hasCts &&
      (probe.stripCount || 0) >= 1 &&
      probe.additionalLLMRequests === 0;
    return {
      ok,
      reason: ok ? "ready" : probe && !probe.composer ? "no-composer" : "inject-missing",
      probe,
      target: { title: target.title, url: target.url },
    };
  } catch (e) {
    return { ok: false, reason: "cdp-error", error: String(e && e.message ? e.message : e) };
  } finally {
    try {
      client && client.close();
    } catch {}
  }
}
