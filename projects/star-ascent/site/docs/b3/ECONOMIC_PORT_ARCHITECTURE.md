# B3 native economic-port architecture

Status: design contract and deterministic handler inventory; no B3 economic
write entrypoint is implemented or authorized for deployment.

This document defines the minimum safe port of all fifteen public IAT V2 write
handlers to the canonical Token-2022 B3 mint. It preserves V2 arithmetic and
state-transition behavior except where the owner-requested core-custody burn
law creates an explicit unresolved conflict. It does not authorize a partial
dispatcher, Devnet write, Mainnet write, funding transaction, or authority
change.

The machine-readable companion is
[`iat-b3-economic-write-gates.v1.json`](iat-b3-economic-write-gates.v1.json).

## 1. Non-negotiable deployment boundary

No B3 economic write handler may be publicly reachable until all fifteen
retained V2 handlers pass the same canonical Daily Law gate, all Token-2022
transfers supply the hook's exact extra accounts, and the complete dispatcher
passes local-validator adversarial tests. Porting one handler first means
implementing and testing it behind a non-deployable internal boundary. It does
not mean exposing a partially gated program.

Every handler follows this order:

1. read and validate immutable program IDs, account keys, owners, lengths,
   discriminators, PDA seeds, and canonical mint binding;
2. read Solana `Clock` and validate the exact Daily Law PDA;
3. decode the fixed law-state schema and recompute the stored decision from its
   committed entropy, cluster identity, mint, and day;
4. require the decision day to equal the current fixed-UTC+03:00 protocol day
   and require the canonical result to be open;
5. only then borrow writable account data, create or close an account, emit a
   state-derived event, or invoke System, Token-2022, randomness, or another
   program.

Missing, stale, future, malformed, wrong-owner, wrong-mint, unfinalized, and
selected-lock state all fail closed. A caller-provided boolean or disposition
string is never accepted as law state.

Transaction rollback is not a substitute for gate placement. A generated
Anchor `#[account(init)]` or `init_if_needed` constraint performs a System
Program CPI while account validation is running, before the handler body or an
`access_control` function. The native B3 port must therefore create every PDA
manually after step 4. If an interim Anchor prototype exists, it must also use
unchecked, exact-address account inputs plus manual post-gate creation; no
write-handler context may contain `init`, `init_if_needed`, `realloc`, or
`close` constraints.

## 2. Program and module boundary

| Boundary | Responsibility | Authority rule |
| --- | --- | --- |
| `iat_b3_consensus` | Pure day mapping, draw derivation, decision validation, and shared vectors | No entrypoint or mutable state |
| `iat_b3_law` | Token-2022 Transfer Hook, fixed law-state PDA, permissionless daily finalization | Frozen program; hook, mint, freeze, and confidential-mint authorities revoked |
| `iat_b3_economy` | Native port of all fifteen V2 handlers, vault ownership, reservations, positions, CCC inactive boundary, core-cap burn CPI, and isolated faction module | Frozen program; only its PDAs sign vault operations |
| Optional privacy UX | Creates and manages holder-authorized confidential accounts and proofs | No protocol custody or bypass; the same mint and hook apply |

The economic and faction code should be modules in one native program for the
first size measurement. A separate faction program duplicates loader and
dispatcher overhead and creates another cross-program authority boundary. The
faction opcode range, PDA seeds, reward ledger, and tests remain isolated from
the V2 port so that no faction rule can consume a V2 reservation lane. If audit
or upgrade-isolation evidence later justifies a separate program, its aggregate
deployment cost must be measured rather than assumed.

The law program must not own a token-transfer release path. A law instruction
that invokes Token-2022 for the hooked IAT mint would produce
`Law -> Token-2022 -> Law hook`, which is forbidden indirect program
reentrancy. Economic-program transfers produce the valid
`Economy -> Token-2022 -> Law hook` call stack.

## 3. Canonical accounts

The final source must freeze exact program IDs and seed domains. The proposed
addresses are:

| Account | Address/owner | Purpose |
| --- | --- | --- |
| canonical mint | fixed public key; Token-2022 owner | Nine-decimal live supply; exact approved extension allowlist |
| law state | `PDA(law, ["law-state", mint])`; law owner | One current deterministic decision |
| hook validation | standard `extra-account-metas` PDA; law owner | Resolves the law state for every transfer |
| economic config | `PDA(economy, ["config", mint])`; economy owner | V2 Genesis anchor, active flag, vault bindings, registry commitment, and bumps |
| vault authority | `PDA(economy, ["vault-authority", config])` | Sole signer for public economic vaults |
| lane state | `PDA(economy, ["lane", config, lane])` | Exact V2 lane accounting |
| lane token account | deterministic Token-2022 account bound by lane state | Treasury, ecosystem, core custody, and liquidity balances |
| stake token account | deterministic Token-2022 account bound by config | User principal custody |
| positions and CCC state | same semantic seed inputs as V2 under the new program ID | Versioned B3 encodings of retained V2 state |

`iat_b3_economy` validates the law account directly; it does not CPI to the law
program merely to ask whether a write is allowed. The verifier checks the law
program ID, PDA, owner, exact codec, mint, network identity, deterministic draw,
current day, and open result. Each Token-2022 transfer then executes the mint's
hook as a second independent enforcement layer.

## 4. Token-2022 replacement contract

Every V2 `Program<Token>`, `Account<Mint>`, `Account<TokenAccount>`, and
`token::transfer_checked` boundary is replaced with explicit native validation
against the canonical Token-2022 program.

For each public transfer the economic program must append the exact hook
validation PDA and law-state PDA to the Token-2022 `TransferChecked` CPI. A
plain four-account transfer instruction is incomplete for the canonical mint.
Source, destination, mint, owner/delegate, decimals, PDA signer seeds, hook
validation account, and law state are all revalidated before invocation.
The native adapter must use Token-2022's exact
`add_extra_accounts_for_execute_cpi` flow to resolve and append the frozen
hook account list; hand-assembled or omitted hook accounts are not equivalent.

Economic vault accounts remain public-balance accounts. Although the mint
contains `ConfidentialTransferMint`, no economic vault may configure or carry a
confidential pending/available balance; otherwise the public `amount` used by
reservation and cap arithmetic would be incomplete. Vault delegate and close
authority fields must be absent, and the mint must reject unapproved authority-
bearing extensions such as Permanent Delegate or Permissioned Burn.

Exact V2 stake accounting also exposes a separate Mainnet blocker. Both
`open_position` and principal withdrawal require the public stake-vault token
balance to equal `config.staked_principal` exactly. An unsolicited transfer of
even 1 base unit into that vault therefore causes `StakeLedgerMismatch` and can
deny future position operations. The parity kernel intentionally preserves this
equality and must not silently relax it; Mainnet needs an immutable mitigation
that retains ledger solvency and cannot create an administrator sweep path.

The selected mitigation is a dedicated
`PDA(economy, ["stake-ingress", config])` transfer authority. The law hook will
leave ordinary destinations unchanged and reject every transfer into
`PDA(economy, ["stake-token", config])` unless that exact PDA is the
Token-2022-validated transfer-authority key. The economic adapter will
atomically substitute it as an exact-amount temporary delegate for a position
deposit, run the hooked Token-2022 transfer via `invoke_signed`, and restore the
source account's prior delegate state. There is no donation sweep and no ledger
relaxation.

The pinned Transfer Hook 2.1.0 ABI de-escalates the authority account to a
read-only non-signer before hook execution. The hook therefore matches the
authority key but never checks `is_signer`; Token-2022 performs owner/delegate
authentication before setting `TransferHookAccount.transferring`, and the hook
already requires that transferring flag. The crate has a regression test for
the non-signer authority meta.

The law crate's test-only native reference currently implements a
self-validating 176-byte binding codec, the three canonical economy-PDA
derivations, and the pure fail-closed admission rule. It lives outside
`src/lib.rs`, so the reference boundary is absent from the current SBF artifact.
It does not wire that rule into hook execution or initialization; no binding
account is currently created or stored, no binding address helper exists, and
there is no binding storage opcode. The config derivation retains V2's exact
`["config", mint]` seed. The economy program is still host-only and has no
frozen program ID, the law program ID is not committed, and the canonical mint
is unpublished. Until all three identities and seed domains are frozen, storing
an initializer-selected economy identity would not be an immutable protocol
law. The final least-cost preference is compile-time frozen stake-vault and
ingress-authority keys. An alternative may embed compact binding facts into the
existing law-state codec before Genesis, but no design may add a new account
meta to every IAT transfer merely for stake ingress. Mainnet remains blocked on
final identity binding, temporary-delegate restoration, and adversarial atomic
rollback rehearsal.

Burning is different from transferring. The sole core-cap burn path uses
Token-2022 `BurnChecked`, signed by the economic vault-authority PDA. It is not
a mint-authority operation and it is not a Transfer Hook call.

## 5. Core-cap integration and unresolved parity conflict

The least-privileged implementation treats `mint.supply` as live supply and
only program-custodied core flows as attributable to the core team. Both
definitions remain provisional until the owner accepts them for Mainnet.

Daily finalization and cap reconciliation are one transaction:

1. `iat_b3_law::finalize_day` proves the current law state is unfinalized;
2. the law-state PDA signs a CPI-only capability call into
   `iat_b3_economy::reconcile_core_cap`;
3. the economy program requires that exact signer, law owner/PDA, canonical
   mint, core lane/custody account, vault authority, and Token-2022 program;
4. both programs independently compute the minimal checked-`u128` burn
   `ceil(max(0, 10*C - S) / 9)` and the economy program invokes `BurnChecked`;
5. the law program reloads mint and custody balances and requires
   `10 * C_post <= S_post` before it records the day's decision.

All effects roll back if either the burn or the decision write fails. No
separate cap-state account is required when finalization is the only daily
reconciliation path; a current canonical decision proves reconciliation ran.
This performs the passive-program burn on the first permissionless finalizer at
or after local 00:01, not autonomously at exactly 00:00. Exact autonomous
midnight execution is impossible on Solana and must remain an explicit relaxed
claim.

V2 `settle_core_week` currently pays an ordinary fixed beneficiary, and the
core lane of `claim_lane_principal` does the same. Once paid, those tokens can no
longer be attributed or burned without a permanent delegate, custody, or an
identity oracle. B3 must therefore route both flows through canonical core
custody and define a new release/spending policy. Exact V2 direct payout and an
enforceable post-release core cap cannot both be claimed. These two matrix rows
remain Mainnet-blocked until the owner accepts the custody semantics; no port
may silently choose one.

Activation also exposes a separate bootstrap-order blocker. The `activate`
write must pass a finalized, open Daily Law decision, but an atomic
`finalize_day` plus core-cap reconciliation cannot unconditionally require an
already activated core-custody regime: that would prevent pre-activation days
from finalizing and therefore prevent `activate` itself. The frozen adapter must
define an immutable pre-activation, vacuous-cap phase and a one-way activation
transition that proves the fully funded canonical core custody and atomically
seals normal cap enforcement, or freeze another equally explicit non-circular
bootstrap rule. The exact phase predicate, accounts, replay guard, and atomic
transition remain unresolved; the host-only activation kernel does not solve
this blocker.

## 6. Faction boundary

The five fixed factions use a separate opcode namespace and PDA domain inside
`iat_b3_economy`. Allegiance, cooldown, weekly score, result, and reward-vault
state never modify V2 `Config`, `LaneVault`, `CoreReward`, `Position`, or `Round`
encodings. Every faction mutation runs the same canonical Daily Law gate before
its first mutable borrow or CPI.

Faction rewards require a fixed, capped, pre-funded community carve-out. The
existing community hardware-custody lane is not silently converted into a
permissionless reward source. Scoring inputs, week anchor, tie rule, carve-out,
follower snapshot, remainder/expiry handling, NFT authority, and solvency remain
Mainnet blockers. Until they are frozen, faction write opcodes remain absent
from the public dispatcher rather than exposing an administrator-controlled
placeholder.

## 7. State and migration compatibility

Compatibility is semantic, not byte-for-byte:

- B3 accounts have a new owner program, versioned native codec, canonical
  Token-2022 mint, and new PDA addresses;
- every V2 amount, week, rate, reservation, bitmap, registry hash, round status,
  and accepted position identifier is preserved exactly;
- V2 Genesis timestamp remains the economic epoch, so lockdown delays execution
  but never pauses accrual;
- reserved bytes and version tags fail closed to permit deterministic decoding
  without accepting ambiguous layouts.

An Original SPL mint cannot be converted into a Token-2022 mint, and a new
program cannot sign for V2-owned PDAs. If V2 has no funded live state, B3 should
start directly from the frozen V2 policy and no state migration is required. If
funded V2 state exists, Mainnet requires a finalized cutover slot, account/data
hash manifest, balance conservation proof, duplicate-claim prevention, and an
old-token lock/burn or escrow mechanism. The current V2 binary has no migration
marker or read-only cutover instruction; if it were already immutable, safe
live-position migration would be blocked.

No migration importer may be deployed as a general administrator write path.
It must accept a one-time immutable manifest root, prove every source record,
mark each source identity consumed, conserve token and reservation totals, and
permanently close after the committed set is exhausted.

## 8. Incremental implementation and verification sequence

1. Freeze this handler inventory and the shared law-state interface codec.
2. Implement a pure, no-entrypoint V2-to-B3 policy/state transition library and
   differential-test it against Rust V2 and the JavaScript reference engine.
3. Implement the canonical Daily Law verifier and adversarial account fixtures;
   do not add a public economic dispatcher.
4. Port state-only transitions as internal functions, beginning with
   `expire_round`, `close_position`, and `settle_round`; retain the compile-time
   inactive CCC boundary and compare exact outputs/errors. `close_position` is
   second because it is a reachable V2 business transition with no lifecycle,
   CPI, randomness, or network boundary. Add only the pure pre-lifecycle
   `commit_round` adjacent-instruction proof and snapshot constructor here; its
   round-account creation remains in step 5. Add only the pre-lifecycle
   `initialize_config`, `initialize_lane_vault`, `initialize_stake_vault`, and
   `activate` validation/state-construction kernels here; signer and account
   authentication, PDA derivation, account allocation/funding, Token-2022
   initialization, and persistent writes remain in step 5. Add only the
   production-inactive `register_agency` boundary here: after `NotActive`, it
   must return the immutable compile-time `CccDlcNotActive` result, with the
   dormant record/hash/count construction available only to differential tests.
   Add only the
   pre-lifecycle `set_eligibility` role-policy and by-value record constructor
   here; administrator/config authentication, wallet-PDA derivation,
   create-or-update lifecycle, and persistence remain in step 5. Add only the
    `prepare_open_position` pre-token-CPI validation, provisional reward-lane
    reservation, and transfer intent here. It must not perform the config
    staked-principal `checked_add`, construct `PositionState`, invoke a program,
    or persist any provisional result. Add only the
    `prepare_withdraw_position_principal` active/open/destination/maturity/stake-
    ledger validation and transfer intent here. It must return unchanged config
    and position snapshots, and must not decrement tracked principal, mark the
    position returned, invoke a program, or persist state.
    Add only `prepare_settle_position_week` through V2's ordered reservation
    consumption and stop before its first nonzero reward transfer. It must return
    provisional lane/reservation copies and treasury, ecosystem, liquidity
    transfer intents, while leaving position paid and settlement bits unchanged.
    Add only `prepare_claim_lane_principal` through V2's nonzero-claim check,
    then fail closed for the core lane while custody release remains unresolved.
    A non-core success returns an unchanged lane snapshot and one transfer intent;
    it must not invoke Token-2022 or increment principal claimed.
    Add only `prepare_settle_core_week` through V2's ordered reservation
    consumption, then always fail closed while core custody remains unresolved.
    Its test-only parity plan leaves paid and settlement words unchanged.
5. Port the eight account-creating paths with manual post-gate System Program
   CPIs and prove locked/unfinalized calls perform no successful CPI or state
   change. The existing `initialize_config`, `initialize_lane_vault`,
   `initialize_stake_vault`, `activate`, `register_agency`, and
   `set_eligibility` `PRE_LIFECYCLE_ONLY` kernels and the five
   `PRE_TOKEN_CPI_ONLY` prepare
   kernels are not completion of this step and must not be exposed until the
   corresponding lifecycle/CPI adapters exist.
6. Port Token-2022 vault transfers and exercise the real hook for
   `open_position`, both settlement handlers, principal claim, and principal
   withdrawal on a disposable local validator.
7. Close the core-custody meaning and release-policy decisions, then add the
   CPI-only burn capability and atomic finalizer integration.
8. Add the isolated faction module only after its funding, scoring, tie, and
   reward rules are frozen.
9. Enable the public dispatcher only when every matrix row, direct-hook test,
   wrong-owner/mint/program test, stale/missing/locked-day test, CPI rollback
   test, and V2 differential vector passes together.
10. Measure the complete optimized SBF artifacts, account rent, compute units,
    transaction account lists, and aggregate fresh-payer peak. If the retained
    implementation exceeds 3 SOL, report it; do not remove V2 behavior or a law
    check to force the target.
11. Perform a fresh signed Devnet rehearsal and independent review before any
    Mainnet ceremony is considered.

The first safe coding slice is the pure transition library plus the read-only
canonical law verifier and internal `expire_round` transition. The second adds
only the by-value `close_position` ledger transition behind the same opaque law
capability, with V2 differential tests. The third adds only `settle_round`: its
production wrapper remains CCC-disabled, while its private by-value kernel
differential-tests the exact V2 Switchboard reveal validation and uniform
tiebreak transition. The fourth adds only the host-side `commit_round` proof and
snapshot kernel: it verifies the immediately preceding Switchboard commit and
returns pending state without creating an account. The fifth adds only the
`initialize_config` handler-body validation and initial `Config` construction
by value behind the opaque Daily Law capability. The sixth adds only
`initialize_lane_vault` handler-body validation, exact retained lane-policy and
beneficiary projection, and the by-value lane-mask result. The seventh adds only
`initialize_stake_vault` handler-body validation and its by-value config binding.
The eighth adds only `activate` handler-body validation, exact funding and
authority-shape checks over already decoded values, week-zero reward
reservation, core-reward construction, and the by-value active flag. All four
Genesis kernels are explicitly `PRE_LIFECYCLE_ONLY`: they do not authenticate
signers or accounts, bind or deserialize the canonical mint and token accounts,
derive or create PDAs, invoke the System or Token-2022 programs, or persist
state. The activation slice also does not resolve core payout custody or the
pre-activation/vacuous-cap bootstrap rule. The ninth adds only
`set_eligibility` handler-body policy and by-value record construction. It
preserves standard-role success with the no-agency sentinel and preserves the
compile-time-inactive CCC boundary before the otherwise unreachable missing or
invalid agency checks. It does not authenticate the administrator or config,
derive the wallet-bound eligibility PDA, implement V2 `init_if_needed`
create-or-update lifecycle, invoke the System Program, or persist a record. The
tenth adds only `prepare_open_position` through the exact point before V2's
transfer CPI. It preserves active/principal, token-destination, exact stake
ledger, owner/eligibility, standard-versus-CCC, week, reward, and treasury-first
reservation ordering. The returned lane copies and transfer intent are
provisional: it does not run the config staked-principal `checked_add`, construct
`PositionState`, invoke Token-2022, create the position PDA, or persist state.
A future adapter must pass the Daily Law gate, authenticate and decode accounts,
and derive and bind the canonical vault-authority PDA rather than trust the
plan's supplied semantic value. After the pre-CPI plan succeeds, it must manually
create the position lifecycle behind the gate, execute the hooked Token-2022
transfer using `add_extra_accounts_for_execute_cpi`, and only then run a post-CPI
finalizer that updates config and constructs the position. A
disposable local validator must prove atomic rollback of the position account,
lane reservations, transfer, and post-CPI state when the hook, token CPI, or
finalizer fails. The unsolicited 1-base-unit stake-vault donation
`StakeLedgerMismatch` denial remains a Mainnet blocker and is not relaxed by
this parity slice.

The eleventh adds only `prepare_withdraw_position_principal` through the exact
point before V2's transfer CPI. It preserves active config, open position,
destination mint/owner, already-returned, checked maturity, validator-Clock week,
term-completion, sufficient tracked principal, and stake-vault mint/authority/
exact-balance precedence. Its unchanged config and position snapshots plus
stake-vault-to-owner transfer intent are provisional. It does not decrement
`config.staked_principal`, set `position.principal_returned`, invoke Token-2022,
or persist state. The future adapter must independently derive and bind the
canonical config, position, stake-vault, vault-authority, mint, and Token-2022
identities; preserve V2's arbitrary-signer caller and owner-bound destination;
run the hooked transfer via `add_extra_accounts_for_execute_cpi`; and only then
run a post-CPI finalizer for both state changes. A disposable local validator
must prove atomic rollback on hook, token, and finalizer failure. Exact
stake-vault equality, including the donation-griefing failure, is preserved.

The twelfth adds only `prepare_settle_position_week` through the exact point
before V2 begins its reward-vault transfers. It preserves active/open,
destination mint/recorded-owner, validator-Clock week, checked term and bit,
duplicate, standard-round omission, immutable CCC-inactive, floor-delta reward,
and treasury/ecosystem/liquidity reservation-consumption precedence. Its private
differential seam can exercise the retained dormant settled and expired-neutral
round branches, but the production wrapper always supplies the compile-time
false CCC constant. Success returns provisional lane and position-reservation
copies plus three ordered transfer intents. Zero amounts must be skipped exactly
as V2 skips them. The plan deliberately does not checked-add `position.paid` or
set the settlement bit: both occur only after all nonzero CPIs in V2, so moving
the paid overflow into preflight would change which CPI or arithmetic error wins.
The future adapter must authenticate the arbitrary signer and owner-bound
destination boundary, independently bind every config/position/round/lane/vault/
mint/Token-2022 identity, execute hooked transfers in treasury, ecosystem,
liquidity order, and run a post-CPI paid/bit finalizer before persisting the
provisional ledgers. A disposable local validator must prove atomic rollback for
each hook/transfer failure and the post-CPI overflow case.

The thirteenth adds only `prepare_claim_lane_principal` through the exact point
before V2 transfers vested principal. It preserves active, stored-lane equality,
claimable-lane range, destination mint then fixed beneficiary, validator-Clock
week, cumulative-unlock arithmetic, checked `reserved + paid +
principal_claimed`, saturating subtraction, and nonzero-claim precedence. Only
after those retained checks does the production path reject `CORE_TEAM` with
`CoreCustodyPolicyUnresolved`; the core release-policy conflict above therefore
remains explicit rather than being silently resolved. A private `#[cfg(test)]`
parity seam proves the former V2 direct-payout result but is absent from
production behavior. Non-core success returns one hooked-transfer intent and an
unchanged lane snapshot. It deliberately does not validate source-vault
mint/authority/balance facts that V2 leaves to the transfer CPI, invoke a CPI, or
checked-add `principal_claimed`. The future adapter must bind every account/PDA
and Token-2022 identity, execute the hooked transfer, and only then apply that
checked addition atomically; hook, token, and post-CPI overflow failures require
local-validator rollback proof. This slice is handler-incomplete and has no
public exposure.

The fourteenth adds only `prepare_settle_core_week` through the exact point
before V2 begins its treasury, ecosystem, and liquidity reward transfers. It
preserves active, destination mint then fixed core beneficiary, stored term,
payable-week arithmetic, validator-Clock current week, low/high settlement-word
selection and duplicate rejection, floor-delta reward, and three-lane
reservation-consumption precedence. V2 does not apply the compile-time CCC
disabled guard to this handler, so the host kernel does not invent one. Only
after every retained pre-CPI check does production return
`CoreCustodyPolicyUnresolved`; a private `#[cfg(test)]` seam alone exposes the
former direct-beneficiary plan for differential proof. The plan contains
provisional reservations and ordered transfer intents but leaves `paid` and both
settlement words unchanged. Source-vault failures remain at the future CPI
boundary, and paid overflow remains after all successful CPIs, preserving V2
error precedence. A future adapter must first freeze canonical custody and its
release policy, independently bind all accounts and PDAs, execute only nonzero
hooked transfers in order, then checked-add paid and mark the selected word in
the same transaction. This slice is handler-incomplete and has no public
exposure.

The fifteenth adds only the production `register_agency` boundary behind the
opaque Daily Law capability. It exactly preserves V2's observable current
behavior: an inactive config returns `NotActive`; an active config then returns
`CccDlcNotActive` because the immutable compile-time CCC Genesis constant is
false. Production cannot construct either agency record, read a clock, append
the registry hash, increment the agency count, create either PDA, invoke the
System Program, or persist state, and merely flipping the constant does not
expose a success path. A private `#[cfg(test)]` seam alone preserves the dormant
enabled handler-body order for source-parity proof: active check, validator
Clock-derived week, agency record, owner-index record, registry-hash append, and
checked count increment. A future lifecycle adapter is intentionally not
specified or authorized while CCC remains immutably disabled; the dormant
administrator/config authentication and both exact V2 PDA derivations are
documented parity facts, not a deployment path. This slice is
`PRE_LIFECYCLE_ONLY`, handler-incomplete, and has no public exposure.

V2 `close_position` releases residual reservations and marks the position
closed; it has no account-close lifecycle. The closed position PDA remains
allocated permanently, so the same owner/config `position_id` is nonreusable.
The B3 matrix deliberately records no `close_position_account` mutation.
None of these kernels may be exposed as a write entrypoint. The first safe
deployable slice is the complete fifteen-row dispatcher behind the frozen
Token-2022 hook, not a single handler.
