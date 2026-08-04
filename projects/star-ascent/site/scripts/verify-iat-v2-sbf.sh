#!/usr/bin/env bash
set -euo pipefail

expected_anchor="anchor-cli 1.0.2"
expected_solana="solana-cli 3.1.10"
expected_rustc_prefix="rustc 1.97.1 "
build_container_image="solanafoundation/anchor"
build_container_tag="v1.0.2"
build_container_index_digest="sha256:05a13b9f0a6d7dd5dc86955dd0e14a098110f12d2862ac5e0cf588049a48841b"
build_container_platform="linux/amd64"
build_container_platform_digest="sha256:28fde4e63a063727c9520a925de4e9a3be29fcc717b5d759363c23ddea28f59d"
build_container_reference="${build_container_image}@${build_container_index_digest}"

for command_name in cargo rustc anchor solana docker git node sha256sum python3; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "FAIL: required command is missing: $command_name" >&2
    exit 1
  fi
done

actual_anchor="$(anchor --version)"
actual_solana="$(solana --version)"
actual_rustc="$(rustc --version)"
if [[ "$actual_anchor" != "$expected_anchor" ]]; then
  echo "FAIL: expected $expected_anchor; found $actual_anchor" >&2
  exit 1
fi
if [[ "$actual_solana" != "$expected_solana" \
  && "$actual_solana" != "$expected_solana "* ]]; then
  echo "FAIL: expected $expected_solana; found $actual_solana" >&2
  exit 1
fi
if [[ "$actual_rustc" != "$expected_rustc_prefix"* ]]; then
  echo "FAIL: expected ${expected_rustc_prefix% }; found $actual_rustc" >&2
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
if [[ -n "$(git status --porcelain=v1 --untracked-files=no)" ]]; then
  echo "FAIL: verifiable proof must start from a clean tracked source tree" >&2
  exit 1
fi

source_head_commit="${IAT_V2_SOURCE_HEAD_SHA:-}"
workflow_event="${IAT_V2_WORKFLOW_EVENT:-}"
ci_server_url="${GITHUB_SERVER_URL:-}"
ci_repository="${GITHUB_REPOSITORY:-}"
ci_repository_id="${GITHUB_REPOSITORY_ID:-}"
ci_workflow_ref="${GITHUB_WORKFLOW_REF:-}"
ci_run_id="${GITHUB_RUN_ID:-}"
ci_run_attempt="${GITHUB_RUN_ATTEMPT:-}"
ci_runner_os="${RUNNER_OS:-}"
ci_runner_arch="${RUNNER_ARCH:-}"
if [[ ! "$source_head_commit" =~ ^[0-9a-f]{40}$ ]]; then
  echo "FAIL: workflow did not provide an exact lowercase source-head commit" >&2
  exit 1
fi
if [[ "$workflow_event" != "push" \
  && "$workflow_event" != "pull_request" \
  && "$workflow_event" != "workflow_dispatch" ]]; then
  echo "FAIL: unsupported or missing workflow event: $workflow_event" >&2
  exit 1
fi
if [[ "$ci_server_url" != "https://github.com" \
  || "$ci_repository" != "InternalAgencyIO/InternalAgency" \
  || "$ci_repository_id" != "1313660798" ]]; then
  echo "FAIL: build provenance is not the reviewed public GitHub repository" >&2
  exit 1
fi
if [[ ! "$ci_workflow_ref" =~ ^InternalAgencyIO/InternalAgency/\.github/workflows/iat-v2-proof\.yml@refs/(heads/.+|pull/[0-9]+/merge)$ ]]; then
  echo "FAIL: build provenance is not the reviewed release-proof workflow" >&2
  exit 1
fi
if [[ ! "$ci_run_id" =~ ^[1-9][0-9]*$ || ! "$ci_run_attempt" =~ ^[1-9][0-9]*$ ]]; then
  echo "FAIL: build provenance is missing a canonical GitHub run ID or attempt" >&2
  exit 1
fi
if [[ "$ci_runner_os" != "Linux" || "$ci_runner_arch" != "X64" ]]; then
  echo "FAIL: verifiable build requires the reviewed Linux/X64 runner platform" >&2
  exit 1
fi
if ! git cat-file -e "${source_head_commit}^{commit}"; then
  echo "FAIL: source-head commit is absent from the full checkout" >&2
  exit 1
fi

checkout_commit="$(git rev-parse HEAD)"
if [[ "$workflow_event" == "pull_request" ]]; then
  if [[ "$(git rev-list --parents -n 1 HEAD | awk '{print NF - 1}')" != "2" \
    || "$(git rev-parse 'HEAD^2')" != "$source_head_commit" ]]; then
    echo "FAIL: pull-request checkout is not the exact synthetic merge of the declared source head" >&2
    exit 1
  fi
  checkout_relation="PR_MERGE_SECOND_PARENT"
elif [[ "$checkout_commit" != "$source_head_commit" ]]; then
  echo "FAIL: branch checkout does not equal the declared source head" >&2
  exit 1
else
  checkout_relation="IDENTICAL"
fi

cargo fmt --all -- --check
cargo test --workspace --all-targets --locked
sbf_log="target/iat-v2-sbf-build.log"
{
  echo "Verify immutable container index and platform manifest"
  actual_platform_digest="$(
    docker manifest inspect "$build_container_reference" \
      | python3 -c 'import json, sys
document = json.load(sys.stdin)
matches = [entry["digest"] for entry in document.get("manifests", []) if entry.get("platform", {}).get("os") == "linux" and entry.get("platform", {}).get("architecture") == "amd64"]
if len(matches) != 1:
    raise SystemExit("expected exactly one linux/amd64 container manifest")
print(matches[0])'
  )"
  if [[ "$actual_platform_digest" != "$build_container_platform_digest" ]]; then
    echo "FAIL: immutable container platform manifest drifted" >&2
    exit 1
  fi
  docker pull --platform "$build_container_platform" "$build_container_reference"
  actual_local_platform="$(docker image inspect --format '{{.Os}}/{{.Architecture}}' "$build_container_reference")"
  if [[ "$actual_local_platform" != "$build_container_platform" ]]; then
    echo "FAIL: pulled container platform does not match the reviewed Linux/X64 runner" >&2
    exit 1
  fi
  echo "PASS: immutable container index, linux/amd64 descriptor, and local image platform match"
} 2>&1 | tee "$sbf_log"

anchor build --verifiable --ignore-keys --docker-image "$build_container_reference" 2>&1 | tee -a "$sbf_log"

if ! grep -Fxq "Using image \"$build_container_reference\"" "$sbf_log"; then
  echo "FAIL: Anchor did not use the reviewed immutable build-container digest" >&2
  exit 1
fi

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

if [[ -n "$(git status --porcelain=v1 --untracked-files=no)" ]]; then
  echo "FAIL: verifiable build modified tracked source files" >&2
  exit 1
fi

source_head_tree="$(git rev-parse "${source_head_commit}^{tree}")"
checkout_tree="$(git rev-parse 'HEAD^{tree}')"
binary_sha256="$(sha256sum "$binary" | awk '{print $1}')"
idl_sha256="$(sha256sum "$idl" | awk '{print $1}')"
log_sha256="$(sha256sum "$sbf_log" | awk '{print $1}')"
binary_bytes="$(stat --printf='%s' "$binary")"
idl_bytes="$(stat --printf='%s' "$idl")"
log_bytes="$(stat --printf='%s' "$sbf_log")"
evidence="target/verifiable/iat-v2-build-evidence.json"
python3 - \
  "$evidence" \
  "$workflow_event" \
  "$ci_server_url" \
  "$ci_repository" \
  "$ci_repository_id" \
  "$ci_workflow_ref" \
  "$ci_run_id" \
  "$ci_run_attempt" \
  "$ci_runner_os" \
  "$ci_runner_arch" \
  "$build_container_image" \
  "$build_container_tag" \
  "$build_container_index_digest" \
  "$build_container_platform" \
  "$build_container_platform_digest" \
  "$build_container_reference" \
  "$source_head_commit" \
  "$source_head_tree" \
  "$checkout_commit" \
  "$checkout_tree" \
  "$checkout_relation" \
  "$actual_rustc" \
  "$actual_anchor" \
  "$actual_solana" \
  "$expected_program_id" \
  "$binary_sha256" \
  "$binary_bytes" \
  "$idl_sha256" \
  "$idl_bytes" \
  "$log_sha256" \
  "$log_bytes" <<'PY'
import json
import pathlib
import sys

(
    evidence_path,
    workflow_event,
    ci_server_url,
    ci_repository,
    ci_repository_id,
    ci_workflow_ref,
    ci_run_id,
    ci_run_attempt,
    ci_runner_os,
    ci_runner_arch,
    build_container_image,
    build_container_tag,
    build_container_index_digest,
    build_container_platform,
    build_container_platform_digest,
    build_container_reference,
    source_head_commit,
    source_head_tree,
    checkout_commit,
    checkout_tree,
    checkout_relation,
    rustc_version,
    anchor_version,
    solana_version,
    program_id,
    binary_sha256,
    binary_bytes,
    idl_sha256,
    idl_bytes,
    log_sha256,
    log_bytes,
) = sys.argv[1:]
document = {
    "schema": "iat-v2-ci-verifiable-sbf-evidence/v5",
    "status": "BUILD_ONLY_HOLD",
    "ciProvenance": {
        "serverUrl": ci_server_url,
        "repository": ci_repository,
        "repositoryId": int(ci_repository_id),
        "workflowRef": ci_workflow_ref,
        "runId": int(ci_run_id),
        "runAttempt": int(ci_run_attempt),
        "runnerOs": ci_runner_os,
        "runnerArch": ci_runner_arch,
    },
    "buildContainer": {
        "image": build_container_image,
        "tag": build_container_tag,
        "indexDigest": build_container_index_digest,
        "platform": build_container_platform,
        "platformManifestDigest": build_container_platform_digest,
        "reference": build_container_reference,
        "registryVerification": "DOCKER_MANIFEST_AND_LOCAL_PLATFORM",
    },
    "sourceBinding": {
        "workflowEvent": workflow_event,
        "sourceHeadCommit": source_head_commit,
        "sourceHeadTree": source_head_tree,
        "checkoutCommit": checkout_commit,
        "checkoutTree": checkout_tree,
        "checkoutRelation": checkout_relation,
        "trackedWorktree": "CLEAN",
    },
    "programId": program_id,
    "toolchain": {
        "rustc": rustc_version,
        "anchor": anchor_version,
        "solana": solana_version,
    },
    "artifacts": {
        "programBinary": {
            "path": "target/verifiable/iat_v2.so",
            "sha256": binary_sha256,
            "bytes": int(binary_bytes),
        },
        "programIdl": {
            "path": "target/idl/iat_v2.json",
            "sha256": idl_sha256,
            "bytes": int(idl_bytes),
        },
        "buildLog": {
            "path": "target/iat-v2-sbf-build.log",
            "sha256": log_sha256,
            "bytes": int(log_bytes),
        },
    },
    "limitations": [
        "Build evidence only; not signed Devnet evidence.",
        "Does not authorize deployment, signing, broadcast, funding, or Mainnet launch.",
    ],
}
pathlib.Path(evidence_path).write_text(
    json.dumps(document, indent=2, sort_keys=True) + "\n",
    encoding="utf-8",
)
PY
node scripts/validate-iat-v2-ci-sbf-evidence.mjs "$evidence"

echo "PASS: locked host tests and program-ID-bound verifiable SBF artifacts completed."
sha256sum "$binary" "$idl" "$evidence" "$sbf_log"
printf 'programBinaryBytes=%s\n' "$binary_bytes"
printf 'programIdlBytes=%s\n' "$idl_bytes"
echo "HOLD: this output is build evidence only; it does not authorize deployment or a transaction."
