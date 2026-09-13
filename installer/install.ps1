#Requires -Version 5.1
<#
  Composer Token Status v2.3.0 — install.ps1
  Rewrite existing "Xiaomi MiMo" user shortcuts to launch the wrapper
  (MiMo + CDP, then one-shot CTS bootstrap). No login autostart.
  Does NOT modify MiMo.exe or app.asar.
#>
$ErrorActionPreference = 'Stop'
$ProductName = 'Composer Token Status'
$RunName = 'ComposerTokenStatus'
$Version = '2.3.0'

function Write-Step($ok, $msg) {
  if ($ok) { Write-Host "  [OK] $msg" -ForegroundColor Green }
  else { Write-Host "  [FAIL] $msg" -ForegroundColor Red }
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$installRoot = Join-Path $env:LOCALAPPDATA 'composer-token-status'
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) {
  Write-Host "Node.js not found on PATH. Install Node.js >= 18 and retry." -ForegroundColor Red
  exit 2
}

Write-Host ""
Write-Host "=== $ProductName $Version — Install ===" -ForegroundColor Cyan
Write-Host "Repo:    $repoRoot"
Write-Host "Install: $installRoot"
Write-Host "Node:    $node"
Write-Host ""

$mimoExe = Join-Path $env:LOCALAPPDATA 'Programs\Xiaomi MiMo\Xiaomi MiMo.exe'
$mimoOk = Test-Path $mimoExe
Write-Step $mimoOk "MiMo Desktop detected ($mimoExe)"
if (-not $mimoOk) {
  Write-Host "MiMo Desktop not found. Install MiMo first." -ForegroundColor Red
  exit 3
}

# --- copy product files ---
$items = @(
  'inject', 'bootstrap', 'adapters', 'scripts', 'docs', 'design', 'examples', 'installer',
  'package.json', 'README.md', 'SPEC.md', 'CHANGELOG.md', 'LICENSE', 'AGENTS.md',
  'DECISIONS.md', 'ACCEPTANCE.md'
)
New-Item -ItemType Directory -Force -Path $installRoot | Out-Null
foreach ($item in $items) {
  $src = Join-Path $repoRoot $item
  if (-not (Test-Path $src)) { continue }
  $dst = Join-Path $installRoot $item
  if (Test-Path $src -PathType Container) {
    if (Test-Path $dst) { Remove-Item $dst -Recurse -Force }
    Copy-Item $src $dst -Recurse -Force
  } else {
    Copy-Item $src $dst -Force
  }
}
Write-Step $true "Files copied to install root"

$bootstrap = Join-Path $installRoot 'bootstrap\bootstrap.mjs'
if (-not (Test-Path $bootstrap)) { Write-Step $false "bootstrap.mjs missing"; exit 4 }

# --- silent VBS launcher (no cmd/PowerShell window) ---
$wrapper = Join-Path $installRoot 'launch-mimo.vbs'
$wrapperBody = @"
' MiMo wrapper — sole process orchestration entry for Token Status.
' 1) If MiMo is not running, start it with --remote-debugging-port=9222.
' 2) Always run one-shot CTS bootstrap (wait → attach → inject → exit).
' CTS never launches MiMo; this wrapper is the only launcher.
Option Explicit

Dim shell, fso, mimoExe, bootstrapScript, nodeExe, mimoArgs, debugPort
Dim wmi, procs, p, alreadyRunning

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

mimoExe = shell.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\Programs\Xiaomi MiMo\Xiaomi MiMo.exe"
bootstrapScript = fso.GetParentFolderName(WScript.ScriptFullName) & "\bootstrap\bootstrap.mjs"
nodeExe = "$node"
debugPort = 9222
mimoArgs = "--remote-debugging-port=" & debugPort

If Not fso.FileExists(mimoExe) Then
  mimoExe = "C:\Program Files\Xiaomi MiMo\Xiaomi MiMo.exe"
End If

If Not fso.FileExists(mimoExe) Then
  MsgBox "Xiaomi MiMo.exe not found.", 16, "Xiaomi MiMo"
  WScript.Quit 1
End If

alreadyRunning = False
On Error Resume Next
Set wmi = GetObject("winmgmts:\\.\root\cimv2")
Set procs = wmi.ExecQuery("SELECT Name FROM Win32_Process WHERE Name = 'Xiaomi MiMo.exe'")
If Err.Number = 0 Then
  For Each p In procs
    alreadyRunning = True
    Exit For
  Next
End If
On Error GoTo 0

If Not alreadyRunning Then
  shell.Run Chr(34) & mimoExe & Chr(34) & " " & mimoArgs, 1, False
End If

If fso.FileExists(bootstrapScript) Then
  shell.Run Chr(34) & nodeExe & Chr(34) & " " & Chr(34) & bootstrapScript & Chr(34), 0, False
End If
"@
Set-Content -Path $wrapper -Value $wrapperBody -Encoding ASCII

$ensurePs1 = Join-Path $installRoot 'ensure-mimo-cdp.ps1'
$ensureBody = @'
$ErrorActionPreference = "Continue"
$exe = Join-Path $env:LOCALAPPDATA "Programs\Xiaomi MiMo\Xiaomi MiMo.exe"
$node = (Get-Command node -EA SilentlyContinue).Source
$boot = Join-Path $env:LOCALAPPDATA "composer-token-status\bootstrap\bootstrap.mjs"
$port = 9222

function Test-Cdp {
  try {
    Invoke-WebRequest -Uri "http://127.0.0.1:$port/json/version" -TimeoutSec 2 -UseBasicParsing | Out-Null
    return $true
  } catch { return $false }
}

function Test-MimoRunning {
  try { return ((tasklist /FI "IMAGENAME eq Xiaomi MiMo.exe" /FO CSV /NH) -match "Xiaomi MiMo") } catch { return $false }
}

if (-not (Test-Cdp)) {
  if (-not (Test-MimoRunning)) {
    Start-Process -FilePath $exe -ArgumentList "--remote-debugging-port=$port"
    # wait up to ~25s for CDP
    for ($i = 0; $i -lt 25; $i++) {
      Start-Sleep -Milliseconds 1000
      if (Test-Cdp) { break }
    }
  } else {
    # MiMo running WITHOUT CDP — cannot attach to existing process.
    # Relaunch is blocked by Electron single-instance (focuses existing).
    # Show a one-line notice and still try inject in case port appears later.
    Write-Host "[cts] MiMo is already running without debug port. Close MiMo fully, then open 'Xiaomi MiMo' again." -ForegroundColor Yellow
  }
}

if ($node -and (Test-Path $boot)) {
  & $node $boot
  exit $LASTEXITCODE
}
exit 1
'@
Set-Content -Path $ensurePs1 -Value $ensureBody -Encoding UTF8

# VBS silent bootstrap for logon — REMOVED in 2.3.0.
# CTS no longer registers HKCU Run. Login starts nothing.
# Remove any legacy login entry from older installs.
$runValue = "wscript.exe `"$vbs`""
$regPath = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
$existing = (Get-ItemProperty -Path $regPath -Name $RunName -ErrorAction SilentlyContinue).$RunName
if ($existing) {
  Remove-ItemProperty -Path $regPath -Name $RunName -Force -ErrorAction SilentlyContinue
  Write-Step $true "Removed legacy login autostart (HKCU Run: $RunName)"
} else {
  Write-Step $true "No login autostart (HKCU Run: $RunName absent)"
}

# --- discover + backup existing Xiaomi MiMo shortcuts, then rewrite ---
function Get-Lnk($path) {
  $w = New-Object -ComObject WScript.Shell
  $s = $w.CreateShortcut($path)
  return $s
}

function Backup-Lnk($lnkPath, $rollback) {
  if (-not (Test-Path $lnkPath)) { return }
  $s = Get-Lnk $lnkPath
  $rollback.shortcuts += [PSCustomObject]@{
    path          = $lnkPath
    targetPath    = $s.TargetPath
    arguments     = $s.Arguments
    workingDirectory = $s.WorkingDirectory
    description   = $s.Description
    iconLocation  = $s.IconLocation
    windowStyle   = $s.WindowStyle
  }
}

function Write-WrappedLnk($lnkPath, $desc) {
  $w = New-Object -ComObject WScript.Shell
  $s = $w.CreateShortcut($lnkPath)
  $s.TargetPath = "wscript.exe"
  $s.Arguments = "`"$wrapper`""
  $s.WorkingDirectory = $installRoot
  $s.IconLocation = "$mimoExe,0"
  $s.Description = $desc
  $s.Save()
}

$rollbackPath = Join-Path $installRoot 'rollback.json'
$rollback = [PSCustomObject]@{
  version = $Version
  createdAt = (Get-Date).ToString('o')
  mimoExe = $mimoExe
  shortcuts = @()
  replaced = @()
}

$candidateLnks = @()
$desktop = [Environment]::GetFolderPath('Desktop')
$candidateLnks += (Join-Path $desktop 'Xiaomi MiMo.lnk')
$candidateLnks += (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Xiaomi MiMo.lnk')
# also any Start Menu folder shortcuts targeting MiMo
Get-ChildItem (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu') -Recurse -Filter *.lnk -ErrorAction SilentlyContinue | ForEach-Object {
  try {
    $s = Get-Lnk $_.FullName
    if ($s.TargetPath -eq $mimoExe) { $candidateLnks += $_.FullName }
  } catch {}
}

$candidateLnks = $candidateLnks | Select-Object -Unique
$rewritten = 0
foreach ($lnk in $candidateLnks) {
  if (-not (Test-Path $lnk)) { continue }
  # Skip our own already-wrapped
  try {
    $s = Get-Lnk $lnk
    if (($s.TargetPath -eq 'wscript.exe' -and $s.Arguments -like '*launch-mimo.vbs*') -or
        ($s.TargetPath -eq 'cmd.exe' -and $s.Arguments -like '*launch-mimo.cmd*')) {
      $rollback.replaced += $lnk
      Write-Step $true "Already wrapped: $lnk"
      continue
    }
    Backup-Lnk $lnk $rollback
    Write-WrappedLnk $lnk 'Xiaomi MiMo'
    $rollback.replaced += $lnk
    $rewritten++
    Write-Step $true "Rewrote shortcut (same name/icon): $lnk"
  } catch {
    Write-Host "  [WARN] skip $lnk : $_"
  }
}

# Ensure a Start Menu entry under product folder as fallback (still named Xiaomi MiMo)
$programs = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Xiaomi MiMo'
New-Item -ItemType Directory -Force -Path $programs | Out-Null
$smLnk = Join-Path $programs 'Xiaomi MiMo.lnk'
if (-not (Test-Path $smLnk) -or $rewritten -eq 0) {
  Write-WrappedLnk $smLnk 'Xiaomi MiMo'
  $rollback.replaced += $smLnk
  Write-Step $true "Start Menu entry: Xiaomi MiMo"
}

# Persist rollback AFTER collecting
$rollback | ConvertTo-Json -Depth 6 | Set-Content -Path $rollbackPath -Encoding UTF8
Write-Step (Test-Path $rollbackPath) "Rollback metadata saved ($($rollback.shortcuts.Count) originals)"

# Remove obsolete special-name shortcut from 2.1.0 if present
$oldSpecial = @(
  (Join-Path $desktop 'MiMo (Token Status).lnk'),
  (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Composer Token Status\MiMo (Token Status).lnk')
)
foreach ($o in $oldSpecial) {
  if (Test-Path $o) { Remove-Item $o -Force -ErrorAction SilentlyContinue }
}
$oldFolder = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Composer Token Status'
if (Test-Path $oldFolder) {
  Get-ChildItem $oldFolder -Filter *.lnk -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
}

# Config
$cfg = @{
  version     = $Version
  installedAt = (Get-Date).ToString('o')
  cdpPort     = 9222
  mimoExe     = $mimoExe
  repoRoot    = $repoRoot
  runName     = $RunName
  mode        = 'wrapper-one-shot-bootstrap'
} | ConvertTo-Json
Set-Content -Path (Join-Path $installRoot 'cts-config.json') -Value $cfg -Encoding UTF8

Write-Host ""
Write-Host "=== Install summary ===" -ForegroundColor Cyan
Write-Host "  Version:     $Version"
Write-Host "  Mode:        Wrapper one-shot bootstrap (no login autostart, no watcher)"
Write-Host "  Install:     $installRoot"
Write-Host "  Persistence: none (HKCU Run not registered)"
Write-Host "  User entry:  Desktop / Start Menu → 'Xiaomi MiMo' (rewritten to wrapper)"
Write-Host "  Rollback:    $rollbackPath"
Write-Host ""
Write-Host "LIMITATION:" -ForegroundColor Yellow
Write-Host "  Launching the raw Xiaomi MiMo.exe from its install folder still cannot get CDP"
Write-Host "  without the --remote-debugging-port flag. Use the desktop/start 'Xiaomi MiMo' icon."
Write-Host ""
Write-Host "  After install: click 'Xiaomi MiMo' once to start MiMo + inject Token Status."
Write-Host "Install: PASS" -ForegroundColor Green
exit 0
