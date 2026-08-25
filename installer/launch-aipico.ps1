# AI PICO - launcher: ensure server is up, then open browser
$AppDir = "$env:LOCALAPPDATA\AIPICO"
$Port = 3456
$ServerUrl = "http://localhost:$Port"
$Log = "$env:TEMP\aipico-launch.log"
function Log($m) { "$((Get-Date).ToString('HH:mm:ss')) | $m" | Out-File -Append -FilePath $Log }

function Find-Node {
  $cmd = Get-Command node.exe -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  foreach ($p in @("$env:ProgramFiles\nodejs\node.exe", "${env:ProgramFiles(x86)}\nodejs\node.exe", "$env:LOCALAPPDATA\Programs\nodejs\node.exe")) {
    if (Test-Path $p) { return $p }
  }
  return $null
}

function Is-Listening {
  try { $c = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue; return $null -ne $c } catch { return $false }
}

Log "Launcher start"
$running = Is-Listening

if (-not $running) {
  $node = Find-Node
  if ($node -and (Test-Path "$AppDir\.next")) {
    $npmCli = Join-Path (Split-Path $node) "node_modules\npm\bin\npm-cli.js"
    Log "node=$node npmCli=$npmCli"
    Start-Process -FilePath $node -ArgumentList "`"$npmCli`"","run","start","--","-p","$Port" -WorkingDirectory $AppDir -WindowStyle Hidden
    $tries = 0
    while (-not (Is-Listening) -and $tries -lt 30) { Start-Sleep 1; $tries++ }
    Log "server-wait done after $tries`s listening=$(Is-Listening)"
  } else {
    Log "SKIP start: node=$node next=$(Test-Path "$AppDir\.next")"
  }
}

Start-Process $ServerUrl
Log "browser launched"
