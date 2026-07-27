# InternalAgency

Internal Agency Dev Network Main.

## Radiance Reactive Overlay

Radiance now has a cinematic desktop runtime in addition to her standard Codex
pet. It plays ten high-fashion scenes (five minutes back-to-back), animates them
with continuous GPU-friendly motion, and can react to system audio or explicit
activity signals.

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
