# IAT B3 architecture baseline

Status: draft 0.1

Source baseline: `f0a794952ab822d823c8d8eba0c4c8f5d9ae4796`

Source branch: `agent/iat-launch-window`

Architecture branch: `agent/iat-b3-architecture`

## 1. Non-negotiable requirements

1. B2 means the complete IAT V2 system.
2. Every V2 feature stays unless the project owner explicitly records a cut.
3. Correctness, security, reliability, evidence quality, and auditability take
   priority over deployment cost.
4. The Friday Consensus Rule is a base-protocol rule, not a contract option,
   administrator switch, governance parameter, or UI convention.
5. The Friday rule has no privileged bypass.
6. Public read-only access continues during the Friday pause.
7. A cost target that cannot be achieved without weakening these constraints
   must be declared infeasible.

## 2. Architectural consequence of the Friday requirement

The existing V2 runtime is an Anchor program on Solana. It can accept or reject
only instructions that invoke that program. It cannot reject:

- native SOL transfers;
- SPL transfers that call the Token Program directly;
- state changes in unrelated programs;
- validator votes, block production, or Solana protocol transitions.

Therefore a chain-wide Friday rule is impossible inside the current Solana
program boundary. Making the Anchor program immutable would make only that
program immutable; it would not turn its policy into Solana consensus.

The non-negotiable Friday requirement consequently makes B3 a sovereign
protocol network: an independent L1, appchain, or other validator-executed
state machine whose block-validity rules include the Friday gate. V2/Solana
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
          +-- immutable Friday pause

V2 Solana snapshot/proofs -> audited migration manifest -> B3 genesis/import
```

### 3.1 ConsensusGuard

`ConsensusGuard` executes in validator block validation before any user
transaction can mutate nonce, fee, balance, or application state. The same
check executes in transaction admission, proposal construction, and block
replay. Mempool filtering alone is insufficient because a malicious proposer
could bypass its own mempool.

During the pause:

- blocks, votes, finality, peer synchronization, and protocol housekeeping
  continue;
- a valid block contains no user state-changing transaction;
- submitted user transactions receive deterministic `FRIDAY_PAUSE` rejection;
- no fee is charged and no nonce is consumed for a rejected transaction;
- nodes do not silently queue transactions across the boundary;
- RPC queries, proofs, balances, history, explorer pages, and subscriptions
  remain available.

Read-only access is an RPC/node operation, not a special “read-only
transaction.” Transaction simulation may remain available only when it cannot
write state, consume a nonce, charge a fee, or be confused with acceptance.

### 3.2 Normative protocol time

An immutable protocol cannot depend on a timezone database whose rules can be
changed after Genesis. B3 therefore snapshots Turkish time as a fixed offset:

```text
IAT_PROTOCOL_OFFSET_SECONDS = 10_800  // UTC+03:00
local_day = floor((consensus_unix_seconds + 10_800) / 86_400)
friday = floor_mod(local_day, 7) == 1
```

Unix day zero was Thursday; day one was Friday. The pause is the half-open UTC
interval from Thursday 21:00:00 inclusive to Friday 21:00:00 exclusive. At the
first valid block timestamp at or after the closing boundary, user state
transitions resume.

This rule represents “Turkish time at B3 Genesis,” permanently fixed at UTC+3.
If Turkish civil-time law later changes, B3 does not silently follow it. Doing
so would require an oracle, mutable timezone database, or hard fork and would
contradict automatic immutability.

The consensus engine must provide a deterministic, monotonically increasing
block timestamp with bounded proposer drift. Every validator recomputes the
Friday predicate from the finalized block header. Local machine clocks and RPC
server timezone settings are never inputs to state transition validity.

### 3.3 Immutability definition

The Friday rule has:

- no storage parameter;
- no administrator key;
- no governance call;
- no emergency bypass;
- no runtime feature flag;
- no alternate transaction class for users.

The rule identifier, constants, test vectors, and normative text are committed
into the chain specification and white paper. Changing the rule requires
incompatible validator software and a new protocol version: a social hard
fork, not an in-protocol edit. No software rule can prevent people from
creating a different network; “immutable” means the existing B3 chain rejects
blocks that violate the rule.

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

Wall-clock policy time continues during Friday. A reward or vesting milestone
that occurs during the pause becomes executable after the pause; the Friday
rule delays execution but does not erase accrual or extend a term.

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
- keep the executable Friday reference and normative boundary vectors green;
- extract pure V2 transition vectors;
- define exact migration state and invariants;
- select and benchmark a mature consensus framework.

### Phase 1: protocol skeleton

- node, consensus, deterministic time, empty-block Friday behavior;
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
- Friday boundary or malicious-proposer test fails;
- any state transition is permitted during Friday;
- any read-only surface unnecessarily stops during Friday;
- supply, allocation, reservation, or settlement differs from canonical V2;
- inactive DLC becomes reachable;
- migration supply or state does not reconcile;
- a cost reduction weakens a security or audit invariant;
- reproducible build or independent review is missing.

## 8. Open decisions

The following require measured prototypes, not assumption:

- consensus framework and validator set model;
- timestamp and finality mechanism;
- B3 fee asset and fee schedule outside Friday;
- exact randomness source;
- migration custody model;
- validator governance outside the immutable Friday rule;
- relationship between Solana IAT and native B3 IAT;
- operational cost target for a sovereign network.

The Solana `1.5 SOL` deployment target cannot be reused as the cost model for a
sovereign chain. B3 needs separate Genesis, validator, RPC, indexing, audit,
and ongoing operating-cost budgets.
