[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$RuntimeRoot,

    [string]$RepoRoot = "",

    [string]$Server = "http://127.0.0.1:7861",

    [ValidateRange(0, 2147483641)]
    [int]$SeedBase = 910000,

    [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not $RepoRoot) {
    $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
} else {
    $RepoRoot = (Resolve-Path -LiteralPath $RepoRoot).Path
}

$resolvedRuntimeRoot = (Resolve-Path -LiteralPath $RuntimeRoot -ErrorAction Stop).Path
$pythonExe = Join-Path $resolvedRuntimeRoot "framepack_cu126_torch26\system\python\python.exe"
if (-not (Test-Path -LiteralPath $pythonExe -PathType Leaf)) {
    throw "Bundled FramePack Python is missing: $pythonExe"
}

$renderer = Join-Path $PSScriptRoot "render-scene.py"
if (-not (Test-Path -LiteralPath $renderer -PathType Leaf)) {
    throw "Scene renderer is missing: $renderer"
}

$env:PYTHONUTF8 = "1"

$projectRelative = "projects/nightflight-guardian-film"
$entries = @()
for ($index = 1; $index -le 6; $index++) {
    $scene = "scene-{0:D2}" -f $index
    $source = "$projectRelative/source/keyframes/$scene.png"
    $prompt = "$projectRelative/production/prompts/$scene.txt"
    $output = "$projectRelative/artifacts/scenes/$scene-15s.mp4"
    $metadata = "$projectRelative/artifacts/metadata/$scene.json"

    foreach ($required in @($source, $prompt)) {
        $absolute = Join-Path $RepoRoot ($required.Replace("/", "\"))
        if (-not (Test-Path -LiteralPath $absolute -PathType Leaf)) {
            throw "Required render input is missing: $absolute"
        }
    }

    foreach ($target in @($output, $metadata)) {
        $absolute = Join-Path $RepoRoot ($target.Replace("/", "\"))
        if ((Test-Path -LiteralPath $absolute) -and -not $Force) {
            throw "Render output already exists; use -Force to replace it: $absolute"
        }
    }

    $entries += [pscustomobject]@{
        Scene = $scene
        Source = $source
        Prompt = $prompt
        Output = $output
        Metadata = $metadata
        Seed = $SeedBase + $index
    }
}

foreach ($entry in $entries) {
    Write-Output "Rendering $($entry.Scene) with seed $($entry.Seed)..."
    $arguments = @(
        $renderer,
        "--repo-root", $RepoRoot,
        "--scene", $entry.Scene,
        "--source", $entry.Source,
        "--prompt-file", $entry.Prompt,
        "--output", $entry.Output,
        "--metadata-output", $entry.Metadata,
        "--seed", "$($entry.Seed)",
        "--server", $Server
    )
    & $pythonExe @arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Render failed for $($entry.Scene)."
    }

    $rendered = Join-Path $RepoRoot ($entry.Output.Replace("/", "\"))
    $metadata = Join-Path $RepoRoot ($entry.Metadata.Replace("/", "\"))
    if (-not (Test-Path -LiteralPath $rendered -PathType Leaf) -or
        -not (Test-Path -LiteralPath $metadata -PathType Leaf)) {
        throw "Renderer returned success without both outputs for $($entry.Scene)."
    }
}

Write-Output "All six NIGHTFLIGHT scenes passed the exact 15-second render contract."
