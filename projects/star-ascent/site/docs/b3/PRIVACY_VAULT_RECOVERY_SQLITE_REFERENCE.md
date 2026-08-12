# B3 Privacy Vault recovery SQLite prerequisite

Status: **host-only durable local mirror, nonactivating**. This prerequisite
does not create a Privacy Vault client, authenticate Solana, protect against a
whole-database rollback, or authorize Devnet or Mainnet. Mainnet remains
**HOLD**.

[`privacy-vault-recovery-sqlite.mjs`](../../programs/iat_b3_reference/privacy-vault-recovery-sqlite.mjs)
stores the encrypted recovery bundle and its local recovery-state cursor in a
dedicated file-backed SQLite database. It consumes the cryptographic lifecycle
from
[`privacy-vault-recovery-lifecycle.mjs`](../../programs/iat_b3_reference/privacy-vault-recovery-lifecycle.mjs)
without changing that module or promoting any of its false truth flags.

## Process-private admission boundary

`commitVerifiedBundle` first requires the exact verification-receipt object
issued by `verifyPrivacyVaultRecoveryBundle` in the same JavaScript process.
The lifecycle validator uses a module-private `WeakSet`; a spread clone,
lookalike, accessor object, bound alias, transparent proxy, hostile proxy, or
receipt reconstructed from durable JSON is not accepted. The adapter then
requires the exact canonical bundle, receipt, current state, vault binding,
recovery-key commitment, epoch, predecessor bundle, prior key-material
commitment, policy, and state transition to agree.

The database record saying that this adapter boundary accepted a process-
private receipt is not a durable signature or an external attestation. A
separate process with write access to the SQLite file is outside this
process-private boundary. The schema blocks ordinary updates, deletes, and
conflicting `INSERT OR REPLACE`, and reopen validation detects inconsistent
history, but it cannot prove that an attacker able to rewrite and rehash an
entire internally consistent database did not do so. Therefore
`externalWriterConfinementVerified` remains `false`.

## Exact append-only database

The dedicated database has exactly three application tables and nine triggers:

1. `privacy_vault_recovery_meta` binds the exact Genesis state, schema
   manifest, vault, recovery-key commitment, and lifecycle age/skew policy;
2. `privacy_vault_recovery_bundle_records` appends one canonical encrypted
   bundle and its process-issued verification-receipt digest per epoch;
3. `privacy_vault_recovery_cursor_history` appends the corresponding local
   cursor and binds the preceding cursor.

No mutable head row exists. The newest validated cursor-history row is the
local head. Epochs and cursor revisions are stored as both canonical decimal
text and unsigned eight-byte big-endian BLOBs; reopen checks the two encodings
are exactly equal. Every bundle and cursor record has a domain-separated
SHA-256 digest. The bundle JSON and state-after JSON are stored in the exact
canonical byte order already accepted by their lifecycle validators.

Every application table has `BEFORE UPDATE`, `BEFORE DELETE`, and conflicting
`BEFORE INSERT` triggers. The explicit conflicting-insert trigger prevents
`INSERT OR REPLACE` from using delete-and-reinsert behavior even when a
separate connection disables `recursive_triggers`. On every open, snapshot,
comparison, and commit, the adapter requires:

- the complete user-schema object set and exact normalized SQL;
- the exact schema-manifest digest;
- `PRAGMA integrity_check = ok` and an empty `foreign_key_check`;
- the exact Genesis and metadata row;
- contiguous bundle and cursor histories;
- exact canonical u64 text/BLOB equality;
- exact bundle, predecessor, state-before, state-after, vault, recovery-key,
  prior key-material, and policy-lifetime binding;
- exact record and cursor digest recomputation.

The Node 24 database connection requires defensive mode, disabled extension
loading, disabled double-quoted string literals, exact named-parameter
handling, foreign keys, recursive triggers, an untrusted schema, WAL mode, and
`synchronous = FULL`.

## Atomic commit and uncertain result

For a new epoch the adapter takes a `BEGIN IMMEDIATE` transaction, revalidates
the complete prior snapshot, inserts the bundle record, inserts its cursor,
and revalidates the exact staged full history before `COMMIT`. A fault after
either insert rolls the transaction back, leaving neither row durable.

A test-only fault after `COMMIT` models a lost response. Reopen observes the
one committed bundle/cursor pair, and the same freshly process-verified bundle
reconciles as `RECONCILED_EXACT_REPLAY`; it does not append a duplicate. A
different digest at the same or an older epoch, or a skipped epoch, remains a
fail-closed replay/fork HOLD. The deployable adapter exports no host-exit or
process-kill path, and the two hard-exit selector strings are rejected even
when the caller supplies an otherwise valid process-issued receipt. For crash
testing only, the focused test materializes a transient copy of the exact
adapter source, inserts a blocking observation marker at an exact transaction
phase, observes that marker from the parent, and externally terminates the
child. Termination after the first insert and after durable commit reopens
respectively empty or complete, never torn. The transient instrumented copy is
not a runtime or packaged artifact.

This is local SQLite transaction atomicity only. It does not make the encrypted
bundle, Solana transaction, proof context, external backup, or any other
database part of the same transaction.

## Rollback comparison is not rollback proof

`compareSuppliedState` compares the locally validated state with a caller-
supplied, structurally valid state under the same vault, recovery-key
commitment, and policy. It can report `EXACT`, `LOCAL_AHEAD`, `LOCAL_BEHIND`, or
`SAME_EPOCH_FORK`. `LOCAL_BEHIND` and `SAME_EPOCH_FORK` are exact comparison
facts only.

The supplied state has no authenticated source in this prerequisite. It may be
fabricated, stale, or controlled by the same failure domain as the database.
Accordingly the comparison fixes all of these to `false`:

- `suppliedStateAuthenticityVerified`;
- `externalRollbackProtectionVerified`;
- `externalWriterConfinementVerified`.

A higher state supplied from an independently authenticated monotonic service
could be useful to a later integration, but that service, trust root, runtime,
and evidence are not invented here.

## Secret and privacy boundary

The SQLite API never accepts a recovery key or recovered ElGamal/key-material
plaintext. It stores the already encrypted bundle, public commitments,
canonical state, and verification-receipt digest. The focused suite checks that
the input recovery key and opaque key material do not appear in its snapshot or
database bytes.

This narrow fact does not certify secure memory erasure, wallet-signature key
derivation, Token-2022 ElGamal key validity, platform-keystore custody, backup
custody, retention compliance, false-zero UI prevention, or privacy/legal
acceptance.

## Immutable HOLD boundary

The adapter, snapshots, commit results, bundle records, cursor records, and
state comparisons keep these facts false:

- external writer confinement;
- supplied-state authenticity;
- external rollback protection;
- secure platform keystore integration;
- authenticated chain observation;
- on-chain runtime integration;
- privacy/legal review acceptance;
- Devnet lifecycle verification;
- activation readiness.

Only the narrowly scoped local capabilities are true: the adapter requires a
process-private verification receipt for its own commit method, stores the
bundle and cursor in one SQLite transaction, and validates that local history
after reopen. It does not alter the existing lifecycle receipt, whose generic
`durablePersistenceVerified` remains `false`.

Production completion still requires the exact native Token-2022 client and
proof implementation, authenticated RPC/finality and uncertain-result
observation, secure wallet/keystore integration, independent rollback anchor,
backup/restore and key-loss drills, enforcement against direct-client bypass,
complete final-binary Devnet evidence, and independent cryptographic, privacy,
security, and legal review. Mainnet status remains `HOLD`.
