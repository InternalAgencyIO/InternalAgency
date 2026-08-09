[CmdletBinding()]
param(
    [switch]$CaptureUi
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
& (Join-Path $PSScriptRoot 'build.ps1') -Configuration Release

$executable = Join-Path $projectRoot 'artifacts\build\Release\CodexGuardian.exe'
$process = Start-Process -FilePath $executable -ArgumentList '--self-test' -PassThru -Wait -WindowStyle Hidden
if ($process.ExitCode -ne 0) {
    throw "Codex Guardian self-test failed with exit code $($process.ExitCode)."
}

$sourceFiles = Get-ChildItem -LiteralPath $projectRoot -Recurse -File | Where-Object {
    $_.FullName -notlike (Join-Path $projectRoot 'artifacts\*') -and
    $_.Extension -in @('.cs', '.ps1', '.md', '.txt', '.yml', '.xml')
}
$sidMatch = $sourceFiles | Select-String -Pattern 'S-1-5-21-[0-9]+-[0-9]+-[0-9]+-[0-9]+'
if ($sidMatch) {
    throw 'Release-source privacy check found a Windows user SID.'
}
$privateSourceValues = @($env:USERPROFILE) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
foreach ($privateValue in $privateSourceValues) {
    $match = $sourceFiles | Select-String -Pattern $privateValue -SimpleMatch
    if ($match) {
        throw "Release-source privacy check found the current user profile path."
    }
}

$binaryBytes = [IO.File]::ReadAllBytes($executable)
$binaryText = [Text.Encoding]::UTF8.GetString($binaryBytes) + [Text.Encoding]::Unicode.GetString($binaryBytes)
$privateBinaryValues = @($env:USERPROFILE, $projectRoot) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
foreach ($privateValue in $privateBinaryValues) {
    if ($binaryText.IndexOf($privateValue, [StringComparison]::OrdinalIgnoreCase) -ge 0) {
        throw "Release binary contains a private build path: $privateValue"
    }
}

if ($CaptureUi) {
    $image = Join-Path $projectRoot 'artifacts\ui\main-window.png'
    New-Item -ItemType Directory -Path (Split-Path -Parent $image) -Force | Out-Null
    $captureArguments = '--capture-ui "' + $image.Replace('"', '\"') + '"'
    $capture = Start-Process -FilePath $executable -ArgumentList $captureArguments -PassThru -Wait
    if ($capture.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $image)) {
        throw 'UI capture failed.'
    }
    Write-Output "Captured $image"
}

Write-Output 'Verification passed: compile, self-test, and private-data scan.'
