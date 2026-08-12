# Reward allocator receipt boundary

Status: strict, deterministic, nonactivating audit serialization. It is not an
authenticated allocator, an account codec, a SQL migration, or authority to
reserve or transfer IAT.

The reward-capacity reference produces canonical JSON decisions in exact
post-CCC-order. This boundary serializes those already-recomputed decisions in
two non-circular stages:

1. the ordered canonical-JSON decision digests form the reference receipt set;
2. a fixed batch transcript commits that set and the finalized round;
3. each fixed receipt envelope commits the batch and one uniquely indexed
   reference decision.

`SHA256(exact batch bytes)` is the batch commitment.
`SHA256(exact receipt bytes)` is the binary receipt digest. Neither digest is
authentication evidence.

## Finalized batch transcript

`IATB3RCF`, version 1, exactly 320 bytes:

| Bytes | Field |
| --- | --- |
| 0..8 | ASCII magic `IATB3RCF` |
| 8 | version `1` |
| 9 | fixed finalized-nonactivating status `1` |
| 10 | SHA-256 suite `1` |
| 11..16 | zero |
| 16..48 | canonical reward-capacity policy SHA-256 |
| 48..80 | SHA-256 of `IAT_B3_DEPLOYMENT_DOMAIN_UNFROZEN_V1` |
| 80..88 | exact 00:00 UTC funding round, signed i64 LE |
| 88..120 | canonical round-seal SHA-256 |
| 120..152 | sealed candidate-set SHA-256 |
| 152..184 | pre-allocation lane-ledger SHA-256 |
| 184..216 | post-allocation lane-ledger SHA-256 |
| 216..248 | ordered reference-receipt-set SHA-256 |
| 248..280 | reference outcome SHA-256 |
| 280..312 | canonical reference-finalization SHA-256 |
| 312..316 | reference receipt count, u32 LE |
| 316..320 | zero |

The deployment digest is a hard-coded nonproduction sentinel, never a caller
choice. A production identity domain requires a new codec version after law,
economy, mint, network, and Config identities are frozen.

## Individual receipt transcript

`IATB3ALR`, version 1, exactly 288 bytes:

| Bytes | Field |
| --- | --- |
| 0..8 | ASCII magic `IATB3ALR` |
| 8 | version `1` |
| 9 | fixed nonactivating-reference-receipt status `1` |
| 10 | SHA-256 suite `1` |
| 11..16 | zero |
| 16..48 | SHA-256 of the exact 320-byte batch |
| 48..56 | exact 00:00 UTC funding round, signed i64 LE |
| 56..88 | round-seal SHA-256 |
| 88..120 | reference-finalization SHA-256 |
| 120..152 | SHA-256 of the UTF-8 obligation ID |
| 152..184 | canonical obligation SHA-256 |
| 184..192 | exact amount, u64 LE |
| 192..200 | treasury plan, u64 LE |
| 200..208 | ecosystem plan, u64 LE |
| 208..216 | liquidity plan, u64 LE |
| 216..248 | canonical JSON reference-receipt SHA-256 |
| 248..280 | faction payout digest, or zero |
| 280 | canonical allocator disposition |
| 281 | canonical allocator reason |
| 282 | canonical faction-digest-present boolean |
| 283 | zero |
| 284..288 | zero-based allocation index, u32 LE |

The index must select the same reference digest exactly once in the finalized
ordered set. Funding round, seal, finalization, obligation, amount, lane plan,
disposition, reason, and faction digest must duplicate the referenced decision
exactly. Reordering is therefore observable and rejected.

Only three allocator decisions exist in this codec:

- `ADMITTED_RESERVED / NONE`: amount is positive and checked `T + E + L`
  equals it exactly;
- `NULL_UNDERFUNDED / EXACT_AMOUNT_NOT_AVAILABLE`: amount is positive and all
  lane amounts are zero;
- `NULL_BLOCKED / HIGHER_PRIORITY_OR_EARLIER_OBLIGATION_UNDERFUNDED`: amount is
  positive and all lane amounts are zero.

Daily missed-round, parent-unfunded, claim-expiry, policy/evidence hold,
Premium-stale, and allocator-absent outcomes are separate boundary or terminal
ledger events. They are deliberately not allocator receipt dispositions.

For a weekly faction receipt, the obligation hash binds the indivisible full
manifest and the optional digest must equal its canonical payout digest.
Materializing an individual follower still requires separate manifest
membership evidence.

## X upgrade ancestry

When the 10% base tranche is admitted, the reference reward state retains the
uniquely derived allocation index, reference decision and finalization hashes,
and binary batch and receipt hashes. A later 90% Premium-upgrade obligation
must carry that exact lineage. The reference marks it `authenticated: false`:
the future adapter must authenticate persisted accounts, the finalized round,
receipt membership, identity binding, clock, and Daily Law before relying on
it. No X-bound account layout is frozen by this slice.

## Inert SQL correspondence

The inert SQLite blueprint now records the decoded correspondence. It remains
not a one-to-one persistence contract: relational rows are not the binary
transcripts. In
`reward_v2_allocator_batches`, `allocator_batch_digest` is the exact binary
batch digest; the policy and fixed nonproduction deployment digests are exact;
and the round seal, candidate set, pre-ledger, post-ledger, ordered receipt set,
outcome, finalization, and receipt count map to their same-named transcript
commitments.

`reward_v2_allocator_receipt_transcripts` covers the complete generic global
waterfall (CCC agents, CCC associates, standard/X, weekly faction, and core).
It records every contiguous allocation index and the exact obligation,
decision, binary receipt, amount, three-lane plan, optional faction digest,
disposition, and full canonical reason. The X-specific receipt table can
materialize only after the complete generic set has count/min/max coverage.

The proof bundle is not a third persistence format: it transports one existing
batch plus its complete ordered existing receipt set. A zero-outcome finalized
round therefore has one batch with receipt count zero and no receipt rows. Its
validator still requires the external finalized round state and any committed
CCC reveal for full recomputation. SQL does not authenticate those inputs;
`runtime_authentication_verified` remains fixed to `0`.

## Remaining activation blockers

No public opcode, account owner/PDA validation, authenticated UTC source,
allocator signature or threshold scheme, replay-safe atomic persistence,
scalable membership proof, Token-2022 transfer, rollback proof, or production
identity is supplied here. Every future mutation still begins with the opaque
canonical open Daily-Law capability. Mainnet remains HOLD.
