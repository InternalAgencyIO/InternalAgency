import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildIatB3ProductionLocalRehearsalPlanPacket,
  canonicalIatB3ProductionLocalRehearsalPlanJson,
  readIatB3ProductionLocalRehearsalPlan,
  validateIatB3ProductionLocalRehearsalPlan,
} from "../scripts/validate-iat-b3-production-local-rehearsal-plan.mjs";
import {
  IAT_B3_PRODUCTION_EXPECTED_DISPOSITIONS_SHA256,
} from "../scripts/lib/iat-b3-production-local-rehearsal-contract.mjs";

const ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));
const PACKET_PATH = resolve(ROOT, "docs/b3/iat-b3-production-local-rehearsal-plan.v1.json");
const VALIDATOR_PATH = resolve(ROOT, "scripts/validate-iat-b3-production-local-rehearsal-plan.mjs");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function clone(value) {
  return structuredClone(value);
}

test("canonical packet is exact source-bound HOLD and never authorizes execution", () => {
  const bytes = readFileSync(PACKET_PATH, "utf8");
  const packet = readIatB3ProductionLocalRehearsalPlan(PACKET_PATH);
  assert.equal(bytes, `${canonicalIatB3ProductionLocalRehearsalPlanJson(packet)}\n`);
  assert.deepEqual(packet, buildIatB3ProductionLocalRehearsalPlanPacket());
  const result = validateIatB3ProductionLocalRehearsalPlan(packet);
  assert.equal(result.valid, true);
  assert.equal(result.status, "HOLD");
  assert.equal(result.executionAuthorized, false);
  assert.equal(result.packetSha256, sha256(Buffer.from(bytes.trimEnd())));
  assert.equal(packet.status, "HOLD");
  assert.ok(Object.entries(packet.scope)
    .filter(([key]) => key.startsWith("authorizes"))
    .every(([, value]) => value === false));
  assert.equal(packet.truth.executionEvidenceAccepted, false);
  assert.equal(packet.truth.mainnetExecutionAuthorized, false);
  assert.equal(packet.truth.mainnetStatus, "HOLD");
});

test("all 15 ordinal dispositions and exact opcode-9 conditional truth remain unexecuted", () => {
  const packet = readIatB3ProductionLocalRehearsalPlan(PACKET_PATH);
  const ordinal = packet.expectedDispositions.ordinalCases;
  assert.deepEqual(ordinal.map(({ opcode }) => opcode), [...Array(15).keys()]);
  assert.deepEqual(ordinal.map(({ exactMetaCount }) => exactMetaCount), [
    1, 1, 1, 1, 1, 6, 17, 17, 1, 12, 12, 7, 1, 1, 1,
  ]);
  assert.equal(packet.expectedDispositions.ordinalCasesAreFullConditionalCoverage, false);
  assert.equal(packet.expectedDispositions.canonicalExpectedDispositionsSha256,
    IAT_B3_PRODUCTION_EXPECTED_DISPOSITIONS_SHA256);
  assert.deepEqual(
    packet.expectedDispositions.opcode9ConditionalCases.map((entry) => [
      entry.lane,
      entry.variant,
      entry.expectedNumericErrorCode,
      entry.exactMetaCount,
      entry.requiredNoEffectBeyondFeePayer,
    ]),
    [
      [1, "NON_CORE_ACTIVE", null, 12, false],
      [2, "NON_CORE_ACTIVE", null, 12, false],
      [4, "NON_CORE_ACTIVE", null, 12, false],
      [3, "CORE_CUSTODY_HOLD", 0xE50E, 1, true],
      [0, "INVALID_LANE", 0xE50D, 1, true],
      [5, "INVALID_LANE", 0xE50D, 1, true],
    ],
  );
  assert.ok(ordinal.every(({ executed, executionEvidenceAccepted }) =>
    executed === false && executionEvidenceAccepted === false));
  assert.ok(packet.expectedDispositions.opcode9ConditionalCases.every(({ executed }) =>
    executed === false));
});

test("exact account maps, PDA seeds, privilege flags, codecs, and fixture requirements are bound", () => {
  const packet = readIatB3ProductionLocalRehearsalPlan(PACKET_PATH);
  const accountMap = packet.productionTransactionMap.operationAccountMap;
  assert.equal(accountMap.length, 15);
  assert.deepEqual(packet.productionTransactionMap.exactMetaCounts, [
    [1], [1], [1], [1], [1], [6], [17, 18], [17], [1], [12, 1, 1], [12], [7], [1], [1], [1],
  ]);
  assert.deepEqual(packet.productionTransactionMap.pdaSeeds, {
    lawState: "law-state",
    config: "config",
    vaultAuthority: "vault-authority",
    laneState: "lane",
    laneToken: "lane-token",
    stakeToken: "stake-token",
    stakeIngress: "stake-ingress",
    eligibility: "eligibility",
    position: "position",
  });
  const dailyLaw = packet.fixturePlan.roles.find(({ role }) => role === "daily_law_state");
  const config = packet.fixturePlan.roles.find(({ role }) => role === "config");
  const eligibility = packet.fixturePlan.roles.find(({ role }) => role === "eligibility");
  assert.equal(dailyLaw.ownerRule, "LAW_PROGRAM");
  assert.equal(dailyLaw.dataLengthRule, "EXACT_160");
  assert.equal(config.ownerRule, "ECONOMY_PROGRAM");
  assert.equal(config.dataLengthRule, "EXACT_272");
  assert.deepEqual(eligibility.codecAlternatives, ["ECONOMY_ELIGIBILITY_V1", "SYSTEM_VACANT"]);
  assert.ok(packet.fixturePlan.roles.every(({ concrete, executionObserved }) =>
    concrete.pubkey === null
    && concrete.owner === null
    && concrete.dataLength === null
    && concrete.dataSha256 === null
    && concrete.decodedStateSha256 === null
    && concrete.decodedInvariants === null
    && executionObserved === false));
});

test("dual genesis, signer, artifact, validator, and fixture-isolation gaps are explicit blockers", () => {
  const packet = readIatB3ProductionLocalRehearsalPlan(PACKET_PATH);
  assert.deepEqual(packet.dualGenesisDomains, {
    validatorGenesisHash: null,
    validatorGenesisClaimedMainnet: false,
    compiledLawDomainGenesisHash: null,
    requireDistinctHashes: true,
    positiveCase: { lawStateDomain: "COMPILED_LAW_DOMAIN", expectedErrorCode: null, executed: false },
    negativeCase: { lawStateDomain: "VALIDATOR_GENESIS", expectedErrorCode: 0xE503, executed: false },
    publicDevnetFinalByteEvidence: false,
  });
  assert.ok(Object.values(packet.identityAndArtifacts).every((value) => value === null));
  assert.equal(packet.signerPlan.keyFilesRead, false);
  assert.equal(packet.signerPlan.keyGenerationAllowed, false);
  assert.equal(packet.signerPlan.feePayer.expectedPubkey, null);
  assert.ok(packet.signerPlan.authorityRoles.every((role) =>
    role.expectedPubkey === null && role.ephemeralKeyPath === null));
  assert.equal(packet.runtimePrerequisites.rpcUrl, null);
  assert.equal(packet.runtimePrerequisites.prestartedValidatorObserved, false);
  assert.equal(packet.runtimePrerequisites.validatorSpawnAllowed, false);
  assert.equal(packet.fixturePlan.isolation.mutablePubkeySetsMustBePairwiseDisjoint, true);
  assert.equal(packet.fixturePlan.isolation.isolationStrategy, null);
  assert.ok(packet.fixturePlan.isolation.rows.every((row) =>
    row.concreteMutablePubkeys === null
    && row.beforeStateSetSha256 === null
    && row.terminalStateSetSha256 === null));
  for (const blocker of [
    "MUTABLE_FIXTURE_ISOLATION_AND_TERMINAL_HASH_PLAN_MISSING",
    "OPCODE9_FULL_CONDITIONAL_CASES_NOT_EXECUTED",
    "SOURCE_BOUND_LOOPBACK_RECEIPT_COMPLETION_NOT_IMPLEMENTED",
    "MAINNET_HOLD",
  ]) assert.ok(packet.blockers.includes(blocker));
});

test("rollback plan is exactly [5,6,7,9,10], atomic, and followed by standalone retry", () => {
  const packet = readIatB3ProductionLocalRehearsalPlan(PACKET_PATH);
  assert.equal(packet.rollbackPlan.exactProbeCount, 5);
  assert.deepEqual(packet.rollbackPlan.exactActiveOpcodes, [5, 6, 7, 9, 10]);
  assert.deepEqual(
    packet.rollbackPlan.probes.map(({ transactionInstructionOpcodes }) => transactionInstructionOpcodes),
    [[5, 12], [6, 12], [7, 12], [9, 12], [10, 12]],
  );
  assert.equal(packet.rollbackPlan.probes[0].requiredInnerCpiProgram, "SYSTEM_PROGRAM");
  assert.ok(packet.rollbackPlan.probes.slice(1).every(({ requiredInnerCpiProgram }) =>
    requiredInnerCpiProgram === "TOKEN_2022_PROGRAM"));
  assert.ok(packet.rollbackPlan.probes.every((probe) =>
    probe.requiredAtomicErrorCode === 0xE50A
    && probe.requiredAtomicNoEffectBeyondFeePayer === true
    && probe.standaloneRetryRequired === true
    && probe.standaloneRetryExpectedErrorCode === null
    && probe.standaloneRetryMustChangeNonFeePayerState === true
    && probe.executed === false));
});

test("every source, map, disposition, role, and blocker mutation fails closed", () => {
  const packet = readIatB3ProductionLocalRehearsalPlan(PACKET_PATH);
  const mutations = [
    (value) => { value.sourceBindings.descriptors[0].sha256 = "0".repeat(64); },
    (value) => { value.productionTransactionMap.operationAccountMap[5].variants[0].orderedMetas[1].isSigner = false; },
    (value) => { value.productionTransactionMap.pdaSeeds.position = "wrong"; },
    (value) => { value.expectedDispositions.ordinalCases[12].expectedNumericErrorCode = null; },
    (value) => { value.expectedDispositions.opcode9ConditionalCases[3].exactMetaCount = 12; },
    (value) => { value.fixturePlan.roles[0].concrete.dataSha256 = "1".repeat(64); },
    (value) => { value.fixturePlan.isolation.rows[0].terminalStateSetSha256 = "2".repeat(64); },
    (value) => { value.rollbackPlan.exactActiveOpcodes[4] = 11; },
    (value) => { value.blockers.pop(); },
    (value) => { value.scope.authorizesRpc = true; },
    (value) => { value.truth.mainnetStatus = "READY"; },
  ];
  for (const mutate of mutations) {
    const value = clone(packet);
    mutate(value);
    assert.throws(
      () => validateIatB3ProductionLocalRehearsalPlan(value),
      /PLAN_TRUTH_HOLD/u,
    );
  }
});

test("strict packet parser rejects noncanonical and duplicate or escape-equivalent members", () => {
  const directory = mkdtempSync(join(tmpdir(), "iat-b3-production-plan-"));
  try {
    const noncanonical = join(directory, "noncanonical.json");
    writeFileSync(noncanonical, JSON.stringify({ status: "HOLD" }, null, 2));
    assert.throws(
      () => readIatB3ProductionLocalRehearsalPlan(noncanonical),
      /CANONICAL_JSON_HOLD/u,
    );
    for (const [name, source] of [
      ["top", '{"status":"HOLD","status":"READY"}\n'],
      ["nested", '{"scope":{"authorizesRpc":false,"authorizesRpc":true}}\n'],
      ["escaped", '{"status":"HOLD","stat\\u0075s":"READY"}\n'],
    ]) {
      const path = join(directory, `${name}.json`);
      writeFileSync(path, source);
      assert.throws(
        () => readIatB3ProductionLocalRehearsalPlan(path),
        /duplicate JSON member/u,
      );
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("validator CLI reports valid HOLD and the implementation has no RPC/key/build/deploy execution surface", () => {
  const run = spawnSync(process.execPath, [VALIDATOR_PATH, PACKET_PATH], {
    cwd: ROOT,
    encoding: "utf8",
  });
  assert.equal(run.status, 0, run.stderr);
  const result = JSON.parse(run.stdout);
  assert.equal(result.valid, true);
  assert.equal(result.status, "HOLD");
  assert.equal(result.executionAuthorized, false);
  const source = readFileSync(VALIDATOR_PATH, "utf8");
  assert.doesNotMatch(source, /\b(?:fetch|spawn|execFile|exec|Connection|Keypair|sendTransaction)\s*\(/u);
  assert.doesNotMatch(source, /solana-test-validator|requestAirdrop|api\.mainnet-beta|api\.devnet/u);
});
