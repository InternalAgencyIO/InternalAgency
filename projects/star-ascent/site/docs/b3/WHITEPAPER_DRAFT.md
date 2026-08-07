# Internal Agency B3 protocol white paper

Draft 0.4 — Solana-hosted confidential-transfer architecture

No token launch, investment return, deployment, migration, or network-activation
claim is made by this draft.

## Abstract

Internal Agency B3 is a proposed Solana-hosted evolution of the complete IAT V2
system. It preserves V2 behavior unless explicitly cut, migrates IAT to a fixed-
supply Token-2022 mint, adds native confidential amounts and balances, and
enforces an immutable Daily Law on ordinary and confidential IAT ownership
transfers through a Transfer Hook.

Every fixed UTC+03:00 day has one permissionlessly finalized result. The bucket
mapping is exactly 1% on non-Friday days and 66.67% on Friday for a uniform
input. A lagged Solana ancestor slot hash supplies the low-cost public entropy.
Transfers fail closed until the day is finalized. If selected, IAT ownership
transfers remain invalid through that local day; Solana consensus, unrelated
assets, read-only access, and protocol housekeeping continue.

B3 does not operate validators. This cost decision explicitly relaxes the
former chainwide, first-block, threshold-VRF, and independent-clock design. The
slot hash is publicly reproducible but is not a bias-resistant threshold VRF,
so B3 does not claim that the realized outcome has an unconditional exact
probability. The precise privacy and relaxation boundaries are normative in
[`SHIELDED_TRANSFERS.md`](SHIELDED_TRANSFERS.md).

## 1. Design principles

1. **Protocol before operator.** No administrator can override a recorded day
   or bypass the hook for an IAT ownership transfer.
2. **Privacy without invented claims.** B3 hides confidential amounts and
   balances, not addresses, timing, counterparties, or the public graph.
3. **Solvency before growth.** Rewards are fully reserved before acceptance.
4. **One result, no reroll.** A finalized daily result and an accepted V2
   randomness result cannot be replaced.
5. **Feature continuity.** V2 features remain unless explicitly cut.
6. **Fail closed.** An absent day record, inactive feature, or unreviewed path
   cannot silently become permissive.
7. **Evidence is part of the system.** Source, binaries, mint configuration,
   state, migration, and public claims must be reproducible.
8. **Reliability before cost.** Cost reduction cannot be hidden as equivalence.

## 2. Native confidential IAT

### 2.1 Token architecture

B3 uses a new Token-2022 mint with:

- fixed supply of 1,000,000,000 IAT and nine decimals;
- Confidential Transfer enabled;
- an IAT Daily Law Transfer Hook configured at mint creation;
- no post-migration mint or freeze authority;
- no global auditor key by default;
- hook-update and IAT-program upgrade authorities revoked only after the final
  audited binary and migration are independently verified.

Solana's ZK ElGamal Proof program verifies confidential transfers. Wallets
derive account-specific ElGamal and AES keys and generate equality, ciphertext-
validity, and range proofs locally. Validators learn that the transfer is valid
without learning its plaintext amount.

### 2.2 Privacy boundary

Encrypted:

- confidential transfer amount;
- confidential available balance;
- confidential pending balance.

Public:

- sender and recipient accounts and owners;
- mint, program, instruction type, timing, slot, signature, and SOL fees;
- transaction and counterparty graph;
- public IAT balances and ordinary transfers;
- cleartext public-to-confidential deposits and confidential-to-public
  withdrawals;
- proof-context lifecycle.

This is confidentiality, not anonymity or an unlinkable mixer. Selective user
disclosure is supported through view keys. A global auditor key is excluded
from the baseline because it would create a single secret capable of decrypting
all confidential transfer amounts.

### 2.3 User cost

Users pay Solana fees in SOL unless B3 sponsors them. No additional IAT privacy
fee is selected. Current Solana guidance indicates roughly `0.0015 SOL` of
extra rent reserve for the confidential account extension. Current confidential
transfers span several dependent proof and transfer transactions; the canonical
three-transaction Rust example carries six signatures, giving an illustrative
base-fee floor of about `0.000030 SOL` before optional priority fees. Temporary
proof-context rent is reclaimed when those accounts close. Receiving users pay
another transaction fee when applying pending balances.

These are current-example figures, not a production quote. Devnet benchmarking
must publish the real setup, finalization, transfer, apply, failure, priority-
fee, and recovery costs before launch.

## 3. The IAT Daily Law

### 3.1 Schedule and scope

The public timezone label is a fixed UTC+03:00 offset. The IAT hook reads
Solana's consensus-provided `Clock` sysvar, adds exactly 10,800 seconds, and
derives the local day and weekday without NTP, an API, or a timezone database.

Every IAT ownership transfer, ordinary or confidential, invokes the hook and
must provide the current day's record. An absent record rejects with
`DAY_UNFINALIZED`. A selected record rejects with `DAILY_LOCKDOWN`. An open
record allows Token-2022 to complete the transfer.

Consequently no IAT ownership transfer can slip through after the day boundary
because finalization is late. An open day may experience additional fail-closed
downtime until finalization. The law does not stop SOL, unrelated tokens,
unrelated programs, Solana voting, block production, proof setup, or read-only
queries.

### 3.2 Permissionless decision

Solana programs do not run automatically at midnight. Any caller may submit a
separate successful `finalize_day` instruction after 00:00. It reads a canonical
lagged ancestor from the recent SlotHashes sysvar, domain-separates the hash by
law identifier, Solana genesis identity, mint, local-day number, and entropy
slot, then runs SHA-256 counter expansion and rejection sampling into 10,000
exact-uniform buckets.

```text
non-Friday: buckets 0..99 lock; 100..9999 open
Friday:     buckets 0..6666 lock; 6667..9999 open
```

The threshold mapping is exactly `100/10000` and `6667/10000` for a uniform
input. Rejection sampling removes modulo bias. Once stored, the record cannot be
overwritten, rerolled, or administratively changed.

Finalization must be separate from a transfer that will be rejected. Solana
rolls back all earlier writes if a later instruction fails, which would
otherwise erase a selected result. Official clients finalize first and submit a
transfer plan only when the persistent record is open.

### 3.3 Randomness limitation

A Solana ancestor slot hash is inexpensive, public, and replayable, but it is
not a consensus-native threshold VRF dedicated to B3. Leaders and transaction
schedulers may have limited influence, and a prospective caller may choose when
to submit finalization. Permissionless competition and a fixed lag reduce but do
not remove that influence.

Accordingly the protocol may claim exact bucket thresholds, not perfectly
unbiased entropy or an unconditional exact realized probability. Recovering
those stronger claims requires validator-level protocol control or an external
randomness network; neither is selected.

### 3.4 Selected-day behavior

During a selected day:

- ordinary and confidential IAT ownership transfers fail;
- all V2 application mutations guarded by the shared Daily Law fail;
- no privileged IAT transfer bypass exists;
- public balances, ciphertexts, proofs, history, explorer pages, RPC reads, and
  subscriptions remain available;
- Solana and unrelated assets continue normally.

Token-2022 public/confidential balance conversion and proof bookkeeping are not
ownership transfers and are not automatically Transfer Hook calls. They must
not be described as chainwide or all-state lockdown enforcement.

### 3.5 Immutability

The law constants, fixed timezone offset, day derivation, slot-selection rule,
domain separation, rejection sampler, thresholds, record schema, and transfer
gate have no administrator parameter or result-override instruction. The IAT
program becomes immutable by revoking its loader authority, and the mint's hook-
update authority is removed after audit.

B3 nevertheless inherits Solana runtime, Token-2022, Clock, SlotHashes, validator
behavior, upgrades, and social forks. "Immutable" therefore means immutable in
the deployed IAT program and mint configuration, not control over the host chain.

## 4. V2 economics

B3 preserves the V2 token contract:

- fixed supply: 1,000,000,000 IAT;
- decimals: 9;
- 500,000,000 IAT community;
- 200,000,000 IAT treasury;
- 150,000,000 IAT ecosystem;
- 100,000,000 IAT core team;
- 50,000,000 IAT liquidity.

Treasury, ecosystem, and liquidity remain reward sources in that exact order.
Core-team principal is not a reward source. Vesting preserves V2 Genesis
unlocks, cliffs, and weekly linear schedules.

## 5. Positions and rewards

User positions last 52 weeks. The core reward lasts 104 weeks. Rates remain:

- core team: 1,700 basis points;
- standard: 1,000 basis points;
- CCC Agent: 2,800 basis points;
- CCC Associate: 2,000 basis points.

There is no automatic compounding. Before accepting a position B3 reserves the
maximum complete reward obligation from unlocked, unreserved treasury, then
ecosystem, then liquidity capacity. An incompletely funded position is rejected
atomically, and the protocol records no reward debt. Previously accepted
reservations retain priority.

## 6. Agencies, eligibility, CCC, and tiebreaks

The agency registry remains append-only, owner-deduplicated, and commitment-
tracked. CCC Agent and Associate behavior stays in scope but remains fail closed
until its existing activation requirements are satisfied.

Application tiebreaks preserve one public randomness event, canonical candidate
commitment, domain separation, exact-uniform rejection sampling, no operator
reroll, and the terminal 86,400-second neutral-expiry path. The final reviewed
transport remains an open implementation decision and is distinct from the
Daily Law's slot-hash input.

## 7. Migration

The original V2 mint cannot be assumed to acquire Token-2022 extensions. B3
therefore requires a new mint and a published finalized V2 snapshot. Independent
exporters reconcile supply, balances, allocations, positions, reservations,
vesting, registries, eligibility commitments, and terminal rounds.

Burn-and-mint, lock-and-mint, and a one-time snapshot have different custody and
rollback risks. No model is selected silently. Activation requires an explicit
owner decision, public rehearsal, canonical manifest and Merkle root, exact
supply reconciliation, and independent verification.

## 8. Public-system continuity

The website, English and Turkish domains, 50-locale route system, explorer,
tokenomics, inactive previews, admin inspection mode, hardware-signing boundary,
source-bound audits, CI, and release evidence remain part of B3. Read-only
surfaces remain available during selected days. Unreviewed localization and
inactive future features remain fail closed.

## 9. Security and legal boundaries

B3 assumes adversaries may control wallets, RPC endpoints, indexers, transaction
ordering, finalization timing, identity accounts, and confidential-transfer
clients. Required evidence includes:

- ordinary and confidential transfer-hook invocation tests against the exact
  deployed Token-2022 version;
- day-boundary, missing-record, selected, open, consecutive-day, skipped-slot,
  delayed-finalization, rollback, replay, and malicious-finalizer tests;
- cross-language bucket and domain-separation vectors;
- sound key derivation, recovery, pending-balance, and selective-disclosure UX;
- supply, allocation, reservation, settlement, and migration reconciliation;
- reproducible programs and independent security review.

Privacy technology does not remove sanctions, AML, money-transmission, tax,
consumer-protection, or jurisdictional obligations. A hosted interface requires
specialized review before public activation. B3 must describe actual technical
privacy and must not market anonymity it does not provide.

## 10. Cost feasibility

The selected profile removes sovereign validator, consensus, and independent-
RPC network investment. Project costs are Solana program deployment, mint and
state rent, RPC/indexing, wallet integration, migration, monitoring, and audits.
User costs are confidential-account rent reserve, Solana transaction fees, and
local proof computation.

The existing V2 monolith does not meet a 1.5 SOL peak deployment target without
major restructuring. B3 will not delete V2 behavior or security checks merely
to force that number. The smaller Daily Law hook and reuse of native Token-2022
cryptography minimize incremental B3 bytecode, but the complete aggregate cost
must be measured rather than inferred.

## 11. Roadmap

1. pin exact Token-2022 and ZK proof program versions;
2. prototype confidential and ordinary hook invocation on Devnet;
3. implement permissionless day finalization and fail-closed transfer vectors;
4. measure entropy access, account rent, transaction count, proof time, and fees;
5. port V2 economic modules with differential tests;
6. build confidential-wallet key recovery, pending-balance, and error UX;
7. implement and rehearse the selected migration model;
8. obtain independent Solana, cryptographic, economic, migration, and legal
   review;
9. publish reproducible binaries, mint configuration, test vectors, and evidence;
10. revoke authorities only after all release gates pass.

## 12. Open decisions

- fixed ancestor-slot lag and skipped-slot selection rule;
- exact deployed Token-2022 and ZK proof program identities;
- user-paid versus sponsored Solana fees;
- V2-to-B3 migration custody model;
- confidential-wallet support and recovery policy;
- selective disclosure and whether any future auditor-key proposal is acceptable;
- application-level randomness transport for preserved V2 tiebreaks;
- legal, tax, and jurisdictional review.

Until these are resolved, prototyped, measured, and independently reviewed, B3
remains an architecture proposal rather than a live confidential asset.
