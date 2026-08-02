# CCC reveal-recovery game theory

> **DRAFT — MAINNET HOLD — NOT INDEPENDENT — NOT DEPLOYED — NO CLAIM ROUTE**

## Actors and choices

The first valid committer initializes the unique weekly round and controls the
Switchboard randomness authority used for reveal. After the oracle result is
available, that actor can either reveal before the deadline or remain silent.

The revised terminal fallback eliminates an unbounded denial-of-service payoff:
silence no longer leaves positions uncloseable. It does not eliminate the
committer's information advantage.

## Payout vectors

For `N` agencies with one equal-sized linked position each:

- successful reveal pays zero to the selected agency and the full weekly amount
  to the other `N - 1` agencies;
- neutral expiry pays each agency the floor of `(N - 1) / N` of its full weekly
  amount.

Both paths have the same ex-ante aggregate expectation before the result is
known, aside from deterministic base-unit floors. They are not the same
realized payoff vector.

If the reveal controller benefits agency `A`, it can reveal whenever another
agency is selected so `A` receives its full reward. When `A` is selected, it
can withhold so `A` receives the neutral amount instead of zero. The controller
therefore has a profitable conditional strategy even though no replacement
random value is requested.

## Security conclusion

Terminal neutral recovery is a liveness control, not a complete randomness
incentive control. It changes `IAT-SEC-001` from permanent external deadlock to
selective reveal optionality. Mainnet remains HOLD.

A closure design needs all of the following:

1. no single economically interested party can suppress the final value;
2. any collateral exceeds the maximum rational gain from withholding and is
   actually slashable on an objective on-chain condition;
3. candidate snapshots and deadlines remain immutable;
4. recovery never requests replacement randomness;
5. signer loss and oracle outage still reach a bounded terminal state;
6. local-validator, signed Devnet, and independent economic review cover the
   final implementation.

Switchboard's official tutorial explicitly calls collateral on commit critical
for games where a player could selectively refuse to reveal. This report uses
that guidance as a design constraint, not as evidence that IAT has implemented
collateral.
