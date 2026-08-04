# Radiance V2 Public Build 001

This directory is the public, non-destructive build record for the Radiance, Ellie & Alia wardrobe V2 pass completed on 2026-08-04.

## Contents

- `primary-originals/`: 12 source stills from the established private-stream sequence.
- `primary-v2/`: 12 identity-preserving V2 wardrobe revisions.
- `external-originals/`: all 24 source PNGs supplied as the additional generated-image set.
- `external-v2/`: 24 matching non-destructive V2 revisions.
- `asset-manifest.json`: generated file inventory with byte sizes, dimensions, and SHA-256 hashes.
- `BUILDLOG.md`: the public wave-by-wave production and validation record.
- `Generate-AssetManifest.ps1`: deterministic local manifest generator.

No original file was overwritten. V2 assets use separate filenames and folders.

## Visual contract

The V2 direction uses coordinated glossy coated-textile tailoring with opaque-backed floral/lace-like embroidery, concise stage-runway silhouettes where the composition supports them, open-waist sleeveless construction where renderer-safe, and coordinated statement heels wherever footwear is visible.

All characters are clearly adult fictional women. Every accepted image remains fully clothed, opaque, secure, non-explicit, anatomically natural, and suitable for mainstream fashion-editorial publication.

Two primary scenes repeatedly failed the full silhouette transformation at output validation. Those scenes use a documented safe-recovery method that changes material and footwear while preserving the source garment cuts and coverage. Two cropped portraits use composition-valid upper-body-only revisions and do not invent off-frame footwear.

## Rebuild the manifest

```powershell
pwsh -File .\Generate-AssetManifest.ps1
```

The generator scans only the four asset folders above and writes `asset-manifest.json`.
