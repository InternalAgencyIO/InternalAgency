# Reward Persistence CAS Reference Boundary

Status: `NON_ACTIVATING_UNAUTHENTICATED_REFERENCE`
Mainnet status: `HOLD`
Runtime authentication verified: `false`
Rollback protection verified: `false`
Activation ready: `false`

This document fixes the boundary of the in-memory reference implementation in
`programs/iat_b3_reference/reward-persistence-cas.mjs` and its host-only durable
SQLite compare-and-swap adapter in
`programs/iat_b3_reference/reward-persistence-cas-sqlite.mjs`, plus the
provider-neutral external checkpoint protocol in
`programs/iat_b3_reference/reward-persistence-checkpoint.mjs`.
None activates a reward path, authenticates an upstream adapter, creates an
on-chain account codec, or relaxes the immutable IAT-wide Daily Law.

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

## Host-only SQLite durability boundary

The optional SQLite store is a Node 24 `node:sqlite` reference adapter. It accepts
only a file-backed database. It is not imported by application, worker, launch,
Solana, migration, or production paths. A new empty database requires an explicit
fixture state; an existing database must match the exact v1 schema and is never
migrated in place.

Every adapter connection requires and verifies foreign keys, recursive triggers,
`trusted_schema=OFF`, WAL journal mode, and `synchronous=FULL`. Native extensions
and double-quoted string literals are disabled, and SQLite defensive mode is
enabled. The immutable metadata row binds the adapter/schema versions, reference
deployment domain, schema-manifest digest, revision-zero entity-set digest, and
the exact `false`/`HOLD` flags.

The database is append-only:

- `reward_cas_entity_versions` retains revision zero and every successor;
- `reward_cas_commits` retains the complete commit chain;
- `reward_cas_head_history` retains genesis and every subsequent head;
- round-consumption, complete proof, and Premium-attempt tables retain one-shot
  tombstones and evidence;
- every table has `BEFORE UPDATE` and `BEFORE DELETE` abort triggers plus a
  duplicate-insert trigger that prevents `REPLACE` from deleting an old row.

Unsigned 64-bit revisions and commit sequences are stored as exact fixed-width
big-endian eight-byte BLOBs, not SQLite signed integers. Their canonical decimal
text and every indexed digest are independently compared with the decoded typed
record during recovery.

Every write validates Daily Law before inspecting the database, then uses
`BEGIN IMMEDIATE`. Inside that transaction it revalidates the exact schema,
metadata, SQLite integrity, foreign keys, full entity-version history, full
commit/head chain, and bidirectional marker/proof completeness. Entity writes use
an SQL predicate against the exact latest revision and state digest. The adapter
then appends the marker, entity version or versions, proof where applicable,
commit, and head; reconstructs the whole state again; and commits only if the
complete reference validator accepts it. It never uses `UPDATE`, `DELETE`,
UPSERT, or `REPLACE`.

Reads and reopen validation run in one SQLite read transaction so a concurrent
writer cannot create a torn entity/commit/head view. Recovery is intentionally
strict and currently O(all entity versions + commits + retained proof bytes) in
time and memory. Artifacts are returned as defensive decoded copies.

Tests inject rollback failures after marker, first entity, proof, commit, and
head writes; reopen always observes the exact prior snapshot. A child-process
hard exit with an open WAL transaction also leaves no partial version. A separate
post-commit lost-response fault proves that the durable marker/proof/commit/head
can be recovered and an exact or alternate retry remains one-shot. Two open
connections prove `BEGIN IMMEDIATE` contention and stale-ledger rejection.

WAL and `synchronous=FULL` provide the SQLite crash-durability boundary only.
The main database, `-wal`, and `-shm` sidecars are one live persistence unit and
must never be copied independently while open. The adapter cannot detect an
operator replacing that whole unit with an older, internally consistent copy.
No value stored inside the same database can supply a monotonic external anchor.
For that reason `rollbackProtectionVerified` remains `false`.

## Provider-neutral external checkpoint protocol

The checkpoint module defines only a non-activating protocol and verifier. It
contains no provider, network client, credential, production identifier, or
runtime consumer. The focused tests supply an in-memory mock sink solely to
exercise the protocol.

A persistence identity binds the explicit unfrozen reference deployment domain,
the SQLite adapter schema and version, the immutable schema-manifest digest, the
revision-zero entity-set digest, and fixed reference-only external namespace and
trust-policy digests. Callers cannot select or replace the namespace or policy.
The literal reference namespace is
`IAT_B3_REWARD_CAS_EXTERNAL_CHECKPOINT_REFERENCE_V1`; the trust policy explicitly
states that the reference is unauthenticated and provider-neutral. These labels
do not identify a production deployment, authority, account, or service.

Each typed-canonical checkpoint binds exactly:

1. the persistence-identity digest;
2. an unsigned 64-bit checkpoint revision;
3. the corresponding unsigned 64-bit CAS commit sequence;
4. that retained commit's digest (or the zero digest at Genesis);
5. the previous checkpoint digest; and
6. the immutable `false`/`HOLD` reference flags.

Checkpoint revision is always CAS sequence plus one. An absent checkpoint may
initialize only while the validated local CAS head is still sequence zero. A
provider reset or late adoption after any local commit fails with
`REWARD_CAS_UNANCHORED_HISTORY_HOLD`; the protocol never retroactively blesses
unanchored history. After Genesis, one compare-and-swap advances exactly one
retained CAS commit and one checkpoint revision. Skipped commits, an unrelated
branch, a stale local restore, and a same-sequence fork all fail closed. A DB
that is legitimately ahead after an anchor outage may reconcile only one commit
at a time from the exact retained ancestor.

The sink CAS predicate is the exact expected checkpoint revision plus digest.
The writer validates Daily Law before reading the store or sink, validates the
complete local snapshot and persistence identity, and then proposes one
checkpoint. A lost sink response is recoverable only when readback equals the
exact proposed checkpoint; an alternate or stale value is rejected. This is a
local-commit-first protocol: DB-ahead can be a recoverable anchor outage, while
checkpoint-ahead is a local rollback signal and remains `HOLD`.

A closed-database test copies a valid sequence-one database, advances the live
database and checkpoint to sequence two, restores the older copy, and reopens
it. SQLite's complete internal validation accepts that self-consistent old
snapshot, while external checkpoint verification rejects it as locally behind.
This proves the protocol can expose whole-database rollback when an independent
trusted monotonic sink eventually exists. It does not make the current mock sink
trusted, cannot detect rollback of an uncheckpointed tail, and provides no
cross-system atomicity between SQLite and any future sink. This reference does
not gate subsequent local CAS writes or downstream consumers while the database
is ahead of the checkpoint, and it cannot detect rollback of the sink itself.
Any future safety claim therefore depends on an independent sink that supplies
linearizable exact compare-and-swap and readback semantics.

External records require exact own enumerable data fields with canonical types,
lowercase 32-byte hexadecimal digests, and dense acyclic typed values. Missing,
extra, symbol, hidden, accessor, sparse, cyclic, null-prototype, and
custom-prototype aliases are rejected without invoking getters.

Because the deployment domain and external authority are unfrozen, runtime
authentication, external monotonicity, rollback protection, and activation all
remain `false`; Mainnet status remains `HOLD`. No field or API in this slice is
named or represented as verified external persistence.

## Explicitly deferred production work

Mainnet activation remains blocked on authenticated Daily-Law ownership and
address provenance, authenticated reward/source/tier/wallet inputs, canonical
clock and finalized-chain provenance, deployment authority, process-level access
control, an externally anchored monotonic head, production backup/restore policy,
and an on-chain account/instruction contract. Runtime authentication remains
`false`, rollback protection remains `false`, activation remains `false`, and
Mainnet remains `HOLD` in every durable artifact.

No code in any reference may be treated as runtime wiring or as permission to
publish, reserve, pay, claim, transfer, or mint rewards.
