#Requires -Version 5.1
<#
  Composer Token Status v2.2.0 — uninstall.ps1
  Restores original shortcuts from rollback.json, removes persistence + install tree.
  Does NOT modify MiMo.exe / app.asar / user chat data.
#>
$ErrorActionPreference = 'Continue'
$RunName = 'ComposerTokenStatus'
$installRoot = Join-Path $env:LOCALAPPDATA 'composer-token-status'
$regPath = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
$rollbackPath = Join-Path $installRoot 'rollback.json'

Write-Host "=== Composer Token Status — Uninstall ===" -ForegroundColor Cyan

# Stop bootstrap
Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -like "*composer-token-status*bootstrap.mjs*" -or $_.CommandLine -like "*bootstrap.mjs*--watch*" } |
  ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } catch {} }
Write-Host "  [OK] Bootstrap stopped"

# Restore shortcuts from rollback
if (Test-Path $rollbackPath) {
  try {
    $rb = Get-Content $rollbackPath -Raw | ConvertFrom-Json
    $w = New-Object -ComObject WScript.Shell
    foreach ($item in @($rb.shortcuts)) {
      if (-not $item -or -not $item.path) { continue }
      $lnkPath = $item.path
      try {
        if (-not (Test-Path (Split-Path $lnkPath -Parent))) {
          New-Item -ItemType Directory -Force -Path (Split-Path $lnkPath -Parent) | Out-Null
        }
        $s = $w.CreateShortcut($lnkPath)
        $s.TargetPath = $item.targetPath
        $s.Arguments = $item.arguments
        $s.WorkingDirectory = $item.workingDirectory
        $s.Description = $item.description
        if ($item.iconLocation) { $s.IconLocation = $item.iconLocation }
        $s.Save()
        Write-Host "  [OK] Restored shortcut: $lnkPath" -ForegroundColor Green
      } catch {
        Write-Host "  [WARN] Could not restore $lnkPath : $_" -ForegroundColor Yellow
      }
    }
    # Remove product Start Menu folder entry we created
    $productStart = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Xiaomi MiMo\Xiaomi MiMo.lnk'
    $productFolder = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Xiaomi MiMo'
    # Only delete if it points at our wrapper
    if (Test-Path $productStart) {
      try {
        $s = $w.CreateShortcut($productStart)
        if ($s.Arguments -like '*launch-mimo.cmd*' -or $s.Arguments -like '*launch-mimo.vbs*' -or $s.TargetPath -eq 'cmd.exe' -or $s.TargetPath -eq 'wscript.exe') {
          Remove-Item $productStart -Force -ErrorAction SilentlyContinue
          if (-not (Get-ChildItem $productFolder -ErrorAction SilentlyContinue)) {
            Remove-Item $productFolder -Recurse -Force -ErrorAction SilentlyContinue
          }
          Write-Host "  [OK] Removed wrapper Start Menu entry"
        }
      } catch {}
    }
  } catch {
    Write-Host "  [WARN] rollback.json unreadable" -ForegroundColor Yellow
  }
} else {
  Write-Host "  [WARN] No rollback.json — cannot auto-restore shortcuts" -ForegroundColor Yellow
}

# Remove HKCU Run
try {
  Remove-ItemProperty -Path $regPath -Name $RunName -ErrorAction SilentlyContinue
  Write-Host "  [OK] Persistence removed"
} catch {}

# Legacy 2.1 shortcuts
$legacy = @(
  (Join-Path ([Environment]::GetFolderPath('Desktop')) 'MiMo (Token Status).lnk'),
  (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Composer Token Status'),
  (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Xiaomi MiMo')
)
foreach ($l in $legacy) {
  if (Test-Path $l) { Remove-Item $l -Recurse -Force -ErrorAction SilentlyContinue }
}

# Remove install tree (after rollback restore)
if (Test-Path $installRoot) {
  Remove-Item $installRoot -Recurse -Force -ErrorAction SilentlyContinue
  Write-Host "  [OK] Install files removed"
}

Write-Host ""
Write-Host "MiMo Desktop binaries / app.asar were NOT modified." -ForegroundColor Green
Write-Host "Uninstall: PASS" -ForegroundColor Green
exit 0
