# Internal Agency B3 protocol white paper

Draft 0.6 — primary Solana-hosted B3 architecture

No token launch, investment return, deployment, migration, or network-activation
claim is made by this draft.

## Abstract

Internal Agency B3 is a proposed Solana-hosted evolution of the complete IAT V2
system. It preserves every V2 feature unless explicitly cut and uses one
canonical Token-2022 IAT mint. The immutable Daily Law applies to every public
and confidential IAT ownership transfer. Privacy is an optional confidential-
balance mode on that same mint, not a second asset.

Every fixed UTC+03:00 protocol day, from local 00:01 through the next local
00:01, has one permissionlessly finalized result. The bucket
mapping is exactly 1% on non-Friday days and 66.67% on Friday for a uniform
input. A lagged Solana ancestor slot hash supplies the low-cost public entropy.
IAT transfers fail closed until the day is finalized. If selected, every public
and confidential canonical IAT ownership transfer remains invalid through that
local day. Solana consensus, unrelated assets, read-only access, and protocol
housekeeping continue.

B3 does not operate validators. This cost decision explicitly relaxes the
former chainwide-Solana, first-block, threshold-VRF, and independent-clock
design. The
slot hash is publicly reproducible but is not a bias-resistant threshold VRF,
so B3 does not claim that the realized outcome has an unconditional exact
probability. The precise privacy and relaxation boundaries are normative in
[`SHIELDED_TRANSFERS.md`](SHIELDED_TRANSFERS.md).

## 1. Design principles

1. **Protocol before operator.** No administrator can override a recorded day
   or bypass the hook for a canonical IAT ownership transfer.
2. **Privacy without mandatory proof cost.** Public IAT is the default. Opt-in
   confidential IAT hides amounts and balances, not addresses, timing,
   counterparties, conversion boundaries, or the public graph.
3. **Solvency before growth.** Rewards are fully reserved before acceptance.
4. **One result, no reroll.** A finalized daily result and an accepted V2
   randomness result cannot be replaced.
5. **Feature continuity.** V2 features remain unless explicitly cut.
6. **Fail closed.** An absent day record, inactive feature, or unreviewed path
   cannot silently become permissive.
7. **Evidence is part of the system.** Source, binaries, mint configuration,
   state, migration, and public claims must be reproducible.
8. **Reliability before cost.** Cost reduction cannot be hidden as equivalence.

## 2. Canonical IAT and optional Privacy Vault

### 2.1 Token architecture

B3 uses one canonical Token-2022 IAT mint with:

- fixed supply of 1,000,000,000 IAT and nine decimals;
- Confidential Transfer enabled;
- an IAT Daily Law Transfer Hook configured at mint creation;
- no post-Genesis mint or freeze authority;
- no global auditor key by default;
- hook-update and IAT-program upgrade authorities revoked only after the final
  audited binary and mint configuration are independently verified.

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
- cleartext deposits into and withdrawals from confidential balance;
- cleartext public-to-confidential deposits and confidential-to-public
  withdrawals;
- proof-context lifecycle.

This is confidentiality, not anonymity or an unlinkable mixer. Selective user
disclosure is supported through view keys. A global auditor key is excluded
from the baseline because it would create a single secret capable of decrypting
all confidential transfer amounts.

### 2.3 User cost

Default IAT users pay no confidential-transfer cost. Their public transfers do
execute the small Daily Law hook, whose compute and priority-fee overhead must
be benchmarked. Only opt-in privacy users pay ZK-related costs. Current Solana
guidance indicates roughly `0.0015 SOL` of extra rent reserve for a confidential account.
Current confidential transfers span several dependent transactions; the
canonical three-transaction Rust example carries six signatures, giving an
illustrative base-fee floor of about `0.000030 SOL` before optional priority
fees. Temporary proof-context rent is reclaimed when those accounts close.
Receiving users pay another transaction fee when applying pending balances.

These are current-example figures, not a production quote. Devnet benchmarking
must publish public-hook overhead and the real confidential setup, deposit,
finalization, transfer, apply, withdrawal, failure, priority-fee, and recovery
costs before launch.

## 3. The IAT-wide Daily Law

### 3.1 Schedule and scope

The public timezone label is a fixed UTC+03:00 offset. The IAT hook reads
Solana's consensus-provided `Clock` sysvar and derives the protocol day exactly
as `floor((unix_timestamp + 10_800 - 60) / 86_400)`, using mathematical floor
division. The subtraction fixes the boundary at local 00:01: `00:00:00` through
`00:00:59` remains part of the preceding protocol day. No NTP, API, timezone
database, or external time oracle participates.

Every public or confidential canonical IAT ownership transfer must provide the
current day's record. An absent record rejects with `DAY_UNFINALIZED`. A
selected record rejects with `DAILY_LOCKDOWN`. An open record permits the
transfer.

Consequently no canonical IAT ownership transfer can slip through after the day
boundary because finalization is late. An open day may experience additional
fail-closed IAT downtime until finalization. The law does not stop SOL,
unrelated tokens, unrelated programs, Solana voting, block production, proof
setup, or read-only queries.

### 3.2 Permissionless decision

Solana programs do not run automatically at a time boundary. Any caller may
submit a separate successful `finalize_day` instruction at or after local 00:01.
It reads a canonical lagged ancestor from the recent SlotHashes sysvar,
domain-separates the hash by law identifier, Solana genesis identity, canonical
IAT mint, local-day number, and entropy slot, then runs SHA-256 counter expansion
and rejection sampling into 10,000 exact-uniform buckets.

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

- public and confidential canonical IAT ownership transfers fail;
- no privileged IAT transfer bypass exists;
- public balances, ciphertexts, proofs, history, explorer pages, RPC reads, and
  subscriptions remain available;
- Solana and unrelated assets continue normally.

A selected Friday interval is exactly `[Friday 00:01:00, Saturday 00:01:00)` in
fixed UTC+03:00. At the Saturday boundary the Friday record becomes stale.
Transfers remain fail closed until Saturday is separately finalized; this
liveness delay cannot make Friday end early or let an unfinalized day pass.

Token-2022 public/confidential balance conversion and proof bookkeeping are not
ownership transfers and are not automatically Transfer Hook calls. They must
not be described as chainwide or all-state lockdown enforcement.

### 3.5 Immutability

The law constants, fixed timezone offset, day derivation, slot-selection rule,
domain separation, rejection sampler, thresholds, record schema, and IAT gate
have no administrator parameter or result-override instruction. The IAT law
program becomes immutable by revoking its loader authority, and the canonical
mint's hook-update authority is removed after audit.

B3 nevertheless inherits Solana runtime, Token-2022, Clock, SlotHashes, validator
behavior, upgrades, and social forks. "Immutable" therefore means immutable in
the deployed IAT programs and mint configuration, not control over the host chain.

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

B3 adds an owner-directed core-team concentration target: protocol-originated
core principal and rewards are routed through immutable program custody and
the enforceable balance is reconciled to no more than 10% of post-burn live mint
supply for each fixed-UTC+03:00 day beginning at 00:00. The smallest valid burn
is `ceil(max(0, 10*C - S) / 9)`, where `S` and `C` are pre-burn mint supply and
core-custody balance. Solana Clock is the only time input; core releases fail
closed until the day is reconciled. There is no preliminary 00:00 write: at or
after 00:01, one permissionless atomic transition observes the current balance,
executes the burn, and finalizes that day's Daily Law decision, preventing an
inbound custody change during the intervening minute from escaping the burn.

The protocol cannot prove that an unrelated pseudonymous wallet is secretly
controlled by a team member. The enforceable scope is therefore immutable
program custody, not a claim about hidden human ownership. This boundary and
its remaining Mainnet decisions are recorded in
[CORE_TEAM_CAP.md](CORE_TEAM_CAP.md).

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

### 6.1 Operator factions

B3 defines five fixed factions whose public leaders are Radiance, Ellie, Alia,
Ece, and the unnamed male character referred to only as **the boss**. These are
narrative identities, not signers or authorities. One operator may pledge to
one faction and may switch at the exact Solana-Clock boundary 86,400 seconds
after the prior change.

Every faction write is subordinate to the IAT-wide Daily Law. Pledges, switches,
scoring, finalization, funding, and claims fail closed when the day is absent or
selected; standings and history remain readable. Weekly proportional allocation
uses whole base units and carries fractional dust forward. Equal follower
rewards use equal whole-unit shares and carry any indivisible remainder forward.

Trustless recurring rewards require a one-time, immutable, capped carve-out
from the community lane into a faction PDA. Without that explicit V2 custody
relaxation, every weekly reward depends on a hardware-wallet signature and is
stoppable. Exact scoring, Sybil resistance, carve-out amount, period anchor,
tie handling, follower snapshot, NFT authority, expiry, and funding horizon are
not yet frozen. [FACTIONS.md](FACTIONS.md) is normative for the current boundary.

## 7. Canonical mint and migration boundary

An original SPL mint cannot gain Token-2022 extensions after creation. If
canonical IAT has not launched, B3 creates the canonical mint as Token-2022 from
inception. If an original SPL canonical mint is already live, B3 requires an
explicitly approved and independently reconciled migration before the new mint
can be called canonical. No mint creation or migration is authorized by this
draft.

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

- ordinary and confidential canonical-IAT transfer-hook invocation tests
  against the exact deployed Token-2022 version;
- day-boundary, missing-record, selected, open, consecutive-day, skipped-slot,
  delayed-finalization, rollback, replay, and malicious-finalizer tests;
- cross-language bucket and domain-separation vectors;
- sound key derivation, recovery, pending-balance, and selective-disclosure UX;
- canonical or migrated supply, allocation, reservation, and settlement
  reconciliation;
- reproducible programs and independent security review.

Privacy technology does not remove sanctions, AML, money-transmission, tax,
consumer-protection, or jurisdictional obligations. A hosted interface requires
specialized review before public activation. B3 must describe actual technical
privacy and must not market anonymity it does not provide.

## 10. Cost feasibility

The selected profile removes sovereign validator, consensus, and independent-
RPC network investment. Project costs are canonical mint/hook deployment,
state rent, RPC/indexing, wallet integration, possible migration, monitoring,
and audits. Default public users incur no ZK-proof or confidential-account
cost, but every transfer executes the Daily Law hook. Only opt-in users incur
confidential-account rent reserve, proof transaction fees, and local proof
computation.

The owner accepts a 3 SOL aggregate fresh-payer peak deployment ceiling for B3.
The existing V2 monolith does not meet that target without major restructuring.
B3 will not delete V2 behavior or security checks merely to force the number.
The current optimized native Daily Law artifact measures 154,952 bytes,
approximately 1.08081144 SOL permanent rent and 2.16042576 SOL pre-fee peak.
This proves the
law adapter fits the ceiling by itself; it does not yet prove that the complete
retained-feature B3 artifact set fits. Aggregate cost must be measured rather
than inferred.

## 11. Roadmap

1. pin exact Token-2022 and ZK proof program versions;
2. prototype public and confidential canonical-IAT hook invocation on Devnet;
3. implement permissionless day finalization and fail-closed IAT vectors;
4. measure entropy access, account rent, transaction count, proof time, and fees;
5. port V2 economic modules with differential tests;
6. freeze and implement the core-cap custody path and faction economics only
   after their explicit Mainnet parameters are resolved;
7. build confidential-wallet key recovery, pending-balance, and error UX;
8. determine and rehearse canonical mint creation or migration;
9. obtain independent Solana, cryptographic, economic, migration, and legal
   review;
10. publish reproducible binaries, mint configuration, test vectors, and evidence;
11. revoke authorities only after all release gates pass.

## 12. Open decisions

- fixed ancestor-slot lag and skipped-slot selection rule;
- exact deployed Token-2022 and ZK proof program identities;
- user-paid versus sponsored Solana fees;
- canonical mint creation or migration model;
- confidential-wallet support and recovery policy;
- selective disclosure and whether any future auditor-key proposal is acceptable;
- application-level randomness transport for preserved V2 tiebreaks;
- faction scoring, Sybil resistance, epoch, tie, funding, reward, NFT, and
  expiry rules;
- exact core-custody scope and the definition of live supply for the 10% cap;
- legal, tax, and jurisdictional review.

Until these are resolved, prototyped, measured, and independently reviewed, B3
remains an implementation program rather than a live Mainnet asset.
