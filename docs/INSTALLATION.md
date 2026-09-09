# Installation

## Agent install (recommended)

Give your MiMo Agent this repository and say: **安装这个项目** / **install this project**.

The Agent should run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\installer\install.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\installer\verify.ps1
```

See [AGENTS.md](../AGENTS.md).

## Manual install

```powershell
# from cloned repo
powershell -NoProfile -ExecutionPolicy Bypass -File .\installer\install.ps1
```

Requirements: Windows 10/11, Node.js ≥ 18, Xiaomi MiMo Desktop installed.

## Daily use

Use the shortcut **「MiMo (Token Status)」** on the Desktop or Start Menu.

That entry:

1. Starts `Xiaomi MiMo.exe --remote-debugging-port=9222`
2. Runs bootstrap inject
3. Shows Composer Token Status

## Important limitation

Double-clicking the **original** `Xiaomi MiMo.exe` without the debugging port **cannot** be auto-attached. Electron does not expose CDP unless launched with the flag. Use the Token Status shortcut (or repair/relaunch with the port).

## Uninstall

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\installer\uninstall.ps1
```

## Repair

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\installer\repair.ps1
```

## Developer mode (optional)

```powershell
npm run connect
```

Not required for normal users after install.
