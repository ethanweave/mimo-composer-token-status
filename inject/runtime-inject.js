/**
 * Composer Token Status — runtime injector v2.0 (MiMo Desktop)
 *
 * UI:
 *   缓存命中率 XX% · 剩余用量 XX%
 *
 * Metrics (locked):
 *   cacheHitRate      = current conversation Prompt Cache Hit Rate
 *                       (native b0e: cacheRead / (cacheRead + cacheWrite + input))
 *   planRemaining     = Account Token Plan remaining
 *                       (window.mimo.getUserUsage() → percent/100)
 *   NEVER Context Ring / contextLimit / stroke-dasharray
 *
 * Refresh (locked):
 *   Event-driven only — NO setInterval / setTimeout loops / rAF / MutationObserver.
 *   Agent completion:
 *     window.mimo.onHarnessDone  → mimo:harnessDone
 *     window.mimo.onChatDone     → chat completion
 *   Microtask-coalesced: at most one refresh per completion burst.
 *   Manual: window.__cts.refresh()
 *
 * Zero LLM · no app.asar · destroy() on reinject.
 */
(function () {
  try {
    if (window.__cts) {
      try {
        if (typeof window.__cts.destroy === "function") window.__cts.destroy();
      } catch (e1) {}
      try {
        delete window.__cts;
      } catch (e2) {
        window.__cts = undefined;
      }
    }
  } catch (e0) {}

  var STRIP_ID = "cts-token-status";
  var STYLE_ID = "cts-token-status-css";
  var DATA_CTS = "token-status";
  var SCHEMA = 1;
  var REV = 20;
  var alive = true;
  var last = null;
  var lastError = null;
  var activeTimers = 0;
  var activeObservers = 0;
  var activeSubscriptions = 0;
  var lastRefreshAt = null;
  var lastRefreshReason = null;
  var lastUsageUpdateAt = null;
  var refreshQueued = false;
  var refreshCount = 0;
  var paintedText = "";

  function totalOf(u) {
    return (u.input || 0) + (u.cacheRead || 0) + (u.cacheWrite || 0) + (u.output || 0);
  }

  /**
   * Native b0e — MiMo Context HUD cache hit.
   * Confirmed from bundle:
   *   TD = input + cacheRead + cacheWrite + output  (context used)
   *   A0e maps tokens.input → usage.input (fresh / uncached input)
   *   tokens.cache.read → cacheRead
   * Therefore input does NOT include cacheRead; formula is:
   *   cacheRead / (cacheRead + cacheWrite + input)
   */
  function cacheHitOf(u) {
    if (!u) return null;
    var denom = (u.cacheRead || 0) + (u.cacheWrite || 0) + (u.input || 0);
    if (!(denom > 0)) return null;
    var r = (u.cacheRead || 0) / denom;
    if (!isFinite(r)) return null;
    return Math.min(1, Math.max(0, r));
  }

  function fiberKey(el) {
    if (!el) return null;
    var keys = Object.keys(el);
    for (var i = 0; i < keys.length; i++) {
      if (keys[i].indexOf("__reactFiber$") === 0) return el[keys[i]];
    }
    return null;
  }

  function findPjeFiber() {
    var nodes = document.querySelectorAll("[data-ctx-hud], .ctx-hud, .composer-bar");
    for (var n = 0; n < nodes.length && n < 12; n++) {
      var f = fiberKey(nodes[n]);
      var hops = 0;
      while (f && hops++ < 40) {
        if (typeof f.type === "function" && f.type.name === "Pje") return f;
        f = f.return;
      }
    }
    return null;
  }

  function isUsageLike(v) {
    return (
      v &&
      typeof v === "object" &&
      typeof v.input === "number" &&
      typeof v.cacheRead === "number" &&
      typeof v.output === "number"
    );
  }

  function trySelector(fn) {
    if (typeof fn !== "function") return undefined;
    try {
      return fn();
    } catch (e) {
      return undefined;
    }
  }

  /** Bounded Pje hook pass only. */
  function readUsageFromPje() {
    var pje = findPjeFiber();
    if (!pje) return { usage: null, convoId: null, found: false };
    var usage = null;
    var convoId = null;
    var h = pje.memoizedState;
    var i = 0;
    var calls = 0;
    while (h && i++ < 32) {
      var ms = h.memoizedState;
      var fns = [];
      if (typeof ms === "function") fns.push(ms);
      if (ms && typeof ms === "object") {
        if (Array.isArray(ms) && typeof ms[0] === "function") fns.push(ms[0]);
        if (typeof ms.memoizedState === "function") fns.push(ms.memoizedState);
        if (Array.isArray(ms.memoizedState) && typeof ms.memoizedState[0] === "function") {
          fns.push(ms.memoizedState[0]);
        }
      }
      for (var c = 0; c < fns.length && calls < 40; c++) {
        calls++;
        var v = trySelector(fns[c]);
        if (typeof v === "string" && v.indexOf("ses_") === 0 && !convoId) convoId = v;
        if (isUsageLike(v)) {
          if (!usage || totalOf(v) >= totalOf(usage)) usage = v;
        }
      }
      h = h.next;
    }
    return { usage: usage, convoId: convoId, found: !!usage };
  }

  function readPlanRemaining() {
    return (async function () {
      if (!alive) return { ratio: null, source: "none", error: "destroyed" };
      var mimo = window.mimo;
      if (!mimo || typeof mimo.getUserUsage !== "function") {
        return { ratio: null, source: "none", error: "window.mimo.getUserUsage unavailable" };
      }
      try {
        var result = await mimo.getUserUsage();
        if (!alive) return { ratio: null, source: "none", error: "destroyed" };
        if (!result || result.ok === false) {
          return {
            ratio: null,
            source: "none",
            error: result && result.error ? result.error : "getUserUsage not ok",
            kind: result && result.kind,
          };
        }
        var usage = result.usage || result;
        if (usage && typeof usage.percent === "number" && isFinite(usage.percent)) {
          return {
            ratio: Math.min(1, Math.max(0, usage.percent / 100)),
            percent: usage.percent,
            resetDate: usage.resetDate || null,
            source: "mimo:getUserUsage",
            method: "window.mimo.getUserUsage",
          };
        }
        return { ratio: null, source: "none", error: "usage.percent missing" };
      } catch (e) {
        return { ratio: null, source: "none", error: String(e && e.message ? e.message : e) };
      }
    })();
  }

  function format(cache, planRem) {
    if (cache == null && planRem == null) return "";
    var cacheTxt = cache == null ? null : "缓存命中率 " + Math.round(cache * 100) + "%";
    var planTxt = planRem == null ? null : "剩余用量 " + Math.round(planRem * 100) + "%";
    if (cacheTxt && planTxt) return cacheTxt + " · " + planTxt;
    if (cacheTxt) return cacheTxt;
    return planTxt;
  }

  function formatCompact(cache, planRem) {
    if (cache == null && planRem == null) return "";
    var cacheTxt = cache == null ? null : "命中率 " + Math.round(cache * 100) + "%";
    var planTxt = planRem == null ? null : "剩余 " + Math.round(planRem * 100) + "%";
    if (cacheTxt && planTxt) return cacheTxt + " · " + planTxt;
    if (cacheTxt) return cacheTxt;
    return planTxt;
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement("style");
    s.id = STYLE_ID;
    s.setAttribute("data-cts", STYLE_ID);
    s.textContent =
      ".cb-center[data-token-status]{flex:1 1 0;min-width:0;display:flex;align-items:center;justify-content:center;font-size:11px;line-height:1.2;color:var(--text-mut,var(--text-secondary,var(--mut,#8e8e93)));white-space:nowrap;user-select:none;pointer-events:none;padding:0 8px;overflow:hidden;text-overflow:ellipsis;box-sizing:border-box;}" +
      ".cb-center[data-token-status].cts-hide{display:none!important;}" +
      ".cb-center[data-token-status] .cts-full{display:inline;}" +
      ".cb-center[data-token-status] .cts-compact{display:none;}" +
      "@media (max-width:560px){.cb-center[data-token-status]{font-size:10px;padding:0 4px;}}" +
      "@media (max-width:500px){.cb-center[data-token-status] .cts-full{display:none;}.cb-center[data-token-status] .cts-compact{display:inline;}}" +
      "@media (max-width:420px){.cb-center[data-token-status]{display:none!important;}}";
    (document.head || document.documentElement).appendChild(s);
  }

  function ensureNode(bar) {
    var all = document.querySelectorAll("#" + STRIP_ID);
    for (var j = 1; j < all.length; j++) {
      if (all[j].parentNode) all[j].parentNode.removeChild(all[j]);
    }
    var n = document.getElementById(STRIP_ID);
    if (n && n.parentNode === bar) return n;
    if (n && n.parentNode) n.parentNode.removeChild(n);
    n = document.createElement("div");
    n.id = STRIP_ID;
    n.className = "cb-center";
    n.setAttribute("data-token-status", "");
    n.setAttribute("data-cts", DATA_CTS);
    n.setAttribute("role", "status");
    var left = bar.querySelector(".cb-left");
    var right = bar.querySelector(".cb-right");
    try {
      if (left && right && left.parentNode === bar && right.parentNode === bar) {
        bar.insertBefore(n, right);
      } else {
        bar.appendChild(n);
      }
    } catch (e) {
      return null;
    }
    return n;
  }

  function paint(full, compact) {
    var text = full || "";
    if (text === paintedText) return;
    paintedText = text;
    var bars = document.querySelectorAll(".composer-bar");
    for (var b = 0; b < bars.length; b++) {
      var node = ensureNode(bars[b]);
      if (!node) continue;
      if (!text) {
        node.classList.add("cts-hide");
        node.textContent = "";
        node.setAttribute("aria-hidden", "true");
        continue;
      }
      node.classList.remove("cts-hide");
      node.removeAttribute("aria-hidden");
      node.textContent = "";
      var fullSpan = document.createElement("span");
      fullSpan.className = "cts-full";
      fullSpan.textContent = full;
      var compactSpan = document.createElement("span");
      compactSpan.className = "cts-compact";
      compactSpan.textContent = compact || full;
      node.appendChild(fullSpan);
      node.appendChild(compactSpan);
    }
  }

  function buildFrom(usage, plan) {
    var cache = cacheHitOf(usage);
    var planRem = plan && plan.ratio != null ? plan.ratio : null;
    if (cache == null && planRem == null) {
      lastError = {
        source: "none",
        reason: "no usage and no plan remaining",
        planError: plan && plan.error,
      };
      return { ok: false, cache: null, planRem: null };
    }
    lastError = null;
    return { ok: true, cache: cache, planRem: planRem, usage: usage, plan: plan };
  }

  /**
   * One refresh pass. reason is recorded for debug.
   * Does not schedule further work.
   */
  function refresh(reason) {
    if (!alive) return Promise.resolve(null);
    lastRefreshReason = reason || "manual";
    lastRefreshAt = Date.now();
    refreshCount++;
    try {
      ensureStyle();
      var u = readUsageFromPje();
      if (u.found) lastUsageUpdateAt = Date.now();
      return readPlanRemaining().then(function (plan) {
        if (!alive) return null;
        var built = buildFrom(u.usage, plan);
        last = built.ok
          ? {
              schemaVersion: SCHEMA,
              session: {
                id: u.convoId || null,
                cacheHitRate: built.cache,
                planRemainingRatio: built.planRem,
                planRemainingSource: plan && plan.source ? plan.source : "none",
                cacheMetricScope: "conversation-cumulative",
                inputTokens: u.usage ? u.usage.input : null,
                outputTokens: u.usage ? u.usage.output : null,
                reasoningTokens: u.usage ? u.usage.reasoning || 0 : null,
                cacheReadTokens: u.usage ? u.usage.cacheRead : null,
                cacheWriteTokens: u.usage ? u.usage.cacheWrite : null,
                totalTokens: u.usage ? totalOf(u.usage) : null,
                model: u.usage ? u.usage.modelId || null : null,
                planPercent: plan && plan.percent != null ? plan.percent : null,
                planResetDate: plan && plan.resetDate ? plan.resetDate : null,
                updatedAt: Date.now(),
              },
            }
          : null;
        var cache = last ? last.session.cacheHitRate : null;
        var planRem = last ? last.session.planRemainingRatio : null;
        paint(format(cache, planRem), formatCompact(cache, planRem));
        return last;
      });
    } catch (e) {
      lastError = { source: "error", message: String(e && e.message ? e.message : e) };
      last = null;
      paintedText = "";
      paint("", "");
      return Promise.resolve(null);
    }
  }

  /**
   * Coalesce bursts (completion + usage event) into one microtask refresh.
   * Not a timer. Not a poll.
   */
  function scheduleRefresh(reason) {
    if (!alive) return;
    lastRefreshReason = reason || lastRefreshReason;
    if (refreshQueued) return;
    refreshQueued = true;
    Promise.resolve().then(function () {
      refreshQueued = false;
      if (!alive) return;
      refresh(lastRefreshReason || "agent-completed");
    });
  }

  function onNativeEvent(reason) {
    return function () {
      if (!alive) return;
      lastUsageUpdateAt = Date.now();
      scheduleRefresh(reason || "agent-completed");
    };
  }

  /**
   * Event-driven subscriptions only.
   * preload: onHarnessDone(cb) → mimo:harnessDone
   *          onChatDone(cb)    → chat completion
   * ipcRenderer.on has no public unsubscribe via preload; we gate with `alive`.
   */
  function subscribeNative() {
    var mimo = window.mimo;
    if (!mimo) return;
    try {
      if (typeof mimo.onHarnessDone === "function") {
        mimo.onHarnessDone(onNativeEvent("agent-completed"));
        activeSubscriptions++;
      }
    } catch (e) {}
    try {
      if (typeof mimo.onChatDone === "function") {
        mimo.onChatDone(onNativeEvent("agent-completed"));
        activeSubscriptions++;
      }
    } catch (e2) {}
    try {
      // usage store push may arrive around completion; coalesced to same refresh
      if (typeof mimo.onHarnessEvent === "function") {
        mimo.onHarnessEvent(function (origin, ev) {
          if (!alive) return;
          if (ev && ev.kind === "usage") {
            lastUsageUpdateAt = Date.now();
            scheduleRefresh("usage-updated");
          }
        });
        activeSubscriptions++;
      }
    } catch (e3) {}
  }

  function destroy() {
    alive = false;
    activeTimers = 0;
    activeObservers = 0;
    activeSubscriptions = 0;
    try {
      var nodes = document.querySelectorAll("#" + STRIP_ID + ", [data-cts='" + DATA_CTS + "']");
      for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].parentNode) nodes[i].parentNode.removeChild(nodes[i]);
      }
      var st = document.getElementById(STYLE_ID);
      if (st && st.parentNode) st.parentNode.removeChild(st);
    } catch (e) {}
    paintedText = "";
  }

  /* orphan cleanup from older revs */
  try {
    document.querySelectorAll("#" + STRIP_ID + ", [data-cts='" + DATA_CTS + "']").forEach(function (n) {
      if (n.parentNode) n.parentNode.removeChild(n);
    });
    var oldStyle = document.getElementById(STYLE_ID);
    if (oldStyle && oldStyle.parentNode) oldStyle.parentNode.removeChild(oldStyle);
  } catch (e) {}

  ensureStyle();
  subscribeNative();
  var kick = refresh("inject");

  window.__cts = {
    __live: true,
    __rev: REV,
    schemaVersion: SCHEMA,
    refresh: function () {
      return refresh("manual");
    },
    getSnapshot: function () {
      return last;
    },
    destroy: destroy,
    debug: function () {
      var s = last && last.session ? last.session : null;
      var out = {
        source: s ? "fiber+plan" : lastError ? lastError.source || "none" : "none",
        conversationId: s ? s.id : null,
        cacheHitRate: s ? s.cacheHitRate : null,
        cacheMetricScope: "conversation-cumulative",
        input: s ? s.inputTokens : null,
        output: s ? s.outputTokens : null,
        reasoning: s ? s.reasoningTokens : null,
        cacheRead: s ? s.cacheReadTokens : null,
        cacheWrite: s ? s.cacheWriteTokens : null,
        totalTokens: s ? s.totalTokens : null,
        model: s ? s.model : null,
        planRemainingRatio: s ? s.planRemainingRatio : null,
        planRemainingPercent: s ? s.planPercent : null,
        planRemainingSource: s ? s.planRemainingSource : "none",
        remainingSource: s ? s.planRemainingSource : "none",
        planResetDate: s ? s.planResetDate : null,
        lastUsageUpdateAt: lastUsageUpdateAt,
        lastRefreshAt: lastRefreshAt,
        lastRefreshReason: lastRefreshReason,
        refreshCount: refreshCount,
        additionalLLMRequests: 0,
        activeTimers: activeTimers,
        activeObservers: activeObservers,
        activeSubscriptions: activeSubscriptions,
        stripCount: document.querySelectorAll("#" + STRIP_ID).length,
        stripText: (document.getElementById(STRIP_ID) || {}).textContent || "",
        failure: lastError,
        rev: REV,
      };
      try {
        console.log("[cts]", out);
      } catch (e) {}
      return out;
    },
  };
  try {
    console.log(
      "[cts] ready rev=" +
        REV +
        " · event-driven · 0 timers · 0 observers · 0 LLM · subs=" +
        activeSubscriptions
    );
  } catch (e) {}
  return kick.then(function () {
    return window.__cts;
  });
})();
