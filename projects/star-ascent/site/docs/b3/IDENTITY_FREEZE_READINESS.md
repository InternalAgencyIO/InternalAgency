# B3 immutable identity-freeze input contract

Status: **BLOCKED / IDENTITY-FREEZE READINESS ONLY**

The canonical draft is
[`iat-b3-identity-freeze.v1.json`](iat-b3-identity-freeze.v1.json), governed by
[`iat-b3-identity-freeze.v1.schema.json`](iat-b3-identity-freeze.v1.schema.json)
and the stricter semantic validator at
[`scripts/validate-iat-b3-identity-freeze.mjs`](../../scripts/validate-iat-b3-identity-freeze.mjs).
It does not select, generate, deploy, fund, or publish a production identity.
It is not a Mainnet, deployment, launch, or release-readiness validator.

The draft deliberately reports `BLOCKED`. In particular, it refuses to treat
the retained V2 program, disposable local-validator programs, fixture programs,
or any rehearsal mint as a B3 identity. It also leaves the production law ID,
economy ID, canonical Token-2022 mint, cluster identity policy, Mainnet Genesis
hash, final entropy lag, and metadata policy unresolved. The cluster-policy
choices include the recommended same law/economy/mint public keys across
clusters while keeping all non-production state noncanonical and disposable.
Candidate seed domains, the Genesis transition predicate, and ceremony order
are enumerated as identity-freeze inputs but remain `BLOCKED` until their
separate owning artifacts are accepted.

## Identity-readiness boundary

For this contract alone to report `identityFreezeReady: true`, its fields must
be internally complete and freeze all of the following inputs together:

- distinct, canonical Base58 identities for the law program, economy program,
  and Mainnet Token-2022 mint, with an explicit same/different-cluster policy;
- the `IAT_B3_SOLANA_DAILY_LAW_V1` domain, independently observed Mainnet
  Genesis hash, mint binding, entropy-slot binding, final lag, skipped-slot
  selection, and fail-closed insufficient-history behavior;
- all 22 account-role seed namespaces, including the donation-safe
  `stake-ingress` authority and the allegiance, scoring, weekly, reward-vault,
  reward-manifest, follower-snapshot, and claim faction address boundaries;
- the already-fixed faction machine IDs `radiance`, `ellie`, `alia`, `ece`, and
  `boss`, their public labels Radiance, Ellie, Alia, Ece, and **the boss**, the
  exact `86,400`-second allegiance cooldown, no-op same-faction rejection, and
  the rule that narrative leaders hold no protocol authority;
- exactly nine decimals, fixed supply, only `ConfidentialTransferMint` and
  `TransferHook`, no Permanent Delegate or mint-close authority, no auditor,
  and null mint, freeze, hook, and confidential-mint authorities at the stated
  terminal points;
- the one-way `UNINITIALIZED -> GENESIS_STAGING -> ACTIVE` transition. Staging
  may only create canonical accounts and fund exact manifest amounts; it cannot
  release, reward, score, pledge, open a position, reserve, withdraw, or claim;
- an ordered ceremony policy requiring hardware-held temporary upgrade
  authorities, byte and identity verification, irrevocable revocation of both
  program upgrade authorities before mint creation, exact funding,
  mint/freeze revocation, atomic law initialization and extension-authority
  sealing, a finalized open current day, and activation last. Activation also
  requires the mint, freeze, transfer-hook, and confidential-mint authorities
  to be terminally null.

Even a production-profile manifest with `productionIdentityReady: true` would
certify only that these identity-freeze inputs are complete and internally
consistent. It does **not** certify faction scoring or reward economics,
Genesis allocation amounts or conservation evidence, reviewed binary hashes or
deployed bytes, program authority revocation evidence, an on-chain ceremony,
or Mainnet/release readiness. Those remain separately reviewed blockers and
gates. The seed table names faction account roles; it does not select their
scoring weights, community carve-out, emissions, prizes, or claim economics.
Likewise, the Genesis predicate constrains permitted staging operations but
does not supply or approve a Genesis allocation ledger.

The complete fixture in `tests/iat-b3-identity-freeze.test.mjs` uses conspicuous
test-only identities and can pass only with the validator's explicit
`allowTestFixture` option. Relabeling any of its four identities as
`PRODUCTION` fails closed, and the option never yields
`productionIdentityReady: true`.

## Use

Run the non-release audit directly:

```text
node scripts/validate-iat-b3-identity-freeze.mjs
```

The current canonical draft prints its blockers and exits with status `2`.
This is intentional and is not wired as a failing launch or deployment gate.
The B3 regression suite instead proves both sides: the production draft stays
honestly unresolved, while a structurally complete test-only fixture passes;
placeholders, malformed or duplicate keys, V2/disposable identities, seed
collisions, broadened mint extensions, staging writes, and unsafe seal ordering
all fail closed.

## Final-binary reproducibility preflight

The existing exact-source runner also exposes a network-free preflight. It does
not compile, sign, deploy, or write to an RPC endpoint:

```text
export IAT_B3_EXACT_SOURCE_HEAD_SHA="<40-hex clean commit obtained from Windows git>"
node scripts/run-iat-b3-combined-law-reproducible-build.mjs --preflight
```

Its machine-readable result is `READY_TO_EXECUTE_DUAL_BUILD` only when all of
these prerequisites are simultaneously true:

- the explicitly declared 40-hex commit is the observed `HEAD`, the complete
  tracked and untracked worktree is clean, and the executing runner bytes match
  the runner blob in that commit;
- the exact committed identity and owner-policy packets yield the three frozen
  production inputs `IAT_B3_PRODUCTION_LAW_PROGRAM_ID`,
  `IAT_B3_PRODUCTION_ECONOMY_PROGRAM_ID`, and
  `IAT_B3_PRODUCTION_CANONICAL_MINT`;
- the host is Linux AMD64 and the already-local container is exactly
  `solanafoundation/anchor@sha256:28fde4e63a063727c9520a925de4e9a3be29fcc717b5d759363c23ddea28f59d`
  (`--pull=never`, `--network=none`, Docker endpoint
  `unix:///var/run/docker.sock`);
- the container reports Rust 1.97.1, Cargo 1.97.1, and
  `solana-cargo-build-sbf 3.1.10`; and
- the temporary-build volume has at least 24 GiB free. The planning budget is
  16 GiB for two fresh build workspaces plus an 8 GiB post-run reserve. The
  pinned container image must already be present and its storage is not included
  in that 24 GiB.

The repository requires Node `>=22.13.0`, while the release-proof workflow uses
Node major 24. There is no exact Node patch pin. The preflight records the
observed Node version and this limitation; the SBF compiler and byte-generating
toolchain remain isolated in the digest-pinned container.

### Native WSL observation-only preflight

The explicit selector `NATIVE_WSL_LINUX_AMD64_PINNED_TOOLCHAIN` is currently
`OBSERVATION_PREFLIGHT_ONLY`, not a build backend. It may read and hash the
installed Ubuntu 24.04 Linux/AMD64 tools and offline dependency archives, but
it cannot execute a compiler, create a build receipt, or validate a build
receipt. Every native preflight includes the failed check
`HERMETIC_IMMUTABLE_ROOTFS_DIRECTLY_PROVEN` and therefore returns `HOLD`/exit
`2`, even if all source, identity, toolchain, archive, and disk observations
pass.

The observation contract binds exact executable paths, versions, file hashes,
and complete tree hashes for Node `v24.10.0`, host Rust and Cargo `1.97.1`,
Solana `cargo-build-sbf 3.1.10`, and platform-tools `v1.52`. Every `Cargo.lock`
registry checksum must have a matching already-local crate archive. These facts
are useful prerequisites, but a mutable host WSL installation is not an
immutable hermetic build root.

From the existing Ubuntu-24.04 WSL environment, run only the no-build checks:

```text
cd "<absolute WSL path to projects/star-ascent/site>"
export IAT_B3_REPRODUCIBLE_BUILD_BACKEND=NATIVE_WSL_LINUX_AMD64_PINNED_TOOLCHAIN
export IAT_B3_EXACT_SOURCE_HEAD_SHA="<40-hex clean commit obtained with Windows git>"
NODE24="${HOME}/.local/node-v24.10.0-linux-x64/bin/node"
test "$("${NODE24}" --version)" = "v24.10.0"
"${NODE24}" scripts/run-iat-b3-combined-law-reproducible-build.mjs --preflight
"${NODE24}" scripts/run-iat-b3-economy-reproducible-build.mjs --preflight
```

The backend discovers the current WSL user's home directory at runtime and
then verifies the exact pinned executable and complete tool-tree hashes. It
does not encode a workstation username or treat discovery as trust.

The runner safely resolves the Windows worktree's `.git` control path for
read-only WSL Git observations; it still requires the exact declared HEAD,
clean tracked and untracked state, committed runner bytes, and Git-object
materialization. The Docker backend remains the default and is unchanged.
The currently installed Docker image is not executable under its required
platform-manifest digest and reports Rust 1.95.0, so it remains a Docker HOLD;
native observation does not waive that Docker receipt contract.

Current native observation proves the pinned toolchain trees, all 229 locked
crate archives, and more than 900 GiB free under `/tmp`. Both preflights still
correctly return `HOLD` for the immutable-rootfs blocker in addition to current
dirty/uncommitted source and unresolved production identities. No build was
run.

Future enablement requires direct proof of an immutable rootfs digest, complete
source/toolchain/runtime/dependency closure, recursive whole-build-root key-
material rejection, and preserved raw stdout and stderr for each repetition
with independently checked SHA-256 and byte length. Until all of those checks
are implemented and proven, every native build or receipt API fails before it
creates an output directory.

A preflight `READY_TO_EXECUTE_DUAL_BUILD` is permission only to start the
compiler run. It deliberately keeps `reproducibleBuildVerified: false` and
Mainnet at `HOLD`. Any failed check exits `2`, reports its exact blocker IDs,
and performs no build.

## Exact clean-head dual-build execution

Run the Docker backend only from the same clean committed Linux AMD64 source
that passed its preflight. Both destinations must be new absolute paths outside
the repository:

```text
export IAT_B3_EXACT_SOURCE_HEAD_SHA="$(git rev-parse HEAD)"
node scripts/run-iat-b3-combined-law-reproducible-build.mjs \
  --receipt /absolute/off-repository/iat-b3-combined-law-build-receipt.json \
  --artifact /absolute/off-repository/iat_b3_law.so
```

For each of two repetitions the runner materializes the declared Git tree from
Git objects, not mutable worktree bytes, and uses fresh output and target
directories. The exact production command inside the pinned container is:

```text
cargo build-sbf \
  --manifest-path projects/star-ascent/site/programs/iat_b3_law/Cargo.toml \
  --sbf-out-dir <FRESH_OUTPUT_DIRECTORY> \
  --arch v0 \
  --no-default-features \
  --features production-combined-hook \
  --optimize-size \
  --offline \
  --skip-tools-install \
  --tools-version v1.52 \
  -- \
  --locked \
  --target-dir <FRESH_TARGET_DIRECTORY>
```

The only permitted output file is nonempty `iat_b3_law.so`. The two outputs
must have identical bytes, byte lengths, and SHA-256 values. The atomically
preserved artifact is read back and bound to receipt schema
`iat-b3-combined-law-exact-source-dual-sbf-build/v2`. The receipt binds the
declared commit and tree, exact executing-runner bytes against the runner blob
in that commit, materialized-input digest, identity and environment digests,
container manifest and local-image IDs, compiler versions, recipe
digest, both artifact and log hashes, final byte length, and preserved-artifact
hash. Unsafe compiler diagnostics, source drift, unexpected output files,
keypair material, any byte mismatch, or output-path overwrite aborts the run.

The successful receipt proves this narrow dual-build fact only. Its safety
boundary intentionally does not assert identity authority, Devnet acceptance,
production-candidate status, Mainnet authorization, or a deployed-program
binding. There is no independent-human-review receipt predicate: nonsigning
truth is checked directly from source and bytes. The only human gate is the
separate actual cryptographic confirmation on a Trezor Model T; the Docker
build runner never signs or claims that confirmation.

### Local-rehearsal receipt handoff

The local-rehearsal readiness gate parses this receipt with
`validateCombinedLawBuildReceipt`; it does not treat a receipt-path hash or a
denormalized input descriptor as proof. It cross-checks the receipt's exact
HEAD, equal executing/committed build-runner hashes, identity-manifest and
build-environment bindings, both build and log hashes, and preserved
`iat_b3_law.so` bytes against the independently reread artifact.

The native WSL receipt schema remains only as a disabled future contract.
Native receipt creation and validation both throw while the execution mode is
`OBSERVATION_PREFLIGHT_ONLY`, and R01 rejects synthetic native law or economy
receipts. Only the existing Docker law and economy receipt schemas can satisfy
R01.

This runner produces only the combined-law `iat_b3_law.so`. It does not build
or attest `iat_b3_economy.so`, and its receipt cannot be copied, renamed, or
reused to clear the local gate's economy-artifact blocker.

The separate production-economy runner is:

```text
export IAT_B3_EXACT_SOURCE_HEAD_SHA="$(git rev-parse HEAD)"
node scripts/run-iat-b3-economy-reproducible-build.mjs --preflight
node scripts/run-iat-b3-economy-reproducible-build.mjs \
  --receipt /absolute/off-repository/iat_b3_economy.receipt.json \
  --artifact /absolute/off-repository/iat_b3_economy.so
```

Its receipt schema is
`iat-b3-economy-exact-source-dual-sbf-build/v2`. It uses the same clean exact-
HEAD Git-object materialization, committed runner binding, pinned Linux/AMD64
container, offline toolchain, two isolated target/output directories, exact
byte equality, atomic no-overwrite publication, and Mainnet-HOLD boundary as
the combined-law runner. It additionally binds the frozen Mainnet Genesis hash
as a fourth build input and source-proves that the only Cargo entrypoint feature
is `runtime-production-entrypoint`. `sbf-preflight-entrypoint` is rejected in
the source closure, recipe, Docker arguments, and receipt.

The exact production economy build command inside the pinned container is:

```text
cargo build-sbf \
  --manifest-path projects/star-ascent/site/programs/iat_b3_economy/Cargo.toml \
  --sbf-out-dir <FRESH_OUTPUT_DIRECTORY> \
  --arch v0 \
  --no-default-features \
  --features runtime-production-entrypoint \
  --optimize-size \
  --offline \
  --skip-tools-install \
  --tools-version v1.52 \
  -- \
  --locked \
  --target-dir <FRESH_TARGET_DIRECTORY>
```

The command requires explicit frozen values for
`IAT_B3_PRODUCTION_LAW_PROGRAM_ID`,
`IAT_B3_PRODUCTION_ECONOMY_PROGRAM_ID`,
`IAT_B3_PRODUCTION_CANONICAL_MINT`, and
`IAT_B3_PRODUCTION_MAINNET_GENESIS_HASH`. The current draft identity packet
cannot supply them, so the no-build preflight correctly returns `HOLD`.

## ProgramData byte binding and abort rule

Use a finalized observation from the authorized cluster and record the RPC
Genesis hash and observation slot. Decode the Program account as upgradeable
loader state: it must be executable, owned by
`BPFLoaderUpgradeab1e11111111111111111111111`, exactly 36 bytes, have little-
endian `u32` discriminator `2`, and name its ProgramData address in bytes
`4..36`.

The named ProgramData account must have the same loader owner and little-endian
`u32` discriminator `3`. Program bytes begin at offset `45`. Before terminal
freeze, its authority must equal the separately reviewed temporary upgrade
authority. After terminal freeze, byte `12` must be `0` (no upgrade authority)
and unused authority bytes `13..45` must be zero. In both observations:

- bytes `45..45 + receipt.artifact.byteLength` must equal the preserved
  `iat_b3_law.so` byte for byte and have the receipt's exact SHA-256;
- every remaining loader-allocation byte must be zero; and
- the program address, ProgramData address, owners, discriminators, authority,
  artifact hash and size, deployed-byte hash and size, trailing-zero length,
  slot, and Genesis hash must be retained as evidence.

Abort and do not continue the ceremony on a different loader owner, address,
discriminator, authority, length, byte, hash, nonzero padding byte, Genesis
hash, or ambiguous/failing RPC observation. Repeat the exact comparison after
authority revocation; a pre-freeze match is not terminal immutable evidence.
