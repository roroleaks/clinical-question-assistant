; AI PICO - Classic Windows Installer
; Created by Dr Raouf Roshdy (c) 2026

[Setup]
AppName=AI PICO — Clinical Question Assistant
AppVersion=3.0
AppPublisher=Dr Raouf Roshdy
AppCopyright=Copyright (c) 2026 Dr Raouf Roshdy
DefaultDirName={localappdata}\AIPICO
DefaultGroupName=AI PICO
PrivilegesRequired=lowest
OutputDir=output
OutputBaseFilename=AIPICO-Setup
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
SetupIconFile=icon.ico
UninstallDisplayIcon={app}\app-source.zip
DisableProgramGroupPage=yes
LicenseFile=disclaimer.txt

[Files]
Source: "app-source.zip"; DestDir: "{app}"; Flags: ignoreversion
Source: "install-app.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "launch-aipico.ps1"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\AI PICO"; Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\launch-aipico.ps1"""; IconFilename: "{app}\app-icon.ico"
Name: "{autodesktop}\AI PICO"; Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\launch-aipico.ps1"""; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop shortcut"; GroupDescription: "Additional icons:"

[Run]
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\install-app.ps1"""; Flags: runhidden waituntilterminated; WorkingDir: "{app}"; StatusMsg: "Installing AI PICO — downloading dependencies and building (this may take a few minutes)…"
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\launch-aipico.ps1"""; Flags: postinstall skipifsilent runhidden; Description: "Launch AI PICO now"

[UninstallDelete]
Type: filesandordirs; Name: "{localappdata}\AIPICO"
