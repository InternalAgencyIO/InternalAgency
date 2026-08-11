# Reward materialized-projection SQLite prerequisite

Status: `HOST_ONLY_NON_ACTIVATING_ATOMIC_MATERIALIZED_LOCAL_PROJECTION`

Mainnet status: `HOLD`

This prerequisite closes one local durability gap only. A branded, Daily-Law-allowed reward consumer permit can advance one consumer cursor, append one projection event, and persist one canonical full projection state in the same file-backed SQLite `BEGIN IMMEDIATE` transaction.

## Executable boundary

The implementation is `programs/iat_b3_reference/reward-materialized-projection-sqlite.mjs`. It provides:

- a contiguous, append-only cursor chain per `consumerId`;
- an append-only projection event for every cursor revision;
- an append-only full-state chain per exact `(consumerId, projectionKind, projectionKey)` namespace;
- canonical typed-value encoding and SHA-256 commitments for every payload and record;
- one-to-one cursor/event/state validation on every open, read, snapshot, and write;
- SQLite foreign keys, exact schema-manifest validation, `WAL`, `synchronous=FULL`, defensive mode, integrity checks, immutable update/delete triggers, and conflicting-insert guards that reject `INSERT OR REPLACE` even when another connection disables recursive triggers;
- exact replay reconciliation without another write; and
- injected pre-commit fault points after the cursor insert, event insert, and state insert, plus a post-commit lost-acknowledgement point.

The factory freezes each successfully constructed adapter and records it in a
module-private `WeakSet`. The exported assertion checks membership without
reading candidate properties. Structural clones, bound-method aliases,
transparent or hostile proxies, revoked proxies, prototype lookalikes, and
accessor fakes cannot manufacture the adapter identity consumed by the
authenticated materialized runtime.

`projectionEffectAtomicityVerified: true` is narrowly scoped by the required value `projectionEffectScope: DURABLE_LOCAL_SQLITE_STATE_ONLY`. It means only that the opaque canonical projection payload, its event, and its cursor are one local SQLite commit. It never covers a payment, token transfer, queue, webhook, social action, external database, or any other effect.

## Replay and recovery

The first call for a contiguous target returns `COMMITTED`. A retry is reconciled as `RECONCILED_EXACT_REPLAY` only when the branded permit and canonical projection commitment exactly match the already durable target. A changed payload, key, kind, permit, checkpoint, target digest, or Daily-Law binding fails closed. A skipped sequence also fails closed.

Pre-commit faults roll back all three rows. A fault after `COMMIT` intentionally simulates loss of the process return: reopen validates the durable triplet and an exact retry reconciles without duplication. Historical exact retries are read-only and do not move a cursor or projection head backward.

Canonical typed payloads may contain nonempty `Buffer` or `Uint8Array` values. The typed-value codec normalizes them to bytes, and every write, read, snapshot, and replay boundary returns a detached clone. Nonempty integer-indexed views cannot be frozen by ECMAScript, so the containing records are deeply frozen while byte views remain mutable caller-owned copies; mutating one returned view cannot change the durable bytes or a later read/replay.

## Truth boundary and remaining blockers

This module is a prerequisite, not an activated runtime. In particular:

- `runtimeAuthenticationVerified` remains `false`;
- `providerAuthenticityVerified` remains `false`;
- `externalRollbackAnchorVerified` remains `false`;
- `rollbackProtectionVerified` remains `false`;
- `externalSideEffectsAuthorized` remains `false`;
- `activationReady` remains `false`; and
- `mainnetStatus` remains `HOLD`.

The separate V2 authenticated reward-runtime prerequisite now accepts only this
process-branded adapter under a distinct content-addressed binding whose
`materializedProjectionSchemaManifestSha256` exactly matches this schema. It
uses this adapter for the permit's cursor/event/state commit and exact
readback; the retained V1 runtime continues to use its original
non-materializing cursor and receipt. A newly constructed V2 runtime keeps
`materializedProjectionStateVerified` and
`projectionEffectAtomicityVerified` false because no operation has yet
committed or been read back. Only a process-issued post-readback receipt sets
those two facts true for `DURABLE_LOCAL_SQLITE_STATE_ONLY`.

This is still a static host-reference composition, not deployed runtime
integration or anti-bypass proof. The append-only SQL invariant covers DML
while the exact trigger schema remains installed: a separate connection cannot
use update, delete, or conflict-driven replacement to rewrite an existing row,
including with `recursive_triggers=OFF`. It does not defend against an actor
able to alter/drop the schema, replace the database/WAL files, or restore an
older whole-file snapshot; reopen detects schema drift but cannot independently
distinguish a self-consistent older file. An externally durable authenticated
anchor remains required, and the separate anchor and projection databases do
not share a transaction.

No provider identity, production credential, trust root, external durability, independent review, deployment, activation, or Mainnet authorization is asserted here.

## Hostile verification

Run under Node 24:

```text
node --test tests/iat-b3-reward-materialized-projection-sqlite.test.mjs
```

The suite covers process-brand clone/alias/proxy/prototype/accessor attacks,
exact commit/reopen, nonempty Buffer/Uint8Array clone isolation and replay,
state-chain advancement, exact replay idempotency, replay drift, copied
permits, skipped targets, every insert-boundary rollback, post-commit recovery,
separate-writer update/delete and `recursive_triggers=OFF` `INSERT OR REPLACE`
attacks, schema drift, Daily Law ordering, locked-law rejection, record-digest
substitution, and truth-flag substitution.
