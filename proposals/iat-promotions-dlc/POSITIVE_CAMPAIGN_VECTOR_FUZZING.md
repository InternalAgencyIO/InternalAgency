# Seeded positive-vector intake fuzzing

**DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE**

This proposal-only corpus expands the fixed 20-case differential suite into
256 deterministic rejection cases. It tests the intake boundary; it does not
publish a valid campaign signature, approve a reviewer, issue a receipt, touch
a wallet or network, or authorize activation.

## Reproducibility contract

- seed: hexadecimal `49544154`;
- generator: unsigned 32-bit `xorshift32`;
- case count: 256;
- family selection: `caseIndex mod 10` in the published family order;
- derivations: SHA-256 over a fixed domain, seed, index, PRNG word, and label;
- evaluation: the existing pure Node intake evaluator and the independent
  Python standard-library implementation must produce the same compact record;
- storage: only mutations, input/result commitments, gate outcomes, and fixed
  false/`NONE` authority claims are published—full 256-case inputs and results
  are replayed rather than stored; and
- commitment: each compact case is canonically hashed, then committed in a
  domain-separated SHA-256 Merkle tree with duplicate-final-node handling.

The first six families receive 26 cases and the remaining four receive 25,
because 256 is not evenly divisible by 10. This is fixed by index, not sampled
coverage.

## Mutation families

1. `CLOSED_SCHEMA` adds an unknown top-level field.
2. `EXPECTED_TARGET` rotates target key insertion order.
3. `PRIVATE_MATERIAL_EXCLUSION` adds a visibly synthetic forbidden field.
4. `EXTERNAL_PROVENANCE` changes the source-artifact digest.
5. `CANONICAL_MESSAGE_BINDING` changes the claimed message digest.
6. `PUBLIC_KEY_BINDING` changes the candidate's claimed public key.
7. `INDEPENDENT_VECTOR_REVIEW` supplies internally consistent review-only
   bindings; that gate passes while invalid cryptography still rejects.
8. `NON_AUTHORITY` flips one forbidden authority claim.
9. `CRYPTOGRAPHIC_SIGNATURE` changes one signature byte and keeps the mirrored
   hexadecimal signature synchronized.
10. `CRYPTOGRAPHIC_GUARD` changes the nonce while retaining the stale
    attestation ID.

## Fail-closed properties

Every case must have at least one failing gate and must end with no intake
acceptance, no receipt, no review completion by the evaluator, no activation
authority, and activation effect `NONE`. A changed case commitment, replay
result, source digest, family count, or Merkle root fails verification.

The corpus deliberately contains synthetic strings under `accessToken` keys to
prove private-field rejection. Their exact public format is
`forbidden-fuzz-placeholder-<index>-<8 lowercase hex characters>`; they are not
credentials and confer no access.

## Local commands

```text
node proposals/iat-promotions-dlc/generate-positive-campaign-vector-intake-fuzz-vectors.mjs --write
node proposals/iat-promotions-dlc/validate-positive-campaign-vector-intake-fuzz-vectors.mjs
python proposals/iat-promotions-dlc/verify-positive-campaign-vector-intake.py --verify-fuzz-vectors --format json
node --test proposals/iat-promotions-dlc/tests/positive-campaign-vector-intake-fuzz.test.mjs
```

These commands read public local proposal files only. They create no key or
signature, make no network call, and have no deployment or claim path.
