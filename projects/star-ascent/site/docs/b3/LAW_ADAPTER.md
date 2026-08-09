# B3 native IAT Daily Law adapter

Status: **SBF + DISPOSABLE LOCAL-VALIDATOR REHEARSED / DEVNET HOLD**

Implementation: `programs/iat_b3_law`

The adapter is a small native Solana program around the framework-neutral
`iat_b3_consensus` kernel. It implements the standard Token-2022 Transfer Hook
`Execute` instruction and a permissionless `finalize_day` instruction. It is
separate from the V2 Anchor program so the mandatory transfer path does not
inherit the complete V2 monolith's binary size or dependencies.

## Pinned compatibility surface

| Component | Pinned source version |
| --- | --- |
| Agave/Solana build toolchain | `3.1.10` in public CI |
| Rust | `1.97.1` in public CI |
| Token-2022 interface | `2.1.0` |
| Transfer Hook interface | `2.1.0` |
| TLV account resolution | `0.11.1` |
| Solana sysvar API | `3.1.1` |
| Solana Clock type | `3.2.0` |

The canonical Token-2022 program address remains
`TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb`. Interface compatibility is not
yet a claim that the exact Mainnet program configuration has passed Gate 1.

## Accounts and initialization

Initialization is a one-time mint-authority operation. It verifies that:

- the mint is owned by Token-2022;
- the mint is initialized with nine decimals and exactly
  `1,000,000,000,000,000,000` base units;
- mint and freeze authorities are already revoked;
- the mint contains exactly the Transfer Hook and Confidential Transfer mint
  extensions and no other Token-2022 extension;
- the configured hook program is the running adapter;
- the signer is the current authority for both required extensions;
- confidential accounts are auto-approved and the global auditor key is null;
- the mint is writable and the supplied executable program account is the
  canonical Token-2022 program;
- the network genesis identity is nonzero;
- the law-state and standard `extra-account-metas` addresses are the exact PDAs.

The adapter now obtains the complete decoded extension-type list from the pinned
Token-2022 interface and accepts only `ConfidentialTransferMint` plus
`TransferHook`. Permanent Delegate, confidential/permissioned mint-burn, Mint
Close Authority, Pausable, transfer-fee configuration, metadata-pointer, and
every other extra extension fail with `UnapprovedMintExtension`. Focused host
tests cover both required-order permutations, missing required state, the named
authority-bearing variants, and representative other extras. A rebuilt SBF and
local-validator/Devnet adversarial mint proof remain required before this can be
treated as deployment evidence.

In the same instruction, the adapter CPIs to Token-2022 to set both the Transfer
Hook program-ID authority and Confidential Transfer mint authority to null. It
reloads the mint and requires both authorities to be null, the confidential
configuration to remain exact, and the hook program ID to remain this law
program before creating the two rent-bearing accounts. Any CPI, reload, or PDA
failure rolls the whole instruction back, so there is no initialized-law window
with a mutable hook or confidential policy.

It creates only two rent-bearing accounts:

1. `law-state` PDA: 160 bytes, bound to program ID and canonical mint;
2. standard Transfer Hook extra-account-meta PDA, containing one read-only
   mint-derived reference to the law-state PDA.

There is no administrator, threshold, timezone, result, or bypass update
instruction. The loader upgrade authority must still be finalized before this
instruction, as required by the rehearsal sequence.

### Stake-ingress anti-donation boundary (unwired)

The test-only native Rust reference at
`programs/iat_b3_law/tests/stake_ingress_reference.rs` contains a separate
176-byte, versioned `StakeIngressBinding` codec and pure enforcement kernel. It
canonically derives the economic config, stake-token vault, and dedicated
`stake-ingress` authority PDA from one economy program ID and mint. The config
seed is the exact retained V2/B3 `PDA(economy, ["config", mint])` seed, not a new
alias. Packing and decoding recompute every address and bump; zero identities,
forged addresses, nonzero reserved bytes, wrong versions, and wrong lengths fail
closed. The rule leaves ordinary destinations unchanged but permits a transfer
into the canonical stake vault only when the Token-2022-validated transfer-
authority key is the derived ingress-authority PDA. It accepts no caller-
provided allow/deny disposition.
That file is an integration-test target outside `src/lib.rs`; it is
host/reference evidence and is not compiled into the current SBF candidate. The
deployable law source remains byte-for-byte identical to its rehearsed version,
so the pinned optimized artifact must also remain identical until final
identities are deliberately wired. A fresh pinned `cargo build-sbf
--optimize-size` rebuild reproduced exactly 154,952 bytes and SHA-256
`927f22cbb431caf1fe9a1cd3782194c20e292f40d72757e7b7dcdf62e8f0381c`.

The pinned `spl-transfer-hook-interface` 2.1.0 `execute` ABI deliberately marks
the authority meta read-only and **not a signer**. The hook must not test
`authority.is_signer`. Security instead composes two facts: Token-2022 validates
the owner/delegate authority before invoking the hook, and the existing
`TransferHookAccount.transferring` check rejects a forged direct hook call. A
focused Rust test constructs the pinned interface instruction and requires its
authority meta to remain non-signer so this privilege de-escalation cannot be
silently misunderstood later.

This boundary is deliberately **not** called by `process_execute`, is not in the
extra-account-meta list, and has no initialization or update opcode. The
current source has no binding-account seed or address helper: no binding account
is created, allocated, written, or read by any instruction, and no storage
opcode exists. The required identities are not frozen: `iat_b3_economy` is
still a host-only library with no executable program ID, this law crate has no
committed public program ID, and the canonical Token-2022 mint is unpublished.
Accepting those facts from the initializer now would substitute caller choice
for an immutable protocol binding; compiling placeholder identities would
either authorize the wrong transfer authority or permanently reject the real
stake flow.

Before wiring, the final source must freeze the law program ID, economy program
ID, canonical mint, and seed domains. The least-cost preference is to compile
the resulting canonical stake-vault and ingress-authority public keys directly
into the frozen law binary. If final SBF measurement or ceremony requirements
instead require stored facts, they must be embedded in the existing law-state
codec before Genesis so the existing hook account supplies them. Storage
topology remains open until the identities and binary are frozen, but it must
not add an account to every transfer merely for this rule. Either form exposes
no update, sweep, recovery, administrator, or caller-disposition instruction.
The economic adapter must temporarily approve the dedicated PDA for exactly
the requested principal, invoke the hooked transfer with that PDA via
`invoke_signed`, and restore the source account's prior delegate state in the
same atomic transaction. Token CPI, hook, delegate restoration, economic state,
and position lifecycle must all roll back together on any failure.

Once that path is frozen and rehearsed, direct Token-2022 donations into the
stake vault fail at the hook while the retained V2 invariant
`stake_tokens.amount == config.staked_principal` stays exact. The present source
only proves the codec, derivation, and admission semantics; it does not yet
claim active donation protection.

### Prototype instruction ABI

- initialize: `"IATB3LAW" || 0x00 || network_genesis_hash[32]`, with ordered
  accounts `payer`, writable `mint`, `law_state`, `extra_account_metas`,
  `system_program`, executable `token_2022_program`;
- finalize: `"IATB3LAW" || 0x01`, with ordered accounts `mint`, writable
  `law_state`;
- transfer enforcement: standard Transfer Hook interface `Execute`, with its
  five standard accounts followed by the read-only `law_state` resolved from
  the extra-account-meta PDA.

## Permissionless daily finalization

`finalize_day` requires only the canonical mint and writable law-state PDA. The
transaction's fee payer can be anyone. The program:

1. reads Solana `Clock` through the sysvar syscall;
2. derives the fixed UTC+03:00 protocol day with the exact mapping
   `floor((Clock.unix_timestamp + 10_800 - 60) / 86_400)`, so the boundary is
   local 00:01;
3. rejects a second finalization for that day;
4. fetches `PodSlotHashes` through the sysvar syscall;
5. selects the newest available ancestor at or before `Clock.slot - 150`;
6. calls the shared exact-threshold and rejection-sampling kernel;
7. atomically writes the complete decision into the fixed law-state account.

The 150-slot lag is a **provisional source constant**, approximately one minute
at nominal 400ms slots. It must be measured under skipped slots, forks, delayed
finalization, congestion, and hostile timing before the Mainnet binary is frozen.

The fixed account is deliberately reused instead of creating a permanent PDA
every day. This avoids indefinite daily rent growth. A successful same-day
decision cannot be overwritten or rerolled; the next civil day replaces the
active record. Historical transactions remain public, but long-term historical
indexing is an external availability concern and must not be described as
permanent on-chain per-day account storage.

## Transfer execution

Token-2022 supplies the standard ordered hook accounts plus the law-state PDA.
The adapter verifies:

- source, destination, and mint are Token-2022 accounts for the same mint;
- the standard validation PDA is exact and program-owned;
- the law-state PDA is exact, program-owned, and bound to the mint;
- the source account's `TransferHookAccount.transferring` flag is active, which
  rejects direct calls that did not come from Token-2022;
- the stored decision recomputes exactly from network, mint, day, slot, and hash;
- the stored day equals the current UTC+03:00 protocol day and is open.

Missing, stale, corrupt, forged, or locked state fails closed. The law-state is
read-only during hook execution. Public and confidential transfers use the same
standard hook entrypoint; the adapter neither receives nor attempts to inspect
a confidential amount.

The boundary is half-open: a prior-day record remains current through local
`00:00:59`; at `00:01:00` that record is stale and all ownership transfers fail
closed until the new day is finalized. A Friday selection therefore covers
`[Friday 00:01:00, Saturday 00:01:00)`, subject to normal fail-closed downtime
if Saturday's result has not yet been finalized.

This adapter does not yet port or gate the V2 staking, settlement, reservation,
vesting, or registry instructions. Each state-changing B3 port remains required
to call the same law kernel directly before Gate 2 can pass. The current code is
therefore IAT-wide for Token-2022 ownership transfers, not yet complete B3-wide
economic-state enforcement.

## Current evidence and next gates

Host evidence currently covers canonical state serialization, corrupt-state
rejection, mint/program PDA separation, standard hook instruction decoding,
unchanged 1%/66.67% thresholds, same-day reroll rejection, future-state
rejection, and deterministic lag selection.

The historical 2026-08-08 disposable local-validator record covers the
pre-allowlist optimized 141,824-byte SBF artifact. The current optimized
atomic-sealing candidate is 154,952 bytes with SHA-256
`927f22cbb431caf1fe9a1cd3782194c20e292f40d72757e7b7dcdf62e8f0381c`.
A fresh disposable loopback run passed with frozen local program data, exact
Token-2022 mint shape, in-initializer authority sealing, real hooked transfers,
permissionless Clock plus SlotHashes finalization, direct-call rejection, and
missing/stale/open/locked/forged state gates. No public network was written. See
[`LOCAL_VALIDATOR_REHEARSAL.md`](LOCAL_VALIDATOR_REHEARSAL.md).

Before Devnet:

- produce a pinned SBF binary and SHA-256 evidence in public CI;
- add a local-validator integration harness that creates a mint with both
  extensions and exercises direct public and confidential transfer paths;
- measure compute units, transaction bytes, account rent, and wallet resolution;
- add rollback, delayed-finalizer, skipped-slot, malformed TLV, wrong-owner,
  wrong-mint, and direct-call adversarial tests;
- reproduce the exact mint-extension allowlist in the pinned SBF and
  local-validator/Devnet evidence, including Permanent Delegate, permissioned
  burn, mint-close, pausable, and representative unknown-extra rejection;
- decide whether the 150-slot lag survives measurement;
- independently review every error and authority transition.

No deployment or mint operation is authorized by this prototype.
