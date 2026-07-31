# External positive campaign-vector intake boundary

> **DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE**

This increment defines the closed, verify-only intake boundary for a future
external campaign-envelope signature vector. It does not supply that vector.
It cannot create a key or signature, issue a receipt, complete an independent
review, deploy code, or authorize activation.

The public corpus is deliberately rejection-only. Its baseline uses a public
RFC 8032 signature that is valid for a different message, so the exact
campaign envelope reaches Ed25519 verification and fails.

## Closed candidate

`positive-campaign-vector-intake.schema.v1.json` permits only:

- fixed HOLD status with network `NONE` and no program ID;
- HTTPS provenance, a source-artifact SHA-256 digest, an accountability label,
  and explicit declarations about independence and signing material;
- the exact campaign envelope, public Ed25519 key, detached public signature,
  and claimed canonical message bytes/digest;
- a bounded independent-review result; and
- fixed non-authority fields: no receipt, no review completion by the intake,
  no activation authorization, and effect `NONE`.

Every object is closed with `additionalProperties: false`. Private keys,
seeds, mnemonics, OAuth material, access tokens, signing requests, wallet
prompts, and raw private identity data are outside the contract.

## Independently supplied target

The evaluator also requires a separate expected-target object with one exact
ordered shape. It binds campaign ID, key ID, public key, source-artifact
digest, review-receipt digest, and the two external availability/review flags.
The candidate does not get to choose whether a positive vector exists or was
independently reviewed.

`EXPECTED_TARGET` validates that separately supplied object's exact shape.
`CANONICAL_MESSAGE_BINDING` then requires the candidate envelope, public key,
signature bytes, canonical message bytes, and message digest to match it and
the verify-only adapter's own reconstruction.

## Fixed gate order

The pure evaluator runs eight gates in order:

1. `CLOSED_SCHEMA`
2. `EXPECTED_TARGET`
3. `PRIVATE_MATERIAL_EXCLUSION`
4. `EXTERNAL_PROVENANCE`
5. `CANONICAL_MESSAGE_BINDING`
6. `CRYPTOGRAPHIC_SIGNATURE`
7. `INDEPENDENT_VECTOR_REVIEW`
8. `NON_AUTHORITY`

A candidate is eligible only if all eight pass. Eligibility would mean only
that the public vector may proceed through the separately governed review
process. It would not issue a review receipt or authorize deployment or
activation.

## Published rejection corpus

`positive-campaign-vector-intake-vectors.v1.json` publishes ten deterministic
rejections covering:

- the unrelated-signature baseline with absent provenance and review;
- missing provenance and an added private-material field;
- canonical message-byte and digest drift;
- source-artifact digest drift;
- an independently supplied public-key mismatch;
- a forbidden activation claim;
- a candidate-only review claim; and
- an unrelated signature mislabelled as source-signed.

Every result fixes receipt issuance, review completion, and activation
authority to false with activation effect `NONE`. No published scenario passes
all eight gates. `positiveVectorIntegrationBlocked` therefore remains true.

## Offline reproduction

```sh
node proposals/iat-promotions-dlc/generate-positive-campaign-vector-intake-vectors.mjs --write
node proposals/iat-promotions-dlc/validate-positive-campaign-vector-intake-vectors.mjs
node --test proposals/iat-promotions-dlc/tests/positive-campaign-vector-intake.test.mjs
```

The evaluator is local-read-only. The generator writes only the deterministic
public rejection artifact and never generates cryptographic or review
material.

An independently implemented Python verifier and its standard-library-only
public Ed25519 operation are documented in
[`INDEPENDENT_POSITIVE_VECTOR_INTAKE_VERIFICATION.md`](./INDEPENDENT_POSITIVE_VECTOR_INTAKE_VERIFICATION.md).
