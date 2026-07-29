#!/usr/bin/env bash
set -euo pipefail

expected_anchor="anchor-cli 1.0.2"
expected_solana="solana-cli 3.1.10"

for command_name in cargo anchor solana docker sha256sum; do
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

cargo fmt --all -- --check
cargo test --workspace --all-targets --locked
anchor build --verifiable

binary="target/verifiable/iat_v2.so"
if [[ ! -s "$binary" ]]; then
  echo "FAIL: verifiable build did not produce $binary" >&2
  exit 1
fi

echo "PASS: locked host tests and verifiable SBF build completed."
sha256sum "$binary"
stat --printf='programBinaryBytes=%s\n' "$binary"
echo "HOLD: this output is build evidence only; it does not authorize deployment or a transaction."
