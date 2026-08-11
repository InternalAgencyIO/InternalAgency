# Privacy Vault journal-transition prerequisite

Status: **host-only deterministic transition replay, nonactivating**. Mainnet
remains **HOLD**.

[`journal_transition.rs`](../../programs/iat_b3_vault/src/journal_transition.rs)
composes the existing in-memory journal transition functions with the version-1
canonical journal codec. It closes one narrow gap: two journal snapshots can
each be canonical while still not be adjacent states of the same allowed
operation. This module verifies the exact transition between those snapshots.

It performs no persistence, compare-and-swap, signing, RPC, account read,
chain observation, transaction construction, proof generation, deployment, or
activation.

## Receipt construction

`prepare_journal_transition` requires:

- an existing canonical `OperationJournal`;
- the caller's exact expected before-journal digest; and
- one typed mutation: either `RecordStep` with an exact step index and
  observation, or `Recover` with an exact confirmed prefix and observed open
  proof-context count.

The constructor encodes and hashes the before snapshot, rejects a stale
expected digest, copies the journal, and invokes the existing
`record_operation_step` or `recover_operation_journal` function on that copy.
It then canonically encodes and hashes the result and replays the complete
transition verifier before returning a receipt. The caller's input journal is
never mutated, including on failure.

The receipt's fields are private to the Rust crate and expose read-only
accessors for:

- receipt version `1`;
- the typed mutation;
- exact 283-byte before and after journal frames; and
- the domain-separated SHA-256 digest of each journal frame.

Private Rust fields prevent safe external code from constructing this receipt
type directly. That is a type-construction boundary only, not a signature,
process identity, durable provenance, or authentication claim. A copied valid
receipt remains a copy of local deterministic evidence, and serialized receipt
components must be reverified rather than trusted by origin.

## Exact replay verification

`verify_journal_transition_parts` accepts untrusted component bytes and:

1. decodes both snapshots through the canonical journal decoder;
2. recomputes and compares both supplied digests;
3. rejects byte-identical or digest-identical no-op pairs;
4. copies the decoded before snapshot and invokes the exact typed lifecycle
   mutation; and
5. requires the replayed after bytes and digest to equal the supplied after
   snapshot exactly.

This binds the same operation ID, complete plan, current prefix, proof-context
count, status, mutation kind, mutation arguments, and all false/HOLD truth
fields. Stale before digests, skipped or out-of-order steps, illegal terminal
updates, inconsistent recovery prefixes, endpoint swaps, cross-operation or
cross-plan substitution, bit flips, and mutation relabeling fail closed.

`verify_journal_transition_receipt` applies that same component verifier to a
typed receipt. Receipt verification proves only deterministic lifecycle replay
between canonical local snapshots. A party able to replace all components can
construct a different self-consistent local transition by asking the public
constructor to validate its own structurally valid input state. No external
identity, chain truth, or expected durable head is established here.

## Hostile coverage

[`journal_transition_spec.rs`](../../programs/iat_b3_vault/tests/journal_transition_spec.rs)
covers confirmed, failed-before-commit, and unknown observations; unknown-result
recovery; proof-context prefix tracking and cleanup; exact codec endpoints;
input immutability; stale before digests; out-of-order, terminal, and invalid
recovery attempts; mutation relabeling; swapped and no-op endpoints; byte and
digest drift; and cross-operation and cross-plan substitution.

## Immutable truth boundary and remaining work

Only `deterministic_transition_replay_verified` is true. The receipt fixes
these facts to false while preserving `mainnet_hold: true`:

- durable persistence;
- writer confinement;
- authenticated chain observation;
- runtime integration;
- Devnet lifecycle verification; and
- activation readiness.

This prerequisite does not make a sequence durable or atomic. A separately
reviewed store must consume exact verified transitions and enforce an atomic
revision/digest compare-and-swap, append-only history, idempotent retry,
crash/reopen recovery, complete schema validation, writer confinement, and
external rollback comparison. Production completion still also requires
authenticated RPC/finality and proof-context observations, exact native
instruction and proof adapters, secure key custody and recovery UX, direct
client bypass prevention, final-binary adversarial Devnet evidence,
independent privacy/security/legal review, and terminal Mainnet authorization.
