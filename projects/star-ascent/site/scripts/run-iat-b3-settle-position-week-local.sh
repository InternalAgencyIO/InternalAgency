#!/usr/bin/env bash

set -euo pipefail

schema="iat-b3-settle-position-week-production-executor-loopback/v1"
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
site_dir=$(cd -- "$script_dir/.." && pwd -P)
fixture_dir="$site_dir/tests/fixtures/iat-b3-settle-position-week"
driver="$script_dir/iat-b3-settle-position-week-local-driver.mjs"
evidence="$site_dir/docs/b3/evidence/local-validator-settle-position-week-production-executor-20260812.json"
evidence_dir=$(dirname -- "$evidence")
deploy_dir="$fixture_dir/target/deploy"
economy_artifact="$deploy_dir/iat_b3_settle_position_week_rehearsal_economy.so"
law_artifact="$deploy_dir/iat_b3_settle_position_week_rehearsal_law_hook.so"
economy_generated_keypair="$deploy_dir/iat_b3_settle_position_week_rehearsal_economy-keypair.json"
law_generated_keypair="$deploy_dir/iat_b3_settle_position_week_rehearsal_law_hook-keypair.json"
economy_build_log="$fixture_dir/target/economy-build-sbf.log"
law_build_log="$fixture_dir/target/law-hook-build-sbf.log"
candidate="$fixture_dir/target/evidence-candidate.json"
economy_id="GLb6VMiKEhRRfYnD1p3a3iCAR3kgtRr8qdHxEHAzbdDU"
law_id="DAQCmCpqSgTn7J2MWmiPNZvJwasEESabaSy7VR4qUy4F"
rpc_port="${IAT_B3_SETTLE_POSITION_WEEK_RPC_PORT:-19499}"
rpc_url="http://127.0.0.1:${rpc_port}"
faucet_port=$((rpc_port - 1))
dynamic_min=$((rpc_port + 2))
dynamic_max=$((rpc_port + 102))
git_head="${IAT_B3_GIT_HEAD:-}"

if [[ -e "$evidence" ]]; then
  printf '{"schema":"%s","status":"FAIL","reason":"evidence_already_exists","publicNetworkWrites":false}\n' "$schema"
  exit 1
fi
if ! mkdir -p -- "$evidence_dir"; then
  printf '{"schema":"%s","status":"FAIL","reason":"evidence_parent_create_failed","publicNetworkWrites":false}\n' "$schema"
  exit 1
fi
if [[ ! -d "$evidence_dir" ]]; then
  printf '{"schema":"%s","status":"FAIL","reason":"evidence_parent_not_directory","publicNetworkWrites":false}\n' "$schema"
  exit 1
fi

for command_name in cargo rustc solana solana-keygen solana-test-validator spl-token sha256sum git; do
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
node_major=$($node_bin -p 'Number(process.versions.node.split(".")[0])')
if (( node_major < 22 )); then
  printf '{"schema":"%s","status":"FAIL","reason":"unsupported_node","observed":%s,"required":22,"publicNetworkWrites":false}\n' \
    "$schema" "$node_major"
  exit 2
fi
if [[ ! "$git_head" =~ ^[0-9a-f]{40}$ ]]; then
  printf '{"schema":"%s","status":"FAIL","reason":"missing_or_invalid_exact_git_head","publicNetworkWrites":false}\n' "$schema"
  exit 2
fi
observed_git_head=$(git -C "$site_dir" rev-parse HEAD)
if [[ "$observed_git_head" != "$git_head" ]]; then
  printf '{"schema":"%s","status":"FAIL","reason":"exact_git_head_mismatch","expected":"%s","observed":"%s","publicNetworkWrites":false}\n' \
    "$schema" "$git_head" "$observed_git_head"
  exit 2
fi
mkdir -p -- "$deploy_dir"
temp_dir=$(mktemp -d /tmp/iat-b3-settle-position-week.XXXXXX)
temp_dir=$(cd -- "$temp_dir" && pwd -P)
case "$temp_dir" in
  /tmp/iat-b3-settle-position-week.*) ;;
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
    /tmp/iat-b3-settle-position-week.*) rm -rf -- "$temp_dir" ;;
    *) cleanup_status=1 ;;
  esac
  rm -f -- "$economy_generated_keypair" "$law_generated_keypair"
  [[ ! -e "$temp_dir" ]] || cleanup_status=1
  [[ ! -e "$economy_generated_keypair" ]] || cleanup_status=1
  [[ ! -e "$law_generated_keypair" ]] || cleanup_status=1
  [[ $cleanup_status -eq 0 ]] && cleanup_complete=true
  return "$cleanup_status"
}
finish() {
  local status=$?
  if ! $cleanup_complete; then
    cleanup || status=1
  fi
  if [[ $status -ne 0 ]]; then
    rm -f -- "$candidate"
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

canonical_diagnostics='Stack offset of|stack frame.*exceeds|max offset exceeded|overwrites values|undefined behavior'
rm -f -- "$candidate" "$economy_build_log" "$law_build_log"
phase="sbf_build_law_hook"
RUSTFLAGS='-C llvm-args=--bpf-stack-size=4096' \
CARGO_TARGET_DIR="$temp_dir/cargo-target" \
cargo build-sbf \
  --manifest-path "$fixture_dir/law-hook/Cargo.toml" \
  --sbf-out-dir "$deploy_dir" \
  --tools-version v1.52 \
  --skip-tools-install \
  -- --locked 2>&1 | tee "$law_build_log" >/dev/null
phase="sbf_build_economy"
RUSTFLAGS='-C llvm-args=--bpf-stack-size=4096' \
CARGO_TARGET_DIR="$temp_dir/cargo-target" \
cargo build-sbf \
  --manifest-path "$fixture_dir/economy/Cargo.toml" \
  --sbf-out-dir "$deploy_dir" \
  --tools-version v1.52 \
  --skip-tools-install \
  -- --locked 2>&1 | tee "$economy_build_log" >/dev/null
[[ -s "$law_artifact" && -s "$economy_artifact" ]]
if grep -Eiq "$canonical_diagnostics" "$law_build_log" "$economy_build_log"; then
  printf '{"schema":"%s","status":"FAIL","reason":"canonical_sbf_compiler_diagnostic","publicNetworkWrites":false}\n' "$schema"
  exit 1
fi
law_sha256=$(sha256sum "$law_artifact" | awk '{print $1}')
economy_sha256=$(sha256sum "$economy_artifact" | awk '{print $1}')

phase="key_generation"
for name in sponsor owner mint source; do
  solana-keygen new \
    --no-bip39-passphrase \
    --silent \
    --force \
    --outfile "$temp_dir/$name.json" >/dev/null 2>&1
done
sponsor_pubkey=$(solana-keygen pubkey "$temp_dir/sponsor.json")
owner_pubkey=$(solana-keygen pubkey "$temp_dir/owner.json")
mint_pubkey=$(solana-keygen pubkey "$temp_dir/mint.json")
source_pubkey=$(solana-keygen pubkey "$temp_dir/source.json")

phase="validator_start"
ledger="$temp_dir/ledger"
validator_log="$temp_dir/validator.log"
solana-test-validator \
  --ledger "$ledger" \
  --bpf-program "$economy_id" "$economy_artifact" \
  --bpf-program "$law_id" "$law_artifact" \
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
solana airdrop 100 "$sponsor_pubkey" --url "$rpc_url" >/dev/null
solana airdrop 50 "$owner_pubkey" --url "$rpc_url" >/dev/null

phase="canonical_token_2022_mint"
spl-token create-token \
  --url "$rpc_url" \
  --fee-payer "$temp_dir/sponsor.json" \
  --mint-authority "$owner_pubkey" \
  --program-2022 \
  --decimals 9 \
  --enable-confidential-transfers auto \
  --transfer-hook "$law_id" \
  "$temp_dir/mint.json" >/dev/null
spl-token create-account \
  --url "$rpc_url" \
  --fee-payer "$temp_dir/sponsor.json" \
  --owner "$owner_pubkey" \
  --program-2022 \
  "$mint_pubkey" "$temp_dir/source.json" >/dev/null
spl-token mint \
  --url "$rpc_url" \
  --fee-payer "$temp_dir/sponsor.json" \
  --mint-authority "$temp_dir/owner.json" \
  --program-2022 \
  "$mint_pubkey" 1000000000 "$source_pubkey" >/dev/null
for authority_type in confidential-transfer-mint transfer-hook-program-id mint; do
  spl-token authorize \
    --url "$rpc_url" \
    --fee-payer "$temp_dir/sponsor.json" \
    --authority "$temp_dir/owner.json" \
    --program-2022 \
    "$mint_pubkey" "$authority_type" --disable >/dev/null
done

phase="validator_rehearsal"
"$node_bin" "$(to_node_path "$driver")" \
  --rpc "$rpc_url" \
  --sponsor "$(to_node_path "$temp_dir/sponsor.json")" \
  --owner "$(to_node_path "$temp_dir/owner.json")" \
  --mint "$mint_pubkey" \
  --source "$source_pubkey" \
  --candidate "$(to_node_path "$candidate")" \
  --git-head "$git_head" \
  --economy-artifact-sha256 "$economy_sha256" \
  --law-artifact-sha256 "$law_sha256" \
  --economy-build-log "$(to_node_path "$economy_build_log")" \
  --law-build-log "$(to_node_path "$law_build_log")"

phase="cleanup"
cleanup

phase="evidence_finalize"
runner_sha256=$(sha256sum "$script_dir/run-iat-b3-settle-position-week-local.sh" | awk '{print $1}')
cargo_version=$(cargo --version)
rustc_version=$(rustc --version)
solana_version=$(solana --version)
spl_token_version=$(spl-token --version)
"$node_bin" "$(to_node_path "$driver")" \
  --finalize-candidate "$(to_node_path "$candidate")" \
  --evidence "$(to_node_path "$evidence")" \
  --runner-sha256 "$runner_sha256" \
  --cargo-version "$cargo_version" \
  --rustc-version "$rustc_version" \
  --solana-version "$solana_version" \
  --spl-token-version "$spl_token_version"
rm -f -- "$candidate"

phase="complete"
printf '{"schema":"%s","status":"PASS","mode":"summary","publicNetworkWrites":false,"temporaryLedgerRemoved":true,"validatorStopped":true,"generatedKeyMaterialRemoved":true,"mainnetExecutionAuthorized":false}\n' \
  "$schema"
