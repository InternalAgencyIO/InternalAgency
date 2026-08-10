#!/usr/bin/env bash

set -euo pipefail

schema="iat-b3-economy-sbf-structural-preflight/v1"
rpc_url="https://api.devnet.solana.com"
expected_genesis="EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG"
expected_payer="DYURSZnNLak5YNt2vLJUnU5iWDUbAo53oUfzZ8dVc5d4"
expected_artifact_bytes=21120
expected_artifact_sha256="3bdffb2bcd9ee919e012d71522c8667883efea196ce5b58a2aef354b720a1588"
minimum_payer_lamports=300000000

[[ "${1:-}" == "--execute" && $# -eq 1 ]] || {
  printf '{"schema":"%s","status":"HOLD","reason":"explicit_execute_flag_required","publicNetworkWrites":false,"mainnetStatus":"HOLD"}\n' "$schema"
  exit 2
}

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
site_dir=$(cd -- "$script_dir/.." && pwd -P)
node_bin="${IAT_B3_NODE:-$(command -v node || true)}"
payer_path="${IAT_B3_DEVNET_PAYER:-}"

for command_name in cargo solana solana-keygen sha256sum stat; do
  command -v "$command_name" >/dev/null 2>&1 || {
    printf '{"schema":"%s","status":"FAIL","reason":"missing_tool","tool":"%s","publicNetworkWrites":false}\n' "$schema" "$command_name"
    exit 2
  }
done
[[ -n "$node_bin" && -x "$node_bin" ]] || {
  printf '{"schema":"%s","status":"FAIL","reason":"missing_tool","tool":"node>=22","publicNetworkWrites":false}\n' "$schema"
  exit 2
}
"$node_bin" -e 'if (Number(process.versions.node.split(".")[0]) < 22) process.exit(1)' || {
  printf '{"schema":"%s","status":"FAIL","reason":"node_version_below_22","publicNetworkWrites":false}\n' "$schema"
  exit 2
}

[[ -n "$payer_path" && "$payer_path" = /* && -f "$payer_path" && ! -L "$payer_path" ]] || {
  printf '{"schema":"%s","status":"FAIL","reason":"absolute_regular_payer_keypair_required","publicNetworkWrites":false}\n' "$schema"
  exit 2
}
payer_path=$(realpath -- "$payer_path")
case "$payer_path" in
  "$site_dir"/*)
    printf '{"schema":"%s","status":"FAIL","reason":"payer_keypair_must_be_outside_repository","publicNetworkWrites":false}\n' "$schema"
    exit 2
    ;;
esac
permissions=$(stat -c '%a' "$payer_path")
[[ "$permissions" == "600" || "$permissions" == "400" ]] || {
  printf '{"schema":"%s","status":"FAIL","reason":"payer_keypair_permissions_must_be_0600_or_0400","publicNetworkWrites":false}\n' "$schema"
  exit 2
}
payer_pubkey=$(solana-keygen pubkey "$payer_path")
[[ "$payer_pubkey" == "$expected_payer" ]] || {
  printf '{"schema":"%s","status":"FAIL","reason":"unexpected_payer","publicNetworkWrites":false}\n' "$schema"
  exit 2
}
genesis=$(solana genesis-hash --url "$rpc_url")
[[ "$genesis" == "$expected_genesis" ]] || {
  printf '{"schema":"%s","status":"FAIL","reason":"devnet_genesis_mismatch","publicNetworkWrites":false}\n' "$schema"
  exit 2
}
balance_output=$(solana balance "$payer_path" --url "$rpc_url" --commitment finalized --lamports)
balance_lamports=$(printf '%s\n' "$balance_output" | awk '{print $1}')
[[ "$balance_lamports" =~ ^[0-9]+$ && "$balance_lamports" -ge "$minimum_payer_lamports" ]] || {
  printf '{"schema":"%s","status":"FAIL","reason":"insufficient_devnet_payer_balance","publicNetworkWrites":false}\n' "$schema"
  exit 2
}

to_node_path() {
  if [[ "$node_bin" == *.exe ]] && command -v wslpath >/dev/null 2>&1; then
    wslpath -w "$1"
  else
    printf '%s\n' "$1"
  fi
}

temp_dir=$(mktemp -d /tmp/iat-b3-economy-devnet.XXXXXX)
temp_dir=$(cd -- "$temp_dir" && pwd -P)
case "$temp_dir" in
  /tmp/iat-b3-economy-devnet.*) ;;
  *) exit 1 ;;
esac

funded_keys=()
cleanup() {
  local cleanup_status=0
  for key_name in "${funded_keys[@]:-}"; do
    [[ -n "$key_name" && -f "$temp_dir/$key_name.json" ]] || continue
    solana transfer "$payer_pubkey" ALL \
      --from "$temp_dir/$key_name.json" \
      --fee-payer "$payer_path" \
      --allow-unfunded-recipient \
      --url "$rpc_url" \
      --commitment finalized \
      --output json-compact || cleanup_status=1
  done
  case "$temp_dir" in
    /tmp/iat-b3-economy-devnet.*) rm -rf -- "$temp_dir" ;;
    *) cleanup_status=1 ;;
  esac
  return "$cleanup_status"
}
trap cleanup EXIT INT TERM

for key_name in program readonly-signer writable-dummy readonly-dummy; do
  solana-keygen new --no-bip39-passphrase --silent --force --outfile "$temp_dir/$key_name.json" >/dev/null 2>&1
  chmod 600 "$temp_dir/$key_name.json"
done
program_id=$(solana-keygen pubkey "$temp_dir/program.json")
readonly_signer=$(solana-keygen pubkey "$temp_dir/readonly-signer.json")
writable_dummy=$(solana-keygen pubkey "$temp_dir/writable-dummy.json")
readonly_dummy=$(solana-keygen pubkey "$temp_dir/readonly-dummy.json")

cargo build-sbf \
  --manifest-path "$site_dir/programs/iat_b3_economy/Cargo.toml" \
  --features sbf-preflight-entrypoint \
  --sbf-out-dir "$temp_dir/deploy" \
  -- --locked >/dev/null
artifact="$temp_dir/deploy/iat_b3_economy.so"
artifact_bytes=$(wc -c < "$artifact" | tr -d '[:space:]')
artifact_sha256=$(sha256sum "$artifact" | awk '{print $1}')
[[ "$artifact_bytes" == "$expected_artifact_bytes" && "$artifact_sha256" == "$expected_artifact_sha256" ]] || {
  printf '{"schema":"%s","status":"FAIL","reason":"artifact_binding_mismatch","publicNetworkWrites":false}\n' "$schema"
  exit 2
}

printf '{"schema":"%s","status":"READY","mode":"canonical-devnet","rpc":"%s","genesisHash":"%s","payer":"%s","programId":"%s","artifact":{"bytes":%s,"sha256":"%s"},"publicNetworkWrites":false,"mainnetStatus":"HOLD"}\n' \
  "$schema" "$rpc_url" "$genesis" "$payer_pubkey" "$program_id" "$artifact_bytes" "$artifact_sha256"

deploy_result=$(solana program deploy "$artifact" \
  --program-id "$temp_dir/program.json" \
  --keypair "$payer_path" \
  --fee-payer "$payer_path" \
  --upgrade-authority "$payer_path" \
  --final \
  --url "$rpc_url" \
  --commitment finalized \
  --use-rpc \
  --output json-compact)
printf '{"schema":"%s","status":"WRITE_OBSERVED","phase":"immutable_program_deploy","programId":"%s","cli":%s,"publicNetworkWrites":true,"mainnetStatus":"HOLD"}\n' \
  "$schema" "$program_id" "$deploy_result"

for key_name in readonly-signer writable-dummy readonly-dummy; do
  recipient=$(solana-keygen pubkey "$temp_dir/$key_name.json")
  transfer_result=$(solana transfer "$recipient" 0.001 \
    --from "$payer_path" \
    --fee-payer "$payer_path" \
    --allow-unfunded-recipient \
    --url "$rpc_url" \
    --commitment finalized \
    --output json-compact)
  funded_keys+=("$key_name")
  printf '{"schema":"%s","status":"WRITE_OBSERVED","phase":"fund_disposable_account","role":"%s","address":"%s","cli":%s,"publicNetworkWrites":true,"mainnetStatus":"HOLD"}\n' \
    "$schema" "$key_name" "$recipient" "$transfer_result"
done

"$node_bin" "$(to_node_path "$script_dir/iat-b3-economy-sbf-preflight-driver.mjs")" \
  --network devnet \
  --rpc "$rpc_url" \
  --program "$program_id" \
  --payer "$(to_node_path "$payer_path")" \
  --readonly-signer "$(to_node_path "$temp_dir/readonly-signer.json")" \
  --writable-dummy "$writable_dummy" \
  --readonly-dummy "$readonly_dummy" \
  --artifact "$(to_node_path "$artifact")"

cleanup
funded_keys=()
trap - EXIT INT TERM
printf '{"schema":"%s","status":"PASS","mode":"summary","programId":"%s","immutableProgram":true,"operationCount":15,"temporaryAccountsRemoved":true,"generatedKeyMaterialRemoved":true,"fullEconomicHandlerRehearsalComplete":false,"mainnetExecutionAuthorized":false,"mainnetStatus":"HOLD"}\n' \
  "$schema" "$program_id"
