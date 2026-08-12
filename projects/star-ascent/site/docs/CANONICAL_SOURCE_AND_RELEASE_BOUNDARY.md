# Canonical source and release boundary

## Authority

The canonical forward repository is `InternalAgencyIO/InternalAgency`. B3 is developed in the tracked `projects/star-ascent/site` tree on public GitHub branches, with reviewed changes merged through the repository's normal history.

The earlier standalone V2 checkout is retained as historical source and evidence. It is not the current B3 authority and must not be copied over newer GitHub work. The V2-to-B3 transition is recorded in `public/audits/b3-canonical-lineage-20260808/manifest.json`: historical V2 evidence stays bound to its original commit, tree, and digest, while the separate B3 successor commit must remain an ancestor of the checkout under review.

Standalone exports remain mirrors. A mirror update must copy a tested, committed canonical state and preserve unrelated work.

## What automation may do

- Generate deterministic public configuration and digest records.
- Validate HOLD, READY, COMPLETED, APPROVED, and PUBLISHED schemas.
- Build and test the website and localhost operator console.
- Package a read-only public deployment.

## What automation may not do

- Connect or unlock the Model T.
- Request, record, or transform wallet secrets.
- Change a human evidence artifact to READY, COMPLETED, APPROVED, or PUBLISHED.
- Sign, submit, or claim verification of a Solana transaction.
- Schedule a launch window from an elapsed or assumed date.

## Ceremony boundary

`scripts/generate-mint-ceremony-config.mjs` is the only bridge from reviewed launch artifacts into the mint UI. The generated configuration is deterministic and digest-bound. `LOCKED` is the default. Mainnet configuration requires current, passing metadata, lock-plan, signer, devnet rehearsal, handoff, and release-packet evidence.

The `/mint` signing controls activate only on `localhost`, `127.0.0.1`, or `[::1]`. A public deployment is intentionally read-only even if a stale browser session or injected wallet provider exists.

## Release rule

No GitHub push, Sites deployment, mint transaction, claim route, or public schedule follows merely from a green local build. Those actions each require their own explicit release decision and the evidence required by their canonical gate.
