# X-bound reward reference-state invariants

Status: **non-activating reference contract**. This document describes the in-memory JavaScript state accepted by `validateXBoundRewardReferenceState`. It does not define an account codec, PDA, database mapping, signer, transfer authority, migration, or production adapter. Mainnet remains HOLD.

## Exact state boundary

The top-level object has exactly these keys:

`schema`, `rewardId`, `wallet`, `xUserId`, `rewardSourceKind`, `priorityClass`, `cccOrdering`, `grossBaseUnits`, `epochClosedAtUnixSeconds`, `claimExpiresAtUnixSeconds`, `activityQualificationSequence`, `nodeActivationSequence`, `initialSubscriptionType`, `latestSubscriptionType`, `latestSubscriptionObservedAtUnixSeconds`, `premiumProofAcceptedAtUnixSeconds`, `premiumProofAcceptedSequence`, `originalBaseAdmissionLineage`, `baseTranche`, `premiumFullTranche`, `upgradeTranche`, and `expiredCleanupRecorded`.

Each non-null tranche has exactly `kind`, `amount`, `fundingRoundAtUnixSeconds`, `eligibleSequence`, and `status`. A CCC ordering object has exactly `qualifyingActivityStartSlot`, `nodeActivationSlot`, and `qualificationPda`. Original base-admission lineage retains its exact v1 ten-key reference shape and remains explicitly unauthenticated.

Unknown, missing, or surplus keys fail closed. Validation is read-only and returns the supplied object without normalizing or mutating it. This boundary freezes a JavaScript reference shape only; it deliberately does not freeze serialized account bytes.

## Identity, amount, class, and time

- `rewardId`, CCC qualification PDA, and lineage digests are exact 32-byte hexadecimal values where applicable.
- `xUserId` is a canonical positive decimal X user ID: 1-32 digits, no sign, zero, leading zero, whitespace, or decimal point.
- `wallet` must decode through the shared Solana Base58 helper to exactly 32 bytes.
- `rewardSourceKind` maps to its one hard-coded priority class. CCC ordering is mandatory only for `CCC_AGENT` and `CCC_ASSOCIATE`; it is forbidden for every other class.
- Gross value is positive, fits u64, and is divisible by ten. The base and upgrade amounts are exactly 10% and 90%; a Premium-origin full tranche is exactly 100%.
- The original funding round is exact 00:00 UTC. Claim expiry is exactly 30 half-open UTC days after that round.
- Base and Premium-full funding rounds equal the original round and their eligible sequence equals `max(activityQualificationSequence, nodeActivationSequence)`.

## Legal origin and tranche states

Premium or PremiumPlus at qualification has only `X_PREMIUM_FULL_100`. Base, upgrade, and original-base lineage are absent. Latest tier equals the initial tier. The reference treats the epoch close as the qualification acceptance instant, and both the Premium acceptance instant and full-tranche round equal that close.

None or Basic at qualification has only `X_BASE_10` plus `X_PREMIUM_UPGRADE_90`; a full-Premium tranche is forbidden. Before a later Premium proof, the only legal base/upgrade pairs are:

| Base | Upgrade |
| --- | --- |
| `PENDING_FUNDING` or `ADMITTED_RESERVED` | `LOCKED_PENDING_PREMIUM` |
| `CLAIMED` | `LOCKED_PENDING_PREMIUM` or `NULL_CLAIM_EXPIRED` |
| `NULL_UNDERFUNDED`, `NULL_BLOCKED`, or `NULL_MISSED` | `NULL_PARENT_UNFUNDED` |
| `NULL_CLAIM_EXPIRED` | `NULL_CLAIM_EXPIRED` |

An admitted or claimed base requires exact original-admission lineage. Lineage is forbidden with pending or failed base funding. It may remain with an expired base only when that base had previously been admitted. Premium-origin state can never carry base-admission lineage.

After a later Premium proof:

- the immutable wallet and X user ID remain unchanged;
- latest tier is Premium or PremiumPlus;
- the observation is later than the original close, no later than acceptance, and at most 86,400 seconds old at acceptance;
- acceptance is later than the original close and before claim expiry;
- proof sequence is strictly greater than both original activity and node sequences;
- the upgrade eligible sequence equals that proof sequence;
- the upgrade round is exactly `nextUtcMidnight(premiumProofAcceptedAtUnixSeconds)` and remains before claim expiry;
- an admitted-base lineage bound to the same reward and original funding round is mandatory; and
- the base is admitted, claimed, or expired, while the upgrade is pending, admitted, claimed, underfunded, blocked, missed, or expired. Locked and parent-unfunded statuses are illegal after proof acceptance.

## Expiry and Daily Law

`expiredCleanupRecorded` is the literal boolean `false` or `true`. An explicitly stored `NULL_CLAIM_EXPIRED` status requires `true`; `true` forbids a stored pending, reserved, or Premium-locked tranche. Terminal funding failures and claimed tranches may remain unchanged when cleanup is recorded.

Every reward mutator checks the immutable IAT-wide Daily Law capability before validating caller-supplied reward, round, proof, receipt, or cleanup data. This validator does not create a bypass: it is read-only and has no write authority.

## Deliberately unresolved blockers

The Premium-at-qualification sequence model is not reconciled with persistence. The JavaScript reference currently stores `premiumProofAcceptedSequence = max(activityQualificationSequence, nodeActivationSequence)` even though this value represents qualification ordering, not a later Premium-upgrade proof. The ledger blueprint instead identifies tier observations independently. This naming and ordering discrepancy must be resolved before any account codec is frozen.

After an upgrade, the compact reference state retains only the latest tier-observation time, not the initial tier-observation time or evidence identifier. The initial observation therefore cannot be independently replayed from this object alone.

Production remains blocked on authenticated X-tier and wallet-binding evidence, authenticated allocator-receipt persistence, immutable PDA seeds and ownership, account discriminator/version/length and bump rules, replay protection, migration rules, and signer/CPI authorization. Until those are separately specified, reviewed, and tested, this state must not be imported by runtime, assigned an account layout, or used to authorize payment.
