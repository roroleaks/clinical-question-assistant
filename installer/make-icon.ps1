Add-Type -AssemblyName System.Drawing

function Draw-Icon($s) {
  $bmp = New-Object System.Drawing.Bitmap($s, $s)
  $bmp.MakeTransparent()
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.InterpolationMode = 'HighQualityBicubic'
  $g.PixelOffsetMode = 'HighQuality'
  $rad = [int]($s * 0.20)
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.StartFigure()
  $path.AddArc(0,0,$rad*2,$rad*2,180,90)
  $path.AddArc($s-$rad*2,0,$rad*2,$rad*2,270,90)
  $path.AddArc($s-$rad*2,$s-$rad*2,$rad*2,$rad*2,0,90)
  $path.AddArc(0,$s-$rad*2,$rad*2,$rad*2,90,90)
  $path.CloseFigure()
  $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.Point(0,0)),
    (New-Object System.Drawing.Point($s,$s)),
    [System.Drawing.Color]::FromArgb(255,20,184,166),
    [System.Drawing.Color]::FromArgb(255,12,74,110))
  $g.FillPath($brush, $path)
  $brush.Dispose()
  $cx = [int]($s*0.41); $cy = [int]($s*0.41); $r = [int]($s*0.21)
  $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, [int]($s*0.06))
  $pen.LineJoin = 'Round'
  $g.DrawEllipse($pen, $cx-$r, $cy-$r, $r*2, $r*2)
  $inner = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(45,255,255,255))
  $g.FillEllipse($inner, $cx-$r+[int]($s*0.03), $cy-$r+[int]($s*0.03), ($r-[int]($s*0.03))*2, ($r-[int]($s*0.03))*2)
  $inner.Dispose()
  $hpen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, [int]($s*0.08))
  $hpen.StartCap='Round'; $hpen.EndCap='Round'
  $g.DrawLine($hpen, $cx+$r-[int]($s*0.05), $cy+$r-[int]($s*0.05), [int]($s*0.74), [int]($s*0.74))
  $cross = [System.Drawing.Color]::FromArgb(255,13,148,136)
  $cb = New-Object System.Drawing.SolidBrush($cross)
  $t = [int]($s*0.027); $L = [int]($s*0.085)
  $g.FillRectangle($cb, $cx-$t, $cy-$L, $t*2, $L*2)
  $g.FillRectangle($cb, $cx-$L, $cy-$t, $L*2, $t*2)
  $cb.Dispose(); $pen.Dispose(); $hpen.Dispose(); $g.Dispose()
  return $bmp
}

function Frame-Bytes($bmp) {
  $w=$bmp.Width; $h=$bmp.Height
  $bd=$bmp.LockBits((New-Object System.Drawing.Rectangle(0,0,$w,$h)),'ReadOnly','Format32bppArgb')
  $stride=$bd.Stride
  $px=New-Object byte[]($stride*$h)
  [System.Runtime.InteropServices.Marshal]::Copy($bd.Scan0,$px,0,$px.Length)
  $bmp.UnlockBits($bd)
  $ms=New-Object System.IO.MemoryStream
  $bw=New-Object System.IO.BinaryWriter($ms)
  # BITMAPINFOHEADER
  $bw.Write([int32]40)
  $bw.Write([int32]$w)
  $bw.Write([int32]($h*2))
  $bw.Write([uint16]1)
  $bw.Write([uint16]32)
  $bw.Write([uint32]0)
  $bw.Write([uint32]($stride*$h))
  $bw.Write([int32]0); $bw.Write([int32]0); $bw.Write([uint32]0); $bw.Write([uint32]0)
  $bw.Write($px)
  # AND mask (zeros)
  $maskW = [int]([Math]::Ceiling($w/32)*4)
  $mask = New-Object byte[]($maskW*$h)
  $bw.Write($mask)
  $bw.Flush()
  $out=$ms.ToArray(); $bw.Close(); $ms.Close()
  return $out
}

$sizes = @(256,48,32,16)
$bmps = $sizes | ForEach-Object { Draw-Icon $_ }
$frames = New-Object System.Collections.ArrayList
foreach ($b in $bmps) { [void]$frames.Add((Frame-Bytes $b)) }
$frames = $frames.ToArray()

$outPath = "C:\Users\raouf.RAOUFDESKTOP\Documents\cq-app\installer\icon.ico"
$ms=New-Object System.IO.MemoryStream
$bw=New-Object System.IO.BinaryWriter($ms)
$bw.Write([uint16]0); $bw.Write([uint16]1); $bw.Write([uint16]$frames.Count)
$offset = 6 + 16*$frames.Count
for ($i=0; $i -lt $frames.Count; $i++) {
  $sz = $sizes[$i]
  $bw.Write([byte]($sz -band 0xFF))
  $bw.Write([byte]($sz -band 0xFF))
  $bw.Write([byte]0); $bw.Write([byte]0)
  $bw.Write([uint16]1); $bw.Write([uint16]32)
  $bw.Write([uint32]$frames[$i].Length)
  $bw.Write([uint32]$offset)
  $offset += $frames[$i].Length
}
foreach ($f in $frames) { $bw.Write([byte[]]$f) }
$bw.Flush()
[System.IO.File]::WriteAllBytes($outPath, $ms.ToArray())
$bw.Close(); $ms.Close()
$bmps | ForEach-Object { $_.Dispose() }
Write-Output "Wrote classic BMP ICO: $outPath"
Get-Item $outPath | Select-Object Length
