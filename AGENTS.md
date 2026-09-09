# MiMo Composer Token Status — Agent installation protocol

## Project

**MiMo Composer Token Status** — agent-native local runtime extension for Xiaomi MiMo Desktop.

Shows on the Composer footer:

```text
缓存命中率 XX% · 剩余用量 XX%
```

- **Cache Hit Rate** = conversation cumulative Prompt Cache hit rate  
- **Usage Left** = Account Token Plan remaining (`window.mimo.getUserUsage()`)

**Not** Context Window remaining.

**Unofficial** — not affiliated with Xiaomi.

## Target

| Item | Value |
|------|--------|
| Host | Xiaomi MiMo Desktop |
| Platform | Windows 10/11 |
| Model | Agent-assisted local installation |
| Runtime | **Frozen** (`inject/runtime-inject.js` rev 20) |
| Package version | **2.2.0** |

## DO NOT MODIFY (unless user explicitly requests)

- `inject/runtime-inject.js` — frozen runtime  
- MiMo install directory / `app.asar` / `Xiaomi MiMo.exe`  

Do not change cache formula, plan source, or event-driven refresh.

## Agent default flow

1. Inspect repository (read `AGENTS.md`, `README.md`)  
2. Verify Windows + Node.js ≥ 18 + MiMo install  
3. Run `installer/install.ps1`  
4. Run `installer/verify.ps1`  
5. Report PASS/FAIL honestly  

On failure, report: **failure stage**, **reason**, **suggested repair** (`installer/repair.ps1`). Never claim success if verify fails.

## Persistence & launch (v2.2.0 zero-friction)

Installer **rewrites existing user shortcuts** named `Xiaomi MiMo` (Desktop + Start Menu) to:

- keep **name** `Xiaomi MiMo` and **icon** from `Xiaomi MiMo.exe`
- launch the real exe with `--remote-debugging-port=9222`
- run bootstrap inject

Original shortcut metadata is saved to `%LOCALAPPDATA%\composer-token-status\rollback.json` and restored on uninstall.

Bootstrap also watches at logon (HKCU Run) to re-inject if CDP is already open.

### Honest limitation (must tell user)

Double-clicking the **raw** `Xiaomi MiMo.exe` inside the install folder **cannot** enable CDP — Electron only opens the debug port at process start. That path is **NOT POSSIBLE WITHOUT HOST MODIFICATION**. Users should use the desktop/start **Xiaomi MiMo** icon (same look as before after install).

## Install (Agent steps)

When the user says **「安装这个项目」** / **install this project** and provides a repo path or URL that the Agent already has locally:

1. Detect Windows + Node.js ≥ 18  
2. Detect MiMo install (`%LOCALAPPDATA%\Programs\Xiaomi MiMo\Xiaomi MiMo.exe`)  
3. Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\installer\install.ps1
```

4. Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\installer\verify.ps1
```

5. Report PASS/FAIL to the user. Do **not** ask the user to run `npm run connect`.

### What install.ps1 does

- Copies product files to `%LOCALAPPDATA%\composer-token-status\`
- Writes `cts-config.json`
- Registers **HKCU** `Run` value `ComposerTokenStatus` (user-level, no admin)
- Creates Start Menu + Desktop shortcuts **「MiMo (Token Status)」** that start MiMo with `--remote-debugging-port=9222`
- Starts bootstrap in watch mode once
- Runs healthcheck when possible

### Idempotent

Re-running install must not create duplicate Run keys, shortcuts, or bootstrap processes.

## Uninstall

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\installer\uninstall.ps1
```

## Repair

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\installer\repair.ps1
```

## Verification

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\installer\verify.ps1
```

Expect `Installation: PASS` and zero LLM / zero timers / zero observers.

## Important limitation (tell the user honestly)

If the user double-clicks the **original** `Xiaomi MiMo.exe` **without** `--remote-debugging-port`, Bootstrap **cannot** attach.  
The supported “always-on” entry point is the installed shortcut **「MiMo (Token Status)」**, or restarting MiMo with the debug port.

Do not claim transparent attach to a no-CDP process.

## Security boundaries

**Allowed:** `127.0.0.1` / localhost CDP WebSocket only; read existing usage + `getUserUsage`.

**Forbidden:**

- modifying `app.asar` or MiMo install binaries  
- external telemetry / analytics / tracking  
- extra LLM requests  
- storing tokens, cookies, passwords  
- uploading chat/prompt/usage data  
- installing Windows services / drivers  
- modifying registry outside the documented HKCU Run value  
- modifying firewall / system proxy  

## Runtime is frozen

Do **not** rewrite `inject/runtime-inject.js` unless a release-blocking bug is proven. Do not change cache formula, plan source, or event-driven refresh.

## Agent success criteria

- User does not need to type `npm run connect` for daily use  
- After install, user opens MiMo via Token Status shortcut (or MiMo already on CDP) and strip appears  
- `verify.ps1` exits 0  
