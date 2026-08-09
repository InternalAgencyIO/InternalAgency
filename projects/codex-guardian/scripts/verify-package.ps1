[CmdletBinding()]
param(
    [ValidatePattern('^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$')]
    [string]$Version = '1.0.0'
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$artifactRoot = Join-Path $projectRoot 'artifacts'
$releaseRoot = Join-Path $artifactRoot 'release'
$verifyRoot = Join-Path $artifactRoot (Join-Path 'verify-package' $Version)
$packageName = "CodexGuardian-$Version-Windows-Portable"
$zipPath = Join-Path $releaseRoot ($packageName + '.zip')
$rawExe = Join-Path $releaseRoot ("CodexGuardian-$Version.exe")
$checksumPath = Join-Path $releaseRoot 'SHA256SUMS.txt'

$artifactFull = [IO.Path]::GetFullPath($artifactRoot).TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
$verifyFull = [IO.Path]::GetFullPath($verifyRoot)
if (-not $verifyFull.StartsWith($artifactFull, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing verification path outside artifacts: $verifyFull"
}

foreach ($required in @($zipPath, $rawExe, $checksumPath, (Join-Path $releaseRoot 'LICENSE.txt'))) {
    if (-not (Test-Path -LiteralPath $required -PathType Leaf)) { throw "Missing release asset: $required" }
}

if (Test-Path -LiteralPath $verifyRoot) { Remove-Item -LiteralPath $verifyRoot -Recurse -Force }
New-Item -ItemType Directory -Path $verifyRoot -Force | Out-Null
Expand-Archive -LiteralPath $zipPath -DestinationPath $verifyRoot

$expandedRoot = Join-Path $verifyRoot $packageName
$packagedExe = Join-Path $expandedRoot 'CodexGuardian.exe'
foreach ($required in @(
    $packagedExe,
    (Join-Path $expandedRoot 'README.md'),
    (Join-Path $expandedRoot 'START-HERE.txt'),
    (Join-Path $expandedRoot 'LICENSE.txt'),
    (Join-Path $expandedRoot 'docs\USER_GUIDE.md'),
    (Join-Path $expandedRoot 'docs\SAFETY_AND_RECOVERY.md')
)) {
    if (-not (Test-Path -LiteralPath $required -PathType Leaf)) { throw "Portable ZIP is missing: $required" }
}

$forbidden = Get-ChildItem -LiteralPath $expandedRoot -Recurse -File | Where-Object {
    $_.Extension -in @('.pdb', '.log', '.ini', '.tsv')
}
if ($forbidden) { throw "Portable ZIP contains generated/private files: $($forbidden.FullName -join ', ')" }

$rawHash = (Get-FileHash -LiteralPath $rawExe -Algorithm SHA256).Hash
$zipExeHash = (Get-FileHash -LiteralPath $packagedExe -Algorithm SHA256).Hash
if ($rawHash -ne $zipExeHash) { throw 'Raw EXE does not match the EXE inside the portable ZIP.' }

$selfTest = Start-Process -FilePath $packagedExe -ArgumentList '--self-test' -PassThru -Wait -WindowStyle Hidden
if ($selfTest.ExitCode -ne 0) { throw "Packaged EXE self-test failed with exit code $($selfTest.ExitCode)." }

$fileVersion = (Get-Item -LiteralPath $rawExe).VersionInfo.FileVersion
if ($fileVersion -ne ($Version + '.0')) { throw "Assembly file version $fileVersion does not match package version $Version." }

$checksumLines = Get-Content -LiteralPath $checksumPath | Where-Object { $_.Trim().Length -gt 0 }
if ($checksumLines.Count -ne 3) { throw 'SHA256SUMS.txt must contain exactly three assets.' }
foreach ($line in $checksumLines) {
    if ($line -notmatch '^([0-9a-f]{64})  ([^\\/]+)$') { throw "Invalid checksum line: $line" }
    $expected = $Matches[1]
    $asset = Join-Path $releaseRoot $Matches[2]
    if (-not (Test-Path -LiteralPath $asset -PathType Leaf)) { throw "Checksum references a missing asset: $asset" }
    $actual = (Get-FileHash -LiteralPath $asset -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $expected) { throw "Checksum mismatch for $asset" }
}

Write-Output 'Portable package verification passed.'
