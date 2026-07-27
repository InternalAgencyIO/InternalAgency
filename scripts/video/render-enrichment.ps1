param(
  [int]$Port = 7861
)

$ErrorActionPreference = "Stop"
$config = Get-Content -LiteralPath (Join-Path $PSScriptRoot "scenes.json") -Raw |
  ConvertFrom-Json
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$manifestPath = Join-Path $repoRoot "assets\videos\manifest.json"

foreach ($scene in ($config.scenes | Where-Object collection -eq "enrichment")) {
  $file = "$($scene.id)-full-30fps.mp4"
  $output = Join-Path $repoRoot "assets\videos\$file"
  if ((Test-Path -LiteralPath $output) -and (Test-Path -LiteralPath $manifestPath)) {
    $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
    $entry = $manifest.assets.PSObject.Properties[$file].Value
    if ($entry -and [math]::Abs([double]$entry.fps - 30) -le 0.01 -and
        [double]$entry.durationSeconds -ge 19) {
      Write-Output "Skipping verified HQ enrichment: $($scene.id)"
      continue
    }
  }

  Write-Output "Rendering HQ enrichment: $($scene.id) ($($scene.durationSeconds)s)..."
  & powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "render-scene.ps1") `
    -Scene $scene.id -Port $Port
  if ($LASTEXITCODE -ne 0) {
    throw "Render failed for $($scene.id)."
  }
}

Write-Output "All six HQ enrichment videos are rendered."
