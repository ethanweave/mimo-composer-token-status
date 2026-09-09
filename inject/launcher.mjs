#!/usr/bin/env node
/**
 * Composer Token Status launcher — one-command inject into running MiMo.
 *
 * Usage:
 *   node inject/launcher.mjs
 *   npm run connect
 *
 * Prerequisites:
 *   Xiaomi MiMo.exe --remote-debugging-port=9222
 *
 * Does NOT modify app.asar. Does NOT call any LLM.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkPort, listTargets, pickRendererTarget, connect, evaluate } from "./cdp-client.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INJECT_PATH = path.join(__dirname, "runtime-inject.js");
const PORT = Number(process.env.CTS_CDP_PORT || 9222);

function fail(msg, hint) {
  console.error(`✗ ${msg}`);
  if (hint) console.error(hint);
  process.exit(1);
}

function ok(msg) {
  console.log(`✓ ${msg}`);
}

async function main() {
  const injectSource = fs.readFileSync(INJECT_PATH, "utf8");
  // Wrap so evaluate gets a self-running IIFE result
  const expression = `${injectSource}\n;undefined;`;

  console.log("Composer Token Status · v2.0.0 launcher");
  console.log(`CDP port: ${PORT}`);
  const steps = {
    port9222: false,
    cdp: false,
    renderer: false,
    composer: false,
    inject: false,
  };

  const port = await checkPort(PORT);
  steps.port9222 = port.ok;
  if (!port.ok) {
    fail(
      `MiMo Renderer Debugging Port ${PORT} not found.`,
      `步骤1 完全退出 MiMo\n步骤2 启动：\n  "…\\Xiaomi MiMo\\Xiaomi MiMo.exe" --remote-debugging-port=${PORT}\n步骤3 打开对话窗口后重试\n诊断：port9222=FAIL · cdp=SKIP · renderer=SKIP · composer=SKIP · inject=SKIP`
    );
  }
  ok(`[1/5] port ${PORT} open (${port.count} target(s))`);

  const targets = await listTargets(PORT);
  steps.cdp = true;
  ok("[2/5] CDP /json/list OK");

  const target = pickRendererTarget(targets);
  if (!target || !target.webSocketDebuggerUrl) {
    fail(
      "No renderer page target with WebSocket URL.",
      "打开 MiMo 主对话窗口（含输入框）后重试\n诊断：port9222=OK · cdp=OK · renderer=FAIL · composer=SKIP · inject=SKIP"
    );
  }
  steps.renderer = true;
  ok(`[3/5] renderer · ${target.title || "(no title)"}`);
  console.log(`       ${target.url || ""}`);

  let client;
  try {
    client = await connect(target.webSocketDebuggerUrl);
  } catch (e) {
    fail(
      `Renderer connect failed: ${e.message}`,
      "诊断：port9222=OK · cdp=OK · renderer=FAIL · inject=SKIP"
    );
  }

  try {
    await client.send("Runtime.enable");
  } catch {
    /* optional */
  }

  const before = await evaluate(
    client,
    `(() => ({
      composer: !!document.querySelector('.composer-bar'),
      existing: document.querySelectorAll('#cts-token-status').length
    }))()`
  );
  if (!before?.composer) {
    client.close();
    fail(
      "Composer not found on this page.",
      "请在含输入框的 MiMo 对话页执行\n诊断：port9222=OK · cdp=OK · renderer=OK · composer=FAIL · inject=SKIP"
    );
  }
  steps.composer = true;
  ok(
    `[4/5] composer${before.existing ? ` (already injected ×${before.existing}, will refresh)` : ""}`
  );

  try {
    await evaluate(client, expression);
  } catch (e) {
    client.close();
    fail(
      `Injection failed: ${e.message}`,
      "不会修改 MiMo 安装文件\n诊断：port9222=OK · cdp=OK · renderer=OK · composer=OK · inject=FAIL"
    );
  }
  steps.inject = true;
  ok("[5/5] Token Status injected");

  const after = await evaluate(
    client,
    `(() => {
      const s = window.__cts && window.__cts.debug ? window.__cts.debug() : null;
      const el = document.getElementById('cts-token-status');
      return {
        debug: s,
        stripText: el ? (el.textContent || '') : null,
        stripHidden: el ? !!el.hidden : null,
        stripCount: document.querySelectorAll('#cts-token-status').length
      };
    })()`
  );

  const d = after?.debug || {};
  const source = d.source || "unknown";
  console.log(`Source: ${source}`);
  console.log(
    `Plan remaining source: ${d.planRemainingSource || "none"}` +
      (d.planRemainingPercent != null ? ` (${d.nativePlanDisplay || d.planRemainingPercent + "%"})` : "")
  );
  if (after?.stripText) console.log(`Strip: ${after.stripText}`);
  else if (after?.stripHidden) console.log("Strip: hidden (empty state — no fake 0%)");
  console.log("Additional LLM Requests: 0");
  if (typeof d.additionalAccountApiCalls === "number") {
    console.log(`Additional Account API Calls (getUserUsage): ${d.additionalAccountApiCalls}`);
  }
  client.close();
  console.log("\nConnected to MiMo · keep using Desktop normally.");
  console.log("In DevTools console: __cts.debug()");
}

main().catch((e) => {
  fail(e.message || String(e));
});
