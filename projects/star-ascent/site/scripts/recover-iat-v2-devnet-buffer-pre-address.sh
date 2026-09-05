#!/usr/bin/bash
set -euo pipefail
set +x

hold() { echo "HOLD: $*" >&2; exit 1; }

(( $# == 0 )) || hold "this recovery launcher accepts no arguments"
[[ "${IAT_V2_CLEAN_ENVIRONMENT:-}" == "iat-v2-devnet-buffer-v1" ]] \
  || hold "use the exact clean Ubuntu-24.04 WSL2 launcher from the attended runbook"

SCRIPT_DIR="$(cd -- "$(/usr/bin/dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
exec /usr/bin/bash --noprofile --norc \
  "$SCRIPT_DIR/rebuild-iat-v2-devnet-buffer-fresh.sh" recover-pre-address
