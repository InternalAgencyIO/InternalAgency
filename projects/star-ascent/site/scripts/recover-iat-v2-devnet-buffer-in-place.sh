#!/usr/bin/bash
set -euo pipefail
set +x
umask 077

hold() { echo "HOLD: $*" >&2; exit 1; }

(( $# == 0 )) || hold "this in-place recovery launcher accepts no arguments"
[[ "${IAT_V2_CLEAN_ENVIRONMENT:-}" == "iat-v2-devnet-buffer-in-place-recovery-v1" ]] \
  || hold "use the exact clean Ubuntu-24.04 WSL2 launcher from the attended runbook"
for inherited in BASH_ENV CDPATH ENV LD_LIBRARY_PATH LD_PRELOAD NODE_OPTIONS NODE_PATH SOLANA_CONFIG_FILE TMPDIR "${!GIT_@}"; do
  [[ -z "$inherited" || ! -v "$inherited" ]] || hold "prohibited inherited environment variable: $inherited"
done
[[ "${HOME:-}" == "/home/a" ]] || hold "HOME is not the reviewed attended WSL home"
[[ "${LANG:-}" == "C.UTF-8" && "${LC_ALL:-}" == "C.UTF-8" ]] || hold "LANG and LC_ALL must both be exact C.UTF-8"
[[ "${PATH:-}" == "/usr/bin:/bin" ]] || hold "PATH is not the reviewed minimal system path"
[[ -e /proc/sys/fs/binfmt_misc/WSLInterop ]] || hold "WSL interoperability boundary is unavailable"
[[ "$(/usr/bin/uname -r)" == *-microsoft-standard-WSL2 ]] || hold "kernel is not the reviewed WSL2 class"
/usr/bin/grep -Fqx 'ID=ubuntu' /etc/os-release || hold "distribution is not Ubuntu"
/usr/bin/grep -Eq '^VERSION_ID="?24\.04"?$' /etc/os-release || hold "distribution is not Ubuntu 24.04"
[[ "$(/usr/bin/id -u)" == "1000" ]] || hold "attended POSIX user identity drifted"

SCRIPT_DIR="$(cd -- "$(/usr/bin/dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
SITE_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"
[[ "$SITE_ROOT" == "/mnt/c/Users/A/Documents/Codex/2026-08-13/can-you-take-over-b3-architecture-3/work/iat-b3-bpk00-package-bound-fd12-owner-root-public-key-anchor-clean/projects/star-ascent/site" ]] \
  || hold "site root is not the one exact reviewed checkout"
cd -- "$SITE_ROOT"

# Execution is admitted only by verify-recovery below. That verifier requires this
# exact committed source to be the public-CI source S and HEAD to be its direct,
# data-only runtime-binding successor B. There is no environment bypass.
IN_PLACE_RUNTIME_BINDING_POLICY='REQUIRE_EXACT_PUBLIC_CI_SOURCE_AND_BINDING_SUCCESSOR'
[[ "$IN_PLACE_RUNTIME_BINDING_POLICY" == 'REQUIRE_EXACT_PUBLIC_CI_SOURCE_AND_BINDING_SUCCESSOR' ]] \
  || hold "in-place recovery runtime-binding policy drifted"

NODE_BIN='/home/a/.local/share/internal-agency/toolchains/node-v24.19.0-linux-x64/bin/node'
NODE_VERSION='v24.19.0'
NODE_SHA256='bc17c508ffeed0ec622934f9b7fa72f8e78da65350e63c3eceb56fa688aa5e12'
NODE_BYTES='125989464'
GIT_BIN='/mnt/c/Program Files/Git/mingw64/bin/git.exe'
GIT_VERSION='git version 2.55.0.windows.5'
GIT_SHA256='d1b62b94aa15e5c3bbcdd6440d5f716f78daa2736a951b0f1fad11d38c5f16da'
GIT_BYTES='4378456'
SOLANA_BIN='/home/a/.local/share/solana/install/releases/3.1.10/solana-release/bin/solana'
PAYER_KEYPAIR="/home/a/.config/solana/iat-v2-devnet-deployer.json"
ARTIFACT="$SITE_ROOT/target/verifiable/iat_v2.so"
EVIDENCE="$SITE_ROOT/target/verifiable/iat-v2-build-evidence.json"
RUNTIME_EVIDENCE="$SITE_ROOT/target/verifiable/iat-v2-recovery-runtime-build-evidence.json"
RECONCILER="$SITE_ROOT/scripts/reconcile-iat-v2-devnet-buffer-finalized.mjs"
BUFFER_ADDRESS="564XrjVAyqXrChSe9sDJ68XFtNL7tVVLYdwFc9mh1GHH"
EXPECTED_AUTHORITY="DYURSZnNLak5YNt2vLJUnU5iWDUbAo53oUfzZ8dVc5d4"
EXPECTED_OWNER="BPFLoaderUpgradeab1e11111111111111111111111"
EXPECTED_GENESIS="EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG"
EXPECTED_BUFFER_LAMPORTS="4522976880"
EXPECTED_ACCOUNT_BYTES="649717"
EXPECTED_METADATA_BYTES="37"
EXPECTED_PROGRAM_BYTES="649680"
EXPECTED_PARTIAL_HASH="b93ff94d13fdd2c2ebe75af8630f70bfa3d59ab1578993a52377283edbf414ef"
EXPECTED_PREFIX_BYTES="19200"
EXPECTED_REMAINING_BYTES="630480"
MIN_FINALIZED_SLOT="489440472"
TARGET_ARTIFACT_SHA256="771c87bcd9afacf7e8e6bf43cd7ba05915fceb11c45a6a89d8080f6b52778a01"
TARGET_ARTIFACT_BYTES="649680"
TARGET_EVIDENCE_SHA256="ca19c4ebec300031528014e3d3373889a7b171589158ba366536e6200a3ac2a9"
TARGET_SOURCE_HEAD="a03fe71dd66cd1650b8d0353e486786df30b83e9"
TARGET_CI_RUN_ID="33161771816"
UPLOAD_FEE_HEADROOM_LAMPORTS="100000000"
RECOVERY_PARENT="/home/a/.local/state/internal-agency/iat-v2"
RECOVERY_ROOT="$RECOVERY_PARENT/devnet-buffer-in-place-recovery-v1"
ATTEMPT_DIR="$RECOVERY_ROOT/attempt-one-use"
CONFIRMATION_PHRASE="AUTHORIZE-DEVNET-IN-PLACE-BUFFER-RECOVERY-564XrjVAyqXrChSe9sDJ68XFtNL7tVVLYdwFc9mh1GHH-FROM-19200-OF-649680-CURRENT-b93ff94d13fdd2c2ebe75af8630f70bfa3d59ab1578993a52377283edbf414ef-TARGET-771c87bcd9afacf7e8e6bf43cd7ba05915fceb11c45a6a89d8080f6b52778a01"
RUNTIME_ANCHOR="$SITE_ROOT/scripts/data/iat-v2-devnet-buffer-runtime-binding.json"

bootstrap_verify_exact_tool() {
  local path="$1" expected_path="$2" expected_version="$3" expected_hash="$4" expected_bytes="$5" label="$6"
  local resolved mode observed_hash observed_version
  resolved="$(/usr/bin/readlink -f -- "$path" 2>/dev/null || true)"
  [[ "$resolved" == "$expected_path" && -f "$resolved" && -x "$resolved" && ! -L "$resolved" ]] \
    || hold "$label is not the exact reviewed executable"
  [[ "$(/usr/bin/stat -c '%u' -- "$resolved")" == "$(/usr/bin/id -u)" ]] || hold "$label owner drifted"
  mode="$(/usr/bin/stat -c '%a' -- "$resolved")"
  [[ "$mode" =~ ^[0-7]{3,4}$ ]] && (( (8#$mode & 8#022) == 0 )) || hold "$label is group/world writable"
  [[ "$(/usr/bin/stat -c '%s' -- "$resolved")" == "$expected_bytes" ]] || hold "$label byte length drifted"
  observed_hash="$(/usr/bin/sha256sum -- "$resolved")"; observed_hash="${observed_hash%% *}"
  [[ "$observed_hash" == "$expected_hash" ]] || hold "$label SHA-256 drifted"
  observed_version="$(/usr/bin/env -i HOME=/nonexistent/iat-v2-bootstrap-home XDG_CONFIG_HOME=/nonexistent/iat-v2-bootstrap-config LANG=C.UTF-8 LC_ALL=C.UTF-8 PATH=/usr/bin:/bin "$resolved" --version 2>&1)"
  [[ "$observed_version" == "$expected_version" ]] || hold "$label version drifted"
}

bootstrap_git() {
  /usr/bin/env -i HOME=/home/a LANG=C.UTF-8 LC_ALL=C.UTF-8 PATH=/usr/bin:/bin \
    GIT_ATTR_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 \
    GIT_LFS_SKIP_SMUDGE=1 GIT_NO_LAZY_FETCH=1 GIT_NO_REPLACE_OBJECTS=1 \
    GIT_OPTIONAL_LOCKS=0 GIT_PAGER=cat GIT_TERMINAL_PROMPT=0 \
    "$GIT_BIN" --no-pager --no-replace-objects -c core.fsmonitor=false -c core.hooksPath=/dev/null "$@"
}

bootstrap_verify_binding_sources() {
  local source_commit head_commit parents changed prefix path repo_path record mode oid index status
  [[ -f "$RUNTIME_ANCHOR" && ! -L "$RUNTIME_ANCHOR" && "$(/usr/bin/stat -c '%h' -- "$RUNTIME_ANCHOR")" == "1" ]] \
    || hold "runtime binding anchor is not a single-linked regular file"
  source_commit="$("$NODE_BIN" --input-type=module -e '
    import { closeSync, constants, fstatSync, lstatSync, openSync, readFileSync } from "node:fs";
    const p=process.argv[1], before=lstatSync(p,{bigint:true});
    if (!before.isFile() || before.isSymbolicLink() || before.nlink!==1n) throw new Error("unsafe anchor");
    const fd=openSync(p,constants.O_RDONLY|constants.O_NOFOLLOW);
    try { const opened=fstatSync(fd,{bigint:true}); if(opened.dev!==before.dev||opened.ino!==before.ino) throw new Error("anchor changed");
      const value=JSON.parse(readFileSync(fd,"utf8")); if(!/^[0-9a-f]{40}$/.test(value.sourceHeadCommit)) throw new Error("bad source commit"); process.stdout.write(value.sourceHeadCommit);
    } finally { closeSync(fd); }
  ' -- "$RUNTIME_ANCHOR")" || hold "runtime binding anchor bootstrap parse failed"
  head_commit="$(bootstrap_git rev-parse --verify HEAD^{commit})" || hold "HEAD is unavailable"
  mapfile -t parents < <(bootstrap_git show -s --format=%P "$head_commit")
  read -r -a parents <<<"${parents[0]:-}"
  (( ${#parents[@]} == 1 )) && [[ "${parents[0]}" == "$source_commit" ]] \
    || hold "HEAD is not the direct child of the anchored public-CI source"
  changed="$(bootstrap_git diff --no-ext-diff --no-textconv --name-status --no-renames "$source_commit" "$head_commit")" \
    || hold "S-to-B bootstrap diff is unavailable"
  [[ "$changed" == $'M\tprojects/star-ascent/site/scripts/data/iat-v2-devnet-buffer-runtime-binding.json' ]] \
    || hold "HEAD is not the exact data-only runtime-binding successor"
  prefix="$(bootstrap_git rev-parse --show-prefix)"
  for path in \
    scripts/iat-v2-devnet-buffer-preflight.mjs \
    scripts/lib/iat-v2-attended-node-runtime.mjs \
    scripts/lib/iat-v2-attended-git-runtime.mjs \
    scripts/lib/iat-v2-devnet-buffer-runtime-binding.mjs \
    scripts/validate-iat-v2-ci-sbf-evidence.mjs \
    programs/iat_v2/artifact-binding.mjs \
    scripts/recover-iat-v2-devnet-buffer-in-place.sh \
    scripts/reconcile-iat-v2-devnet-buffer-finalized.mjs \
    scripts/data/iat-v2-devnet-buffer-runtime-binding.json; do
    [[ -f "$path" && ! -L "$path" && "$(/usr/bin/stat -c '%h' -- "$path")" == "1" ]] \
      || hold "bootstrap runtime source is not a single-linked regular file: $path"
    repo_path="${prefix}${path}"
    record="$(bootstrap_git ls-tree --full-tree "$head_commit" -- "$repo_path")"
    [[ "$record" == *' blob '*$'\t'"$repo_path" ]] || hold "bootstrap runtime source is not committed: $path"
    mode="${record%% *}"; oid="${record#* blob }"; oid="${oid%%$'\t'*}"
    index="$(bootstrap_git ls-files --stage --full-name -- ":(top)$repo_path")"
    [[ "$index" == "$mode $oid 0"$'\t'"$repo_path" ]] || hold "bootstrap runtime source index drifted: $path"
    [[ "$(bootstrap_git hash-object --no-filters -- "$path")" == "$oid" ]] || hold "bootstrap runtime source bytes drifted: $path"
    status="$(bootstrap_git status --porcelain=v1 --untracked-files=all -- "$path")"
    [[ -z "$status" ]] || hold "bootstrap runtime source worktree is not clean: $path"
  done
}

verify_binding() {
  local record
  record="$("$NODE_BIN" scripts/iat-v2-devnet-buffer-preflight.mjs verify-recovery \
    --artifact "$ARTIFACT" --evidence "$EVIDENCE" --runtime-evidence "$RUNTIME_EVIDENCE")" \
    || hold "artifact/source/runtime public-CI binding failed"
  printf '%s' "$record" | "$NODE_BIN" --input-type=module -e '
    const chunks=[]; for await (const chunk of process.stdin) chunks.push(chunk);
    const v=JSON.parse(Buffer.concat(chunks)); const a=process.argv.slice(1);
    if (a.length !== 5) throw new Error("binding argument map drifted");
    const [artifactHash,artifactBytes,artifactEvidence,runtimeArtifactHash,runtimeArtifactBytes]=a;
    if (v.status !== "PASS" || v.network !== "devnet" || v.artifactSha256 !== artifactHash || `${v.artifactBytes}` !== artifactBytes || v.evidenceManifestSha256 !== artifactEvidence) throw new Error("artifact binding drifted");
    const r=v.runtimeBinding;
    if (r?.status !== "BOUND" || r.network !== "devnet" || r.mainnetStatus !== "HOLD" || !/^[0-9a-f]{64}$/.test(r.evidenceManifestSha256) || r.artifactSha256 !== runtimeArtifactHash || `${r.artifactBytes}` !== runtimeArtifactBytes || r.signing !== false || r.broadcast !== false || r.mainnetAuthorized !== false) throw new Error("runtime binding drifted");
  ' -- "$TARGET_ARTIFACT_SHA256" "$TARGET_ARTIFACT_BYTES" "$TARGET_EVIDENCE_SHA256" "$TARGET_ARTIFACT_SHA256" "$TARGET_ARTIFACT_BYTES" \
    || hold "artifact/source/runtime binding pins drifted"
  BINDING_RECORD="$record"
}

# Bootstrap only fixed binary pins and raw Git S->B/source identities before any
# repository shell code executes. The complete verifier then authenticates the
# public CI manifest and full closure before the reviewed library is sourced.
bootstrap_verify_exact_tool "$NODE_BIN" "$NODE_BIN" "$NODE_VERSION" "$NODE_SHA256" "$NODE_BYTES" "Node.js bootstrap runtime"
bootstrap_verify_exact_tool "$GIT_BIN" "$GIT_BIN" "$GIT_VERSION" "$GIT_SHA256" "$GIT_BYTES" "Git bootstrap runtime"
bootstrap_verify_binding_sources
verify_binding

source "$SCRIPT_DIR/lib/iat-v2-attended-solana-toolchain.sh"

NODE_BIN="$IAT_V2_EXPECTED_NODE_PATH"
GIT_BIN="$IAT_V2_EXPECTED_GIT_PATH"
SOLANA_BIN="$IAT_V2_EXPECTED_SOLANA_CLI_PATH"

[[ ! -e "$ATTEMPT_DIR" && ! -L "$ATTEMPT_DIR" ]] \
  || hold "the persistent in-place recovery CAS already exists; DO NOT RERUN after any ambiguity"

verify_node() {
  iat_v2_verify_exact_tool "$NODE_BIN" "$IAT_V2_EXPECTED_NODE_PATH" "$IAT_V2_EXPECTED_NODE_VERSION" \
    "$IAT_V2_EXPECTED_NODE_SHA256" "$IAT_V2_EXPECTED_NODE_BYTES" "Node.js runtime"
  NODE_BIN="$IAT_V2_VERIFIED_TOOL_PATH"
}

verify_git() {
  iat_v2_verify_exact_git
  GIT_BIN="$IAT_V2_VERIFIED_TOOL_PATH"
}

verify_solana() {
  iat_v2_verify_exact_tool "$SOLANA_BIN" "$IAT_V2_EXPECTED_SOLANA_CLI_PATH" "$IAT_V2_EXPECTED_SOLANA_CLI_VERSION" \
    "$IAT_V2_EXPECTED_SOLANA_CLI_SHA256" "$IAT_V2_EXPECTED_SOLANA_CLI_BYTES" "Solana CLI"
  SOLANA_BIN="$IAT_V2_VERIFIED_TOOL_PATH"
}

exact_private_directory() {
  local path="$1"
  [[ -d "$path" && ! -L "$path" ]] || hold "$path is not an exact private directory"
  [[ "$(/usr/bin/readlink -f -- "$path")" == "$path" ]] || hold "$path resolves through a symlink"
  [[ "$(/usr/bin/stat -c '%a' -- "$path")" == "700" ]] || hold "$path is not exact mode 0700"
  [[ "$(/usr/bin/stat -c '%u' -- "$path")" == "$(/usr/bin/id -u)" ]] || hold "$path owner drifted"
}

fsync_paths() {
  "$NODE_BIN" --input-type=module -e '
    import { closeSync, constants, fstatSync, fsyncSync, lstatSync, openSync } from "node:fs";
    for (const path of process.argv.slice(1)) {
      const before = lstatSync(path, { bigint: true });
      const directory = before.isDirectory();
      if (!directory && (!before.isFile() || before.nlink !== 1n)) throw new Error("non-regular recovery entry");
      if (before.isSymbolicLink() || before.uid !== 1000n) throw new Error("unsafe recovery identity");
      if ((before.mode & 0o777n) !== (directory ? 0o700n : 0o600n)) throw new Error("unsafe recovery mode");
      const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | (directory ? constants.O_DIRECTORY : 0));
      try {
        const opened = fstatSync(fd, { bigint: true });
        if (opened.dev !== before.dev || opened.ino !== before.ino) throw new Error("recovery identity changed");
        fsyncSync(fd);
        const durable = fstatSync(fd, { bigint: true });
        const after = lstatSync(path, { bigint: true });
        if (durable.dev !== before.dev || durable.ino !== before.ino || after.dev !== before.dev || after.ino !== before.ino || (!directory && (durable.nlink !== 1n || after.nlink !== 1n))) throw new Error("recovery identity changed during durability barrier");
      } finally { closeSync(fd); }
    }
  ' -- "$@" || hold "recovery evidence could not be made crash-durable"
}

write_exclusive_stdin() {
  local destination="$1"
  "$NODE_BIN" --input-type=module -e '
    import { constants, createWriteStream, openSync, closeSync, fsyncSync } from "node:fs";
    const path = process.argv[1];
    const fd = openSync(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    const output = createWriteStream(null, { fd, autoClose: false });
    process.stdin.pipe(output);
    output.on("finish", () => { fsyncSync(fd); closeSync(fd); });
  ' -- "$destination" || hold "exclusive recovery evidence write failed"
}

snapshot_artifact() {
  local destination="$1"
  "$NODE_BIN" --input-type=module -e '
    import { createHash } from "node:crypto";
    import { closeSync, constants, fstatSync, fsyncSync, lstatSync, openSync, readFileSync, writeFileSync } from "node:fs";
    const [source, destination, expectedHash, expectedBytes] = process.argv.slice(1);
    const before = lstatSync(source, { bigint: true });
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1n) throw new Error("unsafe artifact source");
    const sourceFd = openSync(source, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const opened = fstatSync(sourceFd, { bigint: true });
      if (opened.dev !== before.dev || opened.ino !== before.ino) throw new Error("artifact identity changed");
      const bytes = readFileSync(sourceFd);
      const hash = createHash("sha256").update(bytes).digest("hex");
      if (`${bytes.length}` !== expectedBytes || hash !== expectedHash) throw new Error("artifact pin mismatch");
      writeFileSync(destination, bytes, { flag: "wx", mode: 0o600, flush: true });
      const after = fstatSync(sourceFd, { bigint: true });
      if (after.dev !== before.dev || after.ino !== before.ino) throw new Error("artifact changed while copying");
    } finally { closeSync(sourceFd); }
  ' -- "$ARTIFACT" "$destination" "$TARGET_ARTIFACT_SHA256" "$TARGET_ARTIFACT_BYTES" \
    || hold "exact target artifact snapshot failed"
}

open_private_payer() {
  [[ -f "$PAYER_KEYPAIR" && ! -L "$PAYER_KEYPAIR" ]] || hold "Devnet payer is not a regular non-symlink file"
  [[ "$(/usr/bin/readlink -f -- "$PAYER_KEYPAIR")" == "$PAYER_KEYPAIR" ]] || hold "Devnet payer path is not canonical"
  exec 9< "$PAYER_KEYPAIR"
  [[ "$(/usr/bin/stat -Lc '%a:%u:%h' -- /proc/self/fd/9)" == "600:$(/usr/bin/id -u):1" ]] || hold "Devnet payer descriptor identity drifted"
  [[ "$(/usr/bin/stat -Lc '%d:%i' -- /proc/self/fd/9)" == "$(/usr/bin/stat -Lc '%d:%i' -- "$PAYER_KEYPAIR")" ]] || hold "Devnet payer path changed"
}

reverify_private_payer_fd() {
  [[ -e /proc/self/fd/9 ]] || hold "Devnet payer descriptor is no longer open"
  [[ "$(/usr/bin/stat -Lc '%a:%u:%h' -- /proc/self/fd/9)" == "600:$(/usr/bin/id -u):1" ]] || hold "Devnet payer descriptor identity drifted"
  [[ "$(/usr/bin/stat -Lc '%d:%i' -- /proc/self/fd/9)" == "$(/usr/bin/stat -Lc '%d:%i' -- "$PAYER_KEYPAIR")" ]] || hold "Devnet payer path changed after opening"
}

assert_artifact_fd() {
  local observed_hash observed_bytes
  observed_bytes="$(/usr/bin/stat -Lc '%s' -- /proc/self/fd/11)"
  observed_hash="$(/usr/bin/sha256sum -- /proc/self/fd/11)"; observed_hash="${observed_hash%% *}"
  [[ "$observed_bytes" == "$TARGET_ARTIFACT_BYTES" && "$observed_hash" == "$TARGET_ARTIFACT_SHA256" ]] \
    || hold "open target artifact snapshot drifted"
}

verify_committed_source() {
  local path mode prefix repo_path head index oid status
  for specification in 'scripts/recover-iat-v2-devnet-buffer-in-place.sh 100755' 'scripts/reconcile-iat-v2-devnet-buffer-finalized.mjs 100644'; do
    read -r path mode <<<"$specification"
    [[ -f "$path" && ! -L "$path" && "$(/usr/bin/stat -c '%h' -- "$path")" == "1" ]] || hold "runtime source is not a single-linked regular file: $path"
    prefix="$("$GIT_BIN" --no-replace-objects rev-parse --show-prefix)"
    repo_path="${prefix}${path}"
    head="$("$GIT_BIN" --no-replace-objects ls-tree --full-tree HEAD -- "$repo_path")"
    [[ "$head" == "$mode blob "*$'\t'"$repo_path" ]] || hold "runtime source is not an exact committed $mode blob: $path"
    oid="${head#* blob }"; oid="${oid%%$'\t'*}"
    index="$("$GIT_BIN" --no-replace-objects ls-files --stage --full-name -- ":(top)$repo_path")"
    [[ "$index" == "$mode $oid 0"$'\t'"$repo_path" ]] || hold "runtime source index differs from HEAD: $path"
    [[ "$("$GIT_BIN" --no-replace-objects hash-object --no-filters -- "$path")" == "$oid" ]] || hold "runtime source working bytes differ from HEAD: $path"
    status="$("$GIT_BIN" --no-replace-objects status --porcelain=v1 --untracked-files=all -- "$path")"
    [[ -z "$status" ]] || hold "runtime source worktree is not clean: $path"
  done
}

observe_payer_floor() {
  local output
  output="$(iat_v2_run_keyless_solana_timeout 45 "$SOLANA_BIN" balance "$EXPECTED_AUTHORITY" --url devnet --commitment finalized --lamports)" \
    || hold "finalized Devnet payer balance is unavailable"
  read -r PAYER_LAMPORTS _ <<<"$output"
  [[ "$PAYER_LAMPORTS" =~ ^[0-9]+$ ]] || hold "finalized payer balance output is invalid"
  (( PAYER_LAMPORTS >= UPLOAD_FEE_HEADROOM_LAMPORTS )) || hold "Devnet payer is below the exact upload fee-headroom floor"
}

validate_partial() {
  "$NODE_BIN" --input-type=module -e '
    const chunks=[]; for await (const c of process.stdin) chunks.push(c); const v=JSON.parse(Buffer.concat(chunks)); const a=process.argv.slice(1);
    if (a.length !== 13) throw new Error("partial-state argument map drifted");
    const [buffer,authority,owner,genesis,lamports,accountBytes,metadataBytes,programBytes,partialHash,prefix,remaining,minSlot,targetHash]=a;
    const ok=v.schema==="iat-v2-devnet-buffer-finalized-reconciliation/v1" && v.status==="HOLD_PARTIAL_EXACT_PREFIX_ZERO_TAIL" && v.network==="devnet" && v.genesisHash===genesis && v.commitment==="finalized" && v.bufferAddress===buffer && v.expectedAuthority===authority && v.observedAuthority===authority && v.account?.owner===owner && v.account.executable===false && v.account.lamports===lamports && `${v.account.dataBytes}`===accountBytes && `${v.account.metadataBytes}`===metadataBytes && v.account.stateTag===1 && v.account.authorityOption===1 && `${v.account.programBytes}`===programBytes && v.account.programSha256===partialHash && Number.isSafeInteger(v.minContextSlot) && v.minContextSlot>=Number(minSlot) && Number.isSafeInteger(v.accountContextSlot) && v.accountContextSlot>=v.minContextSlot && v.publicCiArtifact?.sha256===targetHash && `${v.publicCiArtifact?.bytes}`===programBytes && v.comparison?.classification==="PARTIAL_EXACT_PREFIX_ZERO_TAIL" && v.comparison.exact===false && `${v.comparison.matchingPrefixBytes}`===prefix && `${v.comparison.expectedRemainingBytes}`===remaining && v.comparison.observedSuffixIsZero===true && `${v.comparison.firstMismatchOffset}`===prefix && v.comparison.firstMismatchObservedByte===0 && v.validation?.partialExactPrefixZeroTail===true && v.validation.exact===false && JSON.stringify(v.validation.holdReasons)==="[\"PROGRAM_SHA256_MISMATCH\"]" && v.boundary?.mutationAuthorized===false && v.boundary.signing===false && v.boundary.broadcast===false && v.boundary.protectedRecoveryStateRead===false && /^[0-9a-f]{64}$/.test(v.evidenceBodySha256);
    if (!ok) throw new Error("finalized partial prestate drifted");
    process.stdout.write(`${v.minContextSlot}\n${v.accountContextSlot}\n${v.evidenceBodySha256}\n`);
  ' -- "$BUFFER_ADDRESS" "$EXPECTED_AUTHORITY" "$EXPECTED_OWNER" "$EXPECTED_GENESIS" "$EXPECTED_BUFFER_LAMPORTS" "$EXPECTED_ACCOUNT_BYTES" "$EXPECTED_METADATA_BYTES" "$EXPECTED_PROGRAM_BYTES" "$EXPECTED_PARTIAL_HASH" "$EXPECTED_PREFIX_BYTES" "$EXPECTED_REMAINING_BYTES" "$MIN_FINALIZED_SLOT" "$TARGET_ARTIFACT_SHA256"
}

observe_partial() {
  local output status validated
  set +e
  output="$("$NODE_BIN" "$RECONCILER" --buffer "$BUFFER_ADDRESS" --expected-authority "$EXPECTED_AUTHORITY")"
  status=$?
  set -e
  (( status == 2 )) || hold "signer-free reconciler did not return the exact partial HOLD state"
  validated="$(printf '%s' "$output" | validate_partial)" || hold "finalized partial prestate validation failed"
  mapfile -t PARTIAL_FIELDS <<<"$validated"
  (( ${#PARTIAL_FIELDS[@]} == 3 )) || hold "partial prestate validation output was incomplete"
  PARTIAL_RECORD="$output"
}

capture_post_reconciliation() {
  "$NODE_BIN" --input-type=module -e '
    import { spawnSync } from "node:child_process";
    import { writeFileSync } from "node:fs";
    const a=process.argv.slice(1); if (a.length!==7) throw new Error("poststate capture argument map drifted");
    const [node,reconciler,buffer,authority,stdoutPath,stderrPath,resultPath]=a;
    const result=spawnSync(node,[reconciler,"--buffer",buffer,"--expected-authority",authority],{
      encoding:null,
      maxBuffer:4*1024*1024,
      windowsHide:true,
      env:{HOME:"/nonexistent/iat-v2-keyless-poststate-home",XDG_CONFIG_HOME:"/nonexistent/iat-v2-keyless-poststate-config",LANG:"C.UTF-8",LC_ALL:"C.UTF-8",PATH:"/usr/bin:/bin"},
    });
    const stdout=Buffer.isBuffer(result.stdout)?result.stdout:Buffer.alloc(0);
    const stderr=Buffer.isBuffer(result.stderr)?result.stderr:Buffer.from(result.error?.message??"","utf8");
    writeFileSync(stdoutPath,stdout,{flag:"wx",mode:0o600,flush:true});
    writeFileSync(stderrPath,stderr,{flag:"wx",mode:0o600,flush:true});
    writeFileSync(resultPath,`${JSON.stringify({schema:"iat-v2-devnet-buffer-in-place-poststate-capture/v1",exitStatus:result.status,signal:result.signal,error:result.error?.message??null})}\n`,{flag:"wx",mode:0o600,flush:true});
  ' -- "$NODE_BIN" "$RECONCILER" "$BUFFER_ADDRESS" "$EXPECTED_AUTHORITY" \
    "$ATTEMPT_DIR/poststate.json" "$ATTEMPT_DIR/poststate-stderr.txt" "$ATTEMPT_DIR/poststate-result.json"
}

write_manifest() {
  local destination="$1" prestate_hash="$2" min_slot="$3" account_slot="$4" payer_lamports="$5"
  "$NODE_BIN" --input-type=module -e '
    import { writeFileSync } from "node:fs";
    const a=process.argv.slice(1); if (a.length!==11) throw new Error("manifest argument map drifted");
    const [path,buffer,authority,currentHash,prefix,targetHash,targetBytes,minSlot,accountSlot,prestateHash,payerLamports]=a;
    const record={schema:"iat-v2-devnet-buffer-in-place-recovery-reservation/v1",phase:"RESERVED_BEFORE_SOLE_WRITE_INVOCATION",network:"devnet",mainnetStatus:"HOLD",bufferAddress:buffer,expectedAuthority:authority,protectedBufferKeypairUsed:false,newBufferCreated:false,currentProgramSha256:currentHash,matchingPrefixBytes:Number(prefix),targetArtifactSha256:targetHash,targetArtifactBytes:Number(targetBytes),finalizedPrestate:{minContextSlot:Number(minSlot),accountContextSlot:Number(accountSlot),evidenceBodySha256:prestateHash},payerLamports,mutationPolicy:{cliInvocations:1,maxSignAttempts:5,doNotRerunAfterAmbiguity:true},authorityHandoff:false,deployment:false};
    writeFileSync(path, `${JSON.stringify(record,null,2)}\n`, {flag:"wx",mode:0o600,flush:true});
  ' -- "$destination" "$BUFFER_ADDRESS" "$EXPECTED_AUTHORITY" "$EXPECTED_PARTIAL_HASH" "$EXPECTED_PREFIX_BYTES" "$TARGET_ARTIFACT_SHA256" "$TARGET_ARTIFACT_BYTES" "$min_slot" "$account_slot" "$prestate_hash" "$payer_lamports" \
    || hold "one-use recovery manifest could not be written"
}

write_boundary_marker() {
  "$NODE_BIN" --input-type=module -e '
    import { writeFileSync } from "node:fs";
    const a=process.argv.slice(1); if(a.length!==8) throw new Error("boundary marker argument map drifted");
    const [path,buffer,prestate,minSlot,accountSlot,currentHash,target,targetBytes]=a;
    writeFileSync(path, `${JSON.stringify({schema:"iat-v2-devnet-buffer-in-place-mutation-boundary/v1",phase:"MUTATION_BOUNDARY_ENTERED",network:"devnet",mainnetStatus:"HOLD",bufferAddress:buffer,markerBoundFinalizedPrestate:{minContextSlot:Number(minSlot),accountContextSlot:Number(accountSlot),evidenceBodySha256:prestate,programSha256:currentHash},targetArtifactSha256:target,targetArtifactBytes:Number(targetBytes),mayHaveInvoked:true,doNotRerun:true},null,2)}\n`, {flag:"wx",mode:0o600,flush:true});
  ' -- "$ATTEMPT_DIR/mutation-boundary-entered.json" "$BUFFER_ADDRESS" "$MUTATION_PRESTATE_HASH" "$MUTATION_PRESTATE_MIN_SLOT" "$MUTATION_PRESTATE_ACCOUNT_SLOT" "$EXPECTED_PARTIAL_HASH" "$TARGET_ARTIFACT_SHA256" "$TARGET_ARTIFACT_BYTES" \
    || hold "mutation boundary marker could not be persisted; no mutation was invoked"
  fsync_paths "$ATTEMPT_DIR/mutation-boundary-entered.json" "$ATTEMPT_DIR" "$RECOVERY_ROOT" "$RECOVERY_PARENT"
}

cleanup() {
  exec 8>&- 8<&- 9<&- 11<&- 2>/dev/null || true
  if [[ "${BOUNDARY_ENTERED:-false}" == "true" ]]; then
    echo "HOLD: the one-use mutation boundary was entered. DO NOT RERUN; use signer-free finalized reconciliation only." >&2
  fi
}
trap cleanup EXIT

verify_node
verify_git
verify_committed_source
verify_binding
verify_solana
iat_v2_verify_devnet_genesis "$SOLANA_BIN"
[[ "$IAT_V2_VERIFIED_DEVNET_GENESIS_HASH" == "$EXPECTED_GENESIS" ]] || hold "Devnet genesis pin drifted"
observe_payer_floor
observe_partial
INITIAL_ACCOUNT_SLOT="${PARTIAL_FIELDS[1]}"

echo "DEVNET ONLY // EXISTING BUFFER IN-PLACE RECOVERY"
echo "BUFFER: $BUFFER_ADDRESS"
echo "AUTHORITY/PAYER: $EXPECTED_AUTHORITY"
echo "FINALIZED PARTIAL HASH: $EXPECTED_PARTIAL_HASH"
echo "MATCHING PREFIX: $EXPECTED_PREFIX_BYTES / $EXPECTED_PROGRAM_BYTES bytes"
echo "TARGET HASH: $TARGET_ARTIFACT_SHA256"
echo "MUTATION: one Agave 3.1.10 write-buffer CLI invocation against the literal public address."
echo "RETRY DISCLOSURE: --max-sign-attempts 5 may sign/send multiple remaining Devnet chunk transactions."
echo "The CLI may construct an unused ephemeral object in memory; no buffer signer file is read, created, reserved, or passed."
echo "No account creation, close, authority handoff, deployment, release, or Mainnet action is in this helper."
echo "Any timeout, crash, error, or unclear output after the boundary permanently consumes this recovery CAS."

exec 8<>/dev/tty || hold "an attended controlling terminal is required; piped stdin is rejected"
printf '%s' "Type $CONFIRMATION_PHRASE exactly: " >&8
IFS= read -r confirmation <&8 || hold "attended confirmation was unavailable"
exec 8>&- 8<&-
[[ "$confirmation" == "$CONFIRMATION_PHRASE" ]] || hold "confirmation did not match; no mutation was invoked"

verify_node
verify_git
verify_committed_source
verify_binding
verify_solana
iat_v2_verify_devnet_genesis "$SOLANA_BIN"
[[ "$IAT_V2_VERIFIED_DEVNET_GENESIS_HASH" == "$EXPECTED_GENESIS" ]] || hold "Devnet genesis changed after confirmation"
observe_payer_floor
observe_partial
(( PARTIAL_FIELDS[1] >= INITIAL_ACCOUNT_SLOT )) || hold "finalized prestate context moved backwards"
CONFIRMED_ACCOUNT_SLOT="${PARTIAL_FIELDS[1]}"

exact_private_directory "$RECOVERY_PARENT"
if [[ ! -e "$RECOVERY_ROOT" && ! -L "$RECOVERY_ROOT" ]]; then /usr/bin/mkdir -m 700 -- "$RECOVERY_ROOT"; fi
exact_private_directory "$RECOVERY_ROOT"
[[ -z "$(/usr/bin/find "$RECOVERY_ROOT" -mindepth 1 -maxdepth 1 -print -quit)" ]] || hold "in-place recovery root is not empty; preserve it for review"
/usr/bin/mkdir -m 700 -- "$ATTEMPT_DIR" || hold "persistent one-use CAS already exists; DO NOT RERUN"
exact_private_directory "$ATTEMPT_DIR"
fsync_paths "$ATTEMPT_DIR" "$RECOVERY_ROOT" "$RECOVERY_PARENT"
printf '%s\n' "$BINDING_RECORD" | write_exclusive_stdin "$ATTEMPT_DIR/binding-verification.json"
printf '%s\n' "$PARTIAL_RECORD" | write_exclusive_stdin "$ATTEMPT_DIR/prestate.json"
snapshot_artifact "$ATTEMPT_DIR/reviewed-iat_v2.so"
fsync_paths "$ATTEMPT_DIR/binding-verification.json" "$ATTEMPT_DIR/prestate.json" "$ATTEMPT_DIR/reviewed-iat_v2.so" "$ATTEMPT_DIR" "$RECOVERY_ROOT" "$RECOVERY_PARENT"

open_private_payer
exec 11< "$ATTEMPT_DIR/reviewed-iat_v2.so"
assert_artifact_fd 9<&-
[[ "$(iat_v2_run_keyless_solana "$SOLANA_BIN" address -k /proc/self/fd/9 11<&-)" == "$EXPECTED_AUTHORITY" ]] || hold "open Devnet payer does not match the exact authority"

# From this point every non-signing child explicitly closes both protected
# descriptors. This is the final reauthentication and finalized observation;
# no further mutable setup or chain observation may occur before the marker.
verify_node 9<&- 11<&-
verify_git 9<&- 11<&-
verify_committed_source 9<&- 11<&-
verify_binding 9<&- 11<&-
verify_solana 9<&- 11<&-
iat_v2_verify_devnet_genesis "$SOLANA_BIN" 9<&- 11<&-
[[ "$IAT_V2_VERIFIED_DEVNET_GENESIS_HASH" == "$EXPECTED_GENESIS" ]] || hold "Devnet genesis changed at the mutation boundary"
observe_payer_floor 9<&- 11<&-
observe_partial 9<&- 11<&-
(( PARTIAL_FIELDS[1] >= CONFIRMED_ACCOUNT_SLOT )) || hold "marker-bound finalized prestate context moved backwards"
MUTATION_PRESTATE_MIN_SLOT="${PARTIAL_FIELDS[0]}"
MUTATION_PRESTATE_ACCOUNT_SLOT="${PARTIAL_FIELDS[1]}"
MUTATION_PRESTATE_HASH="${PARTIAL_FIELDS[2]}"
write_exclusive_stdin "$ATTEMPT_DIR/mutation-prestate.json" 9<&- 11<&- <<<"$PARTIAL_RECORD"
write_exclusive_stdin "$ATTEMPT_DIR/binding-verification-final.json" 9<&- 11<&- <<<"$BINDING_RECORD"
write_manifest "$ATTEMPT_DIR/reservation-manifest.json" "$MUTATION_PRESTATE_HASH" "$MUTATION_PRESTATE_MIN_SLOT" "$MUTATION_PRESTATE_ACCOUNT_SLOT" "$PAYER_LAMPORTS" 9<&- 11<&-
fsync_paths "$ATTEMPT_DIR/mutation-prestate.json" "$ATTEMPT_DIR/binding-verification-final.json" "$ATTEMPT_DIR/reservation-manifest.json" "$ATTEMPT_DIR" "$RECOVERY_ROOT" "$RECOVERY_PARENT" 9<&- 11<&-
assert_artifact_fd 9<&-
reverify_private_payer_fd 11<&-
[[ "$(iat_v2_run_keyless_solana "$SOLANA_BIN" address -k /proc/self/fd/9 11<&-)" == "$EXPECTED_AUTHORITY" ]] || hold "open Devnet payer changed at the mutation boundary"
write_boundary_marker 9<&- 11<&-
BOUNDARY_ENTERED=true

set +e
write_output="$(iat_v2_run_keyless_solana_timeout 900 "$SOLANA_BIN" program write-buffer /proc/self/fd/11 --buffer 564XrjVAyqXrChSe9sDJ68XFtNL7tVVLYdwFc9mh1GHH --buffer-authority /proc/self/fd/9 --fee-payer /proc/self/fd/9 --keypair /proc/self/fd/9 --url devnet --commitment finalized --use-rpc --with-compute-unit-price 1000 --max-sign-attempts 5 2>&1)"
write_status=$?
set -e
exec 9<&- 11<&-
printf '%s\n' "$write_output" | write_exclusive_stdin "$ATTEMPT_DIR/write-output.txt"
printf '{"schema":"iat-v2-devnet-buffer-in-place-write-result/v1","exitStatus":%s,"doNotRerun":true}\n' "$write_status" | write_exclusive_stdin "$ATTEMPT_DIR/write-result.json"
fsync_paths "$ATTEMPT_DIR/write-output.txt" "$ATTEMPT_DIR/write-result.json" "$ATTEMPT_DIR" "$RECOVERY_ROOT" "$RECOVERY_PARENT"

# The mutation result is untrusted until the exact runtime, committed closure,
# S->B binding, CLI, and Devnet identity are authenticated again.
verify_node
verify_git
verify_committed_source
verify_binding
verify_solana
iat_v2_verify_devnet_genesis "$SOLANA_BIN"
[[ "$IAT_V2_VERIFIED_DEVNET_GENESIS_HASH" == "$EXPECTED_GENESIS" ]] || hold "Devnet genesis changed before poststate capture; DO NOT RERUN"
capture_post_reconciliation
fsync_paths "$ATTEMPT_DIR/poststate.json" "$ATTEMPT_DIR/poststate-stderr.txt" "$ATTEMPT_DIR/poststate-result.json" "$ATTEMPT_DIR" "$RECOVERY_ROOT" "$RECOVERY_PARENT"
"$NODE_BIN" --input-type=module -e '
  import { closeSync, constants, fstatSync, lstatSync, openSync, readFileSync } from "node:fs";
  const p=process.argv[1], before=lstatSync(p,{bigint:true});
  if(!before.isFile()||before.isSymbolicLink()||before.nlink!==1n||before.uid!==1000n||(before.mode&0o777n)!==0o600n) throw new Error("unsafe poststate result");
  const fd=openSync(p,constants.O_RDONLY|constants.O_NOFOLLOW);
  try { const opened=fstatSync(fd,{bigint:true}); if(opened.dev!==before.dev||opened.ino!==before.ino) throw new Error("poststate result changed");
    const v=JSON.parse(readFileSync(fd,"utf8")); if(v.schema!=="iat-v2-devnet-buffer-in-place-poststate-capture/v1"||v.exitStatus!==0||v.signal!==null||v.error!==null) throw new Error("poststate command failed");
  } finally { closeSync(fd); }
' -- "$ATTEMPT_DIR/poststate-result.json" || hold "post-write finalized reconciliation failed; DO NOT RERUN"
post_record="$("$NODE_BIN" --input-type=module -e '
  import { closeSync, constants, fstatSync, lstatSync, openSync, readFileSync } from "node:fs";
  const p=process.argv[1], before=lstatSync(p,{bigint:true});
  if(!before.isFile()||before.isSymbolicLink()||before.nlink!==1n||before.uid!==1000n||(before.mode&0o777n)!==0o600n) throw new Error("unsafe poststate");
  const fd=openSync(p,constants.O_RDONLY|constants.O_NOFOLLOW);
  try { const opened=fstatSync(fd,{bigint:true}); if(opened.dev!==before.dev||opened.ino!==before.ino) throw new Error("poststate changed"); process.stdout.write(readFileSync(fd,"utf8")); }
  finally { closeSync(fd); }
' -- "$ATTEMPT_DIR/poststate.json")" || hold "durable poststate could not be read; DO NOT RERUN"
printf '%s' "$post_record" | "$NODE_BIN" --input-type=module -e '
  import { createHash } from "node:crypto";
  const chunks=[]; for await (const c of process.stdin) chunks.push(c); const v=JSON.parse(Buffer.concat(chunks));
  const a=process.argv.slice(1); if(a.length!==18) throw new Error("poststate argument map drifted");
  const [buffer,authority,owner,genesis,lamports,accountBytes,metadataBytes,target,bytes,minSlot,preMinSlot,preAccountSlot,latestMinSlot,latestAccountSlot,sourceHead,ciRunId,evidenceHash,rpc]=a;
  const exactKeys=(value,keys)=>JSON.stringify(Object.keys(value??{}))===JSON.stringify(keys);
  const monotonic=Number.isSafeInteger(v.minContextSlot) && Number.isSafeInteger(v.accountContextSlot)
    && v.minContextSlot >= Number(minSlot) && v.minContextSlot >= Number(preMinSlot)
    && v.accountContextSlot >= v.minContextSlot && v.accountContextSlot >= Number(preAccountSlot)
    && Number(preMinSlot)===Number(latestMinSlot) && Number(preAccountSlot)===Number(latestAccountSlot);
  const comparison=v.comparison, validation=v.validation, boundary=v.boundary, account=v.account, artifact=v.publicCiArtifact;
  const exact=v.schema==="iat-v2-devnet-buffer-finalized-reconciliation/v1" && v.status==="EXACT_FINALIZED_BUFFER"
    && v.network==="devnet" && v.rpc===rpc && v.genesisHash===genesis && v.commitment==="finalized"
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v.observedAtUtc) && monotonic
    && v.bufferAddress===buffer && v.expectedAuthority===authority && v.observedAuthority===authority && v.observedAuthorityRole==="DEVNET_DEPLOYER"
    && account?.owner===owner && account.executable===false && account.lamports===lamports && `${account.dataBytes}`===accountBytes
    && `${account.metadataBytes}`===metadataBytes && account.stateTag===1 && account.authorityOption===1
    && `${account.programBytes}`===bytes && account.programSha256===target
    && `${artifact?.bytes}`===bytes && artifact.sha256===target && artifact.sourceHeadCommit===sourceHead
    && `${artifact.ciRunId}`===ciRunId && artifact.evidenceManifestSha256===evidenceHash
    && comparison?.classification==="EXACT_ARTIFACT" && comparison.exact===true && `${comparison.matchingPrefixBytes}`===bytes
    && comparison.expectedRemainingBytes===0 && comparison.observedSuffixIsZero===true
    && Number.isSafeInteger(comparison.trailingZeroBytes) && comparison.trailingZeroBytes>=0 && comparison.trailingZeroBytes<=Number(bytes)
    && comparison.firstMismatchOffset===null && comparison.firstMismatchExpectedByte===null && comparison.firstMismatchObservedByte===null
    && `${comparison.observedProgramBytes}`===bytes && comparison.observedProgramSha256===target
    && validation?.authorityAdmitted===true && validation.authorityMatchesExpected===true && validation.sizeMatches===true
    && validation.hashMatches===true && validation.exact===true && validation.partialExactPrefixZeroTail===false
    && JSON.stringify(validation.holdReasons) === "[]"
    && boundary?.mutationAuthorized===false && boundary.signing===false && boundary.broadcast===false
    && boundary.protectedRecoveryStateRead===false && boundary.next==="SEPARATE_ATTENDED_ACTION_REVIEW_REQUIRED";
  const rootKeys=["schema","status","network","rpc","genesisHash","commitment","minContextSlot","accountContextSlot","observedAtUtc","bufferAddress","expectedAuthority","observedAuthority","observedAuthorityRole","account","publicCiArtifact","comparison","validation","boundary","evidenceBodySha256"];
  const shapes=exactKeys(v,rootKeys)
    && exactKeys(account,["owner","executable","lamports","dataBytes","metadataBytes","stateTag","authorityOption","programBytes","programSha256"])
    && exactKeys(artifact,["bytes","sha256","sourceHeadCommit","ciRunId","evidenceManifestSha256"])
    && exactKeys(comparison,["classification","exact","matchingPrefixBytes","expectedRemainingBytes","observedSuffixIsZero","trailingZeroBytes","firstMismatchOffset","firstMismatchExpectedByte","firstMismatchObservedByte","observedProgramBytes","observedProgramSha256"])
    && exactKeys(validation,["authorityAdmitted","authorityMatchesExpected","sizeMatches","hashMatches","exact","partialExactPrefixZeroTail","holdReasons"])
    && exactKeys(boundary,["mutationAuthorized","signing","broadcast","protectedRecoveryStateRead","next"]);
  const {evidenceBodySha256,...body}=v;
  const recomputed=createHash("sha256").update(Buffer.from(`${JSON.stringify(body,null,2)}\n`,"utf8")).digest("hex");
  if(!exact || !shapes || !/^[0-9a-f]{64}$/.test(evidenceBodySha256) || recomputed!==evidenceBodySha256) throw new Error("poststate is not the exact monotonic finalized target");
' -- "$BUFFER_ADDRESS" "$EXPECTED_AUTHORITY" "$EXPECTED_OWNER" "$EXPECTED_GENESIS" "$EXPECTED_BUFFER_LAMPORTS" "$EXPECTED_ACCOUNT_BYTES" "$EXPECTED_METADATA_BYTES" "$TARGET_ARTIFACT_SHA256" "$TARGET_ARTIFACT_BYTES" "$MIN_FINALIZED_SLOT" "$MUTATION_PRESTATE_MIN_SLOT" "$MUTATION_PRESTATE_ACCOUNT_SLOT" "${PARTIAL_FIELDS[0]}" "${PARTIAL_FIELDS[1]}" "$TARGET_SOURCE_HEAD" "$TARGET_CI_RUN_ID" "$TARGET_EVIDENCE_SHA256" 'https://api.devnet.solana.com' \
  || hold "post-write finalized target validation failed; DO NOT RERUN"

BOUNDARY_ENTERED=false
trap - EXIT
echo "EXACT FINALIZED DEVNET BUFFER RECOVERY VERIFIED"
echo "BUFFER: $BUFFER_ADDRESS"
echo "TARGET: $TARGET_ARTIFACT_SHA256 / $TARGET_ARTIFACT_BYTES bytes"
echo "NEXT: separate attended review only; no authority handoff or deployment ran."
