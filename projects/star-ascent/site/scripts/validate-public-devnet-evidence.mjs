#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../public/evidence/iat-v2",
);
const index = JSON.parse(await readFile(path.join(root, "index.json"), "utf8"));
const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

function walk(value, trail = []) {
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    const next = [...trail, key];
    check(
      !/(private.?key|secret.?key|mnemonic|seed.?phrase|recovery.?phrase|wallet.?seed|keypair)/i.test(key),
      `credential-bearing field found: ${next.join(".")}`,
    );
    walk(item, next);
  }
}

check(index.schema === "iat-public-evidence-index/v1", "unexpected index schema");
check(index.license === "CC0-1.0", "public evidence must declare CC0-1.0");
check(index.network === "devnet", "public evidence index must remain devnet-only");
check(index.mainnetStatus === "HOLD", "public evidence must not clear mainnet HOLD");
check(index.independentReviewRequired === true, "current remediation source must require independent review");
check(index.secretMaterialIncluded === false, "secret-material declaration must remain false");
check(Array.isArray(index.records) && index.records.length === 15, "expected fifteen indexed records");
check(
  JSON.stringify(index.canonicalAtPublication) === JSON.stringify([
    "v2-initialization-20260730T074603Z.json",
    "v2-features-20260801T053340Z.json",
    "chain-status-20260801T053947Z.json",
    "v2-feature-independent-signoff-20260801T055736Z.json",
    "v2-local-time-gate-proof-20260801T072730Z.json",
  ]),
  "canonical evidence set is not pinned to the latest reviewed records",
);
check(
  index.canonicalAtPublicationStatus
    === "HISTORICAL_PRIOR_ARTIFACT_SUPERSEDED_BY_REMEDIATION_SOURCE",
  "prior canonical evidence set must be classified as historical",
);
check(
  index.currentRemediationState?.sourceCommit
    === "1df716ccd93c47ee1732af6ae1f43b8e6958afe6"
    && index.currentRemediationState?.localHostProof
      === "v2-local-time-gate-proof-remediation-20260802T103546Z.json"
    && index.currentRemediationState?.localHostProofStatus === "VERIFIED_LOCAL_HOST_ONLY"
    && index.currentRemediationState?.freshSignedDevnetEvidence === "REQUIRED_NOT_COMPLETE"
    && index.currentRemediationState?.independentReview === "REQUIRED_NOT_COMPLETE"
    && index.currentRemediationState?.mainnetStatus === "HOLD",
  "current remediation evidence boundary drift",
);

const indexedNames = new Set();
for (const record of index.records ?? []) {
  check(!indexedNames.has(record.file), `duplicate indexed file: ${record.file}`);
  indexedNames.add(record.file);
  const filePath = path.resolve(root, record.file);
  check(filePath.startsWith(`${root}${path.sep}`), `record escapes evidence directory: ${record.file}`);
  const bytes = await readFile(filePath);
  const details = await stat(filePath);
  const digest = createHash("sha256").update(bytes).digest("hex");
  check(details.size === record.bytes, `byte count mismatch: ${record.file}`);
  check(digest === record.sha256, `SHA-256 mismatch: ${record.file}`);
  if (record.file.endsWith(".json")) walk(JSON.parse(bytes.toString("utf8")));
}

const init = JSON.parse(
  await readFile(path.join(root, "v2-initialization-20260730T074603Z.json"), "utf8"),
);
const feature = JSON.parse(
  await readFile(path.join(root, "v2-features-20260801T053340Z.json"), "utf8"),
);
const legacy = JSON.parse(
  await readFile(path.join(root, "legacy-v1-devnet-ceremony-20260729.json"), "utf8"),
);
const legacyReceipt = JSON.parse(
  await readFile(path.join(root, "chain-status-20260730T123453Z.json"), "utf8"),
);
const receipt = JSON.parse(
  await readFile(path.join(root, "chain-status-20260801T053947Z.json"), "utf8"),
);
const signoff = JSON.parse(
  await readFile(path.join(root, "v2-feature-independent-signoff-20260801T055736Z.json"), "utf8"),
);
const timeGateProof = JSON.parse(
  await readFile(path.join(root, "v2-local-time-gate-proof-20260801T072730Z.json"), "utf8"),
);
const remediationTimeGateProof = JSON.parse(
  await readFile(
    path.join(root, "v2-local-time-gate-proof-remediation-20260802T103546Z.json"),
    "utf8",
  ),
);

check(init.network === "devnet" && init.mainnetStatus === "HOLD", "V2 initialization boundary drift");
check(init.transactions?.length === 7, "V2 initialization must retain seven transactions");
check(feature.network === "devnet" && feature.mainnetStatus === "HOLD", "V2 feature boundary drift");
check(feature.transactions?.length === 18, "latest V2 feature snapshot must retain 18 transactions");
check(
  feature.status === "PARTIAL_PENDING_ALL_TIME_GATES_AND_INDEPENDENT_REVIEW",
  "latest feature snapshot must remain explicitly partial",
);
check(
  feature.positions?.length === 3 && feature.positions.every(Boolean),
  "latest feature snapshot must retain three real stake positions",
);
check(
  feature.positions?.[0]?.paid === "19230769" && feature.positions?.[0]?.settledMask === "1",
  "latest feature snapshot must retain the finalized standard week-8 settlement",
);
check(
  feature.positions?.[1]?.paid === "53846153"
    && feature.positions?.[1]?.settledMask === "1"
    && feature.positions?.[1]?.annualRateBps === "2800",
  "latest feature snapshot must retain the finalized CCC-agent week-8 settlement",
);
check(
  feature.positions?.[2]?.paid === "0"
    && feature.positions?.[2]?.settledMask === "1"
    && feature.positions?.[2]?.annualRateBps === "2000",
  "latest feature snapshot must retain the selected-agency CCC-associate pause",
);
check(feature.coreReward?.paid === "326923076", "latest feature snapshot core APY payment drift");
check(
  feature.liquidityLane?.principalClaimed === "12500000000",
  "latest feature snapshot Genesis liquidity unlock drift",
);
check(
  feature.currentCccRound === 8
    && feature.currentRound?.week === "8"
    && feature.currentRound?.status === 1
    && feature.currentRound?.selectedAgencyIndex === 1
    && feature.currentRound?.derivationCounter === 0,
  "latest feature snapshot must retain the finalized CCC round-8 result",
);
const expectedFeatureActions = new Set([
  "REGISTER_AGENCY_0",
  "REGISTER_AGENCY_1",
  "SET_STANDARD_ELIGIBILITY",
  "OPEN_STANDARD_POSITION",
  "SET_CCC_AGENT_ELIGIBILITY",
  "OPEN_CCC_AGENT_POSITION",
  "SET_CCC_ASSOCIATE_ELIGIBILITY",
  "OPEN_CCC_ASSOCIATE_POSITION",
  "SETTLE_CORE_WEEK_0",
  "CLAIM_LIQUIDITY_GENESIS_UNLOCK",
  "CREATE_SWITCHBOARD_RANDOMNESS",
  "COMMIT_CCC_ROUND_7",
  "REVEAL_CCC_ROUND_7",
  "SETTLE_STANDARD_POSITION_WEEK_8",
  "COMMIT_CCC_ROUND_8",
  "REVEAL_CCC_ROUND_8",
  "SETTLE_LINKED_POSITION_2_WEEK_8",
  "SETTLE_LINKED_POSITION_3_WEEK_8",
]);
const observedFeatureActions = new Set(feature.transactions.map(({ action }) => action));
check(
  expectedFeatureActions.size === observedFeatureActions.size
    && [...expectedFeatureActions].every((action) => observedFeatureActions.has(action)),
  "latest feature snapshot action set drift",
);
check(legacy.network === "devnet" && legacy.transactions?.length === 4, "legacy record boundary drift");
check(
  legacyReceipt.results?.length === 15
    && legacyReceipt.results.every(
      (result) => result.confirmationStatus === "finalized" && result.err === null,
    ),
  "historical 15-signature receipt drift",
);
check(receipt.network === "devnet" && receipt.mainnetStatus === "HOLD", "chain receipt boundary drift");
check(receipt.signingOrBroadcastPerformed === false, "chain receipt must stay read-only");
check(receipt.results?.length === 29, "chain receipt must retain 29 transaction statuses");
check(
  receipt.results?.every((result) => result.confirmationStatus === "finalized" && result.err === null),
  "chain receipt contains a non-finalized or failed transaction",
);

const expectedSignatures = new Set([
  ...legacy.transactions.map(({ signature }) => signature),
  ...init.transactions.map(({ signature }) => signature),
  ...feature.transactions.map(({ signature }) => signature),
]);
const receiptSignatures = new Set(receipt.results.map(({ signature }) => signature));
check(expectedSignatures.size === 29, "expected signature union must contain 29 unique values");
check(
  expectedSignatures.size === receiptSignatures.size
    && [...expectedSignatures].every((signature) => receiptSignatures.has(signature)),
  "chain receipt does not exactly cover the published canonical transaction set",
);
check(
  signoff.schema === "iat-v2-devnet-feature-independent-signoff/v1"
    && signoff.status === "VERIFIED"
    && signoff.scope === "CORRECTED_PROGRAM_AND_EIGHTEEN_TRANSACTION_FEATURE_REHEARSAL",
  "independent feature sign-off boundary drift",
);
check(
  signoff.evidence?.path === "public/evidence/iat-v2/v2-features-20260801T053340Z.json"
    && signoff.evidence?.sha256 === "7b460bee7a644452c6710cff7a5b81a3a3769a1d2daf4d3813913d7524a9b6f9"
    && signoff.evidence?.transactionCount === 18,
  "independent feature sign-off evidence binding drift",
);
check(
  signoff.chainReceipt?.path === "public/evidence/iat-v2/chain-status-20260801T053947Z.json"
    && signoff.chainReceipt?.sha256 === "0a2e1f8ffeecffaf974e51f2d6e9abe020517a784c5cfa8b9c0f6af1f1efa4ce"
    && signoff.chainReceipt?.signatureCount === 29,
  "independent feature sign-off receipt binding drift",
);
check(
  signoff.verifier?.accountabilityLabel === "FDF Guard"
    && signoff.verifier?.independentOfOperator === true
    && signoff.verifier?.didNotOperateModelT === true
    && Object.values(signoff.checks ?? {}).every((value) => value === true)
    && signoff.exceptions?.length === 0
    && signoff.completedAtUtc === "2026-08-01T05:57:36Z",
  "independent feature sign-off completion drift",
);
check(
  timeGateProof.schema === "iat-v2-local-time-gate-proof/v1"
    && timeGateProof.status === "VERIFIED_LOCAL_HOST_ONLY"
    && timeGateProof.network === "local-host"
    && timeGateProof.mainnetStatus === "HOLD",
  "local time-gate proof boundary drift",
);
check(
  timeGateProof.method?.localValidatorTransactionUsed === false
    && timeGateProof.method?.signingPerformed === false
    && timeGateProof.method?.simulationForSigningPerformed === false
    && timeGateProof.method?.broadcastingPerformed === false
    && timeGateProof.method?.walletAccessed === false
    && timeGateProof.method?.keyCreated === false,
  "local time-gate proof safety boundary drift",
);
check(
  timeGateProof.observations?.clockCases?.length === 6
    && timeGateProof.observations?.cccCases?.length === 4
    && timeGateProof.observations?.laneCases?.length === 24
    && timeGateProof.observations?.positionCase?.maturityWeek === 59,
  "local time-gate proof vector set drift",
);
check(
  remediationTimeGateProof.schema === "iat-v2-local-time-gate-proof/v1"
    && remediationTimeGateProof.status === "VERIFIED_LOCAL_HOST_ONLY"
    && remediationTimeGateProof.network === "local-host"
    && remediationTimeGateProof.mainnetStatus === "HOLD"
    && remediationTimeGateProof.publicEvidencePath
      === "public/evidence/iat-v2/v2-local-time-gate-proof-remediation-20260802T103546Z.json",
  "current remediation local proof boundary drift",
);
check(
  remediationTimeGateProof.reviewedProgramArtifact?.sha256
    === "d01d56161396ce7de28c1ff8c7386bf2fdf1014f6f62935c29106054b0e93e22"
    && remediationTimeGateProof.reviewedProgramArtifact?.bytes === 606320
    && remediationTimeGateProof.reviewedProgramArtifact?.bindingSource
      === "public/audits/iat-v2-remediation-20260802/scope.json",
  "current remediation proof program binding drift",
);
check(
  remediationTimeGateProof.method?.localValidatorTransactionUsed === false
    && remediationTimeGateProof.method?.signingPerformed === false
    && remediationTimeGateProof.method?.simulationForSigningPerformed === false
    && remediationTimeGateProof.method?.broadcastingPerformed === false
    && remediationTimeGateProof.method?.walletAccessed === false
    && remediationTimeGateProof.method?.keyCreated === false,
  "current remediation proof safety boundary drift",
);
check(
  remediationTimeGateProof.observations?.clockCases?.length === 6
    && remediationTimeGateProof.observations?.cccCases?.length === 4
    && remediationTimeGateProof.observations?.recoveryCases?.length === 2
    && remediationTimeGateProof.observations?.neutralRewardCases?.length === 3
    && remediationTimeGateProof.observations?.laneCases?.length === 24
    && remediationTimeGateProof.observations?.positionCase?.maturityWeek === 59,
  "current remediation proof vector set drift",
);
check(
  remediationTimeGateProof.commands?.length === 2
    && remediationTimeGateProof.commands?.every(({ result }) => result === "PASS")
    && remediationTimeGateProof.commands?.reduce((sum, { tests }) => sum + tests, 0) === 22,
  "current remediation proof test result drift",
);
check(
  remediationTimeGateProof.limitations?.some((item) =>
    item.includes("does not replace a fresh finalized Devnet transaction receipt"),
  )
    && remediationTimeGateProof.limitations?.some((item) =>
      item.includes("prior binary"),
    ),
  "current remediation proof must retain honest Devnet limitations",
);

const files = await readdir(root);
for (const required of ["README.md", "CC0-1.0.md", "index.json"]) {
  check(files.includes(required), `missing public evidence companion: ${required}`);
}

if (failures.length) {
  console.error("Public devnet evidence validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  "Public evidence validation passed: fifteen indexed records, 29 historical finalized signatures, current local remediation proof, fresh signed Devnet and independent review required, CC0, no secret-bearing fields, mainnet HOLD.",
);

