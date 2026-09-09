# Composer Token Status - click-through overlay aligned to MiMo footer
# powershell -NoProfile -ExecutionPolicy Bypass -File overlay\embed_overlay.ps1
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName PresentationCore, PresentationFramework, WindowsBase

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class CtsNative {
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT r);
  [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr hWnd, int nIndex);
  [DllImport("user32.dll")] public static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
  public const int GWL_EXSTYLE = -20;
  public const int WS_EX_TRANSPARENT = 0x20;
  public const int WS_EX_TOOLWINDOW = 0x80;
  public const int WS_EX_NOACTIVATE = 0x08000000;
}
"@

function Get-PythonExe {
  if ($env:MIMO_PYTHON -and (Test-Path $env:MIMO_PYTHON)) { return $env:MIMO_PYTHON }
  $cmd = Get-Command python -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  return $null
}

function Get-StatusText {
  $py = Get-PythonExe
  if (-not $py) { return [string]::Empty }
  $script = Join-Path $PSScriptRoot 'statusbar.py'
  try {
    $out = & $py $script --once 2>$null
    if ($out) {
      $line = @($out)[0]
      return ([string]$line).Trim()
    }
  } catch { }
  return [string]::Empty
}

function Get-MimoRect {
  $candidates = Get-Process | Where-Object {
    $_.MainWindowHandle -ne 0 -and $_.ProcessName -like '*MiMo*'
  }
  foreach ($p in $candidates) {
    $r = New-Object CtsNative+RECT
    if ([CtsNative]::GetWindowRect($p.MainWindowHandle, [ref]$r)) {
      $w = $r.Right - $r.Left
      $h = $r.Bottom - $r.Top
      if ($w -gt 400 -and $h -gt 300) { return $r }
    }
  }
  return $null
}

$window = New-Object System.Windows.Window
$window.Title = 'cts-overlay'
$window.WindowStyle = 'None'
$window.AllowsTransparency = $true
$window.Background = [System.Windows.Media.Brushes]::Transparent
$window.Topmost = $true
$window.ShowInTaskbar = $false
$window.ShowActivated = $false
$window.ResizeMode = 'NoResize'
$window.Width = 240
$window.Height = 28

$tb = New-Object System.Windows.Controls.TextBlock
$tb.Text = Get-StatusText
$tb.Foreground = '#9B9BA1'
$tb.FontSize = 11
$tb.FontFamily = New-Object System.Windows.Media.FontFamily('Microsoft YaHei')
$tb.HorizontalAlignment = 'Center'
$tb.VerticalAlignment = 'Center'
$window.Content = $tb

$window.Add_SourceInitialized({
  $helper = New-Object System.Windows.Interop.WindowInteropHelper($window)
  $hwnd = $helper.Handle
  if ($hwnd -ne [IntPtr]::Zero) {
    $ex = [CtsNative]::GetWindowLong($hwnd, [CtsNative]::GWL_EXSTYLE)
    $ex = $ex -bor [CtsNative]::WS_EX_TRANSPARENT
    $ex = $ex -bor [CtsNative]::WS_EX_TOOLWINDOW
    $ex = $ex -bor [CtsNative]::WS_EX_NOACTIVATE
    [void][CtsNative]::SetWindowLong($hwnd, [CtsNative]::GWL_EXSTYLE, $ex)
  }
})

function Move-ToFooter {
  $r = Get-MimoRect
  if (-not $r) { return }
  $w = $r.Right - $r.Left
  $yFrom = 72
  if ($env:OVERLAY_Y_FROM_BOTTOM) { $yFrom = [int]$env:OVERLAY_Y_FROM_BOTTOM }
  $xc = 0.5
  if ($env:OVERLAY_X_CENTER) { $xc = [double]$env:OVERLAY_X_CENTER }
  $window.Left = [double]($r.Left + ($w * $xc) - ($window.Width / 2))
  $window.Top = [double]($r.Bottom - $yFrom)
}

$timer = New-Object System.Windows.Threading.DispatcherTimer
$timer.Interval = [TimeSpan]::FromMilliseconds(2000)
$timer.Add_Tick({
  $t = Get-StatusText
  if ($t) { $tb.Text = $t }
  Move-ToFooter
})
$timer.Start()

$window.Add_Loaded({
  Move-ToFooter
  $window.ShowActivated = $false
})

Write-Output 'cts-overlay started'
$window.ShowDialog() | Out-Null
