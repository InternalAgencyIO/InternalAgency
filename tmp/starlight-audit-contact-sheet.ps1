param([Parameter(Mandatory=$true)][string]$ManifestPath,[Parameter(Mandatory=$true)][string]$OutputPath)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$rows = @(Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json)
if ($rows.Count -lt 1 -or $rows.Count -gt 16) { throw 'One to sixteen screenshot records required.' }
if (Test-Path -LiteralPath $OutputPath) { throw 'Refusing to overwrite existing audit contact sheet.' }
$columns = 4
$tileWidth = 260
$tileHeight = 350
$sheet = New-Object System.Drawing.Bitmap ($columns * $tileWidth), ([int][Math]::Ceiling($rows.Count / $columns) * $tileHeight)
$graphics = [System.Drawing.Graphics]::FromImage($sheet)
$graphics.Clear([System.Drawing.Color]::White)
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$font = New-Object System.Drawing.Font 'Arial', 12
try {
  for ($index = 0; $index -lt $rows.Count; $index++) {
    $record = $rows[$index]
    $source = [System.Drawing.Image]::FromFile($record.path)
    try {
      $sourceRect = New-Object System.Drawing.Rectangle 0,0,$source.Width,$source.Height
      if ($record.clip) {
        $sourceRect = New-Object System.Drawing.Rectangle ([int]$record.clip.x),([int]$record.clip.y),([int]$record.clip.width),([int]$record.clip.height)
      }
      $scale = [Math]::Min(($tileWidth - 8) / $sourceRect.Width, ($tileHeight - 28) / $sourceRect.Height)
      $width = [int]($sourceRect.Width * $scale)
      $height = [int]($sourceRect.Height * $scale)
      $left = ($index % $columns) * $tileWidth
      $top = [int][Math]::Floor($index / $columns) * $tileHeight
      $graphics.DrawString([string]$record.label,$font,[System.Drawing.Brushes]::Black,[single]($left + 4),[single]($top + 3))
      $rect = New-Object System.Drawing.Rectangle ($left + [int](($tileWidth - $width) / 2)), ($top + 26), $width, $height
      $graphics.DrawImage($source,$rect,$sourceRect,[System.Drawing.GraphicsUnit]::Pixel)
    } finally { $source.Dispose() }
  }
  $sheet.Save($OutputPath,[System.Drawing.Imaging.ImageFormat]::Png)
} finally { $font.Dispose(); $graphics.Dispose(); $sheet.Dispose() }
Get-Item -LiteralPath $OutputPath | Select-Object FullName,Length
