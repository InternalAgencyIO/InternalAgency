[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$FfmpegRoot,

    [Parameter(Mandatory = $true)]
    [string]$Scene01,

    [Parameter(Mandatory = $true)]
    [string]$Scene02,

    [Parameter(Mandatory = $true)]
    [string]$Scene03,

    [Parameter(Mandatory = $true)]
    [string]$Scene04,

    [Parameter(Mandatory = $true)]
    [string]$Scene05,

    [Parameter(Mandatory = $true)]
    [string]$Scene06,

    [string]$Output = "",

    [string]$NativeOutput = "",

    [switch]$EnableGuardianOverlay,

    [string]$GuardianPng = "",

    [ValidateRange(0, 2400)]
    [int]$GuardianStartFrame = 0,

    [ValidateRange(0, 3839)]
    [int]$GuardianX = 2800,

    [ValidateRange(0, 2159)]
    [int]$GuardianY = 300,

    [ValidateRange(64, 1920)]
    [int]$GuardianWidth = 720,

    [ValidateRange(0.05, 1.0)]
    [double]$GuardianOpacity = 0.55,

    [string]$PythonExe = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ExpectedSceneFrames = 450
$ExpectedSceneSeconds = 15.0
$ExpectedMasterFrames = 2700
$ExpectedMasterSeconds = 90.0
$GuardianDurationFrames = 300

function Find-FfmpegTools {
    param([Parameter(Mandatory = $true)][string]$Root)

    $resolvedRoot = (Resolve-Path -LiteralPath $Root -ErrorAction Stop).Path
    $candidateDirectories = @($resolvedRoot, (Join-Path $resolvedRoot "bin"))
    $candidateDirectories += Get-ChildItem -LiteralPath $resolvedRoot -Directory -Force -ErrorAction SilentlyContinue |
        ForEach-Object { Join-Path $_.FullName "bin" }

    $pairs = @()
    foreach ($directory in ($candidateDirectories | Select-Object -Unique)) {
        $ffmpeg = Join-Path $directory "ffmpeg.exe"
        $ffprobe = Join-Path $directory "ffprobe.exe"
        if ((Test-Path -LiteralPath $ffmpeg -PathType Leaf) -and
            (Test-Path -LiteralPath $ffprobe -PathType Leaf)) {
            $pairs += [pscustomobject]@{
                Ffmpeg = (Resolve-Path -LiteralPath $ffmpeg).Path
                Ffprobe = (Resolve-Path -LiteralPath $ffprobe).Path
            }
        }
    }
    if ($pairs.Count -ne 1) {
        throw "Expected exactly one ffmpeg.exe/ffprobe.exe pair below $resolvedRoot; found $($pairs.Count)."
    }
    return $pairs[0]
}

function Invoke-Probe {
    param(
        [Parameter(Mandatory = $true)][string]$Ffprobe,
        [Parameter(Mandatory = $true)][string]$Path
    )

    $json = & $Ffprobe -v error -count_frames -show_streams -show_format -of json $Path
    if ($LASTEXITCODE -ne 0) {
        throw "ffprobe failed for $Path"
    }
    return (($json -join [Environment]::NewLine) | ConvertFrom-Json)
}

function Convert-Rate {
    param([Parameter(Mandatory = $true)][string]$Rate)

    $parts = $Rate.Split("/")
    if ($parts.Count -ne 2 -or [double]$parts[1] -eq 0) {
        throw "Invalid frame rate: $Rate"
    }
    return [double]$parts[0] / [double]$parts[1]
}

function Assert-VideoContract {
    param(
        [Parameter(Mandatory = $true)]$Probe,
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][int]$Width,
        [Parameter(Mandatory = $true)][int]$Height,
        [Parameter(Mandatory = $true)][int]$Frames,
        [Parameter(Mandatory = $true)][double]$Seconds
    )

    $streams = @($Probe.streams)
    if ($streams.Count -ne 1 -or $streams[0].codec_type -ne "video") {
        throw "Video must contain exactly one video-only stream: $Path"
    }
    $stream = $streams[0]
    if ($stream.codec_name -ne "h264" -or $stream.pix_fmt -ne "yuv420p") {
        throw "Expected H.264 yuv420p: $Path"
    }
    if ([int]$stream.width -ne $Width -or [int]$stream.height -ne $Height) {
        throw "Expected ${Width}x${Height}: $Path"
    }
    $fps = Convert-Rate -Rate ([string]$stream.avg_frame_rate)
    if ([math]::Abs($fps - 30.0) -gt 0.001) {
        throw "Expected 30 fps: $Path"
    }
    if ([int]$stream.nb_read_frames -ne $Frames) {
        throw "Expected $Frames decoded frames: $Path"
    }
    if ([math]::Abs(([double]$Probe.format.duration) - $Seconds) -gt 0.001) {
        throw "Expected $Seconds seconds: $Path"
    }
}

$tools = Find-FfmpegTools -Root $FfmpegRoot
$encoders = & $tools.Ffmpeg -hide_banner -encoders 2>&1
if ($LASTEXITCODE -ne 0 -or -not (($encoders -join "`n") -match "\bh264_nvenc\b")) {
    throw "This portable FFmpeg build does not expose h264_nvenc."
}

$scenes = @($Scene01, $Scene02, $Scene03, $Scene04, $Scene05, $Scene06) |
    ForEach-Object { (Resolve-Path -LiteralPath $_ -ErrorAction Stop).Path }
if (($scenes | Select-Object -Unique).Count -ne 6) {
    throw "Six distinct scene files are required."
}
foreach ($scene in $scenes) {
    $probe = Invoke-Probe -Ffprobe $tools.Ffprobe -Path $scene
    Assert-VideoContract `
        -Probe $probe `
        -Path $scene `
        -Width 832 `
        -Height 480 `
        -Frames $ExpectedSceneFrames `
        -Seconds $ExpectedSceneSeconds
}

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if (-not $Output) {
    $Output = Join-Path $projectRoot "artifacts\master\NIGHTFLIGHT-Guardian-Film-v1.0.0-2160p-H264.mp4"
}
$Output = [System.IO.Path]::GetFullPath($Output)
if (-not $NativeOutput) {
    $NativeOutput = Join-Path ([System.IO.Path]::GetDirectoryName($Output)) "nightflight-native-90s.mp4"
}
$NativeOutput = [System.IO.Path]::GetFullPath($NativeOutput)
if ($Output -eq $NativeOutput) {
    throw "-Output and -NativeOutput must be different files."
}
[System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($Output)) | Out-Null
[System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($NativeOutput)) | Out-Null

$resolvedGuardianPng = $null
if ($EnableGuardianOverlay) {
    if (-not $GuardianPng) {
        throw "-GuardianPng is required when -EnableGuardianOverlay is set."
    }
    $resolvedGuardianPng = (Resolve-Path -LiteralPath $GuardianPng -ErrorAction Stop).Path
    if ([System.IO.Path]::GetExtension($resolvedGuardianPng).ToLowerInvariant() -ne ".png") {
        throw "Guardian overlay must be a PNG."
    }
    if (($GuardianX + $GuardianWidth) -gt 3840) {
        throw "Guardian overlay width and X position exceed the 4K frame."
    }
}

$concatList = Join-Path ([System.IO.Path]::GetDirectoryName($NativeOutput)) (
    ".nightflight-concat-{0}.txt" -f [Guid]::NewGuid().ToString("N")
)
try {
    $concatLines = foreach ($scene in $scenes) {
        $escaped = $scene.Replace("\", "/").Replace("'", "'\''")
        "file '$escaped'"
    }
    [System.IO.File]::WriteAllLines($concatList, $concatLines, [System.Text.UTF8Encoding]::new($false))

    & $tools.Ffmpeg `
        -y `
        -f concat `
        -safe 0 `
        -i $concatList `
        -map 0:v:0 `
        -an `
        -sn `
        -dn `
        -c:v copy `
        -movflags +faststart `
        $NativeOutput
    if ($LASTEXITCODE -ne 0) {
        throw "Lossless native scene concatenation failed."
    }
} finally {
    if (Test-Path -LiteralPath $concatList) {
        Remove-Item -LiteralPath $concatList -Force
    }
}

$nativeProbe = Invoke-Probe -Ffprobe $tools.Ffprobe -Path $NativeOutput
Assert-VideoContract `
    -Probe $nativeProbe `
    -Path $NativeOutput `
    -Width 832 `
    -Height 480 `
    -Frames $ExpectedMasterFrames `
    -Seconds $ExpectedMasterSeconds

$baseFilter = "fps=30,scale=w=3840:h=2160:force_original_aspect_ratio=increase:flags=lanczos,crop=3840:2160,trim=end_frame=2700,setpts=N/(30*TB),format=yuv420p"
$encodeArguments = @("-y", "-i", $NativeOutput)
if ($EnableGuardianOverlay) {
    $guardianEndFrame = $GuardianStartFrame + $GuardianDurationFrames - 1
    $enableExpression = "between(n\,$GuardianStartFrame\,$guardianEndFrame)"
    $filterComplex = "[0:v]$baseFilter[base];" +
        "[1:v]scale=w=$GuardianWidth:h=-2:flags=lanczos,format=rgba,colorchannelmixer=aa=$GuardianOpacity[guardian];" +
        "[base][guardian]overlay=x=$GuardianX:y=$GuardianY:enable='$enableExpression':eof_action=pass:shortest=0,format=yuv420p[outv]"
    $encodeArguments += @(
        "-loop", "1",
        "-framerate", "30",
        "-i", $resolvedGuardianPng,
        "-filter_complex", $filterComplex,
        "-map", "[outv]"
    )
} else {
    $encodeArguments += @("-map", "0:v:0", "-vf", $baseFilter)
}

$encodeArguments += @(
    "-an", "-sn", "-dn",
    "-frames:v", "$ExpectedMasterFrames",
    "-fps_mode", "cfr",
    "-c:v", "h264_nvenc",
    "-preset", "p7",
    "-tune", "hq",
    "-rc", "vbr",
    "-cq", "18",
    "-b:v", "0",
    "-maxrate", "80M",
    "-bufsize", "160M",
    "-profile:v", "high",
    "-level:v", "5.2",
    "-pix_fmt", "yuv420p",
    "-color_primaries", "bt709",
    "-color_trc", "bt709",
    "-colorspace", "bt709",
    "-movflags", "+faststart",
    $Output
)
& $tools.Ffmpeg @encodeArguments
if ($LASTEXITCODE -ne 0) {
    throw "4K H.264 NVENC master encode failed."
}

$verificationMetadata = "$Output.ffprobe.json"
$verifyScript = Join-Path $PSScriptRoot "verify-master.ps1"
$verifyArguments = @(
    "-ExecutionPolicy", "Bypass",
    "-File", $verifyScript,
    "-FfmpegRoot", $FfmpegRoot,
    "-Master", $Output,
    "-MetadataOutput", $verificationMetadata
)
if ($PythonExe) {
    $verifyArguments += @("-PythonExe", $PythonExe)
}
& powershell @verifyArguments
if ($LASTEXITCODE -ne 0) {
    throw "Final master verification failed."
}

Write-Output "Native concat: $NativeOutput"
Write-Output "Verified 4K master: $Output"
if ($EnableGuardianOverlay) {
    Write-Output "Guardian overlay: frames $GuardianStartFrame-$($GuardianStartFrame + 299) (exactly 300 frames / 10.000 seconds)."
} else {
    Write-Output "Guardian overlay: disabled."
}
