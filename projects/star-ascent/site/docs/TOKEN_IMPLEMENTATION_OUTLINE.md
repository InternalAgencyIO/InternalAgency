# IAT V2 token implementation

Status: **host-tested / not deployed / mainnet HOLD**

No live mint, V2 program, vault, authority change, or distribution is asserted
by this repository.

## Fixed architecture

| Layer | V2 decision |
| --- | --- |
| Token | Original SPL Token Program, 9 decimals, fixed 1,000,000,000 IAT supply |
| Metadata | Canonical immutable Metaplex metadata |
| Allocations | 50% community, 20% treasury, 15% ecosystem, 10% core team, 5% liquidity |
| Custody | Community hardware wallet plus four IAT V2 program-vault PDAs |
| Rewards | Fully reserved; treasury → ecosystem → liquidity; no reward debt or automatic compounding |
| Rates | 17% core, 10% standard, 28% CCC Agent, 20% CCC Associate |
| Vesting | Policy-defined 25% reward-lane genesis capacity and weekly cliff/linear schedules |
| Weekly draw | One committed Switchboard reveal, exact-uniform mapping, no reroll |
| Program control | Hardware-wallet upgrade authority before any IAT funding |
| Operator surface | Superseded `/mint` page is read-only |

The exact machine-readable policy is
`engagement/iat-economic-policy.v2.json`. The allocation and devnet evidence
schemas are `launch/iat-v2-allocation-plan.template.json` and
`launch/iat-v2-devnet-rehearsal.template.json`.

## Deployment order

1. Bind a real public program ID into the committed source.
2. Produce and hash a locked verifiable SBF build.
3. Deploy the exact binary unfunded.
4. Transfer upgrade authority to the published Model T administrator.
5. Create the immutable mint and metadata.
6. Initialize config, lane vaults, and stake vault.
7. Mint the five exact allocations.
8. Revoke mint and freeze authorities.
9. Activate only after randomness, build, authority, and review gates pass.
10. Complete positive and adversarial devnet scenarios and independent review.

The former four-transaction mint-only implementation is historical test
scaffolding. It cannot activate V2 and must not be used for devnet or mainnet.

## Hard stops

- No secret or keypair material in source or evidence.
- No wallet automation, blind prompt, or public-host signing.
- No IAT in program vaults before the verified program is hardware-controlled.
- No wrong-cluster Switchboard program, stale reveal, reroll, or mutable
  candidate snapshot.
- No uncollateralized position, reward debt, or rate substitution.
- No mainnet action before SBF, local-validator, devnet, security/economic
  review, and independent-evidence gates pass.
