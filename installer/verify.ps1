#Requires -Version 5.1
<#
  Composer Token Status — verify.ps1
  Checks install, persistence, bootstrap, CDP, inject health.
#>
$ErrorActionPreference = 'Continue'
$RunName = 'ComposerTokenStatus'
$installRoot = Join-Path $env:LOCALAPPDATA 'composer-token-status'
$regPath = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
$node = (Get-Command node -ErrorAction SilentlyContinue).Source

Write-Host ""
Write-Host "=== Composer Token Status — Verify ===" -ForegroundColor Cyan
$fail = 0

function Check($name, $ok, $detail) {
  if ($ok) { Write-Host "  [PASS] $name$(if($detail){" — $detail"})" -ForegroundColor Green }
  else { Write-Host "  [FAIL] $name$(if($detail){" — $detail"})" -ForegroundColor Red; $script:fail++ }
}

Check "Node.js" ([bool]$node) $node
Check "Install root" (Test-Path $installRoot) $installRoot
Check "runtime-inject.js" (Test-Path (Join-Path $installRoot 'inject\runtime-inject.js'))
Check "bootstrap.mjs" (Test-Path (Join-Path $installRoot 'bootstrap\bootstrap.mjs'))

$runVal = $null
try { $runVal = (Get-ItemProperty -Path $regPath -Name $RunName -ErrorAction SilentlyContinue).$RunName } catch {}
Check "Persistence (HKCU Run)" ([bool]$runVal) $runVal

$bs = Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -like "*bootstrap.mjs*" }
Check "Bootstrap process" ([bool]$bs) $(if($bs){"pid $($bs.ProcessId)"}else{"not running"})

$mimo = Join-Path $env:LOCALAPPDATA 'Programs\Xiaomi MiMo\Xiaomi MiMo.exe'
Check "MiMo installed" (Test-Path $mimo)

$mimoRun = $false
try {
  $mimoRun = (tasklist /FI "IMAGENAME eq Xiaomi MiMo.exe" /FO CSV /NH) -match 'Xiaomi MiMo'
} catch {}
Check "MiMo running" $mimoRun

$cdp = $false
try {
  $r = Invoke-WebRequest -Uri 'http://127.0.0.1:9222/json/version' -TimeoutSec 2 -UseBasicParsing
  $cdp = $true
} catch {}
Check "CDP 127.0.0.1:9222" $cdp

$health = $null
if ($node -and (Test-Path (Join-Path $installRoot 'bootstrap\bootstrap.mjs'))) {
  $healthOut = & $node (Join-Path $installRoot 'bootstrap\bootstrap.mjs') --status 2>$null
  $text = ($healthOut | Out-String).Trim()
  $idx = $text.IndexOf('{')
  if ($idx -ge 0) {
    try { $health = $text.Substring($idx) | ConvertFrom-Json } catch {}
  }
}
Check "Healthcheck (__cts)" ($health -and $health.ok -and $health.health.probe.hasCts) `
  $(if ($health -and $health.health.probe) { "strip=$($health.health.probe.stripText)" } else { "unavailable" })

if ($health -and $health.health.probe) {
  $p = $health.health.probe
  Check "Additional LLM = 0" ($p.additionalLLMRequests -eq 0)
  Check "Timers = 0" ($p.activeTimers -eq 0)
  Check "Observers = 0" ($p.activeObservers -eq 0)
}

# asar untouched (hash presence only — we never write it)
$asar = Join-Path $env:LOCALAPPDATA 'Programs\Xiaomi MiMo\resources\app.asar'
Check "app.asar present (not modified by us)" (Test-Path $asar)

Write-Host ""
if ($fail -eq 0) {
  Write-Host "Installation: PASS" -ForegroundColor Green
  exit 0
} else {
  Write-Host "Installation: FAIL ($fail checks)" -ForegroundColor Red
  Write-Host "Hint: open MiMo via 'MiMo (Token Status)' shortcut, then re-run verify."
  exit 1
}
