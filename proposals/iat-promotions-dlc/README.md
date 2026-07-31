# IAT Promotions DLC

> **DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE**

This directory is a public design workspace for a possible post-Genesis IAT
promotion. It does not modify the IAT V2 program, authorize a deployment,
create a claim, reserve tokens, or promise that the feature will activate.

The proposal lets a verified node nominate one hero by X handle. If that hero
later connects a verified X identity to a Solana wallet, one atomic settlement
would pay:

- 120 IAT to the hero;
- 60 IAT to the proposer; and
- no more than 1,000 completed proposer/hero pairs in total.

The maximum campaign budget is therefore 180,000 IAT, isolated in a dedicated
promotion vault funded from the community allocation. Pending, invalid,
cancelled, or duplicate nominations do not consume a completed-pair slot.

## Fixed draft rules

- Participation is optional and never blocks node activation.
- The earliest possible activation is eight hours after independently verified
  mainnet Genesis.
- The campaign must also be separately reviewed, funded, and activated.
- A hero reward is bound to an immutable X user identity, not a mutable handle.
- A node may receive one proposer reward and one hero reward, once each.
- Node, wallet, and X identity are deduplicated independently for each role.
- Self-proposals are rejected.
- Both transfers settle atomically or neither transfer occurs.
- Exactly 1,000 completed pairs permanently exhaust the campaign.
- "Instant" means transaction preparation as soon as eligibility is verified;
  normal Solana submission and confirmation still apply.

## First planning pass

- [Protocol and delivery plan](./PLAN.md)
- [Threat model](./THREAT_MODEL.md)
- [Public status](./STATUS.md)
- [Network-free reference engine](./reference-engine.mjs)
- [Adversarial test matrix](./ADVERSARIAL_TEST_MATRIX.md)
- [Verifier attestation and transparency contract](./ATTESTATION_AND_TRANSPARENCY.md)
- [Network-free attestation/log model](./attestation-transparency.mjs)
- [Machine-readable policy](./promotion-policy.v0.json)
- [Policy validator](./validate-policy.mjs)
- [Proposed program interface](./PROGRAM_INTERFACE.md)
- [Machine-readable account/instruction interface](./program-interface.v0.json)
- [Deterministic instruction vectors](./program-interface-vectors.v0.json)
- [Network-free instruction codec](./program-interface-codec.mjs)
- [Network-free instruction transition adapter](./instruction-transition-adapter.mjs)
- [Interface validator](./validate-program-interface.mjs)
- [Public-key-only RFC 8032 vectors](./ed25519-public-vectors.v0.json)
- [Ed25519 public-vector validator](./validate-ed25519-public-vectors.mjs)
- [Campaign-envelope verification boundary](./CAMPAIGN_ENVELOPE_VERIFICATION.md)
- [Verify-only campaign-envelope adapter](./campaign-envelope-verifier.mjs)
- [Rejection-only campaign-envelope vectors](./campaign-envelope-verification-vectors.v1.json)
- [Campaign-envelope vector generator](./generate-campaign-envelope-verification-vectors.mjs)
- [Campaign-envelope vector validator](./validate-campaign-envelope-verification-vectors.mjs)
- [External positive-vector intake boundary](./POSITIVE_CAMPAIGN_VECTOR_INTAKE.md)
- [Closed positive-vector intake schema](./positive-campaign-vector-intake.schema.v1.json)
- [Pure verify-only intake evaluator](./positive-campaign-vector-intake.mjs)
- [Rejection-only intake vectors](./positive-campaign-vector-intake-vectors.v1.json)
- [Intake-vector generator](./generate-positive-campaign-vector-intake-vectors.mjs)
- [Intake-vector validator](./validate-positive-campaign-vector-intake-vectors.mjs)
- [Independent Python intake-verification contract](./INDEPENDENT_POSITIVE_VECTOR_INTAKE_VERIFICATION.md)
- [Independent zero-dependency Python intake verifier](./verify-positive-campaign-vector-intake.py)
- [Cross-runtime intake mutation contract](./POSITIVE_CAMPAIGN_VECTOR_DIFFERENTIAL.md)
- [Twenty-case differential vectors](./positive-campaign-vector-intake-differential-vectors.v1.json)
- [Differential-vector generator](./generate-positive-campaign-vector-intake-differential-vectors.mjs)
- [Differential-vector validator](./validate-positive-campaign-vector-intake-differential-vectors.mjs)
- [Seeded cross-runtime intake fuzzing contract](./POSITIVE_CAMPAIGN_VECTOR_FUZZING.md)
- [Compact 256-case fuzz commitments](./positive-campaign-vector-intake-fuzz-vectors.v1.json)
- [Seeded fuzz-vector generator](./generate-positive-campaign-vector-intake-fuzz-vectors.mjs)
- [Seeded fuzz-vector validator](./validate-positive-campaign-vector-intake-fuzz-vectors.mjs)
- [Minimal intake counterexample contract](./POSITIVE_CAMPAIGN_VECTOR_MINIMAL_COUNTEREXAMPLES.md)
- [Ten compact minimal counterexamples](./positive-campaign-vector-intake-minimal-counterexamples.v1.json)
- [Minimal-counterexample generator](./generate-positive-campaign-vector-intake-minimal-counterexamples.mjs)
- [Minimal-counterexample validator](./validate-positive-campaign-vector-intake-minimal-counterexamples.mjs)
- [Representation-sensitivity audit contract](./POSITIVE_CAMPAIGN_VECTOR_REPRESENTATION_AUDIT.md)
- [Compact representation audit, collision proofs, tree-size-bound multiproof, and even/odd-width property suites](./positive-campaign-vector-representation-audit.v1.json)
- [Representation-audit generator](./generate-positive-campaign-vector-representation-audit.mjs)
- [Representation-audit validator](./validate-positive-campaign-vector-representation-audit.mjs)
- [Verifier-key lifecycle reference policy](./VERIFIER_KEY_LIFECYCLE.md)
- [Network-free verifier-key lifecycle model](./verifier-key-lifecycle.mjs)
- [Verifier-registry interface amendment](./KEY_LIFECYCLE_AMENDMENT.md)
- [Machine-readable lifecycle amendment](./program-interface-key-lifecycle-amendment.v1.json)
- [Lifecycle amendment byte vectors](./program-interface-key-lifecycle-vectors.v1.json)
- [Lifecycle amendment validator](./validate-key-lifecycle-amendment.mjs)
- [Held full-interface composition preview](./COMPOSITION_PREVIEW.md)
- [Machine-readable composed preview](./program-interface-composition-preview.v1.json)
- [Deterministic preview composer](./compose-program-interface-preview.mjs)
- [Composed instruction vectors](./program-interface-composition-vectors.v1.json)
- [Deterministic composed-vector generator](./generate-composed-interface-vectors.mjs)
- [Cross-interface drift validator](./validate-program-interface-composition.mjs)
- [ABI offset and conformance contract](./ABI_OFFSET_MANIFEST.md)
- [Machine-readable ABI offset manifest](./program-interface-abi-offsets.v1.json)
- [Deterministic ABI-manifest generator](./generate-abi-offset-manifest.mjs)
- [ABI offset and conformance validator](./validate-abi-offset-manifest.mjs)
- [Program event interface](./EVENT_INTERFACE.md)
- [Machine-readable event layouts](./program-event-interface.v1.json)
- [Fixed-width event codec](./program-event-codec.mjs)
- [Deterministic event vectors](./program-event-vectors.v1.json)
- [Event-vector generator](./generate-program-event-vectors.mjs)
- [Event interface validator](./validate-program-event-interface.mjs)
- [Event/account reconciliation contract](./EVENT_RECONCILIATION.md)
- [Machine-readable reconciliation policy](./event-reconciliation-policy.v1.json)
- [Network-free event reconciler](./event-reconciler.mjs)
- [Compact reconciliation vectors](./event-reconciliation-vectors.v1.json)
- [Deterministic reconciliation-vector generator](./generate-event-reconciliation-vectors.mjs)
- [Reconciliation-vector validator](./validate-event-reconciliation-vectors.mjs)
- [Draft-07 evidence schema](./event-reconciliation-evidence.schema.v1.json)
- [Draft-07 result schema](./event-reconciliation-result.schema.v1.json)
- [Synthetic schema examples](./event-reconciliation-schema-examples.v1.json)
- [Dependency-free proposal schema subset validator](./json-schema-subset.mjs)
- [Schema-example generator](./generate-event-reconciliation-schema-examples.mjs)
- [Schema and example validator](./validate-event-reconciliation-schemas.mjs)
- [Content-addressed review contract](./REVIEW_MANIFEST.md)
- [Deterministic review manifest](./review-manifest.v1.json)
- [Review-manifest generator](./generate-review-manifest.mjs)
- [Review-manifest validator](./validate-review-manifest.mjs)
- [Independent zero-dependency Python verifier](./verify-review-manifest.py)
- [Independent-review receipt contract](./INDEPENDENT_REVIEW_RECEIPT.md)
- [Held independent-review receipt template](./independent-review-receipt-template.v1.json)
- [Receipt-template generator](./generate-independent-review-receipt-template.mjs)
- [Receipt-template validator](./validate-independent-review-receipt-template.mjs)
- [Canonical unsigned review-payload contract](./INDEPENDENT_REVIEW_PAYLOAD.md)
- [Unsigned review-payload codec](./independent-review-receipt-payload.mjs)
- [Public unsigned payload/hash vectors](./independent-review-receipt-payload-vectors.v1.json)
- [Payload-vector generator](./generate-independent-review-receipt-payload-vectors.mjs)
- [Payload-vector validator](./validate-independent-review-receipt-payload-vectors.mjs)
- [Verify-only receipt-attestation contract](./INDEPENDENT_REVIEW_VERIFICATION.md)
- [Detached Ed25519 verification adapter](./independent-review-receipt-verifier.mjs)
- [Public verification vectors](./independent-review-receipt-verification-vectors.v1.json)
- [Verification-vector generator](./generate-independent-review-receipt-verification-vectors.mjs)
- [Verification-vector validator](./validate-independent-review-receipt-verification-vectors.mjs)
- [Independent-review acceptance policy](./INDEPENDENT_REVIEW_ACCEPTANCE.md)
- [Pure receipt-candidate evaluator](./independent-review-receipt-acceptance.mjs)
- [Rejection-only acceptance vectors](./independent-review-receipt-acceptance-vectors.v1.json)
- [Acceptance-vector generator](./generate-independent-review-receipt-acceptance-vectors.mjs)
- [Acceptance-vector validator](./validate-independent-review-receipt-acceptance-vectors.mjs)
- [Offline reviewer-bundle lint contract](./REVIEWER_BUNDLE_LINT.md)
- [Local-file-only reviewer-bundle linter](./reviewer-bundle-linter.mjs)
- [Human-readable rejection-only gate report](./reviewer-bundle-gate-report.v1.md)
- [Gate-report generator](./generate-reviewer-bundle-gate-report.mjs)
- [Gate-report validator](./validate-reviewer-bundle-gate-report.mjs)
- [Portable reviewer-bundle schema contract](./REVIEWER_BUNDLE_SCHEMAS.md)
- [Reviewer-candidate Draft-07 schema](./reviewer-candidate.schema.v1.json)
- [Expected-target Draft-07 schema](./reviewer-expected-target.schema.v1.json)
- [Lint-result Draft-07 schema](./reviewer-lint-result.schema.v1.json)
- [Rejection-only schema examples](./reviewer-bundle-schema-examples.v1.json)
- [Schema-example generator](./generate-reviewer-bundle-schema-examples.mjs)
- [Reviewer-bundle schema validator](./validate-reviewer-bundle-schemas.mjs)
- [Reviewer-input structural preflight](./REVIEWER_BUNDLE_PREFLIGHT.md)
- [Local-read-only preflight engine](./reviewer-bundle-preflight.mjs)
- [Deterministic preflight vectors](./reviewer-bundle-preflight-vectors.v1.json)
- [Preflight-vector generator](./generate-reviewer-bundle-preflight-vectors.mjs)
- [Preflight-vector validator](./validate-reviewer-bundle-preflight-vectors.mjs)
- [Independent Python preflight contract](./INDEPENDENT_PREFLIGHT_VERIFICATION.md)
- [Independent zero-dependency Python preflight](./verify-reviewer-bundle-preflight.py)
- [Proposal-only tests](./tests/)

Run the proposal-only checks with:

```sh
node proposals/iat-promotions-dlc/compose-program-interface-preview.mjs --write
node proposals/iat-promotions-dlc/generate-composed-interface-vectors.mjs --write
node proposals/iat-promotions-dlc/generate-abi-offset-manifest.mjs --write
node proposals/iat-promotions-dlc/generate-program-event-vectors.mjs --write
node proposals/iat-promotions-dlc/generate-event-reconciliation-vectors.mjs --write
node proposals/iat-promotions-dlc/generate-event-reconciliation-schema-examples.mjs --write
node proposals/iat-promotions-dlc/generate-independent-review-receipt-template.mjs --write
node proposals/iat-promotions-dlc/generate-independent-review-receipt-payload-vectors.mjs --write
node proposals/iat-promotions-dlc/generate-independent-review-receipt-verification-vectors.mjs --write
node proposals/iat-promotions-dlc/generate-independent-review-receipt-acceptance-vectors.mjs --write
node proposals/iat-promotions-dlc/generate-reviewer-bundle-gate-report.mjs --write
node proposals/iat-promotions-dlc/generate-reviewer-bundle-schema-examples.mjs --write
node proposals/iat-promotions-dlc/generate-reviewer-bundle-preflight-vectors.mjs --write
node proposals/iat-promotions-dlc/generate-campaign-envelope-verification-vectors.mjs --write
node proposals/iat-promotions-dlc/generate-positive-campaign-vector-intake-vectors.mjs --write
node proposals/iat-promotions-dlc/generate-positive-campaign-vector-intake-differential-vectors.mjs --write
node proposals/iat-promotions-dlc/generate-positive-campaign-vector-intake-fuzz-vectors.mjs --write
node proposals/iat-promotions-dlc/generate-positive-campaign-vector-intake-minimal-counterexamples.mjs --write
node proposals/iat-promotions-dlc/generate-positive-campaign-vector-representation-audit.mjs --write
node proposals/iat-promotions-dlc/generate-review-manifest.mjs --write
node proposals/iat-promotions-dlc/validate-policy.mjs
node proposals/iat-promotions-dlc/validate-program-interface.mjs
node proposals/iat-promotions-dlc/validate-ed25519-public-vectors.mjs
node proposals/iat-promotions-dlc/validate-key-lifecycle-amendment.mjs
node proposals/iat-promotions-dlc/validate-program-interface-composition.mjs
node proposals/iat-promotions-dlc/validate-abi-offset-manifest.mjs
node proposals/iat-promotions-dlc/validate-program-event-interface.mjs
node proposals/iat-promotions-dlc/validate-event-reconciliation-vectors.mjs
node proposals/iat-promotions-dlc/validate-event-reconciliation-schemas.mjs
node proposals/iat-promotions-dlc/validate-review-manifest.mjs
node proposals/iat-promotions-dlc/validate-independent-review-receipt-template.mjs
node proposals/iat-promotions-dlc/validate-independent-review-receipt-payload-vectors.mjs
node proposals/iat-promotions-dlc/validate-independent-review-receipt-verification-vectors.mjs
node proposals/iat-promotions-dlc/validate-independent-review-receipt-acceptance-vectors.mjs
node proposals/iat-promotions-dlc/validate-reviewer-bundle-gate-report.mjs
node proposals/iat-promotions-dlc/validate-reviewer-bundle-schemas.mjs
node proposals/iat-promotions-dlc/validate-reviewer-bundle-preflight-vectors.mjs
node proposals/iat-promotions-dlc/validate-campaign-envelope-verification-vectors.mjs
node proposals/iat-promotions-dlc/validate-positive-campaign-vector-intake-vectors.mjs
node proposals/iat-promotions-dlc/validate-positive-campaign-vector-intake-differential-vectors.mjs
node proposals/iat-promotions-dlc/validate-positive-campaign-vector-intake-fuzz-vectors.mjs
node proposals/iat-promotions-dlc/validate-positive-campaign-vector-intake-minimal-counterexamples.mjs
node proposals/iat-promotions-dlc/validate-positive-campaign-vector-representation-audit.mjs
python proposals/iat-promotions-dlc/verify-reviewer-bundle-preflight.py --verify-vectors --format json
python proposals/iat-promotions-dlc/verify-positive-campaign-vector-intake.py --verify-vectors --format json
python proposals/iat-promotions-dlc/verify-positive-campaign-vector-intake.py --verify-differential-vectors --format json
python proposals/iat-promotions-dlc/verify-positive-campaign-vector-intake.py --verify-fuzz-vectors --format json
python proposals/iat-promotions-dlc/verify-positive-campaign-vector-intake.py --verify-minimal-counterexamples --format json
python proposals/iat-promotions-dlc/verify-positive-campaign-vector-intake.py --verify-representation-audit --format json
python proposals/iat-promotions-dlc/verify-review-manifest.py
node --test proposals/iat-promotions-dlc/tests/policy.test.mjs
node --test proposals/iat-promotions-dlc/tests/reference-engine.test.mjs
node --test proposals/iat-promotions-dlc/tests/attestation-transparency.test.mjs
node --test proposals/iat-promotions-dlc/tests/randomized-state-machine.test.mjs
node --test proposals/iat-promotions-dlc/tests/program-interface.test.mjs
node --test proposals/iat-promotions-dlc/tests/instruction-transition-adapter.test.mjs
node --test proposals/iat-promotions-dlc/tests/deterministic-byte-fuzz.test.mjs
node --test proposals/iat-promotions-dlc/tests/ed25519-public-vectors.test.mjs
node --test proposals/iat-promotions-dlc/tests/verifier-key-lifecycle.test.mjs
node --test proposals/iat-promotions-dlc/tests/key-lifecycle-amendment.test.mjs
node --test proposals/iat-promotions-dlc/tests/program-interface-composition.test.mjs
node --test proposals/iat-promotions-dlc/tests/abi-offset-manifest.test.mjs
node --test proposals/iat-promotions-dlc/tests/program-event-interface.test.mjs
node --test proposals/iat-promotions-dlc/tests/event-reconciler.test.mjs
node --test proposals/iat-promotions-dlc/tests/event-reconciliation-vectors.test.mjs
node --test proposals/iat-promotions-dlc/tests/event-reconciliation-schema.test.mjs
node --test proposals/iat-promotions-dlc/tests/review-manifest.test.mjs
node --test proposals/iat-promotions-dlc/tests/review-manifest-python.test.mjs
node --test proposals/iat-promotions-dlc/tests/independent-review-receipt-template.test.mjs
node --test proposals/iat-promotions-dlc/tests/independent-review-receipt-payload.test.mjs
node --test proposals/iat-promotions-dlc/tests/independent-review-receipt-verification.test.mjs
node --test proposals/iat-promotions-dlc/tests/independent-review-receipt-acceptance.test.mjs
node --test proposals/iat-promotions-dlc/tests/reviewer-bundle-linter.test.mjs
node --test proposals/iat-promotions-dlc/tests/reviewer-bundle-schema.test.mjs
node --test proposals/iat-promotions-dlc/tests/reviewer-bundle-preflight.test.mjs
node --test proposals/iat-promotions-dlc/tests/reviewer-bundle-preflight-python.test.mjs
node --test proposals/iat-promotions-dlc/tests/campaign-envelope-verification.test.mjs
node --test proposals/iat-promotions-dlc/tests/positive-campaign-vector-intake.test.mjs
node --test proposals/iat-promotions-dlc/tests/positive-campaign-vector-intake-python.test.mjs
node --test proposals/iat-promotions-dlc/tests/positive-campaign-vector-intake-differential.test.mjs
node --test proposals/iat-promotions-dlc/tests/positive-campaign-vector-intake-fuzz.test.mjs
node --test proposals/iat-promotions-dlc/tests/positive-campaign-vector-intake-minimal-counterexamples.test.mjs
node --test proposals/iat-promotions-dlc/tests/positive-campaign-vector-representation-audit.test.mjs
```

## Deliberate isolation

No file in this directory is imported by the production site, launch tooling,
wallet console, or on-chain program. A later implementation requires a new
review cycle, an independent security assessment, a public artifact hash,
Devnet rehearsal evidence, a separately funded promotion vault, and an explicit
mainnet activation record.
