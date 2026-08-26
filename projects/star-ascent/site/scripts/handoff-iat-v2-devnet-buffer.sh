#!/usr/bin/env bash
set -euo pipefail

SOLANA_BIN="${SOLANA_BIN:-$HOME/.local/share/solana/install/active_release/bin/solana}"
PAYER_KEYPAIR="${PAYER_KEYPAIR:-$HOME/.config/solana/iat-v2-devnet-deployer.json}"
NODE_BIN="${NODE_BIN:-node}"
ARTIFACT="${ARTIFACT:-target/verifiable/iat_v2.so}"
EVIDENCE="${EVIDENCE:-target/verifiable/iat-v2-build-evidence.json}"
BUFFER_ADDRESS="${BUFFER_ADDRESS:-}"
EXPECTED_PAYER="DYURSZnNLak5YNt2vLJUnU5iWDUbAo53oUfzZ8dVc5d4"
NEW_AUTHORITY="7XZjd7aNNci63LZy9syqgjvjNHvkQ83Uwo7cyynrfzPH"

set +e
binding_record="$("$NODE_BIN" scripts/iat-v2-devnet-buffer-preflight.mjs verify \
  --artifact "$ARTIFACT" \
  --evidence "$EVIDENCE" 2>&1)"
binding_status=$?
set -e
printf '%s\n' "$binding_record"
if (( binding_status != 0 )); then
  echo "HOLD: migration artifact/evidence binding did not pass; no authority handoff was attempted." >&2
  exit "$binding_status"
fi
read -r EXPECTED_HASH EXPECTED_BYTES < <(
  printf '%s' "$binding_record" \
    | "$NODE_BIN" -e 'const chunks=[]; process.stdin.on("data", (chunk) => chunks.push(chunk)); process.stdin.on("end", () => { const value=JSON.parse(Buffer.concat(chunks)); process.stdout.write(`${value.artifactSha256} ${value.artifactBytes}\n`); });'
)
if [[ -z "$BUFFER_ADDRESS" ]]; then
  echo "HOLD: BUFFER_ADDRESS is required; no default or historical buffer is admitted." >&2
  exit 1
fi

is_retryable_rpc_error() {
  local status="$1"
  local message="$2"
  (( status == 124 )) ||
    [[ "$message" == *"429"* ||
       "$message" == *"Too Many Requests"* ||
       "$message" == *"Max retries exceeded"* ||
       "$message" == *"Blockhash not found"* ||
       "$message" == *"block height exceeded"* ||
       "$message" == *"was not confirmed"* ||
       "$message" == *"timed out"* ||
       "$message" == *"Timeout"* ]]
}

fetch_buffer_record() {
  authority_record=""
  for read_attempt in $(seq 1 12); do
    echo "Authority verification read $read_attempt of 12..."
    if authority_record="$(timeout 45 "$SOLANA_BIN" program show "$BUFFER_ADDRESS" \
      --url devnet \
      --keypair "$PAYER_KEYPAIR" 2>&1)"; then
      echo "$authority_record"
      return 0
    fi
    status=$?
    echo "$authority_record"
    if ! is_retryable_rpc_error "$status" "$authority_record"; then
      return 1
    fi
    sleep 10
  done
  return 1
}

actual_payer="$("$SOLANA_BIN" address -k "$PAYER_KEYPAIR")"
if [[ "$actual_payer" != "$EXPECTED_PAYER" ]]; then
  echo "HOLD: payer is $actual_payer, expected $EXPECTED_PAYER" >&2
  exit 1
fi

dump_path="$(mktemp /tmp/iat-v2-handoff-buffer-XXXXXX.so)"
trap 'rm -f -- "$dump_path"' EXIT
dump_complete=false
for read_attempt in $(seq 1 12); do
  echo "Pre-handoff hash read $read_attempt of 12..."
  if output="$(timeout 90 "$SOLANA_BIN" program dump "$BUFFER_ADDRESS" "$dump_path" \
    --url devnet \
    --keypair "$PAYER_KEYPAIR" 2>&1)"; then
    echo "$output"
    dump_complete=true
    break
  fi
  status=$?
  echo "$output"
  if ! is_retryable_rpc_error "$status" "$output"; then
    break
  fi
  sleep 10
done
if [[ "$dump_complete" != "true" ]]; then
  echo "HOLD: buffer could not be read before authority handoff." >&2
  exit 1
fi
observed_hash="$(sha256sum "$dump_path" | awk '{print $1}')"
if [[ "$observed_hash" != "$EXPECTED_HASH" ]]; then
  echo "HOLD: buffer hash is $observed_hash, expected $EXPECTED_HASH." >&2
  echo "Rebuild or complete the buffer before any authority handoff." >&2
  exit 1
fi

echo "BUFFER: $BUFFER_ADDRESS"
echo "FROM:   $EXPECTED_PAYER"
echo "TO:     $NEW_AUTHORITY"
echo "HASH:   $EXPECTED_HASH"
echo "BYTES:  $EXPECTED_BYTES"
echo "This cannot upload a second buffer and cannot touch mainnet."
read -r -p "Type TRANSFER-7XZ exactly to continue: " confirmation
if [[ "$confirmation" != "TRANSFER-7XZ" ]]; then
  echo "Cancelled. Nothing was broadcast."
  exit 1
fi

if ! fetch_buffer_record; then
  echo "HOLD: buffer authority could not be read before handoff." >&2
  exit 1
fi
if [[ "$authority_record" == *"Authority: $NEW_AUTHORITY"* ]]; then
  echo
  echo "BUFFER AUTHORITY ALREADY HELD BY 7XZ. RETURN TO CODEX."
  exit 0
fi
if [[ "$authority_record" != *"Authority: $EXPECTED_PAYER"* ]]; then
  echo "HOLD: buffer authority is neither the expected payer nor 7XZ." >&2
  exit 1
fi

for attempt in $(seq 1 12); do
  echo "Authority handoff attempt $attempt of 12..."
  if output="$(timeout 90 "$SOLANA_BIN" program set-buffer-authority "$BUFFER_ADDRESS" \
    --new-buffer-authority "$NEW_AUTHORITY" \
    --buffer-authority "$PAYER_KEYPAIR" \
    --url devnet \
    --keypair "$PAYER_KEYPAIR" \
    --commitment confirmed 2>&1)"; then
    echo "$output"
    if fetch_buffer_record && [[ "$authority_record" == *"Authority: $NEW_AUTHORITY"* ]]; then
      echo
      echo "BUFFER AUTHORITY HANDED TO 7XZ. RETURN TO CODEX."
      exit 0
    fi
    echo "Handoff returned but 7XZ is not confirmed yet; retrying verification."
    sleep 10
    continue
  fi
  status=$?
  echo "$output"
  if fetch_buffer_record && [[ "$authority_record" == *"Authority: $NEW_AUTHORITY"* ]]; then
    echo
    echo "BUFFER AUTHORITY HANDED TO 7XZ. RETURN TO CODEX."
    exit 0
  fi
  if ! is_retryable_rpc_error "$status" "$output"; then
    echo "HOLD: non-rate-limit error; stopping without another attempt." >&2
    exit 1
  fi
  sleep 10
done

echo "HOLD: the public Devnet RPC did not confirm the authority handoff." >&2
exit 1
