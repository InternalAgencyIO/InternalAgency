# Exact-source Git observation process boundary

The shared exact-source observer in
`scripts/run-iat-b3-combined-law-reproducible-build.mjs` treats repository-local
Git configuration and repository-local executables as untrusted. Every Git
invocation uses the source-bound absolute Git executable from a trusted
non-repository working directory, a sanitized absolute-only `PATH`, explicit
authenticated `--git-dir` and `--work-tree` arguments, and places the following
command-level controls before the subcommand, after disabling replacement refs,
optional locks, and paging:

- `core.fsmonitor=false`
- `core.untrackedCache=false`
- `core.splitIndex=false`
- empty `core.hooksPath`, `core.askPass`, `core.editor`, `core.pager`, and
  `sequence.editor`
- empty `credential.helper`, `core.sshCommand`, `diff.external`, and
  `interactive.diffFilter`
- `diff.trustExitCode=false`

The process environment discards every inherited `GIT_*` value and also strips
the common non-Git editor, pager, askpass, shell-startup, and dynamic-loader
injection variables. It then restores only fail-closed protocol, lazy-fetch,
replacement-ref, prompt, optional-lock, and null global/system configuration
controls.

These overrides do not replace the exact-source checks. The observer still
authenticates ordinary `.git` directories; linked-worktree control, reciprocal
backlinks, and canonical `commondir`; rejects common/local object-store
`alternates` and `http-alternates` entries (including reparse entries); compares the
stage-zero index directly with the HEAD tree, reads committed objects through
raw `cat-file --batch`, hashes ordinary and canonical Git-LFS worktree bytes
without filters, rejects hardlinks/reparse drift/mode drift, inventories tracked
and nonignored untracked paths, and repeats HEAD/tree/index/nonignored-untracked
and file fingerprints at the end of the observation. Files excluded by committed
per-directory `.gitignore` rules are deliberately outside this Git cleanliness
truth and are covered by the separate direct-filesystem forbidden-material scan.
The combined-Law and Economy preflight/receipt contracts are therefore `/v2`:
the serialized truth is now named
`repositoryCleanTrackedAndNonignoredUntracked`, and the corresponding preflight
check is `REPOSITORY_CLEAN_TRACKED_AND_NONIGNORED_UNTRACKED`. `/v1` consumers
must fail closed until mechanically migrated; no deprecated alias is accepted.

No invoked subcommand requests a diff, textconv, external filter, credential,
SSH transport, editor, pager, or hook. `git show <commit>:<path>` is used only as
raw blob intake; it does not render a patch. Lazy object fetching remains
disabled and missing promisor objects fail closed.

## Direct forbidden-material observation

`scripts/lib/iat-b3-forbidden-material-scan.mjs` supplies the separate
Git-independent filesystem observation. It recursively inventories the complete
repository root, including paths that a committed `.gitignore` excludes, without
invoking Git or any other subprocess. Only the root `.git` control entry and its
internals are excluded; nested `.git` entries fail closed. Root dependency
caches (`node_modules` and `vendor`) receive a canonical, non-reparse boundary
observation but are not recursively classified as release output. They are
reproducibly reconstructed inputs rather than checkpoint material; their tracked
lockfiles and manifests remain in the exact Git-object closure.

Every visited parent and file must remain an ordinary, canonical, non-reparse
path. Regular files must have one link. The scanner binds each open descriptor to
the pre-open and post-read path stat, then repeats every file stat and directory
entry inventory before returning. For credential-carrying extensions (or no
extension), the scanner tokenizes basename stems across camel/Pascal case and
dot, hyphen, or underscore separators; terminal keypair, keystore, mnemonic,
private-key, secret-key, seed/recovery-phrase, and wallet forms all stop the
scan. Credential-env files or assignments, mnemonic/private-key bytes, receipt
files, build-output directories, build-artifact extensions, and ELF magic also
stop it. Source/prose filenames with non-credential extensions are not inferred
to contain secrets from an identifier alone. Large recognized media files
receive a stable 64-KiB prefix inspection plus full path/stat and final-inventory
revalidation; the result explicitly does not claim a full media-content digest.

The sole exception is the published RFC 8032 section 7.1 TEST 1 keypair vector
in `tests/iat-b3-production-local-rehearsal-driver.test.mjs`. Its exact path,
58,499-byte length, and SHA-256 are reviewed in the scanner. Changed bytes or a
copy at any other path fail closed. This allowlist does not admit production or
operator key material.

The focused adversarial test installs a repository-local `core.fsmonitor`
helper that writes a marker. Ordinary `git status` proves the hostile helper is
live. Both exact-source observation and committed-object materialization then
complete cleanly without recreating the marker. The same test also installs
hostile hooks, pager, editor, sequence editor, credential helper, SSH command,
external diff, and interactive diff-filter values, plus split-index and
untracked-cache state. The test is mandatory on Windows and native WSL Node 24.

## Docker process boundary

The same runner never resolves `docker` through caller `PATH`. Linux/amd64 is
the only executable backend. It directly authenticates `/usr/bin/docker` by
real path, regular-file type, link count, byte length, SHA-256, and exact client
version. It launches from the trusted executable directory with a minimal
environment, absolute-only `PATH`, and a new empty off-repository `DOCKER_CONFIG`.
Inherited Docker/TLS/context/plugin/proxy/dynamic-loader variables are absent.

Before and after each evidence-bearing command the runner binds the local Unix
socket and the exact Docker client, daemon, Engine, containerd, runc, and init
versions. Only seven exact command grammars are accepted: image platform inspect,
image-ID inspect, three offline toolchain probes, and the frozen Law/Economy
build argv. The build grammar admits only two read/write mounts (exact source
read-only and the fresh build directory), fixed identity environment names,
the digest-addressed image, and the frozen Cargo recipe. Contradictory or
privilege-expanding flags cannot be appended. Build subprocesses have an exact
30-minute ceiling; a timeout fails closed, emits no receipt, and the Docker
`--rm` contract governs daemon-side container cleanup. Any leftover container
is therefore not accepted as evidence and must be operator-inspected before a
retry.
