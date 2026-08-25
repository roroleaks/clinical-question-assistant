Add-Type -AssemblyName System.Drawing
$ico = [System.Drawing.Icon]::ExtractAssociatedIcon("C:\Users\raouf.RAOUFDESKTOP\Documents\cq-app\installer\icon.ico")
$bmp = $ico.ToBitmap()
$bmp.Save("C:\Users\raouf.RAOUFDESKTOP\Documents\cq-app\installer\icon-preview.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose(); $ico.Dispose()
Write-Output "preview done"
