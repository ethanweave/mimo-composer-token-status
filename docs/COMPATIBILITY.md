# Compatibility

## Supported platform

| Item | Value |
|------|--------|
| OS | Windows 10 / 11 |
| Host app | Xiaomi MiMo Desktop |
| Node.js | ≥ 18 (for bootstrap / installer / CDP client) |
| Architecture | x64 (typical MiMo Desktop install) |

MiMo executable path is **discovered dynamically** (default: `%LOCALAPPDATA%\Programs\Xiaomi MiMo\Xiaomi MiMo.exe`). Other install locations can be set via `CTS_MIMO_EXE`.

## Tested reference

On the development machine, MiMo Desktop **26.909.91205** (Electron 41.x) was used for live verification of:

- Composer injection  
- Cache Hit Rate  
- Token Plan remaining (`getUserUsage`)  
- Event-driven refresh  
- Installer / verify / uninstall / rollback  

Other versions are **not** guaranteed.

## Version sensitivity

This project depends on **internal** MiMo renderer structure:

- Context HUD component (`Pje`) and `usageByConvo`  
- `window.mimo.getUserUsage()`  
- Harness/chat completion IPC events  

MiMo updates may rename or restructure these. Symptoms: strip missing, cache empty, plan unavailable. Runtime is not modified to “guess” new internals — use `repair` / re-verify after MiMo updates and report breakage.

## Launch support matrix

| Launch method | Token Status |
|---------------|--------------|
| Desktop / Start Menu **Xiaomi MiMo** (installer-wrapped) | **Supported** |
| Raw `Xiaomi MiMo.exe` from install folder (no CDP flag) | **Unsupported** without host modification |
| Manual `--remote-debugging-port=9222` + `npm run connect` | **Supported** (developer mode) |

## Not supported

- Non-Windows hosts  
- Non-MiMo Electron apps  
- Official Xiaomi plugin API (none is used)  
- Automatic attach to a MiMo process that never opened CDP  
