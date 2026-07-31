# Canonical unsigned independent-review payload

> **DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE**

This proposal fixes the bytes a future independent reviewer would attest after
completing the separate receipt workflow. It does not generate a key, create a
signature, identify a reviewer, issue a receipt, approve the proposal, or
authorize activation.

## Bound fields

The domain-separated message commits to:

- fixed repository and draft pull-request identity;
- exact Git commit, review-manifest digest, review-tree root, covered-file
  count, and canonical scope digest;
- reviewer accountability label and privacy-preserving identity commitment;
- an affirmative independence declaration;
- one of `APPROVE_REVIEW_ONLY`, `REQUEST_CHANGES`, or `REJECT`;
- canonical rationale and findings commitments;
- the review timestamp; and
- fixed `activationAuthorized = false` and `activationEffect = NONE` values.

Field order is exact. Hashes use lowercase fixed-width hex, integers use
canonical decimal strings in JSON and fixed little-endian integers in the
message, and the accountability label is length-prefixed UTF-8.

## Binary framing

The message begins with ASCII `IATRDLC1`, then a length-prefixed signing domain,
payload version, fixed repository, pull-request number, and the ordered receipt
fields. The codec accepts no unknown, missing, or reordered JSON field. It
rejects malformed lengths, unsafe integers, unknown decisions, false
independence declarations, activation authority, truncation, and trailing
bytes.

`independent-review-receipt-payload-vectors.v1.json` publishes one unsigned
message for each allowed review decision, including exact message length, bytes,
and SHA-256 digest. The inputs are synthetic public fixtures. There are no
public keys, signatures, secrets, raw X identities, handles, or wallet fields.

## External boundary

Any future reviewer must independently reproduce these bytes, sign outside this
proposal tooling, and publish a separately verified receipt. This increment
does not implement that signing or claim that verification occurred.

## Reproduce locally

```sh
node proposals/iat-promotions-dlc/generate-independent-review-receipt-payload-vectors.mjs --write
node proposals/iat-promotions-dlc/validate-independent-review-receipt-payload-vectors.mjs
node --test proposals/iat-promotions-dlc/tests/independent-review-receipt-payload.test.mjs
```
