# Verifier-registry interface amendment v1

> **DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE**

`program-interface-key-lifecycle-amendment.v1.json` is a machine-readable
security amendment proposed against program interface v0. It remains unapplied.
It does not patch a binary, assign a program ID, create an account, deploy a
program, or make v0 deployable.

## Required base-interface change

The amendment replaces the campaign's inline `verifier_ed25519_key` field with
a read-only `verifier_registry` public key. The nomination, cancellation, and
settlement instructions must then receive both the registry and selected key
record as read-only accounts and enforce issuance-time validity against them.
The composed preview also removes the now-obsolete inline verifier-key argument
from `initialize_campaign`; the separate registry initializer supplies the
initial public verification key after campaign initialization.

This is a same-size field replacement, but that does not make it a safe binary
patch. A full composed interface, deterministic build, new artifact hash,
independent review, and Devnet rehearsal are still required.

## Proposed accounts

- `VerifierRegistry` — 224 bytes including discriminator. Binds the campaign,
  immutable identity domain, current/pending records, rotation policy,
  emergency state, review/event heads, and sequence.
- `VerifierKeyRecord` — 192 bytes including discriminator. Stores only public
  verification material and explicit activation, retirement, cancellation, and
  review boundaries.
- `VerifierReviewReceipt` — 232 bytes including discriminator. Permanently
  consumes a review ID and records the public review hash, action, reason,
  rotation, keys, timestamps, and sequence.

Review receipts and key records have no close instruction in this amendment.
Keeping them prevents rent-reclamation logic from becoming a key- or
review-replay path.

## Proposed instructions

1. `initialize_verifier_registry` binds the first public key and immutable
   identity domain to an initialized campaign.
2. `schedule_verifier_key_rotation` requires the review authority, unused review
   receipt, unused public key, 24-hour notice, and no more than one hour of
   overlap.
3. `activate_scheduled_verifier_key` permissionlessly finalizes a scheduled
   rotation after its clock boundary and writes the old retirement boundary in
   the same transition.
4. `finalize_verifier_key_retirement` permissionlessly records retirement after
   the exact boundary.
5. `emergency_disable_verifier_registry` requires a separate emergency review,
   cancels an optional pending key, records the clock time, and makes disable
   terminal.

None of these instructions accepts a token account, mint, promotion vault,
treasury, ecosystem, liquidity, core-team, staking reserve, or V2 upgrade
authority. The amendment defines no transfer, withdrawal, mint, or re-enable
instruction.

## Attestation guard amendment

Each attestation-consuming instruction must prove:

- the registry was not emergency-disabled at the signed issuance timestamp;
- the selected key's activation was finalized by that timestamp;
- the key had not reached its retirement boundary;
- the key was not cancelled;
- signed key ID, key-record ID, and Ed25519-preinstruction public key agree; and
- the registry identity domain matches the campaign and signed attestation.

These are read-only dependencies. A nomination or settlement cannot rotate or
disable a verifier key.

## Review and evidence gates

The amendment remains `amendmentApplied: false` and keeps
`baseV0Deployable: false`. Applying it requires a separate security review,
independent approval, deterministic build, new public artifact hash, and Devnet
rehearsal. `program-interface-key-lifecycle-vectors.v1.json` fixes the proposed
bytes for all five new instructions, but those vectors are design evidence only.

## Deterministic composition evidence

`program-interface-composition-preview.v1.json` is generated solely from the
base interface, this amendment, and their two byte-vector artifacts. It binds
all four inputs by canonical SHA-256, preserves both discriminator domains,
rejects cross-domain discriminator collisions, and carries every original and
amended forbidden-capability declaration.

The preview deliberately says `deployable: false`, `amendmentApplied: false`,
and `compositionApplied: false`. `validate-program-interface-composition.mjs`
recomputes it byte-for-byte and rejects source, vector, account, guard,
capability, status, or deployment-claim drift.

## Open review questions

- the exact independent-reviewer threshold and emergency governance;
- how the optional pending-key account is represented in a fixed client API;
- event-byte definitions and whether the on-chain event head is necessary;
- account rent payer and permanent retention funding; and
- cross-language IDL generation after the full interface is composed.
