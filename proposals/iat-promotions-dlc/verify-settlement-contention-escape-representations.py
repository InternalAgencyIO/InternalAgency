#!/usr/bin/env python3
"""
Independent strict-JSON escape representation replay.
DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE

Reads local proposal files only. It has no network, wallet, key, signing,
transaction, review-completion, deployment, or activation capability.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import sys
from pathlib import Path
from typing import Any


ARTIFACT_NAME = "settlement-contention-composition-escape-representation-audit.v1.json"
BASE_NAME = "settlement-contention-composition-vectors.v1.json"
SCHEMA_NAME = "settlement-contention-composition-vectors.schema.v1.json"
BASELINE_NAME = "settlement-contention-composition-schema-vectors.v1.json"
TRANSPORT_MARKER = "DRAFT/INACTIVE"
HOLD_LABELS = ["DRAFT", "INACTIVE", "NOT PART OF GENESIS", "NOT DEPLOYED", "NO CLAIM ROUTE"]
VALID_REPRESENTATION_IDS = [
    "BASE_ENVELOPE_LF", "REVERSED_ENVELOPE_LF", "BASE_ENVELOPE_CRLF",
    "UNICODE_KEY_ESCAPE_LF", "ESCAPED_SOLIDUS_LF", "UNICODE_AND_SOLIDUS_LF",
]
MUTATIONS = [
    ("ROOT_CANDIDATE_FIELD", {"operation": "add", "path": "/candidate", "value": {}}),
    ("CASE_EXPANDED_STATE", {"operation": "add", "path": "/cases/0/expandedState", "value": {}}),
    ("REMOVAL_TRACE_FIELD", {"operation": "add", "path": "/cases/0/removalChecks/0/trace", "value": []}),
    ("STATUS_NETWORK_MAINNET", {"operation": "replace", "path": "/status/network", "value": "MAINNET"}),
    ("CONTRACT_RPC_ENABLED", {"operation": "replace", "path": "/contract/usesRpc", "value": True}),
    ("CONTRACT_WALLET_ENABLED", {"operation": "replace", "path": "/contract/usesWallet", "value": True}),
    ("CONTRACT_PREPARATION_ENABLED", {"operation": "replace", "path": "/contract/preparesTransactions", "value": True}),
    ("CONTRACT_ACTIVATION_AUTHORIZED", {"operation": "replace", "path": "/contract/activationAuthorized", "value": True}),
    ("SUMMARY_REVIEW_COMPLETED", {"operation": "replace", "path": "/summary/reviewCompleted", "value": True}),
    ("REMOVAL_OBSERVED_TWO_GATES", {"operation": "replace", "path": "/cases/0/removalChecks/0/observedGates", "value": ["STATUS", "CAPABILITY"]}),
    ("REMOVAL_HASH_UPPERCASE", {"operation": "replace", "path": "/cases/0/removalChecks/0/candidateCommitmentSha256", "value": "A" * 64}),
    ("REMOVAL_UNKNOWN_GATE", {"operation": "replace", "path": "/cases/0/removalChecks/0/remainingGate", "value": "UNKNOWN"}),
]


def reject_duplicate_pairs(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"duplicate JSON key: {key}")
        result[key] = value
    return result


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=reject_duplicate_pairs)


def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def canonical_sha256(value: Any) -> str:
    return hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()


def normalized_text_sha256(path: Path) -> str:
    text = path.read_text(encoding="utf-8").replace("\r\n", "\n").replace("\r", "\n")
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def reverse_keys(value: Any) -> Any:
    if isinstance(value, list):
        return [reverse_keys(item) for item in value]
    if isinstance(value, dict):
        return {key: reverse_keys(item) for key, item in reversed(list(value.items()))}
    return value


def replace_required(value: str, search: str, replacement: str, representation_id: str) -> str:
    if search not in value:
        raise ValueError(f"REPRESENTATION_BUILD_FAILED:{representation_id}")
    return value.replace(search, replacement, 1)


def render_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2, separators=(",", ": ")) + "\n"


def valid_representations(base: dict[str, Any]) -> list[tuple[str, str]]:
    envelope = {"transportMarker": TRANSPORT_MARKER, "candidate": base}
    base_lf = render_json(envelope)
    reversed_lf = render_json(reverse_keys(envelope))
    unicode_key = replace_required(base_lf, '"candidate"', '"c\\u0061ndidate"', "UNICODE_KEY_ESCAPE_LF")
    unicode_key = replace_required(unicode_key, '"vectorVersion"', '"vector\\u0056ersion"', "UNICODE_KEY_ESCAPE_LF")
    escaped_solidus = replace_required(base_lf, '"DRAFT/INACTIVE"', '"DRAFT\\/INACTIVE"', "ESCAPED_SOLIDUS_LF")
    combined = replace_required(base_lf, '"candidate"', '"c\\u0061ndidate"', "UNICODE_AND_SOLIDUS_LF")
    combined = replace_required(combined, '"DRAFT/INACTIVE"', '"\\u0044RAFT\\u002fINACTIVE"', "UNICODE_AND_SOLIDUS_LF")
    return [
        ("BASE_ENVELOPE_LF", base_lf),
        ("REVERSED_ENVELOPE_LF", reversed_lf),
        ("BASE_ENVELOPE_CRLF", base_lf.replace("\n", "\r\n")),
        ("UNICODE_KEY_ESCAPE_LF", unicode_key),
        ("ESCAPED_SOLIDUS_LF", escaped_solidus),
        ("UNICODE_AND_SOLIDUS_LF", combined),
    ]


def malformed_representations(base: dict[str, Any]) -> list[tuple[str, str, str]]:
    base_lf = render_json({"transportMarker": TRANSPORT_MARKER, "candidate": base})

    def marker(replacement: str, identifier: str) -> str:
        return replace_required(base_lf, '"DRAFT/INACTIVE"', replacement, identifier)

    return [
        ("TRUNCATED_UNICODE_ESCAPE", marker('"DRAFT\\u002"', "TRUNCATED_UNICODE_ESCAPE"), "MALFORMED_JSON_ESCAPE"),
        ("NON_HEX_UNICODE_ESCAPE", marker('"DRAFT\\u00G0INACTIVE"', "NON_HEX_UNICODE_ESCAPE"), "MALFORMED_JSON_ESCAPE"),
        ("INVALID_JSON_ESCAPE", marker('"DRAFT\\x2fINACTIVE"', "INVALID_JSON_ESCAPE"), "MALFORMED_JSON_ESCAPE"),
        ("LONE_HIGH_SURROGATE", marker('"DRAFT\\ud800INACTIVE"', "LONE_HIGH_SURROGATE"), "UNPAIRED_UNICODE_SURROGATE"),
        ("LONE_LOW_SURROGATE", marker('"DRAFT\\udc00INACTIVE"', "LONE_LOW_SURROGATE"), "UNPAIRED_UNICODE_SURROGATE"),
        ("BROKEN_SURROGATE_PAIR", marker('"DRAFT\\ud800\\u0041INACTIVE"', "BROKEN_SURROGATE_PAIR"), "UNPAIRED_UNICODE_SURROGATE"),
    ]


def assert_unicode_scalars(value: Any) -> None:
    if isinstance(value, str):
        index = 0
        while index < len(value):
            code = ord(value[index])
            if 0xD800 <= code <= 0xDBFF:
                if index + 1 >= len(value) or not 0xDC00 <= ord(value[index + 1]) <= 0xDFFF:
                    raise ValueError("UNPAIRED_UNICODE_SURROGATE")
                index += 2
                continue
            if 0xDC00 <= code <= 0xDFFF:
                raise ValueError("UNPAIRED_UNICODE_SURROGATE")
            index += 1
        return
    if isinstance(value, list):
        for item in value:
            assert_unicode_scalars(item)
        return
    if isinstance(value, dict):
        for key, item in value.items():
            assert_unicode_scalars(key)
            assert_unicode_scalars(item)


def parse_representation(serialized: str) -> dict[str, Any]:
    try:
        envelope = json.loads(serialized, object_pairs_hook=reject_duplicate_pairs)
    except (json.JSONDecodeError, ValueError):
        raise ValueError("MALFORMED_JSON_ESCAPE") from None
    assert_unicode_scalars(envelope)
    if not isinstance(envelope, dict) or set(envelope) != {"candidate", "transportMarker"}:
        raise ValueError("INVALID_TRANSPORT_ENVELOPE")
    if envelope["transportMarker"] != TRANSPORT_MARKER:
        raise ValueError("TRANSPORT_MARKER_DRIFT")
    candidate = envelope["candidate"]
    if not isinstance(candidate, dict):
        raise ValueError("INVALID_TRANSPORT_ENVELOPE")
    return candidate


def pointer_tokens(pointer: str) -> list[str]:
    if not pointer.startswith("/"):
        raise ValueError("invalid mutation pointer")
    return [token.replace("~1", "/").replace("~0", "~") for token in pointer[1:].split("/")]


def apply_mutation(base: dict[str, Any], mutation: dict[str, Any]) -> dict[str, Any]:
    candidate = copy.deepcopy(base)
    tokens = pointer_tokens(mutation["path"])
    parent: Any = candidate
    for token in tokens[:-1]:
        parent = parent[int(token)] if isinstance(parent, list) else parent[token]
    final = tokens[-1]
    if mutation["operation"] not in {"add", "replace"}:
        raise ValueError("unknown mutation operation")
    if isinstance(parent, list):
        parent[int(final)] = copy.deepcopy(mutation["value"])
    else:
        if mutation["operation"] == "replace" and final not in parent:
            raise ValueError("replace target absent")
        parent[final] = copy.deepcopy(mutation["value"])
    return candidate


def expect(condition: bool, message: str, errors: list[str]) -> None:
    if not condition:
        errors.append(message)


def verify(root: Path, artifact_path: Path) -> tuple[list[str], dict[str, Any]]:
    errors: list[str] = []
    try:
        artifact = load_json(artifact_path)
        base = load_json(root / BASE_NAME)
        schema = load_json(root / SCHEMA_NAME)
        baseline = load_json(root / BASELINE_NAME)
    except (OSError, UnicodeError, json.JSONDecodeError, ValueError) as error:
        return [f"cannot read escape representation evidence: {error}"], {}
    expect(artifact.get("vectorVersion") == 1, "escape representation version drift", errors)
    expect(artifact.get("vectorId") == "iat-promotions-dlc-contention-composition-escape-representations-v1", "escape representation ID drift", errors)
    expect(artifact.get("status") == {"labels": HOLD_LABELS, "network": "NONE", "programId": None, "deployable": False, "vectorsApplied": False}, "escape representation HOLD drift", errors)
    expected_sources = {
        "baseArtifact": (BASE_NAME, "canonicalSha256", canonical_sha256(base)),
        "closedSchema": (SCHEMA_NAME, "canonicalSha256", canonical_sha256(schema)),
        "baselineDiagnostics": (BASELINE_NAME, "canonicalSha256", canonical_sha256(baseline)),
        "mutationCatalog": ("settlement-contention-composition-schema-mutations.mjs", "normalizedTextSha256", normalized_text_sha256(root / "settlement-contention-composition-schema-mutations.mjs")),
        "nodeEvaluator": ("settlement-contention-composition-escape-representations.mjs", "normalizedTextSha256", normalized_text_sha256(root / "settlement-contention-composition-escape-representations.mjs")),
        "pythonVerifier": ("verify-settlement-contention-escape-representations.py", "normalizedTextSha256", normalized_text_sha256(Path(__file__).resolve())),
        "generator": ("generate-settlement-contention-composition-escape-representation-audit.mjs", "normalizedTextSha256", normalized_text_sha256(root / "generate-settlement-contention-composition-escape-representation-audit.mjs")),
    }
    sources = artifact.get("sources", {})
    expect(set(sources) == set(expected_sources), "escape representation source set drift", errors)
    for name, (path, digest_key, digest) in expected_sources.items():
        expect(sources.get(name) == {"path": path, digest_key: digest}, f"escape representation source drift: {name}", errors)
    contract = artifact.get("contract", {})
    expect(contract.get("mode") == "STRICT_JSON_ESCAPE_REPRESENTATION_AUDIT", "escape representation mode drift", errors)
    expect(contract.get("mutationCount") == 12 and contract.get("validRepresentationCountPerMutation") == 6 and contract.get("validTrialCount") == 72 and contract.get("malformedRepresentationCount") == 6, "escape representation counts drift", errors)
    expect(contract.get("validRepresentationIds") == VALID_REPRESENTATION_IDS, "escape representation IDs drift", errors)
    for field in ["unicodeEscapesRequired", "escapedSolidusRequired", "malformedEscapesRejectBeforeMutation", "unpairedSurrogatesRejectBeforeMutation", "canonicalCandidateStable", "diagnosticsBoundToCrossRuntimeBaseline"]:
        expect(contract.get(field) is True, f"escape representation contract {field} drift", errors)
    for field in ["serializedRepresentationsStored", "runtimeCandidatesStored", "usesLocalValidator", "usesRpc", "usesWallet", "preparesTransactions", "signsTransactions", "broadcastsTransactions", "issuesReviewReceipts", "completesReview", "activationAuthorized"]:
        expect(contract.get(field) is False, f"escape representation contract {field} drift", errors)
    expect(contract.get("activationEffect") == "NONE", "escape representation activation effect drift", errors)

    baseline_by_id = {item["caseId"]: item for item in baseline.get("cases", [])}
    cases = artifact.get("cases") if isinstance(artifact.get("cases"), list) else []
    expect(len(cases) == 12, "escape representation cases must contain twelve entries", errors)
    replay_records: list[dict[str, Any]] = []
    case_commitments: list[str] = []
    representations = valid_representations(base)
    for index, (case_id, mutation) in enumerate(MUTATIONS):
        if index >= len(cases):
            break
        published = cases[index]
        baseline_case = baseline_by_id.get(case_id, {})
        trials = []
        for representation_id, serialized in representations:
            represented_base = parse_representation(serialized)
            candidate = apply_mutation(represented_base, mutation)
            trials.append({
                "representationId": representation_id,
                "representationSha256": hashlib.sha256(serialized.encode("utf-8")).hexdigest(),
                "candidateCommitmentSha256": canonical_sha256(candidate),
                "diagnosticCommitmentSha256": baseline_case.get("diagnosticCommitmentSha256"),
                "accepted": False,
            })
        representation_set = canonical_sha256([{"representationId": item["representationId"], "representationSha256": item["representationSha256"]} for item in trials])
        expect(published.get("caseId") == case_id and published.get("mutation") == mutation, f"escape representation case drift: {case_id}", errors)
        expect(published.get("baselineCandidateCommitmentSha256") == baseline_case.get("candidateCommitmentSha256"), f"escape baseline candidate drift: {case_id}", errors)
        expect(published.get("baselineDiagnosticCommitmentSha256") == baseline_case.get("diagnosticCommitmentSha256"), f"escape baseline diagnostic drift: {case_id}", errors)
        expect(published.get("representations") == trials, f"escape representation trial drift: {case_id}", errors)
        expect(len({item["representationSha256"] for item in trials}) == 6, f"escape representation digest collision: {case_id}", errors)
        expect(all(item["candidateCommitmentSha256"] == baseline_case.get("candidateCommitmentSha256") for item in trials), f"escape canonical candidate drift: {case_id}", errors)
        expect(published.get("representationSetCommitmentSha256") == representation_set, f"escape representation-set drift: {case_id}", errors)
        core = {key: value for key, value in published.items() if key != "caseCommitmentSha256"}
        case_commitment = canonical_sha256(core)
        expect(published.get("caseCommitmentSha256") == case_commitment, f"escape case commitment drift: {case_id}", errors)
        case_commitments.append(case_commitment)
        replay_records.append({
            "caseId": case_id,
            "baselineCandidateCommitmentSha256": baseline_case.get("candidateCommitmentSha256"),
            "baselineDiagnosticCommitmentSha256": baseline_case.get("diagnosticCommitmentSha256"),
            "representationSetCommitmentSha256": representation_set,
            "stable": True,
            "accepted": False,
        })

    malformed = []
    for representation_id, serialized, expected_error in malformed_representations(base):
        observed_error = None
        try:
            parse_representation(serialized)
        except ValueError as error:
            observed_error = str(error)
        expect(observed_error == expected_error, f"malformed escape result drift: {representation_id}", errors)
        malformed.append({
            "representationId": representation_id,
            "representationSha256": hashlib.sha256(serialized.encode("utf-8")).hexdigest(),
            "expectedError": expected_error,
            "observedError": observed_error,
            "rejectedBeforeMutation": True,
            "candidateProduced": False,
        })
    expect(artifact.get("malformedRepresentations") == malformed, "malformed escape corpus drift", errors)
    summary = artifact.get("summary", {})
    replay_commitment = canonical_sha256(replay_records)
    malformed_commitment = canonical_sha256(malformed)
    expect(summary.get("mutationCount") == "12" and summary.get("validTrialCount") == "72" and summary.get("malformedRepresentationCount") == "6", "escape representation summary counts drift", errors)
    expect(summary.get("replayCommitmentSha256") == replay_commitment, "escape representation replay drift", errors)
    expect(summary.get("malformedSetCommitmentSha256") == malformed_commitment, "malformed escape commitment drift", errors)
    expect(summary.get("caseSetCommitmentSha256") == canonical_sha256(case_commitments), "escape representation case-set drift", errors)
    for field in ["allCanonicalCandidatesStable", "allBaselineDiagnosticsStable", "allValidRepresentationsDistinctWithinCase", "allMalformedRepresentationsRejectedBeforeMutation", "allRejected"]:
        expect(summary.get(field) is True, f"escape representation summary {field} drift", errors)
    for field in ["serializedRepresentationsStored", "runtimeCandidatesStored", "receiptIssued", "reviewCompleted", "activationAuthorized"]:
        expect(summary.get(field) is False, f"escape representation summary {field} drift", errors)
    expect(summary.get("activationEffect") == "NONE", "escape representation summary activation effect drift", errors)
    return errors, {
        "valid": not errors,
        "errors": errors,
        "mutationCount": len(replay_records),
        "validTrialCount": 6 * len(replay_records),
        "malformedRepresentationCount": len(malformed),
        "allCanonicalCandidatesStable": len(replay_records) == 12,
        "allMalformedRepresentationsRejectedBeforeMutation": len(malformed) == 6,
        "replayCommitmentSha256": replay_commitment,
        "malformedSetCommitmentSha256": malformed_commitment,
        "serializedRepresentationsStored": False,
        "runtimeCandidatesStored": False,
        "network": "NONE",
        "receiptIssued": False,
        "reviewCompleted": False,
        "activationAuthorized": False,
        "activationEffect": "NONE",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify held JSON escape representation evidence offline.")
    default_root = Path(__file__).resolve().parent
    parser.add_argument("--root", type=Path, default=default_root)
    parser.add_argument("--artifact", type=Path)
    parser.add_argument("--json", action="store_true", dest="emit_json")
    arguments = parser.parse_args()
    root = arguments.root.resolve()
    artifact = arguments.artifact.resolve() if arguments.artifact else root / ARTIFACT_NAME
    errors, report = verify(root, artifact)
    if arguments.emit_json:
        print(json.dumps(report, separators=(",", ":")))
    elif errors:
        print("\n".join(errors), file=sys.stderr)
    else:
        print(f"Independent escape representation replay passed: {report['replayCommitmentSha256']}")
    return 2 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
