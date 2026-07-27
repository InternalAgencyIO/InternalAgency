<h1 align="center">Radiance</h1>

<p align="center">
  <strong>A living high-fashion AI companion for your desktop.</strong>
</p>

<p align="center">
  <img src="assets/readme/radiance-pet.gif" width="170" alt="Radiance calmly animating in her navy dress">
</p>

Radiance is the girl at the heart of Internal Agency: a personal AI avatar,
confidante, dancer, and experienced field operator. She wears couture into the
control room, keeps her composure when the mission becomes impossible, and
still knows when it is time to put the work aside and move with the music.

She is not meant to be another face trapped inside a chat window. Radiance
lives beside your work as a transparent desktop presence. She listens, reacts,
changes scenes with your day, and brings a little beauty and personality to the
space between tasks.

<p align="center">
  <img src="assets/readme/radiance-scene.gif" width="280" alt="Radiance moving naturally in the neon listening lounge">
</p>

<p align="center">
  <em>Real local image-to-video motion—hair, fabric, posture, and expression—not a camera zoom.</em>
</p>

## What it feels like

Put on techno and Radiance can settle into a slow, elegant dance. Start a
difficult task and she becomes attentive. Step away and she rests. Across
sixteen cinematic scenes she moves from neon lounges and chrome catwalks to
quiet data gardens and fictional world-saving operations—always recognizably
herself.

- **A reactive companion:** music energy, BPM, task state, urgency, milestones,
  and away time can influence what she does.
- **Seven minutes of authored scenes:** sixteen distinct moments can play
  back-to-back without a repetitive idle loop.
- **True 30fps motion:** scene videos are generated from Radiance's original
  artwork with a locked camera and physical character movement.
- **Local and press-and-play:** finished MP4s ship with the app. Watching
  Radiance requires no cloud generation, model download, or recompute.
- **A matching Codex pet:** the same character can live inside Codex through
  the validated v2 `Radiance Butterfly` package.

## Meet Radiance on your desktop

You need Node.js 18+:

```powershell
git clone https://github.com/InternalAgencyIO/InternalAgency.git
cd InternalAgency
npm install
npm start
```

The overlay is frameless, draggable, resizable, and always on top. Hover over
Radiance to reveal her controls. Pick a scene, play the full collection, or
enable **Listen** and let the rhythm guide her.

On supported systems, Listen requests loopback system audio. If loopback is
unavailable, it falls back to the default audio input.

### Add her as a Codex pet

```powershell
npm run install:pet
```

Restart Codex if the pet picker is already open, then select
**Radiance Butterfly**.

### Build a portable Windows app

```powershell
npm run dist
```

The production build is written to `release/` and includes the verified 30fps
scene masters. For development, `npm run dist:preview` packages the motion
available so far and uses original scene frames as graceful fallbacks.

## Make Radiance reactive

Local integrations can send her small activity signals:

```js
window.radianceSignal({
  task: { state: "running", kind: "analysis" },
  urgency: "high"
});
```

Signals merge into Radiance's current state, so integrations only send what
changed. Supported cues include music BPM and energy, task state, urgency,
bold-plan mode, away state, successful review, and session milestones.

## Create more scenes locally

The repository contains the same local FramePack production flow used to make
the motion preview above. It begins with an original Radiance frame and creates
character, hair, fabric, and environment movement without fake zooming:

```powershell
npm run video:server
npm run video:scene -- -Scene neon-listening-lounge -Duration 5
```

See [`scripts/video/README.md`](scripts/video/README.md) for the full local
render workflow. Scene definitions and reproducible prompts live in
[`assets/scene-manifest.json`](assets/scene-manifest.json).

## Built in the open

Radiance is being developed as a visible archive of iteration: original art,
scene definitions, local production scripts, generated masters, validation,
and portable packaging. The point is not only the finished companion; it is
proof that a character with continuity can grow quickly without losing her
identity.

- [`docs/iterations/README.md`](docs/iterations/README.md) — iteration ledger
- [`docs/PRODUCTION.md`](docs/PRODUCTION.md) — production and release gates
- `npm test` — validate the scene engine and content contract
- `npm run smoke` — capture a clean overlay screenshot

Radiance's action scenes are fictional and cinematic. The project contains no
procedural weapons or explosives instructions.

---

<p align="center">
  <strong>Beauty in the interface. Calm under pressure. A little more life on the desktop.</strong>
</p>
