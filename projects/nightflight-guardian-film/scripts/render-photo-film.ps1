[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$FfmpegRoot,

    [string]$RepoRoot = "",

    [string]$Output = "",

    [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Fps = 30
$SceneFrames = 450
$SceneSeconds = 15.0
$MasterFrames = 2700
$MasterSeconds = 90.0

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

function Get-Probe {
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

function Assert-Contract {
    param(
        [Parameter(Mandatory = $true)]$Probe,
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][int]$Frames,
        [Parameter(Mandatory = $true)][double]$Seconds
    )

    $streams = @($Probe.streams)
    if ($streams.Count -ne 1 -or $streams[0].codec_type -ne "video") {
        throw "Expected one video-only stream: $Path"
    }
    $stream = $streams[0]
    if ($stream.codec_name -ne "h264" -or $stream.pix_fmt -ne "yuv420p") {
        throw "Expected H.264 yuv420p: $Path"
    }
    if ([int]$stream.width -ne 3840 -or [int]$stream.height -ne 2160) {
        throw "Expected 3840x2160: $Path"
    }
    if ([string]$stream.avg_frame_rate -ne "30/1" -or [string]$stream.r_frame_rate -ne "30/1") {
        throw "Expected exact 30/1 fps: $Path"
    }
    if ([int]$stream.nb_read_frames -ne $Frames) {
        throw "Expected $Frames decoded frames: $Path"
    }
    if ([math]::Abs(([double]$Probe.format.duration) - $Seconds) -gt 0.001) {
        throw "Expected $Seconds seconds: $Path"
    }
}

if (-not $RepoRoot) {
    $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
} else {
    $RepoRoot = (Resolve-Path -LiteralPath $RepoRoot -ErrorAction Stop).Path
}

$tools = Find-FfmpegTools -Root $FfmpegRoot
$encoders = & $tools.Ffmpeg -hide_banner -encoders 2>&1
if ($LASTEXITCODE -ne 0 -or -not (($encoders -join "`n") -match "\blibx264\b")) {
    throw "This portable FFmpeg build does not expose libx264."
}

$projectRoot = Join-Path $RepoRoot "projects\nightflight-guardian-film"
$keyframeRoot = Join-Path $projectRoot "source\keyframes"
$guardian = Join-Path $projectRoot "source\references\codex-guardian-ui.png"
$sceneOutputRoot = Join-Path $projectRoot "artifacts\photo-scenes"
$masterOutputRoot = Join-Path $projectRoot "artifacts\master"
[System.IO.Directory]::CreateDirectory($sceneOutputRoot) | Out-Null
[System.IO.Directory]::CreateDirectory($masterOutputRoot) | Out-Null

if (-not (Test-Path -LiteralPath $guardian -PathType Leaf)) {
    throw "Guardian UI reference is missing: $guardian"
}

if (-not $Output) {
    $Output = Join-Path $masterOutputRoot "NIGHTFLIGHT-Guardian-Film-v1.0.0-2160p-H264.mp4"
}
$Output = [System.IO.Path]::GetFullPath($Output)
if ((Test-Path -LiteralPath $Output) -and -not $Force) {
    throw "Master already exists; use -Force to replace it: $Output"
}

$motions = @(
    # Slow push right toward roulette.
    "z='1.000+0.00013*on':x='iw/2-(iw/zoom/2)+0.14*on':y='ih/2-(ih/zoom/2)'",
    # Reverse arc across the four reactions.
    "z='1.035+0.00010*on':x='(iw-iw/zoom)*(1-on/449)':y='ih/2-(ih/zoom/2)'",
    # Ascending diagonal across the staircase.
    "z='1.025+0.00010*on':x='(iw-iw/zoom)*(on/449)':y='(ih-ih/zoom)*(1-on/449)'",
    # Restrained intimate push-in.
    "z='1.015+0.00014*on':x='iw/2-(iw/zoom/2)+0.08*on':y='ih/2-(ih/zoom/2)'",
    # Left-to-right face sweep.
    "z='1.045+0.00007*on':x='(iw-iw/zoom)*(on/449)':y='ih/2-(ih/zoom/2)'",
    # Calm pull-back for the final group tableau.
    "z='1.080-0.00015*on':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
)

$sceneFiles = @()
for ($index = 1; $index -le 6; $index++) {
    $sceneName = "scene-{0:D2}" -f $index
    $source = Join-Path $keyframeRoot "$sceneName.png"
    $target = Join-Path $sceneOutputRoot "$sceneName-15s-2160p.mp4"
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
        throw "Keyframe is missing: $source"
    }
    if ((Test-Path -LiteralPath $target) -and -not $Force) {
        try {
            $existingProbe = Get-Probe -Ffprobe $tools.Ffprobe -Path $target
            Assert-Contract -Probe $existingProbe -Path $target -Frames $SceneFrames -Seconds $SceneSeconds
            Write-Output "Reusing verified $sceneName."
            $sceneFiles += $target
            continue
        } catch {
            Write-Output "Replacing incomplete or invalid $sceneName output."
        }
    }

    $motion = $motions[$index - 1]
    $camera = "scale=7680:-2:flags=lanczos," +
        "zoompan=${motion}:d=1:s=3840x2160:fps=30," +
        "eq=contrast=1.025:saturation=1.035:brightness=-0.003," +
        "unsharp=5:5:0.35:5:5:0.0," +
        "noise=alls=1.2:allf=t+u," +
        "format=yuv420p,setsar=1,setpts=N/(30*TB)"

    $arguments = @("-y", "-loop", "1", "-framerate", "30", "-i", $source)
    if ($index -eq 1) {
        $arguments += @("-loop", "1", "-framerate", "30", "-i", $guardian)
        $filter = "[1:v]scale=82:-2:flags=lanczos[guardian];" +
            "[0:v][guardian]overlay=x=1488:y=205:enable='between(n\,0\,299)':eof_action=pass[plate];" +
            "[plate]$camera[outv]"
        $arguments += @("-filter_complex", $filter, "-map", "[outv]")
    } else {
        $arguments += @("-vf", $camera, "-map", "0:v:0")
    }

    $arguments += @(
        "-an", "-sn", "-dn",
        "-frames:v", "$SceneFrames",
        "-fps_mode", "cfr",
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "18",
        "-g", "60",
        "-profile:v", "high",
        "-level:v", "5.2",
        "-x264-params", "colorprim=bt709:transfer=bt709:colormatrix=bt709",
        "-pix_fmt", "yuv420p",
        "-color_primaries", "bt709",
        "-color_trc", "bt709",
        "-colorspace", "bt709",
        "-movflags", "+faststart",
        $target
    )

    Write-Output "Rendering $sceneName..."
    & $tools.Ffmpeg @arguments
    if ($LASTEXITCODE -ne 0) {
        throw "FFmpeg render failed for $sceneName."
    }
    $probe = Get-Probe -Ffprobe $tools.Ffprobe -Path $target
    Assert-Contract -Probe $probe -Path $target -Frames $SceneFrames -Seconds $SceneSeconds
    $sceneFiles += $target
}

$concatList = Join-Path $masterOutputRoot (".photo-concat-{0}.txt" -f [Guid]::NewGuid().ToString("N"))
try {
    $lines = foreach ($scene in $sceneFiles) {
        $escaped = $scene.Replace("\", "/").Replace("'", "'\''")
        "file '$escaped'"
    }
    [System.IO.File]::WriteAllLines($concatList, $lines, [System.Text.UTF8Encoding]::new($false))
    & $tools.Ffmpeg -y -f concat -safe 0 -i $concatList -map 0:v:0 -an -sn -dn -c:v copy -movflags +faststart $Output
    if ($LASTEXITCODE -ne 0) {
        throw "Lossless six-scene concatenation failed."
    }
} finally {
    if (Test-Path -LiteralPath $concatList) {
        Remove-Item -LiteralPath $concatList -Force
    }
}

$masterProbe = Get-Probe -Ffprobe $tools.Ffprobe -Path $Output
Assert-Contract -Probe $masterProbe -Path $Output -Frames $MasterFrames -Seconds $MasterSeconds

Write-Output "Verified photo-film master: $Output"
Write-Output "Guardian background practical: frames 0-299 (exactly 10.000 seconds)."
