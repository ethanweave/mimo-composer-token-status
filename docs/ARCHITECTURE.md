# Architecture (v2.2.0)

**MiMo Composer Token Status** — agent-native local runtime extension.

Runtime layer (`inject/runtime-inject.js` rev 20) is **frozen**.

---

## End-to-end flow

```text
User
  │  click Desktop / Start Menu "Xiaomi MiMo" (installer-wrapped)
  ▼
launch-mimo.cmd → Xiaomi MiMo.exe --remote-debugging-port=9222
  │
  ▼
MiMo Desktop (Electron)
  │
  │  localhost CDP 127.0.0.1:9222
  ▼
bootstrap.mjs / launcher.mjs
  │  inject/cdp-client.mjs
  ▼
inject/runtime-inject.js  (FROZEN)
  │
  ├── Composer DOM strip
  └── window.__cts.debug()
```

Logon persistence: HKCU Run → `start-bootstrap.vbs` → `bootstrap.mjs --watch` (slow backoff, not 1s).

---

## Metrics data flow

### Cache Hit Rate

```text
MiMo harness / chat
  → usageByConvo[activeConversationId]
  → Pje fiber selectors
  → { input, cacheRead, cacheWrite, output, … }
  → cacheHitRate = cacheRead / max(cacheRead + cacheWrite + input, 1)
  → 缓存命中率 XX%
```

- `input` = fresh / uncached input  
- Scope: conversation cumulative  

### Plan Remaining

```text
window.mimo.getUserUsage()   // IPC mimo:getUserUsage
  → { percent, resetDate }
  → planRemainingRatio = percent / 100
  → 剩余用量 XX%
```

Context Ring / `contextLimit` are **not** Plan Remaining.

---

## Refresh

```text
mimo:harnessDone  |  chat done  |  harnessEvent(kind === "usage")
        ↓
  microtask coalesce
        ↓
   one refresh()
        ↓
  Composer footer update
```

No `setInterval` / `setTimeout` loops / `rAF` / document MutationObserver in the production runtime.

---

## Layers

| Layer | Path | Notes |
|-------|------|-------|
| Frozen runtime | `inject/runtime-inject.js` | Do not rewrite |
| CDP client | `inject/cdp-client.mjs` | Localhost only |
| Dev launcher | `inject/launcher.mjs` | `npm run connect` |
| Bootstrap | `bootstrap/` | discover / inject / health / watch |
| Installer | `installer/` | install / uninstall / repair / verify |
| Agent contract | `AGENTS.md` | Deploy protocol |

---

## Shortcut wrapper (zero-friction)

Installer rewrites user shortcuts named **Xiaomi MiMo** to `cmd /c launch-mimo.cmd` while keeping **name + icon** from `Xiaomi MiMo.exe`. Original shortcut metadata is stored in `rollback.json` for uninstall.
