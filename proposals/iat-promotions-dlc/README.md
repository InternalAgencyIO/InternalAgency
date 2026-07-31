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
- [Verifier-key lifecycle reference policy](./VERIFIER_KEY_LIFECYCLE.md)
- [Network-free verifier-key lifecycle model](./verifier-key-lifecycle.mjs)
- [Verifier-registry interface amendment](./KEY_LIFECYCLE_AMENDMENT.md)
- [Machine-readable lifecycle amendment](./program-interface-key-lifecycle-amendment.v1.json)
- [Lifecycle amendment byte vectors](./program-interface-key-lifecycle-vectors.v1.json)
- [Lifecycle amendment validator](./validate-key-lifecycle-amendment.mjs)
- [Proposal-only tests](./tests/)

Run the proposal-only checks with:

```sh
node proposals/iat-promotions-dlc/validate-policy.mjs
node proposals/iat-promotions-dlc/validate-program-interface.mjs
node proposals/iat-promotions-dlc/validate-ed25519-public-vectors.mjs
node proposals/iat-promotions-dlc/validate-key-lifecycle-amendment.mjs
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
```

## Deliberate isolation

No file in this directory is imported by the production site, launch tooling,
wallet console, or on-chain program. A later implementation requires a new
review cycle, an independent security assessment, a public artifact hash,
Devnet rehearsal evidence, a separately funded promotion vault, and an explicit
mainnet activation record.
