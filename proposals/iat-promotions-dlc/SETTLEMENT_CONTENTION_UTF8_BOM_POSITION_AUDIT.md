# Settlement contention UTF-8 BOM-position audit

> **DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE**

This compact audit fixes byte-order-mark handling between fatal UTF-8 decoding
and the strict single-document JSON delimiter rule. It does not accept a
campaign vector, complete review, prepare a transaction, access a wallet, or
contact a validator or network.

## Position rule

The UTF-8 bytes `EF BB BF` decode to U+FEFF without replacement or special
stripping. At the leading document boundary, after otherwise valid JSON
whitespace, or after the completed document, that preserved scalar is not one
of the four permitted JSON whitespace characters and rejects as
`MALFORMED_JSON`. Decoding succeeds and JSON parsing begins, but no candidate
is returned.

The same U+FEFF scalar is valid inside a JSON string. One control places the
literal UTF-8 bytes inside the candidate string and accepts the exact scalar.
Three rejections cover leading, post-whitespace, and trailing delimiter
positions. Node and zero-dependency Python reconstruct the bytes independently.

Published evidence contains descriptors, byte-sequence hashes, byte counts,
error boundaries, and outcomes only. Raw byte sequences and runtime candidates
are never stored.

The companion
[`SETTLEMENT_CONTENTION_BYTE_VIEW_BOUNDARY_AUDIT.md`](./SETTLEMENT_CONTENTION_BYTE_VIEW_BOUNDARY_AUDIT.md)
fixes which visible runtime bytes may reach this decoder and delimiter rule.

## Replay

```powershell
node proposals/iat-promotions-dlc/generate-settlement-contention-composition-utf8-bom-position-audit.mjs --write
node proposals/iat-promotions-dlc/validate-settlement-contention-composition-utf8-bom-position-audit.mjs
python proposals/iat-promotions-dlc/verify-settlement-contention-transport-limits.py --verify-utf8-bom-position-audit --json
node --test proposals/iat-promotions-dlc/tests/settlement-contention-utf8-bom-position-audit.test.mjs
```

These commands are offline and proposal-only. Passing them is evidence for
review, not permission to activate, deploy, sign, broadcast, or transfer IAT.
