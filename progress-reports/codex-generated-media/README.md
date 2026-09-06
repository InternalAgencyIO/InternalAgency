# Codex generated-media trail

This directory is the append-only public trail for image and video output made or handled by Codex while building InternalAgency.

- `manifest.jsonl` records every discovered occurrence, including rejected, unused, unrelated-request, QA, intermediate, superseded, and canonical assets.
- `blobs/` stores external or ignored output once by SHA-256. Duplicate occurrences point at the same blob or an existing repository path.
- Existing in-repository work stays at its useful path (for example `tmp/`); the manifest points to it instead of making another copy.
- Accepted campaign media remains canonical under `assets/`. A manifest entry or progress blob never makes an image accepted; only the authoritative campaign contract and checkpoint do that.

Run the collector from the repository root:

```powershell
node scripts/archive-generated-media.mjs --apply
```

Optional historical sources can be added explicitly:

```powershell
node scripts/archive-generated-media.mjs --apply --legacy-root "C:\path\to\older-workspace"
```

The collector scans Git-tracked and untracked repository media, the exact FramePack output folder, generated media under the local Codex image store, and intentional ignored `artifacts/` media. It excludes dependencies, runtime packages, and release bundles. Re-running it appends only new path/content occurrences.

Commit and push each new four-slot render bank before opening a later bank or country. Keep large binaries under Git LFS.
