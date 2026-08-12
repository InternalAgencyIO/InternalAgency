#!/usr/bin/env bash

set -euo pipefail

schema="iat-b3-combined-law-stake-local-validator/v1"
require_tools=false
if [[ "${1:-}" == "--require-tools" ]]; then
  require_tools=true
  shift
fi
if [[ $# -ne 0 ]]; then
  printf '{"schema":"%s","status":"FAIL","phase":"arguments","reason":"unexpected_arguments","publicNetworkWrites":false}\n' "$schema"
  exit 2
fi

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
site_dir=$(cd -- "$script_dir/.." && pwd -P)
fixture_dir="$site_dir/tests/fixtures/iat-b3-combined-law-stake"
law_manifest="$site_dir/programs/iat_b3_law/Cargo.toml"
driver="$script_dir/iat-b3-combined-law-stake-local-rehearsal-driver.mjs"
law_id="D6UucuMprPAYyCmr5UPU5h9YhRf2ZNtn23JTS32EjdjY"
economy_id="GLb6VMiKEhRRfYnD1p3a3iCAR3kgtRr8qdHxEHAzbdDU"
rpc_port="${IAT_B3_COMBINED_REHEARSAL_RPC_PORT:-19099}"
rpc_url="http://127.0.0.1:${rpc_port}"
faucet_port=$((rpc_port - 1))
dynamic_min=$((rpc_port + 2))
dynamic_max=$((rpc_port + 102))

missing=()
for command_name in cargo solana solana-keygen solana-test-validator spl-token sha256sum; do
  command -v "$command_name" >/dev/null 2>&1 || missing+=("$command_name")
done
node_bin="${IAT_B3_NODE:-}"
if [[ -z "$node_bin" ]]; then
  node_bin=$(command -v node || true)
fi
if [[ -z "$node_bin" || ! -x "$node_bin" ]]; then
  missing+=("node>=22")
fi
if [[ ${#missing[@]} -ne 0 ]]; then
  json_missing=""
  for item in "${missing[@]}"; do
    [[ -n "$json_missing" ]] && json_missing+=","
    json_missing+="\"$item\""
  done
  printf '{"schema":"%s","status":"SKIP","reason":"tooling_missing","missing":[%s],"publicNetworkWrites":false}\n' \
    "$schema" "$json_missing"
  $require_tools && exit 2
  exit 0
fi

cargo_version=$(cargo --version)
cargo_build_sbf_versions=$(cargo build-sbf --version)
cargo_build_sbf_version=$(printf '%s\n' "$cargo_build_sbf_versions" | sed -n '1p')
platform_tools_version=$(printf '%s\n' "$cargo_build_sbf_versions" | sed -n '2p')
sbf_rustc_version=$(printf '%s\n' "$cargo_build_sbf_versions" | sed -n '3p')
solana_version=$(solana --version)
spl_token_version=$(spl-token --version)
node_major=$($node_bin -p 'Number(process.versions.node.split(".")[0])')
if [[ ! "$cargo_version" =~ ^cargo\ 1\.97\.1\  ]] \
  || [[ "$cargo_build_sbf_version" != "solana-cargo-build-sbf 3.1.10" ]] \
  || [[ "$platform_tools_version" != "platform-tools v1.52" ]] \
  || [[ "$sbf_rustc_version" != "rustc 1.89.0" ]] \
  || [[ ! "$solana_version" =~ ^solana-cli\ 3\.1\.10\ .*client:Agave\)$ ]] \
  || [[ "$spl_token_version" != "spl-token-cli 5.5.0" ]] \
  || [[ "$node_major" -lt 22 ]]; then
  printf '{"schema":"%s","status":"FAIL","phase":"toolchain","reason":"pinned_toolchain_mismatch","cargo":"%s","cargoBuildSbf":"%s","platformTools":"%s","sbfRustc":"%s","solana":"%s","splToken":"%s","nodeMajor":%s,"publicNetworkWrites":false}\n' \
    "$schema" "$cargo_version" "$cargo_build_sbf_version" "$platform_tools_version" "$sbf_rustc_version" "$solana_version" "$spl_token_version" "$node_major"
  exit 2
fi

mkdir -p -- "$fixture_dir/target"
temp_dir=$(mktemp -d "$fixture_dir/target/combined-local-validator.XXXXXX")
temp_dir=$(cd -- "$temp_dir" && pwd -P)
case "$temp_dir" in
  "$fixture_dir"/target/combined-local-validator.*) ;;
  *)
    printf '{"schema":"%s","status":"FAIL","phase":"tempdir","reason":"unsafe_temp_path","publicNetworkWrites":false}\n' "$schema"
    exit 1
    ;;
esac

validator_pid=""
cleanup_complete=false
phase="setup"
stop_validator() {
  if [[ -n "$validator_pid" ]]; then
    kill "$validator_pid" >/dev/null 2>&1 || true
    wait "$validator_pid" >/dev/null 2>&1 || true
    validator_pid=""
  fi
}
cleanup() {
  local status=0
  stop_validator
  case "$temp_dir" in
    "$fixture_dir"/target/combined-local-validator.*) rm -rf -- "$temp_dir" ;;
    *) status=1 ;;
  esac
  [[ ! -e "$temp_dir" ]] || status=1
  if [[ $status -eq 0 ]]; then
    cleanup_complete=true
  fi
  return "$status"
}
finish() {
  local status=$?
  if [[ $status -ne 0 && -d "$temp_dir" ]]; then
    for diagnostic_log in "$temp_dir"/validator-*.log "$temp_dir"/*-build-sbf.log; do
      [[ -f "$diagnostic_log" ]] || continue
      printf '%s\n' "diagnostic tail: $diagnostic_log" >&2
      tail -n 80 "$diagnostic_log" >&2 || true
    done
  fi
  if ! $cleanup_complete; then
    cleanup || status=1
  fi
  if [[ $status -ne 0 ]]; then
    printf '{"schema":"%s","status":"FAIL","phase":"%s","reason":"rehearsal_command_failed","publicNetworkWrites":false,"temporaryLedgerRemoved":%s,"validatorStopped":%s,"generatedKeyMaterialRemoved":%s}\n' \
      "$schema" "$phase" "$cleanup_complete" "$cleanup_complete" "$cleanup_complete"
  fi
  exit "$status"
}
trap finish EXIT
trap 'exit 130' INT TERM

to_node_path() {
  local value=$1
  if [[ "$node_bin" == *.exe ]] && command -v wslpath >/dev/null 2>&1; then
    wslpath -w "$value"
  else
    printf '%s\n' "$value"
  fi
}

start_validator() {
  local label=$1
  shift
  local ledger="$temp_dir/ledger-$label"
  local validator_log="$temp_dir/validator-$label.log"
  solana-test-validator \
    --ledger "$ledger" \
    --bpf-program "$law_id" "$law_artifact" \
    --bpf-program "$economy_id" "$economy_artifact" \
    --rpc-port "$rpc_port" \
    --faucet-port "$faucet_port" \
    --dynamic-port-range "${dynamic_min}-${dynamic_max}" \
    --ticks-per-slot 4 \
    --reset \
    --quiet \
    "$@" >"$validator_log" 2>&1 &
  validator_pid=$!
  for _ in $(seq 1 300); do
    if solana cluster-version --url "$rpc_url" >/dev/null 2>&1; then
      return 0
    fi
    if ! kill -0 "$validator_pid" >/dev/null 2>&1; then
      tail -n 80 "$validator_log" >&2 || true
      return 1
    fi
    sleep 0.1
  done
  tail -n 80 "$validator_log" >&2 || true
  return 1
}

phase="key_generation"
for name in owner recipient mint source recipient-token prior-delegate; do
  solana-keygen new \
    --no-bip39-passphrase \
    --silent \
    --force \
    --outfile "$temp_dir/$name.json" >/dev/null 2>&1
done
owner_pubkey=$(solana-keygen pubkey "$temp_dir/owner.json")
recipient_pubkey=$(solana-keygen pubkey "$temp_dir/recipient.json")
mint_pubkey=$(solana-keygen pubkey "$temp_dir/mint.json")
source_pubkey=$(solana-keygen pubkey "$temp_dir/source.json")
recipient_token_pubkey=$(solana-keygen pubkey "$temp_dir/recipient-token.json")
prior_delegate_pubkey=$(solana-keygen pubkey "$temp_dir/prior-delegate.json")

deploy_dir="$temp_dir/deploy"
mkdir -p -- "$deploy_dir"
phase="law_sbf_build"
law_build_log="$temp_dir/law-build-sbf.log"
IAT_B3_PRODUCTION_LAW_PROGRAM_ID="$law_id" \
IAT_B3_PRODUCTION_ECONOMY_PROGRAM_ID="$economy_id" \
IAT_B3_PRODUCTION_CANONICAL_MINT="$mint_pubkey" \
cargo build-sbf \
  --manifest-path "$law_manifest" \
  --sbf-out-dir "$deploy_dir" \
  --arch v0 \
  --no-default-features \
  --features production-combined-hook \
  --optimize-size \
  --offline \
  --skip-tools-install \
  --tools-version v1.52 \
  -- \
  --locked \
  --target-dir "$temp_dir/law-target" >"$law_build_log" 2>&1
law_artifact="$deploy_dir/iat_b3_law.so"
[[ -s "$law_artifact" ]]

phase="economy_fixture_sbf_build"
economy_build_log="$temp_dir/economy-build-sbf.log"
cargo build-sbf \
  --manifest-path "$fixture_dir/Cargo.toml" \
  --sbf-out-dir "$deploy_dir" \
  --arch v0 \
  --optimize-size \
  --offline \
  --skip-tools-install \
  --tools-version v1.52 \
  -- \
  --locked \
  --target-dir "$temp_dir/economy-target" >"$economy_build_log" 2>&1
economy_artifact="$deploy_dir/iat_b3_combined_law_stake_rehearsal_economy.so"
[[ -s "$economy_artifact" ]]

unsafe_diagnostic='Stack offset of|stack frame of [0-9]+ bytes exceeds|max offset exceeded|overwrites values|undefined behavior'
if grep -Eiq "$unsafe_diagnostic" "$law_build_log" "$economy_build_log"; then
  printf '%s\n' "unsafe SBF diagnostic observed" >&2
  grep -Ein "$unsafe_diagnostic" "$law_build_log" "$economy_build_log" >&2 || true
  exit 1
fi
law_sha256=$(sha256sum "$law_artifact" | awk '{print $1}')
law_bytes=$(stat --format='%s' "$law_artifact")
economy_sha256=$(sha256sum "$economy_artifact" | awk '{print $1}')
economy_bytes=$(stat --format='%s' "$economy_artifact")

phase="baseline_validator_start"
start_validator baseline
phase="fund_disposable_accounts"
solana airdrop 100 "$owner_pubkey" --url "$rpc_url" >/dev/null
solana airdrop 1 "$prior_delegate_pubkey" --url "$rpc_url" >/dev/null

phase="token_2022_canonical_fixture_mint"
spl-token create-token \
  --url "$rpc_url" \
  --fee-payer "$temp_dir/owner.json" \
  --mint-authority "$owner_pubkey" \
  --program-2022 \
  --decimals 9 \
  --enable-confidential-transfers auto \
  --transfer-hook "$law_id" \
  "$temp_dir/mint.json" >/dev/null
spl-token create-account \
  --url "$rpc_url" \
  --fee-payer "$temp_dir/owner.json" \
  --owner "$owner_pubkey" \
  --program-2022 \
  "$mint_pubkey" "$temp_dir/source.json" >/dev/null
spl-token create-account \
  --url "$rpc_url" \
  --fee-payer "$temp_dir/owner.json" \
  --owner "$recipient_pubkey" \
  --program-2022 \
  "$mint_pubkey" "$temp_dir/recipient-token.json" >/dev/null
spl-token mint \
  --url "$rpc_url" \
  --fee-payer "$temp_dir/owner.json" \
  --mint-authority "$temp_dir/owner.json" \
  --program-2022 \
  "$mint_pubkey" 1000000000 "$source_pubkey" >/dev/null
spl-token authorize \
  --url "$rpc_url" \
  --fee-payer "$temp_dir/owner.json" \
  --authority "$temp_dir/owner.json" \
  --program-2022 \
  "$mint_pubkey" mint --disable >/dev/null

fixture_accounts="$temp_dir/account-fixtures"
mkdir -p -- "$fixture_accounts"
phase="actual_initialize_and_finalize"
"$node_bin" "$(to_node_path "$driver")" \
  --mode setup \
  --rpc "$rpc_url" \
  --owner "$(to_node_path "$temp_dir/owner.json")" \
  --mint "$mint_pubkey" \
  --source "$source_pubkey" \
  --recipient-token "$recipient_token_pubkey" \
  --prior-delegate "$prior_delegate_pubkey" \
  --fixture-dir "$(to_node_path "$fixture_accounts")" \
  --law-sha256 "$law_sha256" \
  --economy-sha256 "$economy_sha256"
stop_validator

# This shell fragment contains public addresses only; no key bytes are sourced.
# shellcheck disable=SC1090
source "$fixture_accounts/accounts.env"
shared_accounts=(
  --account "$MINT" "$fixture_accounts/mint.json"
  --account "$SOURCE" "$fixture_accounts/source.json"
  --account "$RECIPIENT_TOKEN" "$fixture_accounts/recipient.json"
  --account "$STAKE_VAULT" "$fixture_accounts/vault.json"
  --account "$INGRESS_AUTHORITY" "$fixture_accounts/ingress.json"
  --account "$VALIDATION" "$fixture_accounts/validation.json"
)

for variant in missing stale open locked forged; do
  phase="variant_${variant}_validator_start"
  start_validator "$variant" \
    "${shared_accounts[@]}" \
    --account "$LAW_STATE" "$fixture_accounts/law-${variant}.json"
  solana airdrop 20 "$owner_pubkey" --url "$rpc_url" >/dev/null
  solana airdrop 1 "$prior_delegate_pubkey" --url "$rpc_url" >/dev/null
  phase="variant_${variant}_rehearsal"
  "$node_bin" "$(to_node_path "$driver")" \
    --mode variant \
    --variant "$variant" \
    --rpc "$rpc_url" \
    --owner "$(to_node_path "$temp_dir/owner.json")" \
    --mint "$MINT" \
    --source "$SOURCE" \
    --recipient-token "$RECIPIENT_TOKEN" \
    --stake-vault "$STAKE_VAULT" \
    --ingress-authority "$INGRESS_AUTHORITY" \
    --prior-delegate "$prior_delegate_pubkey" \
    --validation "$VALIDATION" \
    --law-state "$LAW_STATE" \
    --law-sha256 "$law_sha256" \
    --economy-sha256 "$economy_sha256"
  stop_validator
done

phase="cleanup"
cleanup
phase="complete"
printf '{"schema":"%s","status":"PASS","mode":"summary","rpcScope":"loopback-only","publicNetworkWrites":false,"oneLawElfForFinalizerAndHook":true,"lawArtifact":{"sha256":"%s","byteLength":%s,"cargoFeature":"production-combined-hook"},"economyFixtureArtifact":{"sha256":"%s","byteLength":%s},"productionSourceIngressExecutorExercised":true,"realToken2022HookContext":true,"deterministicSyntheticVariants":["missing","stale","open","locked","forged"],"syntheticVariantsFinalizerProvenance":false,"rawAndBalanceRollbackAsserted":true,"temporaryLedgerRemoved":true,"validatorStopped":true,"generatedKeyMaterialRemoved":true,"fixtureProductionCandidate":false,"productionIdentitiesFrozen":false,"ownerManifestAccepted":false,"finalBinary":false,"productionEconomyEntrypoint":false,"productionEconomyDispatcher":false,"all15Adapters":false,"retainedV2PersistenceComplete":false,"devnetExecuted":false,"mainnetExecuted":false,"graphNodeCompleted":false,"releaseAuthorized":false,"mainnetExecutionAuthorized":false,"statusGate":"HOLD"}\n' \
  "$schema" "$law_sha256" "$law_bytes" "$economy_sha256" "$economy_bytes"
