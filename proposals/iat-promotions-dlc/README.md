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
- [Machine-readable policy](./promotion-policy.v0.json)
- [Policy validator](./validate-policy.mjs)
- [Mutation tests](./tests/policy.test.mjs)

Run the proposal-only checks with:

```sh
node proposals/iat-promotions-dlc/validate-policy.mjs
node --test proposals/iat-promotions-dlc/tests/policy.test.mjs
node --test proposals/iat-promotions-dlc/tests/reference-engine.test.mjs
```

## Deliberate isolation

No file in this directory is imported by the production site, launch tooling,
wallet console, or on-chain program. A later implementation requires a new
review cycle, an independent security assessment, a public artifact hash,
Devnet rehearsal evidence, a separately funded promotion vault, and an explicit
mainnet activation record.
