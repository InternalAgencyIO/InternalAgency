param(
  [int]$Port = 7861
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$runtimeRoot = Join-Path $repoRoot "tools\framepack-runtime"
$bundle = Join-Path $runtimeRoot "framepack_cu126_torch26"
$server = Join-Path $runtimeRoot "FramePack-current"
$python = Join-Path $bundle "system\python\python.exe"

if (-not (Test-Path -LiteralPath $python) -or -not (Test-Path -LiteralPath $server)) {
  throw "FramePack is not installed under $runtimeRoot. Follow scripts/video/README.md."
}

$existing = Get-CimInstance Win32_Process |
  Where-Object { $_.CommandLine -like "*demo_gradio.py*--port*$Port*" } |
  Select-Object -First 1
if ($existing) {
  Write-Output "FramePack is already running on port $Port (PID $($existing.ProcessId))."
  exit 0
}

$env:PATH = (Join-Path $bundle "system\git\bin") + ";" +
  (Join-Path $bundle "system\python") + ";" +
  (Join-Path $bundle "system\python\Scripts") + ";" + $env:PATH
# Hugging Face Xet can stall behind some Windows proxies. The ordinary HTTP
# downloader is slower but provides resumable on-disk progress reliably.
$env:HF_HUB_DISABLE_XET = "1"

$outLog = Join-Path $runtimeRoot "framepack-server.out.log"
$errLog = Join-Path $runtimeRoot "framepack-server.err.log"
$process = Start-Process -FilePath $python `
  -ArgumentList @("demo_gradio.py", "--server", "127.0.0.1", "--port", "$Port") `
  -WorkingDirectory $server `
  -WindowStyle Hidden `
  -RedirectStandardOutput $outLog `
  -RedirectStandardError $errLog `
  -PassThru

Write-Output "FramePack starting on http://127.0.0.1:$Port (PID $($process.Id))."
Write-Output "First start downloads the official models. Logs: $errLog"
