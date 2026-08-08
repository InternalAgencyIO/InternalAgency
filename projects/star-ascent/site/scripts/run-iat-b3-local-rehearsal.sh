#!/usr/bin/env bash

set -euo pipefail

schema="iat-b3-local-validator-rehearsal/v1"
require_tools=false
if [[ "${1:-}" == "--require-tools" ]]; then
  require_tools=true
  shift
fi
if [[ $# -ne 0 ]]; then
  printf '{"schema":"%s","status":"FAIL","phase":"arguments","reason":"unexpected_arguments"}\n' "$schema"
  exit 2
fi

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
repo_dir=$(cd -- "$script_dir/.." && pwd -P)
artifact="$repo_dir/target/deploy/iat_b3_law.so"
program_keypair="$repo_dir/target/deploy/iat_b3_law-keypair.json"
driver="$script_dir/iat-b3-local-rehearsal-driver.mjs"
rpc_port="${IAT_B3_REHEARSAL_RPC_PORT:-18899}"
rpc_url="http://127.0.0.1:${rpc_port}"
faucet_port=$((rpc_port - 1))
dynamic_min=$((rpc_port + 2))
dynamic_max=$((rpc_port + 102))

missing=()
for command_name in solana solana-keygen solana-test-validator spl-token; do
  command -v "$command_name" >/dev/null 2>&1 || missing+=("$command_name")
done
node_bin="${IAT_B3_NODE:-}"
if [[ -z "$node_bin" ]]; then
  node_bin=$(command -v node || true)
fi
if [[ -z "$node_bin" || ! -x "$node_bin" ]]; then
  missing+=("node>=22")
fi
if ! command -v sha256sum >/dev/null 2>&1 && ! command -v shasum >/dev/null 2>&1; then
  missing+=("sha256sum")
fi

json_missing=""
for item in "${missing[@]:-}"; do
  [[ -n "$item" ]] || continue
  [[ -n "$json_missing" ]] && json_missing+=","
  json_missing+="\"$item\""
done
if [[ ${#missing[@]} -ne 0 ]]; then
  printf '{"schema":"%s","status":"SKIP","reason":"tooling_missing","missing":[%s]}\n' \
    "$schema" "$json_missing"
  $require_tools && exit 2
  exit 0
fi
if [[ ! -s "$artifact" || ! -s "$program_keypair" ]]; then
  printf '{"schema":"%s","status":"SKIP","reason":"local_artifact_missing"}\n' "$schema"
  $require_tools && exit 2
  exit 0
fi

mkdir -p -- "$repo_dir/target"
temp_dir=$(mktemp -d "$repo_dir/target/iat-b3-local-rehearsal.XXXXXX")
temp_dir=$(cd -- "$temp_dir" && pwd -P)
case "$temp_dir" in
  "$repo_dir"/target/iat-b3-local-rehearsal.*) ;;
  *)
    printf '{"schema":"%s","status":"FAIL","phase":"tempdir","reason":"unsafe_temp_path"}\n' "$schema"
    exit 1
    ;;
esac

validator_pid=""
phase="setup"
cleanup() {
  if [[ -n "$validator_pid" ]]; then
    kill "$validator_pid" >/dev/null 2>&1 || true
    wait "$validator_pid" >/dev/null 2>&1 || true
    validator_pid=""
  fi
  case "$temp_dir" in
    "$repo_dir"/target/iat-b3-local-rehearsal.*) rm -rf -- "$temp_dir" ;;
  esac
}
finish() {
  local status=$?
  cleanup
  if [[ $status -ne 0 ]]; then
    printf '{"schema":"%s","status":"FAIL","phase":"%s","reason":"rehearsal_command_failed"}\n' \
      "$schema" "$phase"
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

driver_for_node=$(to_node_path "$driver")
start_validator() {
  local label=$1
  shift
  local ledger="$temp_dir/ledger-$label"
  local log="$temp_dir/validator-$label.log"
  solana-test-validator \
    --ledger "$ledger" \
    --upgradeable-program "$program_keypair" "$artifact" "$payer_pubkey" \
    --rpc-port "$rpc_port" \
    --faucet-port "$faucet_port" \
    --dynamic-port-range "${dynamic_min}-${dynamic_max}" \
    --ticks-per-slot 4 \
    --reset \
    --quiet \
    "$@" >"$log" 2>&1 &
  validator_pid=$!
  for _ in $(seq 1 240); do
    if solana cluster-version --url "$rpc_url" >/dev/null 2>&1; then
      return 0
    fi
    if ! kill -0 "$validator_pid" >/dev/null 2>&1; then
      return 1
    fi
    sleep 0.1
  done
  return 1
}

stop_validator() {
  if [[ -n "$validator_pid" ]]; then
    kill "$validator_pid" >/dev/null 2>&1 || true
    wait "$validator_pid" >/dev/null 2>&1 || true
    validator_pid=""
  fi
}

freeze_local_program() {
  solana program set-upgrade-authority \
    "$program_id" \
    --url "$rpc_url" \
    --keypair "$temp_dir/payer.json" \
    --upgrade-authority "$temp_dir/payer.json" \
    --final >/dev/null
}

phase="key_generation"
for name in payer recipient mint; do
  solana-keygen new \
    --no-bip39-passphrase \
    --silent \
    --force \
    --outfile "$temp_dir/$name.json" >/dev/null 2>&1
done
program_id=$(solana-keygen pubkey "$program_keypair")
payer_pubkey=$(solana-keygen pubkey "$temp_dir/payer.json")
recipient_pubkey=$(solana-keygen pubkey "$temp_dir/recipient.json")
mint_pubkey=$(solana-keygen pubkey "$temp_dir/mint.json")
if command -v sha256sum >/dev/null 2>&1; then
  artifact_sha256=$(sha256sum "$artifact" | awk '{print $1}')
else
  artifact_sha256=$(shasum -a 256 "$artifact" | awk '{print $1}')
fi

phase="baseline_validator_start"
start_validator baseline
solana airdrop 100 "$payer_pubkey" --url "$rpc_url" >/dev/null
phase="baseline_program_freeze"
freeze_local_program

phase="token_2022_create_mint"
spl-token create-token \
  --url "$rpc_url" \
  --fee-payer "$temp_dir/payer.json" \
  --mint-authority "$payer_pubkey" \
  --program-2022 \
  --decimals 9 \
  --enable-confidential-transfers auto \
  --transfer-hook "$program_id" \
  "$temp_dir/mint.json" >/dev/null
phase="token_2022_create_source"
spl-token create-account \
  --url "$rpc_url" \
  --fee-payer "$temp_dir/payer.json" \
  --program-2022 "$mint_pubkey" --owner "$payer_pubkey" >/dev/null
source_address=$(spl-token address \
  --url "$rpc_url" \
  --verbose \
  --program-2022 \
  --token "$mint_pubkey" \
  --owner "$payer_pubkey" | awk 'NF { value=$NF } END { print value }')
[[ -n "$source_address" ]] || exit 1
phase="token_2022_create_destination"
spl-token create-account \
  --url "$rpc_url" \
  --fee-payer "$temp_dir/payer.json" \
  --program-2022 "$mint_pubkey" --owner "$recipient_pubkey" >/dev/null
phase="token_2022_mint_supply"
spl-token mint \
  --url "$rpc_url" \
  --fee-payer "$temp_dir/payer.json" \
  --mint-authority "$temp_dir/payer.json" \
  --program-2022 "$mint_pubkey" 1000000000 "$source_address" >/dev/null
phase="token_2022_revoke_mint_authority"
spl-token authorize \
  --url "$rpc_url" \
  --fee-payer "$temp_dir/payer.json" \
  --authority "$temp_dir/payer.json" \
  --program-2022 "$mint_pubkey" mint --disable >/dev/null

fixture_dir="$temp_dir/fixtures"
mkdir -p -- "$fixture_dir"
phase="baseline_rehearsal"
"$node_bin" "$driver_for_node" \
  --mode baseline \
  --rpc "$rpc_url" \
  --payer "$(to_node_path "$temp_dir/payer.json")" \
  --recipient "$(to_node_path "$temp_dir/recipient.json")" \
  --mint "$mint_pubkey" \
  --program-id "$program_id" \
  --fixture-dir "$(to_node_path "$fixture_dir")" \
  --artifact-sha256 "$artifact_sha256"
stop_validator

# The driver writes only public addresses here; no key material is sourced.
# shellcheck disable=SC1090
source "$fixture_dir/accounts.env"
shared_accounts=(
  --account "$MINT" "$fixture_dir/mint.json"
  --account "$SOURCE" "$fixture_dir/source.json"
  --account "$DESTINATION" "$fixture_dir/destination.json"
  --account "$VALIDATION" "$fixture_dir/validation.json"
)

for variant in missing stale open locked forged; do
  phase="variant_${variant}_validator_start"
  start_validator "$variant" \
    "${shared_accounts[@]}" \
    --account "$LAW_STATE" "$fixture_dir/law-${variant}.json"
  solana airdrop 10 "$payer_pubkey" --url "$rpc_url" >/dev/null
  phase="variant_${variant}_program_freeze"
  freeze_local_program
  phase="variant_${variant}_transfer"
  "$node_bin" "$driver_for_node" \
    --mode variant \
    --variant "$variant" \
    --rpc "$rpc_url" \
    --payer "$(to_node_path "$temp_dir/payer.json")" \
    --mint "$MINT" \
    --program-id "$PROGRAM_ID" \
    --source "$SOURCE" \
    --destination "$DESTINATION" \
    --law-state "$LAW_STATE"
  stop_validator
done

phase="complete"
cleanup
printf '{"schema":"%s","status":"PASS","mode":"summary","publicNetworkWrites":false,"temporaryLedgerRemoved":true,"variants":["missing","stale","open","locked","forged"]}\n' \
  "$schema"
