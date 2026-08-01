#!/usr/bin/env python3
"""
Independent duplicate-aware bounded JSON transport replay.
DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE

Reads local proposal files only. It has no network, wallet, key, signing,
transaction, review-completion, deployment, or activation capability.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
from pathlib import Path
from typing import Any


ARTIFACT_NAME = "settlement-contention-composition-transport-limit-audit.v1.json"
NUMERIC_ARTIFACT_NAME = "settlement-contention-composition-numeric-token-audit.v1.json"
BASE_NAME = "settlement-contention-composition-vectors.v1.json"
TRANSPORT_MARKER = "DRAFT/INACTIVE"
HOLD_LABELS = ["DRAFT", "INACTIVE", "NOT PART OF GENESIS", "NOT DEPLOYED", "NO CLAIM ROUTE"]
LIMITS = {
    "maxUtf8Bytes": 65_536,
    "maxDepth": 16,
    "maxObjectMembers": 32,
    "maxArrayLength": 32,
    "maxTotalNodes": 2_048,
}
NUMERIC_TOKEN_RULES = {
    "representation": "CANONICAL_SAFE_INTEGER",
    "canonicalPattern": "0|-?[1-9][0-9]*",
    "minimumSafeInteger": "-9007199254740991",
    "maximumSafeInteger": "9007199254740991",
    "fractionsAllowed": False,
    "exponentAllowed": False,
    "negativeZeroAllowed": False,
    "nonFiniteAllowed": False,
}


class TransportError(ValueError):
    pass


def reject_duplicate_pairs(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise TransportError("DUPLICATE_JSON_KEY")
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


def render_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2, separators=(",", ": ")) + "\n"


def replace_required(value: str, search: str, replacement: str, case_id: str) -> str:
    if search not in value:
        raise TransportError(f"TRANSPORT_CORPUS_BUILD_FAILED:{case_id}")
    return value.replace(search, replacement, 1)


def nested_array(depth: int) -> Any:
    value: Any = 0
    for _ in range(depth):
        value = [value]
    return value


def node_limit_tree() -> dict[str, Any]:
    return {f"p{object_index}": [[0, 0] for _ in range(32)] for object_index in range(32)}


def build_corpus(base: dict[str, Any]) -> tuple[list[tuple[str, str]], list[tuple[str, str, str, str]]]:
    base_lf = render_json({"transportMarker": TRANSPORT_MARKER, "candidate": base})
    padding = LIMITS["maxUtf8Bytes"] - len(base_lf.encode("utf-8"))
    if padding < 0:
        raise TransportError("BASELINE_EXCEEDS_TRANSPORT_LIMIT")
    controls = [
        ("BASELINE_WITHIN_LIMITS", base_lf),
        ("BYTE_LIMIT_EXACT", base_lf + " " * padding),
    ]
    duplicate_top = replace_required(
        base_lf,
        '"transportMarker": "DRAFT/INACTIVE",',
        '"transportMarker": "DRAFT/INACTIVE",\n  "transportMarker": "DRAFT/INACTIVE",',
        "DUPLICATE_TOP_LEVEL_KEY",
    )
    duplicate_candidate = replace_required(
        base_lf,
        '"vectorVersion": 1,',
        '"vectorVersion": 1,\n    "vectorVersion": 1,',
        "DUPLICATE_CANDIDATE_KEY",
    )
    duplicate_deep = replace_required(
        base_lf,
        '"caseId": "STRUCTURE__STATUS",',
        '"caseId": "STRUCTURE__STATUS",\n        "caseId": "STRUCTURE__STATUS",',
        "DUPLICATE_DEEP_KEY",
    )

    def compact_envelope(candidate: Any) -> str:
        return json.dumps({"transportMarker": TRANSPORT_MARKER, "candidate": candidate}, ensure_ascii=False, separators=(",", ":"))

    rejections = [
        ("DUPLICATE_TOP_LEVEL_KEY", "DUPLICATE_KEY", duplicate_top, "DUPLICATE_JSON_KEY"),
        ("DUPLICATE_CANDIDATE_KEY", "DUPLICATE_KEY", duplicate_candidate, "DUPLICATE_JSON_KEY"),
        ("DUPLICATE_DEEP_KEY", "DUPLICATE_KEY", duplicate_deep, "DUPLICATE_JSON_KEY"),
        ("BYTE_LIMIT_PLUS_ONE", "BYTE_LIMIT", base_lf + " " * (padding + 1), "TRANSPORT_BYTE_LIMIT"),
        ("DEPTH_LIMIT_PLUS_ONE", "DEPTH_LIMIT", compact_envelope(nested_array(15)), "TRANSPORT_DEPTH_LIMIT"),
        ("OBJECT_MEMBER_LIMIT_PLUS_ONE", "OBJECT_MEMBER_LIMIT", compact_envelope({f"p{index}": index for index in range(33)}), "TRANSPORT_OBJECT_MEMBER_LIMIT"),
        ("ARRAY_LENGTH_LIMIT_PLUS_ONE", "ARRAY_LENGTH_LIMIT", compact_envelope(list(range(33))), "TRANSPORT_ARRAY_LENGTH_LIMIT"),
        ("TOTAL_NODE_LIMIT_PLUS_ONE", "NODE_LIMIT", compact_envelope(node_limit_tree()), "TRANSPORT_NODE_LIMIT"),
    ]
    return controls, rejections


def assert_unicode_scalars(value: Any) -> None:
    if isinstance(value, str):
        index = 0
        while index < len(value):
            code = ord(value[index])
            if 0xD800 <= code <= 0xDBFF:
                if index + 1 >= len(value) or not 0xDC00 <= ord(value[index + 1]) <= 0xDFFF:
                    raise TransportError("UNPAIRED_UNICODE_SURROGATE")
                index += 2
                continue
            if 0xDC00 <= code <= 0xDFFF:
                raise TransportError("UNPAIRED_UNICODE_SURROGATE")
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


def parse_bounded_json(serialized: str) -> tuple[Any, dict[str, int]]:
    utf8_bytes = len(serialized.encode("utf-8"))
    if utf8_bytes > LIMITS["maxUtf8Bytes"]:
        raise TransportError("TRANSPORT_BYTE_LIMIT")
    def parse_integer(token: str) -> int:
        value = int(token)
        if value == 0 and token.startswith("-"):
            raise TransportError("NEGATIVE_ZERO_JSON_NUMBER")
        if value < -9_007_199_254_740_991 or value > 9_007_199_254_740_991:
            raise TransportError("UNSAFE_JSON_INTEGER")
        return value

    def parse_float(token: str) -> float:
        value = float(token)
        if not math.isfinite(value):
            raise TransportError("NONFINITE_JSON_NUMBER")
        if value == 0 and token.startswith("-"):
            raise TransportError("NEGATIVE_ZERO_JSON_NUMBER")
        raise TransportError("NONCANONICAL_JSON_NUMBER")

    def reject_constant(_token: str) -> None:
        raise TransportError("MALFORMED_JSON")

    try:
        value = json.loads(
            serialized,
            object_pairs_hook=reject_duplicate_pairs,
            parse_int=parse_integer,
            parse_float=parse_float,
            parse_constant=reject_constant,
        )
    except TransportError:
        raise
    except (json.JSONDecodeError, ValueError):
        raise TransportError("MALFORMED_JSON") from None
    assert_unicode_scalars(value)
    metrics = {
        "utf8Bytes": utf8_bytes,
        "totalNodes": 0,
        "maxDepthObserved": 0,
        "maxObjectMembersObserved": 0,
        "maxArrayLengthObserved": 0,
    }

    def walk(item: Any, depth: int) -> None:
        if depth > LIMITS["maxDepth"]:
            raise TransportError("TRANSPORT_DEPTH_LIMIT")
        metrics["totalNodes"] += 1
        if metrics["totalNodes"] > LIMITS["maxTotalNodes"]:
            raise TransportError("TRANSPORT_NODE_LIMIT")
        metrics["maxDepthObserved"] = max(metrics["maxDepthObserved"], depth)
        if isinstance(item, dict):
            if len(item) > LIMITS["maxObjectMembers"]:
                raise TransportError("TRANSPORT_OBJECT_MEMBER_LIMIT")
            metrics["maxObjectMembersObserved"] = max(metrics["maxObjectMembersObserved"], len(item))
            for child in item.values():
                walk(child, depth + 1)
        elif isinstance(item, list):
            if len(item) > LIMITS["maxArrayLength"]:
                raise TransportError("TRANSPORT_ARRAY_LENGTH_LIMIT")
            metrics["maxArrayLengthObserved"] = max(metrics["maxArrayLengthObserved"], len(item))
            for child in item:
                walk(child, depth + 1)

    walk(value, 1)
    return value, metrics


def parse_transport_envelope(serialized: str) -> tuple[dict[str, Any], dict[str, int]]:
    envelope, metrics = parse_bounded_json(serialized)
    if not isinstance(envelope, dict) or set(envelope) != {"candidate", "transportMarker"}:
        raise TransportError("INVALID_TRANSPORT_ENVELOPE")
    if envelope["transportMarker"] != TRANSPORT_MARKER or not isinstance(envelope["candidate"], dict):
        raise TransportError("INVALID_TRANSPORT_ENVELOPE")
    return envelope["candidate"], metrics


def evaluate_corpus(base: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    control_inputs, rejection_inputs = build_corpus(base)
    base_commitment = canonical_sha256(base)
    controls = []
    for case_id, serialized in control_inputs:
        candidate, metrics = parse_transport_envelope(serialized)
        commitment = canonical_sha256(candidate)
        if commitment != base_commitment:
            raise TransportError(f"TRANSPORT_CONTROL_DRIFT:{case_id}")
        controls.append({
            "caseId": case_id,
            "representationSha256": hashlib.sha256(serialized.encode("utf-8")).hexdigest(),
            "metrics": metrics,
            "candidateCommitmentSha256": commitment,
            "acceptedAtParser": True,
            "candidateStored": False,
            "mutationEvaluated": False,
        })
    rejections = []
    for case_id, family, serialized, expected_error in rejection_inputs:
        observed_error = None
        try:
            parse_transport_envelope(serialized)
        except TransportError as error:
            observed_error = str(error)
        if observed_error != expected_error:
            raise TransportError(f"TRANSPORT_REJECTION_DRIFT:{case_id}:{observed_error}")
        rejections.append({
            "caseId": case_id,
            "family": family,
            "representationSha256": hashlib.sha256(serialized.encode("utf-8")).hexdigest(),
            "utf8Bytes": len(serialized.encode("utf-8")),
            "expectedError": expected_error,
            "observedError": observed_error,
            "rejectedBeforeMutation": True,
            "candidateProduced": False,
        })
    return controls, rejections


def numeric_envelope(token: str) -> str:
    return f'{{"transportMarker":"{TRANSPORT_MARKER}","candidate":{{"numericProbe":{token}}}}}'


def numeric_field_mutation(base_lf: str, token: str, case_id: str) -> str:
    return replace_required(base_lf, '"vectorVersion": 1,', f'"vectorVersion": {token},', case_id)


def build_numeric_corpus(base: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    base_lf = render_json({"transportMarker": TRANSPORT_MARKER, "candidate": base})
    controls = [
        {"caseId": "BASELINE_CANONICAL_FIELDS", "family": "CANONICAL_FIELD_SET", "tokens": ["1", "28", "2"], "serialized": base_lf, "expectedCandidate": base},
        {"caseId": "ZERO_CANONICAL", "family": "SAFE_INTEGER_BOUNDARY", "tokens": ["0"], "serialized": numeric_envelope("0"), "expectedCandidate": {"numericProbe": 0}},
        {"caseId": "MAX_SAFE_INTEGER_CANONICAL", "family": "SAFE_INTEGER_BOUNDARY", "tokens": [NUMERIC_TOKEN_RULES["maximumSafeInteger"]], "serialized": numeric_envelope(NUMERIC_TOKEN_RULES["maximumSafeInteger"]), "expectedCandidate": {"numericProbe": 9_007_199_254_740_991}},
        {"caseId": "MIN_SAFE_INTEGER_CANONICAL", "family": "SAFE_INTEGER_BOUNDARY", "tokens": [NUMERIC_TOKEN_RULES["minimumSafeInteger"]], "serialized": numeric_envelope(NUMERIC_TOKEN_RULES["minimumSafeInteger"]), "expectedCandidate": {"numericProbe": -9_007_199_254_740_991}},
    ]
    definitions = [
        ("VECTOR_VERSION_DECIMAL_EQUIVALENT", "EQUIVALENT_NONCANONICAL", "1.0", "NONCANONICAL_JSON_NUMBER"),
        ("VECTOR_VERSION_EXPONENT_LOWER", "EQUIVALENT_NONCANONICAL", "1e0", "NONCANONICAL_JSON_NUMBER"),
        ("VECTOR_VERSION_EXPONENT_UPPER_PLUS", "EQUIVALENT_NONCANONICAL", "1E+0", "NONCANONICAL_JSON_NUMBER"),
        ("NEGATIVE_ZERO_INTEGER", "NEGATIVE_ZERO", "-0", "NEGATIVE_ZERO_JSON_NUMBER"),
        ("NEGATIVE_ZERO_DECIMAL", "NEGATIVE_ZERO", "-0.0", "NEGATIVE_ZERO_JSON_NUMBER"),
        ("NEGATIVE_ZERO_EXPONENT", "NEGATIVE_ZERO", "-0e0", "NEGATIVE_ZERO_JSON_NUMBER"),
        ("POSITIVE_SAFE_INTEGER_PLUS_ONE", "UNSAFE_INTEGER", "9007199254740992", "UNSAFE_JSON_INTEGER"),
        ("NEGATIVE_SAFE_INTEGER_MINUS_ONE", "UNSAFE_INTEGER", "-9007199254740992", "UNSAFE_JSON_INTEGER"),
        ("PRECISION_COLLISION_INTEGER", "UNSAFE_INTEGER", "9007199254740993", "UNSAFE_JSON_INTEGER"),
        ("POSITIVE_EXPONENT_OVERFLOW", "NONFINITE_EQUIVALENT", "1e309", "NONFINITE_JSON_NUMBER"),
        ("NEGATIVE_EXPONENT_OVERFLOW", "NONFINITE_EQUIVALENT", "-1e309", "NONFINITE_JSON_NUMBER"),
        ("NAN_CONSTANT", "NON_JSON_NUMBER", "NaN", "MALFORMED_JSON"),
        ("POSITIVE_INFINITY_CONSTANT", "NON_JSON_NUMBER", "Infinity", "MALFORMED_JSON"),
        ("NEGATIVE_INFINITY_CONSTANT", "NON_JSON_NUMBER", "-Infinity", "MALFORMED_JSON"),
        ("LEADING_PLUS_INTEGER", "NON_JSON_NUMBER", "+1", "MALFORMED_JSON"),
        ("LEADING_ZERO_INTEGER", "NON_JSON_NUMBER", "01", "MALFORMED_JSON"),
    ]
    rejections = [{
        "caseId": case_id,
        "family": family,
        "token": token,
        "targetPath": "/candidate/vectorVersion",
        "serialized": numeric_field_mutation(base_lf, token, case_id),
        "expectedError": expected_error,
    } for case_id, family, token, expected_error in definitions]
    return controls, rejections


def evaluate_numeric_corpus(base: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    control_inputs, rejection_inputs = build_numeric_corpus(base)
    controls = []
    for item in control_inputs:
        candidate, _metrics = parse_transport_envelope(item["serialized"])
        if canonical_sha256(candidate) != canonical_sha256(item["expectedCandidate"]):
            raise TransportError(f'NUMERIC_CONTROL_DRIFT:{item["caseId"]}')
        controls.append({
            "caseId": item["caseId"],
            "family": item["family"],
            "tokens": item["tokens"],
            "representationSha256": hashlib.sha256(item["serialized"].encode("utf-8")).hexdigest(),
            "utf8Bytes": len(item["serialized"].encode("utf-8")),
            "candidateCommitmentSha256": canonical_sha256(candidate),
            "acceptedAtParser": True,
            "candidateStored": False,
            "mutationEvaluated": False,
        })
    rejections = []
    for item in rejection_inputs:
        observed_error = None
        try:
            parse_transport_envelope(item["serialized"])
        except TransportError as error:
            observed_error = str(error)
        if observed_error != item["expectedError"]:
            raise TransportError(f'NUMERIC_REJECTION_DRIFT:{item["caseId"]}:{observed_error}')
        rejections.append({
            "caseId": item["caseId"],
            "family": item["family"],
            "token": item["token"],
            "targetPath": item["targetPath"],
            "representationSha256": hashlib.sha256(item["serialized"].encode("utf-8")).hexdigest(),
            "utf8Bytes": len(item["serialized"].encode("utf-8")),
            "expectedError": item["expectedError"],
            "observedError": observed_error,
            "rejectedBeforeCandidate": True,
            "candidateProduced": False,
            "mutationEvaluated": False,
        })
    return controls, rejections


def expect(condition: bool, message: str, errors: list[str]) -> None:
    if not condition:
        errors.append(message)


def verify(root: Path, artifact_path: Path) -> tuple[list[str], dict[str, Any]]:
    errors: list[str] = []
    try:
        artifact = load_json(artifact_path)
        base = load_json(root / BASE_NAME)
        controls, rejections = evaluate_corpus(base)
    except (OSError, UnicodeError, json.JSONDecodeError, ValueError) as error:
        return [f"cannot read transport limit evidence: {error}"], {}
    expect(artifact.get("vectorVersion") == 1, "transport limit version drift", errors)
    expect(artifact.get("vectorId") == "iat-promotions-dlc-contention-composition-transport-limits-v1", "transport limit ID drift", errors)
    expect(artifact.get("status") == {"labels": HOLD_LABELS, "network": "NONE", "programId": None, "deployable": False, "vectorsApplied": False}, "transport limit HOLD drift", errors)
    expected_sources = {
        "baseArtifact": {"path": BASE_NAME, "canonicalSha256": canonical_sha256(base)},
        "boundedParser": {"path": "settlement-contention-composition-transport-limits.mjs", "normalizedTextSha256": normalized_text_sha256(root / "settlement-contention-composition-transport-limits.mjs")},
        "pythonVerifier": {"path": "verify-settlement-contention-transport-limits.py", "normalizedTextSha256": normalized_text_sha256(Path(__file__).resolve())},
        "generator": {"path": "generate-settlement-contention-composition-transport-limit-audit.mjs", "normalizedTextSha256": normalized_text_sha256(root / "generate-settlement-contention-composition-transport-limit-audit.mjs")},
    }
    expect(artifact.get("sources") == expected_sources, "transport limit source drift", errors)
    contract = artifact.get("contract", {})
    expect(contract.get("mode") == "DUPLICATE_AWARE_BOUNDED_JSON_TRANSPORT", "transport limit mode drift", errors)
    expect(contract.get("limits") == LIMITS, "transport limits drift", errors)
    expect(contract.get("acceptedControlCount") == 2 and contract.get("rejectionCount") == 8 and contract.get("duplicateKeyCaseCount") == 3 and contract.get("limitCaseCount") == 5, "transport limit counts drift", errors)
    for field in ["duplicateKeysRejectedAtAnyDepth", "exactByteBoundaryAccepted", "overLimitRejectedBeforeMutation"]:
        expect(contract.get(field) is True, f"transport contract {field} drift", errors)
    for field in ["serializedRepresentationsStored", "runtimeCandidatesStored", "usesLocalValidator", "usesRpc", "usesWallet", "preparesTransactions", "signsTransactions", "broadcastsTransactions", "issuesReviewReceipts", "completesReview", "activationAuthorized"]:
        expect(contract.get(field) is False, f"transport contract {field} drift", errors)
    expect(contract.get("activationEffect") == "NONE", "transport activation effect drift", errors)
    expect(artifact.get("controls") == controls, "transport controls drift", errors)
    expect(artifact.get("rejections") == rejections, "transport rejections drift", errors)
    summary = artifact.get("summary", {})
    control_commitment = canonical_sha256(controls)
    rejection_commitment = canonical_sha256(rejections)
    combined_commitment = canonical_sha256({"controls": controls, "rejections": rejections})
    expect(summary.get("acceptedControlCount") == "2" and summary.get("rejectionCount") == "8", "transport summary counts drift", errors)
    for field in ["allControlsAcceptedAtParser", "allControlsPreserveBaseCandidate", "allAmbiguousOrOverLimitInputsRejectedBeforeMutation"]:
        expect(summary.get(field) is True, f"transport summary {field} drift", errors)
    expect(summary.get("controlSetCommitmentSha256") == control_commitment, "transport control-set drift", errors)
    expect(summary.get("rejectionSetCommitmentSha256") == rejection_commitment, "transport rejection-set drift", errors)
    expect(summary.get("combinedReplayCommitmentSha256") == combined_commitment, "transport combined replay drift", errors)
    for field in ["serializedRepresentationsStored", "runtimeCandidatesStored", "receiptIssued", "reviewCompleted", "activationAuthorized"]:
        expect(summary.get(field) is False, f"transport summary {field} drift", errors)
    expect(summary.get("activationEffect") == "NONE", "transport summary activation effect drift", errors)
    return errors, {
        "valid": not errors,
        "errors": errors,
        "acceptedControlCount": len(controls),
        "rejectionCount": len(rejections),
        "controlSetCommitmentSha256": control_commitment,
        "rejectionSetCommitmentSha256": rejection_commitment,
        "combinedReplayCommitmentSha256": combined_commitment,
        "allAmbiguousOrOverLimitInputsRejectedBeforeMutation": len(rejections) == 8,
        "serializedRepresentationsStored": False,
        "runtimeCandidatesStored": False,
        "network": "NONE",
        "receiptIssued": False,
        "reviewCompleted": False,
        "activationAuthorized": False,
        "activationEffect": "NONE",
    }


def verify_numeric(root: Path, artifact_path: Path) -> tuple[list[str], dict[str, Any]]:
    errors: list[str] = []
    try:
        artifact = load_json(artifact_path)
        base = load_json(root / BASE_NAME)
        controls, rejections = evaluate_numeric_corpus(base)
    except (OSError, UnicodeError, json.JSONDecodeError, ValueError) as error:
        return [f"cannot read numeric token evidence: {error}"], {}
    expect(artifact.get("vectorVersion") == 1, "numeric token version drift", errors)
    expect(artifact.get("vectorId") == "iat-promotions-dlc-contention-composition-numeric-tokens-v1", "numeric token ID drift", errors)
    expect(artifact.get("status") == {"labels": HOLD_LABELS, "network": "NONE", "programId": None, "deployable": False, "vectorsApplied": False}, "numeric token HOLD drift", errors)
    expected_sources = {
        "baseArtifact": {"path": BASE_NAME, "canonicalSha256": canonical_sha256(base)},
        "boundedParser": {"path": "settlement-contention-composition-transport-limits.mjs", "normalizedTextSha256": normalized_text_sha256(root / "settlement-contention-composition-transport-limits.mjs")},
        "pythonVerifier": {"path": "verify-settlement-contention-transport-limits.py", "normalizedTextSha256": normalized_text_sha256(Path(__file__).resolve())},
        "generator": {"path": "generate-settlement-contention-composition-numeric-token-audit.mjs", "normalizedTextSha256": normalized_text_sha256(root / "generate-settlement-contention-composition-numeric-token-audit.mjs")},
    }
    expect(artifact.get("sources") == expected_sources, "numeric token source drift", errors)
    contract = artifact.get("contract", {})
    expect(contract.get("mode") == "CANONICAL_SAFE_INTEGER_JSON_TRANSPORT", "numeric token mode drift", errors)
    expect(contract.get("numericTokenRules") == NUMERIC_TOKEN_RULES, "numeric token rules drift", errors)
    expect(contract.get("acceptedControlCount") == 4 and contract.get("rejectionCount") == 16, "numeric token counts drift", errors)
    family_counts = {
        "equivalentNoncanonicalCaseCount": 3,
        "negativeZeroCaseCount": 3,
        "unsafeIntegerCaseCount": 3,
        "nonfiniteEquivalentCaseCount": 2,
        "nonJsonNumberCaseCount": 5,
    }
    for field, value in family_counts.items():
        expect(contract.get(field) == value, f"numeric token {field} drift", errors)
    for field in ["equivalentSpellingsRejectedBeforeCandidate", "negativeZeroRejectedBeforeCandidate", "unsafeIntegersRejectedBeforeCandidate", "nonfiniteEquivalentsRejectedBeforeCandidate"]:
        expect(contract.get(field) is True, f"numeric contract {field} drift", errors)
    for field in ["serializedRepresentationsStored", "runtimeCandidatesStored", "usesLocalValidator", "usesRpc", "usesWallet", "preparesTransactions", "signsTransactions", "broadcastsTransactions", "issuesReviewReceipts", "completesReview", "activationAuthorized"]:
        expect(contract.get(field) is False, f"numeric contract {field} drift", errors)
    expect(contract.get("activationEffect") == "NONE", "numeric activation effect drift", errors)
    expect(artifact.get("controls") == controls, "numeric controls drift", errors)
    expect(artifact.get("rejections") == rejections, "numeric rejections drift", errors)
    summary = artifact.get("summary", {})
    control_commitment = canonical_sha256(controls)
    rejection_commitment = canonical_sha256(rejections)
    combined_commitment = canonical_sha256({"controls": controls, "rejections": rejections})
    expect(summary.get("acceptedControlCount") == "4" and summary.get("rejectionCount") == "16", "numeric summary counts drift", errors)
    expect(summary.get("allCanonicalControlsAccepted") is True and summary.get("allNoncanonicalOrUnsafeTokensRejectedBeforeCandidate") is True, "numeric summary outcome drift", errors)
    expect(summary.get("controlSetCommitmentSha256") == control_commitment, "numeric control-set drift", errors)
    expect(summary.get("rejectionSetCommitmentSha256") == rejection_commitment, "numeric rejection-set drift", errors)
    expect(summary.get("combinedReplayCommitmentSha256") == combined_commitment, "numeric combined replay drift", errors)
    for field in ["serializedRepresentationsStored", "runtimeCandidatesStored", "receiptIssued", "reviewCompleted", "activationAuthorized"]:
        expect(summary.get(field) is False, f"numeric summary {field} drift", errors)
    expect(summary.get("activationEffect") == "NONE", "numeric summary activation effect drift", errors)
    return errors, {
        "valid": not errors,
        "errors": errors,
        "acceptedControlCount": len(controls),
        "rejectionCount": len(rejections),
        "controlSetCommitmentSha256": control_commitment,
        "rejectionSetCommitmentSha256": rejection_commitment,
        "combinedReplayCommitmentSha256": combined_commitment,
        "allNoncanonicalOrUnsafeTokensRejectedBeforeCandidate": len(rejections) == 16,
        "serializedRepresentationsStored": False,
        "runtimeCandidatesStored": False,
        "network": "NONE",
        "receiptIssued": False,
        "reviewCompleted": False,
        "activationAuthorized": False,
        "activationEffect": "NONE",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify held bounded JSON transport evidence offline.")
    default_root = Path(__file__).resolve().parent
    parser.add_argument("--root", type=Path, default=default_root)
    parser.add_argument("--artifact", type=Path)
    parser.add_argument("--verify-numeric-token-audit", action="store_true")
    parser.add_argument("--json", action="store_true", dest="emit_json")
    arguments = parser.parse_args()
    root = arguments.root.resolve()
    artifact_name = NUMERIC_ARTIFACT_NAME if arguments.verify_numeric_token_audit else ARTIFACT_NAME
    artifact = arguments.artifact.resolve() if arguments.artifact else root / artifact_name
    errors, report = verify_numeric(root, artifact) if arguments.verify_numeric_token_audit else verify(root, artifact)
    if arguments.emit_json:
        print(json.dumps(report, separators=(",", ":")))
    elif errors:
        print("\n".join(errors), file=sys.stderr)
    else:
        label = "numeric-token" if arguments.verify_numeric_token_audit else "transport-limit"
        print(f"Independent {label} replay passed: {report['combinedReplayCommitmentSha256']}")
    return 2 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
