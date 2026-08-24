# AI PICO — GUI Launcher (c) Dr Raouf Roshdy 2026
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$AppDir   = "$env:LOCALAPPDATA\AIPICO"
$Repo     = "https://github.com/roroleaks/clinical-question-assistant/archive/refs/heads/main.zip"
$Port     = 3456
$ServerUrl = "http://localhost:$Port"
$LogFile  = "$AppDir\install.log"
$DisclaimerFile = "$AppDir\.disclaimer-accepted"

if (-not (Test-Path $AppDir)) { New-Item -ItemType Directory -Path $AppDir -Force | Out-Null }

function Log($msg) {
  try { "$(Get-Date -Format 'HH:mm:ss') | $msg" | Out-File $LogFile -Append -Encoding utf8 } catch {}
}

function Find-Node {
  $cmd = Get-Command node.exe -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  foreach ($p in @("$env:ProgramFiles\nodejs\node.exe", "${env:ProgramFiles(x86)}\nodejs\node.exe", "$env:LOCALAPPDATA\Programs\nodejs\node.exe")) {
    if (Test-Path $p) { return $p }
  }
  return $null
}

function Find-Npm {
  $node = Find-Node
  if ($node) {
    $dir = Split-Path $node
    $npm = Join-Path $dir "npm.cmd"
    if (Test-Path $npm) { return $npm }
  }
  $cmd = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  return $null
}

function Install-Nodejs {
  $winget = Get-Command winget.exe -ErrorAction SilentlyContinue
  if ($winget) {
    & winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements --silent | Out-Null
  } else {
    $installer = "$env:TEMP\node-installer.msi"
    Invoke-WebRequest -Uri "https://nodejs.org/dist/v20.11.1/node-v20.11.1-x64.msi" -OutFile $installer -UseBasicParsing
    Start-Process msiexec.exe -ArgumentList "/i `"$installer`" /qn" -Wait
  }
  $env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User")
}

# ---------- Disclaimer ----------
$needDisclaimer = -not (Test-Path $DisclaimerFile)
if ($needDisclaimer) {
  $df = New-Object System.Windows.Forms.Form
  $df.Text = "AI PICO — Disclaimer"
  $df.Size = New-Object System.Drawing.Size(560, 480)
  $df.StartPosition = "CenterScreen"
  $df.FormBorderStyle = "FixedDialog"
  $df.MaximizeBox = $false
  $df.Icon = [System.Drawing.SystemIcons]::Information

  $lbl = New-Object System.Windows.Forms.Label
  $lbl.Text = @"
AI PICO — Clinical Question Assistant
Created by Dr Raouf Roshdy  (c) 2026 — All rights reserved

IMPORTANT DISCLAIMER — READ BEFORE CONTINUING

1. This software is for EDUCATIONAL and ACADEMIC RESEARCH purposes only.
2. It is NOT a medical device and is NOT certified for clinical use or patient-care decisions.
3. AI-generated content may contain errors, omissions, or outdated information.
4. Always verify formulated questions, references, and evidence against original sources before any professional use.
5. Do NOT enter any patient-identifiable data into this application.
6. Provided "as is", without warranty of any kind. The author accepts no liability for any use.

By clicking "I Accept" you agree to these terms.
"@
  $lbl.Location = New-Object System.Drawing.Point(16, 12)
  $lbl.Size = New-Object System.Drawing.Size(510, 340)
  $lbl.Font = New-Object System.Drawing.Font("Segoe UI", 10)
  $df.Controls.Add($lbl)

  $accept = New-Object System.Windows.Forms.Button
  $accept.Text = "I Accept"
  $accept.Location = New-Object System.Drawing.Point(330, 385)
  $accept.Size = New-Object System.Drawing.Size(100, 34)
  $df.Controls.Add($accept)

  $decline = New-Object System.Windows.Forms.Button
  $decline.Text = "Decline & Exit"
  $decline.Location = New-Object System.Drawing.Point(120, 385)
  $decline.Size = New-Object System.Drawing.Size(100, 34)
  $df.Controls.Add($decline)

  $decline.Add_Click({ $df.DialogResult = [System.Windows.Forms.DialogResult]::No; $df.Close() })
  $accept.Add_Click({ $df.DialogResult = [System.Windows.Forms.DialogResult]::Yes; $df.Close() })

  $r = $df.ShowDialog()
  if ($r -ne [System.Windows.Forms.DialogResult]::Yes) { exit 0 }
  "Accepted $(Get-Date -Format 'yyyy-MM-dd HH:mm')" | Out-File $DisclaimerFile -Encoding utf8
}

# ---------- Main progress form ----------
$form = New-Object System.Windows.Forms.Form
$form.Text = "AI PICO — Setup"
$form.Size = New-Object System.Drawing.Size(560, 300)
$form.StartPosition = "CenterScreen"
$form.FormBorderStyle = "FixedDialog"
$form.MaximizeBox = $false

$title = New-Object System.Windows.Forms.Label
$title.Text = "AI PICO — Clinical Question Assistant"
$title.Font = New-Object System.Drawing.Font("Segoe UI", 14, [System.Drawing.FontStyle]::Bold)
$title.ForeColor = [System.Drawing.Color]::FromArgb(15,107,107)
$title.Location = New-Object System.Drawing.Point(16, 12)
$title.Size = New-Object System.Drawing.Size(510, 30)
$form.Controls.Add($title)

$subtitle = New-Object System.Windows.Forms.Label
$subtitle.Text = "Created by Dr Raouf Roshdy (c) 2026"
$subtitle.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Italic)
$subtitle.ForeColor = [System.Drawing.Color]::Gray
$subtitle.Location = New-Object System.Drawing.Point(16, 42)
$subtitle.Size = New-Object System.Drawing.Size(510, 20)
$form.Controls.Add($subtitle)

$status = New-Object System.Windows.Forms.Label
$status.Text = "Preparing…"
$status.Location = New-Object System.Drawing.Point(16, 90)
$status.Size = New-Object System.Drawing.Size(510, 24)
$form.Controls.Add($status)

$bar = New-Object System.Windows.Forms.ProgressBar
$bar.Location = New-Object System.Drawing.Point(16, 120)
$bar.Size = New-Object System.Drawing.Size(510, 22)
$bar.Style = "Continuous"
$form.Controls.Add($bar)

$details = New-Object System.Windows.Forms.TextBox
$details.Multiline = $true
$details.ReadOnly = $true
$details.ScrollBars = "Vertical"
$details.Font = New-Object System.Drawing.Font("Consolas", 8.5)
$details.Location = New-Object System.Drawing.Point(16, 155)
$details.Size = New-Object System.Drawing.Size(510, 90)
$form.Controls.Add($details)

$doneBtn = New-Object System.Windows.Forms.Button
$doneBtn.Text = "Launch AI PICO"
$doneBtn.Location = New-Object System.Drawing.Point(400, 255 - 25)
$doneBtn.Size = New-Object System.Drawing.Size(126, 34)
$doneBtn.Enabled = $false
$form.Controls.Add($doneBtn)

function Set-Status($msg, $pct, $detail) {
  $status.Text = $msg
  if ($pct -ge 0) { $bar.Value = [Math]::Min(100, $pct) }
  if ($detail) { $details.AppendText("$detail`r`n"); Log $detail }
  [System.Windows.Forms.Application]::DoEvents()
}

$doneBtn.Add_Click({
  Start-Process $ServerUrl
  $form.Close()
})

$form.Show()
$form.Refresh()
[System.Windows.Forms.Application]::DoEvents()

Log "===== AI PICO setup started ====="

try {
  # Step 1: Node.js
  Set-Status "Checking Node.js…" 5 ""
  $node = Find-Node
  if (-not $node) {
    Set-Status "Installing Node.js (one-time)…" 10 "Node.js not found — installing via winget/MSI"
    Install-Nodejs
    $node = Find-Node
    if (-not $node) { throw "Node.js installation failed. Please install from nodejs.org then run this again. Full log: $LogFile" }
  }
  Set-Status "Node.js found" 20 "Node: $node"

  # Step 2: App files
  Set-Status "Preparing application files…" 30 ""
  if (-not (Test-Path "$AppDir\package.json") -or -not (Test-Path "$AppDir\src")) {
    Set-Status "Downloading application (one-time)…" 35 "Fetching from GitHub…"
    $zip = "$env:TEMP\aipico-app.zip"
    Invoke-WebRequest -Uri $Repo -OutFile $zip -UseBasicParsing
    Set-Status "Extracting…" 45 ""
    $tmp = "$env:TEMP\aipico-extract"
    if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
    Expand-Archive -Path $zip -DestinationPath $tmp -Force
    $inner = Get-ChildItem $tmp -Directory | Select-Object -First 1
    Copy-Item "$($inner.FullName)\*" $AppDir -Recurse -Force
    Set-Status "Application downloaded" 50 ""
  } else {
    Set-Status "Application files found" 50 ""
  }

  $npm = Find-Npm
  if (-not $npm) { throw "npm not found next to Node.js. Please reinstall Node.js from nodejs.org. Log: $LogFile" }

  # Step 3: dependencies
  Set-Location $AppDir
  if (-not (Test-Path "$AppDir\node_modules")) {
    Set-Status "Installing dependencies (one-time, few minutes)…" 55 "Running npm install…"
    $out = & $npm install --no-audit --no-fund 2>&1
    Log ($out | Out-String)
    if ($LASTEXITCODE -ne 0) { throw "npm install failed (exit $LASTEXITCODE). Log: $LogFile" }
    Set-Status "Dependencies installed" 70 "npm install completed"
  } else {
    Set-Status "Dependencies already installed" 70 ""
  }

  # Step 4: build
  if (-not (Test-Path "$AppDir\.next")) {
    Set-Status "Building application (one-time)…" 75 "Running production build…"
    $out = & $npm run build 2>&1
    Log ($out | Out-String)
    if ($LASTEXITCODE -ne 0) { throw "Build failed (exit $LASTEXITCODE). Log: $LogFile" }
    Set-Status "Build completed" 85 ""
  } else {
    Set-Status "Build already present" 85 ""
  }

  # Step 5: server
  Set-Status "Starting AI PICO server…" 90 ""
  $running = $false
  try { $c = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue; if ($c) { $running = $true } } catch {}
  if (-not $running) {
    Start-Process -FilePath $npm -ArgumentList "run","start","--","-p","$Port" -WorkingDirectory $AppDir -WindowStyle Hidden
    for ($i = 0; $i -lt 30; $i++) {
      Start-Sleep -Seconds 2
      try { $r = Invoke-WebRequest -Uri $ServerUrl -UseBasicParsing -TimeoutSec 3; if ($r.StatusCode -eq 200) { $running = $true; break } } catch {}
    }
    if (-not $running) { throw "Server did not start. Log: $LogFile" }
  }
  Set-Status "Server running" 100 "Ready at $ServerUrl"
  $status.Text = "✔ Ready! Click Launch to open AI PICO"
  $status.ForeColor = [System.Drawing.Color]::FromArgb(21,128,61)
  $doneBtn.Enabled = $true
  $doneBtn.BackColor = [System.Drawing.Color]::FromArgb(15,107,107)
  $doneBtn.ForeColor = [System.Drawing.Color]::White
  Start-Process $ServerUrl
} catch {
  Set-Status "Setup problem" 100 $_.Exception.Message
  $status.ForeColor = [System.Drawing.Color]::Firebrick
  $details.AppendText("`nERROR: $($_.Exception.Message)`r`n")
  Log "ERROR: $($_.Exception.Message)"
  $retry = New-Object System.Windows.Forms.Button
  $retry.Text = "Open install log"
  $retry.Location = New-Object System.Drawing.Point(16, 255 - 25)
  $retry.Size = New-Object System.Drawing.Size(140, 34)
  $retry.Add_Click({ if (Test-Path $LogFile) { Notepad $LogFile } })
  $form.Controls.Add($retry)
}

$form.TopMost = $true
$form.Activate()
[System.Windows.Forms.Application]::Run($form)
