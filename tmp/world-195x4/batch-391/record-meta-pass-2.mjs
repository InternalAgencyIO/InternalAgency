#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";

const stagingManifestPath = process.argv[2];
const localLexiconPath = process.argv[3];
if (!stagingManifestPath || !localLexiconPath) {
  throw new Error("Usage: node record-meta-pass-2.mjs <local-staging-jsonl> <local-lexicon-jsonl>");
}

const checkpointPath = "assets/lore/starlight-era/batch-391-malta-orbital-research-station-checkpoint.json";
const publicManifestPath = "progress-reports/codex-generated-media/manifest.jsonl";
const promptPath = "tmp/world-195x4/batch-391/scene-1587-meta-pass-2-correction.txt";
const rawPath = "tmp/world-195x4/batch-391/raw/pass-2/scene-1587-meta-ai-correction.webp";
const canonicalPath = "assets/lore/starlight-era/1587-malta-dwejra-orbital-raze-close-love-meta-ai-bounded-pass-2.webp";
const conversationUrl = "https://www.meta.ai/prompt/5378671f-233c-49eb-aab7-f80a8cef656e";
const launchedAt = "2026-08-20T07:47:45.975Z";
const auditedAt = "2026-08-20T07:49:16.754Z";
const authorizationCommit = "d67020ac1c61b93c58d087c94d69a4dcaf3de06c";
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex").toUpperCase();
const meta = (file) => {
  const bytes = fs.readFileSync(file);
  return { path: file, sha256: sha256(bytes), bytes: bytes.length };
};
const appendUnique = (file, rows, key) => {
  const existingText = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  const existing = existingText.trim() ? existingText.trimEnd().split(/\r?\n/).map((line) => JSON.parse(line)) : [];
  const seen = new Set(existing.map((row) => row[key]));
  const additions = rows.filter((row) => !seen.has(row[key]));
  if (additions.length) {
    const prefix = existingText && !existingText.endsWith("\n") ? "\n" : "";
    fs.appendFileSync(file, `${prefix}${additions.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf8");
  }
  return additions.length;
};

const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
const alreadyRecorded = checkpoint.policy?.passTwoCandidatesConsumed === 1
  && checkpoint.events?.some((entry) => entry.eventId === "batch-391-scene-1587-meta-ai-pass-2-correction");
const launchAuthorized = checkpoint.policy?.passTwoCandidatesConsumed === 0
  && checkpoint.policy?.passTwoAuthorizedScenes?.join() === "1587";
if (checkpoint.policy?.passOneCandidatesConsumed !== 4 || (!launchAuthorized && !alreadyRecorded)) {
  throw new Error("Checkpoint does not authorize the bounded Scene 1587 correction");
}
const promptText = fs.readFileSync(promptPath, "utf8");
const promptSha256 = sha256(promptText);
if (promptSha256 !== "71386F0637CB71B0F024C5B2388B1FFDC5E460B13DC1141C5A3684A350960F18") {
  throw new Error(`Correction prompt SHA mismatch: ${promptSha256}`);
}
const raw = meta(rawPath);
const canonical = meta(canonicalPath);
if (raw.sha256 !== "A92FFBF6747031FD2A72DC523043345295C8684BDB2B692316AB085F1D462CCD" || raw.bytes !== 526784) {
  throw new Error("Correction raw provenance mismatch");
}
if (canonical.sha256 !== raw.sha256 || canonical.bytes !== raw.bytes) throw new Error("Correction canonical mismatch");

const event = {
  eventId: "batch-391-scene-1587-meta-ai-pass-2-correction",
  scene: 1587,
  pass: 2,
  attempt: "single-fresh-holistic-correction",
  provider: "Meta AI",
  authorizationCommit,
  launchedAt,
  auditedAt,
  status: "emitted-hard-safe-accepted",
  prompt: { path: promptPath, text: promptText, sha256: promptSha256, bytes: Buffer.byteLength(promptText), fidelity: "runtime-launch-byte-exact" },
  rawOutput: { state: "preserved", path: rawPath, sha256: raw.sha256, bytes: raw.bytes, width: 1120, height: 2240 },
  conversationRefSha256: sha256(conversationUrl),
  responseClassification: "media-emitted-no-refusal",
  responseSummary: "Meta reported the Dwejra banquette, Radiance/Ellie cheek peck, Alia and Radiance in RAZE socks, Ellie/ECE bare legs, and ECE alone on the outer-edge calibration replica.",
  audit: "Hard-safe accepted. Four clearly adult women remain close and emotionally active; Ellie's cheek peck to Radiance is unmistakable, Alia joins the affectionate hand chain, and ECE stays inches away with an inviting gaze. Radiance/Alia wear the RAZE knee-highs; Ellie/ECE are bare-legged. Complete footwear, opaque coverage and Dwejra identity are readable. The harmless rainbow calibration panel is isolated at ECE's outer edge with no Alia contact or unsafe line. Minor hidden-grip geometry is a quality deviation, not a hard defect.",
  canonicalPath,
};
if (!checkpoint.events.some((entry) => entry.eventId === event.eventId)) checkpoint.events.push(event);

checkpoint.status = "complete-four-of-four-hard-safe-meta-ai-bounded-pass-2-accepted-no-more-malta-rendering";
checkpoint.policy.promptDispatchesConsumed = 5;
checkpoint.policy.passTwoCandidatesConsumed = 1;
checkpoint.policy.passTwoAuthorizedScenes = [];
checkpoint.policy.passTwoClosed = true;
checkpoint.policy.thirdPassAllowed = false;
checkpoint.passTwoCorrectionPlan = {
  scene: 1587,
  authorizationCommit,
  remoteVerifiedBeforeLaunch: true,
  sourceMode: "single fresh candidate from established adult faces; not an edit of the rejected raw",
  prompt: { path: promptPath, sha256: promptSha256, bytes: Buffer.byteLength(promptText), chars: promptText.length, suppressedTokenCheck: "passed-current-run-blacklist" },
  hardDefectsAddressed: ["ECE visually sole at the prop edge", "Alia fully separated from the prop", "safe outer-edge downrange lane", "close peck and exact RAZE split retained"],
  result: "hard-safe-accepted",
  noFurtherPass: true,
};
checkpoint.acceptedAssets = checkpoint.acceptedAssets.filter((asset) => asset.scene !== 1587);
checkpoint.acceptedAssets.push({ scene: 1587, path: canonicalPath, sha256: raw.sha256, bytes: raw.bytes, provider: "Meta AI", pass: 2, acceptedAt: auditedAt, hardSafe: true });
checkpoint.acceptedAssets.sort((a, b) => a.scene - b.scene);
checkpoint.countryClosure = {
  closedAt: auditedAt,
  acceptedSceneCount: 4,
  acceptedScenes: [1584, 1585, 1586, 1587],
  passOneCandidatesConsumed: 4,
  passTwoCandidatesConsumed: 1,
  totalProviderDispatches: 5,
  refusals: 0,
  preservedVisualRejects: [1587],
  closeLoveMission: "restored",
  noThirdPass: true,
};
checkpoint.xPost = { status: "eligible-pending-live-reconciliation-no-publication-attempted", caption: "Malta ❤️ Montenegro #Malta #WorldXXXSeries", url: null, minimumAcceptedAssets: 4, acceptedAssets: 4 };
checkpoint.nextQueue = {
  nextCountry: "Maldives",
  nextBatch: 392,
  sceneNumbers: [1588, 1589, 1590, 1591],
  cinematicTheme: "orbital research-station couture",
  themePairPosition: 2,
  countryEvidence: ["assets/lore/starlight-era/world-195x4-campaign.json#/countryPriorityOrder/166"],
  themeEvidence: ["assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json#/cinematicThemeRotation/orderedThemes/9"],
  lockedUntilBatch391Closed: false,
  materializationAllowedAfterRemoteVerifiedBatch391Closure: true,
};
fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");

const occurrenceId = sha256(`external-meta-ai|batch-391|scene-1587|pass-2-correction|${raw.sha256}`).toLowerCase();
const publicRow = {
  schemaVersion: 1,
  occurrenceId,
  importedAtUtc: auditedAt,
  observedAtUtc: auditedAt,
  sha256: raw.sha256.toLowerCase(),
  bytes: raw.bytes,
  extension: ".webp",
  mime: "image/webp",
  sourceKind: "meta-ai-output",
  sourcePath: "external/meta-ai/batch-391/scene-1587-pass-2-correction.webp",
  status: "accepted-external-provider-output",
  canonicalPath,
  batch: 391,
  scene: 1587,
  provider: "Meta AI",
  acceptanceAuthority: checkpointPath,
};
const newPublicRows = appendUnique(publicManifestPath, [publicRow], "occurrenceId");
const localRow = {
  eventId: event.eventId,
  batch: 391,
  scene: 1587,
  provider: "Meta AI",
  launchedAt,
  auditedAt,
  status: "emitted-hard-safe-accepted",
  promptPath,
  promptSha256,
  promptText,
  conversationUrl,
  rawPath,
  rawSha256: raw.sha256,
  rawBytes: raw.bytes,
  canonicalPath,
  audit: event.audit,
};
const newLocalRows = appendUnique(stagingManifestPath, [localRow], "eventId");
const lexiconRow = {
  eventId: "batch-391-scene-1587-meta-ai-pass-2-correction-outcome",
  timestampUtc: auditedAt,
  batch: 391,
  scene: 1587,
  attempt: "pass-2-correction",
  classification: "emitted",
  refusalText: null,
  candidateTokens: [],
  blacklistedTokensAdded: [],
  promptSha256,
  rawSha256: raw.sha256,
  acceptance: "accepted-hard-safe",
};
const newLexiconRows = appendUnique(localLexiconPath, [lexiconRow], "eventId");

console.log(JSON.stringify({
  status: checkpoint.status,
  acceptedScenes: checkpoint.acceptedAssets.map((asset) => asset.scene),
  correctionRaw: raw,
  nextQueue: checkpoint.nextQueue,
  newPublicRows,
  newLocalRows,
  newLexiconRows,
}, null, 2));
