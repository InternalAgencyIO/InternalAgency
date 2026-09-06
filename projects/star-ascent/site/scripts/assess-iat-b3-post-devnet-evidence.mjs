#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  closeSync,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
  realpathSync,
} from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";

import { validateIndependentPreDevnetVerdict } from "./assess-iat-b3-pre-devnet-authorization.mjs";

import {
  HOLD_STATUS,
  MAINNET_HOLD_INVARIANT,
  POST_DEVNET_ASSESSMENT_SCHEMA,
  POST_DEVNET_INPUT_SCHEMA,
  POST_DEVNET_INDEPENDENT_VERDICT_SCHEMA,
  PRE_DEVNET_INDEPENDENT_VERDICT_SCHEMA,
  PRE_DEVNET_REQUEST_ELIGIBLE_STATUS,
  PUBLIC_DEVNET_GENESIS_HASH,
  PUBLIC_DEVNET_GRANT_CONFIRMATION,
  PUBLIC_DEVNET_GRANT_SCOPE,
  PUBLIC_DEVNET_MAX_FUTURE_SKEW_SECONDS,
  PUBLIC_DEVNET_MAX_GRANT_LIFETIME_SECONDS,
  PUBLIC_DEVNET_RPC_URL,
  PUBLIC_DEVNET_REQUIRED_OPCODE9_CASES,
  PUBLIC_DEVNET_SOLE_HUMAN_GATE,
  PUBLIC_DEVNET_USER_GRANT_SCHEMA,
  canonicalSplitGateSha256,
  exactKeys,
  parseStrictSplitGateJson,
  splitGateSafety,
  validateDigest,
  validateFailurePolicy,
  validatePublicKey,
  validateSolanaSignature,
  validateSourceCheckpoint,
} from "./lib/iat-b3-devnet-gate-split-contract.mjs";

const POST_INPUT_KEYS = Object.freeze([
  "schema",
  "sourceCheckpoint",
  "preVerdict",
  "userAuthorization",
  "executionLatch",
  "publicDevnetBuildEvidence",
  "clusterEvidence",
  "identityEvidence",
  "executionIntent",
  "transactionEvidence",
  "stateEvidence",
  "dailyLawEvidence",
  "rollbackRetryEvidence",
  "reconciliationEvidence",
  "authorityCleanupEvidence",
  "failurePolicy",
]);
const GRANT_KEYS = Object.freeze([
  "schema",
  "authorizationId",
  "authorizationRequestId",
  "confirmation",
  "scope",
  "soleHumanGate",
  "authorizedBy",
  "authorized",
  "authorizedAtUnixSeconds",
  "expiresAtUnixSeconds",
  "preVerdictSha256",
  "sourceHeadSha",
  "sourceTreeSha",
  "executionIntentSha256",
  "disposableIdentitySetSha256",
  "fundingIntentSha256",
  "failurePolicySha256",
  "maximumTransactionCount",
  "maximumLamportSpend",
  "network",
  "rpcUrl",
  "genesisHash",
  "oneShot",
  "reusable",
  "mainnetAuthorized",
  "grantSha256",
]);
const LATCH_KEYS = Object.freeze([
  "startedAtUnixSeconds",
  "preVerdictSha256",
  "grantSha256",
  "sourceHeadSha",
  "sourceTreeSha",
  "executionIntentSha256",
  "fundingBalanceObserved",
  "fundingBalanceLamports",
  "network",
  "rpcUrl",
  "genesisHash",
  "modelTPhysicalConfirmationRequiredPerSignature",
  "authorizationUseCount",
  "executionPermitted",
  "mainnetAuthorized",
  "latchSha256",
]);
const BUILD_KEYS = Object.freeze([
  "productionArtifactReuseForbidden",
  "lawArtifactSha256",
  "lawBuildReceiptSha256",
  "economyArtifactSha256",
  "economyBuildReceiptSha256",
  "executionProvenanceSha256",
  "dockerOnly",
  "offline",
  "sameContainer",
  "bindingSha256",
]);
const CLUSTER_KEYS = Object.freeze([
  "network",
  "rpcUrl",
  "genesisHash",
  "observedAtUnixSeconds",
  "finalizedSlot",
  "observationSha256",
]);
const IDENTITY_KEYS = Object.freeze([
  "lawProgramId",
  "economyProgramId",
  "mint",
  "payerPublicKey",
  "allDisposable",
  "allDistinct",
  "productionIdentityReuseObserved",
  "identitySetSha256",
]);
const EXECUTION_INTENT_KEYS = Object.freeze([
  "network",
  "rpcUrl",
  "genesisHash",
  "oneShot",
  "disposableIdentities",
  "productionIdentityReuseForbidden",
  "expectedTransactionCount",
  "maximumLamportSpend",
  "operationMapsSha256",
  "ceremonyStagesSha256",
  "dailyLawBoundarySha256",
  "rollbackMatrixSha256",
  "intentSha256",
]);
const TRANSACTION_SET_KEYS = Object.freeze([
  "started",
  "complete",
  "all15OrdinalCasesObserved",
  "opcode9ConditionalCasesObserved",
  "opcode9CasesSha256",
  "records",
  "transactionSetSha256",
]);
const TRANSACTION_KEYS = Object.freeze([
  "ordinal",
  "operationId",
  "messageSha256",
  "signature",
  "slot",
  "finality",
  "succeeded",
  "expectedCustomError",
  "observedCustomError",
  "preStateSha256",
  "postStateSha256",
  "feeLamports",
  "modelTPhysicalConfirmationObserved",
  "receiptSha256",
]);
const STATE_KEYS = Object.freeze([
  "allAccountsObserved",
  "allExpectedDeltasExact",
  "supplyConserved",
  "feeOnlyDeltasExcludedFromRollback",
  "preStateSetSha256",
  "postStateSetSha256",
  "bindingSha256",
]);
const DAILY_LAW_KEYS = Object.freeze([
  "protocolUtcOffsetSeconds",
  "decisionLocalSecond",
  "normalNumerator",
  "fridayNumerator",
  "denominator",
  "entropyLagSlots",
  "boundaryVectorCount",
  "grindingVectorCount",
  "laggedSlotHashRecomputed",
  "storedDecisionRecomputed",
  "sameDayRerollRejected",
  "limitedProbabilityClaimOnly",
  "bindingSha256",
]);
const ROLLBACK_KEYS = Object.freeze([
  "caseCount",
  "allFailedTransactionsAtomic",
  "allStandaloneRetriesObserved",
  "noRetryBeforeReconciliation",
  "noAutomaticRetry",
  "noAutomaticCompensation",
  "bindingSha256",
]);
const RECONCILIATION_KEYS = Object.freeze([
  "executionState",
  "ambiguousSendCount",
  "allAmbiguousSendsReconciled",
  "messageBytesPreserved",
  "signaturesPreserved",
  "logsPreserved",
  "terminalStateSha256",
  "bindingSha256",
]);
const CLEANUP_KEYS = Object.freeze([
  "programUpgradeAuthorityNull",
  "mintAuthorityNull",
  "freezeAuthorityNull",
  "transferHookAuthorityNull",
  "keysRetainedUntilReconciled",
  "cleanupOccurredAfterEvidence",
  "cleanupComplete",
  "bindingSha256",
]);
const INDEPENDENT_VERIFIER_KEYS = Object.freeze([
  "lane",
  "type",
  "directEvidenceOnly",
  "humanReviewerRequired",
  "sourcePath",
  "sourceSha256",
  "executedSha256",
  "byteLength",
]);
const ARTIFACT_DESCRIPTOR_KEYS = Object.freeze(["path", "sha256", "byteLength"]);
const ASSESSOR_KEYS = Object.freeze([
  "sourcePath",
  "sourceSha256",
  "executedSha256",
  "byteLength",
]);
const CURRENT_ASSESSOR_PATH = realpathSync(fileURLToPath(import.meta.url));
const CURRENT_ASSESSOR_BYTES = readFileSync(CURRENT_ASSESSOR_PATH);
const CURRENT_ASSESSOR_SHA256 = createHash("sha256")
  .update(CURRENT_ASSESSOR_BYTES)
  .digest("hex");
const MAX_BOUND_ARTIFACT_BYTES = 16 * 1024 * 1024;

function blocker(code, detail) {
  return Object.freeze({ code, detail });
}

function add(blockers, condition, code, detail) {
  if (!condition) blockers.push(blocker(code, detail));
}

function recomputeRecord(domain, value, digestKey) {
  if (value === null || typeof value !== "object" || Array.isArray(value)
    || !validateDigest(value[digestKey])) return false;
  const core = Object.fromEntries(Object.entries(value).filter(([key]) => key !== digestKey));
  return value[digestKey] === canonicalSplitGateSha256(domain, core);
}

function validatePreVerdict(value, sourceCheckpoint, evaluationUnixSeconds) {
  if (!validateIndependentPreDevnetVerdict(value)
    || value?.schema !== PRE_DEVNET_INDEPENDENT_VERDICT_SCHEMA
    || value?.status !== PRE_DEVNET_REQUEST_ELIGIBLE_STATUS
    || value?.gate8Go !== false
    || value?.requestAuthorizationPermitted !== true
    || value?.publicDevnetAuthorizationMayBeRequested !== true
    || value?.executionAuthorized !== false
    || value?.publicDevnetAuthorized !== false
    || value?.devnetExecuted !== false
    || value?.publicDevnetExecutionProvenanceAvailable !== false
    || value?.mainnetStatus !== "HOLD"
    || value?.blockers?.length !== 0
    || value?.preservedInvariant?.state !== "TRUE_INVARIANT"
    || value?.preservedInvariant?.clearableByThisContract !== false
    || value?.candidateArtifact?.sha256 === undefined
    || !recomputeRecord("IAT_B3_PRE_DEVNET_INDEPENDENT_VERDICT_V1", value, "verdictSha256")) {
    return false;
  }
  let verifiedAt;
  try {
    verifiedAt = BigInt(value.verifiedAtUnixSeconds);
  } catch {
    return false;
  }
  return verifiedAt <= evaluationUnixSeconds + BigInt(PUBLIC_DEVNET_MAX_FUTURE_SKEW_SECONDS)
    && evaluationUnixSeconds - verifiedAt <= BigInt(PUBLIC_DEVNET_MAX_GRANT_LIFETIME_SECONDS)
    && value?.verifier?.lane === "independent_launch_redteam"
    && sourceCheckpoint?.headSha === value?.sourceCheckpoint?.headSha
    && sourceCheckpoint?.treeSha === value?.sourceCheckpoint?.treeSha;
}

function validateGrant(value, preVerdict, sourceCheckpoint, executionIntent, failurePolicy, evaluationUnixSeconds) {
  if (!exactKeys(value, GRANT_KEYS)
    || value.schema !== PUBLIC_DEVNET_USER_GRANT_SCHEMA
    || typeof value.authorizationId !== "string" || value.authorizationId.length < 8
    || typeof value.authorizationRequestId !== "string" || value.authorizationRequestId.length < 8
    || value.confirmation !== PUBLIC_DEVNET_GRANT_CONFIRMATION
    || value.scope !== PUBLIC_DEVNET_GRANT_SCOPE
    || value.soleHumanGate !== PUBLIC_DEVNET_SOLE_HUMAN_GATE
    || typeof value.authorizedBy !== "string" || value.authorizedBy.length < 3
    || value.authorized !== true
    || value.preVerdictSha256 !== preVerdict?.verdictSha256
    || value.sourceHeadSha !== sourceCheckpoint?.headSha
    || value.sourceTreeSha !== sourceCheckpoint?.treeSha
    || value.executionIntentSha256 !== executionIntent?.intentSha256
    || value.executionIntentSha256 !== preVerdict?.executionIntentSha256
    || value.failurePolicySha256
      !== canonicalSplitGateSha256("IAT_B3_DEVNET_FAILURE_POLICY_V1", failurePolicy)
    || !validateDigest(value.disposableIdentitySetSha256)
    || !validateDigest(value.fundingIntentSha256)
    || value.maximumTransactionCount !== executionIntent?.expectedTransactionCount
    || value.maximumLamportSpend !== executionIntent?.maximumLamportSpend
    || value.network !== "solana-devnet"
    || value.rpcUrl !== PUBLIC_DEVNET_RPC_URL
    || value.genesisHash !== PUBLIC_DEVNET_GENESIS_HASH
    || value.oneShot !== true
    || value.reusable !== false
    || value.mainnetAuthorized !== false
    || !recomputeRecord("IAT_B3_PUBLIC_DEVNET_USER_GRANT_V1", value, "grantSha256")) return false;
  let authorizedAt;
  let expiresAt;
  try {
    authorizedAt = BigInt(value.authorizedAtUnixSeconds);
    expiresAt = BigInt(value.expiresAtUnixSeconds);
  } catch {
    return false;
  }
  return authorizedAt > 0n
    && expiresAt > authorizedAt
    && expiresAt - authorizedAt <= BigInt(PUBLIC_DEVNET_MAX_GRANT_LIFETIME_SECONDS)
    && authorizedAt <= evaluationUnixSeconds + BigInt(PUBLIC_DEVNET_MAX_FUTURE_SKEW_SECONDS)
    && evaluationUnixSeconds <= expiresAt;
}

function validateLatch(value, preVerdict, grant, sourceCheckpoint, executionIntent) {
  if (!exactKeys(value, LATCH_KEYS)
    || value.preVerdictSha256 !== preVerdict?.verdictSha256
    || value.grantSha256 !== grant?.grantSha256
    || value.sourceHeadSha !== sourceCheckpoint?.headSha
    || value.sourceTreeSha !== sourceCheckpoint?.treeSha
    || value.executionIntentSha256 !== executionIntent?.intentSha256
    || value.fundingBalanceObserved !== true
    || !/^[1-9][0-9]*$/u.test(value.fundingBalanceLamports)
    || value.network !== "solana-devnet"
    || value.rpcUrl !== PUBLIC_DEVNET_RPC_URL
    || value.genesisHash !== PUBLIC_DEVNET_GENESIS_HASH
    || value.modelTPhysicalConfirmationRequiredPerSignature !== true
    || value.authorizationUseCount !== 1
    || value.executionPermitted !== true
    || value.mainnetAuthorized !== false
    || !recomputeRecord("IAT_B3_PUBLIC_DEVNET_EXECUTION_LATCH_V1", value, "latchSha256")) return false;
  try {
    return BigInt(value.startedAtUnixSeconds) > 0n
      && BigInt(value.fundingBalanceLamports)
        >= BigInt(executionIntent?.maximumLamportSpend ?? "0");
  } catch {
    return false;
  }
}

function validateBuild(value) {
  return exactKeys(value, BUILD_KEYS)
    && value.productionArtifactReuseForbidden === true
    && validateDigest(value.lawArtifactSha256)
    && validateDigest(value.lawBuildReceiptSha256)
    && validateDigest(value.economyArtifactSha256)
    && validateDigest(value.economyBuildReceiptSha256)
    && validateDigest(value.executionProvenanceSha256)
    && validateDigest(value.bindingSha256)
    && value.lawArtifactSha256 !== value.economyArtifactSha256
    && value.lawBuildReceiptSha256 !== value.economyBuildReceiptSha256
    && value.dockerOnly === true
    && value.offline === true
    && value.sameContainer === true
    && recomputeRecord("IAT_B3_PUBLIC_DEVNET_BUILD_EVIDENCE_V1", value, "bindingSha256");
}

function validateCluster(value) {
  return exactKeys(value, CLUSTER_KEYS)
    && value.network === "solana-devnet"
    && value.rpcUrl === PUBLIC_DEVNET_RPC_URL
    && value.genesisHash === PUBLIC_DEVNET_GENESIS_HASH
    && /^[1-9][0-9]*$/u.test(value.observedAtUnixSeconds)
    && /^[1-9][0-9]*$/u.test(value.finalizedSlot)
    && recomputeRecord("IAT_B3_PUBLIC_DEVNET_CLUSTER_OBSERVATION_V1", value, "observationSha256");
}

function validateIdentities(value, grant, executionIntent) {
  return exactKeys(value, IDENTITY_KEYS)
    && validatePublicKey(value.lawProgramId)
    && validatePublicKey(value.economyProgramId)
    && validatePublicKey(value.mint)
    && validatePublicKey(value.payerPublicKey)
    && new Set([value.lawProgramId, value.economyProgramId, value.mint, value.payerPublicKey]).size === 4
    && value.allDisposable === true
    && value.allDistinct === true
    && value.productionIdentityReuseObserved === false
    && value.identitySetSha256 === grant?.disposableIdentitySetSha256
    && value.lawProgramId === executionIntent?.disposableIdentities?.lawProgramId
    && value.economyProgramId === executionIntent?.disposableIdentities?.economyProgramId
    && value.mint === executionIntent?.disposableIdentities?.mint
    && recomputeRecord("IAT_B3_PUBLIC_DEVNET_IDENTITY_SET_V1", value, "identitySetSha256");
}

function validateExecutionIntent(value) {
  return exactKeys(value, EXECUTION_INTENT_KEYS)
    && value.network === "solana-devnet"
    && value.rpcUrl === PUBLIC_DEVNET_RPC_URL
    && value.genesisHash === PUBLIC_DEVNET_GENESIS_HASH
    && value.oneShot === true
    && exactKeys(value.disposableIdentities, ["lawProgramId", "economyProgramId", "mint"])
    && Object.values(value.disposableIdentities).every(validatePublicKey)
    && new Set(Object.values(value.disposableIdentities)).size === 3
    && value.productionIdentityReuseForbidden === true
    && Number.isSafeInteger(value.expectedTransactionCount)
    && value.expectedTransactionCount >= 19
    && /^[1-9][0-9]*$/u.test(value.maximumLamportSpend)
    && [
      "operationMapsSha256",
      "ceremonyStagesSha256",
      "dailyLawBoundarySha256",
      "rollbackMatrixSha256",
    ].every((key) => validateDigest(value[key]))
    && recomputeRecord("IAT_B3_PUBLIC_DEVNET_EXECUTION_INTENT_V1", value, "intentSha256");
}

function validateTransactionSet(value, expectedCount) {
  if (!exactKeys(value, TRANSACTION_SET_KEYS)
    || value.started !== true
    || value.complete !== true
    || value.all15OrdinalCasesObserved !== true
    || value.opcode9ConditionalCasesObserved !== true
    || !validateDigest(value.opcode9CasesSha256)
    || !Array.isArray(value.records)
    || value.records.length !== expectedCount
    || !validateDigest(value.transactionSetSha256)) return false;
  const signatures = new Set();
  const messages = new Set();
  const observedOpcodes = new Set();
  for (let index = 0; index < value.records.length; index += 1) {
    const record = value.records[index];
    if (!exactKeys(record, TRANSACTION_KEYS)
      || record.ordinal !== index + 1
      || typeof record.operationId !== "string" || record.operationId.length < 2
      || !validateDigest(record.messageSha256)
      || !validateSolanaSignature(record.signature)
      || !/^[1-9][0-9]*$/u.test(record.slot)
      || record.finality !== "finalized"
      || typeof record.succeeded !== "boolean"
      || !(record.expectedCustomError === null
        || Number.isSafeInteger(record.expectedCustomError))
      || record.observedCustomError !== record.expectedCustomError
      || !validateDigest(record.preStateSha256)
      || !validateDigest(record.postStateSha256)
      || !/^[0-9]+$/u.test(record.feeLamports)
      || record.modelTPhysicalConfirmationObserved !== true
      || signatures.has(record.signature)
      || messages.has(record.messageSha256)
      || !recomputeRecord("IAT_B3_PUBLIC_DEVNET_TRANSACTION_RECEIPT_V1", record, "receiptSha256")) return false;
    if (record.succeeded !== (record.expectedCustomError === null)
      || (!record.succeeded && record.preStateSha256 !== record.postStateSha256)) return false;
    signatures.add(record.signature);
    messages.add(record.messageSha256);
    const opcode = record.operationId.match(/^OPCODE_([0-9]|1[0-4])(?:_|$)/u)?.[1];
    if (opcode !== undefined) observedOpcodes.add(Number(opcode));
  }
  if (observedOpcodes.size !== 15) return false;
  const opcode9Cases = value.records
    .filter(({ operationId }) => PUBLIC_DEVNET_REQUIRED_OPCODE9_CASES.includes(operationId))
    .map(({ operationId, receiptSha256 }) => ({ operationId, receiptSha256 }))
    .sort((left, right) => left.operationId.localeCompare(right.operationId));
  if (opcode9Cases.length !== PUBLIC_DEVNET_REQUIRED_OPCODE9_CASES.length
    || new Set(opcode9Cases.map(({ operationId }) => operationId)).size
      !== PUBLIC_DEVNET_REQUIRED_OPCODE9_CASES.length
    || value.opcode9CasesSha256 !== canonicalSplitGateSha256(
      "IAT_B3_PUBLIC_DEVNET_OPCODE9_CASE_SET_V1",
      opcode9Cases,
    )) return false;
  const { transactionSetSha256, ...core } = value;
  return transactionSetSha256 === canonicalSplitGateSha256(
    "IAT_B3_PUBLIC_DEVNET_TRANSACTION_SET_V1",
    core,
  );
}

function validateState(value) {
  return exactKeys(value, STATE_KEYS)
    && value.allAccountsObserved === true
    && value.allExpectedDeltasExact === true
    && value.supplyConserved === true
    && value.feeOnlyDeltasExcludedFromRollback === true
    && validateDigest(value.preStateSetSha256)
    && validateDigest(value.postStateSetSha256)
    && recomputeRecord("IAT_B3_PUBLIC_DEVNET_STATE_EVIDENCE_V1", value, "bindingSha256");
}

function validateDailyLaw(value) {
  return exactKeys(value, DAILY_LAW_KEYS)
    && value.protocolUtcOffsetSeconds === 10_800
    && value.decisionLocalSecond === 60
    && value.normalNumerator === 100
    && value.fridayNumerator === 6_667
    && value.denominator === 10_000
    && value.entropyLagSlots === 150
    && value.boundaryVectorCount === 16
    && value.grindingVectorCount === 5
    && value.laggedSlotHashRecomputed === true
    && value.storedDecisionRecomputed === true
    && value.sameDayRerollRejected === true
    && value.limitedProbabilityClaimOnly === true
    && recomputeRecord("IAT_B3_PUBLIC_DEVNET_DAILY_LAW_EVIDENCE_V1", value, "bindingSha256");
}

function validateRollback(value) {
  return exactKeys(value, ROLLBACK_KEYS)
    && value.caseCount === 5
    && value.allFailedTransactionsAtomic === true
    && value.allStandaloneRetriesObserved === true
    && value.noRetryBeforeReconciliation === true
    && value.noAutomaticRetry === true
    && value.noAutomaticCompensation === true
    && recomputeRecord("IAT_B3_PUBLIC_DEVNET_ROLLBACK_RETRY_EVIDENCE_V1", value, "bindingSha256");
}

function validateReconciliation(value) {
  return exactKeys(value, RECONCILIATION_KEYS)
    && value.executionState === "COMPLETE_RECONCILED"
    && Number.isSafeInteger(value.ambiguousSendCount)
    && value.ambiguousSendCount >= 0
    && value.allAmbiguousSendsReconciled === true
    && value.messageBytesPreserved === true
    && value.signaturesPreserved === true
    && value.logsPreserved === true
    && validateDigest(value.terminalStateSha256)
    && recomputeRecord("IAT_B3_PUBLIC_DEVNET_RECONCILIATION_V1", value, "bindingSha256");
}

function validateCleanup(value) {
  return exactKeys(value, CLEANUP_KEYS)
    && value.programUpgradeAuthorityNull === true
    && value.mintAuthorityNull === true
    && value.freezeAuthorityNull === true
    && value.transferHookAuthorityNull === true
    && value.keysRetainedUntilReconciled === true
    && value.cleanupOccurredAfterEvidence === true
    && value.cleanupComplete === true
    && recomputeRecord("IAT_B3_PUBLIC_DEVNET_AUTHORITY_CLEANUP_V1", value, "bindingSha256");
}

export function assessPostDevnetEvidence(packet, {
  evaluationUnixSeconds = BigInt(Math.floor(Date.now() / 1_000)),
  injectedTestSeam = false,
} = {}) {
  const blockers = [];
  add(blockers, exactKeys(packet, POST_INPUT_KEYS), "POST_INPUT_SHAPE_INVALID", "exact post-Devnet input shape is required");
  add(blockers, packet?.schema === POST_DEVNET_INPUT_SCHEMA, "POST_INPUT_SCHEMA_INVALID", "post-Devnet input schema is not v1");
  add(blockers, validateSourceCheckpoint(packet?.sourceCheckpoint), "POST_SOURCE_CHECKPOINT_INVALID", "the exact clean pre-authorized head/tree is required");
  add(blockers, validatePreVerdict(packet?.preVerdict, packet?.sourceCheckpoint, evaluationUnixSeconds), "POST_PRE_VERDICT_INVALID", "a fresh exact eligible independent pre-verdict is required");
  add(blockers, validateExecutionIntent(packet?.executionIntent), "POST_EXECUTION_INTENT_INVALID", "the exact source-bound execution intent is required");
  add(blockers, validateFailurePolicy(packet?.failurePolicy), "POST_FAILURE_POLICY_INVALID", "stop/preserve/reconcile and key-retention policy must remain exact");
  add(blockers, validateGrant(packet?.userAuthorization, packet?.preVerdict, packet?.sourceCheckpoint, packet?.executionIntent, packet?.failurePolicy, evaluationUnixSeconds), "POST_USER_AUTHORIZATION_INVALID", "a fresh one-shot digest-bound user grant is required");
  add(blockers, validateLatch(packet?.executionLatch, packet?.preVerdict, packet?.userAuthorization, packet?.sourceCheckpoint, packet?.executionIntent), "POST_EXECUTION_LATCH_INVALID", "the pre-write Devnet-only execution latch must bind source, grant, funding, network, and Genesis");
  add(blockers, validateBuild(packet?.publicDevnetBuildEvidence), "POST_BUILD_PROVENANCE_INVALID", "actual same-container disposable build provenance is required");
  add(blockers, validateCluster(packet?.clusterEvidence), "POST_CLUSTER_EVIDENCE_INVALID", "actual finalized observations from the pinned Devnet cluster are required");
  add(blockers, validateIdentities(packet?.identityEvidence, packet?.userAuthorization, packet?.executionIntent), "POST_DISPOSABLE_IDENTITIES_INVALID", "fresh distinct disposable identities must bind the user grant and exact pre-authorized intent");
  add(blockers, validateTransactionSet(packet?.transactionEvidence, packet?.executionIntent?.expectedTransactionCount), "POST_TRANSACTION_RECEIPTS_INVALID", "the exact finalized transaction set and Model-T confirmations are required");
  add(blockers, validateState(packet?.stateEvidence), "POST_STATE_EVIDENCE_INVALID", "complete pre/post state and supply-conservation evidence is required");
  add(blockers, validateDailyLaw(packet?.dailyLawEvidence), "POST_DAILY_LAW_EVIDENCE_INVALID", "the exact 150-slot Daily-Law boundary and timing-risk evidence is required");
  add(blockers, validateRollback(packet?.rollbackRetryEvidence), "POST_ROLLBACK_RETRY_EVIDENCE_INVALID", "all five atomic failure and reconciled standalone-retry cases are required");
  add(blockers, validateReconciliation(packet?.reconciliationEvidence), "POST_RECONCILIATION_INVALID", "every partial or ambiguous send must be preserved and conclusively reconciled");
  add(blockers, validateCleanup(packet?.authorityCleanupEvidence), "POST_AUTHORITY_OR_CLEANUP_INVALID", "terminal authorities and post-evidence cleanup must be exact");
  if (injectedTestSeam) blockers.push(blocker("TEST_ONLY_CONTEXT_INJECTED", "injected observations can never prove public execution"));
  blockers.push(blocker(
    "POST_DIRECT_EVIDENCE_OBSERVER_NOT_IMPLEMENTED",
    "structural hashes, self-declared grant/device fields, and transaction-shaped JSON are not direct RPC, signature, account-state, or hardware-confirmation evidence",
  ));

  const orderedBlockers = Object.freeze([...blockers].sort((left, right) =>
    left.code.localeCompare(right.code) || left.detail.localeCompare(right.detail)));
  const executionStarted = packet?.transactionEvidence?.started === true;
  const executionState = !executionStarted
    ? "NOT_STARTED"
    : "UNVERIFIED_OR_UNRECONCILED";
  const pendingFacts = Object.freeze([
    Object.freeze({
      code: "DEVNET_NOT_EXECUTED",
      state: executionStarted
        ? "UNRESOLVED_DIRECT_OBSERVATION_REQUIRED"
        : "TRUE_EXPECTED_PENDING",
    }),
    Object.freeze({
      code: "PUBLIC_DEVNET_EXECUTION_PROVENANCE_UNAVAILABLE",
      state: "TRUE_PENDING_OR_UNACCEPTED",
    }),
  ]);
  const withoutDigest = {
    schema: POST_DEVNET_ASSESSMENT_SCHEMA,
    status: HOLD_STATUS,
    sourceCheckpoint: packet?.sourceCheckpoint ?? null,
    preVerdictSha256: packet?.preVerdict?.verdictSha256 ?? null,
    grantSha256: packet?.userAuthorization?.grantSha256 ?? null,
    executionState,
    factStates: pendingFacts,
    preservedInvariant: MAINNET_HOLD_INVARIANT,
    blockers: orderedBlockers,
    independentPostVerificationRequired: true,
    devnetRehearsalEvidenceAccepted: false,
    gate8Go: false,
    requestAuthorizationPermitted: false,
    publicDevnetAuthorizationMayBeRequested: false,
    executionAuthorized: false,
    publicDevnetAuthorized: false,
    releaseAuthorized: false,
    mainnetExecutionAuthorized: false,
    mainnetStatus: "HOLD",
    safety: Object.freeze({
      ...splitGateSafety(),
      injectedTestSeam,
      injectedTestEvidenceAccepted: false,
    }),
  };
  return Object.freeze({
    ...withoutDigest,
    assessmentSha256: canonicalSplitGateSha256(
      "IAT_B3_POST_DEVNET_ASSESSMENT_V1",
      withoutDigest,
    ),
  });
}

function validateArtifactDescriptor(value) {
  return exactKeys(value, ARTIFACT_DESCRIPTOR_KEYS)
    && typeof value.path === "string"
    && isAbsolute(value.path)
    && validateDigest(value.sha256)
    && Number.isSafeInteger(value.byteLength)
    && value.byteLength > 0
    && value.byteLength <= MAX_BOUND_ARTIFACT_BYTES;
}

function readBoundArtifact(descriptor) {
  if (!validateArtifactDescriptor(descriptor)) return null;
  let descriptorHandle = null;
  try {
    const descriptorStat = lstatSync(descriptor.path);
    if (!descriptorStat.isFile() || descriptorStat.isSymbolicLink()
      || descriptorStat.nlink !== 1) return null;
    const canonicalPath = realpathSync.native(descriptor.path);
    if (canonicalPath !== descriptor.path) return null;
    descriptorHandle = openSync(canonicalPath, "r");
    const before = fstatSync(descriptorHandle);
    if (!before.isFile() || before.nlink !== 1
      || before.size !== descriptor.byteLength) return null;
    const bytes = readFileSync(descriptorHandle);
    const after = fstatSync(descriptorHandle);
    const afterPath = lstatSync(descriptor.path);
    if (before.dev !== after.dev || before.ino !== after.ino
      || before.size !== after.size || before.mtimeMs !== after.mtimeMs
      || afterPath.dev !== after.dev || afterPath.ino !== after.ino
      || afterPath.size !== after.size || afterPath.mtimeMs !== after.mtimeMs
      || after.nlink !== 1 || afterPath.nlink !== 1
      || realpathSync.native(descriptor.path) !== canonicalPath
      || bytes.length !== descriptor.byteLength
      || createHash("sha256").update(bytes).digest("hex") !== descriptor.sha256) return null;
    return Object.freeze({ path: canonicalPath, bytes });
  } catch {
    return null;
  } finally {
    if (descriptorHandle !== null) closeSync(descriptorHandle);
  }
}

function sameCanonicalJson(left, right) {
  try {
    return isDeepStrictEqual(left, right);
  } catch {
    return false;
  }
}

export function acceptIndependentPostDevnetAssessment(candidate, {
  independentVerification = null,
  candidateAssessmentSha256 = null,
} = {}) {
  const blockers = [];
  const exactVerificationShape = exactKeys(independentVerification, [
    "postInputArtifact",
    "candidateArtifact",
    "assessor",
    "verifier",
    "evaluationUnixSeconds",
    "verifiedAtUnixSeconds",
  ]);
  add(blockers, exactVerificationShape, "POST_INDEPENDENT_INPUT_SHAPE_INVALID", "exact post input, candidate, assessor, verifier, and time bindings are required");
  const inputArtifact = readBoundArtifact(independentVerification?.postInputArtifact);
  const candidateArtifact = readBoundArtifact(independentVerification?.candidateArtifact);
  const assessorArtifact = readBoundArtifact(independentVerification?.assessor && {
    path: independentVerification.assessor.sourcePath,
    sha256: independentVerification.assessor.sourceSha256,
    byteLength: independentVerification.assessor.byteLength,
  });
  const verifierArtifact = readBoundArtifact(independentVerification?.verifier && {
    path: independentVerification.verifier.sourcePath,
    sha256: independentVerification.verifier.sourceSha256,
    byteLength: independentVerification.verifier.byteLength,
  });
  add(blockers, inputArtifact !== null, "POST_INPUT_ARTIFACT_BINDING_INVALID", "the exact strict post-input path and physical bytes are required");
  add(blockers, candidateArtifact !== null, "POST_CANDIDATE_ARTIFACT_BINDING_INVALID", "the exact post-candidate path and physical bytes are required");
  add(blockers, exactKeys(independentVerification?.assessor, ASSESSOR_KEYS)
    && independentVerification.assessor.sourcePath === CURRENT_ASSESSOR_PATH
    && independentVerification.assessor.sourceSha256 === CURRENT_ASSESSOR_SHA256
    && independentVerification.assessor.executedSha256 === CURRENT_ASSESSOR_SHA256
    && independentVerification.assessor.byteLength === CURRENT_ASSESSOR_BYTES.length
    && assessorArtifact !== null,
  "POST_ASSESSOR_BINDING_INVALID", "the executed post-assessor must be this exact source path and physical bytes");
  add(blockers, exactKeys(independentVerification?.verifier, INDEPENDENT_VERIFIER_KEYS)
    && independentVerification.verifier.lane === "independent_launch_redteam"
    && independentVerification.verifier.type === "SOURCE_BOUND_AUTOMATED_DIRECT_EVIDENCE"
    && independentVerification.verifier.directEvidenceOnly === true
    && independentVerification.verifier.humanReviewerRequired === false
    && independentVerification.verifier.sourcePath === CURRENT_ASSESSOR_PATH
    && independentVerification.verifier.sourceSha256 === CURRENT_ASSESSOR_SHA256
    && independentVerification.verifier.executedSha256 === CURRENT_ASSESSOR_SHA256
    && independentVerification.verifier.byteLength === CURRENT_ASSESSOR_BYTES.length
    && verifierArtifact !== null,
  "POST_VERIFIER_BINDING_INVALID", "the independent verifier source path and physical bytes must bind exactly");
  let evaluationUnixSeconds = null;
  let timeValid = false;
  try {
    evaluationUnixSeconds = BigInt(independentVerification?.evaluationUnixSeconds);
    timeValid = evaluationUnixSeconds > 0n
      && BigInt(independentVerification?.verifiedAtUnixSeconds) >= evaluationUnixSeconds;
  } catch {
    timeValid = false;
  }
  add(blockers, timeValid, "POST_INDEPENDENT_TIME_INVALID", "exact positive assessment and verification times are required");
  let observedInput = null;
  let observedCandidate = null;
  let recomputedCandidate = null;
  try {
    if (inputArtifact && evaluationUnixSeconds !== null) {
      observedInput = parseStrictSplitGateJson(
        inputArtifact.bytes.toString("utf8"),
        independentVerification.postInputArtifact.path,
      );
      recomputedCandidate = assessPostDevnetEvidence(observedInput, { evaluationUnixSeconds });
    }
    if (candidateArtifact) {
      observedCandidate = parseStrictSplitGateJson(
        candidateArtifact.bytes.toString("utf8"),
        independentVerification.candidateArtifact.path,
      );
    }
  } catch {
    observedInput = null;
    observedCandidate = null;
    recomputedCandidate = null;
  }
  add(blockers, validatePostDevnetEvidenceAssessment(candidate)
    && candidate?.assessmentSha256 === candidateAssessmentSha256
    && observedInput !== null && observedCandidate !== null && recomputedCandidate !== null
    && sameCanonicalJson(observedCandidate, candidate)
    && sameCanonicalJson(recomputedCandidate, candidate),
  "POST_CANDIDATE_REEXECUTION_MISMATCH", "candidate bytes must exactly equal a deterministic rerun over the exact strict post-input bytes and assessment time");
  blockers.push(blocker(
    "POST_DIRECT_EVIDENCE_OBSERVER_NOT_IMPLEMENTED",
    "byte-backed deterministic re-execution cannot turn self-authored grants, hashes, signatures, RPC-shaped JSON, or device booleans into direct evidence",
  ));
  const orderedBlockers = Object.freeze([...blockers].sort((left, right) =>
    left.code.localeCompare(right.code) || left.detail.localeCompare(right.detail)));
  const withoutDigest = {
    schema: POST_DEVNET_INDEPENDENT_VERDICT_SCHEMA,
    status: HOLD_STATUS,
    candidateAssessmentSha256,
    independentVerificationAccepted: false,
    independentVerification: independentVerification ?? null,
    devnetRehearsalEvidenceAccepted: false,
    factStates: candidate?.factStates ?? [],
    preservedInvariant: MAINNET_HOLD_INVARIANT,
    blockers: orderedBlockers,
    gate8Go: false,
    requestAuthorizationPermitted: false,
    publicDevnetAuthorizationMayBeRequested: false,
    executionAuthorized: false,
    publicDevnetAuthorized: false,
    releaseAuthorized: false,
    mainnetExecutionAuthorized: false,
    mainnetStatus: "HOLD",
    safety: splitGateSafety(),
  };
  return Object.freeze({
    ...withoutDigest,
    verdictSha256: canonicalSplitGateSha256(
      "IAT_B3_POST_DEVNET_INDEPENDENT_VERDICT_V1",
      withoutDigest,
    ),
  });
}

export function parsePostDevnetArguments(arguments_) {
  if (!Array.isArray(arguments_)) {
    throw new Error("Usage: assess-iat-b3-post-devnet-evidence.mjs --input <absolute-input.json>");
  }
  if (arguments_.length === 0) return null;
  if (arguments_.length !== 2
    || arguments_[0] !== "--input" || typeof arguments_[1] !== "string"
    || arguments_[1].length === 0 || !isAbsolute(arguments_[1])) {
    throw new Error("Usage: assess-iat-b3-post-devnet-evidence.mjs --input <absolute-input.json>");
  }
  return resolve(arguments_[1]);
}

export function runPostDevnetAssessment({ inputPath } = {}) {
  let assessment;
  try {
    const absolutePath = resolve(inputPath);
    const packet = parseStrictSplitGateJson(readFileSync(absolutePath, "utf8"), absolutePath);
    assessment = assessPostDevnetEvidence(packet);
  } catch (error) {
    const withoutDigest = {
      schema: POST_DEVNET_ASSESSMENT_SCHEMA,
      status: HOLD_STATUS,
      blockers: Object.freeze([blocker("ASSESSMENT_ERROR", error.message)]),
      gate8Go: false,
      requestAuthorizationPermitted: false,
      publicDevnetAuthorizationMayBeRequested: false,
      executionAuthorized: false,
      publicDevnetAuthorized: false,
      releaseAuthorized: false,
      mainnetExecutionAuthorized: false,
      mainnetStatus: "HOLD",
      safety: splitGateSafety(),
    };
    assessment = Object.freeze({
      ...withoutDigest,
      assessmentSha256: canonicalSplitGateSha256(
        "IAT_B3_POST_DEVNET_ASSESSMENT_ERROR_V1",
        withoutDigest,
      ),
    });
  }
  process.stdout.write(`${JSON.stringify(assessment, null, 2)}\n`);
  process.exitCode = 2;
  return assessment;
}

export function validatePostDevnetEvidenceAssessment(assessment) {
  if (!exactKeys(assessment, [
    "schema",
    "status",
    "sourceCheckpoint",
    "preVerdictSha256",
    "grantSha256",
    "executionState",
    "factStates",
    "preservedInvariant",
    "blockers",
    "independentPostVerificationRequired",
    "devnetRehearsalEvidenceAccepted",
    "gate8Go",
    "requestAuthorizationPermitted",
    "publicDevnetAuthorizationMayBeRequested",
    "executionAuthorized",
    "publicDevnetAuthorized",
    "releaseAuthorized",
    "mainnetExecutionAuthorized",
    "mainnetStatus",
    "safety",
    "assessmentSha256",
  ]) || assessment.schema !== POST_DEVNET_ASSESSMENT_SCHEMA
    || assessment.status !== HOLD_STATUS
    || !validateSourceCheckpoint(assessment.sourceCheckpoint)
    || !validateDigest(assessment.preVerdictSha256)
    || !validateDigest(assessment.grantSha256)
    || assessment.gate8Go !== false
    || assessment.requestAuthorizationPermitted !== false
    || assessment.publicDevnetAuthorizationMayBeRequested !== false
    || assessment.executionAuthorized !== false
    || assessment.publicDevnetAuthorized !== false
    || assessment.releaseAuthorized !== false
    || assessment.mainnetExecutionAuthorized !== false
    || assessment.mainnetStatus !== "HOLD"
    || assessment.devnetRehearsalEvidenceAccepted !== false
    || assessment.independentPostVerificationRequired !== true
    || !["NOT_STARTED", "UNVERIFIED_OR_UNRECONCILED"].includes(assessment.executionState)
    || !Array.isArray(assessment.factStates)
    || assessment.factStates.length !== 2
    || !assessment.factStates.every((entry) => exactKeys(entry, ["code", "state"])
      && typeof entry.code === "string" && typeof entry.state === "string")
    || assessment.factStates[0]?.code !== "DEVNET_NOT_EXECUTED"
    || assessment.factStates[1]?.code !== "PUBLIC_DEVNET_EXECUTION_PROVENANCE_UNAVAILABLE"
    || (assessment.executionState === "NOT_STARTED"
      && (assessment.factStates[0].state !== "TRUE_EXPECTED_PENDING"
        || assessment.factStates[1].state !== "TRUE_PENDING_OR_UNACCEPTED"))
    || (assessment.executionState === "UNVERIFIED_OR_UNRECONCILED"
      && (assessment.factStates[0].state !== "UNRESOLVED_DIRECT_OBSERVATION_REQUIRED"
        || assessment.factStates[1].state !== "TRUE_PENDING_OR_UNACCEPTED"))
    || !Array.isArray(assessment.blockers)
    || !assessment.blockers.every((entry) => exactKeys(entry, ["code", "detail"])
      && typeof entry.code === "string" && entry.code.length > 0
      && typeof entry.detail === "string" && entry.detail.length > 0)
    || new Set(assessment.blockers.map(({ code }) => code)).size !== assessment.blockers.length
    || assessment.blockers.some((entry, index, entries) => index > 0
      && (entries[index - 1].code.localeCompare(entry.code)
        || entries[index - 1].detail.localeCompare(entry.detail)) > 0)
    || !assessment.blockers.some(({ code }) => code === "POST_DIRECT_EVIDENCE_OBSERVER_NOT_IMPLEMENTED")
    || assessment.preservedInvariant?.code !== "MAINNET_HOLD"
    || assessment.preservedInvariant?.state !== "TRUE_INVARIANT"
    || assessment.preservedInvariant?.clearableByThisContract !== false
    || !sameCanonicalJson(assessment.safety, {
      ...splitGateSafety(),
      injectedTestSeam: false,
      injectedTestEvidenceAccepted: false,
    })) return false;
  const core = Object.fromEntries(Object.entries(assessment)
    .filter(([key]) => key !== "assessmentSha256"));
  return assessment.assessmentSha256 === canonicalSplitGateSha256(
    "IAT_B3_POST_DEVNET_ASSESSMENT_V1",
    core,
  );
}

export function validateIndependentPostDevnetVerdict(verdict) {
  if (!exactKeys(verdict, [
    "schema",
    "status",
    "candidateAssessmentSha256",
    "independentVerificationAccepted",
    "independentVerification",
    "devnetRehearsalEvidenceAccepted",
    "factStates",
    "preservedInvariant",
    "blockers",
    "gate8Go",
    "requestAuthorizationPermitted",
    "publicDevnetAuthorizationMayBeRequested",
    "executionAuthorized",
    "publicDevnetAuthorized",
    "releaseAuthorized",
    "mainnetExecutionAuthorized",
    "mainnetStatus",
    "safety",
    "verdictSha256",
  ]) || verdict.schema !== POST_DEVNET_INDEPENDENT_VERDICT_SCHEMA
    || verdict.status !== HOLD_STATUS
    || !validateDigest(verdict.candidateAssessmentSha256)
    || !exactKeys(verdict.independentVerification, [
      "postInputArtifact",
      "candidateArtifact",
      "assessor",
      "verifier",
      "evaluationUnixSeconds",
      "verifiedAtUnixSeconds",
    ])
    || !validateArtifactDescriptor(verdict.independentVerification.postInputArtifact)
    || !validateArtifactDescriptor(verdict.independentVerification.candidateArtifact)
    || !exactKeys(verdict.independentVerification.assessor, ASSESSOR_KEYS)
    || verdict.independentVerification.assessor.sourcePath !== CURRENT_ASSESSOR_PATH
    || verdict.independentVerification.assessor.sourceSha256 !== CURRENT_ASSESSOR_SHA256
    || verdict.independentVerification.assessor.executedSha256 !== CURRENT_ASSESSOR_SHA256
    || verdict.independentVerification.assessor.byteLength !== CURRENT_ASSESSOR_BYTES.length
    || !exactKeys(verdict.independentVerification.verifier, INDEPENDENT_VERIFIER_KEYS)
    || verdict.independentVerification.verifier.lane !== "independent_launch_redteam"
    || verdict.independentVerification.verifier.type !== "SOURCE_BOUND_AUTOMATED_DIRECT_EVIDENCE"
    || verdict.independentVerification.verifier.directEvidenceOnly !== true
    || verdict.independentVerification.verifier.humanReviewerRequired !== false
    || verdict.independentVerification.verifier.sourcePath !== CURRENT_ASSESSOR_PATH
    || verdict.independentVerification.verifier.sourceSha256 !== CURRENT_ASSESSOR_SHA256
    || verdict.independentVerification.verifier.executedSha256 !== CURRENT_ASSESSOR_SHA256
    || verdict.independentVerification.verifier.byteLength !== CURRENT_ASSESSOR_BYTES.length
    || typeof verdict.independentVerification.evaluationUnixSeconds !== "string"
    || !/^[1-9][0-9]*$/u.test(verdict.independentVerification.evaluationUnixSeconds)
    || typeof verdict.independentVerification.verifiedAtUnixSeconds !== "string"
    || !/^[1-9][0-9]*$/u.test(verdict.independentVerification.verifiedAtUnixSeconds)
    || BigInt(verdict.independentVerification.verifiedAtUnixSeconds)
      < BigInt(verdict.independentVerification.evaluationUnixSeconds)
    || verdict.gate8Go !== false
    || verdict.requestAuthorizationPermitted !== false
    || verdict.publicDevnetAuthorizationMayBeRequested !== false
    || verdict.executionAuthorized !== false
    || verdict.publicDevnetAuthorized !== false
    || verdict.releaseAuthorized !== false
    || verdict.mainnetExecutionAuthorized !== false
    || verdict.mainnetStatus !== "HOLD"
    || verdict.independentVerificationAccepted !== false
    || verdict.devnetRehearsalEvidenceAccepted !== false
    || !Array.isArray(verdict.factStates)
    || verdict.factStates.length !== 2
    || !verdict.factStates.every((entry) => exactKeys(entry, ["code", "state"])
      && typeof entry.code === "string" && typeof entry.state === "string")
    || verdict.factStates[0].code !== "DEVNET_NOT_EXECUTED"
    || verdict.factStates[1].code !== "PUBLIC_DEVNET_EXECUTION_PROVENANCE_UNAVAILABLE"
    || !["TRUE_EXPECTED_PENDING", "UNRESOLVED_DIRECT_OBSERVATION_REQUIRED"]
      .includes(verdict.factStates[0].state)
    || verdict.factStates[1].state !== "TRUE_PENDING_OR_UNACCEPTED"
    || !Array.isArray(verdict.blockers)
    || !verdict.blockers.every((entry) => exactKeys(entry, ["code", "detail"])
      && typeof entry.code === "string" && entry.code.length > 0
      && typeof entry.detail === "string" && entry.detail.length > 0)
    || new Set(verdict.blockers.map(({ code }) => code)).size !== verdict.blockers.length
    || verdict.blockers.some((entry, index, entries) => index > 0
      && (entries[index - 1].code.localeCompare(entry.code)
        || entries[index - 1].detail.localeCompare(entry.detail)) > 0)
    || !verdict.blockers.some(({ code }) => code === "POST_DIRECT_EVIDENCE_OBSERVER_NOT_IMPLEMENTED")
    || verdict.preservedInvariant?.code !== "MAINNET_HOLD"
    || verdict.preservedInvariant?.state !== "TRUE_INVARIANT"
    || verdict.preservedInvariant?.clearableByThisContract !== false
    || !sameCanonicalJson(verdict.safety, splitGateSafety())) return false;
  const core = Object.fromEntries(Object.entries(verdict).filter(([key]) => key !== "verdictSha256"));
  return verdict.verdictSha256 === canonicalSplitGateSha256(
    "IAT_B3_POST_DEVNET_INDEPENDENT_VERDICT_V1",
    core,
  );
}

if (process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  let inputPath;
  try {
    inputPath = parsePostDevnetArguments(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 2;
  }
  runPostDevnetAssessment({ inputPath });
}
