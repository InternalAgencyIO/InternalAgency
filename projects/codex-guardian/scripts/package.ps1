[CmdletBinding()]
param(
    [ValidatePattern('^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$')]
    [string]$Version = '1.0.0'
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
& (Join-Path $PSScriptRoot 'verify.ps1')

$artifactRoot = Join-Path $projectRoot 'artifacts'
$releaseRoot = Join-Path $artifactRoot 'release'
$stagingRoot = Join-Path $artifactRoot 'package'
$packageName = "CodexGuardian-$Version-Windows-Portable"
$packageFolder = Join-Path $stagingRoot $packageName
$zipPath = Join-Path $releaseRoot ($packageName + '.zip')
$rawExe = Join-Path $releaseRoot ("CodexGuardian-$Version.exe")
$builtExe = Join-Path $artifactRoot 'build\Release\CodexGuardian.exe'
$licenseSource = Join-Path $projectRoot '..\..\LICENSE'
$releaseLicense = Join-Path $releaseRoot 'LICENSE.txt'

function Assert-ChildPath([string]$Parent, [string]$Child) {
    $parentFull = [IO.Path]::GetFullPath($Parent).TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
    $childFull = [IO.Path]::GetFullPath($Child)
    if (-not $childFull.StartsWith($parentFull, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing path outside expected artifact root: $childFull"
    }
}

Assert-ChildPath $artifactRoot $releaseRoot
Assert-ChildPath $artifactRoot $stagingRoot
Assert-ChildPath $stagingRoot $packageFolder

if (Test-Path -LiteralPath $releaseRoot) { Remove-Item -LiteralPath $releaseRoot -Recurse -Force }
New-Item -ItemType Directory -Path $releaseRoot -Force | Out-Null
if (Test-Path -LiteralPath $packageFolder) { Remove-Item -LiteralPath $packageFolder -Recurse -Force }
New-Item -ItemType Directory -Path $packageFolder -Force | Out-Null

Copy-Item -LiteralPath $builtExe -Destination (Join-Path $packageFolder 'CodexGuardian.exe')
Copy-Item -LiteralPath (Join-Path $projectRoot 'README.md') -Destination (Join-Path $packageFolder 'README.md')
Copy-Item -LiteralPath (Join-Path $projectRoot 'START-HERE.txt') -Destination (Join-Path $packageFolder 'START-HERE.txt')
Copy-Item -LiteralPath $licenseSource -Destination (Join-Path $packageFolder 'LICENSE.txt')
Copy-Item -LiteralPath (Join-Path $projectRoot 'docs') -Destination (Join-Path $packageFolder 'docs') -Recurse
Copy-Item -LiteralPath (Join-Path $projectRoot 'CHANGELOG.md') -Destination (Join-Path $packageFolder 'CHANGELOG.md')
Copy-Item -LiteralPath (Join-Path $projectRoot 'SECURITY.md') -Destination (Join-Path $packageFolder 'SECURITY.md')

if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
Compress-Archive -LiteralPath $packageFolder -DestinationPath $zipPath -CompressionLevel Optimal
Copy-Item -LiteralPath $builtExe -Destination $rawExe -Force
Copy-Item -LiteralPath $licenseSource -Destination $releaseLicense -Force

$assets = @($zipPath, $rawExe, $releaseLicense)
$checksums = foreach ($asset in $assets) {
    $hash = Get-FileHash -LiteralPath $asset -Algorithm SHA256
    "{0}  {1}" -f $hash.Hash.ToLowerInvariant(), (Split-Path -Leaf $asset)
}
$checksumPath = Join-Path $releaseRoot 'SHA256SUMS.txt'
$checksums | Set-Content -LiteralPath $checksumPath -Encoding ascii

& (Join-Path $PSScriptRoot 'verify-package.ps1') -Version $Version

Write-Output "Release assets:"
Get-ChildItem -LiteralPath $releaseRoot -File | Select-Object Name, Length, LastWriteTime
