# Reviewer-bundle portable schema contract

> **DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE**

Three closed Draft-07 schemas define portable JSON boundaries for the offline
reviewer workflow:

1. the externally assembled review candidate;
2. the expected target obtained independently from that candidate; and
3. the evaluation-only lint result.

Every object shape is closed with `additionalProperties: false`. Hashes,
signatures, commit IDs, canonical decimal strings, fixed scope arrays, review
decisions, and HOLD fields have explicit patterns, enums, or constants.

## Structural versus semantic validation

Schema validity proves only that JSON has the expected portable shape. It does
not prove:

- that the expected target came from a trusted source;
- that the candidate and target agree;
- reviewer independence;
- semantic completeness of the review;
- cryptographic validity;
- receipt issuance; or
- activation authority.

The six-gate acceptance evaluator remains the mandatory semantic layer after
all three inputs pass structural validation. The expected target must still be
obtained and compared through an independent publication or reviewer workflow.

## Permanent authority boundary

The lint-result schema fixes `receiptIssued`, `reviewCompletedByThisLinter`, and
`activationAuthorized` to `false`, and `activationEffect` to `NONE`. Even a
future candidate that passes all policy gates cannot turn a lint result into a
receipt or activation instruction.

## Public examples

The deterministic corpus contains three structurally valid examples: the most
complete public candidate, its separately presented target, and its lint
result. The candidate remains rejected because its valid public RFC signature
is unrelated to the canonical review payload.

Fourteen invalid examples isolate closed-object, required-field, canonical
integer, fixed-hex, fixed-scope, HOLD-state, gate-enum, input-binding, receipt,
and activation guards.

## Reproduce locally

```sh
node proposals/iat-promotions-dlc/generate-reviewer-bundle-schema-examples.mjs --write
node proposals/iat-promotions-dlc/validate-reviewer-bundle-schemas.mjs
node --test proposals/iat-promotions-dlc/tests/reviewer-bundle-schema.test.mjs
```
