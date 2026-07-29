# IAT V2 program architecture

Status: host-compiled implementation; BPF build, independent review, and
matching hardware-wallet devnet rehearsal pending. Mainnet HOLD.

This document translates `engagement/iat-economic-policy.v2.json` into
enforceable Solana state transitions. It does not authorize a deployment,
wallet signature, mint, vault funding, or reward claim.

## Fixed implementation decisions

- Original SPL Token Program, 9 decimals, fixed supply of 1B IAT.
- Program-owned PDA token vaults for treasury, ecosystem, core-team principal,
  liquidity, and user-staked principal.
- The Model T address is the intended program administrator and must become the
  upgrade authority before any IAT enters a program vault.
- Beneficiary hardware-wallet addresses receive only transfers permitted by
  the immutable vesting and reward rules.
- Treasury, ecosystem, and liquidity are the only reward lanes, consumed in
  that order.
- Core-team principal is never a reward lane.
- User positions last 52 weeks and may renew only by opening a new,
  independently fully collateralized position.
- Annual rates use 52 weekly periods and cumulative integer arithmetic. There
  is no automatic compounding.
- CCC round zero opens 24 hours after the recorded Genesis timestamp. Later
  round indices open every 604,800 seconds from that first selection.
- Program timing maps 6, 12, 24, and 36 policy months to 26, 52, 104, and 156
  weekly periods. Treasury finishes at week 208 because its 156-week
  linear phase follows its 52-week cliff.

## Program accounts

`Config` is the singleton policy account. It binds the mint, Original Token
Program, hardware administrator, beneficiaries, Genesis timestamp, policy
constants, activation state, agency count, rolling agency-registry commitment,
tracked stake principal, and bumps.

`VaultAuthority` is a signing PDA with no mutable data. It owns every program
token vault.

`LaneVault` exists once for treasury, ecosystem, core team, and liquidity. It
binds the canonical token account, total allocation, Genesis-unlocked amount,
cliff, linear end, paid amount, beneficiary, and outstanding reservation.

`StakeVault` is the shared IAT principal vault. Its tracked principal total
must always reconcile to the token balance.

`CoreReward` reserves the complete 104-week, 17% simple reward obligation
before any user position can be accepted.

`Eligibility` binds one wallet to `standard`, `cccAgent`, or `cccAssociate`.
CCC roles also bind an immutable agency index for the lifetime of an accepted
position.

`Agency` is append-only and indexed from zero. A separate owner-index PDA
prevents one wallet from registering repeatedly to weight the draw. Each append
updates a rolling registry hash. Weekly selection snapshots the current count
and registry hash, so the operator cannot omit an existing agency or reroll
around one.

`Round` binds one policy week to one Switchboard randomness account, commit
slot, snapshotted agency count and registry hash, decision context, final
32-byte value, accepted derivation counter, and selected index. A settled round
is immutable.

`Position` binds owner, principal, accepted week, first accrual week, role,
agency index, rate, 52-bit settlement bitmap, reward paid, and the outstanding
reservation split across the three ordered lanes.

## Instruction boundary

1. `initialize_config`
2. `initialize_lane_vault`
3. `initialize_stake_vault`
4. `activate`
5. `register_agency`
6. `set_eligibility`
7. `open_position`
8. `commit_round`
9. `settle_round`
10. `settle_position_week`
11. `settle_core_week`
12. `claim_lane_principal`
13. `withdraw_position_principal`
14. `close_position`

`activate` must reject unless the program ID and verified build are published,
the hardware upgrade authority is already effective, all five allocation
destinations hold the exact amounts, mint and freeze authorities are both
revoked, the core reward obligation can be reserved in full, and the
Switchboard adapter has passed a compiled local and devnet test.

## Reservation algorithm

For a new position:

1. Calculate maximum simple reward for the complete 52-week term at the
   position's maximum role rate.
2. Calculate currently unlocked, unreserved capacity in treasury.
3. Reserve as much as possible from treasury, then ecosystem, then liquidity.
4. Reject atomically if any base unit remains unreserved.
5. Keep the reservation attached to the position until it is paid or released
   after all 52 weekly outcomes are settled.

The program never records reward debt. Previously accepted reservations have
priority over later positions. Permissionless vested-principal release can
transfer only unlocked capacity left after reservations and reward payments.
Those releases reduce later reward capacity.

## Universal one-roll tiebreak

Every protocol decision with two or more exactly equal candidates uses the same
method, including a 2-way or 100-way CCC tie:

1. Canonically order and commit the complete candidate set before requesting
   randomness.
2. In one atomic transaction, commit one Switchboard randomness account and
   call `commit_round`. The IAT instruction parses the instructions sysvar and
   requires the exact Switchboard `randomness_commit` discriminator, account,
   signer, and program immediately before it. It then requires Switchboard's
   fresh prior-slot seed and binds it to the decision ID, candidate-set hash,
   candidate count, and domain.
3. After the one reveal, derive
   `sample_i = SHA256("IAT_TIEBREAK_V1" || decision_context || randomness || i)`.
4. Let `n` be the candidate count and
   `limit = 2^256 - (2^256 mod n)`. Reject a derived sample only when
   `sample_i >= limit`; otherwise the final winner is `sample_i mod n`.

The counter expands one oracle result; it is not another roll. This rejection
step removes the modulo bias that would otherwise favor some indices whenever
`n` does not divide `2^256`. For the supported `u32` candidate range, a rejected
sample has probability below `2^-224`, and the implementation permits 16
deterministic derivations. The candidate snapshot, randomness account, commit
slot, reveal, counter, winner, and settlement transaction are public. There is
no operator reroll and no unresolved tie. “Immediate” means the request starts
at once and becomes final on its committed reveal; it does not mean zero
network latency.

## Weekly CCC draw

Any payer may commit the one round PDA for the current CCC round. Round zero is
rejected until 24 hours after Genesis; later rounds advance every seven days
from that first selection. The Switchboard
commit and IAT `commit_round` calls must share one Solana transaction; the
instruction rejects any non-adjacent or malformed commit and any seed slot
other than Switchboard's fresh prior-slot seed. It stores the exact Switchboard
randomness account and the current append-only agency count.
Settlement parses that same account against the pinned Switchboard On-Demand
0.13 ABI, requires a reveal in the settlement slot and a seed slot matching the
committed round, stores the full 32 bytes, and derives:

The CCC winner uses the universal exact-uniform tiebreak above with the
snapshotted append-only agency registry as its candidate set. Once settled, the
round cannot be replaced or rerolled.

Positions linked to the selected agency receive a zero rate for that week.
Their principal, earlier accrual, and reservation remain untouched. The
core-team reward account does not read CCC state and remains fixed at 17%.

## Explicit blockers

- The Windows host has an isolated Rust 1.97.1 toolchain and the 14 host tests
  pass, but WSL/Linux, Solana CLI 3.1.10, Anchor CLI 1.0.2, and Docker are not
  available. A locked SBF/verifiable build has therefore not run on this host.
- The ABI-pinned Switchboard parser compiles and its discriminator, offsets,
  official cluster program IDs, same-transaction commit instruction, prior-slot
  seed rule, current-slot reveal rule, seed-slot binding, and no-reroll paths
  have host coverage. The exact
  Switchboard commit/reveal transaction still requires BPF integration testing
  and a signed devnet rehearsal.
- The mint and program IDs do not exist.
- Program vault PDAs do not exist.
- No security or economic review has occurred.
- The existing four-transaction mint ceremony does not initialize or fund this
  program and is superseded for V2.

## Required verification

Run the pure policy model first:

```text
node --test tests/iat-v2-reference-engine.test.mjs
node scripts/validate-iat-v2-policy.mjs
```

After installing the official Linux/WSL toolchain, run the locked Rust tests,
the SBF/verifiable build, local-validator integration tests, and the
hardware-wallet devnet rehearsal. Only then may the V2 allocation plan move
from HOLD.
