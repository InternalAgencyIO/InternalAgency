#!/usr/bin/env bash
set -euo pipefail

# This helper is intentionally interactive. It uploads only the already-built
# verifiable Devnet program bytes and transfers the temporary buffer authority
# to the published 7XZ Model T address. It cannot perform the final upgrade.
#
# A paid buffer already exists for this ceremony. Refuse to create another one.
# Keep this script only as an auditable record of the original preparation path.

EXISTING_BUFFER="Aarejf4n2vwDya7AuVVw2C21PPeoYHb1e8Rw3ukpi3L6"
echo "HOLD: a paid Devnet buffer already exists: $EXISTING_BUFFER" >&2
echo "Use scripts/repair-iat-v2-devnet-buffer.sh to repair it in place." >&2
echo "Nothing was signed or broadcast." >&2
exit 1

SOLANA_BIN="${SOLANA_BIN:-$HOME/.local/share/solana/install/active_release/bin/solana}"
PAYER_KEYPAIR="${PAYER_KEYPAIR:-$HOME/.config/solana/iat-v2-devnet-deployer.json}"
ARTIFACT="${ARTIFACT:-target/verifiable/iat_v2.so}"
EXPECTED_PAYER="DYURSZnNLak5YNt2vLJUnU5iWDUbAo53oUfzZ8dVc5d4"
EXPECTED_AUTHORITY="7XZjd7aNNci63LZy9syqgjvjNHvkQ83Uwo7cyynrfzPH"
EXPECTED_HASH="634d95055b891e6b624a3f6996d10b66e2a7f4bbb1ab50711d6195f72c7772a7"
PROGRAM_ID="62Gth5per9yCuLTG4tnvVDf8yszDvt6Undz3xDmtsnuj"

if [[ ! -x "$SOLANA_BIN" ]]; then
  echo "HOLD: Solana CLI not found at $SOLANA_BIN" >&2
  exit 1
fi
if [[ ! -f "$PAYER_KEYPAIR" ]]; then
  echo "HOLD: existing Devnet deployer keypair not found at $PAYER_KEYPAIR" >&2
  exit 1
fi
if [[ ! -f "$ARTIFACT" ]]; then
  echo "HOLD: verified artifact not found at $ARTIFACT" >&2
  exit 1
fi

actual_payer="$("$SOLANA_BIN" address -k "$PAYER_KEYPAIR")"
actual_hash="$(sha256sum "$ARTIFACT" | awk '{print $1}')"
if [[ "$actual_payer" != "$EXPECTED_PAYER" ]]; then
  echo "HOLD: payer is $actual_payer, expected $EXPECTED_PAYER" >&2
  exit 1
fi
if [[ "$actual_hash" != "$EXPECTED_HASH" ]]; then
  echo "HOLD: artifact hash is $actual_hash, expected $EXPECTED_HASH" >&2
  exit 1
fi

"$SOLANA_BIN" program show "$PROGRAM_ID" \
  --url devnet \
  --keypair "$PAYER_KEYPAIR"
"$SOLANA_BIN" balance "$actual_payer" \
  --url devnet \
  --keypair "$PAYER_KEYPAIR"

echo
echo "This will broadcast the temporary Devnet buffer upload."
echo "It will NOT upgrade the program and cannot touch mainnet."
read -r -p "Type UPLOAD-DEVNET exactly to continue: " confirmation
if [[ "$confirmation" != "UPLOAD-DEVNET" ]]; then
  echo "Cancelled. Nothing was broadcast."
  exit 1
fi

upload_json="$("$SOLANA_BIN" program write-buffer "$ARTIFACT" \
  --url devnet \
  --keypair "$PAYER_KEYPAIR" \
  --fee-payer "$PAYER_KEYPAIR" \
  --buffer-authority "$PAYER_KEYPAIR" \
  --use-rpc \
  --output json-compact)"

buffer_address="$(printf '%s' "$upload_json" | python3 -c '
import json
import re
import sys

value = json.load(sys.stdin)
preferred = ("buffer", "bufferId", "buffer_id", "programId", "program_id")

def strings(item):
    if isinstance(item, dict):
        for key in preferred:
            candidate = item.get(key)
            if isinstance(candidate, str):
                yield candidate
        for candidate in item.values():
            yield from strings(candidate)
    elif isinstance(item, list):
        for candidate in item:
            yield from strings(candidate)
    elif isinstance(item, str):
        yield item

pattern = re.compile(r"^[1-9A-HJ-NP-Za-km-z]{32,44}$")
for candidate in strings(value):
    if pattern.fullmatch(candidate):
        print(candidate)
        break
')"

if [[ -z "$buffer_address" ]]; then
  echo "HOLD: upload completed but the public buffer address could not be parsed." >&2
  echo "$upload_json"
  exit 1
fi

"$SOLANA_BIN" program show "$buffer_address" \
  --url devnet \
  --keypair "$PAYER_KEYPAIR"

"$SOLANA_BIN" program set-buffer-authority "$buffer_address" \
  --new-buffer-authority "$EXPECTED_AUTHORITY" \
  --buffer-authority "$PAYER_KEYPAIR" \
  --url devnet \
  --keypair "$PAYER_KEYPAIR"

"$SOLANA_BIN" program show "$buffer_address" \
  --url devnet \
  --keypair "$PAYER_KEYPAIR"

echo
echo "BUFFER READY: $buffer_address"
echo "NEXT URL: http://127.0.0.1:4175/?mode=upgrade&buffer=$buffer_address"
echo "The final program upgrade still requires the 7XZ Model T in Chrome."
