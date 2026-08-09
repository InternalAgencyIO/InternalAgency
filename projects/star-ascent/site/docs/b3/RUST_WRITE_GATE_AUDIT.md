# B3 Rust write-gate audit

Status: **EXACT SOURCE INVENTORY / MAINNET BLOCKING GAP**

Scope: the executable Rust entrypoints in `programs/iat_b3_law` and
`programs/iat_v2`, plus the host-only `programs/iat_b3_economy` transition
library, as of 2026-08-08. This is a source-reachability audit, not a claim that
an undeployed path has executed on-chain.

## Result

The native B3 law program directly gates the standard Token-2022 Transfer Hook
`Execute` path. Its two own write instructions are deliberately law-exempt:
one-time law initialization must happen before a day can be finalized, and the
permissionless daily finalizer must remain callable during a selected lockdown.

The retained V2 Anchor program is not yet a B3 program. All 15 of its public
write handlers omit the canonical law-state PDA and the Daily Law kernel. The
crate also uses `anchor_spl::token::{Token, Mint, TokenAccount}` and
`Program<Token>`, so its token CPIs target the legacy SPL Token program rather
than the canonical B3 Token-2022 mint. Consequently, neither an account
constraint nor the B3 transfer hook gates any current V2 handler.

The faction and core-team-cap implementations currently present under
`programs/iat_b3_reference` remain executable JavaScript specifications. The
new host-only `iat_b3_economy` library contains immutable V2 constants, an
exact read-only Daily Law codec/verifier, an opaque validated-write capability,
and internal pure `expire_round`, `close_position`, `settle_round`, and
`commit_round` transitions, plus the `initialize_config`,
`initialize_lane_vault`, `initialize_stake_vault`, `activate`, and
`set_eligibility` validation/state constructors explicitly staged as
`PRE_LIFECYCLE_ONLY`, plus the `prepare_open_position` validation, provisional
reservation, and transfer-intent kernel and the
`prepare_withdraw_position_principal` maturity, stake-ledger, and transfer-
intent kernel staged as `PRE_TOKEN_CPI_ONLY`. Its
manifest is `lib`-only and it has no Solana entrypoint or public dispatcher,
account lifecycle, token CPI, or network access. Neither
the JavaScript specifications nor these pure Rust slices may be counted as
on-chain faction or core-cap enforcement.

This is a hard Mainnet blocker. Adding a check to only the V2 transfer helper
would be insufficient: several V2 handlers mutate protocol ledgers without a
token transfer, and account initialization occurs before the Rust handler body
inside Anchor's generated path. Every retained write instruction must receive
and validate canonical Daily Law state before any B3 port can be accepted.

## Native B3 law adapter matrix

| Entry path | State effect | Daily Law relationship | Selected-lockdown result |
| --- | --- | --- | --- |
| `initialize_law` (`IATB3LAW`, opcode `0`) | Creates and writes the law-state PDA and the Transfer Hook extra-account-metas PDA | Intentionally exempt one-time bootstrap; verifies the mint shape, extensions, hook program, hook-update signer, and exact PDAs | Not a post-Genesis business write; must be impossible to repeat for the canonical mint |
| `finalize_day` (`IATB3LAW`, opcode `1`) | Replaces the single current-day decision in the law-state PDA | Intentionally exempt consensus housekeeping; uses only Solana `Clock` and `SlotHashes`, rejects a same-day reroll, and recomputes the fixed draw | Allowed so the next day can be decided even after a locked prior day |
| Transfer Hook `Execute` | Read-only in the law program; authorizes or rejects the Token-2022 transfer that invoked it | **Direct canonical gate**: exact PDA/owner/mint checks, active Token-2022 transfer context, current `Clock` day, and full decision recomputation | Missing, stale, corrupt, forged, or selected state rejects; only a valid current open decision allows the transfer |

The consensus and economy crates are pure and have no account-write entrypoint.

## Retained V2 public write matrix

`CCC-disabled` means the compiled `CCC_DLC_GENESIS_ENABLED = false` guard makes
that handler fail before its business mutation. It is still not a Daily Law
gate and must not be counted as one if a future binary enables the DLC.

| V2 handler | Persistent effects on success | Token movement | Current reachability | Canonical Daily Law gate |
| --- | --- | --- | --- | --- |
| `initialize_config` | Creates and initializes `Config` | None | Hardware-admin bootstrap | **None** |
| `initialize_lane_vault` | Creates lane state and token vault; updates `Config.lane_mask` | None | Hardware-admin bootstrap | **None** |
| `initialize_stake_vault` | Creates stake token vault; updates config | None | Hardware-admin bootstrap | **None** |
| `activate` | Reserves reward ledgers, creates core-reward state, marks config active | None | Hardware-admin bootstrap | **None** |
| `register_agency` | Creates agency and owner-index state; updates registry hash/count | None | CCC-disabled | **None** |
| `set_eligibility` | Creates or rewrites wallet eligibility | None | Reachable for the standard role; CCC roles disabled | **None** |
| `open_position` | Creates position; reserves three reward lanes; updates staked-principal ledger | Owner to stake vault via legacy SPL Token `transfer_checked` | Reachable for the standard role | **None** |
| `settle_position_week` | Consumes reservations; updates lane paid totals, position paid total, and settlement bit | Up to three reward-vault payments via legacy SPL Token | Reachable for standard positions | **None** |
| `settle_core_week` | Consumes reservations; updates lane paid totals, core paid total, and settlement bitmap | Up to three reward-vault payments via legacy SPL Token | Reachable | **None** |
| `claim_lane_principal` | Increments lane principal claimed | Lane vault to beneficiary via legacy SPL Token | Reachable | **None** |
| `withdraw_position_principal` | Decrements staked principal; marks principal returned | Stake vault to owner via legacy SPL Token | Reachable after maturity | **None** |
| `close_position` | Releases three reservation ledgers; marks position closed | None | Reachable after settlement and return | **None** |
| `commit_round` | Creates pending round and snapshots registry/randomness commitment | None | CCC-disabled | **None** |
| `settle_round` | Writes revealed randomness and selected agency; marks round settled | None | CCC-disabled | **None** |
| `expire_round` | Writes neutral terminal result; marks round expired | None | CCC-disabled | **None** |

## Host-only B3 port progress

`expire_round` remains the first pure transition, `close_position` the second,
and `settle_round` the third. `commit_round` is the fourth and only additional
handler-body kernel. `initialize_config` is the fifth host kernel,
`initialize_lane_vault` is the sixth, and `initialize_stake_vault` is the
seventh, but only their pre-lifecycle validation and by-value state construction
are present. `activate` is the eighth host kernel, but only handler-body
validation, reward reservation, and by-value state construction are present.
`set_eligibility` is the ninth host kernel, but only its role-policy validation
and by-value eligibility construction are present. `prepare_open_position` is
the tenth host kernel, but stops immediately before the token CPI.
`prepare_withdraw_position_principal` is the eleventh host kernel and stops at
the same pre-token-CPI boundary. All four
Genesis kernels and `set_eligibility` are `PRE_LIFECYCLE_ONLY`;
both prepare kernels are `PRE_TOKEN_CPI_ONLY`. All have no public exposure.
Every production wrapper requires the opaque canonical Daily Law capability. The
three round-related CCC wrappers then preserve the immutable CCC-disabled
Genesis boundary before inspecting caller-supplied round, instruction-trace, or
randomness values; `set_eligibility` preserves that same boundary inside its
non-standard-role branch.

The `initialize_config` kernel preserves the retained V2 handler body's exact
validation order: hardware-admin key, mint decimals, rehearsal/production
Switchboard program ID, timestamp-mode rule, then the future-genesis guard. On
success it constructs the complete initial V2 `Config` data by value, including
the cluster-specific expected supply, inactive flags, zeroed vault/registry
fields and counts, and both supplied bumps. Differential tests use the actual
V2 `Config` type and include stacked-error precedence plus `i64` timestamp and
`u8` bump boundaries. This is not signer authentication, canonical-mint
binding, PDA derivation, account allocation/funding, System Program CPI, or a
persistent write, and it does not make `initialize_config` a complete handler.

The `initialize_lane_vault` kernel preserves V2's exact handler-body order:
inactive config, inclusive lane range 1 through 4, uninitialized lane bit, then
the retained policy and beneficiary lookup. It constructs every V2 lane field
by value, zeros the three ledgers, scales only total and Genesis-unlocked
amounts in rehearsal mode, and ORs only the target mask bit. Differential tests
use the actual V2 `Config`, `LaneVault`, policy table, and beneficiary constants;
an exhaustive active/rehearsal/lane/mask grid pins error precedence. The core
beneficiary remains exact V2 in this parity kernel; the separate custody and
release-policy divergence remains Mainnet-blocked. This slice does not
authenticate the administrator or config/mint/token accounts, derive either
PDA, allocate or fund an account, initialize Token-2022 state, serialize, or
persist either result, and it does not make `initialize_lane_vault` complete.

The `initialize_stake_vault` kernel preserves V2's two checks and mutation order:
inactive config, uninitialized stake-vault flag, stake-token-account binding,
then the initialized flag. Differential tests use the actual V2 `Config` type,
pin `AlreadyActive` before `StakeVaultAlreadyInitialized`, prove an old binding
is overwritten when the flag is false, and compare every untouched config field.
This slice does not authenticate the administrator or config/mint/token accounts,
derive the vault-authority or stake-token PDA, allocate or fund the account,
initialize Token-2022 state, serialize, or persist the result, and it does not
make `initialize_stake_vault` complete.

The `activate` kernel preserves the retained V2 handler-body order: the frozen
randomness-adapter flag, inactive config, exact `0b1_1110` lane mask, initialized
stake vault, exact fixed supply, revoked mint and freeze authorities, then
community, stake, treasury, ecosystem, core-team, and liquidity funding checks
in that order. It computes the retained core principal and maximum reward,
reserves week-zero capacity treasury first, then ecosystem, then liquidity,
constructs every `CoreReward` field by value, and only then returns an active
config. Differential tests use actual V2 types, constants, and policy helpers
through an independent handler-body reference, while a source-order regression
pins the actual V2 handler and reservation helpers. Coverage includes
stacked-error precedence, lane order, reward-source and arithmetic failures,
spill order, and insufficient capacity. This is handler-body parity only: the
inputs are already decoded semantic values. It
does not authenticate the administrator or any account, prove account owners or
canonical config/mint/vault bindings, derive a PDA, create the core-reward
account, validate Token-2022 extensions/delegate/close-authority state, invoke a
program, serialize, or persist a result, and it does not make `activate`
complete. Its exact V2 reservation math does not resolve the separate core
payout-custody conflict.

The `set_eligibility` kernel preserves the retained V2 handler-body error order:
active config, known role, then the role-specific agency rule. Standard role
zero succeeds only without an agency and stores `u32::MAX` as the no-agency
sentinel. Roles one and two reach the immutable compile-time-inactive CCC check
before the otherwise unreachable missing-agency or out-of-range checks, so they
return `CccDlcNotActive`; unknown roles fail before any agency rule. On standard
success the kernel constructs the exact config key, wallet, sentinel, role, and
bump by value. Differential tests use the actual V2 `Config` and `Eligibility`
types and role-policy helper, and static source regressions pin both handlers'
validation/construction order. This remains handler-body parity only. It does
not authenticate the administrator or config, validate account ownership or
codecs, derive the wallet-bound PDA, create or decode an account, implement the
V2 `init_if_needed` create-or-update lifecycle, invoke the System Program,
serialize, or persist a result, and it does not make `set_eligibility` complete.

The `prepare_open_position` kernel preserves the exact retained V2 pre-CPI
order: active config, positive principal, owner-token mint then owner, stake-
vault mint then authority then exact tracked balance, eligibility owner, known
role, standard-role no-agency rule or immutable CCC-inactive rejection, current
week, maximum reward, and treasury/ecosystem/liquidity reservation. The CCC
roles remain unreachable with `CccDlcNotActive`. Success returns transaction-
local lane copies and an owner-to-stake-vault transfer intent only. It does not
perform `config.staked_principal.checked_add`, construct `PositionState`, create
or persist the position PDA, invoke a CPI, or mutate durable state. It is
explicitly `PRE_TOKEN_CPI_ONLY`, handler-incomplete, and has no public exposure.

The withdrawal kernel preserves the exact retained V2 pre-CPI order: active
config, open position, destination mint then owner, not-yet-returned flag,
checked maturity calculation, validator-Clock-derived current week, completed
term, tracked principal sufficient for this position, then stake-vault mint,
authority, and exact tracked stake-vault balance. Success returns unchanged
config and position snapshots, the maturity week, and a stake-vault-to-owner
transfer intent. It does not decrement `config.staked_principal`, does not set
`position.principal_returned`, and does not invoke a CPI. It also preserves V2's
permissionless caller semantics: the caller is a signer but need not be the
position owner, while the token destination must still belong to the recorded
owner. The slice is `PRE_TOKEN_CPI_ONLY`, handler-incomplete, and has no public
exposure.

Exact parity exposes a Mainnet-blocking denial: V2 requires the stake-vault
token amount to equal tracked principal. An unsolicited 1-base-unit donation to
that public vault makes `open_position` fail with `StakeLedgerMismatch` (and can
also block principal withdrawal). This slice deliberately does not relax the
equality. An immutable mitigation preserving solvency and permissionlessness
must be frozen and rehearsed before Mainnet.

The `commit_round` differential kernel performs no account creation. It accepts
a decoded read-only instructions-sysvar trace, selects only the instruction
immediately preceding the current index, validates the pinned Switchboard
program/discriminator/randomness-account/payer metas, proves a fresh unrevealed
commit, and returns the exact pending-round snapshot by value. Adversarial tests
reject missing/zero/out-of-range indices, a valid but non-adjacent commit, every
malformed commit meta, invalid randomness, stale seed slots, and already
revealed state. The oracle uses the actual V2 `Config` and `Round` types plus V2
cadence, context, and Switchboard parsing functions.

The `settle_round` private by-value differential kernel preserves V2's
config-active, pending-status, randomness-owner, reveal-window, pinned-codec,
freshness, commit-slot, reveal-order, uniform-selection, and terminal mutation
order. Tests use the actual V2 `Round` type, Switchboard parser, and tiebreak
implementation as the comparison oracle.

`close_position` remains the only reachable V2 business transition in the
host-only kernel. It performs no account creation, closure CPI, token CPI,
randomness read, or other network operation; its differential tests use the
actual V2 `Position` and `LaneVault` types. V2 has no `close =` constraint or
manual account close: it marks `closed = true` and retains the position PDA
permanently, making that owner/config position ID nonreusable. The matrix must
therefore never claim a `close_position_account` mutation.

These are not account adapters or deployable handlers. A future native adapter
must still prove account ownership, exact config/round/randomness bindings,
PDAs, codecs, and bumps before its first mutable borrow, and must source Clock
timestamp/slot from one Solana Clock observation. For `commit_round`, it must
decode the canonical instructions sysvar itself and create the round PDA only
after the Daily Law and pure proof succeed. For `initialize_config`, it must
authenticate the hardware-admin signer, bind the canonical Token-2022 mint and
program, derive and verify the config and vault-authority addresses/bumps, and
create the config account only after the gate and pure validation succeed. For
`initialize_lane_vault`, it must authenticate the administrator and all
canonical config/mint/token-program bindings, verify both PDA derivations and
bumps, then manually create and initialize the lane-state and Token-2022 vault
accounts after the gate and pure validation succeed. For
`initialize_stake_vault`, it must authenticate the same canonical bindings,
verify the vault-authority and stake-token PDA derivations, then manually create
and initialize the Token-2022 account after the gate and pure validation succeed.
That account remains a public-balance economic vault with no delegate or close
authority under the frozen replacement contract. For `activate`, it must pass
the canonical Daily Law gate first, authenticate the hardware administrator,
decode and bind the canonical config, mint, custody, lane, and Token-2022 vault
accounts, verify every PDA and null authority, then manually create and persist
the core-reward account only after the pure validation succeeds. For
`set_eligibility`, it must authenticate the hardware administrator and config,
derive and verify the wallet-bound eligibility PDA, and inspect the account's
existence, owner, codec, config key, wallet key, and bump without triggering
lifecycle. Only after the Daily Law gate and pure role-policy transition succeed
may it manually create an absent record or mutably overwrite a valid existing
record and persist the result. The V2 `init_if_needed` constraint is source
evidence of the retained create-or-update semantics, not lifecycle code that can
be copied ahead of the B3 gate. For `open_position`, the adapter must pass the
Daily Law gate, authenticate every account, and derive and bind the canonical
vault-authority PDA itself; the semantic value supplied to the host plan is not
trusted adapter evidence. Only after the pre-CPI plan succeeds may it manually
create the position account, construct Token-2022 `TransferChecked`, and use the
exact `add_extra_accounts_for_execute_cpi` hook-account flow before invocation.
Only after that CPI succeeds may a separate post-CPI finalizer apply the config
staked-principal checked addition and construct/persist `PositionState`. A
disposable local validator must prove the entire transaction rolls back the
manual lifecycle, provisional lane reservations, token transfer, and finalizer
state when the hook, token CPI, or post-CPI finalizer fails.
For `withdraw_position_principal`, the adapter must pass the same Daily Law and
canonical account/PDA checks before mutable borrow, derive and bind the config,
stake-vault, vault-authority, position, mint, and Token-2022 identities itself,
preserve the arbitrary signer caller plus owner-bound destination semantics,
construct Token-2022 `TransferChecked`, and use
`add_extra_accounts_for_execute_cpi` before invoking the stake-vault-to-owner
transfer. Only after the CPI succeeds may its post-CPI finalizer
checked-subtract tracked principal and mark the position returned. A
local-validator failure at the hook, token CPI, or finalizer must prove the
transfer and both state writes roll back atomically.

That adapter also has an unresolved non-circular bootstrap requirement. If the
combined `finalize_day` plus core-cap reconciliation path requires an already
active capped custody before it can finalize, `activate` can never obtain the
current open Daily Law capability it requires. Mainnet therefore needs a frozen
pre-activation/vacuous-cap phase and a one-way activation transition that proves
fully funded canonical core custody and atomically enables normal cap
enforcement, or another explicit immutable bootstrap rule. No such lifecycle
rule exists in this host kernel. Core payout custody remains separately blocked,
and the complete dispatcher remains absent and disabled until all fifteen rows
pass together.

## Internal V2 mutation paths

These helpers are not independently dispatched, but their mutations inherit
the missing gate from their calling handlers:

| Internal path | Called from | Effect |
| --- | --- | --- |
| `reserve_lane` / `reserve_three_lanes` | `activate`, `open_position` | Increments lane reservations |
| `consume_reserved_lane` / `consume_three_reservations` | position/core settlement | Decrements reservations and increments paid ledgers |
| `release_reserved_lane` / `release_three_reservations` | `close_position` | Releases unused reservations |
| `transfer_from_vault` / `transfer_reward_splits` | settlement, lane claim, principal withdrawal | Performs legacy SPL Token transfers; no Token-2022 hook |
| `mark_core_week_settled` | `settle_core_week` | Updates the core settlement bitmap |

## Additional IAT-wide boundary

A Transfer Hook is a transfer gate, not a generic Token-2022 instruction hook.
The current native adapter does not intercept direct non-transfer token
mutations such as holder-authorized burns, delegate approval/revocation, token
account initialization/closure, or confidential-account configuration. Mint
and freeze authority revocation removes minting and freeze/thaw paths, but it
does not make every Token-2022 state mutation flow through `Execute`.

Therefore the current code supports the narrower, truthful claim "all canonical
IAT ownership transfers are gated". It does **not** yet support the stronger
claim "all IAT state-changing transactions are rejected during lockdown." The
latter requires an explicit immutable instruction-surface design and cannot be
closed by a small assertion inside the existing transfer-hook program.

## Required port invariant

For every retained B3 business-write instruction, the native port must:

1. bind the exact canonical mint and law-state PDA to immutable program IDs;
2. verify account ownership and deserialize the canonical fixed law schema;
3. read Solana `Clock` internally, never accept caller-supplied time or an
   `ALLOWED` boolean/enum;
4. recompute and validate the complete decision from the stored entropy data;
5. reject missing, stale, future, corrupt, forged, or selected state before any
   business mutation or CPI;
6. preserve permissionless `finalize_day` as the narrowly defined housekeeping
   exception; and
7. exercise every handler against missing, stale, forged-open, and selected
   decisions in local-validator and Devnet rehearsals.

The accompanying source-inventory test fails if a Rust entrypoint is added or
removed without updating this matrix, or if the current V2/B3 dependency and
gate boundary silently changes.

The complete fifteen-handler native port order, account-lifecycle boundary,
Token-2022 replacement contract, and fail-closed deployment rule are frozen in
[ECONOMIC_PORT_ARCHITECTURE.md](ECONOMIC_PORT_ARCHITECTURE.md) and its
machine-readable write-gate matrix.
