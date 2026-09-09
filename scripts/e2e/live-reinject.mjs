import { listTargets, pickRendererTarget, connect } from "../../inject/cdp-client.mjs";

const targets = await listTargets(9222);
console.log("targets", targets.length);
const client = await connect(pickRendererTarget(targets).webSocketDebuggerUrl);
const r = await client.send("Runtime.evaluate", {
  expression: "1+1",
  returnByValue: true,
});
console.log("ping", r.result && r.result.value);
client.close();
