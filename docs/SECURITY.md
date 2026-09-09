# Security (implementation notes)

Canonical policy: repository root [SECURITY.md](../SECURITY.md).

## Local-only

- CDP: `127.0.0.1:9222` only  
- No external HTTP/WS in production runtime  
- Installer writes only under `%LOCALAPPDATA%\composer-token-status\`, HKCU Run, and user shortcuts (with rollback)  

## Forbidden techniques (not used)

- IFEO hijack  
- DLL injection / process hollowing / memory patching  
- Modifying `app.asar` or `Xiaomi MiMo.exe`  

## Debug API

`__cts.debug()` may expose usage numbers and conversation id. It does **not** emit passwords, cookies, auth headers, or full chat text.
