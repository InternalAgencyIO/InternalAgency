param(
  [switch]$TeaCache,
  [int]$Port = 7861
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$config = Get-Content -LiteralPath (Join-Path $PSScriptRoot "scenes.json") -Raw |
  ConvertFrom-Json

foreach ($scene in $config.scenes) {
  Write-Output "Rendering $($scene.id) ($($scene.durationSeconds)s at 30 fps)..."
  $arguments = @(
    "-ExecutionPolicy", "Bypass",
    "-File", (Join-Path $PSScriptRoot "render-scene.ps1"),
    "-Scene", $scene.id,
    "-Port", "$Port"
  )
  if ($TeaCache) {
    $arguments += "-TeaCache"
  }

  & powershell @arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Render failed for $($scene.id)."
  }
}

Write-Output "All Radiance scene masters are rendered."
