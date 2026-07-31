# Verifier-key lifecycle reference model

> **DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE**

This document defines a network-free reference policy for rotating or disabling
the public Ed25519 key that verifies Promotions DLC identity attestations. It
does not create a key, contain signing material, update a deployed program, or
authorize a verifier.

The current `program-interface.v0.json` stores one verifier public key and has
no rotation or emergency-disable instructions. Therefore, v0 is incomplete for
deployment. The model in `verifier-key-lifecycle.mjs` is design evidence for a
separately reviewed interface revision; it is not silently grafted onto v0.

## Reference policy

- A normal rotation requires a separately approved public review ID and review
  artifact hash.
- A review ID is single-use across normal and emergency transitions.
- The new public key must be published at least 86,400 seconds before its
  scheduled activation.
- The old and new keys may overlap for zero to 3,600 seconds.
- Only one rotation may be pending.
- A public key can never be reintroduced in the same campaign.
- The identity-commitment domain and campaign ID cannot change during rotation.
- The scheduled transition must be explicitly finalized; merely reaching the
  timestamp does not activate the new key.
- The old key stops authorizing newly issued attestations at the exact retirement
  timestamp, even if retirement finalization is submitted later.
- A prior retirement must be finalized before another rotation is scheduled.

The 24-hour notice and one-hour overlap are conservative reference parameters,
not a production promise. Independent security and operational review must
accept or replace them before an interface revision.

## Emergency disable

An independently reviewed emergency action may use one of three public reason
codes: `KEY_COMPROMISE`, `VERIFIER_INTEGRITY_FAILURE`, or
`VERIFIER_UNAVAILABLE`.

Emergency disable is immediate and terminal for this campaign lifecycle:

- no attestation issued at or after the disable timestamp is accepted;
- attestations issued before that timestamp remain verifiable for historical
  audit, subject to their original expiry and all other guards;
- any pending, unactivated rotation is publicly cancelled;
- no key can be rotated, re-enabled, or replaced through this lifecycle after
  disable; and
- resuming verification would require a new reviewed campaign/interface version,
  not a hidden recovery switch.

This fail-closed rule can stop new nominations and settlements. It cannot move
funds, withdraw the promotion vault, mint IAT, rewrite accepted settlements, or
alter the campaign cap.

## Public evidence

Every lifecycle transition appends a canonical hash-chained event containing:

- campaign and sequence;
- prior event hash;
- event timestamp and type;
- public key IDs and public keys where introduced;
- scheduled activation and retirement times;
- public review IDs and hashes; and
- public emergency reason and any cancelled rotation ID.

A checkpoint fixes the campaign, identity domain, event count, head event hash,
status, and publication timestamp. A later event log must retain the exact head
at every published checkpoint. Event mutation, reordering, truncation, campaign
drift, or identity-domain drift fails validation.

## Validity semantics

A key may authorize an attestation issuance timestamp only when:

1. its activation was explicitly finalized;
2. the issuance is not before that finalization;
3. the issuance is strictly before its retirement timestamp, if any; and
4. the issuance is strictly before the lifecycle emergency-disable timestamp,
   if any.

This function answers historical validity only. The attestation still needs its
exact signature, campaign, purpose, wallet proof, nonce, and expiry checks.

## Remaining integration decisions

Before any chain prototype, a reviewed interface revision must define a verifier
registry account, instruction account locks, reviewer authority threshold,
normal rotation instructions, emergency-disable instruction, checkpoint event
schema, and how an in-flight attestation is treated at each boundary. Key
custody remains outside this repository and should use an audited KMS/HSM or
equivalent service.

`KEY_LIFECYCLE_AMENDMENT.md` and its machine-readable v1 amendment now propose
the registry accounts, instruction locks, and attestation guards. They remain an
unapplied delta; reviewer threshold, full-interface composition, event bytes,
deterministic binary, and chain rehearsal are still unresolved.
