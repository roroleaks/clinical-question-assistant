# AI PICO - launcher: start server if not running, open browser
$AppDir = "$env:LOCALAPPDATA\AIPICO"
$Port = 3456
$ServerUrl = "http://localhost:$Port"

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
    for ($i = 0; $i -lt 20; $i++) {
      Start-Sleep -Seconds 2
      try { $r = Invoke-WebRequest -Uri $ServerUrl -UseBasicParsing -TimeoutSec 3; if ($r.StatusCode -eq 200) { $running = $true; break } } catch {}
    }
  }
}

Start-Process $ServerUrl
