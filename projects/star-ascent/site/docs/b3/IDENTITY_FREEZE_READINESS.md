# B3 immutable identity-freeze input contract

Status: **BLOCKED / IDENTITY-FREEZE READINESS ONLY**

The canonical draft is
[`iat-b3-identity-freeze.v1.json`](iat-b3-identity-freeze.v1.json), governed by
[`iat-b3-identity-freeze.v1.schema.json`](iat-b3-identity-freeze.v1.schema.json)
and the stricter semantic validator at
[`scripts/validate-iat-b3-identity-freeze.mjs`](../../scripts/validate-iat-b3-identity-freeze.mjs).
It does not select, generate, deploy, fund, or publish a production identity.
It is not a Mainnet, deployment, launch, or release-readiness validator.

The draft deliberately reports `BLOCKED`. In particular, it refuses to treat
the retained V2 program, disposable local-validator programs, fixture programs,
or any rehearsal mint as a B3 identity. It also leaves the production law ID,
economy ID, canonical Token-2022 mint, cluster identity policy, Mainnet Genesis
hash, final entropy lag, and metadata policy unresolved. The cluster-policy
choices include the recommended same law/economy/mint public keys across
clusters while keeping all non-production state noncanonical and disposable.
Candidate seed domains, the Genesis transition predicate, and ceremony order
are enumerated as identity-freeze inputs but remain `BLOCKED` until their
separate owning artifacts are accepted.

## Identity-readiness boundary

For this contract alone to report `identityFreezeReady: true`, its fields must
be internally complete and freeze all of the following inputs together:

- distinct, canonical Base58 identities for the law program, economy program,
  and Mainnet Token-2022 mint, with an explicit same/different-cluster policy;
- the `IAT_B3_SOLANA_DAILY_LAW_V1` domain, independently observed Mainnet
  Genesis hash, mint binding, entropy-slot binding, final lag, skipped-slot
  selection, and fail-closed insufficient-history behavior;
- all 22 account-role seed namespaces, including the donation-safe
  `stake-ingress` authority and the allegiance, scoring, weekly, reward-vault,
  reward-manifest, follower-snapshot, and claim faction address boundaries;
- the already-fixed faction machine IDs `radiance`, `ellie`, `alia`, `ece`, and
  `boss`, their public labels Radiance, Ellie, Alia, Ece, and **the boss**, the
  exact `86,400`-second allegiance cooldown, no-op same-faction rejection, and
  the rule that narrative leaders hold no protocol authority;
- exactly nine decimals, fixed supply, only `ConfidentialTransferMint` and
  `TransferHook`, no Permanent Delegate or mint-close authority, no auditor,
  and null mint, freeze, hook, and confidential-mint authorities at the stated
  terminal points;
- the one-way `UNINITIALIZED -> GENESIS_STAGING -> ACTIVE` transition. Staging
  may only create canonical accounts and fund exact manifest amounts; it cannot
  release, reward, score, pledge, open a position, reserve, withdraw, or claim;
- an ordered ceremony policy requiring hardware-held temporary upgrade
  authorities, byte and identity verification, irrevocable revocation of both
  program upgrade authorities before mint creation, exact funding,
  mint/freeze revocation, atomic law initialization and extension-authority
  sealing, a finalized open current day, and activation last. Activation also
  requires the mint, freeze, transfer-hook, and confidential-mint authorities
  to be terminally null.

Even a production-profile manifest with `productionIdentityReady: true` would
certify only that these identity-freeze inputs are complete and internally
consistent. It does **not** certify faction scoring or reward economics,
Genesis allocation amounts or conservation evidence, reviewed binary hashes or
deployed bytes, program authority revocation evidence, an on-chain ceremony,
or Mainnet/release readiness. Those remain separately reviewed blockers and
gates. The seed table names faction account roles; it does not select their
scoring weights, community carve-out, emissions, prizes, or claim economics.
Likewise, the Genesis predicate constrains permitted staging operations but
does not supply or approve a Genesis allocation ledger.

The complete fixture in `tests/iat-b3-identity-freeze.test.mjs` uses conspicuous
test-only identities and can pass only with the validator's explicit
`allowTestFixture` option. Relabeling any of its four identities as
`PRODUCTION` fails closed, and the option never yields
`productionIdentityReady: true`.

## Use

Run the non-release audit directly:

```text
node scripts/validate-iat-b3-identity-freeze.mjs
```

The current canonical draft prints its blockers and exits with status `2`.
This is intentional and is not wired as a failing launch or deployment gate.
The B3 regression suite instead proves both sides: the production draft stays
honestly unresolved, while a structurally complete test-only fixture passes;
placeholders, malformed or duplicate keys, V2/disposable identities, seed
collisions, broadened mint extensions, staging writes, and unsafe seal ordering
all fail closed.
