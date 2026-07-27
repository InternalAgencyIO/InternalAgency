param(
  [switch]$TeaCache,
  [switch]$Force,
  [int]$Port = 7861
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$config = Get-Content -LiteralPath (Join-Path $PSScriptRoot "scenes.json") -Raw |
  ConvertFrom-Json
$manifestPath = Join-Path $repoRoot "assets\videos\manifest.json"

foreach ($scene in $config.scenes) {
  $file = "$($scene.id)-full-30fps.mp4"
  $output = Join-Path $repoRoot "assets\videos\$file"
  if ((Test-Path -LiteralPath $output) -and (Test-Path -LiteralPath $manifestPath) -and -not $Force) {
    $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
    $entry = $manifest.assets.PSObject.Properties[$file].Value
    if ($entry -and [math]::Abs([double]$entry.fps - 30) -le 0.01 -and
        [double]$entry.durationSeconds -ge ([double]$scene.durationSeconds - 1)) {
      Write-Output "Skipping verified master already on disk: $($scene.id)"
      continue
    }
  }

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
