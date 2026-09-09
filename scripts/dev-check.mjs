#!/usr/bin/env node
/**
 * Local gate: contract + format checks. No network, no LLM.
 * Run: node scripts/dev-check.mjs
 */
import { formatStatus, formatA11y, toPercent } from "../adapters/format.mjs";
import {
  cacheHitRate,
  planRemainingRatio,
  contextRemainingRatio,
  toUsageSnapshot,
  formatStrip,
  isNativePlanUsage,
} from "../inject/adapter.mjs";

let failed = 0;
const passes = [];

function check(name, actual, expected) {
  const ok = Object.is(actual, expected);
  passes.push({ name, ok, actual, expected });
  if (!ok) failed += 1;
  const mark = ok ? "OK " : "FAIL";
  console.log(`${mark} ${name}`);
  if (!ok) {
    console.log(`     expected: ${JSON.stringify(expected)}\n     actual:   ${JSON.stringify(actual)}`);
  }
}

const snap = {
  cacheHitRate: 0.962,
  planRemainingRatio: 0.72,
};

check("zh strip rounds to int", formatStatus(snap, "zh-CN"), "缓存命中率 96% · 剩余用量 72%");
check("zh compact uses 剩余", formatStatus(snap, "zh-CN", "compact"), "命中率 96% · 剩余 72%");
check("en strip rounds to int", formatStatus(snap, "en-US"), "Cache Hit Rate 96% · Usage Left 72%");
check(
  "zh a11y names Token Plan",
  formatA11y(snap, "zh-CN"),
  "缓存命中率 96%，剩余用量 72%（Token Plan）"
);
check("toPercent clamp high", toPercent(1.2), 100);
check("toPercent clamp low", toPercent(-0.1), 0);
check("toPercent null", toPercent("x"), null);

check("cache only", formatStatus({ cacheHitRate: 0.5, planRemainingRatio: undefined }, "zh-CN"), "缓存命中率 50%");
check("plan only", formatStatus({ planRemainingRatio: 0.1 }, "zh-CN"), "剩余用量 10%");
check("empty → em dash", formatStatus({}, "zh-CN"), "—");
check("no fake zeros from null", formatStatus({ cacheHitRate: null, planRemainingRatio: null }, "zh-CN"), "—");

const strip = formatStatus(snap, "zh-CN");
check("no decimal in zh", /\.\d/.test(strip), false);
check("separator is middle dot", strip.includes(" · "), true);
check("label is 剩余用量 not context leftover", strip.includes("剩余用量"), true);

// adapter math
check("cache formula", cacheHitRate({ cacheRead: 96, cacheWrite: 0, input: 4 }), 0.96);
check("plan ratio from native percent", planRemainingRatio({ percent: 72 }), 0.72);
check("plan percent clamp", planRemainingRatio({ percent: 120 }), 1);
check("plan reject non-number", planRemainingRatio({ percent: "x" }), null);
check("isNativePlanUsage", isNativePlanUsage({ percent: 10, resetDate: "2026-09-01" }), true);
check("context remaining is NOT plan", contextRemainingRatio({ input: 50, cacheRead: 0, cacheWrite: 0, output: 0 }, 100), 0.5);

const mixed = toUsageSnapshot(
  "ses_abc",
  { input: 4, cacheRead: 96, cacheWrite: 0, output: 1 },
  { percent: 72, resetDate: "2026-09-15" }
);
check("snapshot separates plan vs cache", mixed.session.planRemainingRatio, 0.72);
check("snapshot keeps cache", Math.round(mixed.session.cacheHitRate * 100), 96);
check("formatStrip full", formatStrip(mixed), "缓存命中率 96% · 剩余用量 72%");
check("formatStrip compact", formatStrip(mixed, "compact"), "命中率 96% · 剩余 72%");

// Guard: never treat context-only as plan without native plan
const contextOnly = toUsageSnapshot("ses_x", { input: 100, cacheRead: 0, cacheWrite: 0, output: 0 }, null);
check("no plan when only context usage", contextOnly.session.planRemainingRatio, null);

console.log("");
if (failed === 0) {
  console.log(`dev-check passed (${passes.length} checks).`);
  process.exit(0);
}
console.error(`dev-check failed: ${failed}/${passes.length}`);
process.exit(1);
