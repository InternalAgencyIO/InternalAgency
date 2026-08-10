# B3 Privacy Vault client lifecycle reference

Status: **documented host-only lifecycle shape covered, nonactivating**; no
RPC, proof generation, instruction encoding, signing, deployment, or
activation. Mainnet remains **HOLD**.

[`iat_b3_vault`](../../programs/iat_b3_vault) is an isolated `no_std` Rust
workspace library for the optional wallet-facing Privacy Vault lifecycle. It
has no Solana entrypoint or deployable artifact. The vault is not a
program-custodied asset and does not introduce a second token, wrapper, mixer,
bridge, mint, or auditor.

## Modeled reference lifecycle shape

The planner represents these documented wallet phases:

1. confidential-extension reallocation;
2. locally generated and structurally verified ElGamal pubkey-validity proof
   context;
3. explicit opt-in confidential-account configuration with a nonzero maximum
   pending-balance credit counter;
4. pubkey-validity proof-context cleanup;
5. public-to-confidential deposit;
6. confidential ownership transfer with locally generated equality,
   ciphertext-validity, and range proof facts;
7. recipient pending-balance application with exact observed/expected counter
   equality;
8. enable/disable instructions for confidential credits;
9. enable/disable instructions for non-confidential credits;
10. confidential-to-public withdrawal and proof-context cleanup;
11. zero-balance `EmptyAccount` proof flow, proof-context cleanup, and final
    token-account close;
12. encrypted key backup and tested recovery binding;
13. an in-memory operation journal for confirmed, failed-before-commit, and
    unknown-result observations, deterministic recovery replay, and explicit
    proof-context cleanup plans.

`documented_lifecycle_shape_covered: true` means only that these reference
shapes are represented. It does not mean the instructions are encoded, the
proofs or observations are authenticated, the journal is durable, or any phase
has executed on Solana.

Every phase requires the same canonical Token-2022 mint and an owner-bound token
account. Configuration additionally requires explicit opt-in, owner
authorization, an encrypted backup, a successful restore test, matching
ElGamal/keystore commitments, and a locally generated pubkey-validity proof
context structurally bound to the account, mint, key, and owner. Secret key
material is never accepted by the planner.

The runtime input fails closed unless the mint has exactly
`ConfidentialTransferMint` and `TransferHook`, confidential accounts are
auto-approved, the confidential-mint and hook authorities are null, and the
global auditor is absent. All six runtime identities must be nonzero and
distinct.

## Daily-Law-first planning boundary

Every function that plans a chain write validates the supplied Daily-Law facts
before it reads account, owner, amount, counter, proof, journal, or recovery
facts. It requires exact law-program, law-state, and hook-validation identities,
a finalized current day, and an open current day. The confidential
ownership-transfer plan additionally requires:

- hook extra accounts resolved through the official transfer-hook adapter;
- exactly one hook-invoking transfer step; its `changes_owner` fact is true only
  when source and destination token-account owners differ;
- proof-context cleanup after the transfer path.

Missing, unfinalized, locked, substituted, or manually assembled law inputs
fail closed. The confidential amount is validated against the locally
decryptable available balance but is not copied into the public plan artifact.

Token-2022 configure, deposit, pending-balance application, credit toggles,
withdrawal, emptying, and account close are account-local operations. They do
not change the owner and do not themselves invoke the Transfer Hook. Their
plans disclose that boundary and do not falsely claim hook execution. The
Daily-Law check here is only a host-planner admission rule: without a reviewed
native adapter and an enforcement mechanism against direct Token-2022 clients,
it cannot prove an IAT-wide on-chain bypass is impossible. Withdrawal and
deposit amounts remain public cleartext, consistent with the documented privacy
boundary.

## Cleanup and recovery journal

The journal binds a nonzero local operation ID to the complete structural plan,
including its ordered steps, public cleartext amounts, requested permission,
lifecycle truth flags, expected pending counter, opaque proof-context
commitment, source, destination, and mint. It rejects
zero/oversized/internally inconsistent plan shapes,
same-identity plan substitution, and out-of-order steps; counts opened proof
contexts; marks failed/unknown results; and can replay a caller-supplied
confirmed prefix. A cleanup plan closes proof contexts that the journal still
records as open. Confidential amounts are not stored in the plan; the opaque
commitment only distinguishes the caller-supplied proof context and is not
proof that the context cryptographically binds a particular amount.

This state is an in-memory deterministic model only. It deliberately fixes
`authenticated_chain_observation_verified: false`,
`durable_persistence_verified: false`, `activation_ready: false`, and
`mainnet_hold: true`. A fabricated, stale, rolled-back, or incorrectly observed
confirmed prefix can satisfy structural input checks. The model provides no
RPC finality, fork choice, transaction-signature authentication, durable CAS,
or crash-safe persistence.

## Default public-user boundary

Ordinary public IAT users never enter this lifecycle. The crate's explicit
public-overhead contract records that they require no confidential account,
proof generation, proof-context transactions, or Privacy Vault key backup.
Their ordinary ownership transfers still require the IAT-wide Daily Law hook;
this crate creates no bypass.

## Deliberate HOLD boundary

Every plan fixes these truth flags:

- `planner_daily_law_gate_passed: true`;
- `direct_client_bypass_prevention_verified: false`;
- `runtime_authentication_verified: false`;
- `exact_client_adapter_verified: false`;
- `durable_resume_and_cleanup_verified: false`;
- `devnet_lifecycle_verified: false`;
- `activation_ready: false`;
- `mainnet_hold: true`.

The crate validates caller-supplied reference facts; it does not authenticate
Solana accounts or bytecode. Production completion still requires pinned
Token-2022/ZK client and program versions; authenticated account owner, address,
data, and program-bytecode reads; native instruction construction; real local
proof generation and verification; secure platform keystore integration;
durable atomic journal persistence; RPC-finality/fork-aware uncertain-result
recovery; authenticated proof-context discovery and cleanup; key-loss UX;
enforcement against direct-client bypasses; adversarial tests; complete Devnet
evidence; cost and wallet-compatibility measurement; and independent
cryptographic, privacy, security, and legal review. No plan from this crate is a
Devnet or Mainnet authorization.
