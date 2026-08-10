# NIGHTFLIGHT: Signal Four Reunion

A reproducible six-scene, 90-second cinematic photo-film made from the
established NIGHTFLIGHT Signal Four cast. Six approved 1672 x 941 photoreal
keyframes are animated with deterministic camera moves and restrained temporal
film texture, encoded as six exact 15-second chapters, and losslessly joined
into a 3840 x 2160 H.264 master at 30 fps.

The four women are project-generated fictional adults aged 25 or older. The
film is fully clothed, consensual, romantic, and non-explicit. It contains no
dialogue, audio, captions, subtitles, or promotional typography.

This is an animated photo-film, not generative character-motion footage. The
4K delivery is derived from the approved 1672 x 941 stills using Lanczos
resampling and animated crops; it is not represented as native 4K photography
or native 4K diffusion output.

## Structure

1. Arrival at the NIGHTFLIGHT orbital casino.
2. A roulette round ends in a playful loss.
3. The quartet crosses the glass stairway to the upstairs suite.
4. Ece and Radiance greet the boss in sequence.
5. Alia and Ellie greet him; a playful jealous beat resolves warmly.
6. The group closes together in a shared smiling tableau.

Codex Guardian appears only as a small background practical on a physical
monitor in Scene 1. It is composited for output frames 0 through 299 inclusive:
exactly 300 frames, or 10.000 seconds at 30 fps. It is absent from every later
frame and is not the film's primary subject.

## Approved keyframes

| 01 - Arrival | 02 - Roulette | 03 - Upper level |
| --- | --- | --- |
| ![The four women enter NIGHTFLIGHT](source/keyframes/scene-01.png) | ![The quartet reacts to the roulette result](source/keyframes/scene-02.png) | ![The quartet crosses the glass stair](source/keyframes/scene-03.png) |

| 04 - Ece and Radiance | 05 - Alia and Ellie | 06 - Shared close |
| --- | --- | --- |
| ![Ece and Radiance greet the boss](source/keyframes/scene-04.png) | ![Alia and Ellie complete the reunion sequence](source/keyframes/scene-05.png) | ![The group closes together smiling](source/keyframes/scene-06.png) |

## Rebuild

The supported Windows release path needs only portable FFmpeg with `libx264`:

```powershell
powershell -ExecutionPolicy Bypass -File projects\nightflight-guardian-film\scripts\render-photo-film.ps1 `
  -FfmpegRoot C:\Tools\ffmpeg-9.0
```

See `production/BUILDING.md` for the exact output contract, prerequisites,
rendering details, and verification commands.

## Contents

- `production/visual-bible.md` - identity, wardrobe, continuity, and safety lock.
- `production/KEYFRAMES.md` - anchor order, accepted generation briefs, and
  rejection/selection record.
- `production/manifest.json` - machine-readable timing, inputs, provenance,
  render method, and Guardian placement.
- `production/FRAMEPACK_ATTEMPT.md` - transparent record of the unsuccessful
  full-motion experiment and why it is not a release dependency.
- `source/keyframes/` - six approved 1672 x 941 photo-film source plates.
- `scripts/render-photo-film.ps1` - supported deterministic release renderer.
- `scripts/` - additional verification tools and optional experimental
  FramePack reference scripts.
- `deliverables/` - checksums and release metadata; large masters are published
  as GitHub Release assets rather than regular Git blobs.

## License and provenance

Code and production scripts follow the repository MIT license. Generated
artwork and film assets are released as CC0 to the extent the project owns the
rights. Every identity and environment reference is listed by path and SHA-256
in the manifest; no real-person photography is used as a face reference.
