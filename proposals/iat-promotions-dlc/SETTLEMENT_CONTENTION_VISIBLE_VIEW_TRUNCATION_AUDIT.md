# Settlement contention visible-view truncation audit

> **DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE**

This compact audit fixes how the fatal UTF-8 transport boundary handles a
`Uint8Array` whose visible view is shorter than its valid backing buffer. It
does not accept a campaign vector, complete review, prepare a transaction,
access a wallet, or contact a validator or network.

## Truncation rule

The parser decodes exactly the bytes selected by the view's `byteOffset` and
`byteLength`. A full view accepts. Empty, prefix-only, suffix-only, and
one-byte-short views remain valid UTF-8 but reject as `MALFORMED_JSON` after
decode and before any candidate exists. Bytes outside the visible view cannot
complete the document.

All cases share the same valid backing envelope. The published evidence keeps
only lengths, offsets, hashes, error boundaries, outcomes, and commitments.
Backing bytes, visible bytes, runtime inputs, and runtime candidates remain
runtime-only. Zero-dependency Python independently reconstructs the same
slices and commitments.

The companion `SETTLEMENT_CONTENTION_VISIBLE_VIEW_ALIAS_MUTATION_AUDIT.md`
mutates the shared backing buffer before a second parse to distinguish
outside-view isolation from inside-view detection.

## Replay

```powershell
node proposals/iat-promotions-dlc/generate-settlement-contention-composition-visible-view-truncation-audit.mjs --write
node proposals/iat-promotions-dlc/validate-settlement-contention-composition-visible-view-truncation-audit.mjs
python proposals/iat-promotions-dlc/verify-settlement-contention-transport-limits.py --verify-visible-view-truncation-audit --json
node --test proposals/iat-promotions-dlc/tests/settlement-contention-visible-view-truncation-audit.test.mjs
```

These commands are offline and proposal-only. Passing them is evidence for
review, not permission to activate, deploy, sign, broadcast, or transfer IAT.
