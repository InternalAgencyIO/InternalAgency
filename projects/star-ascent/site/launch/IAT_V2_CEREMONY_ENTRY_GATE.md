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
gate; schedule, artifact, automated evidence, device, authorization, and all safety gates
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

Before any other ceremony check runs, the assertion requires validated
historical-audit integrity, the current-source successor clearance, and all
seven conditions recorded in
`launch/iat-v2-mainnet-readiness-gate.json`:

1. Both historical pre-launch and hardening audit packages still pass their
   immutable `DRAFT_MAINNET_HOLD` validators, and the separate versioned
   `iat-v2-current-source-clearance.json` successor records `CLEAR`. The
   successor requires exact public-GitHub CI build provenance and artifact
   bytes plus current-source public direct evidence for the signed Devnet
   rehearsal, production identity integration, and automated security closure.
   Status-only, Boolean-only, URL-only, or unresolved-digest evidence cannot
   clear it.
2. The read-only balance observation is no more than 30 minutes old with no
   more than one minute of future skew.
3. The public mainnet address has at least exactly `8500000000` lamports.
4. One replacement UTC window is published and the schedule state is
   `SCHEDULED_HOLD`. The readiness record binds both the non-future publication
   time (`publishedAtUtc`) and the exact ceremony time (`scheduledAtUtc`). The
   ceremony time must be canonical UTC, later than publication, and still in
   the future when ceremony entry is assessed.
5. Every bound release artifact was regenerated after both funding and
   scheduling, the canonical V2 ceremony review is `READY`, the canonical V2
   stage journal is `ARMED`, and both validators pass in this same assessment.
6. An automated Mainnet evidence source is bound in that validated V2 ceremony
   record and has recorded both artifact and stage-plan observations without signing
   authority.
7. The exact Model T device path was reviewed in the attended session for the
   sole signer address bound to the readiness ledger in that validated review.

The historical source-bound audit package is public at
[`public/audits/iat-v2-prelaunch-20260802/`](../public/audits/iat-v2-prelaunch-20260802/README.md).
It is an internal Codex-assisted review bound to its historical source. The
later historical pre-launch hardening review is public at
[`public/audits/iat-v2-remediation-20260802/`](../public/audits/iat-v2-remediation-20260802/README.md)
and remains immutable HOLD evidence too. Neither audit package can be rewritten
into a later clearance. Current-source progress is recorded only in
[`iat-v2-current-source-clearance.json`](iat-v2-current-source-clearance.json),
which remains non-authorizing even after its exact evidence predicates pass.

The assessment also directly runs and requires the canonical Mainnet
readiness-ledger validator before it can report entry readiness. It separately
requires the mainnet HOLD/safety boundary,
the honest `VERIFIED_LOCAL_HOST_ONLY` classification, and canonical validation
of `iat-v2-ceremony-review.template.json` and
`iat-v2-mainnet-stage-journal.template.json`. Summary booleans in the readiness
ledger cannot substitute for those V2 source artifacts; any validation failure,
non-`READY` ceremony review, or non-`ARMED` stage journal keeps the
corresponding ceremony gate closed.

If any condition is false, the command exits before the full preflight and
prints the machine-readable blocker identifiers. No earlier approval or passed
preparation audit can bypass this boundary.

## What READY means

`READY_FOR_ATTENDED_PREFLIGHT` allows only the remainder of the attended local
preflight to run. It does not mean `GO`, does not move mainnet from `HOLD`, and
does not authorize a transaction. Physical review of every transaction,
separate explicit broadcast approval, confirmed-chain reconciliation, and
evidence-first publication remain distinct explicit owner decisions. Trezor
Model T physical confirmation is the only human gate and applies only to actual signatures.
