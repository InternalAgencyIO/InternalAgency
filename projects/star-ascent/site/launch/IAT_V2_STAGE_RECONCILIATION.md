# IAT V2 mainnet stage reconciliation

Status: **DRAFT — INACTIVE — MAINNET HOLD — NO TRANSACTION AUTHORITY**

`iat-v2-mainnet-stage-journal.template.json` is the canonical non-authorizing
record for the eight reviewed V2 ceremony boundaries. It does not sign,
broadcast, retry, repair, compensate, publish, or establish on-chain truth.

## Before any stage

The journal may move from `HOLD` to `ARMED` only after it binds the exact source
commit, six canonical artifact byte digests, four distinct public identities,
and precommitted transaction-message and expected-post-state digests for all
eight stages. The readiness record must retain its safety controls while
recording a funded, scheduled, regenerated, independently reviewed, explicitly
authorized attended ceremony. `ARMED` is still a record state, not authority.

## After every confirmed stage

Stop. An independent verifier records the direct mainnet Explorer transaction,
confirmation time, verification time, verifier label, and observed post-state
digest. Continue only when that digest exactly matches the precommitted expected
post-state digest. Signatures cannot be reused between stages.

The only successful terminal state is `RECONCILED`, with all eight stages
`FINALIZED_MATCHED`. Publication remains a separate review after reconciliation.

## First mismatch or failure

The first mismatch changes this record permanently to `TERMINAL_HOLD`. Earlier
matched stages remain recorded, the failed boundary is named, and every later
stage is `NOT_ATTEMPTED`. There is no automatic retry, compensating transaction,
approval reuse, or improvised repair path. Preserve the journal and observable
evidence. Any recovery proposal requires a new separately reviewed record and
must never overwrite this terminal history.

Validate locally with:

```text
node scripts/validate-iat-v2-mainnet-stage-journal.mjs
node scripts/test-iat-v2-mainnet-stage-journal-regression.mjs
```
