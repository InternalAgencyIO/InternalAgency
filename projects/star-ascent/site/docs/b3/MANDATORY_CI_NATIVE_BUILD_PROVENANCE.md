# Mandatory CI native-build provenance contract

Status: **HOLD — structural source only**

BP06 defines the inputs and direct observations that a future native build
would require. It does not observe a compiler, authorize compilation, run a
compiler or helper, create an output directory, or establish runtime
containment evidence. Importing the contract and running the build CLI with no
arguments are assessment-only operations. The CLI exits `2`; every argument,
including a nominal execute argument, is rejected.

## Immutable input closures

The native source closure is exactly these seven case-sensitive paths, in
lexicographic order:

1. `native/iat-b3-mandatory-ci-containment/include/iat_b3_containment.h`
2. `native/iat-b3-mandatory-ci-containment/src/common.c`
3. `native/iat-b3-mandatory-ci-containment/src/main.c`
4. `native/iat-b3-mandatory-ci-containment/src/platform_linux.c`
5. `native/iat-b3-mandatory-ci-containment/src/platform_windows.c`
6. `native/iat-b3-mandatory-ci-containment/src/sha256.c`
7. `native/iat-b3-mandatory-ci-containment/src/tap.c`

All paths are repository-relative beneath `projects/star-ascent/site`. The
observer opens each regular, single-link, non-symlink object and binds its
device/inode, length, timestamps and SHA-256 before and after the read. Path,
realpath, case-fold, duplicate, short-read and replacement ambiguity are HOLD.
All six `.c` files, including `tap.c`, occur exactly once in the link argv.
The executable is the held Zig object and argv element one is exactly `cc`;
removing `cc`, using an ambient C compiler, or shifting the fixed arguments is
HOLD.

The build-contract closure separately binds the toolchain policy, this
contract module and the assessment-only build runner. A digest written by any
of these sources describes bytes; it is never observer authority.

Admission requires canonical JSON preimages and separately supplied trust
anchors for the policy, seven-source inventory, three-file contract inventory,
both complete toolchain closures, and both sysroot-role subclosures. Source
and contract inventory entries bind exact paths, roles, byte lengths, hashes,
realpaths and unique file identities. The policy preimage and the policy entry
inside the contract inventory must be the same observed file object. Toolchain
entries reject repeated file identities and repeated file/role pairs; the
root object must own the compiler role. Raw evidence bytes and trust anchors
are distinct inputs, so a self-authored digest cannot admit its own preimage.

## Recursive toolchain closure

Each target requires one observer-session-bound directed closure rooted at an
absolute compiler executable. Every entry contains the same pre/post object
descriptor and sorted roles. The required role union is compiler, linker,
header, sysroot, compiler runtime and runtime library. Every non-root object
must be reachable from the compiler through a closed `invokes`, `includes`,
`links`, `loads` or `sysroot` edge. Missing objects, path aliases, case aliases,
unreachable objects, changed pre/post identity or a mixed observer session are
HOLD.
Each target-map entry must also carry that exact target label; a Linux closure
in the Windows slot, or the reverse, is HOLD at plan, receipt, toolchain
preimage and sysroot-preimage validation.

The policy file remains `HOLD_UNMEASURED`. Null executable, sysroot, closure or
import-allowlist identities cannot be filled from source defaults, PATH,
ambient caches, version text, a caller packet or a self-authored receipt.

## Exact build plan

The only structural plan contains four builds in this order:

1. `linux-x64-musl/A`
2. `linux-x64-musl/B`
3. `windows-x64-gnu/A`
4. `windows-x64-gnu/B`

Each lane has a disjoint absolute root and private work, home, temporary,
cache, output and log paths. No lane root may overlap the repository or another
lane. The recipe binds the absolute compiler executable, complete argv,
sanitized environment, isolated cwd, source closure, build-contract digest and
output path. PATH is empty; loader, network, Git, user-profile and Zig caches
are not inherited. A/B use the same semantic recipe and distinct physical
roots.

The lane layout is regenerated rather than trusted from a receipt: each root
is exactly `<isolated-parent>/<target>-<lane>`, with exact `work`, `home`,
`tmp`, `cache`, `out` and `log` roles and exact artifact/log names. The role
roots are pairwise disjoint. Git global configuration is bound to the current
host's null device (`NUL` on Windows, `/dev/null` elsewhere); no relative
configuration placeholder is accepted.

The canonical plan independently fixes the repository and isolated-parent
roots, observer session, policy/source/contract digests and all four lane
records. Each record binds the held Zig executable, exact `cc` argv, complete
environment, cwd, home, temporary and cache roots, output and log paths,
normalized recipe digest, unique physical-invocation digest, and requirements
that the lane root, cache and output be absent before the build. Any plan byte
not covered by its external trust anchor is HOLD.

## Observer-owned receipt

A future direct observer must bind one session across the authority object,
both recursive toolchain closures, all four build intervals, artifacts, logs,
resource samples and cleanup. It must directly reopen every artifact and log
as the receipt-described same regular object. For each target, A and B artifact
lengths and bytes must be exactly equal. Unique target/lane IDs, roots, caches,
artifact paths, log paths, recipe digests and closure digests prevent stale or
cross-lane mixing.

The canonical observer preimage independently binds the plan anchor and, for
each lane, the root-absence time, root creation identity, build start/end,
artifact/log creation times, exact post-build descriptors and a causation
digest. Root, artifact and log file identities are unique across lanes. Direct
artifact and log byte preimages must match those descriptors, and each
target’s A/B artifacts are compared byte-for-byte rather than by receipt hash.
Every per-build observer record also binds the exact plan invocation digest,
same-object executable descriptor, observed argv/environment/cwd, unique
process and container identities, zero nonsignaled terminal observation, and
artifact/log creation events attributed to that process identity. A digest of
unattributed timestamps or output descriptors is not causation evidence.

The Windows binary policy requires AMD64 PE32+, a zero COFF timestamp and
checksum, no COFF symbols, console subsystem, high-entropy ASLR, dynamic base,
NX compatibility, relocations, a unique non-WX section table, an executable
nonwritable entry section, no overlay, at most 16 declared data directories,
no forbidden data directories, no raw or virtual section overlap, and an exact
measured DLL allowlist. The Linux policy requires AMD64 little-endian
ELF64 ET_DYN, a valid executable load-segment entry, no interpreter or dynamic
segment, bounded extended-section counts, nonoverlapping file and virtual
`PT_LOAD` ranges, at least one nonzero GNU RELRO range fully mapped by a load
segment, a nonexecuting GNU stack, no WX segment/section, no dynamic, symbol or
relocation sections, and no unaccounted overlay bytes.
Every nonempty PE data-directory range must be continuously backed by one
section's raw mapping. Import descriptors are bounded by that mapped directory,
the null descriptor must have all five fields zero, and every DLL-name scan is
bounded by the raw section that maps its starting RVA.

Resource observation starts before the first build and continues through
identity-bound cleanup. Samples are strictly monotonic with no gap above 250
ms. Every sample is bound to the external write-observer identity, records an
integer zero cumulative outside-write count, and lists the unique live lane-root file
identities. Every root identity must be sampled only between its observed
creation and removal. Cleanup starts after all four builds finish, removes the
same four identities, confirms absence, and finishes before observation stops.
The observer start and first sample are both strictly earlier than every
root-absence/root-creation boundary; the same observer identity is present in
every sample and cleanup record, and its stop time is strictly after cleanup
and the final sample.
The continuous aggregate high-water limit is 2,147,483,648 bytes. Any
outside-root write, observer gap, cap breach, ambiguous identity, mismatched
cleanup identity or chronology, remaining root, or observer stop before
cleanup is HOLD.

## Authority and evidence separation

The sole source authority binding is the exact BP00 authority-state object
`6b0b50d9bcc4aa1116e33a5e1cda7fe03976e53b22f72529da3ff8c291d89b7c`
(5,175 bytes). It says `HOLD` and explicitly says compiler, helper and runtime
execution are unauthorized. Source inspection cannot turn that negative fact
positive.

Build provenance and runtime containment are separate predicates. Even a
structurally coherent, self-digested receipt returns `HOLD`, `ready: false`,
`complete: false`, `executionProvenanceObserved: false`, and
`runtimeEvidenceObserved: false`. A later direct observer and separately
authorized implementation must own admission. BP06 provides neither.

No package manager, compiler, linker, helper, fixture, Docker daemon, network,
RPC, key, signature, funding operation, Devnet, Mainnet, deployment or release
action is part of this contract.
