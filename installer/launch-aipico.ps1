# AI PICO - launcher: open browser instantly, start server in background
$AppDir = "$env:LOCALAPPDATA\AIPICO"
$Port = 3456
$ServerUrl = "http://localhost:$Port"

Start-Process $ServerUrl

function Find-Npm {
  $cmd = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  foreach ($p in @("$env:ProgramFiles\nodejs\npm.cmd", "${env:ProgramFiles(x86)}\nodejs\npm.cmd", "$env:LOCALAPPDATA\Programs\nodejs\npm.cmd")) {
    if (Test-Path $p) { return $p }
  }
  return $null
}

$running = $false
try { $c = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue; if ($c) { $running = $true } } catch {}

if (-not $running) {
  $npm = Find-Npm
  if ($npm -and (Test-Path "$AppDir\.next")) {
    Start-Process -FilePath $npm -ArgumentList "run","start","--","-p","$Port" -WorkingDirectory $AppDir -WindowStyle Hidden
  }
}
