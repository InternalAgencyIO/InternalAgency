#!/usr/bin/env bash
set -euo pipefail

expected_anchor="anchor-cli 1.0.2"
expected_solana="solana-cli 3.1.10"

for command_name in cargo anchor solana docker sha256sum python3; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "FAIL: required command is missing: $command_name" >&2
    exit 1
  fi
done

actual_anchor="$(anchor --version)"
actual_solana="$(solana --version)"
if [[ "$actual_anchor" != "$expected_anchor" ]]; then
  echo "FAIL: expected $expected_anchor; found $actual_anchor" >&2
  exit 1
fi
if [[ "$actual_solana" != "$expected_solana" \
  && "$actual_solana" != "$expected_solana "* ]]; then
  echo "FAIL: expected $expected_solana; found $actual_solana" >&2
  exit 1
fi

if ! grep -Fq 'channel = "1.97.1"' rust-toolchain.toml; then
  echo "FAIL: rust-toolchain.toml is not pinned to 1.97.1" >&2
  exit 1
fi
if ! grep -Fq 'anchor_version = "1.0.2"' Anchor.toml \
  || ! grep -Fq 'solana_version = "3.1.10"' Anchor.toml; then
  echo "FAIL: Anchor.toml toolchain pins drifted" >&2
  exit 1
fi
if ! grep -Fq 'wallet = "launch/HOLD-no-signing-wallet.json"' Anchor.toml \
  || [[ -e launch/HOLD-no-signing-wallet.json ]]; then
  echo "FAIL: build-only Anchor wallet boundary drifted" >&2
  exit 1
fi

cargo fmt --all -- --check
cargo test --workspace --all-targets --locked
sbf_log="target/iat-v2-sbf-build.log"
anchor build --verifiable --ignore-keys 2>&1 | tee "$sbf_log"

if grep -Eqi \
  'Stack offset of|stack frame of [0-9]+ bytes exceeds|max offset exceeded|overwrites values|undefined behavior' \
  "$sbf_log"; then
  echo "FAIL: SBF compiler reported an unsafe stack diagnostic." >&2
  exit 1
fi

if [[ -e target/deploy/iat_v2-keypair.json ]]; then
  echo "FAIL: build-only proof produced forbidden program-keypair material" >&2
  exit 1
fi

binary="target/verifiable/iat_v2.so"
if [[ ! -s "$binary" ]]; then
  echo "FAIL: verifiable build did not produce $binary" >&2
  exit 1
fi

idl="target/idl/iat_v2.json"
expected_program_id="62Gth5per9yCuLTG4tnvVDf8yszDvt6Undz3xDmtsnuj"
if [[ ! -s "$idl" ]]; then
  echo "FAIL: verifiable build did not produce $idl" >&2
  exit 1
fi
python3 - "$idl" "$expected_program_id" <<'PY'
import json
import pathlib
import sys

idl_path = pathlib.Path(sys.argv[1])
expected_program_id = sys.argv[2]
try:
    document = json.loads(idl_path.read_text(encoding="utf-8"))
except (OSError, UnicodeError, json.JSONDecodeError) as error:
    raise SystemExit(f"FAIL: generated IDL is not valid UTF-8 JSON: {error}") from error
if document.get("address") != expected_program_id:
    raise SystemExit(
        "FAIL: generated IDL address does not match the reviewed IAT V2 program ID"
    )
PY

echo "PASS: locked host tests and program-ID-bound verifiable SBF artifacts completed."
sha256sum "$binary" "$idl"
stat --printf='programBinaryBytes=%s\n' "$binary"
stat --printf='programIdlBytes=%s\n' "$idl"
echo "HOLD: this output is build evidence only; it does not authorize deployment or a transaction."
