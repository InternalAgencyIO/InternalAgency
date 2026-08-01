#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const V2_STAGE_ORDER = Object.freeze([
  "DEPLOY_PROGRAM_WITHOUT_IAT",
  "TRANSFER_UPGRADE_AUTHORITY_TO_MODEL_T",
  "CREATE_INITIALIZE_IMMUTABLE_MINT_AND_METADATA",
  "INITIALIZE_CONFIG_LANE_VAULTS_AND_STAKE_VAULT",
  "MINT_COMMUNITY_AND_FOUR_PROGRAM_VAULT_ALLOCATIONS",
  "REVOKE_MINT_AUTHORITY",
  "REVOKE_FREEZE_AUTHORITY",
  "ACTIVATE_AFTER_RANDOMNESS_BUILD_AND_REVIEW_GATES",
]);

const canonicalPath = "launch/iat-v2-mainnet-stage-journal.template.json";
const inputPath = process.argv[2] ?? canonicalPath;
if (inputPath !== canonicalPath) {
  console.error(`FAIL: stage journal path must be ${canonicalPath}`);
  process.exit(1);
}

const journal = JSON.parse(readFileSync(resolve(inputPath), "utf8"));
const failures = [];
const fail = (message) => failures.push(message);
const exactKeys = (value, keys) => value && typeof value === "object"
  && !Array.isArray(value)
  && JSON.stringify(Object.keys(value)) === JSON.stringify(keys);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const isDigest = (value) => typeof value === "string" && /^[0-9a-f]{64}$/u.test(value);
const base58DecodedLength = (value) => {
  if (typeof value !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{1,90}$/u.test(value)) return -1;
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let decoded = [0];
  for (const character of value) {
    let carry = alphabet.indexOf(character);
    for (let index = 0; index < decoded.length; index += 1) {
      carry += decoded[index] * 58;
      decoded[index] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) { decoded.push(carry & 0xff); carry >>= 8; }
  }
  let leadingZeroes = 0;
  while (leadingZeroes < value.length && value[leadingZeroes] === "1") leadingZeroes += 1;
  return decoded.length + leadingZeroes - (decoded.length === 1 && decoded[0] === 0 ? 1 : 0);
};
const isAddress = (value) => base58DecodedLength(value) === 32 && value !== "11111111111111111111111111111111";
const isSignature = (value) => base58DecodedLength(value) === 64;
const isUtc = (value) => typeof value === "string"
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u.test(value)
  && Number.isFinite(Date.parse(value));
const isCurrentOrPastUtc = (value) => isUtc(value) && Date.parse(value) <= Date.now() + 60_000;
const isLabel = (value) => typeof value === "string"
  && value === value.trim()
  && value.length >= 3
  && value.length <= 80
  && !/[\p{Cc}\p{Cf}]/u.test(value);
const isReasonCode = (value) => typeof value === "string" && /^[A-Z][A-Z0-9_]{2,63}$/u.test(value);
const isPublicHttpsUrl = (value) => {
  try {
    const parsed = new URL(value);
    const hostname = parsed.hostname.toLowerCase().replace(/\.+$/u, "");
    return parsed.protocol === "https:"
      && parsed.username === ""
      && parsed.password === ""
      && hostname !== "localhost"
      && hostname !== "example.com"
      && !hostname.startsWith("placeholder");
  } catch {
    return false;
  }
};
const nullableFields = [
  "signature",
  "explorerUrl",
  "confirmedAtUtc",
  "independentlyVerifiedAtUtc",
  "independentVerifierLabel",
  "observedPostStateSha256",
  "mismatchCode",
];

const sourcePaths = {
  programClientPath: "programs/iat_v2/client.mjs",
  policyPath: "engagement/iat-economic-policy.v2.json",
  allocationPlanPath: "launch/iat-v2-allocation-plan.template.json",
  readinessGatePath: "launch/iat-v2-mainnet-readiness-gate.json",
  releaseSnapshotPath: "launch/release-snapshot.generated.json",
  localTimeGateProofPath: "launch/iat-v2-local-time-gate-proof.json",
};
const digestFields = {
  programClientSha256: sourcePaths.programClientPath,
  policySha256: sourcePaths.policyPath,
  allocationPlanSha256: sourcePaths.allocationPlanPath,
  readinessGateSha256: sourcePaths.readinessGatePath,
  releaseSnapshotSha256: sourcePaths.releaseSnapshotPath,
  localTimeGateProofSha256: sourcePaths.localTimeGateProofPath,
};
const readinessGate = JSON.parse(readFileSync(resolve(sourcePaths.readinessGatePath), "utf8"));
const programClientSource = readFileSync(resolve(sourcePaths.programClientPath), "utf8");
const stageKeys = [
  "index",
  "stage",
  "status",
  "reviewedIntentSha256",
  "signedMessageSha256",
  "expectedPostStateSha256",
  ...nullableFields,
];
const expectedLimitations = [
  "Explorer URLs and recorded digests are evidence references, not signatures or transaction authority.",
  "A FINALIZED_MATCHED stage requires a separate independent read of confirmed state.",
  "TERMINAL_HOLD is permanent after the first failure, mismatch, or unresolved submission; recovery requires a new separately reviewed record and must never overwrite history.",
  "RECONCILED permits evidence-first publication review only; it does not authorize publication or claims.",
];
const expectedHashContract = {
  algorithm: "SHA-256",
  reviewedIntentEncoding: "RFC8785_CANONICAL_JSON_UTF8",
  reviewedIntentIncludes: ["stage", "network", "programId", "orderedAccountMetas", "instructionData", "amountsAndAuthorities"],
  reviewedIntentExcludes: ["recentBlockhash", "signatures"],
  signedMessageEncoding: "SOLANA_SERIALIZED_MESSAGE_BYTES",
  postStateEncoding: "RFC8785_CANONICAL_JSON_UTF8",
};

function explorerMatchesSignature(url, signature) {
  try {
    const parsed = new URL(url);
    const cluster = parsed.searchParams.get("cluster");
    return parsed.protocol === "https:"
      && parsed.hostname === "explorer.solana.com"
      && parsed.port === ""
      && parsed.hash === ""
      && parsed.pathname === `/tx/${signature}`
      && (cluster === null || cluster === "mainnet-beta")
      && [...parsed.searchParams.keys()].every((key) => key === "cluster");
  } catch {
    return false;
  }
}

function unsafeContent(value, path = "journal") {
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const unsafe = unsafeContent(item, `${path}[${index}]`);
      if (unsafe) return unsafe;
    }
    return null;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (/(?:secret|private.?key|mnemonic|seed.?phrase|password|recovery)/iu.test(key)) return `${path}.${key}`;
      const unsafe = unsafeContent(item, `${path}.${key}`);
      if (unsafe) return unsafe;
    }
  }
  if (typeof value === "string") {
    const words = value.trim().split(/\s+/u);
    if (words.length >= 12 && words.length <= 24 && words.every((word) => /^[a-z]+$/u.test(word))) return path;
    if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/u.test(value)) return path;
  }
  return null;
}

if (!exactKeys(journal, ["schema", "status", "network", "scope", "hashContract", "sourceArtifacts", "artifactDigests", "identity", "controls", "stages", "terminalDecision", "limitations"])) fail("journal must contain exactly the reviewed top-level fields");
if (journal.schema !== "iat-v2-mainnet-stage-journal/v2") fail("unexpected stage-journal schema");
if (!["HOLD", "ARMED", "TERMINAL_HOLD", "RECONCILED"].includes(journal.status)) fail("status must be HOLD, ARMED, TERMINAL_HOLD, or RECONCILED");
if (journal.network !== "mainnet-beta") fail("stage journal must remain mainnet-beta");
if (journal.scope !== "Non-authorizing V2 stage reconciliation journal; this file never signs, broadcasts, retries, repairs, compensates, publishes, or establishes on-chain truth.") fail("scope lost its non-authorizing boundary");
if (JSON.stringify(journal.hashContract) !== JSON.stringify(expectedHashContract)) fail("hashContract must retain the exact reviewed intent, message, and post-state encodings");
if (!exactKeys(journal.sourceArtifacts, Object.keys(sourcePaths))) fail("sourceArtifacts must contain exactly the reviewed paths");
if (!exactKeys(journal.artifactDigests, Object.keys(digestFields))) fail("artifactDigests must contain exactly the reviewed fields");
if (!exactKeys(journal.identity, ["sourceCommit", "programId", "programDataAddress", "mint", "administrator"])) fail("identity must contain exactly the reviewed public fields");
if (!exactKeys(journal.controls, ["stageOrderImmutable", "intentBoundBeforeCeremony", "signedMessageBoundBeforeSubmission", "stopAfterFirstNonMatch", "noAutomaticRetry", "noCompensatingTransaction", "noApprovalReuse", "independentVerificationPerFinalizedStage", "noPublicationBeforeFullReconciliation", "preserveTerminalHoldHistory"])) fail("controls must contain exactly the reviewed intent, message, and stop fields");
if (!exactKeys(journal.terminalDecision, ["state", "failedStage", "reasonCode", "reviewedAtUtc", "reviewerLabel", "publicIncidentUrl"])) fail("terminalDecision must contain exactly the reviewed fields");
if (unsafeContent(journal)) fail(`journal contains credential-shaped content at ${unsafeContent(journal)}`);
for (const [field, expected] of Object.entries(sourcePaths)) {
  if (journal.sourceArtifacts?.[field] !== expected) fail(`${field} must point to ${expected}`);
}
for (const [field, value] of Object.entries(journal.controls ?? {})) {
  if (value !== true) fail(`controls.${field} must be true`);
}
if (JSON.stringify(journal.limitations) !== JSON.stringify(expectedLimitations)) fail("limitations must retain the four exact reviewed non-authorizing statements");
if (!Array.isArray(journal.stages) || journal.stages.length !== V2_STAGE_ORDER.length) fail("journal must contain exactly eight V2 stages");
let priorStageOffset = -1;
for (const stage of V2_STAGE_ORDER) {
  const marker = `"${stage}"`;
  const offset = programClientSource.indexOf(marker);
  if (offset === -1 || programClientSource.indexOf(marker, offset + marker.length) !== -1 || offset <= priorStageOffset) fail(`canonical client must declare ${stage} exactly once in reviewed order`);
  priorStageOffset = offset;
}

const isHold = journal.status === "HOLD";
if (isHold) {
  for (const field of Object.keys(digestFields)) if (journal.artifactDigests?.[field] !== null) fail(`HOLD requires artifactDigests.${field} to be null`);
  for (const [field, value] of Object.entries(journal.identity ?? {})) if (value !== null) fail(`HOLD requires identity.${field} to be null`);
} else {
  for (const [field, artifactPath] of Object.entries(digestFields)) {
    const expected = sha256(readFileSync(resolve(artifactPath)));
    if (!isDigest(journal.artifactDigests?.[field]) || journal.artifactDigests[field] !== expected) fail(`${field} must bind the exact canonical ${artifactPath} bytes`);
  }
  if (typeof journal.identity?.sourceCommit !== "string" || !/^[0-9a-f]{40}$/u.test(journal.identity.sourceCommit)) fail("non-HOLD requires a lowercase 40-hex source commit");
  for (const field of ["programId", "programDataAddress", "mint", "administrator"]) if (!isAddress(journal.identity?.[field])) fail(`non-HOLD requires a usable public identity.${field}`);
  const identityAddresses = [journal.identity?.programId, journal.identity?.programDataAddress, journal.identity?.mint, journal.identity?.administrator];
  if (new Set(identityAddresses).size !== identityAddresses.length) fail("program, ProgramData, mint, and administrator identities must be distinct");
  if (readinessGate.status !== "HOLD" || readinessGate.network !== "mainnet-beta") fail("non-HOLD journal requires a canonical mainnet readiness record still preserving HOLD");
  if (readinessGate.schedule?.state !== "SCHEDULED_HOLD" || !isUtc(readinessGate.schedule?.publishedAtUtc)) fail("non-HOLD journal requires a newly published SCHEDULED_HOLD UTC window");
  if (readinessGate.funding?.ceremonyFloorSatisfied !== true || readinessGate.gates?.mainnetFundingFloorSatisfied !== true) fail("non-HOLD journal requires the recorded ceremony funding floor");
  for (const field of ["replacementUtcWindowPublished", "releaseArtifactsRegeneratedAfterFundingAndScheduling", "finalPreflightPassedAgainstRegeneratedArtifacts", "physicalModelTDevicePathReviewed", "physicalModelTReviewCompleted", "independentMainnetVerifierAssigned", "mainnetExecutionAuthorized"]) {
    if (readinessGate.gates?.[field] !== true) fail(`non-HOLD journal requires readinessGate.gates.${field}`);
  }
  for (const [field, value] of Object.entries(readinessGate.safety ?? {})) if (value !== false) fail(`non-HOLD journal requires readinessGate.safety.${field} to remain false`);
}

const signatures = new Set();
let firstStopIndex = -1;
for (const [offset, stage] of (journal.stages ?? []).entries()) {
  if (!exactKeys(stage, stageKeys)) { fail(`stages[${offset}] must contain exactly the reviewed fields`); continue; }
  if (stage.index !== offset + 1) fail(`stages[${offset}].index must be ${offset + 1}`);
  if (stage.stage !== V2_STAGE_ORDER[offset]) fail(`stages[${offset}].stage breaks the immutable V2 order`);
  if (!["PENDING", "FINALIZED_MATCHED", "FAILED_OR_MISMATCH", "SUBMITTED_UNRESOLVED", "NOT_ATTEMPTED"].includes(stage.status)) fail(`stages[${offset}].status is not reviewed`);
  if (isHold) {
    if (stage.status !== "PENDING") fail(`HOLD requires stages[${offset}] to remain PENDING`);
    for (const field of ["reviewedIntentSha256", "signedMessageSha256", "expectedPostStateSha256", ...nullableFields]) if (stage[field] !== null) fail(`HOLD requires stages[${offset}].${field} to be null`);
    continue;
  }
  for (const field of ["reviewedIntentSha256", "expectedPostStateSha256"]) if (!isDigest(stage[field])) fail(`non-HOLD requires stages[${offset}].${field}`);
  if (stage.status === "PENDING" || stage.status === "NOT_ATTEMPTED") {
    for (const field of ["signedMessageSha256", ...nullableFields]) if (stage[field] !== null) fail(`${stage.status} requires stages[${offset}].${field} to be null`);
  }
  if (stage.status === "FINALIZED_MATCHED") {
    if (!isDigest(stage.signedMessageSha256)) fail(`stages[${offset}] finalized evidence requires its signed-message digest`);
    if (!isSignature(stage.signature)) fail(`stages[${offset}] requires a usable finalized signature`);
    else if (signatures.has(stage.signature)) fail(`duplicate stage signature at index ${offset}`); else signatures.add(stage.signature);
    if (!explorerMatchesSignature(stage.explorerUrl, stage.signature)) fail(`stages[${offset}].explorerUrl must directly identify its mainnet signature`);
    if (!isCurrentOrPastUtc(stage.confirmedAtUtc) || !isCurrentOrPastUtc(stage.independentlyVerifiedAtUtc)) fail(`stages[${offset}] requires non-future canonical confirmation and verification timestamps`);
    else if (Date.parse(stage.independentlyVerifiedAtUtc) < Date.parse(stage.confirmedAtUtc)) fail(`stages[${offset}] verification cannot predate confirmation`);
    if (!isLabel(stage.independentVerifierLabel)) fail(`stages[${offset}] requires an independent verifier label`);
    if (!isDigest(stage.observedPostStateSha256) || stage.observedPostStateSha256 !== stage.expectedPostStateSha256) fail(`stages[${offset}] observed post-state must match the precommitted expected digest`);
    if (stage.mismatchCode !== null) fail(`FINALIZED_MATCHED stage ${offset} cannot retain a mismatch code`);
  }
  if (stage.status === "FAILED_OR_MISMATCH") {
    if (firstStopIndex !== -1) fail("journal may contain only one first stop boundary"); else firstStopIndex = offset;
    if (!isReasonCode(stage.mismatchCode)) fail(`stages[${offset}] requires a portable mismatch code`);
    if (!isCurrentOrPastUtc(stage.independentlyVerifiedAtUtc) || !isLabel(stage.independentVerifierLabel)) fail(`stages[${offset}] failure requires a non-future independent review record`);
    if ((stage.signature === null) !== (stage.explorerUrl === null)) fail(`stages[${offset}] signature and Explorer URL must be both present or both null`);
    if (stage.signature !== null && (!isSignature(stage.signature) || !explorerMatchesSignature(stage.explorerUrl, stage.signature))) fail(`stages[${offset}] failure evidence must directly identify a usable mainnet signature`);
    else if (stage.signature !== null && signatures.has(stage.signature)) fail(`duplicate stage signature at index ${offset}`);
    else if (stage.signature !== null) signatures.add(stage.signature);
    if (stage.confirmedAtUtc !== null && !isCurrentOrPastUtc(stage.confirmedAtUtc)) fail(`stages[${offset}].confirmedAtUtc must be null or non-future canonical UTC`);
    if (stage.confirmedAtUtc !== null && isUtc(stage.independentlyVerifiedAtUtc) && Date.parse(stage.independentlyVerifiedAtUtc) < Date.parse(stage.confirmedAtUtc)) fail(`stages[${offset}] failure verification cannot predate confirmation`);
    if (stage.observedPostStateSha256 !== null && !isDigest(stage.observedPostStateSha256)) fail(`stages[${offset}].observedPostStateSha256 must be null or lowercase SHA-256`);
    if (stage.signedMessageSha256 !== null && !isDigest(stage.signedMessageSha256)) fail(`stages[${offset}].signedMessageSha256 must be null or lowercase SHA-256`);
    if (stage.signature !== null && !isDigest(stage.signedMessageSha256)) fail(`stages[${offset}] failure signature requires its signed-message digest`);
  }
  if (stage.status === "SUBMITTED_UNRESOLVED") {
    if (firstStopIndex !== -1) fail("journal may contain only one first stop boundary"); else firstStopIndex = offset;
    if (!isSignature(stage.signature)) fail(`stages[${offset}] unresolved submission requires its usable public signature`);
    else if (signatures.has(stage.signature)) fail(`duplicate stage signature at index ${offset}`);
    else signatures.add(stage.signature);
    if (!explorerMatchesSignature(stage.explorerUrl, stage.signature)) fail(`stages[${offset}] unresolved submission must directly identify its mainnet signature`);
    if (!isDigest(stage.signedMessageSha256)) fail(`stages[${offset}] unresolved submission requires its signed-message digest`);
    if (stage.confirmedAtUtc !== null) fail(`stages[${offset}] unresolved submission cannot claim a confirmation time`);
    if (!isCurrentOrPastUtc(stage.independentlyVerifiedAtUtc) || !isLabel(stage.independentVerifierLabel)) fail(`stages[${offset}] unresolved submission requires a non-future independent review record`);
    if (stage.observedPostStateSha256 !== null) fail(`stages[${offset}] unresolved submission cannot claim an observed post-state digest`);
    if (stage.mismatchCode !== "CONFIRMATION_UNKNOWN") fail(`stages[${offset}] unresolved submission requires CONFIRMATION_UNKNOWN`);
  }
}

if (journal.status === "ARMED") {
  if (journal.stages?.some(({ status }) => status !== "PENDING")) fail("ARMED requires all stages PENDING");
  if (journal.terminalDecision?.state !== "HOLD" || journal.terminalDecision?.reasonCode !== "NOT_STARTED") fail("ARMED must retain terminal HOLD / NOT_STARTED");
  for (const field of ["failedStage", "reviewedAtUtc", "reviewerLabel", "publicIncidentUrl"]) if (journal.terminalDecision?.[field] !== null) fail(`ARMED requires terminalDecision.${field} to be null`);
}
if (journal.status === "TERMINAL_HOLD") {
  if (firstStopIndex === -1) fail("TERMINAL_HOLD requires one failed, mismatched, or unresolved stage");
  for (let index = 0; index < (journal.stages?.length ?? 0); index += 1) {
    if (index < firstStopIndex && journal.stages[index].status !== "FINALIZED_MATCHED") fail(`TERMINAL_HOLD stage ${index + 1} must be FINALIZED_MATCHED`);
    if (index === firstStopIndex && !["FAILED_OR_MISMATCH", "SUBMITTED_UNRESOLVED"].includes(journal.stages[index].status)) fail(`TERMINAL_HOLD stage ${index + 1} must be FAILED_OR_MISMATCH or SUBMITTED_UNRESOLVED`);
    if (index > firstStopIndex && journal.stages[index].status !== "NOT_ATTEMPTED") fail(`TERMINAL_HOLD stage ${index + 1} must be NOT_ATTEMPTED`);
  }
  if (journal.terminalDecision?.state !== "TERMINAL_HOLD" || journal.terminalDecision?.failedStage !== V2_STAGE_ORDER[firstStopIndex] || !isReasonCode(journal.terminalDecision?.reasonCode) || !isCurrentOrPastUtc(journal.terminalDecision?.reviewedAtUtc) || !isLabel(journal.terminalDecision?.reviewerLabel)) fail("TERMINAL_HOLD decision must bind the first stopped stage and non-future independent review");
  if (journal.terminalDecision?.reasonCode !== journal.stages?.[firstStopIndex]?.mismatchCode) fail("TERMINAL_HOLD reasonCode must equal the stopped stage mismatchCode");
  if (isUtc(journal.terminalDecision?.reviewedAtUtc) && isUtc(journal.stages?.[firstStopIndex]?.independentlyVerifiedAtUtc) && Date.parse(journal.terminalDecision.reviewedAtUtc) < Date.parse(journal.stages[firstStopIndex].independentlyVerifiedAtUtc)) fail("TERMINAL_HOLD review cannot predate the stopped-stage independent review");
  if (journal.terminalDecision?.publicIncidentUrl !== null && !isPublicHttpsUrl(journal.terminalDecision.publicIncidentUrl)) fail("TERMINAL_HOLD publicIncidentUrl must be null or a public HTTPS URL");
}
if (journal.status === "RECONCILED") {
  if (journal.stages?.some(({ status }) => status !== "FINALIZED_MATCHED")) fail("RECONCILED requires all eight stages FINALIZED_MATCHED");
  if (journal.terminalDecision?.state !== "RECONCILED" || journal.terminalDecision?.failedStage !== null || journal.terminalDecision?.reasonCode !== "ALL_STAGES_MATCHED" || !isCurrentOrPastUtc(journal.terminalDecision?.reviewedAtUtc) || !isLabel(journal.terminalDecision?.reviewerLabel) || journal.terminalDecision?.publicIncidentUrl !== null) fail("RECONCILED decision must record ALL_STAGES_MATCHED without incident evidence");
  const latestStageReview = Math.max(...(journal.stages ?? []).map((stage) => Date.parse(stage.independentlyVerifiedAtUtc)));
  if (isUtc(journal.terminalDecision?.reviewedAtUtc) && Number.isFinite(latestStageReview) && Date.parse(journal.terminalDecision.reviewedAtUtc) < latestStageReview) fail("RECONCILED terminal review cannot predate any stage review");
}
if (journal.status === "HOLD") {
  if (journal.terminalDecision?.state !== "HOLD" || journal.terminalDecision?.reasonCode !== "NOT_STARTED") fail("HOLD journal must retain terminal HOLD / NOT_STARTED");
  for (const field of ["failedStage", "reviewedAtUtc", "reviewerLabel", "publicIncidentUrl"]) if (journal.terminalDecision?.[field] !== null) fail(`HOLD requires terminalDecision.${field} to be null`);
}

if (failures.length) {
  console.error("IAT V2 mainnet stage-journal validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`IAT V2 mainnet stage journal passes in ${journal.status}: eight immutable boundaries, independent stage evidence, terminal HOLD on first failure, mismatch, or unresolved submission, no retry or compensating transaction authority.`);
