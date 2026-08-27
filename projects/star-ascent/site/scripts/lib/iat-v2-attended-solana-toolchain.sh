#!/usr/bin/env bash

IAT_V2_EXPECTED_SOLANA_CLI_VERSION='solana-cli 3.1.10 (src:7bc9c805; feat:1620780344, client:Agave)'
IAT_V2_EXPECTED_SOLANA_KEYGEN_VERSION='solana-keygen 3.1.10 (src:7bc9c805; feat:1620780344, client:Agave)'
IAT_V2_EXPECTED_SOLANA_CLI_PATH='/home/a/.local/share/solana/install/releases/3.1.10/solana-release/bin/solana'
IAT_V2_EXPECTED_SOLANA_CLI_SHA256='aacc6871e8ff199608987f0364f2ed9e239a32e1e0548f1ae4477e0e533e1dea'
IAT_V2_EXPECTED_SOLANA_CLI_BYTES='28546968'
IAT_V2_EXPECTED_SOLANA_KEYGEN_PATH='/home/a/.local/share/solana/install/releases/3.1.10/solana-release/bin/solana-keygen'
IAT_V2_EXPECTED_SOLANA_KEYGEN_SHA256='bf66aa11a13dd15503f40ab2b1160f06c7505bca692dfb20800682615d4ec952'
IAT_V2_EXPECTED_SOLANA_KEYGEN_BYTES='2828816'
IAT_V2_EXPECTED_NODE_PATH='/home/a/.local/share/internal-agency/toolchains/node-v24.19.0-linux-x64/bin/node'
IAT_V2_EXPECTED_NODE_VERSION='v24.19.0'
IAT_V2_EXPECTED_NODE_SHA256='bc17c508ffeed0ec622934f9b7fa72f8e78da65350e63c3eceb56fa688aa5e12'
IAT_V2_EXPECTED_NODE_BYTES='125989464'
IAT_V2_EXPECTED_GIT_PATH='/mnt/c/Program Files/Git/mingw64/bin/git.exe'
IAT_V2_EXPECTED_GIT_VERSION='git version 2.55.0.windows.3'
IAT_V2_EXPECTED_GIT_SHA256='1a0043555d254618f2d56c936c3d9a1fbfb878bc878416a133c346bc7835eda9'
IAT_V2_EXPECTED_GIT_BYTES='4383048'
IAT_V2_EXPECTED_DEVNET_GENESIS_HASH='EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG'

iat_v2_verify_exact_tool() {
  local requested="$1"
  local expected_path="$2"
  local expected_version="$3"
  local expected_sha256="$4"
  local expected_bytes="$5"
  local label="$6"
  local command_path=""
  local resolved_path=""
  local observed_version=""
  local observed_sha256=""
  local observed_bytes=""
  local observed_uid=""
  local observed_mode=""

  command_path="$(command -v -- "$requested" 2>/dev/null || true)"
  if [[ -z "$command_path" ]]; then
    echo "HOLD: $label is unavailable at the operator-reviewed command path." >&2
    return 1
  fi
  resolved_path="$(/usr/bin/readlink -f -- "$command_path" 2>/dev/null || true)"
  if [[ -z "$resolved_path" || "$resolved_path" != /* || ! -f "$resolved_path" || ! -x "$resolved_path" || -L "$resolved_path" ]]; then
    echo "HOLD: $label did not resolve to an absolute executable regular file." >&2
    return 1
  fi
  if [[ "$resolved_path" != "$expected_path" ]]; then
    echo "HOLD: $label resolved path drifted." >&2
    echo "EXPECTED: $expected_path" >&2
    echo "OBSERVED: $resolved_path" >&2
    return 1
  fi
  observed_uid="$(/usr/bin/stat -c '%u' -- "$resolved_path" 2>/dev/null || true)"
  observed_mode="$(/usr/bin/stat -c '%a' -- "$resolved_path" 2>/dev/null || true)"
  if [[ "$observed_uid" != "$(/usr/bin/id -u)" || ! "$observed_mode" =~ ^[0-7]{3,4}$ ]] \
    || (( (8#$observed_mode & 8#022) != 0 )); then
    echo "HOLD: $label ownership or write permissions are not operator-exclusive." >&2
    return 1
  fi
  observed_bytes="$(/usr/bin/stat -c '%s' -- "$resolved_path" 2>/dev/null || true)"
  if [[ "$observed_bytes" != "$expected_bytes" ]]; then
    echo "HOLD: $label byte length drifted; expected $expected_bytes, observed $observed_bytes." >&2
    return 1
  fi
  observed_sha256="$(/usr/bin/sha256sum -- "$resolved_path" 2>/dev/null || true)"
  observed_sha256="${observed_sha256%% *}"
  if [[ "$observed_sha256" != "$expected_sha256" ]]; then
    echo "HOLD: $label SHA-256 drifted." >&2
    echo "EXPECTED: $expected_sha256" >&2
    echo "OBSERVED: $observed_sha256" >&2
    return 1
  fi
  if [[ "$resolved_path" == "$IAT_V2_EXPECTED_SOLANA_CLI_PATH" ]]; then
    observed_version="$(/usr/bin/env -i \
      HOME=/nonexistent/iat-v2-keyless-solana-home \
      XDG_CONFIG_HOME=/nonexistent/iat-v2-keyless-solana-config \
      LANG=C.UTF-8 \
      LC_ALL=C.UTF-8 \
      PATH=/usr/bin:/bin \
      "$resolved_path" --version --config /dev/null 2>&1)"
  else
    observed_version="$(/usr/bin/env -i \
      HOME=/nonexistent/iat-v2-keyless-tool-home \
      XDG_CONFIG_HOME=/nonexistent/iat-v2-keyless-tool-config \
      LANG=C.UTF-8 \
      LC_ALL=C.UTF-8 \
      PATH=/usr/bin:/bin \
      "$resolved_path" --version 2>&1)"
  fi
  if [[ "$observed_version" != "$expected_version" ]]; then
    echo "HOLD: $label version drifted." >&2
    echo "EXPECTED: $expected_version" >&2
    echo "OBSERVED: $observed_version" >&2
    return 1
  fi

  IAT_V2_VERIFIED_TOOL_PATH="$resolved_path"
  IAT_V2_VERIFIED_TOOL_VERSION="$observed_version"
  IAT_V2_VERIFIED_TOOL_SHA256="$observed_sha256"
  IAT_V2_VERIFIED_TOOL_BYTES="$observed_bytes"
}

iat_v2_verify_exact_git() {
  iat_v2_verify_exact_tool \
    "$IAT_V2_EXPECTED_GIT_PATH" \
    "$IAT_V2_EXPECTED_GIT_PATH" \
    "$IAT_V2_EXPECTED_GIT_VERSION" \
    "$IAT_V2_EXPECTED_GIT_SHA256" \
    "$IAT_V2_EXPECTED_GIT_BYTES" \
    "Git runtime"
}

iat_v2_run_keyless_solana() {
  local solana_path="$1"
  shift
  /usr/bin/env -i \
    HOME=/nonexistent/iat-v2-keyless-solana-home \
    XDG_CONFIG_HOME=/nonexistent/iat-v2-keyless-solana-config \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    PATH=/usr/bin:/bin \
    "$solana_path" "$@" --config /dev/null
}

iat_v2_run_keyless_solana_timeout() {
  local duration="$1"
  local solana_path="$2"
  shift 2
  /usr/bin/timeout "$duration" \
    /usr/bin/env -i \
    HOME=/nonexistent/iat-v2-keyless-solana-home \
    XDG_CONFIG_HOME=/nonexistent/iat-v2-keyless-solana-config \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    PATH=/usr/bin:/bin \
    "$solana_path" "$@" --config /dev/null
}

iat_v2_verify_devnet_genesis() {
  local solana_path="$1"
  local observed=""
  observed="$(/usr/bin/timeout 45 \
    /usr/bin/env -i \
    HOME=/nonexistent/iat-v2-keyless-solana-home \
    XDG_CONFIG_HOME=/nonexistent/iat-v2-keyless-solana-config \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    PATH=/usr/bin:/bin \
    "$solana_path" genesis-hash --url devnet --config /dev/null 2>&1)"
  if [[ "$observed" != "$IAT_V2_EXPECTED_DEVNET_GENESIS_HASH" ]]; then
    echo "HOLD: Solana CLI did not observe the exact reviewed Devnet genesis hash." >&2
    echo "EXPECTED: $IAT_V2_EXPECTED_DEVNET_GENESIS_HASH" >&2
    echo "OBSERVED: $observed" >&2
    return 1
  fi
  IAT_V2_VERIFIED_DEVNET_GENESIS_HASH="$observed"
}
