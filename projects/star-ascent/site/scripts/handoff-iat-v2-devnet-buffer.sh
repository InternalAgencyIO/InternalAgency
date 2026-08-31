#!/usr/bin/bash
set -euo pipefail
set +x
umask 077

hold() {
  echo "HOLD: $*" >&2
  exit 1
}

iat_v2_verify_captured_source() {
  local source="$1"
  local expected_sha256="$2"
  local expected_bytes="$3"
  local label="$4"
  local observed_sha256 observed_bytes
  observed_sha256="$(printf '%s' "$source" 9<&- | /usr/bin/sha256sum 9<&-)"
  observed_sha256="${observed_sha256%% *}"
  observed_bytes="$(printf '%s' "$source" 9<&- | /usr/bin/wc -c 9<&-)"
  [[ "$observed_sha256" == "$expected_sha256" && "$observed_bytes" == "$expected_bytes" ]] \
    || hold "captured $label source drifted"
}

iat_v2_verify_open_fd() {
  local fd_path="$1"
  local configured_path="$2"
  local expected_sha256="$3"
  local expected_bytes="$4"
  local label="$5"
  local executable="$6"
  local observed_sha256 observed_bytes
  [[ "$configured_path" == /* && ! -L "$configured_path" && -f "$fd_path" ]] \
    || hold "$label did not open from an absolute non-symlink regular file"
  if [[ "$executable" == "true" ]]; then
    [[ -x "$fd_path" ]] || hold "$label descriptor is not executable"
  fi
  observed_bytes="$(/usr/bin/stat -Lc '%s' -- "$fd_path" 9<&- 2>/dev/null || true)"
  observed_sha256="$(/usr/bin/sha256sum -- "$fd_path" 9<&- 2>/dev/null || true)"
  observed_sha256="${observed_sha256%% *}"
  [[ "$observed_bytes" == "$expected_bytes" ]] \
    || hold "$label descriptor byte length drifted; expected $expected_bytes, observed $observed_bytes"
  [[ "$observed_sha256" == "$expected_sha256" ]] \
    || hold "$label descriptor SHA-256 drifted"
}

iat_v2_entrypoint() {
[[ "${IAT_V2_CLEAN_ENVIRONMENT:-}" == "iat-v2-devnet-buffer-v1" ]] \
  || hold "use the exact clean Ubuntu-24.04 WSL2 launcher from the attended runbook"
for inherited_name in BASH_ENV CDPATH ENV LD_LIBRARY_PATH LD_PRELOAD NODE_OPTIONS NODE_PATH SOLANA_CONFIG_FILE TMPDIR "${!GIT_@}"; do
  [[ -z "$inherited_name" || ! -v "$inherited_name" ]] \
    || hold "inherited $inherited_name is not admitted at the attended handoff boundary"
done
[[ "${HOME:-}" == "/home/a" ]] || hold "HOME is not the reviewed attended WSL home"
[[ "${LANG:-}" == "C.UTF-8" && "${LC_ALL:-}" == "C.UTF-8" ]] \
  || hold "LANG and LC_ALL must both be exact C.UTF-8"
[[ "${PATH:-}" == "/usr/bin:/bin" ]] || hold "PATH is not the reviewed minimal system path"
[[ -e /proc/sys/fs/binfmt_misc/WSLInterop ]] || hold "WSL interoperability boundary is unavailable"
[[ "$(/usr/bin/uname -r)" == *-microsoft-standard-WSL2 ]] || hold "kernel is not the reviewed WSL2 class"
/usr/bin/grep -Fqx 'ID=ubuntu' /etc/os-release || hold "distribution is not Ubuntu"
/usr/bin/grep -Eq '^VERSION_ID="?24\.04"?$' /etc/os-release || hold "distribution is not Ubuntu 24.04"
[[ "$(/usr/bin/id -u)" == "1000" ]] || hold "attended POSIX user identity drifted"

[[ "${IAT_V2_HANDOFF_CAPTURED_SOURCE:-}" == "iat-v2-devnet-buffer-handoff-captured-source/v1" \
    && "${BASH_SOURCE[0]-}" == "environment" ]] \
  || hold "use the exact captured-source launcher; direct mutable-path execution is not admitted"
CAPTURED_HANDOFF_SOURCE_SHA256="${IAT_V2_HANDOFF_CAPTURED_SHA256:-}"
CAPTURED_HANDOFF_SOURCE_BYTES="${IAT_V2_HANDOFF_CAPTURED_BYTES:-}"
[[ "$CAPTURED_HANDOFF_SOURCE_SHA256" =~ ^[0-9a-f]{64}$ \
    && "$CAPTURED_HANDOFF_SOURCE_BYTES" =~ ^[1-9][0-9]*$ ]] \
  || hold "captured-source launcher did not supply one canonical handoff digest and byte count"
HANDOFF_SOURCE_PATH="${IAT_V2_HANDOFF_SOURCE_PATH:-}"
[[ "$HANDOFF_SOURCE_PATH" == "/mnt/c/Users/A/Documents/Codex/2026-08-13/can-you-take-over-b3-architecture-3/work/iat-b3-bpk00-package-bound-fd12-owner-root-public-key-anchor-clean/projects/star-ascent/site/scripts/handoff-iat-v2-devnet-buffer.sh" ]] \
  || hold "handoff source path is not the one exact reviewed entrypoint"
SCRIPT_DIR="$(cd -- "$(/usr/bin/dirname -- "$HANDOFF_SOURCE_PATH")" && pwd -P)"
SITE_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"
[[ "$SITE_ROOT" == "/mnt/c/Users/A/Documents/Codex/2026-08-13/can-you-take-over-b3-architecture-3/work/iat-b3-bpk00-package-bound-fd12-owner-root-public-key-anchor-clean/projects/star-ascent/site" ]] \
  || hold "site root is not the one exact reviewed checkout"
cd -- "$SITE_ROOT"
TOOLCHAIN_LIB="$SCRIPT_DIR/lib/iat-v2-attended-solana-toolchain.sh"
TOOLCHAIN_SOURCE_SHA256="0ea9923799c340af3816e18cd5f5e859e77522d9a80605ebb5561ff652c7ec68"
TOOLCHAIN_SOURCE_BYTES="6280"
[[ ! -L "$TOOLCHAIN_LIB" && -f "$TOOLCHAIN_LIB" ]] \
  || hold "attended toolchain source is not a regular non-symlink file"
PINNED_TOOLCHAIN_SOURCE="$(/usr/bin/cat -- "$TOOLCHAIN_LIB"; printf '\x1f')"
[[ "${PINNED_TOOLCHAIN_SOURCE: -1}" == $'\x1f' ]] \
  || hold "attended toolchain source capture did not reach its exact descriptor boundary"
PINNED_TOOLCHAIN_SOURCE="${PINNED_TOOLCHAIN_SOURCE%$'\x1f'}"
iat_v2_verify_captured_source "$PINNED_TOOLCHAIN_SOURCE" "$TOOLCHAIN_SOURCE_SHA256" "$TOOLCHAIN_SOURCE_BYTES" "attended toolchain"
readonly PINNED_TOOLCHAIN_SOURCE
source <(printf '%s' "$PINNED_TOOLCHAIN_SOURCE")

SOLANA_BIN="$IAT_V2_EXPECTED_SOLANA_CLI_PATH"
PAYER_KEYPAIR="/home/a/.config/solana/iat-v2-devnet-deployer.json"
NODE_BIN="$IAT_V2_EXPECTED_NODE_PATH"
GIT_BIN="$IAT_V2_EXPECTED_GIT_PATH"
ARTIFACT="$SITE_ROOT/target/verifiable/iat_v2.so"
RECONCILER="$SITE_ROOT/scripts/reconcile-iat-v2-devnet-buffer-finalized.mjs"
CAS_HELPER="$SITE_ROOT/scripts/iat-v2-devnet-buffer-handoff-cas.mjs"
SEALED_EXEC_HELPER="$SITE_ROOT/scripts/iat-v2-sealed-exec.py"
RUNTIME_BINDING_VERIFIER="$SITE_ROOT/scripts/lib/iat-v2-devnet-buffer-runtime-binding.mjs"
RECONCILER_RUNTIME_PATH="scripts/reconcile-iat-v2-devnet-buffer-finalized.mjs"
CAS_HELPER_RUNTIME_PATH="scripts/iat-v2-devnet-buffer-handoff-cas.mjs"
SEALED_EXEC_RUNTIME_PATH="scripts/iat-v2-sealed-exec.py"
RUNTIME_BINDING_VERIFIER_RUNTIME_PATH="scripts/lib/iat-v2-devnet-buffer-runtime-binding.mjs"
TOOLCHAIN_RUNTIME_PATH="scripts/lib/iat-v2-attended-solana-toolchain.sh"
HANDOFF_RUNTIME_PATH="scripts/handoff-iat-v2-devnet-buffer.sh"
BUFFER_ADDRESS="${BUFFER_ADDRESS:-}"
IAT_V2_HANDOFF_CAS_ROOT="${IAT_V2_HANDOFF_CAS_ROOT:-}"
EXPECTED_CAS_ROOT="/home/a/.local/state/internal-agency/iat-v2/devnet-buffer-handoff-v1"
CAS_ATTEMPTS_DIR="$EXPECTED_CAS_ROOT/attempts"
EXPECTED_PAYER="DYURSZnNLak5YNt2vLJUnU5iWDUbAo53oUfzZ8dVc5d4"
NEW_AUTHORITY="7XZjd7aNNci63LZy9syqgjvjNHvkQ83Uwo7cyynrfzPH"
DEVNET_HANDOFF_FEE_FLOOR_LAMPORTS="10000000"
EXPECTED_HASH="771c87bcd9afacf7e8e6bf43cd7ba05915fceb11c45a6a89d8080f6b52778a01"
EXPECTED_BYTES="649680"
EVIDENCE_HASH="ca19c4ebec300031528014e3d3373889a7b171589158ba366536e6200a3ac2a9"
SOURCE_HEAD="a03fe71dd66cd1650b8d0353e486786df30b83e9"
SOURCE_TREE="ffe82fcf8fd3d851c09a937ebec945121137e546"
CI_RUN_ID="33161771816"
CI_RUN_ATTEMPT="1"
RECONCILER_SOURCE_SHA256="5fd78ea52d62805cf2b11939a98e639a0b8a819c9dbda8bbbd9e05f9520d5ac7"
RECONCILER_SOURCE_BYTES="22369"
CAS_HELPER_SOURCE_SHA256="7ac2d5f8edb12005e19eacc648da530ba87292e156c9e90d8b73b72e78268be8"
CAS_HELPER_SOURCE_BYTES="35372"
SEALED_EXEC_SOURCE_SHA256="bf9d082017e6c1398a07c6689823e5838d011ff8c800397ccc57aaa247da1f7f"
SEALED_EXEC_SOURCE_BYTES="17633"
RUNTIME_BINDING_VERIFIER_SOURCE_SHA256="08d6164107c5e6895c427ef36d5afa744c4aeb8fa17be078326bee832d366ac1"
RUNTIME_BINDING_VERIFIER_SOURCE_BYTES="30272"
SEALED_EXEC_PYTHON="/usr/bin/python3.12"
SEALED_EXEC_PYTHON_VERSION="Python 3.12.3"
SEALED_EXEC_PYTHON_SHA256="1643dacd9feaedc58f3cc581e4d22577dfe25c09b10282936186ccf0f2e61118"
SEALED_EXEC_PYTHON_BYTES="8020928"
PINNED_NODE_EXEC=""
PINNED_SOLANA_EXEC=""
PINNED_ARTIFACT_PATH=""
PINNED_RECONCILER_SOURCE=""
PINNED_CAS_SOURCE=""
PINNED_SEALED_EXEC_SOURCE=""
PINNED_RUNTIME_BINDING_SOURCE=""
CAS_ATTEMPTS_IDENTITY=""
CAS_KEY_SHA256=""
CAS_RECORD_IDENTITY=""
CAS_RECORD_SHA256=""
CAS_MUTATION_PERMANENTLY_RESERVED="false"
CAS_RESERVATION_BOUNDARY_ENTERED="false"
CAS_RESERVATION_STATE_UNCERTAIN="false"
RUNTIME_SOURCE_HEAD=""
RUNTIME_SOURCE_TREE=""
RUNTIME_CHECKOUT_COMMIT=""
RUNTIME_CHECKOUT_TREE=""
RUNTIME_CHECKOUT_RELATION=""
RUNTIME_BINDING_SUCCESSOR_COMMIT=""
RUNTIME_BINDING_SUCCESSOR_TREE=""
RUNTIME_BINDING_ANCHOR_SHA256=""
RUNTIME_CLOSURE_SHA256=""
RUNTIME_EVIDENCE_MANIFEST_SHA256=""
RUNTIME_CI_RUN_ID=""
RUNTIME_CI_RUN_ATTEMPT=""
RUNTIME_WORKFLOW_REF=""
RUNTIME_VERIFICATION_SHA256=""
HANDOFF_SOURCE_SHA256=""
HANDOFF_SOURCE_BYTES=""

NODE_BIN="$IAT_V2_EXPECTED_NODE_PATH"
NODE_VERSION="$IAT_V2_EXPECTED_NODE_VERSION"
NODE_SHA256="$IAT_V2_EXPECTED_NODE_SHA256"
NODE_BYTES="$IAT_V2_EXPECTED_NODE_BYTES"
exec 5< "$NODE_BIN" || hold "reviewed Node.js descriptor could not be opened"
iat_v2_verify_open_fd "/proc/$$/fd/5" "$NODE_BIN" "$NODE_SHA256" "$NODE_BYTES" "Node.js runtime" true
PINNED_NODE_EXEC="/proc/self/fd/5"

iat_v2_verify_exact_git "$GIT_BIN"
GIT_BIN="$IAT_V2_VERIFIED_TOOL_PATH"
GIT_VERSION="$IAT_V2_VERIFIED_TOOL_VERSION"
GIT_SHA256="$IAT_V2_VERIFIED_TOOL_SHA256"
GIT_BYTES="$IAT_V2_VERIFIED_TOOL_BYTES"

[[ ! -L "$RUNTIME_BINDING_VERIFIER" && -f "$RUNTIME_BINDING_VERIFIER" ]] \
  || hold "runtime binding verifier is not a regular non-symlink file"
exec 12< "$RUNTIME_BINDING_VERIFIER" || hold "runtime binding verifier descriptor could not be opened"
iat_v2_verify_open_fd "/proc/$$/fd/12" "$RUNTIME_BINDING_VERIFIER" \
  "$RUNTIME_BINDING_VERIFIER_SOURCE_SHA256" "$RUNTIME_BINDING_VERIFIER_SOURCE_BYTES" \
  "runtime binding verifier" false
PINNED_RUNTIME_BINDING_SOURCE="$(/usr/bin/cat <&12; printf '\x1f')"
[[ "${PINNED_RUNTIME_BINDING_SOURCE: -1}" == $'\x1f' ]] \
  || hold "runtime binding verifier capture did not reach its exact descriptor boundary"
PINNED_RUNTIME_BINDING_SOURCE="${PINNED_RUNTIME_BINDING_SOURCE%$'\x1f'}"
exec 12<&-
iat_v2_verify_captured_source "$PINNED_RUNTIME_BINDING_SOURCE" \
  "$RUNTIME_BINDING_VERIFIER_SOURCE_SHA256" "$RUNTIME_BINDING_VERIFIER_SOURCE_BYTES" \
  "runtime binding verifier"
readonly PINNED_RUNTIME_BINDING_SOURCE

[[ ! -L "$SEALED_EXEC_HELPER" && -f "$SEALED_EXEC_HELPER" ]] \
  || hold "sealed-exec helper is not a regular non-symlink file"
exec 8< "$SEALED_EXEC_HELPER" || hold "sealed-exec helper descriptor could not be opened"
iat_v2_verify_open_fd "/proc/$$/fd/8" "$SEALED_EXEC_HELPER" \
  "$SEALED_EXEC_SOURCE_SHA256" "$SEALED_EXEC_SOURCE_BYTES" "sealed-exec helper" false
PINNED_SEALED_EXEC_SOURCE="$(/usr/bin/cat <&8; printf '\x1f')"
[[ "${PINNED_SEALED_EXEC_SOURCE: -1}" == $'\x1f' ]] \
  || hold "sealed-exec helper capture did not reach its exact descriptor boundary"
PINNED_SEALED_EXEC_SOURCE="${PINNED_SEALED_EXEC_SOURCE%$'\x1f'}"
exec 8<&-
iat_v2_verify_captured_source "$PINNED_SEALED_EXEC_SOURCE" \
  "$SEALED_EXEC_SOURCE_SHA256" "$SEALED_EXEC_SOURCE_BYTES" "sealed-exec helper"
readonly PINNED_SEALED_EXEC_SOURCE

iat_v2_verify_root_owned_python() {
  local resolved uid mode nlink observed_bytes observed_sha256 observed_version
  [[ "$SEALED_EXEC_PYTHON" == /* && ! -L "$SEALED_EXEC_PYTHON" \
      && -f "$SEALED_EXEC_PYTHON" && -x "$SEALED_EXEC_PYTHON" ]] \
    || hold "sealed-exec Python runtime is not one absolute executable non-symlink file"
  resolved="$(/usr/bin/readlink -f -- "$SEALED_EXEC_PYTHON" 9<&- 2>/dev/null || true)"
  uid="$(/usr/bin/stat -Lc '%u' -- "$SEALED_EXEC_PYTHON" 9<&- 2>/dev/null || true)"
  mode="$(/usr/bin/stat -Lc '%a' -- "$SEALED_EXEC_PYTHON" 9<&- 2>/dev/null || true)"
  nlink="$(/usr/bin/stat -Lc '%h' -- "$SEALED_EXEC_PYTHON" 9<&- 2>/dev/null || true)"
  observed_bytes="$(/usr/bin/stat -Lc '%s' -- "$SEALED_EXEC_PYTHON" 9<&- 2>/dev/null || true)"
  observed_sha256="$(/usr/bin/sha256sum -- "$SEALED_EXEC_PYTHON" 9<&- 2>/dev/null || true)"
  observed_sha256="${observed_sha256%% *}"
  observed_version="$(/usr/bin/env -i LANG=C.UTF-8 LC_ALL=C.UTF-8 PATH=/usr/bin:/bin \
    "$SEALED_EXEC_PYTHON" --version 9<&- 2>&1)"
  [[ "$resolved" == "$SEALED_EXEC_PYTHON" && "$uid" == "0" && "$mode" == "755" && "$nlink" == "1" ]] \
    || hold "sealed-exec Python runtime identity, ownership, mode, or link count drifted"
  [[ "$observed_bytes" == "$SEALED_EXEC_PYTHON_BYTES" ]] \
    || hold "sealed-exec Python runtime byte length drifted"
  [[ "$observed_sha256" == "$SEALED_EXEC_PYTHON_SHA256" ]] \
    || hold "sealed-exec Python runtime SHA-256 drifted"
  [[ "$observed_version" == "$SEALED_EXEC_PYTHON_VERSION" ]] \
    || hold "sealed-exec Python runtime version drifted"
}

iat_v2_run_sealed_exec() {
  local duration="$1"
  local source_fd="$2"
  local expected_sha256="$3"
  local expected_bytes="$4"
  shift 4
  [[ "$duration" =~ ^[1-9][0-9]*$ ]] && [[ "$source_fd" == "5" || "$source_fd" == "7" ]] \
    || hold "sealed executable invocation profile is invalid"
  if [[ "$source_fd" == "5" ]]; then
    iat_v2_verify_open_fd "/proc/$$/fd/5" "$NODE_BIN" "$NODE_SHA256" "$NODE_BYTES" "Node.js runtime" true 9<&-
  else
    iat_v2_verify_open_fd "/proc/$$/fd/7" "$SOLANA_BIN" "$SOLANA_CLI_SHA256" "$SOLANA_CLI_BYTES" "Solana CLI" true 9<&-
  fi
  iat_v2_verify_root_owned_python
  iat_v2_verify_captured_source "$PINNED_SEALED_EXEC_SOURCE" "$SEALED_EXEC_SOURCE_SHA256" "$SEALED_EXEC_SOURCE_BYTES" "sealed-exec helper"
  /usr/bin/timeout "$duration" \
    /usr/bin/env -i \
      LANG=C.UTF-8 \
      LC_ALL=C.UTF-8 \
      PATH=/usr/bin:/bin \
      PYTHONDONTWRITEBYTECODE=1 \
      PYTHONNOUSERSITE=1 \
      "$SEALED_EXEC_PYTHON" -I -S -c "$PINNED_SEALED_EXEC_SOURCE" \
        --source-fd "$source_fd" \
        --expected-sha256 "$expected_sha256" \
        --expected-bytes "$expected_bytes" \
        "$@"
}

iat_v2_run_clean_node() {
  [[ -n "$PINNED_NODE_EXEC" && -n "$PINNED_SEALED_EXEC_SOURCE" ]] \
    || hold "sealed Node.js execution epoch is unavailable"
  iat_v2_run_sealed_exec 90 5 "$NODE_SHA256" "$NODE_BYTES" \
    --env HOME=/home/a \
    --env LANG=C.UTF-8 \
    --env LC_ALL=C.UTF-8 \
    --env PATH=/usr/bin:/bin \
    -- node "$@" 9<&-
}

iat_v2_run_runtime_binding_verifier() {
  iat_v2_verify_open_fd "/proc/$$/fd/5" "$NODE_BIN" "$NODE_SHA256" "$NODE_BYTES" "Node.js runtime" true
  iat_v2_verify_captured_source "$PINNED_RUNTIME_BINDING_SOURCE" \
    "$RUNTIME_BINDING_VERIFIER_SOURCE_SHA256" "$RUNTIME_BINDING_VERIFIER_SOURCE_BYTES" \
    "runtime binding verifier"
  printf '%s' "$PINNED_RUNTIME_BINDING_SOURCE" 9<&- \
    | iat_v2_run_sealed_exec 120 5 "$NODE_SHA256" "$NODE_BYTES" \
      --env HOME=/home/a \
      --env LANG=C.UTF-8 \
      --env LC_ALL=C.UTF-8 \
      --env PATH=/usr/bin:/bin \
      --env IAT_V2_RUNTIME_BINDING_STDIN_CLI=iat-v2-devnet-buffer-runtime-binding-stdin/v1 \
      --env IAT_V2_PROJECT_ROOT="$SITE_ROOT" \
      -- node --input-type=module - verify 9<&-
}

binding_diagnostics="$(/usr/bin/mktemp /tmp/iat-v2-binding-diagnostics-XXXXXX.txt)"
set +e
binding_record="$(
  iat_v2_run_runtime_binding_verifier 2>"$binding_diagnostics"
  command_status=$?
  printf '\x1f'
  exit "$command_status"
)"
binding_status=$?
set -e
if [[ -s "$binding_diagnostics" ]]; then
  /usr/bin/cat -- "$binding_diagnostics" >&2
fi
/usr/bin/rm -f -- "$binding_diagnostics"
[[ "${binding_record: -1}" == $'\x1f' ]] \
  || hold "runtime binding verifier output did not reach its exact capture boundary"
binding_record="${binding_record%$'\x1f'}"
printf '%s' "$binding_record"
if (( binding_status != 0 )); then
  echo "HOLD: exact runtime binding did not pass; no authority handoff was attempted." >&2
  exit "$binding_status"
fi
RUNTIME_VERIFICATION_SHA256="$(printf '%s' "$binding_record" 9<&- | /usr/bin/sha256sum 9<&-)"
RUNTIME_VERIFICATION_SHA256="${RUNTIME_VERIFICATION_SHA256%% *}"
mapfile -t binding_fields < <(
  printf '%s' "$binding_record" \
    | iat_v2_run_clean_node -e 'const chunks=[]; process.stdin.on("data",(chunk)=>chunks.push(chunk)); process.stdin.on("end",()=>{try{const value=JSON.parse(Buffer.concat(chunks));const entries=value.runtimeClosureEntries;const byPath=new Map(Array.isArray(entries)?entries.map((entry)=>[entry.path,entry]):[]);const paths=["scripts/reconcile-iat-v2-devnet-buffer-finalized.mjs","scripts/iat-v2-devnet-buffer-handoff-cas.mjs","scripts/iat-v2-sealed-exec.py","scripts/lib/iat-v2-attended-solana-toolchain.sh","scripts/lib/iat-v2-devnet-buffer-runtime-binding.mjs","scripts/handoff-iat-v2-devnet-buffer.sh"];const selected=paths.map((path)=>byPath.get(path));if(selected.some((entry)=>!entry))process.exit(2);const fields=[value.artifactSha256,value.artifactBytes,value.evidenceManifestSha256,value.sourceHeadCommit,value.sourceHeadTree,value.checkoutCommit,value.checkoutTree,value.checkoutRelation,value.bindingSuccessorCommit,value.bindingSuccessorTree,value.bindingAnchorSha256,value.runtimeClosureSha256,value.ciRunId,value.ciRunAttempt,value.workflowRef,...selected.flatMap((entry)=>[entry.sha256,entry.bytes])];process.stdout.write(`${fields.join("\n")}\n`);}catch{process.exit(2);}});'
)
if (( ${#binding_fields[@]} != 27 )); then
  echo "HOLD: runtime binding output did not contain every exact provenance and closure field." >&2
  exit 1
fi
[[ "${binding_fields[0]}" == "$EXPECTED_HASH" \
    && "${binding_fields[1]}" == "$EXPECTED_BYTES" \
    && "${binding_fields[2]}" == "$EVIDENCE_HASH" ]] \
  || hold "runtime binding artifact or evidence tuple differs from the hardcoded migration tuple"
RUNTIME_SOURCE_HEAD="${binding_fields[3]}"
RUNTIME_SOURCE_TREE="${binding_fields[4]}"
RUNTIME_CHECKOUT_COMMIT="${binding_fields[5]}"
RUNTIME_CHECKOUT_TREE="${binding_fields[6]}"
RUNTIME_CHECKOUT_RELATION="${binding_fields[7]}"
RUNTIME_BINDING_SUCCESSOR_COMMIT="${binding_fields[8]}"
RUNTIME_BINDING_SUCCESSOR_TREE="${binding_fields[9]}"
RUNTIME_BINDING_ANCHOR_SHA256="${binding_fields[10]}"
RUNTIME_CLOSURE_SHA256="${binding_fields[11]}"
RUNTIME_EVIDENCE_MANIFEST_SHA256="${binding_fields[2]}"
RUNTIME_CI_RUN_ID="${binding_fields[12]}"
RUNTIME_CI_RUN_ATTEMPT="${binding_fields[13]}"
RUNTIME_WORKFLOW_REF="${binding_fields[14]}"
[[ "${binding_fields[15]}" == "$RECONCILER_SOURCE_SHA256" \
    && "${binding_fields[16]}" == "$RECONCILER_SOURCE_BYTES" \
    && "${binding_fields[17]}" == "$CAS_HELPER_SOURCE_SHA256" \
    && "${binding_fields[18]}" == "$CAS_HELPER_SOURCE_BYTES" \
    && "${binding_fields[19]}" == "$SEALED_EXEC_SOURCE_SHA256" \
    && "${binding_fields[20]}" == "$SEALED_EXEC_SOURCE_BYTES" \
    && "${binding_fields[21]}" == "$TOOLCHAIN_SOURCE_SHA256" \
    && "${binding_fields[22]}" == "$TOOLCHAIN_SOURCE_BYTES" \
    && "${binding_fields[23]}" == "$RUNTIME_BINDING_VERIFIER_SOURCE_SHA256" \
    && "${binding_fields[24]}" == "$RUNTIME_BINDING_VERIFIER_SOURCE_BYTES" ]] \
  || hold "runtime binding critical source identities differ from the hardcoded bootstrap"
HANDOFF_SOURCE_SHA256="${binding_fields[25]}"
HANDOFF_SOURCE_BYTES="${binding_fields[26]}"
[[ "$RUNTIME_SOURCE_HEAD" =~ ^[0-9a-f]{40}$ \
    && "$RUNTIME_SOURCE_TREE" =~ ^[0-9a-f]{40}$ \
    && "$RUNTIME_CHECKOUT_COMMIT" =~ ^[0-9a-f]{40}$ \
    && "$RUNTIME_CHECKOUT_TREE" =~ ^[0-9a-f]{40}$ \
    && "$RUNTIME_CHECKOUT_RELATION" == "PR_MERGE_SECOND_PARENT" \
    && "$RUNTIME_BINDING_SUCCESSOR_COMMIT" =~ ^[0-9a-f]{40}$ \
    && "$RUNTIME_BINDING_SUCCESSOR_TREE" =~ ^[0-9a-f]{40}$ \
    && "$RUNTIME_BINDING_ANCHOR_SHA256" =~ ^[0-9a-f]{64}$ \
    && "$RUNTIME_CLOSURE_SHA256" =~ ^[0-9a-f]{64}$ \
    && "$RUNTIME_EVIDENCE_MANIFEST_SHA256" =~ ^[0-9a-f]{64}$ \
    && "$RUNTIME_CI_RUN_ID" =~ ^[1-9][0-9]*$ \
    && "$RUNTIME_CI_RUN_ATTEMPT" =~ ^[1-9][0-9]*$ \
    && "$RUNTIME_WORKFLOW_REF" =~ ^InternalAgencyIO/InternalAgency/\.github/workflows/iat-v2-proof\.yml@refs/pull/[1-9][0-9]*/merge$ \
    && "$RUNTIME_VERIFICATION_SHA256" =~ ^[0-9a-f]{64}$ \
    && "$HANDOFF_SOURCE_SHA256" =~ ^[0-9a-f]{64}$ \
    && "$HANDOFF_SOURCE_BYTES" =~ ^[1-9][0-9]*$ ]] \
  || hold "runtime binding provenance fields are not canonical"
[[ "$HANDOFF_SOURCE_SHA256" == "$CAPTURED_HANDOFF_SOURCE_SHA256" \
    && "$HANDOFF_SOURCE_BYTES" == "$CAPTURED_HANDOFF_SOURCE_BYTES" ]] \
  || hold "runtime-bound handoff source differs from the exact bytes parsed by Bash"
if [[ -z "$BUFFER_ADDRESS" ]]; then
  echo "HOLD: BUFFER_ADDRESS is required; no default or historical buffer is admitted." >&2
  exit 1
fi
if [[ "$IAT_V2_HANDOFF_CAS_ROOT" != "$EXPECTED_CAS_ROOT" ]]; then
  echo "HOLD: IAT_V2_HANDOFF_CAS_ROOT must equal the one exact reviewed persistent namespace: $EXPECTED_CAS_ROOT" >&2
  exit 1
fi

SOLANA_BIN="$IAT_V2_EXPECTED_SOLANA_CLI_PATH"
SOLANA_CLI_VERSION="$IAT_V2_EXPECTED_SOLANA_CLI_VERSION"
SOLANA_CLI_SHA256="$IAT_V2_EXPECTED_SOLANA_CLI_SHA256"
SOLANA_CLI_BYTES="$IAT_V2_EXPECTED_SOLANA_CLI_BYTES"
exec 7< "$SOLANA_BIN" || hold "reviewed Solana CLI descriptor could not be opened"
iat_v2_verify_open_fd "/proc/$$/fd/7" "$SOLANA_BIN" "$SOLANA_CLI_SHA256" "$SOLANA_CLI_BYTES" "Solana CLI" true
PINNED_SOLANA_EXEC="/proc/self/fd/7"
DEVNET_GENESIS_HASH="$IAT_V2_EXPECTED_DEVNET_GENESIS_HASH"

CAS_ARGS=(
  --root "$IAT_V2_HANDOFF_CAS_ROOT"
  --buffer "$BUFFER_ADDRESS"
  --from-authority "$EXPECTED_PAYER"
  --to-authority "$NEW_AUTHORITY"
  --artifact-sha256 "$EXPECTED_HASH"
  --artifact-bytes "$EXPECTED_BYTES"
  --evidence-manifest-sha256 "$EVIDENCE_HASH"
  --source-head-commit "$SOURCE_HEAD"
  --source-head-tree "$SOURCE_TREE"
  --ci-run-id "$CI_RUN_ID"
  --ci-run-attempt "$CI_RUN_ATTEMPT"
  --runtime-source-head-commit "$RUNTIME_SOURCE_HEAD"
  --runtime-source-head-tree "$RUNTIME_SOURCE_TREE"
  --runtime-checkout-commit "$RUNTIME_CHECKOUT_COMMIT"
  --runtime-checkout-tree "$RUNTIME_CHECKOUT_TREE"
  --runtime-checkout-relation "$RUNTIME_CHECKOUT_RELATION"
  --runtime-binding-successor-commit "$RUNTIME_BINDING_SUCCESSOR_COMMIT"
  --runtime-binding-successor-tree "$RUNTIME_BINDING_SUCCESSOR_TREE"
  --runtime-binding-anchor-sha256 "$RUNTIME_BINDING_ANCHOR_SHA256"
  --runtime-closure-sha256 "$RUNTIME_CLOSURE_SHA256"
  --runtime-evidence-manifest-sha256 "$RUNTIME_EVIDENCE_MANIFEST_SHA256"
  --runtime-ci-run-id "$RUNTIME_CI_RUN_ID"
  --runtime-ci-run-attempt "$RUNTIME_CI_RUN_ATTEMPT"
  --runtime-workflow-ref "$RUNTIME_WORKFLOW_REF"
  --runtime-verification-sha256 "$RUNTIME_VERIFICATION_SHA256"
  --handoff-sha256 "$HANDOFF_SOURCE_SHA256"
  --handoff-bytes "$HANDOFF_SOURCE_BYTES"
  --reconciler-sha256 "$RECONCILER_SOURCE_SHA256"
  --reconciler-bytes "$RECONCILER_SOURCE_BYTES"
  --cas-helper-sha256 "$CAS_HELPER_SOURCE_SHA256"
  --cas-helper-bytes "$CAS_HELPER_SOURCE_BYTES"
  --sealed-exec-sha256 "$SEALED_EXEC_SOURCE_SHA256"
  --sealed-exec-bytes "$SEALED_EXEC_SOURCE_BYTES"
  --runtime-binding-verifier-sha256 "$RUNTIME_BINDING_VERIFIER_SOURCE_SHA256"
  --runtime-binding-verifier-bytes "$RUNTIME_BINDING_VERIFIER_SOURCE_BYTES"
  --toolchain-sha256 "$TOOLCHAIN_SOURCE_SHA256"
  --toolchain-bytes "$TOOLCHAIN_SOURCE_BYTES"
  --sealed-exec-python-path "$SEALED_EXEC_PYTHON"
  --sealed-exec-python-version "$SEALED_EXEC_PYTHON_VERSION"
  --sealed-exec-python-sha256 "$SEALED_EXEC_PYTHON_SHA256"
  --sealed-exec-python-bytes "$SEALED_EXEC_PYTHON_BYTES"
  --node-path "$NODE_BIN"
  --node-version "$NODE_VERSION"
  --node-sha256 "$NODE_SHA256"
  --node-bytes "$NODE_BYTES"
  --git-path "$GIT_BIN"
  --git-version "$GIT_VERSION"
  --git-sha256 "$GIT_SHA256"
  --git-bytes "$GIT_BYTES"
  --devnet-genesis-hash "$DEVNET_GENESIS_HASH"
  --solana-cli-path "$SOLANA_BIN"
  --solana-cli-version "$SOLANA_CLI_VERSION"
  --solana-cli-sha256 "$SOLANA_CLI_SHA256"
  --solana-cli-bytes "$SOLANA_CLI_BYTES"
)

is_retryable_rpc_error() {
  local status="$1"
  local message="$2"
  (( status == 124 )) ||
    [[ "$message" == *"429"* ||
       "$message" == *"Too Many Requests"* ||
       "$message" == *"Max retries exceeded"* ||
       "$message" == *"Blockhash not found"* ||
       "$message" == *"block height exceeded"* ||
       "$message" == *"was not confirmed"* ||
       "$message" == *"timed out"* ||
       "$message" == *"Timeout"* ||
       "$message" == *"fetch failed"* ||
       "$message" == *"RPC_TRANSPORT_HOLD"* ]]
}

iat_v2_run_pinned_solana() {
  local duration="$1"
  local signer_profile="$2"
  shift 2
  local -a launcher=(
    --env HOME=/nonexistent/iat-v2-keyless-solana-home
    --env XDG_CONFIG_HOME=/nonexistent/iat-v2-keyless-solana-config
    --env LANG=C.UTF-8
    --env LC_ALL=C.UTF-8
    --env PATH=/usr/bin:/bin
  )
  if [[ "$signer_profile" == "signer" ]]; then
    launcher+=(--inherit-fd 9)
  elif [[ "$signer_profile" != "keyless" ]]; then
    hold "sealed Solana signer profile is invalid"
  fi
  if [[ "$signer_profile" == "signer" ]]; then
    iat_v2_run_sealed_exec "$duration" 7 "$SOLANA_CLI_SHA256" "$SOLANA_CLI_BYTES" \
      "${launcher[@]}" -- solana "$@" --config /dev/null
  else
    iat_v2_run_sealed_exec "$duration" 7 "$SOLANA_CLI_SHA256" "$SOLANA_CLI_BYTES" \
      "${launcher[@]}" -- solana "$@" --config /dev/null 9<&-
  fi
}

iat_v2_verify_pinned_devnet_genesis() {
  local observed
  observed="$(iat_v2_run_pinned_solana 45 keyless genesis-hash --url devnet 9<&- 2>&1)" \
    || hold "sealed Solana CLI could not observe the reviewed Devnet genesis hash"
  [[ "$observed" == "$DEVNET_GENESIS_HASH" ]] \
    || hold "sealed Solana CLI observed a different Devnet genesis hash"
}

iat_v2_parse_exact_cas_result() {
  local record="$1"
  local expected_key="$2"
  local allowed_statuses="$3"
  local -a parsed=()
  mapfile -t parsed < <(
    printf '%s' "$record" 9<&- \
      | iat_v2_run_clean_node -e '
        const chunks=[];
        process.stdin.on("data",(chunk)=>chunks.push(chunk));
        process.stdin.on("end",()=>{
          try {
            const text=Buffer.concat(chunks).toString("utf8");
            const value=JSON.parse(text);
            const {createHash}=require("node:crypto");
            const [root,buffer,expectedKey,allowedCsv]=process.argv.slice(1);
            const keys=["schema","status","casKeySha256","recordPath","recordSha256","mutationReserved","mutationMayRun","reservedAtUtc"];
            const sort=(input)=>Array.isArray(input)?input.map(sort):input&&typeof input==="object"
              ?Object.fromEntries(Object.keys(input).sort().map((key)=>[key,sort(input[key])])):input;
            const target={schema:"iat-v2-devnet-buffer-authority-target/v1",network:"devnet",
              mutation:"SET_BUFFER_AUTHORITY",casRootPath:root,
              casRootCeremonyId:"9e691e59-35c8-4861-86a0-7a219885b1c0",bufferAddress:buffer};
            const computedKey=createHash("sha256")
              .update(`${JSON.stringify(sort(target),null,2)}\n`).digest("hex");
            const exact=value&&typeof value==="object"&&!Array.isArray(value)
              && JSON.stringify(Object.keys(value))===JSON.stringify(keys)
              && text===`${JSON.stringify(value)}\n`
              && value.schema==="iat-v2-devnet-buffer-authority-cas-result/v2"
              && new Set(allowedCsv.split(",")).has(value.status)
              && /^[0-9a-f]{64}$/.test(value.casKeySha256??"")
              && value.casKeySha256===computedKey
              && (!expectedKey||value.casKeySha256===expectedKey)
              && value.recordPath===`${root}/attempts/${value.casKeySha256}.json`
              && (value.status==="AVAILABLE"
                ? value.recordSha256===null
                : /^[0-9a-f]{64}$/.test(value.recordSha256??""))
              && value.mutationReserved===(value.status!=="AVAILABLE")
              && value.mutationMayRun===(value.status==="RESERVED_CREATED")
              && (value.status==="AVAILABLE"
                ? value.reservedAtUtc===null
                : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value.reservedAtUtc??""));
            if(!exact) process.exit(2);
            process.stdout.write(`${value.status}\n${value.casKeySha256}\n${value.recordSha256??"-"}\n`);
          } catch { process.exit(2); }
        });
      ' "$EXPECTED_CAS_ROOT" "$BUFFER_ADDRESS" "$expected_key" "$allowed_statuses" 9<&-
  )
  (( ${#parsed[@]} == 3 )) || hold "CAS result was not one exact canonical schema-valid record"
  CAS_PARSED_STATUS="${parsed[0]}"
  CAS_PARSED_KEY="${parsed[1]}"
  CAS_PARSED_RECORD_SHA256="${parsed[2]}"
}

iat_v2_snapshot_cas_attempts_identity() {
  local resolved uid mode
  [[ "$CAS_ATTEMPTS_DIR" == /* && ! -L "$CAS_ATTEMPTS_DIR" && -d "$CAS_ATTEMPTS_DIR" ]] \
    || hold "CAS attempts directory is not one absolute non-symlink directory"
  resolved="$(/usr/bin/readlink -f -- "$CAS_ATTEMPTS_DIR" 2>/dev/null || true)"
  uid="$(/usr/bin/stat -Lc '%u' -- "$CAS_ATTEMPTS_DIR" 2>/dev/null || true)"
  mode="$(/usr/bin/stat -Lc '%a' -- "$CAS_ATTEMPTS_DIR" 2>/dev/null || true)"
  CAS_ATTEMPTS_IDENTITY="$(/usr/bin/stat -Lc '%d:%i:%z' -- "$CAS_ATTEMPTS_DIR" 2>/dev/null || true)"
  [[ "$resolved" == "$CAS_ATTEMPTS_DIR" && "$uid" == "1000" && "$mode" == "700" \
      && -n "$CAS_ATTEMPTS_IDENTITY" ]] \
    || hold "CAS attempts directory identity, owner, or mode drifted before attended review"
}

iat_v2_open_and_lock_cas_attempts_fd() {
  local fd_path="/proc/$$/fd/10"
  local resolved configured_identity fd_identity uid mode
  exec 10< "$CAS_ATTEMPTS_DIR" || hold "CAS attempts directory descriptor could not be opened"
  /usr/bin/flock --exclusive --nonblock 10 9<&- \
    || hold "another compliant Devnet buffer handoff owns the CAS namespace lock"
  resolved="$(/usr/bin/readlink -f -- "$fd_path" 9<&- 2>/dev/null || true)"
  configured_identity="$(/usr/bin/stat -Lc '%d:%i:%z' -- "$CAS_ATTEMPTS_DIR" 9<&- 2>/dev/null || true)"
  fd_identity="$(/usr/bin/stat -Lc '%d:%i:%z' -- "$fd_path" 9<&- 2>/dev/null || true)"
  uid="$(/usr/bin/stat -Lc '%u' -- "$fd_path" 9<&- 2>/dev/null || true)"
  mode="$(/usr/bin/stat -Lc '%a' -- "$fd_path" 9<&- 2>/dev/null || true)"
  [[ -d "$fd_path" && "$resolved" == "$CAS_ATTEMPTS_DIR" \
      && "$configured_identity" == "$CAS_ATTEMPTS_IDENTITY" \
      && "$fd_identity" == "$CAS_ATTEMPTS_IDENTITY" \
      && "$uid" == "1000" && "$mode" == "700" ]] \
    || hold "pinned CAS attempts directory identity, owner, or mode drifted"
}

iat_v2_reverify_locked_cas_attempts_fd_before_reserve() {
  local fd_path="/proc/$$/fd/10"
  local resolved configured_identity fd_identity uid mode
  resolved="$(/usr/bin/readlink -f -- "$fd_path" 9<&- 2>/dev/null || true)"
  configured_identity="$(/usr/bin/stat -Lc '%d:%i:%z' -- "$CAS_ATTEMPTS_DIR" 9<&- 2>/dev/null || true)"
  fd_identity="$(/usr/bin/stat -Lc '%d:%i:%z' -- "$fd_path" 9<&- 2>/dev/null || true)"
  uid="$(/usr/bin/stat -Lc '%u' -- "$fd_path" 9<&- 2>/dev/null || true)"
  mode="$(/usr/bin/stat -Lc '%a' -- "$fd_path" 9<&- 2>/dev/null || true)"
  [[ -d "$fd_path" && "$resolved" == "$CAS_ATTEMPTS_DIR" \
      && "$configured_identity" == "$CAS_ATTEMPTS_IDENTITY" \
      && "$fd_identity" == "$CAS_ATTEMPTS_IDENTITY" \
      && "$uid" == "1000" && "$mode" == "700" ]] \
    || hold "locked CAS namespace changed during attended review; no reservation was created"
}

iat_v2_open_verified_reserved_cas_fd() {
  local record_path="/proc/$$/fd/10/${CAS_KEY_SHA256}.json"
  local before_identity after_identity fd_identity uid mode nlink
  [[ "$CAS_KEY_SHA256" =~ ^[0-9a-f]{64}$ && ! -L "$record_path" && -f "$record_path" ]] \
    || hold "reserved CAS record path is not one exact regular non-symlink file"
  before_identity="$(/usr/bin/stat -Lc '%d:%i' -- "$record_path" 9<&- 2>/dev/null || true)"
  exec 11< "$record_path" || hold "reserved CAS record descriptor could not be opened"
  fd_identity="$(/usr/bin/stat -Lc '%d:%i' -- "/proc/$$/fd/11" 9<&- 2>/dev/null || true)"
  after_identity="$(/usr/bin/stat -Lc '%d:%i' -- "$record_path" 9<&- 2>/dev/null || true)"
  uid="$(/usr/bin/stat -Lc '%u' -- "/proc/$$/fd/11" 9<&- 2>/dev/null || true)"
  mode="$(/usr/bin/stat -Lc '%a' -- "/proc/$$/fd/11" 9<&- 2>/dev/null || true)"
  nlink="$(/usr/bin/stat -Lc '%h' -- "/proc/$$/fd/11" 9<&- 2>/dev/null || true)"
  [[ -n "$before_identity" && "$before_identity" == "$fd_identity" \
      && "$after_identity" == "$fd_identity" && "$uid" == "1000" \
      && "$mode" == "600" && "$nlink" == "1" ]] \
    || hold "reserved CAS record identity, owner, mode, or link count drifted while opening"
  CAS_RECORD_IDENTITY="$fd_identity"
  local observed_sha256
  observed_sha256="$(/usr/bin/sha256sum -- "/proc/$$/fd/11" 9<&-)"
  observed_sha256="${observed_sha256%% *}"
  [[ "$CAS_PARSED_RECORD_SHA256" =~ ^[0-9a-f]{64}$ \
      && "$observed_sha256" == "$CAS_PARSED_RECORD_SHA256" ]] \
    || hold "reserved CAS record descriptor content differs from the exact validated reservation"
  CAS_RECORD_SHA256="$observed_sha256"
}

iat_v2_reverify_reserved_cas_fd() {
  local record_path="/proc/$$/fd/10/${CAS_KEY_SHA256}.json"
  local path_identity fd_identity uid mode nlink observed_sha256
  if [[ -L "$record_path" || ! -f "$record_path" || ! -f "/proc/$$/fd/11" ]]; then
    echo "HOLD: reserved CAS record is no longer present at its pinned path" >&2
    return 1
  fi
  path_identity="$(/usr/bin/stat -Lc '%d:%i' -- "$record_path" 9<&- 2>/dev/null || true)"
  fd_identity="$(/usr/bin/stat -Lc '%d:%i' -- "/proc/$$/fd/11" 9<&- 2>/dev/null || true)"
  uid="$(/usr/bin/stat -Lc '%u' -- "/proc/$$/fd/11" 9<&- 2>/dev/null || true)"
  mode="$(/usr/bin/stat -Lc '%a' -- "/proc/$$/fd/11" 9<&- 2>/dev/null || true)"
  nlink="$(/usr/bin/stat -Lc '%h' -- "/proc/$$/fd/11" 9<&- 2>/dev/null || true)"
  observed_sha256="$(/usr/bin/sha256sum -- "/proc/$$/fd/11" 9<&-)"
  observed_sha256="${observed_sha256%% *}"
  if [[ "$path_identity" != "$CAS_RECORD_IDENTITY" || "$fd_identity" != "$CAS_RECORD_IDENTITY" \
      || "$uid" != "1000" || "$mode" != "600" || "$nlink" != "1" \
      || "$observed_sha256" != "$CAS_RECORD_SHA256" ]]; then
    echo "HOLD: reserved CAS record changed after its exact pinned validation" >&2
    return 1
  fi
}

iat_v2_open_pinned_pre_prompt_epoch() {
  [[ ! -L "$ARTIFACT" && -f "$ARTIFACT" ]] || hold "reviewed artifact path is not a regular non-symlink file"
  [[ ! -L "$CAS_HELPER" && -f "$CAS_HELPER" ]] || hold "CAS helper path is not a regular non-symlink file"
  [[ ! -L "$NODE_BIN" && -f "$NODE_BIN" && -x "$NODE_BIN" ]] || hold "Node.js path is not an executable non-symlink file"
  [[ ! -L "$RECONCILER" && -f "$RECONCILER" ]] || hold "reconciler path is not a regular non-symlink file"
  [[ ! -L "$SOLANA_BIN" && -f "$SOLANA_BIN" && -x "$SOLANA_BIN" ]] || hold "Solana CLI path is not an executable non-symlink file"

  exec 3< "$ARTIFACT" || hold "reviewed artifact descriptor could not be opened"
  exec 4< "$CAS_HELPER" || hold "CAS helper descriptor could not be opened"
  exec 6< "$RECONCILER" || hold "reconciler descriptor could not be opened"

  iat_v2_verify_open_fd "/proc/$$/fd/3" "$ARTIFACT" "$EXPECTED_HASH" "$EXPECTED_BYTES" "reviewed artifact" false
  iat_v2_verify_open_fd "/proc/$$/fd/4" "$CAS_HELPER" "$CAS_HELPER_SOURCE_SHA256" "$CAS_HELPER_SOURCE_BYTES" "CAS helper" false
  iat_v2_verify_open_fd "/proc/$$/fd/5" "$NODE_BIN" "$NODE_SHA256" "$NODE_BYTES" "Node.js runtime" true
  iat_v2_verify_open_fd "/proc/$$/fd/6" "$RECONCILER" "$RECONCILER_SOURCE_SHA256" "$RECONCILER_SOURCE_BYTES" "finalized reconciler" false
  iat_v2_verify_open_fd "/proc/$$/fd/7" "$SOLANA_BIN" "$SOLANA_CLI_SHA256" "$SOLANA_CLI_BYTES" "Solana CLI" true

  PINNED_ARTIFACT_PATH="/proc/self/fd/3"
  PINNED_NODE_EXEC="/proc/self/fd/5"
  PINNED_SOLANA_EXEC="/proc/self/fd/7"
  PINNED_RECONCILER_SOURCE="$(/usr/bin/cat <&6; printf '\x1f')"
  PINNED_CAS_SOURCE="$(/usr/bin/cat <&4; printf '\x1f')"
  [[ "${PINNED_RECONCILER_SOURCE: -1}" == $'\x1f' \
      && "${PINNED_CAS_SOURCE: -1}" == $'\x1f' ]] \
    || hold "pre-prompt source capture did not reach every exact descriptor boundary"
  PINNED_RECONCILER_SOURCE="${PINNED_RECONCILER_SOURCE%$'\x1f'}"
  PINNED_CAS_SOURCE="${PINNED_CAS_SOURCE%$'\x1f'}"
  exec 4<&-
  exec 6<&-
  iat_v2_verify_captured_source "$PINNED_RECONCILER_SOURCE" "$RECONCILER_SOURCE_SHA256" "$RECONCILER_SOURCE_BYTES" "reconciler"
  iat_v2_verify_captured_source "$PINNED_CAS_SOURCE" "$CAS_HELPER_SOURCE_SHA256" "$CAS_HELPER_SOURCE_BYTES" "CAS helper"
  iat_v2_verify_captured_source "$PINNED_SEALED_EXEC_SOURCE" "$SEALED_EXEC_SOURCE_SHA256" "$SEALED_EXEC_SOURCE_BYTES" "sealed-exec helper"
  iat_v2_verify_captured_source "$PINNED_TOOLCHAIN_SOURCE" "$TOOLCHAIN_SOURCE_SHA256" "$TOOLCHAIN_SOURCE_BYTES" "attended toolchain"
  iat_v2_verify_captured_source "$PINNED_RUNTIME_BINDING_SOURCE" \
    "$RUNTIME_BINDING_VERIFIER_SOURCE_SHA256" "$RUNTIME_BINDING_VERIFIER_SOURCE_BYTES" \
    "runtime binding verifier"
  readonly PINNED_RECONCILER_SOURCE PINNED_CAS_SOURCE
  iat_v2_verify_root_owned_python
  [[ "$(iat_v2_run_clean_node --version 9<&-)" == "$NODE_VERSION" ]] \
    || hold "sealed Node.js descriptor version drifted"
  [[ "$(iat_v2_run_pinned_solana 45 keyless --version 9<&- 2>&1)" == "$SOLANA_CLI_VERSION" ]] \
    || hold "sealed Solana CLI descriptor version drifted"
}

iat_v2_reverify_pinned_epoch() {
  iat_v2_verify_open_fd "/proc/$$/fd/3" "$ARTIFACT" "$EXPECTED_HASH" "$EXPECTED_BYTES" "reviewed artifact" false
  iat_v2_verify_open_fd "/proc/$$/fd/5" "$NODE_BIN" "$NODE_SHA256" "$NODE_BYTES" "Node.js runtime" true
  iat_v2_verify_open_fd "/proc/$$/fd/7" "$SOLANA_BIN" "$SOLANA_CLI_SHA256" "$SOLANA_CLI_BYTES" "Solana CLI" true
  iat_v2_verify_captured_source "$PINNED_RECONCILER_SOURCE" "$RECONCILER_SOURCE_SHA256" "$RECONCILER_SOURCE_BYTES" "reconciler"
  iat_v2_verify_captured_source "$PINNED_CAS_SOURCE" "$CAS_HELPER_SOURCE_SHA256" "$CAS_HELPER_SOURCE_BYTES" "CAS helper"
  iat_v2_verify_captured_source "$PINNED_SEALED_EXEC_SOURCE" "$SEALED_EXEC_SOURCE_SHA256" "$SEALED_EXEC_SOURCE_BYTES" "sealed-exec helper"
  iat_v2_verify_captured_source "$PINNED_TOOLCHAIN_SOURCE" "$TOOLCHAIN_SOURCE_SHA256" "$TOOLCHAIN_SOURCE_BYTES" "attended toolchain"
  iat_v2_verify_captured_source "$PINNED_RUNTIME_BINDING_SOURCE" \
    "$RUNTIME_BINDING_VERIFIER_SOURCE_SHA256" "$RUNTIME_BINDING_VERIFIER_SOURCE_BYTES" \
    "runtime binding verifier"
  iat_v2_verify_root_owned_python
  [[ "$(iat_v2_run_clean_node --version 9<&-)" == "$NODE_VERSION" ]] \
    || hold "sealed Node.js descriptor version drifted"
  [[ "$(iat_v2_run_pinned_solana 45 keyless --version 9<&- 2>&1)" == "$SOLANA_CLI_VERSION" ]] \
    || hold "sealed Solana CLI descriptor version drifted"
}

iat_v2_run_signer_free_reconciler() {
  [[ -n "$PINNED_RECONCILER_SOURCE" && -n "$PINNED_ARTIFACT_PATH" ]] \
    || hold "pinned reconciler execution epoch is unavailable"
  iat_v2_verify_open_fd "/proc/$$/fd/5" "$NODE_BIN" "$NODE_SHA256" "$NODE_BYTES" "Node.js runtime" true
  iat_v2_verify_open_fd "/proc/$$/fd/3" "$ARTIFACT" "$EXPECTED_HASH" "$EXPECTED_BYTES" "reviewed artifact" false
  iat_v2_verify_captured_source "$PINNED_RECONCILER_SOURCE" "$RECONCILER_SOURCE_SHA256" "$RECONCILER_SOURCE_BYTES" "reconciler"
  printf '%s' "$PINNED_RECONCILER_SOURCE" 9<&- \
    | iat_v2_run_sealed_exec 90 5 "$NODE_SHA256" "$NODE_BYTES" \
      --env HOME=/nonexistent/iat-v2-buffer-reconciler-home \
      --env XDG_CONFIG_HOME=/nonexistent/iat-v2-buffer-reconciler-config \
      --env LANG=C.UTF-8 \
      --env LC_ALL=C.UTF-8 \
      --env PATH=/usr/bin:/bin \
      --env IAT_V2_RECONCILER_STDIN_CLI=iat-v2-devnet-buffer-finalized-reconciler-stdin/v1 \
      --inherit-fd 3 \
      -- node --input-type=module - "$@" --artifact "$PINNED_ARTIFACT_PATH" 9<&-
}

iat_v2_run_pinned_cas() {
  [[ -n "$PINNED_NODE_EXEC" && -n "$PINNED_CAS_SOURCE" ]] \
    || hold "pinned CAS execution epoch is unavailable"
  iat_v2_verify_open_fd "/proc/$$/fd/5" "$NODE_BIN" "$NODE_SHA256" "$NODE_BYTES" "Node.js runtime" true
  iat_v2_verify_captured_source "$PINNED_CAS_SOURCE" "$CAS_HELPER_SOURCE_SHA256" "$CAS_HELPER_SOURCE_BYTES" "CAS helper"
  printf '%s' "$PINNED_CAS_SOURCE" 9<&- \
    | iat_v2_run_sealed_exec 90 5 "$NODE_SHA256" "$NODE_BYTES" \
      --env HOME=/home/a \
      --env LANG=C.UTF-8 \
      --env LC_ALL=C.UTF-8 \
      --env PATH=/usr/bin:/bin \
      --env IAT_V2_HANDOFF_CAS_STDIN_CLI=iat-v2-devnet-buffer-handoff-cas-stdin-v1 \
      --env IAT_V2_PROJECT_ROOT="$SITE_ROOT" \
      --env IAT_V2_HANDOFF_CAS_ATTEMPTS_FD=10 \
      --inherit-fd 10 \
      -- node --input-type=module - "$@" 9<&-
}

iat_v2_capture_pinned_cas() {
  local captured command_status
  set +e
  captured="$(
    iat_v2_run_pinned_cas "$@"
    command_status=$?
    printf '\x1f'
    exit "$command_status"
  )"
  command_status=$?
  set -e
  [[ "${captured: -1}" == $'\x1f' ]] \
    || hold "CAS helper output did not reach its exact capture boundary"
  CAS_CAPTURED_RECORD="${captured%$'\x1f'}"
  CAS_CAPTURED_STATUS="$command_status"
}

fetch_buffer_record() {
  local expected_authority="${1:-}"
  local emit_failure="${2:-true}"
  local status=0
  authority_record=""
  observed_authority=""
  [[ "$expected_authority" == "$EXPECTED_PAYER" || "$expected_authority" == "$NEW_AUTHORITY" ]] \
    || { echo "HOLD: signer-free buffer reconciliation received an unreviewed expected authority." >&2; return 1; }
  [[ -n "$PINNED_NODE_EXEC" && -n "$PINNED_RECONCILER_SOURCE" ]] \
    || { echo "HOLD: pinned signer-free reconciliation epoch is unavailable." >&2; return 1; }
  for ((read_attempt = 1; read_attempt <= 12; read_attempt += 1)); do
    echo "Signer-free finalized buffer reconciliation $read_attempt of 12 for $expected_authority..."
    if authority_record="$(iat_v2_run_signer_free_reconciler \
      --buffer "$BUFFER_ADDRESS" \
      --expected-authority "$expected_authority" 2>&1)"; then
      status=0
    else
      status=$?
    fi
    if (( status == 0 )); then
      if observed_authority="$(printf '%s' "$authority_record" 9<&- | iat_v2_run_clean_node -e '
        const {createHash}=require("node:crypto");
        const chunks=[];
        process.stdin.on("data",(chunk)=>chunks.push(chunk));
        process.stdin.on("end",()=>{
          try {
            const v=JSON.parse(Buffer.concat(chunks));
            const [buffer,authority,artifactHash,artifactBytes,sourceHead,ciRun,evidenceHash,genesis]=process.argv.slice(1);
            const bytes=Number(artifactBytes);
            const run=Number(ciRun);
            const role=authority.startsWith("DYURS")?"DEVNET_DEPLOYER":"MODEL_T_ADMIN";
            const {evidenceFile,evidenceBodySha256,...body}=v;
            const sealed=createHash("sha256").update(Buffer.from(`${JSON.stringify(body,null,2)}\n`,"utf8")).digest("hex");
            const exact=v.schema==="iat-v2-devnet-buffer-finalized-reconciliation/v1"
              && v.status==="EXACT_FINALIZED_BUFFER" && v.network==="devnet"
              && v.rpc==="https://api.devnet.solana.com" && v.genesisHash===genesis
              && v.commitment==="finalized" && Number.isSafeInteger(v.minContextSlot) && v.minContextSlot>0
              && Number.isSafeInteger(v.accountContextSlot) && v.accountContextSlot>=v.minContextSlot
              && v.bufferAddress===buffer && v.expectedAuthority===authority
              && v.observedAuthority===authority && v.observedAuthorityRole===role
              && v.account?.owner==="BPFLoaderUpgradeab1e11111111111111111111111"
              && v.account?.executable===false && /^[0-9]+$/.test(v.account?.lamports??"")
              && v.account?.dataBytes===bytes+37 && v.account?.metadataBytes===37
              && v.account?.stateTag===1 && v.account?.authorityOption===1
              && v.account?.programBytes===bytes && v.account?.programSha256===artifactHash
              && v.publicCiArtifact?.bytes===bytes && v.publicCiArtifact?.sha256===artifactHash
              && v.publicCiArtifact?.sourceHeadCommit===sourceHead && v.publicCiArtifact?.ciRunId===run
              && v.publicCiArtifact?.evidenceManifestSha256===evidenceHash
              && v.comparison?.classification==="EXACT_ARTIFACT" && v.comparison?.exact===true
              && v.comparison?.matchingPrefixBytes===bytes && v.comparison?.expectedRemainingBytes===0
              && v.comparison?.firstMismatchOffset===null && v.comparison?.observedProgramBytes===bytes
              && v.comparison?.observedProgramSha256===artifactHash
              && v.validation?.authorityAdmitted===true && v.validation?.authorityMatchesExpected===true
              && v.validation?.sizeMatches===true && v.validation?.hashMatches===true
              && v.validation?.exact===true && v.validation?.partialExactPrefixZeroTail===false
              && Array.isArray(v.validation?.holdReasons) && v.validation.holdReasons.length===0
              && v.boundary?.mutationAuthorized===false && v.boundary?.signing===false
              && v.boundary?.broadcast===false && v.boundary?.protectedRecoveryStateRead===false
              && v.boundary?.next==="SEPARATE_ATTENDED_ACTION_REVIEW_REQUIRED"
              && evidenceFile===null && /^[0-9a-f]{64}$/.test(evidenceBodySha256??"")
              && sealed===evidenceBodySha256;
            if(!exact) process.exit(2);
            process.stdout.write(v.observedAuthority);
          } catch { process.exit(2); }
        });
      ' "$BUFFER_ADDRESS" "$expected_authority" "$EXPECTED_HASH" "$EXPECTED_BYTES" "$SOURCE_HEAD" "$CI_RUN_ID" "$EVIDENCE_HASH" "$DEVNET_GENESIS_HASH")"; then
        printf '%s\n' "$authority_record"
        return 0
      else
        status=$?
      fi
    fi
    if ! is_retryable_rpc_error "$status" "$authority_record" || (( read_attempt == 12 )); then
      [[ "$emit_failure" == "true" ]] && printf '%s\n' "$authority_record" >&2
      return 1
    fi
    /usr/bin/sleep 10 9<&-
  done
  return 1
}

open_verified_payer_fd() {
  local configured_real=""
  local configured_identity=""
  local configured_identity_after=""
  local fd_path="/proc/$$/fd/9"
  local fd_real=""
  local fd_identity=""
  local fd_mode=""
  local fd_uid=""
  local fd_nlink=""
  if [[ "$PAYER_KEYPAIR" != /* || -L "$PAYER_KEYPAIR" || ! -f "$PAYER_KEYPAIR" ]]; then
    echo "HOLD: payer keypair must be an absolute, non-symlink regular file." >&2
    return 1
  fi
  configured_real="$(/usr/bin/readlink -f -- "$PAYER_KEYPAIR" 2>/dev/null || true)"
  configured_identity="$(/usr/bin/stat -Lc '%d:%i' -- "$PAYER_KEYPAIR" 2>/dev/null || true)"
  if [[ -z "$configured_real" || -z "$configured_identity" ]]; then
    echo "HOLD: payer keypair identity could not be observed before opening it." >&2
    return 1
  fi
  if ! exec 9< "$PAYER_KEYPAIR"; then
    echo "HOLD: payer keypair could not be opened after attended confirmation." >&2
    return 1
  fi
  fd_real="$(/usr/bin/readlink -f -- "$fd_path" 9<&- 2>/dev/null || true)"
  fd_identity="$(/usr/bin/stat -Lc '%d:%i' -- "$fd_path" 9<&- 2>/dev/null || true)"
  configured_identity_after="$(/usr/bin/stat -Lc '%d:%i' -- "$PAYER_KEYPAIR" 9<&- 2>/dev/null || true)"
  fd_mode="$(/usr/bin/stat -Lc '%a' -- "$fd_path" 9<&- 2>/dev/null || true)"
  fd_uid="$(/usr/bin/stat -Lc '%u' -- "$fd_path" 9<&- 2>/dev/null || true)"
  fd_nlink="$(/usr/bin/stat -Lc '%h' -- "$fd_path" 9<&- 2>/dev/null || true)"
  if [[ -L "$PAYER_KEYPAIR" || ! -f "$fd_path" \
      || "$fd_real" != "$configured_real" \
      || "$fd_identity" != "$configured_identity" \
      || "$configured_identity_after" != "$configured_identity" ]]; then
    echo "HOLD: payer keypair path identity changed while it was opened." >&2
    exec 9<&-
    return 1
  fi
  if [[ "$fd_mode" != "600" || "$fd_uid" != "1000" || "$fd_nlink" != "1" ]]; then
    echo "HOLD: opened payer keypair must be uid 1000, exact mode 0600, and single-linked." >&2
    exec 9<&-
    return 1
  fi
  PAYER_FD_PATH="/proc/self/fd/9"
}

reverify_open_payer_fd() {
  local fd_path="/proc/$$/fd/9"
  local configured_identity fd_identity fd_mode fd_uid fd_nlink
  if [[ "$PAYER_KEYPAIR" != /* || -L "$PAYER_KEYPAIR" || ! -f "$PAYER_KEYPAIR" ]]; then
    echo "HOLD: payer keypair path changed after it was opened." >&2
    return 1
  fi
  configured_identity="$(/usr/bin/stat -Lc '%d:%i' -- "$PAYER_KEYPAIR" 9<&- 2>/dev/null || true)"
  fd_identity="$(/usr/bin/stat -Lc '%d:%i' -- "$fd_path" 9<&- 2>/dev/null || true)"
  fd_mode="$(/usr/bin/stat -Lc '%a' -- "$fd_path" 9<&- 2>/dev/null || true)"
  fd_uid="$(/usr/bin/stat -Lc '%u' -- "$fd_path" 9<&- 2>/dev/null || true)"
  fd_nlink="$(/usr/bin/stat -Lc '%h' -- "$fd_path" 9<&- 2>/dev/null || true)"
  if [[ -z "$configured_identity" || "$configured_identity" != "$fd_identity" \
      || "$fd_mode" != "600" || "$fd_uid" != "1000" || "$fd_nlink" != "1" ]]; then
    echo "HOLD: opened payer keypair identity, owner, mode, or link count drifted." >&2
    return 1
  fi
}

observe_handoff_fee_floor() {
  local balance_output
  [[ -n "$PINNED_SOLANA_EXEC" ]] \
    || hold "pinned Solana execution epoch is unavailable for the finalized payer balance"
  balance_output="$(iat_v2_run_pinned_solana 45 keyless balance "$EXPECTED_PAYER" \
    --url devnet --commitment finalized --lamports 9<&-)" \
    || hold "finalized payer balance was unavailable before the one-use handoff"
  read -r handoff_balance_lamports _ <<<"$balance_output"
  [[ "$handoff_balance_lamports" =~ ^[0-9]+$ ]] || hold "unexpected finalized payer balance output"
  (( handoff_balance_lamports >= DEVNET_HANDOFF_FEE_FLOOR_LAMPORTS )) \
    || hold "finalized payer balance is below the reviewed single-handoff fee floor of $DEVNET_HANDOFF_FEE_FLOOR_LAMPORTS lamports"
}

cleanup() {
  local status=$?
  trap - EXIT
  if (( status != 0 )) \
    && [[ "$CAS_RESERVATION_BOUNDARY_ENTERED" == "true" \
      || "$CAS_MUTATION_PERMANENTLY_RESERVED" == "true" \
      || "$CAS_RESERVATION_STATE_UNCERTAIN" == "true" ]]; then
    echo "DO NOT RESUBMIT. A durable mutation reservation exists or may exist; preserve it and use signer-free finalized reconciliation only." >&2
  fi
  { exec 3<&-; } 2>/dev/null || true
  { exec 4<&-; } 2>/dev/null || true
  { exec 5<&-; } 2>/dev/null || true
  { exec 6<&-; } 2>/dev/null || true
  { exec 7<&-; } 2>/dev/null || true
  { exec 8<&-; } 2>/dev/null || true
  { exec 9<&-; } 2>/dev/null || true
  { exec 10<&-; } 2>/dev/null || true
  { exec 11<&-; } 2>/dev/null || true
  exit "$status"
}
trap cleanup EXIT

iat_v2_main() {
iat_v2_open_pinned_pre_prompt_epoch
iat_v2_snapshot_cas_attempts_identity
iat_v2_open_and_lock_cas_attempts_fd
CAS_RESERVATION_STATE_UNCERTAIN="true"
iat_v2_capture_pinned_cas inspect "${CAS_ARGS[@]}"
cas_record="$CAS_CAPTURED_RECORD"
cas_command_status="$CAS_CAPTURED_STATUS"
if (( cas_command_status != 0 )); then
  echo "HOLD: durable one-use authority reservation could not be validated; no keypair was accessed." >&2
  exit "$cas_command_status"
fi
printf '%s' "$cas_record"
iat_v2_parse_exact_cas_result "$cas_record" "" "AVAILABLE,RESERVED_EXISTING"
cas_status="$CAS_PARSED_STATUS"
CAS_KEY_SHA256="$CAS_PARSED_KEY"
CAS_RESERVATION_STATE_UNCERTAIN="false"
if [[ "$cas_status" == "RESERVED_EXISTING" ]]; then
  CAS_MUTATION_PERMANENTLY_RESERVED="true"
  iat_v2_open_verified_reserved_cas_fd
  iat_v2_reverify_reserved_cas_fd \
    || hold "existing durable reservation lost its exact pinned identity"
  echo "A durable one-use mutation reservation already exists. Performing exact read-only finalized reconciliation only."
  if ! fetch_buffer_record "$NEW_AUTHORITY"; then
    iat_v2_reverify_reserved_cas_fd || true
    echo "HOLD: finalized buffer identity, bytes, or authority remains ambiguous for the permanently reserved mutation." >&2
    echo "DO NOT RESUBMIT. Return to Codex for read-only reconciliation." >&2
    exit 1
  fi
  iat_v2_reverify_reserved_cas_fd \
    || hold "existing durable reservation changed during read-only reconciliation; do not resubmit"
  if [[ "$observed_authority" == "$NEW_AUTHORITY" ]]; then
    echo "BUFFER AUTHORITY IS FINALIZED AT 7XZ. THE RESERVED MUTATION WILL NOT BE REPEATED."
    exit 0
  fi
  echo "HOLD: the mutation is permanently reserved but exact finalized state does not show 7XZ." >&2
  echo "DO NOT RESUBMIT. Return to Codex for read-only reconciliation." >&2
  exit 1
fi
if [[ "$cas_status" != "AVAILABLE" ]]; then
  echo "HOLD: unexpected durable reservation state $cas_status." >&2
  exit 1
fi

iat_v2_verify_pinned_devnet_genesis
if fetch_buffer_record "$NEW_AUTHORITY" false; then
  echo "BUFFER AUTHORITY ALREADY HELD BY 7XZ. NO MUTATION IS NEEDED."
  exit 0
fi
if ! fetch_buffer_record "$EXPECTED_PAYER"; then
  echo "HOLD: exact finalized buffer identity, bytes, and authority could not be established before handoff." >&2
  exit 1
fi

echo "BUFFER:          $BUFFER_ADDRESS"
echo "FROM:            $EXPECTED_PAYER"
echo "TO:              $NEW_AUTHORITY"
echo "ARTIFACT SHA-256: $EXPECTED_HASH"
echo "ARTIFACT BYTES:   $EXPECTED_BYTES"
echo "NODE PATH:        $NODE_BIN"
echo "NODE VERSION:     $NODE_VERSION"
echo "NODE SHA-256:     $NODE_SHA256"
echo "NODE BYTES:       $NODE_BYTES"
echo "GIT PATH:         $GIT_BIN"
echo "GIT VERSION:      $GIT_VERSION"
echo "GIT SHA-256:      $GIT_SHA256"
echo "GIT BYTES:        $GIT_BYTES"
echo "SOLANA PATH:      $SOLANA_BIN"
echo "SOLANA VERSION:   $SOLANA_CLI_VERSION"
echo "SOLANA SHA-256:   $SOLANA_CLI_SHA256"
echo "SOLANA BYTES:     $SOLANA_CLI_BYTES"
echo "SEALED EXEC PYTHON: $SEALED_EXEC_PYTHON"
echo "PYTHON VERSION:     $SEALED_EXEC_PYTHON_VERSION"
echo "PYTHON SHA-256:     $SEALED_EXEC_PYTHON_SHA256"
echo "DEVNET GENESIS:   $DEVNET_GENESIS_HASH"
echo "HANDOFF FEE FLOOR: $DEVNET_HANDOFF_FEE_FLOOR_LAMPORTS lamports"
echo "This cannot upload a second buffer and cannot touch mainnet."
echo "TRUST LIMIT: the root-owned Ubuntu OS runtime (Bash/system utilities, loaders/shared libraries, and Python modules) plus the WSL kernel/procfs boundary is reviewed but not individually SHA-256-bound."
echo "LOCK LIMIT: filesystem locks serialize compliant launchers; same-uid hostile writers require an external protected CAS broker."
if ! exec 8<>/dev/tty; then
  echo "HOLD: an attached readable/writable /dev/tty is required; piped stdin is not an attended confirmation." >&2
  exit 1
fi
confirmation_challenge="TRANSFER-$BUFFER_ADDRESS-${EXPECTED_HASH:0:12}"
printf '%s' "Type $confirmation_challenge exactly to continue: " >&8
if ! IFS= read -r confirmation <&8; then
  exec 8>&-
  echo "HOLD: attended confirmation could not be read from /dev/tty." >&2
  exit 1
fi
exec 8>&-
if [[ "$confirmation" != "$confirmation_challenge" ]]; then
  echo "Cancelled. Nothing was broadcast."
  exit 1
fi

iat_v2_reverify_pinned_epoch
iat_v2_verify_pinned_devnet_genesis
iat_v2_reverify_locked_cas_attempts_fd_before_reserve
open_verified_payer_fd
/usr/bin/flock --exclusive --nonblock 9 \
  || hold "another compliant payer-authorized Devnet writer owns the exclusive signer lock"
reverify_open_payer_fd
actual_payer="$(iat_v2_run_pinned_solana 45 signer address -k "$PAYER_FD_PATH")"
if [[ "$actual_payer" != "$EXPECTED_PAYER" ]]; then
  echo "HOLD: opened payer identity is $actual_payer, expected $EXPECTED_PAYER" >&2
  exec 9<&-
  exit 1
fi

observe_handoff_fee_floor 9<&-
echo "FINALIZED DEVNET PAYER BALANCE: $handoff_balance_lamports lamports"
reverify_open_payer_fd
[[ "$(iat_v2_run_pinned_solana 45 signer address -k "$PAYER_FD_PATH")" == "$EXPECTED_PAYER" ]] \
  || hold "opened payer identity drifted before the one-use reservation"
if ! fetch_buffer_record "$EXPECTED_PAYER"; then
  hold "exact finalized buffer identity, bytes, or authority could not be re-established after the attended pause"
fi
[[ "$observed_authority" == "$EXPECTED_PAYER" ]] \
  || hold "finalized buffer authority changed after the attended pause; no reservation was created"
iat_v2_reverify_pinned_epoch
iat_v2_reverify_locked_cas_attempts_fd_before_reserve
reverify_open_payer_fd
[[ "$(iat_v2_run_pinned_solana 45 signer address -k "$PAYER_FD_PATH")" == "$EXPECTED_PAYER" ]] \
  || hold "opened payer identity drifted immediately before the one-use reservation"
observe_handoff_fee_floor
echo "FINAL PRE-RESERVATION DEVNET PAYER BALANCE: $handoff_balance_lamports lamports"
CAS_RESERVATION_BOUNDARY_ENTERED="true"
iat_v2_capture_pinned_cas reserve "${CAS_ARGS[@]}"
cas_record="$CAS_CAPTURED_RECORD"
cas_command_status="$CAS_CAPTURED_STATUS"
if (( cas_command_status != 0 )); then
  echo "HOLD: durable one-use mutation reservation did not return exact success. No mutation was attempted." >&2
  echo "DO NOT RERUN. Inspect the persistent CAS record and finalized Devnet state read-only." >&2
  exec 9<&-
  exit "$cas_command_status"
fi
CAS_MUTATION_PERMANENTLY_RESERVED="true"
printf '%s' "$cas_record"
iat_v2_parse_exact_cas_result "$cas_record" "$CAS_KEY_SHA256" "RESERVED_CREATED,RESERVED_EXISTING" 9<&-
cas_status="$CAS_PARSED_STATUS"
created_record_sha256="$CAS_PARSED_RECORD_SHA256"
if [[ "$cas_status" == "RESERVED_EXISTING" ]]; then
  iat_v2_open_verified_reserved_cas_fd
  iat_v2_reverify_reserved_cas_fd \
    || hold "concurrent durable reservation lost its exact pinned identity"
  exec 9<&-
  echo "Another process already reserved this mutation. This process will reconcile read-only and will not submit."
  if ! fetch_buffer_record "$NEW_AUTHORITY"; then
    iat_v2_reverify_reserved_cas_fd || true
    echo "HOLD: exact finalized state remains ambiguous for the concurrently reserved mutation." >&2
    echo "DO NOT RESUBMIT. Return to Codex for read-only reconciliation." >&2
    exit 1
  fi
  iat_v2_reverify_reserved_cas_fd \
    || hold "concurrent durable reservation changed during read-only reconciliation; do not resubmit"
  if [[ "$observed_authority" == "$NEW_AUTHORITY" ]]; then
    echo "BUFFER AUTHORITY IS FINALIZED AT 7XZ. THE RESERVED MUTATION WILL NOT BE REPEATED."
    exit 0
  fi
  echo "HOLD: another process reserved the mutation but exact finalized state does not show 7XZ." >&2
  echo "DO NOT RESUBMIT. Return to Codex for read-only reconciliation." >&2
  exit 1
fi
if [[ "$cas_status" != "RESERVED_CREATED" ]]; then
  echo "HOLD: mutation reservation was not atomically created. No mutation was attempted." >&2
  exec 9<&-
  exit 1
fi

iat_v2_capture_pinned_cas inspect "${CAS_ARGS[@]}"
if (( CAS_CAPTURED_STATUS != 0 )); then
  exec 9<&-
  echo "HOLD: created reservation could not be re-inspected exactly. No mutation was attempted." >&2
  echo "DO NOT RESUBMIT. Return to Codex for read-only CAS reconciliation." >&2
  exit "$CAS_CAPTURED_STATUS"
fi
printf '%s' "$CAS_CAPTURED_RECORD"
iat_v2_parse_exact_cas_result "$CAS_CAPTURED_RECORD" "$CAS_KEY_SHA256" "RESERVED_EXISTING" 9<&-
[[ "$CAS_PARSED_RECORD_SHA256" == "$created_record_sha256" ]] \
  || hold "created reservation digest changed between reserve and immediate pinned reinspection"
[[ "$CAS_PARSED_STATUS" == "RESERVED_EXISTING" ]] \
  || hold "created reservation was not exact on immediate pinned reinspection"
iat_v2_open_verified_reserved_cas_fd
iat_v2_reverify_reserved_cas_fd \
  || hold "created durable reservation lost its exact pinned identity before mutation"
iat_v2_reverify_pinned_epoch
reverify_open_payer_fd
[[ "$(iat_v2_run_pinned_solana 45 signer address -k "$PAYER_FD_PATH")" == "$EXPECTED_PAYER" ]] \
  || hold "opened payer identity drifted after the permanent reservation"
observe_handoff_fee_floor
if ! fetch_buffer_record "$EXPECTED_PAYER"; then
  echo "HOLD: exact finalized buffer state became ambiguous after permanent reservation." >&2
  echo "DO NOT RESUBMIT. Return to Codex for read-only reconciliation." >&2
  exit 1
fi
[[ "$observed_authority" == "$EXPECTED_PAYER" ]] \
  || hold "finalized buffer authority changed after permanent reservation; do not resubmit"
iat_v2_reverify_reserved_cas_fd \
  || hold "created durable reservation changed immediately before mutation; do not resubmit"
reverify_open_payer_fd
[[ "$(iat_v2_run_pinned_solana 45 signer address -k "$PAYER_FD_PATH")" == "$EXPECTED_PAYER" ]] \
  || hold "opened payer identity drifted immediately before the one-use mutation; do not resubmit"
iat_v2_reverify_reserved_cas_fd \
  || hold "created durable reservation changed at the final signer boundary; do not resubmit"

echo "Submitting the one-use authority mutation exactly once..."
set +e
output="$(iat_v2_run_pinned_solana 90 signer program set-buffer-authority "$BUFFER_ADDRESS" \
  --new-buffer-authority "$NEW_AUTHORITY" \
  --buffer-authority "$PAYER_FD_PATH" \
  --url devnet \
  --keypair "$PAYER_FD_PATH" \
  --commitment finalized 2>&1)"
mutation_status=$?
set -e
if ! iat_v2_reverify_reserved_cas_fd; then
  exec 9<&-
  echo "HOLD: durable CAS record changed during the one-use mutation attempt." >&2
  echo "DO NOT RESUBMIT. The mutation may already have run; reconcile finalized state read-only." >&2
  exit 1
fi
exec 9<&-
echo "$output"

echo "Mutation command status: $mutation_status. Beginning exact read-only finalized reconciliation."
if ! fetch_buffer_record "$NEW_AUTHORITY"; then
  iat_v2_reverify_reserved_cas_fd || true
  echo "HOLD: finalized buffer identity, bytes, or authority is ambiguous after the one-use mutation attempt." >&2
  echo "DO NOT RESUBMIT. Return to Codex for read-only reconciliation." >&2
  exit 1
fi
iat_v2_reverify_reserved_cas_fd \
  || hold "durable CAS record changed after the one-use mutation attempt; do not resubmit"
if [[ "$observed_authority" == "$NEW_AUTHORITY" ]]; then
  echo
  echo "BUFFER AUTHORITY HANDED TO 7XZ AT FINALIZED COMMITMENT. RETURN TO CODEX."
  exit 0
fi
if [[ "$observed_authority" == "$EXPECTED_PAYER" ]]; then
  echo "HOLD: exact finalized state still shows the expected payer after the one-use mutation attempt." >&2
  echo "DO NOT RESUBMIT. Return to Codex for read-only reconciliation." >&2
  exit 1
fi

echo "HOLD: exact finalized state shows an unexpected buffer authority after the one-use mutation attempt." >&2
echo "DO NOT RESUBMIT. Return to Codex for read-only reconciliation." >&2
exit 1
}

iat_v2_main "$@"
}

iat_v2_entrypoint "$@"
