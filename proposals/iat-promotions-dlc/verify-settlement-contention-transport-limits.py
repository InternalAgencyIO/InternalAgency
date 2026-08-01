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
import unicodedata
from pathlib import Path
from typing import Any


ARTIFACT_NAME = "settlement-contention-composition-transport-limit-audit.v1.json"
NUMERIC_ARTIFACT_NAME = "settlement-contention-composition-numeric-token-audit.v1.json"
DELIMITER_ARTIFACT_NAME = "settlement-contention-composition-delimiter-whitespace-audit.v1.json"
STRING_ARTIFACT_NAME = "settlement-contention-composition-string-token-audit.v1.json"
KEY_COLLISION_ARTIFACT_NAME = "settlement-contention-composition-key-collision-audit.v1.json"
MARKER_VALUE_ARTIFACT_NAME = "settlement-contention-composition-marker-value-audit.v1.json"
FATAL_UTF8_ARTIFACT_NAME = "settlement-contention-composition-fatal-utf8-ingress-audit.v1.json"
UTF8_BOUNDARY_ARTIFACT_NAME = "settlement-contention-composition-utf8-boundary-audit.v1.json"
UTF8_BOM_POSITION_ARTIFACT_NAME = "settlement-contention-composition-utf8-bom-position-audit.v1.json"
BYTE_VIEW_BOUNDARY_ARTIFACT_NAME = "settlement-contention-composition-byte-view-boundary-audit.v1.json"
VISIBLE_VIEW_TRUNCATION_ARTIFACT_NAME = "settlement-contention-composition-visible-view-truncation-audit.v1.json"
VISIBLE_VIEW_ALIAS_MUTATION_ARTIFACT_NAME = "settlement-contention-composition-visible-view-alias-mutation-audit.v1.json"
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
DELIMITER_WHITESPACE_RULES = {
    "allowedWhitespaceCodePoints": ["U+0020", "U+0009", "U+000A", "U+000D"],
    "bomAllowed": False,
    "unicodeWhitespaceAllowed": False,
    "trailingValuesAllowed": False,
    "concatenatedDocumentsAllowed": False,
    "singleDocumentOnly": True,
}
STRING_TOKEN_RULES = {
    "requiredEnvelopeKeys": ["candidate", "transportMarker"],
    "keyComparison": "EXACT_DECODED_UNICODE_SCALAR_SEQUENCE",
    "rawControlCodePointsAllowedInStrings": False,
    "escapedControlCodePointsAllowedInRequiredKeys": False,
    "escapedCanonicalKeySpellingsAllowed": True,
    "unicodeNormalizationAppliedToRequiredKeys": False,
    "unicodeCompatibilityLookalikesAllowed": False,
}
KEY_COLLISION_RULES = {
    "duplicateComparison": "EXACT_DECODED_UNICODE_SCALAR_SEQUENCE",
    "escapedCanonicalSpellingsCollide": True,
    "unicodeNormalizationAppliedBeforeDuplicateCheck": False,
    "normalizationLookalikesRemainDistinct": True,
    "distinctUnexpectedKeysRejected": True,
}
TRANSPORT_MARKER_VALUE_RULES = {
    "canonicalValue": "DRAFT/INACTIVE",
    "comparison": "EXACT_DECODED_UNICODE_SCALAR_SEQUENCE",
    "escapedCanonicalValueSpellingsAllowed": True,
    "rawControlCodePointsAllowed": False,
    "escapedControlCodePointsAllowed": False,
    "caseFoldApplied": False,
    "unicodeNormalizationApplied": False,
    "confusableMappingApplied": False,
}
FATAL_UTF8_INGRESS_RULES = {
    "inputType": "BYTE_SEQUENCE",
    "encoding": "UTF-8",
    "decoderErrorMode": "FATAL",
    "replacementCharacterInserted": False,
    "bomHandling": "PRESERVE_FOR_JSON_DELIMITER_RULE",
    "rejectionPrecedesJsonParsing": True,
}
UTF8_BOUNDARY_RULES = {
    "maximumUnicodeScalar": "U+10FFFF",
    "shortestFormRequired": True,
    "obsoleteFiveSixByteFormsAllowed": False,
    "feFfLeadBytesAllowed": False,
    "continuationBytesRequireActiveSequence": True,
    "rejectionPrecedesJsonParsing": True,
}
UTF8_BOM_POSITION_RULES = {
    "bomUtf8Bytes": "EF BB BF",
    "decoderPreservesBomScalar": True,
    "leadingBomAllowed": False,
    "postWhitespaceBomAllowed": False,
    "trailingBomAllowed": False,
    "bomInsideJsonStringAllowed": True,
    "delimiterRejectionAfterSuccessfulDecode": True,
}
BYTE_VIEW_BOUNDARY_RULES = {
    "acceptedInputType": "Uint8Array",
    "byteOffsetRespected": True,
    "byteLengthRespected": True,
    "arrayBufferAccepted": False,
    "dataViewAccepted": False,
    "stringAccepted": False,
    "numericArrayAccepted": False,
    "invalidInputError": "INVALID_BYTE_VIEW",
    "rejectionPrecedesUtf8Decoding": True,
}
VISIBLE_VIEW_TRUNCATION_RULES = {
    "acceptedInputType": "Uint8Array",
    "fullViewAccepted": True,
    "emptyViewAccepted": False,
    "prefixOnlyViewAccepted": False,
    "suffixOnlyViewAccepted": False,
    "oneByteShortViewAccepted": False,
    "outsideViewReadAllowed": False,
    "truncatedViewError": "MALFORMED_JSON",
    "rejectionAfterSuccessfulUtf8Decode": True,
}
VISIBLE_VIEW_ALIAS_MUTATION_RULES = {
    "acceptedInputType": "Uint8Array",
    "sharedBackingBufferRequired": True,
    "outsideViewMutationsAffectVisibleBytes": False,
    "outsideViewMutationsAffectCandidate": False,
    "insideViewMutationsDetected": True,
    "detectionModes": ["CANDIDATE_COMMITMENT_CHANGED", "PARSER_REJECTION"],
    "backingByteSequencesStored": False,
    "visibleByteSequencesStored": False,
}
NORMALIZATION_KEY_DEFINITIONS = [
    ("FULLWIDTH_C_PREFIX", "ｃandidate", "candidate"),
    ("FULLWIDTH_CANDIDATE", "ｃａｎｄｉｄａｔｅ", "candidate"),
    ("CIRCLED_C_PREFIX", "ⓒandidate", "candidate"),
    ("MATHEMATICAL_BOLD_C_PREFIX", "𝐜andidate", "candidate"),
    ("FULLWIDTH_T_PREFIX", "ｔransportMarker", "transportMarker"),
    ("FULLWIDTH_CAPITAL_M", "transportＭarker", "transportMarker"),
]


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


def parse_transport_envelope_bytes(serialized_bytes: Any) -> tuple[dict[str, Any], dict[str, int]]:
    if not isinstance(serialized_bytes, bytes):
        raise TransportError("INVALID_BYTE_VIEW")
    try:
        serialized = serialized_bytes.decode("utf-8", "strict")
    except UnicodeDecodeError:
        raise TransportError("INVALID_UTF8") from None
    return parse_transport_envelope(serialized)


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


def standard_whitespace_probe() -> str:
    return ' \n\t{ \r\n"transportMarker"\t:\t"DRAFT/INACTIVE"\r,\n"candidate"\t:\t{\n"whitespaceProbe"\r:\n0\t}\n}\r\n'


def place_character(serialized: str, character: str, placement: str, case_id: str) -> str:
    if placement == "PREFIX":
        return character + serialized
    if placement == "SUFFIX":
        return serialized + character
    if placement == "AFTER_FIRST_COLON":
        return replace_required(serialized, ':"DRAFT/INACTIVE"', f':{character}"DRAFT/INACTIVE"', case_id)
    if placement == "AFTER_FIRST_COMMA":
        return replace_required(serialized, ',"candidate"', f',{character}"candidate"', case_id)
    if placement == "BEFORE_FINAL_BRACE":
        return serialized[:-1] + character + "}"
    raise TransportError(f"DELIMITER_CORPUS_BUILD_FAILED:{case_id}")


def build_delimiter_corpus(base: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    base_lf = render_json({"transportMarker": TRANSPORT_MARKER, "candidate": base})
    base_compact = json.dumps({"transportMarker": TRANSPORT_MARKER, "candidate": base}, ensure_ascii=False, separators=(",", ":"))
    base_crlf = base_lf.replace("\n", "\r\n")
    compact_probe = numeric_envelope("0")
    controls = [
        {"caseId": "BASELINE_PRETTY_LF", "representation": "PRETTY_LF", "serialized": base_lf, "expectedCandidate": base},
        {"caseId": "COMPACT_SINGLE_DOCUMENT", "representation": "COMPACT", "serialized": base_compact, "expectedCandidate": base},
        {"caseId": "BASELINE_PRETTY_CRLF", "representation": "PRETTY_CRLF", "serialized": base_crlf, "expectedCandidate": base},
        {"caseId": "STANDARD_WHITESPACE_MIX", "representation": "SPACE_TAB_LF_CR", "serialized": standard_whitespace_probe(), "expectedCandidate": {"whitespaceProbe": 0}},
    ]
    definitions = [
        ("BOM_PREFIX", "BOM", "U+FEFF_PREFIX", "\ufeff", "PREFIX"),
        ("BOM_SUFFIX", "BOM", "U+FEFF_SUFFIX", "\ufeff", "SUFFIX"),
        ("BOM_AFTER_COLON", "BOM", "U+FEFF_AFTER_FIRST_COLON", "\ufeff", "AFTER_FIRST_COLON"),
        ("NBSP_PREFIX", "UNICODE_WHITESPACE", "U+00A0_PREFIX", "\u00a0", "PREFIX"),
        ("OGHAM_SUFFIX", "UNICODE_WHITESPACE", "U+1680_SUFFIX", "\u1680", "SUFFIX"),
        ("EN_SPACE_AFTER_COLON", "UNICODE_WHITESPACE", "U+2002_AFTER_FIRST_COLON", "\u2002", "AFTER_FIRST_COLON"),
        ("LINE_SEPARATOR_AFTER_COMMA", "UNICODE_WHITESPACE", "U+2028_AFTER_FIRST_COMMA", "\u2028", "AFTER_FIRST_COMMA"),
        ("PARAGRAPH_SEPARATOR_PREFIX", "UNICODE_WHITESPACE", "U+2029_PREFIX", "\u2029", "PREFIX"),
        ("NARROW_NBSP_BEFORE_CLOSE", "UNICODE_WHITESPACE", "U+202F_BEFORE_FINAL_BRACE", "\u202f", "BEFORE_FINAL_BRACE"),
        ("IDEOGRAPHIC_SPACE_AFTER_COLON", "UNICODE_WHITESPACE", "U+3000_AFTER_FIRST_COLON", "\u3000", "AFTER_FIRST_COLON"),
    ]
    rejections = [{
        "caseId": case_id,
        "family": family,
        "descriptor": descriptor,
        "serialized": place_character(base_compact, character, placement, case_id),
        "expectedError": "MALFORMED_JSON",
    } for case_id, family, descriptor, character, placement in definitions]
    rejections.extend([
        {"caseId": "TRAILING_SCALAR", "family": "TRAILING_VALUE", "descriptor": "TRAILING_TRUE", "serialized": base_compact + " true", "expectedError": "MALFORMED_JSON"},
        {"caseId": "TRAILING_OBJECT", "family": "TRAILING_VALUE", "descriptor": "TRAILING_EMPTY_OBJECT", "serialized": base_compact + " {}", "expectedError": "MALFORMED_JSON"},
        {"caseId": "TRAILING_ARRAY", "family": "TRAILING_VALUE", "descriptor": "TRAILING_EMPTY_ARRAY", "serialized": base_compact + " []", "expectedError": "MALFORMED_JSON"},
        {"caseId": "CONCATENATED_COMPACT", "family": "CONCATENATED_DOCUMENT", "descriptor": "COMPACT_NO_SEPARATOR", "serialized": compact_probe + compact_probe, "expectedError": "MALFORMED_JSON"},
        {"caseId": "CONCATENATED_SPACE", "family": "CONCATENATED_DOCUMENT", "descriptor": "COMPACT_SPACE_COMPACT", "serialized": compact_probe + " " + compact_probe, "expectedError": "MALFORMED_JSON"},
        {"caseId": "CONCATENATED_NEWLINE", "family": "CONCATENATED_DOCUMENT", "descriptor": "COMPACT_LF_COMPACT", "serialized": compact_probe + "\n" + compact_probe, "expectedError": "MALFORMED_JSON"},
    ])
    return controls, rejections


def evaluate_delimiter_corpus(base: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    control_inputs, rejection_inputs = build_delimiter_corpus(base)
    controls = []
    for item in control_inputs:
        candidate, _metrics = parse_transport_envelope(item["serialized"])
        if canonical_sha256(candidate) != canonical_sha256(item["expectedCandidate"]):
            raise TransportError(f'DELIMITER_CONTROL_DRIFT:{item["caseId"]}')
        controls.append({
            "caseId": item["caseId"],
            "representation": item["representation"],
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
            raise TransportError(f'DELIMITER_REJECTION_DRIFT:{item["caseId"]}:{observed_error}')
        rejections.append({
            "caseId": item["caseId"],
            "family": item["family"],
            "descriptor": item["descriptor"],
            "representationSha256": hashlib.sha256(item["serialized"].encode("utf-8")).hexdigest(),
            "utf8Bytes": len(item["serialized"].encode("utf-8")),
            "expectedError": item["expectedError"],
            "observedError": observed_error,
            "rejectedBeforeCandidate": True,
            "candidateProduced": False,
            "mutationEvaluated": False,
        })
    return controls, rejections


def string_probe_envelope(candidate_key_token: str = '"candidate"', marker_key_token: str = '"transportMarker"') -> str:
    return f'{{{marker_key_token}:"{TRANSPORT_MARKER}",{candidate_key_token}:{{"stringProbe":0}}}}'


def string_key_envelope(decoded_key: str, target_required_key: str) -> str:
    marker_key = decoded_key if target_required_key == "transportMarker" else "transportMarker"
    candidate_key = decoded_key if target_required_key == "candidate" else "candidate"
    return json.dumps(
        {marker_key: TRANSPORT_MARKER, candidate_key: {"stringProbe": 0}},
        ensure_ascii=False,
        separators=(",", ":"),
    )


def build_string_corpus(base: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    base_compact = json.dumps({"transportMarker": TRANSPORT_MARKER, "candidate": base}, ensure_ascii=False, separators=(",", ":"))
    controls = [
        {"caseId": "BASELINE_COMPACT", "representation": "CANONICAL_LITERAL_KEYS", "serialized": base_compact, "expectedCandidate": base},
        {"caseId": "ESCAPED_CANONICAL_CANDIDATE_KEY", "representation": "ESCAPED_ASCII_CANDIDATE_KEY", "serialized": string_probe_envelope('"\\u0063andidate"'), "expectedCandidate": {"stringProbe": 0}},
        {"caseId": "ESCAPED_CANONICAL_MARKER_KEY", "representation": "ESCAPED_ASCII_MARKER_KEY", "serialized": string_probe_envelope('"candidate"', '"transport\\u004darker"'), "expectedCandidate": {"stringProbe": 0}},
    ]
    control_definitions = [
        ("U+0000", "\u0000"),
        ("U+0008", "\b"),
        ("U+0009", "\t"),
        ("U+000A", "\n"),
        ("U+000C", "\f"),
        ("U+000D", "\r"),
        ("U+001F", "\u001f"),
    ]
    raw_controls = [{
        "caseId": f"RAW_CONTROL_{descriptor[2:]}",
        "family": "RAW_CONTROL_IN_STRING",
        "descriptor": descriptor,
        "targetRequiredKey": "candidate",
        "serialized": string_probe_envelope(f'"cand{character}idate"'),
        "expectedError": "MALFORMED_JSON",
        "nfkcMatchesRequiredKey": False,
    } for descriptor, character in control_definitions]
    escaped_definitions = [
        ("U+0000", r"\u0000"),
        ("U+0008", r"\b"),
        ("U+0009", r"\t"),
        ("U+000A", r"\n"),
        ("U+000C", r"\f"),
        ("U+000D", r"\r"),
        ("U+001F", r"\u001f"),
    ]
    escaped_controls = [{
        "caseId": f"ESCAPED_CONTROL_{descriptor[2:]}",
        "family": "ESCAPED_CONTROL_IN_REQUIRED_KEY",
        "descriptor": descriptor,
        "targetRequiredKey": "candidate",
        "serialized": string_probe_envelope(f'"cand{token}idate"'),
        "expectedError": "INVALID_TRANSPORT_ENVELOPE",
        "nfkcMatchesRequiredKey": False,
    } for descriptor, token in escaped_definitions]
    normalization_lookalikes = []
    for descriptor, variant_key, target_required_key in NORMALIZATION_KEY_DEFINITIONS:
        if variant_key == target_required_key or unicodedata.normalize("NFKC", variant_key) != target_required_key:
            raise TransportError(f"STRING_NORMALIZATION_CORPUS_BUILD_FAILED:{descriptor}")
        normalization_lookalikes.append({
            "caseId": f"NORMALIZATION_{descriptor}",
            "family": "UNICODE_NORMALIZATION_LOOKALIKE",
            "descriptor": descriptor,
            "targetRequiredKey": target_required_key,
            "serialized": string_key_envelope(variant_key, target_required_key),
            "expectedError": "INVALID_TRANSPORT_ENVELOPE",
            "nfkcMatchesRequiredKey": True,
        })
    return controls, raw_controls + escaped_controls + normalization_lookalikes


def evaluate_string_corpus(base: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    control_inputs, rejection_inputs = build_string_corpus(base)
    controls = []
    for item in control_inputs:
        candidate, _metrics = parse_transport_envelope(item["serialized"])
        if canonical_sha256(candidate) != canonical_sha256(item["expectedCandidate"]):
            raise TransportError(f'STRING_CONTROL_DRIFT:{item["caseId"]}')
        controls.append({
            "caseId": item["caseId"],
            "representation": item["representation"],
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
            raise TransportError(f'STRING_REJECTION_DRIFT:{item["caseId"]}:{observed_error}')
        rejections.append({
            "caseId": item["caseId"],
            "family": item["family"],
            "descriptor": item["descriptor"],
            "targetRequiredKey": item["targetRequiredKey"],
            "representationSha256": hashlib.sha256(item["serialized"].encode("utf-8")).hexdigest(),
            "utf8Bytes": len(item["serialized"].encode("utf-8")),
            "expectedError": item["expectedError"],
            "observedError": observed_error,
            "nfkcMatchesRequiredKey": item["nfkcMatchesRequiredKey"],
            "rejectedBeforeCandidate": True,
            "candidateProduced": False,
            "mutationEvaluated": False,
        })
    return controls, rejections


def duplicate_required_key_envelope(target_required_key: str, first_key_token: str, second_key_token: str) -> str:
    candidate = '{"collisionProbe":0}'
    if target_required_key == "candidate":
        return f'{{"transportMarker":"{TRANSPORT_MARKER}",{first_key_token}:{candidate},{second_key_token}:{candidate}}}'
    if target_required_key == "transportMarker":
        return f'{{{first_key_token}:"{TRANSPORT_MARKER}",{second_key_token}:"{TRANSPORT_MARKER}","candidate":{candidate}}}'
    raise TransportError(f"KEY_COLLISION_CORPUS_BUILD_FAILED:{target_required_key}")


def normalization_distinct_envelope(variant_key: str, target_required_key: str) -> str:
    candidate = {"collisionProbe": 0}
    if target_required_key == "candidate":
        value = {"transportMarker": TRANSPORT_MARKER, "candidate": candidate, variant_key: candidate}
    elif target_required_key == "transportMarker":
        value = {"transportMarker": TRANSPORT_MARKER, variant_key: TRANSPORT_MARKER, "candidate": candidate}
    else:
        raise TransportError(f"KEY_COLLISION_CORPUS_BUILD_FAILED:{target_required_key}")
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def build_key_collision_corpus(base: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    controls = [
        {"caseId": "BASELINE_COMPACT", "representation": "CANONICAL_LITERAL_KEYS", "serialized": json.dumps({"transportMarker": TRANSPORT_MARKER, "candidate": base}, ensure_ascii=False, separators=(",", ":")), "expectedCandidate": base},
        {"caseId": "ESCAPED_CANONICAL_CANDIDATE_KEY", "representation": "ESCAPED_ASCII_CANDIDATE_KEY", "serialized": string_probe_envelope('"\\u0063andidate"').replace("stringProbe", "collisionProbe"), "expectedCandidate": {"collisionProbe": 0}},
        {"caseId": "ESCAPED_CANONICAL_MARKER_KEY", "representation": "ESCAPED_ASCII_MARKER_KEY", "serialized": string_probe_envelope('"candidate"', '"transport\\u004darker"').replace("stringProbe", "collisionProbe"), "expectedCandidate": {"collisionProbe": 0}},
    ]
    duplicate_definitions = [
        ("CANDIDATE_LITERAL_THEN_ESCAPE", "candidate", '"candidate"', '"\\u0063andidate"'),
        ("CANDIDATE_ESCAPE_THEN_LITERAL", "candidate", '"\\u0063andidate"', '"candidate"'),
        ("CANDIDATE_TWO_ESCAPE_SPELLINGS", "candidate", '"\\u0063andidate"', '"c\\u0061ndidate"'),
        ("MARKER_LITERAL_THEN_ESCAPE", "transportMarker", '"transportMarker"', '"transport\\u004darker"'),
        ("MARKER_ESCAPE_THEN_LITERAL", "transportMarker", '"transport\\u004darker"', '"transportMarker"'),
        ("MARKER_TWO_ESCAPE_SPELLINGS", "transportMarker", '"\\u0074ransportMarker"', '"transport\\u004darker"'),
    ]
    decoded_duplicates = [{
        "caseId": f"DUPLICATE_{descriptor}",
        "family": "DECODED_KEY_DUPLICATE",
        "descriptor": descriptor,
        "targetRequiredKey": target_required_key,
        "serialized": duplicate_required_key_envelope(target_required_key, first_key_token, second_key_token),
        "expectedError": "DUPLICATE_JSON_KEY",
        "decodedKeysCollide": True,
        "nfkcMatchesRequiredKey": False,
        "distinctDecodedKey": False,
    } for descriptor, target_required_key, first_key_token, second_key_token in duplicate_definitions]
    normalization_distinct = []
    for descriptor, variant_key, target_required_key in NORMALIZATION_KEY_DEFINITIONS:
        if variant_key == target_required_key or unicodedata.normalize("NFKC", variant_key) != target_required_key:
            raise TransportError(f"KEY_COLLISION_NORMALIZATION_CORPUS_BUILD_FAILED:{descriptor}")
        normalization_distinct.append({
            "caseId": f"DISTINCT_{descriptor}",
            "family": "NORMALIZATION_LOOKALIKE_DISTINCT_KEY",
            "descriptor": descriptor,
            "targetRequiredKey": target_required_key,
            "serialized": normalization_distinct_envelope(variant_key, target_required_key),
            "expectedError": "INVALID_TRANSPORT_ENVELOPE",
            "decodedKeysCollide": False,
            "nfkcMatchesRequiredKey": True,
            "distinctDecodedKey": True,
        })
    return controls, decoded_duplicates + normalization_distinct


def evaluate_key_collision_corpus(base: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    control_inputs, rejection_inputs = build_key_collision_corpus(base)
    controls = []
    for item in control_inputs:
        candidate, _metrics = parse_transport_envelope(item["serialized"])
        if canonical_sha256(candidate) != canonical_sha256(item["expectedCandidate"]):
            raise TransportError(f'KEY_COLLISION_CONTROL_DRIFT:{item["caseId"]}')
        controls.append({
            "caseId": item["caseId"],
            "representation": item["representation"],
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
            raise TransportError(f'KEY_COLLISION_REJECTION_DRIFT:{item["caseId"]}:{observed_error}')
        rejections.append({
            "caseId": item["caseId"],
            "family": item["family"],
            "descriptor": item["descriptor"],
            "targetRequiredKey": item["targetRequiredKey"],
            "representationSha256": hashlib.sha256(item["serialized"].encode("utf-8")).hexdigest(),
            "utf8Bytes": len(item["serialized"].encode("utf-8")),
            "expectedError": item["expectedError"],
            "observedError": observed_error,
            "decodedKeysCollide": item["decodedKeysCollide"],
            "nfkcMatchesRequiredKey": item["nfkcMatchesRequiredKey"],
            "distinctDecodedKey": item["distinctDecodedKey"],
            "rejectedBeforeCandidate": True,
            "candidateProduced": False,
            "mutationEvaluated": False,
        })
    return controls, rejections


def marker_token_envelope(marker_token: str) -> str:
    return f'{{"transportMarker":{marker_token},"candidate":{{"markerProbe":0}}}}'


def marker_value_envelope(marker_value: str) -> str:
    return json.dumps({"transportMarker": marker_value, "candidate": {"markerProbe": 0}}, ensure_ascii=False, separators=(",", ":"))


def build_marker_value_corpus(base: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    controls = [
        {"caseId": "BASELINE_COMPACT", "representation": "CANONICAL_LITERAL_MARKER", "serialized": json.dumps({"transportMarker": TRANSPORT_MARKER, "candidate": base}, ensure_ascii=False, separators=(",", ":")), "expectedCandidate": base},
        {"caseId": "ESCAPED_CANONICAL_D", "representation": "ESCAPED_ASCII_D", "serialized": marker_token_envelope('"\\u0044RAFT/INACTIVE"'), "expectedCandidate": {"markerProbe": 0}},
        {"caseId": "ESCAPED_CANONICAL_SOLIDUS", "representation": "ESCAPED_SOLIDUS", "serialized": marker_token_envelope('"DRAFT\\/INACTIVE"'), "expectedCandidate": {"markerProbe": 0}},
        {"caseId": "FULLY_ESCAPED_CANONICAL", "representation": "ESCAPED_ALL_ASCII", "serialized": marker_token_envelope('"\\u0044\\u0052\\u0041\\u0046\\u0054\\u002f\\u0049\\u004e\\u0041\\u0043\\u0054\\u0049\\u0056\\u0045"'), "expectedCandidate": {"markerProbe": 0}},
    ]
    raw_definitions = [("U+0000", "\u0000"), ("U+000A", "\n"), ("U+000D", "\r")]
    raw_controls = [{
        "caseId": f"RAW_MARKER_CONTROL_{descriptor[2:]}",
        "family": "RAW_CONTROL_IN_MARKER_VALUE",
        "descriptor": descriptor,
        "serialized": marker_token_envelope(f'"DRAFT{character}/INACTIVE"'),
        "expectedError": "MALFORMED_JSON",
        "nfkcMatchesCanonical": False,
        "caseInsensitiveMatchesCanonical": False,
        "confusableCrossScript": False,
    } for descriptor, character in raw_definitions]
    escaped_definitions = [("U+0000", r"\u0000"), ("U+0009", r"\t"), ("U+000A", r"\n"), ("U+000D", r"\r")]
    escaped_controls = [{
        "caseId": f"ESCAPED_MARKER_CONTROL_{descriptor[2:]}",
        "family": "ESCAPED_CONTROL_IN_MARKER_VALUE",
        "descriptor": descriptor,
        "serialized": marker_token_envelope(f'"DRAFT{token}/INACTIVE"'),
        "expectedError": "INVALID_TRANSPORT_ENVELOPE",
        "nfkcMatchesCanonical": False,
        "caseInsensitiveMatchesCanonical": False,
        "confusableCrossScript": False,
    } for descriptor, token in escaped_definitions]
    case_definitions = [
        ("LOWERCASE_DRAFT", "draft/INACTIVE"),
        ("LOWERCASE_INACTIVE", "DRAFT/inactive"),
        ("TITLE_CASE_BOTH", "Draft/Inactive"),
    ]
    case_variants = []
    for descriptor, marker_value in case_definitions:
        if marker_value == TRANSPORT_MARKER or marker_value.lower() != TRANSPORT_MARKER.lower():
            raise TransportError(f"MARKER_CASE_CORPUS_BUILD_FAILED:{descriptor}")
        case_variants.append({
            "caseId": f"CASE_{descriptor}",
            "family": "CASE_VARIANT",
            "descriptor": descriptor,
            "serialized": marker_value_envelope(marker_value),
            "expectedError": "INVALID_TRANSPORT_ENVELOPE",
            "nfkcMatchesCanonical": False,
            "caseInsensitiveMatchesCanonical": True,
            "confusableCrossScript": False,
        })
    normalization_definitions = [
        ("FULLWIDTH_D_PREFIX", "ＤRAFT/INACTIVE"),
        ("FULLWIDTH_SOLIDUS", "DRAFT／INACTIVE"),
        ("FULLWIDTH_COMPLETE", "ＤＲＡＦＴ／ＩＮＡＣＴＩＶＥ"),
        ("MATHEMATICAL_BOLD_D_PREFIX", "𝐃RAFT/INACTIVE"),
    ]
    normalization_variants = []
    for descriptor, marker_value in normalization_definitions:
        if marker_value == TRANSPORT_MARKER or unicodedata.normalize("NFKC", marker_value) != TRANSPORT_MARKER:
            raise TransportError(f"MARKER_NORMALIZATION_CORPUS_BUILD_FAILED:{descriptor}")
        normalization_variants.append({
            "caseId": f"NORMALIZATION_{descriptor}",
            "family": "NORMALIZATION_VARIANT",
            "descriptor": descriptor,
            "serialized": marker_value_envelope(marker_value),
            "expectedError": "INVALID_TRANSPORT_ENVELOPE",
            "nfkcMatchesCanonical": True,
            "caseInsensitiveMatchesCanonical": False,
            "confusableCrossScript": False,
        })
    confusable_definitions = [
        ("GREEK_CAPITAL_ALPHA", "DRΑFT/INACTIVE"),
        ("CYRILLIC_CAPITAL_A", "DRАFT/INACTIVE"),
    ]
    confusable_variants = [{
        "caseId": f"CONFUSABLE_{descriptor}",
        "family": "CROSS_SCRIPT_CONFUSABLE",
        "descriptor": descriptor,
        "serialized": marker_value_envelope(marker_value),
        "expectedError": "INVALID_TRANSPORT_ENVELOPE",
        "nfkcMatchesCanonical": False,
        "caseInsensitiveMatchesCanonical": False,
        "confusableCrossScript": True,
    } for descriptor, marker_value in confusable_definitions]
    return controls, raw_controls + escaped_controls + case_variants + normalization_variants + confusable_variants


def evaluate_marker_value_corpus(base: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    control_inputs, rejection_inputs = build_marker_value_corpus(base)
    controls = []
    for item in control_inputs:
        candidate, _metrics = parse_transport_envelope(item["serialized"])
        if canonical_sha256(candidate) != canonical_sha256(item["expectedCandidate"]):
            raise TransportError(f'MARKER_VALUE_CONTROL_DRIFT:{item["caseId"]}')
        controls.append({
            "caseId": item["caseId"],
            "representation": item["representation"],
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
            raise TransportError(f'MARKER_VALUE_REJECTION_DRIFT:{item["caseId"]}:{observed_error}')
        rejections.append({
            "caseId": item["caseId"],
            "family": item["family"],
            "descriptor": item["descriptor"],
            "representationSha256": hashlib.sha256(item["serialized"].encode("utf-8")).hexdigest(),
            "utf8Bytes": len(item["serialized"].encode("utf-8")),
            "expectedError": item["expectedError"],
            "observedError": observed_error,
            "nfkcMatchesCanonical": item["nfkcMatchesCanonical"],
            "caseInsensitiveMatchesCanonical": item["caseInsensitiveMatchesCanonical"],
            "confusableCrossScript": item["confusableCrossScript"],
            "rejectedBeforeCandidate": True,
            "candidateProduced": False,
            "mutationEvaluated": False,
        })
    return controls, rejections


def utf8_probe_envelope(probe: str) -> bytes:
    return json.dumps({"transportMarker": TRANSPORT_MARKER, "candidate": {"utf8Probe": probe}}, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def invalid_utf8_probe_envelope(injected_bytes: bytes) -> bytes:
    prefix = b'{"transportMarker":"DRAFT/INACTIVE","candidate":{"utf8Probe":"'
    suffix = b'"}}'
    return prefix + injected_bytes + suffix


def truncated_utf8_probe_envelope(injected_bytes: bytes) -> bytes:
    prefix = b'{"transportMarker":"DRAFT/INACTIVE","candidate":{"utf8Probe":"'
    return prefix + injected_bytes


def build_fatal_utf8_corpus(base: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    controls = [
        {
            "caseId": "ASCII_BASELINE",
            "scalarClass": "ONE_BYTE_ASCII",
            "serializedBytes": json.dumps({"transportMarker": TRANSPORT_MARKER, "candidate": base}, ensure_ascii=False, separators=(",", ":")).encode("utf-8"),
            "expectedCandidate": base,
        },
        {"caseId": "VALID_TWO_BYTE_SCALAR", "scalarClass": "U+00E9", "serializedBytes": utf8_probe_envelope("\u00e9"), "expectedCandidate": {"utf8Probe": "\u00e9"}},
        {"caseId": "VALID_THREE_BYTE_SCALAR", "scalarClass": "U+20AC", "serializedBytes": utf8_probe_envelope("\u20ac"), "expectedCandidate": {"utf8Probe": "\u20ac"}},
        {"caseId": "VALID_FOUR_BYTE_SCALAR", "scalarClass": "U+1F642", "serializedBytes": utf8_probe_envelope("\U0001f642"), "expectedCandidate": {"utf8Probe": "\U0001f642"}},
    ]
    definitions = [
        ("TRUNCATED_TWO_BYTE_AT_EOF", "TRUNCATED_UTF8", "TWO_BYTE_LEAD_ONLY", bytes([0xC2])),
        ("TRUNCATED_THREE_BYTE_AFTER_LEAD", "TRUNCATED_UTF8", "THREE_BYTE_LEAD_ONLY", bytes([0xE2])),
        ("TRUNCATED_THREE_BYTE_AFTER_ONE_CONTINUATION", "TRUNCATED_UTF8", "THREE_BYTE_ONE_CONTINUATION", bytes([0xE2, 0x82])),
        ("TRUNCATED_FOUR_BYTE_AFTER_TWO_CONTINUATIONS", "TRUNCATED_UTF8", "FOUR_BYTE_TWO_CONTINUATIONS", bytes([0xF0, 0x9F, 0x99])),
        ("OVERLONG_TWO_BYTE_NUL", "OVERLONG_UTF8", "TWO_BYTE_NUL", bytes([0xC0, 0x80])),
        ("OVERLONG_TWO_BYTE_SOLIDUS", "OVERLONG_UTF8", "TWO_BYTE_SOLIDUS", bytes([0xC0, 0xAF])),
        ("OVERLONG_THREE_BYTE_NUL", "OVERLONG_UTF8", "THREE_BYTE_NUL", bytes([0xE0, 0x80, 0x80])),
        ("OVERLONG_FOUR_BYTE_NUL", "OVERLONG_UTF8", "FOUR_BYTE_NUL", bytes([0xF0, 0x80, 0x80, 0x80])),
        ("SURROGATE_HIGH_MIN", "SURROGATE_ENCODED_UTF8", "U+D800", bytes([0xED, 0xA0, 0x80])),
        ("SURROGATE_HIGH_MAX", "SURROGATE_ENCODED_UTF8", "U+DBFF", bytes([0xED, 0xAF, 0xBF])),
        ("SURROGATE_LOW_MIN", "SURROGATE_ENCODED_UTF8", "U+DC00", bytes([0xED, 0xB0, 0x80])),
        ("SURROGATE_LOW_MAX", "SURROGATE_ENCODED_UTF8", "U+DFFF", bytes([0xED, 0xBF, 0xBF])),
        ("INVALID_LONE_CONTINUATION", "INVALID_CONTINUATION_UTF8", "LONE_CONTINUATION", bytes([0x80])),
        ("INVALID_TWO_BYTE_ASCII_CONTINUATION", "INVALID_CONTINUATION_UTF8", "TWO_BYTE_ASCII_SECOND", bytes([0xC2, 0x20])),
        ("INVALID_THREE_BYTE_SECOND", "INVALID_CONTINUATION_UTF8", "THREE_BYTE_INVALID_SECOND", bytes([0xE2, 0x28, 0xA1])),
        ("INVALID_FOUR_BYTE_SECOND", "INVALID_CONTINUATION_UTF8", "FOUR_BYTE_INVALID_SECOND", bytes([0xF0, 0x28, 0x8C, 0xBC])),
    ]
    rejections = [{
        "caseId": case_id,
        "family": family,
        "descriptor": descriptor,
        "serializedBytes": truncated_utf8_probe_envelope(injected_bytes) if family == "TRUNCATED_UTF8" else invalid_utf8_probe_envelope(injected_bytes),
        "injectedByteLength": len(injected_bytes),
        "expectedError": "INVALID_UTF8",
    } for case_id, family, descriptor, injected_bytes in definitions]
    return controls, rejections


def evaluate_fatal_utf8_corpus(base: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    control_inputs, rejection_inputs = build_fatal_utf8_corpus(base)
    controls = []
    for item in control_inputs:
        candidate, _metrics = parse_transport_envelope_bytes(item["serializedBytes"])
        if canonical_sha256(candidate) != canonical_sha256(item["expectedCandidate"]):
            raise TransportError(f'FATAL_UTF8_CONTROL_DRIFT:{item["caseId"]}')
        controls.append({
            "caseId": item["caseId"],
            "scalarClass": item["scalarClass"],
            "representationSha256": hashlib.sha256(item["serializedBytes"]).hexdigest(),
            "utf8Bytes": len(item["serializedBytes"]),
            "candidateCommitmentSha256": canonical_sha256(candidate),
            "utf8DecodingSucceeded": True,
            "acceptedAtParser": True,
            "candidateStored": False,
            "mutationEvaluated": False,
        })
    rejections = []
    for item in rejection_inputs:
        observed_error = None
        try:
            parse_transport_envelope_bytes(item["serializedBytes"])
        except TransportError as error:
            observed_error = str(error)
        if observed_error != item["expectedError"]:
            raise TransportError(f'FATAL_UTF8_REJECTION_DRIFT:{item["caseId"]}:{observed_error}')
        rejections.append({
            "caseId": item["caseId"],
            "family": item["family"],
            "descriptor": item["descriptor"],
            "representationSha256": hashlib.sha256(item["serializedBytes"]).hexdigest(),
            "utf8Bytes": len(item["serializedBytes"]),
            "injectedByteLength": item["injectedByteLength"],
            "expectedError": item["expectedError"],
            "observedError": observed_error,
            "utf8DecodingSucceeded": False,
            "jsonParsingAttempted": False,
            "rejectedBeforeCandidate": True,
            "candidateProduced": False,
            "mutationEvaluated": False,
        })
    return controls, rejections


def build_utf8_boundary_corpus() -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    control_definitions = [
        ("MAX_ONE_BYTE_SCALAR", "U+007F", bytes([0x7F]), "\u007f"),
        ("MAX_TWO_BYTE_SCALAR", "U+07FF", bytes([0xDF, 0xBF]), "\u07ff"),
        ("LAST_PRE_SURROGATE_SCALAR", "U+D7FF", bytes([0xED, 0x9F, 0xBF]), "\ud7ff"),
        ("MAX_UNICODE_SCALAR", "U+10FFFF", bytes([0xF4, 0x8F, 0xBF, 0xBF]), "\U0010ffff"),
    ]
    controls = [{
        "caseId": case_id,
        "scalarClass": scalar_class,
        "encodedByteLength": len(encoded_bytes),
        "serializedBytes": invalid_utf8_probe_envelope(encoded_bytes),
        "expectedCandidate": {"utf8Probe": scalar},
    } for case_id, scalar_class, encoded_bytes, scalar in control_definitions]
    definitions = [
        ("OUT_OF_RANGE_U_PLUS_110000", "OUT_OF_RANGE_SCALAR_UTF8", "ABOVE_U+10FFFF_MIN", bytes([0xF4, 0x90, 0x80, 0x80])),
        ("OUT_OF_RANGE_F4_MAX_TAIL", "OUT_OF_RANGE_SCALAR_UTF8", "F4_MAX_CONTINUATIONS", bytes([0xF4, 0xBF, 0xBF, 0xBF])),
        ("OUT_OF_RANGE_F5_MIN_TAIL", "OUT_OF_RANGE_SCALAR_UTF8", "F5_MIN_CONTINUATIONS", bytes([0xF5, 0x80, 0x80, 0x80])),
        ("OUT_OF_RANGE_F7_MAX_TAIL", "OUT_OF_RANGE_SCALAR_UTF8", "F7_MAX_CONTINUATIONS", bytes([0xF7, 0xBF, 0xBF, 0xBF])),
        ("OBSOLETE_FIVE_BYTE_MIN", "OBSOLETE_FIVE_SIX_BYTE_PREFIX", "F8_FIVE_BYTE_FORM", bytes([0xF8, 0x88, 0x80, 0x80, 0x80])),
        ("OBSOLETE_FIVE_BYTE_MAX", "OBSOLETE_FIVE_SIX_BYTE_PREFIX", "FB_FIVE_BYTE_FORM", bytes([0xFB, 0xBF, 0xBF, 0xBF, 0xBF])),
        ("OBSOLETE_SIX_BYTE_MIN", "OBSOLETE_FIVE_SIX_BYTE_PREFIX", "FC_SIX_BYTE_FORM", bytes([0xFC, 0x84, 0x80, 0x80, 0x80, 0x80])),
        ("OBSOLETE_SIX_BYTE_MAX", "OBSOLETE_FIVE_SIX_BYTE_PREFIX", "FD_SIX_BYTE_FORM", bytes([0xFD, 0xBF, 0xBF, 0xBF, 0xBF, 0xBF])),
        ("ILLEGAL_FE_LEAD_ONLY", "ILLEGAL_FE_FF_LEAD", "FE_LEAD_ONLY", bytes([0xFE])),
        ("ILLEGAL_FF_LEAD_ONLY", "ILLEGAL_FE_FF_LEAD", "FF_LEAD_ONLY", bytes([0xFF])),
        ("ILLEGAL_FE_WITH_CONTINUATION", "ILLEGAL_FE_FF_LEAD", "FE_WITH_CONTINUATION", bytes([0xFE, 0x80])),
        ("ILLEGAL_FF_WITH_CONTINUATION", "ILLEGAL_FE_FF_LEAD", "FF_WITH_CONTINUATION", bytes([0xFF, 0xBF])),
        ("REDUNDANT_MIN_CONTINUATION_PAIR", "REDUNDANT_CONTINUATION_RUN", "MIN_PAIR", bytes([0x80, 0x80])),
        ("REDUNDANT_MAX_CONTINUATION_PAIR", "REDUNDANT_CONTINUATION_RUN", "MAX_PAIR", bytes([0xBF, 0xBF])),
        ("REDUNDANT_MIXED_TRIPLE", "REDUNDANT_CONTINUATION_RUN", "MIXED_TRIPLE", bytes([0x80, 0xBF, 0x80])),
        ("REDUNDANT_MIXED_QUAD", "REDUNDANT_CONTINUATION_RUN", "MIXED_QUAD", bytes([0xBF, 0x80, 0xBF, 0xBF])),
    ]
    rejections = [{
        "caseId": case_id,
        "family": family,
        "descriptor": descriptor,
        "serializedBytes": invalid_utf8_probe_envelope(injected_bytes),
        "injectedByteLength": len(injected_bytes),
        "expectedError": "INVALID_UTF8",
    } for case_id, family, descriptor, injected_bytes in definitions]
    return controls, rejections


def evaluate_utf8_boundary_corpus() -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    control_inputs, rejection_inputs = build_utf8_boundary_corpus()
    controls = []
    for item in control_inputs:
        candidate, _metrics = parse_transport_envelope_bytes(item["serializedBytes"])
        if canonical_sha256(candidate) != canonical_sha256(item["expectedCandidate"]):
            raise TransportError(f'UTF8_BOUNDARY_CONTROL_DRIFT:{item["caseId"]}')
        controls.append({
            "caseId": item["caseId"],
            "scalarClass": item["scalarClass"],
            "encodedByteLength": item["encodedByteLength"],
            "representationSha256": hashlib.sha256(item["serializedBytes"]).hexdigest(),
            "utf8Bytes": len(item["serializedBytes"]),
            "candidateCommitmentSha256": canonical_sha256(candidate),
            "utf8DecodingSucceeded": True,
            "acceptedAtParser": True,
            "candidateStored": False,
            "mutationEvaluated": False,
        })
    rejections = []
    for item in rejection_inputs:
        observed_error = None
        try:
            parse_transport_envelope_bytes(item["serializedBytes"])
        except TransportError as error:
            observed_error = str(error)
        if observed_error != item["expectedError"]:
            raise TransportError(f'UTF8_BOUNDARY_REJECTION_DRIFT:{item["caseId"]}:{observed_error}')
        rejections.append({
            "caseId": item["caseId"],
            "family": item["family"],
            "descriptor": item["descriptor"],
            "representationSha256": hashlib.sha256(item["serializedBytes"]).hexdigest(),
            "utf8Bytes": len(item["serializedBytes"]),
            "injectedByteLength": item["injectedByteLength"],
            "expectedError": item["expectedError"],
            "observedError": observed_error,
            "utf8DecodingSucceeded": False,
            "jsonParsingAttempted": False,
            "rejectedBeforeCandidate": True,
            "candidateProduced": False,
            "mutationEvaluated": False,
        })
    return controls, rejections


UTF8_BOM_BYTES = bytes([0xEF, 0xBB, 0xBF])


def bom_position_envelope(position: str) -> bytes:
    envelope = b'{"transportMarker":"DRAFT/INACTIVE","candidate":{"bomProbe":0}}'
    if position == "LEADING":
        return UTF8_BOM_BYTES + envelope
    if position == "POST_WHITESPACE":
        return b" \t\r\n" + UTF8_BOM_BYTES + envelope
    if position == "TRAILING":
        return envelope + UTF8_BOM_BYTES
    raise TransportError(f"UTF8_BOM_POSITION_CORPUS_BUILD_FAILED:{position}")


def build_utf8_bom_position_corpus() -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    controls = [{
        "caseId": "BOM_INSIDE_CANDIDATE_STRING",
        "family": "BOM_AS_JSON_STRING_SCALAR",
        "position": "INSIDE_CANDIDATE_STRING",
        "serializedBytes": invalid_utf8_probe_envelope(UTF8_BOM_BYTES),
        "expectedCandidate": {"utf8Probe": "\ufeff"},
    }]
    rejections = [{
        "caseId": case_id,
        "family": "BOM_AT_JSON_DELIMITER",
        "position": position,
        "serializedBytes": bom_position_envelope(position),
        "injectedByteLength": len(UTF8_BOM_BYTES),
        "expectedError": "MALFORMED_JSON",
    } for case_id, position in [
        ("BOM_LEADING_DOCUMENT", "LEADING"),
        ("BOM_AFTER_STANDARD_WHITESPACE", "POST_WHITESPACE"),
        ("BOM_TRAILING_DOCUMENT", "TRAILING"),
    ]]
    return controls, rejections


def evaluate_utf8_bom_position_corpus() -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    control_inputs, rejection_inputs = build_utf8_bom_position_corpus()
    controls = []
    for item in control_inputs:
        candidate, _metrics = parse_transport_envelope_bytes(item["serializedBytes"])
        if canonical_sha256(candidate) != canonical_sha256(item["expectedCandidate"]):
            raise TransportError(f'UTF8_BOM_POSITION_CONTROL_DRIFT:{item["caseId"]}')
        controls.append({
            "caseId": item["caseId"],
            "family": item["family"],
            "position": item["position"],
            "representationSha256": hashlib.sha256(item["serializedBytes"]).hexdigest(),
            "utf8Bytes": len(item["serializedBytes"]),
            "candidateCommitmentSha256": canonical_sha256(candidate),
            "utf8DecodingSucceeded": True,
            "acceptedAtParser": True,
            "candidateStored": False,
            "mutationEvaluated": False,
        })
    rejections = []
    for item in rejection_inputs:
        observed_error = None
        try:
            parse_transport_envelope_bytes(item["serializedBytes"])
        except TransportError as error:
            observed_error = str(error)
        if observed_error != item["expectedError"]:
            raise TransportError(f'UTF8_BOM_POSITION_REJECTION_DRIFT:{item["caseId"]}:{observed_error}')
        rejections.append({
            "caseId": item["caseId"],
            "family": item["family"],
            "position": item["position"],
            "representationSha256": hashlib.sha256(item["serializedBytes"]).hexdigest(),
            "utf8Bytes": len(item["serializedBytes"]),
            "injectedByteLength": item["injectedByteLength"],
            "expectedError": item["expectedError"],
            "observedError": observed_error,
            "utf8DecodingSucceeded": True,
            "jsonParsingAttempted": True,
            "rejectedBeforeCandidate": True,
            "candidateProduced": False,
            "mutationEvaluated": False,
        })
    return controls, rejections


def byte_view_probe_envelope() -> bytes:
    return b'{"transportMarker":"DRAFT/INACTIVE","candidate":{"byteViewProbe":0}}'


def byte_view_control(case_id: str, prefix_bytes: bytes, suffix_bytes: bytes) -> dict[str, Any]:
    payload_bytes = byte_view_probe_envelope()
    backing_bytes = prefix_bytes + payload_bytes + suffix_bytes
    return {
        "caseId": case_id,
        "inputType": "Uint8Array",
        "backingBytes": backing_bytes,
        "serializedBytes": backing_bytes[len(prefix_bytes):len(prefix_bytes) + len(payload_bytes)],
        "byteOffset": len(prefix_bytes),
        "byteLength": len(payload_bytes),
        "excludedPrefixLength": len(prefix_bytes),
        "excludedSuffixLength": len(suffix_bytes),
        "expectedCandidate": {"byteViewProbe": 0},
    }


def build_byte_view_boundary_corpus() -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    controls = [
        byte_view_control("NONZERO_OFFSET_EXCLUDES_INVALID_PREFIX", bytes([0xFF, 0xC0]), b""),
        byte_view_control("BOUNDED_LENGTH_EXCLUDES_INVALID_SUFFIX", b"", bytes([0xC0, 0xFF])),
        byte_view_control("OFFSET_AND_LENGTH_EXCLUDE_BOTH_SENTINELS", bytes([0xFF, 0xC0]), bytes([0xC0, 0xFF])),
    ]
    payload_bytes = byte_view_probe_envelope()
    rejections = [{
        "caseId": case_id,
        "inputType": input_type,
        "runtimeInput": runtime_input,
        "payloadBytes": payload_bytes,
        "expectedError": "INVALID_BYTE_VIEW",
    } for case_id, input_type, runtime_input in [
        ("ARRAY_BUFFER_REJECTED", "ArrayBuffer", bytearray(payload_bytes)),
        ("DATA_VIEW_REJECTED", "DataView", memoryview(payload_bytes)),
        ("STRING_REJECTED", "string", payload_bytes.decode("utf-8")),
        ("NUMERIC_ARRAY_REJECTED", "Array<number>", list(payload_bytes)),
    ]]
    return controls, rejections


def evaluate_byte_view_boundary_corpus() -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    control_inputs, rejection_inputs = build_byte_view_boundary_corpus()
    controls = []
    for item in control_inputs:
        candidate, _metrics = parse_transport_envelope_bytes(item["serializedBytes"])
        if canonical_sha256(candidate) != canonical_sha256(item["expectedCandidate"]):
            raise TransportError(f'BYTE_VIEW_BOUNDARY_CONTROL_DRIFT:{item["caseId"]}')
        controls.append({
            "caseId": item["caseId"],
            "inputType": item["inputType"],
            "backingRepresentationSha256": hashlib.sha256(item["backingBytes"]).hexdigest(),
            "visibleRepresentationSha256": hashlib.sha256(item["serializedBytes"]).hexdigest(),
            "backingByteLength": len(item["backingBytes"]),
            "byteOffset": item["byteOffset"],
            "byteLength": item["byteLength"],
            "excludedPrefixLength": item["excludedPrefixLength"],
            "excludedSuffixLength": item["excludedSuffixLength"],
            "candidateCommitmentSha256": canonical_sha256(candidate),
            "acceptedAtParser": True,
            "candidateStored": False,
            "mutationEvaluated": False,
        })
    rejections = []
    for item in rejection_inputs:
        observed_error = None
        try:
            parse_transport_envelope_bytes(item["runtimeInput"])
        except TransportError as error:
            observed_error = str(error)
        if observed_error != item["expectedError"]:
            raise TransportError(f'BYTE_VIEW_BOUNDARY_REJECTION_DRIFT:{item["caseId"]}:{observed_error}')
        rejections.append({
            "caseId": item["caseId"],
            "inputType": item["inputType"],
            "payloadRepresentationSha256": hashlib.sha256(item["payloadBytes"]).hexdigest(),
            "payloadByteLength": len(item["payloadBytes"]),
            "expectedError": item["expectedError"],
            "observedError": observed_error,
            "utf8DecodingAttempted": False,
            "jsonParsingAttempted": False,
            "rejectedBeforeCandidate": True,
            "candidateProduced": False,
            "mutationEvaluated": False,
        })
    return controls, rejections


def visible_view_truncation_probe_envelope() -> bytes:
    return b'{"transportMarker":"DRAFT/INACTIVE","candidate":{"viewTruncationProbe":0}}'


def visible_view_truncation_case(case_id: str, byte_offset: int, byte_length: int) -> dict[str, Any]:
    backing_bytes = visible_view_truncation_probe_envelope()
    return {
        "caseId": case_id,
        "inputType": "Uint8Array",
        "backingBytes": backing_bytes,
        "serializedBytes": backing_bytes[byte_offset:byte_offset + byte_length],
        "byteOffset": byte_offset,
        "byteLength": byte_length,
        "excludedPrefixLength": byte_offset,
        "excludedSuffixLength": len(backing_bytes) - byte_offset - byte_length,
    }


def build_visible_view_truncation_corpus() -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    backing_length = len(visible_view_truncation_probe_envelope())
    control = visible_view_truncation_case("FULL_VISIBLE_VIEW_ACCEPTED", 0, backing_length)
    control["expectedCandidate"] = {"viewTruncationProbe": 0}
    rejections = []
    for case_id, family, byte_offset, byte_length in [
        ("EMPTY_VIEW_REJECTED", "EMPTY_VIEW", 0, 0),
        ("PREFIX_ONLY_VIEW_REJECTED", "PREFIX_ONLY_VIEW", 0, 24),
        ("SUFFIX_ONLY_VIEW_REJECTED", "SUFFIX_ONLY_VIEW", 1, backing_length - 1),
        ("ONE_BYTE_SHORT_VIEW_REJECTED", "ONE_BYTE_SHORT_VIEW", 0, backing_length - 1),
    ]:
        item = visible_view_truncation_case(case_id, byte_offset, byte_length)
        item.update({"family": family, "expectedError": "MALFORMED_JSON"})
        rejections.append(item)
    return [control], rejections


def evaluate_visible_view_truncation_corpus() -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    control_inputs, rejection_inputs = build_visible_view_truncation_corpus()
    controls = []
    for item in control_inputs:
        candidate, _metrics = parse_transport_envelope_bytes(item["serializedBytes"])
        if canonical_sha256(candidate) != canonical_sha256(item["expectedCandidate"]):
            raise TransportError(f'VISIBLE_VIEW_TRUNCATION_CONTROL_DRIFT:{item["caseId"]}')
        controls.append({
            "caseId": item["caseId"],
            "inputType": item["inputType"],
            "backingRepresentationSha256": hashlib.sha256(item["backingBytes"]).hexdigest(),
            "visibleRepresentationSha256": hashlib.sha256(item["serializedBytes"]).hexdigest(),
            "backingByteLength": len(item["backingBytes"]),
            "byteOffset": item["byteOffset"],
            "byteLength": item["byteLength"],
            "excludedPrefixLength": item["excludedPrefixLength"],
            "excludedSuffixLength": item["excludedSuffixLength"],
            "candidateCommitmentSha256": canonical_sha256(candidate),
            "acceptedAtParser": True,
            "candidateStored": False,
            "mutationEvaluated": False,
        })
    rejections = []
    for item in rejection_inputs:
        observed_error = None
        try:
            parse_transport_envelope_bytes(item["serializedBytes"])
        except TransportError as error:
            observed_error = str(error)
        if observed_error != item["expectedError"]:
            raise TransportError(f'VISIBLE_VIEW_TRUNCATION_REJECTION_DRIFT:{item["caseId"]}:{observed_error}')
        rejections.append({
            "caseId": item["caseId"],
            "family": item["family"],
            "inputType": item["inputType"],
            "backingRepresentationSha256": hashlib.sha256(item["backingBytes"]).hexdigest(),
            "visibleRepresentationSha256": hashlib.sha256(item["serializedBytes"]).hexdigest(),
            "backingByteLength": len(item["backingBytes"]),
            "byteOffset": item["byteOffset"],
            "byteLength": item["byteLength"],
            "excludedPrefixLength": item["excludedPrefixLength"],
            "excludedSuffixLength": item["excludedSuffixLength"],
            "expectedError": item["expectedError"],
            "observedError": observed_error,
            "utf8DecodingSucceeded": True,
            "jsonParsingAttempted": True,
            "rejectedBeforeCandidate": True,
            "candidateProduced": False,
            "mutationEvaluated": False,
        })
    return controls, rejections


def visible_view_alias_mutation_probe_envelope() -> bytes:
    return b'{"transportMarker":"DRAFT/INACTIVE","candidate":{"aliasMutationProbe":0}}'


def visible_view_alias_mutation_case(case_id: str, family: str, mutation_region: str, mutation_descriptor: str, mutation_backing_index: int, replacement_byte: int, expected_after_error: str | None = None) -> dict[str, Any]:
    payload_bytes = visible_view_alias_mutation_probe_envelope()
    prefix_bytes = b"!?"
    suffix_bytes = b"#$"
    backing_bytes = bytearray(prefix_bytes + payload_bytes + suffix_bytes)
    serialized_view = memoryview(backing_bytes)[len(prefix_bytes):len(prefix_bytes) + len(payload_bytes)]
    return {
        "caseId": case_id,
        "family": family,
        "mutationRegion": mutation_region,
        "mutationDescriptor": mutation_descriptor,
        "backingBytes": backing_bytes,
        "serializedView": serialized_view,
        "byteOffset": len(prefix_bytes),
        "byteLength": len(payload_bytes),
        "mutationBackingIndex": mutation_backing_index,
        "mutationViewIndex": mutation_backing_index - len(prefix_bytes) if mutation_region == "INSIDE_VIEW" else None,
        "replacementByte": replacement_byte,
        "expectedAfterError": expected_after_error,
    }


def build_visible_view_alias_mutation_corpus() -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    payload_bytes = visible_view_alias_mutation_probe_envelope()
    prefix_length = 2
    candidate_digit_index = prefix_length + payload_bytes.index(b"0")
    marker_initial_index = prefix_length + payload_bytes.index(b"DRAFT/INACTIVE")
    final_delimiter_index = prefix_length + len(payload_bytes) - 1
    outside_controls = [
        visible_view_alias_mutation_case("OUTSIDE_PREFIX_ALIAS_MUTATION", "OUTSIDE_VIEW_ISOLATION", "OUTSIDE_PREFIX", "EXCLUDED_PREFIX_SENTINEL", 0, 0x7E),
        visible_view_alias_mutation_case("OUTSIDE_SUFFIX_ALIAS_MUTATION", "OUTSIDE_VIEW_ISOLATION", "OUTSIDE_SUFFIX", "EXCLUDED_SUFFIX_SENTINEL", prefix_length + len(payload_bytes), 0x7E),
        visible_view_alias_mutation_case("OUTSIDE_FINAL_SUFFIX_ALIAS_MUTATION", "OUTSIDE_VIEW_ISOLATION", "OUTSIDE_SUFFIX", "EXCLUDED_FINAL_SUFFIX_SENTINEL", prefix_length + len(payload_bytes) + 1, 0x7E),
    ]
    inside_detections = [
        visible_view_alias_mutation_case("INSIDE_CANDIDATE_ALIAS_MUTATION", "INSIDE_VIEW_DETECTION", "INSIDE_VIEW", "CANDIDATE_DIGIT", candidate_digit_index, 0x31),
        visible_view_alias_mutation_case("INSIDE_MARKER_ALIAS_MUTATION", "INSIDE_VIEW_DETECTION", "INSIDE_VIEW", "MARKER_INITIAL", marker_initial_index, 0x58, "INVALID_TRANSPORT_ENVELOPE"),
        visible_view_alias_mutation_case("INSIDE_DELIMITER_ALIAS_MUTATION", "INSIDE_VIEW_DETECTION", "INSIDE_VIEW", "FINAL_DELIMITER", final_delimiter_index, 0x5D, "MALFORMED_JSON"),
    ]
    return outside_controls, inside_detections


def evaluate_visible_view_alias_mutation_case(item: dict[str, Any]) -> dict[str, Any]:
    before_backing_sha256 = hashlib.sha256(item["backingBytes"]).hexdigest()
    before_visible_sha256 = hashlib.sha256(item["serializedView"]).hexdigest()
    before_candidate, _metrics = parse_transport_envelope_bytes(bytes(item["serializedView"]))
    before_candidate_commitment = canonical_sha256(before_candidate)
    item["backingBytes"][item["mutationBackingIndex"]] = item["replacementByte"]
    after_backing_sha256 = hashlib.sha256(item["backingBytes"]).hexdigest()
    after_visible_sha256 = hashlib.sha256(item["serializedView"]).hexdigest()
    after_candidate_commitment = None
    observed_after_error = None
    try:
        after_candidate, _metrics = parse_transport_envelope_bytes(bytes(item["serializedView"]))
        after_candidate_commitment = canonical_sha256(after_candidate)
    except TransportError as error:
        observed_after_error = str(error)
    if observed_after_error != item["expectedAfterError"]:
        raise TransportError(f'VISIBLE_VIEW_ALIAS_MUTATION_ERROR_DRIFT:{item["caseId"]}:{observed_after_error}')
    visible_bytes_changed = before_visible_sha256 != after_visible_sha256
    candidate_commitment_changed = before_candidate_commitment != after_candidate_commitment
    parser_rejected_after = observed_after_error is not None
    if item["mutationRegion"] == "INSIDE_VIEW":
        if not visible_bytes_changed or (not candidate_commitment_changed and not parser_rejected_after):
            raise TransportError(f'VISIBLE_VIEW_ALIAS_MUTATION_UNDETECTED:{item["caseId"]}')
    elif visible_bytes_changed or candidate_commitment_changed or parser_rejected_after:
        raise TransportError(f'VISIBLE_VIEW_ALIAS_MUTATION_ISOLATION_DRIFT:{item["caseId"]}')
    return {
        "caseId": item["caseId"],
        "family": item["family"],
        "inputType": "Uint8Array",
        "mutationRegion": item["mutationRegion"],
        "mutationDescriptor": item["mutationDescriptor"],
        "backingByteLength": len(item["backingBytes"]),
        "byteOffset": item["byteOffset"],
        "byteLength": item["byteLength"],
        "mutationBackingIndex": item["mutationBackingIndex"],
        "mutationViewIndex": item["mutationViewIndex"],
        "beforeBackingRepresentationSha256": before_backing_sha256,
        "afterBackingRepresentationSha256": after_backing_sha256,
        "beforeVisibleRepresentationSha256": before_visible_sha256,
        "afterVisibleRepresentationSha256": after_visible_sha256,
        "beforeCandidateCommitmentSha256": before_candidate_commitment,
        "afterCandidateCommitmentSha256": after_candidate_commitment,
        "expectedAfterError": item["expectedAfterError"],
        "observedAfterError": observed_after_error,
        "visibleBytesChanged": visible_bytes_changed,
        "candidateCommitmentChanged": candidate_commitment_changed,
        "parserRejectedAfter": parser_rejected_after,
        "mutationDetected": item["mutationRegion"] == "INSIDE_VIEW",
        "outsideViewIsolationPreserved": item["mutationRegion"] != "INSIDE_VIEW",
        "runtimeBytesStored": False,
        "runtimeCandidatesStored": False,
        "aliasMutationEvaluated": True,
        "campaignMutationEvaluated": False,
    }


def evaluate_visible_view_alias_mutation_corpus() -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    outside_controls, inside_detections = build_visible_view_alias_mutation_corpus()
    return (
        [evaluate_visible_view_alias_mutation_case(item) for item in outside_controls],
        [evaluate_visible_view_alias_mutation_case(item) for item in inside_detections],
    )


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


def verify_delimiter(root: Path, artifact_path: Path) -> tuple[list[str], dict[str, Any]]:
    errors: list[str] = []
    try:
        artifact = load_json(artifact_path)
        base = load_json(root / BASE_NAME)
        controls, rejections = evaluate_delimiter_corpus(base)
    except (OSError, UnicodeError, json.JSONDecodeError, ValueError) as error:
        return [f"cannot read delimiter evidence: {error}"], {}
    expect(artifact.get("vectorVersion") == 1, "delimiter version drift", errors)
    expect(artifact.get("vectorId") == "iat-promotions-dlc-contention-composition-delimiter-whitespace-v1", "delimiter ID drift", errors)
    expect(artifact.get("status") == {"labels": HOLD_LABELS, "network": "NONE", "programId": None, "deployable": False, "vectorsApplied": False}, "delimiter HOLD drift", errors)
    expected_sources = {
        "baseArtifact": {"path": BASE_NAME, "canonicalSha256": canonical_sha256(base)},
        "boundedParser": {"path": "settlement-contention-composition-transport-limits.mjs", "normalizedTextSha256": normalized_text_sha256(root / "settlement-contention-composition-transport-limits.mjs")},
        "pythonVerifier": {"path": "verify-settlement-contention-transport-limits.py", "normalizedTextSha256": normalized_text_sha256(Path(__file__).resolve())},
        "generator": {"path": "generate-settlement-contention-composition-delimiter-whitespace-audit.mjs", "normalizedTextSha256": normalized_text_sha256(root / "generate-settlement-contention-composition-delimiter-whitespace-audit.mjs")},
    }
    expect(artifact.get("sources") == expected_sources, "delimiter source drift", errors)
    contract = artifact.get("contract", {})
    expect(contract.get("mode") == "STRICT_SINGLE_DOCUMENT_JSON_DELIMITERS", "delimiter mode drift", errors)
    expect(contract.get("delimiterWhitespaceRules") == DELIMITER_WHITESPACE_RULES, "delimiter rules drift", errors)
    expect(contract.get("acceptedControlCount") == 4 and contract.get("rejectionCount") == 16, "delimiter counts drift", errors)
    family_counts = {
        "bomCaseCount": 3,
        "unicodeWhitespaceCaseCount": 7,
        "trailingValueCaseCount": 3,
        "concatenatedDocumentCaseCount": 3,
    }
    for field, value in family_counts.items():
        expect(contract.get(field) == value, f"delimiter {field} drift", errors)
    for field in ["standardWhitespaceAccepted", "bomRejectedBeforeCandidate", "unicodeWhitespaceRejectedBeforeCandidate", "trailingValuesRejectedBeforeCandidate", "concatenatedDocumentsRejectedBeforeCandidate"]:
        expect(contract.get(field) is True, f"delimiter contract {field} drift", errors)
    for field in ["serializedRepresentationsStored", "runtimeCandidatesStored", "usesLocalValidator", "usesRpc", "usesWallet", "preparesTransactions", "signsTransactions", "broadcastsTransactions", "issuesReviewReceipts", "completesReview", "activationAuthorized"]:
        expect(contract.get(field) is False, f"delimiter contract {field} drift", errors)
    expect(contract.get("activationEffect") == "NONE", "delimiter activation effect drift", errors)
    expect(artifact.get("controls") == controls, "delimiter controls drift", errors)
    expect(artifact.get("rejections") == rejections, "delimiter rejections drift", errors)
    summary = artifact.get("summary", {})
    control_commitment = canonical_sha256(controls)
    rejection_commitment = canonical_sha256(rejections)
    combined_commitment = canonical_sha256({"controls": controls, "rejections": rejections})
    expect(summary.get("acceptedControlCount") == "4" and summary.get("rejectionCount") == "16", "delimiter summary counts drift", errors)
    expect(summary.get("allStandardWhitespaceControlsAccepted") is True and summary.get("allAmbiguousDelimitersRejectedBeforeCandidate") is True, "delimiter summary outcome drift", errors)
    expect(summary.get("controlSetCommitmentSha256") == control_commitment, "delimiter control-set drift", errors)
    expect(summary.get("rejectionSetCommitmentSha256") == rejection_commitment, "delimiter rejection-set drift", errors)
    expect(summary.get("combinedReplayCommitmentSha256") == combined_commitment, "delimiter combined replay drift", errors)
    for field in ["serializedRepresentationsStored", "runtimeCandidatesStored", "receiptIssued", "reviewCompleted", "activationAuthorized"]:
        expect(summary.get(field) is False, f"delimiter summary {field} drift", errors)
    expect(summary.get("activationEffect") == "NONE", "delimiter summary activation effect drift", errors)
    return errors, {
        "valid": not errors,
        "errors": errors,
        "acceptedControlCount": len(controls),
        "rejectionCount": len(rejections),
        "controlSetCommitmentSha256": control_commitment,
        "rejectionSetCommitmentSha256": rejection_commitment,
        "combinedReplayCommitmentSha256": combined_commitment,
        "allAmbiguousDelimitersRejectedBeforeCandidate": len(rejections) == 16,
        "serializedRepresentationsStored": False,
        "runtimeCandidatesStored": False,
        "network": "NONE",
        "receiptIssued": False,
        "reviewCompleted": False,
        "activationAuthorized": False,
        "activationEffect": "NONE",
    }


def verify_string(root: Path, artifact_path: Path) -> tuple[list[str], dict[str, Any]]:
    errors: list[str] = []
    try:
        artifact = load_json(artifact_path)
        base = load_json(root / BASE_NAME)
        controls, rejections = evaluate_string_corpus(base)
    except (OSError, UnicodeError, json.JSONDecodeError, ValueError) as error:
        return [f"cannot read string-token evidence: {error}"], {}
    expect(artifact.get("vectorVersion") == 1, "string-token version drift", errors)
    expect(artifact.get("vectorId") == "iat-promotions-dlc-contention-composition-string-tokens-v1", "string-token ID drift", errors)
    expect(artifact.get("status") == {"labels": HOLD_LABELS, "network": "NONE", "programId": None, "deployable": False, "vectorsApplied": False}, "string-token HOLD drift", errors)
    expected_sources = {
        "baseArtifact": {"path": BASE_NAME, "canonicalSha256": canonical_sha256(base)},
        "boundedParser": {"path": "settlement-contention-composition-transport-limits.mjs", "normalizedTextSha256": normalized_text_sha256(root / "settlement-contention-composition-transport-limits.mjs")},
        "pythonVerifier": {"path": "verify-settlement-contention-transport-limits.py", "normalizedTextSha256": normalized_text_sha256(Path(__file__).resolve())},
        "generator": {"path": "generate-settlement-contention-composition-string-token-audit.mjs", "normalizedTextSha256": normalized_text_sha256(root / "generate-settlement-contention-composition-string-token-audit.mjs")},
    }
    expect(artifact.get("sources") == expected_sources, "string-token source drift", errors)
    contract = artifact.get("contract", {})
    expect(contract.get("mode") == "EXACT_REQUIRED_KEY_STRING_TOKENS", "string-token mode drift", errors)
    expect(contract.get("stringTokenRules") == STRING_TOKEN_RULES, "string-token rules drift", errors)
    expect(contract.get("acceptedControlCount") == 3 and contract.get("rejectionCount") == 20, "string-token counts drift", errors)
    family_counts = {
        "rawControlCaseCount": 7,
        "escapedControlRequiredKeyCaseCount": 7,
        "normalizationLookalikeCaseCount": 6,
    }
    for field, value in family_counts.items():
        expect(contract.get(field) == value, f"string-token {field} drift", errors)
    for field in ["escapedCanonicalKeySpellingsAccepted", "rawControlsRejectedBeforeCandidate", "escapedControlsCannotMasqueradeAsRequiredKeys", "normalizationLookalikesCannotMasqueradeAsRequiredKeys"]:
        expect(contract.get(field) is True, f"string-token contract {field} drift", errors)
    for field in ["serializedRepresentationsStored", "runtimeCandidatesStored", "usesLocalValidator", "usesRpc", "usesWallet", "preparesTransactions", "signsTransactions", "broadcastsTransactions", "issuesReviewReceipts", "completesReview", "activationAuthorized"]:
        expect(contract.get(field) is False, f"string-token contract {field} drift", errors)
    expect(contract.get("activationEffect") == "NONE", "string-token activation effect drift", errors)
    expect(artifact.get("controls") == controls, "string-token controls drift", errors)
    expect(artifact.get("rejections") == rejections, "string-token rejections drift", errors)
    summary = artifact.get("summary", {})
    control_commitment = canonical_sha256(controls)
    rejection_commitment = canonical_sha256(rejections)
    combined_commitment = canonical_sha256({"controls": controls, "rejections": rejections})
    expect(summary.get("acceptedControlCount") == "3" and summary.get("rejectionCount") == "20", "string-token summary counts drift", errors)
    expect(summary.get("allCanonicalControlsAccepted") is True and summary.get("allAmbiguousStringTokensRejectedBeforeCandidate") is True, "string-token summary outcome drift", errors)
    expect(summary.get("controlSetCommitmentSha256") == control_commitment, "string-token control-set drift", errors)
    expect(summary.get("rejectionSetCommitmentSha256") == rejection_commitment, "string-token rejection-set drift", errors)
    expect(summary.get("combinedReplayCommitmentSha256") == combined_commitment, "string-token combined replay drift", errors)
    for field in ["serializedRepresentationsStored", "runtimeCandidatesStored", "receiptIssued", "reviewCompleted", "activationAuthorized"]:
        expect(summary.get(field) is False, f"string-token summary {field} drift", errors)
    expect(summary.get("activationEffect") == "NONE", "string-token summary activation effect drift", errors)
    return errors, {
        "valid": not errors,
        "errors": errors,
        "acceptedControlCount": len(controls),
        "rejectionCount": len(rejections),
        "controlSetCommitmentSha256": control_commitment,
        "rejectionSetCommitmentSha256": rejection_commitment,
        "combinedReplayCommitmentSha256": combined_commitment,
        "allAmbiguousStringTokensRejectedBeforeCandidate": len(rejections) == 20,
        "serializedRepresentationsStored": False,
        "runtimeCandidatesStored": False,
        "network": "NONE",
        "receiptIssued": False,
        "reviewCompleted": False,
        "activationAuthorized": False,
        "activationEffect": "NONE",
    }


def verify_key_collision(root: Path, artifact_path: Path) -> tuple[list[str], dict[str, Any]]:
    errors: list[str] = []
    try:
        artifact = load_json(artifact_path)
        base = load_json(root / BASE_NAME)
        controls, rejections = evaluate_key_collision_corpus(base)
    except (OSError, UnicodeError, json.JSONDecodeError, ValueError) as error:
        return [f"cannot read key-collision evidence: {error}"], {}
    expect(artifact.get("vectorVersion") == 1, "key-collision version drift", errors)
    expect(artifact.get("vectorId") == "iat-promotions-dlc-contention-composition-key-collisions-v1", "key-collision ID drift", errors)
    expect(artifact.get("status") == {"labels": HOLD_LABELS, "network": "NONE", "programId": None, "deployable": False, "vectorsApplied": False}, "key-collision HOLD drift", errors)
    expected_sources = {
        "baseArtifact": {"path": BASE_NAME, "canonicalSha256": canonical_sha256(base)},
        "boundedParser": {"path": "settlement-contention-composition-transport-limits.mjs", "normalizedTextSha256": normalized_text_sha256(root / "settlement-contention-composition-transport-limits.mjs")},
        "pythonVerifier": {"path": "verify-settlement-contention-transport-limits.py", "normalizedTextSha256": normalized_text_sha256(Path(__file__).resolve())},
        "generator": {"path": "generate-settlement-contention-composition-key-collision-audit.mjs", "normalizedTextSha256": normalized_text_sha256(root / "generate-settlement-contention-composition-key-collision-audit.mjs")},
    }
    expect(artifact.get("sources") == expected_sources, "key-collision source drift", errors)
    contract = artifact.get("contract", {})
    expect(contract.get("mode") == "DECODED_REQUIRED_KEY_COLLISION_BOUNDARY", "key-collision mode drift", errors)
    expect(contract.get("keyCollisionRules") == KEY_COLLISION_RULES, "key-collision rules drift", errors)
    expect(contract.get("acceptedControlCount") == 3 and contract.get("rejectionCount") == 12, "key-collision counts drift", errors)
    expect(contract.get("decodedDuplicateCaseCount") == 6 and contract.get("normalizationDistinctCaseCount") == 6, "key-collision family counts drift", errors)
    for field in ["escapedCanonicalSpellingsRejectAsDuplicates", "normalizationLookalikesRemainDistinct", "distinctUnexpectedKeysRejectAtEnvelope"]:
        expect(contract.get(field) is True, f"key-collision contract {field} drift", errors)
    for field in ["serializedRepresentationsStored", "runtimeCandidatesStored", "usesLocalValidator", "usesRpc", "usesWallet", "preparesTransactions", "signsTransactions", "broadcastsTransactions", "issuesReviewReceipts", "completesReview", "activationAuthorized"]:
        expect(contract.get(field) is False, f"key-collision contract {field} drift", errors)
    expect(contract.get("activationEffect") == "NONE", "key-collision activation effect drift", errors)
    expect(artifact.get("controls") == controls, "key-collision controls drift", errors)
    expect(artifact.get("rejections") == rejections, "key-collision rejections drift", errors)
    summary = artifact.get("summary", {})
    control_commitment = canonical_sha256(controls)
    rejection_commitment = canonical_sha256(rejections)
    combined_commitment = canonical_sha256({"controls": controls, "rejections": rejections})
    expect(summary.get("acceptedControlCount") == "3" and summary.get("rejectionCount") == "12", "key-collision summary counts drift", errors)
    expect(summary.get("allCanonicalControlsAccepted") is True and summary.get("allCollisionOrDistinctLookalikeCasesRejectedBeforeCandidate") is True, "key-collision summary outcome drift", errors)
    expect(summary.get("controlSetCommitmentSha256") == control_commitment, "key-collision control-set drift", errors)
    expect(summary.get("rejectionSetCommitmentSha256") == rejection_commitment, "key-collision rejection-set drift", errors)
    expect(summary.get("combinedReplayCommitmentSha256") == combined_commitment, "key-collision combined replay drift", errors)
    for field in ["serializedRepresentationsStored", "runtimeCandidatesStored", "receiptIssued", "reviewCompleted", "activationAuthorized"]:
        expect(summary.get(field) is False, f"key-collision summary {field} drift", errors)
    expect(summary.get("activationEffect") == "NONE", "key-collision summary activation effect drift", errors)
    return errors, {
        "valid": not errors,
        "errors": errors,
        "acceptedControlCount": len(controls),
        "rejectionCount": len(rejections),
        "controlSetCommitmentSha256": control_commitment,
        "rejectionSetCommitmentSha256": rejection_commitment,
        "combinedReplayCommitmentSha256": combined_commitment,
        "allCollisionOrDistinctLookalikeCasesRejectedBeforeCandidate": len(rejections) == 12,
        "serializedRepresentationsStored": False,
        "runtimeCandidatesStored": False,
        "network": "NONE",
        "receiptIssued": False,
        "reviewCompleted": False,
        "activationAuthorized": False,
        "activationEffect": "NONE",
    }


def verify_marker_value(root: Path, artifact_path: Path) -> tuple[list[str], dict[str, Any]]:
    errors: list[str] = []
    try:
        artifact = load_json(artifact_path)
        base = load_json(root / BASE_NAME)
        controls, rejections = evaluate_marker_value_corpus(base)
    except (OSError, UnicodeError, json.JSONDecodeError, ValueError) as error:
        return [f"cannot read marker-value evidence: {error}"], {}
    expect(artifact.get("vectorVersion") == 1, "marker-value version drift", errors)
    expect(artifact.get("vectorId") == "iat-promotions-dlc-contention-composition-marker-values-v1", "marker-value ID drift", errors)
    expect(artifact.get("status") == {"labels": HOLD_LABELS, "network": "NONE", "programId": None, "deployable": False, "vectorsApplied": False}, "marker-value HOLD drift", errors)
    expected_sources = {
        "baseArtifact": {"path": BASE_NAME, "canonicalSha256": canonical_sha256(base)},
        "boundedParser": {"path": "settlement-contention-composition-transport-limits.mjs", "normalizedTextSha256": normalized_text_sha256(root / "settlement-contention-composition-transport-limits.mjs")},
        "pythonVerifier": {"path": "verify-settlement-contention-transport-limits.py", "normalizedTextSha256": normalized_text_sha256(Path(__file__).resolve())},
        "generator": {"path": "generate-settlement-contention-composition-marker-value-audit.mjs", "normalizedTextSha256": normalized_text_sha256(root / "generate-settlement-contention-composition-marker-value-audit.mjs")},
    }
    expect(artifact.get("sources") == expected_sources, "marker-value source drift", errors)
    contract = artifact.get("contract", {})
    expect(contract.get("mode") == "EXACT_TRANSPORT_MARKER_VALUE", "marker-value mode drift", errors)
    expect(contract.get("transportMarkerValueRules") == TRANSPORT_MARKER_VALUE_RULES, "marker-value rules drift", errors)
    expect(contract.get("acceptedControlCount") == 4 and contract.get("rejectionCount") == 16, "marker-value counts drift", errors)
    family_counts = {
        "rawControlCaseCount": 3,
        "escapedControlCaseCount": 4,
        "caseVariantCount": 3,
        "normalizationVariantCount": 4,
        "confusableVariantCount": 2,
    }
    for field, value in family_counts.items():
        expect(contract.get(field) == value, f"marker-value {field} drift", errors)
    for field in ["escapedCanonicalValuesAccepted", "rawControlsRejectedBeforeCandidate", "escapedControlsRejectedBeforeCandidate", "caseVariantsRejectedBeforeCandidate", "normalizationVariantsRejectedBeforeCandidate", "confusablesRejectedBeforeCandidate"]:
        expect(contract.get(field) is True, f"marker-value contract {field} drift", errors)
    for field in ["serializedRepresentationsStored", "runtimeCandidatesStored", "usesLocalValidator", "usesRpc", "usesWallet", "preparesTransactions", "signsTransactions", "broadcastsTransactions", "issuesReviewReceipts", "completesReview", "activationAuthorized"]:
        expect(contract.get(field) is False, f"marker-value contract {field} drift", errors)
    expect(contract.get("activationEffect") == "NONE", "marker-value activation effect drift", errors)
    expect(artifact.get("controls") == controls, "marker-value controls drift", errors)
    expect(artifact.get("rejections") == rejections, "marker-value rejections drift", errors)
    summary = artifact.get("summary", {})
    control_commitment = canonical_sha256(controls)
    rejection_commitment = canonical_sha256(rejections)
    combined_commitment = canonical_sha256({"controls": controls, "rejections": rejections})
    expect(summary.get("acceptedControlCount") == "4" and summary.get("rejectionCount") == "16", "marker-value summary counts drift", errors)
    expect(summary.get("allCanonicalControlsAccepted") is True and summary.get("allNoncanonicalMarkerValuesRejectedBeforeCandidate") is True, "marker-value summary outcome drift", errors)
    expect(summary.get("controlSetCommitmentSha256") == control_commitment, "marker-value control-set drift", errors)
    expect(summary.get("rejectionSetCommitmentSha256") == rejection_commitment, "marker-value rejection-set drift", errors)
    expect(summary.get("combinedReplayCommitmentSha256") == combined_commitment, "marker-value combined replay drift", errors)
    for field in ["serializedRepresentationsStored", "runtimeCandidatesStored", "receiptIssued", "reviewCompleted", "activationAuthorized"]:
        expect(summary.get(field) is False, f"marker-value summary {field} drift", errors)
    expect(summary.get("activationEffect") == "NONE", "marker-value summary activation effect drift", errors)
    return errors, {
        "valid": not errors,
        "errors": errors,
        "acceptedControlCount": len(controls),
        "rejectionCount": len(rejections),
        "controlSetCommitmentSha256": control_commitment,
        "rejectionSetCommitmentSha256": rejection_commitment,
        "combinedReplayCommitmentSha256": combined_commitment,
        "allNoncanonicalMarkerValuesRejectedBeforeCandidate": len(rejections) == 16,
        "serializedRepresentationsStored": False,
        "runtimeCandidatesStored": False,
        "network": "NONE",
        "receiptIssued": False,
        "reviewCompleted": False,
        "activationAuthorized": False,
        "activationEffect": "NONE",
    }


def verify_fatal_utf8(root: Path, artifact_path: Path) -> tuple[list[str], dict[str, Any]]:
    errors: list[str] = []
    try:
        artifact = load_json(artifact_path)
        base = load_json(root / BASE_NAME)
        controls, rejections = evaluate_fatal_utf8_corpus(base)
    except (OSError, UnicodeError, json.JSONDecodeError, ValueError) as error:
        return [f"cannot read fatal UTF-8 evidence: {error}"], {}
    expect(artifact.get("vectorVersion") == 1, "fatal UTF-8 version drift", errors)
    expect(artifact.get("vectorId") == "iat-promotions-dlc-contention-composition-fatal-utf8-ingress-v1", "fatal UTF-8 ID drift", errors)
    expect(artifact.get("status") == {"labels": HOLD_LABELS, "network": "NONE", "programId": None, "deployable": False, "vectorsApplied": False}, "fatal UTF-8 HOLD drift", errors)
    expected_sources = {
        "baseArtifact": {"path": BASE_NAME, "canonicalSha256": canonical_sha256(base)},
        "boundedParser": {"path": "settlement-contention-composition-transport-limits.mjs", "normalizedTextSha256": normalized_text_sha256(root / "settlement-contention-composition-transport-limits.mjs")},
        "pythonVerifier": {"path": "verify-settlement-contention-transport-limits.py", "normalizedTextSha256": normalized_text_sha256(Path(__file__).resolve())},
        "generator": {"path": "generate-settlement-contention-composition-fatal-utf8-ingress-audit.mjs", "normalizedTextSha256": normalized_text_sha256(root / "generate-settlement-contention-composition-fatal-utf8-ingress-audit.mjs")},
    }
    expect(artifact.get("sources") == expected_sources, "fatal UTF-8 source drift", errors)
    contract = artifact.get("contract", {})
    expect(contract.get("mode") == "FATAL_UTF8_BYTE_INGRESS", "fatal UTF-8 mode drift", errors)
    expect(contract.get("fatalUtf8IngressRules") == FATAL_UTF8_INGRESS_RULES, "fatal UTF-8 rules drift", errors)
    expect(contract.get("acceptedControlCount") == 4 and contract.get("rejectionCount") == 16, "fatal UTF-8 counts drift", errors)
    for field in ["truncatedCaseCount", "overlongCaseCount", "surrogateEncodedCaseCount", "invalidContinuationCaseCount"]:
        expect(contract.get(field) == 4, f"fatal UTF-8 {field} drift", errors)
    for field in ["validScalarWidthsAccepted", "truncatedRejectedBeforeJson", "overlongRejectedBeforeJson", "surrogateEncodedRejectedBeforeJson", "invalidContinuationsRejectedBeforeJson"]:
        expect(contract.get(field) is True, f"fatal UTF-8 contract {field} drift", errors)
    for field in ["serializedByteSequencesStored", "runtimeCandidatesStored", "usesLocalValidator", "usesRpc", "usesWallet", "preparesTransactions", "signsTransactions", "broadcastsTransactions", "issuesReviewReceipts", "completesReview", "activationAuthorized"]:
        expect(contract.get(field) is False, f"fatal UTF-8 contract {field} drift", errors)
    expect(contract.get("activationEffect") == "NONE", "fatal UTF-8 activation effect drift", errors)
    expect(artifact.get("controls") == controls, "fatal UTF-8 controls drift", errors)
    expect(artifact.get("rejections") == rejections, "fatal UTF-8 rejections drift", errors)
    summary = artifact.get("summary", {})
    control_commitment = canonical_sha256(controls)
    rejection_commitment = canonical_sha256(rejections)
    combined_commitment = canonical_sha256({"controls": controls, "rejections": rejections})
    expect(summary.get("acceptedControlCount") == "4" and summary.get("rejectionCount") == "16", "fatal UTF-8 summary counts drift", errors)
    expect(summary.get("allValidScalarWidthControlsAccepted") is True and summary.get("allMalformedByteSequencesRejectedBeforeJson") is True, "fatal UTF-8 summary outcome drift", errors)
    expect(summary.get("controlSetCommitmentSha256") == control_commitment, "fatal UTF-8 control-set drift", errors)
    expect(summary.get("rejectionSetCommitmentSha256") == rejection_commitment, "fatal UTF-8 rejection-set drift", errors)
    expect(summary.get("combinedReplayCommitmentSha256") == combined_commitment, "fatal UTF-8 combined replay drift", errors)
    for field in ["serializedByteSequencesStored", "runtimeCandidatesStored", "receiptIssued", "reviewCompleted", "activationAuthorized"]:
        expect(summary.get(field) is False, f"fatal UTF-8 summary {field} drift", errors)
    expect(summary.get("activationEffect") == "NONE", "fatal UTF-8 summary activation effect drift", errors)
    return errors, {
        "valid": not errors,
        "errors": errors,
        "acceptedControlCount": len(controls),
        "rejectionCount": len(rejections),
        "controlSetCommitmentSha256": control_commitment,
        "rejectionSetCommitmentSha256": rejection_commitment,
        "combinedReplayCommitmentSha256": combined_commitment,
        "allMalformedByteSequencesRejectedBeforeJson": len(rejections) == 16,
        "serializedByteSequencesStored": False,
        "runtimeCandidatesStored": False,
        "network": "NONE",
        "receiptIssued": False,
        "reviewCompleted": False,
        "activationAuthorized": False,
        "activationEffect": "NONE",
    }


def verify_utf8_boundary(root: Path, artifact_path: Path) -> tuple[list[str], dict[str, Any]]:
    errors: list[str] = []
    try:
        artifact = load_json(artifact_path)
        base = load_json(root / BASE_NAME)
        controls, rejections = evaluate_utf8_boundary_corpus()
    except (OSError, UnicodeError, json.JSONDecodeError, ValueError) as error:
        return [f"cannot read UTF-8 boundary evidence: {error}"], {}
    expect(artifact.get("vectorVersion") == 1, "UTF-8 boundary version drift", errors)
    expect(artifact.get("vectorId") == "iat-promotions-dlc-contention-composition-utf8-boundary-v1", "UTF-8 boundary ID drift", errors)
    expect(artifact.get("status") == {"labels": HOLD_LABELS, "network": "NONE", "programId": None, "deployable": False, "vectorsApplied": False}, "UTF-8 boundary HOLD drift", errors)
    expected_sources = {
        "baseArtifact": {"path": BASE_NAME, "canonicalSha256": canonical_sha256(base)},
        "boundedParser": {"path": "settlement-contention-composition-transport-limits.mjs", "normalizedTextSha256": normalized_text_sha256(root / "settlement-contention-composition-transport-limits.mjs")},
        "pythonVerifier": {"path": "verify-settlement-contention-transport-limits.py", "normalizedTextSha256": normalized_text_sha256(Path(__file__).resolve())},
        "generator": {"path": "generate-settlement-contention-composition-utf8-boundary-audit.mjs", "normalizedTextSha256": normalized_text_sha256(root / "generate-settlement-contention-composition-utf8-boundary-audit.mjs")},
    }
    expect(artifact.get("sources") == expected_sources, "UTF-8 boundary source drift", errors)
    contract = artifact.get("contract", {})
    expect(contract.get("mode") == "UTF8_UPPER_BOUND_AND_ILLEGAL_LEADS", "UTF-8 boundary mode drift", errors)
    expect(contract.get("utf8BoundaryRules") == UTF8_BOUNDARY_RULES, "UTF-8 boundary rules drift", errors)
    expect(contract.get("acceptedControlCount") == 4 and contract.get("rejectionCount") == 16, "UTF-8 boundary counts drift", errors)
    for field in ["outOfRangeCaseCount", "obsoleteLongFormCaseCount", "illegalFeFfLeadCaseCount", "redundantContinuationCaseCount"]:
        expect(contract.get(field) == 4, f"UTF-8 boundary {field} drift", errors)
    for field in ["boundaryScalarsAccepted", "outOfRangeRejectedBeforeJson", "obsoleteLongFormsRejectedBeforeJson", "illegalFeFfLeadsRejectedBeforeJson", "redundantContinuationsRejectedBeforeJson"]:
        expect(contract.get(field) is True, f"UTF-8 boundary contract {field} drift", errors)
    for field in ["serializedByteSequencesStored", "runtimeCandidatesStored", "usesLocalValidator", "usesRpc", "usesWallet", "preparesTransactions", "signsTransactions", "broadcastsTransactions", "issuesReviewReceipts", "completesReview", "activationAuthorized"]:
        expect(contract.get(field) is False, f"UTF-8 boundary contract {field} drift", errors)
    expect(contract.get("activationEffect") == "NONE", "UTF-8 boundary activation effect drift", errors)
    expect(artifact.get("controls") == controls, "UTF-8 boundary controls drift", errors)
    expect(artifact.get("rejections") == rejections, "UTF-8 boundary rejections drift", errors)
    summary = artifact.get("summary", {})
    control_commitment = canonical_sha256(controls)
    rejection_commitment = canonical_sha256(rejections)
    combined_commitment = canonical_sha256({"controls": controls, "rejections": rejections})
    expect(summary.get("acceptedControlCount") == "4" and summary.get("rejectionCount") == "16", "UTF-8 boundary summary counts drift", errors)
    expect(summary.get("allBoundaryControlsAccepted") is True and summary.get("allIllegalByteSequencesRejectedBeforeJson") is True, "UTF-8 boundary summary outcome drift", errors)
    expect(summary.get("controlSetCommitmentSha256") == control_commitment, "UTF-8 boundary control-set drift", errors)
    expect(summary.get("rejectionSetCommitmentSha256") == rejection_commitment, "UTF-8 boundary rejection-set drift", errors)
    expect(summary.get("combinedReplayCommitmentSha256") == combined_commitment, "UTF-8 boundary combined replay drift", errors)
    for field in ["serializedByteSequencesStored", "runtimeCandidatesStored", "receiptIssued", "reviewCompleted", "activationAuthorized"]:
        expect(summary.get(field) is False, f"UTF-8 boundary summary {field} drift", errors)
    expect(summary.get("activationEffect") == "NONE", "UTF-8 boundary summary activation effect drift", errors)
    return errors, {
        "valid": not errors,
        "errors": errors,
        "acceptedControlCount": len(controls),
        "rejectionCount": len(rejections),
        "controlSetCommitmentSha256": control_commitment,
        "rejectionSetCommitmentSha256": rejection_commitment,
        "combinedReplayCommitmentSha256": combined_commitment,
        "allIllegalByteSequencesRejectedBeforeJson": len(rejections) == 16,
        "serializedByteSequencesStored": False,
        "runtimeCandidatesStored": False,
        "network": "NONE",
        "receiptIssued": False,
        "reviewCompleted": False,
        "activationAuthorized": False,
        "activationEffect": "NONE",
    }


def verify_utf8_bom_position(root: Path, artifact_path: Path) -> tuple[list[str], dict[str, Any]]:
    errors: list[str] = []
    try:
        artifact = load_json(artifact_path)
        base = load_json(root / BASE_NAME)
        controls, rejections = evaluate_utf8_bom_position_corpus()
    except (OSError, UnicodeError, json.JSONDecodeError, ValueError) as error:
        return [f"cannot read UTF-8 BOM-position evidence: {error}"], {}
    expect(artifact.get("vectorVersion") == 1, "UTF-8 BOM-position version drift", errors)
    expect(artifact.get("vectorId") == "iat-promotions-dlc-contention-composition-utf8-bom-position-v1", "UTF-8 BOM-position ID drift", errors)
    expect(artifact.get("status") == {"labels": HOLD_LABELS, "network": "NONE", "programId": None, "deployable": False, "vectorsApplied": False}, "UTF-8 BOM-position HOLD drift", errors)
    expected_sources = {
        "baseArtifact": {"path": BASE_NAME, "canonicalSha256": canonical_sha256(base)},
        "boundedParser": {"path": "settlement-contention-composition-transport-limits.mjs", "normalizedTextSha256": normalized_text_sha256(root / "settlement-contention-composition-transport-limits.mjs")},
        "pythonVerifier": {"path": "verify-settlement-contention-transport-limits.py", "normalizedTextSha256": normalized_text_sha256(Path(__file__).resolve())},
        "generator": {"path": "generate-settlement-contention-composition-utf8-bom-position-audit.mjs", "normalizedTextSha256": normalized_text_sha256(root / "generate-settlement-contention-composition-utf8-bom-position-audit.mjs")},
    }
    expect(artifact.get("sources") == expected_sources, "UTF-8 BOM-position source drift", errors)
    contract = artifact.get("contract", {})
    expect(contract.get("mode") == "UTF8_BOM_POSITION_DELIMITER_BOUNDARY", "UTF-8 BOM-position mode drift", errors)
    expect(contract.get("utf8BomPositionRules") == UTF8_BOM_POSITION_RULES, "UTF-8 BOM-position rules drift", errors)
    expect(contract.get("acceptedControlCount") == 1 and contract.get("rejectionCount") == 3, "UTF-8 BOM-position counts drift", errors)
    expect(contract.get("leadingBomCaseCount") == 1 and contract.get("postWhitespaceBomCaseCount") == 1 and contract.get("trailingBomCaseCount") == 1, "UTF-8 BOM-position family counts drift", errors)
    for field in ["bomScalarInsideStringAccepted", "bomBytesPreservedByDecoder", "leadingBomRejectedByDelimiterRule", "postWhitespaceBomRejectedByDelimiterRule", "trailingBomRejectedByDelimiterRule"]:
        expect(contract.get(field) is True, f"UTF-8 BOM-position contract {field} drift", errors)
    for field in ["serializedByteSequencesStored", "runtimeCandidatesStored", "usesLocalValidator", "usesRpc", "usesWallet", "preparesTransactions", "signsTransactions", "broadcastsTransactions", "issuesReviewReceipts", "completesReview", "activationAuthorized"]:
        expect(contract.get(field) is False, f"UTF-8 BOM-position contract {field} drift", errors)
    expect(contract.get("activationEffect") == "NONE", "UTF-8 BOM-position activation effect drift", errors)
    expect(artifact.get("controls") == controls, "UTF-8 BOM-position controls drift", errors)
    expect(artifact.get("rejections") == rejections, "UTF-8 BOM-position rejections drift", errors)
    summary = artifact.get("summary", {})
    control_commitment = canonical_sha256(controls)
    rejection_commitment = canonical_sha256(rejections)
    combined_commitment = canonical_sha256({"controls": controls, "rejections": rejections})
    expect(summary.get("acceptedControlCount") == "1" and summary.get("rejectionCount") == "3", "UTF-8 BOM-position summary counts drift", errors)
    expect(summary.get("bomInsideStringAccepted") is True and summary.get("allDelimiterBomPositionsRejectedAfterDecode") is True, "UTF-8 BOM-position summary outcome drift", errors)
    expect(summary.get("controlSetCommitmentSha256") == control_commitment, "UTF-8 BOM-position control-set drift", errors)
    expect(summary.get("rejectionSetCommitmentSha256") == rejection_commitment, "UTF-8 BOM-position rejection-set drift", errors)
    expect(summary.get("combinedReplayCommitmentSha256") == combined_commitment, "UTF-8 BOM-position combined replay drift", errors)
    for field in ["serializedByteSequencesStored", "runtimeCandidatesStored", "receiptIssued", "reviewCompleted", "activationAuthorized"]:
        expect(summary.get(field) is False, f"UTF-8 BOM-position summary {field} drift", errors)
    expect(summary.get("activationEffect") == "NONE", "UTF-8 BOM-position summary activation effect drift", errors)
    return errors, {
        "valid": not errors,
        "errors": errors,
        "acceptedControlCount": len(controls),
        "rejectionCount": len(rejections),
        "controlSetCommitmentSha256": control_commitment,
        "rejectionSetCommitmentSha256": rejection_commitment,
        "combinedReplayCommitmentSha256": combined_commitment,
        "allDelimiterBomPositionsRejectedAfterDecode": len(rejections) == 3,
        "serializedByteSequencesStored": False,
        "runtimeCandidatesStored": False,
        "network": "NONE",
        "receiptIssued": False,
        "reviewCompleted": False,
        "activationAuthorized": False,
        "activationEffect": "NONE",
    }


def verify_byte_view_boundary(root: Path, artifact_path: Path) -> tuple[list[str], dict[str, Any]]:
    errors: list[str] = []
    try:
        artifact = load_json(artifact_path)
        base = load_json(root / BASE_NAME)
        controls, rejections = evaluate_byte_view_boundary_corpus()
    except (OSError, UnicodeError, json.JSONDecodeError, ValueError) as error:
        return [f"cannot read byte-view boundary evidence: {error}"], {}
    expect(artifact.get("vectorVersion") == 1, "byte-view boundary version drift", errors)
    expect(artifact.get("vectorId") == "iat-promotions-dlc-contention-composition-byte-view-boundary-v1", "byte-view boundary ID drift", errors)
    expect(artifact.get("status") == {"labels": HOLD_LABELS, "network": "NONE", "programId": None, "deployable": False, "vectorsApplied": False}, "byte-view boundary HOLD drift", errors)
    expected_sources = {
        "baseArtifact": {"path": BASE_NAME, "canonicalSha256": canonical_sha256(base)},
        "boundedParser": {"path": "settlement-contention-composition-transport-limits.mjs", "normalizedTextSha256": normalized_text_sha256(root / "settlement-contention-composition-transport-limits.mjs")},
        "pythonVerifier": {"path": "verify-settlement-contention-transport-limits.py", "normalizedTextSha256": normalized_text_sha256(Path(__file__).resolve())},
        "generator": {"path": "generate-settlement-contention-composition-byte-view-boundary-audit.mjs", "normalizedTextSha256": normalized_text_sha256(root / "generate-settlement-contention-composition-byte-view-boundary-audit.mjs")},
    }
    expect(artifact.get("sources") == expected_sources, "byte-view boundary source drift", errors)
    contract = artifact.get("contract", {})
    expect(contract.get("mode") == "UINT8ARRAY_VISIBLE_BYTE_BOUNDARY", "byte-view boundary mode drift", errors)
    expect(contract.get("byteViewBoundaryRules") == BYTE_VIEW_BOUNDARY_RULES, "byte-view boundary rules drift", errors)
    expect(contract.get("acceptedControlCount") == 3 and contract.get("rejectionCount") == 4, "byte-view boundary counts drift", errors)
    for field in ["nonzeroOffsetAccepted", "boundedLengthAccepted", "outsideSentinelsExcluded", "wrongTypesRejectedBeforeDecode"]:
        expect(contract.get(field) is True, f"byte-view boundary contract {field} drift", errors)
    for field in ["backingByteSequencesStored", "visibleByteSequencesStored", "runtimeInputsStored", "runtimeCandidatesStored", "usesLocalValidator", "usesRpc", "usesWallet", "preparesTransactions", "signsTransactions", "broadcastsTransactions", "issuesReviewReceipts", "completesReview", "activationAuthorized"]:
        expect(contract.get(field) is False, f"byte-view boundary contract {field} drift", errors)
    expect(contract.get("activationEffect") == "NONE", "byte-view boundary activation effect drift", errors)
    expect(artifact.get("controls") == controls, "byte-view boundary controls drift", errors)
    expect(artifact.get("rejections") == rejections, "byte-view boundary rejections drift", errors)
    summary = artifact.get("summary", {})
    control_commitment = canonical_sha256(controls)
    rejection_commitment = canonical_sha256(rejections)
    combined_commitment = canonical_sha256({"controls": controls, "rejections": rejections})
    expect(summary.get("acceptedControlCount") == "3" and summary.get("rejectionCount") == "4", "byte-view boundary summary counts drift", errors)
    expect(summary.get("allVisibleByteControlsAccepted") is True and summary.get("allWrongTypesRejectedBeforeDecode") is True, "byte-view boundary summary outcome drift", errors)
    expect(summary.get("controlSetCommitmentSha256") == control_commitment, "byte-view boundary control-set drift", errors)
    expect(summary.get("rejectionSetCommitmentSha256") == rejection_commitment, "byte-view boundary rejection-set drift", errors)
    expect(summary.get("combinedReplayCommitmentSha256") == combined_commitment, "byte-view boundary combined replay drift", errors)
    for field in ["backingByteSequencesStored", "visibleByteSequencesStored", "runtimeInputsStored", "runtimeCandidatesStored", "receiptIssued", "reviewCompleted", "activationAuthorized"]:
        expect(summary.get(field) is False, f"byte-view boundary summary {field} drift", errors)
    expect(summary.get("activationEffect") == "NONE", "byte-view boundary summary activation effect drift", errors)
    return errors, {
        "valid": not errors,
        "errors": errors,
        "acceptedControlCount": len(controls),
        "rejectionCount": len(rejections),
        "controlSetCommitmentSha256": control_commitment,
        "rejectionSetCommitmentSha256": rejection_commitment,
        "combinedReplayCommitmentSha256": combined_commitment,
        "allVisibleByteControlsAccepted": len(controls) == 3,
        "allWrongTypesRejectedBeforeDecode": len(rejections) == 4,
        "backingByteSequencesStored": False,
        "visibleByteSequencesStored": False,
        "runtimeInputsStored": False,
        "runtimeCandidatesStored": False,
        "network": "NONE",
        "receiptIssued": False,
        "reviewCompleted": False,
        "activationAuthorized": False,
        "activationEffect": "NONE",
    }


def verify_visible_view_truncation(root: Path, artifact_path: Path) -> tuple[list[str], dict[str, Any]]:
    errors: list[str] = []
    try:
        artifact = load_json(artifact_path)
        base = load_json(root / BASE_NAME)
        controls, rejections = evaluate_visible_view_truncation_corpus()
    except (OSError, UnicodeError, json.JSONDecodeError, ValueError) as error:
        return [f"cannot read visible-view truncation evidence: {error}"], {}
    expect(artifact.get("vectorVersion") == 1, "visible-view truncation version drift", errors)
    expect(artifact.get("vectorId") == "iat-promotions-dlc-contention-composition-visible-view-truncation-v1", "visible-view truncation ID drift", errors)
    expect(artifact.get("status") == {"labels": HOLD_LABELS, "network": "NONE", "programId": None, "deployable": False, "vectorsApplied": False}, "visible-view truncation HOLD drift", errors)
    expected_sources = {
        "baseArtifact": {"path": BASE_NAME, "canonicalSha256": canonical_sha256(base)},
        "boundedParser": {"path": "settlement-contention-composition-transport-limits.mjs", "normalizedTextSha256": normalized_text_sha256(root / "settlement-contention-composition-transport-limits.mjs")},
        "pythonVerifier": {"path": "verify-settlement-contention-transport-limits.py", "normalizedTextSha256": normalized_text_sha256(Path(__file__).resolve())},
        "generator": {"path": "generate-settlement-contention-composition-visible-view-truncation-audit.mjs", "normalizedTextSha256": normalized_text_sha256(root / "generate-settlement-contention-composition-visible-view-truncation-audit.mjs")},
    }
    expect(artifact.get("sources") == expected_sources, "visible-view truncation source drift", errors)
    contract = artifact.get("contract", {})
    expect(contract.get("mode") == "UINT8ARRAY_VISIBLE_VIEW_TRUNCATION", "visible-view truncation mode drift", errors)
    expect(contract.get("visibleViewTruncationRules") == VISIBLE_VIEW_TRUNCATION_RULES, "visible-view truncation rules drift", errors)
    expect(contract.get("acceptedControlCount") == 1 and contract.get("rejectionCount") == 4, "visible-view truncation counts drift", errors)
    for field in ["fullViewAccepted", "emptyViewRejected", "prefixOnlyViewRejected", "suffixOnlyViewRejected", "oneByteShortViewRejected", "outsideViewBytesExcluded", "truncationsRejectedAfterDecode"]:
        expect(contract.get(field) is True, f"visible-view truncation contract {field} drift", errors)
    for field in ["backingByteSequencesStored", "visibleByteSequencesStored", "runtimeInputsStored", "runtimeCandidatesStored", "usesLocalValidator", "usesRpc", "usesWallet", "preparesTransactions", "signsTransactions", "broadcastsTransactions", "issuesReviewReceipts", "completesReview", "activationAuthorized"]:
        expect(contract.get(field) is False, f"visible-view truncation contract {field} drift", errors)
    expect(contract.get("activationEffect") == "NONE", "visible-view truncation activation effect drift", errors)
    expect(artifact.get("controls") == controls, "visible-view truncation controls drift", errors)
    expect(artifact.get("rejections") == rejections, "visible-view truncation rejections drift", errors)
    summary = artifact.get("summary", {})
    control_commitment = canonical_sha256(controls)
    rejection_commitment = canonical_sha256(rejections)
    combined_commitment = canonical_sha256({"controls": controls, "rejections": rejections})
    expect(summary.get("acceptedControlCount") == "1" and summary.get("rejectionCount") == "4", "visible-view truncation summary counts drift", errors)
    expect(summary.get("fullVisibleViewAccepted") is True and summary.get("allTruncatedVisibleViewsRejectedAfterDecode") is True, "visible-view truncation summary outcome drift", errors)
    expect(summary.get("controlSetCommitmentSha256") == control_commitment, "visible-view truncation control-set drift", errors)
    expect(summary.get("rejectionSetCommitmentSha256") == rejection_commitment, "visible-view truncation rejection-set drift", errors)
    expect(summary.get("combinedReplayCommitmentSha256") == combined_commitment, "visible-view truncation combined replay drift", errors)
    for field in ["backingByteSequencesStored", "visibleByteSequencesStored", "runtimeInputsStored", "runtimeCandidatesStored", "receiptIssued", "reviewCompleted", "activationAuthorized"]:
        expect(summary.get(field) is False, f"visible-view truncation summary {field} drift", errors)
    expect(summary.get("activationEffect") == "NONE", "visible-view truncation summary activation effect drift", errors)
    return errors, {
        "valid": not errors,
        "errors": errors,
        "acceptedControlCount": len(controls),
        "rejectionCount": len(rejections),
        "controlSetCommitmentSha256": control_commitment,
        "rejectionSetCommitmentSha256": rejection_commitment,
        "combinedReplayCommitmentSha256": combined_commitment,
        "fullVisibleViewAccepted": len(controls) == 1,
        "allTruncatedVisibleViewsRejectedAfterDecode": len(rejections) == 4,
        "backingByteSequencesStored": False,
        "visibleByteSequencesStored": False,
        "runtimeInputsStored": False,
        "runtimeCandidatesStored": False,
        "network": "NONE",
        "receiptIssued": False,
        "reviewCompleted": False,
        "activationAuthorized": False,
        "activationEffect": "NONE",
    }


def verify_visible_view_alias_mutation(root: Path, artifact_path: Path) -> tuple[list[str], dict[str, Any]]:
    errors: list[str] = []
    try:
        artifact = load_json(artifact_path)
        base = load_json(root / BASE_NAME)
        outside_controls, inside_detections = evaluate_visible_view_alias_mutation_corpus()
    except (OSError, UnicodeError, json.JSONDecodeError, ValueError) as error:
        return [f"cannot read visible-view alias-mutation evidence: {error}"], {}
    expect(artifact.get("vectorVersion") == 1, "visible-view alias-mutation version drift", errors)
    expect(artifact.get("vectorId") == "iat-promotions-dlc-contention-composition-visible-view-alias-mutation-v1", "visible-view alias-mutation ID drift", errors)
    expect(artifact.get("status") == {"labels": HOLD_LABELS, "network": "NONE", "programId": None, "deployable": False, "vectorsApplied": False}, "visible-view alias-mutation HOLD drift", errors)
    expected_sources = {
        "baseArtifact": {"path": BASE_NAME, "canonicalSha256": canonical_sha256(base)},
        "boundedParser": {"path": "settlement-contention-composition-transport-limits.mjs", "normalizedTextSha256": normalized_text_sha256(root / "settlement-contention-composition-transport-limits.mjs")},
        "pythonVerifier": {"path": "verify-settlement-contention-transport-limits.py", "normalizedTextSha256": normalized_text_sha256(Path(__file__).resolve())},
        "generator": {"path": "generate-settlement-contention-composition-visible-view-alias-mutation-audit.mjs", "normalizedTextSha256": normalized_text_sha256(root / "generate-settlement-contention-composition-visible-view-alias-mutation-audit.mjs")},
    }
    expect(artifact.get("sources") == expected_sources, "visible-view alias-mutation source drift", errors)
    contract = artifact.get("contract", {})
    expect(contract.get("mode") == "UINT8ARRAY_SHARED_BACKING_ALIAS_MUTATION", "visible-view alias-mutation mode drift", errors)
    expect(contract.get("visibleViewAliasMutationRules") == VISIBLE_VIEW_ALIAS_MUTATION_RULES, "visible-view alias-mutation rules drift", errors)
    expect(contract.get("outsideControlCount") == 3 and contract.get("insideDetectionCount") == 3, "visible-view alias-mutation counts drift", errors)
    for field in ["outsidePrefixIsolationProven", "outsideSuffixIsolationProven", "insideCandidateChangeDetected", "insideMarkerChangeRejected", "insideDelimiterChangeRejected", "sharedBackingAliasesExercised"]:
        expect(contract.get(field) is True, f"visible-view alias-mutation contract {field} drift", errors)
    for field in ["backingByteSequencesStored", "visibleByteSequencesStored", "runtimeInputsStored", "runtimeCandidatesStored", "usesLocalValidator", "usesRpc", "usesWallet", "preparesTransactions", "signsTransactions", "broadcastsTransactions", "issuesReviewReceipts", "completesReview", "activationAuthorized"]:
        expect(contract.get(field) is False, f"visible-view alias-mutation contract {field} drift", errors)
    expect(contract.get("activationEffect") == "NONE", "visible-view alias-mutation activation effect drift", errors)
    expect(artifact.get("outsideControls") == outside_controls, "visible-view alias-mutation outside controls drift", errors)
    expect(artifact.get("insideDetections") == inside_detections, "visible-view alias-mutation inside detections drift", errors)
    summary = artifact.get("summary", {})
    outside_commitment = canonical_sha256(outside_controls)
    inside_commitment = canonical_sha256(inside_detections)
    combined_commitment = canonical_sha256({"outsideControls": outside_controls, "insideDetections": inside_detections})
    expect(summary.get("outsideControlCount") == "3" and summary.get("insideDetectionCount") == "3", "visible-view alias-mutation summary counts drift", errors)
    expect(summary.get("allOutsideMutationsIsolated") is True and summary.get("allInsideMutationsDetected") is True, "visible-view alias-mutation summary outcome drift", errors)
    expect(summary.get("outsideControlSetCommitmentSha256") == outside_commitment, "visible-view alias-mutation outside-set drift", errors)
    expect(summary.get("insideDetectionSetCommitmentSha256") == inside_commitment, "visible-view alias-mutation inside-set drift", errors)
    expect(summary.get("combinedReplayCommitmentSha256") == combined_commitment, "visible-view alias-mutation combined replay drift", errors)
    for field in ["backingByteSequencesStored", "visibleByteSequencesStored", "runtimeInputsStored", "runtimeCandidatesStored", "receiptIssued", "reviewCompleted", "activationAuthorized"]:
        expect(summary.get(field) is False, f"visible-view alias-mutation summary {field} drift", errors)
    expect(summary.get("activationEffect") == "NONE", "visible-view alias-mutation summary activation effect drift", errors)
    return errors, {
        "valid": not errors,
        "errors": errors,
        "outsideControlCount": len(outside_controls),
        "insideDetectionCount": len(inside_detections),
        "outsideControlSetCommitmentSha256": outside_commitment,
        "insideDetectionSetCommitmentSha256": inside_commitment,
        "combinedReplayCommitmentSha256": combined_commitment,
        "allOutsideMutationsIsolated": len(outside_controls) == 3,
        "allInsideMutationsDetected": len(inside_detections) == 3,
        "backingByteSequencesStored": False,
        "visibleByteSequencesStored": False,
        "runtimeInputsStored": False,
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
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument("--verify-numeric-token-audit", action="store_true")
    modes.add_argument("--verify-delimiter-whitespace-audit", action="store_true")
    modes.add_argument("--verify-string-token-audit", action="store_true")
    modes.add_argument("--verify-key-collision-audit", action="store_true")
    modes.add_argument("--verify-marker-value-audit", action="store_true")
    modes.add_argument("--verify-fatal-utf8-ingress-audit", action="store_true")
    modes.add_argument("--verify-utf8-boundary-audit", action="store_true")
    modes.add_argument("--verify-utf8-bom-position-audit", action="store_true")
    modes.add_argument("--verify-byte-view-boundary-audit", action="store_true")
    modes.add_argument("--verify-visible-view-truncation-audit", action="store_true")
    modes.add_argument("--verify-visible-view-alias-mutation-audit", action="store_true")
    parser.add_argument("--json", action="store_true", dest="emit_json")
    arguments = parser.parse_args()
    root = arguments.root.resolve()
    if arguments.verify_numeric_token_audit:
        artifact_name = NUMERIC_ARTIFACT_NAME
    elif arguments.verify_delimiter_whitespace_audit:
        artifact_name = DELIMITER_ARTIFACT_NAME
    elif arguments.verify_string_token_audit:
        artifact_name = STRING_ARTIFACT_NAME
    elif arguments.verify_key_collision_audit:
        artifact_name = KEY_COLLISION_ARTIFACT_NAME
    elif arguments.verify_marker_value_audit:
        artifact_name = MARKER_VALUE_ARTIFACT_NAME
    elif arguments.verify_fatal_utf8_ingress_audit:
        artifact_name = FATAL_UTF8_ARTIFACT_NAME
    elif arguments.verify_utf8_boundary_audit:
        artifact_name = UTF8_BOUNDARY_ARTIFACT_NAME
    elif arguments.verify_utf8_bom_position_audit:
        artifact_name = UTF8_BOM_POSITION_ARTIFACT_NAME
    elif arguments.verify_byte_view_boundary_audit:
        artifact_name = BYTE_VIEW_BOUNDARY_ARTIFACT_NAME
    elif arguments.verify_visible_view_truncation_audit:
        artifact_name = VISIBLE_VIEW_TRUNCATION_ARTIFACT_NAME
    elif arguments.verify_visible_view_alias_mutation_audit:
        artifact_name = VISIBLE_VIEW_ALIAS_MUTATION_ARTIFACT_NAME
    else:
        artifact_name = ARTIFACT_NAME
    artifact = arguments.artifact.resolve() if arguments.artifact else root / artifact_name
    if arguments.verify_numeric_token_audit:
        errors, report = verify_numeric(root, artifact)
    elif arguments.verify_delimiter_whitespace_audit:
        errors, report = verify_delimiter(root, artifact)
    elif arguments.verify_string_token_audit:
        errors, report = verify_string(root, artifact)
    elif arguments.verify_key_collision_audit:
        errors, report = verify_key_collision(root, artifact)
    elif arguments.verify_marker_value_audit:
        errors, report = verify_marker_value(root, artifact)
    elif arguments.verify_fatal_utf8_ingress_audit:
        errors, report = verify_fatal_utf8(root, artifact)
    elif arguments.verify_utf8_boundary_audit:
        errors, report = verify_utf8_boundary(root, artifact)
    elif arguments.verify_utf8_bom_position_audit:
        errors, report = verify_utf8_bom_position(root, artifact)
    elif arguments.verify_byte_view_boundary_audit:
        errors, report = verify_byte_view_boundary(root, artifact)
    elif arguments.verify_visible_view_truncation_audit:
        errors, report = verify_visible_view_truncation(root, artifact)
    elif arguments.verify_visible_view_alias_mutation_audit:
        errors, report = verify_visible_view_alias_mutation(root, artifact)
    else:
        errors, report = verify(root, artifact)
    if arguments.emit_json:
        print(json.dumps(report, separators=(",", ":")))
    elif errors:
        print("\n".join(errors), file=sys.stderr)
    else:
        label = "numeric-token" if arguments.verify_numeric_token_audit else ("delimiter-whitespace" if arguments.verify_delimiter_whitespace_audit else ("string-token" if arguments.verify_string_token_audit else ("key-collision" if arguments.verify_key_collision_audit else ("marker-value" if arguments.verify_marker_value_audit else ("fatal-utf8-ingress" if arguments.verify_fatal_utf8_ingress_audit else ("utf8-boundary" if arguments.verify_utf8_boundary_audit else ("utf8-bom-position" if arguments.verify_utf8_bom_position_audit else ("byte-view-boundary" if arguments.verify_byte_view_boundary_audit else ("visible-view-truncation" if arguments.verify_visible_view_truncation_audit else ("visible-view-alias-mutation" if arguments.verify_visible_view_alias_mutation_audit else "transport-limit"))))))))))
        print(f"Independent {label} replay passed: {report['combinedReplayCommitmentSha256']}")
    return 2 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
