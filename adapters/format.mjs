/**
 * Usage → footer string (no LLM, no polling of models).
 * Contract: schemaVersion 1
 *
 * cacheHitRate     = conversation cache hit
 * planRemainingRatio = Token Plan / Account Quota remaining (NOT context window)
 */
import { readFileSync } from "node:fs";

export function clamp01(n) {
  if (typeof n !== "number" || Number.isNaN(n)) return null;
  return Math.min(1, Math.max(0, n));
}

export function toPercent(ratio) {
  const r = clamp01(ratio);
  if (r === null) return null;
  return Math.round(r * 100);
}

/**
 * @param {{ cacheHitRate?: number|null, planRemainingRatio?: number|null }} session
 * @param {string} locale
 * @param {"full"|"compact"} mode
 */
export function formatStatus(session, locale = "zh-CN", mode = "full") {
  const cache = toPercent(session?.cacheHitRate);
  const left = toPercent(session?.planRemainingRatio);
  if (cache === null && left === null) return "—";

  if (locale.startsWith("zh")) {
    const cacheLabel = mode === "compact" ? "命中率" : "缓存命中率";
    const planLabel = mode === "compact" ? "剩余" : "剩余用量";
    if (cache !== null && left !== null) return `${cacheLabel} ${cache}% · ${planLabel} ${left}%`;
    if (cache !== null) return `${cacheLabel} ${cache}%`;
    return `${planLabel} ${left}%`;
  }
  if (cache !== null && left !== null) return `Cache Hit Rate ${cache}% · Usage Left ${left}%`;
  if (cache !== null) return `Cache Hit Rate ${cache}%`;
  return `Usage Left ${left}%`;
}

export function formatA11y(session, locale = "zh-CN") {
  const cache = toPercent(session?.cacheHitRate);
  const left = toPercent(session?.planRemainingRatio);
  if (cache === null && left === null) return "暂无用量数据";
  if (locale.startsWith("zh")) {
    if (cache !== null && left !== null) {
      return `缓存命中率 ${cache}%，剩余用量 ${left}%（Token Plan）`;
    }
    return cache !== null ? `缓存命中率 ${cache}%` : `剩余用量 ${left}%（Token Plan）`;
  }
  if (cache !== null && left !== null) return `Cache hit rate ${cache}%, ${left}% plan remaining`;
  return cache !== null ? `Cache hit rate ${cache}%` : `${left}% plan remaining`;
}

/** Demo snapshot only — replace with host native sources in production inject */
export const demoSnapshot = {
  schemaVersion: 1,
  session: {
    id: "sess_demo",
    cacheHitRate: 0.962,
    planRemainingRatio: 0.72,
    planRemainingPercent: 72,
    planResetDate: "2026-09-15",
    planRemainingSource: "native-account-ui",
    inputTokens: 19400,
    outputTokens: 2200,
    cacheReadTokens: 443800,
    cacheWriteTokens: 0,
    model: "provider/model",
  },
};

function main() {
  const args = process.argv.slice(2);
  let snapshot = demoSnapshot;
  const fileIdx = args.indexOf("--file");
  if (fileIdx !== -1 && args[fileIdx + 1]) {
    snapshot = JSON.parse(readFileSync(args[fileIdx + 1], "utf8"));
  }
  const locale = args.includes("--en") ? "en-US" : "zh-CN";
  const session = snapshot.session ?? snapshot;
  console.log(formatStatus(session, locale));
  console.log(formatA11y(session, locale));
}

const entry = process.argv[1] ? process.argv[1].replace(/\\/g, "/") : "";
if (entry.endsWith("format.mjs")) {
  main();
}
