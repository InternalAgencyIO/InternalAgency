# B3 reward-consumer gating reference

Status: host-only, non-activating reference. Mainnet and every external side
effect remain **HOLD**.

The reward allocator, durable SQLite CAS, and provider-neutral external
checkpoint protocol previously established deterministic allocation and local
commit lineage. They did not establish the point at which a downstream process
may consume a local commit. In particular, a process could otherwise observe a
valid local CAS head that had not yet reached the external checkpoint.

[`reward-consumer-gate.mjs`](../../programs/iat_b3_reference/reward-consumer-gate.mjs)
adds that missing fail-closed reference boundary.

## Exact admission order

The exported permit constructor performs these checks in order:

1. validate the current canonical Daily-Law reference state before reading any
   store, checkpoint, consumer, or target-commit input;
2. validate the durable store's persistence identity and complete CAS snapshot;
3. validate the external checkpoint chain and require the checkpoint to equal
   the local head exactly — a retained ancestor is not sufficient;
4. bind one exact target sequence and commit digest retained by that anchored
   history;
5. validate the operation-specific proof/consumption or Premium-upgrade
   evidence bound to that commit;
6. decode every allocator receipt and independently require each admitted
   reservation's three lane amounts to sum to its complete obligation, while
   every null outcome has a zero lane plan;
7. issue a process-local branded permit for a local projection only.

The permit binds the persistence identity, external checkpoint, target commit,
source Daily-Law reference, current consumer Daily-Law reference, proof digest,
consumer ID, and exact reservation plan. A serialized or caller-authored object
does not carry the private process brand and is rejected.

## Preserved reward laws

- allocation order remains CCC Agent, CCC Associate, standard-10% and X
  campaigns, authorized weekly faction manifest, then core;
- admitted reservation plans bind one complete obligation and never project a
  partial reservation; this gate does not execute or verify payment;
- treasury, ecosystem, then liquidity remains the only lane order;
- the first unfundable obligation stops peers and lower priorities from
  leapfrogging;
- non-Premium X rewards remain the 10% tranche, and a later accepted Premium
  proof can create only the separately ordered 90% upgrade tranche;
- Daily Law is checked before every state-changing reference path;
- the original CAS commit and allocator receipt lineage are retained rather
  than replaced by a consumer-selected amount or disposition.

## Deliberate HOLD boundary

This module authorizes no token transfer, queue publish, webhook, RPC write,
payment, claim, cleanup, or on-chain reservation. Requests for an
`EXTERNAL_EFFECT` permit fail with `REWARD_CONSUMER_EXTERNAL_EFFECTS_HOLD`.
Every permit reports:

- `runtimeAuthenticationVerified: false`;
- `rollbackProtectionVerified: false`;
- `durableConsumerCursorVerified: false`;
- `externalSideEffectsAuthorized: false`;
- `activationReady: false`;
- `mainnetStatus: "HOLD"`.

The regression suite also freezes the limitations instead of hiding them. An
exact byte-for-byte caller copy of a structurally valid checkpoint is
indistinguishable from an authenticated provider read to this host reference;
it can produce the same local permit repeatedly. A retained but stale ancestor
is rejected when the local CAS has advanced, but the module cannot prove that a
provider response itself is fresh, authentic, monotonic outside the supplied
chain, or protected from rollback. The repeated-permit test also demonstrates
that no durable per-consumer cursor or exactly-once external-effect guarantee
exists. These are limitation tests, not mock authentication.

Production completion still requires a reviewed provider integration, an
authenticated read/write boundary, a durable per-consumer cursor or outbox,
cross-system idempotency and uncertain-result recovery, complete downstream
consumer inventory, exact production identities, and adversarial Devnet
evidence. The reference must not be wired into the app, worker, economic
program, Devnet runner, or release switch as if those gates were complete.
