# B3 two-lane readiness assessment

`scripts/assess-iat-b3-all-feature-devnet-readiness.mjs` is a fail-closed,
machine-readable evidence assessor. It never signs, broadcasts, deploys,
funds, activates, or queries RPC. It does not build artifacts and does not
authorize Mainnet.

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
```

No input returns machine-readable `HOLD` and exit code `2`. Invalid, missing,
stale, aliased, forged, or unresolved evidence also returns `HOLD`/`2`.
Unexpected errors are converted to `ASSESSMENT_ERROR`/`HOLD`/`2`; there is no
permissive fallback. Direct calls with an injected context are test seams and
always return `HOLD_TEST`; injected observations cannot authorize readiness.

The current strict input schema is
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

The truthful result is `HOLD`. At minimum, production identities/Mainnet Law
domain and committed Docker runners must be frozen; exact Law and Economy
receipts/artifacts/logs must exist; an accepted isolated final-byte execution
receipt contract and run must exist; and a fresh B09 disposable-Devnet
preflight/receipt pair plus non-forgeable execution provenance must be produced
and observed. The checked-in B09 contract/state—or even a structurally valid
self-authored bundle—is not execution evidence. No canonical pair or accepted
execution-provenance predicate is present in this repository. Mainnet remains
`HOLD` in every assessment output.
