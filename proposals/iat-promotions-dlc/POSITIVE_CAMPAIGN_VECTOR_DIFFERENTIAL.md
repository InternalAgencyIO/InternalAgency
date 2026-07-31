# Cross-runtime positive-vector intake mutation corpus

> **DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE**

This corpus requires the Node and independent Python intake evaluators to
produce exactly the same complete result for twenty deterministic mutations.
It expands rejection evidence only. It publishes no valid campaign signature,
review receipt, completed review, deployment permission, or activation effect.

## Mutation families

`positive-campaign-vector-intake-differential-vectors.v1.json` covers:

- intake version, required status, unknown fields, and HOLD-label order;
- independently supplied target key order, version, and public-key binding;
- an added secret-bearing field name and changed source-artifact provenance;
- a source-signed assertion that still fails real Ed25519 verification;
- claimed canonical message bytes, digest, public key, and signature hex;
- a changed signed payload with stale attestation ID;
- a changed detached-signature byte with matching public hex representation;
- candidate-only review completion and independently bound review completion;
  and
- forbidden receipt-issuance and activation-authority claims.

Every case is derived from the same public rejection baseline and fixes the
eight gate IDs and order. The independently bound review case deliberately
passes the review gate while failing the cryptographic gate, proving that
review metadata cannot replace a signature over the exact campaign message.

## Cross-runtime contract

The Node generator publishes each mutated candidate, independently supplied
target, and complete expected result. The Node validator regenerates the
artifact. The zero-dependency Python verifier independently re-runs schema
validation, canonical-message construction, Ed25519 verification, and every
gate, then requires full object equality.

All source artifacts are content-bound by canonical or normalized SHA-256.
All results remain rejection-only and fix receipt issuance, review completion,
and activation authorization to false with effect `NONE`.

## Offline reproduction

```sh
node proposals/iat-promotions-dlc/generate-positive-campaign-vector-intake-differential-vectors.mjs --write
node proposals/iat-promotions-dlc/validate-positive-campaign-vector-intake-differential-vectors.mjs
python proposals/iat-promotions-dlc/verify-positive-campaign-vector-intake.py --verify-differential-vectors --format json
node --test proposals/iat-promotions-dlc/tests/positive-campaign-vector-intake-differential.test.mjs
```

Expected Python summary:

```json
{
  "valid": true,
  "errors": [],
  "mutationCount": 20,
  "nodeAndPythonMatchExactly": true,
  "receiptIssued": false,
  "reviewCompleted": false,
  "activationAuthorized": false,
  "activationEffect": "NONE"
}
```
