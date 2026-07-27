# Radiance iteration archive

Radiance is developed in public milestones. Git commits are the immutable
source archive; this ledger explains what each milestone proved and how to
reproduce it.

| Iteration | Commit | Outcome | Proof |
| --- | --- | --- | --- |
| 01 | `73091d8` | Ten-scene, five-minute reactive desktop overlay and Codex pet packaging | `npm test`, `npm run smoke` |
| 02 | `38fc59a` | Motion cues made immediately visible in the overlay | renderer smoke capture |
| 03 | `9626ff3` | Original-frame image-to-video pipeline and 30 fps runtime playback | scene contract tests |
| 04 | `8a806ed` | Generated Python cache removed from source history | clean worktree |
| 05 | `d225269` | Git LFS video masters, integrity manifest, and portable Windows packaging | `npm run dist` release gate |

The next archived iteration is created only after a generated scene passes
frame-rate, duration, identity, and visible-motion review. Failed experiments
remain reproducible through their prompt/seed change commits but are never
promoted as production masters.

## Replay the current source state

```powershell
git clone https://github.com/InternalAgencyIO/InternalAgency.git
cd InternalAgency
git lfs pull
npm ci
npm test
npm start
```

Once all ten masters are present:

```powershell
npm run dist
.\release\Radiance-0.1.0-portable.exe
```

End users do not install FramePack or download model weights. Generation is an
authoring concern; playback is a packaged product feature.
