#!/usr/bin/env bash

set -euo pipefail

schema="iat-b3-close-position-production-handler-loopback/v1"
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
site_dir=$(cd -- "$script_dir/.." && pwd -P)
fixture_dir="$site_dir/tests/fixtures/iat-b3-close-position"
driver="$script_dir/iat-b3-close-position-local-driver.mjs"
evidence="$site_dir/docs/b3/evidence/local-validator-close-position-production-handler-20260812.json"
work_root="${IAT_B3_CLOSE_POSITION_WORK_ROOT:-${TMPDIR:-/tmp}/iat-b3-close-position}"
rpc_port="${IAT_B3_CLOSE_POSITION_RPC_PORT:-19239}"
rpc_url="http://127.0.0.1:${rpc_port}"
faucet_port=$((rpc_port - 1))
dynamic_min=$((rpc_port + 2))
dynamic_max=$((rpc_port + 102))
node_bin="${IAT_B3_NODE:-$(command -v node || true)}"
git_head="${IAT_B3_GIT_HEAD:-}"

for command_name in cargo solana solana-keygen solana-test-validator sha256sum awk grep mktemp; do
  command -v "$command_name" >/dev/null 2>&1 || {
    printf '{"schema":"%s","status":"FAIL","reason":"missing_tool","tool":"%s","publicNetworkWrites":false}\n' "$schema" "$command_name"
    exit 2
  }
done
[[ -n "$node_bin" && -x "$node_bin" ]] || {
  printf '{"schema":"%s","status":"FAIL","reason":"missing_tool","tool":"node>=22","publicNetworkWrites":false}\n' "$schema"
  exit 2
}
node_major=$("$node_bin" -p 'Number(process.versions.node.split(".")[0])')
[[ "$node_major" -ge 22 ]] || {
  printf '{"schema":"%s","status":"FAIL","reason":"unsupported_node","observedMajor":%s,"requiredMajor":22,"publicNetworkWrites":false}\n' "$schema" "$node_major"
  exit 2
}
[[ "$git_head" =~ ^[0-9a-f]{40}$ ]] || {
  printf '{"schema":"%s","status":"FAIL","reason":"missing_or_invalid_exact_git_head","publicNetworkWrites":false}\n' "$schema"
  exit 2
}

mkdir -p -- "$work_root"
work_root=$(cd -- "$work_root" && pwd -P)
temp_dir=$(mktemp -d "$work_root/run.XXXXXX")
temp_dir=$(cd -- "$temp_dir" && pwd -P)
case "$temp_dir" in
  "$work_root"/run.*) ;;
  *) exit 1 ;;
esac

validator_pid=""
cleanup_complete=false
candidate="$evidence.candidate"
handoff="$work_root/evidence-input.$$.jsonl"
cleanup() {
  local status=0
  if [[ -n "$validator_pid" ]]; then
    if kill -0 "$validator_pid" >/dev/null 2>&1; then
      kill "$validator_pid" >/dev/null 2>&1 || status=1
    fi
    wait "$validator_pid" >/dev/null 2>&1 || true
    validator_pid=""
  fi
  case "$temp_dir" in
    "$work_root"/run.*) rm -rf -- "$temp_dir" || status=1 ;;
    *) status=1 ;;
  esac
  [[ ! -e "$temp_dir" ]] || status=1
  [[ $status -eq 0 ]] && cleanup_complete=true
  return "$status"
}
finish() {
  local status=$?
  if ! $cleanup_complete; then
    cleanup || status=1
  fi
  if [[ $status -ne 0 ]]; then
    rm -f -- "$candidate" "$handoff"
    printf '{"schema":"%s","status":"FAIL","phase":"%s","publicNetworkWrites":false,"temporaryLedgerRemoved":%s,"validatorStopped":%s}\n' \
      "$schema" "$phase" "$cleanup_complete" "$cleanup_complete"
  fi
  exit "$status"
}
trap finish EXIT
trap 'exit 130' INT TERM

to_node_path() {
  local path=$1
  if [[ "$node_bin" == *.exe ]] && command -v wslpath >/dev/null 2>&1; then
    wslpath -w "$path"
  else
    printf '%s\n' "$path"
  fi
}

phase="prepare"
rm -f -- "$candidate"
mkdir -p -- "$temp_dir/fixtures" "$temp_dir/deploy"
solana-keygen new --no-bip39-passphrase --silent --force --outfile "$temp_dir/payer.json" >/dev/null 2>&1
solana-keygen new --no-bip39-passphrase --silent --force --outfile "$temp_dir/caller.json" >/dev/null 2>&1
payer_pubkey=$(solana-keygen pubkey "$temp_dir/payer.json")
caller_pubkey=$(solana-keygen pubkey "$temp_dir/caller.json")
"$node_bin" "$(to_node_path "$driver")" \
  --mode prepare-fixture \
  --fixture-dir "$(to_node_path "$temp_dir/fixtures")" \
  --env "$(to_node_path "$temp_dir/accounts.env")" \
  --payer-pubkey "$payer_pubkey" \
  --caller-pubkey "$caller_pubkey" >"$temp_dir/evidence.jsonl"

# Contains fixture public addresses only.
# shellcheck disable=SC1090
source "$temp_dir/accounts.env"

phase="sbf_build"
canonical_diagnostics='Stack offset of|stack frame.*exceeds|max offset exceeded|overwrites values|undefined behavior'
RUSTFLAGS='-C llvm-args=--bpf-stack-size=4096' \
CARGO_TARGET_DIR="$temp_dir/cargo-target" \
cargo build-sbf \
  --manifest-path "$fixture_dir/Cargo.toml" \
  --sbf-out-dir "$temp_dir/deploy" \
  --tools-version v1.52 \
  --skip-tools-install \
  -- --locked 2>&1 | tee "$temp_dir/build-sbf.log" >/dev/null
artifact="$temp_dir/deploy/iat_b3_close_position_rehearsal.so"
[[ -s "$artifact" ]]
if grep -Eiq "$canonical_diagnostics" "$temp_dir/build-sbf.log"; then
  printf '{"schema":"%s","status":"FAIL","reason":"canonical_sbf_compiler_diagnostic","publicNetworkWrites":false}\n' "$schema"
  exit 1
fi
artifact_sha256=$(sha256sum "$artifact" | awk '{print $1}')
artifact_bytes=$(wc -c <"$artifact" | tr -d '[:space:]')

phase="validator_start"
solana-test-validator \
  --ledger "$temp_dir/ledger" \
  --bpf-program "$PROGRAM_ID" "$artifact" \
  --account "$LAW_STATE" "$temp_dir/fixtures/law.json" \
  --account "$CONFIG" "$temp_dir/fixtures/config.json" \
  --account "$POSITION" "$temp_dir/fixtures/position.json" \
  --account "$TREASURY" "$temp_dir/fixtures/treasury.json" \
  --account "$ECOSYSTEM" "$temp_dir/fixtures/ecosystem.json" \
  --account "$LIQUIDITY" "$temp_dir/fixtures/liquidity.json" \
  --rpc-port "$rpc_port" \
  --faucet-port "$faucet_port" \
  --dynamic-port-range "${dynamic_min}-${dynamic_max}" \
  --ticks-per-slot 4 \
  --reset \
  --quiet >"$temp_dir/validator.log" 2>&1 &
validator_pid=$!
for _ in $(seq 1 240); do
  solana cluster-version --url "$rpc_url" >/dev/null 2>&1 && break
  if ! kill -0 "$validator_pid" >/dev/null 2>&1; then
    cat "$temp_dir/validator.log" >&2
    exit 1
  fi
  sleep 0.1
done
solana cluster-version --url "$rpc_url" >/dev/null
solana airdrop 10 "$payer_pubkey" --url "$rpc_url" --commitment finalized >/dev/null
solana airdrop 1 "$caller_pubkey" --url "$rpc_url" --commitment finalized >/dev/null

phase="law_first"
"$node_bin" "$(to_node_path "$driver")" \
  --mode law-first --rpc "$rpc_url" --payer "$(to_node_path "$temp_dir/payer.json")" \
  --caller "$(to_node_path "$temp_dir/caller.json")" --law-state "$LAW_STATE" >>"$temp_dir/evidence.jsonl"
phase="late_failure"
"$node_bin" "$(to_node_path "$driver")" \
  --mode late-failure --rpc "$rpc_url" --payer "$(to_node_path "$temp_dir/payer.json")" \
  --caller "$(to_node_path "$temp_dir/caller.json")" --law-state "$LAW_STATE" >>"$temp_dir/evidence.jsonl"
phase="success"
"$node_bin" "$(to_node_path "$driver")" \
  --mode success --rpc "$rpc_url" --payer "$(to_node_path "$temp_dir/payer.json")" \
  --caller "$(to_node_path "$temp_dir/caller.json")" --law-state "$LAW_STATE" >>"$temp_dir/evidence.jsonl"

phase="cleanup"
cp -- "$temp_dir/evidence.jsonl" "$handoff"
cleanup
trap - EXIT INT TERM
phase="evidence"
"$node_bin" "$(to_node_path "$driver")" \
  --mode finalize-evidence \
  --output "$(to_node_path "$candidate")" \
  --site-root "$(to_node_path "$site_dir")" \
  --git-head "$git_head" \
  --artifact-bytes "$artifact_bytes" \
  --artifact-sha256 "$artifact_sha256" <"$handoff"
rm -f -- "$handoff"
mv -- "$candidate" "$evidence"
printf '{"schema":"%s","status":"PASS","phase":"summary","exactProductionClosePositionSourceImported":true,"productionClosePositionHandlerSbfExecutionObserved":true,"runtimeDailyLawBeforeDecodeObserved":true,"syntheticProductionActiveConfigAuthenticated":true,"exactFourStateCasObserved":true,"lateFailureFourStateTransactionRollbackObserved":true,"rawBytesAndBalancesChecked":true,"loopbackRpcOnly":true,"temporaryLedgerRemoved":true,"validatorStopped":true,"generatedKeyMaterialRemoved":true,"productionProgramErrorAbiProven":false,"productionDispatcherProven":false,"productionEntrypointProven":false,"productionFinalCombinedBinaryProven":false,"publicDevnetExecuted":false,"all15HandlersComplete":false,"mainnetExecutionAuthorized":false,"mainnetStatus":"HOLD"}\n' "$schema"
