# Settlement contention fatal UTF-8 ingress audit

> **DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE**

This compact audit fixes the byte-to-text boundary before bounded JSON
parsing. It does not accept a campaign vector, complete review, prepare a
transaction, access a wallet, or contact a validator or network.

## Fatal byte-decoding rule

Transport bytes must decode as strict UTF-8. The decoder inserts no replacement
character and preserves a decoded BOM for the existing JSON delimiter rule.
Any decoding failure rejects as `INVALID_UTF8` before JSON parsing or candidate
production.

Four controls cover valid one-, two-, three-, and four-byte scalar encodings.
Sixteen rejections cover four truncated sequences, four overlong encodings,
four UTF-8 encodings of forbidden surrogate code points, and four invalid
continuation patterns. Node and zero-dependency Python reconstruct the byte
sequences independently.

Published evidence contains descriptors, byte-sequence hashes, byte counts,
error boundaries, and outcomes only. Raw byte sequences and runtime candidates
are never stored.

The companion
[`SETTLEMENT_CONTENTION_UTF8_BOM_POSITION_AUDIT.md`](./SETTLEMENT_CONTENTION_UTF8_BOM_POSITION_AUDIT.md)
separately proves that valid BOM bytes are preserved for the delimiter rule
rather than being mistaken for malformed UTF-8.

## Replay

```powershell
node proposals/iat-promotions-dlc/generate-settlement-contention-composition-fatal-utf8-ingress-audit.mjs --write
node proposals/iat-promotions-dlc/validate-settlement-contention-composition-fatal-utf8-ingress-audit.mjs
python proposals/iat-promotions-dlc/verify-settlement-contention-transport-limits.py --verify-fatal-utf8-ingress-audit --json
node --test proposals/iat-promotions-dlc/tests/settlement-contention-fatal-utf8-ingress-audit.test.mjs
```

These commands are offline and proposal-only. Passing them is evidence for
review, not permission to activate, deploy, sign, broadcast, or transfer IAT.

The companion
[`SETTLEMENT_CONTENTION_UTF8_BOUNDARY_AUDIT.md`](./SETTLEMENT_CONTENTION_UTF8_BOUNDARY_AUDIT.md)
extends fatal decoding through the maximum scalar and illegal lead-byte forms.
