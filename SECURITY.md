# Security Policy

**MiMo Composer Token Status** is a **local** developer/desktop extension.

## Network

| Path | External network |
|------|------------------|
| Production runtime (`inject/runtime-inject.js`) | **None** |
| Bootstrap / installer | **None** |
| CDP | **`127.0.0.1:9222` only** (Chrome DevTools Protocol to the user’s local MiMo) |

The project does **not**:

- upload tokens, cookies, or credentials  
- upload prompts or conversations  
- send telemetry or use analytics  
- make additional LLM inference requests  
- contact third-party APIs  

## Local CDP

CDP is a powerful local debug protocol. This project only connects to a **user-started** MiMo instance that already exposes `--remote-debugging-port` on localhost. It does not open ports on external interfaces or install remote access.

## Host integrity

- Does **not** modify `Xiaomi MiMo.exe`  
- Does **not** modify `app.asar` or other install files  
- Does **not** use IFEO, DLL injection, or process hollowing  
- Installer only writes under `%LOCALAPPDATA%\composer-token-status\`, one HKCU Run value, and user shortcut rewrites (with rollback)

## Reporting

If you find a security issue in this repository, open a GitHub issue or contact the maintainers. Do not include secrets or chat content in reports.
