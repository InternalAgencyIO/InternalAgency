#!/usr/bin/env bash

set -euo pipefail

schema="iat-b3-account-lifecycle-local-validator/v1"
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
site_dir=$(cd -- "$script_dir/.." && pwd -P)
fixture_root="$site_dir/tests/fixtures/iat-b3-account-lifecycle"
rpc_port="${IAT_B3_ACCOUNT_LIFECYCLE_RPC_PORT:-19199}"
rpc_url="http://127.0.0.1:${rpc_port}"
faucet_port=$((rpc_port - 1))
dynamic_min=$((rpc_port + 2))
dynamic_max=$((rpc_port + 102))
node_bin="${IAT_B3_NODE:-$(command -v node || true)}"

for command_name in cargo solana solana-keygen solana-test-validator; do
  command -v "$command_name" >/dev/null 2>&1 || {
    printf '{"schema":"%s","status":"FAIL","reason":"missing_tool","tool":"%s","publicNetworkWrites":false}\n' "$schema" "$command_name"
    exit 2
  }
done
[[ -n "$node_bin" && -x "$node_bin" ]] || {
  printf '{"schema":"%s","status":"FAIL","reason":"missing_tool","tool":"node>=22","publicNetworkWrites":false}\n' "$schema"
  exit 2
}

node_major=$($node_bin -p 'Number(process.versions.node.split(".")[0])')
[[ "$node_major" -ge 22 ]] || {
  printf '{"schema":"%s","status":"FAIL","reason":"unsupported_node","observedMajor":%s,"requiredMajor":22,"publicNetworkWrites":false}\n' "$schema" "$node_major"
  exit 2
}

mkdir -p -- "$fixture_root/target"
temp_dir=$(mktemp -d "$fixture_root/target/local-validator.XXXXXX")
temp_dir=$(cd -- "$temp_dir" && pwd -P)
case "$temp_dir" in
  "$fixture_root"/target/local-validator.*) ;;
  *) exit 1 ;;
esac

validator_pid=""
cleanup() {
  if [[ -n "$validator_pid" ]]; then
    kill "$validator_pid" >/dev/null 2>&1 || true
    wait "$validator_pid" >/dev/null 2>&1 || true
    validator_pid=""
  fi
  case "$temp_dir" in
    "$fixture_root"/target/local-validator.*) rm -rf -- "$temp_dir" ;;
    *) return 1 ;;
  esac
}
trap cleanup EXIT INT TERM

to_node_path() {
  if [[ "$node_bin" == *.exe ]] && command -v wslpath >/dev/null 2>&1; then
    wslpath -w "$1"
  else
    printf '%s\n' "$1"
  fi
}

driver="$script_dir/iat-b3-account-lifecycle-local-driver.mjs"
"$node_bin" "$(to_node_path "$driver")" \
  --mode prepare-fixture \
  --fixture "$(to_node_path "$temp_dir/law.json")" \
  --env "$(to_node_path "$temp_dir/accounts.env")"

# Contains only fixture public addresses.
# shellcheck disable=SC1090
source "$temp_dir/accounts.env"

cargo build-sbf \
  --manifest-path "$fixture_root/Cargo.toml" \
  --sbf-out-dir "$temp_dir/deploy" \
  -- --locked >/dev/null
artifact="$temp_dir/deploy/iat_b3_account_lifecycle_rehearsal.so"
[[ -s "$artifact" ]]

solana-keygen new --no-bip39-passphrase --silent --force --outfile "$temp_dir/payer.json" >/dev/null 2>&1
payer_pubkey=$(solana-keygen pubkey "$temp_dir/payer.json")

solana-test-validator \
  --ledger "$temp_dir/ledger" \
  --bpf-program "$PROGRAM_ID" "$artifact" \
  --account "$LAW_STATE" "$temp_dir/law.json" \
  --rpc-port "$rpc_port" \
  --faucet-port "$faucet_port" \
  --dynamic-port-range "${dynamic_min}-${dynamic_max}" \
  --ticks-per-slot 4 \
  --reset \
  --quiet >"$temp_dir/validator.log" 2>&1 &
validator_pid=$!

for _ in $(seq 1 240); do
  solana cluster-version --url "$rpc_url" >/dev/null 2>&1 && break
  kill -0 "$validator_pid" >/dev/null 2>&1 || exit 1
  sleep 0.1
done
solana cluster-version --url "$rpc_url" >/dev/null
solana airdrop 10 "$payer_pubkey" --url "$rpc_url" --commitment finalized >/dev/null

for mode in zero prefunded rollback; do
  "$node_bin" "$(to_node_path "$driver")" \
    --mode "$mode" \
    --rpc "$rpc_url" \
    --payer "$(to_node_path "$temp_dir/payer.json")" \
    --law-state "$LAW_STATE"
done

cleanup
trap - EXIT INT TERM
printf '{"schema":"%s","status":"PASS","phase":"summary","realSystemCpiObserved":true,"canonicalPdaSigningObserved":true,"prefundedAllocateAssignFundObserved":true,"transactionRollbackObserved":true,"syntheticDailyLawFixture":true,"publicNetworkWrites":false,"fullFeatureDevnetRehearsalComplete":false,"activationReady":false,"mainnetStatus":"HOLD","temporaryLedgerRemoved":true,"validatorStopped":true,"generatedKeyMaterialRemoved":true}\n' "$schema"
