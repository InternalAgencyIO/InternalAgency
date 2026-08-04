# IAT V2 identity and incentive review

> **DRAFT - MAINNET HOLD - NOT INDEPENDENT - NOT DEPLOYED - NO CLAIM ROUTE**

## Identity model

The policy identifies a qualifying participant by the pair of one exact
32-byte Solana wallet and one immutable X user ID with current Premium or
PremiumPlus status. It is deliberately not proof of one biological person.

A person may control multiple qualifying pairs if every pair has a distinct
wallet, a distinct immutable X user ID, qualifying Premium status, and an X
account age of at least 40 days. The same person may also legitimately collect
both sides of a future Hero pair through two distinct qualifying pairs. This is
accepted policy, not a bypass.

The 40-day account minimum and paid Premium requirement raise the capital,
time, and operational cost of bulk Sybil creation. They do not eliminate
purchased accounts, compromised accounts, coordinated groups, payment fraud,
or provider-data compromise. The correct public claim is cost-raising and
deduplication, not personhood.

## Genesis scarcity

There are exactly 1,000 numbered Genesis slots. A pending or failed activation
must not consume one. The wallet/X binding, slot reservation, and activation
are prepared as one database batch so one request wins the final slot and all
failed statements roll back. Production D1 contention and rollback behavior
still needs integration rehearsal.

This first-valid atomic allocation favors earlier eligible participants. That
is transparent but may induce congestion near the cap. Server-side rate limits
and bounded retries protect availability; they must not silently create more
slots or a privileged refill path.

## Daily liability

Each UTC epoch selects at most 1,000 qualifying pairs deterministically. Each
winner receives 12 IAT, so the exact maximum is 12,000 IAT per epoch and
4,380,000 IAT over 365 epochs. Duplicate wallet or immutable X ID, stale
Premium observation, account age below 40 days, and replay are rejected before
selection. Expired, invalid, or unclaimed entries do not create replacement
budget.

Deterministic canonical selection removes discretionary winner choice but can
still be gamed if an attacker can predict and cheaply create many eligible
pairs before the committed snapshot. The Premium fee, 40-day age, unique
wallet/X pair, snapshot commitment, hard winner cap, and lifetime budget bound
the attack; they do not make it impossible.

## Future DLC boundary

CCC, Propose a Hero, and Associates are future features, inactive at Genesis.
Every CCC instruction is compiled fail-closed and has no Genesis activation
instruction. Hero and Associates remain separately documented, audited, and
blocked until later review and explicit activation. No future-feature finding
is evidence of a Genesis claim route.

## Custody incentives

Keeping all authorities on one Trezor removes hot-key and server-key exposure
but concentrates upgrade, administration, and custody incentives in one
device/operator boundary. An attended ceremony and public evidence reduce
accidental misuse; they do not prevent coercion, compromise, or correlated key
loss. The owner has accepted this topology, so the audit records the risk
rather than claiming authority separation.

## Conclusion

The implemented rules make rewards bounded, auditable, deterministic, and
more expensive to Sybil. They do not establish personhood, independent custody,
or current-source on-chain assurance. Mainnet remains HOLD until fresh build,
signed Devnet, independent review, funding, scheduling, and ceremony gates are
separately completed.
