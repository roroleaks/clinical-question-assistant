# AI PICO — Windows Desktop Launcher

## What is this?
`AIPICO.exe` turns your web app into a Windows desktop program. On first run it:
1. Installs Node.js (if missing)
2. Downloads the application from GitHub
3. Installs all dependencies
4. Builds the app
5. Starts a local server
6. Opens the interface in your browser

## How to distribute
Give users a ZIP containing:
- `AIPICO.exe` (the launcher)
- This README

They just double-click `AIPICO.exe` — everything else is automatic.

## Requirements
- Windows 10/11
- Internet connection (first run only)
- ~500MB free disk space

## Where is the app installed?
`%LOCALAPPDATA%\AIPICO`

## How to stop the server
Open Task Manager → find `node.exe` → End Task.
Or restart your PC.

## Rebuild the EXE
Edit `AIPICO-Launcher.ps1`, then:
```powershell
Import-Module ps2exe
Invoke-ps2exe -inputFile "AIPICO-Launcher.ps1" -outputFile "AIPICO.exe" -title "AI PICO" -version "3.0.0.0"
```
