# Settlement contention transport-limit audit

> **DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE**

This compact audit defines a duplicate-aware, resource-bounded JSON transport
boundary for proposal evidence. It does not accept a campaign vector, complete
review, prepare a transaction, access a wallet, or contact a validator or
network.

## Fixed limits

- 65,536 UTF-8 bytes;
- nesting depth 16;
- 32 members per object;
- 32 values per array; and
- 2,048 total JSON values.

The limits are checked before an envelope can return a mutation candidate.
Duplicate keys reject at every object depth rather than silently selecting the
first or last value.

## Compact corpus

Two controls accept: the ordinary envelope and the same envelope padded to
exactly 65,536 bytes. Both reproduce the same canonical base-candidate
commitment and remain runtime-only.

Eight isolated inputs reject:

- duplicate keys at the envelope, candidate, and deep-case levels;
- 65,537 UTF-8 bytes;
- depth 17;
- 33 object members;
- 33 array values; and
- more than 2,048 total values while every local width and byte limit remains
  satisfied.

Each rejection publishes only the representation hash, observed error class,
byte count, and pre-mutation outcome. Raw inputs and candidates are never
stored.

## Independent replay

A zero-dependency Python verifier reconstructs both controls and all eight
rejections independently. It must match every raw digest, limit metric, error
class, and compact commitment. Changed evidence exits with status `2`.

This audit is review material only. It grants no receipt, deployment,
activation, claim, wallet, signing, RPC, transaction, or chain capability.
