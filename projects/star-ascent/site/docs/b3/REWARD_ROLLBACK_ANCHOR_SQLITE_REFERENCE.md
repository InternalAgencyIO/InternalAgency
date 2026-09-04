# B3 reward rollback-anchor SQLite mirror prerequisite

Status: **host-only, nonactivating durable local-mirror prerequisite**.
Mainnet remains **HOLD**.

[`reward-rollback-anchor-sqlite.mjs`](../../programs/iat_b3_reference/reward-rollback-anchor-sqlite.mjs)
closes one narrow persistence gap after cryptographic rollback-anchor
verification. It consumes only an in-process, branded receipt from
`reward-external-rollback-anchor.mjs` and atomically appends an exact receipt
projection and its matching cursor to a file-backed SQLite database. On every
open, read, comparison, and write, it validates the complete schema, metadata,
integrity checks, foreign keys, receipt chain, cursor chain, row projections,
and content digests.

This is a local durability prerequisite. It is not the external checkpoint
provider, not independent monotonic storage, and not a runtime reward adapter.
It does not select or contact a provider, load a credential, generate a key,
authenticate ownership of a configured public key, authorize a reward effect,
or change the release graph.

## Required caller inputs

Construction has no identity or state defaults. The caller must supply:

- a file-backed database path;
- an explicit `PRODUCTION` `EXTERNAL_CHECKPOINT_PROVIDER` trust binding;
- the exact trust-bound reward-anchor genesis state; and
- the exact trust-bound provider-envelope genesis state.

Fixture, zero, malformed, wrong-provider, non-production, mismatched-trust,
non-genesis, extra-field, accessor-backed, and unsupported option inputs fail
closed through the composed validators and the mirror's exact option gate. The
module does not establish that any supplied identity, registry, evidence
digest, or public key belongs to a real production provider.

Only a mirror that completes construction and full database validation is
frozen and added to a module-private `WeakSet`. The exported adapter assertion
checks that process brand without reading candidate properties. Structural
clones, bound-method aliases, proxies, prototype lookalikes, and accessor fakes
cannot acquire the brand. This authenticates the exact in-process factory
instance only; it does not authenticate an external provider, make the host
trusted, or establish runtime confinement.

The provider-envelope sequence is required to begin at one and remain
contiguous with the anchor sequence stored by this mirror. Operational use
therefore requires a dedicated receipt domain for reward rollback anchors. A
provider domain multiplexed with unrelated signed operations will create
sequence gaps and is deliberately rejected. This document does not claim that
such a dedicated production domain exists.

## Durable layout and transaction

The strict schema has three append-only tables:

1. one immutable metadata row binding the schema-manifest digest, namespace,
   persistence identity, trust binding, trust root, key-registry snapshot, and
   both genesis-state digests;
2. receipt projections keyed independently by big-endian unsigned 64-bit
   sequence, canonical decimal sequence, anchor/checkpoint/CAS/provider
   digests, both predecessor-state digests, source verification-receipt digest,
   and a canonical content-addressed record blob; and
3. cursor records bound one-to-one by a deferred foreign key to the matching
   receipt, with their own contiguous predecessor digest and canonical record
   blob.

Every retained sequence has both a canonical decimal representation and an
eight-byte big-endian representation. This avoids SQLite numeric coercion and
preserves exact unsigned 64-bit ordering. Strict checks reject malformed,
negative, overflowing, noncanonical, zero-when-positive, and inconsistent
representations.

A consume operation opens `BEGIN IMMEDIATE`, fully revalidates the existing
database, validates the process-branded source receipt, enforces exact trust
root and persistence identity, and requires all of these transitions to be
contiguous:

- anchor sequence and predecessor anchor;
- checkpoint revision and predecessor checkpoint;
- CAS sequence and head digest;
- provider-envelope sequence and predecessor provider state;
- reward-anchor pre-state and post-state digests; and
- provider-envelope pre-state and post-state digests.

It then inserts one receipt and one cursor, revalidates the database while the
transaction is open, and commits both together. An exact retry of the current
process-branded receipt returns `ALREADY_CURRENT` without adding a row. An
older receipt, skip, same-sequence fork, predecessor splice, alternate trust
root, serialized receipt, or structurally valid but unbranded clone fails.

The database uses WAL mode, `synchronous=FULL`, foreign keys, recursive
triggers, trusted-schema off, strict tables, disabled extension loading, exact
schema-manifest comparison, append-only update/delete triggers, and explicit
duplicate-insert triggers. Node 24.4 is the pinned minimum executable for this
reference because it provides `node:sqlite`; the API is still experimental in
that runtime. Node 24.4 does not expose SQLite defensive mode. This module does
not claim defensive mode, sandboxing, hostile-host resistance, or production
runtime compatibility from these local settings.

## Crash and reopen evidence

The hostile suite covers both exception boundaries and abrupt child-process
termination:

- exact-property clones, bound aliases, proxies, prototype lookalikes, and
  accessor fakes fail the process-brand assertion without property reads;
- failure after the receipt insert but before the cursor insert rolls back and
  reopens with neither row;
- failure after both inserts but before commit rolls back and reopens with
  neither row;
- an abrupt process exit after the receipt insert recovers an empty database;
- a reported failure after commit reopens with both rows and an exact retry is
  idempotent; and
- an abrupt process exit immediately after commit reopens with both rows.

The hard-exit fault values are explicitly named `testOnlyFault` inputs and
exist only to exercise SQLite recovery boundaries in an isolated child
process. They are not a runtime recovery mechanism or production control.

## Local rollback comparison

`compareWithSuppliedAnchorState` validates an exact trust-bound anchor state
and reports one of four local relationships:

- `EXACT`;
- `LOCAL_AHEAD`;
- `LOCAL_BEHIND`; or
- `SAME_SEQUENCE_FORK`.

If an older, internally valid database file is restored and the caller still
supplies the known higher anchor state, the mirror reports `LOCAL_BEHIND` and
sets `localRollbackSignalDetected: true`. A same-sequence digest fork produces
the same signal. The suite closes the live database, restores a sequence-one
copy after sequence two was committed, reopens it, and verifies this result.

This comparison does **not** authenticate the supplied state. Its receipt says
`suppliedStateAuthenticityVerified: false`. If an attacker rolls back the
database, WAL/SHM sidecars, and the caller's supplied anchor state together,
the local mirror cannot distinguish the restored unit from its original
history. If the host, filesystem, SQLite library, or process is malicious,
append-only triggers and local digests are not an independent trust boundary.
The database file and any live WAL/SHM files must also be treated as one
persistence unit; copying only one component is not a valid backup protocol.

## Exact positive facts

Successful operations establish only:

- complete local schema and history validation at that operation boundary;
- a contiguous local projection of already-executed, process-branded signed
  anchor verification receipts;
- atomic local receipt-plus-cursor commit;
- file-backed close/reopen and tested SQLite crash recovery; and
- detection that this local mirror is behind or forked relative to a separately
  supplied higher state.

These facts are exposed as
`durableLocalMirrorVerified: true`,
`cursorReceiptAtomicityVerified: true`, and
`localRollbackComparisonVerified: true`. They are intentionally local and do
not assert external truth.

## Deliberate HOLD boundary

The mirror, stored receipt records, cursors, operation results, snapshots,
heads, and comparison results preserve these broader fields as false:

- `providerAuthenticationVerified`;
- `externalProviderDurabilityVerified`;
- `externalMonotonicityVerified`;
- `independentRollbackProtectionVerified`;
- `runtimeIntegrationVerified`; and
- `activationReady`.

Every artifact remains `mainnetStatus: "HOLD"`. The predecessor provider
module also keeps provider identity, key ownership, registry authenticity,
source-bound automated direct evidence, and activation claims false. Local
storage of a valid signature projection does not strengthen any of those
facts.

## Remaining production work

This prerequisite does not complete `DURABLE_REWARD_CAS` or
`EXTERNAL_CHECKPOINT_PROVIDER`. Production still requires:

1. owner-approved provider, tenant, resource, namespace, production public
   keys, registry, credential custody, rotation, revocation, and identity
   evidence;
2. independently verified provider authentication and single-copy monotonic
   append/CAS semantics;
3. an independently protected external head that cannot be rolled back with
   the local database or caller state;
4. a reviewed bridge from the exact guarded reward checkpoint into the signed
   request and from the verified response into this mirror;
5. a reviewed runtime rule that blocks reward mutation and consumption unless
   the required external/local anchor state is current;
6. multi-process locking, storage-full, permission-loss, WAL corruption,
   filesystem, backup/restore, power-loss, host-compromise, RTO, and RPO drills
   on the exact production platform and final binary;
7. exact production identities, reproducible final artifacts, and full
   adversarial Devnet evidence; and
8. independent security, operations, economic, privacy, legal, and disaster-
   recovery acceptance plus terminal authorization.

No SQLite row or result from this module is a provider credential, network
observation, externally durable checkpoint, independent rollback proof,
reward authorization, Devnet result, deployment, or Mainnet authorization.
