#!/usr/bin/env bash

set -euo pipefail

schema="iat-b3-stake-ingress-local-validator/v1"
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
site_dir=$(cd -- "$script_dir/.." && pwd -P)
fixture_dir="$site_dir/tests/fixtures/iat-b3-stake-ingress"
driver="$script_dir/iat-b3-stake-ingress-local-rehearsal-driver.mjs"
economy_generated_keypair="$fixture_dir/target/deploy/iat_b3_stake_ingress_rehearsal_economy-keypair.json"
hook_generated_keypair="$fixture_dir/target/deploy/iat_b3_stake_ingress_rehearsal_hook-keypair.json"
economy_id="GLb6VMiKEhRRfYnD1p3a3iCAR3kgtRr8qdHxEHAzbdDU"
hook_id="DAQCmCpqSgTn7J2MWmiPNZvJwasEESabaSy7VR4qUy4F"
rpc_port="${IAT_B3_STAKE_REHEARSAL_RPC_PORT:-18999}"
rpc_url="http://127.0.0.1:${rpc_port}"
faucet_port=$((rpc_port - 1))
dynamic_min=$((rpc_port + 2))
dynamic_max=$((rpc_port + 102))

for command_name in cargo solana solana-keygen solana-test-validator spl-token sha256sum; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    printf '{"schema":"%s","status":"FAIL","reason":"missing_tool","tool":"%s","publicNetworkWrites":false}\n' \
      "$schema" "$command_name"
    exit 2
  fi
done
node_bin="${IAT_B3_NODE:-$(command -v node || true)}"
if [[ -z "$node_bin" || ! -x "$node_bin" ]]; then
  printf '{"schema":"%s","status":"FAIL","reason":"missing_tool","tool":"node>=22","publicNetworkWrites":false}\n' \
    "$schema"
  exit 2
fi

mkdir -p -- "$fixture_dir/target"
temp_dir=$(mktemp -d "$fixture_dir/target/local-validator.XXXXXX")
temp_dir=$(cd -- "$temp_dir" && pwd -P)
case "$temp_dir" in
  "$fixture_dir"/target/local-validator.*) ;;
  *)
    printf '{"schema":"%s","status":"FAIL","reason":"unsafe_temp_path","publicNetworkWrites":false}\n' "$schema"
    exit 1
    ;;
esac

validator_pid=""
phase="build"
cleanup_complete=false
cleanup() {
  local cleanup_status=0
  if [[ -n "$validator_pid" ]]; then
    kill "$validator_pid" >/dev/null 2>&1 || true
    wait "$validator_pid" >/dev/null 2>&1 || true
    if kill -0 "$validator_pid" >/dev/null 2>&1; then
      cleanup_status=1
    fi
    validator_pid=""
  fi
  case "$temp_dir" in
    "$fixture_dir"/target/local-validator.*) rm -rf -- "$temp_dir" ;;
    *) cleanup_status=1 ;;
  esac
  rm -f -- "$economy_generated_keypair" "$hook_generated_keypair"
  [[ ! -e "$temp_dir" ]] || cleanup_status=1
  [[ ! -e "$economy_generated_keypair" ]] || cleanup_status=1
  [[ ! -e "$hook_generated_keypair" ]] || cleanup_status=1
  [[ $cleanup_status -eq 0 ]] && cleanup_complete=true
  return "$cleanup_status"
}
finish() {
  local status=$?
  if ! $cleanup_complete; then
    cleanup || status=1
  fi
  if [[ $status -ne 0 ]]; then
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

phase="sbf_build_hook"
cargo build-sbf \
  --manifest-path "$fixture_dir/hook/Cargo.toml" \
  --sbf-out-dir "$fixture_dir/target/deploy" \
  -- --locked >/dev/null
phase="sbf_build_economy"
cargo build-sbf \
  --manifest-path "$fixture_dir/economy/Cargo.toml" \
  --sbf-out-dir "$fixture_dir/target/deploy" \
  -- --locked >/dev/null
hook_artifact="$fixture_dir/target/deploy/iat_b3_stake_ingress_rehearsal_hook.so"
economy_artifact="$fixture_dir/target/deploy/iat_b3_stake_ingress_rehearsal_economy.so"
[[ -s "$hook_artifact" && -s "$economy_artifact" ]]
hook_sha256=$(sha256sum "$hook_artifact" | awk '{print $1}')
economy_sha256=$(sha256sum "$economy_artifact" | awk '{print $1}')

phase="key_generation"
for name in owner mint source guarded-source prior-delegate; do
  solana-keygen new \
    --no-bip39-passphrase \
    --silent \
    --force \
    --outfile "$temp_dir/$name.json" >/dev/null 2>&1
done
owner_pubkey=$(solana-keygen pubkey "$temp_dir/owner.json")
mint_pubkey=$(solana-keygen pubkey "$temp_dir/mint.json")
source_pubkey=$(solana-keygen pubkey "$temp_dir/source.json")
guarded_source_pubkey=$(solana-keygen pubkey "$temp_dir/guarded-source.json")
prior_delegate_pubkey=$(solana-keygen pubkey "$temp_dir/prior-delegate.json")

phase="validator_start"
ledger="$temp_dir/ledger"
validator_log="$temp_dir/validator.log"
solana-test-validator \
  --ledger "$ledger" \
  --bpf-program "$economy_id" "$economy_artifact" \
  --bpf-program "$hook_id" "$hook_artifact" \
  --rpc-port "$rpc_port" \
  --faucet-port "$faucet_port" \
  --dynamic-port-range "${dynamic_min}-${dynamic_max}" \
  --ticks-per-slot 4 \
  --reset \
  --quiet >"$validator_log" 2>&1 &
validator_pid=$!
for _ in $(seq 1 240); do
  if solana cluster-version --url "$rpc_url" >/dev/null 2>&1; then
    break
  fi
  if ! kill -0 "$validator_pid" >/dev/null 2>&1; then
    exit 1
  fi
  sleep 0.1
done
solana cluster-version --url "$rpc_url" >/dev/null

phase="fund_disposable_accounts"
solana airdrop 100 "$owner_pubkey" --url "$rpc_url" >/dev/null
solana airdrop 1 "$prior_delegate_pubkey" --url "$rpc_url" >/dev/null

phase="token_2022_mint"
spl-token create-token \
  --url "$rpc_url" \
  --fee-payer "$temp_dir/owner.json" \
  --mint-authority "$owner_pubkey" \
  --program-2022 \
  --decimals 9 \
  --transfer-hook "$hook_id" \
  "$temp_dir/mint.json" >/dev/null

phase="token_2022_sources"
for source_name in source guarded-source; do
  spl-token create-account \
    --url "$rpc_url" \
    --fee-payer "$temp_dir/owner.json" \
    --owner "$owner_pubkey" \
    --program-2022 \
    "$mint_pubkey" "$temp_dir/$source_name.json" >/dev/null
done
spl-token mint \
  --url "$rpc_url" \
  --fee-payer "$temp_dir/owner.json" \
  --mint-authority "$temp_dir/owner.json" \
  --program-2022 "$mint_pubkey" 1000 "$source_pubkey" >/dev/null
spl-token mint \
  --url "$rpc_url" \
  --fee-payer "$temp_dir/owner.json" \
  --mint-authority "$temp_dir/owner.json" \
  --program-2022 "$mint_pubkey" 100 "$guarded_source_pubkey" >/dev/null

phase="enable_cpi_guard"
spl-token enable-cpi-guard \
  --url "$rpc_url" \
  --fee-payer "$temp_dir/owner.json" \
  --owner "$temp_dir/owner.json" \
  --program-2022 "$guarded_source_pubkey" >/dev/null

phase="validator_rehearsal"
"$node_bin" "$(to_node_path "$driver")" \
  --rpc "$rpc_url" \
  --owner "$(to_node_path "$temp_dir/owner.json")" \
  --mint "$mint_pubkey" \
  --source "$source_pubkey" \
  --guarded-source "$guarded_source_pubkey" \
  --prior-delegate "$prior_delegate_pubkey" \
  --economy-sha256 "$economy_sha256" \
  --hook-sha256 "$hook_sha256"

phase="cleanup"
cleanup
phase="complete"
printf '{"schema":"%s","status":"PASS","mode":"summary","publicNetworkWrites":false,"temporaryLedgerRemoved":true,"validatorStopped":true,"generatedKeyMaterialRemoved":true}\n' \
  "$schema"
