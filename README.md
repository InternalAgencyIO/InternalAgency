# InternalAgency

Internal Agency Dev Network Main.

## Radiance Reactive Overlay

Radiance now has a cinematic desktop runtime in addition to her standard Codex
pet. It plays ten high-fashion scenes (five minutes back-to-back), animates them
as generated 30 fps image-to-video clips, and can react to system audio or
explicit activity signals. While a clip is still being generated, the overlay
uses its original scene frame as a temporary fallback.

### Run it

```powershell
npm install
npm start
```

The overlay is frameless, draggable, resizable, and always on top. Hover it to
reveal controls. Choose a scene manually, run the full five-minute sequence, or
enable **Listen** so music energy and estimated BPM influence scene selection.

On Electron-supported systems, Listen requests loopback system audio. If that
is unavailable, it falls back to the default audio input.

### Press-and-play standalone app

Release builds include the finished 30 fps MP4 scene masters. Playback does not
run FramePack, download model weights, or regenerate frames:

```powershell
npm install
npm run dist
```

The portable Windows executable is written to `release/`. The build refuses to
run unless all ten full videos are present and verified. Videos are stored
outside the Electron ASAR inside the package so Chromium can stream them
directly.

### Development proof

Radiance is archived as a sequence of reproducible, reviewable milestones. See
[`docs/iterations/README.md`](docs/iterations/README.md) for the commit ledger
and [`docs/PRODUCTION.md`](docs/PRODUCTION.md) for the production gate. GitHub
Actions runs the source checks on every push and builds the portable executable
as soon as the verified video manifest is present.

### Install the matching Codex pet

```powershell
npm run install:pet
```

This copies the validated v2 `Radiance Butterfly` package to
`~/.codex/pets/radiance-butterfly`. Restart Codex if its pet picker is already
open.

### Verify

```powershell
npm test
npm run smoke
```

`npm run smoke` saves `artifacts/radiance-overlay.png` without leaving the
overlay open.

### Generate true-motion videos

The project includes a local FramePack image-to-video pipeline for NVIDIA RTX
GPUs. It starts with each original Radiance scene frame and generates physical
character, hair, fabric, and environment motion with a locked camera:

```powershell
npm run video:server
npm run video:scene -- -Scene neon-listening-lounge -Duration 5
```

See [`scripts/video/README.md`](scripts/video/README.md) for installation,
full-scene rendering, and output details.

## Runtime signals

The renderer exposes `window.radianceSignal(detail)` for local integrations:

```js
window.radianceSignal({
  task: { state: "running", kind: "analysis" },
  urgency: "high"
});
```

Supported cues include music BPM/energy, task state/kind, urgency, bold-plan
mode, away state, successful review, and session milestones. Signals are merged
into the current state; integrations do not need to send the whole object.

## Content contract

Scene definitions live in [`assets/scene-manifest.json`](assets/scene-manifest.json).
The first pilot contains ten scenes totaling exactly 300 seconds. Action scenes
are fictional and cinematic; the runtime contains no procedural weapons or
explosives instructions.
