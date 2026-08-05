# Nightflight campaign-art provenance

This directory contains the three source-bound campaign images used by the
English-only Casino DLC front-end demo. Each file is copied byte-for-byte from
an accepted asset in the public Batch 211 record. The exact source path and
SHA-256 digest are recorded in `asset-provenance.json`.

The implementation uses a deterministic lookup table keyed by game ID. It
selects the host, campaign image, tattoo cue, trio-interaction cue, and PAWS
action without `Math.random`, a network request, a wallet, or a contract.
Rejected generation candidates are intentionally absent.

The project-owned selection and provenance metadata in this directory are
dedicated under CC0 1.0 Universal. That dedication does not change the
repository license for software or expand rights in trademarks or material
the project does not own.
