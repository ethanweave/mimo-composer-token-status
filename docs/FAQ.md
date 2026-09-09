# FAQ

## What is 剩余用量?

**Account Token Plan remaining** — the same source as MiMo’s account menu.  
It is **not** Context Window leftover and **not** the context ring.

## What is 缓存命中率?

Current conversation cumulative **Prompt Cache** hit rate:

`cacheRead / (cacheRead + cacheWrite + input)` where `input` is fresh/uncached input.

## Why doesn’t the strip appear when I double-click Xiaomi MiMo.exe in Program Files?

Chromium/Electron only enables CDP if the process starts with `--remote-debugging-port`. External tools cannot turn CDP on later without modifying the host. Use the **desktop / Start Menu Xiaomi MiMo** shortcut after install (installer wraps it), or start MiMo with the flag manually.

## Do I need npm every day?

No. After `install.ps1`, daily use is: open **Xiaomi MiMo** from the desktop/start icon.

## Does this send my chats anywhere?

No. See [SECURITY.md](../SECURITY.md). Only localhost CDP; no telemetry; no LLM calls for stats.

## Will MiMo updates break it?

Possibly. Internals are version-sensitive ([COMPATIBILITY.md](COMPATIBILITY.md)). Run `installer\repair.ps1` and `verify.ps1` after updates.

## How do I uninstall?

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\installer\uninstall.ps1
```

Restores original shortcuts from `rollback.json` and removes install files. Does not modify MiMo binaries.

## Why is there both bootstrap watch and a shortcut wrapper?

- **Shortcut:** guarantees CDP is available when the user starts MiMo.  
- **Bootstrap watch:** re-injects if MiMo restarts with CDP already up (low-frequency, not 1s polling).

## Can I still use npm run connect?

Yes — developer mode. Not required for normal users after install.
