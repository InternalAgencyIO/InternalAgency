# Reward ledger v2 non-activating blueprint

Status: **BLUEPRINT ONLY / NON-ACTIVATING / NO MIGRATION / NO RUNTIME PATH**

This contract and `reward-ledger.v2.schema.sql` describe a candidate evidence
and accounting boundary. They do not modify `binding-ledger.schema.sql`, expose
an API route, register a runtime or migration command, reserve IAT, create reward debt, sign
or broadcast a transaction, or authorize Genesis/Mainnet use. Every SQL object
is prefixed `reward_v2_`; the guard row permanently records that runtime wiring,
migration, and a global allocator are absent.

## Identity boundary

A v2 node exists only after all of these facts are recorded together:

- OAuth proves control of one immutable, canonical numeric X user ID;
- the destination wallet signs the wallet-bound challenge;
- one immutable two-letter country code is present;
- the X account is at least exactly 40 days old when control is observed; and
- the node, X ID, wallet, proof digests, and append-only history sequence agree.

An unverified identity never means an unbound identity. Here it means an
OAuth-bound identity whose exact observed subscription tier is non-Premium.
The only admitted tier strings are `None`, `Basic`, `Premium`, and
`PremiumPlus`. Missing, unknown, malformed, or provider-failed values have no
fallback tier. Observations are append-only, evidence-digest unique, globally
sequenced, and fresh for the half-open 24-hour interval beginning at the
provider observation. Qualification must use the latest accepted observation
known at that instant; choosing an older still-overlapping observation to
manufacture a later upgrade is rejected.

`reward_v2_identity_tombstones` is permanent. Its globally unique X ID and
wallet prevent delete/rebind/re-entry games. Node identity, tier observations,
history, actions, candidates, Genesis acceptances, daily epochs and selections,
allocator batches and decisions, grants, and receipts are append-only. Every
table has a `BEFORE INSERT` conflict guard over its primary and unique
identity/replay keys. These guards reject statement-level `INSERT OR REPLACE`
deletion even if a connection turns `recursive_triggers` off; the schema also
enables recursive triggers as defence-in-depth.

## Qualifying actions

The complete action enum is:

- `original`
- `reply`
- `quote`
- `repost`
- `like`
- `follow`

Every action binds the node, UTC day, canonical campaign-target SHA-256 digest,
unique evidence digest, and one append-only acceptance sequence. Original,
reply, quote, and repost evidence requires the immutable numeric provider
activity ID and provider event time.

X lookup surfaces do not provide a reliable event time for a like or follow.
Those two types therefore admit no provider activity ID/time and instead use
the first observation's UTC timestamp plus a positive finalized Solana slot.
Later observations cannot reuse the same node/action/target tuple in another
epoch. A persistent partial unique index excludes `utc_day` for like/follow
target replay. Immutable numeric provider activity IDs and evidence digests are
globally replay-unique for post-shaped actions. A canonical target digest is
mandatory for both lookup-shaped actions.

`bookmark`, `view`, `impression`, unattributable activity, and every unknown
type are forbidden. The selected qualifying-action ledger admits at most one
action and one `DAILY` candidate for a node in one UTC day. A node's separate,
one-time `GENESIS` candidate may coexist on that day. Input order, browser
time, handles, display names, and mutable profile fields do not determine
eligibility.

## Campaign amounts and ordering

All amounts are IAT base units at nine decimals:

| Campaign | Nominal full reward | `X_BASE_10` (1,000 bps) | `X_PREMIUM_FULL_100` (10,000 bps) | `X_PREMIUM_UPGRADE_90` (9,000 bps) |
| --- | ---: | ---: | ---: | ---: |
| Genesis | 100 IAT (`100000000000`) | 10 IAT (`10000000000`) | 100 IAT (`100000000000`) | 90 IAT (`90000000000`) |
| Daily | 12 IAT (`12000000000`) | 1.2 IAT (`1200000000`) | 12 IAT (`12000000000`) | 10.8 IAT (`10800000000`) |

Genesis ranks come from `reward_v2_genesis_acceptances`, not directly from a
candidate. The dedicated append-only sequence accepts only the next contiguous
rank, permanently binds it to one node, day, timestamp, and evidence digest,
and stops at 1,000. A Genesis candidate must foreign-key the exact acceptance;
it cannot forge or reassign the rank. A partial unique index also forbids the
same node from receiving another Genesis candidate on a later day. Daily
candidates require one qualifying action. Candidate uniqueness is scoped to
`(node, campaign, UTC day)`: duplicate Daily candidates fail, while one-time
Genesis and Daily are independent nominal programs and can coexist.

The intended D1 operation inserts the acceptance and its candidate in one
serialized transaction. SQLite checks contiguous ranks, immutability,
uniqueness, and the candidate foreign key, but it cannot require every newly
inserted acceptance to acquire its candidate before transaction commit. The
future adapter must treat an orphan acceptance as a failed/held transaction and
must prove real concurrent last-slot behavior; this blueprint does not claim
that production D1 transaction evidence.

## Frozen daily epoch and selection evidence

The Daily campaign does not treat every candidate as a winner. An append-only
`reward_v2_daily_epochs` row freezes the designated funding round, candidate
snapshot digest, exact `IAT_DAILY_BUDGET_V1_ASCENDING_SHA256` algorithm and
`IAT_DAILY_BUDGET_V1` score domain, V1 policy hash, finalized Solana slot and
block hash, and a chained budget attestation. Its integer ordinal is contiguous and
limited to `1..365`. Each epoch admits no more than 1,000 selected candidates,
exactly 12 IAT nominal per selection, no more than 12,000 IAT nominal per day,
and no more than 4,380,000 IAT nominal cumulatively. Refill and recycling are
hard-coded false.

Each `reward_v2_daily_selections` row binds one Daily candidate to that epoch
and its designated funding round. It records the frozen policy and snapshot,
finalized-slot hash, V1 selection-score digest, rank `1..1000`, and independent
attestation digest. Round-plus-rank, round-plus-candidate,
round-plus-selection-score, candidate, and attestation replays are unique;
ranks must append contiguously in ascending V1 score order and cannot exceed
the epoch's selected count.
Every Daily allocator tranche, including a later Premium upgrade, must bind
this original selection. Every Genesis tranche instead binds its immutable
Genesis acceptance.

Stock SQLite cannot recompute the frozen SHA-256 lottery or prove that an epoch
row's declared selected count has exactly that many selection rows at commit.
A future authenticated service/validator must recompute the V1 score and
attestation over canonical bytes, prove that the chosen ranks are the actual
top-N winners against the complete frozen snapshot, and a serialized D1 budget
finalizer must insert the epoch plus its complete selection set atomically or
hold the whole epoch. These are explicit activation blockers, not deployability
claims.

The three tranche names are mutually tier-bound. An original `None`/`Basic`
candidate can receive the complete 1,000-bps base and, after a later upgrade,
the complete 9,000-bps conditional bonus. An original
`Premium`/`PremiumPlus` candidate can receive only one atomic 10,000-bps
`X_PREMIUM_FULL_100`; it cannot independently claim base plus upgrade pieces.
None is a partial payment of an already owed amount: every tranche is nominal
evidence until a global allocator issues one full receipt. The schema contains
no allocator implementation.

`X_PREMIUM_UPGRADE_90` requires the same node and immutable X ID, an original
`None` or `Basic` observation, a prior `ADMITTED_RESERVED` `X_BASE_10` allocator
receipt, and a fresh `Premium` or `PremiumPlus` observation accepted strictly
after the original funding round. The upgrade uses a strictly later funding
round: the next midnight after that proof. Its eligibility sequence is exactly
the accepted Premium-proof sequence, which must already exceed the original
activity, node, and initial-proof sequence. A failed original admission cannot
produce a payable upgrade.

All three tranches use the single class name
`STANDARD_10_PERCENT_AND_X_CAMPAIGN`. This blueprint does not implement the
larger CCC/faction/core waterfall, alter existing reservation priority, or make
the class name an authorization to consume any active lane.

## UTC funding rounds and expiry

Every designated funding round is decided against the frozen state at its
exact `00:00:00.000Z` boundary. Its exact state machine is:

```text
collecting -> sealed -> global_allocator_pending -> allocator_recorded -> terminal
          \-> null       \-> null                    \-> null
```

Every row must be inserted initially as `collecting`, before its boundary, with
all lifecycle-result fields null; direct insertion of a sealed, null, recorded,
or terminal round is rejected. `sealed_at_utc` must equal that boundary. Both its candidate snapshot and its
global lane/reservation snapshot are immutable thereafter. Candidate insertion
requires the round still be collecting, so no candidate or capacity may enter
after the seal. There is no 24-hour eligibility window. An omitted or unsealed
boundary obligation becomes decidably null at
`00:00:01.000Z`; every null decision and receipt is rejected before that
instant. A grant backed by a valid frozen seal may be recorded/executed later,
but still before the candidate's claim expiry.

SQLite cannot authenticate wall-clock time supplied by an adapter. The future
serialized writer must prove that candidate acceptance and seal persistence
actually occurred by the recorded boundary. This remains an explicit activation
gate; a backdated field is not authenticated clock evidence.

`origin_utc_day` is the closed UTC day containing the qualifying daily action,
or the day containing the canonical Genesis acceptance. Every candidate stores
and foreign-keys an immutable `original_funding_round_at_utc`: the next exact
`00:00:00.000Z` after that origin day. Base and already-Premium full grants can
use only that designated round; a midday Genesis acceptance therefore cannot
use the already-passed midnight. A later upgrade uses the next exact midnight
after the accepted Premium proof, never the already-open round. Every candidate
expires exactly `2,592,000` seconds after its designated original funding
round. The 30-day claim interval is half-open and payment at the exact expiry
second is rejected.

The only null reasons are:

- `daily_unfulfilled_at_utc_boundary`
- `global_allocator_absent`
- `insufficient_full_tranche_capacity`
- `waterfall_blocked_by_higher_priority`
- `parent_tranche_unfunded`
- `identity_or_evidence_held`
- `premium_upgrade_proof_not_fresh`
- `claim_window_expired`
- `policy_hold`

Boundary-null receipts cannot be recorded before the exact miss-decidable
instant. A null receipt and allocator grant are mutually exclusive for the
same candidate and tranche. Allocator dispositions map one-to-one to their
reason, including first-head `NULL_UNDERFUNDED` versus later
`NULL_BLOCKED`; callers cannot relabel a blocked tail as an independent capacity
failure. Null is terminal: it cannot be retried or recycled.

## Atomicity, receipts, and replay

Before a global allocator batch and its candidate/tranche receipt exist, a
candidate is nominal evidence only: it reserves no lane balance and creates no
claim or debt. An allocator grant is valid only after an append-only
`reward_v2_allocator_batches` row and append-only
`reward_v2_allocator_receipts` row exist. Strict foreign keys and field-match
triggers bind the batch, funding round, both frozen snapshots, Daily selection
or Genesis acceptance, tranche, amount, eligibility sequence, decision digest,
and receipt digest. A null receipt has the same antecedent and exact field
binding. A grant or null row cannot mint its own unbound digest.
Partial-payment, retry, and recycling flags are hard-coded false.

The batch deliberately records `runtime_authentication_verified = 0`: this
blueprint establishes database ancestry, not a signature-verification
implementation. An authenticated global-allocator/boundary-monitor adapter and
canonical batch-byte verifier remain mandatory before activation.

Each funded tranche has at most one terminal receipt:

- `paid_full` requires the complete grant amount, the originally signed wallet,
  a unique transaction-evidence digest, and a time before expiry; or
- `expired_unpaid` records zero paid, no transaction, the exact expiry reason,
  and no recycling.

Evidence, allocator-decision, allocator-receipt, null-receipt,
transaction-evidence, and terminal-receipt digests are replay unique. A failed
transaction must leave no partial ledger row; repeating a successful identity,
action, tranche, or receipt collides with a unique key rather than paying again.

## Deliberate non-claims

This blueprint does not prove one biological human, make free X identities
Sybil-resistant, implement X collection, authenticate adapter wall-clock
persistence, recompute or authenticate V1 SHA selection scores/top-N
completeness, prove the atomic Daily budget finalizer, cryptographically authenticate a global
allocator, reserve or transfer tokens, wire Daily Law, reconcile the core cap,
select CCC/faction/core priority, or establish deployability. Any future
implementation still requires those missing authenticated/atomic decisions, an
accepted allocator/funding design, canonical Daily Law checks on every economic
write, atomic core-cap integration, local-validator/Devnet adversarial evidence,
independent review, and an explicit migration decision.
