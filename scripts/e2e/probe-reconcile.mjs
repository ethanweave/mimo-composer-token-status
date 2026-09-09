import fs from "node:fs";
import { listTargets, pickRendererTarget, connect, evaluate } from "../../inject/cdp-client.mjs";

const inject = fs.readFileSync(new URL("./runtime-inject.js", import.meta.url), "utf8");
const targets = await listTargets(9222);
const client = await connect(pickRendererTarget(targets).webSocketDebuggerUrl);

await evaluate(client, `(() => { try { if (window.__cts && window.__cts.destroy) window.__cts.destroy(); window.__cts = undefined; } catch(e){} document.querySelectorAll('#cts-token-status').forEach(n=>n.remove()); return 1; })()`);
await client.send("Runtime.evaluate", { expression: inject, returnByValue: true });
const debug = await evaluate(client, `(() => window.__cts.debug())()`);
console.log(JSON.stringify(debug, null, 2));
client.close();
