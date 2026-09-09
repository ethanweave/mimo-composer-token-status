/**
 * Minimal CDP client (Node 18+ global WebSocket + fetch). No npm deps.
 * Localhost only. Read-only control of an already-running MiMo renderer.
 */
const DEFAULT_PORT = 9222;

export async function listTargets(port = DEFAULT_PORT) {
  const res = await fetch(`http://127.0.0.1:${port}/json/list`, {
    signal: AbortSignal.timeout(2000),
  });
  if (!res.ok) throw new Error(`CDP list failed: HTTP ${res.status}`);
  return res.json();
}

export async function checkPort(port = DEFAULT_PORT) {
  try {
    const list = await listTargets(port);
    return { ok: true, count: list.length };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
}

/** Prefer dedicated renderer pages over extensions / devtools. */
export function pickRendererTarget(targets) {
  const pages = (targets || []).filter((t) => t && t.type === "page" && t.webSocketDebuggerUrl);
  if (!pages.length) return null;
  const mimo = pages.filter((t) => {
    const u = `${t.url || ""} ${t.title || ""}`.toLowerCase();
    return (
      u.includes("mimo") ||
      u.includes("app://") ||
      u.includes("file://") ||
      u.includes("localhost") ||
      u.includes("127.0.0.1")
    );
  });
  // Prefer non-empty page with longest url (app shell), not about:blank
  const scored = (mimo.length ? mimo : pages).slice().sort((a, b) => {
    const sa = (a.url && a.url !== "about:blank" ? 2 : 0) + (a.title ? 1 : 0);
    const sb = (b.url && b.url !== "about:blank" ? 2 : 0) + (b.title ? 1 : 0);
    return sb - sa;
  });
  return scored[0];
}

export async function connect(wsUrl, timeoutMs = 5000) {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("WebSocket connect timeout")), timeoutMs);
    ws.addEventListener("open", () => {
      clearTimeout(t);
      resolve();
    });
    ws.addEventListener("error", () => {
      clearTimeout(t);
      reject(new Error("WebSocket connect failed"));
    });
  });

  let id = 0;
  const pending = new Map();
  ws.addEventListener("message", (ev) => {
    let msg;
    try {
      msg = JSON.parse(typeof ev.data === "string" ? ev.data : String(ev.data));
    } catch {
      return;
    }
    if (msg.id != null && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message || "CDP error"));
      else resolve(msg.result);
    }
  });

  function send(method, params = {}) {
    const mid = ++id;
    return new Promise((resolve, reject) => {
      pending.set(mid, { resolve, reject });
      ws.send(JSON.stringify({ id: mid, method, params }));
      setTimeout(() => {
        if (pending.has(mid)) {
          pending.delete(mid);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, 15000);
    });
  }

  return {
    send,
    close() {
      try {
        ws.close();
      } catch {}
    },
    raw: ws,
  };
}

export async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: false,
  });
  if (result.exceptionDetails) {
    const m =
      result.exceptionDetails.exception?.description ||
      result.exceptionDetails.text ||
      "evaluate exception";
    throw new Error(m);
  }
  return result.result?.value;
}
