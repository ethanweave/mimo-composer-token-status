#Requires -Version 5.1
<#
  Composer Token Status — repair.ps1
  Re-copies files from this repo, re-registers persistence, restarts bootstrap.
  Does not reinstall MiMo. Does not modify app.asar.
#>
$ErrorActionPreference = 'Stop'
Write-Host "=== Composer Token Status — Repair ===" -ForegroundColor Cyan
$repoRoot = Split-Path -Parent $PSScriptRoot
$installScript = Join-Path $PSScriptRoot 'install.ps1'
if (-not (Test-Path $installScript)) {
  Write-Host "install.ps1 missing next to repair.ps1" -ForegroundColor Red
  exit 1
}
# Stop existing bootstrap then reinstall (idempotent)
Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -like "*bootstrap.mjs*--watch*" } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

& powershell -NoProfile -ExecutionPolicy Bypass -File $installScript
exit $LASTEXITCODE
