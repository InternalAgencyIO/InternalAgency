# STAR ASCENT — Genesis and daily X participation rewards

## Decision state

This subsystem is **`HOLD_PENDING_GLOBAL_REWARD_WATERFALL`** and `publicationAllowed` is `false`. The policy and pure engine can classify candidates, apply the exact queue, split nominal rewards, and model a later Premium upgrade. They cannot reserve a reward lane, publish a claim root, activate an API route, write a durable entitlement, or send IAT.

The hold is immutable until the IAT-wide UTC 00:00 waterfall can evaluate every competing reward class from one exact unlocked-lane snapshot with no partial payments. Collection coverage for every X action, especially likes and follows, is also a launch gate.

## Frozen amounts and caps

| Program | Nominal reward | Maximum nodes | Time/campaign cap |
| --- | ---: | ---: | ---: |
| Genesis Gift | 100 IAT | First 1,000 eligible bound nodes | One per wallet and immutable numeric X ID |
| Daily X reward | 12 IAT | 1,000 nodes per closed UTC day | 365 accounted epochs; 4,380,000 nominal IAT lifetime |

The daily epoch maximum is 12,000 IAT. Every selected daily node consumes the full nominal 12 IAT from epoch and lifetime caps at its original UTC 00:00 round. A smaller immediate tranche, an unreserved entitlement, a later null, or an expired claim never reduces or refills that accounting.

Every artifact carries a fixed source kind: Genesis is `GENESIS_AIRDROP`; daily activity is `X_INTERACTION`. Source kind is bound into candidate, original-claim, lineage, entitlement, leaf, and upgrade-obligation commitments so 100-IAT and 12-IAT records cannot be exchanged.

These are participation rewards, not yield, interest, APY, or a promise of value.

## Identity and observation requirements

Every Genesis or daily candidate fails closed unless the evidence binds all of the following:

- successful X OAuth authentication;
- the immutable numeric X user ID, never a mutable handle;
- a public Solana wallet proven by a wallet-signature challenge;
- a selected two-letter country code;
- an X account at least 40 full days old at the round snapshot; and
- one known subscription observation no more than 24 hours old: `None`, `Basic`, `Premium`, or `PremiumPlus`.

A missing, unknown, future, malformed, or stale tier observation is not treated as non-Premium. It is rejected. Existing pair semantics remain: one wallet and one immutable X ID per bound pair; a separately qualifying pair is not collapsed merely because the same person may control it.

The exact observed X `subscription_type` is the only payout-tier key. X's `verified` boolean or blue-check presentation is informational and cannot override it: `verified: true` with `None`/`Basic` still receives 10%, while `verified: false` with fresh `Premium`/`PremiumPlus` still receives 100%.

## Genesis reservation and funding plan

`buildGenesisRewardPlan` is a separate held pure planner and never routes Genesis through legacy `buildEpoch`. It requires a complete authenticated first-1,000 binding-registry snapshot digest plus, for every candidate, an immutable reservation sequence, reservation time, receipt digest, designated funding round, wallet/X binding, identity evidence, and allocator chronology slots.

Reservations sort by their immutable numeric sequence. Only sequences 1 through 1,000 can enter the plan. The output `reservationRank` is the original sequence itself; it is never reassigned from array position. Thus an omitted snapshot containing only true reservation 999 still reports rank 999, not rank 1. The pure engine cannot authenticate completeness, so the durable registry adapter and complete-snapshot proof remain explicit launch blockers.

The designated funding round must be the next UTC 00:00 after the sealed reservation snapshot. Tier evidence must be fresh at that round. Each immediate candidate and conditional entitlement uses the exact 100-IAT nominal source. Claim validity is half-open: `[fundingRoundAtUtc, fundingRoundAtUtc + 30 days)`. The exact expiry instant is excluded and no upgrade can extend it.

## Exact tranche rules

All three machine tranche kinds map to reward class `STANDARD_10_PERCENT_AND_X_CAMPAIGN`, whose owner-facing label is **10% reward lanes**. Their amount invariants are exact: `X_BASE_10` is always 1,000 basis points, `X_PREMIUM_FULL_100` is always 10,000 basis points, and `X_PREMIUM_UPGRADE_90` is always 9,000 basis points.

| Fresh observed tier at the original round | Immediate atomic tranche | Deferred record |
| --- | ---: | ---: |
| `None` or `Basic` | 10% as `X_BASE_10` | Conditional 90% candidate as `X_PREMIUM_UPGRADE_90` |
| `Premium` or `PremiumPlus` | 100% as `X_PREMIUM_FULL_100` | None |

The split is performed in IAT atomic base units. Genesis therefore splits to exactly 10/90 IAT for a known non-Premium node; daily splits to exactly 1.2/10.8 IAT. No tranche may be prorated.

The engine deliberately emits a **conditional entitlement candidate**, not an active entitlement. The future global waterfall must admit the original 10% `X_BASE_10` tranche in full at its original UTC 00:00 round and atomically promote the candidate. If that tranche is unfunded or null, no 90% entitlement is created. A Premium 100% `X_PREMIUM_FULL_100` record never has a deferred entitlement. This prevents an unfunded free-account reward from manufacturing later debt.

## Daily qualifying actions and evidence

At most one reward may be selected per bound node per closed UTC day. The exact public interaction set is:

1. `original`
2. `reply`
3. `quote`
4. `repost`
5. `like`
6. `follow`

Raw `retweet` is an input alias only. It is normalized to canonical `repost` before evidence hashing, canonical action keys, replay checks, or selection. Supplying the same action once as `retweet` and once as `repost` therefore cannot create two rewards.

Every row binds the action type, actor immutable X ID, collector's finalized activity slot, node-history start slot, canonical campaign target ID, and a lowercase SHA-256 digest of that target evidence. The actor must equal the bound immutable X ID.

Originals, replies, quotes, and reposts additionally require the canonical numeric X post ID and canonical `created_at`. That timestamp must fall inside `[epoch 00:00 UTC, snapshot 00:00 UTC)`; a caller's substitute occurrence time is rejected.

Likes and follows do not have a trustworthy event timestamp in lookup responses. For either action, `collectorFirstObservedAtUtc` must fall inside the closed epoch and `activityStartSlot` must equal the append-only collector's `collectorFirstObservedFinalizedSlot`. Caller-supplied action IDs and fields such as `likedAtUtc`, `followedAtUtc`, or a generic occurrence timestamp are forbidden. The engine derives a stable synthetic action ID from exactly the action type, actor X ID, and canonical target ID. A canonical target-evidence digest remains mandatory.

The action commitment binds the policy schema version, epoch, exact UTC snapshot, candidate-snapshot digest, finalized-slot hash, actor/action/target evidence, and ordering slots. A separate candidate commitment binds that evidence to the wallet. Duplicate canonical action keys fail within a candidate set. A future append-only v2 activity ledger must enforce the same canonical key's uniqueness across epochs before admission; the pure batch does not pretend an in-memory set is durable replay protection.

Private or unattributable bookmarks, views, and impressions do not qualify. Duplicate nodes, automated activity, unavailable evidence, unbound targets, or evidence outside the closed collection window fail closed.

## Daily selection and later reward-lane order

Daily oversubscription keeps the frozen V1 snapshot lottery:

`SHA256(IAT_DAILY_BUDGET_V1 | closed UTC epoch | candidate snapshot digest | predeclared finalized-slot hash | immutable X ID | wallet)`

Candidates sort by that digest, then immutable X ID and wallet only for a
digest tie. Input order, handle, subscription tier, and collector speed do not
replace this fair snapshot-bound selection rule.

After a candidate is selected, its later global-capacity obligation carries
ascending chronology metadata in exactly this order:

1. `activityStartSlot`
2. `nodeHistoryStartSlot`
3. numeric value of immutable `xUserId`
4. `wallet` string

That metadata does not retroactively select the daily winners. The special CCC
Agent/Associate underfunding order and exact-tie reveal are defined by the
global reward-capacity contract.

A later 90% upgrade does **not** retain the old non-Premium queue position. Its new priority activity slot is the maximum of the original activity slot, original node-history start slot, and the finalized slot at which the fresh Premium proof was accepted. The remaining tie breakers are the original node-history start slot, numeric X ID, and wallet. The acceptance slot must be later than both original slots. The canonical proof-acceptance timestamp must be at or after the fresh tier observation, strictly after the original funding round, and before the original expiry; the tier observation must still be no more than 24 hours old when the proof is accepted.

## Deferred 90% lifecycle

An active deferred entitlement can exist only after durable proof of full original-tranche admission. Mutable booleans such as `active: true` or `originalTrancheAdmitted: true` are never authorization. The pure preparer requires its builder-emitted typed lineage plus an immutable original-admission ledger receipt digest. It recomputes the source-specific nominal amount, atomic 10/90 split, candidate commitment, original claim ID, entitlement ID, and 30-day expiry before preparing an obligation. The future adapter must authenticate that receipt digest against the durable ledger; no such adapter exists in this batch. The entitlement remains unreserved and creates no debt.

1. The same immutable X ID and wallet later provide a fresh `Premium` or `PremiumPlus` observation.
2. That observation must be later than both the original observation and original round, and strictly before the original 30-day expiry. Proof acceptance must occur at or after that observation while it is still fresh, strictly after the original round, and before expiry.
3. The decision occurs once, at the first UTC 00:00 strictly after proof acceptance—not merely after observation. That boundary must itself be before the original expiry. Thus a 23:59 observation accepted at 00:01 belongs to the following day's 00:00 round, never the already-passed midnight.
4. The proof-acceptance finalized slot establishes a fresh queue position.
5. The pure helper binds both the canonical proof-acceptance timestamp and finalized slot into one exact `X_PREMIUM_UPGRADE_90` obligation candidate. It does not accept a caller-supplied capacity scalar and cannot decide whether a lane is funded.
6. The future global allocator reads its own exact lane snapshot and atomically admits the full obligation or records `NULL_UNFUNDED_NO_DEBT` with amount zero. That durable decision consumes the entitlement. There is no partial payment, debt, retry, or later catch-up.

Any future admitted/reserved claim retains only the original 30-day expiry. Upgrade handling never extends it.

## Pure engine API

`engagement/epoch-engine.mjs` exposes these daily-policy primitives:

- `selectGenesisRewardCandidates` and `buildGenesisRewardPlan` implement the separate held first-1,000 immutable-reservation flow, exact 100-IAT source, next-midnight round, and half-open expiry.
- `dailySelectionScore` preserves the V1 snapshot-bound daily lottery, while `dailySelectionPriority` carries separate chronology for the later allocator.
- `selectDailyBudgetWinners` validates identity, action evidence, duplicates, freshness, and exact ordering.
- `rewardTranches` returns atomic nominal, immediate, and deferred base-unit amounts for either Genesis or daily nominal rewards.
- `buildDailyEpoch` consumes budget against nominal 100% and returns `immediateClaims` plus inactive `deferredEntitlements` candidates. The top level, every immediate candidate, and every deferred candidate explicitly prohibit publication.
- `resolveDeferredPremiumEntitlement` rejects caller flags and oversized amounts, verifies typed builder lineage and an immutable receipt digest, then prepares a fixed-source, fixed-amount, fixed-round, fixed-order obligation for the global allocator. Despite its compatibility name, it cannot authenticate the future ledger adapter, see capacity, consume the entitlement, or choose funded versus null.

The returned plans include policy and source identity, typed reward lineage, snapshot commitments, nominal and tranche totals, exact priorities, candidate Merkle roots/proofs, and the global-waterfall hold. `buildEpoch`, `leafHash`, Merkle construction, and proof verification remain unchanged only for the existing generic legacy fixture flow; the held Genesis policy planner does not call them.

## Required live gates

No route, database migration, scheduler, X credential, signing key, or on-chain instruction is added by this policy batch. Before activation, independently reviewed components must provide:

- official X OAuth and immutable-ID binding;
- durable wallet-signature and country evidence;
- append-only collection with finalized-slot anchoring and complete official-API coverage for all six actions;
- an atomic identity/action ledger enforcing one node reward per day;
- a complete authenticated first-1,000 Genesis binding-registry snapshot and immutable reservation receipts;
- an authenticated original-admission receipt adapter for deferred lineage activation;
- the IAT-wide UTC 00:00 waterfall and its exact lane-capacity snapshot;
- atomic persistence of original admission, entitlement activation, terminal upgrade outcome, and 30-day expiry;
- reproducible manifests and independent proof/total verification; and
- physical owner review and signing on the Trezor Model T.

The web runtime has no signing key and automatic broadcast is forbidden. No hot distributor wallet or separate authority is authorized. The Trezor boundary and all IAT-wide lockdown requirements remain in force.
