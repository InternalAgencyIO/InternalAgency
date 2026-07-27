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

## Generate

Start the local model server:

```powershell
npm run video:server
```

The first start downloads more than 30 GB of official model weights. Once the
server reaches `http://127.0.0.1:7861`, render a short proof:

```powershell
npm run video:scene -- -Scene neon-listening-lounge -Duration 5
```

Render the full configured scene:

```powershell
npm run video:scene -- -Scene neon-listening-lounge
```

Scene prompts, deterministic seeds, source frames, and target durations are in
`scenes.json`. Final clips are written to `assets/videos/*-full-30fps.mp4`.
