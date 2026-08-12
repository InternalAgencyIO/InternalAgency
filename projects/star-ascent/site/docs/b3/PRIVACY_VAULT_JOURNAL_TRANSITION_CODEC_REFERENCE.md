# Privacy Vault journal-transition transport codec

Status: **host-only canonical transition transport, nonactivating**. Mainnet
remains **HOLD**.

[`journal_transition_codec.rs`](../../programs/iat_b3_vault/src/journal_transition_codec.rs)
adds one fixed-size version-1 transport frame for the reviewed private
`JournalTransitionReceipt`. It does not create an alternate receipt path:
decoding must recreate the receipt through `prepare_journal_transition` and
then match every supplied component exactly.

The codec performs no persistence, compare-and-swap, signing, RPC, account
read, chain observation, transaction construction, proof generation, runtime
integration, deployment, or activation.

## Exact 650-byte frame

The complete record is exactly 650 bytes:

| Offset | Bytes | Meaning |
| --- | ---: | --- |
| 0 | 8 | ASCII `IATB3JTR` |
| 8 | 1 | transport-codec version `1` |
| 9 | 1 | record kind `1` |
| 10 | 2 | reserved canonical zero |
| 12 | 4 | unsigned big-endian payload length `634` |
| 16 | 1 | transition-receipt version `1` |
| 17 | 1 | mutation kind: record step `1`, recover `2` |
| 18 | 1 | mutation argument 0 |
| 19 | 1 | mutation argument 1 |
| 20 | 32 | before-journal domain-separated SHA-256 digest |
| 52 | 283 | exact canonical before-journal frame |
| 335 | 32 | after-journal domain-separated SHA-256 digest |
| 367 | 283 | exact canonical after-journal frame |

For mutation kind `1`, argument 0 is the step index and argument 1 is the
observation discriminant: confirmed `1`, failed before commit `2`, or result
unknown `3`. For mutation kind `2`, argument 0 is the confirmed step count and
argument 1 is the observed open proof-context count. Recovery arguments are
not opaque metadata; the transition constructor replays and validates them.

Encoders first reverify the private receipt. Decoders require the exact frame
length, magic, versions, record kind, zero reserved bytes, big-endian payload
length, mutation kind, and observation discriminant. Short input, appended
bytes, aliases, and unknown values fail closed.

## Constructor-only decode boundary

After parsing, the decoder:

1. decodes the supplied before-journal bytes with the canonical journal codec;
2. calls `prepare_journal_transition` with that journal, the supplied before
   digest, and the exact typed mutation;
3. lets the reviewed transition constructor replay the existing lifecycle
   mutation on a copy and create the private receipt; and
4. requires the recreated receipt version, mutation, both digests, and both
   283-byte endpoint frames to equal the supplied transport components.

The codec never constructs `JournalTransitionReceipt` fields directly and
does not implement a second lifecycle transition model. This means a valid but
nonadjacent after snapshot, step skip, relabeled observation, changed recovery
argument, cross-operation endpoint, cross-plan endpoint, swapped endpoint, or
endpoint/digest bit flip cannot decode merely because each endpoint is
individually canonical.

The transport has no separate signature or authentication tag. Its embedded
digests provide the existing deterministic endpoint content binding, while
constructor replay binds adjacency and mutation semantics. A party able to
replace the complete frame can supply a different self-consistent local
transition. The codec does not establish origin, process identity, expected
durable head, external time, chain truth, or authorization.

## Hostile coverage

[`journal_transition_codec_spec.rs`](../../programs/iat_b3_vault/tests/journal_transition_codec_spec.rs)
covers exact offsets and lengths; deterministic encode/decode/encode; all three
step observations; recovery prefix/context arguments; short and appended
input; magic, version, kind, reserved, and payload-length drift; receipt,
mutation, and observation aliases; before/after byte and digest drift; mutation
relabeling; cross-operation endpoint substitution; and a separately valid
nonadjacent after snapshot.

## Immutable truth boundary and remaining work

Decoded receipts retain only the reviewed
`deterministic_transition_replay_verified: true` local fact. Durable
persistence, writer confinement, authenticated chain observation, runtime
integration, Devnet lifecycle verification, and activation readiness remain
false, while `mainnet_hold` remains true.

Canonical transport does not make a transition durable or atomic. A separately
reviewed store must consume these exact bytes and enforce revision/digest CAS,
append-only history, idempotent retry, crash/reopen recovery, complete schema
validation, writer confinement, and external rollback comparison. Production
completion still requires authenticated RPC/finality and proof-context
observations, exact native instruction and proof adapters, secure key custody
and recovery UX, direct-client bypass prevention, final-binary adversarial
Devnet evidence, independent privacy/security/legal review, and terminal
Mainnet authorization.
