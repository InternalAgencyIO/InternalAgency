# IAT V2 ceremony-entry gate

Status: **DRAFT — UNSCHEDULED — MAINNET HOLD — NO CLAIM ROUTE**

This gate separates ordinary preparation checks from an attended mainnet
preflight. It is local and read-only. It cannot connect to a wallet, access a
device, create a key, sign, simulate for signing, broadcast, deploy, mint,
transfer, schedule, authorize, or publish anything.

## Preparation audit

Refresh the canonical funding evidence first when a current observation is
needed:

```bash
npm run refresh:iat-v2-mainnet-funding
```

This command performs one finalized `getBalance` request against the official
mainnet RPC. It accepts no wallet, key, custom endpoint, transaction, signing,
or broadcast input. A balance at or above the floor updates only the funding
gate; schedule, artifact, verifier, device, authorization, and all safety gates
remain unchanged and mainnet remains `HOLD`.

Run this while preparing artifacts:

```bash
node scripts/run-launch-preflight.mjs
```

The command reports the current ceremony-entry blockers and then checks local
artifact consistency. A passing preparation audit means only that the checked
HOLD artifacts are internally consistent. It is not permission to enter the
ceremony.

## Attended ceremony-entry assertion

Run this only during the final attended review:

```bash
node scripts/run-launch-preflight.mjs --require-ceremony-ready
```

Before any other ceremony check runs, the assertion requires the public
pre-launch audit clearance and all six conditions recorded in
`launch/iat-v2-mainnet-readiness-gate.json`:

1. The canonical pre-launch audit manifest records `CLEAR`, zero open
   critical/high findings, resolved security blockers, and a completed
   independent final-code audit.
2. The read-only balance observation is no more than 30 minutes old with no
   more than one minute of future skew.
3. The public mainnet address has at least exactly `8500000000` lamports.
4. One replacement UTC window is published and the schedule state is
   `SCHEDULED_HOLD`.
5. Every bound release artifact was regenerated after both funding and
   scheduling.
6. An independent mainnet verifier is assigned.
7. The exact Model T device path was reviewed in the attended session.

The source-bound audit package is public at
[`public/audits/iat-v2-prelaunch-20260802/`](../public/audits/iat-v2-prelaunch-20260802/README.md).
It is an internal Codex-assisted review, not an independent security audit, and
it is deliberately fail-closed while any critical/high finding remains open.

The assessment also independently requires the mainnet HOLD/safety boundary
and the honest `VERIFIED_LOCAL_HOST_ONLY` classification; either failure adds a
separate blocker.

If any condition is false, the command exits before the full preflight and
prints the machine-readable blocker identifiers. No earlier approval or passed
preparation audit can bypass this boundary.

## What READY means

`READY_FOR_ATTENDED_PREFLIGHT` allows only the remainder of the attended local
preflight to run. It does not mean `GO`, does not move mainnet from `HOLD`, and
does not authorize a transaction. Physical review of every transaction,
separate explicit broadcast approval, confirmed-chain reconciliation, and
evidence-first publication remain distinct human-controlled boundaries.
