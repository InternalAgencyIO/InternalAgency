# Privacy Vault operation-journal codec prerequisite

Status: **host-only canonical bytes and content digest, nonactivating**.
Mainnet remains **HOLD**.

[`journal_codec.rs`](../../programs/iat_b3_vault/src/journal_codec.rs)
adds a fixed-size version-1 codec for the existing
`PrivacyOperationPlan` and `OperationJournal` types. It does not change the
planner, journal transition functions, or any native instruction behavior.
It performs no persistence, signing, key handling, RPC, account reads, chain
observation, deployment, or activation.

## Exact frames

Both records begin with the same 16-byte header:

| Offset | Bytes | Meaning |
| --- | ---: | --- |
| 0 | 8 | ASCII `IATB3PJC` |
| 8 | 1 | codec version `1` |
| 9 | 1 | record kind: plan `1`, journal `2` |
| 10 | 2 | reserved canonical zero |
| 12 | 4 | unsigned big-endian payload length |

The complete plan record is exactly 236 bytes: the 16-byte header and a
220-byte payload. The payload includes every plan field and all four step
slots. Discriminants and booleans are one byte, every `u64` is eight-byte
big-endian, keys/digests are 32 raw bytes, and options use an explicit one-byte
tag followed by their fixed-size value. A `None` option requires a zero value,
and every inactive step must equal the all-zero canonical `None` step.

The complete journal record is exactly 283 bytes: the 16-byte header and a
267-byte payload. It contains the positive big-endian operation ID, the exact
220-byte bound-plan payload, that plan frame's domain-separated SHA-256
digest, the next-step and proof-context counters, the journal-status
discriminant, and the four immutable journal truth booleans.

Decoders require the exact record length. Short input, appended bytes, wrong
magic, unsupported version, cross-kind input, nonzero reserved bytes, wrong
payload length, unknown discriminants, noncanonical booleans/options/unused
steps, zero journal IDs, invalid plan semantics, and impossible journal states
fail closed.

## Semantic binding

Plan encode and decode call the existing private planner-shape validator and
add only the inactive-step canonical-zero rule. They preserve all existing
false/HOLD fields. The journal codec additionally requires:

- the bound plan to remain valid and byte-canonical;
- the operation ID to be nonzero;
- the next-step index not to exceed the plan;
- open proof contexts to equal the result of the exact confirmed step prefix;
- status, prefix, and open-context state to be mutually consistent; and
- authenticated observation, durable persistence, and activation to remain
  false while `mainnet_hold` remains true.

Embedding the exact plan digest means a plan-payload substitution without the
matching digest is rejected. This is deterministic content binding, not
authentication: a party able to replace both bytes and digest can construct a
different self-consistent record. A trusted persistence/authentication layer
must bind the expected journal digest separately.

## Digests

The codec uses SHA-256 without adding a crate dependency. Digests cover the
complete framed bytes after these exact ASCII domain strings and one zero
separator byte:

- `IAT_B3_PRIVACY_OPERATION_PLAN_CODEC_DIGEST_V1`;
- `IAT_B3_OPERATION_JOURNAL_CODEC_DIGEST_V1`.

The implementation is checked against the FIPS SHA-256 `abc` vector. The
integration test also freezes plan and journal golden digests independently
reproduced with Node's cryptographic SHA-256 implementation.

## Hostile coverage

[`journal_codec_spec.rs`](../../programs/iat_b3_vault/tests/journal_codec_spec.rs)
covers all nine operation discriminants, all step kinds (including both values
of both credit-permission toggles), all visibility values, initial and terminal
journals, recovery/cleanup/abort states, round trips, exact lengths, trailing
bytes, header drift, little-endian aliases, zero/reserved aliases, malformed
booleans/options/discriminants, inactive-step contamination, truth promotion,
impossible counters/statuses, plan-digest bit flips, and cross-plan payload
substitution.

## Immutable truth boundary and remaining work

Canonical bytes and matching digests do not establish durable persistence,
writer confinement, crash recovery, external rollback protection, provider or
chain authentication, native runtime integration, finality, Devnet evidence,
privacy/security/legal acceptance, activation readiness, or Mainnet
authorization. Those facts remain false or **HOLD**.

`PRIVACY_VAULT_CLIENT` still requires a separately reviewed durable operation
journal store, authenticated account/program/finality observations, exact
native instruction and proof adapters, secure key custody and recovery UX,
uncertain-result reconciliation, proof-context cleanup, bypass prevention,
final-binary adversarial Devnet evidence, source-bound automated direct
evidence, and terminal authorization.
