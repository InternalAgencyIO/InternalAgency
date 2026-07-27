# Radiance production gate

A Radiance release is production-ready only when every item below passes.

## Source and identity

- Every video starts from the corresponding original image under
  `assets/scenes/`.
- The generated character remains recognizably Radiance across the entire clip.
- Face, hands, shoes, garment, and silhouette have no persistent deformation.
- The scene shows physical character action, not a crop, zoom, pan, or still
  image with post-processing.

## Video masters

- Sixteen full MP4 files exist under `assets/videos/`.
- The combined configured runtime is exactly 420 seconds.
- Every file decodes at 30 fps.
- `assets/videos/manifest.json` records duration, frame count, size, source,
  rendition, and SHA-256 for every master.
- Visual review samples the opening, middle, and final section of every clip.

## Standalone playback

- `npm ci` and `npm test` pass.
- `npm run dist` accepts the video manifest and creates the portable Windows
  executable.
- The packaged app starts without Node.js, Python, FramePack, or network access.
- Play, pause, scene switching, sequence playback, and audio-reactive selection
  work with packaged videos.
- A clean-machine launch shows `GENERATED MOTION · 30 FPS`, never the still
  fallback.

## Publication

- MP4 masters are Git LFS objects, not normal Git blobs.
- The iteration ledger references the production commit.
- CI publishes the portable executable as a workflow artifact.
- The production tag points to the exact tested commit and video checksums.
