# CCC Associates threat and game-theory review

> **INTENDED FUTURE FEATURE / NOT PART OF GENESIS / INACTIVE / NO SEPARATE DEPLOYMENT / NO CLAIM ROUTE**

## Trust boundaries

1. The common V2 administrator currently creates agencies and certifies wallet
   roles. There is no independent Associates activation or verifier boundary.
2. X and X Premium evidence are entirely off-chain and absent from the account
   model. A Solana administrator signature is not proof of wallet/X/Premium
   qualification.
3. Associate positions depend on the common reward vaults and every CCC weekly
   round. A liveness failure in randomness becomes a position-exit failure.
4. The public “future feature” statement is operational documentation. The
   binary currently recognizes role `2`; documentation cannot disable it.

## Accepted multi-account economics

Multiple qualifying wallet/X/Premium pairs controlled by one person are
allowed. The security question is not whether the owner is a unique human; it
is whether every pair pays and proves the full qualification cost.

At 2,000 bps, Associate positions receive twice the standard 1,000-bps rate in
unpaused weeks. Administrative certification therefore creates an economic
rent. With no Premium proof, objective admission rule, participant cap, or
separate budget, the current rent is limited primarily by shared vault capacity
and administrator discretion.

## Registry-padding game

One owner wallet can appear only once, but one person may control many wallets.
That is intentionally allowed if each wallet has its own immutable X ID and
Premium subscription. The current agency registry does not demand any of those
costs—or even the owner signature.

Let `N` be legitimate active agencies and `P` be padded inactive agencies. An
active agency's pause probability falls from `1/N` to `1/(N+P)`. If a strategic
operator gains more from reducing pauses across its positions than it pays to
create padding entries, padding is rational. Exact-uniform randomness cannot
fix a manipulated candidate set.

An economically meaningful registry needs owner consent, one qualifying
wallet/X/Premium pair per agency, and an epoch-specific stake, bond, or active
position rule. Those controls price the behavior without pretending to prove
one human.

## Administrator and timing game

Because role assignment is discretionary and can occur immediately after
common activation, the administrator can favor early wallets before a public
Associates opening. A later public T+1-week announcement cannot undo positions
already opened. A default-off on-chain state and a public, one-way activation
record are necessary for fair ordering.

## Randomness hostage game

The first payer to create a weekly round owns the only round PDA path, while
Associate settlement requires that round to reach settled status. Withholding
reveal is cheap compared with the aggregate positions it can freeze. This is a
denial-of-service game, not a randomness-bias game; uniform sampling after a
successful reveal does not solve it.

## Budget competition

Each position reserves its maximum reward from common treasury, ecosystem, and
liquidity lanes. That prevents undercollateralized acceptance but does not
define an Associate program budget. Early or favored Associate enrollment can
consume capacity that later standard participants expected. Before future
activation, publish an exact cap, cutoff, terminal state, and concentration
simulation.
