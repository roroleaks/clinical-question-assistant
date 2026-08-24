# AIPICO Launcher - Clinical Question Assistant
$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$AppDir = "$env:LOCALAPPDATA\AIPICO"
$Repo = "https://github.com/roroleaks/clinical-question-assistant.git"
$ServerUrl = "http://localhost:3456"

function Write-Step($msg) { Write-Host "`n[$([char]0x25B6)] $msg" -ForegroundColor Cyan }
function Write-Ok($msg) { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Info($msg) { Write-Host "  $msg" -ForegroundColor Gray }

Write-Host ""
Write-Host "  ==========================================" -ForegroundColor Cyan
Write-Host "     AI PICO - Clinical Question Assistant  " -ForegroundColor White
Write-Host "     Dr Raouf Roshdy (c) 2026               " -ForegroundColor Gray
Write-Host "  ==========================================" -ForegroundColor Cyan

# Step 1: Check Node.js
Write-Step "Checking Node.js..."
$nodeOk = $false
try {
  $v = & node --version 2>$null
  if ($v -match "v(\d+)\.") { if ([int]$Matches[1] -ge 18) { $nodeOk = $true; Write-Ok "Node.js $v found" } }
} catch {}
if (-not $nodeOk) {
  Write-Info "Node.js 18+ not found. Installing via winget..."
  $winget = Get-Command winget -ErrorAction SilentlyContinue
  if ($winget) {
    & winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements 2>$null
  } else {
    Write-Info "winget not available. Downloading Node.js installer..."
    $installer = "$env:TEMP\node-installer.msi"
    Invoke-WebRequest -Uri "https://nodejs.org/dist/v20.11.1/node-v20.11.1-x64.msi" -OutFile $installer -UseBasicParsing
    Start-Process msiexec.exe -ArgumentList "/i `"$installer`" /qn" -Wait
  }
  # Refresh PATH
  $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
  try { $v = & node --version 2>$null; Write-Ok "Node.js $v installed" } catch { Write-Host "  [X] Node.js installation failed. Please install from nodejs.org and rerun." -ForegroundColor Red; Read-Host "Press Enter to exit"; exit 1 }
}

# Step 2: Get/update app files
Write-Step "Preparing application files..."
if (-not (Test-Path $AppDir)) { New-Item -ItemType Directory -Path $AppDir -Force | Out-Null }

$hasPackage = Test-Path "$AppDir\package.json"
$hasSrc = Test-Path "$AppDir\src"
if (-not ($hasPackage -and $hasSrc)) {
  Write-Info "Downloading application (first run only)..."
  $zip = "$env:TEMP\aipico-app.zip"
  Invoke-WebRequest -Uri "$Repo/archive/refs/heads/main.zip" -OutFile $zip -UseBasicParsing
  $tmp = "$env:TEMP\aipico-extract"
  if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
  Expand-Archive -Path $zip -DestinationPath $tmp -Force
  $inner = Get-ChildItem $tmp -Directory | Select-Object -First 1
  Copy-Item "$($inner.FullName)\*" $AppDir -Recurse -Force
  Write-Ok "Application downloaded"
} else {
  Write-Ok "Application files found"
}

Set-Location $AppDir

# Step 3: Install dependencies
Write-Step "Installing dependencies (first run only)..."
if (-not (Test-Path "$AppDir\node_modules")) {
  & npm install --no-audit --no-fund 2>&1 | Out-Null
  Write-Ok "Dependencies installed"
} else {
  Write-Ok "Dependencies already installed"
}

# Step 4: Build if needed
Write-Step "Building application (first run only)..."
if (-not (Test-Path "$AppDir\.next")) {
  & npm run build 2>&1 | Out-Null
  Write-Ok "Application built"
} else {
  Write-Ok "Build found"
}

# Step 5: Start server
Write-Step "Starting AI PICO server..."
$existing = Get-NetTCPConnection -LocalPort 3456 -ErrorAction SilentlyContinue
if ($existing) {
  Write-Info "Server already running on port 3456"
} else {
  $env:PORT = "3456"
  Start-Process -FilePath "npm" -ArgumentList "run","start","--","-p","3456" -WorkingDirectory $AppDir -WindowStyle Hidden
  Write-Info "Waiting for server to start..."
  $ready = $false
  for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 2
    try { $r = Invoke-WebRequest -Uri $ServerUrl -UseBasicParsing -TimeoutSec 3; if ($r.StatusCode -eq 200) { $ready = $true; break } } catch {}
  }
  if ($ready) { Write-Ok "Server started" } else { Write-Host "  [X] Server failed to start" -ForegroundColor Red; Read-Host "Press Enter to exit"; exit 1 }
}

# Step 6: Open browser
Write-Step "Opening AI PICO..."
Start-Process $ServerUrl
Write-Host ""
Write-Host "  AI PICO is running at $ServerUrl" -ForegroundColor Green
Write-Host "  Keep this window open while using the app." -ForegroundColor Gray
Write-Host "  Close this window to keep the server running in background." -ForegroundColor DarkGray
Write-Host ""
Read-Host "Press Enter to close this launcher (app stays running)"
