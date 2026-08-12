#!/usr/bin/env bash

set -euo pipefail

schema="iat-b3-economy-sbf-structural-preflight/v1"
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
site_dir=$(cd -- "$script_dir/.." && pwd -P)
program_id="GLb6VMiKEhRRfYnD1p3a3iCAR3kgtRr8qdHxEHAzbdDU"
rpc_port="${IAT_B3_ECONOMY_PREFLIGHT_RPC_PORT:-19099}"
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

target_root="$site_dir/tests/fixtures/iat-b3-economy-sbf-preflight"
mkdir -p -- "$target_root/target"
temp_dir=$(mktemp -d "$target_root/target/local-validator.XXXXXX")
temp_dir=$(cd -- "$temp_dir" && pwd -P)
case "$temp_dir" in
  "$target_root"/target/local-validator.*) ;;
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
    "$target_root"/target/local-validator.*) rm -rf -- "$temp_dir" ;;
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

cargo build-sbf \
  --manifest-path "$site_dir/programs/iat_b3_economy/Cargo.toml" \
  --features sbf-preflight-entrypoint \
  --sbf-out-dir "$temp_dir/deploy" \
  -- --locked >/dev/null
artifact="$temp_dir/deploy/iat_b3_economy.so"
[[ -s "$artifact" ]]

for name in payer readonly-signer writable-dummy readonly-dummy; do
  solana-keygen new --no-bip39-passphrase --silent --force --outfile "$temp_dir/$name.json" >/dev/null 2>&1
done
readonly_signer=$(solana-keygen pubkey "$temp_dir/readonly-signer.json")
writable_dummy=$(solana-keygen pubkey "$temp_dir/writable-dummy.json")
readonly_dummy=$(solana-keygen pubkey "$temp_dir/readonly-dummy.json")

ledger="$temp_dir/ledger"
solana-test-validator \
  --ledger "$ledger" \
  --bpf-program "$program_id" "$artifact" \
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

for account in payer readonly-signer writable-dummy readonly-dummy; do
  pubkey=$(solana-keygen pubkey "$temp_dir/$account.json")
  solana airdrop 2 "$pubkey" --url "$rpc_url" --commitment finalized >/dev/null
done

"$node_bin" "$(to_node_path "$script_dir/iat-b3-economy-sbf-preflight-driver.mjs")" \
  --network local \
  --rpc "$rpc_url" \
  --program "$program_id" \
  --payer "$(to_node_path "$temp_dir/payer.json")" \
  --readonly-signer "$(to_node_path "$temp_dir/readonly-signer.json")" \
  --writable-dummy "$writable_dummy" \
  --readonly-dummy "$readonly_dummy" \
  --artifact "$(to_node_path "$artifact")"

cleanup
trap - EXIT INT TERM
printf '{"schema":"%s","status":"PASS","mode":"summary","publicNetworkWrites":false,"temporaryLedgerRemoved":true,"validatorStopped":true,"generatedKeyMaterialRemoved":true}\n' "$schema"
