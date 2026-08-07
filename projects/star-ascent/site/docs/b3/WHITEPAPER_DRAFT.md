# Internal Agency B3 protocol white paper

Draft 0.1 — architecture edition

No token launch, investment return, deployment, bridge, or network-activation
claim is made by this draft.

## Abstract

Internal Agency B3 is a proposed sovereign protocol that preserves the full
IAT V2 economic and public-system contract while adding an immutable weekly
execution pause. Every Friday under the protocol's fixed UTC+03:00 time, user
state transitions are rejected at consensus. Block production, finality,
syncing, balances, history, proofs, explorers, and other read-only node
operations continue.

B3 is not merely a new Solana smart contract. A Solana program cannot impose a
chain-wide rule on native transfers, unrelated token transfers, or validator
consensus. B3 therefore separates the existing V2/Solana system, which is the
behavioral and migration reference, from a sovereign validator-executed B3
state machine.

## 1. Design principles

1. **Protocol before operator.** No administrator can bypass consensus.
2. **Solvency before growth.** Rewards are fully reserved before acceptance.
3. **One result, no reroll.** Exact-uniform decisions bind one public
   randomness event to one canonical candidate set.
4. **Feature continuity.** V2 features remain unless explicitly cut.
5. **Fail closed.** Inactive or unreviewed features are unreachable.
6. **Evidence is part of the system.** Source, binaries, state, migration, and
   public claims must be independently reproducible.
7. **Reliability before cost.** A cost target cannot weaken protocol behavior.

## 2. The Friday Consensus Rule

### 2.1 Normative rule

Let `T` be the deterministic Unix timestamp in a candidate block header. Let:

```text
D = floor((T + 10_800) / 86_400)
```

The block is inside the Friday pause exactly when:

```text
floor_mod(D, 7) = 1
```

because Unix day zero was Thursday and Unix day one was Friday. Equivalently,
the pause spans Thursday 21:00:00 UTC inclusive through Friday 21:00:00 UTC
exclusive.

Inside that interval a block containing a user state-changing transaction is
invalid. Every validating node must reject it. The rule has no administrator,
governance parameter, oracle, emergency exception, or application override.

### 2.2 What continues

- validator consensus messages and finality;
- production of valid empty or protocol-housekeeping blocks;
- peer synchronization and archival ingestion;
- RPC queries and cryptographic state proofs;
- balances, transaction history, explorer, and public documents;
- transaction construction and simulation clearly labeled as non-acceptance.

### 2.3 What stops

- IAT transfers;
- fee-bearing user calls;
- position opening, settlement, withdrawal, or claim execution;
- allocation and vesting withdrawals;
- registry, eligibility, identity, or agency state transitions;
- contract or runtime calls submitted as user transactions;
- governance or administrator transactions.

Rejected transactions do not pay fees, consume nonces, or enter blocks. Nodes
do not carry them silently across the pause.

### 2.4 Time and boundary safety

Protocol time is fixed at UTC+03:00 rather than read from a mutable timezone
database. Consensus timestamps are monotonic, bounded, and validated by every
node. Tests cover the last pre-pause block, the opening boundary, the last
paused block, the reopening boundary, leap years, negative timestamps where
supported, malicious proposer drift, replay, reorganization, and node restart.

Vesting and accrual clocks continue while execution is paused. Entitlements
that mature during Friday become executable after reopening; they are not lost.

## 3. Native IAT economics

B3 preserves the V2 token contract:

- fixed supply: 1,000,000,000 IAT;
- decimals: 9;
- no post-Genesis mint or freeze authority;
- 500,000,000 IAT community;
- 200,000,000 IAT treasury;
- 150,000,000 IAT ecosystem;
- 100,000,000 IAT core team;
- 50,000,000 IAT liquidity.

Treasury, ecosystem, and liquidity are the reward sources in that exact order.
Core-team principal is not a reward source. Vesting preserves V2 Genesis
unlocks, cliffs, and weekly linear schedules.

## 4. Positions and rewards

User positions last 52 weeks. The core reward lasts 104 weeks. Rates are
expressed in basis points over 52 weekly periods:

- core team: 1,700 bps;
- standard: 1,000 bps;
- CCC Agent: 2,800 bps;
- CCC Associate: 2,000 bps.

There is no automatic compounding. Before a position is accepted, B3 reserves
the maximum complete reward obligation from unlocked, unreserved treasury,
then ecosystem, then liquidity capacity. If any base unit remains unfunded,
the position is rejected atomically. The protocol records no reward debt.

Previously accepted reservations have priority. Principal return, settlement,
and residual release preserve the V2 lifecycle and arithmetic.

## 5. Agencies, eligibility, and CCC

The agency registry is append-only. Owner indexing prevents repeated
registration by the same wallet from weighting a draw. Every registry append
updates a rolling commitment. A decision snapshots the complete candidate
count and registry commitment.

CCC Agent and CCC Associate behavior remains part of B3 scope but retains the
V2 fail-closed Genesis status until separate activation requirements, evidence,
security review, and economic review are complete. Preservation does not imply
activation.

## 6. Universal one-roll resolution

For every protocol decision with two or more exactly equal candidates:

1. canonically order and commit the complete candidate set;
2. bind one public randomness event to the decision and commitment;
3. derive domain-separated 256-bit samples with a counter;
4. reject only samples in the modulo-bias tail;
5. accept the first exact-uniform index;
6. publish the commitment, randomness, counter, winner, and settlement proof.

The counter expands one randomness event; it is not another roll. A valid
result cannot be replaced or rerolled. A reveal unavailable for 86,400 seconds
enters the terminal V2 neutral-expiry path rather than requesting a replacement
value. B3's randomness transport is not selected in this draft; it must meet or
exceed the V2 bias, liveness, withholding, and replay guarantees.

## 7. State and execution architecture

B3 separates consensus validity from application modules. `ConsensusGuard`
enforces Friday before the runtime. Runtime modules implement the native asset,
allocations, vesting, reward capacity, positions, agencies, eligibility,
randomness, migrations, and event commitments.

Public RPC and indexers are read-only consumers. The website and explorer do
not decide protocol state. Identity-provider and D1 services can establish
reviewed eligibility facts, but cannot bypass consensus or mint supply.

## 8. Security model

B3 assumes adversaries may control users, RPC endpoints, indexers, block
proposers, a minority of validators, identity accounts, and transaction order.
Security requirements include:

- deterministic block replay;
- Byzantine-finality assumptions stated for the selected consensus engine;
- bounded consensus timestamp manipulation;
- Friday enforcement at admission, proposal, validation, and replay;
- overflow-safe fixed-point arithmetic;
- supply and reservation reconciliation;
- no-reroll randomness and terminal liveness;
- replay-resistant migration proofs;
- no privileged Friday bypass;
- reproducible node and runtime builds;
- independent source, economic, and migration review.

No claim of decentralization or Byzantine threshold is made until the
validator and consensus model is selected and measured.

## 9. Governance and upgrades

The Friday rule is outside mutable governance. Other B3 components may have a
reviewed upgrade process, but an upgrade cannot produce a valid block that
violates Friday on the existing protocol version. Any attempt to alter the
rule is an incompatible hard fork and must use a new protocol version and
public network identity.

The exact governance, validator admission, slashing, and non-Friday upgrade
model remain open design decisions.

## 10. V2 migration

B3 begins from a published finalized V2 snapshot. Independent exporters
reconcile supply, balances, allocations, positions, reservations, vesting,
registries, eligibility commitments, and terminal rounds. A canonical manifest
and Merkle root bind the imported state.

Burn-and-mint, lock-and-mint, and one-time snapshot models have different
custody and rollback risks. This draft does not select one. B3 activation
requires a public rehearsal, supply reconciliation, independent verification,
and explicit migration decision.

## 11. Public system continuity

The Internal Agency website, English and Turkish domains, 50-locale route
system, explorer, tokenomics, inactive future previews, admin inspection mode,
hardware-signing boundary, source-bound audits, CI, and release evidence remain
part of B3. Read-only surfaces are specifically expected to stay operational
during Friday.

Unreviewed localization remains fail-closed. Inactive future features remain
inactive. A public preview is not protocol activation.

## 12. Cost and feasibility

The recorded V2 loader-v3 peak is `8.31841104 SOL` before fees. A safe unchanged
size-optimized build measures `524,672` bytes, approximately `7.30692816 SOL`
peak and `3.65406264 SOL` permanent rent under the current model.

Therefore 3 SOL peak and 1.5 SOL peak are not achieved. B3 will not delete
features or guards to force those values. Moreover, a sovereign B3 network has
a different cost model: validator, RPC, indexer, monitoring, audit, migration,
and ongoing operations replace Solana ProgramData rent as the dominant budget.

## 13. Roadmap

1. lock the V2 feature-parity and Friday specifications;
2. benchmark mature consensus frameworks;
3. implement multi-validator Friday boundary tests;
4. port native IAT supply and V2 economic invariants;
5. add positions, vesting, and reservations with differential tests;
6. preserve inactive CCC and future-feature boundaries;
7. select and audit B3 randomness;
8. build snapshot and migration proofs;
9. integrate read-only website and explorer paths;
10. complete public testnet, independent audits, and migration rehearsal.

## 14. Unresolved decisions

- validator and consensus framework;
- validator admission and Byzantine threshold;
- fee market outside Friday;
- randomness source and withholding defense;
- bridge or snapshot custody model;
- upgrade process outside the immutable rule;
- final Solana/B3 asset relationship;
- legal, tax, and jurisdictional review;
- validator and infrastructure budget.

Until these are resolved and independently reviewed, B3 remains an
architecture proposal, not a live protocol.
