# STAR ASCENT live broadcast operator card

Status: **HOLD — WINDOW OPENS 29 JULY 2026 AT 15:00:00 UTC**

## Before the window

- Open only verified official URLs and the prepared public evidence page.
- Confirm the Trezor device is charged, unlocked by its owner, and has completed the rehearsed path. Never enter or share recovery material.
- Confirm `launch/release-snapshot.generated.json` is current, validated, and still `HOLD`; `launch/mainnet-handoff.template.json` is `APPROVED`; and `launch/release-packet.template.json` is `READY`. These are review states, not signing or publication authority.
- Confirm a distinct correction owner is named in the approved handoff and ready packet.
- Read the public status aloud: **HOLD until every ordered evidence field is independently verified.**

## Broadcast sequence

1. State scope: no presale, no paid registration, no price or yield claim.
2. Show the intended mint and allocation plan as a proposal, not a completed fact.
3. Follow the exact four-transaction ceremony:
   1. `CREATE_INITIALIZE_IMMUTABLE_METADATA`
   2. `MINT_FIVE_ALLOCATION_DESTINATIONS`
   3. `REVOKE_MINT_AUTHORITY`
   4. `REVOKE_FREEZE_AUTHORITY`
4. For every transaction, the owner verifies the reviewed transaction on the
   physical device and the independent verifier captures direct evidence before
   the next transaction.
5. Publication is a separate human action. Publish only the validated
   publication payload and canonical Proof Board routes after confirming the
   metadata, supply, five allocations, and both revoked authority states.

## Stop conditions

Stop immediately if the device screen differs from the prepared transaction,
an address differs from the reviewed plan, a transaction fails, a proof field
cannot be independently checked, a credential is requested, or a digest or
approval is stale. Say `HOLD`, preserve the evidence, and stop signing and
publication.

Return the handoff and release packet to their canonical `HOLD` reset states.
The correction owner coordinates the source correction, release-snapshot
regeneration, and repeated independent review. Never edit the snapshot or reuse
stale digests, labels, or approval timestamps.

## After verified publication

- Publish mint, program, supply, authority evidence, allocation addresses,
  lock evidence, and circulating-supply calculation.
- Update the Dossier record from `HOLD` only where the linked evidence exists.
- Record corrections openly. Do not fill uncertainty with narrative.
