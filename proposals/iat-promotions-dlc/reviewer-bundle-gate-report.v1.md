# Offline independent-review bundle gate report

> **DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE**

This deterministic report is evaluation-only. It does not complete an independent
review, issue a receipt, create a signature, or authorize activation.

## Verdict

- Candidate policy result: **CANDIDATE_REJECTED**
- Gates passed: **5/6**
- Receipt issued: **false**
- Review completed by this linter: **false**
- Activation authorized: **false**
- Activation effect: **NONE**

## Input commitments

- Candidate canonical SHA-256: `23ec8d91b33a965f516bcb0cfd0ab3417d559fdc5a3e6ed19b8fd40ab9a6a895`
- Expected-target canonical SHA-256: `0156c5c929a2f9a36a2c796e432f6c05f35d97772a459605009d1f7a449f8b95`
- Receipt-template canonical SHA-256: `c250d2b854122fae4687bc422da448eadc7c916ae36847fca5c58f6819a6f16e`

The expected target must come from a separately trusted publication or reviewer
workflow. A candidate cannot establish its own review target merely by repeating it.

## Gate results

| Gate | Result |
| --- | --- |
| Exact shape | **PASS** |
| Target binding | **PASS** |
| Complete scope | **PASS** |
| Reviewer independence | **PASS** |
| Semantic review | **PASS** |
| Cryptographic attestation | **FAIL** |

## Failures

- `CRYPTOGRAPHIC_ATTESTATION`: INVALID_EXTERNAL_SIGNATURE

## Authority boundary

A PASS result would mean only that the supplied candidate satisfies the draft review
policy against the separately supplied expected target. This linter always issues no
receipt, completes no review, and has no deployment, wallet, token, site, DNS, network,
Genesis, or activation authority.
