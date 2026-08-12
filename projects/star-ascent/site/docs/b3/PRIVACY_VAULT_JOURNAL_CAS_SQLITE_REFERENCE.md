# Privacy Vault verified-transition journal CAS prerequisite

Status: **host-only local SQLite transition CAS, nonactivating**. Mainnet
remains **HOLD**.

This prerequisite composes two new, isolated host components:

- [`iat_b3_vault_journal_transition_verifier.rs`](../../programs/iat_b3_vault/src/bin/iat_b3_vault_journal_transition_verifier.rs),
  a bounded Rust executable over the already reviewed transition codec; and
- [`privacy-vault-journal-cas-sqlite.mjs`](../../programs/iat_b3_reference/privacy-vault-journal-cas-sqlite.mjs),
  a file-backed Node 24 SQLite compare-and-swap consumer.

The SQLite module does not parse the journal plan, journal state, mutation, or
Rust transition format and does not implement another lifecycle model. Every
incoming and stored 650-byte transition frame must first be accepted by the
exact Rust decoder/replayer.

## Fixed verifier process boundary

The Rust verifier accepts no arguments and reads at most 651 input bytes. It
requires exactly one canonical 650-byte transition transport frame, decodes it
through `decode_journal_transition_receipt`, re-encodes it byte-exactly, and
writes one fixed 730-byte binary response:

| Offset | Bytes | Meaning |
| --- | ---: | --- |
| 0 | 8 | ASCII `IATB3JVR` |
| 8 | 1 | response protocol version `1` |
| 9 | 1 | accepted-transition result kind `1` |
| 10 | 2 | reserved canonical zero |
| 12 | 4 | unsigned big-endian payload length `714` |
| 16 | 650 | exact canonical input-frame echo |
| 666 | 32 | before-journal digest returned by the private receipt |
| 698 | 32 | after-journal digest returned by the private receipt |

Invalid length, codec, mutation, lifecycle replay, or canonical re-encoding
exits nonzero without a response. There is no signing, private key, network,
RPC, account read, proof generation, persistence, or activation path in the
verifier.

The SQLite factory requires an explicit launch executable path and SHA-256,
exact argv array, exact working directory, exact environment object, bounded
timeout, verifier-artifact path and SHA-256, and the exact argv element used to
name that artifact when execution is indirect. It rejects final or parent path
aliases, symlinks, non-regular or oversized files, duplicate environment keys,
unknown fields, NULs, and hash/stat drift. It rechecks the executable,
artifact, and working directory immediately before and after every synchronous
spawn. Spawning uses an argv array with `shell: false`; frame input is exactly
650 bytes and stdout/stderr are capped at 4096 bytes. A successful response
must be exactly 730 bytes and echo the supplied frame byte-for-byte.

These checks bind the configured local launch recipe but do not authenticate
who selected the executable/hash, the operating system or launcher, a path
mapping across environments, or an undetectable race that replaces and
restores bytes during execution. Accordingly
`verifierIdentityAuthenticated`,
`verifierLaunchEnvironmentAuthenticated`,
`verifierArtifactPathMappingAuthenticated`, and
`verifierPathRaceConfinementVerified` remain false. The Windows-focused test
uses an exact SHA-bound `wsl.exe --exec <Linux verifier>` argv recipe because
the available Node 24 SQLite runtime is Windows while pinned Rust is Linux;
that test bridge is not a production runtime claim.

## Local SQLite CAS

Creation requires an absolute file-backed database path and an explicit
nonzero expected genesis-journal digest. The adapter stores an immutable meta
row and an ordered transition history. It derives the current head rather than
maintaining a separately mutable cursor.

Each committed row binds:

- canonical u64 big-endian and decimal revision forms;
- exact before and after journal digests from the verifier;
- the exact 650-byte frame and its SHA-256;
- the prior transition-frame SHA-256;
- the complete verifier-launch binding digest; and
- a domain-separated record digest.

Every snapshot enumerates the complete dedicated schema, runs SQLite integrity
and foreign-key checks, requires contiguous revisions, verifies the frame and
record hash chains from the supplied genesis digest, and invokes the configured
Rust verifier again for every stored frame. Truth/HOLD columns are exact SQL
constraints and are revalidated on every read.

`commitTransition` detaches caller bytes, verifies the frame before entering
SQLite, then uses `BEGIN IMMEDIATE` to reload and verify the exact current
history. A new row requires exact expected revision, expected head digest,
receipt before digest, next revision, and a distinct after digest. The adapter
inserts one row, performs full staged verification inside the transaction,
commits, and performs a fresh transactional readback. Two adapters cannot both
advance one head.

A lost response reconciles only if the exact byte-identical frame is already
the current head, its prior revision/head match the caller's original CAS, and
all digests match. Earlier replay, stale revision, skip, competing fork,
nonadjacent frame, no-op, or same-hash/different-byte substitution remains
HOLD. A bounded exception-only test seam covers rollback after insert and lost
response after commit; the deployable modules expose no process-exit, abort,
kill, or hard-exit primitive.

SQLite uses defensive mode, extensions disabled, double-quoted literals and
bare/unknown parameters disabled, foreign keys and recursive triggers enabled,
trusted schema disabled, WAL, and `synchronous=FULL`. Tables are STRICT and
WITHOUT ROWID. Adapter-issued updates/deletes are absent and immutable triggers
reject ordinary mutation.

## Hostile coverage

[`iat-b3-privacy-vault-journal-cas-sqlite.test.mjs`](../../tests/iat-b3-privacy-vault-journal-cas-sqlite.test.mjs)
builds the exact Rust verifier and uses independently assembled test-only
canonical frames. It covers a three-transition chain, commit/reopen, rollback
before staged readback, lost-response reconciliation, stale/skip/fork/no-op and
malformed frames, competing adapters, schema drift, wrong executable/artifact
hashes, launch-binding drift, process-brand clones, and post-bind artifact
mutation. Accessor-backed or otherwise non-data `argv` entries fail before any
launch binding or database open.

The hostile suite also uses a separate SQLite writer with
`recursive_triggers=OFF` and `INSERT OR REPLACE` to bypass ordinary immutable
triggers. The next adapter snapshot detects the corrupt frame/hash before
returning state. Because a separately authorized writer can still replace an
entire coherent database or history, `externalWriterConfinementVerified` and
`externalRollbackProtectionVerified` remain false.

## Immutable truth boundary and remaining work

Only local, tested facts are true:

- exact configured-verifier replay is required for every incoming/stored frame;
- transition append and head advancement occur in one local SQLite transaction;
- exact CAS/retry reconciliation is enforced; and
- local SQLite close/reopen readback has been exercised.

No verifier/provider identity, external writer confinement, external rollback
protection, authenticated chain observation, provider authentication, runtime
integration, privacy/legal acceptance, Devnet lifecycle, activation readiness,
or Mainnet authorization is established. Those facts remain false and Mainnet
remains **HOLD**.

Production completion still requires a reviewed native binding to an exact
reproducible verifier binary, authenticated RPC/finality and proof-context
observations, secure key custody and recovery UX, external rollback anchoring,
direct-client bypass prevention, final-binary adversarial Devnet evidence,
independent privacy/security/legal review, and terminal authorization.
