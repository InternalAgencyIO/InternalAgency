# B3 V2 feature-parity contract

Status: draft 0.1. The default disposition of every row is **KEEP**.

Only an explicit written owner decision may change a row to **CUT**. Refactoring,
module splitting, framework changes, and cost work do not count as permission
to remove behavior.

| V2 capability or guarantee | B3 disposition | Acceptance evidence |
| --- | --- | --- |
| Fixed 1B IAT supply, 9 decimals | Keep; rewrite as native asset | Genesis supply invariant and replay tests |
| Original SPL representation | Keep during migration; define final relationship explicitly | Supply/custody proof |
| Five allocation lanes | Keep exact amounts | Canonical vector parity |
| Community hardware custody boundary | Keep until migration model replaces it explicitly | Custody review |
| Treasury/ecosystem/core/liquidity vesting | Keep exact cliffs and linear schedules | Boundary vectors |
| Ordered reward lanes | Keep treasury -> ecosystem -> liquidity | Differential tests |
| Full collateral reservation | Keep | Solvency and contention tests |
| No reward debt | Keep | Atomic rejection tests |
| Existing-reservation priority | Keep | Adversarial ordering tests |
| 52-week positions | Keep | Full lifecycle replay |
| 104-week core rewards at 17% | Keep | 104-week settlement-bitmap parity |
| Standard 10% rate | Keep | Weekly/cumulative vectors |
| CCC Agent 28% rate | Keep, Genesis inactive as in V2 | Fail-closed reachability tests |
| CCC Associate 20% rate | Keep, Genesis inactive as in V2 | Fail-closed reachability tests |
| No automatic compounding | Keep | Arithmetic invariant |
| Append-only agency registry | Keep | Duplicate and commitment tests |
| Immutable registry snapshots | Keep | Historical replay |
| Universal one-roll tiebreak | Keep | Shared vectors and bias analysis |
| Exact-uniform rejection sampling | Keep | Cross-language vectors |
| No operator reroll | Keep | Malicious operator tests |
| 24-hour first CCC delay | Keep | Boundary vectors |
| Weekly CCC cadence | Keep | Time vectors |
| 24-hour reveal timeout | Keep | Half-open boundary vectors |
| Terminal expired-neutral settlement | Keep | Liveness and expected-value vectors |
| Switchboard adapter behavior | Keep semantics; replace Solana transport only after review | New adapter audit |
| Program activation/funding invariants | Keep as B3 Genesis/import invariants | Genesis validator |
| Mint/freeze revocation effect | Keep as no post-Genesis issuance/freeze authority | Consensus tests |
| Model T signing boundary | Keep for transitional V2 and any B3 ceremony using it | Physical path review |
| Sole-device concentration risk disclosure | Keep until owner changes authority model | Public risk register |
| Wallet/X binding and uniqueness | Keep | Integration and rollback tests |
| X age/subscription checks | Keep | Provider-bound rehearsal |
| Atomic D1 activation and cap semantics | Keep | Concurrency tests |
| Read-only bounded RPC proxy | Keep; add B3 RPC | Abuse and timeout tests |
| Public network explorer | Keep | Live/query contract |
| English and Turkish public domains | Keep | Host and metadata tests |
| 50-locale route architecture | Keep | Render/hydration matrix |
| Native-language review HOLD policy | Keep | Accountable signoff ledger |
| Inactive future previews | Keep inactive | No-activation-path tests |
| Hero Promotions future DLC | Keep inactive | Separate activation audit |
| Predictive Engine Market preview | Keep inactive | Separate economic/security review |
| Casino DLC preview | Keep inactive | No wager/deposit route tests |
| Admin inspection mode | Keep non-signing | Cross-engine isolation proof |
| Reproducible SBF and source binding | Keep for V2; add reproducible B3 node/runtime builds | Independent reproduction |
| Public audit/evidence chain | Keep and extend | Manifest replay |
| Launch HOLD and ceremony gates | Keep until superseded by stricter B3 gates | Fail-closed regressions |
| Friday Consensus Rule | New B3 base-protocol requirement | Multi-validator boundary and replay tests |

## Change control

Every proposed parity change must record:

1. exact feature or guarantee;
2. owner instruction authorizing the change;
3. white-paper impact;
4. migration impact;
5. security/economic impact;
6. tests added or removed;
7. independent review status.

Silence, cost pressure, schedule pressure, a smaller binary, or difficulty
porting a feature is not authorization to cut it.
