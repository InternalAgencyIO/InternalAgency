# Disposable-Devnet build execution provenance boundary

Status: **HOLD**. B24 implements a source-bound same-container hermetic
execution contract, but B19 still categorically disables the canonical path
with `HERMETIC_MOUNT_CAUSALITY_UNPROVEN`. The new contract is additionally
blocked by
`HERMETIC_SAME_CONTAINER_EXECUTION_CONTRACT_NOT_INDEPENDENTLY_ACCEPTED`.
The pinned local Docker daemon/socket is also an explicit trust boundary:
`PINNED_DOCKER_SOCKET_EXCLUSIVE_PRINCIPAL_NOT_PROVEN` remains HOLD, because a
concurrent socket principal could otherwise inject a root exec into a running
container.
Its final retained-file ledger and promotion contract is separately blocked by
`FINAL_RETAINED_FILE_LEDGER_NOT_INDEPENDENTLY_ACCEPTED`.
No Docker API, image creation, container, or build was invoked while B24 was
implemented or tested.
It does not run a Devnet rehearsal, prove production final bytes, authorize a
release, or authorize Mainnet.

## Authority boundary

The sole retained implementation is
`scripts/run-iat-b3-disposable-devnet-build-execution-provenance.mjs`. A result
cannot currently set `executionProvenanceObserved: true`: the canonical execute
function throws `HERMETIC_MOUNT_CAUSALITY_UNPROVEN` before output validation,
runtime host or Docker observation, caller-supplied input reads, directory
creation, external process execution, or live transcript construction. Module
import still performs the source-bound local helper-closure reads and dynamic
evaluation described below; those bootstrap reads neither inspect caller paths
nor invoke Docker or a build. There is no live-result registry or live-status
acceptance branch.

The hard-disabled code now defines the required replacement architecture. A
future reviewed enablement may set `executionProvenanceObserved: true` only
while its result is still the exact object created by one directly invoked,
exact committed copy of that runner. It copies the mounted source and local
toolchain bytes into a fresh container-private store, binds those private
closures before and after Cargo, binds the private artifact before and after
export, and requires host same-fd artifact equality. Host pathname checkpoints
alone still do not prove which inode the Docker daemon mounted; the private
copy and same-container frames are the causal boundary.
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

## Hard-disabled B24 hermetic design

The code below the categorical B19 hold remains unreachable and produces no
Docker observation or execution evidence. It now contains an implemented,
pure-testable command/receipt boundary for future independent review. It must
not be described as executed or accepted. Its transcript wire schema is
`iat-b3-disposable-devnet-live-build-execution-transcript/v3`; no earlier alias
is accepted.

Each Law or Economy attempt gets one fresh container with the digest-addressed
Linux/AMD64 Anchor image, an empty private Docker configuration, the absolute
byte-pinned Docker executable, a closed environment, the exact local
socket/daemon runtime, and exactly:

- `--pull=never`
- `--network=none`
- `--platform=linux/amd64`
- `--read-only`
- `--cap-drop=ALL`
- `--security-opt=no-new-privileges`
- `--pids-limit=512`
- a 256 MiB `noexec` `tmpfs` for `/tmp`
- a fresh 8 GiB `nosuid,nodev,exec` input `tmpfs` at `/iat-private`, owned by
  uid/gid 0
- a separate fresh 24 GiB `nosuid,nodev,exec` build `tmpfs` at `/iat-build`,
  owned by uid/gid 65534
- eight exact bind mounts: read-only source plus six read-only local-byte
  closures, and one fresh writable artifact-export directory
- immutable preexisting workdir `/usr/bin`, followed first by the exact
  root initializer and then by one exact `docker container exec
  --user=65534:65534 --workdir=/iat-private/home/a/iat-source` build command

The retained grammar rejects contradictory duplicate flags,
privileged/capability expansion, host namespaces, devices, arbitrary bind
mounts, alternate images, wrapper mutation, retry names, and extra commands.
The lifecycle requires pre-create absence, created-state inspect, detached
initializer start, running-state inspect, one exact unprivileged attached exec,
exact initializer-log validation, stop, exited-state inspect, forced removal,
and post-removal absence. The host does not read an exported ELF until after
stop and exited-state inspect. There is no retry within a contract. None of
these branches are currently reachable.
No image, toolchain, container absence, or cleanup has been observed by B24.

## Container-private source and toolchain closure

No build is reachable. The fixed initializer starts with `set -euo pipefail`
as uid/gid 0 under `--cap-drop=ALL`. It copies the complete source and six
local-byte roots into `/iat-private` with
`cp -a --no-preserve=ownership --reflink=never`, checks exact host/private
manifests, makes the closure root-owned with no group/other write permission,
validates safe in-root symlinks and single-link regular files, atomically
publishes a root-owned `0444` ready marker, emits one exact initializer frame,
then waits. Records bind entry type, base64 UTF-8 path, POSIX mode, byte length,
and file SHA-256 or symlink target. The closure is build-UID-unwritable; this is
not a claim of filesystem immutability against the trusted daemon or uid 0.

The exact local inputs currently frozen into the contract are:

- Rust/Cargo 1.97.1: 188 entries, 653,573,351 bytes, manifest SHA-256
  `5d4b1a80279f8169ff7f7fb2dea8535e9498ab4e5cd5914a9ca0390dfe4a14b9`;
- Solana 3.1.10 release: 104 entries, 419,506,102 bytes,
  `7c60c723f9b74f734ca4f6caf46565b54bf8f65527d3680f5784c14b79903a3f`;
- platform-tools 1.52: 3,828 entries, 1,663,263,438 bytes,
  `f879ef69841177c086891ed5c4291eddac14580698c4f37d8eae9c556e30bdaf`;
- Criterion closure: 38 entries, 2,201,370 bytes,
  `9c5cc9c7135f8984eef0ffa9725732e292bc446840a6ad6b815d388d208508d9`;
- Cargo registry cache: 2,092 entries, 234,988,779 bytes,
  `02b7a46d4d16cb4a573fccd96e628dce07ae6e31037fd67964acf44345110b75`;
- Cargo registry index: 2,376 entries, 179,474,589 bytes,
  `73f669e18accdd5134e94d6781016ecaab17c152b005e6620b7e7cd0503b5ec6`;
- Cargo.lock registry closure: 229 packages, binding SHA-256
  `8a447110f4aed5dae2c1c1b592cb441a8270eba97b51284cd76b8912a46a3e3f`.

After the ready marker, one exact Docker exec runs the build wrapper directly
as uid/gid 65534; there is no in-container setuid transition. The wrapper
revalidates root ownership, absence of group/other write, exact manifests, and
the ready marker before Cargo. Only Cargo home and the separate `/iat-build`
workspace (`target`, `output`, and executable private `TMPDIR`) are writable by
that uid; root-owned copied inputs remain traversable but build-UID-unwritable. Law
uses `production-combined-hook`; Economy uses
`runtime-production-entrypoint`; `sbf-preflight-entrypoint` is absent. Cargo is
offline with tools installation skipped. Cargo and all build-script stdout is
redirected to captured stderr, so exec stdout is reserved for exactly three
canonical JSON frames, in addition to the initializer's separate exact frame:

1. `PRIVATE_INPUT_CLOSURE_PRE_CARGO`;
2. `PRIVATE_INPUT_CLOSURE_POST_CARGO`;
3. `PRIVATE_ARTIFACT_EXPORTED`.

The first two bind the lane, ordinal, kind, contract, recipe, exact source, and
toolchain closure. The final frame additionally binds Cargo exit 0 and the
private ELF SHA-256/length after its copy to the host export mount. The wrapper
rehashes the private and exported ELF after copying. The Node validator accepts
no frame prefix, suffix, duplicate, reordering, alternate encoding, or
self-consistent field mutation, and rereads the exported SBF ELF bytes. Even a
structurally valid sequence returns
`HOLD_HERMETIC_CONTRACT_STRUCTURAL_VALIDATION_ONLY` with
`executionProvenanceObserved: false` while the categorical guard remains.

The fresh host export directory has an exact open mode of `0703`. Its host
owner retains read/write/traverse while the exact uid/gid 65534 build exec,
with all capabilities dropped and no supplementary groups, receives only
other-write and other-traverse: it cannot enumerate the
directory. The wrapper creates exactly the expected output name with Bash
`noclobber` and an exclusive file descriptor, copies the already hashed private
ELF through that descriptor, closes it, and sets the file to `0444`. The host
then stops the container and requires that single exact name, same directory inode and process-owner
uid/gid, exported single-link ELF uid/gid 65534 and mode `0444`, and matching private frame
hash/length before closing the directory back to `0700`. No broader write or
container privilege is introduced.

Two isolated Law and Economy attempts remain required. Before transcript
construction, all retained evidence lives under a dedicated `evidence/`
subtree. The v1 retained-file ledger enumerates every directory and
reopens every exact input, raw stdout/stderr log, and preserved ELF with
no-follow/single-link checks, binding path, mode, owner, device, inode,
nanosecond timestamps, length, and SHA-256. After transcript write and same-fd
readback, the first ledger is fully recomputed from the same evidence subtree,
and a second whole-stage ledger must contain the full unchanged file and
directory records under `evidence/` plus exactly that transcript inode. The structural
promotion record binds both ledgers and can only report HOLD, with execution,
build, release, and Mainnet authority false. Any extra/missing file, inode or
path swap, hardlink, reparse, byte/timestamp/descriptor-closure drift, or
self-authored readiness mutation
fails closed. A live brand could be applied only after this promotion contract,
dual-byte equality, recursive key scan, and container/build-root cleanup are
independently accepted. B26 does not claim any of those observations.

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
shape after the B24 hermetic contract is independently accepted and a later
source change deliberately removes the categorical guard:

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
