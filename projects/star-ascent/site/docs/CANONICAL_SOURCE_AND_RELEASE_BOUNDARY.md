# Canonical source and release boundary

## Authority

The canonical working repository is:

`C:\Users\A\Documents\Codex\2026-07-26\realtime-voice-chat-9`

The GitHub monorepo copy under `projects/star-ascent/site` and any standalone exports are mirrors. They must not be edited independently or treated as fresher than this repository. A mirror update must copy a tested, committed canonical state and preserve unrelated work.

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
