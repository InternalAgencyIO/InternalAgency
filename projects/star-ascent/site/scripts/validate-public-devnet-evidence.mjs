#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
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
check(
  index.automatedDirectEvidenceRequired === true
    && index.humanReviewerRequired === false
    && index.noSelfAttestation === true,
  "current remediation source must require automated direct evidence with no human-review prerequisite or self-attestation",
);
check(index.secretMaterialIncluded === false, "secret-material declaration must remain false");
check(Array.isArray(index.records) && index.records.length === 17, "expected seventeen indexed records");
const currentHardeningRecord = index.records?.find(
  ({ file }) => file === "v2-local-time-gate-proof-hardening-20260802T130622Z.json",
);
const currentIdentityD1Record = index.records?.find(
  ({ file }) => file === "v2-local-identity-d1-rehearsal-20260802T194419Z.json",
);
check(
  currentHardeningRecord?.status
    === "CURRENT_VERIFIED_LOCAL_HOST_ONLY_CURRENT_SBF_FRESH_SIGNED_DEVNET_AND_AUTOMATED_DIRECT_EVIDENCE_REQUIRED_MAINNET_HOLD",
  "current hardening record must require automated direct evidence without an independent-review prerequisite",
);
check(
  currentIdentityD1Record?.status
    === "CURRENT_VERIFIED_CREDENTIAL_FREE_LOCAL_MODEL_ONLY_ACTUAL_INTEGRATION_AND_AUTOMATED_DIRECT_EVIDENCE_REQUIRED_MAINNET_HOLD",
  "current identity/D1 record must require automated direct evidence without an independent-review prerequisite",
);
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
    === "b73d2d3ce8572e833b9fdd37df23cd97b40df111"
    && index.currentRemediationState?.localHostProof
      === "v2-local-time-gate-proof-hardening-20260802T130622Z.json"
    && index.currentRemediationState?.localHostProofStatus === "VERIFIED_LOCAL_HOST_ONLY"
    && index.currentRemediationState?.verifiableSbf?.sourceCommit
      === "b73d2d3ce8572e833b9fdd37df23cd97b40df111"
    && index.currentRemediationState?.verifiableSbf?.sha256
      === "d437be9a78aeaa09eeef419554bd0c0598a18239edeb226912c79a973f24d2a4"
    && index.currentRemediationState?.verifiableSbf?.bytes === 579480
    && index.currentRemediationState?.verifiableSbf?.status === "VERIFIED_BUILD_ONLY_NOT_DEPLOYED"
    && index.currentRemediationState?.freshSignedDevnetEvidence === "REQUIRED_NOT_COMPLETE"
    && index.currentRemediationState?.automatedDirectEvidence === "REQUIRED_NOT_COMPLETE"
    && index.currentRemediationState?.mainnetStatus === "HOLD",
  "current remediation evidence boundary drift",
);
check(
  index.currentIdentityHardeningState?.sourceCommit
    === "01b0ccbc5295064c559cb0cfaf1a434feeac23b0"
    && index.currentIdentityHardeningState?.localModelEvidence
      === "v2-local-identity-d1-rehearsal-20260802T194419Z.json"
    && index.currentIdentityHardeningState?.localModelStatus
      === "VERIFIED_CREDENTIAL_FREE_LOCAL_MODEL_ONLY"
    && index.currentIdentityHardeningState?.actualXOAuthAndD1Integration
      === "REQUIRED_NOT_COMPLETE"
    && index.currentIdentityHardeningState?.freshSignedDevnetEvidence
      === "REQUIRED_NOT_COMPLETE"
    && index.currentIdentityHardeningState?.automatedDirectEvidence
      === "REQUIRED_NOT_COMPLETE"
    && index.currentIdentityHardeningState?.mainnetStatus === "HOLD",
  "current identity hardening evidence boundary drift",
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
    path.join(root, "v2-local-time-gate-proof-hardening-20260802T130622Z.json"),
    "utf8",
  ),
);
const identityD1Rehearsal = JSON.parse(
  await readFile(
    path.join(root, "v2-local-identity-d1-rehearsal-20260802T194419Z.json"),
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
  "archival feature sign-off boundary drift",
);
check(
  signoff.evidence?.path === "public/evidence/iat-v2/v2-features-20260801T053340Z.json"
    && signoff.evidence?.sha256 === "7b460bee7a644452c6710cff7a5b81a3a3769a1d2daf4d3813913d7524a9b6f9"
    && signoff.evidence?.transactionCount === 18,
  "archival feature sign-off evidence binding drift",
);
check(
  signoff.chainReceipt?.path === "public/evidence/iat-v2/chain-status-20260801T053947Z.json"
    && signoff.chainReceipt?.sha256 === "0a2e1f8ffeecffaf974e51f2d6e9abe020517a784c5cfa8b9c0f6af1f1efa4ce"
    && signoff.chainReceipt?.signatureCount === 29,
  "archival feature sign-off receipt binding drift",
);
check(
  signoff.verifier?.accountabilityLabel === "FDF Guard"
    && signoff.verifier?.independentOfOperator === true
    && signoff.verifier?.didNotOperateModelT === true
    && Object.values(signoff.checks ?? {}).every((value) => value === true)
    && signoff.exceptions?.length === 0
    && signoff.completedAtUtc === "2026-08-01T05:57:36Z",
  "archival feature sign-off completion drift",
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
      === "public/evidence/iat-v2/v2-local-time-gate-proof-hardening-20260802T130622Z.json"
    && remediationTimeGateProof.sourceBinding?.commit
      === "b73d2d3ce8572e833b9fdd37df23cd97b40df111"
    && remediationTimeGateProof.sourceBinding?.allInputsMatchCommit === true,
  "current remediation local proof boundary drift",
);
check(
  remediationTimeGateProof.reviewedProgramArtifact?.sha256
    === "d437be9a78aeaa09eeef419554bd0c0598a18239edeb226912c79a973f24d2a4"
    && remediationTimeGateProof.reviewedProgramArtifact?.bytes === 579480
    && remediationTimeGateProof.reviewedProgramArtifact?.status
      === "CURRENT_SOURCE_VERIFIABLE_SBF"
    && remediationTimeGateProof.reviewedProgramArtifact?.sourceCommit
      === "b73d2d3ce8572e833b9fdd37df23cd97b40df111"
    && remediationTimeGateProof.reviewedProgramArtifact?.coversCurrentSource === true
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
check(
  identityD1Rehearsal.schema === "iat-v2-local-identity-d1-rehearsal/v1"
    && identityD1Rehearsal.status === "VERIFIED_CREDENTIAL_FREE_LOCAL_MODEL_ONLY"
    && identityD1Rehearsal.network === "local-host"
    && identityD1Rehearsal.mainnetStatus === "HOLD",
  "local identity/D1 rehearsal boundary drift",
);
check(
  identityD1Rehearsal.method?.providerRequestPerformed === false
    && identityD1Rehearsal.method?.cloudflareD1RequestPerformed === false
    && identityD1Rehearsal.method?.credentialMaterialIncluded === false
    && identityD1Rehearsal.method?.personalDataIncluded === false
    && identityD1Rehearsal.method?.walletAccessed === false
    && identityD1Rehearsal.method?.signingPerformed === false
    && identityD1Rehearsal.method?.simulationForSigningPerformed === false
    && identityD1Rehearsal.method?.broadcastingPerformed === false
    && identityD1Rehearsal.method?.networkMutationPerformed === false,
  "local identity/D1 rehearsal safety boundary drift",
);
check(
  identityD1Rehearsal.scenarios?.length === 8
    && identityD1Rehearsal.scenarios?.every(({ result }) => result.startsWith("PASS"))
    && identityD1Rehearsal.validation?.targetedIdentityTests?.passed === 12
    && identityD1Rehearsal.validation?.targetedIdentityTests?.failed === 0
    && identityD1Rehearsal.validation?.checkIatV2?.passed === 65
    && identityD1Rehearsal.validation?.checkIatV2?.failed === 0
    && identityD1Rehearsal.validation?.fullLaunchGates === "PASS_HOLD"
    && identityD1Rehearsal.validation?.productionBuild === "PASS",
  "local identity/D1 rehearsal result set drift",
);
check(
  identityD1Rehearsal.limitations?.some((item) => item.includes("not an actual Cloudflare D1 integration run"))
    && identityD1Rehearsal.limitations?.some((item) => item.includes("not signed Devnet evidence"))
    && identityD1Rehearsal.limitations?.some((item) => item.includes("not independent review")),
  "local identity/D1 rehearsal must retain honest limitations",
);
const identityCommit = identityD1Rehearsal.sourceBinding?.commit;
const git = (...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 50_000_000 }).trim();
check(/^[0-9a-f]{40}$/u.test(identityCommit ?? ""), "identity rehearsal source commit must be a full SHA-1");
check(git("rev-parse", `${identityCommit}^{tree}`) === identityD1Rehearsal.sourceBinding?.gitTree, "identity rehearsal source tree mismatch");
check(git("rev-parse", `${identityCommit}:projects/star-ascent/site/programs/iat_v2`) === identityD1Rehearsal.sourceBinding?.programTree, "identity rehearsal program tree mismatch");
for (const [sourcePath, blob] of Object.entries(identityD1Rehearsal.sourceBinding?.criticalGitBlobs ?? {})) {
  check(git("rev-parse", `${identityCommit}:${sourcePath}`) === blob, `identity rehearsal source blob mismatch: ${sourcePath}`);
}
check(
  identityD1Rehearsal.reviewedProgramArtifact?.sha256
    === "d437be9a78aeaa09eeef419554bd0c0598a18239edeb226912c79a973f24d2a4"
    && identityD1Rehearsal.reviewedProgramArtifact?.bytes === 579480
    && identityD1Rehearsal.reviewedProgramArtifact?.programTreeUnchangedFromReviewedBuild === true
    && identityD1Rehearsal.reviewedProgramArtifact?.freshPinnedRebuildPassed === true
    && identityD1Rehearsal.reviewedProgramArtifact?.lockedRustTests === 23
    && identityD1Rehearsal.reviewedProgramArtifact?.unsafeStackDiagnosticObserved === false
    && identityD1Rehearsal.reviewedProgramArtifact?.programSigningArtifactProduced === false
    && identityD1Rehearsal.reviewedProgramArtifact?.deploymentAuthorized === false,
  "identity rehearsal program artifact boundary drift",
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
  "Public evidence validation passed: seventeen indexed records, 29 historical finalized signatures, current source-bound local proofs and verifiable SBF, actual D1 integration, fresh signed Devnet, and automated direct evidence required without a human-review prerequisite, CC0, no secret-bearing fields, mainnet HOLD.",
);
