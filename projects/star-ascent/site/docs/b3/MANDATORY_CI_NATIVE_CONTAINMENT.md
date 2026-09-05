# Mandatory CI native containment

Status: **HOLD — accepted source contracts only.** BP00 through BP09 and the
X16 cross-review establish fail-closed source, schema, validator, static-test,
workflow-smoke, and review contracts. They do not establish a compiler or
toolchain observation, a built helper, same-object helper execution, native
containment, runtime evidence, Devnet readiness, release authority, or Mainnet
authority. The canonical runner remains machine-readable `HOLD` with exit
code `2`; every canonical live-evidence, execution, readiness,
operative-authorization, Devnet, Mainnet, and release field remains false.

Loading the committed JavaScript closure and statically inspecting the C
sources are source observations only. Source tokens, a passing Node test, a
hosted workflow result, a self-consistent receipt, or a recorded permission
cannot promote an unobserved capability.

## Accepted source-contract ladder

| scope | accepted structural contract | truth that remains unobserved or false |
| --- | --- | --- |
| BP00 | Exact nonoperative authority-state packet and strict validator. Source/schema/test/doc work and narrowly recorded local permissions are separated from operability. | System mutation, install/download, compiler, helper, runtime containment, Docker operability, RPC, funding, public Devnet, release, and Mainnet authority. |
| BP01 | Exact fourteen-group prerequisite packet, BP00 binding, K44 manifest, strict byte/parser rules, and a 28-blocker closure. | Semantic digest, source checkpoint, toolchain identities, platform capabilities, helper artifact, invocation, daemon/storage, compile receipt, runtime receipt, and every direct observer. |
| BP02 | Native header, common core, main, SHA-256, and TAP source grammar with exact timing, ranges, identifiers, READY/FINAL frames, and a categorical hard HOLD. | Compilation, native execution, accepting TAP, PASS, capability, and evidence. |
| BP03 | Two inert hostile-fixture modules and a closed ten-case structural plan read only as bytes by their test. | Fixture execution, platform signal behavior, containment behavior, and runtime evidence. |
| BP04 | Linux source state machine for descriptor-bound execution, namespace/PID1 containment, pidfd lifetime, fair streams, immutable deadlines, complete reaping, exact status EOF, and write-once outcomes. | Linux compilation, host support, helper execution, namespace creation, teardown, and absence observation. |
| BP05 | Windows source state machine for held executable identity, atomic Job/handle inheritance, suspended creation, immutable deadlines, bounded overlapped I/O, and `ACTIVE_PROCESS_ZERO`. Unsupported pathname launch fails before process creation. | Windows compilation, a supported same-object launch route, Job execution, stream observation, teardown, and absence observation. |
| BP06 | Exact seven-source Zig `cc` build recipe, recursive toolchain/sysroot closures, four canonical disjoint A/B lanes, byte-equality, PE/ELF policy, continuous 2 GiB resource observation, causation, and identity-bound cleanup contracts. | Build authority, measured compiler/sysroots, compiler execution, artifacts, logs, an observer-owned admitted receipt, and runtime evidence. |
| BP07 | Strict compile/runtime separation and an exact runtime-receipt schema for checkpoint, same-object artifact identity, platform capabilities, invocation descriptors, clocks, TAP, containment, and cleanup. | Receipt-source observation, compile provenance, runtime execution, same-object execution, platform capability, containment emptiness, and cleanup evidence. |
| B27, reused as BP08 | Canonical orchestrator binds the frozen BP02–BP07 interfaces and K44 policy, rejects caller/injected/self-authored promotion, and exposes no execution API. There is no duplicate BP08 writer or second orchestrator. | Live build and runtime receipts, K44 direct observations, workload start, containment, TAP, deadlines, cleanup, and authorization. |
| X16 | Independent review accepted the exact B27/BP07 integration freeze after hostile substitution, stale-input, teardown, and promotion attacks. | X16 is review evidence about source bytes only; it is not compile, runtime, containment, or release evidence. |
| BP09 | Exact hosted smoke-only workflow wiring and hostile workflow regression. | Hosted-to-local provenance, helper/runtime evidence, an admitted receipt, release authority, Devnet execution, and Mainnet authority. |

## Fixed protocol and timing model

| phase | default gates | all-feature gate |
| --- | ---: | ---: |
| startup, including containment creation and READY | 10,000 ms | 10,000 ms |
| child execution | 120,000 ms | 180,000 ms |
| final stream/TAP observation | 5,000 ms | 5,000 ms |
| observation-only teardown | 15,000 ms | 15,000 ms |
| parent guard | 5,000 ms | 5,000 ms |
| immutable outer ceiling | 155,000 ms | 215,000 ms |

These values are frozen source and receipt predicates; the canonical path arms
no timer and starts no child. A future admitted implementation must arm the
outer and startup watchdogs before creation and the execution watchdog before
START/resume. Expired timers arbitrate before terminal, status, stream, and
PASS observations. The first failure is immutable. The execution cutoff has
no TERM grace, retry, extension, caller override, or second timeout program.
Teardown is observation-only and cannot extend target execution.

Each output stream is capped at 64 MiB. Observation is fair and cap-aware: at
most one bounded chunk per ready stream is drained before timer arbitration.
Diagnostics bind raw length and SHA-256 plus bounded 2 KiB prefix and tail.
Strict TAP requires the exact ordered cases, terminal plan, eight terminal
summary/duration lines, EOF, no bailout or trailing bytes, and zero
fail/skip/todo/cancel. PASS additionally requires natural zero root terminal,
validated READY/FINAL, closed streams, direct-root reap, empty containment,
zero leaks/zombies, positive absence proof, and no intervention. A forced
teardown or expired immutable deadline cannot be overwritten by later output.

## Platform source semantics

### Linux/WSL

The accepted Linux source holds a regular executable object and models
same-object `execveat`, then uses `clone3` to create user, mount, and PID
namespaces with a creation-returned pidfd. Namespace PID 1 closes the
parent-death race with `PDEATHSIG`, mounts private `/proc`, owns only its
required descriptor endpoints, creates the workload only after the exact
READY/START barrier, and completely reaps clone-class descendants. Numeric PID
or process-group cleanup is forbidden. Any `/proc` mapping is bracketed by the
retained pidfd and one directory descriptor.

Timer processing has priority over pidfd, status, and stream observations.
Status reads are nonblocking, bounded, exact-length, trailing-rejecting, and
committed only after EOF. Control writes are locally SIGPIPE-safe with mask and
pending-state restoration. Only a retained `CLD_EXITED`/status-zero namespace
PID1 result can participate in PASS; every other terminal state freezes
`INTERNAL_HOLD`. Namespace destruction, both stream EOFs, and complete reap are
required for absence. None of those events has been observed on a host.

### Windows

The accepted Windows source opens the executable with write/delete sharing
denied and retains the handle through arbitration. Its future creation path
models one `STARTUPINFOEX` transaction with exact `JOB_LIST` and `HANDLE_LIST`,
`CREATE_SUSPENDED`, Job membership proof before resume, kill-on-close, no
breakaway, and completion-port `ACTIVE_PROCESS_ZERO`. Assign-after-start,
`taskkill`, WMI/CIM, pathname-hash identity, and numeric-PID cleanup are not
fallbacks.

Stdout and stderr use overlapped, one-chunk-per-turn reads. Startup and outer
watchdogs precede creation; execution precedes resume; immutable timers are
re-arbitrated before terminal acceptance and the sole PASS decision. Failure
is write-once. Cancellation requires bounded terminal completion, otherwise
ownership is retained fail-safely; attribute-list deletion is initialization
gated. PASS requires natural zero root terminal, both EOFs,
`ACTIVE_PROCESS_ZERO`, and no intervention. The current source deliberately
fails unsupported pathname launch before `CreateProcessW`; it therefore
describes the required same-object boundary but does not provide or claim a
usable Windows launch capability.

## Build and runtime evidence separation

BP06's policy remains `HOLD_UNMEASURED`. The only modeled compiler is an
absolute, held, policy-pinned Zig executable invoked with exact `cc` argv.
Each target needs an externally authenticated compiler/linker/header/sysroot/
compiler-runtime/runtime-library closure. The canonical four-lane plan is:

1. `linux-x64-musl/A`;
2. `linux-x64-musl/B`;
3. `windows-x64-gnu/A`;
4. `windows-x64-gnu/B`.

Lane roots, work, home, temporary, cache, output, and log paths are disjoint
and regenerated from the plan. Environment, cwd, null Git configuration,
executable descriptor, argv, process/container identity, terminal zero,
artifact/log creation, direct bytes, continuous outside-write observation,
2 GiB high-water bound, and cleanup identity are receipt predicates. The
current PE/ELF parsers are strict policy validators, but parsing candidate
bytes cannot prove who built them.

BP07 accepts no candidate as authority. Even a canonical structurally coherent
receipt is classified as nonauthoritative and returns an all-false `HOLD`.
Compile provenance and runtime containment are separate observations. The
runtime contract requires the admitted compile object to be the exact held
execution object and requires external observer-owned bytes for platform,
deadline, TAP, containment-empty, and cleanup facts. A semantic digest detects
mutation; it cannot attest its own truth.

The B27 canonical runner therefore reports, without exception:

- `status: "HOLD"`, `exitCode: 2`, and `ready`, `complete`, `valid`, and
  `authorized` false;
- source checkpoint, build receipt, public build input, runtime receipt source,
  execution provenance, runtime evidence, containment, TAP, deadline, cleanup,
  artifact build, helper execution, and process start all unobserved/false;
- caller and injected input acceptance, self-authored receipt acceptance,
  automatic retry, network, RPC, key read, signing, transaction send, Devnet,
  Mainnet, and release all false.

## Local observation versus hosted smoke

These evidence classes are disjoint:

| lane | current fact | prohibited inference |
| --- | --- | --- |
| Local direct observation | No accepted compiler/toolchain closure, dual build, helper, or runtime receipt exists. The exact-digest container/Git observation remains blocked because the authorized Docker Hub pull timed out before the image or either observer run existed. | A recorded local provisioning permission or a responsive WSL/Docker daemon is not toolchain, build, runtime, or containment evidence. |
| K89 Windows hosted smoke | The exact Windows job reads source, runs the 30-case structural suite, then reaches the expected preflight `HOLD`. It is labeled `HOSTED_CROSS_PLATFORM_SMOKE_ONLY (non-evidence)`. | Hosted checkout, setup-node, Node tests, or an expected failure cannot populate local checkpoint, compiler, artifact, same-object, platform, or runtime fields. |
| BP09 Phase-B hosted smoke | The isolated Ubuntu job is ordered after K89, consumes no predecessor output or receipt, uses pinned checkout/setup-node with no credential persistence or cache, and invokes only `check:iat-b3-mandatory-ci-phase-b-structure` followed by `check:iat-b3-mandatory-ci-phase-b-hosted-smoke`, with Bash and fixed 5-minute step/15-minute job limits. | It cannot download or import build/runtime artifacts, execute the helper, promote hosted state into a local receipt, or make a release claim. Its result is all-false HOLD/non-evidence. |

The two hosted jobs are workflow source contracts, not evidence that GitHub has
run them for the current bytes. No hosted observation can substitute for the
future direct local observer, and no local observation can inherit authority
from hosted ordering.

## Accepted source-only test matrix

The current focused inventory has 180 named Node static tests across the ten
mandatory-containment suites. The counts are source-contract evidence only:

| suite | cases |
| --- | ---: |
| Phase-A containment contract | 30 |
| native core static | 14 |
| inert hostile fixtures | 10 |
| Linux source state machine | 17 |
| Windows source state machine | 22 |
| native-build contract | 15 |
| runtime-receipt contract | 17 |
| canonical mandatory gates | 14 |
| BP00 authority state | 13 |
| BP01 prerequisite packet | 28 |

The final BP06 review passed its 29-case build/core pair. X16 independently
passed the five affected B27/BP07 suites, 90/90 with no
fail/skip/todo/cancel. BP09/BP09R passed the four hosted source suites, 85/85,
and 123 fail-closed workflow mutation probes. Those results establish source
consistency and rejection behavior only; none compiled C or executed a helper,
fixture, namespace, Job Object, or workload.

## Current blockers and ordered next steps

Current hard blockers include:

- BP00/BP01 live compiler, helper, runtime, platform, daemon/storage,
  checkpoint, and K44 observer fields remain unresolved, absent, or false;
- the exact immutable Linux container and direct Git implementation identity
  remain unobserved after the exact image pull timed out; substitution or a
  mutable image is not allowed;
- the Zig executable, recursive Linux-musl and Windows-GNU closures, sysroots,
  and import allowlists remain unmeasured in the checked-in
  `HOLD_UNMEASURED` policy;
- no externally authenticated build preimages, admitted four-lane observer
  session, byte-identical A/B artifacts/logs, or identity-bound cleanup receipt
  exists;
- no compiled helper has been admitted and no same-object native execution,
  platform capability, hostile-fixture containment, deadline, TAP, teardown,
  or absence observation exists;
- the canonical orchestrator exposes no build or execution API and keeps
  `SOURCE_BOUND_LIVE_BUILD_RECEIPT_UNAVAILABLE`,
  `SOURCE_BOUND_LIVE_RUNTIME_RECEIPT_UNAVAILABLE`,
  `K44_DIRECT_OBSERVERS_UNAVAILABLE`,
  `CANONICAL_MANDATORY_CONTAINMENT_HOLD`, and `B27_NO_EXECUTION_API`.

The smallest truthful progression is:

1. Resolve the exact-digest local image/Git observation without changing the
   pinned image, adding a network fallback, or importing credentials.
2. Directly measure and freeze the exact Zig/toolchain/sysroot closures and
   source checkpoint, then obtain a fresh exact authority state for the
   bounded compiler/helper actions; documentation cannot grant it.
3. Execute the four canonical builds only inside the admitted direct-observer
   envelope and independently validate the artifact/log bytes, PE/ELF policy,
   2 GiB/no-outside-write record, causation, and cleanup receipt.
4. Independently admit compile provenance before attempting any helper or
   fixture. Close the Windows same-object launch blocker rather than falling
   back to pathname, PID, taskkill, or assign-after-start behavior.
5. Under separately exact runtime authority, execute each admitted artifact as
   the held object, run the hostile matrix inside its creation-bound
   containment, and collect external BP07 receipts for both platforms.
6. Independently review those live receipts and only then change the B27
   canonical state. Devnet authorization remains a separate pre/post evidence
   gate; Mainnet and release remain HOLD.

Nothing in this document authorizes a download, install, compiler, build,
helper, fixture, Docker/container, network, RPC, key, signature, funding,
public Devnet, deployment, release, or Mainnet action.
