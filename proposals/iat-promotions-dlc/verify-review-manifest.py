#!/usr/bin/env python3
"""
Independent zero-dependency verifier for the Promotions DLC review manifest.
DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from pathlib import Path


OUTPUT_RELATIVE_PATH = "review-manifest.v1.json"
HOLD_LABELS = [
    "DRAFT",
    "INACTIVE",
    "NOT PART OF GENESIS",
    "NOT DEPLOYED",
    "NO CLAIM ROUTE",
]
LEAF_DOMAIN = b"iat-promotions-dlc-review-leaf-v1"
NODE_DOMAIN = b"iat-promotions-dlc-review-node-v1"
ROLES = ["ARTIFACT", "GENERATOR", "VALIDATOR", "TEST", "SUPPORTING_SOURCE"]


def classify_review_path(path: str) -> str:
    name = path.rsplit("/", 1)[-1]
    if path.startswith("tests/") and name.endswith(".test.mjs"):
        return "TEST"
    if (name.startswith("generate-") or name.startswith("compose-")) and name.endswith(".mjs"):
        return "GENERATOR"
    if (name.startswith("validate-") and name.endswith(".mjs")) or (
        name.startswith("verify-") and name.endswith(".py")
    ):
        return "VALIDATOR"
    if name.endswith(".md") or name.endswith(".json"):
        return "ARTIFACT"
    if name.endswith(".mjs"):
        return "SUPPORTING_SOURCE"
    raise ValueError(f"unclassified proposal path: {path}")


def normalized_text_bytes(path: Path, relative_path: str) -> bytes:
    try:
        text = path.read_bytes().decode("utf-8", errors="strict")
    except UnicodeDecodeError as error:
        raise ValueError(f"review file is not valid UTF-8 text: {relative_path}") from error
    return text.replace("\r\n", "\n").replace("\r", "\n").encode("utf-8")


def list_review_paths(root: Path) -> list[str]:
    paths: list[str] = []
    for current, directories, files in os.walk(root, followlinks=False):
        current_path = Path(current)
        for name in directories:
            candidate = current_path / name
            if candidate.is_symlink():
                raise ValueError(f"symbolic links are forbidden: {candidate.relative_to(root).as_posix()}")
        for name in files:
            candidate = current_path / name
            relative_path = candidate.relative_to(root).as_posix()
            if candidate.is_symlink():
                raise ValueError(f"symbolic links are forbidden: {relative_path}")
            if not candidate.is_file():
                raise ValueError(f"unsupported filesystem entry: {relative_path}")
            if relative_path != OUTPUT_RELATIVE_PATH:
                paths.append(relative_path)
    return sorted(paths, key=lambda value: value.encode("utf-8"))


def leaf_sha256(entry: dict[str, str]) -> str:
    content_digest = bytes.fromhex(entry["contentSha256"])
    if len(content_digest) != 32:
        raise ValueError(f"invalid content digest: {entry['path']}")
    preimage = b"\x00".join(
        [
            LEAF_DOMAIN,
            entry["path"].encode("utf-8"),
            entry["normalizedByteLength"].encode("ascii"),
            content_digest,
        ]
    )
    return hashlib.sha256(preimage).hexdigest()


def tree_levels(entries: list[dict[str, str]]) -> list[list[str]]:
    if not entries:
        raise ValueError("review manifest cannot have an empty tree")
    levels = [[entry["leafSha256"] for entry in entries]]
    level = [bytes.fromhex(digest) for digest in levels[0]]
    while len(level) > 1:
        next_level: list[bytes] = []
        for index in range(0, len(level), 2):
            left = level[index]
            right = level[index + 1] if index + 1 < len(level) else left
            next_level.append(hashlib.sha256(NODE_DOMAIN + b"\x00" + left + right).digest())
        level = next_level
        levels.append([digest.hex() for digest in level])
    return levels


def generate_review_manifest(root: Path) -> dict[str, object]:
    entries: list[dict[str, str]] = []
    for relative_path in list_review_paths(root):
        content = normalized_text_bytes(root / Path(*relative_path.split("/")), relative_path)
        entry = {
            "path": relative_path,
            "role": classify_review_path(relative_path),
            "normalizedByteLength": str(len(content)),
            "contentSha256": hashlib.sha256(content).hexdigest(),
        }
        entry["leafSha256"] = leaf_sha256(entry)
        entries.append(entry)

    counts = {
        role: str(sum(1 for entry in entries if entry["role"] == role))
        for role in ROLES
    }
    levels = tree_levels(entries)
    return {
        "manifestVersion": 1,
        "manifestId": "iat-promotions-dlc-review-manifest-v1",
        "status": {
            "labels": HOLD_LABELS,
            "network": "NONE",
            "programId": None,
            "deployable": False,
            "manifestApplied": False,
        },
        "hashContract": {
            "hash": "SHA-256",
            "contentBytes": "valid UTF-8 with CRLF and CR normalized to LF",
            "pathBytes": "UTF-8 forward-slash proposal-relative path",
            "ordering": "ascending unsigned UTF-8 path bytes",
            "leafDomain": LEAF_DOMAIN.decode("ascii"),
            "leafPreimage": "domain || 0x00 || path || 0x00 || normalizedByteLength || 0x00 || rawContentSha256",
            "nodeDomain": NODE_DOMAIN.decode("ascii"),
            "nodePreimage": "domain || 0x00 || rawLeftSha256 || rawRightSha256",
            "oddNode": "duplicate final node",
        },
        "selfReference": {
            "path": OUTPUT_RELATIVE_PATH,
            "includedInTree": False,
            "reason": "A manifest cannot contain its own content digest without a recursive fixed-point claim.",
        },
        "summary": {
            "coveredFileCount": str(len(entries)),
            "totalNormalizedByteLength": str(sum(int(entry["normalizedByteLength"]) for entry in entries)),
            "countsByRole": counts,
        },
        "entries": entries,
        "merkleVectors": {
            "leafCount": str(len(entries)),
            "intermediateLevels": [
                {
                    "level": str(index),
                    "nodeCount": str(len(digests)),
                    "nodeSha256": digests,
                }
                for index, digests in enumerate(levels[1:], start=1)
            ],
        },
        "treeRootSha256": levels[-1][0],
    }


def verify(root: Path, manifest_path: Path) -> tuple[list[str], dict[str, object]]:
    errors: list[str] = []
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        return [f"cannot read review manifest: {error}"], {}
    try:
        expected = generate_review_manifest(root)
    except (OSError, UnicodeError, ValueError) as error:
        return [f"cannot regenerate review manifest: {error}"], manifest
    if manifest != expected:
        errors.append("review manifest differs from independent deterministic Python generation")
    return errors, expected


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify the held IAT Promotions DLC review manifest.")
    default_root = Path(__file__).resolve().parent
    parser.add_argument("--root", type=Path, default=default_root)
    parser.add_argument("--manifest", type=Path)
    parser.add_argument("--json", action="store_true", dest="emit_json")
    arguments = parser.parse_args()
    root = arguments.root.resolve()
    manifest_path = arguments.manifest.resolve() if arguments.manifest else root / OUTPUT_RELATIVE_PATH
    errors, expected = verify(root, manifest_path)
    if arguments.emit_json:
        print(json.dumps({"valid": not errors, "errors": errors, "treeRootSha256": expected.get("treeRootSha256")}, separators=(",", ":")))
    elif errors:
        print("\n".join(errors), file=sys.stderr)
    else:
        print(f"Independent Python verification passed: {expected['treeRootSha256']}")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
