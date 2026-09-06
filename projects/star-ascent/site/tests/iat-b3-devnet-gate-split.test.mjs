import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  assessIndependentPreDevnetVerdict,
  assessPreDevnetAuthorizationCandidate,
  validateIndependentPreDevnetVerdict,
  validatePreDevnetAuthorizationCandidateAssessment,
} from "../scripts/assess-iat-b3-pre-devnet-authorization.mjs";
import {
  acceptIndependentPostDevnetAssessment,
  assessPostDevnetEvidence,
  validateIndependentPostDevnetVerdict,
  validatePostDevnetEvidenceAssessment,
} from "../scripts/assess-iat-b3-post-devnet-evidence.mjs";
import {
  HOLD_STATUS,
  MAINNET_HOLD_CODE,
  POST_DEVNET_ACCEPTED_STATUS,
  POST_DEVNET_ELIGIBLE_STATUS,
  POST_DEVNET_INPUT_SCHEMA,
  PRE_DEVNET_ELIGIBLE_STATUS,
  PRE_DEVNET_EVIDENCE_BLOCKERS,
  PRE_DEVNET_INDEPENDENT_VERDICT_SCHEMA,
  PRE_DEVNET_INPUT_SCHEMA,
  PRE_DEVNET_REQUEST_ELIGIBLE_STATUS,
  PUBLIC_DEVNET_GENESIS_HASH,
  PUBLIC_DEVNET_GRANT_CONFIRMATION,
  PUBLIC_DEVNET_GRANT_SCOPE,
  PUBLIC_DEVNET_RPC_URL,
  PUBLIC_DEVNET_REQUIRED_OPCODE9_CASES,
  PUBLIC_DEVNET_SOLE_HUMAN_GATE,
  PUBLIC_DEVNET_USER_GRANT_SCHEMA,
  REQUIRED_FAILURE_POLICY,
  canonicalSplitGateSha256,
} from "../scripts/lib/iat-b3-devnet-gate-split-contract.mjs";

const SITE_ROOT = fileURLToPath(new URL("../", import.meta.url));
const PRE_SCRIPT = resolve(SITE_ROOT, "scripts/assess-iat-b3-pre-devnet-authorization.mjs");
const POST_SCRIPT = resolve(SITE_ROOT, "scripts/assess-iat-b3-post-devnet-evidence.mjs");
const HEX = (character) => character.repeat(64);
const SOURCE = Object.freeze({
  headSha: "1".repeat(40),
  treeSha: "2".repeat(40),
  statusPorcelain: "",
});
const IDENTITIES = Object.freeze({
  lawProgramId: "D6UucuMprPAYyCmr5UPU5h9YhRf2ZNtn23JTS32EjdjY",
  economyProgramId: "GLb6VMiKEhRRfYnD1p3a3iCAR3kgtRr8qdHxEHAzbdDU",
  canonicalMint: "3JF3sEqM796hk5WFqA6EtmEwJQ9quALszsfJyvXNQKy3",
  compiledLawDomainGenesisHash: "4zEL9HZwTFoanu5RbmGspF5a6uqVGP99xkJxToZoq3Pw",
});
const DISPOSABLE_IDENTITIES = Object.freeze({
  lawProgramId: "FSh75Nh67AvXravbH4XbW1gMKbZeWNCWHtVcM7MXnzfd",
  economyProgramId: "CBgoRviu9VJtfXh8G6p6ZnsSeBfeVWbmisyMytq2Z5M",
  mint: "BNciP7GwnAEDtpr1W1n5sGBGcvCbvan5KcvScPe3L1Bz",
});
const EVALUATION = 2_000_000_000n;
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58Encode(bytes) {
  let leadingZeroBytes = 0;
  while (leadingZeroBytes < bytes.length && bytes[leadingZeroBytes] === 0) {
    leadingZeroBytes += 1;
  }
  let number = 0n;
  for (const byte of bytes) number = (number << 8n) + BigInt(byte);
  let encoded = "";
  while (number > 0n) {
    encoded = BASE58_ALPHABET[Number(number % 58n)] + encoded;
    number /= 58n;
  }
  return `${"1".repeat(leadingZeroBytes)}${encoded}`;
}

function bind(domain, value, key) {
  const core = structuredClone(value);
  delete core[key];
  value[key] = canonicalSplitGateSha256(domain, core);
  return value;
}

function artifactDescriptor(path) {
  const canonicalPath = realpathSync.native(path);
  const bytes = readFileSync(canonicalPath);
  return {
    path: canonicalPath,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    byteLength: bytes.length,
  };
}

function writeJsonArtifact(root, name, value) {
  const path = join(root, name);
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
  return artifactDescriptor(path);
}

function sourceDescriptor(path) {
  const artifact = artifactDescriptor(path);
  return {
    sourcePath: artifact.path,
    sourceSha256: artifact.sha256,
    executedSha256: artifact.sha256,
    byteLength: artifact.byteLength,
  };
}

function verifierDescriptor(path) {
  return {
    lane: "independent_launch_redteam",
    type: "SOURCE_BOUND_AUTOMATED_DIRECT_EVIDENCE",
    directEvidenceOnly: true,
    humanReviewerRequired: false,
    ...sourceDescriptor(path),
  };
}

function observationWindow() {
  const started = 1_900_000_000n;
  const common = {
    headSha: SOURCE.headSha,
    treeSha: SOURCE.treeSha,
    runnerSha256: HEX("a"),
    toolchainSha256: HEX("b"),
    identitiesSha256: HEX("c"),
    artifactsSha256: HEX("d"),
    receiptsSha256: HEX("e"),
    validatorGenesisHash: base58Encode(Buffer.alloc(32, 42)),
    validatorProcessIdentitySha256: HEX("f"),
  };
  const samples = [];
  for (let index = 0; index < 73; index += 1) {
    const core = {
      ordinal: index + 1,
      observedAtUnixSeconds: (started + (BigInt(index) * 1_200n)).toString(),
      ...common,
      validatorSlot: (10_000n + BigInt(index)).toString(),
      previousSampleSha256: index === 0 ? null : samples[index - 1].sampleSha256,
      schedulerEnvelopeSha256: canonicalSplitGateSha256(
        "IAT_B3_TEST_SCHEDULER_ENVELOPE_V1",
        { ordinal: index + 1 },
      ),
    };
    samples.push({
      ...core,
      sampleSha256: canonicalSplitGateSha256(
        "IAT_B3_PRE_DEVNET_OBSERVATION_SAMPLE_V1",
        core,
      ),
    });
  }
  const window = {
    startedAtUnixSeconds: started.toString(),
    endedAtUnixSeconds: (started + 86_400n).toString(),
    requiredDurationSeconds: 86_400,
    targetCadenceSeconds: 1_200,
    maximumGapSeconds: 1_500,
    scheduler: {
      type: "EXTERNAL_HASH_CHAINED_MONITOR",
      sourceSha256: HEX("1"),
      executedSha256: HEX("1"),
    },
    samples,
    bindingSha256: HEX("0"),
  };
  return bind("IAT_B3_PRE_DEVNET_OBSERVATION_WINDOW_V1", window, "bindingSha256");
}

function validPrePacket() {
  const productionIdentities = bind(
    "IAT_B3_PRE_DEVNET_PRODUCTION_IDENTITIES_V1",
    { ...IDENTITIES, identityBindingSha256: HEX("0") },
    "identityBindingSha256",
  );
  const productionByteEvidence = bind(
    "IAT_B3_PRE_DEVNET_PRODUCTION_BYTES_V1",
    {
      lawArtifactSha256: HEX("1"),
      lawReceiptSha256: HEX("2"),
      economyArtifactSha256: HEX("3"),
      economyReceiptSha256: HEX("4"),
      distinctArtifactsAndReceipts: true,
      sameContainerOfflineProvenance: true,
      bindingSha256: HEX("0"),
    },
    "bindingSha256",
  );
  const localRehearsalEvidence = bind(
    "IAT_B3_PRE_DEVNET_LOCAL_REHEARSAL_V1",
    {
      preflightSha256: HEX("1"),
      executionPlanSha256: HEX("2"),
      executionReceiptSha256: HEX("3"),
      officialExecutionEvidenceSha256: HEX("4"),
      loopbackOnly: true,
      all15Observed: true,
      opcode9ConditionalCasesObserved: true,
      fiveRollbackAndRetryCasesObserved: true,
      negativeValidatorDomainDailyLawObserved: true,
      positiveCompiledDomainDailyLawObserved: true,
      sourceBoundReceiptComplete: true,
      bindingSha256: HEX("0"),
    },
    "bindingSha256",
  );
  const ownerPolicyEvidence = bind(
    "IAT_B3_PRE_DEVNET_OWNER_POLICY_V1",
    {
      stages2Through6Complete: true,
      entropyLagSlots: 150,
      entropyRiskAcceptance:
        "ACCEPT_LAGGED_SLOT_HASH_WITH_FINALIZER_TIMING_INFLUENCE_AND_LIMITED_PROBABILITY_CLAIMS",
      finalEntropyLagFrozen: true,
      bindingSha256: HEX("0"),
    },
    "bindingSha256",
  );
  const fullSupplyTransitAcceptance = bind(
    "IAT_B3_PRE_DEVNET_FULL_SUPPLY_TRANSIT_V1",
    {
      accepted: true,
      policy: "MODEL_T_FULL_SUPPLY_TRANSIT",
      soleHumanGate: PUBLIC_DEVNET_SOLE_HUMAN_GATE,
      publicKeysOnly: true,
      acceptanceSha256: HEX("0"),
    },
    "acceptanceSha256",
  );
  const publicDevnetExecutionIntent = bind(
    "IAT_B3_PUBLIC_DEVNET_EXECUTION_INTENT_V1",
    {
      network: "solana-devnet",
      rpcUrl: PUBLIC_DEVNET_RPC_URL,
      genesisHash: PUBLIC_DEVNET_GENESIS_HASH,
      oneShot: true,
      disposableIdentities: structuredClone(DISPOSABLE_IDENTITIES),
      productionIdentityReuseForbidden: true,
      expectedTransactionCount: 19,
      maximumLamportSpend: "3000000000",
      operationMapsSha256: HEX("a"),
      ceremonyStagesSha256: HEX("b"),
      dailyLawBoundarySha256: HEX("c"),
      rollbackMatrixSha256: HEX("d"),
      intentSha256: HEX("0"),
    },
    "intentSha256",
  );
  const fundingIntent = bind(
    "IAT_B3_PRE_DEVNET_FUNDING_INTENT_V1",
    {
      payerPublicKey: "DYURSZnNLak5YNt2vLJUnU5iWDUbAo53oUfzZ8dVc5d4",
      maximumLamportSpend: publicDevnetExecutionIntent.maximumLamportSpend,
      sourcePolicySha256: HEX("e"),
      approved: true,
      fundingIntentSha256: HEX("0"),
    },
    "fundingIntentSha256",
  );
  return {
    schema: PRE_DEVNET_INPUT_SCHEMA,
    sourceCheckpoint: structuredClone(SOURCE),
    canonicalBindings: {
      canonicalReadinessAssessmentSha256: HEX("1"),
      productionPlanSha256: HEX("2"),
      operationMapsSha256: HEX("3"),
      ceremonyStagesSha256: HEX("4"),
      dailyLawBoundarySha256: HEX("5"),
      rollbackMatrixSha256: HEX("6"),
    },
    productionToolchain: {
      linuxAmd64: true,
      dockerOnly: true,
      offline: true,
      sameContainer: true,
      pinnedToolchainSha256: HEX("7"),
      executedRunnerSha256: HEX("8"),
      committedRunnerSha256: HEX("8"),
    },
    productionIdentities,
    productionByteEvidence,
    localRehearsalEvidence,
    continuousObservationEvidence: observationWindow(),
    ownerPolicyEvidence,
    fullSupplyTransitAcceptance,
    publicDevnetExecutionIntent,
    fundingIntent,
    failurePolicy: structuredClone(REQUIRED_FAILURE_POLICY),
    clearedEvidence: PRE_DEVNET_EVIDENCE_BLOCKERS.map((code, index) => ({
      code,
      directlyObserved: true,
      evidenceSha256: canonicalSplitGateSha256(
        "IAT_B3_TEST_DIRECT_EVIDENCE_V1",
        { code, index },
      ),
    })),
  };
}

function preHoldVerdictForPostFixture(prePacket = validPrePacket()) {
  const candidateAssessment = assessPreDevnetAuthorizationCandidate(prePacket);
  assert.equal(candidateAssessment.status, HOLD_STATUS);
  const packet = {
    schema: PRE_DEVNET_INDEPENDENT_VERDICT_SCHEMA,
    candidateAssessment,
    candidateAssessmentSha256: candidateAssessment.assessmentSha256,
    preInputArtifact: null,
    candidateArtifact: null,
    assessor: null,
    verifier: null,
    verifiedAtUnixSeconds: EVALUATION.toString(),
  };
  const verdict = assessIndependentPreDevnetVerdict(packet);
  assert.equal(verdict.status, HOLD_STATUS);
  return { prePacket, candidateAssessment, packet, verdict };
}

function validPostPacket() {
  const { prePacket, verdict } = preHoldVerdictForPostFixture();
  const executionIntent = structuredClone(prePacket.publicDevnetExecutionIntent);
  const identityEvidence = bind(
    "IAT_B3_PUBLIC_DEVNET_IDENTITY_SET_V1",
    {
      ...DISPOSABLE_IDENTITIES,
      payerPublicKey: prePacket.fundingIntent.payerPublicKey,
      allDisposable: true,
      allDistinct: true,
      productionIdentityReuseObserved: false,
      identitySetSha256: HEX("0"),
    },
    "identitySetSha256",
  );
  const grant = bind(
    "IAT_B3_PUBLIC_DEVNET_USER_GRANT_V1",
    {
      schema: PUBLIC_DEVNET_USER_GRANT_SCHEMA,
      authorizationId: "devnet-authorization/test-0001",
      authorizationRequestId: "devnet-request/test-0001",
      confirmation: PUBLIC_DEVNET_GRANT_CONFIRMATION,
      scope: PUBLIC_DEVNET_GRANT_SCOPE,
      soleHumanGate: PUBLIC_DEVNET_SOLE_HUMAN_GATE,
      authorizedBy: "owner/test",
      authorized: true,
      authorizedAtUnixSeconds: (EVALUATION - 10n).toString(),
      expiresAtUnixSeconds: (EVALUATION + 1_000n).toString(),
      preVerdictSha256: verdict.verdictSha256,
      sourceHeadSha: SOURCE.headSha,
      sourceTreeSha: SOURCE.treeSha,
      executionIntentSha256: executionIntent.intentSha256,
      disposableIdentitySetSha256: identityEvidence.identitySetSha256,
      fundingIntentSha256: prePacket.fundingIntent.fundingIntentSha256,
      failurePolicySha256: canonicalSplitGateSha256(
        "IAT_B3_DEVNET_FAILURE_POLICY_V1",
        REQUIRED_FAILURE_POLICY,
      ),
      maximumTransactionCount: executionIntent.expectedTransactionCount,
      maximumLamportSpend: executionIntent.maximumLamportSpend,
      network: "solana-devnet",
      rpcUrl: PUBLIC_DEVNET_RPC_URL,
      genesisHash: PUBLIC_DEVNET_GENESIS_HASH,
      oneShot: true,
      reusable: false,
      mainnetAuthorized: false,
      grantSha256: HEX("0"),
    },
    "grantSha256",
  );
  const executionLatch = bind(
    "IAT_B3_PUBLIC_DEVNET_EXECUTION_LATCH_V1",
    {
      startedAtUnixSeconds: EVALUATION.toString(),
      preVerdictSha256: verdict.verdictSha256,
      grantSha256: grant.grantSha256,
      sourceHeadSha: SOURCE.headSha,
      sourceTreeSha: SOURCE.treeSha,
      executionIntentSha256: executionIntent.intentSha256,
      fundingBalanceObserved: true,
      fundingBalanceLamports: "4000000000",
      network: "solana-devnet",
      rpcUrl: PUBLIC_DEVNET_RPC_URL,
      genesisHash: PUBLIC_DEVNET_GENESIS_HASH,
      modelTPhysicalConfirmationRequiredPerSignature: true,
      authorizationUseCount: 1,
      executionPermitted: true,
      mainnetAuthorized: false,
      latchSha256: HEX("0"),
    },
    "latchSha256",
  );
  const publicDevnetBuildEvidence = bind(
    "IAT_B3_PUBLIC_DEVNET_BUILD_EVIDENCE_V1",
    {
      productionArtifactReuseForbidden: true,
      lawArtifactSha256: HEX("1"),
      lawBuildReceiptSha256: HEX("2"),
      economyArtifactSha256: HEX("3"),
      economyBuildReceiptSha256: HEX("4"),
      executionProvenanceSha256: HEX("5"),
      dockerOnly: true,
      offline: true,
      sameContainer: true,
      bindingSha256: HEX("0"),
    },
    "bindingSha256",
  );
  const clusterEvidence = bind(
    "IAT_B3_PUBLIC_DEVNET_CLUSTER_OBSERVATION_V1",
    {
      network: "solana-devnet",
      rpcUrl: PUBLIC_DEVNET_RPC_URL,
      genesisHash: PUBLIC_DEVNET_GENESIS_HASH,
      observedAtUnixSeconds: EVALUATION.toString(),
      finalizedSlot: "500000000",
      observationSha256: HEX("0"),
    },
    "observationSha256",
  );
  const extraOpcode9Cases = PUBLIC_DEVNET_REQUIRED_OPCODE9_CASES.slice(1);
  const records = Array.from({ length: 19 }, (_, index) => {
    const operationId = index === 9
      ? PUBLIC_DEVNET_REQUIRED_OPCODE9_CASES[0]
      : index < 15 ? `OPCODE_${index}` : extraOpcode9Cases[index - 15];
    const expectedCustomError = operationId === "OPCODE_9_CORE_TEAM_HOLD"
      ? 58_001
      : operationId === "OPCODE_9_INVALID_LANE" ? 58_002 : null;
    const preStateSha256 = canonicalSplitGateSha256(
      "IAT_B3_TEST_PRE_STATE_V1",
      { index },
    );
    return bind("IAT_B3_PUBLIC_DEVNET_TRANSACTION_RECEIPT_V1", {
      ordinal: index + 1,
      operationId,
      messageSha256: canonicalSplitGateSha256(
        "IAT_B3_TEST_DEVNET_MESSAGE_V1",
        { index },
      ),
      signature: base58Encode(Buffer.alloc(64, index + 1)),
      slot: (500_000_001n + BigInt(index)).toString(),
      finality: "finalized",
      succeeded: expectedCustomError === null,
      expectedCustomError,
      observedCustomError: expectedCustomError,
      preStateSha256,
      postStateSha256: expectedCustomError === null
        ? canonicalSplitGateSha256("IAT_B3_TEST_POST_STATE_V1", { index })
        : preStateSha256,
      feeLamports: "5000",
      modelTPhysicalConfirmationObserved: true,
      receiptSha256: HEX("0"),
    }, "receiptSha256");
  });
  const opcode9CasesSha256 = canonicalSplitGateSha256(
    "IAT_B3_PUBLIC_DEVNET_OPCODE9_CASE_SET_V1",
    records
      .filter(({ operationId }) => PUBLIC_DEVNET_REQUIRED_OPCODE9_CASES.includes(operationId))
      .map(({ operationId, receiptSha256 }) => ({ operationId, receiptSha256 }))
      .sort((left, right) => left.operationId.localeCompare(right.operationId)),
  );
  const transactionEvidence = bind(
    "IAT_B3_PUBLIC_DEVNET_TRANSACTION_SET_V1",
    {
      started: true,
      complete: true,
      all15OrdinalCasesObserved: true,
      opcode9ConditionalCasesObserved: true,
      opcode9CasesSha256,
      records,
      transactionSetSha256: HEX("0"),
    },
    "transactionSetSha256",
  );
  const stateEvidence = bind(
    "IAT_B3_PUBLIC_DEVNET_STATE_EVIDENCE_V1",
    {
      allAccountsObserved: true,
      allExpectedDeltasExact: true,
      supplyConserved: true,
      feeOnlyDeltasExcludedFromRollback: true,
      preStateSetSha256: HEX("7"),
      postStateSetSha256: HEX("8"),
      bindingSha256: HEX("0"),
    },
    "bindingSha256",
  );
  const dailyLawEvidence = bind(
    "IAT_B3_PUBLIC_DEVNET_DAILY_LAW_EVIDENCE_V1",
    {
      protocolUtcOffsetSeconds: 10_800,
      decisionLocalSecond: 60,
      normalNumerator: 100,
      fridayNumerator: 6_667,
      denominator: 10_000,
      entropyLagSlots: 150,
      boundaryVectorCount: 16,
      grindingVectorCount: 5,
      laggedSlotHashRecomputed: true,
      storedDecisionRecomputed: true,
      sameDayRerollRejected: true,
      limitedProbabilityClaimOnly: true,
      bindingSha256: HEX("0"),
    },
    "bindingSha256",
  );
  const rollbackRetryEvidence = bind(
    "IAT_B3_PUBLIC_DEVNET_ROLLBACK_RETRY_EVIDENCE_V1",
    {
      caseCount: 5,
      allFailedTransactionsAtomic: true,
      allStandaloneRetriesObserved: true,
      noRetryBeforeReconciliation: true,
      noAutomaticRetry: true,
      noAutomaticCompensation: true,
      bindingSha256: HEX("0"),
    },
    "bindingSha256",
  );
  const reconciliationEvidence = bind(
    "IAT_B3_PUBLIC_DEVNET_RECONCILIATION_V1",
    {
      executionState: "COMPLETE_RECONCILED",
      ambiguousSendCount: 0,
      allAmbiguousSendsReconciled: true,
      messageBytesPreserved: true,
      signaturesPreserved: true,
      logsPreserved: true,
      terminalStateSha256: HEX("9"),
      bindingSha256: HEX("0"),
    },
    "bindingSha256",
  );
  const authorityCleanupEvidence = bind(
    "IAT_B3_PUBLIC_DEVNET_AUTHORITY_CLEANUP_V1",
    {
      programUpgradeAuthorityNull: true,
      mintAuthorityNull: true,
      freezeAuthorityNull: true,
      transferHookAuthorityNull: true,
      keysRetainedUntilReconciled: true,
      cleanupOccurredAfterEvidence: true,
      cleanupComplete: true,
      bindingSha256: HEX("0"),
    },
    "bindingSha256",
  );
  return {
    schema: POST_DEVNET_INPUT_SCHEMA,
    sourceCheckpoint: structuredClone(SOURCE),
    preVerdict: verdict,
    userAuthorization: grant,
    executionLatch,
    publicDevnetBuildEvidence,
    clusterEvidence,
    identityEvidence,
    executionIntent,
    transactionEvidence,
    stateEvidence,
    dailyLawEvidence,
    rollbackRetryEvidence,
    reconciliationEvidence,
    authorityCleanupEvidence,
    failurePolicy: structuredClone(REQUIRED_FAILURE_POLICY),
  };
}

function blockerCodes(result) {
  return new Set(result.blockers.map(({ code }) => code));
}

test("35 self-attested structural rows remain HOLD behind the direct-observer boundary", () => {
  assert.equal(PRE_DEVNET_EVIDENCE_BLOCKERS.length, 35);
  assert.equal(new Set(PRE_DEVNET_EVIDENCE_BLOCKERS).size, 35);
  const candidate = assessPreDevnetAuthorizationCandidate(validPrePacket());
  assert.equal(candidate.status, HOLD_STATUS);
  assert.equal(candidate.clearedEvidenceCount, 0);
  assert.deepEqual(candidate.clearedEvidenceCodes, []);
  assert.equal(candidate.blockers.length, 36);
  assert(blockerCodes(candidate).has("PRE_DIRECT_EVIDENCE_OBSERVER_NOT_IMPLEMENTED"));
  assert(PRE_DEVNET_EVIDENCE_BLOCKERS.every((code) => blockerCodes(candidate).has(code)));
  assert.equal(candidate.requestAuthorizationPermitted, false);
  assert.equal(candidate.publicDevnetAuthorizationMayBeRequested, false);
  assert.equal(candidate.gate8Go, false);
  assert.equal(candidate.executionAuthorized, false);
  assert.deepEqual(
    candidate.preservedPendingFacts.map(({ state }) => state),
    ["TRUE_EXPECTED_PENDING", "TRUE_EXPECTED_PENDING"],
  );
  assert.equal(candidate.preservedInvariant.code, MAINNET_HOLD_CODE);
  assert.equal(candidate.preservedInvariant.clearableByThisContract, false);
  assert.equal(candidate.mainnetStatus, HOLD_STATUS);
  assert.equal(validatePreDevnetAuthorizationCandidateAssessment(candidate), true);
});

test("pre-verification binds exact bytes, reruns the assessor, and rejects the X11 self-authoring exploit", () => {
  const root = mkdtempSync(join(tmpdir(), "iat-b3-pre-independent-"));
  try {
    const prePacket = validPrePacket();
    const candidateAssessment = assessPreDevnetAuthorizationCandidate(prePacket);
    const packet = {
      schema: PRE_DEVNET_INDEPENDENT_VERDICT_SCHEMA,
      candidateAssessment,
      candidateAssessmentSha256: candidateAssessment.assessmentSha256,
      preInputArtifact: writeJsonArtifact(root, "pre-input.json", prePacket),
      candidateArtifact: writeJsonArtifact(root, "pre-candidate.json", candidateAssessment),
      assessor: sourceDescriptor(PRE_SCRIPT),
      verifier: verifierDescriptor(PRE_SCRIPT),
      verifiedAtUnixSeconds: EVALUATION.toString(),
    };
    const verdict = assessIndependentPreDevnetVerdict(packet);
    assert.equal(verdict.status, HOLD_STATUS);
    assert.equal(verdict.clearedEvidenceCount, 0);
    assert.equal(verdict.requestAuthorizationPermitted, false);
    assert.equal(verdict.publicDevnetAuthorizationMayBeRequested, false);
    assert.equal(verdict.blockers.length, 36);
    assert(blockerCodes(verdict).has("PRE_DIRECT_EVIDENCE_OBSERVER_NOT_IMPLEMENTED"));
    assert(PRE_DEVNET_EVIDENCE_BLOCKERS.every((code) => blockerCodes(verdict).has(code)));
    assert.equal(validateIndependentPreDevnetVerdict(verdict), true);

    const promoted = structuredClone(verdict);
    promoted.status = PRE_DEVNET_REQUEST_ELIGIBLE_STATUS;
    promoted.clearedEvidenceCount = 36;
    promoted.requestAuthorizationPermitted = true;
    promoted.publicDevnetAuthorizationMayBeRequested = true;
    promoted.blockers = [];
    promoted.verdictSha256 = canonicalSplitGateSha256(
      "IAT_B3_PRE_DEVNET_INDEPENDENT_VERDICT_V1",
      Object.fromEntries(Object.entries(promoted).filter(([key]) => key !== "verdictSha256")),
    );
    assert.equal(validateIndependentPreDevnetVerdict(promoted), false);

    const forgedCandidate = structuredClone(assessPreDevnetAuthorizationCandidate(null));
    forgedCandidate.status = PRE_DEVNET_ELIGIBLE_STATUS;
    forgedCandidate.blockers = [];
    forgedCandidate.clearedEvidenceCount = 35;
    forgedCandidate.assessmentSha256 = canonicalSplitGateSha256(
      "IAT_B3_PRE_DEVNET_ASSESSMENT_V1",
      Object.fromEntries(
        Object.entries(forgedCandidate).filter(([key]) => key !== "assessmentSha256"),
      ),
    );
    const forgedPacket = {
      schema: PRE_DEVNET_INDEPENDENT_VERDICT_SCHEMA,
      candidateAssessment: forgedCandidate,
      candidateAssessmentSha256: forgedCandidate.assessmentSha256,
      preInputArtifact: writeJsonArtifact(root, "forged-pre-input.json", null),
      candidateArtifact: writeJsonArtifact(root, "forged-pre-candidate.json", forgedCandidate),
      assessor: sourceDescriptor(PRE_SCRIPT),
      verifier: verifierDescriptor(PRE_SCRIPT),
      verifiedAtUnixSeconds: EVALUATION.toString(),
    };
    const rejected = assessIndependentPreDevnetVerdict(forgedPacket);
    assert.equal(rejected.status, HOLD_STATUS);
    assert.equal(rejected.requestAuthorizationPermitted, false);
    assert(blockerCodes(rejected).has("PRE_CANDIDATE_INVALID"));
    assert(blockerCodes(rejected).has("PRE_CANDIDATE_REEXECUTION_MISMATCH"));
    assert(blockerCodes(rejected).has("PRE_DIRECT_EVIDENCE_OBSERVER_NOT_IMPLEMENTED"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("24-hour clock drift, gaps, restarts, and locally promoted pending facts fail closed", () => {
  for (const variant of ["gap", "source", "process", "promote-pending"]) {
    const packet = validPrePacket();
    if (variant === "gap") {
      packet.continuousObservationEvidence.samples[1].observedAtUnixSeconds =
        (BigInt(packet.continuousObservationEvidence.samples[0].observedAtUnixSeconds) + 1_501n).toString();
    } else if (variant === "source") {
      packet.continuousObservationEvidence.samples[20].treeSha = "f".repeat(40);
    } else if (variant === "process") {
      packet.continuousObservationEvidence.samples[20].validatorProcessIdentitySha256 = HEX("1");
    } else {
      packet.resolvedFacts = ["DEVNET_NOT_EXECUTED"];
    }
    const result = assessPreDevnetAuthorizationCandidate(packet);
    assert.equal(result.status, HOLD_STATUS, variant);
    assert.equal(result.requestAuthorizationPermitted, false, variant);
    assert(
      blockerCodes(result).has(
        variant === "promote-pending" ? "PRE_INPUT_SHAPE_INVALID" : "PRE_24H_OBSERVATION_INVALID",
      ),
      variant,
    );
  }
});

test("owner WAIT_FOR_MEASUREMENT and PROVIDE_LATER identity inputs remain pre-authorization blockers", () => {
  const packet = validPrePacket();
  packet.ownerPolicyEvidence.entropyRiskAcceptance = "WAIT_FOR_MEASUREMENT";
  packet.productionIdentities.lawProgramId = "PROVIDE_LATER";
  const result = assessPreDevnetAuthorizationCandidate(packet);
  assert.equal(result.status, HOLD_STATUS);
  assert(blockerCodes(result).has("PRE_OWNER_POLICY_INVALID"));
  assert(blockerCodes(result).has("PRE_PRODUCTION_IDENTITIES_INVALID"));
  assert.equal(result.requestAuthorizationPermitted, false);
});

test("self-authored post evidence stays HOLD and the X11 post self-authoring exploit is rejected", () => {
  const packet = validPostPacket();
  const candidate = assessPostDevnetEvidence(packet, { evaluationUnixSeconds: EVALUATION });
  assert.equal(candidate.status, HOLD_STATUS);
  assert.equal(candidate.devnetRehearsalEvidenceAccepted, false);
  assert.equal(candidate.publicDevnetAuthorizationMayBeRequested, false);
  assert.equal(candidate.gate8Go, false);
  assert.equal(candidate.executionState, "UNVERIFIED_OR_UNRECONCILED");
  assert.deepEqual(
    candidate.factStates.map(({ state }) => state),
    ["UNRESOLVED_DIRECT_OBSERVATION_REQUIRED", "TRUE_PENDING_OR_UNACCEPTED"],
  );
  assert(blockerCodes(candidate).has("POST_DIRECT_EVIDENCE_OBSERVER_NOT_IMPLEMENTED"));
  assert.equal(candidate.mainnetStatus, HOLD_STATUS);
  assert.equal(candidate.releaseAuthorized, false);
  assert.equal(validatePostDevnetEvidenceAssessment(candidate), true);

  const root = mkdtempSync(join(tmpdir(), "iat-b3-post-independent-"));
  try {
    const independentVerification = {
      postInputArtifact: writeJsonArtifact(root, "post-input.json", packet),
      candidateArtifact: writeJsonArtifact(root, "post-candidate.json", candidate),
      assessor: sourceDescriptor(POST_SCRIPT),
      verifier: verifierDescriptor(POST_SCRIPT),
      evaluationUnixSeconds: EVALUATION.toString(),
      verifiedAtUnixSeconds: (EVALUATION + 1n).toString(),
    };
    const held = acceptIndependentPostDevnetAssessment(candidate, {
      independentVerification,
      candidateAssessmentSha256: candidate.assessmentSha256,
    });
    assert.equal(held.status, HOLD_STATUS);
    assert.equal(held.devnetRehearsalEvidenceAccepted, false);
    assert.equal(held.preservedInvariant.code, MAINNET_HOLD_CODE);
    assert.equal(held.mainnetExecutionAuthorized, false);
    assert.equal(held.releaseAuthorized, false);
    assert.deepEqual(
      held.blockers.map(({ code }) => code),
      ["POST_DIRECT_EVIDENCE_OBSERVER_NOT_IMPLEMENTED"],
    );
    assert.equal(validateIndependentPostDevnetVerdict(held), true);

    const promoted = structuredClone(held);
    promoted.status = POST_DEVNET_ACCEPTED_STATUS;
    promoted.independentVerificationAccepted = true;
    promoted.devnetRehearsalEvidenceAccepted = true;
    promoted.blockers = [];
    promoted.verdictSha256 = canonicalSplitGateSha256(
      "IAT_B3_POST_DEVNET_INDEPENDENT_VERDICT_V1",
      Object.fromEntries(Object.entries(promoted).filter(([key]) => key !== "verdictSha256")),
    );
    assert.equal(validateIndependentPostDevnetVerdict(promoted), false);

    const forgedCandidate = structuredClone(assessPostDevnetEvidence(null, {
      evaluationUnixSeconds: 1n,
    }));
    forgedCandidate.status = POST_DEVNET_ELIGIBLE_STATUS;
    forgedCandidate.blockers = [];
    forgedCandidate.executionState = "COMPLETE_RECONCILED";
    forgedCandidate.factStates = [
      { code: "DEVNET_NOT_EXECUTED", state: "FALSE_DIRECTLY_OBSERVED" },
      {
        code: "PUBLIC_DEVNET_EXECUTION_PROVENANCE_UNAVAILABLE",
        state: "FALSE_DIRECTLY_OBSERVED",
      },
    ];
    forgedCandidate.assessmentSha256 = canonicalSplitGateSha256(
      "IAT_B3_POST_DEVNET_ASSESSMENT_V1",
      Object.fromEntries(
        Object.entries(forgedCandidate).filter(([key]) => key !== "assessmentSha256"),
      ),
    );
    const rejected = acceptIndependentPostDevnetAssessment(forgedCandidate, {
      independentVerification: {
        postInputArtifact: writeJsonArtifact(root, "forged-post-input.json", null),
        candidateArtifact: writeJsonArtifact(
          root,
          "forged-post-candidate.json",
          forgedCandidate,
        ),
        assessor: sourceDescriptor(POST_SCRIPT),
        verifier: verifierDescriptor(POST_SCRIPT),
        evaluationUnixSeconds: "1",
        verifiedAtUnixSeconds: "2",
      },
      candidateAssessmentSha256: forgedCandidate.assessmentSha256,
    });
    assert.equal(rejected.status, HOLD_STATUS);
    assert.equal(rejected.devnetRehearsalEvidenceAccepted, false);
    assert(blockerCodes(rejected).has("POST_CANDIDATE_REEXECUTION_MISMATCH"));
    assert(blockerCodes(rejected).has("POST_DIRECT_EVIDENCE_OBSERVER_NOT_IMPLEMENTED"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("stale/replayed grants, Mainnet substitution, and execution-intent drift fail closed", () => {
  for (const variant of ["stale", "reuse", "mainnet", "intent"]) {
    const packet = validPostPacket();
    if (variant === "stale") {
      packet.userAuthorization.expiresAtUnixSeconds = (EVALUATION - 1n).toString();
      bind("IAT_B3_PUBLIC_DEVNET_USER_GRANT_V1", packet.userAuthorization, "grantSha256");
      packet.executionLatch.grantSha256 = packet.userAuthorization.grantSha256;
      bind("IAT_B3_PUBLIC_DEVNET_EXECUTION_LATCH_V1", packet.executionLatch, "latchSha256");
    } else if (variant === "reuse") {
      packet.executionLatch.authorizationUseCount = 2;
      bind("IAT_B3_PUBLIC_DEVNET_EXECUTION_LATCH_V1", packet.executionLatch, "latchSha256");
    } else if (variant === "mainnet") {
      packet.executionLatch.network = "mainnet-beta";
      bind("IAT_B3_PUBLIC_DEVNET_EXECUTION_LATCH_V1", packet.executionLatch, "latchSha256");
    } else {
      packet.executionIntent.expectedTransactionCount = 16;
      bind("IAT_B3_PUBLIC_DEVNET_EXECUTION_INTENT_V1", packet.executionIntent, "intentSha256");
    }
    const result = assessPostDevnetEvidence(packet, { evaluationUnixSeconds: EVALUATION });
    assert.equal(result.status, HOLD_STATUS, variant);
    assert.equal(result.releaseAuthorized, false, variant);
    assert.equal(result.mainnetExecutionAuthorized, false, variant);
  }
});

test("a self-authored partial-execution claim stays unresolved and cannot relabel either fact", () => {
  const packet = validPostPacket();
  packet.transactionEvidence.complete = false;
  bind("IAT_B3_PUBLIC_DEVNET_TRANSACTION_SET_V1", packet.transactionEvidence, "transactionSetSha256");
  packet.reconciliationEvidence.executionState = "PARTIAL_UNRECONCILED";
  bind("IAT_B3_PUBLIC_DEVNET_RECONCILIATION_V1", packet.reconciliationEvidence, "bindingSha256");
  packet.authorityCleanupEvidence.cleanupComplete = false;
  bind("IAT_B3_PUBLIC_DEVNET_AUTHORITY_CLEANUP_V1", packet.authorityCleanupEvidence, "bindingSha256");
  const result = assessPostDevnetEvidence(packet, { evaluationUnixSeconds: EVALUATION });
  assert.equal(result.status, HOLD_STATUS);
  assert.equal(result.executionState, "UNVERIFIED_OR_UNRECONCILED");
  assert.equal(result.factStates[0].state, "UNRESOLVED_DIRECT_OBSERVATION_REQUIRED");
  assert.equal(result.factStates[1].state, "TRUE_PENDING_OR_UNACCEPTED");
  assert(blockerCodes(result).has("POST_TRANSACTION_RECEIPTS_INVALID"));
  assert(blockerCodes(result).has("POST_RECONCILIATION_INVALID"));
  assert(blockerCodes(result).has("POST_AUTHORITY_OR_CLEANUP_INVALID"));
});

test("receipt/signature mutations, Daily-Law drift, unsafe retry, and premature cleanup fail closed after digest recomputation", () => {
  for (const variant of ["receipt", "signature", "duplicate", "entropy", "retry", "cleanup", "production-reuse"]) {
    const packet = validPostPacket();
    if (variant === "receipt") {
      packet.transactionEvidence.records.pop();
      bind("IAT_B3_PUBLIC_DEVNET_TRANSACTION_SET_V1", packet.transactionEvidence, "transactionSetSha256");
    } else if (variant === "signature") {
      packet.transactionEvidence.records[0].signature = "1".repeat(88);
      bind(
        "IAT_B3_PUBLIC_DEVNET_TRANSACTION_RECEIPT_V1",
        packet.transactionEvidence.records[0],
        "receiptSha256",
      );
      bind("IAT_B3_PUBLIC_DEVNET_TRANSACTION_SET_V1", packet.transactionEvidence, "transactionSetSha256");
    } else if (variant === "duplicate") {
      packet.transactionEvidence.records[1].signature =
        packet.transactionEvidence.records[0].signature;
      bind(
        "IAT_B3_PUBLIC_DEVNET_TRANSACTION_RECEIPT_V1",
        packet.transactionEvidence.records[1],
        "receiptSha256",
      );
      bind("IAT_B3_PUBLIC_DEVNET_TRANSACTION_SET_V1", packet.transactionEvidence, "transactionSetSha256");
    } else if (variant === "entropy") {
      packet.dailyLawEvidence.entropyLagSlots = 149;
      bind("IAT_B3_PUBLIC_DEVNET_DAILY_LAW_EVIDENCE_V1", packet.dailyLawEvidence, "bindingSha256");
    } else if (variant === "retry") {
      packet.rollbackRetryEvidence.noAutomaticRetry = false;
      bind("IAT_B3_PUBLIC_DEVNET_ROLLBACK_RETRY_EVIDENCE_V1", packet.rollbackRetryEvidence, "bindingSha256");
    } else if (variant === "cleanup") {
      packet.authorityCleanupEvidence.keysRetainedUntilReconciled = false;
      bind("IAT_B3_PUBLIC_DEVNET_AUTHORITY_CLEANUP_V1", packet.authorityCleanupEvidence, "bindingSha256");
    } else {
      packet.publicDevnetBuildEvidence.productionArtifactReuseForbidden = false;
      bind("IAT_B3_PUBLIC_DEVNET_BUILD_EVIDENCE_V1", packet.publicDevnetBuildEvidence, "bindingSha256");
    }
    const result = assessPostDevnetEvidence(packet, { evaluationUnixSeconds: EVALUATION });
    assert.equal(result.status, HOLD_STATUS, variant);
  }
});

test("independent post verification rejects verifier/source and candidate-byte substitution", () => {
  const root = mkdtempSync(join(tmpdir(), "iat-b3-post-bindings-"));
  try {
    const packet = validPostPacket();
    const candidate = assessPostDevnetEvidence(packet, {
      evaluationUnixSeconds: EVALUATION,
    });
    const common = {
      postInputArtifact: writeJsonArtifact(root, "post-input.json", packet),
      candidateArtifact: writeJsonArtifact(root, "post-candidate.json", candidate),
      assessor: sourceDescriptor(POST_SCRIPT),
      verifier: verifierDescriptor(POST_SCRIPT),
      evaluationUnixSeconds: EVALUATION.toString(),
      verifiedAtUnixSeconds: (EVALUATION + 1n).toString(),
    };
    const badVerifier = acceptIndependentPostDevnetAssessment(candidate, {
      independentVerification: {
        ...common,
        verifier: { ...common.verifier, executedSha256: HEX("f") },
      },
      candidateAssessmentSha256: candidate.assessmentSha256,
    });
    assert(blockerCodes(badVerifier).has("POST_VERIFIER_BINDING_INVALID"));

    const substituted = structuredClone(candidate);
    substituted.sourceCheckpoint.headSha = "f".repeat(40);
    substituted.assessmentSha256 = canonicalSplitGateSha256(
      "IAT_B3_POST_DEVNET_ASSESSMENT_V1",
      Object.fromEntries(
        Object.entries(substituted).filter(([key]) => key !== "assessmentSha256"),
      ),
    );
    const badCandidate = acceptIndependentPostDevnetAssessment(substituted, {
      independentVerification: {
        ...common,
        candidateArtifact: writeJsonArtifact(root, "substituted-candidate.json", substituted),
      },
      candidateAssessmentSha256: substituted.assessmentSha256,
    });
    assert.equal(badCandidate.status, HOLD_STATUS);
    assert.equal(badCandidate.devnetRehearsalEvidenceAccepted, false);
    assert(blockerCodes(badCandidate).has("POST_CANDIDATE_REEXECUTION_MISMATCH"));
    assert.equal(badCandidate.mainnetStatus, HOLD_STATUS);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("duplicate-key and unknown-key CLI inputs are rejected with HOLD/exit 2", () => {
  const root = mkdtempSync(join(tmpdir(), "iat-b3-split-gate-"));
  try {
    for (const [name, bytes] of [
      ["duplicate.json", '{"schema":"a","schema":"b"}'],
      ["unknown.json", JSON.stringify({ ...validPrePacket(), unknownAuthorization: true })],
    ]) {
      const path = join(root, name);
      writeFileSync(path, bytes);
      const result = spawnSync(process.execPath, [PRE_SCRIPT, "--input", path], {
        cwd: SITE_ROOT,
        encoding: "utf8",
      });
      assert.equal(result.status, 2, name);
      const assessment = JSON.parse(result.stdout);
      assert.equal(assessment.status, HOLD_STATUS, name);
      assert.equal(assessment.requestAuthorizationPermitted, false, name);
      assert.equal(assessment.mainnetStatus, HOLD_STATUS, name);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("missing pre/post CLI inputs produce machine-readable HOLD/exit 2", () => {
  for (const script of [PRE_SCRIPT, POST_SCRIPT]) {
    const result = spawnSync(process.execPath, [script], {
      cwd: SITE_ROOT,
      encoding: "utf8",
    });
    assert.equal(result.status, 2, script);
    const assessment = JSON.parse(result.stdout);
    assert.equal(assessment.status, HOLD_STATUS, script);
    assert.equal(assessment.gate8Go, false, script);
    assert.equal(assessment.publicDevnetAuthorizationMayBeRequested, false, script);
    assert.equal(assessment.mainnetStatus, HOLD_STATUS, script);
  }
});
