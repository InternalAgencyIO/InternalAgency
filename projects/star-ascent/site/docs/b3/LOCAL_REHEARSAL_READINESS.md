# B3 local rehearsal readiness preflight

`scripts/assess-iat-b3-local-rehearsal-readiness.mjs` is the fail-closed,
machine-readable entry gate for a **separately invoked, disposable loopback
validator rehearsal**. The command only reads source, Git state, manifests,
preserved artifacts, tool versions, and free space. It never builds an
artifact, starts a validator, generates a key, makes an RPC request, signs, or
broadcasts. It does not authorize Devnet or Mainnet.

The preflight emits one of:

- `READY`, exit `0`: the exact inputs are ready to be handed to a separate
  loopback expected-disposition executor;
- `HOLD`, exit `2`: at least one named prerequisite is absent or invalid.

`READY` does **not** mean all 15 operations are active and does not predict
completion of the 17-stage ceremony. The rehearsal must assert the
source-derived expected result for each operation. Mainnet is `HOLD` in every
assessment.

## Command and current truth

From `projects/star-ascent/site`, select a reviewed absolute Node 24 executable
for the current host (the assessor still verifies the required version):

```powershell
$Node24 = '<absolute path to reviewed Node 24 executable>'
& $Node24 scripts/assess-iat-b3-local-rehearsal-readiness.mjs
& $Node24 scripts/assess-iat-b3-local-rehearsal-readiness.mjs --input '<absolute outside-repository path to r01-input.json>'
```

The no-input form intentionally returns `HOLD`. At the current uncommitted
Windows checkout it identifies, at minimum: missing strict input, non-clean or
uncommitted runner/source, wrong host, incomplete pinned local-validator
toolchain, unfrozen production identities, and absent exact dual-build
law/economy artifacts and receipts. It also emits an explicit disk blocker
whenever observed rehearsal-volume space falls below 24 GiB. These are real
blockers, not fields to waive.

Because no-input can never satisfy `READINESS_INPUT_VALID`, it records every
external tool as `NOT_PROBED_NO_INPUT_FAIL_CLOSED` instead of launching version
commands. It still performs the complete exact-source, disposition, identity,
ceremony, law-boundary, and disk observations. Supplying `--input` retains all
nine external tool probes before toolchain readiness can pass.

The required execution host is Linux/AMD64. Tool observations must prove Node
at least `22.13.0`, GNU Bash, Rust/Cargo `1.97.1`,
`solana-cargo-build-sbf 3.1.10`, platform-tools `v1.52` with SBF Rust
`1.89.0`, Solana CLI/keygen/test-validator `3.1.10`, `spl-token-cli 5.5.0`,
and `sha256sum`. The local rehearsal volume must have at least 24 GiB free:
16 GiB estimated for disposable ledgers, artifacts, and logs plus an 8 GiB
post-rehearsal reserve. Build caches are not included.

The policy field `testNode: 24.14.0` records the Windows test runtime; it is not
an exact-patch execution requirement. The installed WSL Node `v24.10.0`
satisfies the source-enforced `>=22.13.0` rule. Under WSL, the assessor resolves
the Windows-linked worktree `.git` control file to its actual Git directory and
then performs the same exact HEAD, clean tracked-and-untracked state, and
committed-runner checks. It does not relax or replace any of them.

## Source-derived operation contract

The gate parses the production instruction enum, route table, authenticated
entrypoint, and claim-lane executor. It fails on an opcode, route, count,
Daily Law ordering, or lane-policy drift. The current exact matrix is:

| Opcode | Operation | Expected disposition |
| ---: | --- | --- |
| 0 | `initialize_config` | `INITIALIZATION_POLICY_HOLD` |
| 1 | `initialize_lane_vault` | `INITIALIZATION_POLICY_HOLD` |
| 2 | `initialize_stake_vault` | `INITIALIZATION_POLICY_HOLD` |
| 3 | `activate` | `INITIALIZATION_POLICY_HOLD` |
| 4 | `register_agency` | `INITIALIZATION_POLICY_HOLD` |
| 5 | `set_eligibility` | `ACTIVE` |
| 6 | `open_position` | `ACTIVE` |
| 7 | `settle_position_week` | `ACTIVE` |
| 8 | `settle_core_week` | `CORE_CUSTODY_HOLD`, no mutation |
| 9 | `claim_lane_principal` | conditional, described below |
| 10 | `withdraw_position_principal` | `ACTIVE` |
| 11 | `close_position` | `ACTIVE` |
| 12 | `commit_round` | `CCC_DISABLED`, no mutation |
| 13 | `settle_round` | `CCC_DISABLED`, no mutation |
| 14 | `expire_round` | `CCC_DISABLED`, no mutation |

The summary count is 6 active routes, 5 initialization-policy holds, 3
CCC-disabled routes, and 1 opcode-level core-custody hold. Opcode 9 is not a
blanket active claim: `TREASURY`, `ECOSYSTEM`, and `LIQUIDITY` are active;
`CORE_TEAM` returns the typed `CORE_CUSTODY_HOLD` before operation-account
reads and must not mutate; any other lane is an invalid-lane hold. Every route
is behind authenticated Daily Law verification.

## Strict external input and artifact binding

The optional packet schema is
`iat-b3-local-rehearsal-readiness-input/v1`, with exactly:

```text
schema
declaredHeadSha
identityBinding
artifacts
```

The packet must be an absolute regular, non-symlink file outside the
repository. `declaredHeadSha` must equal the exact clean committed checkout.
The executed runner bytes must equal the runner blob at that HEAD.

`identityBinding` requires the exact production-candidate law program,
economy program, Token-2022 mint, and network Genesis hash, plus a canonical
binding digest. It contains only public identities. The values must equal a
production identity manifest whose combined artifact binding is actually
ready; placeholders do not pass.

`artifacts` contains exact `law` and `economy` descriptors. Each names an
absolute, regular, non-symlink artifact and receipt outside the repository.
The preflight rereads both and recomputes artifact hash/size and receipt-file
hash. `receiptSha256` in the input descriptor is the SHA-256 of the exact
receipt **file bytes**, not the receipt record's internal canonical digest.

For `LAW`, the receipt must parse and pass the existing
`iat-b3-combined-law-exact-source-dual-sbf-build/v1` validator. The local gate
then projects and cross-checks its internal receipt digest, declared HEAD,
identity-manifest and build-environment bindings, output filename, both build
and log hashes, and preserved artifact hash/size. A file containing arbitrary
JSON with a matching outer hash does not pass.

For `ECONOMY`, the receipt must parse and pass
`iat-b3-economy-exact-source-dual-sbf-build/v1`. Its source closure and recipe
must prove the sole feature is `runtime-production-entrypoint`; the structural
`sbf-preflight-entrypoint` feature is forbidden. The gate cross-checks the
receipt's exact HEAD, four-input identity environment, both distinct build-log
hashes, and preserved `iat_b3_economy.so` bytes. The older economy structural-
preflight scripts are not reproducibility receipts and cannot satisfy this
gate.

Law and economy artifact and receipt paths must be distinct. The preflight
does not perform either build and does not accept an artifact or receipt path
inside the checkout.

The Docker receipts remain exact-source, offline, dual-fresh-build contracts.
Native WSL is observation-only until an immutable hermetic rootfs and complete
closure are directly proven: it cannot build, create or validate a receipt, and
R01 rejects the retained native receipt schema. Its future execution contract
requires recursive whole-build-root key-material rejection plus preserved raw
stdout and stderr for both runs, each bound by SHA-256 and byte length. No build
receipt contains a human-review predicate, signs anything, or substitutes for
the separate Trezor Model T cryptographic confirmation gate.

## Off-repository HOLD packet path plan

Reserve one new directory named for the future clean commit. Do not create
placeholder binaries, receipts, hashes, or keys:

```text
C:\iat-b3-release-evidence\<CLEAN_HEAD_SHA>\r01-input.json
C:\iat-b3-release-evidence\<CLEAN_HEAD_SHA>\law\iat_b3_law.so
C:\iat-b3-release-evidence\<CLEAN_HEAD_SHA>\law\iat_b3_law.receipt.json
C:\iat-b3-release-evidence\<CLEAN_HEAD_SHA>\economy\iat_b3_economy.so
C:\iat-b3-release-evidence\<CLEAN_HEAD_SHA>\economy\iat_b3_economy.receipt.json
```

After identities are genuinely frozen, the combined-law and production-
economy runners may populate their respective paths using atomic no-overwrite
output. Only after both validated receipts exist should an operator populate
`r01-input.json` with exact public identities, Genesis hash, artifact bytes,
hashes, sizes, build-log hashes, and receipt-file hashes. Until then, invoke
the no-input command and retain its machine-readable `HOLD`; an example with
invented placeholder values would be misleading and is intentionally not
provided.

## Exact 17-stage rehearsal order

The gate imports this order from the production identity/authority evidence
validator and binds it by digest:

1. Deploy law with the hardware upgrade authority.
2. Deploy economy with the hardware upgrade authority.
3. Verify exact program bytes and identities.
4. Revoke law upgrade authority.
5. Revoke economy upgrade authority.
6. Verify both programs immutable.
7. Create the exact Token-2022 mint.
8. Enter Genesis staging.
9. Create and fund canonical accounts.
10. Verify Genesis conservation and bindings.
11. Revoke mint authority.
12. Revoke freeze authority.
13. Initialize law and seal extension authorities.
14. Verify mint and program authorities sealed.
15. Finalize the current day.
16. Activate only if the current day is open.
17. Verify active and staging disabled.

Under the current five initialization-policy holds, full ceremony completion
is not expected. A local run should still exercise and record every reachable
stage and prove the exact typed hold and no-mutation boundary where progress
stops. It must not reinterpret an expected hold as an active operation.

## Daily Law vectors

The preflight source-binds UTC+3 protocol days, the `00:01:00` decision
boundary, half-open day arithmetic including negative Unix time, normal
`100/10000` and Friday `6667/10000` thresholds, and entropy lag 150. The
separate executor must cover 16 vectors: `00:00:59` versus `00:01:00`, negative
time, missing/stale/open/locked/forged decisions, both sides of normal and
Friday bucket thresholds, insufficient slot history, skipped target slot,
same-day reroll, and consecutive selected days.

The five bound grinding vectors cover consecutive invocation timing,
skipped-slot candidate collapse, congested invocation opportunities, modeled
fork alternatives, and the fact that permissionless competition does not
remove timing influence. Existing results are synthetic only: empirical
Devnet/Mainnet measurement is incomplete, entropy-risk acceptance is absent,
and the final lag is not frozen.

## Abort and rollback contract

The separate rehearsal must use loopback only, one safety-checked disposable
root, no automatic retry or compensation, and a validator process that stops
on success, failure, or signal. Expected failures require exact pre/post
account-byte, balance, and delegate equality. Active adversarial failures must
be atomic across every touched account.

Abort immediately when any of these occurs:

- prerequisite, validator startup/health, identity, byte, stage invariant, or
  cleanup-boundary mismatch;
- a Daily Law error differs from the expected typed error or changes state;
- a policy-held, CCC-disabled, core-custody, or invalid-lane call changes state;
- an active adversarial call partially changes state;
- a send is ambiguous or times out;
- a pre-revocation binary readback differs from the retained artifact;
- any later step fails after an authority revocation.

On an ambiguous send, stop and preserve the message, signature, logs, and
pre/post snapshots; reconcile before any retry. Before revocation, keep the
authority intact and do not automatically upgrade. After revocation there is
no code rollback: stop the validator, preserve diagnostics, discard only the
verified disposable ledger root, and restart from stage 1. Never broaden
cleanup beyond the root created by the rehearsal.
