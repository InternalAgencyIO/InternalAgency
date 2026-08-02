# IAT public evidence ledger

This directory preserves every non-secret IAT devnet evidence export and local
proof available to the launch team through 2026-08-02. Transaction evidence
files are published byte-for-byte from the operator exports; the SHA-256 values
in `index.json` identify the exact bytes.

## Status boundary

- Network: Solana devnet.
- Mainnet: **HOLD**.
- V2 initialization rehearsal: seven recorded transactions.
- V2 on-chain feature rehearsal: 18 recorded feature transactions in the latest
  snapshot. Three role-specific stake positions, standard and CCC-agent week-8
  payouts, the selected-agency CCC-associate pause, core APY settlement, the
  Genesis liquidity unlock, live Switchboard randomness, and finalized CCC
  rounds 7 and 8 are recorded.
- The 18-transaction feature rehearsal, FDF Guard review, and prior SBF are
  historical evidence for prior program artifacts. They do **not** cover
  hardened source commit `b73d2d3ce8572e833b9fdd37df23cd97b40df111`.
- Current hardened-source proof: **VERIFIED LOCAL HOST ONLY** across 39 exact
  clock, cliff, maturity, terminal-recovery, and neutral-payout vectors, six
  Rust host tests, and 16 JavaScript tests.
- Current-source verifiable SBF: **COMPLETE** at 579,480 bytes with SHA-256
  `d437be9a78aeaa09eeef419554bd0c0598a18239edeb226912c79a973f24d2a4`.
- Fresh signed Devnet evidence for the hardened source and current SBF:
  **REQUIRED, NOT COMPLETE**.
- Independent review of the hardened source and fresh evidence:
  **REQUIRED, NOT COMPLETE**.
- Signing material: not included.

The V2 initialization and V2 feature records describe separate deterministic
devnet rehearsal instances. Their mint and configuration addresses therefore
differ. Neither address is a mainnet mint.

The V1 ceremony record is retained as a historical, superseded artifact. It
cannot authorize or substitute for IAT V2.

## Verification

`chain-status-20260801T053947Z.json` records a read-only Solana devnet RPC check
of all 29 unique transaction signatures in the historical canonical exports. Every
signature was found with `finalized` status and a null transaction error at the
stated observation time. This receipt does not prove independent review and
does not authorize mainnet.

`v2-feature-independent-signoff-20260801T055736Z.json` binds the prior program
artifact, feature export, and chain receipt to the completed historical review.
Its communication reference states that the approval was relayed by the launch
operator in the Codex launch task; it is not a wallet signature and does not
authorize mainnet.

`v2-local-time-gate-proof-20260801T072730Z.json` binds the prior Rust program
policy, economic policy, cross-language reference engine, and boundary tests.
It covers pre-boundary rejection, exact-boundary acceptance, all four vesting
lanes, and the 52-week position maturity. It used no validator transaction,
keypair, wallet, signing, simulation for signing, broadcast, or network state.
It is not Devnet transaction evidence and does not authorize mainnet.

`v2-local-time-gate-proof-remediation-20260802T103546Z.json` binds source commit
`1df716ccd93c47ee1732af6ae1f43b8e6958afe6`, the verifiable SBF artifact, exact
program policy, reference engine, and terminal-recovery boundary tests. It used
no validator transaction, keypair, wallet, signing, simulation for signing,
broadcast, or network state. This proof does not replace fresh signed Devnet
evidence and independent review for the remediation artifact.

`v2-local-time-gate-proof-hardening-20260802T130622Z.json` is the current local
proof. Its six exact source/test inputs are byte-bound to
`b73d2d3ce8572e833b9fdd37df23cd97b40df111` and the current 579,480-byte SBF.
It used no validator transaction, wallet, key, signing,
simulation for signing, broadcast, or network mutation and therefore cannot
replace a signed Devnet rehearsal or independent review.

The earlier 15-, 24-, and 25-signature receipts and every superseded progress
snapshot remain in the ledger for a complete audit trail.

## Public-domain dedication

To the extent copyright or related rights apply, Internal Agency dedicates the
evidence files, this index, and this explanatory record to the public domain
under CC0 1.0 Universal. Code referenced by the evidence keeps the license
declared in the source repository.

