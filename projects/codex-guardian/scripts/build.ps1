[CmdletBinding()]
param(
    [ValidateSet('Debug', 'Release')]
    [string]$Configuration = 'Release'
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$sourceRoot = Join-Path $projectRoot 'src'
$outputRoot = Join-Path $projectRoot (Join-Path 'artifacts\build' $Configuration)

$compilerCandidates = @(
    (Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'),
    (Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe')
)
$compiler = $compilerCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $compiler) {
    throw 'The .NET Framework C# compiler was not found. Enable .NET Framework 4.8 in Windows Features.'
}

if (Test-Path -LiteralPath $outputRoot) { Remove-Item -LiteralPath $outputRoot -Recurse -Force }
New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null
$output = Join-Path $outputRoot 'CodexGuardian.exe'
$manifest = Join-Path $sourceRoot 'app.manifest'
$sources = Get-ChildItem -LiteralPath $sourceRoot -Filter '*.cs' -File | Sort-Object Name | ForEach-Object { $_.FullName }

$compilerArguments = @(
    '/nologo',
    '/target:winexe',
    '/platform:anycpu',
    '/warn:4',
    ('/win32manifest:' + $manifest),
    ('/out:' + $output),
    '/reference:System.dll',
    '/reference:System.Core.dll',
    '/reference:System.Drawing.dll',
    '/reference:System.Management.dll',
    '/reference:System.Windows.Forms.dll'
)

if ($Configuration -eq 'Release') {
    $compilerArguments += '/optimize+'
    $compilerArguments += '/debug-'
} else {
    $compilerArguments += '/optimize-'
    $compilerArguments += '/debug:full'
    $compilerArguments += '/define:DEBUG;TRACE'
}

& $compiler @compilerArguments @sources
if ($LASTEXITCODE -ne 0) {
    throw "C# compilation failed with exit code $LASTEXITCODE."
}

$built = Get-Item -LiteralPath $output
Write-Output ("Built {0} ({1:N0} bytes)" -f $built.FullName, $built.Length)
