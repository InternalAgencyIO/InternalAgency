#!/usr/bin/env python3
"""
Independent zero-dependency reviewer-input structural preflight.
DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE

This verifier intentionally implements only the Draft-07 keyword subset used
by the two fixed reviewer-input schemas. It reads local JSON, emits structural
diagnostics, and cannot perform semantic review, issue a receipt, sign, access
a wallet or network, or authorize activation.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent
CANDIDATE_SCHEMA_PATH = ROOT / "reviewer-candidate.schema.v1.json"
EXPECTED_TARGET_SCHEMA_PATH = ROOT / "reviewer-expected-target.schema.v1.json"
VECTOR_PATH = ROOT / "reviewer-bundle-preflight-vectors.v1.json"
HOLD_LABELS = [
    "DRAFT",
    "INACTIVE",
    "NOT PART OF GENESIS",
    "NOT DEPLOYED",
    "NO CLAIM ROUTE",
]


class CliUsageError(ValueError):
    """Raised when CLI arguments do not describe one supported offline mode."""


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


def decode_pointer_segment(segment: str) -> str:
    return segment.replace("~1", "/").replace("~0", "~")


def encode_pointer_segment(segment: str) -> str:
    return segment.replace("~", "~0").replace("/", "~1")


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
    raise TypeError(f"unsupported JSON value type: {type(value).__name__}")


def compact_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def deep_equal(left: Any, right: Any) -> bool:
    return compact_json(left) == compact_json(right)


def resolve_local_ref(root_schema: dict[str, Any], reference: Any) -> dict[str, Any]:
    if not isinstance(reference, str) or not reference.startswith("#/"):
        raise ValueError("ONLY_LOCAL_SCHEMA_REFS_SUPPORTED")
    current: Any = root_schema
    for segment in map(decode_pointer_segment, reference[2:].split("/")):
        if not isinstance(current, dict) or segment not in current:
            raise ValueError("SCHEMA_REF_NOT_FOUND")
        current = current[segment]
    if not isinstance(current, dict):
        raise ValueError("SCHEMA_REF_NOT_OBJECT")
    return current


def javascript_string_length(value: str) -> int:
    return len(value.encode("utf-16-le", errors="surrogatepass")) // 2


def validate_json_schema_subset(schema: dict[str, Any], instance: Any) -> list[dict[str, str]]:
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
            reference = node["$ref"]
            visit(resolve_local_ref(schema, reference), value, instance_path, reference)
            return
        if "const" in node and not deep_equal(value, node["const"]):
            add(instance_path, f"{schema_path}/const", "const", "must equal the fixed value")
            return
        if "enum" in node and not any(deep_equal(value, candidate) for candidate in node["enum"]):
            add(instance_path, f"{schema_path}/enum", "enum", "must equal one allowed value")
            return
        if "type" in node:
            actual = instance_type(value)
            allowed = node["type"] if isinstance(node["type"], list) else [node["type"]]
            type_matches = any(
                candidate == actual or (candidate == "number" and actual == "integer")
                for candidate in allowed
            )
            if not type_matches:
                add(
                    instance_path,
                    f"{schema_path}/type",
                    "type",
                    f"must be {' or '.join(allowed)}",
                )
                return
        if isinstance(value, str):
            if "pattern" in node and re.search(node["pattern"], value) is None:
                add(instance_path, f"{schema_path}/pattern", "pattern", "must match the fixed pattern")
            length = javascript_string_length(value)
            if "minLength" in node and length < node["minLength"]:
                add(instance_path, f"{schema_path}/minLength", "minLength", "is too short")
            if "maxLength" in node and length > node["maxLength"]:
                add(instance_path, f"{schema_path}/maxLength", "maxLength", "is too long")
        if isinstance(value, list):
            if "minItems" in node and len(value) < node["minItems"]:
                add(instance_path, f"{schema_path}/minItems", "minItems", "has too few items")
            if "maxItems" in node and len(value) > node["maxItems"]:
                add(instance_path, f"{schema_path}/maxItems", "maxItems", "has too many items")
            if node.get("uniqueItems") is True:
                serialized = [compact_json(item) for item in value]
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
            properties = node.get("properties", {})
            for key, child in value.items():
                child_path = f"{instance_path}/{encode_pointer_segment(key)}"
                if key in properties:
                    visit(properties[key], child, child_path, f"{schema_path}/properties/{key}")
                elif node.get("additionalProperties") is False:
                    add(
                        child_path,
                        f"{schema_path}/additionalProperties",
                        "additionalProperties",
                        "is not allowed",
                    )

    visit(schema, instance, "", "#")
    return errors


def document_result(document: str, schema: dict[str, Any], value: Any) -> dict[str, Any]:
    errors = validate_json_schema_subset(schema, value)
    return {"document": document, "valid": len(errors) == 0, "errors": errors}


def preflight_reviewer_inputs(
    candidate: Any,
    expected_target: Any,
    candidate_schema: dict[str, Any],
    expected_target_schema: dict[str, Any],
) -> dict[str, Any]:
    documents = [
        document_result("CANDIDATE", candidate_schema, candidate),
        document_result("EXPECTED_TARGET", expected_target_schema, expected_target),
    ]
    structural_valid = all(document["valid"] for document in documents)
    return {
        "preflightVersion": 1,
        "preflightId": "iat-promotions-dlc-reviewer-input-preflight-v1",
        "status": {
            "labels": HOLD_LABELS,
            "network": "NONE",
            "programId": None,
            "deployable": False,
            "schemaApplied": False,
        },
        "structuralValid": structural_valid,
        "semanticEvaluationAllowed": structural_valid,
        "semanticEvaluationRan": False,
        "documents": documents,
        "receiptIssued": False,
        "reviewCompletedByThisPreflight": False,
        "activationAuthorized": False,
        "activationEffect": "NONE",
    }


def escape_table_cell(value: Any) -> str:
    escaped = str(value).replace("\\", "\\\\").replace("|", "\\|")
    return re.sub(r"\r?\n", " ", escaped)


def render_reviewer_input_preflight(preflight: dict[str, Any]) -> str:
    errors = [
        {**error, "document": document["document"]}
        for document in preflight["documents"]
        for error in document["errors"]
    ]
    if errors:
        rows = [
            " ".join(
                [
                    "|",
                    escape_table_cell(error["document"]),
                    "|",
                    escape_table_cell(error["instancePath"] or "/"),
                    "|",
                    escape_table_cell(error["keyword"]),
                    "|",
                    escape_table_cell(error["message"]),
                    "|",
                ]
            )
            for error in errors
        ]
    else:
        rows = ["| — | — | — | No structural errors |"]
    lines = [
        "# Offline reviewer-input structural preflight",
        "",
        "> **DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE**",
        "",
        f"- Structural result: **{'PASS' if preflight['structuralValid'] else 'FAIL'}**",
        f"- Semantic evaluation allowed: **{str(preflight['semanticEvaluationAllowed']).lower()}**",
        f"- Semantic evaluation ran: **{str(preflight['semanticEvaluationRan']).lower()}**",
        f"- Receipt issued: **{str(preflight['receiptIssued']).lower()}**",
        "- Review completed by this preflight: "
        f"**{str(preflight['reviewCompletedByThisPreflight']).lower()}**",
        f"- Activation authorized: **{str(preflight['activationAuthorized']).lower()}**",
        f"- Activation effect: **{preflight['activationEffect']}**",
        "",
        "## JSON Pointer diagnostics",
        "",
        "| Document | Instance pointer | Keyword | Message |",
        "| --- | --- | --- | --- |",
        *rows,
        "",
        "Structural PASS permits the separate six-gate semantic evaluator to run; it",
        "does not establish target authenticity, accept a review, issue a receipt, or",
        "authorize activation.",
        "",
    ]
    return "\n".join(lines)


def verify_vectors(vector_path: Path) -> dict[str, Any]:
    vectors = read_json(vector_path)
    candidate_schema = read_json(CANDIDATE_SCHEMA_PATH)
    expected_target_schema = read_json(EXPECTED_TARGET_SCHEMA_PATH)
    errors: list[str] = []
    scenarios = vectors.get("scenarios", [])
    for scenario in scenarios:
        name = scenario.get("name", "UNNAMED")
        reproduced = preflight_reviewer_inputs(
            scenario.get("candidate"),
            scenario.get("expectedTarget"),
            candidate_schema,
            expected_target_schema,
        )
        if reproduced != scenario.get("result"):
            errors.append(f"{name}: result differs from independent Python preflight")
        if reproduced["structuralValid"] != scenario.get("expectedStructuralValid"):
            errors.append(f"{name}: expectedStructuralValid differs")
        if reproduced["semanticEvaluationRan"] is not False:
            errors.append(f"{name}: semantic evaluation ran")
        if reproduced["receiptIssued"] is not False:
            errors.append(f"{name}: receipt was issued")
        if reproduced["reviewCompletedByThisPreflight"] is not False:
            errors.append(f"{name}: review completion was claimed")
        if reproduced["activationAuthorized"] is not False or reproduced["activationEffect"] != "NONE":
            errors.append(f"{name}: activation authority was claimed")
    return {"valid": not errors, "errors": errors, "scenarioCount": len(scenarios)}


def emit_json(value: Any) -> None:
    print(json.dumps(value, ensure_ascii=False, indent=2))


def parse_arguments() -> argparse.Namespace:
    parser = OfflineArgumentParser(
        description="Independently reproduce held reviewer-input structural preflight diagnostics."
    )
    parser.add_argument("--candidate", type=Path)
    parser.add_argument("--expected-target", type=Path)
    parser.add_argument("--vectors", type=Path, default=VECTOR_PATH)
    parser.add_argument("--verify-vectors", action="store_true")
    parser.add_argument("--format", choices=["json", "markdown"], default="json")
    arguments = parser.parse_args()
    has_candidate = arguments.candidate is not None
    has_target = arguments.expected_target is not None
    if arguments.verify_vectors:
        if has_candidate or has_target or arguments.format == "markdown":
            raise CliUsageError("vector verification cannot be combined with input files or Markdown")
    elif not (has_candidate and has_target):
        raise CliUsageError("both --candidate and --expected-target are required")
    return arguments


def main() -> int:
    try:
        arguments = parse_arguments()
        if arguments.verify_vectors:
            report = verify_vectors(arguments.vectors.resolve())
            emit_json(report)
            return 0 if report["valid"] else 1
        candidate_schema = read_json(CANDIDATE_SCHEMA_PATH)
        expected_target_schema = read_json(EXPECTED_TARGET_SCHEMA_PATH)
        preflight = preflight_reviewer_inputs(
            read_json(arguments.candidate.resolve()),
            read_json(arguments.expected_target.resolve()),
            candidate_schema,
            expected_target_schema,
        )
        if arguments.format == "markdown":
            sys.stdout.write(render_reviewer_input_preflight(preflight))
        else:
            emit_json(preflight)
        return 0 if preflight["structuralValid"] else 3
    except (CliUsageError, OSError, UnicodeError, json.JSONDecodeError, ValueError, TypeError) as error:
        print(str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
