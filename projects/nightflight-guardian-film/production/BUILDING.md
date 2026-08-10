# Building the 90-second master

The supported release path is Windows-only, GUI-independent, and uses portable
FFmpeg without an installer. It turns six approved still keyframes into six
deterministic cinematic photo-film scenes, validates each scene, joins them
without re-encoding, and validates the final 4K master.

FramePack is not required. Its scripts remain in the repository only as an
optional experimental reference; see `FRAMEPACK_ATTEMPT.md` for the measured
unsuccessful run and its limits.

## Release output contract

- Six scene files: H.264, yuv420p, 3840 x 2160, exact 30/1 fps, exactly 450
  decoded frames and 15.000 seconds each.
- One master: H.264, yuv420p, 3840 x 2160, exact 30/1 fps, exactly 2,700
  decoded frames and 90.000 seconds.
- One video stream only: no audio, subtitle, attachment, or data streams.
- CPU encoding with FFmpeg `libx264` at CRF 18 and the fast preset.
- Guardian visible only in Scene 1 output frames 0-299 inclusive, exactly
  10.000 seconds; absent from frames 300-2,699.

The 4K frame is delivery resolution. Source plates are 1672 x 941 and are
resampled with Lanczos before the animated crop. The release is therefore not
described as native 4K photography, native 4K diffusion video, or character
animation.

## Prerequisites

1. Windows 10 or Windows 11.
2. Enough CPU time and free disk space for six 4K H.264 encodes.
3. Portable FFmpeg 9.0 with `ffmpeg.exe`, `ffprobe.exe`, and the `libx264`
   encoder. No NVIDIA GPU or NVENC-compatible driver is required.

The pinned Windows ZIP is:

```text
https://www.gyan.dev/ffmpeg/builds/packages/ffmpeg-9.0-essentials_build.zip
SHA-256: e6b54767a6065919048f1a098eb27211ca4e12b4348a05d88777a5855d0b6e71
Size: 111167378 bytes
```

FFmpeg's official download page links the Gyan Windows builds. Gyan's static
Windows builds are GPLv3. The archive is downloaded separately, kept out of
this repository, and is not redistributed as part of the film source. FFmpeg
and its build retain their own licenses; the repository MIT license does not
replace them.

Verify and extract the ZIP with ordinary Windows tools:

```powershell
$zip = "C:\Downloads\ffmpeg-9.0-essentials_build.zip"
(Get-FileHash -Algorithm SHA256 -LiteralPath $zip).Hash
Expand-Archive -LiteralPath $zip -DestinationPath "C:\Tools\ffmpeg-9.0"
```

The hash must equal the value above. `-FfmpegRoot` may point either to the
extraction directory or directly to its versioned child; the renderer locates
one matching `bin\ffmpeg.exe` and `bin\ffprobe.exe` pair and rejects ambiguity.

You can confirm CPU encoder availability before rendering:

```powershell
C:\Tools\ffmpeg-9.0\ffmpeg-9.0-essentials_build\bin\ffmpeg.exe -hide_banner -encoders | Select-String libx264
```

## Production inputs

The renderer expects these six opaque RGB PNGs:

```text
projects/nightflight-guardian-film/source/keyframes/scene-01.png
projects/nightflight-guardian-film/source/keyframes/scene-02.png
projects/nightflight-guardian-film/source/keyframes/scene-03.png
projects/nightflight-guardian-film/source/keyframes/scene-04.png
projects/nightflight-guardian-film/source/keyframes/scene-05.png
projects/nightflight-guardian-film/source/keyframes/scene-06.png
```

Each approved keyframe is 1672 x 941 and contains the complete cast,
environment, wardrobe, and story beat for its scene. Identity anchors and
environment references are provenance inputs for keyframe creation; they are
not separately injected during the photo-film render.

Scene 1 also requires the sanitized Guardian practical:

```text
projects/nightflight-guardian-film/source/references/codex-guardian-ui.png
```

Its SHA-256 and the keyframe SHA-256 values are pinned in `manifest.json`.

## Render the release master

From the InternalAgency repository root:

```powershell
$ffmpeg = "C:\Tools\ffmpeg-9.0"

powershell -ExecutionPolicy Bypass -File projects\nightflight-guardian-film\scripts\render-photo-film.ps1 `
  -FfmpegRoot $ffmpeg
```

Use `-Force` only when intentionally replacing existing scene and master
outputs:

```powershell
powershell -ExecutionPolicy Bypass -File projects\nightflight-guardian-film\scripts\render-photo-film.ps1 `
  -FfmpegRoot $ffmpeg `
  -Force
```

By default, the scene files are written below `artifacts/photo-scenes/` and the
master is written to:

```text
artifacts/master/NIGHTFLIGHT-Guardian-Film-v1.0.0-2160p-H264.mp4
```

The renderer uses a distinct deterministic push, sweep, diagonal move, or
pull-back for each plate. It first creates a high-resolution Lanczos working
image, applies the animated 3840 x 2160 crop at 30 fps, and adds restrained
contrast, saturation, sharpening, and temporal film noise. Every scene is
limited to 450 frames and normalized to H.264 yuv420p with BT.709 color tags.

For Scene 1, the Guardian UI is composited into the designated physical monitor
on the 1672 x 941 source plate before the camera transform. The source-space
placement is x=1488, y=205, width=82 pixels. The FFmpeg expression enables it
only while the Scene 1 frame index is between 0 and 299 inclusive. Because it
is attached before the crop, it follows the monitor through the camera move
instead of floating over the final frame.

After all six per-scene contracts pass, the renderer uses the concat demuxer
and stream copy to join them without another generation or encoding pass.

## Independent verification

Run the repository verifier against the finished master:

```powershell
powershell -ExecutionPolicy Bypass -File projects\nightflight-guardian-film\scripts\verify-master.ps1 `
  -FfmpegRoot $ffmpeg `
  -Master projects\nightflight-guardian-film\artifacts\master\NIGHTFLIGHT-Guardian-Film-v1.0.0-2160p-H264.mp4 `
  -MetadataOutput projects\nightflight-guardian-film\artifacts\master\master.ffprobe.json
```

Verification fails unless the master is H.264, yuv420p, 3840 x 2160, exact
30/1 fps, exactly 2,700 decoded frames, 90.000 seconds within one millisecond,
and contains one video stream only. The JSON record includes the master SHA-256
and exact `ffprobe` version.

Guardian timing also needs visual boundary QA: inspect Scene 1 frame 299 and
frame 300 to confirm the monitor practical is present in the former and absent
in the latter. Review representative frames from every scene for crop safety,
identity continuity, and unintended text.

## Optional FramePack experimental reference

The following scripts preserve the earlier full-motion approach for research
and are not part of the supported release build:

- `scripts/start-framepack.ps1`
- `scripts/render-scene.py`
- `scripts/render-all.ps1`
- `scripts/merge-master.ps1`
- `scripts/test-pipeline.ps1`

That path requires an external FramePack runtime, model weights, a suitable
CUDA environment, and substantially more compute time. The measured production
attempt generated no usable output and is documented in
`production/FRAMEPACK_ATTEMPT.md`. Its presence must not be read as a claim that
the released master contains FramePack character motion.

## Publication

Large masters belong in the tagged GitHub Release, not regular Git history.
Commit the scripts, prompts, approved keyframes, provenance, final verification
record, and SHA-256 checksum. Publish the master under tag
`nightflight-guardian-film-v1.0.0`.
