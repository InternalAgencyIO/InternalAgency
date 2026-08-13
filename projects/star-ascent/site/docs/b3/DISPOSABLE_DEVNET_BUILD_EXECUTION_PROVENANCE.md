# Disposable-Devnet build execution provenance boundary

Status: **HOLD**. B19 categorically disables the canonical execution path with
`HERMETIC_MOUNT_CAUSALITY_UNPROVEN`. The retained implementation is design
input for a future build-execution provenance boundary only.
It does not run a Devnet rehearsal, prove production final bytes, authorize a
release, or authorize Mainnet.

## Authority boundary

The sole retained implementation is
`scripts/run-iat-b3-disposable-devnet-build-execution-provenance.mjs`. A result
cannot currently set `executionProvenanceObserved: true`: the canonical execute
function throws `HERMETIC_MOUNT_CAUSALITY_UNPROVEN` before output validation,
host or Docker observation, input reads, directory creation, external process
execution, or live transcript construction. There is no live-result registry
or live-status acceptance branch.

A future replacement may set `executionProvenanceObserved: true` only while its
result is still the exact object created by one directly invoked, exact
committed copy of that runner. It must build from a container-private exact
source copy, bind the private source closure before and after Cargo, bind the
private artifact before exporting its bytes, and revalidate every retained
input, log, and artifact before applying any future live brand. Host pathname
checkpoints alone do not prove which inode the Docker daemon mounted.
The retained module-private `Symbol` is not exported or serialized and cannot
promote a result. Reparsed JSON, copied objects, external receipts, raw logs,
and ELF files always project to
`HOLD_SERIALIZED_TRANSCRIPT_NOT_LIVE_PROCESS_EVIDENCE`. An injected executor is
an explicit test seam and always projects to
`HOLD_TEST_INJECTED_EXECUTOR_NOT_EVIDENCE`.

The runner's CLI always exits 2/HOLD. Even a future successful offline build
records only build execution provenance. It remains blocked on behavioral
Devnet execution, production-final-byte evidence, release authorization, and
Mainnet authorization.

## Canonical live process

The categorical B19 hold fires before Docker is reachable. Any future live path
also requires all of the following:

1. Linux AMD64, exact Node v24.10.0 runtime bytes, exact `/usr/bin/git`
   2.43.0 bytes, `PATH=/usr/bin:/bin`, and a byte-pinned regular
   `/usr/bin/docker` executable. The transcript records the host executable
   descriptors, process argv, `/proc/self/exe`, `/proc/self/cmdline`, and the
   initial `/proc/self/environ`. The inherited host environment must contain
   exactly `PATH`, `LANG`, `LC_ALL`, `TZ`, the declared HEAD, and the explicit
   execution gate. `NODE_OPTIONS`, `NODE_PATH`, loader/audit variables, shell
   startup injection variables, and every undeclared variable are forbidden;
   no username-specific runtime path is trusted.
2. The explicit environment gate
   `IAT_B3_DISPOSABLE_DEVNET_OFFLINE_BUILD_EXECUTION_GATE=AUTHORIZED_EXACT_SOURCE_OFFLINE_DOCKER_DUAL_BUILD_ONLY`.
3. `IAT_B3_EXACT_SOURCE_HEAD_SHA` equal to the clean committed HEAD.
4. Executed runner bytes identical to the runner blob at that HEAD.
5. Before any imported helper is evaluated, the exact bytes and lengths of the
   combined-Law runner, Economy runner, identity validator, owner-policy
   validator, and native-backend policy module must match the source-bound B15
   closure. Every helper must then match its blob at the declared HEAD before
   and after execution.
6. The shared B10 exact-source observer: reciprocal linked-worktree control,
   index/tree equality, no untracked paths, no filters or lazy fetch, direct
   ordinary/LFS byte verification, reparse/hardlink/mode checks, and repeated
   source observation.
7. Exact-source materialization from Git objects into a process-owned root.
   The complete path/mode/Git-object/SHA-256/length/LFS-pointer entry list is
   retained as a canonical source-closure manifest, not merely summarized by a
   caller-supplied digest.
8. Fresh canonical identity and Genesis JSON inputs outside the repository.
   The three public identities must be distinct and absent from the committed
   source closure. The observed network, URL, and Genesis must be exact Devnet.

The runner does not generate identities and has no RPC, signing, deployment,
funding, or key-loading implementation.

## Unreachable legacy Docker design

The code below the categorical B19 hold is unreachable and produces no Docker
observation or execution evidence. It retains a closed command grammar only as
design input; it must not be run or described as an implemented hermetic
executor. A future replacement would require the digest-addressed Linux/AMD64
Anchor image, an empty private Docker configuration, the absolute byte-pinned
Docker executable, a closed environment, an exact local socket/daemon runtime,
and containers constrained by:

- `--pull=never`
- `--network=none`
- `--platform=linux/amd64`
- `--read-only`
- `--cap-drop=ALL`
- `--security-opt=no-new-privileges`
- an isolated `tmpfs` for `/tmp`
- a read-only exact-source mount
- one fresh writable build/output root

The retained grammar rejects contradictory duplicate flags,
privileged/capability expansion, host namespaces, devices, arbitrary bind
mounts, alternate images, and extra commands. None of its probe, create,
inspect, start, attach, cleanup, or log-preservation branches are reachable.
No image, toolchain, platform-tools closure, container absence, or cleanup has
been observed by B19.

## Unreachable legacy build design

No build is reachable. A replacement would require two isolated Law and
Economy builds from a container-private exact source copy, with
`production-combined-hook` for Law and `runtime-production-entrypoint` for
Economy; `sbf-preflight-entrypoint` would remain forbidden. It would bind the
private source before and after Cargo, hash the private artifacts before
export, re-read every retained byte, and apply a live brand only at the final
validated boundary.

The inherited build-variable names contain `PRODUCTION`, but this lane binds
them to the disposable public program/mint identities and the Devnet Genesis
domain supplied above. These bytes are therefore behavioral-lane bytes only;
they can never substitute for the separate production-ID/Mainnet-domain final
binary proof.

The exported, non-executing recursive scanner rejects key-material filenames,
including snake/camel/Pascal and dot/hyphen/underscore forms of private key,
secret key, seed phrase, and recovery phrase. It also rejects private-key PEM
data, canonical 64-byte JSON key arrays at any nesting depth, normalized
secret-bearing JSON fields, oversized JSON, symlinks, and hardlinks. No build
root, retained log, ELF, input copy, cleanup receipt, or transcript is created
while the categorical hold is active.

## Input schemas

Identity input:

```json
{"canonicalMint":"<fresh-public-key>","economyProgramId":"<fresh-public-key>","generatedAtUtc":"<fresh-exact-UTC>","laneId":"b15-devnet-YYYYMMDDTHHMMSSZ-<16-hex>","lawProgramId":"<fresh-public-key>","schema":"iat-b3-disposable-devnet-public-identity-input/v1"}
```

Genesis input:

```json
{"generatedAtUtc":"<same-fresh-exact-UTC>","genesisHash":"EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG","laneId":"b15-devnet-YYYYMMDDTHHMMSSZ-<16-hex>","network":"solana-devnet","rpcUrl":"https://api.devnet.solana.com","schema":"iat-b3-disposable-devnet-genesis-observation-input/v1"}
```

Both files must contain the exact canonical JSON bytes plus one LF, reside on
distinct regular single-link paths outside the repository, and be no older than
15 minutes. The Genesis file is observational input; this runner never calls
the URL.

## Future gated command

There is currently no authorized execution command. Even with syntactically
valid arguments, the exact gate, and a declared HEAD, the runner exits 2/HOLD
with `HERMETIC_MOUNT_CAUSALITY_UNPROVEN` before reading the named files or
creating the named output. The following is retained only as a future interface
shape after a new hermetic executor is implemented and reviewed:

```sh
/usr/bin/env -i \
PATH=/usr/bin:/bin LANG=C.UTF-8 LC_ALL=C.UTF-8 TZ=UTC \
IAT_B3_EXACT_SOURCE_HEAD_SHA=<exact-clean-head> \
IAT_B3_DISPOSABLE_DEVNET_OFFLINE_BUILD_EXECUTION_GATE=AUTHORIZED_EXACT_SOURCE_OFFLINE_DOCKER_DUAL_BUILD_ONLY \
<absolute-byte-pinned-node-v24.10.0-executable> \
  projects/star-ascent/site/scripts/run-iat-b3-disposable-devnet-build-execution-provenance.mjs \
  --execute \
  --output-root /absolute/off-repo/iat-b3-disposable-devnet-provenance-<lane> \
  --identity-input /absolute/off-repo/disposable-identities.json \
  --genesis-input /absolute/off-repo/devnet-genesis.json
```

The machine output and process exit remain HOLD. A later readiness consumer
must receive the still-live branded object in the same runner process; it must
never promote a transcript read back from disk.

Current machine state:
`docs/b3/iat-b3-disposable-devnet-build-execution-provenance-state.v1.json`.
