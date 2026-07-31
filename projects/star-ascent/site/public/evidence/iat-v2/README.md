# IAT public evidence ledger

This directory preserves every non-secret IAT devnet evidence export available
to the launch team as of 2026-07-31. Files are published byte-for-byte from the
operator exports; the SHA-256 values in `index.json` identify the exact bytes.

## Status boundary

- Network: Solana devnet.
- Mainnet: **HOLD**.
- V2 initialization rehearsal: seven recorded transactions.
- V2 on-chain feature rehearsal: 14 recorded feature transactions in the latest
  snapshot. Three role-specific stake positions, the standard player week-8
  settlement, core APY settlement, the Genesis liquidity unlock, live
  Switchboard randomness, and a CCC commit/reveal result are recorded.
- CCC-linked week-8 settlements remain gated on real CCC round 8. Later
  maturity, cliff, and linear-unlock gates also remain outside the latest
  signed snapshot.
- Independent review: still required.
- Signing material: not included.

The V2 initialization and V2 feature records describe separate deterministic
devnet rehearsal instances. Their mint and configuration addresses therefore
differ. Neither address is a mainnet mint.

The V1 ceremony record is retained as a historical, superseded artifact. It
cannot authorize or substitute for IAT V2.

## Verification

`chain-status-20260731T102046Z.json` records a read-only Solana devnet RPC check
of all 25 unique transaction signatures in the current canonical exports. Every
signature was found with `finalized` status and a null transaction error at the
stated observation time. This receipt does not prove independent review and
does not authorize mainnet.

The earlier 15- and 24-signature receipts and every superseded progress snapshot
remain in the ledger for a complete audit trail.

## Public-domain dedication

To the extent copyright or related rights apply, Internal Agency dedicates the
evidence files, this index, and this explanatory record to the public domain
under CC0 1.0 Universal. Code referenced by the evidence keeps the license
declared in the source repository.

