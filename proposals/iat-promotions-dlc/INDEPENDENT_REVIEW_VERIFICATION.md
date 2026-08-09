# Verify-only independent-review attestation adapter

> **DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE**

This adapter verifies externally supplied detached Ed25519 material. It cannot
generate a key, create a signature, access a wallet, contact a network, issue a
review receipt, or authorize activation.

## Public evidence

The positive verification cases are the two already published public RFC 8032
section 7.1 vectors. They establish that the adapter accepts known valid
Ed25519 material without loading any private key.

No valid signature over an IAT review payload is published. Instead, each of
the three canonical review payloads is paired with an unrelated, valid RFC
signature and must fail. This proves the adapter verifies the exact receipt
bytes rather than treating a valid signature over another message as approval.

## Receipt verification sequence

For future externally supplied material, the adapter:

1. canonicalizes and validates the complete unsigned receipt payload;
2. computes and compares its SHA-256 digest;
3. validates exact attestation shape and Ed25519 public-material formats; and
4. verifies the detached signature against the exact payload bytes.

Malformed payloads, extra attestation fields, wrong algorithms, digest
mismatch, changed public keys, changed signatures, and changed message bytes
fail closed.

## Deliberate limits

Cryptographic validity proves only that a holder of the corresponding private
key attested the exact bytes. It does not prove the review was competent, the
reviewer was independent, findings were resolved, the proposal is safe, or an
activation is authorized. Every adapter result therefore fixes semantic review
and reviewer-independence verification to false and activation effect to
`NONE`.

## Reproduce locally

```sh
node proposals/iat-promotions-dlc/generate-independent-review-receipt-verification-vectors.mjs --write
node proposals/iat-promotions-dlc/validate-independent-review-receipt-verification-vectors.mjs
node --test proposals/iat-promotions-dlc/tests/independent-review-receipt-verification.test.mjs
```
