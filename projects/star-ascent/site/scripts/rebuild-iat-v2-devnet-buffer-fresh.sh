#!/usr/bin/env bash
set -euo pipefail

SOLANA_BIN="${SOLANA_BIN:-$HOME/.local/share/solana/install/active_release/bin/solana}"
SOLANA_KEYGEN_BIN="${SOLANA_KEYGEN_BIN:-$HOME/.local/share/solana/install/active_release/bin/solana-keygen}"
PAYER_KEYPAIR="${PAYER_KEYPAIR:-$HOME/.config/solana/iat-v2-devnet-deployer.json}"
ARTIFACT="${ARTIFACT:-target/verifiable/iat_v2.so}"
OLD_BUFFER="Aarejf4n2vwDya7AuVVw2C21PPeoYHb1e8Rw3ukpi3L6"
EXPECTED_PAYER="DYURSZnNLak5YNt2vLJUnU5iWDUbAo53oUfzZ8dVc5d4"
NEW_AUTHORITY="7XZjd7aNNci63LZy9syqgjvjNHvkQ83Uwo7cyynrfzPH"
EXPECTED_HASH="634d95055b891e6b624a3f6996d10b66e2a7f4bbb1ab50711d6195f72c7772a7"
STATE_FILE="launch/iat-v2-devnet-fresh-buffer.txt"
MINIMUM_FRESH_BALANCE_LAMPORTS=4200000000

is_retryable_rpc_error() {
  local message="$1"
  [[ "$message" == *"429"* ||
     "$message" == *"Too Many Requests"* ||
     "$message" == *"Max retries exceeded"* ||
     "$message" == *"Blockhash not found"* ||
     "$message" == *"block height exceeded"* ||
     "$message" == *"was not confirmed"* ||
     "$message" == *"timed out"* ||
     "$message" == *"Timeout"* ]]
}

is_retryable_rpc_failure() {
  local status="$1"
  local message="$2"
  (( status == 124 )) || is_retryable_rpc_error "$message"
}

actual_payer="$("$SOLANA_BIN" address -k "$PAYER_KEYPAIR")"
actual_hash="$(sha256sum "$ARTIFACT" | awk '{print $1}')"
if [[ "$actual_payer" != "$EXPECTED_PAYER" ]]; then
  echo "HOLD: payer is $actual_payer, expected $EXPECTED_PAYER" >&2
  exit 1
fi
if [[ "$actual_hash" != "$EXPECTED_HASH" ]]; then
  echo "HOLD: local artifact hash is $actual_hash, expected $EXPECTED_HASH" >&2
  exit 1
fi

confirmation="${IAT_FRESH_REBUILD_CONFIRM:-}"
if [[ -z "$confirmation" ]]; then
  read -r -p "Type REBUILD-DEVNET-FRESH exactly to continue: " confirmation
fi
if [[ "$confirmation" != "REBUILD-DEVNET-FRESH" ]]; then
  echo "Cancelled. Nothing was broadcast."
  exit 1
fi

echo "NETWORK: DEVNET ONLY"
echo "OLD INCOMPLETE BUFFER: $OLD_BUFFER"
echo "FRESH ARTIFACT HASH:  $EXPECTED_HASH"
echo "FINAL AUTHORITY:      $NEW_AUTHORITY"
echo

old_buffer_present=false
for attempt in $(seq 1 12); do
  echo "Old-buffer preflight $attempt of 12..."
  if output="$(timeout 45 "$SOLANA_BIN" program show "$OLD_BUFFER" \
    --url devnet \
    --keypair "$PAYER_KEYPAIR" 2>&1)"; then
    echo "$output"
    if [[ "$output" != *"Buffer Address: $OLD_BUFFER"* ]]; then
      echo "HOLD: the old address is not an upgradeable-loader buffer." >&2
      exit 1
    fi
    if [[ "$output" != *"Authority: $EXPECTED_PAYER"* ]]; then
      echo "HOLD: the old buffer is not controlled by the expected Devnet payer." >&2
      exit 1
    fi
    old_buffer_present=true
    break
  fi
  status=$?
  echo "$output"
  if [[ "$output" == *"AccountNotFound"* || "$output" == *"not found"* ]]; then
    echo "Old buffer is already closed; continuing with a clean creation."
    break
  fi
  if ! is_retryable_rpc_failure "$status" "$output"; then
    echo "HOLD: old-buffer preflight failed with a non-retryable error." >&2
    exit 1
  fi
  sleep 10
done

if [[ "$old_buffer_present" == "true" ]]; then
  closed=false
  for attempt in $(seq 1 12); do
    echo "Closing abandoned Devnet buffer, attempt $attempt of 12..."
    if output="$(timeout 90 "$SOLANA_BIN" program close "$OLD_BUFFER" \
      --authority "$PAYER_KEYPAIR" \
      --recipient "$EXPECTED_PAYER" \
      --url devnet \
      --keypair "$PAYER_KEYPAIR" \
      --commitment confirmed \
      --bypass-warning 2>&1)"; then
      echo "$output"
      closed=true
      break
    fi
    status=$?
    echo "$output"
    if [[ "$output" == *"AccountNotFound"* || "$output" == *"not found"* ]]; then
      echo "Old buffer is already absent; treating the close as finalized."
      closed=true
      break
    fi
    if ! is_retryable_rpc_failure "$status" "$output"; then
      echo "HOLD: old-buffer close failed with a non-retryable error." >&2
      exit 1
    fi
    sleep 10
  done
  if [[ "$closed" != "true" ]]; then
    echo "HOLD: old Devnet buffer could not be closed after verified retries." >&2
    exit 1
  fi
fi

balance_output=""
for attempt in $(seq 1 12); do
  echo "Reclaimed-balance verification $attempt of 12..."
  if balance_output="$(timeout 45 "$SOLANA_BIN" balance "$EXPECTED_PAYER" \
    --url devnet \
    --lamports 2>&1)"; then
    break
  fi
  status=$?
  echo "$balance_output"
  if ! is_retryable_rpc_failure "$status" "$balance_output"; then
    echo "HOLD: unable to verify payer balance after closing the old buffer." >&2
    exit 1
  fi
  balance_output=""
  sleep 10
done
if [[ -z "$balance_output" ]]; then
  echo "HOLD: payer balance remained unavailable after verified retries." >&2
  exit 1
fi
balance_lamports="$(awk '{print $1}' <<<"$balance_output")"
if [[ ! "$balance_lamports" =~ ^[0-9]+$ ]]; then
  echo "HOLD: unexpected payer balance output: $balance_output" >&2
  exit 1
fi
echo "DEVNET PAYER BALANCE AFTER RECLAIM: $balance_lamports lamports"
if (( balance_lamports < MINIMUM_FRESH_BALANCE_LAMPORTS )); then
  echo "HOLD: reclaimed Devnet balance is below the fresh-buffer rent requirement." >&2
  exit 1
fi

buffer_keypair="$(mktemp /tmp/iat-v2-fresh-buffer-XXXXXX.json)"
dump_path="$(mktemp /tmp/iat-v2-fresh-dump-XXXXXX.so)"
trap 'rm -f -- "$buffer_keypair" "$dump_path"' EXIT
"$SOLANA_KEYGEN_BIN" new \
  --silent \
  --no-bip39-passphrase \
  --force \
  --outfile "$buffer_keypair"
chmod 600 "$buffer_keypair"
new_buffer="$("$SOLANA_BIN" address -k "$buffer_keypair")"
printf '%s\n' "$new_buffer" > "$STATE_FILE"

echo
echo "FRESH BUFFER ADDRESS: $new_buffer"
echo "The temporary buffer creation signer is never printed and will be deleted."

verified=false
for cycle in $(seq 1 12); do
  echo "Fresh upload cycle $cycle of 12..."
  write_succeeded=false
  if output="$(timeout 420 "$SOLANA_BIN" program write-buffer "$ARTIFACT" \
    --buffer "$buffer_keypair" \
    --buffer-authority "$PAYER_KEYPAIR" \
    --fee-payer "$PAYER_KEYPAIR" \
    --keypair "$PAYER_KEYPAIR" \
    --url devnet \
    --use-rpc \
    --with-compute-unit-price 1000 \
    --max-sign-attempts 5 2>&1)"; then
    echo "$output"
    write_succeeded=true
  else
    status=$?
    echo "$output"
    if ! is_retryable_rpc_failure "$status" "$output"; then
      echo "HOLD: fresh-buffer upload failed with a non-retryable error." >&2
      exit 1
    fi
    echo "RPC transport exhausted this upload cycle; verifying finalized chunks."
  fi

  dump_complete=false
  for read_attempt in $(seq 1 6); do
    echo "Fresh-buffer hash read $read_attempt of 6..."
    if output="$(timeout 90 "$SOLANA_BIN" program dump "$new_buffer" "$dump_path" \
      --url devnet \
      --keypair "$PAYER_KEYPAIR" 2>&1)"; then
      echo "$output"
      dump_complete=true
      break
    fi
    status=$?
    echo "$output"
    if ! is_retryable_rpc_failure "$status" "$output"; then
      echo "HOLD: fresh buffer could not be read for exact-hash verification." >&2
      exit 1
    fi
    sleep 10
  done

  if [[ "$dump_complete" == "true" ]]; then
    observed_hash="$(sha256sum "$dump_path" | awk '{print $1}')"
    echo "OBSERVED FRESH BUFFER HASH: $observed_hash"
    if [[ "$observed_hash" == "$EXPECTED_HASH" ]]; then
      verified=true
      break
    fi
  fi

  if [[ "$write_succeeded" == "true" ]]; then
    echo "CLI reported success but the exact hash is not finalized yet; retrying."
  fi
  sleep 10
done

if [[ "$verified" != "true" ]]; then
  echo "HOLD: fresh buffer did not reach the reviewed hash after 12 cycles." >&2
  echo "FRESH BUFFER ADDRESS: $new_buffer" >&2
  exit 1
fi

echo "VERIFIED FRESH BUFFER HASH: $EXPECTED_HASH"

BUFFER_ADDRESS="$new_buffer" \
  IAT_HANDOFF_CONFIRM=TRANSFER-7XZ \
  SOLANA_BIN="$SOLANA_BIN" \
  PAYER_KEYPAIR="$PAYER_KEYPAIR" \
  bash scripts/handoff-iat-v2-devnet-buffer.sh

echo
echo "FRESH REBUILD COMPLETE"
echo "BUFFER:    $new_buffer"
echo "HASH:      $EXPECTED_HASH"
echo "AUTHORITY: $NEW_AUTHORITY"
echo "NEXT URL:  http://127.0.0.1:4175/?mode=upgrade&buffer=$new_buffer"
