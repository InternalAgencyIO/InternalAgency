# B3 V2 feature-parity contract

Status: draft 0.1. The default disposition of every row is **KEEP**.

Only an explicit written owner decision may change a row to **CUT**. Refactoring,
module splitting, framework changes, and cost work do not count as permission
to remove behavior.

| V2 capability or guarantee | B3 disposition | Acceptance evidence |
| --- | --- | --- |
| Fixed 1B IAT supply, 9 decimals | Keep in the single canonical B3 IAT mint | Supply invariant and replay tests |
| Original SPL representation | Preserve only as migration source if it exists; one hooked Token-2022 mint must become canonical for IAT-wide enforcement | Live mint identity, supply, and migration proof |
| Optional Privacy Vault | New opt-in confidential balance on the same canonical IAT mint; no wrapper token and no global auditor by default | Exact-version Devnet hook/proof tests, key recovery, privacy-boundary review |
| Five allocation lanes | Keep exact amounts | Canonical vector parity |
| Community hardware custody boundary | Keep for the remaining community lane; owner-directed faction rewards require one fixed, capped, pre-funded PDA carve-out whose exact amount is still HOLD | Custody review, fixed-cap proof, and zero-increase test |
| Treasury/ecosystem/core/liquidity vesting | Keep exact cliffs and linear schedules | Boundary vectors |
| Ordered reward lanes | Keep treasury -> ecosystem -> liquidity | Differential tests |
| Full collateral reservation | Keep | Solvency and contention tests |
| No reward debt | Keep | Atomic rejection tests |
| Existing-reservation priority | Keep | Adversarial ordering tests |
| 52-week positions | Keep | Full lifecycle replay |
| 104-week core rewards at 17% | Keep accrual arithmetic; route protocol-originated delivery through the new immutable core-custody cap | 104-week settlement-bitmap parity plus daily cap/burn reconciliation |
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
| AI-generated unverified localization policy | Keep | Deterministic integrity gates and visible disclosure |
| Inactive future previews | Keep inactive | No-activation-path tests |
| Hero Promotions future DLC | Keep inactive | Separate activation audit |
| Predictive Engine Market preview | Keep inactive | Separate economic/security review |
| Casino DLC preview | Keep inactive | No wager/deposit route tests |
| Admin inspection mode | Keep non-signing | Cross-engine isolation proof |
| Reproducible SBF and source binding | Keep for V2; add reproducible B3 node/runtime builds | Independent reproduction |
| Public audit/evidence chain | Keep and extend | Manifest replay |
| Launch HOLD and ceremony gates | Keep until superseded by stricter B3 gates | Fail-closed regressions |
| Daily Lockdown Law | New immutable IAT-wide law: exact 1%/66.67% bucket thresholds, half-open fixed-UTC+03:00 protocol days from 00:01 to 00:01, first successful permissionless finalization at or after the boundary, lagged Solana slot-hash input, fail closed until finalized, no external oracle or privileged IAT bypass. Solana-wide scope, first-block decision, unbiased threshold VRF, and independent clock are explicitly relaxed. | Public/confidential canonical-IAT hook invocation, `00:00:59`/`00:01:00` boundary, negative-time, absent-day, consecutive-day, rollback, replay, malicious-finalizer, timing-influence, and external-reproduction tests |
| Five operator factions | New fixed B3 application module: Radiance, Ellie, Alia, Ece, and `the boss`; narrative leaders have no keys; one allegiance per operator; exact 86,400-second switch cooldown; every write directly law-gated | Fixed-ID, cooldown, no-op, lockdown, unique-winner, accounting, and adversarial identity tests |
| Weekly faction rewards | New owner-directed community use, HOLD until scoring/Sybil/tie rules and an immutable capped community carve-out are specified | Prefunding, solvency, conservation, snapshot, equal-share, remainder, expiry, and authority tests |
| Core-team 10% live-supply cap | New immutable B3 custody/release law whose cap day rolls at fixed-UTC+03:00 00:00; the sole write transition atomically burns/reconciles and finalizes Daily Law at or after 00:01; no permanent delegate; enforceable only over protocol-custodied core flows | Exact post-burn formula, Clock boundary, idempotence, `00:00..00:01` inbound-change race, stale-day, authority, BurnChecked CPI, and lockdown-ordering tests |

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
