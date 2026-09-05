# Reward waterfall audit SQLite reference

Status: **host-only, nonactivating local replay-audit prerequisite**.
Mainnet status: **HOLD**.

[`reward-waterfall-audit-sqlite.mjs`](../../programs/iat_b3_reference/reward-waterfall-audit-sqlite.mjs)
closes one narrow owner-independent gap at the `REWARD_WATERFALL_PROOFS`
boundary: a complete finalized typed round, its canonical CCC reveal value, the
exact allocator batch, and every contiguous allocator receipt can be appended
atomically to a file-backed SQLite database and independently replayed after
reopen. It is not runtime wiring and does not change the canonical release
graph.

## Exact retained facts

Each round row stores:

- the exact canonical signed-i64 funding-round decimal, including negative
  exact-midnight reference rounds;
- the finalized typed-round bytes and canonical reward-CAS state digest;
- the canonical CCC reveal bytes, including an explicit encoded `null`;
- the exact 320-byte allocator batch and transcript digest;
- the canonical reward-CAS proof-bundle digest; and
- the declared count of exact 288-byte receipt rows.

Each receipt row stores the funding round, its contiguous allocation index,
the exact receipt transcript bytes and digest, and immutable `false`/`HOLD`
flags. The proof-bundle digest and typed round codec deliberately reuse the
same exported primitives used by `reward-persistence-cas.mjs`; this adapter
does not introduce an alternate reward evidence digest.

Every open, count, and append validates the exact schema object set, SQL
definitions, SQLite integrity, foreign keys, all round and receipt flags,
receipt count and index continuity, every retained digest, and a fresh full
`validateRewardAllocatorProofBundle` recomputation. An invalid existing row
prevents all further operations.

## Append and durability boundary

The two strict `WITHOUT ROWID` tables are append-only. `BEFORE UPDATE` and
`BEFORE DELETE` triggers reject mutation, and explicit duplicate-insert
triggers reject insert-or-replace paths before SQLite can delete prior bytes.
A write uses `BEGIN IMMEDIATE`, replays all existing history, inserts one round
and all its receipts, replays the database again inside the transaction, then
commits.

The database requires SQLite defensive mode, WAL mode, `synchronous=FULL`,
foreign keys, recursive triggers, trusted-schema off, disabled extension
loading, and exact active pragma verification. The hostile verification
commands pin Node 25.5.0 because its `node:sqlite` API exposes defensive mode.
The repository workflow currently selects the rolling Node 24 major; the
locally resolved `24.19.0` also exposes defensive mode and passes the focused
suite, while older `24.4.0` fails closed at adapter construction instead of
silently weakening the requirement. CI integration must keep a reviewed Node
24 point release with defensive mode or pin an equivalent reviewed runtime
before this slice can enter the canonical suite. This local setting is still
not a hostile-host or production security boundary.

The focused test suite covers:

- clean close/reopen with both nonempty and zero-receipt rounds;
- signed negative, zero, and nearest in-range i64-boundary UTC rounds plus
  direct rejection of noncanonical signed-decimal SQL keys;
- corrupt, reordered, sparse, accessor-backed, symbol, and extra-key inputs;
- transaction faults after the round row, after the first receipt, and just
  before commit, each recovering zero rows;
- abrupt child-process exit after the first receipt, recovering zero rows;
- reported failure and abrupt exit immediately after durable commit, each
  recovering exactly one complete round;
- writer lock contention with no partial rows;
- direct update, delete, replace, schema, coverage, and flag tampering; and
- restoration of an older internally valid whole database.

Canonical test reachability is fail-closed without editing the concurrently
owned package manifest: the existing `check:iat-b3-spec` command runs
`iat-b3-reward-guarded-source-inventory.test.mjs`, and that guarded entry point
imports this complete functional suite. A wiring test requires exactly one
literal import, a readable target suite, and exactly one guarded-entrypoint
reference in the package command. Removing either edge therefore fails the
canonical check instead of silently dropping the durability adversaries.

The database file and any live WAL/SHM sidecars are one persistence unit and
must not be copied independently while open. WAL plus FULL synchronization is
a local SQLite crash boundary, not an independent monotonic authority.

## Exact positive result

A successful append result asserts only
`durableLocalReplayAuditVerified: true`: at that operation boundary, the exact
typed round and complete proof set were committed locally and survived the
tested replay checks. The adapter, its rows, and every result keep:

- `runtimeAuthenticationVerified: false`;
- `rollbackProtectionVerified: false`;
- `activationReady: false`; and
- `mainnetStatus: "HOLD"`.

No stored byte authenticates obligation source, chronology, Daily Law,
round-clock completeness, randomness provenance, provider identity, a signer,
an RPC response, a deployed program, or a production binary. The accepted
Daily-Law object used by the pure allocator is not stored or reauthenticated by
this adapter.

## Whole-unit rollback limit

Restoring an older internally valid database file reopens successfully. A
separately retained newer append result can show that this local copy is older,
but the adapter itself has no trusted external head. If an attacker rolls back
the database, its sidecars, and the caller's evidence together, local replay
cannot distinguish that unit from its original history. Consequently
`rollbackProtectionVerified` remains false.

## Remaining blockers

This prerequisite does not complete `REWARD_WATERFALL_PROOFS` or
`DURABLE_REWARD_CAS`. Production still requires, in dependency order:

1. authenticated source-kind, chronology, round-clock/completeness, CCC
   registry/randomness, and Daily-Law provenance;
2. source-bound production account/instruction layout evidence and a native
   atomic bridge
   that cannot bypass the allocator or its complete proof set;
3. the durable CAS chain, consumer gate, and independently protected external
   monotonic head on exact production identities;
4. provider credentials, key ownership, rotation/revocation, RPC and failure
   drills, and accepted source-bound automated direct-evidence packets;
5. reproducible final binaries and full adversarial Devnet evidence; and
6. terminal authorization with a zero-blocker, zero-violation release graph.

This file is documentation for a local reference prerequisite only. It is not
a release packet, external-provider observation, automated evidence receipt,
Devnet result, deployment record, or Mainnet authorization.
