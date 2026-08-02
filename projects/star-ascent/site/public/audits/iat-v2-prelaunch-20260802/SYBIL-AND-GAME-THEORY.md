# Sybil and game-theory review

> **DRAFT — MAINNET HOLD — MULTI-ACCOUNT MODEL RECORDED — NO REWARD OR CLAIM AUTHORITY**

## Protocol identity assumption

Per the owner's 2026-08-02 direction, the system does not attempt to prove one
unique human. One participant/node is one independently controlled pair:

1. one unique Solana wallet, proven by a fresh domain-separated Ed25519
   challenge;
2. one unique immutable X user ID, proven through OAuth;
3. one eligible X Premium subscription for that authenticated X user.

One person may control multiple qualifying pairs. IP, device, country, handle,
display name, and claimed real-world identity are not deduplication keys. The
country field is a declared CCC affiliation, not nationality or residency.

Under this model, a multi-account operator is not automatically an attacker.
The failure cases are bypassing any per-pair control, reusing an identifier,
capturing ordering unfairly, or creating liabilities outside the public budget.

## Present control matrix

| Required control | Present state | Result |
| --- | --- | --- |
| Exact wallet proof | Domain-separated message, exact 32-byte key/signature, five-minute nonce, atomic consume | Pass |
| Wallet uniqueness | Unique D1 index | Pass for one database |
| Immutable X ID | OAuth `/users/me` ID | Pass as identifier |
| X ID uniqueness | Unique D1 index | Pass for one database |
| X handle rename safety | Handle is not stored as identity key | Pass |
| X Premium per pair | `subscription_type` not requested or stored | Fail |
| Joint wallet/X authorization | Later steps trust bearer `nodeId` | Fail |
| Exact 1,000 Genesis slots | Blueprint exists; production migration/transaction absent | Fail |
| Cross-environment/global uniqueness | No evidence of one canonical production ledger and restore/replay procedure | Open |
| Revocation/recovery | No production cooldown/rebind state machine | Open |

## Economic equilibria

### Genesis race

The 100-IAT first-1,000 gift has a maximum nominal allocation of 100,000 IAT,
or 0.01% of fixed supply. The cap controls total amount, but first-come ordering
rewards automation, proximity, and capital. With multiple pairs allowed, a
rational operator prepares many Premium pairs before opening. That is an
intended consequence only if:

- Premium is actually proven for each pair;
- the final-slot transaction is serial and replay-safe;
- the opening time and queue behavior are public;
- rate limiting cannot reorder already-complete proofs;
- no operator/manual path can insert earlier timestamps or slots.

### Daily account-farm break-even

Let `R = 12 × P` be the daily fiat value of one reward, where `P` is the fiat
value of one IAT. Let `C_x` be the daily amortized X Premium cost and `C_o` the
daily operating/compliance cost. More pairs are rational whenever:

`R > C_x + C_o`.

X controls `C_x` and can change subscription products, prices, API fields, or
eligibility. The protocol must therefore cap its own exposure. An external
subscription is a cost signal, not a supply invariant.

At exactly 1,000 daily pairs, gross distribution is 12,000 IAT/day and
4,380,000 IAT/year. The daily system does not limit participants to the Genesis
1,000, so this is an example, not a maximum. Define in base units:

- maximum claims per epoch;
- maximum IAT per epoch;
- lifetime campaign budget;
- hot-wallet balance/refill ceiling;
- deterministic pro-rata/cutoff rule;
- expiry and unclaimed-fund treatment.

### CCC registry strategy

The weekly selected agency receives a zero rate. Adding candidate identities
therefore reduces the probability that any one active agency is paused. The
program prevents the same wallet from registering twice, but it does not bind
registration to Premium, owner consent, stake, activity, or expiry. If `k`
active agencies are joined by `d` inactive/dummy agencies, an active agency's
pause probability falls from `1/k` to `1/(k+d)`.

Because multiple qualifying pairs are accepted, the policy must explicitly say
whether each pair may be a separate agency. If yes, this is a pay-to-dilute
mechanism whose cost is the Premium/bond requirement and should be disclosed.
If no, a different agency-identity rule is required. Uniform oracle sampling
cannot answer that policy question.

### Randomness liveness and griefing

The current first-committer design lets an external actor buy a permanent denial
for the CCC week by withholding reveal. The griefing cost is transaction/oracle
setup, while the harmed value is every affected CCC position's weekly reward,
closeability, and locked residual reservation. That asymmetric cost makes the
attack rational even without direct profit—for competitors, extortion, or
reputational damage.

A recovery design must not allow selective revelation. Candidate count/hash
must remain fixed, and the fallback must not give the committer or administrator
a choice among multiple outcomes after learning any result.

## Required adversarial simulations before clearance

1. 1,100 simultaneous verified Premium pairs at the Genesis boundary; prove
   exactly slots 1..1000, no duplicates, and deterministic rejection of the
   remainder.
2. Same wallet/different X, same X/different wallet, handle rename, Premium
   downgrade, OAuth replay, challenge replay, stolen node UUID, and database
   restore/replay.
3. 0, 1, 1,000, 10,000, and budget-exhausting daily participants; prove the
   public cap and deterministic oversubscription rule.
4. CCC registry with inactive, zero-position, duplicate-owner, and many
   Premium-pair candidates; measure pause probabilities and operator payoff.
5. Malicious first committer, never reveal, late reveal, wrong-account reveal,
   oracle outage, and recovery race; prove eventual single settlement without
   reroll.
6. Upgrade/admin/custody signer compromise and loss; prove multi-party
   containment and recovery.

## Residual risk that cannot be coded away

X may suspend accounts, change Premium fields, suffer OAuth/API outages, or
permit account transfers. Wallet and X control at one instant is not durable
control forever. Public rules need observation times, revalidation cadence,
appeal/hold handling, and a declared response to X discontinuing the field.

Allowing multiple pairs also permits wealth-based concentration. That is a
policy choice, not a hidden Sybil bug, but it must be paired with explicit
budgets and transparent concentration metrics.
