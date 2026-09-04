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

import {
  HOLD_STATUS,
  MAINNET_HOLD_CODE,
  MAINNET_HOLD_INVARIANT,
  POST_DEVNET_PENDING_FACT_CODES,
  PRE_DEVNET_ASSESSMENT_SCHEMA,
  PRE_DEVNET_EVIDENCE_BLOCKERS,
  PRE_DEVNET_INDEPENDENT_BLOCKER,
  PRE_DEVNET_INDEPENDENT_VERDICT_SCHEMA,
  PRE_DEVNET_INPUT_SCHEMA,
  PRE_DEVNET_PENDING_FACTS,
  PUBLIC_DEVNET_GENESIS_HASH,
  PUBLIC_DEVNET_RPC_URL,
  canonicalSplitGateSha256,
  exactKeys,
  parseStrictSplitGateJson,
  splitGateSafety,
  validateClearedEvidence,
  validateContinuousObservation,
  validateDigest,
  validateExactOrderedCodes,
  validateFailurePolicy,
  validatePublicKey,
  validateSourceCheckpoint,
} from "./lib/iat-b3-devnet-gate-split-contract.mjs";

const PRE_INPUT_KEYS = Object.freeze([
  "schema",
  "sourceCheckpoint",
  "canonicalBindings",
  "productionToolchain",
  "productionIdentities",
  "productionByteEvidence",
  "localRehearsalEvidence",
  "continuousObservationEvidence",
  "ownerPolicyEvidence",
  "fullSupplyTransitAcceptance",
  "publicDevnetExecutionIntent",
  "fundingIntent",
  "failurePolicy",
  "clearedEvidence",
]);
const BINDING_KEYS = Object.freeze([
  "canonicalReadinessAssessmentSha256",
  "productionPlanSha256",
  "operationMapsSha256",
  "ceremonyStagesSha256",
  "dailyLawBoundarySha256",
  "rollbackMatrixSha256",
]);
const TOOLCHAIN_KEYS = Object.freeze([
  "linuxAmd64",
  "dockerOnly",
  "offline",
  "sameContainer",
  "pinnedToolchainSha256",
  "executedRunnerSha256",
  "committedRunnerSha256",
]);
const IDENTITY_KEYS = Object.freeze([
  "lawProgramId",
  "economyProgramId",
  "canonicalMint",
  "compiledLawDomainGenesisHash",
  "identityBindingSha256",
]);
const PRODUCTION_BYTE_KEYS = Object.freeze([
  "lawArtifactSha256",
  "lawReceiptSha256",
  "economyArtifactSha256",
  "economyReceiptSha256",
  "distinctArtifactsAndReceipts",
  "sameContainerOfflineProvenance",
  "bindingSha256",
]);
const LOCAL_REHEARSAL_KEYS = Object.freeze([
  "preflightSha256",
  "executionPlanSha256",
  "executionReceiptSha256",
  "officialExecutionEvidenceSha256",
  "loopbackOnly",
  "all15Observed",
  "opcode9ConditionalCasesObserved",
  "fiveRollbackAndRetryCasesObserved",
  "negativeValidatorDomainDailyLawObserved",
  "positiveCompiledDomainDailyLawObserved",
  "sourceBoundReceiptComplete",
  "bindingSha256",
]);
const OWNER_POLICY_KEYS = Object.freeze([
  "stages2Through6Complete",
  "entropyLagSlots",
  "entropyRiskAcceptance",
  "finalEntropyLagFrozen",
  "bindingSha256",
]);
const TRANSIT_KEYS = Object.freeze([
  "accepted",
  "policy",
  "soleHumanGate",
  "publicKeysOnly",
  "acceptanceSha256",
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
const FUNDING_KEYS = Object.freeze([
  "payerPublicKey",
  "maximumLamportSpend",
  "sourcePolicySha256",
  "approved",
  "fundingIntentSha256",
]);
const VERDICT_INPUT_KEYS = Object.freeze([
  "schema",
  "candidateAssessment",
  "candidateAssessmentSha256",
  "preInputArtifact",
  "candidateArtifact",
  "assessor",
  "verifier",
  "verifiedAtUnixSeconds",
]);
const ARTIFACT_DESCRIPTOR_KEYS = Object.freeze(["path", "sha256", "byteLength"]);
const VERIFIER_KEYS = Object.freeze([
  "lane",
  "type",
  "directEvidenceOnly",
  "humanReviewerRequired",
  "sourcePath",
  "sourceSha256",
  "executedSha256",
  "byteLength",
]);
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

function allDigests(value, keys) {
  return exactKeys(value, keys) && keys.every((key) => validateDigest(value[key]));
}

function recomputeBinding(domain, value, digestKey) {
  if (value === null || typeof value !== "object" || Array.isArray(value)
    || !validateDigest(value[digestKey])) return false;
  const core = Object.fromEntries(Object.entries(value).filter(([key]) => key !== digestKey));
  return value[digestKey] === canonicalSplitGateSha256(domain, core);
}

function validateCanonicalBindings(value) {
  return allDigests(value, BINDING_KEYS);
}

function validateToolchain(value) {
  return exactKeys(value, TOOLCHAIN_KEYS)
    && value.linuxAmd64 === true
    && value.dockerOnly === true
    && value.offline === true
    && value.sameContainer === true
    && validateDigest(value.pinnedToolchainSha256)
    && validateDigest(value.executedRunnerSha256)
    && value.executedRunnerSha256 === value.committedRunnerSha256;
}

function validateProductionIdentities(value) {
  return exactKeys(value, IDENTITY_KEYS)
    && validatePublicKey(value.lawProgramId)
    && validatePublicKey(value.economyProgramId)
    && validatePublicKey(value.canonicalMint)
    && new Set([value.lawProgramId, value.economyProgramId, value.canonicalMint]).size === 3
    && validatePublicKey(value.compiledLawDomainGenesisHash)
    && recomputeBinding(
      "IAT_B3_PRE_DEVNET_PRODUCTION_IDENTITIES_V1",
      value,
      "identityBindingSha256",
    );
}

function validateProductionBytes(value) {
  return exactKeys(value, PRODUCTION_BYTE_KEYS)
    && validateDigest(value.lawArtifactSha256)
    && validateDigest(value.lawReceiptSha256)
    && validateDigest(value.economyArtifactSha256)
    && validateDigest(value.economyReceiptSha256)
    && value.lawArtifactSha256 !== value.economyArtifactSha256
    && value.lawReceiptSha256 !== value.economyReceiptSha256
    && value.distinctArtifactsAndReceipts === true
    && value.sameContainerOfflineProvenance === true
    && recomputeBinding(
      "IAT_B3_PRE_DEVNET_PRODUCTION_BYTES_V1",
      value,
      "bindingSha256",
    );
}

function validateLocalRehearsal(value) {
  return exactKeys(value, LOCAL_REHEARSAL_KEYS)
    && [
      "preflightSha256",
      "executionPlanSha256",
      "executionReceiptSha256",
      "officialExecutionEvidenceSha256",
      "bindingSha256",
    ].every((key) => validateDigest(value[key]))
    && [
      "loopbackOnly",
      "all15Observed",
      "opcode9ConditionalCasesObserved",
      "fiveRollbackAndRetryCasesObserved",
      "negativeValidatorDomainDailyLawObserved",
      "positiveCompiledDomainDailyLawObserved",
      "sourceBoundReceiptComplete",
    ].every((key) => value[key] === true)
    && recomputeBinding(
      "IAT_B3_PRE_DEVNET_LOCAL_REHEARSAL_V1",
      value,
      "bindingSha256",
    );
}

function validateOwnerPolicy(value) {
  return exactKeys(value, OWNER_POLICY_KEYS)
    && value.stages2Through6Complete === true
    && value.entropyLagSlots === 150
    && value.entropyRiskAcceptance
      === "ACCEPT_LAGGED_SLOT_HASH_WITH_FINALIZER_TIMING_INFLUENCE_AND_LIMITED_PROBABILITY_CLAIMS"
    && value.finalEntropyLagFrozen === true
    && recomputeBinding(
      "IAT_B3_PRE_DEVNET_OWNER_POLICY_V1",
      value,
      "bindingSha256",
    );
}

function validateTransit(value) {
  return exactKeys(value, TRANSIT_KEYS)
    && value.accepted === true
    && value.policy === "MODEL_T_FULL_SUPPLY_TRANSIT"
    && value.soleHumanGate
      === "TREZOR_MODEL_T_PHYSICAL_CONFIRMATION_PER_REQUIRED_SIGNATURE"
    && value.publicKeysOnly === true
    && recomputeBinding(
      "IAT_B3_PRE_DEVNET_FULL_SUPPLY_TRANSIT_V1",
      value,
      "acceptanceSha256",
    );
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
    && typeof value.maximumLamportSpend === "string"
    && /^[1-9][0-9]*$/u.test(value.maximumLamportSpend)
    && validateDigest(value.operationMapsSha256)
    && validateDigest(value.ceremonyStagesSha256)
    && validateDigest(value.dailyLawBoundarySha256)
    && validateDigest(value.rollbackMatrixSha256)
    && recomputeBinding(
      "IAT_B3_PUBLIC_DEVNET_EXECUTION_INTENT_V1",
      value,
      "intentSha256",
    );
}

function validateFundingIntent(value, executionIntent) {
  return exactKeys(value, FUNDING_KEYS)
    && validatePublicKey(value.payerPublicKey)
    && value.maximumLamportSpend === executionIntent?.maximumLamportSpend
    && validateDigest(value.sourcePolicySha256)
    && value.approved === true
    && recomputeBinding(
      "IAT_B3_PRE_DEVNET_FUNDING_INTENT_V1",
      value,
      "fundingIntentSha256",
    );
}

function evidenceMap(value) {
  if (!Array.isArray(value) || value.length !== PRE_DEVNET_EVIDENCE_BLOCKERS.length
    || !value.every(validateClearedEvidence)) return null;
  const map = new Map(value.map((entry) => [entry.code, entry]));
  return map.size === PRE_DEVNET_EVIDENCE_BLOCKERS.length
    && PRE_DEVNET_EVIDENCE_BLOCKERS.every((code) => map.has(code)) ? map : null;
}

export function assessPreDevnetAuthorizationCandidate(packet, {
  injectedTestSeam = false,
} = {}) {
  const blockers = [];
  add(blockers, exactKeys(packet, PRE_INPUT_KEYS), "PRE_INPUT_SHAPE_INVALID", "exact pre-Devnet input shape is required");
  add(blockers, packet?.schema === PRE_DEVNET_INPUT_SCHEMA, "PRE_INPUT_SCHEMA_INVALID", "pre-Devnet input schema is not v1");
  add(blockers, validateSourceCheckpoint(packet?.sourceCheckpoint), "PRE_SOURCE_CHECKPOINT_INVALID", "an exact clean committed head/tree is required");
  add(blockers, validateCanonicalBindings(packet?.canonicalBindings), "PRE_CANONICAL_BINDINGS_INVALID", "canonical readiness, operation, ceremony, Daily-Law, and rollback digests are required");
  add(blockers, validateToolchain(packet?.productionToolchain), "PRE_TOOLCHAIN_INVALID", "same-container offline Linux/AMD64 Docker evidence is required");
  add(blockers, validateProductionIdentities(packet?.productionIdentities), "PRE_PRODUCTION_IDENTITIES_INVALID", "three distinct production public identities and compiled Law domain are required");
  add(blockers, validateProductionBytes(packet?.productionByteEvidence), "PRE_PRODUCTION_BYTES_INVALID", "distinct exact Law/Economy artifacts and hermetic receipts are required");
  add(blockers, validateLocalRehearsal(packet?.localRehearsalEvidence), "PRE_LOCAL_REHEARSAL_INVALID", "the exact loopback all-15, opcode9, Daily-Law, and rollback rehearsal must be complete");
  add(blockers, validateContinuousObservation(packet?.continuousObservationEvidence, packet?.sourceCheckpoint), "PRE_24H_OBSERVATION_INVALID", "a source-stable externally scheduled hash-chained 24-hour observation is required");
  add(blockers, validateOwnerPolicy(packet?.ownerPolicyEvidence), "PRE_OWNER_POLICY_INVALID", "owner stages 2-6, final entropy lag, and measured timing-risk acceptance are required");
  add(blockers, validateTransit(packet?.fullSupplyTransitAcceptance), "PRE_FULL_SUPPLY_TRANSIT_INVALID", "the exact Model-T full-supply transit policy acceptance is required");
  add(blockers, validateExecutionIntent(packet?.publicDevnetExecutionIntent), "PRE_DEVNET_INTENT_INVALID", "an exact one-shot disposable Devnet-only intent is required");
  add(blockers, validateFundingIntent(packet?.fundingIntent, packet?.publicDevnetExecutionIntent), "PRE_FUNDING_INTENT_INVALID", "an approved capped disposable funding intent is required");
  add(blockers, validateFailurePolicy(packet?.failurePolicy), "PRE_FAILURE_POLICY_INVALID", "stop/preserve/reconcile and key-retention policy must be exact");
  const evidence = evidenceMap(packet?.clearedEvidence);
  add(blockers, evidence !== null, "PRE_CLEARED_EVIDENCE_SET_INVALID", "the exact 35 direct-evidence rows are required once each");
  if (injectedTestSeam) blockers.push(blocker("TEST_ONLY_CONTEXT_INJECTED", "injected observations can never authorize a request"));
  for (const code of PRE_DEVNET_EVIDENCE_BLOCKERS) {
    blockers.push(blocker(
      code,
      "trusted direct observation is unavailable; a self-attested clearedEvidence row is structural and nonauthorizing",
    ));
  }
  blockers.push(blocker(
    "PRE_DIRECT_EVIDENCE_OBSERVER_NOT_IMPLEMENTED",
    "structural hashes and self-attested booleans are not direct evidence; trusted artifact, scheduler, owner/device, and local-rehearsal observers must be implemented before pre-review eligibility",
  ));

  const orderedBlockers = Object.freeze([...blockers].sort((left, right) =>
    left.code.localeCompare(right.code) || left.detail.localeCompare(right.detail)));
  const status = HOLD_STATUS;
  const inputSha256 = canonicalSplitGateSha256("IAT_B3_PRE_DEVNET_INPUT_V1", packet ?? null);
  const withoutDigest = {
    schema: PRE_DEVNET_ASSESSMENT_SCHEMA,
    status,
    inputSha256,
    sourceCheckpoint: packet?.sourceCheckpoint ?? null,
    executionIntentSha256: packet?.publicDevnetExecutionIntent?.intentSha256 ?? null,
    clearedEvidenceCodes: Object.freeze([]),
    clearedEvidenceCount: 0,
    requiredEvidenceCount: PRE_DEVNET_EVIDENCE_BLOCKERS.length,
    independentVerification: Object.freeze({
      required: true,
      blockerCode: PRE_DEVNET_INDEPENDENT_BLOCKER,
      complete: false,
    }),
    preservedPendingFacts: PRE_DEVNET_PENDING_FACTS,
    preservedInvariant: MAINNET_HOLD_INVARIANT,
    blockers: orderedBlockers,
    gate8Go: false,
    requestAuthorizationPermitted: false,
    publicDevnetAuthorizationMayBeRequested: false,
    executionAuthorized: false,
    publicDevnetAuthorized: false,
    devnetExecuted: false,
    publicDevnetExecutionProvenanceAvailable: false,
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
      "IAT_B3_PRE_DEVNET_ASSESSMENT_V1",
      withoutDigest,
    ),
  });
}

function validateArtifactDescriptor(value) {
  return exactKeys(value, ARTIFACT_DESCRIPTOR_KEYS)
    && typeof value.path === "string"
    && value.path.length > 0
    && validateDigest(value.sha256)
    && Number.isSafeInteger(value.byteLength)
    && value.byteLength > 0
    && value.byteLength <= MAX_BOUND_ARTIFACT_BYTES;
}

function readBoundArtifact(descriptor) {
  if (!validateArtifactDescriptor(descriptor) || !isAbsolute(descriptor.path)) return null;
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

function validateVerifier(value) {
  return exactKeys(value, VERIFIER_KEYS)
    && value.lane === "independent_launch_redteam"
    && value.type === "SOURCE_BOUND_AUTOMATED_DIRECT_EVIDENCE"
    && value.directEvidenceOnly === true
    && value.humanReviewerRequired === false
    && typeof value.sourcePath === "string"
    && isAbsolute(value.sourcePath)
    && value.sourcePath === CURRENT_ASSESSOR_PATH
    && value.sourceSha256 === CURRENT_ASSESSOR_SHA256
    && value.executedSha256 === CURRENT_ASSESSOR_SHA256
    && value.byteLength === CURRENT_ASSESSOR_BYTES.length;
}

export function assessIndependentPreDevnetVerdict(packet, {
} = {}) {
  const blockers = [];
  const assessment = packet?.candidateAssessment;
  add(blockers, exactKeys(packet, VERDICT_INPUT_KEYS), "PRE_VERDICT_INPUT_SHAPE_INVALID", "exact independent-verdict input shape is required");
  add(blockers, packet?.schema === PRE_DEVNET_INDEPENDENT_VERDICT_SCHEMA, "PRE_VERDICT_SCHEMA_INVALID", "independent pre-verdict schema is not v1");
  add(blockers, validatePreDevnetAuthorizationCandidateAssessment(assessment),
    "PRE_CANDIDATE_INVALID", "the complete candidate assessment must pass its strict validator");
  add(blockers, validateExactOrderedCodes(
    assessment?.preservedPendingFacts?.map(({ code }) => code),
    POST_DEVNET_PENDING_FACT_CODES,
  ) && assessment?.preservedPendingFacts?.every(({ state }) => state === "TRUE_EXPECTED_PENDING")
    && assessment?.preservedInvariant?.code === MAINNET_HOLD_CODE
    && assessment?.preservedInvariant?.state === "TRUE_INVARIANT"
    && assessment?.preservedInvariant?.clearableByThisContract === false,
  "PRE_PENDING_FACTS_OR_MAINNET_INVARIANT_INVALID", "the two post facts and Mainnet HOLD must be preserved");
  add(blockers, assessment?.assessmentSha256 === packet?.candidateAssessmentSha256
    && packet?.candidateAssessmentSha256 === canonicalSplitGateSha256(
      "IAT_B3_PRE_DEVNET_ASSESSMENT_V1",
      Object.fromEntries(Object.entries(assessment ?? {}).filter(([key]) => key !== "assessmentSha256")),
    ),
  "PRE_CANDIDATE_DIGEST_INVALID", "the candidate semantic digest must recompute exactly");
  const inputArtifact = readBoundArtifact(packet?.preInputArtifact);
  const candidateArtifact = readBoundArtifact(packet?.candidateArtifact);
  const assessorArtifact = readBoundArtifact(packet?.assessor && {
    path: packet.assessor.sourcePath,
    sha256: packet.assessor.sourceSha256,
    byteLength: packet.assessor.byteLength,
  });
  const verifierArtifact = readBoundArtifact(packet?.verifier && {
    path: packet.verifier.sourcePath,
    sha256: packet.verifier.sourceSha256,
    byteLength: packet.verifier.byteLength,
  });
  add(blockers, inputArtifact !== null, "PRE_INPUT_ARTIFACT_BINDING_INVALID", "the exact strict pre-input path and physical bytes are required");
  add(blockers, candidateArtifact !== null, "PRE_CANDIDATE_ARTIFACT_BINDING_INVALID", "the exact candidate path and physical bytes are required");
  add(blockers, exactKeys(packet?.assessor, ASSESSOR_KEYS)
    && packet.assessor.sourcePath === CURRENT_ASSESSOR_PATH
    && packet.assessor.sourceSha256 === CURRENT_ASSESSOR_SHA256
    && packet.assessor.executedSha256 === CURRENT_ASSESSOR_SHA256
    && packet.assessor.byteLength === CURRENT_ASSESSOR_BYTES.length
    && assessorArtifact !== null,
  "PRE_ASSESSOR_BINDING_INVALID", "the executed pre-assessor must be this exact source path and physical bytes");
  add(blockers, validateVerifier(packet?.verifier) && verifierArtifact !== null,
  "PRE_VERIFIER_BINDING_INVALID", "the independent verifier source path and physical bytes must bind exactly");
  let observedInput = null;
  let observedCandidate = null;
  let recomputedCandidate = null;
  try {
    if (inputArtifact) {
      observedInput = parseStrictSplitGateJson(
        inputArtifact.bytes.toString("utf8"),
        packet.preInputArtifact.path,
      );
      recomputedCandidate = assessPreDevnetAuthorizationCandidate(observedInput);
    }
    if (candidateArtifact) {
      observedCandidate = parseStrictSplitGateJson(
        candidateArtifact.bytes.toString("utf8"),
        packet.candidateArtifact.path,
      );
    }
  } catch {
    observedInput = null;
    observedCandidate = null;
    recomputedCandidate = null;
  }
  add(blockers, observedInput !== null && observedCandidate !== null
    && recomputedCandidate !== null
    && sameCanonicalJson(observedCandidate, assessment)
    && sameCanonicalJson(recomputedCandidate, assessment),
  "PRE_CANDIDATE_REEXECUTION_MISMATCH", "candidate bytes must exactly equal a deterministic rerun over the exact strict pre-input bytes");
  let verifiedAtValid = false;
  try {
    verifiedAtValid = BigInt(packet?.verifiedAtUnixSeconds) > 0n;
  } catch {
    verifiedAtValid = false;
  }
  add(blockers, verifiedAtValid, "PRE_VERIFIED_AT_INVALID", "a positive verifier observation time is required");
  blockers.push(blocker(
    "PRE_DIRECT_EVIDENCE_OBSERVER_NOT_IMPLEMENTED",
    "byte-backed deterministic re-execution cannot turn self-authored hashes and booleans into direct artifact, scheduler, owner/device, or local-rehearsal evidence",
  ));
  for (const code of PRE_DEVNET_EVIDENCE_BLOCKERS) {
    blockers.push(blocker(
      code,
      "the candidate cannot clear this blocker until the required trusted direct observer is implemented",
    ));
  }

  const orderedBlockers = Object.freeze([...blockers].sort((left, right) =>
    left.code.localeCompare(right.code) || left.detail.localeCompare(right.detail)));
  const withoutDigest = {
    schema: PRE_DEVNET_INDEPENDENT_VERDICT_SCHEMA,
    status: HOLD_STATUS,
    sourceCheckpoint: assessment?.sourceCheckpoint ?? null,
    executionIntentSha256: assessment?.executionIntentSha256 ?? null,
    candidateAssessmentSha256: packet?.candidateAssessmentSha256 ?? null,
    preInputArtifact: packet?.preInputArtifact ?? null,
    candidateArtifact: packet?.candidateArtifact ?? null,
    assessor: packet?.assessor ?? null,
    verifier: packet?.verifier ?? null,
    verifiedAtUnixSeconds: packet?.verifiedAtUnixSeconds ?? null,
    clearedEvidenceCount: 0,
    preservedPendingFacts: PRE_DEVNET_PENDING_FACTS,
    preservedInvariant: MAINNET_HOLD_INVARIANT,
    blockers: orderedBlockers,
    gate8Go: false,
    requestAuthorizationPermitted: false,
    publicDevnetAuthorizationMayBeRequested: false,
    executionAuthorized: false,
    publicDevnetAuthorized: false,
    devnetExecuted: false,
    publicDevnetExecutionProvenanceAvailable: false,
    releaseAuthorized: false,
    mainnetExecutionAuthorized: false,
    mainnetStatus: "HOLD",
    safety: splitGateSafety(),
  };
  return Object.freeze({
    ...withoutDigest,
    verdictSha256: canonicalSplitGateSha256(
      "IAT_B3_PRE_DEVNET_INDEPENDENT_VERDICT_V1",
      withoutDigest,
    ),
  });
}

export function parsePreDevnetArguments(arguments_) {
  if (!Array.isArray(arguments_)) {
    throw new Error("Usage: assess-iat-b3-pre-devnet-authorization.mjs --input <absolute-input.json>");
  }
  if (arguments_.length === 0) return null;
  if (arguments_.length !== 2
    || arguments_[0] !== "--input" || typeof arguments_[1] !== "string"
    || arguments_[1].length === 0 || !isAbsolute(arguments_[1])) {
    throw new Error("Usage: assess-iat-b3-pre-devnet-authorization.mjs --input <absolute-input.json>");
  }
  return resolve(arguments_[1]);
}

export function runPreDevnetAssessment({ inputPath } = {}) {
  let assessment;
  try {
    const absolutePath = resolve(inputPath);
    const packet = parseStrictSplitGateJson(readFileSync(absolutePath, "utf8"), absolutePath);
    assessment = assessPreDevnetAuthorizationCandidate(packet);
  } catch (error) {
    const withoutDigest = {
      schema: PRE_DEVNET_ASSESSMENT_SCHEMA,
      status: HOLD_STATUS,
      blockers: Object.freeze([blocker("ASSESSMENT_ERROR", error.message)]),
      gate8Go: false,
      requestAuthorizationPermitted: false,
      publicDevnetAuthorizationMayBeRequested: false,
      executionAuthorized: false,
      publicDevnetAuthorized: false,
      devnetExecuted: false,
      publicDevnetExecutionProvenanceAvailable: false,
      releaseAuthorized: false,
      mainnetExecutionAuthorized: false,
      mainnetStatus: "HOLD",
      safety: splitGateSafety(),
    };
    assessment = Object.freeze({
      ...withoutDigest,
      assessmentSha256: canonicalSplitGateSha256(
        "IAT_B3_PRE_DEVNET_ASSESSMENT_ERROR_V1",
        withoutDigest,
      ),
    });
  }
  process.stdout.write(`${JSON.stringify(assessment, null, 2)}\n`);
  process.exitCode = 2;
  return assessment;
}

export function validatePreDevnetAuthorizationCandidateAssessment(assessment) {
  if (!exactKeys(assessment, [
    "schema",
    "status",
    "inputSha256",
    "sourceCheckpoint",
    "executionIntentSha256",
    "clearedEvidenceCodes",
    "clearedEvidenceCount",
    "requiredEvidenceCount",
    "independentVerification",
    "preservedPendingFacts",
    "preservedInvariant",
    "blockers",
    "gate8Go",
    "requestAuthorizationPermitted",
    "publicDevnetAuthorizationMayBeRequested",
    "executionAuthorized",
    "publicDevnetAuthorized",
    "devnetExecuted",
    "publicDevnetExecutionProvenanceAvailable",
    "releaseAuthorized",
    "mainnetExecutionAuthorized",
    "mainnetStatus",
    "safety",
    "assessmentSha256",
  ]) || assessment.schema !== PRE_DEVNET_ASSESSMENT_SCHEMA
    || assessment.status !== HOLD_STATUS
    || !validateDigest(assessment.inputSha256)
    || !validateSourceCheckpoint(assessment.sourceCheckpoint)
    || !validateDigest(assessment.executionIntentSha256)
    || !validateExactOrderedCodes(assessment.clearedEvidenceCodes, [])
    || assessment.clearedEvidenceCount !== 0
    || assessment.requiredEvidenceCount !== PRE_DEVNET_EVIDENCE_BLOCKERS.length
    || !exactKeys(assessment.independentVerification, ["required", "blockerCode", "complete"])
    || assessment.independentVerification.required !== true
    || assessment.independentVerification.blockerCode !== PRE_DEVNET_INDEPENDENT_BLOCKER
    || assessment.independentVerification.complete !== false
    || !sameCanonicalJson(assessment.preservedPendingFacts, PRE_DEVNET_PENDING_FACTS)
    || !Array.isArray(assessment.blockers)
    || assessment.blockers.length < 1
    || !assessment.blockers.every((entry) => exactKeys(entry, ["code", "detail"])
      && typeof entry.code === "string" && entry.code.length > 0
      && typeof entry.detail === "string" && entry.detail.length > 0)
    || new Set(assessment.blockers.map(({ code }) => code)).size !== assessment.blockers.length
    || assessment.blockers.some((entry, index, entries) => index > 0
      && (entries[index - 1].code.localeCompare(entry.code)
        || entries[index - 1].detail.localeCompare(entry.detail)) > 0)
    || !assessment.blockers.some(({ code }) => code === "PRE_DIRECT_EVIDENCE_OBSERVER_NOT_IMPLEMENTED")
    || !PRE_DEVNET_EVIDENCE_BLOCKERS.every((code) =>
      assessment.blockers.some((entry) => entry.code === code))
    || assessment.blockers.some((entry, index, entries) => index > 0
      && (entries[index - 1].code.localeCompare(entry.code)
        || entries[index - 1].detail.localeCompare(entry.detail)) > 0)
    || assessment.gate8Go !== false
    || assessment.requestAuthorizationPermitted !== false
    || assessment.publicDevnetAuthorizationMayBeRequested !== false
    || assessment.executionAuthorized !== false
    || assessment.publicDevnetAuthorized !== false
    || assessment.devnetExecuted !== false
    || assessment.publicDevnetExecutionProvenanceAvailable !== false
    || assessment.releaseAuthorized !== false
    || assessment.mainnetExecutionAuthorized !== false
    || assessment.mainnetStatus !== "HOLD"
    || assessment.preservedInvariant?.code !== MAINNET_HOLD_CODE
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
    "IAT_B3_PRE_DEVNET_ASSESSMENT_V1",
    core,
  );
}

export function validateIndependentPreDevnetVerdict(verdict) {
  if (!exactKeys(verdict, [
    "schema",
    "status",
    "sourceCheckpoint",
    "executionIntentSha256",
    "candidateAssessmentSha256",
    "preInputArtifact",
    "candidateArtifact",
    "assessor",
    "verifier",
    "verifiedAtUnixSeconds",
    "clearedEvidenceCount",
    "preservedPendingFacts",
    "preservedInvariant",
    "blockers",
    "gate8Go",
    "requestAuthorizationPermitted",
    "publicDevnetAuthorizationMayBeRequested",
    "executionAuthorized",
    "publicDevnetAuthorized",
    "devnetExecuted",
    "publicDevnetExecutionProvenanceAvailable",
    "releaseAuthorized",
    "mainnetExecutionAuthorized",
    "mainnetStatus",
    "safety",
    "verdictSha256",
  ]) || verdict.schema !== PRE_DEVNET_INDEPENDENT_VERDICT_SCHEMA
    || verdict.status !== HOLD_STATUS
    || !validateSourceCheckpoint(verdict.sourceCheckpoint)
    || !validateDigest(verdict.executionIntentSha256)
    || !validateDigest(verdict.candidateAssessmentSha256)
    || !validateArtifactDescriptor(verdict.preInputArtifact)
    || !validateArtifactDescriptor(verdict.candidateArtifact)
    || !exactKeys(verdict.assessor, ASSESSOR_KEYS)
    || verdict.assessor.sourcePath !== CURRENT_ASSESSOR_PATH
    || verdict.assessor.sourceSha256 !== CURRENT_ASSESSOR_SHA256
    || verdict.assessor.executedSha256 !== CURRENT_ASSESSOR_SHA256
    || verdict.assessor.byteLength !== CURRENT_ASSESSOR_BYTES.length
    || !validateVerifier(verdict.verifier)
    || typeof verdict.verifiedAtUnixSeconds !== "string"
    || !/^[1-9][0-9]*$/u.test(verdict.verifiedAtUnixSeconds)
    || verdict.gate8Go !== false
    || verdict.requestAuthorizationPermitted !== false
    || verdict.publicDevnetAuthorizationMayBeRequested !== false
    || verdict.executionAuthorized !== false
    || verdict.publicDevnetAuthorized !== false
    || verdict.devnetExecuted !== false
    || verdict.publicDevnetExecutionProvenanceAvailable !== false
    || verdict.releaseAuthorized !== false
    || verdict.mainnetExecutionAuthorized !== false
    || verdict.mainnetStatus !== "HOLD"
    || verdict.clearedEvidenceCount !== 0
    || !sameCanonicalJson(verdict.preservedPendingFacts, PRE_DEVNET_PENDING_FACTS)
    || verdict.preservedInvariant?.code !== MAINNET_HOLD_CODE
    || verdict.preservedInvariant?.state !== "TRUE_INVARIANT"
    || verdict.preservedInvariant?.clearableByThisContract !== false
    || !Array.isArray(verdict.blockers)
    || !verdict.blockers.every((entry) => exactKeys(entry, ["code", "detail"])
      && typeof entry.code === "string" && entry.code.length > 0
      && typeof entry.detail === "string" && entry.detail.length > 0)
    || new Set(verdict.blockers.map(({ code }) => code)).size !== verdict.blockers.length
    || verdict.blockers.some((entry, index, entries) => index > 0
      && (entries[index - 1].code.localeCompare(entry.code)
        || entries[index - 1].detail.localeCompare(entry.detail)) > 0)
    || !verdict.blockers.some(({ code }) => code === "PRE_DIRECT_EVIDENCE_OBSERVER_NOT_IMPLEMENTED")
    || !PRE_DEVNET_EVIDENCE_BLOCKERS.every((code) =>
      verdict.blockers.some((entry) => entry.code === code))
    || !sameCanonicalJson(verdict.safety, splitGateSafety())) return false;
  const core = Object.fromEntries(Object.entries(verdict).filter(([key]) => key !== "verdictSha256"));
  return verdict.verdictSha256 === canonicalSplitGateSha256(
    "IAT_B3_PRE_DEVNET_INDEPENDENT_VERDICT_V1",
    core,
  );
}

if (process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  let inputPath;
  try {
    inputPath = parsePreDevnetArguments(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 2;
  }
  runPreDevnetAssessment({ inputPath });
}
