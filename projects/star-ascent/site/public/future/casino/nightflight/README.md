# Nightflight campaign-art provenance

This directory contains six source-bound campaign images used by the
English-only Casino DLC front-end demo. Three foundation files are copied
byte-for-byte from accepted assets in the public Batch 211 record. Three
versioned campaign files were generated for this demo with the foundation
files as identity, palette, relationship, wardrobe, and PAWS references. Exact
source paths or reference sets and SHA-256 digests are recorded in
`asset-provenance.json`.
The normalized generation prompts and output digests are published in
`generation-prompts-v1.md`.

The implementation uses the immutable, executable story manifest at
`app/future/casino/demo/nightflight-narrative.mjs`, keyed by game ID. It
selects the lead host, campaign image, reciprocal pair-or-trio cue, and PAWS
action without `Math.random`, a network request, a wallet, or a contract. The
manifest deliberately covers every edge of the Radiance-Ellie-Alia triangle
and keeps lead focus balanced 4/3/3 across the ten rooms.
Rejected generation candidates are intentionally absent. Every generated
character is specified as a fictional adult age 25+, fully clothed, and
non-explicit. The apparent campaign-film motion is CSS pan, zoom, flare, and
scanline animation over still images; it is not represented as model-generated
live-action video.

The project-owned selection and provenance metadata, plus the rights the
project can dedicate in the three generated v1 assets, are dedicated under CC0
1.0 Universal. That dedication does not change the repository license for
software or expand rights in identities, trademarks, model inputs, or material
the project does not own.
