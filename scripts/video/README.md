# Radiance video pipeline

This pipeline turns the ten original Radiance scene frames into genuine
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

Scene prompts, deterministic seeds, source frames, and target durations are in
`scenes.json`. Final clips are written to `assets/videos/*-full-30fps.mp4`.
Each output is decoded and verified at 30 fps, then recorded with its frame
count, duration, byte size, and SHA-256 digest in `assets/videos/manifest.json`.
