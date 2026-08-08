# B3 core-team concentration cap

Status: executable reference law; on-chain custody boundary requires explicit
Mainnet acceptance before the frozen adapter is built.

## Rule requested

The protocol target is that the core team retains no more than 10% of live IAT
and that any enforceable excess is burned for each fixed-UTC+03:00 day beginning
at 00:00. The rule must use Solana state and sysvars only.

## Least-expensive enforceable interpretation

The only identity-free balance the protocol can prove belongs to the core team
is the balance held by an immutable program-owned core-custody vault. A Solana
program cannot discover whether an unrelated pseudonymous wallet is secretly
controlled by a team member. It also cannot confiscate tokens from an ordinary
wallet without a delegate or custody power.

The B3-safe interpretation is therefore:

- `live IAT supply` is the canonical Token-2022 mint `supply` after prior burns;
- `core balance` is the IAT balance in the immutable core-custody vault;
- all protocol-originated core principal and core rewards enter that vault;
- the core release path fails closed until the current cap day is reconciled;
- no mint authority, freeze authority, or permanent delegate is introduced;
- off-protocol purchases or undisclosed wallets are outside what a
  permissionless program can attribute to a human group.

Calling a circulating-supply API, maintaining a changeable wallet list, or
using an identity oracle would make the law stoppable or subjective. Those
designs are rejected.

## Exact burn calculation

Let `S` be mint supply before reconciliation, `C` the core-custody balance, and
`B` the burn. The post-burn invariant is:

```text
10 * (C - B) <= S - B
```

The smallest valid integer burn is:

```text
B = ceil(max(0, 10*C - S) / 9)
```

Using `10% of S` as the target without accounting for the supply destroyed by
the same burn would under-burn. The executable reference uses checked integer
arithmetic and proves that one base unit less would violate the cap.

## Time and liveness

The cap day is `floor((Clock.unix_timestamp + 10,800) / 86,400)`, so it changes
at exactly local 00:00 in fixed UTC+03:00. No external clock or oracle is used.

Solana programs do not wake themselves at midnight. There is no standalone
00:00 reconciliation instruction. During local `00:00:00..00:00:59`, the cap
day has advanced but the new Daily Law day cannot yet be finalized, so core
withdrawals fail closed regardless of any caller-supplied reconciliation day.

The sole authoritative transition is the first successful permissionless call
at or after 00:01. It observes the then-current mint supply and core-custody
balance, calculates the exact burn, requires the Token-2022 `BurnChecked` CPI to
succeed, and records both the reconciliation and that day's deterministic Daily
Law decision atomically. Every result commits or none does. An inbound custody
change between 00:00 and finalization is therefore included in the same burn;
there is no preliminary snapshot that can become stale. The prior decision must
be canonical and closed, and the new day must still be unfinalized.

Core reconciliation and release never accept a caller-authored `ALLOWED` flag.
They validate the canonical Daily Law account, its current height/day, and its
deterministic decision. A current open decision plus same-day reconciliation is
required for withdrawal. Once any current-day decision is recorded, another
transition is rejected; if that decision selected lockdown, every core write
remains rejected for the full selected interval.

## Required V2-to-B3 change

V2 already assigns exactly 100,000,000 IAT, 10% of the original fixed supply,
to a program vault before vesting. V2 principal claims and core weekly reward
settlements eventually send IAT to an ordinary beneficiary account. B3 must
route those protocol-originated core flows through the capped custody boundary
or the daily rule cannot remain enforceable after release.

This preserves the V2 allocation and reward calculations. It changes the final
custody/release path and adds an immutable burn/reconciliation law. Previously
released or independently acquired tokens cannot be clawed back without the
much broader seizure authority that this architecture rejects.

## Mainnet blockers

- Confirm that `active tokens` means canonical live mint supply, not an
  off-chain circulating-supply estimate.
- Confirm that the immutable rule covers protocol-originated core custody and
  does not claim to identify hidden human-controlled wallets.
- Specify the authorized spending/release policy from core custody; a release
  to an ordinary wallet ends cryptographic attribution to the core team.
- Measure the additional frozen-program bytes and rent against the accepted
  3 SOL deployment ceiling.
- Add native adapter, local-validator, Devnet burn, stale-day, forged-account,
  `00:00..00:01` deposit-race, lockdown-ordering, and authority-null evidence
  before Mainnet.

No Mainnet program should be frozen while any item above is unresolved.
