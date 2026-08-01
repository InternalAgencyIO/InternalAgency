# Settlement contention visible-view alias-mutation audit

> **DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE**

This compact audit fixes mutation behavior for a `Uint8Array` view that aliases
a larger shared backing buffer. It does not accept a campaign vector, complete
review, prepare a transaction, access a wallet, or contact a validator or
network.

## Alias rule

Each case parses a valid view, mutates its shared backing buffer, and parses the
same view again. Three controls mutate excluded prefix or suffix bytes: the
backing commitment changes, but visible bytes and candidate commitment remain
identical. Three inside-view cases mutate the candidate digit, marker initial,
or final delimiter. The candidate change produces a different commitment; the
marker and delimiter changes reject as `INVALID_TRANSPORT_ENVELOPE` and
`MALFORMED_JSON` respectively.

The published evidence contains only offsets, lengths, mutation-region labels,
hashes, error boundaries, outcomes, and commitments. Backing bytes, visible
bytes, runtime inputs, and runtime candidates remain runtime-only.
Zero-dependency Python independently reconstructs shared `bytearray` /
`memoryview` aliases and the same compact results.

## Replay

```powershell
node proposals/iat-promotions-dlc/generate-settlement-contention-composition-visible-view-alias-mutation-audit.mjs --write
node proposals/iat-promotions-dlc/validate-settlement-contention-composition-visible-view-alias-mutation-audit.mjs
python proposals/iat-promotions-dlc/verify-settlement-contention-transport-limits.py --verify-visible-view-alias-mutation-audit --json
node --test proposals/iat-promotions-dlc/tests/settlement-contention-visible-view-alias-mutation-audit.test.mjs
```

These commands are offline and proposal-only. Passing them is evidence for
review, not permission to activate, deploy, sign, broadcast, or transfer IAT.
