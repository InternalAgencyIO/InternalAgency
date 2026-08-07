# IAT B3 architecture baseline

Status: draft 0.4, Solana-hosted confidential-transfer profile selected

Source baseline: `f0a794952ab822d823c8d8eba0c4c8f5d9ae4796`

Source branch: `agent/iat-launch-window`

Architecture branch: `agent/iat-b3-architecture`

## 1. Non-negotiable requirements

1. B2 means the complete IAT V2 system.
2. Every V2 feature stays unless the project owner explicitly records a cut.
3. Correctness, security, reliability, evidence quality, and auditability take
   priority over deployment cost.
4. The selected Daily Law is an immutable IAT ownership-transfer rule, not an
   administrator switch, governance parameter, or UI convention.
5. The bucket mapping remains exactly `100/10000` on non-Friday days and
   `6667/10000` on Friday. Because the selected Solana slot-hash input is not a
   threshold VRF, B3 does not claim an unconditionally exact realized chance.
6. The first successful permissionless `finalize_day` interaction after local
   00:00 records the result. Until then all IAT ownership transfers fail closed.
7. A selected result rejects IAT ownership transfers until the next fixed
   UTC+03:00 civil-day boundary and the next day is finalized open.
8. The decision uses a canonically lagged Solana ancestor slot hash, with its
   limited leader, scheduler, and finalizer-influence risks disclosed.
9. The IAT law has no privileged transfer bypass, external oracle, result
   override, or reroll after finalization.
10. Public read-only access continues during a selected lockdown.
11. The former chainwide, first-block, threshold-VRF, independent-clock profile
   is not claimed. It remains the sovereign-network alternative if the owner
   later accepts validator infrastructure costs.
12. A cost target that cannot be achieved without further weakening these
   constraints must be declared infeasible.

## 2. Selected deployment decision

B3 remains on Solana. It does not operate a Solana validator or a separate
validator network. The selected asset is a new Token-2022 IAT mint combining
native Confidential Transfer with a permanently configured IAT Transfer Hook.
The small hook enforces the current finalized day record for ordinary and
confidential ownership transfers; Solana's existing ZK proof program verifies
the confidential amounts and balances.

```text
wallet: derive private keys and proofs
                  |
          Token-2022 IAT mint
          /                 \
public transfer       confidential transfer
          \                 /
        immutable IAT Daily Law hook
                  |
     day PDA: absent / open / locked
                  |
 Clock + lagged ancestor SlotHashes
```

Every transfer after a new local day begins must reference that exact day's
record. Missing records fail closed. Any caller can create the record with a
separate successful `finalize_day` transaction, after which transfers either
remain rejected for the selected day or proceed for the open day. The separate
transaction is necessary because Solana rolls back the result write if a later
transfer instruction fails.

The complete privacy boundary, current user-cost model, entropy construction,
release gates, and owner-authorized relaxations are normative in
[`SHIELDED_TRANSFERS.md`](SHIELDED_TRANSFERS.md).

## 3. Full-requirements consequence, retained as an unselected reference

The existing V2 runtime is an Anchor program on Solana. It can accept or reject
only instructions that invoke that program. It cannot reject:

- native SOL transfers;
- SPL transfers that call the Token Program directly;
- state changes in unrelated programs;
- validator votes, block production, or Solana protocol transitions.

Therefore a chain-wide daily lockdown law is impossible inside the current Solana
program boundary. Making the Anchor program immutable would make only that
program immutable; it would not turn its policy into Solana consensus.

The original unrelaxed lockdown requirement consequently makes B3 a sovereign
protocol network: an independent L1, appchain, or other validator-executed
state machine whose block-validity rules include the daily gate. V2/Solana
remains the behavioral reference and migration origin. It may remain live
during a separately governed transition, but it is not the final B3 consensus
runtime. This is not the selected low-cost B3 deployment profile.

## 4. Sovereign reference topology, not selected

```text
Public website / explorer / localized documents
                    |
          Read-only RPC and indexed history
                    |
        B3 full nodes and archival indexers
                    |
    ConsensusGuard -> transaction validity -> runtime
          |                                  |
          |                                  +-- native IAT asset
          |                                  +-- allocations and vesting
          |                                  +-- reward reservations
          |                                  +-- positions and settlement
          |                                  +-- eligibility and agencies
          |                                  +-- randomness and tiebreaks
          |                                  +-- migration registry
          |
          +-- immutable daily lockdown draw

V2 Solana snapshot/proofs -> audited migration manifest -> B3 genesis/import
```

### 4.1 ConsensusGuard

`ConsensusGuard` executes in validator block validation before any user
transaction can mutate nonce, fee, balance, or application state. The same
check executes in transaction admission, proposal construction, and block
replay. Mempool filtering alone is insufficient because a malicious proposer
could bypass its own mempool.

During a selected lockdown:

- blocks, votes, finality, peer synchronization, and protocol housekeeping
  continue;
- a valid block contains no user state-changing transaction;
- submitted user transactions receive deterministic `DAILY_LOCKDOWN`
  rejection;
- no fee is charged and no nonce is consumed for a rejected transaction;
- nodes do not silently queue transactions across the boundary;
- RPC queries, proofs, balances, history, explorer pages, and subscriptions
  remain available.

Read-only access is an RPC/node operation, not a special “read-only
transaction.” Transaction simulation may remain available only when it cannot
write state, consume a nonce, charge a fee, or be confused with acceptance.

### 4.2 Normative protocol schedule

No live wall clock, NTP server, timezone database, API, price feed, or other
oracle participates in lockdown validity. Genesis permanently commits:

```text
IAT_PROTOCOL_OFFSET_SECONDS = 10_800       // fixed UTC+03:00 label
DAILY_DECISION_LOCAL_SECOND = 0            // first block reaching 00:00
LOCKDOWN_DURATION_NOMINAL_SECONDS = 86_400
NORMAL_DAY_LOCKDOWN_CHANCE = 100 / 10000   // 1%
FRIDAY_LOCKDOWN_CHANCE = 6667 / 10000      // 66.67%
GENESIS_NOMINAL_UNIX_SECONDS
GENESIS_HEIGHT
NOMINAL_BLOCK_SECONDS
```

For height `H`, nominal protocol time is derived only from immutable Genesis
constants and height:

```text
nominal_time(H) = genesis_nominal_time
                + (H - genesis_height) * nominal_block_seconds
```

For every local day, the decision height is the first height whose derived
nominal time is at or after 00:00 in fixed UTC+03:00. It is also the opening
height if selected. The closing height is the first height reaching the next
local 00:00, making the interval half-open. Network latency or a change in real
block-production rate can move the wall-clock appearance of these heights;
that drift is accepted. Validators never consult their local clock to decide
whether a block is locked.

The final production chain specification must freeze the Genesis anchor and
nominal block period. It must choose a period for which the number of locked
heights approximates 24 hours at the intended block rate. Once Genesis exists,
neither value is a governance parameter.

### 4.3 Provable daily decision

The first block reaching each nominal local 00:00 is the decision block. Its
header commits the unique output and proof of the network's consensus-native
threshold VRF or equivalent bias-resistant random beacon. Validators derive
the decision from the header before executing the block body. If selected, a
decision block containing a user state-changing transaction is invalid. The
production verifier and proof suite are part of consensus, not a replaceable
adapter.

The daily draw is domain-separated by the law identifier, network identity,
and local-day number. A SHA-256 counter expansion performs rejection sampling
into 10,000 exact-uniform buckets. On non-Friday days, buckets `0..99` lock and
`100..9999` remain open. On Friday, buckets `0..6666` lock and `6667..9999`
remain open. Rejection removes modulo bias. The counter expands the one proven
randomness output and is not a reroll.

Every validator and outside observer can reproduce the bucket from the
decision-block header. A proposer cannot substitute a different output, proof,
day, counter, chance class, or result. A missing or invalid proof cannot
produce a valid decision block. Withholding may halt consensus under the
selected consensus
engine's stated liveness assumptions, but it cannot turn a selected lockdown
into an open day. Each day is a new independent draw. Consecutive selections
are valid and form one continuous multi-day period without an unlocked block.

### 4.4 Immutability definition

The Daily Lockdown Law has:

- no storage parameter;
- no administrator key;
- no governance call;
- no emergency bypass;
- no runtime feature flag;
- no alternate transaction class for users.

The law identifier, schedule constants, probability, randomness derivation,
test vectors, and normative text are committed into the chain specification
and white paper. Changing the law requires
incompatible validator software and a new protocol version: a social hard
fork, not an in-protocol edit. No software rule can prevent people from
creating a different network; “immutable” means the existing B3 chain rejects
blocks that violate the rule.

### 4.5 Design intent and limit of the claim

The law creates a recurring incentive for operators to disconnect from digital
systems, including Internal Agency. It also makes uninterrupted on-network
deposit, withdrawal, transfer, and settlement service impossible during a
selected lockdown. This deliberately conflicts with always-on centralized
custody operations.

It cannot truthfully guarantee that a centralized exchange or bank will never
list IAT: an intermediary can maintain an off-chain internal ledger or suspend
on-chain settlement. The protocol can make on-network execution impossible
during the lock; it cannot control private databases or third-party claims.

## 5. Runtime modules

### 5.1 Native IAT asset

Preserve the V2 supply and arithmetic contract:

- name: Internal Agency Token;
- symbol: IAT;
- 9 decimals;
- fixed supply: `1_000_000_000_000_000_000` base units;
- no post-Genesis mint or freeze authority.

B3 represents IAT as a new Token-2022 mint with Confidential Transfer and the
immutable IAT Daily Law hook. The V2 mint remains the migration source. The
chosen burn-and-mint, lock-and-mint, or one-time snapshot model must reconcile
the complete fixed supply and disclose custody; it is not yet selected.

### 5.2 Allocation and vesting

Preserve all five V2 lanes and exact amounts. Community custody remains
distinct. Treasury, ecosystem, core-team, and liquidity vesting semantics are
ported exactly, including Genesis-unlocked amounts, cliffs, and linear end
weeks.

### 5.3 Reward reservation ledger

Preserve the V2 solvency rule:

- reserve the complete maximum obligation before accepting a position;
- consume treasury, then ecosystem, then liquidity;
- accepted reservations have priority;
- reward debt is forbidden;
- unlocked capacity may be claimed only after reservations and payments.

This logic should be moved as a pure deterministic library first, then wrapped
by the B3 runtime. The existing Rust policy functions and JavaScript reference
engine become differential test oracles.

### 5.4 Positions and core rewards

Preserve 52-week user positions, 104-week core rewards, simple annual rates,
no automatic compounding, weekly cumulative integer arithmetic, principal
custody, maturity, settlement bitmaps, and residual-reservation release.

Height-derived policy time continues during a selected lockdown. A reward or
vesting milestone that occurs during the lock becomes executable after it;
the law delays execution but does not erase accrual or extend a term.

### 5.5 Eligibility, agency registry, and future CCC

Preserve standard, CCC Agent, and CCC Associate roles; the append-only agency
registry; owner deduplication; registry commitments; snapshot semantics; and
the existing Genesis fail-closed status. “Stays” does not mean “activates.”
Inactive V2 features stay inactive until their existing review and activation
requirements are satisfied.

### 5.6 Randomness and universal tiebreak

Preserve the one-roll, no-reroll, domain-separated, exact-uniform rejection
sampling behavior and the 86,400-second terminal neutral-expiry semantics.

Switchboard is a Solana-specific transport and must be rewritten for B3. The
behavioral contract stays. Candidate B3 randomness mechanisms must be compared
for bias resistance, liveness, withholding incentives, public verifiability,
and deterministic replay. No replacement is accepted merely because it makes
the binary smaller.

### 5.7 Identity and public-node activation

Preserve the existing wallet/X identity binding, uniqueness, age and
subscription checks, daily caps, replay resistance, short-lived sessions,
atomic D1 semantics, rollback behavior, and fail-closed operation. This remains
an off-chain eligibility boundary unless a separately reviewed protocol design
moves specific facts on-chain.

### 5.8 Public website, explorer, admin, and evidence

The live website, both domains, the 50-locale route system, localized review
holds, network explorer, tokenomics, inactive future previews, admin inspection
mode, hardware-wallet boundary, source-bound audits, reproducible builds, CI,
release packets, and ceremony gates are B3 system components. They are not
discarded because they are outside the validator runtime.

## 6. B2-to-B3 migration

1. Freeze a reviewed V2 source and public branch identity.
2. Publish a finalized Solana snapshot height and block hash.
3. Export mint supply, token accounts, program accounts, positions,
   reservations, agencies, eligibility commitments, rounds, and vesting state.
4. Recompute every exported invariant with two independent implementations.
5. Publish a canonical migration manifest and Merkle root.
6. Rehearse import into a disposable B3 network.
7. Run differential state-transition vectors against V2.
8. Obtain independent security and economic review.
9. Select one migration model: burn-and-mint, lock-and-mint, or one-time
   snapshot. The white paper must state custody and rollback risks explicitly.
10. Activate B3 only after the migration root and Genesis state are publicly
    reproducible.

No bridge model is selected in this baseline. That decision affects custody,
supply integrity, rollback, and legal disclosures and requires explicit owner
approval after evidence is available.

## 7. Implementation strategy

### Phase 0: Solana compatibility proof

- pin the deployed Token-2022 and ZK proof program identities;
- prove that ordinary and confidential transfers both invoke the configured
  IAT hook on Devnet;
- prototype `PodSlotHashes` access, fixed-lag selection, day finalization, and
  fail-closed missing-record behavior;
- measure account rent, proof time, transaction count, and user fees;
- do not migrate or revoke any authority during this prototype.

### Phase 1: specification lock

- source-control this feature-parity contract;
- keep the executable daily schedule, normal/Friday probabilities, draw, decision,
  and boundary vectors green;
- extract pure V2 transition vectors;
- define exact migration state and invariants;
- select and benchmark a mature consensus framework.

### Phase 2: IAT Daily Law hook

- immutable day-state schema and permissionless finalization;
- fixed UTC+03:00 Clock derivation and fixed-lag SlotHashes entropy;
- exact-threshold rejection sampling shared with the existing law kernel;
- public and confidential transfer-hook enforcement;
- malicious finalizer, transaction-ordering, rollback, and delayed-finalization
  tests.

### Phase 3: V2 economic parity

- allocations and vesting;
- reservations and positions;
- core reward settlement;
- differential V2/B3 tests.

### Phase 4: registry and randomness parity

- eligibility and agency commitments;
- CCC retained fail-closed;
- reviewed randomness adapter and no-reroll tests.

### Phase 5: confidential migration and public surfaces

- Token-2022 mint configuration, confidential-wallet flows, snapshot tools, and
  proof manifest;
- live-site B3 read paths;
- admin and evidence pipeline;
- rehearsals, audit, and staged rollout.

## 8. Architecture gates

B3 cannot advance from a phase while any of these fail:

- V2 feature-parity ledger is incomplete;
- daily boundary, slot-hash selection, bucket mapping, malicious-finalizer, or
  rollback test fails;
- an ordinary or confidential IAT ownership transfer is permitted while the
  day is absent or selected;
- any read-only surface unnecessarily stops during a selected lockdown;
- supply, allocation, reservation, or settlement differs from canonical V2;
- inactive DLC becomes reachable;
- migration supply or state does not reconcile;
- a cost reduction weakens a security or audit invariant;
- reproducible build or independent review is missing.

## 9. Open decisions

The following require measured prototypes, not assumption:

- fixed ancestor-slot lag and skipped-slot rule, after Devnet measurement;
- exact deployed Token-2022 and ZK proof program versions;
- whether B3 sponsors Solana fees or users pay SOL directly;
- migration custody model;
- final V2 mint to B3 Token-2022 mint relationship;
- selective-disclosure UX and whether a future auditor-key proposal is ever
  acceptable;
- legal and jurisdictional treatment of the hosted confidential-transfer UI.

The Solana `1.5 SOL` target applies only to project deployment funding. User
confidential-account rent and transaction fees are separate. No validator
network budget is required for the selected profile.
