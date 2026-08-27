#!/usr/bin/bash
set -euo pipefail
set +x
umask 077

hold() { echo "HOLD: $*" >&2; exit 1; }

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

SCRIPT_DIR="$(cd -- "$(/usr/bin/dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
SITE_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"
[[ "$SITE_ROOT" == "/mnt/c/Users/A/Documents/Codex/2026-08-13/can-you-take-over-b3-architecture-3/work/iat-b3-bpk00-package-bound-fd12-owner-root-public-key-anchor-clean/projects/star-ascent/site" ]] \
  || hold "site root is not the one exact reviewed checkout"
cd -- "$SITE_ROOT"
source "$SCRIPT_DIR/lib/iat-v2-attended-solana-toolchain.sh"

SOLANA_BIN="$IAT_V2_EXPECTED_SOLANA_CLI_PATH"
PAYER_KEYPAIR="/home/a/.config/solana/iat-v2-devnet-deployer.json"
NODE_BIN="$IAT_V2_EXPECTED_NODE_PATH"
GIT_BIN="$IAT_V2_EXPECTED_GIT_PATH"
ARTIFACT="$SITE_ROOT/target/verifiable/iat_v2.so"
EVIDENCE="$SITE_ROOT/target/verifiable/iat-v2-build-evidence.json"
BUFFER_ADDRESS="${BUFFER_ADDRESS:-}"
IAT_V2_HANDOFF_CAS_ROOT="${IAT_V2_HANDOFF_CAS_ROOT:-}"
EXPECTED_CAS_ROOT="/home/a/.local/state/internal-agency/iat-v2/devnet-buffer-handoff-v1"
EXPECTED_PAYER="DYURSZnNLak5YNt2vLJUnU5iWDUbAo53oUfzZ8dVc5d4"
NEW_AUTHORITY="7XZjd7aNNci63LZy9syqgjvjNHvkQ83Uwo7cyynrfzPH"
DEVNET_HANDOFF_FEE_FLOOR_LAMPORTS="10000000"

iat_v2_verify_exact_tool \
  "$NODE_BIN" \
  "$IAT_V2_EXPECTED_NODE_PATH" \
  "$IAT_V2_EXPECTED_NODE_VERSION" \
  "$IAT_V2_EXPECTED_NODE_SHA256" \
  "$IAT_V2_EXPECTED_NODE_BYTES" \
  "Node.js runtime"
NODE_BIN="$IAT_V2_VERIFIED_TOOL_PATH"
NODE_VERSION="$IAT_V2_VERIFIED_TOOL_VERSION"
NODE_SHA256="$IAT_V2_VERIFIED_TOOL_SHA256"
NODE_BYTES="$IAT_V2_VERIFIED_TOOL_BYTES"

iat_v2_verify_exact_git "$GIT_BIN"
GIT_BIN="$IAT_V2_VERIFIED_TOOL_PATH"
GIT_VERSION="$IAT_V2_VERIFIED_TOOL_VERSION"
GIT_SHA256="$IAT_V2_VERIFIED_TOOL_SHA256"
GIT_BYTES="$IAT_V2_VERIFIED_TOOL_BYTES"

iat_v2_run_clean_node() {
  /usr/bin/env -i \
    HOME=/home/a \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    PATH=/usr/bin:/bin \
    "$NODE_BIN" "$@"
}

binding_diagnostics="$(/usr/bin/mktemp /tmp/iat-v2-binding-diagnostics-XXXXXX.txt)"
set +e
binding_record="$(iat_v2_run_clean_node scripts/iat-v2-devnet-buffer-preflight.mjs verify \
  --artifact "$ARTIFACT" \
  --evidence "$EVIDENCE" 2>"$binding_diagnostics")"
binding_status=$?
set -e
if [[ -s "$binding_diagnostics" ]]; then
  /usr/bin/cat -- "$binding_diagnostics" >&2
fi
/usr/bin/rm -f -- "$binding_diagnostics"
printf '%s\n' "$binding_record"
if (( binding_status != 0 )); then
  echo "HOLD: migration artifact/evidence binding did not pass; no authority handoff was attempted." >&2
  exit "$binding_status"
fi
mapfile -t binding_fields < <(
  printf '%s' "$binding_record" \
    | iat_v2_run_clean_node -e 'const chunks=[]; process.stdin.on("data", (chunk) => chunks.push(chunk)); process.stdin.on("end", () => { const value=JSON.parse(Buffer.concat(chunks)); const fields=[value.artifactSha256,value.artifactBytes,value.evidenceManifestSha256,value.sourceHeadCommit,value.sourceHeadTree,value.ciRunId,value.ciRunAttempt,value.gitPath,value.gitVersion,value.gitSha256,value.gitBytes]; process.stdout.write(`${fields.join("\n")}\n`); });'
)
if (( ${#binding_fields[@]} != 11 )); then
  echo "HOLD: migration binding output did not contain the exact artifact, source, CI, and Git identity fields." >&2
  exit 1
fi
EXPECTED_HASH="${binding_fields[0]}"
EXPECTED_BYTES="${binding_fields[1]}"
EVIDENCE_HASH="${binding_fields[2]}"
SOURCE_HEAD="${binding_fields[3]}"
SOURCE_TREE="${binding_fields[4]}"
CI_RUN_ID="${binding_fields[5]}"
CI_RUN_ATTEMPT="${binding_fields[6]}"
BINDING_GIT_PATH="${binding_fields[7]}"
BINDING_GIT_VERSION="${binding_fields[8]}"
BINDING_GIT_SHA256="${binding_fields[9]}"
BINDING_GIT_BYTES="${binding_fields[10]}"
if [[ "$BINDING_GIT_PATH" != "$GIT_BIN" \
    || "$BINDING_GIT_VERSION" != "$GIT_VERSION" \
    || "$BINDING_GIT_SHA256" != "$GIT_SHA256" \
    || "$BINDING_GIT_BYTES" != "$GIT_BYTES" ]]; then
  echo "HOLD: migration preflight returned a different Git runtime identity." >&2
  exit 1
fi
if [[ -z "$BUFFER_ADDRESS" ]]; then
  echo "HOLD: BUFFER_ADDRESS is required; no default or historical buffer is admitted." >&2
  exit 1
fi
if [[ "$IAT_V2_HANDOFF_CAS_ROOT" != "$EXPECTED_CAS_ROOT" ]]; then
  echo "HOLD: IAT_V2_HANDOFF_CAS_ROOT must equal the one exact reviewed persistent namespace: $EXPECTED_CAS_ROOT" >&2
  exit 1
fi

iat_v2_verify_exact_tool \
  "$SOLANA_BIN" \
  "$IAT_V2_EXPECTED_SOLANA_CLI_PATH" \
  "$IAT_V2_EXPECTED_SOLANA_CLI_VERSION" \
  "$IAT_V2_EXPECTED_SOLANA_CLI_SHA256" \
  "$IAT_V2_EXPECTED_SOLANA_CLI_BYTES" \
  "Solana CLI"
SOLANA_BIN="$IAT_V2_VERIFIED_TOOL_PATH"
SOLANA_CLI_VERSION="$IAT_V2_VERIFIED_TOOL_VERSION"
SOLANA_CLI_SHA256="$IAT_V2_VERIFIED_TOOL_SHA256"
SOLANA_CLI_BYTES="$IAT_V2_VERIFIED_TOOL_BYTES"
iat_v2_verify_devnet_genesis "$SOLANA_BIN"
DEVNET_GENESIS_HASH="$IAT_V2_VERIFIED_DEVNET_GENESIS_HASH"

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
       "$message" == *"Timeout"* ]]
}

iat_v2_reverify_node() {
  local label="$1"
  iat_v2_verify_exact_tool \
    "$NODE_BIN" \
    "$IAT_V2_EXPECTED_NODE_PATH" \
    "$IAT_V2_EXPECTED_NODE_VERSION" \
    "$IAT_V2_EXPECTED_NODE_SHA256" \
    "$IAT_V2_EXPECTED_NODE_BYTES" \
    "$label"
  NODE_BIN="$IAT_V2_VERIFIED_TOOL_PATH"
}

iat_v2_reverify_git() {
  iat_v2_verify_exact_git "$GIT_BIN"
  GIT_BIN="$IAT_V2_VERIFIED_TOOL_PATH"
}

iat_v2_reverify_solana_and_devnet() {
  local label="$1"
  iat_v2_verify_exact_tool \
    "$SOLANA_BIN" \
    "$IAT_V2_EXPECTED_SOLANA_CLI_PATH" \
    "$IAT_V2_EXPECTED_SOLANA_CLI_VERSION" \
    "$IAT_V2_EXPECTED_SOLANA_CLI_SHA256" \
    "$IAT_V2_EXPECTED_SOLANA_CLI_BYTES" \
    "$label"
  SOLANA_BIN="$IAT_V2_VERIFIED_TOOL_PATH"
  iat_v2_verify_devnet_genesis "$SOLANA_BIN"
  DEVNET_GENESIS_HASH="$IAT_V2_VERIFIED_DEVNET_GENESIS_HASH"
}

validate_exact_buffer_address() {
  local line=""
  local address_lines=0
  local exact_address_lines=0
  while IFS= read -r line; do
    if [[ "$line" == "Buffer Address: "* ]]; then
      address_lines=$((address_lines + 1))
      if [[ "$line" == "Buffer Address: $BUFFER_ADDRESS" ]]; then
        exact_address_lines=$((exact_address_lines + 1))
      fi
    fi
  done <<< "$authority_record"
  if (( address_lines != 1 || exact_address_lines != 1 )); then
    echo "HOLD: finalized program show did not identify exactly the requested Buffer Address: $BUFFER_ADDRESS." >&2
    return 1
  fi
}

extract_exact_buffer_authority() {
  local line=""
  local authority_lines=0
  observed_authority=""
  while IFS= read -r line; do
    if [[ "$line" == "Authority: "* ]]; then
      authority_lines=$((authority_lines + 1))
      observed_authority="${line#Authority: }"
    fi
  done <<< "$authority_record"
  if (( authority_lines != 1 )) || [[ -z "$observed_authority" ]]; then
    echo "HOLD: finalized program show did not contain one exact, non-empty Authority line." >&2
    return 1
  fi
}

verify_exact_finalized_buffer_dump() {
  local dump_complete=false
  local output=""
  local status=0
  local observed_hash=""
  local observed_bytes=""
  for read_attempt in $(/usr/bin/seq 1 12); do
    echo "Finalized exact buffer dump $read_attempt of 12..."
    if [[ -L "$dump_path" || ! -f "$dump_path" ]]; then
      echo "HOLD: the private buffer-dump scratch path changed identity." >&2
      return 1
    fi
    : > "$dump_path"
    if output="$(iat_v2_run_keyless_solana_timeout 90 "$SOLANA_BIN" program dump "$BUFFER_ADDRESS" "$dump_path" \
      --url devnet \
      --commitment finalized 2>&1)"; then
      echo "$output"
      dump_complete=true
      break
    else
      status=$?
    fi
    echo "$output"
    if ! is_retryable_rpc_error "$status" "$output"; then
      break
    fi
    /usr/bin/sleep 10
  done
  if [[ "$dump_complete" != "true" || -L "$dump_path" || ! -f "$dump_path" ]]; then
    echo "HOLD: exact finalized buffer bytes could not be observed." >&2
    return 1
  fi
  observed_bytes="$(/usr/bin/stat -c '%s' -- "$dump_path")"
  observed_hash="$(/usr/bin/sha256sum -- "$dump_path")"
  observed_hash="${observed_hash%% *}"
  if [[ "$observed_bytes" != "$EXPECTED_BYTES" || "$observed_hash" != "$EXPECTED_HASH" ]]; then
    echo "HOLD: finalized buffer bytes do not match the exact reviewed artifact." >&2
    echo "EXPECTED SHA-256/BYTES: $EXPECTED_HASH / $EXPECTED_BYTES" >&2
    echo "OBSERVED SHA-256/BYTES: $observed_hash / $observed_bytes" >&2
    return 1
  fi
}

fetch_buffer_record() {
  local status=0
  authority_record=""
  observed_authority=""
  iat_v2_reverify_solana_and_devnet "Solana CLI at finalized buffer observation"
  for read_attempt in $(/usr/bin/seq 1 12); do
    echo "Finalized buffer identity read $read_attempt of 12..."
    if authority_record="$(iat_v2_run_keyless_solana_timeout 45 "$SOLANA_BIN" program show "$BUFFER_ADDRESS" \
      --url devnet \
      --commitment finalized 2>&1)"; then
      echo "$authority_record"
      break
    else
      status=$?
    fi
    echo "$authority_record"
    if ! is_retryable_rpc_error "$status" "$authority_record"; then
      return 1
    fi
    if (( read_attempt == 12 )); then
      return 1
    fi
    /usr/bin/sleep 10
  done
  validate_exact_buffer_address || return 1
  verify_exact_finalized_buffer_dump || return 1
  extract_exact_buffer_authority || return 1
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
  fd_real="$(/usr/bin/readlink -f -- "$fd_path" 2>/dev/null || true)"
  fd_identity="$(/usr/bin/stat -Lc '%d:%i' -- "$fd_path" 2>/dev/null || true)"
  configured_identity_after="$(/usr/bin/stat -Lc '%d:%i' -- "$PAYER_KEYPAIR" 2>/dev/null || true)"
  fd_mode="$(/usr/bin/stat -Lc '%a' -- "$fd_path" 2>/dev/null || true)"
  fd_uid="$(/usr/bin/stat -Lc '%u' -- "$fd_path" 2>/dev/null || true)"
  fd_nlink="$(/usr/bin/stat -Lc '%h' -- "$fd_path" 2>/dev/null || true)"
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
  configured_identity="$(/usr/bin/stat -Lc '%d:%i' -- "$PAYER_KEYPAIR" 2>/dev/null || true)"
  fd_identity="$(/usr/bin/stat -Lc '%d:%i' -- "$fd_path" 2>/dev/null || true)"
  fd_mode="$(/usr/bin/stat -Lc '%a' -- "$fd_path" 2>/dev/null || true)"
  fd_uid="$(/usr/bin/stat -Lc '%u' -- "$fd_path" 2>/dev/null || true)"
  fd_nlink="$(/usr/bin/stat -Lc '%h' -- "$fd_path" 2>/dev/null || true)"
  if [[ -z "$configured_identity" || "$configured_identity" != "$fd_identity" \
      || "$fd_mode" != "600" || "$fd_uid" != "1000" || "$fd_nlink" != "1" ]]; then
    echo "HOLD: opened payer keypair identity, owner, mode, or link count drifted." >&2
    return 1
  fi
}

observe_handoff_fee_floor() {
  local balance_output
  balance_output="$(iat_v2_run_keyless_solana_timeout 45 "$SOLANA_BIN" balance "$EXPECTED_PAYER" \
    --url devnet --commitment finalized --lamports)" \
    || hold "finalized payer balance was unavailable before the one-use handoff"
  read -r handoff_balance_lamports _ <<<"$balance_output"
  [[ "$handoff_balance_lamports" =~ ^[0-9]+$ ]] || hold "unexpected finalized payer balance output"
  (( handoff_balance_lamports >= DEVNET_HANDOFF_FEE_FLOOR_LAMPORTS )) \
    || hold "finalized payer balance is below the reviewed single-handoff fee floor of $DEVNET_HANDOFF_FEE_FLOOR_LAMPORTS lamports"
}

dump_path="$(/usr/bin/mktemp /tmp/iat-v2-handoff-buffer-XXXXXX.so)"
cleanup() {
  exec 9<&- 2>/dev/null || true
  /usr/bin/rm -f -- "$dump_path"
}
trap cleanup EXIT

iat_v2_reverify_git
iat_v2_reverify_node "Node.js runtime immediately before durable reservation inspection"
set +e
cas_record="$(iat_v2_run_clean_node scripts/iat-v2-devnet-buffer-handoff-cas.mjs inspect "${CAS_ARGS[@]}")"
cas_command_status=$?
set -e
if (( cas_command_status != 0 )); then
  echo "HOLD: durable one-use authority reservation could not be validated; no keypair was accessed." >&2
  exit "$cas_command_status"
fi
printf '%s\n' "$cas_record"
cas_status="$(printf '%s' "$cas_record" | iat_v2_run_clean_node -e 'const chunks=[]; process.stdin.on("data", (chunk) => chunks.push(chunk)); process.stdin.on("end", () => process.stdout.write(JSON.parse(Buffer.concat(chunks)).status));')"
if [[ "$cas_status" == "RESERVED_EXISTING" ]]; then
  echo "A durable one-use mutation reservation already exists. Performing exact read-only finalized reconciliation only."
  if ! fetch_buffer_record; then
    echo "HOLD: finalized buffer identity, bytes, or authority remains ambiguous for the permanently reserved mutation." >&2
    echo "DO NOT RESUBMIT. Return to Codex for read-only reconciliation." >&2
    exit 1
  fi
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

if ! fetch_buffer_record; then
  echo "HOLD: exact finalized buffer identity, bytes, and authority could not be established before handoff." >&2
  exit 1
fi
if [[ "$observed_authority" == "$NEW_AUTHORITY" ]]; then
  echo "BUFFER AUTHORITY ALREADY HELD BY 7XZ. NO MUTATION IS NEEDED."
  exit 0
fi
if [[ "$observed_authority" != "$EXPECTED_PAYER" ]]; then
  echo "HOLD: exact finalized buffer authority is neither the expected payer nor 7XZ." >&2
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
echo "DEVNET GENESIS:   $DEVNET_GENESIS_HASH"
echo "HANDOFF FEE FLOOR: $DEVNET_HANDOFF_FEE_FLOOR_LAMPORTS lamports"
echo "This cannot upload a second buffer and cannot touch mainnet."
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

iat_v2_reverify_solana_and_devnet "Solana CLI before payer-keypair inspection"
open_verified_payer_fd
actual_payer="$(iat_v2_run_keyless_solana "$SOLANA_BIN" address -k "$PAYER_FD_PATH")"
if [[ "$actual_payer" != "$EXPECTED_PAYER" ]]; then
  echo "HOLD: opened payer identity is $actual_payer, expected $EXPECTED_PAYER" >&2
  exec 9<&-
  exit 1
fi

iat_v2_reverify_solana_and_devnet "Solana CLI before final attended reobservation" 9<&-
observe_handoff_fee_floor 9<&-
echo "FINALIZED DEVNET PAYER BALANCE: $handoff_balance_lamports lamports"
reverify_open_payer_fd
[[ "$(iat_v2_run_keyless_solana "$SOLANA_BIN" address -k "$PAYER_FD_PATH")" == "$EXPECTED_PAYER" ]] \
  || hold "opened payer identity drifted before the one-use reservation"
iat_v2_reverify_git 9<&-
iat_v2_reverify_node "Node.js runtime immediately before durable reservation creation" 9<&-
if ! fetch_buffer_record 9<&-; then
  hold "exact finalized buffer identity, bytes, or authority could not be re-established after the attended pause"
fi
[[ "$observed_authority" == "$EXPECTED_PAYER" ]] \
  || hold "finalized buffer authority changed after the attended pause; no reservation was created"
set +e
cas_record="$(iat_v2_run_clean_node scripts/iat-v2-devnet-buffer-handoff-cas.mjs reserve "${CAS_ARGS[@]}" 9<&-)"
cas_command_status=$?
set -e
if (( cas_command_status != 0 )); then
  echo "HOLD: durable one-use mutation reservation failed. No mutation was attempted." >&2
  exec 9<&-
  exit "$cas_command_status"
fi
printf '%s\n' "$cas_record"
case "$cas_record" in
  *'"status":"RESERVED_CREATED"'*) cas_status="RESERVED_CREATED" ;;
  *'"status":"RESERVED_EXISTING"'*) cas_status="RESERVED_EXISTING" ;;
  *) cas_status="UNRECOGNIZED" ;;
esac
if [[ "$cas_status" == "RESERVED_EXISTING" ]]; then
  exec 9<&-
  echo "Another process already reserved this mutation. This process will reconcile read-only and will not submit."
  if ! fetch_buffer_record; then
    echo "HOLD: exact finalized state remains ambiguous for the concurrently reserved mutation." >&2
    echo "DO NOT RESUBMIT. Return to Codex for read-only reconciliation." >&2
    exit 1
  fi
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

echo "Submitting the one-use authority mutation exactly once..."
set +e
output="$(iat_v2_run_keyless_solana_timeout 90 "$SOLANA_BIN" program set-buffer-authority "$BUFFER_ADDRESS" \
  --new-buffer-authority "$NEW_AUTHORITY" \
  --buffer-authority "$PAYER_FD_PATH" \
  --url devnet \
  --keypair "$PAYER_FD_PATH" \
  --commitment finalized 2>&1)"
mutation_status=$?
set -e
exec 9<&-
echo "$output"

echo "Mutation command status: $mutation_status. Beginning exact read-only finalized reconciliation."
if ! fetch_buffer_record; then
  echo "HOLD: finalized buffer identity, bytes, or authority is ambiguous after the one-use mutation attempt." >&2
  echo "DO NOT RESUBMIT. Return to Codex for read-only reconciliation." >&2
  exit 1
fi
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
