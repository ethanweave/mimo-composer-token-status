import { listTargets, pickRendererTarget, connect, evaluate } from "../../inject/cdp-client.mjs";

const targets = await listTargets(9222);
const client = await connect(pickRendererTarget(targets).webSocketDebuggerUrl);
await client.send("Runtime.enable");

const probe = await evaluate(client, `(() => {
  const hud = document.querySelector('[data-ctx-hud]');
  const fk = Object.keys(hud).find(x => x.startsWith('__reactFiber$'));
  let f = hud[fk];
  let pje = null, hops = 0;
  while (f && hops++ < 30) {
    if (typeof f.type === 'function' && f.type.name === 'Pje') { pje = f; break; }
    f = f.return;
  }
  const dumps = [];
  let h = pje.memoizedState, i = 0;
  while (h && i++ < 30) {
    const ms = h.memoizedState;
    if (Array.isArray(ms) && typeof ms[0] === 'function') {
      let v, err;
      try { v = ms[0](); } catch (e) { err = String(e); }
      dumps.push({
        hook: i,
        type: v === null ? 'null' : typeof v,
        err: err || null,
        v: typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean' ? v : v,
      });
    }
    h = h.next;
  }
  return dumps;
})()`);

console.log(JSON.stringify(probe, null, 2));
client.close();
