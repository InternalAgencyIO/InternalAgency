import { createHash } from "node:crypto";

import {
  canonicalizeRfc8785,
  sha256CanonicalJson,
} from "../iat-v2-canonical-json.mjs";
import { parseB3OwnerPolicyFreezeJson } from "../validate-iat-b3-owner-policy-freeze.mjs";

export const PRE_DEVNET_INPUT_SCHEMA =
  "iat-b3-pre-devnet-authorization-candidate-input/v1";
export const PRE_DEVNET_ASSESSMENT_SCHEMA =
  "iat-b3-pre-devnet-authorization-candidate-assessment/v1";
export const PRE_DEVNET_INDEPENDENT_VERDICT_SCHEMA =
  "iat-b3-pre-devnet-independent-verdict/v1";
export const PUBLIC_DEVNET_USER_GRANT_SCHEMA =
  "iat-b3-public-devnet-user-authorization/v1";
export const POST_DEVNET_INPUT_SCHEMA =
  "iat-b3-post-devnet-evidence-input/v1";
export const POST_DEVNET_ASSESSMENT_SCHEMA =
  "iat-b3-post-devnet-evidence-assessment/v1";
export const POST_DEVNET_INDEPENDENT_VERDICT_SCHEMA =
  "iat-b3-post-devnet-independent-verdict/v1";

export const PRE_DEVNET_ELIGIBLE_STATUS =
  "ELIGIBLE_FOR_INDEPENDENT_PRE_REVIEW";
export const PRE_DEVNET_REQUEST_ELIGIBLE_STATUS =
  "ELIGIBLE_TO_REQUEST_USER_AUTHORIZATION";
export const POST_DEVNET_ELIGIBLE_STATUS =
  "ELIGIBLE_FOR_INDEPENDENT_POST_REVIEW";
export const POST_DEVNET_ACCEPTED_STATUS =
  "DEVNET_REHEARSAL_EVIDENCE_ACCEPTED";
export const HOLD_STATUS = "HOLD";
export const MAINNET_HOLD_STATUS = "HOLD";

export const PRE_DEVNET_REQUIRED_SECONDS = 86_400;
export const PRE_DEVNET_TARGET_SAMPLE_CADENCE_SECONDS = 1_200;
export const PRE_DEVNET_MAX_SAMPLE_GAP_SECONDS = 1_500;
export const PRE_DEVNET_MIN_SAMPLE_COUNT = 73;
export const PUBLIC_DEVNET_MAX_GRANT_LIFETIME_SECONDS = 3_600;
export const PUBLIC_DEVNET_MAX_FUTURE_SKEW_SECONDS = 300;
export const PUBLIC_DEVNET_RPC_URL = "https://api.devnet.solana.com";
export const PUBLIC_DEVNET_GENESIS_HASH =
  "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
export const PUBLIC_DEVNET_GRANT_CONFIRMATION =
  "CONFIRMED_ONE_SHOT_ALL_FEATURE_B3_PUBLIC_DEVNET_REHEARSAL";
export const PUBLIC_DEVNET_GRANT_SCOPE =
  "ONE_DISPOSABLE_ALL_FEATURE_B3_PUBLIC_DEVNET_REHEARSAL_ONLY";
export const PUBLIC_DEVNET_SOLE_HUMAN_GATE =
  "TREZOR_MODEL_T_PHYSICAL_CONFIRMATION_PER_REQUIRED_SIGNATURE";
export const PUBLIC_DEVNET_REQUIRED_OPCODE9_CASES = Object.freeze([
  "OPCODE_9_TREASURY",
  "OPCODE_9_ECOSYSTEM",
  "OPCODE_9_LIQUIDITY",
  "OPCODE_9_CORE_TEAM_HOLD",
  "OPCODE_9_INVALID_LANE",
]);

export const REQUIRED_FAILURE_POLICY = Object.freeze({
  automaticRetry: false,
  resubmitBeforeReconciliation: false,
  ambiguousSendAction: "STOP_PRESERVE_AND_RECONCILE",
  preserveMessageBytes: true,
  preserveSignatures: true,
  preserveLogs: true,
  authorityRevocationOnlyAfterExactByteVerification: true,
  publicWritesRollbackable: false,
  automaticCompensation: false,
  preRevocationRecovery: "PREAPPROVED_UPGRADE_OR_ABANDON",
  postRevocationRecovery: "NO_CODE_ROLLBACK_ABANDON_AND_REDEPLOY",
  partialWriteDisposition: "PARTIAL_HOLD",
  retainDisposableKeysUntilReconciled: true,
  cleanupOnlyAfterEvidence: true,
});

export const CANONICAL_READINESS_BLOCKERS = Object.freeze([
  "READINESS_INPUT_VALID",
  "EXACT_CLEAN_COMMITTED_SOURCE",
  "EXECUTED_RUNNER_MATCHES_HEAD",
  "LINUX_AMD64_LOCAL_VALIDATOR_HOST",
  "PINNED_LOCAL_VALIDATOR_TOOLCHAIN",
  "CANONICAL_PRODUCTION_IDENTITIES_READY",
  "EXACT_REHEARSAL_IDENTITY_INPUT",
  "EXACT_LAW_ARTIFACT_DUAL_BUILD_BOUND",
  "EXACT_ECONOMY_ARTIFACT_DUAL_BUILD_BOUND",
  "LAW_ECONOMY_ARTIFACTS_AND_RECEIPTS_DISTINCT",
]);

export const PRE_DEVNET_PLAN_BLOCKERS = Object.freeze([
  "CONCRETE_LAW_PROGRAM_ID_MISSING",
  "CONCRETE_ECONOMY_PROGRAM_ID_MISSING",
  "CONCRETE_CANONICAL_MINT_MISSING",
  "COMPILED_LAW_DOMAIN_GENESIS_HASH_MISSING",
  "FINAL_LAW_ELF_AND_DOCKER_RECEIPT_MISSING",
  "FINAL_ECONOMY_ELF_AND_DOCKER_RECEIPT_MISSING",
  "PRESTARTED_LOOPBACK_VALIDATOR_MISSING",
  "VALIDATOR_GENESIS_HASH_MISSING",
  "CONCRETE_ACCOUNT_DUMPS_AND_DECODED_INVARIANTS_MISSING",
  "EPHEMERAL_SIGNER_PUBLIC_KEYS_AND_PATHS_MISSING",
  "MUTABLE_FIXTURE_ISOLATION_AND_TERMINAL_HASH_PLAN_MISSING",
  "ALL_15_ORDINAL_CASES_NOT_EXECUTED",
  "OPCODE9_FULL_CONDITIONAL_CASES_NOT_EXECUTED",
  "FIVE_ATOMIC_ROLLBACK_AND_STANDALONE_RETRY_PROBES_NOT_EXECUTED",
  "NEGATIVE_VALIDATOR_DOMAIN_DAILY_LAW_REJECTION_NOT_EXECUTED",
  "POSITIVE_COMPILED_DOMAIN_DAILY_LAW_ACCEPTANCE_NOT_EXECUTED",
  "SOURCE_BOUND_LOOPBACK_RECEIPT_COMPLETION_NOT_IMPLEMENTED",
]);

export const PRE_DEVNET_PACKET_BLOCKERS = Object.freeze([
  "24H_WINDOW_NOT_OBSERVED",
  "PREFLIGHT_NOT_OBSERVED",
  "EXECUTION_PLAN_NOT_OBSERVED",
  "EXECUTION_RECEIPT_NOT_OBSERVED",
  "OFFICIAL_EXECUTION_EVIDENCE_NOT_OBSERVED",
  "HERMETIC_MOUNT_CAUSALITY_UNPROVEN",
  "OWNER_POLICY_STAGES_2_THROUGH_6_INCOMPLETE",
  "FULL_SUPPLY_TRANSIT_OWNER_ACCEPTANCE_ABSENT",
]);

export const PRE_DEVNET_EVIDENCE_BLOCKERS = Object.freeze([
  ...CANONICAL_READINESS_BLOCKERS,
  ...PRE_DEVNET_PLAN_BLOCKERS,
  ...PRE_DEVNET_PACKET_BLOCKERS,
]);
export const PRE_DEVNET_INDEPENDENT_BLOCKER =
  "GATE_8_DIRECT_EVIDENCE_PACKET_UNSATISFIED";
export const POST_DEVNET_PENDING_FACT_CODES = Object.freeze([
  "DEVNET_NOT_EXECUTED",
  "PUBLIC_DEVNET_EXECUTION_PROVENANCE_UNAVAILABLE",
]);
export const MAINNET_HOLD_CODE = "MAINNET_HOLD";

export const PRE_DEVNET_PENDING_FACTS = Object.freeze([
  Object.freeze({
    code: "DEVNET_NOT_EXECUTED",
    state: "TRUE_EXPECTED_PENDING",
    clearableOnlyBy: "POST_DEVNET_DIRECT_RECEIPTS",
  }),
  Object.freeze({
    code: "PUBLIC_DEVNET_EXECUTION_PROVENANCE_UNAVAILABLE",
    state: "TRUE_EXPECTED_PENDING",
    clearableOnlyBy: "POST_DEVNET_DIRECT_RECEIPTS",
  }),
]);
export const MAINNET_HOLD_INVARIANT = Object.freeze({
  code: MAINNET_HOLD_CODE,
  state: "TRUE_INVARIANT",
  clearableByThisContract: false,
});

const HEX_64 = /^[0-9a-f]{64}$/u;
const SOURCE_HEAD = /^[0-9a-f]{40}$/u;
const PUBLIC_KEY = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/u;
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function exactKeys(value, keys) {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype
    && Object.keys(value).length === keys.length
    && keys.every((key) => Object.hasOwn(value, key));
}

export function canonicalSplitGateSha256(domain, value) {
  if (typeof domain !== "string" || !/^[A-Z0-9_]{8,128}$/u.test(domain)) {
    throw new TypeError("IAT_B3_DEVNET_GATE_DIGEST_DOMAIN_INVALID_HOLD");
  }
  return createHash("sha256")
    .update(`${domain}\0`, "utf8")
    .update(canonicalizeRfc8785(value), "utf8")
    .digest("hex");
}

export { canonicalizeRfc8785, sha256CanonicalJson };

export function parseStrictSplitGateJson(text, label = "IAT_B3_DEVNET_GATE_INPUT") {
  return parseB3OwnerPolicyFreezeJson(text, label);
}

export function validateSourceCheckpoint(value) {
  return exactKeys(value, ["headSha", "treeSha", "statusPorcelain"])
    && SOURCE_HEAD.test(value.headSha)
    && SOURCE_HEAD.test(value.treeSha)
    && value.statusPorcelain === "";
}

export function validateDigest(value) {
  return HEX_64.test(value);
}

export function validatePublicKey(value) {
  return PUBLIC_KEY.test(value) && base58DecodedByteLength(value) === 32;
}

function base58DecodedByteLength(value) {
  if (typeof value !== "string" || value.length === 0) return null;
  let number = 0n;
  for (const character of value) {
    const digit = BASE58_ALPHABET.indexOf(character);
    if (digit < 0) return null;
    number = (number * 58n) + BigInt(digit);
  }
  let encodedBytes = 0;
  while (number > 0n) {
    encodedBytes += 1;
    number >>= 8n;
  }
  let leadingZeroBytes = 0;
  while (leadingZeroBytes < value.length && value[leadingZeroBytes] === "1") {
    leadingZeroBytes += 1;
  }
  return leadingZeroBytes + encodedBytes;
}

export function validateSolanaSignature(value) {
  return typeof value === "string"
    && value.length >= 86
    && value.length <= 88
    && base58DecodedByteLength(value) === 64;
}

export function validateFailurePolicy(value) {
  return exactKeys(value, Object.keys(REQUIRED_FAILURE_POLICY))
    && Object.entries(REQUIRED_FAILURE_POLICY)
      .every(([key, expected]) => value[key] === expected);
}

export function validateExactOrderedCodes(value, expected) {
  return Array.isArray(value)
    && value.length === expected.length
    && value.every((code, index) => code === expected[index]);
}

export function validateClearedEvidence(value) {
  return exactKeys(value, ["code", "directlyObserved", "evidenceSha256"])
    && PRE_DEVNET_EVIDENCE_BLOCKERS.includes(value.code)
    && value.directlyObserved === true
    && validateDigest(value.evidenceSha256);
}

export function validateContinuousObservation(value, sourceCheckpoint) {
  if (!validateSourceCheckpoint(sourceCheckpoint) || !exactKeys(value, [
    "startedAtUnixSeconds",
    "endedAtUnixSeconds",
    "requiredDurationSeconds",
    "targetCadenceSeconds",
    "maximumGapSeconds",
    "scheduler",
    "samples",
    "bindingSha256",
  ])) return false;
  if (!exactKeys(value.scheduler, ["type", "sourceSha256", "executedSha256"])
    || value.scheduler.type !== "EXTERNAL_HASH_CHAINED_MONITOR"
    || !validateDigest(value.scheduler.sourceSha256)
    || value.scheduler.executedSha256 !== value.scheduler.sourceSha256
    || value.requiredDurationSeconds !== PRE_DEVNET_REQUIRED_SECONDS
    || value.targetCadenceSeconds !== PRE_DEVNET_TARGET_SAMPLE_CADENCE_SECONDS
    || value.maximumGapSeconds !== PRE_DEVNET_MAX_SAMPLE_GAP_SECONDS
    || !Array.isArray(value.samples)
    || value.samples.length < PRE_DEVNET_MIN_SAMPLE_COUNT) return false;
  let started;
  let ended;
  try {
    started = BigInt(value.startedAtUnixSeconds);
    ended = BigInt(value.endedAtUnixSeconds);
  } catch {
    return false;
  }
  if (ended - started < BigInt(PRE_DEVNET_REQUIRED_SECONDS)) return false;
  const bindingFields = [
    "headSha",
    "treeSha",
    "runnerSha256",
    "toolchainSha256",
    "identitiesSha256",
    "artifactsSha256",
    "receiptsSha256",
    "validatorGenesisHash",
    "validatorProcessIdentitySha256",
  ];
  let previousTimestamp = null;
  let previousDigest = null;
  for (let index = 0; index < value.samples.length; index += 1) {
    const sample = value.samples[index];
    if (!exactKeys(sample, [
      "ordinal",
      "observedAtUnixSeconds",
      ...bindingFields,
      "validatorSlot",
      "previousSampleSha256",
      "schedulerEnvelopeSha256",
      "sampleSha256",
    ]) || sample.ordinal !== index + 1
      || !validateDigest(sample.runnerSha256)
      || !validateDigest(sample.toolchainSha256)
      || !validateDigest(sample.identitiesSha256)
      || !validateDigest(sample.artifactsSha256)
      || !validateDigest(sample.receiptsSha256)
      || !validateDigest(sample.validatorProcessIdentitySha256)
      || !validateDigest(sample.schedulerEnvelopeSha256)
      || !validateDigest(sample.sampleSha256)
      || sample.headSha !== sourceCheckpoint.headSha
      || sample.treeSha !== sourceCheckpoint.treeSha
      || !validatePublicKey(sample.validatorGenesisHash)) return false;
    let timestamp;
    let slot;
    try {
      timestamp = BigInt(sample.observedAtUnixSeconds);
      slot = BigInt(sample.validatorSlot);
    } catch {
      return false;
    }
    if (index === 0) {
      if (timestamp !== started || sample.previousSampleSha256 !== null) return false;
    } else {
      const previous = value.samples[index - 1];
      const gap = timestamp - previousTimestamp;
      if (gap <= 0n || gap > BigInt(PRE_DEVNET_MAX_SAMPLE_GAP_SECONDS)
        || slot <= BigInt(previous.validatorSlot)
        || sample.previousSampleSha256 !== previousDigest) return false;
      for (const field of bindingFields) {
        if (sample[field] !== value.samples[0][field]) return false;
      }
    }
    const { sampleSha256, ...sampleCore } = sample;
    const expectedSampleSha256 = canonicalSplitGateSha256(
      "IAT_B3_PRE_DEVNET_OBSERVATION_SAMPLE_V1",
      sampleCore,
    );
    if (sampleSha256 !== expectedSampleSha256) return false;
    previousTimestamp = timestamp;
    previousDigest = sampleSha256;
  }
  if (previousTimestamp !== ended) return false;
  const { bindingSha256, ...windowCore } = value;
  return bindingSha256 === canonicalSplitGateSha256(
    "IAT_B3_PRE_DEVNET_OBSERVATION_WINDOW_V1",
    windowCore,
  );
}

export function splitGateSafety() {
  return Object.freeze({
    networkAccess: false,
    rpcQueries: false,
    signing: false,
    broadcast: false,
    deployment: false,
    fundingSpend: false,
    activation: false,
    releaseAuthorized: false,
    mainnetExecutionAuthorized: false,
    mainnetStatus: MAINNET_HOLD_STATUS,
  });
}
