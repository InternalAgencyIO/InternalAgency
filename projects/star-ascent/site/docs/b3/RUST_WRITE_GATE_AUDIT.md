# B3 Rust write-gate audit

Status: **EXACT SOURCE INVENTORY / MAINNET BLOCKING GAP**

Scope: the executable Rust entrypoints in `programs/iat_b3_law` and
`programs/iat_v2`, plus the default host-only `programs/iat_b3_economy`
transition kernel and its feature-gated structural SBF preflight, as of
2026-08-10. This is a source-reachability audit, not a claim that
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
default `iat_b3_economy` kernel remains host-only and contains immutable V2 constants, an
exact read-only Daily Law codec/verifier, an opaque validated-write capability,
and internal pure `expire_round`, `close_position`, `settle_round`, and
`commit_round` transitions, plus the `initialize_config`,
`initialize_lane_vault`, `initialize_stake_vault`, `activate`, and
the production-inactive `prepare_register_agency` host boundary and
`set_eligibility` validation/state constructors explicitly staged as
`PRE_LIFECYCLE_ONLY`, plus the `prepare_open_position` validation, provisional
reservation, and transfer-intent kernel and the
`prepare_withdraw_position_principal` maturity, stake-ledger, and transfer-
intent kernel and the `prepare_settle_position_week` reward/reservation and
ordered-transfer-intent kernel and the `prepare_claim_lane_principal` vesting,
core-custody-blocker, and transfer-intent kernel and the
`prepare_settle_core_week` reward/reservation and core-custody-blocker kernel
staged as
`PRE_TOKEN_CPI_ONLY`. Its
manifest now also supports an exact feature-gated structural preflight, but
there is no production economic entrypoint or public write dispatcher, account
lifecycle, token CPI, or network access. Neither
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

The consensus crate and default economy kernel are pure. The only Economy SBF
entrypoint is the all-fifteen account-meta structural preflight; it has no
account-write path and completes no handler.

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
the same pre-token-CPI boundary. `prepare_settle_position_week` is the twelfth
host kernel and stops before the first reward transfer.
`prepare_claim_lane_principal` is the thirteenth and stops before its principal
transfer, with the unresolved core lane failing closed after retained V2
pre-CPI validation. `prepare_settle_core_week` is the fourteenth and likewise
fails closed after retained V2 pre-CPI validation and reservation consumption.
`prepare_register_agency` is the fifteenth host kernel and exposes only the
immutable production CCC-inactive boundary for the retained `register_agency`
handler body; its dormant enabled construction exists under `#[cfg(test)]`
solely for V2 differential proof. All four Genesis kernels,
`prepare_register_agency`, and `set_eligibility` are `PRE_LIFECYCLE_ONLY`;
all five prepare kernels are `PRE_TOKEN_CPI_ONLY`. All have no public exposure.
Every production wrapper requires the opaque canonical Daily Law capability. The
three round-related CCC wrappers then preserve the immutable CCC-disabled
Genesis boundary before inspecting caller-supplied round, instruction-trace, or
randomness values; `prepare_register_agency` preserves `NotActive` before that
boundary, and `set_eligibility` preserves it inside its non-standard-role
branch.

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

The `prepare_settle_position_week` kernel preserves the exact retained V2 body
through reservation consumption: active config, open position, destination mint
then recorded owner, validator-Clock week, term subtraction/bound, settlement-bit
construction, duplicate rejection, standard-round omission or immutable CCC-
inactive rejection, floor-delta weekly reward, and treasury-first then ecosystem
then liquidity reservation consumption. The production wrapper returns
`CccDlcNotActive` for every non-standard role before the otherwise dormant round-
required/config/week/snapshot/status checks. A private differential seam exercises
those retained dormant branches without changing the compile-time false
production constant: a settled selected agency is paused, a non-selected agency
receives the full stored-rate reward, and an expired-neutral round receives
`floor(full * (N - 1) / N)`.

Success returns only transaction-local lane and position-reservation copies plus
three transfer intents in treasury, ecosystem, liquidity order, leaving position
paid and settlement bits unchanged. A zero split is
an intent that the adapter must skip, matching V2's `transfer_from_vault` early
return. The returned position deliberately keeps `paid` and `settled_mask`
unchanged. V2 performs `position.paid.checked_add(amount)` and sets the bit only
after every nonzero CPI succeeds; moving that overflow check into preflight would
change CPI-error precedence. The slice performs no CPI, hook-account expansion,
post-CPI finalization, serialization, or persistence. It is
`PRE_TOKEN_CPI_ONLY`, handler-incomplete, and has no public exposure. Differential
and adversarial vectors use the actual V2 `Position`, `LaneVault`, `Round`, and
policy functions and cover stacked errors, bit/rate/ledger arithmetic, zero-
amount reconciliation, CCC inactivity, dormant terminal round modes, and the
three-lane spill order.

The `prepare_claim_lane_principal` kernel preserves the exact retained V2
handler-body order through the transfer boundary: active config, stored lane
equality, treasury-through-liquidity range, destination mint then fixed
beneficiary, validator-Clock week, cumulative vesting arithmetic, checked
`reserved + paid + principal_claimed`, saturating claimable subtraction, and the
nonzero-claim requirement. The production path then fails the `CORE_TEAM` lane
with `CoreCustodyPolicyUnresolved`, after every retained V2 pre-CPI check but
before any transfer can be planned for public use. This keeps the unresolved
canonical-custody release policy honest. A private `#[cfg(test)]` parity seam
models V2's former direct payout only for differential tests. Non-core success
returns an unchanged lane snapshot and one transfer intent. Source vault
mint/authority/balance failures remain at the future CPI boundary, as in V2;
the kernel does not prevalidate them, invoke a CPI, or increment
`principal_claimed`. It is `PRE_TOKEN_CPI_ONLY`, handler-incomplete, and has no
public exposure.

The `prepare_settle_core_week` kernel preserves the exact retained V2
handler-body order through the transfer boundary: active config, destination
mint then fixed core beneficiary, stored term, checked payable week, validator-
Clock current week, low/high settlement-word range and duplicate check, floor-
delta reward, then treasury, ecosystem, and liquidity reservation consumption.
The handler has no `CCC_DLC_GENESIS_ENABLED` check in V2, so this port does not
misclassify it as CCC-disabled. Reservation checks still traverse all three
lanes when the weekly reward is zero. Only after this complete pre-CPI boundary
does production return `CoreCustodyPolicyUnresolved`; a private `#[cfg(test)]`
seam models the old fixed-beneficiary transfer plan solely for differential
tests. Its provisional core and lane copies leave `paid`, `settled_low`, and
`settled_high` unchanged. It neither prevalidates later source-vault CPI facts
nor moves the checked paid addition ahead of the three ordered CPIs, so token-
CPI errors retain precedence over paid overflow. The slice is
`PRE_TOKEN_CPI_ONLY`, handler-incomplete, and has no public exposure.

The `prepare_register_agency` production host wrapper requires the opaque Daily
Law capability, then preserves only the retained V2 `register_agency`
handler-body result/error order: inactive config fails with `NotActive`, while
active config fails immediately with `CccDlcNotActive` because
`CCC_DLC_GENESIS_ENABLED` is the immutable false constant. This is not an
end-to-end V2 instruction-parity claim. V2 Anchor first authenticates the
administrator/config relationship and, for a call that reaches the Rust
handler, has executed both `agency` and `agency-owner` init lifecycles during
generated account validation. An earlier lifecycle error aborts before the
handler; successful init CPIs roll back when it returns `NotActive`,
`CccDlcNotActive`, or another `Err`. The host wrapper starts after the B3 Daily
Law gate and deliberately models none of those pre-handler effects.

There is no caller enable flag and no production Clock read, record
construction, registry-hash update, count increment, lifecycle, CPI,
persistence, dispatcher, or success path; changing the constant alone still
cannot expose the dormant body. The raw `register_agency` function name remains
reserved for a future complete native adapter or dispatcher instruction. A
private `#[cfg(test)]` seam and actual V2 `Agency`/`AgencyOwnerIndex` comparison
oracle pin the hypothetical enabled handler-body assignment order: agency
config, owner, and index; validator-Clock week; remaining agency fields;
owner-index fields; the `IAT_AGENCY_REGISTRY_V1` hash append; then checked `u32`
count increment.
Adversarial vectors prove `NotActive` precedes invalid Clock and overflow,
invalid Clock precedes count overflow, and `u32::MAX - 1` remains the last
successful increment. Administrator/config authentication and the exact
`agency`/`agency-owner` PDA lifecycle are deliberately absent and unauthorized
under the immutable inactive law. This slice is
`CCC_INACTIVE`, `PRE_LIFECYCLE_ONLY`, handler-incomplete, and has no public
exposure.

Exact parity exposes a Mainnet-blocking denial: V2 requires the stake-vault
token amount to equal tracked principal. An unsolicited 1-base-unit donation to
that public vault makes `open_position` fail with `StakeLedgerMismatch` (and can
also block principal withdrawal). This slice deliberately does not relax the
equality. An immutable mitigation preserving solvency and permissionlessness
must be frozen and rehearsed before Mainnet.

The law crate's host-test `stake_ingress` source contains a bounded,
identity-unwired anti-donation kernel. A 176-byte `StakeIngressBinding` codec
recomputes the
economic config, stake-token, and dedicated `stake-ingress` authority PDAs from
the codec's economy program ID and mint. Its pure rule rejects a canonical
stake-vault destination unless the exact ingress PDA is the Token-2022-
validated transfer-authority key, while ordinary destinations pass through.
Forged fields, bumps, zero identities, reserved bytes, versions, and lengths
fail closed, and there is no caller-provided disposition. The integration test
imports the source file directly; it is absent from `src/lib.rs` and the
deployable crate module graph. `process_execute`, `process_initialize_law`, the two-
opcode dispatcher, the 160-byte Daily Law codec, and its current one-entry hook
meta list remain unchanged. The config derivation is the exact retained V2/B3
`["config", mint]` seed. No binding account is created, stored, loaded, or
addressed by an instruction, and no binding-account seed or storage opcode
exists. The default optimized SBF therefore remains exactly 154,952 bytes with
SHA-256 `927f22cbb431caf1fe9a1cd3782194c20e292f40d72757e7b7dcdf62e8f0381c`.

The pinned Transfer Hook 2.1.0 interface marks the hook's authority meta
read-only and non-signer. The enforcement kernel intentionally has no
`authority_is_signer` input or check. Token-2022 authenticates the owner/delegate
before hook invocation, and `validate_transfer_context` separately requires the
source account's active `TransferHookAccount.transferring` flag. A Rust
regression test pins the de-escalated authority meta.

This is not active protection. `iat_b3_economy` remains host-only without a
program ID, `iat_b3_law` has no committed public program ID, and the canonical
Token-2022 mint is not published. Wiring any placeholder or initializer-chosen
identity would violate immutability. The final adapter must freeze those three
identities and all seed domains, then either compile the two final destination/
authority keys into the frozen binary or embed compact binding facts in the
existing law-state codec before Genesis. It must not append a new account to
every transfer for this rule. The economy ingress PDA is an exact-amount
temporary delegate; the adapter must restore any prior delegate and prove
complete rollback on every approval, transfer, hook, restoration, and post-CPI
failure. No update, administrator, sweep, recovery, oracle, or bypass opcode is
permitted.

The economy crate now carries the previously test-only ten-phase stake-ingress
kernel in production source. Its combined API requires the opaque open-Day
Daily Law capability, runs the retained V2 open-position preflight itself, and
then binds exact approval, hooked transfer, reload, V2 post-CPI ordering, and
delegate restoration intents. It performs no CPI, account access, lifecycle,
serialization, persistence, Solana entrypoint, or public dispatch. Focused
adversarial tests retain the former executable-spec coverage and add combined-
boundary and error-precedence coverage.

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

The adjacent strict-codec slice covers only B3 `PositionState` and `LaneState`.
Both use distinct eight-byte magics and exact versioned 176-byte layouts;
little-endian numerics, canonical booleans, zero reserved bytes, exact length,
role `0..=2`, and stored lane `1..=4` are checked on decode and encode. Encoding
constructs a temporary fixed buffer and copies only after every semantic check,
so a rejected value or wrong-sized destination remains unchanged. Golden hashes
and field-completeness vectors pin every semantic field, and cross-type,
version, length, trailing-byte, reserved-byte, boolean, and discriminant
adversaries fail closed. These are deliberate B3 corruption rules, not a claim
that the new bytes decode V2 Anchor accounts or reproduce Anchor account-error
precedence.

A separate production-source Config representation is now present without
closing the Config/Genesis decision. `IATB3CFG` v1 is an exact 272-byte envelope
over every retained `ConfigState` field plus the explicit high-level
`UNINITIALIZED`, `GENESIS_STAGING`, or `ACTIVE` label. It rejects wrong
length/type/version, reserved-byte drift, noncanonical booleans, phases, and
lane-mask bits, and phase/retained-`active` disagreement. Encoding uses a
temporary buffer. It exposes no transition function and therefore does not
choose the unresolved one-way staging/activation predicate, vacuous-cap rule,
finalization condition, or conservation evidence.

Behind `runtime-account-bridge`, an already-open opaque Daily Law capability is
required before an immutable `AccountInfo` parser checks the relative Config
PDA, program owner, mint, bump, strict bytes, and read-only/non-signer/
non-executable flags. That private-field observation supplies no production-ID
freeze, write intent, or phase authorization. The matrix therefore still
records `PARTIAL_STRICT_CODEC_ONLY`,
`BLOCKED_PENDING_GENESIS_STAGING_ACTIVE_CAP_PHASE_RULE`, and
`nativeAdapterComplete: false`; no dispatcher, lifecycle, CPI, durable write,
or public handler was added.

Four additional field-complete projections now use the same strict B3 envelope:
`CoreRewardState` is 128 bytes with magic `IATB3CRW`; `AgencyState` is 96 bytes
with `IATB3AGN`; `AgencyOwnerIndexState` is 96 bytes with `IATB3AOI`; and
`EligibilityState` is 96 bytes with `IATB3ELG`. Golden hashes and per-field
mutation vectors cover all four, every type magic is distinct, all trailing
reserved space must remain zero, cross-type inputs fail, and Eligibility roles
outside `0..=2` fail before encode copies its temporary buffer. Codec existence
does not make the production-inactive Agency path reachable or supply account
ownership, signer, PDA, lifecycle, or persistence checks.

`RoundState` now includes the retained persisted bump immediately after status.
`commit_round_transition` writes the supplied round bump into that field;
settle and expire preserve it; and `CommitRoundResult` no longer duplicates it.
The strict 224-byte `IATB3RND` codec pins status at offset 212, bump at 213, and
a zero tail through 223. Both directions reject statuses outside `0..=2`; an
audited golden hash, per-field vectors, exact-length/type/reserved corruption,
atomic encode failures, and a panic sweep pin the layout. The matrix therefore
records `roundCodecStatus: STRICT_V1`.

Config remains blocked at
`BLOCKED_PENDING_GENESIS_STAGING_ACTIVE_CAP_PHASE_RULE`: byte representation is
no longer the missing piece, but the owner predicate, lifecycle, vacuous-cap
proof, conservation evidence, and mutable adapter remain unresolved. The seven
write-intent candidate codecs plus the separate Config read representation are
preparation only, not a native adapter or handler completion.

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
For `settle_position_week`, the adapter must preserve V2's arbitrary-signer
caller and owner-bound destination, authenticate the config/position/optional-
round/mint/vault-authority/lane/vault accounts, and preserve the exact account
constraint boundary before invoking the pure preflight. It must execute only
nonzero hooked Token-2022 transfers in treasury, ecosystem, liquidity order via
`add_extra_accounts_for_execute_cpi`. Only after all transfers succeed may a
post-CPI finalizer checked-add the total paid and set the settlement bit, then
persist the provisional lane and position reservation values. It must not
prevalidate a later source vault in a way that masks an earlier CPI failure, and
a disposable local validator must prove that every hook, first/second/third
transfer, and post-CPI overflow failure rolls back all token and ledger changes.
For `claim_lane_principal`, the adapter must preserve V2's arbitrary-signer
caller and fixed-beneficiary destination, bind the config, selected lane state,
lane vault, vault-authority, mint, and Token-2022 identities before the pure
preflight, and retain the core blocker until a frozen custody-release policy is
accepted. For a non-core plan it must execute the hooked transfer before
checked-adding `claimable` to `principal_claimed`; it must not prevalidate token
source facts in a way that changes V2 CPI-error precedence. Local-validator
rehearsal must prove atomic rollback for hook, token CPI, and post-CPI overflow
failures.
For `settle_core_week`, no adapter may proceed until canonical core custody and
its release policy are frozen. It must then preserve the arbitrary-signer
caller, bind config/core-reward/lane/vault/mint/Token-2022 identities, execute
only nonzero hooked transfers in treasury, ecosystem, liquidity order, and only
after all succeed checked-add paid and mark the selected low/high word. It must
not add a CCC-disabled guard or prevalidate a later source vault in a way that
masks an earlier CPI failure. Local-validator rehearsal must prove rollback for
each hook/CPI failure and post-CPI paid overflow.

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

### Nonactivating native state adapter

`iat_b3_economy::native_adapter` now provides a host-only preparation boundary
for the frozen economy PDA seed roster and the seven already-strict B3 state
codecs. It derives the singleton config and every PDA/bump from runtime-bound,
non-colliding economy-program and canonical-mint identities, authenticates exact
account key/owner/writable/non-executable/non-signer
shape, cross-checks each decoded state's embedded seed identities and bump, and
additionally binds a lane state's token account and token bump to the canonical
lane-token PDA. Faction child derivations accept opaque, rederived canonical
faction-config, faction-week, and reward-manifest parent capabilities rather
than arbitrary nonzero parent keys.

The opaque Daily Law write capability and every native authorization, intent,
batch, seal, and precondition proof bind the exact Clock timestamp, local day,
law program ID, law-state address and bump, canonical mint, network Genesis
hash, and SHA-256 of the exact validated law-account bytes. The capability mint
must equal the native economy binding's canonical mint at every public boundary;
cross-program, cross-address, cross-bump, cross-mint, cross-network, and
same-decision/different-account-byte capabilities fail closed.

Existing-state intents carry an exact preimage SHA-256 and postimage;
vacant-PDA intents distinguish zero-lamport `CreateAccount` from a prefunded
System-owned `AllocateAssignAndFund` shape. A lifecycle payer has a separate
proof type requiring a writable signature, canonical System Program ownership,
empty data, and an exact lamport preimage. Ordered batches reject duplicate keys,
target/payer collisions, inconsistent payer snapshots, and aggregate funding
above any payer's observed balance. They reauthenticate each unique payer and
validate every target and payer precondition before returning an opaque
all-or-none batch proof. There is no partial-payment or partial-write path.

This is preparation, not execution. Its checked truth surface keeps
`entrypoint_exposed`, `dispatcher_exposed`, `account_writes_executed`,
`system_cpi_executed`, `token_cpi_executed`, `rent_sysvar_authenticated`,
`config_codec_supported`, `runtime_authorization_complete`, and
`any_handler_complete` false, while `mainnet_hold` remains true. Here
`config_codec_supported` is the aggregate mutable-handler/native-adapter flag;
the separate read-only representation does not satisfy it. The caller-supplied
rent minimum is not trusted runtime evidence; a future
adapter must authenticate the canonical Rent sysvar and calculate the minimum.
The host-only native module itself has no authenticated Clock or Rent sysvar
account, `AccountInfo`, mutable borrow, invoke, System/Token CPI, dispatcher,
entrypoint, or public write path. The separate `runtime-write-adapter` feature
now executes only sealed existing-state CAS batches: all immutable validations,
all mutable data borrows, and all second preimage checks complete before the
first byte is copied. It rejects create intents and performs no lamport write,
System CPI, Token-2022 CPI, instruction decode, dispatcher, or entrypoint.
Runtime handler authorization, mutable Config lifecycle, every Genesis phase
transition, and all public exposure remain blocked, so this primitive is not a
Devnet economic handler or a Mainnet authorization.

The separate `runtime-account-lifecycle` feature now executes only sealed PDA
create batches. It validates all target and system-payer preimages before the
first CPI, reconstructs canonical signer seeds internally, and supports the
exact zero-lamport `CreateAccount` or prefunded
`Allocate`/`Assign`/missing-rent-funding sequence. It then requires exact
post-CPI owner, lamports, zeroed codec length, and payer debit before copying
the sealed initial postimage. A failure after the first CPI relies on Solana's
atomic transaction rollback. This is a real internal System Program CPI
primitive, but it has no arbitrary seed/owner/instruction input, Token-2022
CPI, production instruction ABI, entrypoint, dispatcher, public exposure, or
production identity freeze. It has not executed on Devnet, completes no
handler, and leaves Mainnet HOLD.

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
removed without updating this matrix, if the exact structural-only exception
gains a mutable borrow/CPI/production claim, or if the current V2/B3 dependency
and gate boundary silently changes.

The complete fifteen-handler native port order, account-lifecycle boundary,
Token-2022 replacement contract, and fail-closed deployment rule are frozen in
[ECONOMIC_PORT_ARCHITECTURE.md](ECONOMIC_PORT_ARCHITECTURE.md) and its
machine-readable write-gate matrix.
