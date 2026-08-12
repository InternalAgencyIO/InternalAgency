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

### Stake-ingress anti-donation boundary (feature-gated executable seam, identity-unfrozen)

The source file at
`programs/iat_b3_law/src/stake_ingress.rs` contains a separate 176-byte,
versioned `StakeIngressBinding` codec and pure enforcement kernel. It
canonically derives the economic config, stake-token vault, and dedicated
`stake-ingress` authority PDA from one economy program ID and mint. The config
seed is the exact retained V2/B3 `PDA(economy, ["config", mint])` seed, not a new
alias. Packing and decoding recompute every address and bump; zero identities,
forged addresses, nonzero reserved bytes, wrong versions, and wrong lengths fail
closed. The rule leaves ordinary destinations unchanged but permits a transfer
into the canonical stake vault only when the Token-2022-validated transfer-
authority key is the derived ingress-authority PDA. It accepts no caller-
provided allow/deny disposition.
The companion integration test imports this source directly instead of
carrying a second implementation. It covers canonical round trips, zero and
wrong identities, field and reserved-byte corruption, wrong lengths,
transactional encode failure, wrong-authority donation attempts, ordinary
destinations, and the pinned hook authority ABI.

The pinned `spl-transfer-hook-interface` 2.1.0 `execute` ABI deliberately marks
the authority meta read-only and **not a signer**. The hook must not test
`authority.is_signer`. Security instead composes two facts: Token-2022 validates
the owner/delegate authority before invoking the hook, and the existing
`TransferHookAccount.transferring` check rejects a forged direct hook call. A
focused Rust test constructs the pinned interface instruction and requires its
authority meta to remain non-signer so this privilege de-escalation cannot be
silently misunderstood later.

The law crate now exposes this rule only behind the
`production-combined-hook` Cargo feature. Its build script refuses that feature
unless explicit frozen law-program, economy-program, and canonical-mint public
keys are supplied as canonical Base58 build inputs. It rejects zero or
colliding identities, derives the retained config, stake-vault, and ingress-
authority PDAs at build time, and compiles only the resulting keys into the
artifact. The runtime rejects a different law program or mint. After the
existing hook has authenticated the Token-2022 transfer context and a current
finalized OPEN Daily Law decision, `process_execute` applies the compiled
stake-vault admission rule. Missing, stale, forged, or locked Daily Law still
wins before the stake-ingress decision.

The feature adds no instruction opcode, account meta, binding account,
initializer input, update path, or runtime PDA derivation. The feature-disabled
build preserves the law-only behavior. Enabling it without all three identity
inputs fails before crate compilation; fixture-only tests use conspicuous
non-production identities and are not an identity freeze. The real required
identities remain unfrozen: `iat_b3_economy` has no approved production program
ID, this law crate has no committed production program ID, and the canonical
Token-2022 mint is unpublished. Accepting those facts from instruction bytes
would substitute caller choice for immutable protocol law, so no such path
exists.

Before candidate acceptance, the owner and independent reviewers must freeze
the three identities and seed domains, reproduce the exact feature-enabled SBF
bytes, and execute both Daily Law and stake-ingress adversarial matrices against
that one artifact. The current 160-byte law-state codec and one-entry extra-
account-meta list remain unchanged. No design may add an account to every
transfer merely for this rule, and no update, sweep, recovery, administrator,
or caller-disposition instruction is exposed.
The economic adapter must temporarily approve the dedicated PDA for exactly
the requested principal, invoke the hooked transfer with that PDA via
`invoke_signed`, and restore the source account's prior delegate state in the
same atomic transaction. Token CPI, hook, delegate restoration, economic state,
and position lifecycle must all roll back together on any failure.

Once that exact artifact is frozen and rehearsed, direct Token-2022 donations into the
stake vault fail at the hook while the retained V2 invariant
`stake_tokens.amount == config.staked_principal` stays exact. The present source
now makes the compile-time identity binding and executable admission path
reviewable; it does not yet claim active donation protection.

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
pre-allowlist optimized 141,824-byte SBF artifact. The rehearsed optimized
atomic-sealing candidate is 154,952 bytes with SHA-256
`927f22cbb431caf1fe9a1cd3782194c20e292f40d72757e7b7dcdf62e8f0381c`.
A fresh disposable loopback run passed with frozen local program data, exact
Token-2022 mint shape, in-initializer authority sealing, real hooked transfers,
permissionless Clock plus SlotHashes finalization, direct-call rejection, and
missing/stale/open/locked/forged state gates. No public network was written. See
[`LOCAL_VALIDATOR_REHEARSAL.md`](LOCAL_VALIDATOR_REHEARSAL.md).

The `154,952`-byte law-only digest above is historical evidence for the prior
reviewed source and is not silently rebound to this feature addition. The
feature-disabled code path remains law-only, but its exact SBF bytes must be
rebuilt and compared before any byte-identity claim. An earlier pinned
`solana-cargo-build-sbf 3.1.10 --optimize-size` compiler-only experiment with
the reference module exported was repeated byte-identically and produced
SHA-256 `10e468525e491bb9b03ab4cd1b700ffde57904e7d209aa6fa0527d73bfd97613`;
its guard was unreachable and that digest remains historical source/build
evidence only. The new feature-enabled path has no production identity inputs,
pinned SBF digest, or combined-validator evidence. Existing CI and Devnet pins
must not be rebound until identity freeze and deliberate candidate review.

A 2026-08-09 disposable stake-ingress rehearsal separately passed the pinned
Token-2022 runtime primitives: exact owner-signed approval CPI, stateless
ingress-PDA `invoke_signed`, hooked transfer, allowance auto-clear, exact prior-
delegate restoration, direct-donation rejection, CPI Guard fail-closed, and
atomic rollback at hook, post-CPI, and restoration failures. The two fixture
binaries are explicitly non-production and did not execute Daily Law in the
same hook. Production integration therefore remains blocked on the three
frozen identities and a repeat of both matrices against one final binary. See
the stake-ingress section and machine record linked from
[`LOCAL_VALIDATOR_REHEARSAL.md`](LOCAL_VALIDATOR_REHEARSAL.md).

Here “stateless” is normative: neither the adapter nor hook may require the
ingress PDA to be absent, unfunded, System-owned, program-owned, zero-data,
non-executable, or in any other account state. The loopback runner funds the
previously absent PDA before both successful deposits and binds the observed
System owner, zero data length, non-executable bit, and nonzero lamports in its
record. Canonical key derivation and valid `invoke_signed` seeds are the only
admission facts.

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
