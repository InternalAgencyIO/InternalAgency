# B3 operator factions

Status: executable reference specification. Scoring, Sybil resistance, reward
funding, and prize authority remain Mainnet blockers.

## Fixed factions

B3 defines exactly five faction identifiers:

| Machine ID | Public leader label |
| --- | --- |
| `radiance` | Radiance |
| `ellie` | Ellie |
| `alia` | Alia |
| `ece` | Ece |
| `boss` | the boss |

The male character has no published personal name. Public narrative refers to
him only as **the boss**. All five leaders are fictional narrative identities.
They hold no signer, upgrade, mint, vault, scoring, finalization, or reward
authority. A character must never become a privileged protocol key.

## Allegiance

Each operator may have one on-chain allegiance account for one fixed faction.
The first pledge is immediate. A change is valid only when the Solana Clock
sysvar satisfies:

```text
Clock.unix_timestamp >= last_changed_at + 86,400
```

The exact second at 86,400 is allowed; 86,399 is rejected. Pledging to the
already-selected faction is a no-op and is rejected. There is no external
clock, keeper identity, admin override, leader signature, or cooldown reset.

The initial operator identity boundary should reuse the preserved wallet/X
binding rather than silently declaring one wallet to be one human. Whether an
eventually audited on-chain identity commitment replaces that dependency is an
open design decision.

## Lockdown law

The faction program is subordinate to the immutable IAT-wide Daily Law. Every
faction state-changing instruction must receive and validate the canonical law
state directly. This includes:

- first pledge and allegiance switch;
- score submission or commitment;
- weekly result finalization;
- IAT or NFT reward funding;
- reward claims, expiry, and carry-forward;
- any future faction administrative transition.

If the current IAT day is absent, stale, or selected for lockdown, the write
fails closed. Read-only faction standings, allegiance, history, and reward
receipts remain available. A transfer hook alone is not sufficient because it
cannot block a faction write that moves no token.

No faction instruction accepts a caller-supplied `ALLOWED`/lockdown enum. The
reference API requires an accepted Daily Law state whose height-derived day and
decision are revalidated by the shared Daily Law engine. A plain object, copied
state object, stale decision, malformed draw, or unfinalized current day fails
closed. The Mainnet equivalent must load the canonical Daily Law PDA and verify
its owner, seeds, discriminator, and SlotHashes-bound decision provenance.

## Weekly competition

The executable reference supports an immutable seven-day epoch anchor, exact
integer score inputs for all five factions, a unique-winner finalization, and
idempotent replay. It deliberately does not invent how scores are earned.

A Mainnet scoring design must freeze:

- the eligible digital actions and their weights;
- proof source and replay prevention;
- one-operator enforcement and Sybil resistance;
- score cutoff, late-event, rollback, and challenge behavior;
- canonical weekly epoch anchor;
- an exact tie rule compatible with the preserved one-roll/no-reroll contract.

Until those fields are specified and adversarially tested, a tied maximum fails
closed rather than letting an operator choose a winner.

## Community-pool distribution

V2 holds the 500,000,000 IAT community lane in hardware custody and explicitly
marks it as not being a reward source. A recurring, permissionless faction
reward cannot be paid trustlessly from that wallet: every payment would require
a Trezor signature and could be delayed, refused, or redirected off protocol.

The least-expensive trustless relaxation is an explicit, fixed, capped carve-out
from the community lane, funded once into a program-owned faction reward vault
before authority finalization. The remaining community allocation retains its
V2 custody boundary. The carve-out cannot be increased after the Mainnet law is
frozen.

The exact amount, weekly emission schedule, funding horizon, solvency priority,
and unused-balance destination are not authorized by the current narrative and
remain launch blockers. No implementation may infer them.

Given a sealed weekly pool and nonnegative faction scores, the reference engine
allocates whole IAT base units proportionally. Fractional dust carries forward;
canonical order never grants an artificial bonus. Zero activity carries the
entire pool forward.

## Winner rewards

A weekly reward manifest must be sealed before its scoring period opens. It may
describe equal IAT distribution, already-created NFT inventory, or another
audited prize type. Finalization cannot add a prize after the winner is known.

For equal IAT distribution, every eligible follower receives the same whole
base-unit amount. If there are no eligible followers, the complete reward
carries forward. Indivisible remainder also carries forward rather than
favoring an address by sort order.

NFT creation or transfer requires a separately frozen mint/update authority,
collection, supply, metadata, eligibility-snapshot, expiry, and unclaimed-prize
policy. The faction module receives no IAT mint, freeze, or permanent-delegate
authority.

## Program boundary

Faction competition is evolving application economics, not part of the small
immutable transfer-hook dispatcher. It belongs in a separate native module or
the retained V2-continuity runtime. That module must:

- read the immutable law state before every write;
- route IAT payouts through the canonical Token-2022 transfer path, so the hook
  independently enforces lockdown;
- use pre-funded PDA custody and permissionless/idempotent finalization;
- expose no privileged leader or operator reroll;
- preserve full conservation and audit receipts.

Splitting the module improves audit and upgrade isolation but is not presumed
cheaper. The optimized Daily Law program already consumes a measured
`1.97768400 SOL` fresh-payer peak, leaving only `1.02231600 SOL` under the
accepted 3 SOL aggregate ceiling. The faction binary, state rent, mint/NFT
accounts, and any retained V2 runtime must be measured together before claiming
the target is met.

## Executable evidence

The pure reference is
[`programs/iat_b3_reference/factions.mjs`](../../programs/iat_b3_reference/factions.mjs)
with focused vectors in
[`tests/iat-b3-factions.test.mjs`](../../tests/iat-b3-factions.test.mjs).
It covers fixed IDs, narrative-only leaders, first pledge, the exact 24-hour
boundary, no-op rejection, missing/locked-day rejection, proportional integer
accounting, zero-followers carry-forward, and idempotent unique-winner
finalization.

It is specification evidence, not a deployed or Mainnet-authorized program.
