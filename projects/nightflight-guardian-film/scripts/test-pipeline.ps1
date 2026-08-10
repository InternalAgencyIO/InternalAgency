[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$RuntimeRoot
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$resolvedRuntimeRoot = (Resolve-Path -LiteralPath $RuntimeRoot -ErrorAction Stop).Path
$pythonExe = Join-Path $resolvedRuntimeRoot "framepack_cu126_torch26\system\python\python.exe"
if (-not (Test-Path -LiteralPath $pythonExe -PathType Leaf)) {
    throw "Bundled FramePack Python is missing: $pythonExe"
}

$powerShellScripts = Get-ChildItem -LiteralPath $PSScriptRoot -Filter "*.ps1" -File
foreach ($script in $powerShellScripts) {
    $tokens = $null
    $parseErrors = $null
    [System.Management.Automation.Language.Parser]::ParseFile(
        $script.FullName,
        [ref]$tokens,
        [ref]$parseErrors
    ) | Out-Null
    if ($parseErrors.Count -gt 0) {
        $messages = ($parseErrors | ForEach-Object { $_.Message }) -join [Environment]::NewLine
        throw "PowerShell syntax validation failed for $($script.FullName):`n$messages"
    }
}
Write-Output "PowerShell syntax validation passed for $($powerShellScripts.Count) scripts."

$previousDontWriteBytecode = $env:PYTHONDONTWRITEBYTECODE
try {
    $env:PYTHONDONTWRITEBYTECODE = "1"
    & $pythonExe (Join-Path $PSScriptRoot "render-scene.py") --self-test
    if ($LASTEXITCODE -ne 0) {
        throw "Scene render contract self-test failed."
    }
    & $pythonExe (Join-Path $PSScriptRoot "verify-master.py") --self-test
    if ($LASTEXITCODE -ne 0) {
        throw "Master verifier self-test failed."
    }
} finally {
    $env:PYTHONDONTWRITEBYTECODE = $previousDontWriteBytecode
}

& (Join-Path $PSScriptRoot "start-framepack.ps1") `
    -RuntimeRoot $resolvedRuntimeRoot `
    -ValidateOnly
if ($LASTEXITCODE -ne 0) {
    throw "FramePack runtime validation failed."
}

Write-Output "NIGHTFLIGHT pipeline self-tests passed without generated scene files."
