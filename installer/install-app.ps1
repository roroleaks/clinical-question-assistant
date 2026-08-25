# AI PICO - post-install: extract app, install deps, build
$ErrorActionPreference = "Continue"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$AppDir  = "$env:LOCALAPPDATA\AIPICO"
$LogFile = "$AppDir\install.log"
if (-not (Test-Path $AppDir)) { New-Item -ItemType Directory -Path $AppDir -Force | Out-Null }

function Log($m) { try { "$(Get-Date -Format 'HH:mm:ss') | $m" | Out-File $LogFile -Append -Encoding utf8 } catch {} }
Log "===== AI PICO install started ====="

function Find-Node {
  $cmd = Get-Command node.exe -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  foreach ($p in @("$env:ProgramFiles\nodejs\node.exe", "${env:ProgramFiles(x86)}\nodejs\node.exe", "$env:LOCALAPPDATA\Programs\nodejs\node.exe")) {
    if (Test-Path $p) { return $p }
  }
  return $null
}

try {
  # 1. Node.js check/install
  $node = Find-Node
  if (-not $node) {
    Log "Node.js not found - installing..."
    $installer = "$env:TEMP\node-installer.msi"
    Invoke-WebRequest -Uri "https://nodejs.org/dist/v20.11.1/node-v20.11.1-x64.msi" -OutFile $installer -UseBasicParsing
    Start-Process msiexec.exe -ArgumentList "/i `"$installer`" /qn" -Wait
    $env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User")
    $node = Find-Node
    if (-not $node) { throw "Node.js installation failed" }
  }
  Log "Node: $node"
  $npm = Join-Path (Split-Path $node) "npm.cmd"

  # 2. Extract bundled app source
  $zip = Join-Path $PSScriptRoot "app-source.zip"
  if (-not (Test-Path $zip)) { throw "app-source.zip not found next to installer" }
  if (Test-Path $AppDir) { Remove-Item "$AppDir\*" -Recurse -Force -ErrorAction SilentlyContinue }
  $tmp = "$env:TEMP\aipico-extract"
  if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
  Expand-Archive -Path $zip -DestinationPath $tmp -Force
  $inner = Get-ChildItem $tmp -Directory | Select-Object -First 1
  Copy-Item "$($inner.FullName)\*" $AppDir -Recurse -Force
  Log "App extracted to $AppDir"

  # 3. Dependencies
  Set-Location $AppDir
  Log "Running npm install..."
  $out = & $npm install --no-audit --no-fund 2>&1
  Log ($out | Out-String)
  if ($LASTEXITCODE -ne 0) { throw "npm install failed (exit $LASTEXITCODE)" }
  Log "Dependencies installed"

  # 4. Build
  Log "Running production build..."
  $out = & $npm run build 2>&1
  Log ($out | Out-String)
  if ($LASTEXITCODE -ne 0) { throw "Build failed (exit $LASTEXITCODE)" }
  Log "Build completed"

  Log "===== install OK ====="
  exit 0
} catch {
  Log "ERROR: $($_.Exception.Message)"
  [System.Windows.Forms.MessageBox]::Show("AI PICO installation problem:`n$($_.Exception.Message)`n`nFull log: $LogFile", "AI PICO Setup") | Out-Null
  exit 1
}
