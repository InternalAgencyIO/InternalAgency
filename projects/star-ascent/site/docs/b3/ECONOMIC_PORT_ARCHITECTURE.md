# B3 native economic-port architecture

Status: design contract and deterministic handler inventory; no B3 economic
write entrypoint is implemented or authorized for deployment.

A feature-gated SBF structural preflight now dispatches the exact all-fifteen
account-meta shapes. It is not an economic write entrypoint: it authenticates
no account key or owner, borrows no account data or lamports mutably, performs
no write or CPI, and completes no handler.

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

The law crate's host-test `stake_ingress` source implements a
self-validating 176-byte binding codec, the three canonical economy-PDA
derivations, and the pure fail-closed admission rule. Its integration test
imports the file directly; it is absent from the deployable crate module graph
and cannot be called by `process_execute` or any initialization path. No binding
account is currently created or stored, and there is no binding-account seed,
storage address, or storage opcode. The config derivation retains V2's exact
`["config", mint]` seed. The default economy kernel remains host-only and the
feature-gated SBF surface is structural-only; there is no production economic
entrypoint or frozen program ID. The law program ID is not committed, and the
canonical mint is unpublished. Until all three identities and seed domains are frozen, storing
an initializer-selected economy identity would not be an immutable protocol
law. The final least-cost preference is compile-time frozen stake-vault and
ingress-authority keys. An alternative may embed compact binding facts into the
existing law-state codec before Genesis, but no design may add a new account
meta to every IAT transfer merely for stake ingress. Mainnet remains blocked on
final identity binding, temporary-delegate restoration, and adversarial atomic
rollback rehearsal.

The economy crate's production-source `stake_ingress` kernel and feature-gated
`stake_ingress_runtime` executor now authenticate the finalized OPEN Daily Law
account from `AccountInfo` and `Clock` before any token parsing. The production
entry then requires the same opaque production-ACTIVE Config capability bound
to that exact Law account hash, timestamp, and local day before mint or token
data parsing or CPI. It composes the exact retained V2 `prepare_open_position`
preflight and executes the ten-phase transaction-local ingress sequence. The
older unphased entry remains only for the pinned structural SBF fixture. The
runtime captures the original delegate,
performs an owner-signed exact `ApproveChecked` CPI, verifies its reload,
requires ingress-PDA `invoke_signed` plus hook account expansion, verifies exact
source/vault deltas and allowance consumption, and runs the retained V2
checked-add and Position-construction finalizer. It restores the prior delegate,
refuses completion until the restoration reload is exact, and only then supplies
the exact completed Config/Position/Lane values to the transaction-local
persistence callback. Large preflight and finalizer values are heap-bounded; the
SBF stack gate and loopback rollback matrix pass. A separate production-ACTIVE
Config CAS now revalidates the same opaque Config preimage before and after its
mutable borrow and can increase only retained V2 `staked_principal`; every
other Config field is copied from the authenticated state. It now accepts no
caller-shaped delta: the exact retained-V2 completed ingress must bind the
Config delta, Position principal, all three lane labels/Config bindings, and
the reloaded stake-vault amount. The Config CAS itself does not authenticate
lane AccountInfos. That Config-only write is not the complete persistence path.
A separate preflight
now authenticates the exact treasury, ecosystem, and liquidity AccountInfos in
fixed order and seals their completed-ingress CAS postimages before mutation.
The production ledger executor then acquires all four Config/lane mutable
borrows, revalidates every preimage, and writes all four postimages only after
every check passes. A separate production lifecycle boundary now accepts only
that exact completed ingress, proves the owner-signer payer, derives the
`Position` PDA from canonical Config/owner/position-id seeds, verifies the
retained bump, seals the exact Position postimage, and routes creation through
the production-ACTIVE System CPI executor. The new
`runtime-production-open-position` composition carries the authenticated Daily
Law capability into the post-restoration callback, creates that exact Position,
requires the strict canonical Token-2022 mint capability (exact supply and
decimals, only `ConfidentialTransferMint` plus `TransferHook`, canonical
auto-approve, no auditor, and null mint/freeze/hook/confidential authorities)
before any token CPI, and then executes the four-account Config/lane CAS. Any callback error remains
inside the same instruction and therefore requires transaction rollback of the
earlier Token-2022 and System CPIs. There is still no public lifecycle
dispatcher, frozen identity, entrypoint, or public ABI; those remain the
security boundary.

The exact all-15 production instruction representation is isolated in the pure
`production_instruction` module. Every retained operation has one strict
32-byte `IATB3EC1` version-1 envelope at its canonical ordinal, with six zero
header-reserved bytes and a canonical zero-filled payload. Lane, optional
agency, week/ordinal, position-id, and principal fields have fixed
little-endian layouts; production initialization carries no rehearsal-mode or
timestamp override. The decoder does not evaluate business policy, read
accounts, dispatch, invoke CPI, or write state; therefore it cannot run ahead
of Daily Law. The dispatcher, entrypoint, production identities, executable
account routing, and Mainnet authorization remain incomplete/HOLD.

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

The owner-directed reward update moves only **new, previously unreserved**
weekly faction obligations into the shared reward-lane waterfall. It does not
raid or reclassify any already accepted community-carve-out reservation, and
the existing community hardware-custody lane is not converted into a
permissionless reward source. Scoring inputs, week anchor, tie rule, follower
snapshot, remainder/expiry handling, NFT authority, and solvency remain Mainnet
blockers. Until they are frozen, faction write opcodes remain absent from the
public dispatcher rather than exposing an administrator-controlled placeholder.

### New-obligation reward-capacity policy

The owner-directed reward-capacity waterfall applies only to a sealed UTC
round of new, previously unreserved obligations. Its machine order is CCC
Agent, CCC Associate, standard-10%-rate and X-campaign rewards, an authorized
weekly faction manifest, then core. The current V2 reservations, including the
activation-time core obligation, remain senior and cannot be clawed back or
reordered. An arrival after a round is sealed belongs to a later round; it does
not preempt already accepted collateral.

The existing V1 snapshot-bound SHA-256 rule still selects oversubscribed daily
campaign winners. Activity/node chronology is carried only after selection for
the new obligation allocator; the special earliest-activity/earliest-node rule
applies to underfunded CCC cohorts.

Each obligation or policy-defined X tranche is indivisible. A complete amount
may span treasury, ecosystem, and liquidity in that preserved order, but a
one-base-unit shortage admits nothing. The first unfundable obligation stops
the round so a smaller peer or lower class cannot leapfrog. Every new X-bound
recipient reward uses one of three canonical tranche kinds: `X_BASE_10` at
exactly 1,000 bps for a known non-Premium tier, `X_PREMIUM_FULL_100` at exactly
10,000 bps when the fresh qualification proof already reports
Premium/PremiumPlus, or conditional `X_PREMIUM_UPGRADE_90` at exactly 9,000 bps
after a later accepted upgrade proof. These retain their source priority:
Genesis/social/standard, CCC Agent, CCC Associate, or faction. Core is not
silently declared X-bound, and existing accepted V2 obligations are not
rewritten. No conditional tranche is reward debt, and the upgrade tranche
receives its ordering sequence only when a later fresh Premium proof is accepted. All
identity, activity, round, reservation, payment, cleanup, and receipt writes
remain subject to the canonical Daily Law before mutation.

This is currently a non-activating reference contract. The runtime has no
authenticated X/activity commitment account, sealed-round codec, dispatcher,
Token-2022 CPI finalizer, or rollback proof for it. CCC is still compile-time
inactive, new shared-lane faction obligation creation remains HOLD, and
core custody remains unresolved. No existing handler or public opcode may
infer deployment authority from the reference policy.

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
   production-inactive `prepare_register_agency` host boundary for the retained
   V2 `register_agency` body here: after `NotActive`, it must return the
   immutable compile-time `CccDlcNotActive` result, with the dormant
   record/hash/count construction available only to differential tests. Add
   only the pre-lifecycle `set_eligibility` role-policy and by-value record
   constructor here; administrator/config authentication, wallet-PDA derivation,
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
   `initialize_stake_vault`, `activate`, `prepare_register_agency`, and
   `set_eligibility` `PRE_LIFECYCLE_ONLY` kernels and the five
   `PRE_TOKEN_CPI_ONLY` prepare kernels are not completion of this step and must
   not be exposed until the
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
tenth adds `prepare_open_position` through the exact point before V2's transfer
CPI plus the production-source, dispatcher-disabled atomic ingress state
machine. It preserves active/principal, token-destination, exact stake
ledger, owner/eligibility, standard-versus-CCC, week, reward, and treasury-first
reservation ordering. The returned lane copies and transfer intent are
provisional: it does not run the config staked-principal `checked_add`, construct
`PositionState`, invoke Token-2022, create the position PDA, or persist state.
A future adapter must pass the Daily Law gate, authenticate and decode accounts,
and derive and bind the canonical vault-authority PDA rather than trust the
plan's supplied semantic value. After the pre-CPI plan succeeds, it must manually
create the position lifecycle behind the gate, execute the hooked Token-2022
transfer using `add_extra_accounts_for_execute_cpi`, and only then run a post-CPI
finalizer that updates config and constructs the position. The pure combined
kernel specifies those post-CPI writes and exact delegate restoration by value,
but does not authenticate accounts, invoke Token-2022, or persist them. A
disposable local validator must prove atomic rollback of the position account,
lane reservations, transfer, and post-CPI state when the hook, token CPI, or
finalizer fails. The unsolicited 1-base-unit stake-vault donation
`StakeLedgerMismatch` denial is addressed at the production-kernel level by the
immutable ingress admission design, but active protection remains blocked on
identity freeze, native CPI/lifecycle integration, and combined-binary rehearsal.

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

The fifteenth adds only the production `prepare_register_agency` host boundary
for the retained V2 `register_agency` handler body behind the opaque Daily Law
capability. Its parity claim is deliberately limited to the V2 handler-body
result and error order after the B3 Daily Law gate: an inactive config returns
`NotActive`; an active config then returns `CccDlcNotActive` because the
immutable compile-time CCC Genesis constant is false. This is not exact
end-to-end V2 instruction behavior. V2's generated Anchor account validation
authenticates the administrator/config relationship and, for a call that
reaches the handler, has executed both `agency` and `agency-owner` init
lifecycles. An earlier lifecycle error aborts before the handler; successful
init CPIs are rolled back when the handler returns `NotActive`,
`CccDlcNotActive`, or another `Err`. The B3 host boundary models none of that
lifecycle.

Production cannot construct either agency record, read a clock, append the
registry hash, increment the agency count, create either PDA, invoke the System
Program, or persist state, and merely flipping the constant does not expose a
success path. A private `#[cfg(test)]` seam alone preserves the dormant enabled
handler-body assignment order for source-parity proof: active check; agency
config, owner, and index; validator-Clock-derived week; remaining agency fields;
owner-index fields; registry-hash append; and checked count increment. The raw
`register_agency` function name remains reserved for a future complete native
adapter or dispatcher instruction. Such an adapter is not specified or
authorized while CCC remains immutably disabled; the dormant
administrator/config authentication and both exact V2 PDA derivations are
documented parity facts, not a deployment path. This slice is
`PRE_LIFECYCLE_ONLY`, handler-incomplete, and has no public exposure.

V2 `close_position` releases residual reservations and marks the position
closed; it has no account-close lifecycle. The closed position PDA remains
allocated permanently, so the same owner/config `position_id` is nonreusable.
The B3 matrix deliberately records no `close_position_account` mutation.

The first post-kernel codec slice freezes only the identity-independent B3 byte
layouts for `PositionState` and `LaneState`. Each is an exact 176-byte envelope
with a distinct eight-byte type magic, version byte, zero reserved bytes,
little-endian numeric fields, canonical `0`/`1` booleans, and strict role/lane
discriminants. Encode validates into a temporary fixed buffer before copying,
so an error cannot partially change caller output. Decode rejects wrong type,
version, length, trailing data, reserved bytes, boolean encodings, and invalid
discriminants. This deliberately stricter B3 corruption boundary is not a claim
of V2 Anchor byte-layout or account-validation error-order compatibility.

The Config byte-representation partial is now production source, but the
Config/Genesis decision remains unresolved. `IATB3CFG` v1 is an exact 272-byte
envelope containing every retained `ConfigState` field plus an explicit
`UNINITIALIZED`, `GENESIS_STAGING`, or `ACTIVE` discriminant. It rejects wrong
length/type/version, nonzero reserved bytes, noncanonical booleans, phases, and
lane-mask bits, and disagreement between the phase and retained V2
`active: bool`; encoding is transactional through a temporary fixed buffer.
This prevents the legacy boolean from silently becoming the unstated B3
bootstrap rule while preserving it byte-for-byte as retained V2 semantics.

The representation deliberately has no transition function. It does not choose
the owner-controlled preactivation predicate, vacuous-cap prevention rule,
finalize/activate checks, conservation proof, or authorization evidence. It
does not make an existing uninitialized Config account canonical, require that
such an account exist, or define when either admitted phase edge is legal.
Accordingly the matrix still records
`BLOCKED_PENDING_GENESIS_STAGING_ACTIVE_CAP_PHASE_RULE`, the aggregate stage
remains `PARTIAL_STRICT_CODEC_ONLY`, and `nativeAdapterComplete` remains false.

A production-source, non-executing candidate now makes the intended
non-circular bootstrap rule concrete for owner and independent review. The
`UNINITIALIZED -> GENESIS_STAGING` candidate admits only a production-shaped
Config with zero stake account, principal, agencies, lane mask, and economic
activity; it intentionally does not require Daily Law because no economic
write is yet permitted. The `GENESIS_STAGING -> ACTIVE` candidate first
requires an opaque current OPEN Daily Law capability for the same mint, then a
mint/program-bound exact conservation receipt, the complete lane/stake funding
shape, and zero observable preactivation Config/Lane economic state: staked
principal, agencies, reserved rewards, paid rewards, and claimed principal. It
binds the Config preimage, law account, conservation manifest, and exact current
state facts into the candidate.

The pure candidate is not the frozen phase predicate. Its public input remains
caller-shaped, the owner has not accepted the rule, production identities and
final binaries are absent, and no writer consumes the result. It exposes no
AccountInfo, mutable borrow, CPI, ABI, entrypoint, or dispatcher; all
authorization fields remain false and the Config graph node remains
blocked/Mainnet HOLD.

A separate production-source pure kernel now closes the arithmetic-only part of
Genesis conservation without crossing that boundary. It requires the exact
ordered 500M/200M/150M/100M/50M allocation, 1B supply at nine decimals, five
distinct token accounts and five distinct beneficiary bindings, exact observed
mint/program/authority/balance matches, null base mint/freeze authorities, and
token accounts with no delegate, delegated amount, close authority, frozen, or
native state. Its receipt hashes the proposed destination manifest and proves
that the five observed amounts sum exactly to the observed fixed supply.

This is deliberately structural evidence only. The kernel consumes semantic
observations, not authenticated `AccountInfo` values; the proposed destination
manifest has no owner acceptance or production-identity authority; and it does
not prove absence or retirement of a prior mint, Token-2022 extension authority
seals, a migration, a phase edge, or a write. Those truth fields remain false,
the graph node remains `BLOCKED`, and Mainnet remains `HOLD` until a signed
destination manifest, production identity binding, runtime account adapter,
chain observation, and migration-or-new-mint evidence are independently bound.

Behind `runtime-account-bridge`, a second layer now removes caller-shaped
semantic balances from this path. It accepts only opaque canonical-mint and
public-token-account capabilities returned by the exact Token-2022 parser plus
four opaque strict Lane-PDA capabilities returned by the Daily-Law-gated native
account authenticator. Community custody must bind its token owner directly;
the other four accounts must bind the canonical vault-authority PDA, exact Lane
PDA/role/token account/beneficiary/policy, and zero reserved, paid, and claimed
Genesis accounting before the pure conservation receipt can exist.

This closes runtime authentication of the five observed public balances and
Lane beneficiary bindings, not the graph packet. The owner has not accepted
the manifest, production IDs are still inputs, the parser does not attest
deployed Token-2022 or hook bytecode, and no prior-supply retirement, phase
transition, write, activation, or Mainnet evidence is created. The module has
no mutable borrow, CPI, ABI, entrypoint, or dispatcher and remains `HOLD`.

The runtime bridge now preserves that distinction through opaque capability
types. One wrapper can only be returned after the real Daily-Law AccountInfo and
runtime Clock pass the open-day verifier; another can only be returned after
the Token-2022 and four strict Lane-PDA capabilities pass the conservation
composition. A feature-gated Config/Genesis composer then parses the real
read-only Config PDA with the opaque runtime Law capability, requires the same
Config/mint/token-program binding, derives the five current preactivation facts
from authenticated Config and Lane state, and returns an opaque held activation
candidate.

This authenticates current observable preactivation state. It does not prove a
complete historical absence of prior writes, owner acceptance, production
identity freeze, phase authorization, or execution. Those truth fields remain
false, no write/ABI/entrypoint/dispatcher was added, and the graph remains
`BLOCKED`/Mainnet `HOLD`.

The same runtime boundary now exposes an opaque production-ACTIVE Config
capability. It can only be returned after the runtime Law capability parses the
real Config PDA and the codec reports `ACTIVE`; it additionally rejects
rehearsal mode, non-mainnet supply, incomplete Lane mask, missing stake vault,
zero stake token identity, and zero token-program identity. This prevents the
retained V2 `active` boolean from being accepted alone as B3 activation. The
production existing-state CAS entry now requires this capability and binds it
to the exact Daily Law account hash, timestamp, and local day before account
count validation, borrows, or writes. The lifecycle and Token-2022 CPI paths do
not yet require it, so handler completion and aggregate phase enforcement remain
false/HOLD.

The next strict-codec batch adds only four more field-complete retained
projections: `CoreRewardState` (`IATB3CRW`, 128 bytes), `AgencyState`
(`IATB3AGN`, 96 bytes), `AgencyOwnerIndexState` (`IATB3AOI`, 96 bytes), and
`EligibilityState` (`IATB3ELG`, 96 bytes). They share the versioned exact-length,
little-endian, zero-reserved, wrong-type, and atomic temporary-buffer rules
above. Eligibility additionally admits only the retained roles `0..=2` on both
decode and encode. These byte codecs neither activate CCC nor implement the
Agency/owner-index/eligibility account lifecycle, administrator checks, PDA
binding, or persistence.

`RoundState` is now a field-complete retained projection: its persisted `bump`
follows `status`, the commit transition writes `CommitRoundInput.round_bump`
into that field, and settle/expire preserve it. The redundant bump beside the
round in `CommitRoundResult` was removed. Its strict `IATB3RND` codec is exactly
224 bytes: semantic bytes end with status at offset 212 and bump at 213, while
214 through 223 remain zero. Decode and encode admit only retained statuses
`0`, `1`, and `2`; the fixed golden vector, every semantic field, exact lengths,
wrong types, reserved bytes, atomic failure, and panic-free corruption sweep are
pinned in Rust tests. The matrix records `roundCodecStatus: STRICT_V1`.

Config remains `BLOCKED_PENDING_GENESIS_STAGING_ACTIVE_CAP_PHASE_RULE`: strict
bytes are present, but the phase predicate, lifecycle, conservation, and owner
decision are not. The aggregate stage remains `PARTIAL_STRICT_CODEC_ONLY` and
native-adapter-incomplete. Neither the Config representation nor the Round
codec adds a write path, lifecycle, persistence, dispatcher, CPI, or public
exposure.

The next non-activating adapter slice is available only behind the
`runtime-account-bridge` Cargo feature. It reads real immutable Solana
`AccountInfo` values, sources the Daily Law timestamp from `Clock::get()`, and
sources strict-state creation rent from `Rent::get()`. It passes those runtime
facts into the existing opaque Daily Law verifier, signer/system-payer checks,
seven strict PDA-state codecs, and inert existing/create write-intent builders.
The public runtime functions do not accept a timestamp, rent minimum, transfer
disposition, program identity, mint identity, or network identity from
instruction bytes. Tests use private injected Clock/Rent seams only to prove
the success path on a host without weakening the public sysvar boundary.

This stage is
`FEATURE_GATED_READ_ONLY_ACCOUNTINFO_CLOCK_RENT_NO_DISPATCH` and remains
incomplete. It has no instruction ABI, entrypoint, mutable account borrow,
write, allocation, System Program CPI, Token-2022 CPI, mutable Config adapter,
frozen production-identity binder, complete account-identity graph, or public
exposure. Its Config-only read path requires an already-open opaque Daily Law
capability, then checks the binding-relative Config PDA, program owner, mint,
bump, read-only/non-signer/non-executable flags, immutable data borrow, and the
strict 272-byte codec. The returned private-field observation carries no phase
edge, mutation, or transition authorization. It does not change any matrix row's
`handlerComplete`, the aggregate `DISABLED_UNTIL_ALL_15_PASS` exposure, the
core-custody/faction/Genesis HOLDs, or the complete-dispatcher boundary.

A narrower execution primitive is now isolated behind the separate
`runtime-write-adapter` feature. It accepts only sealed native-adapter batches
containing existing-state CAS intents. Its production entry requires the opaque
production-ACTIVE Config capability and binds that capability to the exact
Daily Law account hash, timestamp, and local day before account-count checks,
borrows, or writes. It then validates all account headers/preimages, acquires
every mutable data borrow, revalidates every preimage while all borrows are held,
and only then copies any postimage. The older unphased entry is retained only
for the pinned local structural lifecycle fixture. Borrow conflicts, stale
bytes, capability drift, duplicate accounts, and create-account intents fail
before the first write. This is real internal account-data persistence for
already-authenticated fixed codecs, but it is not a handler: account creation,
lamport mutation, System CPI, Token-2022 CPI, instruction decoding, entrypoint,
dispatcher, production identities, and public exposure remain absent. No
handler is complete and Mainnet remains HOLD.

The next internal primitive is isolated behind
`runtime-account-lifecycle`. It accepts only sealed create-intent batches from
the native adapter. Its production entry first requires the same opaque
production-ACTIVE Config capability and exact Daily Law observation used by the
CAS path; an inactive, staging, rehearsal, foreign-binding, or stale-Law
capability fails before System Program validation, account borrows, or CPI. It
then validates every target and exact system-owned payer preimage and
reconstructs each canonical PDA signer seed inside the crate. For a zero-lamport
target it performs the exact System Program `CreateAccount` path; for a
prefunded System-owned PDA it performs `Allocate`, `Assign`, then only the
missing rent funding. After CPI it requires the exact owner, lamports,
zero-initialized length, and payer debit before copying the sealed codec
postimage. The older unphased entry is retained only for the pinned local
structural lifecycle fixture. Any later error depends on Solana's atomic
transaction rollback. Arbitrary seeds, owners, instructions, Token-2022 CPI,
instruction decoding, entrypoint, dispatcher, and public exposure remain
absent. The same feature now provides one exact completed-ingress Position
boundary: it binds the retained-V2 completed Config/lane/stake facts, requires
the Position owner as the system payer, reconstructs canonical Position seeds
and bump, and seals that exact Position state into the existing
production-ACTIVE lifecycle executor. This still is not composed with ingress
CPI plus the Config/lane commit in the generic primitive. The narrower
`runtime-production-open-position` composition does execute all three through
one internal post-restoration callback and now reauthenticates the exact
confidential-mint policy before entering Token-2022, while remaining feature-gated and
dispatcherless. It has not been executed on Devnet, completes no public
handler, does not freeze production identities, and keeps Mainnet HOLD.

The same feature now contains a second, explicitly nonactivating rehearsal
surface at
`FEATURE_GATED_READ_ONLY_ALL_15_ACCOUNT_GRAPH_PREFLIGHT_NO_DISPATCH`. Its local
economy Token-2022 parser pins `spl-token-2022-interface =2.1.0`,
`solana-account-info =3.1.1`, and `solana-zk-sdk =4.0.0` without depending on the
Privacy Vault crate. It authenticates the exact canonical mint base plus
`ConfidentialTransferMint` and `TransferHook` TLVs, including canonical
`PodBool` bytes, null authorities, the expected hook program, exact length,
account type, standard executable program IDs, and immutable data borrows. The
economic account parser accepts public-balance accounts only: exact
`TransferHookAccount`, optionally typed `ImmutableOwner`, initialized and
unfrozen base state, canonical non-transferring `PodBool`, no delegate, native
balance, close authority, confidential-account extension, duplicate/unknown
TLV, trailing byte, or cross-mint account. Standard executable IDs are not a
claim about deployed program-data bytes or release identity.

`rehearsal_adapter` inventories all 15 retained public writes and records each
V2 account-role order, signer/writable/executable meta, optional Round slot, and
the currently controlling HOLD. It composes only opaque Daily Law, native
binding, and canonical-mint capabilities; reuses strict state authentication,
public Token-2022 account authentication, and inert atomic-batch sealing; and
can return only a structural meta-shape observation. Caller-supplied role names
do not authenticate identities and the returned value never authorizes a
handler or a Devnet transaction. Genesis-phase/Config-lifecycle, immutable CCC,
core custody/release, production identity, hook-CPI, and dispatcher blockers
remain explicit. Accordingly `any_handler_complete`, Devnet execution, public
driver wiring, instruction ABI, entrypoint, dispatcher, mutable borrows,
writes, CPI, RPC, signing, deployment, and production identity freeze all
remain false; Mainnet remains HOLD.

The separate `sbf-preflight-entrypoint` feature freezes only a 16-byte
`IATB3PF1` structural envelope and operation index for those same fifteen
account graphs. Its SBF dispatcher compares account count plus every
signer/writable/executable bit, then returns without reading account data. A
loopback validator rehearsal finalized one signed transaction for each of the
fifteen shapes and rejected a readonly-signer downgrade with custom error 3.
The 21,120-byte rehearsal artifact has SHA-256
`3bdffb2bcd9ee919e012d71522c8667883efea196ce5b58a2aef354b720a1588`.
The explicit-`--execute` Devnet runner executed against the immutable program
`D8FDYUMd5PZxDenEDvE3KRERzKdU8k3rrebw173HUZLh`. It finalized all fifteen
structural operations, rejected a signer downgrade in simulation with custom
error 3, and removed every disposable funded account. It pins
only `https://api.devnet.solana.com`, the canonical Devnet Genesis hash, the
exact artifact, and the reviewed file-backed payer; requires an immutable
deployment; and removes its disposable funded accounts and key files. The
source-bound evidence is
[`iat-b3-economy-sbf-structural-devnet-20260810T141607Z.json`](evidence/iat-b3-economy-sbf-structural-devnet-20260810T141607Z.json).
This proves loader/entrypoint/meta-shape compatibility only. Account identities,
owners, data, Daily Law, Config phase, mutation order, CPI, rollback, production
ABI, public Devnet deployment, every handler, and every release gate remain
unproven and false/HOLD.

None of these kernels may be exposed as a write entrypoint. The first safe
deployable slice is the complete fifteen-row dispatcher behind the frozen
Token-2022 hook, not a single handler.
