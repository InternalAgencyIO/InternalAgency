# Independent-review receipt acceptance policy

> **DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE**

This pure policy evaluates whether a future externally signed review receipt
satisfies every review gate. It issues no receipt, completes no review, creates
no signature, and authorizes no activation.

## All gates are mandatory

A candidate is accepted only when all six gates pass:

1. exact candidate, target, and reviewer object shapes;
2. exact agreement among expected target, candidate target, and signed payload;
3. complete scope, including all manifest entries and every open security
   decision;
4. reviewer identity binding, affirmative independence declaration, and no
   disallowed concurrent role;
5. allowed decision, evidence commitments, timestamp, blocking-finding rules,
   and fixed non-activation semantics; and
6. valid detached Ed25519 attestation over the exact canonical payload.

The policy enumerates nine open security decisions from the public status and
requires a unique disposition and evidence commitment for each. A blocking
disposition prevents `APPROVE_REVIEW_ONLY` but is compatible with
`REQUEST_CHANGES` or `REJECT`.

## Rejection-only public vectors

No valid signature over a review payload exists in this draft. The most
complete public candidate therefore passes the first five gates and fails only
cryptographic attestation. Additional vectors isolate target mismatch, scope
omission, reviewer-role conflict, blocking approval, and activation claims.

Every vector remains rejected, issues no receipt, claims no completed review,
and fixes activation effect to `NONE`. This makes the missing independent human
and cryptographic step visible instead of fabricating a sign-off.

## Reproduce locally

```sh
node proposals/iat-promotions-dlc/generate-independent-review-receipt-acceptance-vectors.mjs --write
node proposals/iat-promotions-dlc/validate-independent-review-receipt-acceptance-vectors.mjs
node --test proposals/iat-promotions-dlc/tests/independent-review-receipt-acceptance.test.mjs
```
