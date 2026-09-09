# inject/ — production runtime

| File | Role |
|------|------|
| `runtime-inject.js` | **FROZEN** browser-side injector (v2.0.0 / rev 20) |
| `launcher.mjs` | `npm run connect` — CDP inject orchestration |
| `cdp-client.mjs` | Minimal WebSocket CDP client (no npm deps) |
| `adapter.mjs` | Snapshot helpers shared by static checks |

## Frozen runtime contract

`runtime-inject.js` must keep:

- Metrics: cache hit rate (conversation) + Token Plan remaining (`getUserUsage`)
- Refresh: event-driven only (`onHarnessDone` / `onChatDone` / usage events)
- `timers = 0`, `observers = 0`
- Idempotent `destroy()` on reinject
- Zero LLM requests
- No `app.asar` writes

Do **not** rewrite for style, “cleaner” architecture, or alternate data sources.

## Manual APIs (injected page)

```js
__cts.debug()
__cts.refresh()
__cts.destroy()
__cts.getSnapshot()
```
