# Settlement contention UTF-8 boundary audit

> **DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE**

This compact audit fixes Unicode-scalar upper bounds and illegal UTF-8 lead
behavior at the byte-to-text boundary. It does not accept a campaign vector,
complete review, prepare a transaction, access a wallet, or contact a
validator or network.

## Boundary rule

UTF-8 must use Unicode scalar values no greater than U+10FFFF and must use
valid modern one- through four-byte forms. Obsolete five/six-byte forms, FE/FF
lead bytes, and continuation bytes without an active sequence are forbidden.
Every invalid sequence rejects as `INVALID_UTF8` before JSON parsing.

Four controls cover U+007F, U+07FF, U+D7FF, and U+10FFFF. Sixteen rejections
cover four out-of-range scalar encodings, four obsolete five/six-byte forms,
four FE/FF lead forms, and four redundant continuation runs. Node and
zero-dependency Python reconstruct the bytes independently.

Published evidence contains descriptors, byte-sequence hashes, byte counts,
error boundaries, and outcomes only. Raw byte sequences and runtime candidates
are never stored.

The companion
[`SETTLEMENT_CONTENTION_UTF8_BOM_POSITION_AUDIT.md`](./SETTLEMENT_CONTENTION_UTF8_BOM_POSITION_AUDIT.md)
distinguishes valid U+FEFF decoding from its invalid use at JSON document
delimiters.

## Replay

```powershell
node proposals/iat-promotions-dlc/generate-settlement-contention-composition-utf8-boundary-audit.mjs --write
node proposals/iat-promotions-dlc/validate-settlement-contention-composition-utf8-boundary-audit.mjs
python proposals/iat-promotions-dlc/verify-settlement-contention-transport-limits.py --verify-utf8-boundary-audit --json
node --test proposals/iat-promotions-dlc/tests/settlement-contention-utf8-boundary-audit.test.mjs
```

These commands are offline and proposal-only. Passing them is evidence for
review, not permission to activate, deploy, sign, broadcast, or transfer IAT.
