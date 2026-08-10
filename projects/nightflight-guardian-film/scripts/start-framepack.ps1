[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$RuntimeRoot,

    [ValidateRange(1024, 65535)]
    [int]$Port = 7861,

    [ValidateRange(10, 1800)]
    [int]$ReadyTimeoutSeconds = 600,

    [switch]$ValidateOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Resolve-RequiredPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,

        [Parameter(Mandatory = $true)]
        [string]$Description,

        [switch]$Directory
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        throw "$Description is missing: $Path"
    }

    $item = Get-Item -LiteralPath $Path -Force
    if ($Directory -and -not $item.PSIsContainer) {
        throw "$Description must be a directory: $Path"
    }
    if (-not $Directory -and $item.PSIsContainer) {
        throw "$Description must be a file: $Path"
    }
    return $item.FullName
}

$resolvedRuntimeRoot = Resolve-RequiredPath -Path $RuntimeRoot -Description "FramePack runtime root" -Directory
$bundleRoot = Resolve-RequiredPath `
    -Path (Join-Path $resolvedRuntimeRoot "framepack_cu126_torch26") `
    -Description "FramePack Windows bundle" `
    -Directory
$serverRoot = Resolve-RequiredPath `
    -Path (Join-Path $resolvedRuntimeRoot "FramePack-current") `
    -Description "FramePack checkout" `
    -Directory
$pythonExe = Resolve-RequiredPath `
    -Path (Join-Path $bundleRoot "system\python\python.exe") `
    -Description "Bundled FramePack Python"
$pythonScripts = Resolve-RequiredPath `
    -Path (Join-Path $bundleRoot "system\python\Scripts") `
    -Description "Bundled Python Scripts directory" `
    -Directory
$gitBin = Resolve-RequiredPath `
    -Path (Join-Path $bundleRoot "system\git\bin") `
    -Description "Bundled Git bin directory" `
    -Directory
$entryPoint = Resolve-RequiredPath `
    -Path (Join-Path $serverRoot "demo_gradio_lowram.py") `
    -Description "Low-RAM FramePack entry point"

if ($ValidateOnly) {
    & $pythonExe -c "import av, gradio_client, torch; assert torch.cuda.is_available(), 'CUDA is unavailable'; print(torch.__version__); print(torch.cuda.get_device_name(0))"
    if ($LASTEXITCODE -ne 0) {
        throw "The bundled FramePack Python environment failed validation."
    }

    Write-Output "FramePack runtime validation passed."
    Write-Output "Runtime root: $resolvedRuntimeRoot"
    Write-Output "Low-RAM entry point: $entryPoint"
    exit 0
}

$listener = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue |
    Select-Object -First 1
if ($listener) {
    $ownerProcessId = [int]$listener.OwningProcess
    $owner = Get-CimInstance Win32_Process -Filter "ProcessId = $ownerProcessId" -ErrorAction SilentlyContinue
    if ($owner -and $owner.CommandLine -and $owner.CommandLine.Contains("demo_gradio_lowram.py")) {
        Write-Output "FramePack is already listening on http://127.0.0.1:$Port (PID $ownerProcessId)."
        exit 0
    }
    throw "Port $Port is already used by another process (PID $ownerProcessId)."
}

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$logDirectory = Join-Path $projectRoot "artifacts\framepack"
[System.IO.Directory]::CreateDirectory($logDirectory) | Out-Null
$stdoutLog = Join-Path $logDirectory "server-$Port.out.log"
$stderrLog = Join-Path $logDirectory "server-$Port.err.log"

$env:PATH = "$gitBin;$([System.IO.Path]::GetDirectoryName($pythonExe));$pythonScripts;$env:PATH"
$env:HF_HUB_DISABLE_XET = "1"
$entryName = [System.IO.Path]::GetFileName($entryPoint)
$process = Start-Process `
    -FilePath $pythonExe `
    -ArgumentList @($entryName, "--server", "127.0.0.1", "--port", "$Port") `
    -WorkingDirectory $serverRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput $stdoutLog `
    -RedirectStandardError $stderrLog `
    -PassThru

Write-Output "Starting low-RAM FramePack on http://127.0.0.1:$Port (PID $($process.Id))."
Write-Output "Logs: $stderrLog"

$deadline = [DateTime]::UtcNow.AddSeconds($ReadyTimeoutSeconds)
$serverUrl = "http://127.0.0.1:$Port/"
while ([DateTime]::UtcNow -lt $deadline) {
    if ($process.HasExited) {
        $tail = if (Test-Path -LiteralPath $stderrLog) {
            (Get-Content -LiteralPath $stderrLog -Tail 30) -join [Environment]::NewLine
        } else {
            "No error log was created."
        }
        throw "FramePack exited before becoming ready.`n$tail"
    }

    try {
        $response = Invoke-WebRequest -Uri $serverUrl -UseBasicParsing -TimeoutSec 2
        if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
            Write-Output "FramePack is ready at $serverUrl"
            exit 0
        }
    } catch {
        # Model loading can take several minutes; keep polling until the deadline.
    }
    Start-Sleep -Seconds 1
}

throw "FramePack did not become ready within $ReadyTimeoutSeconds seconds. See $stderrLog"
