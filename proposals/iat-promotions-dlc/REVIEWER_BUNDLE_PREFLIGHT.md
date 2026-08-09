# Reviewer-input structural preflight

> **DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE**

The local CLI validates the candidate and independently supplied expected target
against their closed Draft-07 schemas before running any of the six semantic
review gates.

Malformed structure returns exact document, JSON Pointer, Draft-07 keyword, and
message diagnostics. The semantic evaluator is not called. Structurally valid
inputs continue to the existing pure six-gate evaluator unchanged.

## CLI exit states

- exit `0`: structurally valid and all six semantic gates pass;
- exit `2`: structurally valid but one or more semantic gates reject;
- exit `3`: parsed JSON fails structural schema preflight; and
- exit `1`: usage, file reading, or JSON parsing fails.

Every outcome remains evaluation-only. Neither structural PASS nor semantic
PASS issues a receipt, completes an independent review, or authorizes
activation.

## Diagnostic boundary

JSON Pointer diagnostics reveal schema paths and validation messages only. They
do not publish raw X identities, mutable handles, OAuth material, private keys,
or wallet secrets. Candidate public keys and detached signatures are already
public review material and remain bound by fixed lowercase-hex patterns.
Markdown table output escapes backslashes before pipe characters and normalizes
line breaks, so crafted field names cannot create ambiguous diagnostic cells.

## Deterministic public vectors

The vector corpus includes one structurally valid public input pair plus nine
candidate/expected-target mutations. Every invalid scenario stops semantic
evaluation and preserves false receipt, review, and activation fields.

## Independent Python reproduction

The zero-dependency Python verifier independently implements the fixed schema
subset and reproduces every result object and normalized Markdown diagnostic in
the public corpus. It never calls the Node validator and has no semantic-review,
signing, receipt, wallet, or network capability. See
[`INDEPENDENT_PREFLIGHT_VERIFICATION.md`](./INDEPENDENT_PREFLIGHT_VERIFICATION.md).

```sh
node proposals/iat-promotions-dlc/generate-reviewer-bundle-preflight-vectors.mjs --write
node proposals/iat-promotions-dlc/validate-reviewer-bundle-preflight-vectors.mjs
python proposals/iat-promotions-dlc/verify-reviewer-bundle-preflight.py --verify-vectors --format json
node --test proposals/iat-promotions-dlc/tests/reviewer-bundle-preflight.test.mjs
node --test proposals/iat-promotions-dlc/tests/reviewer-bundle-preflight-python.test.mjs
```
