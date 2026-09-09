# E2E / live helpers

These scripts talk to a **running** MiMo with `--remote-debugging-port=9222`.
They are development/verification tools, not part of the injected runtime.

| Script | Purpose |
|--------|---------|
| `probe-debug.mjs` | Print `__cts.debug()` + live `getUserUsage()` |
| `watch-refresh.mjs` | Snapshot debug every 2s; detect refresh growth |
| `e2e-turn.mjs` | One DOM send attempt + wait for refresh |
| `e2e-turn2.mjs` | React `onKeyDown` Enter send helper |
| `e2e-multi.mjs` | Stop stuck turn + multi-round send helper |
| `probe-composer.mjs` | Inspect composer DOM / React props |
| `probe-live.mjs` | Dump Pje hook selectors |
| `probe-reconcile.mjs` | Destroy + reinject + debug |
| `probe-usage-struct.mjs` | Offline bundle snippet helper (needs extract) |
| `verify-anchor.mjs` | Offline bundle anchor check (needs extract) |
| `live-reinject.mjs` | Minimal CDP ping |

## Usage

```powershell
# from repo root
node scripts/e2e/probe-debug.mjs
node scripts/e2e/watch-refresh.mjs
npm run e2e:multi
```

Import path for CDP client is `../../inject/cdp-client.mjs`.

## Notes

- DOM send helpers may fail if composer React state or focus differs; prefer manual sends for acceptance.
- Do not treat interrupted scripts as product failures.
