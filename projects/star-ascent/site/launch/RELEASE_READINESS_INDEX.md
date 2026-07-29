# STAR ASCENT — Release Readiness Index

This index is the single operator-facing map for Genesis. It keeps the public
story, the physical signer flow, and the evidence trail in the same order.

## Before broadcast

1. Run `node scripts/run-launch-preflight.mjs` from the project root. It starts
   with isolated negative-case gate regressions, then validates the live
   artifact set; any failure keeps the launch in HOLD.
2. Read [`GENESIS_COMMAND_CENTER.md`](GENESIS_COMMAND_CENTER.md) and assign the
   roles named there.
3. Prepare the hardware signer using
   [`../docs/TREZOR_SIGNER_READINESS.md`](../docs/TREZOR_SIGNER_READINESS.md)
   and [`../docs/MODEL_T_SOLANA_SIGNING_GATE.md`](../docs/MODEL_T_SOLANA_SIGNING_GATE.md).
4. Keep the public surfaces open: `/launch`, `/signal`, `/proof`, and `/dossier`.

## At Genesis

1. Follow [`GENESIS_OPERATIONS_CARD.md`](GENESIS_OPERATIONS_CARD.md) exactly.
2. The signer confirms every transaction on-device. No person signs from a
   copied address or an unreviewed prompt.
3. Record the final mint address, exact supply, authority-revocation evidence,
   allocation-wallet evidence, and timelock evidence.
4. Publish only facts that can be independently checked; until then, the public
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
