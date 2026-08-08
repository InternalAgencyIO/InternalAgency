# B3 gated path to Mainnet

Status: **B3 PRIMARY / MAINNET HOLD**

B3 is the project's primary forward architecture. V2 remains the live source of
truth and full behavioral baseline until every applicable gate below is backed
by public evidence. "Going toward Mainnet" authorizes implementation, local
testing, Devnet rehearsal, audit preparation, and public documentation. It does
not authorize mint creation, migration, funding, signing, authority revocation,
or Mainnet transactions.

## Architecture locked for implementation

- one canonical Token-2022 IAT mint;
- fixed 1,000,000,000 IAT supply and nine decimals;
- all V2 features retained unless explicitly cut;
- immutable Daily Law hook on all public and confidential IAT ownership transfers;
- 1% non-Friday and 66.67% Friday bucket thresholds;
- permissionless finalization at or after local 00:01 using a fixed-lag Solana
  ancestor hash;
- fixed UTC+03:00 label from Solana `Clock`;
- optional confidential balance on the same mint;
- no separate privacy token, wrapper supply, mixer, or IAT validator network.

## Gate 0 — live-estate truth

State: **PARTIAL — REPOSITORY EVIDENCE SAYS NO MAINNET IAT MINT**

The checked-in operator handoff states that no IAT mint transaction has been
created, signed, or deployed. The public proof page labels the Mainnet mint
"Not published," the network page says the mint and program addresses are not
published, and the Mainnet readiness record remains `HOLD` with
`mainnetExecutionAuthorized: false`. These mutually consistent records support
creating B3 as Token-2022 from inception instead of migrating an existing mint.
They do not independently prove the absence of an undisclosed mint, so the
following read-only reconciliation remains mandatory:

- independently query Mainnet for any claimed canonical IAT mint and program;
- reconcile GitHub, local source, public website, domains, Devnet evidence, and
  any live addresses;
- publish exact slot, commitment, RPC method, account bytes, and hashes;
- obtain any candidate mint address from the owner-controlled ceremony record;
- if no candidate exists, bind that signed assertion into the release packet;
- decide whether B3 is a new mint or requires a migration.

No later mint or migration decision is valid without this gate.

## Gate 1 — exact host-program compatibility

State: **OPEN**

- pin exact Mainnet Token-2022 and ZK ElGamal Proof program identities;
- pin the released client and interface versions used by B3;
- prove ordinary and confidential transfers both invoke Transfer Hook;
- prove the hook cannot read a confidential amount;
- prove required extensions coexist in the exact deployed version;
- enforce the exact approved mint-extension allowlist on-chain; required-
  extension presence alone is insufficient, and Permanent Delegate,
  permissioned burn, mint-close, pausable, or any other unapproved
  authority-bearing extension is a hard failure;
- record wallet, explorer, indexer, hardware-signer, and RPC compatibility.

## Gate 2 — immutable IAT Daily Law adapter

State: **IN PROGRESS — SBF + DISPOSABLE LOCAL-VALIDATOR REHEARSED**

- retain and independently reproduce the completed SBF and disposable
  local-validator proof for the native Transfer Hook adapter;
- prove the exact half-open Friday 00:01 to Saturday 00:01 boundary, including
  `00:00:59`/`00:01:00`, negative-time reference vectors, and stale-record
  rejection;
- validate `finalize_day` and its provisional 150-slot ancestor lag under
  realistic Solana timing;
- freeze the ancestor lag, skipped-slot fallback, domain separation, and fixed
  law-state PDA schema;
- reject absent, stale, forged, or selected current-day state;
- prove ordinary and confidential direct clients cannot bypass the hook;
- prove every B3 economic mutation calls the same gate;
- measure default-transfer compute and priority-fee overhead.

## Gate 3 — optional Privacy Vault client

State: **OPEN**

- configure confidential accounts only on explicit opt-in;
- derive recoverable ElGamal and AES keys from a domain-separated wallet signature;
- implement public deposit, confidential transfer, pending-balance apply, and
  public withdrawal UX;
- state what remains public at every step;
- prevent a wallet without unlocked view keys from displaying a false zero;
- benchmark setup rent, proof time, transaction count, fees, retry behavior, and
  context-account rent recovery.

## Gate 4 — V2 parity and canonical asset

State: **OPEN**

- keep every V2 parity row green or record an explicit owner-authorized cut;
- reconcile supply, allocations, vesting, positions, reservations, agencies,
  eligibility commitments, tiebreaks, and inactive feature gates;
- if migration is required, implement two independent exporters and importers;
- publish a canonical manifest, Merkle root, and zero-difference reconciliation;
- prove no duplicate canonical supply can circulate under the chosen model.
- freeze the exact core-custody definition and prove the daily 10% post-burn
  invariant without a permanent delegate;
- freeze faction scoring, Sybil, epoch, tie, community-carve-out, follower
  snapshot, NFT authority, remainder, expiry, and funding-horizon rules;
- prove every faction write directly fails closed under the Daily Law.

## Gate 5 — adversarial Devnet program

State: **OPEN**

- deploy only to Devnet under a documented temporary authority;
- test normal-day open/locked and Friday open/locked vectors;
- test consecutive selected days and delayed finalization;
- test leader/finalizer timing influence and publish the measured limitation;
- test rollback, replay, stale record, skipped slot, direct Token-2022 call,
  confidential direct call, transfer-hook account substitution, and RPC failure;
- run ordinary-transfer and confidential-transfer load tests;
- run core-cap `23:59:59`/`00:00:00`/`00:01:00`, no-excess, excess, stale-day,
  post-burn-minimality, pre-finalization inbound-custody race,
  lockdown-ordering, and forged-vault tests;
- run faction first-pledge, `86,399`/`86,400` switch, no-op, missing/locked-day,
  Sybil, tie, proportional-conservation, zero-follower, and idempotence tests;
- publish reproducible binaries, IDLs, addresses, transaction signatures, and logs.

## Gate 6 — independent review

State: **OPEN**

- Solana program security audit;
- confidential-transfer and key-management review;
- economic and migration review;
- randomness/timing claim review;
- privacy-language and user-risk review;
- sanctions, AML, money-transmission, tax, consumer-protection, and jurisdictional
  legal review;
- remediate every blocking finding and publish the disposition.

## Gate 7 — Mainnet ceremony readiness

State: **HOLD**

- final source commit and reproducible binary hashes frozen;
- exact mint-extension configuration independently reproduced;
- mint, freeze, hook-update, and program-upgrade authority plan approved;
- signer, hardware-device, funding, rollback, incident, and abort procedures rehearsed;
- website and explorer display only verified addresses and claims;
- public launch packet contains supply, privacy, cost, randomness, lockdown, and
  migration limitations in plain language;
- independent reviewers sign the source-bound evidence packet.

## Gate 8 — Mainnet execution

State: **NOT AUTHORIZED**

Mainnet execution requires a separate explicit owner instruction after Gates
0–7 pass. The execution turn must resolve exact addresses, amounts, authorities,
signers, payer balances, transaction simulations, abort conditions, and evidence
capture before requesting any signature.

## Immediate implementation order

1. produce the pinned SBF binary and digest for the native law adapter;
2. build exact-version local-validator public/confidential transfer tests;
3. run exact-version Devnet compatibility tests only after explicit deployment authorization;
4. benchmark ordinary-transfer overhead before adding wallet privacy UX;
5. implement opt-in confidential-account flows;
6. resolve and implement the core-cap custody boundary and sealed faction
   economics without adding privileged token authority;
7. measure the complete law, faction, retained-V2, mint, and state-account peak
   against the accepted 3 SOL ceiling;
8. determine the live canonical-mint state and migration consequence;
9. begin independent review only from pinned, reproducible artifacts.
