# IAT B3 architecture baseline

Status: draft 0.3

Source baseline: `f0a794952ab822d823c8d8eba0c4c8f5d9ae4796`

Source branch: `agent/iat-launch-window`

Architecture branch: `agent/iat-b3-architecture`

## 1. Non-negotiable requirements

1. B2 means the complete IAT V2 system.
2. Every V2 feature stays unless the project owner explicitly records a cut.
3. Correctness, security, reliability, evidence quality, and auditability take
   priority over deployment cost.
4. The Daily Lockdown Law is a base-protocol rule, not a contract
   option, administrator switch, governance parameter, or UI convention.
5. Each non-Friday day is selected independently with exact probability
   `100/10000` (1%). Friday is the only exception, at exact probability
   `6667/10000` (66.67%).
6. The first block whose height-derived nominal UTC+03:00 time reaches 00:00
   is the decision block and, if selected, the first locked block.
7. A selected lockdown lasts one nominal 24-hour height interval.
8. The decision uses a unique, proof-verifiable, consensus-native randomness
   output committed in the decision block.
9. The law has no privileged bypass, oracle, mutable clock, or reroll.
10. Public read-only access continues during a selected lockdown.
11. A cost target that cannot be achieved without weakening these constraints
   must be declared infeasible.

## 2. Architectural consequence of the lockdown requirement

The existing V2 runtime is an Anchor program on Solana. It can accept or reject
only instructions that invoke that program. It cannot reject:

- native SOL transfers;
- SPL transfers that call the Token Program directly;
- state changes in unrelated programs;
- validator votes, block production, or Solana protocol transitions.

Therefore a chain-wide daily lockdown law is impossible inside the current Solana
program boundary. Making the Anchor program immutable would make only that
program immutable; it would not turn its policy into Solana consensus.

The non-negotiable lockdown requirement consequently makes B3 a sovereign
protocol network: an independent L1, appchain, or other validator-executed
state machine whose block-validity rules include the daily gate. V2/Solana
remains the behavioral reference and migration origin. It may remain live
during a separately governed transition, but it is not the final B3 consensus
runtime.

## 3. Recommended B3 topology

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

### 3.1 ConsensusGuard

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

### 3.2 Normative protocol schedule

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

### 3.3 Provable daily decision

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

### 3.4 Immutability definition

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

### 3.5 Design intent and limit of the claim

The law creates a recurring incentive for operators to disconnect from digital
systems, including Internal Agency. It also makes uninterrupted on-network
deposit, withdrawal, transfer, and settlement service impossible during a
selected lockdown. This deliberately conflicts with always-on centralized
custody operations.

It cannot truthfully guarantee that a centralized exchange or bank will never
list IAT: an intermediary can maintain an off-chain internal ledger or suspend
on-chain settlement. The protocol can make on-network execution impossible
during the lock; it cannot control private databases or third-party claims.

## 4. Runtime modules

### 4.1 Native IAT asset

Preserve the V2 supply and arithmetic contract:

- name: Internal Agency Token;
- symbol: IAT;
- 9 decimals;
- fixed supply: `1_000_000_000_000_000_000` base units;
- no post-Genesis mint or freeze authority.

B3 should represent IAT natively in the state machine. A Solana representation
may remain during migration, but a bridge or custodian cannot be described as
base consensus.

### 4.2 Allocation and vesting

Preserve all five V2 lanes and exact amounts. Community custody remains
distinct. Treasury, ecosystem, core-team, and liquidity vesting semantics are
ported exactly, including Genesis-unlocked amounts, cliffs, and linear end
weeks.

### 4.3 Reward reservation ledger

Preserve the V2 solvency rule:

- reserve the complete maximum obligation before accepting a position;
- consume treasury, then ecosystem, then liquidity;
- accepted reservations have priority;
- reward debt is forbidden;
- unlocked capacity may be claimed only after reservations and payments.

This logic should be moved as a pure deterministic library first, then wrapped
by the B3 runtime. The existing Rust policy functions and JavaScript reference
engine become differential test oracles.

### 4.4 Positions and core rewards

Preserve 52-week user positions, 104-week core rewards, simple annual rates,
no automatic compounding, weekly cumulative integer arithmetic, principal
custody, maturity, settlement bitmaps, and residual-reservation release.

Height-derived policy time continues during a selected lockdown. A reward or
vesting milestone that occurs during the lock becomes executable after it;
the law delays execution but does not erase accrual or extend a term.

### 4.5 Eligibility, agency registry, and future CCC

Preserve standard, CCC Agent, and CCC Associate roles; the append-only agency
registry; owner deduplication; registry commitments; snapshot semantics; and
the existing Genesis fail-closed status. “Stays” does not mean “activates.”
Inactive V2 features stay inactive until their existing review and activation
requirements are satisfied.

### 4.6 Randomness and universal tiebreak

Preserve the one-roll, no-reroll, domain-separated, exact-uniform rejection
sampling behavior and the 86,400-second terminal neutral-expiry semantics.

Switchboard is a Solana-specific transport and must be rewritten for B3. The
behavioral contract stays. Candidate B3 randomness mechanisms must be compared
for bias resistance, liveness, withholding incentives, public verifiability,
and deterministic replay. No replacement is accepted merely because it makes
the binary smaller.

### 4.7 Identity and public-node activation

Preserve the existing wallet/X identity binding, uniqueness, age and
subscription checks, daily caps, replay resistance, short-lived sessions,
atomic D1 semantics, rollback behavior, and fail-closed operation. This remains
an off-chain eligibility boundary unless a separately reviewed protocol design
moves specific facts on-chain.

### 4.8 Public website, explorer, admin, and evidence

The live website, both domains, the 50-locale route system, localized review
holds, network explorer, tokenomics, inactive future previews, admin inspection
mode, hardware-wallet boundary, source-bound audits, reproducible builds, CI,
release packets, and ceremony gates are B3 system components. They are not
discarded because they are outside the validator runtime.

## 5. B2-to-B3 migration

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

## 6. Implementation strategy

### Phase 0: specification lock

- source-control this feature-parity contract;
- keep the executable daily schedule, normal/Friday probabilities, draw, decision,
  and boundary vectors green;
- extract pure V2 transition vectors;
- define exact migration state and invariants;
- select and benchmark a mature consensus framework.

### Phase 1: protocol skeleton

- node, consensus, height-derived schedule, native random beacon, and selected
  daily-lockdown empty-block behavior;
- native IAT supply;
- query RPC and explorer indexing;
- adversarial consensus tests with malicious proposals.

### Phase 2: V2 economic parity

- allocations and vesting;
- reservations and positions;
- core reward settlement;
- differential V2/B3 tests.

### Phase 3: registry and randomness parity

- eligibility and agency commitments;
- CCC retained fail-closed;
- reviewed randomness adapter and no-reroll tests.

### Phase 4: migration and public surfaces

- snapshot tools and proof manifest;
- live-site B3 read paths;
- admin and evidence pipeline;
- rehearsals, audit, and staged rollout.

## 7. Architecture gates

B3 cannot advance from a phase while any of these fail:

- V2 feature-parity ledger is incomplete;
- daily boundary, decision-proof, exact-probability, or malicious-proposer
  test fails;
- any user state transition is permitted during a selected lockdown;
- any read-only surface unnecessarily stops during a selected lockdown;
- supply, allocation, reservation, or settlement differs from canonical V2;
- inactive DLC becomes reachable;
- migration supply or state does not reconcile;
- a cost reduction weakens a security or audit invariant;
- reproducible build or independent review is missing.

## 8. Open decisions

The following require measured prototypes, not assumption:

- consensus framework and validator set model;
- final immutable Genesis anchor, nominal block period, and finality mechanism;
- B3 fee asset and fee schedule outside selected lockdowns;
- threshold-VRF or equivalent consensus beacon suite and validator parameters;
- migration custody model;
- validator governance outside the immutable Daily Lockdown Law;
- relationship between Solana IAT and native B3 IAT;
- operational cost target for a sovereign network.

The Solana `1.5 SOL` deployment target cannot be reused as the cost model for a
sovereign chain. B3 needs separate Genesis, validator, RPC, indexing, audit,
and ongoing operating-cost budgets.
