#!/usr/bin/env node
/**
 * Composer Token Status Bootstrap v2.3.1
 *
 * One-shot companion: WAIT FOR CDP → ATTACH → INJECT → EXIT.
 * CDP ready ≠ Composer ready: no-composer gets a bounded retry, then exit.
 * Never launches MiMo. Never keeps a long-lived process after inject.
 *
 * Network: localhost CDP only.
 * No LLM. No telemetry. No app.asar writes.
 *
 * Usage:
 *   node bootstrap/bootstrap.mjs              # one-shot attach + inject
 *   node bootstrap/bootstrap.mjs --status     # discovery + health only
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { connect, pickRendererTarget, evaluate } from "../inject/cdp-client.mjs";
import {
  DEFAULT_CDP_PORT,
  VERSION,
  findMimoExe,
  loadConfig,
  resolveInstallRoot,
} from "./config.mjs";
import { discover, listCdpTargets, mimoRunning } from "./mimo-discovery.mjs";
import { healthcheck } from "./healthcheck.mjs";

const args = new Set(process.argv.slice(2));
const STATUS_ONLY = args.has("--status");
const PORT = Number(process.env.CTS_CDP_PORT || DEFAULT_CDP_PORT);

// Bounded readiness wait — never infinite, never daemon.
const CDP_WAIT_MAX_MS = 20000;
const CDP_WAIT_INTERVAL_MS = 500;
// CDP open ≠ composer mounted. Retry only on no-composer, then give up.
const COMPOSER_WAIT_MAX_MS = 15000;
const COMPOSER_WAIT_INTERVAL_MS = 500;

function log(msg) {
  console.error(`[cts-bootstrap] ${msg}`);
}

function repoRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

function injectSourcePath() {
  const root = repoRoot();
  const p = path.join(root, "inject", "runtime-inject.js");
  if (!fs.existsSync(p)) throw new Error("runtime-inject.js missing: " + p);
  return p;
}

async function injectOnce() {
  const targets = await listCdpTargets(PORT);
  const target = pickRendererTarget(targets);
  if (!target || !target.webSocketDebuggerUrl) {
    return { ok: false, reason: "no-renderer" };
  }
  const source = fs.readFileSync(injectSourcePath(), "utf8");
  const client = await connect(target.webSocketDebuggerUrl);
  try {
    await client.send("Runtime.enable").catch(() => {});
    const before = await evaluate(
      client,
      `(() => ({
        cts: !!window.__cts,
        rev: window.__cts ? window.__cts.__rev : null,
        composer: !!document.querySelector('.composer-bar'),
        stripCount: document.querySelectorAll('#cts-token-status').length
      }))()`
    );
    if (!before || !before.composer) {
      return { ok: false, reason: "no-composer" };
    }
    await client.send("Runtime.evaluate", {
      expression: source + "\n;undefined;",
      returnByValue: true,
      awaitPromise: true,
    });
    const after = await evaluate(
      client,
      `(() => {
        const d = window.__cts && window.__cts.debug ? window.__cts.debug() : null;
        return {
          rev: d ? d.rev : null,
          stripCount: d ? d.stripCount : 0,
          stripText: d ? d.stripText : '',
          cacheHitRate: d ? d.cacheHitRate : null,
          planRemainingRatio: d ? d.planRemainingRatio : null,
          planRemainingSource: d ? d.planRemainingSource : null,
          additionalLLMRequests: d ? d.additionalLLMRequests : 0,
          activeTimers: d ? d.activeTimers : null,
          activeObservers: d ? d.activeObservers : null,
        };
      })()`
    );
    return { ok: true, before, after, targetTitle: target.title };
  } catch (e) {
    return { ok: false, reason: "inject-error", error: String(e && e.message ? e.message : e) };
  } finally {
    try {
      client.close();
    } catch {}
  }
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForCdp() {
  const deadline = Date.now() + CDP_WAIT_MAX_MS;
  while (Date.now() < deadline) {
    const disc = await discover(PORT);
    if (disc.cdpReady) return disc;
    await sleep(CDP_WAIT_INTERVAL_MS);
  }
  return discover(PORT);
}

/**
 * Inject with bounded retry ONLY for no-composer.
 * Other failures (attach/eval/target) fail immediately.
 */
async function injectWithComposerRetry() {
  const deadline = Date.now() + COMPOSER_WAIT_MAX_MS;
  let attempts = 0;
  let last = null;
  while (true) {
    attempts++;
    last = await injectOnce();
    if (last.ok) return { ...last, attempts };
    if (last.reason !== "no-composer") return { ...last, attempts };
    if (Date.now() >= deadline) {
      return {
        ...last,
        attempts,
        timedOut: true,
        hint: `composer not ready within ${COMPOSER_WAIT_MAX_MS}ms`,
      };
    }
    log(`no-composer (attempt ${attempts}), retry in ${COMPOSER_WAIT_INTERVAL_MS}ms`);
    await sleep(COMPOSER_WAIT_INTERVAL_MS);
  }
}

async function once() {
  let disc = await discover(PORT);
  log(
    `discover installed=${disc.mimoInstalled} running=${disc.mimoRunning} cdp=${disc.cdpReady} port=${PORT}`
  );
  if (!disc.mimoInstalled) {
    return { ok: false, step: "discover", ...disc };
  }
  if (!disc.cdpReady) {
    if (STATUS_ONLY) return { ok: false, step: "cdp", ...disc };
    // Bounded wait for wrapper-spawned MiMo to open CDP. Never launch MiMo ourselves.
    log(`waiting for CDP up to ${CDP_WAIT_MAX_MS}ms`);
    disc = await waitForCdp();
    if (!disc.cdpReady) {
      return {
        ok: false,
        step: "cdp-timeout",
        ...disc,
        hint: disc.mimoRunning && !disc.cdpReady
          ? "MiMo is running WITHOUT --remote-debugging-port. Relaunch via the Xiaomi MiMo wrapper shortcut."
          : "MiMo did not open CDP in time. Launch MiMo via the Xiaomi MiMo wrapper shortcut.",
      };
    }
  }
  if (STATUS_ONLY) {
    const h = await healthcheck(PORT);
    return { ok: h.ok, step: "status", health: h, discover: disc };
  }
  const inj = await injectWithComposerRetry();
  if (!inj.ok) {
    return {
      ok: false,
      step: inj.reason === "no-composer" ? "composer-timeout" : "inject",
      ...inj,
    };
  }
  log(`injected after ${inj.attempts} attempt(s)`);
  const h = await healthcheck(PORT);
  return {
    ok: true,
    step: "ready",
    version: VERSION,
    injectAttempts: inj.attempts,
    inject: inj.after,
    health: h,
    discover: await discover(PORT),
  };
}

async function main() {
  const installRoot = resolveInstallRoot();
  loadConfig(installRoot);
  const result = await once();
  console.log(JSON.stringify(result, null, 2));
  // Force exit — CDP sockets / undici keep the event loop alive otherwise.
  process.exit(result.ok ? 0 : 1);
}

main().catch((e) => {
  console.error("[cts-bootstrap] fatal", e);
  process.exit(1);
});
