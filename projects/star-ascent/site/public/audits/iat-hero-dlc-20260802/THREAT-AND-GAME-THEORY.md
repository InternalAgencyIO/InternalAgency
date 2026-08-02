# Propose a Hero threat and game-theory review

> **FUTURE / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE**

## Trust boundaries

1. X authenticates account control and exposes the immutable user ID and
   subscription metadata requested by the verifier. It does not prove a unique
   human.
2. The identity verifier joins X evidence, wallet proof, node binding, campaign,
   purpose, nonce, and freshness into one signed statement. The signature only
   authenticates the verifier; it does not make false source facts true.
3. The future Solana program must verify exact Ed25519 instruction bytes,
   account owners, PDA seeds, mint, canonical token destinations, clock, caps,
   and terminal states. That program does not yet exist.
4. Public commitments hide raw X IDs only if the domain and secret pepper are
   strong and independently governed.

## Accepted multi-account economics

One person may run many qualifying wallet/X/Premium pairs. This is intended,
not a Sybil failure. If the same operator controls proposer pair A and hero pair
B, a 60/120 reward split still returns the full 180 IAT to that operator. The
protocol cannot forbid this while also declining proof of personhood.

Therefore the enforceable controls are:

- every pair independently proves wallet control;
- every pair independently proves a unique immutable X user ID;
- every X account independently has an allowed active Premium tier;
- the same wallet or X ID cannot replay within a reward role;
- accounting and the global 1,000-pair/180,000-IAT limits never bend.

The current model meets the replay and budget goals but not the Premium goal.
Profitability is permissioned by cost, not humanity: operators rationally add
pairs while expected reward exceeds Premium, capital, and operating costs.

## Strategic attacks

### Reservation griefing

A pending proposer pays no IAT and consumes no completed slot, but it creates a
durable exclusive reservation on the hero commitment. With no TTL, one paid
Premium pair can lock one high-value hero forever. Multiple permitted pairs
scale the attack linearly. A short, public TTL plus permissionless cleanup makes
the cost recurring and bounded without adding personhood.

### Verifier capture

A dishonest verifier can mint eligibility facts until 1,000 pairs drain the
vault. Replay protection does not help because the verifier can issue fresh
nonces and identifiers. Threshold review, public append-only outcomes,
rate/anomaly alarms, and an on-chain emergency disable reduce—but do not
eliminate—this oracle risk.

### First-come saturation

If the campaign is first-come after activation, well-prepared multi-pair
operators can dominate the cap. That is compatible with the accepted identity
model, but must be publicly disclosed. Premium is a changing external price,
not a stable proof-of-work or stake. The launch review should model saturation
at several IAT and Premium prices before funding.

### Stalled vault

Exact funding eliminates budget ambiguity but creates liveness risk. If demand
stops, X becomes unavailable, or the verifier is disabled, an active campaign
cannot return unused funds. A future terminal recovery path must be time-bound,
non-redirectable, publicly auditable, and incapable of reopening proposals.
