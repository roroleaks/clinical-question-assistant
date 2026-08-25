' AI PICO Launcher - completely hidden, no console flash
' (c) Dr Raouf Roshdy 2026
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & WshShell.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\AIPICO\launch-aipico.ps1""", 0, False
