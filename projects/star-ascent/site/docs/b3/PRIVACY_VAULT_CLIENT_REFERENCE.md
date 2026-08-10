# B3 Privacy Vault client lifecycle reference

Status: **partial host-only lifecycle shape**; no RPC, proof generation,
instruction encoding, signing, deployment, or activation. Mainnet remains
**HOLD**.

[`iat_b3_vault`](../../programs/iat_b3_vault) is an isolated `no_std` Rust
workspace library for the optional wallet-facing Privacy Vault lifecycle. It
has no Solana entrypoint or deployable artifact. The vault is not a
program-custodied asset and does not introduce a second token, wrapper, mixer,
bridge, mint, or auditor.

## Modeled reference lifecycle shape

The planner currently models the high-level admission boundary for these wallet
phases:

1. explicit opt-in confidential-account configuration;
2. public-to-confidential deposit;
3. confidential ownership transfer with locally generated equality,
   ciphertext-validity, and range proof facts;
4. recipient pending-balance application;
5. confidential-to-public withdrawal;
6. encrypted key backup and tested recovery binding.

This is not a complete Token-2022 client lifecycle. The current reference does
not model the exact configure-account proof/context instructions, initial
pending-balance counter configuration, confidential and non-confidential credit
toggle instructions, `EmptyAccount` proof flow, final token-account close, or a
durable resume/cleanup journal. Every plan therefore fixes
`lifecycle_shape_complete: false`.

Every phase requires the same canonical Token-2022 mint and an owner-bound token
account. Configuration additionally requires explicit opt-in, owner
authorization, an encrypted backup, a successful restore test, and matching
ElGamal/keystore commitments. Secret key material is never accepted by the
planner.

The runtime input fails closed unless the mint has exactly
`ConfidentialTransferMint` and `TransferHook`, confidential accounts are
auto-approved, the confidential-mint and hook authorities are null, and the
global auditor is absent. All six runtime identities must be nonzero and
distinct.

## Daily-Law boundary

The confidential ownership-transfer plan requires:

- exact law-program, law-state, and hook-validation identities matching the
  validated reference runtime;
- a finalized current day;
- an open current day;
- hook extra accounts resolved through the official transfer-hook adapter;
- exactly one hook-invoking transfer step; its `changes_owner` fact is true only
  when source and destination token-account owners differ;
- proof-context cleanup after the transfer path.

The planner validates this Daily-Law/hook binding before it reads account,
owner, amount, pending-counter, or proof facts, preserving fail-closed error
precedence.

Missing, unfinalized, locked, substituted, or manually assembled law inputs
fail closed. The confidential amount is validated against the locally
decryptable available balance but is not copied into the public plan artifact.

Token-2022 deposit, pending-balance application, and withdrawal are
account-local public/confidential balance conversions. They do not change the
owner and are disclosed as outside the Transfer Hook boundary; the planner does
not falsely claim a hook invocation for them. Withdrawal and deposit amounts
remain public cleartext, consistent with the documented privacy boundary.

## Default public-user boundary

Ordinary public IAT users never enter this lifecycle. The crate's explicit
public-overhead contract records that they require no confidential account,
proof generation, proof-context transactions, or Privacy Vault key backup.
Their ordinary ownership transfers still require the IAT-wide Daily Law hook;
this crate creates no bypass.

## Deliberate HOLD boundary

Every plan fixes these truth flags:

- `runtime_authentication_verified: false`;
- `exact_client_adapter_verified: false`;
- `durable_resume_and_cleanup_verified: false`;
- `devnet_lifecycle_verified: false`;
- `activation_ready: false`;
- `mainnet_hold: true`.

The crate validates caller-supplied reference facts; it does not authenticate
Solana accounts or bytecode. Production completion still requires exact
Token-2022/ZK client and program versions, native instruction construction,
real local proof generation, secure platform keystore integration, resumable
multi-transaction journaling, uncertain-result and proof-context cleanup,
key-loss UX, direct-client adversarial tests, complete Devnet evidence, cost and
wallet compatibility measurement, and independent cryptographic/privacy/legal
review. No plan from this crate is a Devnet or Mainnet authorization.
