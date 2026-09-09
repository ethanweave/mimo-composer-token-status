#!/usr/bin/env node
/**
 * Composer Token Status Bootstrap v2.1.0
 *
 * Discovers MiMo, ensures CDP (via launcher shortcut or already-open port),
 * injects FROZEN runtime, health-checks, then watches with slow backoff.
 *
 * Network: localhost CDP only.
 * No LLM. No telemetry. No app.asar writes.
 *
 * Usage:
 *   node bootstrap/bootstrap.mjs              # one-shot attach + inject
 *   node bootstrap/bootstrap.mjs --watch      # persistent enablement
 *   node bootstrap/bootstrap.mjs --status     # discovery + health only
 *   node bootstrap/bootstrap.mjs --launch     # start MiMo with CDP if not running
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
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
const WATCH = args.has("--watch");
const STATUS_ONLY = args.has("--status");
const LAUNCH = args.has("--launch") || WATCH; // watch mode may launch once
const PORT = Number(process.env.CTS_CDP_PORT || DEFAULT_CDP_PORT);

function log(msg) {
  // human logs on stderr so --status stdout stays pure JSON
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
    // Idempotent: runtime destroy()s previous instance first
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

function launchMimoWithCdp(exe, port) {
  if (!exe) return { ok: false, reason: "mimo-not-found" };
  if (mimoRunning()) {
    return { ok: false, reason: "already-running", limitation: "mimo-already-running" };
  }
  log(`launching MiMo with --remote-debugging-port=${port}`);
  const child = spawn(exe, [`--remote-debugging-port=${port}`], {
    detached: true,
    stdio: "ignore",
    windowsHide: false,
  });
  child.unref();
  return { ok: true, pid: child.pid };
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function once() {
  const disc = await discover(PORT);
  log(
    `discover installed=${disc.mimoInstalled} running=${disc.mimoRunning} cdp=${disc.cdpReady} port=${PORT}`
  );
  if (!disc.mimoInstalled) {
    return { ok: false, step: "discover", ...disc };
  }
  if (!disc.cdpReady) {
    if (STATUS_ONLY) return { ok: false, step: "cdp", ...disc };
    if (!disc.mimoRunning && (LAUNCH || args.has("--launch"))) {
      const launched = launchMimoWithCdp(disc.mimoExe, PORT);
      if (!launched.ok) return { ok: false, step: "launch", ...launched };
      // wait for CDP up to ~20s
      for (let i = 0; i < 20; i++) {
        await sleep(1000);
        const d = await discover(PORT);
        if (d.cdpReady) break;
      }
      const d2 = await discover(PORT);
      if (!d2.cdpReady) {
        return {
          ok: false,
          step: "cdp-wait",
          limitation: "MiMo started but CDP port did not open",
        };
      }
    } else {
      return {
        ok: false,
        step: "cdp",
        ...disc,
        hint: "Start MiMo via the 'MiMo (Token Status)' shortcut, or restart MiMo with --remote-debugging-port",
      };
    }
  }
  if (STATUS_ONLY) {
    const h = await healthcheck(PORT);
    return { ok: h.ok, step: "status", health: h, discover: disc };
  }
  const inj = await injectOnce();
  if (!inj.ok) {
    return { ok: false, step: "inject", ...inj };
  }
  const h = await healthcheck(PORT);
  return {
    ok: true,
    step: "ready",
    version: VERSION,
    inject: inj.after,
    health: h,
    discover: await discover(PORT),
  };
}

async function watchLoop() {
  log(`watch mode v${VERSION} port=${PORT} (backoff 5s, not 1s)`);
  let launchedOnce = false;
  let lastFail = "";
  while (true) {
    try {
      const disc = await discover(PORT);
      if (!disc.mimoInstalled) {
        await sleep(15000);
        continue;
      }
      if (!disc.cdpReady) {
        if (!disc.mimoRunning && !launchedOnce) {
          const l = launchMimoWithCdp(disc.mimoExe, PORT);
          launchedOnce = true;
          log(`auto-launch: ${JSON.stringify(l)}`);
        } else if (disc.mimoRunning && disc.cdpReady === false) {
          const msg = "MiMo running without CDP — use Token Status shortcut / relaunch with port";
          if (msg !== lastFail) {
            log(msg);
            lastFail = msg;
          }
        }
        await sleep(5000);
        continue;
      }
      // CDP open — ensure injected (idempotent)
      const inj = await injectOnce();
      if (inj.ok) {
        if (lastFail) lastFail = "";
        log(`injected rev=${inj.after && inj.after.rev} strip=${inj.after && inj.after.stripText}`);
      } else {
        log(`inject skip/fail: ${inj.reason || inj.error || ""}`);
      }
      // After success, poll less often to keep CPU near idle
      await sleep(12000);
    } catch (e) {
      log(`watch error: ${e && e.message ? e.message : e}`);
      await sleep(8000);
    }
  }
}

async function main() {
  const installRoot = resolveInstallRoot();
  const cfg = loadConfig(installRoot);
  if (WATCH) {
    await watchLoop();
    return;
  }
  const result = await once();
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}

main().catch((e) => {
  console.error("[cts-bootstrap] fatal", e);
  process.exit(1);
});
