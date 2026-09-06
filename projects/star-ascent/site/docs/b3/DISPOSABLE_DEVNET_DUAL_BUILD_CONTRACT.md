# Disposable-Devnet structural bundle contract

This B09 contract is a nonauthorizing structural validator. It can prove that
the files presented to it have exact shapes, bindings, file identities, and
byte equality at validation time. It cannot prove that Docker, Cargo, RPC, or
key generation ran. One process can self-author every JSON record, log line,
and ELF-magic byte sequence accepted by the structural schema. Therefore every
result remains `HOLD` with
`DISPOSABLE_DEVNET_EXECUTION_PROVENANCE_UNAVAILABLE`.

The validator never builds, queries RPC, generates keys, signs, deploys, funds,
or authorizes anything. The canonical state contains no preflight or receipt.

The machine contract is
`scripts/validate-iat-b3-disposable-devnet-dual-build-evidence.mjs`. Its v2
schemas are:

- `iat-b3-disposable-devnet-structural-contract-preflight/v2`
- `iat-b3-disposable-devnet-structural-contract-receipt/v2`

The compatibility-named evidence-null state file is
`docs/b3/iat-b3-disposable-devnet-dual-build-evidence-state.v1.json`; its schema
is `iat-b3-disposable-devnet-dual-build-evidence-state/v2`.

## Committed-source structure

The canonical source collector delegates to the shared B10 exact-source
observer and reciprocal worktree-control resolver. It does not invoke `git
status`. The shared observer reads committed blobs and worktree bytes directly,
requires index-to-HEAD equality, enumerates untracked paths with `ls-files`,
rejects replacement objects and lazy fetches, and authenticates both directions
of a Windows-linked WSL worktree control file. Repository-local clean/process
filters are therefore never invoked. The authenticated commit and canonical
tree ID bind the complete Git tree, not a selected source subset; B09 hashes
that `(headSha, treeSha)` root as its complete closure. The compatibility field
`sourceClosureFileCount` is `null` when collected because no untrusted secondary
tree enumeration is used. The observer, complete closure digest, and executed
runner bytes are rechecked after inspection. The executed validator must equal
the validator blob in that commit.

The structural source inspection also checks the retained production feature
closures and recipes:

- Law feature `production-combined-hook`;
- Economy feature `runtime-production-entrypoint`;
- Economy feature `sbf-preflight-entrypoint` remains separate and unselected;
- locked/offline recipe structures remain byte-bound.

These checks bind source structure only. They do not establish that any build
command executed.

## Self-authored input records

The identity and Genesis files are explicitly self-authored records. The
validator reopens and hashes them, checks their lane/source/runner fields,
requires three distinct canonical public keys absent from committed text, and
checks the canonical Devnet RPC and Genesis values. The timestamp window is
structural. `FRESH_ISOLATED_OFFLINE_KEYGEN` and `getGenesisHash` are claims
inside those files; neither key generation nor an RPC call is observed.

Container and toolchain objects must structurally match the pinned Linux/AMD64
Docker recipe, `--pull=never`, `--network=none`, Rust 1.97.1, and
cargo-build-sbf 3.1.10. This is not container- or toolchain-execution evidence.
No platform-tools runtime observation is claimed or accepted by B09.

## Structural receipt

The receipt names two distinct, non-nested workspace directories and a third
preservation directory. Each workspace contains Law/Economy ELF-shaped bytes
and self-authored log bytes. Each log header binds the lane, preflight, complete
tree closure, identities, ordinal, path, claimed Docker recipe, environment,
and artifact digest. The validator compares build 1, build 2, and preserved
bytes exactly. Its successful status is
`STRUCTURAL_CONTRACT_BYTE_EQUALITY_RECORDED_HOLD`, never READY or VERIFIED.

The log header proves only that those bytes contain the required header. It
does not prove the named command, backend, or toolchain produced the artifact.
Accordingly the receipt fixes these truths:

```text
classification = STRUCTURAL_CONTRACT_ONLY
selfAuthoredBundlePossible = true
structuralByteEqualityRecorded = true
executionProvenanceObserved = false
buildExecutionObserved = false
behavioralDevnetEvidence = false
adversarialDevnetExecutionEvidence = false
```

## File-system boundary

Every external descriptor binds absolute path, SHA-256, length, device, inode,
and the digest of the complete parent-directory identity chain. Every parent
component must be a real directory whose real path equals its supplied path;
symlink, junction/reparse, and alias chains fail closed. Files are opened with
no-follow where the platform supports it, then lstat and same-descriptor fstat
device/inode/size/time/link metadata are compared before and after the read.
Hard links, path replacement, parent-directory replacement, in-read mutation,
repository-contained paths, aliases, and descriptor swaps are rejected.

Workspace and preservation directories also bind device, inode, and their full
parent-chain digest and are rechecked after their files are consumed.

## Categorical boundary

The immutable scope is:

`DISPOSABLE_DEVNET_STRUCTURAL_CONTRACT_ONLY_NONAUTHORITATIVE`

A valid bundle can clear only a structural-input error. It cannot establish
build execution, behavioral Devnet evidence, adversarial execution, production
receipts, production final bytes, Devnet execution, rehearsal completion,
signing, deployment, release, or Mainnet authorization. D04 consumes B09 only
under this boundary and retains
`DISPOSABLE_DEVNET_EXECUTION_PROVENANCE_UNAVAILABLE`.

To inspect the evidence-null state with Node 24:

```text
node scripts/validate-iat-b3-disposable-devnet-dual-build-evidence.mjs
```

The command exits `2` with structured `HOLD`. `--input <absolute-json>` can
validate a structural bundle only after this runner is in an exact clean
commit. Even a valid input returns a structural-only HOLD result; it never
promotes execution or release truth.
