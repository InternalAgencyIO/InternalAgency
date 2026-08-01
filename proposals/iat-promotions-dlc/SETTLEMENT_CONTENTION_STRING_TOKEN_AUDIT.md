# Settlement contention string-token audit

> **DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE**

This compact audit fixes how JSON string tokens become the two required
transport-envelope keys. It does not accept a campaign vector, complete
review, prepare a transaction, access a wallet, or contact a validator or
network.

## Exact-key rule

The decoded key must equal `candidate` or `transportMarker` as the exact
Unicode scalar sequence. The parser does not normalize keys. An ASCII key may
use an equivalent JSON Unicode escape, but an escaped control character or a
Unicode compatibility lookalike does not become a required field.

Three controls accept: the compact baseline plus escaped ASCII spellings of
each required key. Twenty isolated inputs reject:

- seven raw control code points from U+0000 through U+001F inside a quoted key;
- the same seven controls written as valid JSON escapes inside `candidate`;
  and
- six visually or compatibility-related key spellings that normalize to a
  required key under NFKC but are not byte-for-byte the decoded required key.

The normalization cases include partial and complete fullwidth spellings,
circled and mathematical letters, and variants targeting both required keys.
This is deliberately stricter than applying NFC, NFD, NFKC, or NFKD before
field lookup.

Only descriptors, required-key names, representation hashes, byte counts,
error classes, normalization relations, and outcomes are published. Serialized
envelopes and runtime candidates are not.

## Independent replay

The zero-dependency Python mode reconstructs all twenty-three inputs
independently and must match every digest, error, outcome, and commitment.
Changed evidence exits with status `2`.

This audit is review material only. It grants no receipt, deployment,
activation, claim, wallet, signing, RPC, transaction, or chain capability.
