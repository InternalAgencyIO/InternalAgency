#!/usr/bin/env bash
set -euo pipefail

schema="iat-b3-devnet-rehearsal/v1"
devnet_rpc="https://api.devnet.solana.com"
expected_devnet_genesis_hash="EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG"
expected_artifact_sha256="927f22cbb431caf1fe9a1cd3782194c20e292f40d72757e7b7dcdf62e8f0381c"
expected_artifact_size="154952"
execute_confirmation="CONFIRMED_PUBLIC_DEVNET_REHEARSAL"
expected_reused_v2_devnet_payer="DYURSZnNLak5YNt2vLJUnU5iWDUbAo53oUfzZ8dVc5d4"
funding_mode=""
reuse_payer_key=""

# This check intentionally precedes mktemp, key generation, RPC contact, and
# every public write. Both executable modes are exact, explicit Devnet-only
# opt-ins; neither reads the default Solana signer.
if [[ $# -ne 1 ]]; then
  printf '{"schema":"iat-b3-devnet-rehearsal/v1","status":"NOT_EXECUTED","reason":"explicit_execute_required","publicNetworkWrites":false}\n'
  exit 2
fi
case "$1" in
  --execute)
    funding_mode="DEVNET_FAUCET"
    ;;
  --execute-reuse-v2-devnet-payer)
    funding_mode="REUSED_V2_DEVNET_PAYER"
    reuse_payer_key=$(printenv IAT_B3_V2_DEVNET_PAYER_KEYPAIR 2>/dev/null || true)
    [[ "$reuse_payer_key" == /* && -f "$reuse_payer_key" && ! -L "$reuse_payer_key" ]] || {
      printf '{"schema":"iat-b3-devnet-rehearsal/v1","status":"FAIL","phase":"funding_preflight","reason":"explicit_v2_devnet_payer_key_required","publicNetworkWrites":false}\n'
      exit 1
    }
    reuse_payer_key=$(cd -- "$(dirname -- "$reuse_payer_key")" && pwd -P)/$(basename -- "$reuse_payer_key")
    ;;
  *)
    printf '{"schema":"iat-b3-devnet-rehearsal/v1","status":"NOT_EXECUTED","reason":"explicit_execute_required","publicNetworkWrites":false}\n'
    exit 2
    ;;
esac

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
if [[ "$funding_mode" == "REUSED_V2_DEVNET_PAYER" ]]; then
  reused_payer_pubkey=$(solana-keygen pubkey "$reuse_payer_key" 2>/dev/null || true)
  [[ "$reused_payer_pubkey" == "$expected_reused_v2_devnet_payer" ]] || {
    printf '{"schema":"iat-b3-devnet-rehearsal/v1","status":"FAIL","phase":"funding_preflight","reason":"v2_devnet_payer_identity_mismatch","publicNetworkWrites":false}\n'
    exit 1
  }
fi

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
        [[ -s "$evidence_file" ]] || continue
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

if [[ "$funding_mode" == "DEVNET_FAUCET" ]]; then
  payer_key="$temp_dir/payer.json"
else
  payer_key="$reuse_payer_key"
fi
program_key="$temp_dir/program.json"
buffer_key="$temp_dir/buffer.json"
mint_key="$temp_dir/mint.json"
recipient_key="$temp_dir/recipient.json"
cli_evidence_dir="$temp_dir/cli-evidence"
mkdir -p -- "$cli_evidence_dir"

generated_key_files=("$program_key" "$buffer_key" "$mint_key" "$recipient_key")
if [[ "$funding_mode" == "DEVNET_FAUCET" ]]; then
  generated_key_files=("$payer_key" "${generated_key_files[@]}")
fi
for key_file in "${generated_key_files[@]}"; do
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

printf '{"schema":"iat-b3-devnet-rehearsal/v1","status":"READY_FOR_FIRST_PUBLIC_WRITE","network":"solana-devnet","rpc":"https://api.devnet.solana.com","genesisHash":"%s","fundingMode":"%s","payerDisposable":%s,"publicNetworkWrites":false,"publicAddresses":{"payer":{"address":"%s","explorerUrl":"https://explorer.solana.com/address/%s?cluster=devnet"},"program":{"address":"%s","explorerUrl":"https://explorer.solana.com/address/%s?cluster=devnet"},"deploymentBuffer":{"address":"%s","explorerUrl":"https://explorer.solana.com/address/%s?cluster=devnet"},"mint":{"address":"%s","explorerUrl":"https://explorer.solana.com/address/%s?cluster=devnet"},"recipient":{"address":"%s","explorerUrl":"https://explorer.solana.com/address/%s?cluster=devnet"}}}\n' \
  "$observed_genesis_hash" "$funding_mode" "$([[ "$funding_mode" == "DEVNET_FAUCET" ]] && printf true || printf false)" \
  "$payer_pubkey" "$payer_pubkey" \
  "$program_pubkey" "$program_pubkey" \
  "$buffer_pubkey" "$buffer_pubkey" \
  "$mint_pubkey" "$mint_pubkey" \
  "$recipient_pubkey" "$recipient_pubkey"
identity_evidence_emitted=true

phase="payer_history_boundary_preflight"
payer_history_raw=$(solana transaction-history "$payer_pubkey" \
  --url "$devnet_rpc" \
  --commitment finalized \
  --limit 1 \
  --output json-compact 2>"$temp_dir/payer-history-boundary.stderr")
payer_history_pattern='^\[\{"signature":"([1-9A-HJ-NP-Za-km-z]{64,88})"\}\]$'
if [[ "$payer_history_raw" == "[]" ]]; then
  payer_history_before="NONE"
elif [[ "$payer_history_raw" =~ $payer_history_pattern ]]; then
  payer_history_before="${BASH_REMATCH[1]}"
else
  phase="payer_history_boundary_invalid"
  exit 1
fi

run_json() {
  local label=$1
  local evidence_file
  local command_exit_code=0
  local sanitizer_exit_code=0
  local stdout_json_present=false
  local cli_evidence_sanitized=false
  shift
  evidence_file="$cli_evidence_dir/$label.json"
  if "$@" >"$evidence_file" 2>"$temp_dir/$label.stderr"; then
    command_exit_code=0
  else
    command_exit_code=$?
  fi
  if [[ -s "$evidence_file" ]]; then
    stdout_json_present=true
    if "$node_bin" "$driver_for_node" \
      --offline-sanitize-cli-evidence "$label" "$(to_node_path "$evidence_file")" \
      2>"$temp_dir/$label-sanitizer.stderr"; then
      cli_evidence_sanitized=true
    else
      sanitizer_exit_code=$?
    fi
  else
    sanitizer_exit_code=1
  fi
  if [[ $command_exit_code -ne 0 ]]; then
    printf '{"schema":"iat-b3-devnet-rehearsal/v1","status":"FAIL","phase":"public_cli_command","label":"%s","cliExitCode":%d,"stdoutJsonPresent":%s,"cliEvidenceSanitized":%s}\n' \
      "$label" "$command_exit_code" "$stdout_json_present" "$cli_evidence_sanitized"
    return "$command_exit_code"
  fi
  return "$sanitizer_exit_code"
}

run_airdrop() {
  local label=$1
  local raw_file
  local evidence_file
  local normalized_file
  local command_exit_code=0
  local normalizer_exit_code=0
  local stdout_present=false
  shift
  raw_file="$temp_dir/$label.stdout"
  evidence_file="$cli_evidence_dir/$label.json"
  normalized_file="$temp_dir/$label.normalized.json"
  if "$@" >"$raw_file" 2>"$temp_dir/$label.stderr"; then
    command_exit_code=0
  else
    command_exit_code=$?
  fi
  if [[ -s "$raw_file" ]]; then
    stdout_present=true
  fi
  if [[ $command_exit_code -ne 0 ]]; then
    printf '{"schema":"iat-b3-devnet-rehearsal/v1","status":"FAIL","phase":"public_cli_command","label":"%s","cliExitCode":%d,"stdoutPresent":%s,"normalizedEvidencePresent":false}\n' \
      "$label" "$command_exit_code" "$stdout_present"
    return "$command_exit_code"
  fi
  if "$node_bin" "$driver_for_node" \
    --offline-normalize-airdrop-cli-evidence \
    "$label" \
    "$(to_node_path "$raw_file")" \
    >"$normalized_file" 2>"$temp_dir/$label-normalizer.stderr"; then
    mv -- "$normalized_file" "$evidence_file"
    cat "$evidence_file"
    return 0
  else
    normalizer_exit_code=$?
  fi
  [[ -s "$normalized_file" ]] && cat "$normalized_file"
  return "$normalizer_exit_code"
}

if [[ "$funding_mode" == "DEVNET_FAUCET" ]]; then
  phase="devnet_airdrop_1"
  public_writes_started=true
  permanent_artifacts_may_remain=true
  run_airdrop airdrop-1 solana airdrop 2 "$payer_pubkey" \
    --url "$devnet_rpc" \
    --keypair "$payer_key" \
    --commitment finalized \
    --output json-compact
  phase="devnet_airdrop_2"
  run_airdrop airdrop-2 solana airdrop 1 "$payer_pubkey" \
    --url "$devnet_rpc" \
    --keypair "$payer_key" \
    --commitment finalized \
    --output json-compact
else
  phase="reused_v2_devnet_payer_balance_preflight"
fi

funding_lamports=$(solana balance "$payer_pubkey" \
  --url "$devnet_rpc" \
  --commitment finalized \
  --lamports 2>"$temp_dir/balance.stderr" | awk 'NR == 1 {print $1}')
[[ "$funding_lamports" =~ ^[0-9]+$ && "$funding_lamports" -ge 3000000000 ]] || {
  phase="devnet_funding_balance_insufficient"
  exit 1
}

phase="deploy_exact_optimized_program"
public_writes_started=true
permanent_artifacts_may_remain=true
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
  --funding-mode "$funding_mode" \
  --payer-history-before "$payer_history_before" \
  --cli-evidence-dir "$(to_node_path "$cli_evidence_dir")"

phase="complete"
