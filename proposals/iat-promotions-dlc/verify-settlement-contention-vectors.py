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


def verify(root: Path, artifact_path: Path) -> tuple[list[str], dict[str, Any]]:
    errors: list[str] = []
    try:
        artifact = load_json(artifact_path)
    except (OSError, UnicodeError, json.JSONDecodeError, ValueError) as error:
        return [f"cannot read contention artifact: {error}"], {}

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


def main() -> int:
    parser = argparse.ArgumentParser(description="Replay held compact IAT settlement-contention evidence offline.")
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
        print(f"Independent compact replay passed: {report['replayCommitmentSha256']}")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
