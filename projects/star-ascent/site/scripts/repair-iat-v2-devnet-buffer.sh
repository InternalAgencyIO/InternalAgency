#!/usr/bin/env bash
set -euo pipefail

SOLANA_BIN="${SOLANA_BIN:-$HOME/.local/share/solana/install/active_release/bin/solana}"
PAYER_KEYPAIR="${PAYER_KEYPAIR:-$HOME/.config/solana/iat-v2-devnet-deployer.json}"
ARTIFACT="${ARTIFACT:-target/verifiable/iat_v2.so}"
BUFFER_ADDRESS="Aarejf4n2vwDya7AuVVw2C21PPeoYHb1e8Rw3ukpi3L6"
EXPECTED_PAYER="DYURSZnNLak5YNt2vLJUnU5iWDUbAo53oUfzZ8dVc5d4"
NEW_AUTHORITY="7XZjd7aNNci63LZy9syqgjvjNHvkQ83Uwo7cyynrfzPH"
EXPECTED_HASH="634d95055b891e6b624a3f6996d10b66e2a7f4bbb1ab50711d6195f72c7772a7"

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

confirmation="${IAT_REPAIR_CONFIRM:-}"
if [[ -z "$confirmation" ]]; then
  read -r -p "Type REPAIR-BUFFER exactly to continue: " confirmation
fi
if [[ "$confirmation" != "REPAIR-BUFFER" ]]; then
  echo "Cancelled. Nothing was broadcast."
  exit 1
fi

echo "Repairing existing buffer $BUFFER_ADDRESS in place."
echo "No second buffer will be created."

dump_path="$(mktemp /tmp/iat-v2-buffer-XXXXXX.so)"
trap 'rm -f -- "$dump_path"' EXIT
verified=false

for cycle in $(seq 1 12); do
  echo "Repair cycle $cycle of 12: writing mismatched chunks..."
  write_succeeded=false
  if output="$("$SOLANA_BIN" program write-buffer "$ARTIFACT" \
    --buffer "$BUFFER_ADDRESS" \
    --buffer-authority "$PAYER_KEYPAIR" \
    --fee-payer "$PAYER_KEYPAIR" \
    --keypair "$PAYER_KEYPAIR" \
    --url devnet \
    --use-rpc \
    --max-sign-attempts 1 2>&1)"; then
    echo "$output"
    write_succeeded=true
  else
    echo "$output"
    if [[ "$output" != *"429"* && "$output" != *"Too Many Requests"* ]]; then
      echo "HOLD: non-rate-limit write error; stopping." >&2
      exit 1
    fi
    echo "RPC rate-limited this write cycle; checking any chunks that finalized."
  fi

  dump_complete=false
  for read_attempt in $(seq 1 6); do
    echo "Repair cycle $cycle: hash verification read $read_attempt of 6..."
    if output="$("$SOLANA_BIN" program dump "$BUFFER_ADDRESS" "$dump_path" \
      --url devnet \
      --keypair "$PAYER_KEYPAIR" 2>&1)"; then
      echo "$output"
      dump_complete=true
      break
    fi
    echo "$output"
    if [[ "$output" != *"429"* && "$output" != *"Too Many Requests"* ]]; then
      echo "HOLD: non-rate-limit verification error; stopping." >&2
      exit 1
    fi
    sleep 15
  done

  if [[ "$dump_complete" == "true" ]]; then
    buffer_hash="$(sha256sum "$dump_path" | awk '{print $1}')"
    echo "OBSERVED BUFFER HASH: $buffer_hash"
    if [[ "$buffer_hash" == "$EXPECTED_HASH" ]]; then
      verified=true
      break
    fi
  fi

  if [[ "$write_succeeded" == "true" ]]; then
    echo "CLI reported success but the exact hash is not present yet; retrying safely."
  fi
  sleep 15
done

if [[ "$verified" != "true" ]]; then
  echo "HOLD: buffer did not reach exact hash $EXPECTED_HASH after 12 verified cycles." >&2
  exit 1
fi
echo "VERIFIED BUFFER HASH: $EXPECTED_HASH"

IAT_HANDOFF_CONFIRM=TRANSFER-7XZ \
  SOLANA_BIN="$SOLANA_BIN" \
  PAYER_KEYPAIR="$PAYER_KEYPAIR" \
  bash scripts/handoff-iat-v2-devnet-buffer.sh

echo
echo "REPAIR COMPLETE: exact artifact verified and buffer authority returned to $NEW_AUTHORITY"
