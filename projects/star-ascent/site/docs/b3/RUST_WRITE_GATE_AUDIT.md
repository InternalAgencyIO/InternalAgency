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
`initialize_lane_vault`, `initialize_stake_vault`, and `activate`
validation/state constructors explicitly staged as `PRE_LIFECYCLE_ONLY`. Its
manifest is `lib`-only and it has no Solana entrypoint or public dispatcher,
account lifecycle, token CPI, or network access. Neither the JavaScript
specifications nor these pure Rust slices may be counted as on-chain faction or
core-cap enforcement.

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
All four Genesis kernels are `PRE_LIFECYCLE_ONLY` and have no public exposure.
Every production wrapper requires the opaque canonical Daily Law capability.
The three CCC wrappers then preserve the immutable CCC-disabled Genesis
boundary before inspecting caller-supplied round, instruction-trace, or
randomness values.

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
actual V2 `Position` and `LaneVault` types.

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
the core-reward account only after the pure validation succeeds.

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
