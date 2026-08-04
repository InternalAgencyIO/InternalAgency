# IAT V2 findings

> **DRAFT — MAINNET HOLD — OPEN FINDINGS — NOT AN EXTERNAL AUDIT — NOT LAUNCH AUTHORITY**

The source of truth is [findings.json](findings.json). Severity describes the
worst credible impact under the documented preconditions; it does not claim
that exploitation has occurred.

## Summary

| Severity | Open | Launch effect |
| --- | ---: | --- |
| Critical | 2 | Must be fixed before any deployment/funding decision |
| High | 7 | Must be fixed or publicly accepted by independent multi-party review |
| Medium | 5 | Remediate or document bounded residual risk before release |
| Low | 2 | Track to closure; not independently launch-clearing |

Current decision: **HOLD**.

## Critical

### IAT-SEC-001 — CCC round reveal-withholding permanently blocks a week

`commit_round` is permissionless and creates the unique round PDA for the
current week. The payer supplies and signs for the immediately preceding
Switchboard commit. If a malicious payer commits first and then refuses to
reveal, the round remains at status `0`. The program has no expiry, cancel,
replacement, fallback outcome, or recovery instruction.

Every CCC-linked position that spans that week needs a settled round. Its week
bit can never be set, and `close_position` requires all 52 bits. Principal can
still be returned at maturity, but residual reservations and complete position
closure remain blocked. This is a permanent, low-cost external liveness attack.

The Switchboard documentation itself treats selective revelation as critical
and makes clear that the player triggers reveal. Exact atomic commit validation
prevents outcome manipulation before commitment; it does not force liveness
after commitment.

Required fix: a recovery protocol that expires a missing reveal without giving
any party a reroll or candidate-set rewrite. Restricting the committer alone is
not sufficient unless availability and compromise are also handled.

### IAT-SEC-002 — one key combines upgrade, administration, and custody

`PROGRAM_ADMIN` and `COMMUNITY_CUSTODY` are the same address, and launch plans
also assign it program upgrade authority. The hardware wallet improves private
key isolation, but it does not create multi-party authorization or role
separation. Upgrade authority can replace the program logic that controls PDA
vaults; the same key can also register agencies/set eligibility and directly
control the 500M-IAT community account.

This contradicts the repository's own requirements for multi-party protection
of high-value transfers and separation of deployment, upgrade, treasury,
pause, and oracle roles.

Required fix: distinct roles plus multi-party control. A final decision must
choose between a timelocked multisig upgrade path and making the independently
verified program immutable. The final on-chain ProgramData state must be
published.

## High

### IAT-SEC-003 — node UUID is an authorization bearer

Wallet verification returns `nodeId`. `select-country` and `x/authorize` accept
only that UUID, with no fresh wallet proof or bound server session. The callback
then puts the UUID in a URL. Leakage lets another party attach its X identity or
immutable country choice to the victim's pending wallet binding.

Required fix: a Secure/HttpOnly/SameSite session bound to the wallet challenge
plus one-time transition nonces; never put authorization-capable IDs in URLs.

### IAT-SEC-004 — Premium is not enforced

The accepted identity rule for this audit is one unique wallet + one immutable
X user ID + X Premium, with multiple qualifying pairs per person allowed. The
callback only requests `id`; it does not request `subscription_type`. The
schema cannot record a Premium observation.

Required fix: define allowed tiers, request and verify the authenticated user's
`subscription_type`, persist tier and observation time, fail closed on missing
or unknown values, and specify downgrade/revalidation behavior.

### IAT-SEC-005 — exact 1,000-slot transaction is blueprint-only

The reviewed SQL blueprint has a `genesis_slots` table with a 1..1000 primary
key. The deployed-migration source does not. The callback simply activates a
binding. No serial transaction allocates the last slot, returns capacity
reached, or reconciles the public cap.

Required fix: production migration and concurrency tests for 999, 1000, 1001,
and simultaneous last-slot requests.

### IAT-SEC-006 — known release/build dependency advisories

The canonical npm lock graphs are not clean at high severity. Production-only
dependency sets report zero, but electron-builder is release infrastructure and
the site dev graph supplies compiled framework/admin/chain tooling. Treating
all dev dependencies as harmless would be inaccurate.

Required fix: upgrade and regenerate locks, rebuild, rerun all checks, and
document reachability for any unavoidable exception. The alternate pnpm lock
must be removed or made canonical-equivalent.

### IAT-GAME-001 — CCC registry padding dilutes the pause

Uniform randomness is not the same as economically correct candidates. The
administrator can append any unchecked wallet. There is no owner consent,
Premium-bound identity proof, active position, bond, or expiry. Inactive/dummy
owners can absorb selections and reduce the pause probability of active
agencies.

Multiple qualifying wallet/X/Premium pairs are allowed by owner policy. The
fix is therefore not personhood; it is to enforce the published cost and define
which economically active pair belongs in each weekly candidate snapshot.

### IAT-GAME-002 — aggregate daily liability is unspecified

At 12 IAT per pair per day, 1,000 active pairs imply 12,000 IAT/day or
4,380,000 IAT/year. The daily population is not capped at 1,000, so the actual
liability can be higher. The policy names a capped distributor but supplies no
exact epoch cap, lifetime budget, refill rule, or deterministic oversubscription
behavior.

Because multiple Premium pairs per person are intentionally accepted, account
creation is rational whenever expected rewards exceed subscription and
operating cost. Publish the budget and exhaustion rule rather than relying on
X pricing as a permanent deterrent.

### IAT-ASSURANCE-001 — independent final-code audit missing

Functional tests, CodeQL, this review, and signed Devnet evidence are different
controls. None is an independent Solana security audit of the final code and
SBF. The repository policy requires independent assurance proportional to the
value at risk.

Required fix: remediate first, then commission review of the final commit,
verified SBF hash, program ID, oracle recovery, authority model, and economic
assumptions.

## Medium

- **IAT-SEC-007:** production time begins at config initialization, so a delayed
  partial ceremony advances vesting and CCC clocks before activation.
- **IAT-SEC-008:** the public network endpoint can amplify one request into
  multiple RPC calls/`getProgramAccounts` without rate, cache, or cost budgets.
- **IAT-SEC-009:** X token/profile calls lack explicit deadlines and the callback
  configuration is not exact-allowlisted.
- **IAT-SEC-010:** the Merkle engine accepts Base58-shaped strings rather than
  exact 32-byte public keys and uses insertion-order `JSON.stringify` for the
  policy digest.
- **IAT-SEC-011:** tracked npm and pnpm locks reproduce different site graphs.

## Low

- **IAT-SEC-012:** Electron auto-approves display/media capture without explicit
  local-origin and navigation containment.
- **IAT-QUALITY-001:** Rust tests pass, but strict clippy is not warning-clean.

## Positive controls retained

The audit did not find an EVM-style reentrancy path. The program makes no
arbitrary untrusted CPI; SPL Token is pinned through Anchor's `Program<Token>`,
destination owners/mints are checked, PDA seeds bind vaults, and Solana
transaction failure rolls state back atomically. Arithmetic uses checked
operations and release overflow checks. Mint/freeze revocation and exact vault
funding are activation preconditions. Reward reservations prevent accepted
positions from creating unbacked reward debt. These controls are valuable, but
they do not repair the open liveness and authority failures.

## Severity and closure policy

- **Critical:** credible permanent asset/liveness loss or catastrophic control
  compromise. No risk acceptance by a single operator.
- **High:** material authorization, economic, supply-chain, or assurance failure.
  Fix by default; exception requires public multi-party rationale and bounded
  evidence.
- **Medium/Low:** track to a named owner and deadline; prove reachability or
  mitigation rather than closing from scanner disappearance alone.

Every fix changes the audited source. Closure therefore requires a new package
revision bound to the fixed commit and tree, not an edit to this finding text.
