#!/usr/bin/bash
set -euo pipefail
set +x
umask 077

hold() { echo "HOLD: $*" >&2; exit 1; }

(( $# <= 1 )) || hold "unexpected rebuild arguments"
REBUILD_MODE="${1:-fresh}"
[[ "$REBUILD_MODE" == "fresh" || "$REBUILD_MODE" == "recover-pre-address" ]] \
  || hold "unsupported rebuild mode"

[[ "${IAT_V2_CLEAN_ENVIRONMENT:-}" == "iat-v2-devnet-buffer-v1" ]] \
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
source "$SCRIPT_DIR/lib/iat-v2-attended-solana-toolchain.sh"

NODE_BIN="$IAT_V2_EXPECTED_NODE_PATH"
GIT_BIN="$IAT_V2_EXPECTED_GIT_PATH"
SOLANA_BIN="$IAT_V2_EXPECTED_SOLANA_CLI_PATH"
SOLANA_KEYGEN_BIN="$IAT_V2_EXPECTED_SOLANA_KEYGEN_PATH"
PAYER_KEYPAIR="/home/a/.config/solana/iat-v2-devnet-deployer.json"
ARTIFACT="$SITE_ROOT/target/verifiable/iat_v2.so"
EVIDENCE="$SITE_ROOT/target/verifiable/iat-v2-build-evidence.json"
RUNTIME_EVIDENCE="$SITE_ROOT/target/verifiable/iat-v2-recovery-runtime-build-evidence.json"
OLD_BUFFER="Aarejf4n2vwDya7AuVVw2C21PPeoYHb1e8Rw3ukpi3L6"
EXPECTED_PAYER="DYURSZnNLak5YNt2vLJUnU5iWDUbAo53oUfzZ8dVc5d4"
NEW_AUTHORITY="7XZjd7aNNci63LZy9syqgjvjNHvkQ83Uwo7cyynrfzPH"
RECOVERY_PARENT="/home/a/.local/state/internal-agency/iat-v2"
RECOVERY_ROOT="$RECOVERY_PARENT/devnet-buffer-rebuild-v1"
DEVNET_UPLOAD_FEE_HEADROOM_LAMPORTS="100000000"

if [[ "$REBUILD_MODE" == "fresh" \
    && ( -e "$RECOVERY_ROOT/attempt-one-use" || -L "$RECOVERY_ROOT/attempt-one-use" ) ]]; then
  hold "the persistent one-use rebuild reservation already exists; use only the separately reviewed recovery entrypoint"
fi

verify_node() {
  iat_v2_verify_exact_tool "$NODE_BIN" "$IAT_V2_EXPECTED_NODE_PATH" "$IAT_V2_EXPECTED_NODE_VERSION" \
    "$IAT_V2_EXPECTED_NODE_SHA256" "$IAT_V2_EXPECTED_NODE_BYTES" "Node.js runtime"
  NODE_BIN="$IAT_V2_VERIFIED_TOOL_PATH"; NODE_VERSION="$IAT_V2_VERIFIED_TOOL_VERSION"
  NODE_SHA256="$IAT_V2_VERIFIED_TOOL_SHA256"; NODE_BYTES="$IAT_V2_VERIFIED_TOOL_BYTES"
}

verify_git() {
  iat_v2_verify_exact_git
  GIT_BIN="$IAT_V2_VERIFIED_TOOL_PATH"; GIT_VERSION="$IAT_V2_VERIFIED_TOOL_VERSION"
  GIT_SHA256="$IAT_V2_VERIFIED_TOOL_SHA256"; GIT_BYTES="$IAT_V2_VERIFIED_TOOL_BYTES"
}

verify_solana() {
  iat_v2_verify_exact_tool "$SOLANA_BIN" "$IAT_V2_EXPECTED_SOLANA_CLI_PATH" "$IAT_V2_EXPECTED_SOLANA_CLI_VERSION" \
    "$IAT_V2_EXPECTED_SOLANA_CLI_SHA256" "$IAT_V2_EXPECTED_SOLANA_CLI_BYTES" "Solana CLI"
  SOLANA_BIN="$IAT_V2_VERIFIED_TOOL_PATH"; SOLANA_CLI_VERSION="$IAT_V2_VERIFIED_TOOL_VERSION"
  SOLANA_CLI_SHA256="$IAT_V2_VERIFIED_TOOL_SHA256"; SOLANA_CLI_BYTES="$IAT_V2_VERIFIED_TOOL_BYTES"
}

verify_keygen() {
  iat_v2_verify_exact_tool "$SOLANA_KEYGEN_BIN" "$IAT_V2_EXPECTED_SOLANA_KEYGEN_PATH" "$IAT_V2_EXPECTED_SOLANA_KEYGEN_VERSION" \
    "$IAT_V2_EXPECTED_SOLANA_KEYGEN_SHA256" "$IAT_V2_EXPECTED_SOLANA_KEYGEN_BYTES" "Solana key generator"
  SOLANA_KEYGEN_BIN="$IAT_V2_VERIFIED_TOOL_PATH"; SOLANA_KEYGEN_VERSION="$IAT_V2_VERIFIED_TOOL_VERSION"
  SOLANA_KEYGEN_SHA256="$IAT_V2_VERIFIED_TOOL_SHA256"; SOLANA_KEYGEN_BYTES="$IAT_V2_VERIFIED_TOOL_BYTES"
}

exact_private_directory() {
  local path="$1"
  [[ -d "$path" && ! -L "$path" ]] || hold "$path is not an exact private directory"
  [[ "$(/usr/bin/readlink -f -- "$path")" == "$path" ]] || hold "$path resolves through a symlink"
  [[ "$(/usr/bin/stat -c '%a' -- "$path")" == "700" ]] || hold "$path is not exact mode 0700"
  [[ "$(/usr/bin/stat -c '%u' -- "$path")" == "$(/usr/bin/id -u)" ]] || hold "$path owner drifted"
}

fsync_recovery_paths() {
  "$NODE_BIN" --input-type=module -e '
    import { closeSync, constants, fstatSync, fsyncSync, lstatSync, openSync } from "node:fs";
    const paths = process.argv.slice(1);
    if (paths.length === 0) throw new Error("at least one recovery path is required");
    for (const path of paths) {
      const before = lstatSync(path, { bigint: true });
      const directory = before.isDirectory();
      if (!directory && !before.isFile()) throw new Error(`${path} is not a regular file or directory`);
      if (before.uid !== 1000n) throw new Error(`${path} owner drifted`);
      const expectedMode = directory ? 0o700n : 0o600n;
      if ((before.mode & 0o777n) !== expectedMode) throw new Error(`${path} mode drifted`);
      if (!directory && before.nlink !== 1n) throw new Error(`${path} must be single-linked`);
      const flags = constants.O_RDONLY | constants.O_NOFOLLOW | (directory ? constants.O_DIRECTORY : 0);
      const descriptor = openSync(path, flags);
      try {
        const opened = fstatSync(descriptor, { bigint: true });
        const current = lstatSync(path, { bigint: true });
        if (opened.dev !== before.dev || opened.ino !== before.ino || current.dev !== before.dev || current.ino !== before.ino) {
          throw new Error(`${path} identity changed before durability barrier`);
        }
        fsyncSync(descriptor);
        const durable = fstatSync(descriptor, { bigint: true });
        const after = lstatSync(path, { bigint: true });
        if (durable.dev !== before.dev || durable.ino !== before.ino || after.dev !== before.dev || after.ino !== before.ino) {
          throw new Error(`${path} identity changed during durability barrier`);
        }
      } finally { closeSync(descriptor); }
    }
  ' -- "$@" || hold "protected recovery state could not be made crash-durable"
}

snapshot_reviewed_artifact() {
  local source="$1" destination="$2" expected_hash="$3" expected_bytes="$4"
  /usr/bin/env -i \
    HOME=/home/a \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    PATH=/usr/bin:/bin \
    "$NODE_BIN" --input-type=module -e '
      import { createHash } from "node:crypto";
      import { closeSync, constants, fstatSync, fsyncSync, lstatSync, openSync, readSync, writeSync } from "node:fs";
      const [source, destination, expectedHash, expectedBytes] = process.argv.slice(1);
      const before = lstatSync(source, { bigint: true });
      if (!before.isFile() || before.isSymbolicLink()) throw new Error("reviewed artifact source is not a regular non-symlink file");
      const sourceFd = openSync(source, constants.O_RDONLY | constants.O_NOFOLLOW);
      let destinationFd;
      try {
        const opened = fstatSync(sourceFd, { bigint: true });
        if (opened.dev !== before.dev || opened.ino !== before.ino) throw new Error("reviewed artifact identity changed while opening");
        destinationFd = openSync(destination, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
        const hash = createHash("sha256");
        const buffer = Buffer.allocUnsafe(1024 * 1024);
        let total = 0;
        for (;;) {
          const count = readSync(sourceFd, buffer, 0, buffer.length, null);
          if (count === 0) break;
          hash.update(buffer.subarray(0, count));
          let written = 0;
          while (written < count) written += writeSync(destinationFd, buffer, written, count - written, null);
          total += count;
        }
        const digest = hash.digest("hex");
        const sourceAfter = fstatSync(sourceFd, { bigint: true });
        const pathAfter = lstatSync(source, { bigint: true });
        if (sourceAfter.dev !== before.dev || sourceAfter.ino !== before.ino || pathAfter.dev !== before.dev || pathAfter.ino !== before.ino) {
          throw new Error("reviewed artifact identity changed while snapshotting");
        }
        if (`${total}` !== expectedBytes || digest !== expectedHash) throw new Error("artifact snapshot does not match reviewed bytes");
        fsyncSync(destinationFd);
      } finally {
        if (destinationFd !== undefined) closeSync(destinationFd);
        closeSync(sourceFd);
      }
    ' -- "$source" "$destination" "$expected_hash" "$expected_bytes" \
    || hold "exact reviewed artifact could not be snapshotted into the one-use recovery namespace"
}

write_rebuild_reservation_manifest() {
  local manifest="$1" fresh_buffer="$2"
  /usr/bin/env -i \
    HOME=/home/a \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    PATH=/usr/bin:/bin \
    "$NODE_BIN" --input-type=module -e '
      import { closeSync, constants, fsyncSync, openSync, writeFileSync } from "node:fs";
      const [path, freshBuffer, entryMode, artifactSha256, artifactBytes, evidenceManifestSha256, sourceHeadCommit, sourceHeadTree,
        ciRunId, ciRunAttempt, runtimeSourceHeadCommit, runtimeSourceHeadTree, runtimeCheckoutCommit, runtimeCheckoutTree,
        runtimeCheckoutRelation, runtimeBindingSuccessorCommit, runtimeBindingSuccessorTree, runtimeBindingAnchorSha256,
        runtimeClosureSha256, runtimeEvidenceManifestSha256, runtimeArtifactSha256, runtimeArtifactBytes,
        runtimeCiRunId, runtimeCiRunAttempt, runtimeWorkflowRef,
        nodePath, nodeVersion, nodeSha256, nodeBytes, gitPath, gitVersion, gitSha256, gitBytes,
        solanaPath, solanaVersion, solanaSha256, solanaBytes, keygenPath, keygenVersion, keygenSha256, keygenBytes,
        genesisHash, expectedPayer, newAuthority, oldBuffer, feeHeadroomLamports] = process.argv.slice(1);
      const record = {
        schema: "iat-v2-devnet-buffer-rebuild-reservation/v2",
        phase: "RESERVED_BEFORE_UPLOAD",
        entryMode,
        reservedSignerReused: entryMode === "recover-pre-address",
        network: "devnet",
        genesisHash,
        freshBuffer,
        expectedPayer,
        newAuthority,
        oldBuffer,
        oldBufferPolicy: "RETAIN_UNTOUCHED",
        artifactSha256,
        artifactBytes,
        evidenceManifestSha256,
        sourceHeadCommit,
        sourceHeadTree,
        ciRunId,
        ciRunAttempt,
        runtimeBinding: {
          sourceHeadCommit: runtimeSourceHeadCommit,
          sourceHeadTree: runtimeSourceHeadTree,
          checkoutCommit: runtimeCheckoutCommit,
          checkoutTree: runtimeCheckoutTree,
          checkoutRelation: runtimeCheckoutRelation,
          bindingSuccessorCommit: runtimeBindingSuccessorCommit,
          bindingSuccessorTree: runtimeBindingSuccessorTree,
          bindingAnchorSha256: runtimeBindingAnchorSha256,
          runtimeClosureSha256,
          evidenceManifestSha256: runtimeEvidenceManifestSha256,
          artifactSha256: runtimeArtifactSha256,
          artifactBytes: runtimeArtifactBytes,
          ciRunId: runtimeCiRunId,
          ciRunAttempt: runtimeCiRunAttempt,
          workflowRef: runtimeWorkflowRef,
        },
        node: { path: nodePath, version: nodeVersion, sha256: nodeSha256, bytes: nodeBytes },
        git: { path: gitPath, version: gitVersion, sha256: gitSha256, bytes: gitBytes },
        solana: { path: solanaPath, version: solanaVersion, sha256: solanaSha256, bytes: solanaBytes },
        keygen: { path: keygenPath, version: keygenVersion, sha256: keygenSha256, bytes: keygenBytes },
        feePolicy: { uploadHeadroomLamports: feeHeadroomLamports, maxSignAttempts: "5" },
        transactionExecution: false,
        signing: false,
        broadcast: false,
      };
      writeFileSync(path, `${JSON.stringify(record)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
      const descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
      try { fsyncSync(descriptor); } finally { closeSync(descriptor); }
    ' -- "$manifest" "$fresh_buffer" "$REBUILD_MODE" "$EXPECTED_HASH" "$EXPECTED_BYTES" "$EVIDENCE_MANIFEST_SHA256" \
      "$SOURCE_HEAD_COMMIT" "$SOURCE_HEAD_TREE" "$CI_RUN_ID" "$CI_RUN_ATTEMPT" \
      "$RUNTIME_SOURCE_HEAD_COMMIT" "$RUNTIME_SOURCE_HEAD_TREE" "$RUNTIME_CHECKOUT_COMMIT" "$RUNTIME_CHECKOUT_TREE" \
      "$RUNTIME_CHECKOUT_RELATION" "$RUNTIME_BINDING_SUCCESSOR_COMMIT" "$RUNTIME_BINDING_SUCCESSOR_TREE" \
      "$RUNTIME_BINDING_ANCHOR_SHA256" "$RUNTIME_CLOSURE_SHA256" "$RUNTIME_EVIDENCE_MANIFEST_SHA256" \
      "$RUNTIME_ARTIFACT_SHA256" "$RUNTIME_ARTIFACT_BYTES" "$RUNTIME_CI_RUN_ID" "$RUNTIME_CI_RUN_ATTEMPT" "$RUNTIME_WORKFLOW_REF" \
      "$NODE_BIN" "$NODE_VERSION" "$NODE_SHA256" "$NODE_BYTES" "$GIT_BIN" "$GIT_VERSION" "$GIT_SHA256" "$GIT_BYTES" \
      "$SOLANA_BIN" "$SOLANA_CLI_VERSION" "$SOLANA_CLI_SHA256" "$SOLANA_CLI_BYTES" \
      "$SOLANA_KEYGEN_BIN" "$SOLANA_KEYGEN_VERSION" "$SOLANA_KEYGEN_SHA256" "$SOLANA_KEYGEN_BYTES" \
      "$DEVNET_GENESIS_HASH" "$EXPECTED_PAYER" "$NEW_AUTHORITY" "$OLD_BUFFER" "$DEVNET_UPLOAD_FEE_HEADROOM_LAMPORTS" \
    || hold "one-use rebuild reservation manifest could not be written durably"
}

assert_open_private_file_identity() {
  local path="$1" descriptor="$2" label="$3" descriptor_path="/proc/self/fd/$2"
  [[ -f "$path" && ! -L "$path" ]] || hold "$label path is not a regular non-symlink file"
  [[ "$(/usr/bin/readlink -f -- "$path")" == "$path" ]] || hold "$label path is not canonical"
  [[ "$(/usr/bin/stat -Lc '%F' -- "$descriptor_path")" == "regular file" ]] || hold "$label descriptor is not a regular file"
  [[ "$(/usr/bin/stat -Lc '%a' -- "$descriptor_path")" == "600" ]] || hold "$label descriptor is not exact mode 0600"
  [[ "$(/usr/bin/stat -Lc '%u' -- "$descriptor_path")" == "$(/usr/bin/id -u)" ]] || hold "$label descriptor owner drifted"
  [[ "$(/usr/bin/stat -Lc '%h' -- "$descriptor_path")" == "1" ]] || hold "$label descriptor must be single-linked"
  [[ "$(/usr/bin/stat -Lc '%d:%i' -- "$descriptor_path")" == "$(/usr/bin/stat -Lc '%d:%i' -- "$path")" ]] || hold "$label path identity changed"
  [[ ! -L "$path" ]] || hold "$label path became a symlink"
}

open_exact_private_file() {
  local path="$1" descriptor="$2" label="$3"
  [[ -f "$path" && ! -L "$path" ]] || hold "$label is not a regular non-symlink file"
  [[ "$(/usr/bin/readlink -f -- "$path")" == "$path" ]] || hold "$label path is not canonical"
  if [[ "$descriptor" == "9" ]]; then exec 9< "$path"; elif [[ "$descriptor" == "10" ]]; then exec 10< "$path"; elif [[ "$descriptor" == "11" ]]; then exec 11< "$path"; else hold "unsupported private descriptor"; fi
  assert_open_private_file_identity "$path" "$descriptor" "$label"
}

assert_bound_artifact_identity() {
  assert_open_private_file_identity "$artifact_snapshot" 11 "reviewed artifact snapshot"
  local observed_bytes observed_hash
  observed_bytes="$(/usr/bin/stat -Lc '%s' -- /proc/self/fd/11)"
  observed_hash="$(/usr/bin/sha256sum -- /proc/self/fd/11)"; observed_hash="${observed_hash%% *}"
  [[ "$observed_bytes" == "$EXPECTED_BYTES" && "$observed_hash" == "$EXPECTED_HASH" ]] \
    || hold "open reviewed artifact snapshot drifted before upload"
}

observe_finalized_payer_floor() {
  local balance_output
  balance_output="$(iat_v2_run_keyless_solana_timeout 45 "$SOLANA_BIN" balance "$EXPECTED_PAYER" --url devnet --commitment finalized --lamports)" \
    || hold "finalized payer balance was unavailable"
  read -r balance_lamports _ <<<"$balance_output"
  [[ "$balance_lamports" =~ ^[0-9]+$ ]] || hold "unexpected finalized payer balance output"
  (( balance_lamports >= REQUIRED_DEPLOYER_LAMPORTS )) \
    || hold "finalized Devnet payer balance is below the exact rent-plus-upload-headroom policy floor of $REQUIRED_DEPLOYER_LAMPORTS lamports"
}

verify_recovery_runtime_binding_again() {
  local runtime_record
  local -a runtime_fields
  runtime_record="$("$NODE_BIN" scripts/iat-v2-devnet-buffer-preflight.mjs verify-runtime --runtime-evidence "$RUNTIME_EVIDENCE")" \
    || hold "Devnet buffer recovery runtime binding changed after initial verification"
  mapfile -t runtime_fields < <(printf '%s' "$runtime_record" | "$NODE_BIN" -e '
    const chunks=[]; process.stdin.on("data",c=>chunks.push(c)); process.stdin.on("end",()=>{const v=JSON.parse(Buffer.concat(chunks));
    for(const f of ["sourceHeadCommit","sourceHeadTree","checkoutCommit","checkoutTree","checkoutRelation","bindingSuccessorCommit","bindingSuccessorTree","bindingAnchorSha256","runtimeClosureSha256","evidenceManifestSha256","artifactSha256","artifactBytes","ciRunId","ciRunAttempt","workflowRef"]) process.stdout.write(`${v[f]}\n`);});')
  (( ${#runtime_fields[@]} == 15 )) || hold "runtime recheck output was incomplete"
  [[ "${runtime_fields[0]}" == "$RUNTIME_SOURCE_HEAD_COMMIT" \
      && "${runtime_fields[1]}" == "$RUNTIME_SOURCE_HEAD_TREE" \
      && "${runtime_fields[2]}" == "$RUNTIME_CHECKOUT_COMMIT" \
      && "${runtime_fields[3]}" == "$RUNTIME_CHECKOUT_TREE" \
      && "${runtime_fields[4]}" == "$RUNTIME_CHECKOUT_RELATION" \
      && "${runtime_fields[5]}" == "$RUNTIME_BINDING_SUCCESSOR_COMMIT" \
      && "${runtime_fields[6]}" == "$RUNTIME_BINDING_SUCCESSOR_TREE" \
      && "${runtime_fields[7]}" == "$RUNTIME_BINDING_ANCHOR_SHA256" \
      && "${runtime_fields[8]}" == "$RUNTIME_CLOSURE_SHA256" \
      && "${runtime_fields[9]}" == "$RUNTIME_EVIDENCE_MANIFEST_SHA256" \
      && "${runtime_fields[10]}" == "$RUNTIME_ARTIFACT_SHA256" \
      && "${runtime_fields[11]}" == "$RUNTIME_ARTIFACT_BYTES" \
      && "${runtime_fields[12]}" == "$RUNTIME_CI_RUN_ID" \
      && "${runtime_fields[13]}" == "$RUNTIME_CI_RUN_ATTEMPT" \
      && "${runtime_fields[14]}" == "$RUNTIME_WORKFLOW_REF" ]] \
    || hold "Devnet buffer recovery runtime binding identity changed"
}

verify_node; verify_git

binding_diagnostics="$(/usr/bin/mktemp /tmp/iat-v2-binding-diagnostics-XXXXXX.txt)"
set +e
binding_record="$("$NODE_BIN" scripts/iat-v2-devnet-buffer-preflight.mjs verify-recovery --artifact "$ARTIFACT" --evidence "$EVIDENCE" --runtime-evidence "$RUNTIME_EVIDENCE" 2>"$binding_diagnostics")"
binding_status=$?
set -e
if [[ -s "$binding_diagnostics" ]]; then /usr/bin/cat -- "$binding_diagnostics" >&2; fi
/usr/bin/rm -f -- "$binding_diagnostics"
printf '%s\n' "$binding_record"
(( binding_status == 0 )) || hold "migration artifact/evidence binding did not pass; no buffer action was attempted"

mapfile -t binding_fields < <(printf '%s' "$binding_record" | "$NODE_BIN" -e '
  const chunks=[]; process.stdin.on("data",c=>chunks.push(c)); process.stdin.on("end",()=>{const v=JSON.parse(Buffer.concat(chunks));
  for(const f of ["artifactSha256","artifactBytes","evidenceManifestSha256","sourceHeadCommit","sourceHeadTree","ciRunId","ciRunAttempt","gitPath","gitVersion","gitSha256","gitBytes"]) process.stdout.write(`${v[f]}\n`);
  for(const f of ["sourceHeadCommit","sourceHeadTree","checkoutCommit","checkoutTree","checkoutRelation","bindingSuccessorCommit","bindingSuccessorTree","bindingAnchorSha256","runtimeClosureSha256","evidenceManifestSha256","artifactSha256","artifactBytes","ciRunId","ciRunAttempt","workflowRef"]) process.stdout.write(`${v.runtimeBinding?.[f]}\n`);});')
(( ${#binding_fields[@]} == 26 )) || hold "preflight binding output was incomplete"
EXPECTED_HASH="${binding_fields[0]}"; EXPECTED_BYTES="${binding_fields[1]}"; EVIDENCE_MANIFEST_SHA256="${binding_fields[2]}"
SOURCE_HEAD_COMMIT="${binding_fields[3]}"; SOURCE_HEAD_TREE="${binding_fields[4]}"; CI_RUN_ID="${binding_fields[5]}"; CI_RUN_ATTEMPT="${binding_fields[6]}"
PREFLIGHT_GIT_PATH="${binding_fields[7]}"; PREFLIGHT_GIT_VERSION="${binding_fields[8]}"; PREFLIGHT_GIT_SHA256="${binding_fields[9]}"; PREFLIGHT_GIT_BYTES="${binding_fields[10]}"
RUNTIME_SOURCE_HEAD_COMMIT="${binding_fields[11]}"; RUNTIME_SOURCE_HEAD_TREE="${binding_fields[12]}"; RUNTIME_CHECKOUT_COMMIT="${binding_fields[13]}"; RUNTIME_CHECKOUT_TREE="${binding_fields[14]}"; RUNTIME_CHECKOUT_RELATION="${binding_fields[15]}"
RUNTIME_BINDING_SUCCESSOR_COMMIT="${binding_fields[16]}"; RUNTIME_BINDING_SUCCESSOR_TREE="${binding_fields[17]}"; RUNTIME_BINDING_ANCHOR_SHA256="${binding_fields[18]}"; RUNTIME_CLOSURE_SHA256="${binding_fields[19]}"
RUNTIME_EVIDENCE_MANIFEST_SHA256="${binding_fields[20]}"; RUNTIME_ARTIFACT_SHA256="${binding_fields[21]}"; RUNTIME_ARTIFACT_BYTES="${binding_fields[22]}"; RUNTIME_CI_RUN_ID="${binding_fields[23]}"; RUNTIME_CI_RUN_ATTEMPT="${binding_fields[24]}"; RUNTIME_WORKFLOW_REF="${binding_fields[25]}"
[[ "$PREFLIGHT_GIT_PATH" == "$GIT_BIN" && "$PREFLIGHT_GIT_VERSION" == "$GIT_VERSION" && "$PREFLIGHT_GIT_SHA256" == "$GIT_SHA256" && "$PREFLIGHT_GIT_BYTES" == "$GIT_BYTES" ]] \
  || hold "preflight Git identity disagrees with the exact shell runtime"

verify_solana; iat_v2_verify_devnet_genesis "$SOLANA_BIN"
DEVNET_GENESIS_HASH="$IAT_V2_VERIFIED_DEVNET_GENESIS_HASH"
verify_keygen

capacity_record="$("$NODE_BIN" scripts/iat-v2-devnet-buffer-preflight.mjs capacity --artifact-bytes "$EXPECTED_BYTES")"
printf '%s\n' "$capacity_record"
mapfile -t capacity_fields < <(printf '%s' "$capacity_record" | "$NODE_BIN" -e '
  const chunks=[]; process.stdin.on("data",c=>chunks.push(c)); process.stdin.on("end",()=>{const v=JSON.parse(Buffer.concat(chunks));
  for(const f of ["genesisHash","extensionRequired","extensionBytes","bufferRentLamports","deployerLamports","deployerBufferOnlyShortfallLamports"]) process.stdout.write(`${v[f]}\n`);});')
(( ${#capacity_fields[@]} == 6 )) || hold "capacity output was incomplete"
[[ "${capacity_fields[0]}" == "$IAT_V2_EXPECTED_DEVNET_GENESIS_HASH" ]] || hold "capacity observer genesis identity drifted"
EXTENSION_REQUIRED="${capacity_fields[1]}"; EXTENSION_BYTES="${capacity_fields[2]}"; BUFFER_RENT_LAMPORTS="${capacity_fields[3]}"
OBSERVED_DEPLOYER_LAMPORTS="${capacity_fields[4]}"; BUFFER_SHORTFALL_LAMPORTS="${capacity_fields[5]}"
[[ "$EXTENSION_REQUIRED" == "false" ]] || hold "ProgramData still needs the separate attended $EXTENSION_BYTES-byte extension before upload"
[[ "$BUFFER_SHORTFALL_LAMPORTS" == "0" ]] || hold "Devnet deployer is still short $BUFFER_SHORTFALL_LAMPORTS lamports before transaction-fee headroom"
[[ "$BUFFER_RENT_LAMPORTS" =~ ^[0-9]+$ && "$DEVNET_UPLOAD_FEE_HEADROOM_LAMPORTS" =~ ^[0-9]+$ ]] \
  || hold "Devnet upload funding policy is not an exact integer"
REQUIRED_DEPLOYER_LAMPORTS=$((BUFFER_RENT_LAMPORTS + DEVNET_UPLOAD_FEE_HEADROOM_LAMPORTS))
(( OBSERVED_DEPLOYER_LAMPORTS >= REQUIRED_DEPLOYER_LAMPORTS )) \
  || hold "Devnet deployer is below the exact rent-plus-upload-headroom policy floor of $REQUIRED_DEPLOYER_LAMPORTS lamports"

actual_hash="$(/usr/bin/sha256sum -- "$ARTIFACT")"; actual_hash="${actual_hash%% *}"
[[ "$actual_hash" == "$EXPECTED_HASH" ]] || hold "local artifact hash drifted"
[[ "$(/usr/bin/stat -c '%s' -- "$ARTIFACT")" == "$EXPECTED_BYTES" ]] || hold "local artifact byte length drifted"

echo "NETWORK:                    DEVNET ONLY"
echo "DEVNET GENESIS:             $DEVNET_GENESIS_HASH"
echo "OLD BUFFER:                 $OLD_BUFFER"
echo "OLD BUFFER POLICY:          RETAINED; THIS HELPER NEVER CLOSES OR MUTATES IT"
echo "FRESH ARTIFACT SHA-256:     $EXPECTED_HASH"
echo "FRESH ARTIFACT BYTES:       $EXPECTED_BYTES"
echo "EVIDENCE MANIFEST SHA-256:  $EVIDENCE_MANIFEST_SHA256"
echo "SOURCE HEAD / TREE:         $SOURCE_HEAD_COMMIT / $SOURCE_HEAD_TREE"
echo "PUBLIC CI RUN / ATTEMPT:    $CI_RUN_ID / $CI_RUN_ATTEMPT"
echo "RUNTIME SOURCE / TREE:      $RUNTIME_SOURCE_HEAD_COMMIT / $RUNTIME_SOURCE_HEAD_TREE"
echo "RUNTIME CI CHECKOUT / TREE: $RUNTIME_CHECKOUT_COMMIT / $RUNTIME_CHECKOUT_TREE ($RUNTIME_CHECKOUT_RELATION)"
echo "RUNTIME BINDING SUCCESSOR:  $RUNTIME_BINDING_SUCCESSOR_COMMIT"
echo "RUNTIME BINDING ANCHOR:     $RUNTIME_BINDING_ANCHOR_SHA256"
echo "RUNTIME CLOSURE SHA-256:    $RUNTIME_CLOSURE_SHA256"
echo "RUNTIME CI RUN / ATTEMPT:   $RUNTIME_CI_RUN_ID / $RUNTIME_CI_RUN_ATTEMPT"
echo "EXACT BUFFER RENT:          $BUFFER_RENT_LAMPORTS lamports"
echo "UPLOAD FEE HEADROOM POLICY: $DEVNET_UPLOAD_FEE_HEADROOM_LAMPORTS lamports"
echo "REQUIRED DEPLOYER FLOOR:    $REQUIRED_DEPLOYER_LAMPORTS lamports"
echo "FINAL BUFFER AUTHORITY:     $NEW_AUTHORITY (separate helper; not this step)"
echo "OBSERVED DEPLOYER BALANCE:  $OBSERVED_DEPLOYER_LAMPORTS lamports"
echo "NODE:                       $NODE_BIN | $NODE_VERSION | $NODE_SHA256 | $NODE_BYTES bytes"
echo "GIT:                        $GIT_BIN | $GIT_VERSION | $GIT_SHA256 | $GIT_BYTES bytes"
echo "SOLANA:                     $SOLANA_BIN | $SOLANA_CLI_VERSION | $SOLANA_CLI_SHA256 | $SOLANA_CLI_BYTES bytes"
echo "SOLANA KEYGEN:              $SOLANA_KEYGEN_BIN | $SOLANA_KEYGEN_VERSION | $SOLANA_KEYGEN_SHA256 | $SOLANA_KEYGEN_BYTES bytes"
echo "MUTATION BOUNDARY:           one fresh-buffer write CLI invocation; no old-buffer close; no authority handoff"
echo "UPLOAD RETRY DISCLOSURE:     --max-sign-attempts 5 may re-sign/resend unconfirmed chunks across up to five blockhash iterations"
if [[ "$REBUILD_MODE" == "recover-pre-address" ]]; then
  echo "RECOVERY MODE:               SAME RESERVED SIGNER; PRE-ADDRESS FAILURE ONLY; NO NEW KEY OR RESERVATION"
fi

exec 8<>/dev/tty || hold "an attended controlling terminal is required; piped stdin is rejected"
if [[ "$REBUILD_MODE" == "fresh" ]]; then
  expected_confirmation="REBUILD-DEVNET-FRESH"
else
  expected_confirmation="RECOVER-DEVNET-BUFFER-PRE-ADDRESS"
fi
printf '%s' "Type $expected_confirmation exactly on the attended terminal to continue: " >&8
IFS= read -r confirmation <&8 || hold "attended terminal confirmation was unavailable"
exec 8>&- 8<&-
[[ "$confirmation" == "$expected_confirmation" ]] || hold "confirmation did not match; nothing was broadcast"

verify_node; verify_git; verify_recovery_runtime_binding_again
verify_solana; iat_v2_verify_devnet_genesis "$SOLANA_BIN"; verify_keygen
[[ "$IAT_V2_VERIFIED_DEVNET_GENESIS_HASH" == "$DEVNET_GENESIS_HASH" ]] || hold "Devnet genesis changed after confirmation"
open_exact_private_file "$PAYER_KEYPAIR" 9 "Devnet payer keypair"
actual_payer="$(iat_v2_run_keyless_solana "$SOLANA_BIN" address -k /proc/self/fd/9)"
[[ "$actual_payer" == "$EXPECTED_PAYER" ]] || hold "payer address is $actual_payer, expected $EXPECTED_PAYER"

observe_finalized_payer_floor 9<&-
echo "FINALIZED DEVNET PAYER BALANCE: $balance_lamports lamports"
echo "DEVNET UPLOAD FEE HEADROOM:      $((balance_lamports - BUFFER_RENT_LAMPORTS)) lamports"

exact_private_directory "$RECOVERY_PARENT" 9<&-
if [[ "$REBUILD_MODE" == "fresh" && ! -e "$RECOVERY_ROOT" ]]; then /usr/bin/mkdir -m 700 -- "$RECOVERY_ROOT" 9<&-; fi
exact_private_directory "$RECOVERY_ROOT" 9<&-
fsync_recovery_paths "$RECOVERY_ROOT" "$RECOVERY_PARENT" 9<&-
attempt_dir="$RECOVERY_ROOT/attempt-one-use"
if [[ "$REBUILD_MODE" == "fresh" ]]; then
  if ! /usr/bin/mkdir -m 700 -- "$attempt_dir" 9<&-; then
    hold "the persistent one-use rebuild reservation already exists; enter read-only recovery and do not rerun"
  fi
else
  [[ -d "$attempt_dir" && ! -L "$attempt_dir" ]] \
    || hold "the exact existing one-use reservation is unavailable for protected recovery"
fi
unexpected_recovery_entry="$(/usr/bin/find "$RECOVERY_ROOT" -mindepth 1 -maxdepth 1 ! -path "$attempt_dir" -print -quit 9<&-)"
[[ -z "$unexpected_recovery_entry" ]] || hold "unexpected rebuild recovery state requires read-only review; the one-use reservation is retained"
exact_private_directory "$attempt_dir" 9<&-
fsync_recovery_paths "$attempt_dir" "$RECOVERY_ROOT" "$RECOVERY_PARENT" 9<&-
buffer_keypair="$attempt_dir/buffer-keypair.json"
buffer_address_record="$attempt_dir/buffer-address.txt"
artifact_snapshot="$attempt_dir/reviewed-iat_v2.so"
reservation_manifest="$attempt_dir/reservation-manifest.json"
dump_path="$attempt_dir/finalized-buffer.so"
upload_verified=false
dump_created_by_this_run=false
cleanup() {
  exec 9<&- || true; exec 10<&- || true; exec 11<&- || true
  if [[ "$dump_created_by_this_run" == "true" ]]; then /usr/bin/rm -f -- "$dump_path"; fi
  if [[ "$upload_verified" == "true" ]]; then /usr/bin/rm -f -- "$buffer_keypair"; elif [[ -e "$buffer_keypair" ]]; then echo "HOLD: protected recovery signer retained at $buffer_keypair; do not rerun or expose it without a separate reviewed recovery." >&2; fi
}
trap cleanup EXIT

if [[ "$REBUILD_MODE" == "fresh" ]]; then
  snapshot_reviewed_artifact "$ARTIFACT" "$artifact_snapshot" "$EXPECTED_HASH" "$EXPECTED_BYTES" 9<&-
  fsync_recovery_paths "$artifact_snapshot" "$attempt_dir" "$RECOVERY_ROOT" "$RECOVERY_PARENT" 9<&-
else
  [[ ! -e "$buffer_address_record" && ! -L "$buffer_address_record" \
      && ! -e "$reservation_manifest" && ! -L "$reservation_manifest" \
      && ! -e "$dump_path" && ! -L "$dump_path" ]] \
    || hold "the reserved attempt is not the exact pre-address recovery phase; use read-only diagnosis only"
  unexpected_attempt_entry="$(/usr/bin/find "$attempt_dir" -mindepth 1 -maxdepth 1 \
    ! -path "$buffer_keypair" ! -path "$artifact_snapshot" -print -quit 9<&-)"
  [[ -z "$unexpected_attempt_entry" ]] \
    || hold "the reserved attempt contains unexpected recovery state; use read-only diagnosis only"
  fsync_recovery_paths "$buffer_keypair" "$artifact_snapshot" "$attempt_dir" "$RECOVERY_ROOT" "$RECOVERY_PARENT" 9<&-
fi
open_exact_private_file "$artifact_snapshot" 11 "reviewed artifact snapshot" 9<&-
if [[ "$REBUILD_MODE" == "fresh" ]]; then
  /usr/bin/env -i \
    HOME=/nonexistent/iat-v2-keyless-keygen-home \
    XDG_CONFIG_HOME=/nonexistent/iat-v2-keyless-keygen-config \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    PATH=/usr/bin:/bin \
    "$SOLANA_KEYGEN_BIN" new --silent --no-bip39-passphrase --force --outfile "$buffer_keypair" 9<&- 11<&-
  /usr/bin/chmod 600 -- "$buffer_keypair" 9<&- 11<&-
  fsync_recovery_paths "$buffer_keypair" "$attempt_dir" 9<&- 11<&-
fi
# Reserve FD 10 before the function-call redirections so Bash cannot use it
# internally to save FD 11 with CLOEXEC and hide the signer from child checks.
exec 10</dev/null
open_exact_private_file "$buffer_keypair" 10 "fresh buffer signer" 9<&- 11<&-
assert_bound_artifact_identity 9<&- 10<&-
new_buffer="$(iat_v2_run_keyless_solana "$SOLANA_BIN" address -k /proc/self/fd/10 9<&- 11<&-)"
( set -o noclobber; printf '%s\n' "$new_buffer" > "$buffer_address_record" ) 9<&- 10<&- 11<&- || hold "fresh buffer address record already exists"
/usr/bin/chmod 600 -- "$buffer_address_record" 9<&- 10<&- 11<&-
write_rebuild_reservation_manifest "$reservation_manifest" "$new_buffer" 9<&- 10<&- 11<&-
fsync_recovery_paths "$buffer_keypair" "$buffer_address_record" "$artifact_snapshot" "$reservation_manifest" \
  "$attempt_dir" "$RECOVERY_ROOT" "$RECOVERY_PARENT" 9<&- 10<&- 11<&-

echo "FRESH BUFFER ADDRESS: $new_buffer"
echo "The protected fresh-buffer signer is never printed or digested."
exec 8<>/dev/tty || hold "an attended controlling terminal is required for the target-bound upload confirmation"
printf '%s' "Type UPLOAD-$new_buffer exactly on the attended terminal to bind this fresh address: " >&8
IFS= read -r target_confirmation <&8 || hold "target-bound attended confirmation was unavailable"
exec 8>&- 8<&-
[[ "$target_confirmation" == "UPLOAD-$new_buffer" ]] || hold "fresh-address confirmation did not match; no write was attempted"
echo "Submitting the one fresh-buffer write invocation now; it will never close $OLD_BUFFER."
verify_node 9<&- 10<&- 11<&-
verify_git 9<&- 10<&- 11<&-
verify_recovery_runtime_binding_again 9<&- 10<&- 11<&-
verify_solana 9<&- 10<&- 11<&-
iat_v2_verify_devnet_genesis "$SOLANA_BIN" 9<&- 10<&- 11<&-
verify_keygen 9<&- 10<&- 11<&-
observe_finalized_payer_floor 9<&- 10<&- 11<&-
[[ "$(iat_v2_run_keyless_solana "$SOLANA_BIN" address -k /proc/self/fd/9 10<&- 11<&-)" == "$EXPECTED_PAYER" ]] || hold "open payer descriptor identity drifted"
[[ "$(iat_v2_run_keyless_solana "$SOLANA_BIN" address -k /proc/self/fd/10 9<&- 11<&-)" == "$new_buffer" ]] || hold "open buffer descriptor identity drifted"
assert_open_private_file_identity "$PAYER_KEYPAIR" 9 "Devnet payer keypair" 10<&- 11<&-
assert_open_private_file_identity "$buffer_keypair" 10 "fresh buffer signer" 9<&- 11<&-
assert_bound_artifact_identity 9<&- 10<&-

set +e
write_output="$(iat_v2_run_keyless_solana_timeout 900 "$SOLANA_BIN" program write-buffer /proc/self/fd/11 --buffer /proc/self/fd/10 --buffer-authority /proc/self/fd/9 \
  --fee-payer /proc/self/fd/9 --keypair /proc/self/fd/9 --url devnet --commitment finalized --use-rpc --with-compute-unit-price 1000 --max-sign-attempts 5 2>&1)"
write_status=$?
set -e
exec 9<&- 10<&- 11<&-
printf '%s\n' "$write_output"
echo "Beginning read-only finalized reconciliation. The write invocation will not be repeated."

for read_attempt in $(/usr/bin/seq 1 12); do
  echo "Finalized fresh-buffer verification read $read_attempt of 12..."
  verify_solana 9<&- 10<&-
  iat_v2_verify_devnet_genesis "$SOLANA_BIN" 9<&- 10<&-
  set +e
  show_output="$(iat_v2_run_keyless_solana_timeout 45 "$SOLANA_BIN" program show "$new_buffer" --url devnet --commitment finalized 9<&- 10<&- 2>&1)"; show_status=$?
  set -e
  buffer_line_count=0; exact_buffer_line_count=0; authority_line_count=0; exact_authority_line_count=0
  while IFS= read -r show_line; do
    if [[ "$show_line" == "Buffer Address: "* ]]; then
      buffer_line_count=$((buffer_line_count + 1))
      [[ "$show_line" == "Buffer Address: $new_buffer" ]] && exact_buffer_line_count=$((exact_buffer_line_count + 1))
    fi
    if [[ "$show_line" == "Authority: "* ]]; then
      authority_line_count=$((authority_line_count + 1))
      [[ "$show_line" == "Authority: $EXPECTED_PAYER" ]] && exact_authority_line_count=$((exact_authority_line_count + 1))
    fi
  done <<< "$show_output"
  if (( show_status == 0 && buffer_line_count == 1 && exact_buffer_line_count == 1 \
      && authority_line_count == 1 && exact_authority_line_count == 1 )); then
    if [[ "$dump_created_by_this_run" == "true" ]]; then
      /usr/bin/rm -f -- "$dump_path" 9<&- 10<&-
      dump_created_by_this_run=false
    fi
    [[ ! -e "$dump_path" && ! -L "$dump_path" ]] \
      || hold "finalized buffer reconstruction path already exists; preserve it for read-only diagnosis"
    dump_created_by_this_run=true
    set +e
    dump_output="$(iat_v2_run_keyless_solana_timeout 90 "$SOLANA_BIN" program dump "$new_buffer" "$dump_path" --url devnet --commitment finalized 9<&- 10<&- 2>&1)"; dump_status=$?
    set -e
    if (( dump_status == 0 )) && [[ -f "$dump_path" && ! -L "$dump_path" ]]; then
      observed_bytes="$(/usr/bin/stat -c '%s' -- "$dump_path" 9<&- 10<&-)"; observed_hash="$(/usr/bin/sha256sum -- "$dump_path" 9<&- 10<&-)"; observed_hash="${observed_hash%% *}"
      echo "OBSERVED FINALIZED BUFFER BYTES / SHA-256: $observed_bytes / $observed_hash"
      if [[ "$observed_bytes" == "$EXPECTED_BYTES" && "$observed_hash" == "$EXPECTED_HASH" ]]; then upload_verified=true; break; fi
    fi
  fi
  printf '%s\n' "$show_output"
  (( read_attempt < 12 )) && /usr/bin/sleep 10 9<&- 10<&-
done

if [[ "$upload_verified" != "true" ]]; then
  echo "HOLD: the sole write invocation exited $write_status and exact finalized bytes were not reconstructed." >&2
  echo "DO NOT RERUN. Preserve the recovery directory for a separately reviewed read-only diagnosis." >&2
  exit 1
fi

echo "FRESH BUFFER UPLOAD AND FINALIZED HASH VERIFICATION COMPLETE"
echo "BUFFER:    $new_buffer"
echo "HASH:      $EXPECTED_HASH"
echo "BYTES:     $EXPECTED_BYTES"
echo "AUTHORITY: $EXPECTED_PAYER (handoff has NOT run)"
echo "OLD BUFFER $OLD_BUFFER WAS NOT TOUCHED"
echo "NEXT STEP: use the exact clean-environment authority-handoff command in the attended runbook."
