# Changelog

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
