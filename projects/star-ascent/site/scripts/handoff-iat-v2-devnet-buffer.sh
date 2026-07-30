#!/usr/bin/env bash
set -euo pipefail

SOLANA_BIN="${SOLANA_BIN:-$HOME/.local/share/solana/install/active_release/bin/solana}"
PAYER_KEYPAIR="${PAYER_KEYPAIR:-$HOME/.config/solana/iat-v2-devnet-deployer.json}"
BUFFER_ADDRESS="Aarejf4n2vwDya7AuVVw2C21PPeoYHb1e8Rw3ukpi3L6"
EXPECTED_PAYER="DYURSZnNLak5YNt2vLJUnU5iWDUbAo53oUfzZ8dVc5d4"
NEW_AUTHORITY="7XZjd7aNNci63LZy9syqgjvjNHvkQ83Uwo7cyynrfzPH"
EXPECTED_HASH="634d95055b891e6b624a3f6996d10b66e2a7f4bbb1ab50711d6195f72c7772a7"

actual_payer="$("$SOLANA_BIN" address -k "$PAYER_KEYPAIR")"
if [[ "$actual_payer" != "$EXPECTED_PAYER" ]]; then
  echo "HOLD: payer is $actual_payer, expected $EXPECTED_PAYER" >&2
  exit 1
fi

dump_path="$(mktemp /tmp/iat-v2-handoff-buffer-XXXXXX.so)"
trap 'rm -f -- "$dump_path"' EXIT
if ! output="$("$SOLANA_BIN" program dump "$BUFFER_ADDRESS" "$dump_path" \
  --url devnet \
  --keypair "$PAYER_KEYPAIR" 2>&1)"; then
  echo "$output" >&2
  echo "HOLD: buffer could not be read before authority handoff." >&2
  exit 1
fi
observed_hash="$(sha256sum "$dump_path" | awk '{print $1}')"
if [[ "$observed_hash" != "$EXPECTED_HASH" ]]; then
  echo "HOLD: buffer hash is $observed_hash, expected $EXPECTED_HASH." >&2
  echo "Repair the existing buffer before any authority handoff." >&2
  exit 1
fi

echo "BUFFER: $BUFFER_ADDRESS"
echo "FROM:   $EXPECTED_PAYER"
echo "TO:     $NEW_AUTHORITY"
echo "HASH:   $EXPECTED_HASH"
echo "This cannot upload a second buffer and cannot touch mainnet."
confirmation="${IAT_HANDOFF_CONFIRM:-}"
if [[ -z "$confirmation" ]]; then
  read -r -p "Type TRANSFER-7XZ exactly to continue: " confirmation
fi
if [[ "$confirmation" != "TRANSFER-7XZ" ]]; then
  echo "Cancelled. Nothing was broadcast."
  exit 1
fi

for attempt in $(seq 1 12); do
  echo "Authority handoff attempt $attempt of 12..."
  if output="$("$SOLANA_BIN" program set-buffer-authority "$BUFFER_ADDRESS" \
    --new-buffer-authority "$NEW_AUTHORITY" \
    --buffer-authority "$PAYER_KEYPAIR" \
    --url devnet \
    --keypair "$PAYER_KEYPAIR" \
    --commitment confirmed 2>&1)"; then
    echo "$output"
    authority_record="$("$SOLANA_BIN" program show "$BUFFER_ADDRESS" \
      --url devnet \
      --keypair "$PAYER_KEYPAIR" 2>&1)"
    echo "$authority_record"
    if [[ "$authority_record" != *"Authority: $NEW_AUTHORITY"* ]]; then
      echo "HOLD: handoff transaction returned, but 7XZ authority is not confirmed." >&2
      exit 1
    fi
    echo
    echo "BUFFER AUTHORITY HANDED TO 7XZ. RETURN TO CODEX."
    exit 0
  fi
  echo "$output"
  if [[ "$output" != *"429"* && "$output" != *"Too Many Requests"* ]]; then
    echo "HOLD: non-rate-limit error; stopping without another attempt." >&2
    exit 1
  fi
  sleep 20
done

echo "HOLD: the public Devnet RPC remained rate-limited. No second buffer was created." >&2
exit 1
