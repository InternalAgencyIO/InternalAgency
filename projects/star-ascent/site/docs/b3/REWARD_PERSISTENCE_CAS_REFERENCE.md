# Reward Persistence CAS Reference Boundary

Status: `NON_ACTIVATING_UNAUTHENTICATED_REFERENCE`
Mainnet status: `HOLD`
Runtime authentication verified: `false`
Rollback protection verified: `false`
Activation ready: `false`

This document fixes the boundary of the in-memory compare-and-swap reference in
`programs/iat_b3_reference/reward-persistence-cas.mjs`. It does not activate a
reward path, authenticate an adapter, create an on-chain account codec, provide
durable storage, or relax the immutable IAT-wide Daily Law.

## What the reference proves

The store has one global shared-lane ledger entity, one entity per sealed UTC
funding round, and one entity per X-bound reward. Every entity is stored with an
unsigned 64-bit revision and a SHA-256 digest of its canonical typed value. A
write must present both the exact current revision and the exact current digest.
The next revision is exactly the current revision plus one. Partial payments are
not represented.

Round finalization is one atomic in-memory transaction over all of these facts:

1. the pending round revision and digest;
2. the global shared-lane ledger revision and digest;
3. the finalized round value;
4. the post-allocation shared-lane ledger;
5. the one-shot round-consumption marker;
6. the complete allocator batch and contiguous receipt proof bundle;
7. the proof-bundle, finalization, pre-ledger, and post-ledger digests;
8. the append-only commit and new hash-chain head.

The exact ledger snapshot sealed into the round must still equal the current
ledger entity. Therefore a successful earlier round makes any separately sealed
round against the old ledger fail closed, even if a caller supplies the new
ledger revision. A consumed round cannot be replayed.

Pending rounds form a strict UTC sequence fence: only the earliest pending
funding round may finalize. A later round cannot leapfrog an earlier pending
round and consume the shared reserve first. Snapshot recovery independently
requires finalization commits to be strictly ascending by funding round and
rejects any finalized commit that has skipped an earlier retained pending round.

Premium upgrade recording is one atomic in-memory transaction over the reward
revision/digest, the updated X-bound state, the one-shot upgrade-attempt marker,
the unauthenticated evidence digest, the append-only commit, and the new head.
After the first accepted attempt, both an exact retry and a different proof or
evidence digest are rejected. The 90% upgrade remains dependent on the immutable
base-10% admission lineage enforced by the reward reference state.

## Daily Law ordering

`finalizeRewardCapacityRoundCas`, `recordPremiumUpgradeCas`, both exported
preparation builders, and the exported commit builder validate the branded
Daily-Law state before reading or comparing mutable store state. A lockdown,
unfinalized day, stale day, or caller-authored substitute fails before a CAS
operation. The in-memory snapshot remains unchanged on every such failure.

The adapter symbol is not an authority boundary. Calling it directly still
reaches a preparation builder that validates Daily Law first. Production must
replace this reference boundary with authenticated ownership, PDA/address,
discriminator, canonical clock/slot, and Daily-Law provenance checks.

## Typed state and immutable chain

The state digest uses a domain-separated typed codec. `null`, boolean, string,
safe integer number, bigint, bytes, dense array, and plain record have distinct
tags. Negative safe integers round-trip exactly. Buffer and Uint8Array are one
canonical byte type, and a subarray commits only its declared byte range.

Arrays and byte views must be dense indexed data values with no extra own
properties. Plain records must have only enumerable own data properties. Sparse
arrays, accessors, symbols, decorated byte views, unsupported prototypes,
non-safe numbers, negative zero, and cycles are rejected. Repeated acyclic object
references are deliberately canonicalized by value; reference identity is not
part of persisted state.

Commits use consecutive positive sequences and bind the previous commit digest.
A finalization commit contains exactly one round change and the global ledger
change. An upgrade commit contains exactly one X-reward change. Snapshot
validation recomputes entity, commit, consumption, proof, and attempt digests;
checks the complete commit chain and head; checks per-entity change continuity;
and binds each proof/attempt marker to its commit. Store reads and snapshots are
defensive clones, so callers cannot mutate retained state through returned
objects.

Completeness is bidirectional. Every round-consumption, proof, or Premium-attempt
marker must bind one exact commit, and every finalization commit must retain one
consumption plus one proof while every Premium-upgrade commit must retain one
attempt. Deleting both sides of a round marker pair, or deleting an upgrade
attempt while leaving its commit, is invalid recovery state.

## Failure atomicity and recovery

The implementation constructs all next maps, records, proof bytes, commits, and
the next head before replacing any retained state. The test-only fault points
`AFTER_MARKER`, `AFTER_PROOF`, `AFTER_FIRST_ENTITY`, and `BEFORE_HEAD` prove that
an exception at each staging boundary leaves the complete prior snapshot equal
by value. Post-commit getters recover the head, entity, commit, round-consumption
marker, exact proof record, and Premium attempt. Two stores with identical input
snapshots and operations produce byte-for-byte equivalent results and heads.

## Explicitly deferred production work

This tranche intentionally stops at an in-memory reference. It has no SQLite or
other file-backed adapter, transaction journal, fsync boundary, crash/reopen
test, multi-process lock, authenticated upstream adapter, monotonic finalized
chain source, or rollback-resistant durable head. Process termination loses the
store. `rollbackProtectionVerified` therefore remains `false` everywhere.

Mainnet activation remains blocked until a separately reviewed durable adapter
proves database transaction atomicity, crash recovery, concurrency control,
authenticated Daily-Law and reward inputs, canonical deployment identity, and
rollback resistance. No code in this reference may be treated as runtime wiring
or as permission to publish, reserve, pay, claim, or mint rewards.
