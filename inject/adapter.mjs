/**
 * MiMo → UsageSnapshot adapter (FINAL)
 *
 * Two independent metrics:
 *
 * A. cacheHitRate — current conversation usage (Context Ring store entry)
 *    usageByConvo[convoId] ≈ { input, output, reasoning, cacheRead, cacheWrite, modelId?, providerId? }
 *    cacheHitRate = cacheRead / max(cacheRead + cacheWrite + input, 1)
 *
 * B. planRemainingRatio — MiMo Account / Token Plan Remaining Usage
 *    Native source (confirmed):
 *      window.mimo.getUserUsage() / IPC mimo:getUserUsage / GET {base}/user/usage
 *      payload: { percent: number, resetDate: string }
 *    Native UI: Math.round(percent)  with label 剩余用量 / Remaining usage
 *    planRemainingRatio = percent / 100
 *
 * Context Window remaining is debug-only (contextRemainingRatio).
 * It MUST NOT be used as Token Plan remaining.
 *
 * Zero LLM calls. Read-only local / account-bridge data.
 */

/**
 * @typedef {Object} RawUsageEntry
 * @property {number} [input]
 * @property {number} [output]
 * @property {number} [reasoning]
 * @property {number} [cacheRead]
 * @property {number} [cacheWrite]
 * @property {string} [modelId]
 * @property {string} [providerId]
 */

/**
 * @typedef {Object} NativePlanUsage
 * @property {number} percent   // remaining percent 0–100+
 * @property {string} [resetDate]
 */

/**
 * @typedef {Object} UsageSnapshot
 * @property {number} schemaVersion
 * @property {{
 *   id: string,
 *   cacheHitRate: number|null,
 *   planRemainingRatio: number|null,
 *   planRemainingPercent?: number|null,
 *   planResetDate?: string|null,
 *   planRemainingSource?: string,
 *   contextRemainingRatio?: number|null,
 *   inputTokens?: number|null,
 *   outputTokens?: number|null,
 *   cacheReadTokens?: number|null,
 *   cacheWriteTokens?: number|null,
 *   model?: string|null
 * }} session
 */

const clamp01 = (n) => (typeof n === "number" && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : null);

/** Same as b0e */
export function cacheHitRate(u) {
  if (!u) return null;
  const denom = (u.cacheRead || 0) + (u.cacheWrite || 0) + (u.input || 0);
  if (!(denom > 0)) return null;
  const r = (u.cacheRead || 0) / denom;
  return Number.isFinite(r) ? Math.min(1, Math.max(0, r)) : null;
}

/** Same as TD */
export function totalTokens(u) {
  return (u.input || 0) + (u.cacheRead || 0) + (u.cacheWrite || 0) + (u.output || 0);
}

/** Context window remaining — DEBUG ONLY, never Token Plan. */
export function contextRemainingRatio(u, limit) {
  const total = totalTokens(u);
  if (!limit || limit <= 0 || total <= 0) return null;
  return Math.min(1, Math.max(0, 1 - total / limit));
}

/** Native plan percent → ratio. percent is already remaining. */
export function planRemainingRatio(plan) {
  if (!plan || typeof plan.percent !== "number" || !Number.isFinite(plan.percent)) return null;
  const pct = Math.min(100, Math.max(0, plan.percent));
  return pct / 100;
}

export function isNativePlanUsage(plan) {
  return !!(
    plan &&
    typeof plan === "object" &&
    typeof plan.percent === "number" &&
    Number.isFinite(plan.percent) &&
    plan.percent >= 0
  );
}

/**
 * @param {string} id
 * @param {RawUsageEntry|null|undefined} raw
 * @param {NativePlanUsage|null|undefined} plan
 * @returns {UsageSnapshot|null}
 */
export function toUsageSnapshot(id, raw, plan = null) {
  const cache = raw ? cacheHitRate(raw) : null;
  const planRatio = planRemainingRatio(plan);
  if (cache == null && planRatio == null) return null;
  return {
    schemaVersion: 1,
    session: {
      id: id || "unknown",
      cacheHitRate: cache,
      planRemainingRatio: planRatio,
      planRemainingPercent: isNativePlanUsage(plan)
        ? Math.min(100, Math.max(0, plan.percent))
        : null,
      planResetDate: plan && plan.resetDate != null ? plan.resetDate : null,
      planRemainingSource: planRatio != null ? "native-account-ui" : "none",
      contextRemainingRatio: null,
      inputTokens: raw ? raw.input || 0 : null,
      outputTokens: raw ? raw.output || 0 : null,
      cacheReadTokens: raw ? raw.cacheRead || 0 : null,
      cacheWriteTokens: raw ? raw.cacheWrite || 0 : null,
      model: raw ? raw.modelId || null : null,
    },
  };
}

/** Footer copy — integers, no decimals (DECISIONS) */
export function formatStrip(snap, mode = "full") {
  const s = snap && snap.session ? snap.session : null;
  if (!s) return "—";
  const cache = s.cacheHitRate == null ? null : Math.round(s.cacheHitRate * 100);
  const left = s.planRemainingRatio == null ? null : Math.round(s.planRemainingRatio * 100);
  const planLabel = mode === "compact" ? "剩余" : "剩余用量";
  const cacheLabel = mode === "compact" ? "命中率" : "缓存命中率";
  if (cache == null && left == null) return "—";
  if (cache != null && left != null) return `${cacheLabel} ${cache}% · ${planLabel} ${left}%`;
  if (cache != null) return `${cacheLabel} ${cache}%`;
  return `${planLabel} ${left}%`;
}

export function formatA11y(snap) {
  const s = snap && snap.session ? snap.session : null;
  if (!s) return "暂无用量数据";
  const parts = [];
  if (s.cacheHitRate != null) parts.push(`缓存命中率 ${Math.round(s.cacheHitRate * 100)}%`);
  if (s.planRemainingRatio != null) {
    parts.push(`剩余用量 ${Math.round(s.planRemainingRatio * 100)}%（Token Plan）`);
  }
  return parts.length ? parts.join("，") : "暂无用量数据";
}
