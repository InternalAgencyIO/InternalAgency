# B3 Privacy Vault native Token-2022 instruction-plan prerequisite

Status: `PINNED_TOKEN_2022_ACCOUNT_LOCAL_INSTRUCTION_SUBSET_NO_SIGNING_MAINNET_HOLD`

This reference closes one narrow prerequisite in the Privacy Vault client path:
the feature-gated host crate can now turn a canonical Privacy Vault plan into an
exact, unsigned Token-2022 instruction for the account-local subset supported by
`spl-token-2022-interface = 2.1.0`. It does not claim a complete native client,
an authenticated runtime transaction, Devnet evidence, or launch readiness.

The separately versioned machine packet
`iat-b3-privacy-vault-native-instruction-plan.v1.json` binds this narrow
construction surface to exact source bytes. It does not revise or relabel the
earlier Token-2022 host-compatibility packet. In that host-only packet,
`hostChecks.instructionConstruction` remains `false`: the read-only host parser
still constructs no instruction. Construction exists only in the separate
feature-gated `native_instruction_plan` module and is certified only by the
new prerequisite packet.

## Exact covered subset

`programs/iat_b3_vault/src/native_instruction_plan.rs` constructs only these
official interface instructions:

- deposit public tokens into the same account's confidential balance;
- apply that account's pending confidential balance;
- enable or disable confidential credits; and
- enable or disable non-confidential credits.

Each construction requires a plan that passes the canonical Privacy Vault plan
codec and digest, a read-only canonical-mint capability, and a read-only
confidential-token-account capability. The adapter cross-binds the Token-2022
program, mint, token account, and wallet owner before calling the pinned official
builder. It also compares the relevant live public fields: deposited public
amount and confidential-credit permission, pending credit counter, or current
permission bit. A mismatch fails closed without returning an instruction.

`ApplyPendingBalance` additionally requires the caller-supplied
`DecryptableBalance` bytes used by the official instruction. This value remains
opaque to the planner; this prerequisite does not claim that plaintext or local
key material was authenticated.

## Explicitly absent

This module does not construct or execute account configuration, confidential
transfer, withdrawal, empty-account, close-account, proof-context, or transfer-
hook account-resolution instructions. It does not authenticate a Daily Law
account from chain data. It exposes no signer, wallet callback, RPC client, CPI,
submission, confirmation, persistence, retry, rollback, or activation method.
It cannot mutate chain state.

The plan admission layer still requires finalized/open Daily Law facts for these
account-local conversions, while also disclosing that Token-2022 does not invoke
the transfer hook for them. That structural admission check is not a production
substitute for authenticated Daily Law ingress or direct-client bypass controls.

## Verification

`programs/iat_b3_vault/tests/native_instruction_plan_spec.rs` uses account bytes
parsed by the real read-only Token-2022 host adapters. It proves byte/account
equality with the pinned official builders for deposit, apply-pending-balance,
and all four credit-permission variants. Hostile cases cover noncanonical plan
truth, account binding drift, public-balance drift, pending-counter drift,
permission drift, material mismatch, and an unsupported proof-bearing operation.

The compile-time truth record remains explicit: signing, RPC, submission, chain
mutation, runtime Daily Law authentication, hook resolution, Devnet verification,
and activation readiness are all `false`; `mainnet_hold` is `true`.

## Source-bound audit inventory

The v1 prerequisite packet and strict validator inventory exact bytes for the
workspace lockfile; the vault manifest and library export; the canonical plan
codec; the read-only Token-2022 host parser; the native instruction module; its
hostile specification test; and this reference. It also binds the separately
validated host-compatibility packet as a prerequisite. Path order, byte length,
SHA-256, dependency versions, the six supported builder variants, and every
false/HOLD truth flag are immutable packet fields.

The schema rejects extra fields. The semantic validator rejects missing,
reordered, aliased, or changed source bytes; operation-set drift; dependency or
program-identity substitution; any attempt to move instruction construction
into the host-only certification scope; and any claim of proof lifecycle,
signing, RPC, submission, chain mutation, Devnet, activation, release, or
Mainnet completion.

## Remaining production closure

The Privacy Vault client blocker remains open until one final artifact binds the
full operation lifecycle to authenticated Daily Law and stake ingress, official
proof generation and proof-context handling, official hook-account resolution,
production identities, durable recovery/journaling, signing and confirmation,
and full adversarial Devnet evidence for the exact reproducible final binaries.
Independent packet acceptance and terminal authorization remain mandatory after
that evidence. This prerequisite must not be used to sign, broadcast, deploy,
activate, seal, or spend on Mainnet.
