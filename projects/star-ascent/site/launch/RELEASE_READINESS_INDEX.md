# STAR ASCENT — Release Readiness Index

This index is the single operator-facing map for Genesis. It keeps the public
story, the physical signer flow, and the evidence trail in the same order.

Current state: **UNSCHEDULED — MAINNET HOLD — NO CLAIM ROUTE**. The canonical
machine-readable gate is
[`iat-v2-mainnet-readiness-gate.json`](iat-v2-mainnet-readiness-gate.json).

## Before scheduling

1. Confirm the public mainnet fee-payer balance is at least the exact
   `8500000000` lamport ceremony floor using a fresh read-only observation.
2. Publish one replacement UTC window; invalidate the expired window and every
   packet or approval that pre-dates the replacement.
3. Regenerate all bound release artifacts before any final review.

## Before broadcast

1. In the attended final review, run
   `node scripts/run-launch-preflight.mjs --require-ceremony-ready` from the
   project root. It fails before the full preflight if a fresh read-only
   balance, funding, replacement schedule, regeneration, verifier, or Model T
   device-path review is missing.
   The default command is preparation-only and cannot open the ceremony.
2. Validate `launch/iat-v2-mainnet-readiness-gate.json`, then read
   [`GENESIS_COMMAND_CENTER.md`](GENESIS_COMMAND_CENTER.md) and assign the
   roles named there.
3. Read [`IAT_V2_CEREMONY_ENTRY_GATE.md`](IAT_V2_CEREMONY_ENTRY_GATE.md) and
   keep `READY_FOR_ATTENDED_PREFLIGHT` distinct from signing or broadcast
   authority.
4. Prepare the hardware signer using
   [`../docs/TREZOR_SIGNER_READINESS.md`](../docs/TREZOR_SIGNER_READINESS.md)
   and [`../docs/MODEL_T_SOLANA_SIGNING_GATE.md`](../docs/MODEL_T_SOLANA_SIGNING_GATE.md).
5. Keep the public surfaces open: `/launch`, `/signal`, `/proof`, and `/dossier`.

## At Genesis

1. Follow [`GENESIS_OPERATIONS_CARD.md`](GENESIS_OPERATIONS_CARD.md) exactly.
2. Use the machine-readable
   [`iat-v2-mainnet-stage-journal.template.json`](iat-v2-mainnet-stage-journal.template.json)
   and its [`stage reconciliation rules`](IAT_V2_STAGE_RECONCILIATION.md). Stop
   for independent verification after every confirmed stage; the first
   mismatch is a permanent terminal HOLD for that journal.
3. The signer confirms every transaction on-device. No person signs from a
   copied address or an unreviewed prompt.
4. Record the final mint address, exact supply, authority-revocation evidence,
   allocation-wallet evidence, and timelock evidence.
5. Publish only facts that can be independently checked; until then, the public
   proof board remains in its HOLD state.

## First hour

1. Reconcile the chain record with
   [`FIRST_HOUR_RECONCILIATION.md`](FIRST_HOUR_RECONCILIATION.md).
2. Fill and publish [`POST_GENESIS_PUBLIC_UPDATE.md`](POST_GENESIS_PUBLIC_UPDATE.md).
3. Use the verified fields in [`FIRST_HOUR_SOCIAL_PACK.md`](FIRST_HOUR_SOCIAL_PACK.md).
4. Archive the completed publication packet with
   [`PUBLICATION_PAYLOAD.template.md`](PUBLICATION_PAYLOAD.template.md).

## Public routes

- `/launch` — live run of show
- `/proof` — evidence status board
- `/dossier` — White Dossier and archive
- `/signal` — transmission and public updates
- `/press` — approved short-form media material

**Release rule:** the story goes live with the evidence, never ahead of it.
