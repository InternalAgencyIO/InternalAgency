#!/usr/bin/env node

import { appendFileSync, existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

const root = process.cwd();
const checkpointRelative = "assets/lore/starlight-era/batch-389-suriname-polar-airship-checkpoint.json";
const checkpointPath = path.join(root, checkpointRelative);
const manifestRelative = "progress-reports/codex-generated-media/manifest.jsonl";
const manifestPath = path.join(root, manifestRelative);
const submittedAt = "2026-08-20T05:48:39.789Z";
const recordedAt = "2026-08-20T06:01:13.0289304Z";
const parentCommit = "ae1e0b79ff8aaccadf874c204a4528812093b918";

const sceneRecords = {
  1576: {
    conversationUrl: "https://www.meta.ai/prompt/26738af4-298e-4aff-9b23-27ffb9c784f5",
    promptSha256: "A4264AC88731EB7782216E84E15A3F6056C7B44E66DE1599BA1C49274CDF3956",
    promptBytes: 2943,
    rawPath: "tmp/world-195x4/batch-389/raw/pass-2/scene-1576-meta-ai-primary.webp",
    file: "assets/lore/starlight-era/1576-suriname-waterkant-polar-airship-meta-ai-bounded-pass-2.webp",
    sha256: "C8AD0FC4954366FFED1BF37F64028A076FE8101D5CA6F4D506F9CF909E459C5E",
    bytes: 573584,
    hardGateAudit: "four clearly adult role-anchored women; secure opaque public-safe fashion; complete plausible gross anatomy and footwear; PAWS and MAX protected on the lounge; the rainbow object is visibly a harmless non-weapon cinema viewfinder frame held by the isolated handler with a complete target/backstop lane and no person, animal, camera, threat, firing, or combat in its path; valid media",
  },
  1577: {
    conversationUrl: "https://www.meta.ai/prompt/f6dfd910-5d73-4428-bdbd-fa6a5bd4c6fc",
    promptSha256: "8076E4A68B1F09FA47CA9A7647A3CCFB1412EAA86596AD7217AE4B2EF98C7283",
    promptBytes: 2789,
    rawPath: "tmp/world-195x4/batch-389/raw/pass-2/scene-1577-meta-ai-primary.webp",
    file: "assets/lore/starlight-era/1577-suriname-brownsberg-brokopondo-polar-airship-meta-ai-bounded-pass-2.webp",
    sha256: "9EFCC0AE31B34F8ED949F0E496E813E92D91A07532A2B881BEDD87952E3CC80D",
    bytes: 506098,
    hardGateAudit: "four clearly adult role-anchored women; secure opaque public-safe fashion; complete plausible gross anatomy and footwear; mascots protected on the lounge; the rainbow object is visibly a harmless non-weapon cinema viewfinder frame isolated beside a complete target/backstop lane with no unsafe aim, threat, firing, or combat; valid media",
  },
  1578: {
    conversationUrl: "https://www.meta.ai/prompt/7bc52723-52b5-4856-8cab-09df15705a67",
    promptSha256: "2A5296DB5AF8AE478EF38E5C9C4E53AD84001262414A8E5AEC46F3465AD60D92",
    promptBytes: 2851,
    rawPath: "tmp/world-195x4/batch-389/raw/pass-2/scene-1578-meta-ai-primary.webp",
    file: "assets/lore/starlight-era/1578-suriname-voltzberg-raleigh-falls-polar-airship-meta-ai-bounded-pass-2.webp",
    sha256: "E6DE05F4A27466A8541442ED26727093BE12CB9EFF959C37BFCDF404D04EDF96",
    bytes: 610368,
    hardGateAudit: "four clearly adult role-anchored women; secure opaque public-safe fashion; complete plausible gross anatomy and footwear; mascots remain safely outside the lane; the rainbow object is visibly a harmless non-weapon cinema viewfinder/calibration frame, the complete target/backstop lane is present, and there is no unsafe aim, threat, firing, or combat; valid media",
  },
  1579: {
    conversationUrl: "https://www.meta.ai/prompt/2a9ffddd-8fcd-41d0-a506-12f0ceba35cd",
    promptSha256: "644A78B36E06946CD779B94EC4395E02AD435AEFE7C7A9436272968474579E00",
    promptBytes: 3056,
    rawPath: "tmp/world-195x4/batch-389/raw/pass-2/scene-1579-meta-ai-primary.webp",
    file: "assets/lore/starlight-era/1579-suriname-galibi-polar-airship-male-meta-ai-bounded-pass-2.webp",
    sha256: "37E14265B5209AE9F8FCF6DCD738072D04F3B801624F38029F9E36B580DA4757",
    bytes: 649630,
    hardGateAudit: "four clearly adult role-anchored women plus the clearly adult bearded man; secure opaque public-safe fashion; complete plausible gross anatomy and footwear; MAX protected on the lounge; the rainbow object is visibly a harmless non-weapon calibration panel isolated beside a complete target/backstop lane with no unsafe aim, threat, firing, or combat; valid media",
  },
};

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex").toUpperCase();
}

function verifyFile(relativePath, digest, bytes) {
  const absolute = path.join(root, relativePath);
  if (!existsSync(absolute)) throw new Error(`Missing file: ${relativePath}`);
  const buffer = readFileSync(absolute);
  if (buffer.length !== bytes || sha256(buffer) !== digest) throw new Error(`File provenance mismatch: ${relativePath}`);
}

const checkpoint = JSON.parse(readFileSync(checkpointPath, "utf8"));
if (checkpoint.batch !== 389 || checkpoint.country !== "Suriname") throw new Error("Unexpected checkpoint identity");
if (checkpoint.providerPolicy?.status !== "meta-ai-only") throw new Error("Meta AI-only provider policy is not active");
if (checkpoint.renderPasses?.pass2?.status === "completed-four-hard-safe-meta-ai-primary-no-fallbacks") {
  console.log(JSON.stringify({ mode: "already-recorded", checkpoint: checkpointRelative }, null, 2));
  process.exit(0);
}
if (checkpoint.renderPasses?.pass2?.candidatesConsumed !== 0) throw new Error("Pass 2 has unexpected prior consumption");

for (const [scene, record] of Object.entries(sceneRecords)) {
  verifyFile(record.rawPath, record.sha256, record.bytes);
  verifyFile(record.file, record.sha256, record.bytes);
  const promptRecord = checkpoint.renderPasses.pass2.prompts?.[scene]?.primary;
  if (promptRecord?.sha256 !== record.promptSha256 || promptRecord?.bytes !== record.promptBytes) throw new Error(`Prompt checkpoint mismatch: ${scene}`);
  verifyFile(promptRecord.path, record.promptSha256, record.promptBytes);
}

const events = Object.entries(sceneRecords).map(([sceneText, record]) => ({
  scene: Number(sceneText),
  provider: "Meta AI",
  providerConversationUrl: record.conversationUrl,
  submittedAt,
  terminalObservedBy: recordedAt,
  status: "completed-hard-safe-accepted",
  dispatchMode: "text-only-primary-after-upload-failure",
  fallbackUsed: false,
  refusalObserved: false,
  promptPath: checkpoint.renderPasses.pass2.prompts[sceneText].primary.path,
  promptSha256: record.promptSha256,
  promptBytes: record.promptBytes,
  rawPath: record.rawPath,
  rawSha256: record.sha256,
  rawBytes: record.bytes,
  dimensions: [1152, 2048],
  identityAnchorMode: "text-only role anchors; upload failed before dispatch and no reference file was transmitted",
  hardGateAudit: record.hardGateAudit,
  acceptedAsset: record.file,
}));

checkpoint.status = "complete-four-of-four-hard-safe-meta-ai-pass-2-accepted-no-more-suriname-rendering";
checkpoint.closureParentCommit = parentCommit;
checkpoint.policy.pass2CandidatesConsumed = 4;
checkpoint.renderPasses.pass2 = {
  ...checkpoint.renderPasses.pass2,
  status: "completed-four-hard-safe-meta-ai-primary-no-fallbacks",
  candidatesConsumed: 4,
  events,
  holisticAudit: {
    status: "complete-once-after-all-four-terminal",
    hardSafeAcceptedScenes: [1576, 1577, 1578, 1579],
    hardUnusableScenes: [],
    preliminaryIntakeNote: "Scene 1578 received a preliminary per-output safety flag before the bank completed. The single authoritative holistic audit determined that its object is visibly a harmless non-weapon cinema viewfinder/calibration frame with a complete safety lane; the preliminary flag remains in the local staging trail but is superseded and did not trigger a render.",
    qualityVariancesNotRenderTriggers: [
      "text-only role anchoring after upload failure",
      "viewfinder/frame geometry differs from the exact prop target",
      "mascot species or styling varies in some scenes",
      "fine garment and Suriname motif fidelity varies",
    ],
    thirdPassAllowed: false,
  },
  thirdPassAllowed: false,
};
checkpoint.metaAiBrowserAudit = {
  provider: "Meta AI only",
  primaryBankSubmittedAt: submittedAt,
  exactConcurrentScenes: [1576, 1577, 1578, 1579],
  primaryNonRefusalCount: 4,
  fallbackRetryCount: 0,
  refusalCount: 0,
  currentBlacklistedTokens: [],
  uploadState: "multi-file attachment attempt failed before dispatch; all four scenes continued text-only",
  sensitiveUnrelatedAssetHandling: "One stale unrelated page asset was exported during media acquisition, recognized as containing personal receipt details, excluded from public raw preservation, and recorded only through sanitized manifest provenance. No personal text, local path, or remote asset URL is published.",
  noBypassTactics: true,
};
checkpoint.acceptedAssets = Object.entries(sceneRecords).map(([sceneText, record]) => ({
  scene: Number(sceneText),
  file: record.file,
  rawPath: record.rawPath,
  sha256: record.sha256,
  bytes: record.bytes,
  dimensions: [1152, 2048],
  provider: "Meta AI",
  acceptance: "bounded-hard-safe-meta-ai-pass-2",
}));
checkpoint.hardSafeAcceptedCount = 4;
checkpoint.missingSceneNumbers = [];
checkpoint.xPost.status = "eligible-pending-live-duplicate-reconciliation-and-publication";
checkpoint.nextQueue.lockedUntilBatch389Closed = false;
checkpoint.nextQueue.materializationAllowedAfterRemoteVerifiedBatch389Closure = true;

writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");

const existingManifest = readFileSync(manifestPath, "utf8");
const existingIds = new Set(existingManifest.trimEnd().split(/\n/).filter(Boolean).map((line) => JSON.parse(line).occurrenceId));
const newRows = [];
for (const [sceneText, record] of Object.entries(sceneRecords)) {
  const sourceKind = "meta-ai-output";
  const sourcePath = `external/meta-ai/batch-389/scene-${sceneText}-primary.webp`;
  const digest = record.sha256.toLowerCase();
  const occurrenceId = createHash("sha256").update(`${sourceKind}\0${sourcePath}\0${digest}`).digest("hex");
  if (existingIds.has(occurrenceId)) continue;
  newRows.push({
    schemaVersion: 1,
    occurrenceId,
    importedAtUtc: recordedAt,
    observedAtUtc: recordedAt,
    sha256: digest,
    bytes: record.bytes,
    extension: ".webp",
    mime: "image/webp",
    sourceKind,
    sourcePath,
    status: "external-provider-output",
    canonicalPath: record.file,
    batch: 389,
    scene: Number(sceneText),
    provider: "Meta AI",
    acceptanceAuthority: checkpointRelative,
  });
}
if (newRows.length) appendFileSync(manifestPath, `${newRows.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf8");

console.log(JSON.stringify({
  mode: "recorded",
  checkpoint: checkpointRelative,
  status: checkpoint.status,
  acceptedScenes: checkpoint.acceptedAssets.map((asset) => asset.scene),
  hardSafeAcceptedCount: checkpoint.hardSafeAcceptedCount,
  newExternalManifestRows: newRows.length,
  nextQueue: checkpoint.nextQueue,
}, null, 2));
