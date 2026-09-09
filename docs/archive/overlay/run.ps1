# Start Composer Token Status overlay (always-on-top strip)
# Usage: powershell -File overlay\run.ps1
$ErrorActionPreference = "Stop"
$py = @($env:MIMO_PYTHON, (Get-Command python -ErrorAction SilentlyContinue).Source, (Get-Command py -ErrorAction SilentlyContinue).Source) |
  Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if (-not $py) { throw "No Python found" }
& $py (Join-Path $PSScriptRoot "statusbar.py") @args
