#!/usr/bin/env python3
"""Independent rejection-only positive campaign-vector intake verifier.

DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE

Python standard library only. This verifier reads public local files and can
neither create keys/signatures nor issue review or activation authority.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import re
import sys
from copy import deepcopy
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent
DEFAULT_VECTORS = ROOT / "positive-campaign-vector-intake-vectors.v1.json"
DEFAULT_DIFFERENTIAL_VECTORS = (
    ROOT / "positive-campaign-vector-intake-differential-vectors.v1.json"
)
DEFAULT_FUZZ_VECTORS = ROOT / "positive-campaign-vector-intake-fuzz-vectors.v1.json"
DEFAULT_MINIMAL_COUNTEREXAMPLES = (
    ROOT / "positive-campaign-vector-intake-minimal-counterexamples.v1.json"
)
DEFAULT_REPRESENTATION_AUDIT = (
    ROOT / "positive-campaign-vector-representation-audit.v1.json"
)
SCHEMA_PATH = ROOT / "positive-campaign-vector-intake.schema.v1.json"
CAMPAIGN_VECTORS_PATH = ROOT / "campaign-envelope-verification-vectors.v1.json"
EVALUATOR_PATH = ROOT / "positive-campaign-vector-intake.mjs"
FUZZ_GENERATOR_PATH = ROOT / "generate-positive-campaign-vector-intake-fuzz-vectors.mjs"
MINIMAL_GENERATOR_PATH = (
    ROOT / "generate-positive-campaign-vector-intake-minimal-counterexamples.mjs"
)
REPRESENTATION_GENERATOR_PATH = (
    ROOT / "generate-positive-campaign-vector-representation-audit.mjs"
)
HOLD_LABELS = ["DRAFT", "INACTIVE", "NOT PART OF GENESIS", "NOT DEPLOYED", "NO CLAIM ROUTE"]
TARGET_KEYS = [
    "targetVersion",
    "campaignId",
    "keyId",
    "publicKeyHex",
    "sourceArtifactSha256",
    "reviewReceiptSha256",
    "positiveVectorAvailable",
    "positiveVectorReviewCompleted",
]
GATE_ORDER = [
    "CLOSED_SCHEMA",
    "EXPECTED_TARGET",
    "PRIVATE_MATERIAL_EXCLUSION",
    "EXTERNAL_PROVENANCE",
    "CANONICAL_MESSAGE_BINDING",
    "CRYPTOGRAPHIC_SIGNATURE",
    "INDEPENDENT_VECTOR_REVIEW",
    "NON_AUTHORITY",
]
FUZZ_SEED = 0x49544154
FUZZ_CASE_COUNT = 256
REPRESENTATION_MERKLE_LEAF_DOMAIN = (
    "iat-promotions-dlc-representation-audit-leaf-v1"
)
REPRESENTATION_MERKLE_NODE_DOMAIN = (
    "iat-promotions-dlc-representation-audit-node-v1"
)
FUZZ_FAMILIES = [
    "CLOSED_SCHEMA",
    "EXPECTED_TARGET",
    "PRIVATE_MATERIAL_EXCLUSION",
    "EXTERNAL_PROVENANCE",
    "CANONICAL_MESSAGE_BINDING",
    "PUBLIC_KEY_BINDING",
    "INDEPENDENT_VECTOR_REVIEW",
    "NON_AUTHORITY",
    "CRYPTOGRAPHIC_SIGNATURE",
    "CRYPTOGRAPHIC_GUARD",
]
FUZZ_DERIVATION_DOMAIN = "iat-promotions-dlc-intake-fuzz-v1"
FUZZ_LEAF_DOMAIN = "iat-promotions-dlc-intake-fuzz-leaf-v1"
FUZZ_NODE_DOMAIN = "iat-promotions-dlc-intake-fuzz-node-v1"
MINIMAL_PRIMARY_GATES = {
    "CLOSED_SCHEMA": "CLOSED_SCHEMA",
    "EXPECTED_TARGET": "EXPECTED_TARGET",
    "PRIVATE_MATERIAL_EXCLUSION": "PRIVATE_MATERIAL_EXCLUSION",
    "EXTERNAL_PROVENANCE": "EXTERNAL_PROVENANCE",
    "CANONICAL_MESSAGE_BINDING": "CANONICAL_MESSAGE_BINDING",
    "PUBLIC_KEY_BINDING": "CANONICAL_MESSAGE_BINDING",
    "INDEPENDENT_VECTOR_REVIEW": "INDEPENDENT_VECTOR_REVIEW",
    "NON_AUTHORITY": "NON_AUTHORITY",
    "CRYPTOGRAPHIC_SIGNATURE": "CRYPTOGRAPHIC_SIGNATURE",
    "CRYPTOGRAPHIC_GUARD": "CRYPTOGRAPHIC_SIGNATURE",
}
PAYLOAD_KEYS = [
    "campaignId",
    "domain",
    "expiresAt",
    "issuedAt",
    "nodeId",
    "nonce",
    "purpose",
    "wallet",
    "walletProofDigest",
    "walletProofVerifiedAt",
    "xIdentityCommitment",
]
SIGNED_ENVELOPE_KEYS = [
    "attestationId",
    "keyId",
    "payload",
    "scheme",
    "version",
    "signatureBase64",
]
UNSIGNED_ENVELOPE_KEYS = SIGNED_ENVELOPE_KEYS[:-1]
HEX_32 = re.compile(r"^[0-9a-f]{64}$")
BASE58_WALLET = re.compile(r"^[1-9A-HJ-NP-Za-km-z]{32,44}$")
FORBIDDEN_PRIVATE_FIELD = re.compile(
    r"private|secret|seed|mnemonic|oauth|accessToken", re.IGNORECASE
)
SAFE_INTEGER_MAXIMUM = (1 << 53) - 1
ATTESTATION_DOMAIN = "iat-promotions-dlc-attestation-v0"


# Pure-Python Ed25519 verification parameters and group operations. There is
# deliberately no key-generation or signing path.
FIELD_Q = (1 << 255) - 19
GROUP_L = (1 << 252) + 27742317777372353535851937790883648493
CURVE_D = (-121665 * pow(121666, FIELD_Q - 2, FIELD_Q)) % FIELD_Q
SQRT_MINUS_ONE = pow(2, (FIELD_Q - 1) // 4, FIELD_Q)
IDENTITY = (0, 1)


class VerificationFailure(Exception):
    """Fixed semantic rejection code."""


class CliUsageError(ValueError):
    """Raised when CLI arguments do not select offline vector verification."""


class OfflineArgumentParser(argparse.ArgumentParser):
    def error(self, message: str) -> None:
        raise CliUsageError(message)


def reject_nonstandard_number(value: str) -> None:
    raise ValueError(f"non-standard JSON number: {value}")


def read_json(path: Path) -> Any:
    return json.loads(
        path.read_text(encoding="utf-8"),
        parse_constant=reject_nonstandard_number,
    )


def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def canonical_sha256(value: Any) -> str:
    return hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()


def normalized_text_sha256(path: Path) -> str:
    text = path.read_text(encoding="utf-8").replace("\r\n", "\n").replace("\r", "\n")
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def instance_type(value: Any) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, list):
        return "array"
    if isinstance(value, int):
        return "integer"
    if isinstance(value, float):
        return "number"
    if isinstance(value, str):
        return "string"
    if isinstance(value, dict):
        return "object"
    return type(value).__name__


def pointer_segment(value: str) -> str:
    return value.replace("~", "~0").replace("/", "~1")


def resolve_local_ref(root_schema: dict[str, Any], reference: str) -> dict[str, Any]:
    if not isinstance(reference, str) or not reference.startswith("#/"):
        raise ValueError("ONLY_LOCAL_SCHEMA_REFS_SUPPORTED")
    current: Any = root_schema
    for raw_segment in reference[2:].split("/"):
        segment = raw_segment.replace("~1", "/").replace("~0", "~")
        if not isinstance(current, dict) or segment not in current:
            raise ValueError("SCHEMA_REF_NOT_FOUND")
        current = current[segment]
    return current


def validate_schema_subset(schema: dict[str, Any], instance: Any) -> list[dict[str, str]]:
    errors: list[dict[str, str]] = []

    def add(instance_path: str, schema_path: str, keyword: str, message: str) -> None:
        errors.append(
            {
                "instancePath": instance_path,
                "schemaPath": schema_path,
                "keyword": keyword,
                "message": message,
            }
        )

    def visit(node: dict[str, Any], value: Any, instance_path: str, schema_path: str) -> None:
        if "$ref" in node:
            visit(resolve_local_ref(schema, node["$ref"]), value, instance_path, node["$ref"])
            return
        if "const" in node and value != node["const"]:
            add(instance_path, f"{schema_path}/const", "const", "must equal the fixed value")
            return
        if "enum" in node and not any(value == candidate for candidate in node["enum"]):
            add(instance_path, f"{schema_path}/enum", "enum", "must equal one allowed value")
            return
        if "type" in node:
            allowed = node["type"] if isinstance(node["type"], list) else [node["type"]]
            actual = instance_type(value)
            if not any(kind == actual or (kind == "number" and actual == "integer") for kind in allowed):
                add(instance_path, f"{schema_path}/type", "type", f"must be {' or '.join(allowed)}")
                return
        if isinstance(value, str):
            if "pattern" in node and re.search(node["pattern"], value) is None:
                add(instance_path, f"{schema_path}/pattern", "pattern", "must match the fixed pattern")
            if "minLength" in node and len(value) < node["minLength"]:
                add(instance_path, f"{schema_path}/minLength", "minLength", "is too short")
            if "maxLength" in node and len(value) > node["maxLength"]:
                add(instance_path, f"{schema_path}/maxLength", "maxLength", "is too long")
        if isinstance(value, list):
            if "minItems" in node and len(value) < node["minItems"]:
                add(instance_path, f"{schema_path}/minItems", "minItems", "has too few items")
            if "maxItems" in node and len(value) > node["maxItems"]:
                add(instance_path, f"{schema_path}/maxItems", "maxItems", "has too many items")
            if node.get("uniqueItems") is True:
                serialized = [json.dumps(item, separators=(",", ":")) for item in value]
                if len(set(serialized)) != len(serialized):
                    add(instance_path, f"{schema_path}/uniqueItems", "uniqueItems", "has duplicate items")
            items = node.get("items")
            if isinstance(items, list):
                for index, item in enumerate(value):
                    if index < len(items):
                        visit(items[index], item, f"{instance_path}/{index}", f"{schema_path}/items/{index}")
                    elif node.get("additionalItems") is False:
                        add(
                            f"{instance_path}/{index}",
                            f"{schema_path}/additionalItems",
                            "additionalItems",
                            "is not allowed",
                        )
            elif isinstance(items, dict):
                for index, item in enumerate(value):
                    visit(items, item, f"{instance_path}/{index}", f"{schema_path}/items")
        if isinstance(value, dict):
            for required in node.get("required", []):
                if required not in value:
                    add(instance_path, f"{schema_path}/required", "required", f"missing {required}")
            for key, child in value.items():
                if key in node.get("properties", {}):
                    visit(
                        node["properties"][key],
                        child,
                        f"{instance_path}/{pointer_segment(key)}",
                        f"{schema_path}/properties/{key}",
                    )
                elif node.get("additionalProperties") is False:
                    add(
                        f"{instance_path}/{pointer_segment(key)}",
                        f"{schema_path}/additionalProperties",
                        "additionalProperties",
                        "is not allowed",
                    )

    visit(schema, instance, "", "#")
    return errors


def recover_x(y: int, sign_bit: int) -> int:
    if y >= FIELD_Q:
        raise VerificationFailure("INVALID_ED25519_POINT")
    xx = ((y * y - 1) * pow(CURVE_D * y * y + 1, FIELD_Q - 2, FIELD_Q)) % FIELD_Q
    x = pow(xx, (FIELD_Q + 3) // 8, FIELD_Q)
    if (x * x - xx) % FIELD_Q != 0:
        x = (x * SQRT_MINUS_ONE) % FIELD_Q
    if (x * x - xx) % FIELD_Q != 0:
        raise VerificationFailure("INVALID_ED25519_POINT")
    if (x & 1) != sign_bit:
        x = FIELD_Q - x
    return x


def decode_point(encoded: bytes) -> tuple[int, int]:
    if len(encoded) != 32:
        raise VerificationFailure("INVALID_ED25519_POINT")
    encoded_integer = int.from_bytes(encoded, "little")
    sign_bit = encoded_integer >> 255
    y = encoded_integer & ((1 << 255) - 1)
    x = recover_x(y, sign_bit)
    if (-x * x + y * y - 1 - CURVE_D * x * x * y * y) % FIELD_Q != 0:
        raise VerificationFailure("INVALID_ED25519_POINT")
    return x, y


def add_points(left: tuple[int, int], right: tuple[int, int]) -> tuple[int, int]:
    x1, y1 = left
    x2, y2 = right
    product = (CURVE_D * x1 * x2 * y1 * y2) % FIELD_Q
    x3 = ((x1 * y2 + y1 * x2) * pow(1 + product, FIELD_Q - 2, FIELD_Q)) % FIELD_Q
    y3 = ((y1 * y2 + x1 * x2) * pow(1 - product, FIELD_Q - 2, FIELD_Q)) % FIELD_Q
    return x3, y3


def scalar_multiply(point: tuple[int, int], scalar: int) -> tuple[int, int]:
    result = IDENTITY
    addend = point
    while scalar > 0:
        if scalar & 1:
            result = add_points(result, addend)
        addend = add_points(addend, addend)
        scalar >>= 1
    return result


BASE_Y = (4 * pow(5, FIELD_Q - 2, FIELD_Q)) % FIELD_Q
BASE_POINT = (recover_x(BASE_Y, 0), BASE_Y)


def verify_ed25519(public_key: bytes, message: bytes, signature: bytes) -> bool:
    if len(public_key) != 32 or len(signature) != 64:
        return False
    try:
        public_point = decode_point(public_key)
        r_point = decode_point(signature[:32])
    except VerificationFailure:
        return False
    scalar_s = int.from_bytes(signature[32:], "little")
    if scalar_s >= GROUP_L:
        return False
    if scalar_multiply(public_point, GROUP_L) != IDENTITY:
        return False
    challenge = int.from_bytes(
        hashlib.sha512(signature[:32] + public_key + message).digest(), "little"
    ) % GROUP_L
    return scalar_multiply(BASE_POINT, scalar_s) == add_points(
        r_point, scalar_multiply(public_point, challenge)
    )


def exact_keys(value: Any, expected: list[str], code: str) -> None:
    if not isinstance(value, dict) or sorted(value) != sorted(expected):
        raise VerificationFailure(code)


def safe_timestamp(value: Any, code: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < 0 or value > SAFE_INTEGER_MAXIMUM:
        raise VerificationFailure(code)
    return value


def required_string(value: Any, code: str, maximum: int = 256) -> str:
    if not isinstance(value, str) or not value or len(value) > maximum:
        raise VerificationFailure(code)
    return value


def required_hash(value: Any, code: str) -> str:
    if not isinstance(value, str) or HEX_32.fullmatch(value) is None:
        raise VerificationFailure(code)
    return value


def decode_base64(value: Any) -> bytes:
    if not isinstance(value, str) or not value or len(value) > 256:
        raise VerificationFailure("INVALID_SIGNATURE_ENCODING")
    try:
        decoded = base64.b64decode(value, validate=True)
    except (ValueError, base64.binascii.Error) as error:
        raise VerificationFailure("INVALID_SIGNATURE_ENCODING") from error
    if not decoded or base64.b64encode(decoded).decode("ascii") != value:
        raise VerificationFailure("INVALID_SIGNATURE_ENCODING")
    return decoded


def normalize_payload(payload: Any) -> dict[str, Any]:
    exact_keys(payload, PAYLOAD_KEYS, "ATTESTATION_PAYLOAD_FIELDS_MISMATCH")
    if payload["domain"] != ATTESTATION_DOMAIN:
        raise VerificationFailure("ATTESTATION_DOMAIN_MISMATCH")
    if payload["purpose"] not in {"NOMINATE", "CANCEL", "SETTLE"}:
        raise VerificationFailure("INVALID_ATTESTATION_PURPOSE")
    issued_at = safe_timestamp(payload["issuedAt"], "INVALID_ATTESTATION_ISSUED_AT")
    expires_at = safe_timestamp(payload["expiresAt"], "INVALID_ATTESTATION_EXPIRY")
    proof_at = safe_timestamp(payload["walletProofVerifiedAt"], "INVALID_WALLET_PROOF_TIMESTAMP")
    if expires_at <= issued_at:
        raise VerificationFailure("ATTESTATION_EXPIRY_NOT_AFTER_ISSUE")
    if expires_at - issued_at > 300:
        raise VerificationFailure("ATTESTATION_LIFETIME_TOO_LONG")
    if proof_at > issued_at:
        raise VerificationFailure("WALLET_PROOF_AFTER_ATTESTATION")
    if issued_at - proof_at > 600:
        raise VerificationFailure("WALLET_PROOF_TOO_OLD")
    wallet = payload["wallet"]
    if not isinstance(wallet, str) or BASE58_WALLET.fullmatch(wallet) is None:
        raise VerificationFailure("INVALID_SOLANA_WALLET")
    return {
        "campaignId": required_string(payload["campaignId"], "INVALID_CAMPAIGN_ID", 128),
        "domain": ATTESTATION_DOMAIN,
        "expiresAt": expires_at,
        "issuedAt": issued_at,
        "nodeId": required_string(payload["nodeId"], "INVALID_NODE_ID", 128),
        "nonce": required_string(payload["nonce"], "INVALID_ATTESTATION_NONCE", 128),
        "purpose": payload["purpose"],
        "wallet": wallet,
        "walletProofDigest": required_hash(payload["walletProofDigest"], "INVALID_WALLET_PROOF_DIGEST"),
        "walletProofVerifiedAt": proof_at,
        "xIdentityCommitment": required_hash(payload["xIdentityCommitment"], "INVALID_X_IDENTITY_COMMITMENT"),
    }


def campaign_verification(
    envelope: Any,
    *,
    now: Any,
    expected_campaign_id: Any,
    expected_key_id: Any,
    public_key_hex: Any,
) -> dict[str, Any]:
    result = {
        "campaignEnvelopeVerified": False,
        "canonicalMessageHex": None,
        "canonicalMessageSha256": None,
        "reason": None,
    }
    if not isinstance(expected_key_id, str) or not expected_key_id:
        return {**result, "reason": "INVALID_EXPECTED_KEY_ID"}
    if not isinstance(public_key_hex, str) or HEX_32.fullmatch(public_key_hex) is None:
        return {**result, "reason": "INVALID_ED25519_PUBLIC_KEY_HEX"}
    try:
        signature = decode_base64(envelope.get("signatureBase64") if isinstance(envelope, dict) else None)
    except VerificationFailure as error:
        return {**result, "reason": str(error)}
    observed_message: bytes | None = None
    try:
        exact_keys(envelope, SIGNED_ENVELOPE_KEYS, "SIGNED_ENVELOPE_FIELDS_MISMATCH")
        safe_timestamp(now, "INVALID_CURRENT_TIMESTAMP")
        if envelope["version"] != 0:
            raise VerificationFailure("ATTESTATION_VERSION_MISMATCH")
        if envelope["scheme"] != "ED25519_DETACHED":
            raise VerificationFailure("ATTESTATION_SCHEME_MISMATCH")
        required_string(envelope["keyId"], "INVALID_KEY_ID", 128)
        if envelope["keyId"] != expected_key_id:
            raise VerificationFailure("ATTESTATION_KEY_NOT_ALLOWED")
        payload = normalize_payload(envelope["payload"])
        if canonical_json(payload) != canonical_json(envelope["payload"]):
            raise VerificationFailure("ATTESTATION_PAYLOAD_NOT_CANONICAL")
        if payload["campaignId"] != expected_campaign_id:
            raise VerificationFailure("ATTESTATION_CAMPAIGN_MISMATCH")
        if payload["issuedAt"] > now:
            raise VerificationFailure("ATTESTATION_NOT_YET_VALID")
        if payload["expiresAt"] <= now:
            raise VerificationFailure("ATTESTATION_EXPIRED")
        expected_id = hashlib.sha256(canonical_json(payload).encode("utf-8")).hexdigest()
        if envelope["attestationId"] != expected_id:
            raise VerificationFailure("ATTESTATION_ID_MISMATCH")
        unsigned_envelope = {
            "attestationId": envelope["attestationId"],
            "keyId": envelope["keyId"],
            "payload": payload,
            "scheme": envelope["scheme"],
            "version": envelope["version"],
        }
        exact_keys(unsigned_envelope, UNSIGNED_ENVELOPE_KEYS, "UNSIGNED_ENVELOPE_FIELDS_MISMATCH")
        observed_message = f"{ATTESTATION_DOMAIN}\n{canonical_json(unsigned_envelope)}".encode("utf-8")
        if not verify_ed25519(bytes.fromhex(public_key_hex), observed_message, signature):
            raise VerificationFailure("INVALID_ATTESTATION_SIGNATURE")
        return {
            "campaignEnvelopeVerified": True,
            "canonicalMessageHex": observed_message.hex(),
            "canonicalMessageSha256": hashlib.sha256(observed_message).hexdigest(),
            "reason": "VALID_EXTERNAL_CAMPAIGN_SIGNATURE",
        }
    except VerificationFailure as error:
        return {
            "campaignEnvelopeVerified": False,
            "canonicalMessageHex": observed_message.hex() if observed_message is not None else None,
            "canonicalMessageSha256": (
                hashlib.sha256(observed_message).hexdigest() if observed_message is not None else None
            ),
            "reason": str(error),
        }


def exact_target_shape(target: Any) -> bool:
    return (
        isinstance(target, dict)
        and list(target) == TARGET_KEYS
        and target["targetVersion"] == 1
        and isinstance(target["campaignId"], str)
        and bool(target["campaignId"])
        and isinstance(target["keyId"], str)
        and bool(target["keyId"])
        and isinstance(target["publicKeyHex"], str)
        and HEX_32.fullmatch(target["publicKeyHex"]) is not None
        and isinstance(target["sourceArtifactSha256"], str)
        and HEX_32.fullmatch(target["sourceArtifactSha256"]) is not None
        and isinstance(target["reviewReceiptSha256"], str)
        and HEX_32.fullmatch(target["reviewReceiptSha256"]) is not None
        and isinstance(target["positiveVectorAvailable"], bool)
        and isinstance(target["positiveVectorReviewCompleted"], bool)
    )


def contains_forbidden_private_field(value: Any) -> bool:
    if not isinstance(value, dict):
        if isinstance(value, list):
            return any(contains_forbidden_private_field(item) for item in value)
        return False
    for key, nested in value.items():
        if FORBIDDEN_PRIVATE_FIELD.search(key) is not None:
            return True
        if contains_forbidden_private_field(nested):
            return True
    return False


def signature_hex_from_base64(value: Any) -> str | None:
    try:
        decoded = decode_base64(value)
    except VerificationFailure:
        return None
    return decoded.hex() if len(decoded) == 64 else None


def gate(identifier: str, passed: bool, detail: str) -> dict[str, str]:
    return {"id": identifier, "result": "PASS" if passed else "FAIL", "detail": detail}


def evaluate_intake(
    candidate: Any, expected_target: Any, *, now: int, schema: dict[str, Any]
) -> dict[str, Any]:
    schema_errors = validate_schema_subset(schema, candidate)
    structural_valid = len(schema_errors) == 0
    target_valid = exact_target_shape(expected_target)
    privacy_valid = not contains_forbidden_private_field(candidate)
    verification = {
        "campaignEnvelopeVerified": False,
        "canonicalMessageHex": None,
        "canonicalMessageSha256": None,
        "reason": "NOT_EVALUATED",
    }
    if structural_valid and target_valid:
        verification = campaign_verification(
            candidate["campaignVector"]["envelope"],
            now=now,
            expected_campaign_id=expected_target["campaignId"],
            expected_key_id=expected_target["keyId"],
            public_key_hex=expected_target["publicKeyHex"],
        )
    provenance_valid = (
        structural_valid
        and target_valid
        and privacy_valid
        and candidate["provenance"]["independenceDeclaration"] is True
        and candidate["provenance"]["campaignMessageWasSignedBySource"] is True
        and candidate["provenance"]["signingMaterialIncluded"] is False
        and candidate["provenance"]["sourceArtifactSha256"]
        == expected_target["sourceArtifactSha256"]
    )
    message_binding_valid = (
        structural_valid
        and target_valid
        and verification["canonicalMessageHex"] is not None
        and candidate["campaignVector"]["envelope"]["payload"]["campaignId"]
        == expected_target["campaignId"]
        and candidate["campaignVector"]["envelope"]["keyId"] == expected_target["keyId"]
        and candidate["campaignVector"]["publicKeyHex"] == expected_target["publicKeyHex"]
        and candidate["campaignVector"]["signatureHex"]
        == signature_hex_from_base64(candidate["campaignVector"]["envelope"]["signatureBase64"])
        and candidate["campaignVector"]["claimedCanonicalMessageHex"]
        == verification["canonicalMessageHex"]
        and candidate["campaignVector"]["claimedCanonicalMessageSha256"]
        == verification["canonicalMessageSha256"]
    )
    cryptographic_valid = (
        structural_valid
        and target_valid
        and verification["campaignEnvelopeVerified"] is True
    )
    review_valid = (
        structural_valid
        and target_valid
        and expected_target["positiveVectorAvailable"] is True
        and expected_target["positiveVectorReviewCompleted"] is True
        and candidate["review"]["completed"] is True
        and candidate["review"]["decision"] == "APPROVE_VECTOR_ONLY"
        and isinstance(candidate["review"]["reviewerIdentityCommitmentSha256"], str)
        and HEX_32.fullmatch(candidate["review"]["reviewerIdentityCommitmentSha256"]) is not None
        and candidate["review"]["receiptSha256"] == expected_target["reviewReceiptSha256"]
    )
    non_authority_valid = (
        structural_valid
        and candidate["authority"]["receiptIssued"] is False
        and candidate["authority"]["reviewCompletedByIntake"] is False
        and candidate["authority"]["activationAuthorized"] is False
        and candidate["authority"]["activationEffect"] == "NONE"
    )
    gates = [
        gate("CLOSED_SCHEMA", structural_valid, "STRUCTURE_VALID" if structural_valid else "STRUCTURE_REJECTED"),
        gate("EXPECTED_TARGET", target_valid, "TARGET_SHAPE_VALID" if target_valid else "TARGET_REJECTED"),
        gate(
            "PRIVATE_MATERIAL_EXCLUSION",
            privacy_valid,
            "NO_PRIVATE_FIELDS" if privacy_valid else "PRIVATE_FIELD_REJECTED",
        ),
        gate(
            "EXTERNAL_PROVENANCE",
            provenance_valid,
            "PROVENANCE_BOUND" if provenance_valid else "PROVENANCE_NOT_ESTABLISHED",
        ),
        gate(
            "CANONICAL_MESSAGE_BINDING",
            message_binding_valid,
            "MESSAGE_BOUND" if message_binding_valid else "MESSAGE_BINDING_FAILED",
        ),
        gate("CRYPTOGRAPHIC_SIGNATURE", cryptographic_valid, verification["reason"]),
        gate(
            "INDEPENDENT_VECTOR_REVIEW",
            review_valid,
            "VECTOR_REVIEW_BOUND" if review_valid else "POSITIVE_VECTOR_OR_REVIEW_ABSENT",
        ),
        gate(
            "NON_AUTHORITY",
            non_authority_valid,
            "NO_AUTHORITY_EFFECT" if non_authority_valid else "AUTHORITY_CLAIM_REJECTED",
        ),
    ]
    accepted = all(entry["result"] == "PASS" for entry in gates)
    return {
        "intakeEvaluationVersion": 1,
        "intakeEvaluationId": "iat-promotions-dlc-positive-campaign-vector-intake-evaluation-v1",
        "status": {
            "labels": HOLD_LABELS,
            "network": "NONE",
            "programId": None,
            "deployable": False,
            "intakeApplied": False,
        },
        "structuralValid": structural_valid,
        "schemaErrors": schema_errors,
        "candidateSatisfiesIntakePolicy": accepted,
        "positiveVectorAcceptedForSeparateReview": accepted,
        "verificationReason": verification["reason"],
        "gates": gates,
        "receiptIssued": False,
        "reviewCompletedByThisEvaluator": False,
        "activationAuthorized": False,
        "activationEffect": "NONE",
    }


def validate_bundle(vectors: Any) -> list[str]:
    errors: list[str] = []

    def expect(condition: bool, message: str) -> None:
        if not condition:
            errors.append(message)

    schema = read_json(SCHEMA_PATH)
    campaign_vectors = read_json(CAMPAIGN_VECTORS_PATH)
    expect(vectors.get("vectorVersion") == 1, "intake vector version drift")
    expect(
        vectors.get("vectorId") == "iat-promotions-dlc-positive-campaign-vector-intake-vectors-v1",
        "intake vector ID drift",
    )
    status = vectors.get("status", {})
    expect(status.get("labels") == HOLD_LABELS, "intake HOLD labels drift")
    expect(status.get("network") == "NONE", "intake vectors must remain network-free")
    expect(status.get("programId") is None, "intake vectors claim a program ID")
    expect(status.get("deployable") is False, "intake vectors claim deployability")
    expect(status.get("intakeApplied") is False, "intake vectors claim application")
    expect(status.get("positiveVectorAvailable") is False, "intake vectors claim a positive vector")
    expect(
        status.get("positiveVectorReviewCompleted") is False,
        "intake vectors claim positive-vector review completion",
    )
    expect(
        status.get("positiveVectorIntegrationBlocked") is True,
        "positive-vector integration HOLD was released",
    )
    contract = vectors.get("contract", {})
    expect(contract.get("mode") == "VERIFY_ONLY_REJECTION_ONLY", "intake mode drift")
    expect(contract.get("gateOrder") == GATE_ORDER, "intake gate order drift")
    expect(contract.get("everyPublicCandidateRejected") is True, "public rejection contract drift")
    for field in [
        "validPositiveCampaignVectorPublished",
        "independentlyReviewedPositiveVectorPublished",
        "signingMaterialIncluded",
        "createsKeys",
        "createsSignatures",
        "issuesReviewReceipts",
        "completesReview",
        "activationAuthorized",
    ]:
        expect(contract.get(field) is False, f"intake contract {field} drift")
    expect(contract.get("activationEffect") == "NONE", "intake activation effect drift")
    sources = vectors.get("sources", {})
    expect(
        sources.get("campaignEnvelopeVectors", {}).get("canonicalSha256")
        == canonical_sha256(campaign_vectors),
        "campaign-envelope source digest drift",
    )
    expect(
        sources.get("intakeSchema", {}).get("canonicalSha256") == canonical_sha256(schema),
        "intake schema digest drift",
    )
    expect(
        sources.get("intakeEvaluator", {}).get("normalizedTextSha256")
        == normalized_text_sha256(EVALUATOR_PATH),
        "intake evaluator source digest drift",
    )
    positive_controls = campaign_vectors.get("publicPrimitiveControls", [])
    expect(len(positive_controls) == 2, "public Ed25519 positive-control count drift")
    for control in positive_controls:
        try:
            verified = verify_ed25519(
                bytes.fromhex(control["publicKeyHex"]),
                bytes.fromhex(control["messageHex"]),
                bytes.fromhex(control["signatureHex"]),
            )
        except (KeyError, ValueError):
            verified = False
        expect(verified is True, f"{control.get('name', 'UNKNOWN')} public Ed25519 control failed")
    scenarios = vectors.get("scenarios", [])
    expect(isinstance(scenarios, list) and len(scenarios) == 10, "intake scenario count drift")
    seen: set[str] = set()
    for scenario in scenarios if isinstance(scenarios, list) else []:
        name = scenario.get("name", "UNKNOWN")
        expect(name not in seen, f"duplicate intake scenario {name}")
        seen.add(name)
        try:
            actual = evaluate_intake(
                scenario["candidate"],
                scenario["expectedTarget"],
                now=vectors["evaluationTime"],
                schema=schema,
            )
        except (KeyError, TypeError, ValueError, VerificationFailure) as error:
            errors.append(f"{name}: independent evaluation failed closed: {error}")
            continue
        expect(actual == scenario.get("expectedResult"), f"{name}: result does not reproduce")
        expect(actual["candidateSatisfiesIntakePolicy"] is False, f"{name}: satisfies intake policy")
        expect(
            actual["positiveVectorAcceptedForSeparateReview"] is False,
            f"{name}: claims separate-review acceptance",
        )
        expect(
            [entry["id"] for entry in actual["gates"]] == GATE_ORDER,
            f"{name}: gate order drift",
        )
        expect(any(entry["result"] == "FAIL" for entry in actual["gates"]), f"{name}: no rejecting gate")
        expect(actual["receiptIssued"] is False, f"{name}: issues receipt")
        expect(actual["reviewCompletedByThisEvaluator"] is False, f"{name}: completes review")
        expect(actual["activationAuthorized"] is False, f"{name}: authorizes activation")
        expect(actual["activationEffect"] == "NONE", f"{name}: creates activation effect")
    return errors


def validate_differential_bundle(vectors: Any) -> list[str]:
    errors: list[str] = []

    def expect(condition: bool, message: str) -> None:
        if not condition:
            errors.append(message)

    schema = read_json(SCHEMA_PATH)
    base_vectors = read_json(DEFAULT_VECTORS)
    base_errors = validate_bundle(base_vectors)
    errors.extend(f"base intake: {error}" for error in base_errors)
    expect(vectors.get("vectorVersion") == 1, "differential vector version drift")
    expect(
        vectors.get("vectorId")
        == "iat-promotions-dlc-positive-campaign-vector-intake-differential-vectors-v1",
        "differential vector ID drift",
    )
    status = vectors.get("status", {})
    expect(status.get("labels") == HOLD_LABELS, "differential HOLD labels drift")
    expect(status.get("network") == "NONE", "differential vectors must remain network-free")
    expect(status.get("programId") is None, "differential vectors claim a program ID")
    expect(status.get("deployable") is False, "differential vectors claim deployability")
    expect(status.get("differentialCorpusApplied") is False, "differential corpus claims application")
    expect(status.get("positiveVectorAvailable") is False, "differential corpus claims a positive vector")
    expect(
        status.get("positiveVectorReviewCompleted") is False,
        "differential corpus claims review completion",
    )
    expect(
        status.get("positiveVectorIntegrationBlocked") is True,
        "differential corpus released positive integration HOLD",
    )
    contract = vectors.get("contract", {})
    expect(
        contract.get("mode") == "CROSS_RUNTIME_VERIFY_ONLY_REJECTION_ONLY",
        "differential mode drift",
    )
    expect(contract.get("gateOrder") == GATE_ORDER, "differential gate order drift")
    expect(contract.get("mutationCount") == 20, "differential mutation count drift")
    expect(contract.get("everyMutationRejected") is True, "differential rejection contract drift")
    expect(contract.get("nodeAndPythonMustMatchExactly") is True, "cross-runtime parity disabled")
    for field in [
        "validPositiveCampaignVectorPublished",
        "signingMaterialIncluded",
        "createsKeys",
        "createsSignatures",
        "issuesReviewReceipts",
        "completesReview",
        "activationAuthorized",
    ]:
        expect(contract.get(field) is False, f"differential contract {field} drift")
    expect(contract.get("activationEffect") == "NONE", "differential activation effect drift")
    sources = vectors.get("sources", {})
    expect(
        sources.get("baseVectors", {}).get("canonicalSha256") == canonical_sha256(base_vectors),
        "differential base-vector source digest drift",
    )
    expect(
        sources.get("intakeSchema", {}).get("canonicalSha256") == canonical_sha256(schema),
        "differential schema source digest drift",
    )
    expect(
        sources.get("nodeEvaluator", {}).get("normalizedTextSha256")
        == normalized_text_sha256(EVALUATOR_PATH),
        "differential Node evaluator source digest drift",
    )
    expect(
        sources.get("pythonVerifier", {}).get("normalizedTextSha256")
        == normalized_text_sha256(Path(__file__).resolve()),
        "differential Python verifier source digest drift",
    )
    scenarios = vectors.get("scenarios", [])
    expect(isinstance(scenarios, list) and len(scenarios) == 20, "differential case count drift")
    seen: set[str] = set()
    for scenario in scenarios if isinstance(scenarios, list) else []:
        name = scenario.get("name", "UNKNOWN")
        expect(name not in seen, f"duplicate differential scenario {name}")
        seen.add(name)
        try:
            actual = evaluate_intake(
                scenario["candidate"],
                scenario["expectedTarget"],
                now=vectors["evaluationTime"],
                schema=schema,
            )
        except (KeyError, TypeError, ValueError, VerificationFailure) as error:
            errors.append(f"{name}: independent differential evaluation failed closed: {error}")
            continue
        expect(actual == scenario.get("expectedResult"), f"{name}: differential result does not reproduce")
        expect(actual["candidateSatisfiesIntakePolicy"] is False, f"{name}: satisfies intake policy")
        expect(
            actual["positiveVectorAcceptedForSeparateReview"] is False,
            f"{name}: claims separate-review acceptance",
        )
        expect(
            [entry["id"] for entry in actual["gates"]] == GATE_ORDER,
            f"{name}: gate order drift",
        )
        expect(any(entry["result"] == "FAIL" for entry in actual["gates"]), f"{name}: no rejecting gate")
        expect(actual["receiptIssued"] is False, f"{name}: issues receipt")
        expect(actual["reviewCompletedByThisEvaluator"] is False, f"{name}: completes review")
        expect(actual["activationAuthorized"] is False, f"{name}: authorizes activation")
        expect(actual["activationEffect"] == "NONE", f"{name}: creates activation effect")
    return errors


def xorshift32(value: int) -> int:
    state = value & 0xFFFFFFFF
    state ^= (state << 13) & 0xFFFFFFFF
    state ^= state >> 17
    state ^= (state << 5) & 0xFFFFFFFF
    return state & 0xFFFFFFFF


def derived_fuzz_hex(seed_hex: str, index: int, word_hex: str, label: str) -> str:
    preimage = (
        f"{FUZZ_DERIVATION_DOMAIN}\0{seed_hex}\0{index}\0{word_hex}\0{label}"
    )
    return hashlib.sha256(preimage.encode("utf-8")).hexdigest()


def fuzz_leaf_sha256(case_commitment_sha256: str) -> str:
    if HEX_32.fullmatch(case_commitment_sha256) is None:
        raise ValueError("INVALID_FUZZ_CASE_COMMITMENT")
    preimage = (
        FUZZ_LEAF_DOMAIN.encode("utf-8")
        + b"\0"
        + bytes.fromhex(case_commitment_sha256)
    )
    return hashlib.sha256(preimage).hexdigest()


def fuzz_merkle_root_sha256(case_commitments: list[str]) -> str:
    if not case_commitments:
        raise ValueError("FUZZ_TREE_EMPTY")
    level = [bytes.fromhex(fuzz_leaf_sha256(value)) for value in case_commitments]
    while len(level) > 1:
        next_level = []
        for index in range(0, len(level), 2):
            left = level[index]
            right = level[index + 1] if index + 1 < len(level) else left
            preimage = FUZZ_NODE_DOMAIN.encode("utf-8") + b"\0" + left + right
            next_level.append(hashlib.sha256(preimage).digest())
        level = next_level
    return level[0].hex()


def replay_fuzz_case(
    index: int, base_vectors: dict[str, Any], schema: dict[str, Any]
) -> dict[str, Any]:
    if index < 0 or index >= FUZZ_CASE_COUNT:
        raise ValueError(f"FUZZ_CASE_INDEX_OUT_OF_RANGE:{index}")
    word = FUZZ_SEED
    for _cursor in range(index + 1):
        word = xorshift32(word)
    word_hex = f"{word:08x}"
    seed_hex = f"{FUZZ_SEED:08x}"
    family = FUZZ_FAMILIES[index % len(FUZZ_FAMILIES)]
    base = base_vectors["scenarios"][0]
    candidate = deepcopy(base["candidate"])
    expected_target = deepcopy(base["expectedTarget"])

    if family == "CLOSED_SCHEMA":
        field = f"fuzz_{word_hex}"
        candidate[field] = False
        mutation = {
            "document": "candidate",
            "operation": "add",
            "path": f"/{field}",
            "variant": word_hex,
        }
    elif family == "EXPECTED_TARGET":
        permutation_ordinal = 1 + index // len(FUZZ_FAMILIES)
        remaining = list(expected_target.items())
        permuted: list[tuple[str, Any]] = []
        rank = permutation_ordinal
        while remaining:
            block_size = 1
            for factor in range(2, len(remaining)):
                block_size *= factor
            selected = (rank // block_size) % len(remaining)
            rank %= block_size
            permuted.append(remaining.pop(selected))
        expected_target = dict(permuted)
        mutation = {
            "document": "expectedTarget",
            "operation": "permute-keys",
            "path": "/",
            "permutationOrdinal": permutation_ordinal,
            "variant": word_hex,
        }
    elif family == "PRIVATE_MATERIAL_EXCLUSION":
        candidate["provenance"]["accessToken"] = (
            f"forbidden-fuzz-placeholder-{index}-{word_hex}"
        )
        mutation = {
            "document": "candidate",
            "operation": "add",
            "path": "/provenance/accessToken",
            "variant": word_hex,
        }
    elif family == "EXTERNAL_PROVENANCE":
        candidate["provenance"]["sourceArtifactSha256"] = derived_fuzz_hex(
            seed_hex, index, word_hex, "provenance"
        )
        mutation = {
            "document": "candidate",
            "operation": "replace",
            "path": "/provenance/sourceArtifactSha256",
            "variant": word_hex,
        }
    elif family == "CANONICAL_MESSAGE_BINDING":
        candidate["campaignVector"]["claimedCanonicalMessageSha256"] = derived_fuzz_hex(
            seed_hex, index, word_hex, "canonical-message"
        )
        mutation = {
            "document": "candidate",
            "operation": "replace",
            "path": "/campaignVector/claimedCanonicalMessageSha256",
            "variant": word_hex,
        }
    elif family == "PUBLIC_KEY_BINDING":
        candidate["campaignVector"]["publicKeyHex"] = derived_fuzz_hex(
            seed_hex, index, word_hex, "public-key-binding"
        )
        mutation = {
            "document": "candidate",
            "operation": "replace",
            "path": "/campaignVector/publicKeyHex",
            "variant": word_hex,
        }
    elif family == "INDEPENDENT_VECTOR_REVIEW":
        receipt_sha256 = derived_fuzz_hex(
            seed_hex, index, word_hex, "review-receipt"
        )
        candidate["review"] = {
            "completed": True,
            "decision": "APPROVE_VECTOR_ONLY",
            "reviewerIdentityCommitmentSha256": derived_fuzz_hex(
                seed_hex, index, word_hex, "reviewer"
            ),
            "receiptSha256": receipt_sha256,
        }
        expected_target["reviewReceiptSha256"] = receipt_sha256
        expected_target["positiveVectorAvailable"] = True
        expected_target["positiveVectorReviewCompleted"] = True
        mutation = {
            "document": "candidate+expectedTarget",
            "operation": "bind-review",
            "path": "/review",
            "variant": word_hex,
        }
    elif family == "NON_AUTHORITY":
        candidate["authority"]["activationEffect"] = f"FUZZ_{word_hex}"
        mutation = {
            "document": "candidate",
            "operation": "replace",
            "path": "/authority/activationEffect",
            "variant": word_hex,
        }
    elif family == "CRYPTOGRAPHIC_SIGNATURE":
        signature = bytearray(
            base64.b64decode(
                candidate["campaignVector"]["envelope"]["signatureBase64"],
                validate=True,
            )
        )
        byte_index = (word >> 8) % len(signature)
        xor_mask = 1 + (word & 0xFF) % 255
        signature[byte_index] ^= xor_mask
        changed_base64 = base64.b64encode(bytes(signature)).decode("ascii")
        candidate["campaignVector"]["envelope"]["signatureBase64"] = changed_base64
        candidate["campaignVector"]["signatureHex"] = bytes(signature).hex()
        mutation = {
            "document": "candidate",
            "operation": "xor-signature-byte",
            "path": "/campaignVector/envelope/signatureBase64",
            "byteIndex": byte_index,
            "xorMask": xor_mask,
            "variant": word_hex,
        }
    elif family == "CRYPTOGRAPHIC_GUARD":
        nonce = candidate["campaignVector"]["envelope"]["payload"]["nonce"]
        candidate["campaignVector"]["envelope"]["payload"]["nonce"] = (
            f"{nonce}-{word_hex}"
        )
        mutation = {
            "document": "candidate",
            "operation": "append",
            "path": "/campaignVector/envelope/payload/nonce",
            "variant": word_hex,
        }
    else:
        raise ValueError(f"UNKNOWN_FUZZ_FAMILY:{family}")

    result = evaluate_intake(
        candidate,
        expected_target,
        now=base_vectors["evaluationTime"],
        schema=schema,
    )
    passing_gate_ids = [
        entry["id"] for entry in result["gates"] if entry["result"] == "PASS"
    ]
    failing_gate_ids = [
        entry["id"] for entry in result["gates"] if entry["result"] == "FAIL"
    ]
    core = {
        "index": str(index),
        "name": f"FUZZ_{index:03d}_{family}_{word_hex}",
        "family": family,
        "mutation": mutation,
        "inputCommitmentSha256": canonical_sha256(
            {"candidate": candidate, "expectedTarget": expected_target}
        ),
        "resultCommitmentSha256": canonical_sha256(result),
        "structuralValid": result["structuralValid"],
        "verificationReason": result["verificationReason"],
        "passingGateIds": passing_gate_ids,
        "failingGateIds": failing_gate_ids,
        "expectedAccepted": False,
        "expectedReceiptIssued": False,
        "expectedReviewCompleted": False,
        "expectedActivationAuthorized": False,
        "expectedActivationEffect": "NONE",
    }
    return {
        "candidate": candidate,
        "expectedTarget": expected_target,
        "result": result,
        "record": {**core, "caseCommitmentSha256": canonical_sha256(core)},
    }


def validate_fuzz_bundle(vectors: Any) -> list[str]:
    errors: list[str] = []

    def expect(condition: bool, message: str) -> None:
        if not condition:
            errors.append(message)

    schema = read_json(SCHEMA_PATH)
    base_vectors = read_json(DEFAULT_VECTORS)
    errors.extend(f"base intake: {error}" for error in validate_bundle(base_vectors))
    expect(vectors.get("vectorVersion") == 1, "fuzz vector version drift")
    expect(
        vectors.get("vectorId")
        == "iat-promotions-dlc-positive-campaign-vector-intake-fuzz-vectors-v1",
        "fuzz vector ID drift",
    )
    status = vectors.get("status", {})
    expect(status.get("labels") == HOLD_LABELS, "fuzz HOLD labels drift")
    expect(status.get("network") == "NONE", "fuzz vectors must remain network-free")
    expect(status.get("programId") is None, "fuzz vectors claim a program ID")
    expect(status.get("deployable") is False, "fuzz vectors claim deployability")
    expect(status.get("fuzzCorpusApplied") is False, "fuzz corpus claims application")
    expect(status.get("positiveVectorAvailable") is False, "fuzz corpus claims a positive vector")
    expect(
        status.get("positiveVectorReviewCompleted") is False,
        "fuzz corpus claims review completion",
    )
    expect(
        status.get("positiveVectorIntegrationBlocked") is True,
        "fuzz corpus released positive integration HOLD",
    )
    contract = vectors.get("contract", {})
    expect(
        contract.get("mode") == "SEEDED_CROSS_RUNTIME_VERIFY_ONLY_REJECTION_ONLY",
        "fuzz mode drift",
    )
    expect(contract.get("prng") == "XORSHIFT32", "fuzz PRNG drift")
    expect(contract.get("seedHex") == f"{FUZZ_SEED:08x}", "fuzz seed drift")
    expect(contract.get("mutationCount") == FUZZ_CASE_COUNT, "fuzz mutation count drift")
    expect(contract.get("familyOrder") == FUZZ_FAMILIES, "fuzz family order drift")
    expect(contract.get("gateOrder") == GATE_ORDER, "fuzz gate order drift")
    expect(contract.get("everyMutationRejected") is True, "fuzz rejection contract drift")
    expect(
        contract.get("nodeAndPythonMustMatchExactly") is True,
        "fuzz cross-runtime parity disabled",
    )
    expect(
        contract.get("storesInputsOrFullResults") is False,
        "fuzz corpus stores inputs or full results",
    )
    for field in [
        "validPositiveCampaignVectorPublished",
        "signingMaterialIncluded",
        "createsKeys",
        "createsSignatures",
        "issuesReviewReceipts",
        "completesReview",
        "activationAuthorized",
    ]:
        expect(contract.get(field) is False, f"fuzz contract {field} drift")
    expect(contract.get("activationEffect") == "NONE", "fuzz activation effect drift")
    sources = vectors.get("sources", {})
    expect(
        sources.get("baseVectors", {}).get("canonicalSha256")
        == canonical_sha256(base_vectors),
        "fuzz base-vector source digest drift",
    )
    expect(
        sources.get("intakeSchema", {}).get("canonicalSha256")
        == canonical_sha256(schema),
        "fuzz schema source digest drift",
    )
    expect(
        sources.get("nodeEvaluator", {}).get("normalizedTextSha256")
        == normalized_text_sha256(EVALUATOR_PATH),
        "fuzz Node evaluator source digest drift",
    )
    expect(
        sources.get("pythonVerifier", {}).get("normalizedTextSha256")
        == normalized_text_sha256(Path(__file__).resolve()),
        "fuzz Python verifier source digest drift",
    )
    expect(
        sources.get("generator", {}).get("normalizedTextSha256")
        == normalized_text_sha256(FUZZ_GENERATOR_PATH),
        "fuzz generator source digest drift",
    )
    cases = vectors.get("cases", [])
    expect(isinstance(cases, list) and len(cases) == FUZZ_CASE_COUNT, "fuzz case count drift")
    seen: set[str] = set()
    family_counts = {family: 0 for family in FUZZ_FAMILIES}
    for index, record in enumerate(cases if isinstance(cases, list) else []):
        name = record.get("name", "UNKNOWN")
        expect(record.get("index") == str(index), f"fuzz case index drift at {index}")
        expect(name not in seen, f"duplicate fuzz case {name}")
        seen.add(name)
        family = record.get("family")
        expect(family in FUZZ_FAMILIES, f"{name}: unknown family")
        if family in family_counts:
            family_counts[family] += 1
        try:
            replay = replay_fuzz_case(index, base_vectors, schema)
        except (KeyError, TypeError, ValueError, VerificationFailure) as error:
            errors.append(f"{name}: independent fuzz replay failed closed: {error}")
            continue
        expect(replay["record"] == record, f"{name}: compact fuzz record does not reproduce")
        result = replay["result"]
        expect(result["candidateSatisfiesIntakePolicy"] is False, f"{name}: satisfies intake policy")
        expect(
            result["positiveVectorAcceptedForSeparateReview"] is False,
            f"{name}: claims separate-review acceptance",
        )
        expect(bool(record.get("failingGateIds")), f"{name}: has no rejecting gate")
        expect(result["receiptIssued"] is False, f"{name}: issues receipt")
        expect(result["reviewCompletedByThisEvaluator"] is False, f"{name}: completes review")
        expect(result["activationAuthorized"] is False, f"{name}: authorizes activation")
        expect(result["activationEffect"] == "NONE", f"{name}: creates activation effect")
        expect(
            canonical_sha256(result) == record.get("resultCommitmentSha256"),
            f"{name}: result commitment mismatch",
        )
        if family == "INDEPENDENT_VECTOR_REVIEW":
            gates = {entry["id"]: entry["result"] for entry in result["gates"]}
            expect(gates.get("INDEPENDENT_VECTOR_REVIEW") == "PASS", f"{name}: review gate drift")
            expect(gates.get("CRYPTOGRAPHIC_SIGNATURE") == "FAIL", f"{name}: crypto HOLD bypassed")
        if family == "PRIVATE_MATERIAL_EXCLUSION":
            placeholder = replay["candidate"]["provenance"]["accessToken"]
            expect(
                re.fullmatch(r"forbidden-fuzz-placeholder-\d+-[0-9a-f]{8}", placeholder)
                is not None,
                f"{name}: private-field placeholder drift",
            )
    expected_counts = {family: str(family_counts[family]) for family in FUZZ_FAMILIES}
    expect(contract.get("familyCounts") == expected_counts, "fuzz contract family counts drift")
    summary = vectors.get("summary", {})
    expect(summary.get("caseCount") == str(FUZZ_CASE_COUNT), "fuzz summary case count drift")
    expect(summary.get("familyCounts") == expected_counts, "fuzz summary family counts drift")
    expect(summary.get("allRejected") is True, "fuzz summary rejection drift")
    try:
        root = fuzz_merkle_root_sha256(
            [record["caseCommitmentSha256"] for record in cases]
        )
    except (KeyError, TypeError, ValueError) as error:
        errors.append(f"fuzz Merkle reconstruction failed closed: {error}")
    else:
        expect(
            summary.get("caseCommitmentMerkleRootSha256") == root,
            "fuzz Merkle root drift",
        )
    return errors


def ordered_input_sha256(candidate: Any, expected_target: Any) -> str:
    ordered_json = json.dumps(
        {"candidate": candidate, "expectedTarget": expected_target},
        ensure_ascii=False,
        separators=(",", ":"),
    )
    return hashlib.sha256(ordered_json.encode("utf-8")).hexdigest()


def representation_audit_leaf_sha256(record_commitment_sha256: str) -> str:
    if not isinstance(record_commitment_sha256, str) or not re.fullmatch(
        r"[0-9a-f]{64}", record_commitment_sha256
    ):
        raise ValueError("INVALID_REPRESENTATION_RECORD_COMMITMENT")
    return hashlib.sha256(
        REPRESENTATION_MERKLE_LEAF_DOMAIN.encode("utf-8")
        + b"\x00"
        + bytes.fromhex(record_commitment_sha256)
    ).hexdigest()


def representation_audit_parent_sha256(left_sha256: str, right_sha256: str) -> str:
    if not re.fullmatch(r"[0-9a-f]{64}", left_sha256 or "") or not re.fullmatch(
        r"[0-9a-f]{64}", right_sha256 or ""
    ):
        raise ValueError("INVALID_REPRESENTATION_MERKLE_NODE")
    return hashlib.sha256(
        REPRESENTATION_MERKLE_NODE_DOMAIN.encode("utf-8")
        + b"\x00"
        + bytes.fromhex(left_sha256)
        + bytes.fromhex(right_sha256)
    ).hexdigest()


def representation_audit_merkle_levels(
    record_commitments: list[str],
) -> list[list[str]]:
    if not record_commitments:
        raise ValueError("REPRESENTATION_TREE_EMPTY")
    levels = [[representation_audit_leaf_sha256(value) for value in record_commitments]]
    while len(levels[-1]) > 1:
        current = levels[-1]
        next_level = []
        for index in range(0, len(current), 2):
            right = current[index + 1] if index + 1 < len(current) else current[index]
            next_level.append(representation_audit_parent_sha256(current[index], right))
        levels.append(next_level)
    return levels


def representation_audit_merkle_proof(
    record_commitments: list[str], index: int
) -> list[dict[str, str]]:
    levels = representation_audit_merkle_levels(record_commitments)
    if index < 0 or index >= len(levels[0]):
        raise ValueError("REPRESENTATION_PROOF_INDEX_OUT_OF_RANGE")
    path = []
    cursor = index
    for level, nodes in enumerate(levels[:-1]):
        sibling_index = cursor + 1 if cursor % 2 == 0 else cursor - 1
        path.append(
            {
                "level": str(level),
                "side": "RIGHT" if cursor % 2 == 0 else "LEFT",
                "siblingSha256": (
                    nodes[sibling_index]
                    if sibling_index < len(nodes)
                    else nodes[cursor]
                ),
            }
        )
        cursor //= 2
    return path


def verify_representation_audit_merkle_proof(
    record_commitment_sha256: str,
    index: int,
    path: Any,
    expected_root_sha256: str,
) -> bool:
    if (
        index < 0
        or not isinstance(path, list)
        or not re.fullmatch(r"[0-9a-f]{64}", expected_root_sha256 or "")
    ):
        return False
    current = representation_audit_leaf_sha256(record_commitment_sha256)
    cursor = index
    for level, step in enumerate(path):
        expected_side = "RIGHT" if cursor % 2 == 0 else "LEFT"
        if (
            not isinstance(step, dict)
            or step.get("level") != str(level)
            or step.get("side") != expected_side
            or not re.fullmatch(r"[0-9a-f]{64}", step.get("siblingSha256", ""))
        ):
            return False
        sibling = step["siblingSha256"]
        current = (
            representation_audit_parent_sha256(sibling, current)
            if expected_side == "LEFT"
            else representation_audit_parent_sha256(current, sibling)
        )
        cursor //= 2
    return current == expected_root_sha256


def representation_audit_multiproof_node_keys(
    total_leaf_count: int, indices: list[int]
) -> list[tuple[int, int]]:
    if total_leaf_count <= 0:
        raise ValueError("INVALID_REPRESENTATION_MULTIPROOF_LEAF_COUNT")
    unique = sorted(set(indices))
    if len(unique) != len(indices) or any(
        index < 0 or index >= total_leaf_count for index in unique
    ):
        raise ValueError("INVALID_REPRESENTATION_MULTIPROOF_INDICES")
    keys = []
    active = set(unique)
    width = total_leaf_count
    level = 0
    while width > 1:
        next_active = set()
        for index in sorted(active):
            sibling = index + 1 if index % 2 == 0 else index - 1
            if sibling < width and sibling not in active:
                keys.append((level, sibling))
            next_active.add(index // 2)
        active = next_active
        width = (width + 1) // 2
        level += 1
    return keys


def representation_audit_merkle_multiproof(
    record_commitments: list[str], indices: list[int]
) -> list[dict[str, str]]:
    levels = representation_audit_merkle_levels(record_commitments)
    return [
        {
            "level": str(level),
            "index": str(index),
            "sha256": levels[level][index],
        }
        for level, index in representation_audit_multiproof_node_keys(
            len(record_commitments), indices
        )
    ]


def verify_representation_audit_merkle_multiproof(
    selected_records: Any,
    total_leaf_count: int,
    proof_nodes: Any,
    expected_root_sha256: str,
) -> bool:
    if (
        not isinstance(selected_records, list)
        or not selected_records
        or not isinstance(proof_nodes, list)
    ):
        return False
    indices = [record.get("index") for record in selected_records]
    try:
        expected_keys = representation_audit_multiproof_node_keys(
            total_leaf_count, indices
        )
    except (TypeError, ValueError):
        return False
    if len(proof_nodes) != len(expected_keys):
        return False
    proof_map = {}
    for position, node in enumerate(proof_nodes):
        expected_level, expected_index = expected_keys[position]
        if (
            not isinstance(node, dict)
            or node.get("level") != str(expected_level)
            or node.get("index") != str(expected_index)
            or not re.fullmatch(r"[0-9a-f]{64}", node.get("sha256", ""))
        ):
            return False
        proof_map[(expected_level, expected_index)] = node["sha256"]
    active = {}
    for record in selected_records:
        index = record.get("index")
        commitment = record.get("recordCommitmentSha256")
        if not isinstance(index, int):
            return False
        try:
            active[index] = representation_audit_leaf_sha256(commitment)
        except ValueError:
            return False
    width = total_leaf_count
    level = 0
    used = set()
    while width > 1:
        parents = sorted({index // 2 for index in active})
        next_active = {}
        for parent in parents:
            left_index = parent * 2
            right_index = min(left_index + 1, width - 1)

            def resolve(index: int) -> str | None:
                if index in active:
                    return active[index]
                key = (level, index)
                if key not in proof_map:
                    return None
                used.add(key)
                return proof_map[key]

            left = resolve(left_index)
            right = resolve(right_index)
            if left is None or right is None:
                return False
            next_active[parent] = representation_audit_parent_sha256(left, right)
        active = next_active
        width = (width + 1) // 2
        level += 1
    return active.get(0) == expected_root_sha256 and len(used) == len(proof_map)


def result_gate(result: dict[str, Any], gate_id: str) -> dict[str, str]:
    for entry in result["gates"]:
        if entry["id"] == gate_id:
            return entry
    raise ValueError(f"MISSING_GATE:{gate_id}")


def differing_gate_ids(
    before: dict[str, Any], after: dict[str, Any]
) -> list[str]:
    return [
        entry["id"]
        for index, entry in enumerate(before["gates"])
        if entry["result"] != after["gates"][index]["result"]
        or entry["detail"] != after["gates"][index]["detail"]
    ]


def replay_minimal_counterexample(
    index: int, base_vectors: dict[str, Any], schema: dict[str, Any]
) -> dict[str, Any]:
    if index < 0 or index >= len(FUZZ_FAMILIES):
        raise ValueError(f"MINIMAL_COUNTEREXAMPLE_INDEX_OUT_OF_RANGE:{index}")
    family = FUZZ_FAMILIES[index]
    base = base_vectors["scenarios"][0]
    fuzz_replay = replay_fuzz_case(index, base_vectors, schema)
    control_candidate = deepcopy(base["candidate"])
    control_target = deepcopy(base["expectedTarget"])
    mutated_candidate = deepcopy(fuzz_replay["candidate"])
    mutated_target = deepcopy(fuzz_replay["expectedTarget"])
    delta = deepcopy(fuzz_replay["record"]["mutation"])
    storage_delta_count = 2 if family == "CRYPTOGRAPHIC_SIGNATURE" else 1
    proof_mode = "PASS_TO_FAIL_GATE"

    if family == "EXTERNAL_PROVENANCE":
        control_candidate["provenance"]["campaignMessageWasSignedBySource"] = True
        mutated_candidate["provenance"]["campaignMessageWasSignedBySource"] = True
    if family == "INDEPENDENT_VECTOR_REVIEW":
        control_candidate = deepcopy(fuzz_replay["candidate"])
        control_target = deepcopy(fuzz_replay["expectedTarget"])
        mutated_candidate = deepcopy(control_candidate)
        mutated_target = deepcopy(control_target)
        mutated_target["positiveVectorReviewCompleted"] = False
        delta = {
            "document": "expectedTarget",
            "operation": "replace",
            "path": "/positiveVectorReviewCompleted",
            "from": True,
            "to": False,
            "variant": fuzz_replay["record"]["mutation"]["variant"],
        }
    if family == "CRYPTOGRAPHIC_SIGNATURE":
        proof_mode = "REJECTION_PRESERVING_BYTE_DELTA"
    if family == "CRYPTOGRAPHIC_GUARD":
        proof_mode = "REJECTION_REASON_DELTA"

    control_result = evaluate_intake(
        control_candidate,
        control_target,
        now=base_vectors["evaluationTime"],
        schema=schema,
    )
    mutated_result = evaluate_intake(
        mutated_candidate,
        mutated_target,
        now=base_vectors["evaluationTime"],
        schema=schema,
    )
    primary_gate_id = MINIMAL_PRIMARY_GATES[family]
    control_gate = result_gate(control_result, primary_gate_id)
    mutated_gate = result_gate(mutated_result, primary_gate_id)
    core = {
        "index": str(index),
        "family": family,
        "sourceFuzzCaseIndex": str(index),
        "sourceFuzzCaseName": fuzz_replay["record"]["name"],
        "primaryGateId": primary_gate_id,
        "proofMode": proof_mode,
        "delta": delta,
        "semanticDeltaCount": "1",
        "storageDeltaCount": str(storage_delta_count),
        "controlInputCanonicalSha256": canonical_sha256(
            {"candidate": control_candidate, "expectedTarget": control_target}
        ),
        "mutatedInputCanonicalSha256": canonical_sha256(
            {"candidate": mutated_candidate, "expectedTarget": mutated_target}
        ),
        "controlInputOrderedSha256": ordered_input_sha256(
            control_candidate, control_target
        ),
        "mutatedInputOrderedSha256": ordered_input_sha256(
            mutated_candidate, mutated_target
        ),
        "controlResultCommitmentSha256": canonical_sha256(control_result),
        "mutatedResultCommitmentSha256": canonical_sha256(mutated_result),
        "controlPrimaryGateResult": control_gate["result"],
        "mutatedPrimaryGateResult": mutated_gate["result"],
        "controlVerificationReason": control_result["verificationReason"],
        "mutatedVerificationReason": mutated_result["verificationReason"],
        "changedGateIds": differing_gate_ids(control_result, mutated_result),
        "controlAccepted": False,
        "mutatedAccepted": False,
        "receiptIssued": False,
        "reviewCompleted": False,
        "activationAuthorized": False,
        "activationEffect": "NONE",
    }
    return {
        "controlCandidate": control_candidate,
        "controlTarget": control_target,
        "mutatedCandidate": mutated_candidate,
        "mutatedTarget": mutated_target,
        "controlResult": control_result,
        "mutatedResult": mutated_result,
        "fixture": {**core, "fixtureCommitmentSha256": canonical_sha256(core)},
    }


def validate_minimal_counterexamples(artifact: Any) -> list[str]:
    errors: list[str] = []

    def expect(condition: bool, message: str) -> None:
        if not condition:
            errors.append(message)

    schema = read_json(SCHEMA_PATH)
    base_vectors = read_json(DEFAULT_VECTORS)
    fuzz_vectors = read_json(DEFAULT_FUZZ_VECTORS)
    errors.extend(f"base intake: {error}" for error in validate_bundle(base_vectors))
    expect(artifact.get("counterexampleVersion") == 1, "minimal counterexample version drift")
    expect(
        artifact.get("counterexampleId")
        == "iat-promotions-dlc-positive-campaign-vector-minimal-counterexamples-v1",
        "minimal counterexample ID drift",
    )
    status = artifact.get("status", {})
    expect(status.get("labels") == HOLD_LABELS, "minimal HOLD labels drift")
    expect(status.get("network") == "NONE", "minimal counterexamples must remain network-free")
    expect(status.get("programId") is None, "minimal counterexamples claim a program ID")
    expect(status.get("deployable") is False, "minimal counterexamples claim deployability")
    expect(status.get("counterexamplesApplied") is False, "minimal counterexamples claim application")
    expect(status.get("positiveVectorAvailable") is False, "minimal counterexamples claim a positive vector")
    expect(
        status.get("positiveVectorReviewCompleted") is False,
        "minimal counterexamples claim review completion",
    )
    expect(
        status.get("positiveVectorIntegrationBlocked") is True,
        "minimal counterexamples released integration HOLD",
    )
    contract = artifact.get("contract", {})
    expect(contract.get("mode") == "CROSS_RUNTIME_MINIMAL_REJECTION_ONLY", "minimal mode drift")
    expect(contract.get("familyOrder") == FUZZ_FAMILIES, "minimal family order drift")
    expect(contract.get("fixtureCount") == len(FUZZ_FAMILIES), "minimal fixture count drift")
    expect(contract.get("oneSemanticDeltaPerFixture") is True, "minimal single-delta contract drift")
    expect(contract.get("orderedCommitmentRequired") is True, "ordered commitment disabled")
    expect(contract.get("storesInputsOrFullResults") is False, "minimal artifact stores full evidence")
    expect(contract.get("everyControlRejected") is True, "minimal controls claim acceptance")
    expect(contract.get("everyMutationRejected") is True, "minimal mutations claim acceptance")
    for field in [
        "validPositiveCampaignVectorPublished",
        "signingMaterialIncluded",
        "createsKeys",
        "createsSignatures",
        "issuesReviewReceipts",
        "completesReview",
        "activationAuthorized",
    ]:
        expect(contract.get(field) is False, f"minimal contract {field} drift")
    expect(contract.get("activationEffect") == "NONE", "minimal activation effect drift")
    sources = artifact.get("sources", {})
    expect(
        sources.get("baseVectors", {}).get("canonicalSha256")
        == canonical_sha256(base_vectors),
        "minimal base-vector source digest drift",
    )
    expect(
        sources.get("fuzzVectors", {}).get("canonicalSha256")
        == canonical_sha256(fuzz_vectors),
        "minimal fuzz-vector source digest drift",
    )
    expect(
        sources.get("intakeSchema", {}).get("canonicalSha256")
        == canonical_sha256(schema),
        "minimal schema source digest drift",
    )
    expect(
        sources.get("nodeEvaluator", {}).get("normalizedTextSha256")
        == normalized_text_sha256(EVALUATOR_PATH),
        "minimal Node evaluator source digest drift",
    )
    expect(
        sources.get("fuzzGenerator", {}).get("normalizedTextSha256")
        == normalized_text_sha256(FUZZ_GENERATOR_PATH),
        "minimal fuzz generator source digest drift",
    )
    expect(
        sources.get("pythonVerifier", {}).get("normalizedTextSha256")
        == normalized_text_sha256(Path(__file__).resolve()),
        "minimal Python verifier source digest drift",
    )
    expect(
        sources.get("generator", {}).get("normalizedTextSha256")
        == normalized_text_sha256(MINIMAL_GENERATOR_PATH),
        "minimal generator source digest drift",
    )
    fixtures = artifact.get("fixtures", [])
    expect(
        isinstance(fixtures, list) and len(fixtures) == len(FUZZ_FAMILIES),
        "minimal fixture array drift",
    )
    for index, fixture in enumerate(fixtures if isinstance(fixtures, list) else []):
        family = FUZZ_FAMILIES[index]
        expect(fixture.get("index") == str(index), f"minimal index drift at {index}")
        expect(fixture.get("family") == family, f"minimal family drift at {index}")
        expect(fixture.get("semanticDeltaCount") == "1", f"{family}: semantic delta count drift")
        try:
            replay = replay_minimal_counterexample(index, base_vectors, schema)
        except (KeyError, TypeError, ValueError, VerificationFailure) as error:
            errors.append(f"{family}: independent minimal replay failed closed: {error}")
            continue
        expect(replay["fixture"] == fixture, f"{family}: minimal fixture does not reproduce")
        expect(
            replay["controlResult"]["candidateSatisfiesIntakePolicy"] is False,
            f"{family}: control satisfies intake policy",
        )
        expect(
            replay["mutatedResult"]["candidateSatisfiesIntakePolicy"] is False,
            f"{family}: mutation satisfies intake policy",
        )
        expect(fixture.get("receiptIssued") is False, f"{family}: issues receipt")
        expect(fixture.get("reviewCompleted") is False, f"{family}: completes review")
        expect(fixture.get("activationAuthorized") is False, f"{family}: authorizes activation")
        expect(fixture.get("activationEffect") == "NONE", f"{family}: creates activation effect")
        if family not in ["CRYPTOGRAPHIC_SIGNATURE", "CRYPTOGRAPHIC_GUARD"]:
            expect(fixture.get("proofMode") == "PASS_TO_FAIL_GATE", f"{family}: proof mode drift")
            expect(fixture.get("controlPrimaryGateResult") == "PASS", f"{family}: control gate drift")
            expect(fixture.get("mutatedPrimaryGateResult") == "FAIL", f"{family}: mutated gate drift")
            expect(fixture.get("primaryGateId") in fixture.get("changedGateIds", []), f"{family}: primary gate unchanged")
        if family == "CRYPTOGRAPHIC_SIGNATURE":
            expect(
                fixture.get("proofMode") == "REJECTION_PRESERVING_BYTE_DELTA",
                "signature proof mode drift",
            )
            expect(fixture.get("storageDeltaCount") == "2", "signature mirrored storage delta drift")
        if family == "CRYPTOGRAPHIC_GUARD":
            expect(fixture.get("proofMode") == "REJECTION_REASON_DELTA", "guard proof mode drift")
            expect(
                fixture.get("controlVerificationReason")
                != fixture.get("mutatedVerificationReason"),
                "guard verification reason unchanged",
            )
        if family == "EXPECTED_TARGET":
            expect(
                fixture.get("controlInputCanonicalSha256")
                == fixture.get("mutatedInputCanonicalSha256"),
                "target reorder unexpectedly changes canonical commitment",
            )
            expect(
                fixture.get("controlInputOrderedSha256")
                != fixture.get("mutatedInputOrderedSha256"),
                "target reorder is not bound by ordered commitment",
            )
        else:
            expect(
                fixture.get("controlInputCanonicalSha256")
                != fixture.get("mutatedInputCanonicalSha256"),
                f"{family}: canonical input commitment unchanged",
            )
    summary = artifact.get("summary", {})
    expect(summary.get("fixtureCount") == str(len(FUZZ_FAMILIES)), "minimal summary count drift")
    expect(summary.get("allControlsRejected") is True, "minimal summary control rejection drift")
    expect(summary.get("allMutationsRejected") is True, "minimal summary mutation rejection drift")
    expect(
        summary.get("fixtureSetCommitmentSha256")
        == canonical_sha256([fixture["fixtureCommitmentSha256"] for fixture in fixtures]),
        "minimal fixture-set commitment drift",
    )
    return errors


def replay_representation_audit(
    base_vectors: dict[str, Any], schema: dict[str, Any]
) -> dict[str, Any]:
    replays = [
        replay_fuzz_case(index, base_vectors, schema)
        for index in range(FUZZ_CASE_COUNT)
    ]
    canonical_commitments = [
        replay["record"]["inputCommitmentSha256"] for replay in replays
    ]
    ordered_commitments = [
        ordered_input_sha256(replay["candidate"], replay["expectedTarget"])
        for replay in replays
    ]
    canonical_groups: dict[str, list[int]] = {}
    ordered_groups: dict[str, list[int]] = {}
    for index, value in enumerate(canonical_commitments):
        canonical_groups.setdefault(value, []).append(index)
    for index, value in enumerate(ordered_commitments):
        ordered_groups.setdefault(value, []).append(index)
    records = []
    for index, replay in enumerate(replays):
        canonical_class = canonical_groups[canonical_commitments[index]]
        ordered_class = ordered_groups[ordered_commitments[index]]
        core = {
            "index": str(index),
            "family": replay["record"]["family"],
            "sourceFuzzCaseName": replay["record"]["name"],
            "sourceCaseCommitmentSha256": replay["record"]["caseCommitmentSha256"],
            "canonicalInputSha256": canonical_commitments[index],
            "orderedInputSha256": ordered_commitments[index],
            "canonicalClassSize": str(len(canonical_class)),
            "orderedClassSize": str(len(ordered_class)),
            "canonicalCollisionExpected": replay["record"]["family"] == "EXPECTED_TARGET",
            "orderedInputUnique": len(ordered_class) == 1,
            "inputOrResultStored": False,
            "accepted": False,
            "receiptIssued": False,
            "reviewCompleted": False,
            "activationAuthorized": False,
            "activationEffect": "NONE",
        }
        records.append(
            {**core, "auditRecordCommitmentSha256": canonical_sha256(core)}
        )
    collision_classes = []
    for canonical_input_sha256, indices in canonical_groups.items():
        if len(indices) <= 1:
            continue
        families = []
        for index in indices:
            family = records[index]["family"]
            if family not in families:
                families.append(family)
        collision_classes.append(
            {
                "canonicalInputSha256": canonical_input_sha256,
                "classSize": str(len(indices)),
                "indices": [str(index) for index in indices],
                "families": families,
                "orderedCommitmentsAllDistinct": len(
                    {ordered_commitments[index] for index in indices}
                )
                == len(indices),
            }
        )
    record_commitments = [
        record["auditRecordCommitmentSha256"] for record in records
    ]
    merkle_levels = representation_audit_merkle_levels(record_commitments)
    merkle_root = merkle_levels[-1][0]
    expected_collision_proofs = []
    for record in records:
        if not record["canonicalCollisionExpected"]:
            continue
        index = int(record["index"])
        proof_core = {
            "index": record["index"],
            "family": record["family"],
            "sourceFuzzCaseName": record["sourceFuzzCaseName"],
            "auditRecordCommitmentSha256": record["auditRecordCommitmentSha256"],
            "leafSha256": representation_audit_leaf_sha256(
                record["auditRecordCommitmentSha256"]
            ),
            "path": representation_audit_merkle_proof(record_commitments, index),
            "proofVerifiedToPublishedRoot": True,
            "inputOrResultStored": False,
            "accepted": False,
            "receiptIssued": False,
            "reviewCompleted": False,
            "activationAuthorized": False,
            "activationEffect": "NONE",
        }
        expected_collision_proofs.append(
            {
                **proof_core,
                "proofCommitmentSha256": canonical_sha256(proof_core),
            }
        )
    collision_indices = [int(proof["index"]) for proof in expected_collision_proofs]
    multiproof_nodes = representation_audit_merkle_multiproof(
        record_commitments, collision_indices
    )
    multiproof_core = {
        "family": "EXPECTED_TARGET",
        "treeLeafCount": str(len(record_commitments)),
        "recordCount": str(len(collision_indices)),
        "recordIndices": [str(index) for index in collision_indices],
        "proofNodes": multiproof_nodes,
        "proofNodeCount": str(len(multiproof_nodes)),
        "proofVerifiedToPublishedRoot": True,
        "minimalNodeSet": True,
        "equivalentToIndividualProofs": True,
        "inputOrResultStored": False,
        "accepted": False,
        "receiptIssued": False,
        "reviewCompleted": False,
        "activationAuthorized": False,
        "activationEffect": "NONE",
    }
    expected_collision_multiproof = {
        **multiproof_core,
        "multiproofCommitmentSha256": canonical_sha256(multiproof_core),
    }
    return {
        "records": records,
        "canonicalCollisionClasses": collision_classes,
        "recordMerkleRootSha256": merkle_root,
        "expectedCollisionProofs": expected_collision_proofs,
        "expectedCollisionMultiproof": expected_collision_multiproof,
    }


def validate_representation_audit(artifact: Any) -> list[str]:
    errors: list[str] = []

    def expect(condition: bool, message: str) -> None:
        if not condition:
            errors.append(message)

    schema = read_json(SCHEMA_PATH)
    base_vectors = read_json(DEFAULT_VECTORS)
    fuzz_vectors = read_json(DEFAULT_FUZZ_VECTORS)
    expect(artifact.get("auditVersion") == 1, "representation audit version drift")
    expect(
        artifact.get("auditId")
        == "iat-promotions-dlc-positive-campaign-vector-representation-audit-v1",
        "representation audit ID drift",
    )
    status = artifact.get("status", {})
    expect(status.get("labels") == HOLD_LABELS, "representation HOLD labels drift")
    expect(status.get("network") == "NONE", "representation audit must remain network-free")
    expect(status.get("programId") is None, "representation audit claims a program ID")
    expect(status.get("deployable") is False, "representation audit claims deployability")
    expect(status.get("auditApplied") is False, "representation audit claims application")
    expect(status.get("positiveVectorAvailable") is False, "representation audit claims a positive vector")
    expect(
        status.get("positiveVectorReviewCompleted") is False,
        "representation audit claims review completion",
    )
    expect(
        status.get("positiveVectorIntegrationBlocked") is True,
        "representation audit released integration HOLD",
    )
    contract = artifact.get("contract", {})
    expect(
        contract.get("mode") == "CROSS_RUNTIME_REPRESENTATION_AUDIT_REJECTION_ONLY",
        "representation mode drift",
    )
    expect(contract.get("caseCount") == FUZZ_CASE_COUNT, "representation case count drift")
    expect(
        contract.get("expectedCanonicalCollisionFamilies") == ["EXPECTED_TARGET"],
        "representation expected collision family drift",
    )
    expect(
        contract.get("expectedCanonicalCollisionClassCount") == 1,
        "representation collision class contract drift",
    )
    expect(
        contract.get("expectedCanonicalCollisionCaseCount") == 26,
        "representation collision case contract drift",
    )
    expect(contract.get("orderedInputsMustBeUnique") is True, "ordered-input uniqueness disabled")
    expect(contract.get("storesInputsOrFullResults") is False, "representation audit stores full evidence")
    expect(contract.get("everyCaseRejected") is True, "representation audit claims acceptance")
    for field in [
        "validPositiveCampaignVectorPublished",
        "signingMaterialIncluded",
        "createsKeys",
        "createsSignatures",
        "issuesReviewReceipts",
        "completesReview",
        "activationAuthorized",
    ]:
        expect(contract.get(field) is False, f"representation contract {field} drift")
    expect(contract.get("activationEffect") == "NONE", "representation activation effect drift")
    merkle_contract = artifact.get("merkleContract", {})
    expect(merkle_contract.get("hash") == "SHA-256", "representation Merkle hash drift")
    expect(
        merkle_contract.get("leafDomain") == REPRESENTATION_MERKLE_LEAF_DOMAIN,
        "representation Merkle leaf domain drift",
    )
    expect(
        merkle_contract.get("nodeDomain") == REPRESENTATION_MERKLE_NODE_DOMAIN,
        "representation Merkle node domain drift",
    )
    expect(
        merkle_contract.get("ordering") == "records in ascending numeric index order",
        "representation Merkle ordering drift",
    )
    expect(merkle_contract.get("oddNode") == "duplicate final node", "representation odd-node contract drift")
    expect(merkle_contract.get("proofFamily") == "EXPECTED_TARGET", "representation proof family drift")
    expect(merkle_contract.get("proofCount") == 26, "representation proof count contract drift")
    expect(merkle_contract.get("proofPathLength") == 8, "representation proof path-length drift")
    expect(
        merkle_contract.get("publishesProofsForAcceptedVectors") is False,
        "representation proof contract claims accepted vectors",
    )
    expect(merkle_contract.get("multiproofCount") == 1, "representation multiproof count drift")
    expect(merkle_contract.get("multiproofNodeCount") == 84, "representation multiproof node count drift")
    expect(merkle_contract.get("individualProofNodeCount") == 208, "representation individual proof-node count drift")
    expect(merkle_contract.get("multiproofSavedNodeCount") == 124, "representation multiproof savings drift")
    expect(merkle_contract.get("multiproofRequiresExactTreeLeafCount") is True, "representation multiproof tree-size binding disabled")
    expect(merkle_contract.get("multiproofRequiresMinimalNodeSet") is True, "representation multiproof minimality disabled")
    expect(merkle_contract.get("multiproofEquivalentToIndividualProofs") is True, "representation proof equivalence disabled")
    sources = artifact.get("sources", {})
    expect(
        sources.get("fuzzVectors", {}).get("canonicalSha256")
        == canonical_sha256(fuzz_vectors),
        "representation fuzz-vector source digest drift",
    )
    expect(
        sources.get("fuzzGenerator", {}).get("normalizedTextSha256")
        == normalized_text_sha256(FUZZ_GENERATOR_PATH),
        "representation fuzz generator source digest drift",
    )
    expect(
        sources.get("pythonVerifier", {}).get("normalizedTextSha256")
        == normalized_text_sha256(Path(__file__).resolve()),
        "representation Python verifier source digest drift",
    )
    expect(
        sources.get("generator", {}).get("normalizedTextSha256")
        == normalized_text_sha256(REPRESENTATION_GENERATOR_PATH),
        "representation generator source digest drift",
    )
    replay = replay_representation_audit(base_vectors, schema)
    records = artifact.get("records", [])
    expect(isinstance(records, list) and len(records) == FUZZ_CASE_COUNT, "representation record count drift")
    expect(records == replay["records"], "representation records do not independently replay")
    expect(
        artifact.get("canonicalCollisionClasses")
        == replay["canonicalCollisionClasses"],
        "representation collision classes do not independently replay",
    )
    expect(
        artifact.get("expectedCollisionProofs")
        == replay["expectedCollisionProofs"],
        "representation inclusion proofs do not independently replay",
    )
    expect(
        artifact.get("expectedCollisionMultiproof")
        == replay["expectedCollisionMultiproof"],
        "representation multiproof does not independently replay",
    )
    ordered: set[str] = set()
    canonical: set[str] = set()
    for index, record in enumerate(records if isinstance(records, list) else []):
        name = record.get("sourceFuzzCaseName", "UNKNOWN")
        expect(record.get("index") == str(index), f"representation index drift at {index}")
        expect(record.get("orderedClassSize") == "1", f"{name}: ordered input duplicated")
        expect(record.get("orderedInputUnique") is True, f"{name}: ordered uniqueness drift")
        expect(record.get("inputOrResultStored") is False, f"{name}: claims stored evidence")
        expect(record.get("accepted") is False, f"{name}: claims acceptance")
        expect(record.get("receiptIssued") is False, f"{name}: claims receipt issuance")
        expect(record.get("reviewCompleted") is False, f"{name}: claims review completion")
        expect(record.get("activationAuthorized") is False, f"{name}: claims activation authority")
        expect(record.get("activationEffect") == "NONE", f"{name}: claims activation effect")
        expect(record.get("orderedInputSha256") not in ordered, f"{name}: repeats ordered commitment")
        ordered.add(record.get("orderedInputSha256"))
        canonical.add(record.get("canonicalInputSha256"))
        if record.get("family") == "EXPECTED_TARGET":
            expect(record.get("canonicalCollisionExpected") is True, f"{name}: expected collision hidden")
            expect(record.get("canonicalClassSize") == "26", f"{name}: collision class size drift")
        else:
            expect(record.get("canonicalCollisionExpected") is False, f"{name}: unexpected collision claimed")
            expect(record.get("canonicalClassSize") == "1", f"{name}: unexpected canonical collision")
    collision_classes = artifact.get("canonicalCollisionClasses", [])
    expect(len(collision_classes) == 1, "representation collision class count drift")
    if collision_classes:
        collision = collision_classes[0]
        expect(collision.get("classSize") == "26", "representation collision size drift")
        expect(collision.get("families") == ["EXPECTED_TARGET"], "representation collision family drift")
        expect(
            collision.get("orderedCommitmentsAllDistinct") is True,
            "ordered commitments do not split canonical collision",
        )
    summary = artifact.get("summary", {})
    expect(summary.get("caseCount") == "256", "representation summary case count drift")
    expect(summary.get("canonicalUniqueCount") == "231", "representation canonical unique count drift")
    expect(summary.get("orderedUniqueCount") == "256", "representation ordered unique count drift")
    expect(summary.get("canonicalCollisionClassCount") == "1", "representation collision class drift")
    expect(summary.get("canonicalCollisionCaseCount") == "26", "representation collision case drift")
    expect(summary.get("unexpectedCanonicalCollisionCount") == "0", "unexpected canonical collision reported")
    expect(summary.get("duplicateOrderedInputCount") == "0", "duplicate ordered input reported")
    expect(summary.get("allRejected") is True, "representation summary rejection drift")
    expect(len(canonical) == 231, "representation calculated canonical unique count drift")
    expect(len(ordered) == 256, "representation calculated ordered unique count drift")
    expect(
        summary.get("auditRecordSetCommitmentSha256")
        == canonical_sha256([record["auditRecordCommitmentSha256"] for record in records]),
        "representation record-set commitment drift",
    )
    expect(
        summary.get("auditRecordMerkleRootSha256")
        == replay["recordMerkleRootSha256"],
        "representation Merkle root drift",
    )
    proofs = artifact.get("expectedCollisionProofs", [])
    expect(isinstance(proofs, list) and len(proofs) == 26, "representation inclusion-proof count drift")
    expect(summary.get("expectedCollisionProofCount") == "26", "representation proof summary count drift")
    expected_proof_indices = [
        record["index"] for record in records if record.get("family") == "EXPECTED_TARGET"
    ]
    expect(
        [proof.get("index") for proof in proofs] == expected_proof_indices,
        "representation proofs do not cover exactly the expected collision class",
    )
    for proof in proofs:
        index = int(proof.get("index", -1))
        record = records[index] if 0 <= index < len(records) else {}
        expect(proof.get("family") == "EXPECTED_TARGET", f"{index} proof family drift")
        expect(proof.get("sourceFuzzCaseName") == record.get("sourceFuzzCaseName"), f"{index} proof source drift")
        expect(
            proof.get("auditRecordCommitmentSha256")
            == record.get("auditRecordCommitmentSha256"),
            f"{index} proof record drift",
        )
        expect(
            proof.get("leafSha256")
            == representation_audit_leaf_sha256(proof.get("auditRecordCommitmentSha256", "")),
            f"{index} proof leaf drift",
        )
        expect(
            isinstance(proof.get("path"), list) and len(proof.get("path", [])) == 8,
            f"{index} proof path-length drift",
        )
        expect(
            verify_representation_audit_merkle_proof(
                proof.get("auditRecordCommitmentSha256", ""),
                index,
                proof.get("path"),
                replay["recordMerkleRootSha256"],
            ),
            f"{index} inclusion proof does not reach the published root",
        )
        for field in [
            "inputOrResultStored",
            "accepted",
            "receiptIssued",
            "reviewCompleted",
            "activationAuthorized",
        ]:
            expect(proof.get(field) is False, f"{index} proof {field} drift")
        expect(proof.get("proofVerifiedToPublishedRoot") is True, f"{index} proof verification claim drift")
        expect(proof.get("activationEffect") == "NONE", f"{index} proof activation effect drift")
        proof_core = {key: value for key, value in proof.items() if key != "proofCommitmentSha256"}
        expect(
            proof.get("proofCommitmentSha256") == canonical_sha256(proof_core),
            f"{index} proof commitment drift",
        )
    expect(
        summary.get("expectedCollisionProofSetCommitmentSha256")
        == canonical_sha256([proof["proofCommitmentSha256"] for proof in proofs]),
        "representation proof-set commitment drift",
    )
    multiproof = artifact.get("expectedCollisionMultiproof", {})
    selected_records = [
        {
            "index": int(proof["index"]),
            "recordCommitmentSha256": proof["auditRecordCommitmentSha256"],
        }
        for proof in proofs
    ]
    expected_multiproof_nodes = representation_audit_merkle_multiproof(
        [record["auditRecordCommitmentSha256"] for record in records],
        [record["index"] for record in selected_records],
    )
    expect(multiproof.get("family") == "EXPECTED_TARGET", "representation multiproof family drift")
    expect(multiproof.get("treeLeafCount") == str(len(records)), "representation multiproof tree leaf-count drift")
    expect(multiproof.get("treeLeafCount") == summary.get("caseCount"), "representation multiproof tree leaf-count is not summary-bound")
    expect(multiproof.get("recordCount") == "26", "representation multiproof record count drift")
    expect(multiproof.get("recordIndices") == expected_proof_indices, "representation multiproof membership drift")
    expect(multiproof.get("proofNodeCount") == "84", "representation multiproof compact node count drift")
    expect(multiproof.get("proofNodes") == expected_multiproof_nodes, "representation multiproof nodes are not minimal or deterministic")
    expect(
        verify_representation_audit_merkle_multiproof(
            selected_records,
            len(records),
            multiproof.get("proofNodes"),
            replay["recordMerkleRootSha256"],
        ),
        "representation multiproof does not reach the published root",
    )
    expect(multiproof.get("proofVerifiedToPublishedRoot") is True, "representation multiproof verification claim drift")
    expect(multiproof.get("minimalNodeSet") is True, "representation multiproof minimality claim drift")
    expect(multiproof.get("equivalentToIndividualProofs") is True, "representation multiproof equivalence claim drift")
    for field in [
        "inputOrResultStored",
        "accepted",
        "receiptIssued",
        "reviewCompleted",
        "activationAuthorized",
    ]:
        expect(multiproof.get(field) is False, f"representation multiproof {field} drift")
    expect(multiproof.get("activationEffect") == "NONE", "representation multiproof activation effect drift")
    multiproof_core = {
        key: value
        for key, value in multiproof.items()
        if key != "multiproofCommitmentSha256"
    }
    expect(
        multiproof.get("multiproofCommitmentSha256")
        == canonical_sha256(multiproof_core),
        "representation multiproof commitment drift",
    )
    expect(summary.get("expectedCollisionMultiproofNodeCount") == "84", "representation multiproof summary node count drift")
    expect(summary.get("expectedCollisionIndividualProofNodeCount") == "208", "representation individual-proof summary count drift")
    expect(summary.get("expectedCollisionMultiproofSavedNodeCount") == "124", "representation multiproof summary savings drift")
    expect(
        summary.get("expectedCollisionMultiproofCommitmentSha256")
        == multiproof.get("multiproofCommitmentSha256"),
        "representation multiproof summary commitment drift",
    )
    return errors


def render_result(valid: bool, errors: list[str], scenario_count: int, output_format: str) -> str:
    result = {
        "valid": valid,
        "errors": errors,
        "scenarioCount": scenario_count,
        "positivePrimitiveControlCount": 2,
        "receiptIssued": False,
        "reviewCompleted": False,
        "activationAuthorized": False,
        "activationEffect": "NONE",
    }
    if output_format == "json":
        return json.dumps(result, ensure_ascii=False, indent=2)
    if valid:
        return (
            f"Independent positive-vector intake verification passed: {scenario_count} "
            "rejected scenarios; no receipt, review, or activation authority."
        )
    return "Independent positive-vector intake verification failed:\n" + "\n".join(
        f"- {error}" for error in errors
    )


def render_differential_result(
    valid: bool, errors: list[str], mutation_count: int, output_format: str
) -> str:
    result = {
        "valid": valid,
        "errors": errors,
        "mutationCount": mutation_count,
        "nodeAndPythonMatchExactly": valid,
        "receiptIssued": False,
        "reviewCompleted": False,
        "activationAuthorized": False,
        "activationEffect": "NONE",
    }
    if output_format == "json":
        return json.dumps(result, ensure_ascii=False, indent=2)
    if valid:
        return (
            f"Independent differential intake verification passed: {mutation_count} "
            "mutations match Node and remain rejected and non-authoritative."
        )
    return "Independent differential intake verification failed:\n" + "\n".join(
        f"- {error}" for error in errors
    )


def render_fuzz_result(
    valid: bool, errors: list[str], mutation_count: int, merkle_root: str | None,
    output_format: str
) -> str:
    result = {
        "valid": valid,
        "errors": errors,
        "mutationCount": mutation_count,
        "seedHex": f"{FUZZ_SEED:08x}",
        "familyCount": len(FUZZ_FAMILIES),
        "nodeAndPythonMatchExactly": valid,
        "allRejected": valid,
        "caseCommitmentMerkleRootSha256": merkle_root,
        "receiptIssued": False,
        "reviewCompleted": False,
        "activationAuthorized": False,
        "activationEffect": "NONE",
    }
    if output_format == "json":
        return json.dumps(result, ensure_ascii=False, indent=2)
    if valid:
        return (
            f"Independent seeded intake fuzz verification passed: {mutation_count} "
            "mutations match Node and remain rejected and non-authoritative."
        )
    return "Independent seeded intake fuzz verification failed:\n" + "\n".join(
        f"- {error}" for error in errors
    )


def render_minimal_result(
    valid: bool, errors: list[str], fixture_count: int,
    fixture_set_commitment: str | None, output_format: str
) -> str:
    result = {
        "valid": valid,
        "errors": errors,
        "fixtureCount": fixture_count,
        "familyCount": len(FUZZ_FAMILIES),
        "nodeAndPythonMatchExactly": valid,
        "oneSemanticDeltaPerFixture": valid,
        "fixtureSetCommitmentSha256": fixture_set_commitment,
        "receiptIssued": False,
        "reviewCompleted": False,
        "activationAuthorized": False,
        "activationEffect": "NONE",
    }
    if output_format == "json":
        return json.dumps(result, ensure_ascii=False, indent=2)
    if valid:
        return (
            f"Independent minimal-counterexample verification passed: {fixture_count} "
            "families reproduce one semantic delta each and remain rejected."
        )
    return "Independent minimal-counterexample verification failed:\n" + "\n".join(
        f"- {error}" for error in errors
    )


def render_representation_result(
    valid: bool,
    errors: list[str],
    case_count: int,
    canonical_unique_count: int,
    ordered_unique_count: int,
    record_set_commitment: str | None,
    record_merkle_root: str | None,
    expected_collision_proof_count: int,
    proof_set_commitment: str | None,
    multiproof_node_count: int,
    individual_proof_node_count: int,
    multiproof_saved_node_count: int,
    multiproof_commitment: str | None,
    output_format: str,
) -> str:
    result = {
        "valid": valid,
        "errors": errors,
        "caseCount": case_count,
        "canonicalUniqueCount": canonical_unique_count,
        "orderedUniqueCount": ordered_unique_count,
        "expectedCanonicalCollisionClassCount": 1,
        "nodeAndPythonMatchExactly": valid,
        "allRejected": valid,
        "auditRecordSetCommitmentSha256": record_set_commitment,
        "auditRecordMerkleRootSha256": record_merkle_root,
        "expectedCollisionProofCount": expected_collision_proof_count,
        "expectedCollisionProofSetCommitmentSha256": proof_set_commitment,
        "expectedCollisionMultiproofNodeCount": multiproof_node_count,
        "expectedCollisionIndividualProofNodeCount": individual_proof_node_count,
        "expectedCollisionMultiproofSavedNodeCount": multiproof_saved_node_count,
        "expectedCollisionMultiproofCommitmentSha256": multiproof_commitment,
        "receiptIssued": False,
        "reviewCompleted": False,
        "activationAuthorized": False,
        "activationEffect": "NONE",
    }
    if output_format == "json":
        return json.dumps(result, ensure_ascii=False, indent=2)
    if valid:
        return (
            f"Independent representation audit passed: {case_count} ordered inputs "
            f"are unique across {canonical_unique_count} canonical classes."
        )
    return "Independent representation audit failed:\n" + "\n".join(
        f"- {error}" for error in errors
    )


def main(argv: list[str] | None = None) -> int:
    try:
        parser = OfflineArgumentParser(description=__doc__)
        parser.add_argument("--vectors", type=Path, default=DEFAULT_VECTORS)
        parser.add_argument(
            "--differential-vectors", type=Path, default=DEFAULT_DIFFERENTIAL_VECTORS
        )
        parser.add_argument("--fuzz-vectors", type=Path, default=DEFAULT_FUZZ_VECTORS)
        parser.add_argument(
            "--minimal-counterexamples",
            type=Path,
            default=DEFAULT_MINIMAL_COUNTEREXAMPLES,
        )
        parser.add_argument(
            "--representation-audit",
            type=Path,
            default=DEFAULT_REPRESENTATION_AUDIT,
        )
        parser.add_argument("--verify-vectors", action="store_true")
        parser.add_argument("--verify-differential-vectors", action="store_true")
        parser.add_argument("--verify-fuzz-vectors", action="store_true")
        parser.add_argument("--verify-minimal-counterexamples", action="store_true")
        parser.add_argument("--verify-representation-audit", action="store_true")
        parser.add_argument("--format", choices=["text", "json"], default="text")
        args = parser.parse_args(argv)
        selected_modes = sum([
            args.verify_vectors,
            args.verify_differential_vectors,
            args.verify_fuzz_vectors,
            args.verify_minimal_counterexamples,
            args.verify_representation_audit,
        ])
        if selected_modes != 1:
            raise CliUsageError(
                "exactly one of --verify-vectors, --verify-differential-vectors, "
                "--verify-fuzz-vectors, --verify-minimal-counterexamples, or "
                "--verify-representation-audit is required"
            )
        if args.verify_vectors:
            vectors = read_json(args.vectors)
            errors = validate_bundle(vectors)
        elif args.verify_differential_vectors:
            vectors = read_json(args.differential_vectors)
            errors = validate_differential_bundle(vectors)
        elif args.verify_fuzz_vectors:
            vectors = read_json(args.fuzz_vectors)
            errors = validate_fuzz_bundle(vectors)
        elif args.verify_minimal_counterexamples:
            vectors = read_json(args.minimal_counterexamples)
            errors = validate_minimal_counterexamples(vectors)
        else:
            vectors = read_json(args.representation_audit)
            errors = validate_representation_audit(vectors)
    except (CliUsageError, OSError, UnicodeError, json.JSONDecodeError, ValueError) as error:
        print(f"Unable to read public intake vectors: {error}", file=sys.stderr)
        return 1
    case_count = len(vectors.get("scenarios", [])) if isinstance(vectors, dict) else 0
    if args.verify_vectors:
        print(render_result(not errors, errors, case_count, args.format))
    elif args.verify_differential_vectors:
        print(render_differential_result(not errors, errors, case_count, args.format))
    elif args.verify_fuzz_vectors:
        fuzz_cases = vectors.get("cases", []) if isinstance(vectors, dict) else []
        fuzz_count = len(fuzz_cases) if isinstance(fuzz_cases, list) else 0
        merkle_root = vectors.get("summary", {}).get("caseCommitmentMerkleRootSha256")
        print(render_fuzz_result(not errors, errors, fuzz_count, merkle_root, args.format))
    elif args.verify_minimal_counterexamples:
        fixtures = vectors.get("fixtures", []) if isinstance(vectors, dict) else []
        fixture_count = len(fixtures) if isinstance(fixtures, list) else 0
        set_commitment = vectors.get("summary", {}).get("fixtureSetCommitmentSha256")
        print(render_minimal_result(
            not errors,
            errors,
            fixture_count,
            set_commitment,
            args.format,
        ))
    else:
        records = vectors.get("records", []) if isinstance(vectors, dict) else []
        summary = vectors.get("summary", {}) if isinstance(vectors, dict) else {}
        print(render_representation_result(
            not errors,
            errors,
            len(records) if isinstance(records, list) else 0,
            int(summary.get("canonicalUniqueCount", 0)),
            int(summary.get("orderedUniqueCount", 0)),
            summary.get("auditRecordSetCommitmentSha256"),
            summary.get("auditRecordMerkleRootSha256"),
            int(summary.get("expectedCollisionProofCount", 0)),
            summary.get("expectedCollisionProofSetCommitmentSha256"),
            int(summary.get("expectedCollisionMultiproofNodeCount", 0)),
            int(summary.get("expectedCollisionIndividualProofNodeCount", 0)),
            int(summary.get("expectedCollisionMultiproofSavedNodeCount", 0)),
            summary.get("expectedCollisionMultiproofCommitmentSha256"),
            args.format,
        ))
    return 0 if not errors else 2


if __name__ == "__main__":
    raise SystemExit(main())
