# B3 reward-capacity waterfall

Status: executable reference contract only. It is blocked, non-activating, and
does not authorize a deployment, funding movement, claim, CCC activation,
faction carve-out, or change to the immutable Daily Law.

## Fixed boundaries

The priority of **new and previously unreserved** obligations is:

1. CCC Agent;
2. CCC Associate;
3. standard 10%-rate and X campaign rewards (owner label: "10% reward lanes");
4. weekly faction manifest;
5. core.

Existing reservations always win. In particular, the retained V2 activation
path reserves the complete existing 104-week core obligation before accepting
user positions. This reference cannot raid or reorder that reservation. The
owner rule "Core last" therefore applies only to a future, not-yet-reserved
obligation.

Within any shared reward-reserve obligation, physical capacity remains
treasury, then ecosystem, then liquidity. Core principal is not a reward
source. An obligation may draw from more than one of the three lanes only when
the complete exact amount can be reserved or transferred atomically. If the
next higher-priority obligation is short by even one base unit, it receives
nothing and no peer or lower class may leapfrog it. The protocol creates no
reward debt.

The JavaScript allocator is a pure reservation planner. `ADMITTED_RESERVED`
and `plannedByLane` describe an atomic plan; they are not a persisted payment,
token transfer, or CPI, and the reference never increments a paid balance. An
X reward state can consume a result only with its exact allocator receipt,
boundary seal, finalized typed round state, and, when needed, the sealed CCC
reveal. Outcome validation deterministically recomputes the complete allocation,
post-ledger, receipt set, and finalization from the sealed inputs before it
accepts an exact result. Rehashing a caller-invented disposition cannot make it
valid.

Allocation consumes a typed by-value `SEALED_PENDING_FINALIZATION` round state
and returns its `FINALIZED_NON_ACTIVATING` successor. Supplying that returned
state to allocation again is rejected. Production must persist the successor
atomically under the unique round key; a stale copy remains an explicit
nonactivation blocker, not an alternate replay-guard parameter.

Every UTC funding round seals one complete candidate and capacity snapshot at
its designated `00:00 UTC` boundary, before allocation. The seal commits the
exact round, boundary timestamp, every due obligation, class, amount,
chronology, candidate-set digest, and exact treasury/ecosystem/liquidity ledger
with all existing reservations, paid balances, and withdrawals. The allocator
has no free ledger input. It also seals a complete canonical CCC precommit-
registry snapshot. A due obligation omitted from the boundary snapshot becomes
logically `NULL_MISSED` at boundary plus one second; it cannot enter, reopen, or
recreate the round. A new late-arriving obligation may use only a later round
allowed by its own policy. A finalized typed state cannot accept a second or
conflicting finalization.

Allocation may execute one second or much later from the immutable boundary
seal without changing its candidate set, capacity, order, or result. Execution
delay is not a miss. Failure to create the complete seal at the boundary is.
The finalization binds the pre-ledger and post-ledger digests. This reference
checks the supplied boundary timestamp and snapshot but does not authenticate
the clock or completeness adapter; both remain deployment blockers.

A reader never infers a miss merely from wall-clock time. It resolves the
designated round key: exact membership in that immutable seal is pending or
admitted according to its finalization; omission, or an absent boundary seal,
is `NULL_MISSED`. Neither omission nor absence is decidable at or before the
boundary; the earliest decision timestamp is exactly boundary plus one second
under an authenticated clock. `applyXBoundMissedFundingOutcome` records that
terminal result under open Daily Law, voids a base tranche's upgrade child, and
prevents the obligation from being rebuilt. Claim-expiry cleanup also terminates
any still-pending tranche so it cannot survive as rebuildable work.

Any already accepted or reserved faction obligation under the existing fixed,
capped community carve-out is grandfathered and cannot enter this new
waterfall. A **new and unreserved** weekly faction manifest competes for shared
treasury, ecosystem, then liquidity capacity after the standard/X class and
before core. It is one indivisible obligation; the waterfall never pays only
some followers. Individual `FACTION_FOLLOWER` fragments cannot enter the
waterfall. Exactly one new aggregate manifest may enter a funding round, and it
binds the canonical complete follower-payout list, exact total, follower count,
week ID, and payout digest. An underfunded faction head nulls the complete
manifest and blocks core.

CCC remains compile-time inactive at Genesis. These semantics do not activate
the DLC.

## New X-bound rewards

The 10/90 rule applies to every **new** reward whose recipient is X-bound. The
source kind preserves its waterfall class for every applicable tranche:

| Source kind | Priority class |
| --- | --- |
| `GENESIS_AIRDROP` | `STANDARD_10_PERCENT_AND_X_CAMPAIGN` |
| `X_INTERACTION` | `STANDARD_10_PERCENT_AND_X_CAMPAIGN` |
| `STANDARD_POSITION` | `STANDARD_10_PERCENT_AND_X_CAMPAIGN` |
| `CCC_AGENT` | `CCC_AGENT` |
| `CCC_ASSOCIATE` | `CCC_ASSOCIATE` |
| `FACTION_FOLLOWER` | `WEEKLY_FACTION` |

There is no generic `AIRDROP` kind: a Solana Devnet faucet airdrop can never
enter this policy. Core is not automatically X-bound, and this reference does
not invent a core X identity. Existing accepted or reserved V2 obligations are
grandfathered and are never retroactively split. CCC and faction rewards remain
inactive/HOLD despite having future source-class mappings here.

The machine class `STANDARD_10_PERCENT_AND_X_CAMPAIGN` includes standard
10%-rate obligations plus Genesis/X interaction tranches. All layers use the
same three tranche kinds and exact basis points: `X_BASE_10` is 1,000,
`X_PREMIUM_FULL_100` is 10,000, and `X_PREMIUM_UPGRADE_90` is 9,000.

Gross amounts must be positive whole IAT base-unit amounts divisible by ten.
A fresh, known non-Premium observation (`None` or `Basic`) creates two
indivisible tranches: exactly 10% is eligible immediately and exactly 90% is
locked. Missing, unknown, future-dated, or stale subscription evidence fails
closed. A fresh `Premium` or `PremiumPlus` identity at qualification creates
one indivisible `X_PREMIUM_FULL_100` tranche. It is never represented as a base
plus upgrade pair and therefore cannot claim only 10% of an admitted full
reward.

The locked 90% becomes eligible only when a later fresh Premium observation is
bound to the same immutable X user ID and wallet, is itself strictly later than
the original epoch close and prior observation, and is recorded before the
original claim expiry. Its proof-acceptance sequence must be strictly greater
than both original activity and node sequences. Its queue sequence is the
maximum of those three sequences. It therefore cannot inherit an old free-
account queue position and jump later Premium users.

Funding decisions and claims use separate clocks. The immediate non-Premium
10% or already-Premium full-100 tranche is attempted once from the sealed original
epoch-close `00:00 UTC` snapshot. After a later qualifying upgrade, the 90% is
attempted once from the sealed first-`00:00 UTC` snapshot strictly after the
Premium proof is accepted. An unfunded tranche or one omitted from its
designated boundary seal is permanently null. Delayed execution of a valid
seal is not omission. If the base/full original attempt fails, no later upgrade
entitlement survives.

A successfully admitted tranche is fully reserved and remains claimable for
the original policy-bound 30-day half-open claim window. At that separate claim
expiry, an unclaimed reservation is logically null and releasable. Funding
failure, funding-round nulling, and claim expiry never create debt or permit
recreation. Cleanup may occur later, permissionlessly and idempotently, only
after the immutable Daily Law permits writes.

"No partial payment" applies to each protocol-defined 10%, full-100%, or 90%
tranche. A
non-Premium participant can therefore receive the complete 10% tranche before
an upgrade and the complete 90% tranche after an eligible upgrade; neither
tranche may be shaved, prorated, or partially funded.

## Daily Law first

Every state-changing entry point must validate the canonical current open
Daily Law capability before validating or mutating reward state. Missing,
copied, forged, stale, unfinalized, or locked law state fails closed before a
reservation, tier update, payment, cursor movement, expiry cleanup, or token
transfer intent exists.

The reward UTC boundary does not alter the immutable IAT Daily Law. That law
continues to use its fixed UTC+03:00 protocol day and 00:01 decision boundary.
A lockdown blocks the designated reservation attempt, so a still-unreserved
tranche becomes logically null once its round passes. A tranche fully admitted
and reserved before lockdown remains claimable until its separate original
30-day expiry. Cleanup waits for an open Daily Law state.

## Deterministic CCC ordering

Within an underfunded CCC tier, candidates are ordered by the earliest
immutable `qualifyingActivityStartSlot`, then the earliest immutable
`nodeActivationSlot`. For an X-bound CCC tranche, the next key is its X
eligibility sequence; an upgrade uses the maximum including its fresh Premium-
proof acceptance sequence. An exact tied cohort is canonically committed by
qualification-PDA bytes before randomness. One revealed 256-bit value produces
an exact-uniform ordering without replacement using rank-domain-separated
decision contexts and rejection sampling. Before the funding round, the seal
must bind a complete canonical precommit-registry snapshot containing exactly
one source and SHA-256 reveal commitment when an exact tie exists. An absent,
multi-entry, duplicate, digest-mismatched, or reveal-mismatched registry fails
closed. The allocator
accepts no free decision context: it derives the context from the policy,
round, candidate digest, sealed capacity digest, registry digest, and reveal
commitment. The
finalization binds the unique reveal digest, source, and derived context. The
operator cannot substitute a reveal after sealing.

The activity and activation slots require new immutable account fields or a
separately reviewed qualification record. They must not be inferred from an
RPC arrival time, mutable profile metadata, or caller-provided timestamp.

Non-CCC chronology likewise comes from a precommitted authenticated adapter,
not a free caller ordinal. The reference sorts the committed funding round,
eligibility sequence, activity sequence, node sequence, immutable identity,
and commitment digest. Authentication of that chronology adapter, the source-
kind adapter, canonical CCC precommit-registry/randomness provenance, atomic
typed-round-state persistence, allocator-receipt persistence, and the round-
snapshot clock/completeness adapter is intentionally absent and remains a
deployment blocker.

## Reference boundary

The pure implementation is
`programs/iat_b3_reference/reward-capacity-waterfall.mjs`. Focused vectors are
in `tests/iat-b3-reward-capacity-waterfall.test.mjs`. The committed JSON policy
is checked by `scripts/validate-iat-b3-reward-capacity-waterfall.mjs`.

Passing this reference suite is not Mainnet evidence. Production account
layouts, identity attestations, faction funding, CCC activation, atomic Token-
2022 CPIs, reviewed binary identities, and Devnet rehearsal remain blocked.
