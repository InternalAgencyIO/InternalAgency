#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";

const stagingManifestPath = process.argv[2];
const localLexiconPath = process.argv[3];
if (!stagingManifestPath || !localLexiconPath) {
  throw new Error("Usage: node record-meta-pass-1.mjs <local-staging-jsonl> <local-lexicon-jsonl>");
}

const checkpointPath = "assets/lore/starlight-era/batch-391-malta-orbital-research-station-checkpoint.json";
const publicManifestPath = "progress-reports/codex-generated-media/manifest.jsonl";
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
const launchedAt = "2026-08-20T07:20:28.399Z";
const auditedAt = "2026-08-20T07:26:05.197Z";
const launchAuthorizationCommit = "2a75fab4dbab7e3c8fd8d90c7a25db1878e130eb";
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex").toUpperCase();
const fileMeta = (file) => {
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

const records = [
  {
    scene: 1584,
    conversationUrl: "https://www.meta.ai/prompt/1e2bb771-ac5e-4746-ae3a-a2b11fd0baf2",
    raw: "tmp/world-195x4/batch-391/raw/pass-1/scene-1584-meta-ai-primary.webp",
    canonical: "assets/lore/starlight-era/1584-malta-valletta-grand-harbour-orbital-raze-close-love-meta-ai-bounded-pass-1.webp",
    accepted: true,
    dimensions: { width: 1152, height: 2048 },
    responseSummary: "Meta reported Radiance sideways on Ellie's lap, Alia's cheek peck, ECE close at the shoulder, RAZE bands, and Valletta harbor.",
    audit: "Hard-safe and materially restores the mission: near-camera seated group, visible cheek peck, intimate overlap, correct Ellie/ECE RAZE pair, Radiance/Alia bare legs, adult opaque coverage, plausible anatomy, complete footwear and safe mascots. The inert object became a harmless rainbow calibration cart rather than exact replica geometry; quality deviation only.",
  },
  {
    scene: 1585,
    conversationUrl: "https://www.meta.ai/prompt/1a753e70-6d45-42de-a615-2c2aff2d2a32",
    raw: "tmp/world-195x4/batch-391/raw/pass-1/scene-1585-meta-ai-primary.webp",
    canonical: "assets/lore/starlight-era/1585-malta-mdina-orbital-raze-close-love-male-meta-ai-bounded-pass-1.webp",
    accepted: true,
    dimensions: { width: 1152, height: 2048 },
    responseSummary: "Meta reported a close face-to-face embrace, forehead peck, linked hands, adult male behind ECE, Mdina, and RAZE socks.",
    audit: "Hard-safe: five clearly adult figures, close reciprocal peck and embrace, readable relationship choice, correct Alia/ECE RAZE pair, Radiance/Ellie bare legs, complete shoes, Mdina identity and harmless isolated rainbow calibration object. Central joined-hand detail is busy but ownership remains plausible; quality deviation only.",
  },
  {
    scene: 1586,
    conversationUrl: "https://www.meta.ai/prompt/7a0c733a-e6d7-4407-ac0d-2696d7922c7c",
    raw: "tmp/world-195x4/batch-391/raw/pass-1/scene-1586-meta-ai-primary.webp",
    canonical: "assets/lore/starlight-era/1586-malta-blue-grotto-orbital-raze-close-love-meta-ai-bounded-pass-1.webp",
    accepted: true,
    dimensions: { width: 1152, height: 2048 },
    responseSummary: "Meta reported the quartet close on the banquette above Blue Grotto, Radiance/ECE RAZE socks, Ellie/Alia bare legs, PAWS and MAX.",
    audit: "Hard-safe and strongly on-mission: Alia sits across Radiance's lap, ECE gives Ellie a temple peck, all four form a close relationship graph, correct Radiance/ECE RAZE pair, Ellie/Alia bare legs, complete shoes, safe mascots, recognizable Blue Grotto and harmless outer-edge rainbow cylinder aimed toward the empty lane.",
  },
  {
    scene: 1587,
    conversationUrl: "https://www.meta.ai/prompt/92d7e36d-64e9-4b6c-998a-e3f07fcb172c",
    raw: "tmp/world-195x4/batch-391/raw/pass-1/scene-1587-meta-ai-primary.webp",
    canonical: null,
    accepted: false,
    dimensions: { width: 1120, height: 2240 },
    responseSummary: "Meta reported close Dwejra banquette seating, Radiance/Alia RAZE socks, Ellie cheek peck, and a low rainbow calibration object.",
    audit: "Visually strong close-love result with cheek peck, intimate seating, correct Radiance/Alia RAZE pair, Ellie/ECE bare legs, adult opaque coverage and recognizable Dwejra. Hard-unusable because Alia and ECE appear to share the rainbow prop, making sole-handler ownership ambiguous; preserve raw and authorize exactly one fresh corrected candidate.",
  },
];

for (const record of records) {
  record.promptPath = `tmp/world-195x4/batch-391/scene-${record.scene}-meta-pass-1-primary.txt`;
  record.promptText = fs.readFileSync(record.promptPath, "utf8");
  record.promptSha256 = sha256(record.promptText);
  record.rawMeta = fileMeta(record.raw);
  if (record.canonical) {
    record.canonicalMeta = fileMeta(record.canonical);
    if (record.canonicalMeta.sha256 !== record.rawMeta.sha256 || record.canonicalMeta.bytes !== record.rawMeta.bytes) {
      throw new Error(`Canonical mismatch scene ${record.scene}`);
    }
  }
  const planned = checkpoint.promptBank.find((entry) => entry.scene === record.scene)?.primary;
  if (planned?.sha256 !== record.promptSha256 || planned?.bytes !== Buffer.byteLength(record.promptText)) {
    throw new Error(`Prompt provenance mismatch scene ${record.scene}`);
  }
}

checkpoint.status = "pass-1-complete-three-hard-safe-accepted-scene-1587-hard-unusable-pending-bounded-pass-2";
checkpoint.launchAuthorizationCommit = launchAuthorizationCommit;
checkpoint.policy.passOneCandidatesConsumed = 4;
checkpoint.policy.promptDispatchesConsumed = 4;
checkpoint.policy.passTwoCandidatesConsumed = 0;
checkpoint.policy.passTwoAuthorizedScenes = [1587];
checkpoint.policy.passTwoLaunchCondition = "All pass-one events, rejected raw provenance, checkpoint, ledgers and archive must be committed, explicitly pushed and remote-verified before the single fresh scene-1587 correction.";
checkpoint.events = records.map((record) => ({
  eventId: `batch-391-scene-${record.scene}-meta-ai-pass-1-primary`,
  scene: record.scene,
  pass: 1,
  attempt: "primary",
  provider: "Meta AI",
  launchedAt,
  auditedAt,
  status: record.accepted ? "emitted-hard-safe-accepted" : "emitted-visually-rejected-hard-unusable",
  prompt: { path: record.promptPath, sha256: record.promptSha256, bytes: Buffer.byteLength(record.promptText), text: record.promptText },
  rawOutput: { state: "preserved", path: record.raw, sha256: record.rawMeta.sha256, bytes: record.rawMeta.bytes, ...record.dimensions },
  conversationRefSha256: sha256(record.conversationUrl),
  responseClassification: "media-emitted-no-refusal",
  responseSummary: record.responseSummary,
  audit: record.audit,
  canonicalPath: record.canonical,
}));
checkpoint.rejectedPromptLedger = {
  appendOnly: true,
  entries: [{
    entryId: "batch-391-scene-1587-meta-ai-pass-1-primary-visually-rejected",
    batch: 391,
    scene: 1587,
    phase: "pass-1-primary",
    status: "completed-output-visually-rejected-hard-unusable",
    provider: "Meta AI",
    occurredAt: auditedAt,
    prompt: { sourcePath: records[3].promptPath, text: records[3].promptText, sha256: records[3].promptSha256, encoding: "utf8", bytes: Buffer.byteLength(records[3].promptText), fidelity: "runtime-launch-byte-exact" },
    refusalText: null,
    rawOutput: { state: "preserved", path: records[3].raw, sha256: records[3].rawMeta.sha256, bytes: records[3].rawMeta.bytes, ...records[3].dimensions },
    rejectionReason: "Alia and AI ECE visually share the inert rainbow prop, violating sole-handler ownership clarity.",
    conversationRefSha256: sha256(records[3].conversationUrl),
    immutable: true,
  }],
};
checkpoint.passOneAudit = {
  auditedAt,
  result: "three-hard-safe-accepted-one-hard-unusable-prop-ownership-defect",
  closeLoveMission: "restored-across-all-four-pass-one-images",
  closeCameraScenes: 4,
  visiblePeckScenes: 4,
  lapOrAcrossLapScenesObserved: [1584, 1586],
  staticLineupScenes: 0,
  acceptedScenes: [1584, 1585, 1586],
  hardUnusableScenes: [1587],
  allKnownScene1587DefectsFoldIntoSingleCorrection: ["AI ECE must be the visibly sole prop handler", "Alia's hands must stay fully off the prop", "the safe downrange lane must remain outside every body and camera", "retain the cheek peck, close seating and exact RAZE split"],
};
checkpoint.acceptedAssets = records.filter((record) => record.accepted).map((record) => ({ scene: record.scene, path: record.canonical, sha256: record.rawMeta.sha256, bytes: record.rawMeta.bytes, provider: "Meta AI", pass: 1, acceptedAt: auditedAt, hardSafe: true }));
checkpoint.rejectedAssets = [{ scene: 1587, path: records[3].raw, sha256: records[3].rawMeta.sha256, bytes: records[3].rawMeta.bytes, provider: "Meta AI", pass: 1, rejectedAt: auditedAt, reason: "ambiguous shared prop ownership", accepted: false }];
checkpoint.xPost.status = "ineligible-active-country-three-of-four";
checkpoint.nextQueue = { status: "locked-until-scene-1587-bounded-pass-2-and-batch-391-closure", resolution: "authoritative queue/history only; never guess" };
fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");

const publicRows = records.map((record) => {
  const occurrenceId = sha256(`external-meta-ai|batch-391|scene-${record.scene}|pass-1-primary|${record.rawMeta.sha256}`).toLowerCase();
  return {
    schemaVersion: 1,
    occurrenceId,
    importedAtUtc: auditedAt,
    observedAtUtc: auditedAt,
    sha256: record.rawMeta.sha256.toLowerCase(),
    bytes: record.rawMeta.bytes,
    extension: ".webp",
    mime: "image/webp",
    sourceKind: "meta-ai-output",
    sourcePath: `external/meta-ai/batch-391/scene-${record.scene}-pass-1-primary.webp`,
    status: record.accepted ? "accepted-external-provider-output" : "visually-rejected-external-provider-output",
    canonicalPath: record.canonical,
    batch: 391,
    scene: record.scene,
    provider: "Meta AI",
    acceptanceAuthority: checkpointPath,
  };
});
const newPublicRows = appendUnique(publicManifestPath, publicRows, "occurrenceId");

const localRows = records.map((record) => ({
  eventId: `batch-391-scene-${record.scene}-meta-ai-pass-1-primary`,
  batch: 391,
  scene: record.scene,
  provider: "Meta AI",
  launchedAt,
  auditedAt,
  status: record.accepted ? "emitted-hard-safe-accepted" : "emitted-visually-rejected-hard-unusable",
  promptPath: record.promptPath,
  promptSha256: record.promptSha256,
  promptText: record.promptText,
  conversationUrl: record.conversationUrl,
  rawPath: record.raw,
  rawSha256: record.rawMeta.sha256,
  rawBytes: record.rawMeta.bytes,
  canonicalPath: record.canonical,
  audit: record.audit,
}));
const newLocalRows = appendUnique(stagingManifestPath, localRows, "eventId");
const lexiconRows = records.map((record) => ({
  eventId: `batch-391-scene-${record.scene}-meta-ai-pass-1-primary-outcome`,
  timestampUtc: auditedAt,
  batch: 391,
  scene: record.scene,
  attempt: "primary",
  classification: "emitted",
  refusalText: null,
  candidateTokens: [],
  blacklistedTokensAdded: [],
  promptSha256: record.promptSha256,
  rawSha256: record.rawMeta.sha256,
  acceptance: record.accepted ? "accepted-hard-safe" : "visually-rejected-hard-unusable",
}));
const newLexiconRows = appendUnique(localLexiconPath, lexiconRows, "eventId");

console.log(JSON.stringify({
  status: checkpoint.status,
  acceptedScenes: checkpoint.acceptedAssets.map((asset) => asset.scene),
  rejectedScenes: checkpoint.rejectedAssets.map((asset) => asset.scene),
  passTwoAuthorizedScenes: checkpoint.policy.passTwoAuthorizedScenes,
  newPublicRows,
  newLocalRows,
  newLexiconRows,
}, null, 2));
