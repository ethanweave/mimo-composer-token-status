# Changelog

## [2.3.1] — 2026-09-13

Startup lifecycle refactor + Cache Hit Rate structure-based Fiber lookup.

### Changed

- **No login autostart**: removed HKCU Run `ComposerTokenStatus`; Windows Login starts nothing
- **One-shot bootstrap**: `bootstrap.mjs` no longer launches MiMo, watches, or keeps a daemon
  - WAIT FOR CDP → ATTACH → INJECT → EXIT
  - Bounded CDP wait: 20s
  - Bounded `no-composer` retry: 500ms interval, 15s max (then exit 1)
- **Wrapper is sole launcher**: `launch-mimo.vbs` starts MiMo with `--remote-debugging-port=9222` only if not already running, then runs one-shot bootstrap
- Desktop / Start Menu "Xiaomi MiMo" shortcuts target the wrapper (same name + icon)
- `installer/install.ps1`: no longer registers login persistence; clears legacy Run entry
- **runtime-inject.js REV 21**: locate conversation usage by Fiber **structure**, not minified component name (`Pje`/`iIe`)
  - Accepts direct usage-like `hook.memoizedState` objects (current MiMo)
  - Still accepts selector-function hooks (legacy Pje-style)
  - Same-fiber `ses_` id boosts score; `Pje` name is only a soft hint
  - Cache formula unchanged: `cacheRead / (cacheRead + cacheWrite + input)`

### Fixed

- Token Status disappeared after cold start when CDP opened before Composer mounted (one-shot inject failed once and exited)
- Cache Hit Rate always null after MiMo renamed the usage component (`Pje` → minified)

### Removed

- `bootstrap --watch` / `--launch` / `watchLoop` / spawn-MiMo-from-CTS
- Login-time resident node process

## [2.2.0] — 2026-09-09

**MiMo Composer Token Status v2.2.0**  
Agent-native runtime extension for Xiaomi MiMo Desktop.

### Added

- Composer footer **Cache Hit Rate** + **Token Plan Usage Remaining**
- Agent-native installation (`AGENTS.md` + `installer/*.ps1`)
- User-level persistent bootstrap (HKCU Run)
- Automatic **Xiaomi MiMo** shortcut wrapping (same name/icon)
- Rollback of original shortcuts on uninstall
- Healthcheck / repair / verify workflows
- Event-driven usage refresh
- Docs: README productization, SECURITY, COMPATIBILITY, FAQ, ARCHITECTURE

### Architecture

- CDP runtime injection (`127.0.0.1:9222`)
- Frozen injector: `inject/runtime-inject.js` (rev 20)
- Cache: `cacheRead / max(cacheRead + cacheWrite + input, 1)`
- Plan: `window.mimo.getUserUsage()` → `percent / 100`
- Refresh: `harnessDone` / `chatDone` / `harnessEvent(usage)` + microtask dedupe

### Security

- No external network in production  
- No telemetry / analytics  
- No additional LLM requests  
- No `app.asar` modification  
- No IFEO / DLL injection / process hollowing  

### Limitations

- Windows only  
- MiMo-specific internals (version-sensitive)  
- Raw `Xiaomi MiMo.exe` direct launch without CDP **cannot** be attached without host modification  

## [2.1.0] — 2026-09-09

- Bootstrap + installer + special shortcut name (superseded by 2.2.0 zero-friction wrap)

## [2.0.0] — 2026-09-09

- Frozen runtime: cache + Token Plan metrics, event-driven refresh, zero LLM
