# Build Log

## 2026-08-04

1. Inventoried and visually inspected 12 established primary stills.
2. Inventoried and visually inspected all 24 PNGs in the additional generated-image source set.
3. Materialized two non-destructive revision plans before generation:
   - 12-item primary V2 set.
   - 24-item external V2 set.
4. Locked the wardrobe contract:
   - Identity, pose, action, props, setting, camera, crop, and lighting preserved.
   - Glossy coated-textile construction and opaque-backed floral/lace-like trim dominate.
   - Concise self-lined silhouettes and statement heels are used where visible and composition-valid.
   - Fully opaque, secure, adult, non-explicit coverage remains binding.
5. Ran direct image-edit calls in parallel waves, with one source per lane.
6. Primary-set production:
   - Items 1–6 passed the full wardrobe treatment and were frozen independently.
   - Items 8 and 10 passed in the next wave.
   - Item 9 passed on its isolated retry.
   - Item 11 passed on its isolated retry.
   - Items 7 and 12 repeatedly failed output validation under full and conservative transformation wording.
   - Items 7 and 12 passed a final material-and-footwear-only safe-recovery method, preserving their original cuts and coverage.
7. External-set production:
   - Item 2 passed first.
   - Items 3–5 passed; item 6 required an isolated conservative retry.
   - Items 6–9 then passed together.
   - Items 10–13 passed together.
   - Items 15–17 passed; item 14 required an isolated conservative retry.
   - Items 14 and 18–20 passed together.
   - Items 21–24 passed together.
   - Item 1, a close portrait, passed a composition-valid upper-body-only revision.
8. Visually inspected every successful output before accepting it.
9. Copied accepted outputs to versioned destinations without overwriting originals.
10. Recorded exact SHA-256 hashes and byte sizes for all 36 V2 files.
11. Validated:
    - 12 primary originals and 12 primary V2 files.
    - 24 external originals and 24 external V2 files.
    - Zero empty output files.
    - Zero duplicate V2 hashes.
    - Valid JSON production metadata.
12. Uploaded the first six primary V2 files to the existing Drive delivery folder before the workflow switched to build-in-public publication. No Drive identifiers are included in this public record.
13. Copied all 36 originals and all 36 V2 outputs into this public GitHub release directory.
14. Generated `asset-manifest.json` and ran repository-safe validation before the narrow commit and push.
15. Published the complete LFS-backed release to the public `agent/iat-launch-window` branch in commit `15d22fd9c2eb49a38b1433099686fb0f4ec4e396`.
