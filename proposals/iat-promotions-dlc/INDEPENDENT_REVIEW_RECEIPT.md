# Independent-review receipt template

> **DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE**

This proposal publishes a machine-readable template for a future independent
review receipt. The template is not a receipt, sign-off, approval, deployment
authorization, activation decision, wallet request, or signature request.

## What a future receipt must bind

A reviewer must bind the receipt to all of the following:

- the exact Git commit;
- the SHA-256 digest of `review-manifest.v1.json`;
- the manifest's review-tree root;
- the manifest's covered-file count; and
- a canonical digest of the declared review scope.

The receipt contract fixes repository and draft-PR identity and requires the
reviewed Git tree to agree with an independently reproduced manifest. A receipt
cannot silently cover a subset of files.

## Review scope

The fixed review areas cover protocol/economics, identity/deduplication, atomic
settlement/rollback, vault and authority isolation, verifier-key lifecycle,
event/account reconciliation, client ABI/fixed bytes, and adversarial tests.
Every open security decision requires an explicit disposition.

Production V2 code, live sites, Mainnet and Devnet state, wallets and keys, DNS
and hosting, and Genesis release gates are explicitly outside this proposal
review. They require their own authorization and evidence.

## Independence and decision semantics

The reviewer cannot concurrently be the proposal author, ceremony operator,
program deployer, promotion-vault authority, or identity-verifier operator. The
template requires a public accountability label, a privacy-preserving reviewer
identity commitment, and an independence declaration in a future receipt. It
does not require wallet authority or raw private identity.

The only future review decisions are `APPROVE_REVIEW_ONLY`,
`REQUEST_CHANGES`, and `REJECT`. Even `APPROVE_REVIEW_ONLY` has no activation
effect. A separate activation review remains mandatory.

## External attestation boundary

A future completed receipt requires an externally supplied Ed25519 public key,
signature, canonical payload digest, and successful independent verification.
This template generates no key, signs no payload, requests no secret, and
contains no reviewer or attestation value. The signing-message format and
public verification vectors remain a separate future proposal increment.

## Reproduce locally

```sh
node proposals/iat-promotions-dlc/generate-independent-review-receipt-template.mjs --write
node proposals/iat-promotions-dlc/validate-independent-review-receipt-template.mjs
node --test proposals/iat-promotions-dlc/tests/independent-review-receipt-template.test.mjs
```
