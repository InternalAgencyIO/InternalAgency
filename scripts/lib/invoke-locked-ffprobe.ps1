[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('version', 'probe')]
    [string]$Mode,

    [Parameter(Mandatory = $true)]
    [string]$ToolPath,

    [Parameter(Mandatory = $true)]
    [string]$ArgumentsBase64,

    [Parameter(Mandatory = $true)]
    [int64]$ExpectedToolBytes,

    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[a-f0-9]{64}$')]
    [string]$ExpectedToolSha256,

    [string]$MediaPath = '',

    [int64]$ExpectedMediaBytes = 0,

    [string]$ExpectedMediaSha256 = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-StreamEvidence {
    param([Parameter(Mandatory = $true)][System.IO.FileStream]$Stream)

    $Stream.Position = 0
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $digest = $sha.ComputeHash($Stream)
    }
    finally {
        $sha.Dispose()
    }

    return [ordered]@{
        bytes = [int64]$Stream.Length
        sha256 = -join ($digest | ForEach-Object { $_.ToString('x2') })
    }
}

function Get-BytesSha256 {
    param([Parameter(Mandatory = $true)][byte[]]$Bytes)

    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $digest = $sha.ComputeHash($Bytes)
    }
    finally {
        $sha.Dispose()
    }
    return -join ($digest | ForEach-Object { $_.ToString('x2') })
}

$toolFullPath = [System.IO.Path]::GetFullPath($ToolPath)
$argumentsBytes = [System.Convert]::FromBase64String($ArgumentsBase64)
$argumentsJson = [System.Text.Encoding]::UTF8.GetString($argumentsBytes)
$decodedArguments = ConvertFrom-Json -InputObject $argumentsJson
$ffprobeArguments = @($decodedArguments | ForEach-Object { $_ })
if ($ffprobeArguments.Count -eq 0 -or @($ffprobeArguments | Where-Object { $_ -isnot [string] }).Count -ne 0) {
    throw 'Locked FFprobe arguments must be a non-empty JSON string array'
}

if ($Mode -eq 'version' -and $MediaPath) {
    throw 'Version mode cannot accept a media path'
}
if ($Mode -eq 'probe' -and -not $MediaPath) {
    throw 'Probe mode requires a media path'
}
if ($Mode -eq 'version' -and ($ExpectedMediaBytes -ne 0 -or $ExpectedMediaSha256)) {
    throw 'Version mode cannot accept expected media evidence'
}
if ($Mode -eq 'probe' -and ($ExpectedMediaBytes -le 0 -or $ExpectedMediaSha256 -notmatch '^[a-f0-9]{64}$')) {
    throw 'Probe mode requires exact expected media evidence'
}

$toolStream = $null
$mediaStream = $null
$stderrPath = Join-Path ([System.IO.Path]::GetDirectoryName($toolFullPath)) ('.locked-ffprobe-stderr-' + [guid]::NewGuid().ToString('N') + '.txt')

try {
    # FileShare.Read permits the exact executable/media to be opened for reading by
    # FFprobe while denying writes, replacement, rename, and deletion until the
    # evidence after invocation has been computed from these same descriptors.
    $toolStream = [System.IO.File]::Open(
        $toolFullPath,
        [System.IO.FileMode]::Open,
        [System.IO.FileAccess]::Read,
        [System.IO.FileShare]::Read
    )
    $toolBefore = Get-StreamEvidence -Stream $toolStream
    if ($toolBefore.bytes -ne $ExpectedToolBytes -or $toolBefore.sha256 -ne $ExpectedToolSha256) {
        throw 'Locked FFprobe tool evidence does not match the exact pin before invocation'
    }

    $mediaBefore = $null
    if ($Mode -eq 'probe') {
        $mediaFullPath = [System.IO.Path]::GetFullPath($MediaPath)
        $mediaStream = [System.IO.File]::Open(
            $mediaFullPath,
            [System.IO.FileMode]::Open,
            [System.IO.FileAccess]::Read,
            [System.IO.FileShare]::Read
        )
        $mediaBefore = Get-StreamEvidence -Stream $mediaStream
        if ($mediaBefore.bytes -ne $ExpectedMediaBytes -or $mediaBefore.sha256 -ne $ExpectedMediaSha256) {
            throw 'Locked media evidence does not match the staged input before invocation'
        }
    }

    $stdoutLines = @(& $toolFullPath @ffprobeArguments 2> $stderrPath)
    $exitCode = [int]$LASTEXITCODE
    $stdout = [string]::Join([System.Environment]::NewLine, [string[]]$stdoutLines)
    if ($stdoutLines.Count -gt 0) {
        $stdout += [System.Environment]::NewLine
    }
    $stderr = if (Test-Path -LiteralPath $stderrPath) {
        [System.IO.File]::ReadAllText($stderrPath)
    }
    else {
        ''
    }

    $toolAfter = Get-StreamEvidence -Stream $toolStream
    $mediaAfter = if ($null -ne $mediaStream) {
        Get-StreamEvidence -Stream $mediaStream
    }
    else {
        $null
    }
    if ($toolAfter.bytes -ne $ExpectedToolBytes -or $toolAfter.sha256 -ne $ExpectedToolSha256) {
        throw 'Locked FFprobe tool evidence changed during invocation'
    }
    if (
        $null -ne $mediaStream -and
        ($mediaAfter.bytes -ne $ExpectedMediaBytes -or $mediaAfter.sha256 -ne $ExpectedMediaSha256)
    ) {
        throw 'Locked media evidence changed during invocation'
    }

    [ordered]@{
        schemaVersion = 1
        mode = $Mode
        argumentsSha256 = Get-BytesSha256 -Bytes $argumentsBytes
        tool = [ordered]@{
            before = $toolBefore
            after = $toolAfter
        }
        media = if ($null -ne $mediaStream) {
            [ordered]@{
                before = $mediaBefore
                after = $mediaAfter
            }
        }
        else {
            $null
        }
        status = $exitCode
        stdout = $stdout
        stderr = $stderr
    } | ConvertTo-Json -Compress -Depth 6
}
finally {
    if ($null -ne $mediaStream) {
        $mediaStream.Dispose()
    }
    if ($null -ne $toolStream) {
        $toolStream.Dispose()
    }
    Remove-Item -LiteralPath $stderrPath -Force -ErrorAction SilentlyContinue
}
