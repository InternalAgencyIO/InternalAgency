# Radiance video pipeline

This pipeline turns the Radiance scene anchors into genuine
image-to-video diffusion clips at 30 fps. It uses the official open-source
FramePack runtime locally; the camera is explicitly locked and prompts require
physical character, hair, garment, and environment motion.

## Runtime

FramePack's official Windows package belongs under:

```text
tools/framepack-runtime/framepack_cu126_torch26/
```

Keep a current official checkout under:

```text
tools/framepack-runtime/FramePack-current/
```

The runtime and downloaded model cache are intentionally gitignored. The final
MP4 files under `assets/videos/` are project assets and may be committed.
The generated masters are tracked with Git LFS; end users never need this
runtime or its model weights.

## Generate

Start the local model server:

```powershell
npm run video:server
```

The first start downloads more than 30 GB of official model weights. Once the
server reaches `http://127.0.0.1:7861`, render a short proof:

The launcher defaults to low-RAM model storage: the two large models remain FP8
on CPU and each active layer is cast to bf16/fp16 on the GPU. This is useful on
authoring machines that also run VMs. To use the official full-precision
in-memory path instead:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/video/start-framepack.ps1 -FullPrecision
```

```powershell
npm run video:scene -- -Scene neon-listening-lounge -Duration 5
```

Render the full configured scene:

```powershell
npm run video:scene -- -Scene neon-listening-lounge
```

Render every full scene in sequence:

```powershell
npm run video:all
```

Render only the six 20-second HQ enrichment scenes:

```powershell
npm run video:enrich
```

Scene prompts, deterministic seeds, source frames, and target durations are in
`scenes.json`. Final clips are written to `assets/videos/*-full-30fps.mp4`.
Each output is decoded and verified at 30 fps, then recorded with its frame
count, duration, byte size, and SHA-256 digest in `assets/videos/manifest.json`.

## World Series country animations

Beginning with World Series Batch 199, each country batch produces four archive
PNGs plus one 15-second MP4 derived from the fourth, finale still. The country
renderer trims the FramePack result to exactly 450 frames at 30 fps, writes an
H.264/yuv420p silent MP4 beside its source still, and records both source and
video hashes in `assets/lore/starlight-era/world-15s-video-manifest.json`.

Start the same local FramePack server, prepare a UTF-8 motion prompt file, then
run:

```powershell
npm run video:world-country -- `
  -Source assets/lore/starlight-era/819-india-example-finale.png `
  -Country India `
  -Batch 199 `
  -SourceImageNumber 819 `
  -PromptFile tmp/india-819-video-prompt.txt
```

The motion prompt must preserve all three canonical faces, the assigned
captain/first-officer/cabin-host roles, country design, real location, wardrobe,
footwear, relationship geometry, and the completed aviation objective. Prefer
one continuous restrained camera move with natural breathing, eye contact,
hair/fabric response, a readable mission-light change, and one affectionate
beat. Do not introduce cuts, costume changes, new people, a new location, or a
second action sequence.
