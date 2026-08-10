[CmdletBinding()]
param(
    [string]$FfmpegRoot = "",

    [string]$Master = "",

    [string]$MetadataOutput = "",

    [string]$PythonExe = "",

    [switch]$SelfTest
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Find-Ffprobe {
    param([Parameter(Mandatory = $true)][string]$Root)

    $resolvedRoot = (Resolve-Path -LiteralPath $Root -ErrorAction Stop).Path
    $candidates = @(
        (Join-Path $resolvedRoot "ffprobe.exe"),
        (Join-Path $resolvedRoot "bin\ffprobe.exe")
    )
    $candidates += Get-ChildItem -LiteralPath $resolvedRoot -Directory -Force -ErrorAction SilentlyContinue |
        ForEach-Object { Join-Path $_.FullName "bin\ffprobe.exe" }
    $matches = @($candidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -Unique)
    if ($matches.Count -ne 1) {
        throw "Expected exactly one ffprobe.exe below $resolvedRoot; found $($matches.Count)."
    }
    return (Resolve-Path -LiteralPath $matches[0]).Path
}

if (-not $PythonExe) {
    $pythonCommand = Get-Command python.exe -ErrorAction Stop
    $PythonExe = $pythonCommand.Source
} else {
    $PythonExe = (Resolve-Path -LiteralPath $PythonExe -ErrorAction Stop).Path
}

$verifier = Join-Path $PSScriptRoot "verify-master.py"
if (-not (Test-Path -LiteralPath $verifier -PathType Leaf)) {
    throw "Master verifier is missing: $verifier"
}

if ($SelfTest) {
    & $PythonExe $verifier --self-test
    if ($LASTEXITCODE -ne 0) {
        throw "Master verifier self-test failed."
    }
    exit 0
}

if (-not $FfmpegRoot) {
    throw "-FfmpegRoot is required."
}
if (-not $Master) {
    throw "-Master is required."
}

$ffprobe = Find-Ffprobe -Root $FfmpegRoot
$resolvedMaster = (Resolve-Path -LiteralPath $Master -ErrorAction Stop).Path
$arguments = @($verifier, "--ffprobe", $ffprobe, "--master", $resolvedMaster)
if ($MetadataOutput) {
    $metadataPath = [System.IO.Path]::GetFullPath($MetadataOutput)
    $arguments += @("--metadata-output", $metadataPath)
}

& $PythonExe @arguments
if ($LASTEXITCODE -ne 0) {
    throw "NIGHTFLIGHT master verification failed."
}
