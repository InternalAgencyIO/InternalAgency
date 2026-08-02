param(
  [Parameter(Mandatory = $true)]
  [string]$Source,
  [Parameter(Mandatory = $true)]
  [string]$Country,
  [Parameter(Mandatory = $true)]
  [int]$Batch,
  [Parameter(Mandatory = $true)]
  [int]$SourceImageNumber,
  [Parameter(Mandatory = $true)]
  [string]$PromptFile,
  [string]$Output = "",
  [switch]$TeaCache,
  [int]$Port = 7861
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$python = Join-Path $repoRoot "tools\framepack-runtime\framepack_cu126_torch26\system\python\python.exe"
$script = Join-Path $PSScriptRoot "render-world-country.py"
$env:PYTHONUTF8 = "1"

if (-not (Test-Path -LiteralPath $python)) {
  throw "FramePack runtime is missing. Follow scripts/video/README.md."
}

$arguments = @(
  $script,
  "--source", $Source,
  "--country", $Country,
  "--batch", "$Batch",
  "--source-image-number", "$SourceImageNumber",
  "--prompt-file", $PromptFile,
  "--server", "http://127.0.0.1:$Port"
)
if ($Output) {
  $arguments += @("--output", $Output)
}
if ($TeaCache) {
  $arguments += "--teacache"
}

& $python @arguments
exit $LASTEXITCODE
