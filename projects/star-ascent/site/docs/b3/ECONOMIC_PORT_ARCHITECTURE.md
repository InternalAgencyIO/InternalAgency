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

Economic vault accounts remain public-balance accounts. Although the mint
contains `ConfidentialTransferMint`, no economic vault may configure or carry a
confidential pending/available balance; otherwise the public `amount` used by
reservation and cap arithmetic would be incomplete. Vault delegate and close
authority fields must be absent, and the mint must reject unapproved authority-
bearing extensions such as Permanent Delegate or Permissioned Burn.

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
   CPI, randomness, or network boundary.
5. Port the eight account-creating paths with manual post-gate System Program
   CPIs and prove locked/unfinalized calls perform no successful CPI or state
   change.
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
tiebreak transition. None of those may be exposed as a write entrypoint. The
first safe deployable slice is the complete fifteen-row dispatcher behind the
frozen Token-2022 hook, not a single handler.
