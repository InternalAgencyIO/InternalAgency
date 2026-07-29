# Incoming artwork ingestion — STAR ASCENT

Use this card when Grok, Gemini, or another generator supplies new campaign art.
It is a review and handoff procedure, not permission to publish an asset.

Start each delivery by copying `launch/incoming-artwork-manifest.template.json`, filling it in, and running:

```sh
node scripts/validate-incoming-artwork-manifest.mjs path/to/manifest.json
```

The validator accepts only `HOLD` or `PENDING_REVIEW`; it never produces a publish-ready status.

## Delivery package

- Supply the original PNG or WebP, plus the prompt, model, date, and creator
  approval in the private handoff note. Never place those details in public metadata.
- Name files in `public/images/` as `star-ascent-<subject>-v<N>.<ext>`; do not
  overwrite a released version.
- Provide one landscape master at least 2400 × 1350 px. If a portrait crop is
  intended for the dossier or shortcut, provide a separate master at least
  1350 × 1800 px. Keep the intended subject inside the central 70% of both
  the width and height; record all four safe-area edges in the manifest.
- Flatten the image, use sRGB, and keep the shipped file below 3 MB. Do not
  embed EXIF location, account, prompt, or contact data.

## STAR ASCENT visual fit

The live surface uses near-black space, ember red (`#ff3126`), violet accents,
high-contrast scorpion/crew silhouettes, and roomy left-side copy overlays.
Avoid tiny lettering, logos, fake interfaces, QR codes, token addresses,
wallet prompts, price charts, countdown guarantees, and claims of launch or
availability. Artwork must remain safe if viewed without surrounding copy.

## Placement map

| Intended use | Existing reference | Crop rule |
| --- | --- | --- |
| Main campaign/hero art | `star-ascent-keyart-v2.png` | Preserve the center and right third; site copy may occupy the left third. |
| Narrative arrival scene | `scorpion-crew-arrival-v1.webp` | Keep the crew clear at 62% horizontal crop on mobile. |
| Dossier feature art | `scorpion-commander-portrait-v1.webp` | Keep the face and shoulders in the upper-middle crop. |
| Small fixed shortcut | `stage-manager-story.webp` | It is hidden below 480 px; it must read without any small text. |

## Manifest fields and performance decisions

- One manifest entry is required per returned file. Its filename, byte size,
  native dimensions, placement, bilingual alt text, 70% horizontal and vertical safe areas,
  and review booleans are all mandatory.
- Use `preload` only for a reviewed hero replacement. Use `lazy` for arrival,
  dossier, and shortcut artwork. Never make a speculative or below-the-fold
  campaign asset eager. The validator permits at most one preloaded image and
  caps that critical-path image at 3 MB.
- A delivery may contain several reviewed files, but their combined shipped
  weight must stay at or below 5 MB. Split excess material into a later
  handoff instead of weakening the page-performance budget.
- A returned social-card or livestream image must also be named in its matching
  `handoff` entry, and its manifest placement must match that channel exactly.
  `REQUESTED` and `DELIVERED` need an exact filename; `NOT_REQUESTED` and
  `HOLD` must leave the filename blank. No assumed or cross-channel asset is
  allowed.
- The review record must explicitly clear generated text, unlicensed marks,
  personal data, and rights. Do not replace those booleans with a narrative
  claim or a status label.

## Review gate before a source change

1. Compare the asset at desktop, 700 px, and 480 px crops against its target.
2. Confirm no generated text or symbol can be mistaken for an official address,
   link, price, approval request, or live status.
3. Confirm the prompt and original file contain no secrets, personal data, or
   third-party protected mark requiring permission.
4. Add the versioned file and update only the component that owns its placement.
   Keep the old asset until the replacement has passed visual review.
5. Record the asset filename, intended placement, reviewer, and date in the
   manifest and commit message. Publish only after the standard site build.

## Rejection triggers

Reject or return the asset when it contains unreadable generated lettering,
unlicensed logos or recognizable people, unsafe wallet or payment imagery,
claims that cannot be verified on the public site, or a crop that hides the
subject at mobile width.
