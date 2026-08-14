# B3 non-circular pre/post-Devnet readiness gates

The legacy `scripts/assess-iat-b3-all-feature-devnet-readiness.mjs` remains a
fail-closed, machine-readable two-lane evidence observer. It never signs, broadcasts, deploys,
funds, activates, or queries RPC. It does not build
artifacts and does not authorize Mainnet. Its former operational `GO` path is
retired: every legacy invocation now returns `HOLD` or `HOLD_TEST`, includes
`LEGACY_COMBINED_GATE_DEPRECATED`, and exits `2`.

Authorization readiness now uses two non-circular contracts:

- `scripts/assess-iat-b3-pre-devnet-authorization.mjs` checks only evidence
  available before public Devnet execution. Structural hashes and self-attested
  booleans are not direct evidence. Until trusted artifact, scheduler,
  owner/device, and local-rehearsal observers exist, every candidate and every
  independent verdict is `HOLD`; neither
  `ELIGIBLE_FOR_INDEPENDENT_PRE_REVIEW` nor
  `ELIGIBLE_TO_REQUEST_USER_AUTHORIZATION` is reachable. Public Devnet
  authorization therefore may not be requested.
- `scripts/assess-iat-b3-post-devnet-evidence.mjs` consumes that exact verdict,
  a fresh digest-bound one-shot user grant, the pre-write execution latch, and
  actual finalized public Devnet receipts. Its current JSON fields are not a
  trusted RPC/signature/account-state/hardware observer. Every post candidate
  and independent post verdict is therefore `HOLD`; neither
  `ELIGIBLE_FOR_INDEPENDENT_POST_REVIEW` nor acceptance is reachable.

The independent paths open exact absolute non-symlink input, candidate,
assessor, and verifier files; verify path, bytes, SHA-256, byte length, and
same-descriptor stability; strictly parse the input and candidate; run the
exact pinned assessor over the physical input bytes; and require full deep
equality with both candidate objects. This rejects self-digested candidate
promotion, but deterministic re-execution alone does not make self-authored
evidence independently observed. The explicit direct-observer blockers remain
non-clearable by the current implementation.

## Exact blocker split

The frozen 39-blocker Gate-8 result is partitioned without pretending public
execution already happened:

1. The pre-Devnet taxonomy contains 35 evidence blockers: all 10
   canonical-readiness blockers, the first 17 production-plan blockers through
   `SOURCE_BOUND_LOOPBACK_RECEIPT_COMPLETION_NOT_IMPLEMENTED`, and eight packet
   blockers through `FULL_SUPPLY_TRANSIT_OWNER_ACCEPTANCE_ABSENT`. A
   self-consistent row for each code is only structural input and does not
   establish that any blocker was directly observed. Consequently the current
   output reports `clearedEvidenceCount: 0`, keeps all 35 blocker codes, and
   adds the direct-observer implementation blocker.
2. Exact candidate re-execution and byte binding do not clear
   `GATE_8_DIRECT_EVIDENCE_PACKET_UNSATISFIED`. The current implementation adds
   `PRE_DIRECT_EVIDENCE_OBSERVER_NOT_IMPLEMENTED`; the post implementation adds
   `POST_DIRECT_EVIDENCE_OBSERVER_NOT_IMPLEMENTED`. Both are fail-closed hard
   stops pending source-bound direct observers.
3. Pre-Devnet outputs preserve `DEVNET_NOT_EXECUTED` and
   `PUBLIC_DEVNET_EXECUTION_PROVENANCE_UNAVAILABLE` as
   `TRUE_EXPECTED_PENDING`. Only actual, reconciled post-Devnet receipts may
   transition them to `FALSE_DIRECTLY_OBSERVED`.
4. `MAINNET_HOLD` is `TRUE_INVARIANT`, is non-clearable by either contract,
   and remains accompanied by hard-false release and Mainnet authorization.

A self-authored claim that a public write started is
`UNVERIFIED_OR_UNRECONCILED`, never a directly observed fact transition. A
future trusted observer must preserve any actual partial-write evidence and
remain `HOLD` until reconciliation; it must never relabel an actual public
write as `DEVNET_NOT_EXECUTED`.

## Pre-Devnet entry contract

The pre-candidate schema describes an exact clean head/tree, committed/executed runner,
same-container offline Linux/AMD64 Docker provenance, distinct production Law
and Economy artifacts and receipts, production public identities, the exact
loopback all-15 rehearsal, every opcode-9 branch, five atomic failure plus
standalone-retry probes, both Daily-Law domain cases, owner-policy closure, and
the Model-T full-supply-transit acceptance. Supplying internally consistent
hashes and true booleans for those fields is not proof that the described
events occurred.

The continuous observation begins only after the other prerequisites are
fixed. It requires at least 86,400 elapsed seconds and 73 externally scheduled,
hash-chained samples, targeting 1,200-second cadence with no adjacent gap above
1,500 seconds. Head, tree, runner, toolchain, identities, artifacts, receipts,
validator Genesis, and validator process identity stay constant while slots
increase monotonically. Drift, restart, missing scheduler evidence, or a broken
chain resets the clock. Existing HOLD packets cannot start it retroactively.

Owner choices such as `PROVIDE_LATER` production identities and
`WAIT_FOR_MEASUREMENT` entropy disposition remain blockers. Accepting a source-
locked default or allowing policy drafting is not a signature, receipt, or
execution authorization.

The separate user grant is Devnet-only, one-shot, non-reusable, valid for at
most one hour, capped by transaction count and lamport spend, and bound to the
pre-verdict, clean source, exact execution intent, disposable identity set,
funding intent, failure policy, pinned RPC, and Devnet Genesis. The pre-write
latch revalidates those bindings and records exactly one authorization use.
Physical confirmation on a Trezor Model T is the sole human signing gate for
each required signature; non-signature claims remain automated evidence.

## Post-Devnet evidence contract

The post-candidate requires actual same-container disposable build provenance,
fresh and distinct Devnet identities, the pinned cluster and Genesis, and the
complete source-bound transaction set. Every receipt binds ordinal, operation,
message digest, signature, finalized slot, success or exact typed error,
pre/post state, fee, and Model-T confirmation. The set covers all 15 opcodes and
all opcode-9 conditional cases without omissions, duplicates, or extras.

Post evidence also binds all account snapshots, supply conservation, the 16
Daily-Law boundary vectors, five finalizer-timing vectors, entropy lag 150, five
atomic rollback and standalone retry cases, authority terminal state, ambiguous
send reconciliation, and cleanup ordering. Public Devnet behavioral evidence
can never satisfy the production final-byte proof.

The assessor deliberately separates two non-interchangeable lanes:

1. **Exact production-byte evidence.** Law and Economy artifacts must come from
   the strict Docker-only reproducible-build receipt validators, bind the exact
   clean committed head/tree, committed and executed runner bytes, production
   identity/environment inputs, pinned Linux/AMD64 container and toolchain,
   frozen recipe/source closure, and two preserved raw build logs. Those exact
   production bytes may be exercised only on an isolated loopback validator
   preloaded at the production public program IDs. Economy keeps the compiled
   Mainnet Law-domain Genesis hash; the disposable validator Genesis must not be
   claimed as Mainnet. The public network cannot satisfy this lane.
2. **Public Devnet behavioral evidence.** This lane requires disposable program
   and mint identities plus the real Devnet domain. Production-identity/Mainnet-
   domain artifacts are forbidden. The assessor opens and strictly parses the
   B09 disposable-Devnet preflight and receipt, invokes both B09 validators, and
   independently cross-matches the clean head/tree, committed/executed runner,
   production-feature source closures, fresh identities, observed Devnet
   Genesis, Docker-only toolchain, lane, raw logs, and ELF bytes. Only that full
   pair can clear `DISPOSABLE_DEVNET_EXACT_SOURCE_RECEIPT_UNAVAILABLE`.
   However, B09 files are self-contained structural evidence and do not prove
   that an external build or Devnet execution actually occurred. Therefore the
   lane remains not ready with
   `DISPOSABLE_DEVNET_EXECUTION_PROVENANCE_UNAVAILABLE`. B09 can never satisfy
   the production final-byte or isolated-local-execution lane.

## Source-bound operation truth

The 15-operation map comes only from
`scripts/lib/iat-b3-production-transaction-map.mjs`. The assessor runs the
source-derived R06 validator across its exact production source inventory and
requires the executed map-validator bytes to equal the committed bytes. It does
not use `rehearsal_adapter.rs`.

Every operation has one authenticated, read-only Daily-Law account prefix. The
exact total account counts by opcode are:

```text
0..4: 1, 1, 1, 1, 1
5:    6
6:    17 or 18
7:    17
8:    1
9:    12 for lanes 1/2/4; 1 for core lane 3 or invalid lanes
10:   12
11:   7
12..14: 1, 1, 1
```

Opcode 9 remains lane-conditional: Treasury, Ecosystem, and Liquidity are the
12-meta active variant; Core Team is the typed core-custody HOLD; other lanes
are invalid. The full disposition matrix remains 6 active, 5 initialization-
policy HOLD, 3 CCC-disabled, and 1 core-custody HOLD. Legacy or injected map
objects can produce only `HOLD_TEST`.

## Command and exit contract

From `projects/star-ascent/site`:

```text
npm run check:iat-b3-all-feature-devnet-readiness
node scripts/assess-iat-b3-all-feature-devnet-readiness.mjs --input <absolute-readiness-input.json>
node scripts/assess-iat-b3-pre-devnet-authorization.mjs --input <absolute-pre-input.json>
node scripts/assess-iat-b3-post-devnet-evidence.mjs --input <absolute-post-input.json>
```

No input returns machine-readable `HOLD` and exit code `2`. A structurally
complete input also returns `HOLD`/`2` while the direct observers are absent.
Invalid, missing,
stale, aliased, forged, unresolved, duplicate-key, or unknown-key evidence also
returns `HOLD`/`2`. Unexpected errors become `ASSESSMENT_ERROR`/`HOLD`/`2`;
there is no permissive fallback. Direct calls with injected observations are
test seams and cannot authorize a request or prove public execution.

The legacy strict input schema is
`iat-b3-all-feature-devnet-readiness-input/v4`, with these exact top-level
members:

```text
schema
declaredHeadSha
productionToolchain
productionByteEvidence
publicDevnetBehavioralEvidence
clusterPolicy
funding
authorization
automatedVerification
failurePolicy
```

Unknown, missing, or duplicate JSON members fail closed.

## Exact production artifact records

`productionByteEvidence.artifacts` contains `law` and `economy`. Each requires:

```text
kind
artifactPath / artifactSha256 / artifactByteLength
receiptPath / receiptFileSha256
firstBuildLogPath / firstBuildLogSha256
secondBuildLogPath / secondBuildLogSha256
```

Every path must be absolute, outside the repository, non-symlink, one-link,
regular, bounded, stable across the same-descriptor read, and distinct from all
other evidence files. Artifact files must begin with ELF magic. Receipt JSON is
duplicate-key rejecting and must pass the existing Law or Economy Docker
receipt validator. Native-WSL receipts are forbidden. The assessor also
cross-checks receipt artifact hash/length, raw-log hashes, runner hashes,
head/tree/materialized tree, identity/environment hashes, pinned container,
offline mode, and—for Economy—the production-only feature/source closure.

The local-validator portion supplies separately preserved preflight and
execution-receipt files. The current official execution-receipt contract does
not accept completed final-byte evidence, so the assessor truthfully remains
`PRODUCTION_LOCAL_FINAL_BYTE_EXECUTION_NOT_ACCEPTED`. It never promotes
`all15Observed`, a fake adapter, or a test receipt into completion.

## Public Devnet boundary

`clusterPolicy` pins the canonical `solana-devnet` RPC and Genesis constants,
three distinct fresh disposable identities, a cleanup-plan digest, and an
explicit prohibition on Mainnet identity reuse. The exact v4
`publicDevnetBehavioralEvidence` record contains only:

```text
policy
preflightPath / preflightFileSha256
receiptPath / receiptFileSha256
devnetDomain
disposableIdentities
productionArtifactReuseForbidden
finalByteEvidenceAccepted
```

Both outer files and every identity/Genesis observation, build log, isolated
build artifact, and preserved artifact referenced by B09 must be absolute,
external, stable, bounded, non-symlink, one-link files with exact hashes and
lengths. The two build roots and preserved root must be distinct and fresh.
Native builds, dirty source, uncommitted runner bytes, wrong Genesis, stale or
cross-lane records, self-digested forgeries, checked-in/production identities,
artifact disagreement, and any path or byte reuse with production evidence all
fail closed. Arbitrary descriptors are no longer part of the input schema.
Even a fully self-consistent preflight, receipt, observation set, Docker-shaped
logs, and ELF-magic byte set can be synthesized by one process. D03 reports
`structuralContractValidated: true` for a valid pair but keeps `ready: false`
and `executionProvenanceObserved: false`. No non-forgeable execution-provenance
predicate is currently defined, and the assessor does not invent or infer one.

Funding requires an explicitly approved disposable Devnet payer, a balance
observation no older than one hour, and balance at least equal to the approved
peak. The assessor trusts only the supplied bound record and spends nothing.

## Authorization and recovery

Authorization and automated verification bind the exact head, production-byte
evidence digest, public-Devnet behavioral-evidence digest, R06 operation-map
digest, 17-stage ceremony digest, funding digest, and failure-policy digest.
The sole human gate is physical confirmation on a Trezor Model T. All
non-signature claims require direct automated evidence; no independent human
review predicate is accepted.

The failure policy forbids automatic retry, automatic compensation, and
resubmission of an ambiguous send before reconciliation. Operators must stop,
preserve message bytes/signatures/logs, and reconcile. Public writes are not
rollbackable. Before authority revocation, recovery is only a preapproved
upgrade or abandonment; after revocation there is no code rollback, only
abandonment and redeployment. Disposable keys remain available until all
partial state is reconciled.

## Current result

The truthful result remains `HOLD`. `PROVIDE_LATER` production identities,
`WAIT_FOR_MEASUREMENT` entropy policy, unexecuted local rehearsal evidence, and
the unstarted 24-hour observation prevent an independent pre-verdict from
permitting an authorization request. Exact Law and Economy
receipts/artifacts/logs and accepted same-container provenance must be produced
and observed. A checked-in structural contract or self-authored bundle is not
execution evidence. In addition, the pre and post direct-evidence observers are
not implemented; exact byte binding and deterministic assessor re-execution do
not substitute for them. Public Devnet authorization is not currently
requestable, no current evidence can start the authoritative 24-hour clock,
and Mainnet remains `HOLD` in every assessment output.
