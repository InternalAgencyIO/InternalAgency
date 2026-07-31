#!/usr/bin/env python3
"""
Independent zero-dependency semantic replay for compact settlement-contention
evidence. DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE

This verifier reads local proposal files only. It has no RPC, wallet, validator,
transaction, signing, broadcasting, review-completion, or activation capability.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Any


ARTIFACT_NAME = "settlement-contention-vectors.v1.json"
MUTATION_ARTIFACT_NAME = "settlement-contention-mutation-vectors.v1.json"
HOLD_LABELS = [
    "DRAFT",
    "INACTIVE",
    "NOT PART OF GENESIS",
    "NOT DEPLOYED",
    "NO CLAIM ROUTE",
]
HEX64 = re.compile(r"^[0-9a-f]{64}$")
HERO_REWARD = 120_000_000_000
PROPOSER_REWARD = 60_000_000_000
PAIR_REWARD = HERO_REWARD + PROPOSER_REWARD
SCENARIO_DEFINITIONS = [
    ("A_COMMITS_B_TERMINAL", "A", "B", None),
    ("B_COMMITS_A_TERMINAL", "B", "A", None),
    ("A_HERO_FAULT_B_RECOVERS", "A", "B", "AFTER_HERO_TRANSFER"),
    ("A_PROPOSER_FAULT_B_RECOVERS", "A", "B", "AFTER_PROPOSER_TRANSFER"),
    ("B_HERO_FAULT_A_RECOVERS", "B", "A", "AFTER_HERO_TRANSFER"),
    ("B_PROPOSER_FAULT_A_RECOVERS", "B", "A", "AFTER_PROPOSER_TRANSFER"),
]
ZERO_HASH = "0" * 64
MUTATION_DEFINITIONS = [
    ("ROOT_UNKNOWN_PROPERTY", "STRUCTURE", False, {"operation": "add", "path": "/expandedState", "value": {}}, False, False),
    ("SCENARIO_EXPANDED_TIMELINE", "STRUCTURE", False, {"operation": "add", "path": "/scenarios/0/expandedTimeline", "value": []}, False, False),
    ("STATUS_NETWORK_MAINNET", "STATUS", False, {"operation": "replace", "path": "/status/network", "value": "MAINNET"}, False, False),
    ("CONTRACT_RPC_ENABLED", "CAPABILITY", False, {"operation": "replace", "path": "/contract/usesRpc", "value": True}, False, False),
    ("CONTRACT_LOCAL_VALIDATOR_ENABLED", "CAPABILITY", False, {"operation": "replace", "path": "/contract/usesLocalValidator", "value": True}, False, False),
    ("CONTRACT_WALLET_ENABLED", "CAPABILITY", False, {"operation": "replace", "path": "/contract/usesWallet", "value": True}, False, False),
    ("CONTRACT_TRANSACTION_PREPARATION_ENABLED", "CAPABILITY", False, {"operation": "replace", "path": "/contract/preparesTransactions", "value": True}, False, False),
    ("SUMMARY_REVIEW_COMPLETED", "AUTHORITY", False, {"operation": "replace", "path": "/summary/reviewCompleted", "value": True}, False, False),
    ("SCENARIO_ACTIVATION_AUTHORIZED_REBOUND", "AUTHORITY", False, {"operation": "replace", "path": "/scenarios/0/activationAuthorized", "value": True}, True, True),
    ("HERO_REWARD_DRIFT_REBOUND", "ECONOMICS", False, {"operation": "replace", "path": "/scenarios/0/winnerHeroBalanceBaseUnits", "value": "119999999999"}, True, True),
    ("VAULT_BALANCE_DRIFT_REBOUND", "ECONOMICS", False, {"operation": "replace", "path": "/scenarios/0/vaultBalanceBaseUnits", "value": "1"}, True, True),
    ("WINNER_ID_DRIFT_REBOUND", "SEMANTIC_REPLAY", True, {"operation": "replace", "path": "/scenarios/0/winnerAttemptId", "value": "B"}, True, True),
    ("TIMELINE_COMMITMENT_DRIFT_REBOUND", "SEMANTIC_REPLAY", True, {"operation": "replace", "path": "/scenarios/0/timelineCommitmentSha256", "value": ZERO_HASH}, True, True),
    ("SCENARIO_COMMITMENT_DRIFT", "COMMITMENT", True, {"operation": "replace", "path": "/scenarios/0/scenarioCommitmentSha256", "value": ZERO_HASH}, False, False),
    ("SCENARIO_SET_COMMITMENT_DRIFT", "COMMITMENT", True, {"operation": "replace", "path": "/summary/scenarioSetCommitmentSha256", "value": ZERO_HASH}, False, False),
    ("CONTENTION_MODEL_SOURCE_DRIFT", "SOURCE_BINDING", True, {"operation": "replace", "path": "/sources/contentionModel/normalizedTextSha256", "value": ZERO_HASH}, False, False),
]
ROOT_KEYS = {"vectorVersion", "vectorId", "status", "sources", "contract", "summary", "scenarios"}
STATUS_KEYS = {"labels", "network", "programId", "deployable", "vectorsApplied"}
SOURCE_KEYS = {"referenceEngine", "contentionModel", "generator"}
SOURCE_ENTRY_KEYS = {"path", "normalizedTextSha256"}
CONTRACT_KEYS = {
    "mode", "scenarioCount", "timelineStepsPerScenario", "finalSlotStartsAtCompletedPairs",
    "exactWritableLockDerivation", "campaignAndVaultLocksSerializeAllSettlements", "injectedFaults",
    "storesExpandedState", "storesExpandedTimelineOrTrace", "usesLocalValidator", "usesRpc",
    "usesWallet", "preparesTransactions", "signsTransactions", "broadcastsTransactions",
    "issuesReviewReceipts", "completesReview", "activationAuthorized", "activationEffect",
}
SUMMARY_KEYS = {
    "scenarioCount", "lockConflictCount", "rollbackCount", "committedAttemptCount",
    "terminalRejectionCount", "exactFinalCompletedPairsCount", "zeroFinalVaultBalanceCount",
    "allCallersUnchanged", "allLocksReleased", "allLosersUnpaid", "allWinnersPaidExactly",
    "scenarioSetCommitmentSha256", "expandedStateStored", "expandedTimelineOrTraceStored",
    "chainTransactionPrepared", "receiptIssued", "reviewCompleted", "activationAuthorized",
    "activationEffect",
}
SCENARIO_KEYS = {
    "name", "firstAttemptId", "secondAttemptId", "injectedFault", "winnerAttemptId", "loserAttemptId",
    "initialStateSha256", "finalStateSha256", "timelineCommitmentSha256", "traceCommitmentSha256",
    "attemptOutcomeSetCommitmentSha256", "lockConflictCount", "rollbackCount", "committedAttemptCount",
    "terminalRejectionCount", "completedPairs", "vaultBalanceBaseUnits", "winnerHeroBalanceBaseUnits",
    "winnerProposerBalanceBaseUnits", "loserHeroBalanceBaseUnits", "loserProposerBalanceBaseUnits",
    "callerStateUnchanged", "allLocksReleased", "expandedTimelineStored", "expandedTraceStored",
    "attemptInputsStored", "chainTransactionPrepared", "acceptedCampaignVectorPublished", "receiptIssued",
    "reviewCompleted", "activationAuthorized", "activationEffect", "scenarioCommitmentSha256",
}


def reject_duplicate_pairs(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"duplicate JSON property: {key}")
        result[key] = value
    return result


def load_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=reject_duplicate_pairs)
    if not isinstance(value, dict):
        raise ValueError("contention artifact root must be an object")
    return value


def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def canonical_sha256(value: Any) -> str:
    return hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()


def normalized_text_sha256(path: Path) -> str:
    text = path.read_bytes().decode("utf-8", errors="strict")
    normalized = text.replace("\r\n", "\n").replace("\r", "\n")
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def exact_keys(value: Any, expected: set[str], label: str, errors: list[str]) -> bool:
    if not isinstance(value, dict):
        errors.append(f"{label} must be an object")
        return False
    actual = set(value)
    if actual != expected:
        missing = sorted(expected - actual)
        unexpected = sorted(actual - expected)
        errors.append(f"{label} closed-property mismatch; missing={missing}; unexpected={unexpected}")
        return False
    return True


def expect(condition: bool, message: str, errors: list[str]) -> None:
    if not condition:
        errors.append(message)


def schedule(first: str, second: str) -> list[dict[str, str]]:
    return [
        {"operation": "ACQUIRE", "attemptId": first},
        {"operation": "ACQUIRE", "attemptId": second},
        {"operation": "EXECUTE", "attemptId": first},
        {"operation": "RELEASE", "attemptId": first},
        {"operation": "ACQUIRE", "attemptId": second},
        {"operation": "EXECUTE", "attemptId": second},
        {"operation": "RELEASE", "attemptId": second},
    ]


def replay_scenario(name: str, first: str, second: str, fault: str | None) -> dict[str, Any]:
    """Replay the compact seven-step lock/economic contract without retaining its schedule."""
    completed_pairs = 999
    vault_balance = PAIR_REWARD
    lock_owner: str | None = None
    conflict_count = 0
    rollback_count = 0
    committed_count = 0
    terminal_rejections = 0
    balances = {"A_HERO": 0, "A_PROPOSER": 0, "B_HERO": 0, "B_PROPOSER": 0}

    lock_owner = first
    if lock_owner is not None:
        conflict_count += 1
    if fault is not None:
        rollback_count += 1
    else:
        balances[f"{first}_HERO"] += HERO_REWARD
        balances[f"{first}_PROPOSER"] += PROPOSER_REWARD
        vault_balance -= PAIR_REWARD
        completed_pairs += 1
        committed_count += 1
    lock_owner = None

    lock_owner = second
    if completed_pairs >= 1000:
        terminal_rejections += 1
    else:
        balances[f"{second}_HERO"] += HERO_REWARD
        balances[f"{second}_PROPOSER"] += PROPOSER_REWARD
        vault_balance -= PAIR_REWARD
        completed_pairs += 1
        committed_count += 1
    lock_owner = None

    winner = first if fault is None else second
    loser = second if winner == first else first
    return {
        "name": name,
        "firstAttemptId": first,
        "secondAttemptId": second,
        "injectedFault": fault,
        "winnerAttemptId": winner,
        "loserAttemptId": loser,
        "timelineCommitmentSha256": canonical_sha256(schedule(first, second)),
        "lockConflictCount": str(conflict_count),
        "rollbackCount": str(rollback_count),
        "committedAttemptCount": str(committed_count),
        "terminalRejectionCount": str(terminal_rejections),
        "completedPairs": str(completed_pairs),
        "vaultBalanceBaseUnits": str(vault_balance),
        "winnerHeroBalanceBaseUnits": str(balances[f"{winner}_HERO"]),
        "winnerProposerBalanceBaseUnits": str(balances[f"{winner}_PROPOSER"]),
        "loserHeroBalanceBaseUnits": str(balances[f"{loser}_HERO"]),
        "loserProposerBalanceBaseUnits": str(balances[f"{loser}_PROPOSER"]),
        "callerStateUnchanged": True,
        "allLocksReleased": lock_owner is None,
    }


def verify_artifact(root: Path, artifact: dict[str, Any]) -> tuple[list[str], dict[str, Any]]:
    errors: list[str] = []
    exact_keys(artifact, ROOT_KEYS, "artifact", errors)
    expect(artifact.get("vectorVersion") == 1, "vector version drift", errors)
    expect(artifact.get("vectorId") == "iat-promotions-dlc-settlement-contention-v1", "vector ID drift", errors)

    status = artifact.get("status")
    if exact_keys(status, STATUS_KEYS, "status", errors):
        expect(status == {
            "labels": HOLD_LABELS,
            "network": "NONE",
            "programId": None,
            "deployable": False,
            "vectorsApplied": False,
        }, "status HOLD contract drift", errors)

    sources = artifact.get("sources")
    expected_sources = {
        "referenceEngine": "reference-engine.mjs",
        "contentionModel": "settlement-contention-model.mjs",
        "generator": "generate-settlement-contention-vectors.mjs",
    }
    if exact_keys(sources, SOURCE_KEYS, "sources", errors):
        for key, expected_path in expected_sources.items():
            entry = sources.get(key)
            if exact_keys(entry, SOURCE_ENTRY_KEYS, f"sources.{key}", errors):
                expect(entry.get("path") == expected_path, f"sources.{key} path drift", errors)
                try:
                    digest = normalized_text_sha256(root / expected_path)
                    expect(entry.get("normalizedTextSha256") == digest, f"sources.{key} digest drift", errors)
                except (OSError, UnicodeError) as error:
                    errors.append(f"cannot hash sources.{key}: {error}")

    contract = artifact.get("contract")
    if exact_keys(contract, CONTRACT_KEYS, "contract", errors):
        expected_contract = {
            "mode": "DETERMINISTIC_NETWORK_FREE_SETTLEMENT_CONTENTION",
            "scenarioCount": 6,
            "timelineStepsPerScenario": 7,
            "finalSlotStartsAtCompletedPairs": 999,
            "exactWritableLockDerivation": True,
            "campaignAndVaultLocksSerializeAllSettlements": True,
            "injectedFaults": ["AFTER_HERO_TRANSFER", "AFTER_PROPOSER_TRANSFER"],
            "storesExpandedState": False,
            "storesExpandedTimelineOrTrace": False,
            "usesLocalValidator": False,
            "usesRpc": False,
            "usesWallet": False,
            "preparesTransactions": False,
            "signsTransactions": False,
            "broadcastsTransactions": False,
            "issuesReviewReceipts": False,
            "completesReview": False,
            "activationAuthorized": False,
            "activationEffect": "NONE",
        }
        expect(contract == expected_contract, "contention contract drift", errors)

    scenarios = artifact.get("scenarios")
    replayed: list[dict[str, Any]] = []
    scenario_commitments: list[str] = []
    if not isinstance(scenarios, list) or len(scenarios) != len(SCENARIO_DEFINITIONS):
        errors.append("scenario list must contain exactly six entries")
        scenarios = []
    for index, definition in enumerate(SCENARIO_DEFINITIONS):
        if index >= len(scenarios):
            break
        scenario = scenarios[index]
        if not exact_keys(scenario, SCENARIO_KEYS, f"scenarios[{index}]", errors):
            continue
        replay = replay_scenario(*definition)
        replayed.append(replay)
        for field, expected_value in replay.items():
            expect(scenario.get(field) == expected_value, f"{definition[0]} replay mismatch: {field}", errors)
        for field in [
            "initialStateSha256", "finalStateSha256", "traceCommitmentSha256",
            "attemptOutcomeSetCommitmentSha256", "scenarioCommitmentSha256",
        ]:
            expect(isinstance(scenario.get(field), str) and bool(HEX64.fullmatch(scenario[field])),
                   f"{definition[0]} invalid {field}", errors)
        for field in [
            "expandedTimelineStored", "expandedTraceStored", "attemptInputsStored",
            "chainTransactionPrepared", "acceptedCampaignVectorPublished", "receiptIssued",
            "reviewCompleted", "activationAuthorized",
        ]:
            expect(scenario.get(field) is False, f"{definition[0]} authority gate drift: {field}", errors)
        expect(scenario.get("activationEffect") == "NONE", f"{definition[0]} activation effect drift", errors)
        core = {key: value for key, value in scenario.items() if key != "scenarioCommitmentSha256"}
        expected_commitment = canonical_sha256(core)
        expect(scenario.get("scenarioCommitmentSha256") == expected_commitment,
               f"{definition[0]} scenario commitment drift", errors)
        scenario_commitments.append(expected_commitment)

    if len(scenarios) == 6:
        initial_hashes = {scenario.get("initialStateSha256") for scenario in scenarios}
        expect(len(initial_hashes) == 1, "scenario initial-state commitment drift", errors)
        winner_final_hashes: dict[str, set[Any]] = {"A": set(), "B": set()}
        for scenario in scenarios:
            winner = scenario.get("winnerAttemptId")
            if winner in winner_final_hashes:
                winner_final_hashes[winner].add(scenario.get("finalStateSha256"))
        expect(all(len(values) == 1 for values in winner_final_hashes.values()),
               "winner-equivalent final-state commitment drift", errors)
        expect(winner_final_hashes["A"] != winner_final_hashes["B"],
               "different winners alias the same final-state commitment", errors)

    derived_summary = {
        "scenarioCount": str(len(replayed)),
        "lockConflictCount": str(sum(int(item["lockConflictCount"]) for item in replayed)),
        "rollbackCount": str(sum(int(item["rollbackCount"]) for item in replayed)),
        "committedAttemptCount": str(sum(int(item["committedAttemptCount"]) for item in replayed)),
        "terminalRejectionCount": str(sum(int(item["terminalRejectionCount"]) for item in replayed)),
        "exactFinalCompletedPairsCount": str(sum(item["completedPairs"] == "1000" for item in replayed)),
        "zeroFinalVaultBalanceCount": str(sum(item["vaultBalanceBaseUnits"] == "0" for item in replayed)),
        "allCallersUnchanged": all(item["callerStateUnchanged"] for item in replayed),
        "allLocksReleased": all(item["allLocksReleased"] for item in replayed),
        "allLosersUnpaid": all(item["loserHeroBalanceBaseUnits"] == "0" and item["loserProposerBalanceBaseUnits"] == "0" for item in replayed),
        "allWinnersPaidExactly": all(item["winnerHeroBalanceBaseUnits"] == str(HERO_REWARD) and item["winnerProposerBalanceBaseUnits"] == str(PROPOSER_REWARD) for item in replayed),
        "scenarioSetCommitmentSha256": canonical_sha256(scenario_commitments),
        "expandedStateStored": False,
        "expandedTimelineOrTraceStored": False,
        "chainTransactionPrepared": False,
        "receiptIssued": False,
        "reviewCompleted": False,
        "activationAuthorized": False,
        "activationEffect": "NONE",
    }
    summary = artifact.get("summary")
    if exact_keys(summary, SUMMARY_KEYS, "summary", errors):
        expect(summary == derived_summary, "summary differs from independent compact replay", errors)

    report = {
        "valid": not errors,
        "errors": errors,
        "scenarioCount": len(replayed),
        "replayCommitmentSha256": canonical_sha256(replayed),
        "scenarioSetCommitmentSha256": derived_summary["scenarioSetCommitmentSha256"],
        "expandedStateStored": False,
        "expandedSchedulesStored": False,
        "network": "NONE",
        "receiptIssued": False,
        "reviewCompleted": False,
        "activationAuthorized": False,
        "activationEffect": "NONE",
    }
    return errors, report


def verify(root: Path, artifact_path: Path) -> tuple[list[str], dict[str, Any]]:
    try:
        artifact = load_json(artifact_path)
    except (OSError, UnicodeError, json.JSONDecodeError, ValueError) as error:
        return [f"cannot read contention artifact: {error}"], {}
    return verify_artifact(root, artifact)


def apply_pointer_mutation(base: dict[str, Any], mutation: dict[str, Any]) -> dict[str, Any]:
    candidate = json.loads(json.dumps(base, separators=(",", ":")))
    path = mutation["path"]
    if not isinstance(path, str) or not path.startswith("/"):
        raise ValueError("invalid mutation path")
    segments = [segment.replace("~1", "/").replace("~0", "~") for segment in path[1:].split("/")]
    final = segments.pop()
    parent: Any = candidate
    for segment in segments:
        parent = parent[int(segment)] if isinstance(parent, list) else parent[segment]
    key: Any = int(final) if isinstance(parent, list) else final
    operation = mutation["operation"]
    if operation == "replace":
        if isinstance(parent, list):
            if key < 0 or key >= len(parent):
                raise ValueError("mutation target missing")
        elif key not in parent:
            raise ValueError("mutation target missing")
    elif operation != "add":
        raise ValueError("unsupported mutation operation")
    parent[key] = json.loads(json.dumps(mutation["value"], separators=(",", ":")))
    return candidate


def apply_contention_mutation(base: dict[str, Any], definition: tuple[Any, ...]) -> dict[str, Any]:
    _, _, _, mutation, rebind_scenario, rebind_set = definition
    candidate = apply_pointer_mutation(base, mutation)
    if rebind_scenario:
        index = int(mutation["path"].split("/")[2])
        scenario = candidate["scenarios"][index]
        core = {key: value for key, value in scenario.items() if key != "scenarioCommitmentSha256"}
        scenario["scenarioCommitmentSha256"] = canonical_sha256(core)
    if rebind_set:
        candidate["summary"]["scenarioSetCommitmentSha256"] = canonical_sha256(
            [scenario["scenarioCommitmentSha256"] for scenario in candidate["scenarios"]]
        )
    return candidate


def verify_mutation_vectors(root: Path, vectors_path: Path) -> tuple[list[str], dict[str, Any]]:
    errors: list[str] = []
    try:
        vectors = load_json(vectors_path)
        base = load_json(root / ARTIFACT_NAME)
    except (OSError, UnicodeError, json.JSONDecodeError, ValueError) as error:
        return [f"cannot read contention mutation vectors: {error}"], {}

    expected_root_keys = {"vectorVersion", "vectorId", "status", "sources", "contract", "summary", "cases"}
    exact_keys(vectors, expected_root_keys, "mutation vectors", errors)
    expect(vectors.get("vectorVersion") == 1, "mutation vector version drift", errors)
    expect(vectors.get("vectorId") == "iat-promotions-dlc-settlement-contention-mutations-v1", "mutation vector ID drift", errors)
    status = vectors.get("status")
    if exact_keys(status, STATUS_KEYS, "mutation status", errors):
        expect(status == {"labels": HOLD_LABELS, "network": "NONE", "programId": None, "deployable": False, "vectorsApplied": False}, "mutation HOLD status drift", errors)

    expected_sources = {
        "baseArtifact": ("settlement-contention-vectors.v1.json", "canonicalSha256", canonical_sha256(base)),
        "closedSchema": ("settlement-contention-evidence.schema.v1.json", "canonicalSha256", canonical_sha256(load_json(root / "settlement-contention-evidence.schema.v1.json"))),
        "nodeEvaluator": ("settlement-contention-mutations.mjs", "normalizedTextSha256", normalized_text_sha256(root / "settlement-contention-mutations.mjs")),
        "pythonVerifier": ("verify-settlement-contention-vectors.py", "normalizedTextSha256", normalized_text_sha256(Path(__file__).resolve())),
        "generator": ("generate-settlement-contention-mutation-vectors.mjs", "normalizedTextSha256", normalized_text_sha256(root / "generate-settlement-contention-mutation-vectors.mjs")),
    }
    sources = vectors.get("sources")
    if exact_keys(sources, set(expected_sources), "mutation sources", errors):
        for name, (path, digest_key, digest) in expected_sources.items():
            entry = sources.get(name)
            if exact_keys(entry, {"path", digest_key}, f"mutation sources.{name}", errors):
                expect(entry.get("path") == path, f"mutation sources.{name} path drift", errors)
                expect(entry.get(digest_key) == digest, f"mutation sources.{name} digest drift", errors)

    cases = vectors.get("cases")
    if not isinstance(cases, list) or len(cases) != len(MUTATION_DEFINITIONS):
        errors.append("mutation cases must contain exactly sixteen entries")
        cases = []
    common_records: list[dict[str, Any]] = []
    case_commitments: list[str] = []
    for index, definition in enumerate(MUTATION_DEFINITIONS):
        if index >= len(cases):
            break
        case = cases[index]
        case_id, primary_gate, expected_schema_valid, mutation, rebind_scenario, rebind_set = definition
        expected_case_keys = {
            "caseId", "primaryGate", "mutation", "rebindScenarioCommitment",
            "rebindScenarioSetCommitment", "expectedSchemaValid", "expectedAccepted",
            "candidateCommitmentSha256", "nodeSchemaErrorCount", "nodeSemanticErrorCount",
            "nodeSemanticErrorSetCommitmentSha256", "runtimeCandidateStored", "expandedStateStored",
            "expandedScheduleStored", "receiptIssued", "reviewCompleted", "activationAuthorized",
            "activationEffect", "caseCommitmentSha256",
        }
        if not exact_keys(case, expected_case_keys, f"mutation cases[{index}]", errors):
            continue
        expect(case.get("caseId") == case_id, f"{case_id} case ID drift", errors)
        expect(case.get("primaryGate") == primary_gate, f"{case_id} primary gate drift", errors)
        expect(case.get("mutation") == mutation, f"{case_id} descriptor drift", errors)
        expect(case.get("rebindScenarioCommitment") is rebind_scenario, f"{case_id} scenario rebind drift", errors)
        expect(case.get("rebindScenarioSetCommitment") is rebind_set, f"{case_id} set rebind drift", errors)
        expect(case.get("expectedSchemaValid") is expected_schema_valid, f"{case_id} schema expectation drift", errors)
        expect(case.get("expectedAccepted") is False, f"{case_id} acceptance expectation drift", errors)
        candidate = apply_contention_mutation(base, definition)
        candidate_commitment = canonical_sha256(candidate)
        expect(case.get("candidateCommitmentSha256") == candidate_commitment, f"{case_id} candidate commitment drift", errors)
        candidate_errors, _ = verify_artifact(root, candidate)
        expect(bool(candidate_errors), f"{case_id} unexpectedly accepted by Python replay", errors)
        for field in ["runtimeCandidateStored", "expandedStateStored", "expandedScheduleStored", "receiptIssued", "reviewCompleted", "activationAuthorized"]:
            expect(case.get(field) is False, f"{case_id} {field} drift", errors)
        expect(case.get("activationEffect") == "NONE", f"{case_id} activation effect drift", errors)
        core = {key: value for key, value in case.items() if key != "caseCommitmentSha256"}
        expected_case_commitment = canonical_sha256(core)
        expect(case.get("caseCommitmentSha256") == expected_case_commitment, f"{case_id} case commitment drift", errors)
        case_commitments.append(expected_case_commitment)
        common_records.append({"caseId": case_id, "primaryGate": primary_gate, "candidateCommitmentSha256": candidate_commitment, "accepted": False})

    summary = vectors.get("summary") if isinstance(vectors.get("summary"), dict) else {}
    common_commitment = canonical_sha256(common_records)
    expect(summary.get("commonReplayCommitmentSha256") == common_commitment, "mutation common replay commitment drift", errors)
    expect(summary.get("caseSetCommitmentSha256") == canonical_sha256(case_commitments), "mutation case-set commitment drift", errors)
    expect(summary.get("allRejected") is True, "mutation summary releases a candidate", errors)
    for field in ["runtimeCandidateStored", "expandedStateStored", "expandedScheduleStored", "receiptIssued", "reviewCompleted", "activationAuthorized"]:
        expect(summary.get(field) is False, f"mutation summary {field} drift", errors)
    expect(summary.get("activationEffect") == "NONE", "mutation summary activation effect drift", errors)

    report = {
        "valid": not errors,
        "errors": errors,
        "mutationCaseCount": len(common_records),
        "commonReplayCommitmentSha256": common_commitment,
        "allRejected": len(common_records) == len(MUTATION_DEFINITIONS),
        "expandedStateStored": False,
        "expandedSchedulesStored": False,
        "network": "NONE",
        "receiptIssued": False,
        "reviewCompleted": False,
        "activationAuthorized": False,
        "activationEffect": "NONE",
    }
    return errors, report


def main() -> int:
    parser = argparse.ArgumentParser(description="Replay held compact IAT settlement-contention evidence offline.")
    default_root = Path(__file__).resolve().parent
    parser.add_argument("--root", type=Path, default=default_root)
    parser.add_argument("--artifact", type=Path)
    parser.add_argument("--verify-mutation-vectors", action="store_true")
    parser.add_argument("--mutation-vectors", type=Path)
    parser.add_argument("--json", action="store_true", dest="emit_json")
    arguments = parser.parse_args()
    root = arguments.root.resolve()
    if arguments.verify_mutation_vectors:
        vectors = arguments.mutation_vectors.resolve() if arguments.mutation_vectors else root / MUTATION_ARTIFACT_NAME
        errors, report = verify_mutation_vectors(root, vectors)
    else:
        artifact = arguments.artifact.resolve() if arguments.artifact else root / ARTIFACT_NAME
        errors, report = verify(root, artifact)
    if arguments.emit_json:
        print(json.dumps(report, separators=(",", ":")))
    elif errors:
        print("\n".join(errors), file=sys.stderr)
    else:
        commitment = report.get("commonReplayCommitmentSha256", report.get("replayCommitmentSha256"))
        print(f"Independent compact replay passed: {commitment}")
    return 2 if errors and arguments.verify_mutation_vectors else (1 if errors else 0)


if __name__ == "__main__":
    raise SystemExit(main())
