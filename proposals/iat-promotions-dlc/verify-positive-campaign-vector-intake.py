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
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent
DEFAULT_VECTORS = ROOT / "positive-campaign-vector-intake-vectors.v1.json"
DEFAULT_DIFFERENTIAL_VECTORS = (
    ROOT / "positive-campaign-vector-intake-differential-vectors.v1.json"
)
SCHEMA_PATH = ROOT / "positive-campaign-vector-intake.schema.v1.json"
CAMPAIGN_VECTORS_PATH = ROOT / "campaign-envelope-verification-vectors.v1.json"
EVALUATOR_PATH = ROOT / "positive-campaign-vector-intake.mjs"
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


def main(argv: list[str] | None = None) -> int:
    try:
        parser = OfflineArgumentParser(description=__doc__)
        parser.add_argument("--vectors", type=Path, default=DEFAULT_VECTORS)
        parser.add_argument(
            "--differential-vectors", type=Path, default=DEFAULT_DIFFERENTIAL_VECTORS
        )
        parser.add_argument("--verify-vectors", action="store_true")
        parser.add_argument("--verify-differential-vectors", action="store_true")
        parser.add_argument("--format", choices=["text", "json"], default="text")
        args = parser.parse_args(argv)
        if args.verify_vectors == args.verify_differential_vectors:
            raise CliUsageError(
                "exactly one of --verify-vectors or --verify-differential-vectors is required"
            )
        if args.verify_vectors:
            vectors = read_json(args.vectors)
            errors = validate_bundle(vectors)
        else:
            vectors = read_json(args.differential_vectors)
            errors = validate_differential_bundle(vectors)
    except (CliUsageError, OSError, UnicodeError, json.JSONDecodeError, ValueError) as error:
        print(f"Unable to read public intake vectors: {error}", file=sys.stderr)
        return 1
    case_count = len(vectors.get("scenarios", [])) if isinstance(vectors, dict) else 0
    if args.verify_vectors:
        print(render_result(not errors, errors, case_count, args.format))
    else:
        print(render_differential_result(not errors, errors, case_count, args.format))
    return 0 if not errors else 2


if __name__ == "__main__":
    raise SystemExit(main())
