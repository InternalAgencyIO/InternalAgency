#!/usr/bin/env bash

set -euo pipefail

schema="iat-b3-account-lifecycle-local-validator/v1"
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
site_dir=$(cd -- "$script_dir/.." && pwd -P)
fixture_root="$site_dir/tests/fixtures/iat-b3-account-lifecycle"
work_root="${IAT_B3_ACCOUNT_LIFECYCLE_WORK_ROOT:-$fixture_root/target}"
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

node_major=$("$node_bin" -p 'Number(process.versions.node.split(".")[0])')
[[ "$node_major" -ge 22 ]] || {
  printf '{"schema":"%s","status":"FAIL","reason":"unsupported_node","observedMajor":%s,"requiredMajor":22,"publicNetworkWrites":false}\n' "$schema" "$node_major"
  exit 2
}

mkdir -p -- "$work_root"
work_root=$(cd -- "$work_root" && pwd -P)
temp_dir=$(mktemp -d "$work_root/local-validator.XXXXXX")
temp_dir=$(cd -- "$temp_dir" && pwd -P)
case "$temp_dir" in
  "$work_root"/local-validator.*) ;;
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
    "$work_root"/local-validator.*) rm -rf -- "$temp_dir" ;;
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
solana-keygen new --no-bip39-passphrase --silent --force --outfile "$temp_dir/payer.json" >/dev/null 2>&1
payer_pubkey=$(solana-keygen pubkey "$temp_dir/payer.json")
"$node_bin" "$(to_node_path "$driver")" \
  --mode prepare-fixture \
  --fixture "$(to_node_path "$temp_dir/law.json")" \
  --config-fixture "$(to_node_path "$temp_dir/config.json")" \
  --payer-pubkey "$payer_pubkey" \
  --env "$(to_node_path "$temp_dir/accounts.env")"

# Contains only fixture public addresses.
# shellcheck disable=SC1090
source "$temp_dir/accounts.env"

CARGO_TARGET_DIR="${IAT_B3_ACCOUNT_LIFECYCLE_CARGO_TARGET_DIR:-$work_root/cargo-target}" cargo build-sbf \
  --manifest-path "$fixture_root/Cargo.toml" \
  --sbf-out-dir "$temp_dir/deploy" \
  -- --locked 2>&1 | tee "$temp_dir/build-sbf.log" >&2
sbf_stack_diagnostics_present=false
if grep -Eiq 'Stack offset of|stack frame of [0-9]+ bytes exceeds|max offset exceeded|overwrites values|undefined behavior' "$temp_dir/build-sbf.log"; then
  sbf_stack_diagnostics_present=true
fi
production_set_eligibility_live_stack_diagnostics_present=false
if grep -Eq 'production_set_eligibility.*(execute_runtime_production_set_eligibility_account_infos|execute_with_active_config|execute_production_(pre_body|retained_body|postimage)_stage)|runtime_account_lifecycle.*(init_if_needed_pre_body|init_if_needed_postimage|system_owned_init_if_needed_post_cpi)' "$temp_dir/build-sbf.log"; then
  production_set_eligibility_live_stack_diagnostics_present=true
fi
artifact="$temp_dir/deploy/iat_b3_account_lifecycle_rehearsal.so"
[[ -s "$artifact" ]]

solana-test-validator \
  --ledger "$temp_dir/ledger" \
  --bpf-program "$PROGRAM_ID" "$artifact" \
  --account "$LAW_STATE" "$temp_dir/law.json" \
  --account "$CONFIG" "$temp_dir/config.json" \
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

for mode in zero update update-rollback prefunded rollback; do
  "$node_bin" "$(to_node_path "$driver")" \
    --mode "$mode" \
    --rpc "$rpc_url" \
    --payer "$(to_node_path "$temp_dir/payer.json")" \
    --law-state "$LAW_STATE"
done

for mode in \
  set-valid-vacant \
  set-valid-prefunded \
  set-invalid-vacant-3 \
  set-invalid-vacant-255 \
  set-invalid-prefunded-3 \
  set-invalid-prefunded-255 \
  set-existing-seed \
  set-existing-invalid-3 \
  set-existing-invalid-255 \
  set-law-rejection; do
  "$node_bin" "$(to_node_path "$driver")" \
    --mode "$mode" \
    --rpc "$rpc_url" \
    --payer "$(to_node_path "$temp_dir/payer.json")" \
    --law-state "$LAW_STATE" \
    --config "$CONFIG"
done

cleanup
trap - EXIT INT TERM
printf '{"schema":"%s","status":"PASS","phase":"summary","realSystemCpiObserved":true,"canonicalPdaSigningObserved":true,"prefundedAllocateAssignFundObserved":true,"existingStateCasObserved":true,"transactionRollbackObserved":true,"setEligibilityRollbackPrerequisiteExercised":true,"setEligibilityRequestedComputeUnitLimit":1400000,"productionComputeBudgetProven":false,"productionSetEligibilityExecutorInvoked":true,"productionSetEligibilityExecutorSbfExecutionProven":true,"localProductionSetEligibilityExecutorSbfExecutionObserved":true,"realProductionSetEligibilityRollbackObserved":true,"sbfBuildStackDiagnosticsPresent":%s,"productionSetEligibilityLiveStackDiagnosticsPresent":%s,"productionFinalArtifactStackSafeProven":false,"productionSetEligibilityInstructionCodecExercised":true,"syntheticProgramErrorMapping":true,"productionProgramErrorAbiProven":false,"lawAuthenticatedBeforeProductionDecode":true,"vacantUnknownRoleRollbackObserved":true,"prefundedUnknownRoleRollbackObserved":true,"existingInvalidRoleZeroCpiNoWriteObserved":true,"lawRejectionBeforeDecodeAndCpiObserved":true,"syntheticDailyLawFixture":true,"syntheticProductionActiveConfigFixture":true,"publicNetworkWrites":false,"productionDispatcherExposed":false,"productionEntrypointProven":false,"finalBinaryDevnetRollbackProven":false,"fullFeatureDevnetRehearsalComplete":false,"activationReady":false,"mainnetStatus":"HOLD","temporaryLedgerRemoved":true,"validatorStopped":true,"generatedKeyMaterialRemoved":true}\n' "$schema" "$sbf_stack_diagnostics_present" "$production_set_eligibility_live_stack_diagnostics_present"
