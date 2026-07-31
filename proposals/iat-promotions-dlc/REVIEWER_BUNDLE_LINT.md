# Offline reviewer-bundle lint contract

> **DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE**

The reviewer-bundle linter is a local, read-only presentation layer over the
six-gate independent-review acceptance policy. It reads a candidate JSON file,
an independently supplied expected-target JSON file, and the held receipt
template. It prints a deterministic JSON or Markdown gate report.

It does not write a receipt, create or store a signature, complete an
independent review, contact a network, access a wallet, or authorize activation.

Portable candidate, expected-target, and lint-result shapes are defined in the
[reviewer-bundle schema contract](./REVIEWER_BUNDLE_SCHEMAS.md). Passing those
schemas establishes structure only; the six-gate semantic policy remains
mandatory.

## Required trust boundary

The expected target must be obtained independently from the candidate bundle.
The reviewer must compare its commit, review-manifest digest, Merkle root, and
covered-file count with the separately trusted public release target. Repeating
candidate-controlled values in both input files is not independent target
verification.

The linter binds each input to a canonical SHA-256 digest in its report so a
reviewer can compare exactly which bytes and semantic objects were evaluated.

## Exit behavior

- exit `0`: all six draft policy gates pass;
- exit `2`: the bundle was parsed and rejected by one or more gates; and
- exit `3`: parsed JSON fails candidate or expected-target schema preflight; and
- exit `1`: usage, file reading, or JSON parsing failed.

Even exit `0` is evaluation-only. It does not issue or publish a receipt and it
has no activation effect.

## Offline usage

```sh
node proposals/iat-promotions-dlc/reviewer-bundle-linter.mjs \
  --candidate ./candidate.json \
  --expected-target ./expected-target.json \
  --format markdown
```

Use `--format json` for a machine-readable report. The public generated report
uses the most complete rejection-only candidate: five gates pass and the absent
external review signature remains visibly failed.

The CLI now runs the [structural preflight](./REVIEWER_BUNDLE_PREFLIGHT.md)
first. Structural failure prints exact document, JSON Pointer, keyword, and
message diagnostics and prevents the semantic evaluator from running.

## Reproduce the public report

```sh
node proposals/iat-promotions-dlc/generate-reviewer-bundle-gate-report.mjs --write
node proposals/iat-promotions-dlc/validate-reviewer-bundle-gate-report.mjs
node --test proposals/iat-promotions-dlc/tests/reviewer-bundle-linter.test.mjs
```
