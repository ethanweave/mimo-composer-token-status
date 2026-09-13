' MiMo wrapper - sole process orchestration entry for Token Status.
' 1) If MiMo is not running, start it with --remote-debugging-port=9222.
' 2) Always run one-shot CTS bootstrap (wait -> attach -> inject -> exit).
' CTS never launches MiMo; this wrapper is the only launcher.
Option Explicit

Dim shell, fso, mimoExe, bootstrapScript, nodeExe, mimoArgs, debugPort
Dim wmi, procs, p, alreadyRunning

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

mimoExe = shell.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\Programs\Xiaomi MiMo\Xiaomi MiMo.exe"
bootstrapScript = fso.GetParentFolderName(WScript.ScriptFullName) & "\bootstrap\bootstrap.mjs"
nodeExe = "C:\Program Files\nodejs\node.exe"
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
