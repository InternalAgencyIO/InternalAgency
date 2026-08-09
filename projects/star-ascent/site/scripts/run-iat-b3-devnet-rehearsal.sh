#!/usr/bin/env bash
set -euo pipefail

schema="iat-b3-devnet-rehearsal/v1"
devnet_rpc="https://api.devnet.solana.com"
expected_devnet_genesis_hash="EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG"
expected_artifact_sha256="927f22cbb431caf1fe9a1cd3782194c20e292f40d72757e7b7dcdf62e8f0381c"
expected_artifact_size="154952"
execute_confirmation="CONFIRMED_PUBLIC_DEVNET_REHEARSAL"

# This check intentionally precedes mktemp, key generation, RPC contact, and
# every public write. The wrapper has exactly one executable invocation.
if [[ $# -ne 1 || "$1" != "--execute" ]]; then
  printf '{"schema":"iat-b3-devnet-rehearsal/v1","status":"NOT_EXECUTED","reason":"explicit_execute_required","publicNetworkWrites":false}\n'
  exit 2
fi

for tool in solana solana-keygen spl-token sha256sum stat mktemp; do
  command -v "$tool" >/dev/null 2>&1 || {
    printf '{"schema":"iat-b3-devnet-rehearsal/v1","status":"FAIL","phase":"tool_preflight","reason":"required_tool_missing","publicNetworkWrites":false}\n'
    exit 1
  }
done

script_dir=$(cd -- "$(dirname -- "$0")" && pwd -P)
repo_dir=$(cd -- "$script_dir/.." && pwd -P)
artifact="$repo_dir/target/deploy/iat_b3_law.so"
driver="$script_dir/iat-b3-devnet-rehearsal-driver.mjs"
node_bin=$(printenv IAT_B3_NODE 2>/dev/null || command -v node || true)
[[ -n "$node_bin" && -x "$node_bin" ]] || {
  printf '{"schema":"iat-b3-devnet-rehearsal/v1","status":"FAIL","phase":"tool_preflight","reason":"supported_node_missing","publicNetworkWrites":false}\n'
  exit 1
}
[[ -f "$artifact" && -f "$driver" ]] || {
  printf '{"schema":"iat-b3-devnet-rehearsal/v1","status":"FAIL","phase":"artifact_preflight","reason":"reviewed_inputs_missing","publicNetworkWrites":false}\n'
  exit 1
}

to_node_path() {
  local path=$1
  if [[ "$node_bin" == *.exe ]] && command -v wslpath >/dev/null 2>&1; then
    wslpath -w "$path"
  else
    printf '%s\n' "$path"
  fi
}

node_major=$("$node_bin" -p 'Number(process.versions.node.split(".")[0])' 2>/dev/null || true)
[[ "$node_major" =~ ^[0-9]+$ && "$node_major" -ge 22 ]] || {
  printf '{"schema":"iat-b3-devnet-rehearsal/v1","status":"FAIL","phase":"tool_preflight","reason":"supported_node_22_or_newer_required","publicNetworkWrites":false}\n'
  exit 1
}
driver_for_node=$(to_node_path "$driver")
"$node_bin" "$driver_for_node" --offline-import-preflight >/dev/null 2>&1 || {
  printf '{"schema":"iat-b3-devnet-rehearsal/v1","status":"FAIL","phase":"tool_preflight","reason":"driver_dependency_preflight_failed","publicNetworkWrites":false}\n'
  exit 1
}

artifact_sha256=$(sha256sum "$artifact" | awk '{print $1}')
artifact_size=$(stat -c '%s' "$artifact")
[[ "$artifact_sha256" == "$expected_artifact_sha256" ]] || {
  printf '{"schema":"iat-b3-devnet-rehearsal/v1","status":"FAIL","phase":"artifact_preflight","reason":"artifact_digest_not_pinned","publicNetworkWrites":false}\n'
  exit 1
}
[[ "$artifact_size" == "$expected_artifact_size" ]] || {
  printf '{"schema":"iat-b3-devnet-rehearsal/v1","status":"FAIL","phase":"artifact_preflight","reason":"artifact_size_not_pinned","publicNetworkWrites":false}\n'
  exit 1
}

mkdir -p -- "$repo_dir/target"
temp_dir=$(mktemp -d "$repo_dir"/target/iat-b3-devnet-rehearsal.XXXXXX)
temp_dir=$(cd -- "$temp_dir" && pwd -P)
phase="temporary_identity_generation"
public_writes_started=false
permanent_artifacts_may_remain=false
temporary_secrets_removed=false
identity_evidence_emitted=false
payer_pubkey=""
program_pubkey=""
buffer_pubkey=""
mint_pubkey=""
recipient_pubkey=""
cli_evidence_dir=""

finish() {
  local exit_code=$?
  local evidence_file
  local evidence_label
  trap - EXIT
  if [[ $exit_code -ne 0 && "$public_writes_started" == "true" && "$identity_evidence_emitted" == "true" ]]; then
    printf '{"schema":"iat-b3-devnet-rehearsal/v1","status":"PARTIAL_PUBLIC_ARTIFACT_LOCATORS","network":"solana-devnet","rpc":"https://api.devnet.solana.com","publicAddresses":{"payer":{"address":"%s","explorerUrl":"https://explorer.solana.com/address/%s?cluster=devnet"},"program":{"address":"%s","explorerUrl":"https://explorer.solana.com/address/%s?cluster=devnet"},"deploymentBuffer":{"address":"%s","explorerUrl":"https://explorer.solana.com/address/%s?cluster=devnet"},"mint":{"address":"%s","explorerUrl":"https://explorer.solana.com/address/%s?cluster=devnet"},"recipient":{"address":"%s","explorerUrl":"https://explorer.solana.com/address/%s?cluster=devnet"}}}\n' \
      "$payer_pubkey" "$payer_pubkey" \
      "$program_pubkey" "$program_pubkey" \
      "$buffer_pubkey" "$buffer_pubkey" \
      "$mint_pubkey" "$mint_pubkey" \
      "$recipient_pubkey" "$recipient_pubkey"
    if [[ -d "$cli_evidence_dir" ]]; then
      for evidence_file in "$cli_evidence_dir"/*.json; do
        [[ -f "$evidence_file" ]] || continue
        evidence_label=$(basename -- "$evidence_file" .json)
        "$node_bin" "$driver_for_node" \
          --offline-sanitize-cli-evidence "$evidence_label" "$(to_node_path "$evidence_file")" \
          2>"$temp_dir/partial-$evidence_label-sanitizer.stderr" || true
      done
    fi
  fi
  if [[ -n "$temp_dir" && -d "$temp_dir" ]]; then
    case "$temp_dir" in
      "$repo_dir"/target/iat-b3-devnet-rehearsal.*)
        if rm -rf -- "$temp_dir"; then
          temporary_secrets_removed=true
        else
          exit_code=1
          phase="temporary_secret_cleanup_failed"
        fi
        ;;
      *)
        exit_code=1
        phase="unsafe_cleanup_target_rejected"
        ;;
    esac
  else
    temporary_secrets_removed=true
  fi
  if [[ $exit_code -eq 0 ]]; then
    printf '{"schema":"iat-b3-devnet-rehearsal/v1","status":"PASS","mode":"cleanup","temporarySecretsRemoved":true,"publicNetworkWrites":true,"permanentDevnetArtifactsRemain":true}\n'
  else
    printf '{"schema":"iat-b3-devnet-rehearsal/v1","status":"FAIL","reason":"rehearsal_command_failed_or_partial","phase":"%s","public_writes_started":%s,"permanent_artifacts_may_remain":%s,"identityEvidenceEmitted":%s,"temporarySecretsRemoved":%s}\n' \
      "$phase" "$public_writes_started" "$permanent_artifacts_may_remain" "$identity_evidence_emitted" "$temporary_secrets_removed"
  fi
  exit "$exit_code"
}
trap finish EXIT
trap 'exit 130' INT TERM

payer_key="$temp_dir/payer.json"
program_key="$temp_dir/program.json"
buffer_key="$temp_dir/buffer.json"
mint_key="$temp_dir/mint.json"
recipient_key="$temp_dir/recipient.json"
cli_evidence_dir="$temp_dir/cli-evidence"
mkdir -p -- "$cli_evidence_dir"

for key_file in "$payer_key" "$program_key" "$buffer_key" "$mint_key" "$recipient_key"; do
  solana-keygen new \
    --no-bip39-passphrase \
    --silent \
    --force \
    --outfile "$key_file" >/dev/null 2>&1
done

payer_pubkey=$(solana-keygen pubkey "$payer_key")
program_pubkey=$(solana-keygen pubkey "$program_key")
buffer_pubkey=$(solana-keygen pubkey "$buffer_key")
mint_pubkey=$(solana-keygen pubkey "$mint_key")
recipient_pubkey=$(solana-keygen pubkey "$recipient_key")

phase="canonical_devnet_genesis_preflight"
observed_genesis_hash=$(solana genesis-hash \
  --url "$devnet_rpc" 2>"$temp_dir/genesis-hash.stderr" | awk 'NF {print $1; exit}')
[[ "$observed_genesis_hash" == "$expected_devnet_genesis_hash" ]] || {
  phase="canonical_devnet_genesis_mismatch"
  exit 1
}

printf '{"schema":"iat-b3-devnet-rehearsal/v1","status":"READY_FOR_FIRST_PUBLIC_WRITE","network":"solana-devnet","rpc":"https://api.devnet.solana.com","genesisHash":"%s","publicNetworkWrites":false,"publicAddresses":{"payer":{"address":"%s","explorerUrl":"https://explorer.solana.com/address/%s?cluster=devnet"},"program":{"address":"%s","explorerUrl":"https://explorer.solana.com/address/%s?cluster=devnet"},"deploymentBuffer":{"address":"%s","explorerUrl":"https://explorer.solana.com/address/%s?cluster=devnet"},"mint":{"address":"%s","explorerUrl":"https://explorer.solana.com/address/%s?cluster=devnet"},"recipient":{"address":"%s","explorerUrl":"https://explorer.solana.com/address/%s?cluster=devnet"}}}\n' \
  "$observed_genesis_hash" \
  "$payer_pubkey" "$payer_pubkey" \
  "$program_pubkey" "$program_pubkey" \
  "$buffer_pubkey" "$buffer_pubkey" \
  "$mint_pubkey" "$mint_pubkey" \
  "$recipient_pubkey" "$recipient_pubkey"
identity_evidence_emitted=true

run_json() {
  local label=$1
  local evidence_file
  shift
  evidence_file="$cli_evidence_dir/$label.json"
  "$@" >"$evidence_file" 2>"$temp_dir/$label.stderr"
  "$node_bin" "$driver_for_node" \
    --offline-sanitize-cli-evidence "$label" "$(to_node_path "$evidence_file")" \
    2>"$temp_dir/$label-sanitizer.stderr"
}

phase="devnet_airdrop_1"
public_writes_started=true
permanent_artifacts_may_remain=true
run_json airdrop-1 solana airdrop 2 "$payer_pubkey" \
  --url "$devnet_rpc" \
  --keypair "$payer_key" \
  --commitment finalized \
  --output json-compact
phase="devnet_airdrop_2"
run_json airdrop-2 solana airdrop 1 "$payer_pubkey" \
  --url "$devnet_rpc" \
  --keypair "$payer_key" \
  --commitment finalized \
  --output json-compact

funding_lamports=$(solana balance "$payer_pubkey" \
  --url "$devnet_rpc" \
  --lamports 2>"$temp_dir/balance.stderr" | awk 'NR == 1 {print $1}')
[[ "$funding_lamports" =~ ^[0-9]+$ && "$funding_lamports" -ge 3000000000 ]] || {
  phase="devnet_airdrop_balance_insufficient"
  exit 1
}

phase="deploy_exact_optimized_program"
run_json deploy-program solana program deploy "$artifact" \
  --url "$devnet_rpc" \
  --use-rpc \
  --commitment finalized \
  --keypair "$payer_key" \
  --fee-payer "$payer_key" \
  --program-id "$program_key" \
  --buffer "$buffer_key" \
  --upgrade-authority "$payer_key" \
  --max-sign-attempts 2 \
  --output json-compact

phase="irrevocably_finalize_program_upgrade_authority"
run_json freeze-program solana program set-upgrade-authority "$program_pubkey" \
  --url "$devnet_rpc" \
  --commitment finalized \
  --keypair "$payer_key" \
  --upgrade-authority "$payer_key" \
  --final \
  --output json-compact

phase="create_exact_token_2022_mint"
run_json create-mint spl-token create-token \
  --url "$devnet_rpc" \
  --fee-payer "$payer_key" \
  --mint-authority "$payer_pubkey" \
  --program-2022 \
  --decimals 9 \
  --enable-freeze \
  --enable-confidential-transfers auto \
  --transfer-hook "$program_pubkey" \
  --output json-compact \
  "$mint_key"

phase="create_disposable_source_token_account"
run_json create-source spl-token create-account \
  --url "$devnet_rpc" \
  --fee-payer "$payer_key" \
  --program-2022 \
  --owner "$payer_pubkey" \
  --output json-compact \
  "$mint_pubkey"

source_address=$(spl-token address \
  --url "$devnet_rpc" \
  --verbose \
  --program-2022 \
  --token "$mint_pubkey" \
  --owner "$payer_pubkey" 2>"$temp_dir/source-address.stderr" | awk 'NF {value=$NF} END {print value}')
[[ "$source_address" =~ ^[1-9A-HJ-NP-Za-km-z]{32,44}$ ]] || {
  phase="source_token_address_derivation_failed"
  exit 1
}

phase="create_disposable_recipient_token_account"
run_json create-destination spl-token create-account \
  --url "$devnet_rpc" \
  --fee-payer "$payer_key" \
  --program-2022 \
  --owner "$recipient_pubkey" \
  --output json-compact \
  "$mint_pubkey"

phase="mint_fixed_rehearsal_supply"
run_json mint-supply spl-token mint \
  --url "$devnet_rpc" \
  --fee-payer "$payer_key" \
  --mint-authority "$payer_key" \
  --program-2022 \
  --output json-compact \
  "$mint_pubkey" 1000000000 "$source_address"

phase="revoke_freeze_authority"
run_json revoke-freeze spl-token authorize \
  --url "$devnet_rpc" \
  --fee-payer "$payer_key" \
  --authority "$payer_key" \
  --program-2022 \
  --output json-compact \
  "$mint_pubkey" freeze --disable

phase="revoke_mint_authority"
run_json revoke-mint spl-token authorize \
  --url "$devnet_rpc" \
  --fee-payer "$payer_key" \
  --authority "$payer_key" \
  --program-2022 \
  --output json-compact \
  "$mint_pubkey" mint --disable

phase="immutable_program_and_law_rehearsal_driver"
"$node_bin" "$driver_for_node" \
  --execute "$execute_confirmation" \
  --artifact "$(to_node_path "$artifact")" \
  --payer "$(to_node_path "$payer_key")" \
  --recipient "$(to_node_path "$recipient_key")" \
  --program-id "$program_pubkey" \
  --mint "$mint_pubkey" \
  --cli-evidence-dir "$(to_node_path "$cli_evidence_dir")"

phase="complete"
