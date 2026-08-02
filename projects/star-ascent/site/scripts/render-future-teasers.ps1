param(
  [string]$FfmpegPath = "C:\Users\A\AppData\Local\Programs\cosmo-downloader\resources\bin\win32-x64\ffmpeg.exe",
  [ValidateSet("all", "predictive", "casino", "predictive-carrier", "casino-everest")]
  [string]$Only = "all"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if (-not (Test-Path -LiteralPath $FfmpegPath)) {
  throw "ffmpeg was not found at the supplied path."
}

$siteRoot = Split-Path -Parent $PSScriptRoot
$outputRoot = Join-Path $siteRoot "public\media\future"
$tempRoot = Join-Path $siteRoot "outputs\future-teaser-render"
New-Item -ItemType Directory -Force -Path $outputRoot, $tempRoot | Out-Null

Add-Type -AssemblyName System.Speech

function Write-VoiceTrack {
  param(
    [string]$Path,
    [string[]]$Lines
  )

  $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
  try {
    $synth.SelectVoice("Microsoft Zira Desktop")
    $synth.Rate = 1
    $synth.Volume = 92
    $builder = New-Object System.Speech.Synthesis.PromptBuilder
    foreach ($line in $Lines) {
      $builder.AppendText($line)
      $builder.AppendBreak([TimeSpan]::FromMilliseconds(320))
    }
    $synth.SetOutputToWaveFile($Path)
    $synth.Speak($builder)
    $synth.SetOutputToNull()
  } finally {
    $synth.Dispose()
  }
}

function Convert-ToAssFilterPath {
  param([string]$Path)
  return $Path.Replace("\", "/").Replace(":", "\:")
}

function Render-Teaser {
  param(
    [string]$Image,
    [string]$Subtitle,
    [string]$Voice,
    [string]$Output,
    [int]$Tone
  )

  $assPath = Convert-ToAssFilterPath -Path $Subtitle
  $videoFilter = "zoompan=z='min(zoom+0.00014,1.065)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=450:s=3840x2160:fps=30,eq=saturation=1.08:contrast=1.045,ass='$assPath'"
  $audioFilter = "[1:a]volume=0.025,afade=t=in:st=0:d=1,afade=t=out:st=14:d=1[bed];[2:a]volume=1.0,apad=pad_dur=15[voice];[bed][voice]amix=inputs=2:duration=first:dropout_transition=1[a]"

  & $FfmpegPath -hide_banner -loglevel warning -y `
    -loop 1 -framerate 30 -t 15 -i $Image `
    -f lavfi -t 15 -i "sine=frequency=$Tone`:sample_rate=48000" `
    -i $Voice `
    -vf $videoFilter `
    -filter_complex $audioFilter `
    -map 0:v -map "[a]" `
    -t 15 -c:v libx264 -preset medium -crf 21 -profile:v high -level 5.2 `
    -pix_fmt yuv420p -r 30 -c:a aac -b:a 192k -movflags +faststart $Output

  if ($LASTEXITCODE -ne 0) { throw "ffmpeg failed while rendering $Output" }
}

$predictiveVoice = Join-Path $tempRoot "predictive-engine-voice.wav"
$casinoVoice = Join-Path $tempRoot "casino-voice.wav"
Write-VoiceTrack -Path $predictiveVoice -Lines @(
  "Thirty days after I A T Genesis, the Predictive Engine enters its review window.",
  "Create a market. No matched volume? Cancel with no penalty.",
  "I A T or Sol. One percent returns to liquidity. Every result stays verifiable."
)
Write-VoiceTrack -Path $casinoVoice -Lines @(
  "Fifteen days after I A T Genesis, the Casino D L C enters its review window.",
  "Every game is designed for independent replay.",
  "I A T or Sol. One percent returns to liquidity and extends the runway."
)

$carrierVoice = Join-Path $tempRoot "predictive-engine-carrier-voice.wav"
$everestVoice = Join-Path $tempRoot "casino-everest-voice.wav"
Write-VoiceTrack -Path $carrierVoice -Lines @(
  "Thirty days after I A T Genesis, the Predictive Engine enters review.",
  "Markets need named sources, replayable receipts, and public resolution.",
  "The runway is only a preview. There is no wager route."
)
Write-VoiceTrack -Path $everestVoice -Lines @(
  "Fifteen days after I A T Genesis, the Casino D L C enters review.",
  "Deal, reveal, and verify. Every result must be replayable.",
  "One percent returns to liquidity. This remains a concept."
)

if ($Only -in @("all", "predictive")) {
  Render-Teaser `
    -Image (Join-Path $siteRoot "public\images\future\predictive-engine-hero-v1.png") `
    -Subtitle (Join-Path $siteRoot "scripts\video\future\predictive-engine-teaser.ass") `
    -Voice $predictiveVoice `
    -Output (Join-Path $outputRoot "predictive-engine-teaser-15s-4k-v1.mp4") `
    -Tone 82
}

if ($Only -in @("all", "casino")) {
  Render-Teaser `
    -Image (Join-Path $siteRoot "public\images\future\casino-hero-v1.png") `
    -Subtitle (Join-Path $siteRoot "scripts\video\future\casino-teaser.ass") `
    -Voice $casinoVoice `
    -Output (Join-Path $outputRoot "casino-dlc-teaser-15s-4k-v1.mp4") `
    -Tone 68
}

if ($Only -in @("all", "predictive-carrier")) {
  Render-Teaser `
    -Image (Join-Path $siteRoot "public\images\future\predictive-engine-carrier-runway-v2.png") `
    -Subtitle (Join-Path $siteRoot "scripts\video\future\predictive-engine-carrier-teaser.ass") `
    -Voice $carrierVoice `
    -Output (Join-Path $outputRoot "predictive-engine-carrier-teaser-15s-4k-v2.mp4") `
    -Tone 92
}

if ($Only -in @("all", "casino-everest")) {
  Render-Teaser `
    -Image (Join-Path $siteRoot "public\images\future\casino-everest-poker-v2.png") `
    -Subtitle (Join-Path $siteRoot "scripts\video\future\casino-everest-teaser.ass") `
    -Voice $everestVoice `
    -Output (Join-Path $outputRoot "casino-everest-teaser-15s-4k-v2.mp4") `
    -Tone 74
}

Get-Item (Join-Path $outputRoot "*.mp4") | Select-Object Name, Length, LastWriteTime
