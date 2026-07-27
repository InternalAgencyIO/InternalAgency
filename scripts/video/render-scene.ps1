param(
  [Parameter(Mandatory = $true)]
  [string]$Scene,
  [double]$Duration = 0,
  [switch]$TeaCache,
  [int]$Port = 7861
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$python = Join-Path $repoRoot "tools\framepack-runtime\framepack_cu126_torch26\system\python\python.exe"
$script = Join-Path $PSScriptRoot "render-framepack.py"

if (-not (Test-Path -LiteralPath $python)) {
  throw "FramePack runtime is missing. Follow scripts/video/README.md."
}

$arguments = @(
  $script,
  "--scene", $Scene,
  "--server", "http://127.0.0.1:$Port"
)
if ($Duration -gt 0) {
  $arguments += @("--duration", "$Duration")
}
if ($TeaCache) {
  $arguments += "--teacache"
}

& $python @arguments
exit $LASTEXITCODE
