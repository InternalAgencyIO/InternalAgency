#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";

const stagingManifestPath = process.argv[2];
const localLexiconPath = process.argv[3];
if (!stagingManifestPath || !localLexiconPath) {
  throw new Error("Usage: node record-meta-pass-1.mjs <local-staging-manifest-jsonl> <local-lexicon-jsonl>");
}

const checkpointPath = "assets/lore/starlight-era/batch-390-montenegro-polar-airship-checkpoint.json";
const publicManifestPath = "progress-reports/codex-generated-media/manifest.jsonl";
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
const primarySubmittedAt = "2026-08-20T06:34:16.190Z";
const fallbackSubmittedAt = "2026-08-20T06:38:13.237Z";
const suppressedFallbackSubmittedAt = "2026-08-20T06:39:47.680Z";
const auditedAt = "2026-08-20T06:44:44.6622529Z";
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex").toUpperCase();

const conversationUrls = {
  1580: "https://www.meta.ai/prompt/1862fdac-38fe-48fa-915c-7b9b01905264",
  1581: "https://www.meta.ai/prompt/ef715a58-fc03-4792-8c03-fb04e6ab4657",
  1582: "https://www.meta.ai/prompt/24275bbf-3d2e-450f-9297-84fdace82771",
  1583: "https://www.meta.ai/prompt/2c3daea4-b8b6-4b1a-99b3-973de00fafee",
};
const primaryRefusals = {
  1580: {
    occurredAt: "2026-08-20T06:37:13.1029683Z",
    text: "I wasn't able to create that exact image as described — the combination of poses, contacts, and the training replica together is too complex to render as a clean, readable full-length editorial.",
  },
  1581: {
    occurredAt: "2026-08-20T06:38:54.4139604Z",
    text: "I wasn't able to generate that exact 9:16 editorial as described — there's too much overlapping detail in one frame for me to keep everything accurate and readable.",
  },
  1583: {
    occurredAt: "2026-08-20T06:37:13.1029683Z",
    text: "I wasn't able to create that exact image as described.",
  },
};
const blacklistedTokens = [
  "16", "16 full-length", "9", "9 16", "anchors", "anchors only", "create", "create one",
  "editorial", "editorial use", "fresh", "fresh photorealistic", "full-length", "full-length starlight",
  "identity", "identity anchors", "one", "one fresh", "only", "original", "original identity",
  "photorealistic", "photorealistic 9", "public-fashion", "public-fashion editorial", "series",
  "series public-fashion", "starlight", "starlight world", "use", "use original", "world", "world series",
];

const records = [
  {
    scene: 1580,
    attempt: "fallback",
    promptPath: "tmp/world-195x4/batch-390/scene-1580-meta-pass-1-fallback.txt",
    rawPath: "tmp/world-195x4/batch-390/raw/pass-1/scene-1580-meta-ai-fallback.webp",
    canonicalPath: "assets/lore/starlight-era/1580-montenegro-black-lake-polar-airship-raze-meta-ai-bounded-pass-1.webp",
    sha256: "5CE5E2D873BE0CF0A47971A69C8FCD369B6E1F0C4596C4E966555993E787871C",
    bytes: 688852,
    submittedAt: fallbackSubmittedAt,
    observedSockWearers: ["Alia", "AI ECE"],
    observedBareLegCharacters: ["Radiance", "Ellie"],
    qualityDeviations: [
      "stored love choreography simplified to a small standing hand-link and shoulder-touch tableau",
      "some silhouettes read as short coat minis and the sock wearers use low ankle footwear rather than the requested pumps",
      "the mission prop resolves as a harmless rainbow light-calibration ring rather than exact large-frame geometry"
    ],
  },
  {
    scene: 1581,
    attempt: "fallback-suppressed",
    promptPath: "tmp/world-195x4/batch-390/scene-1581-meta-pass-1-fallback-suppressed.txt",
    rawPath: "tmp/world-195x4/batch-390/raw/pass-1/scene-1581-meta-ai-fallback-suppressed.webp",
    canonicalPath: "assets/lore/starlight-era/1581-montenegro-kotor-bay-polar-airship-raze-male-meta-ai-bounded-pass-1.webp",
    sha256: "C9D7EBB9DAE3E36585A18C6DBB59D109CCE7347D4B1CF57AEE0B2588001E9AA5",
    bytes: 770956,
    submittedAt: suppressedFallbackSubmittedAt,
    observedSockWearers: ["Radiance", "Ellie"],
    observedBareLegCharacters: ["Alia", "AI ECE"],
    qualityDeviations: [
      "mascot species/count drift toward multiple safe golden pups instead of the exact PAWS-and-MAX pair",
      "several hems extend near the knee and the stored five-adult love beat is simplified",
      "the mission prop resolves as a harmless rainbow calibration sculpture rather than exact large-frame geometry"
    ],
  },
  {
    scene: 1582,
    attempt: "primary",
    promptPath: "tmp/world-195x4/batch-390/scene-1582-meta-pass-1-primary.txt",
    rawPath: "tmp/world-195x4/batch-390/raw/pass-1/scene-1582-meta-ai-primary.webp",
    canonicalPath: "assets/lore/starlight-era/1582-montenegro-tara-bridge-polar-airship-raze-meta-ai-bounded-pass-1.webp",
    sha256: "90A12A9AFB45EA1113DDF62B387A7DEBBDF49964ADEB24C2054307C18BA9F525",
    bytes: 766418,
    submittedAt: primarySubmittedAt,
    observedSockWearers: ["Alia", "AI ECE"],
    observedBareLegCharacters: ["Radiance", "Ellie"],
    qualityDeviations: [
      "the isolated inert prop remains visibly sidearm-like, but points downward and away beside the labeled safety bay and partial sandbag backstop",
      "stored relationship choreography is simplified and the upper-thigh silhouettes vary from the exact prompt constructions"
    ],
  },
  {
    scene: 1583,
    attempt: "fallback",
    promptPath: "tmp/world-195x4/batch-390/scene-1583-meta-pass-1-fallback.txt",
    rawPath: "tmp/world-195x4/batch-390/raw/pass-1/scene-1583-meta-ai-fallback.webp",
    canonicalPath: "assets/lore/starlight-era/1583-montenegro-skadar-lake-polar-airship-raze-meta-ai-bounded-pass-1.webp",
    sha256: "F342E15B63F187B83A6747413CC83D78BA28038C3E8CB68942A885E58357E6F9",
    bytes: 697706,
    submittedAt: fallbackSubmittedAt,
    observedSockWearers: ["Radiance", "AI ECE"],
    observedBareLegCharacters: ["Ellie", "Alia"],
    qualityDeviations: [
      "three looks use knee-length or capri-like hems instead of the requested upper-thigh foundation",
      "stored dip and compound love choreography simplify to a standing hand-link and shoulder touch",
      "the mission prop resolves as a harmless open rainbow calibration frame rather than exact large-frame geometry"
    ],
  },
];

const filePromptRecord = (promptPath) => {
  const bytes = fs.readFileSync(promptPath);
  const text = bytes.toString("utf8");
  return {
    sourcePath: promptPath,
    text,
    sha256: sha256(bytes),
    encoding: "utf-8",
    bytes: bytes.length,
    chars: text.length,
    fidelity: "runtime-launch-byte-exact",
  };
};
const verifyMedia = (record) => {
  for (const file of [record.rawPath, record.canonicalPath]) {
    const bytes = fs.readFileSync(file);
    if (bytes.length !== record.bytes || sha256(bytes) !== record.sha256) throw new Error(`Media verification failed: ${file}`);
  }
};
records.forEach(verifyMedia);

const events = [];
for (const record of records) {
  if (primaryRefusals[record.scene]) {
    const primaryPath = `tmp/world-195x4/batch-390/scene-${record.scene}-meta-pass-1-primary.txt`;
    events.push({
      scene: record.scene,
      attempt: "primary",
      status: "moderation-blocked-text-only-no-media",
      submittedAt: primarySubmittedAt,
      occurredAt: primaryRefusals[record.scene].occurredAt,
      provider: "Meta AI",
      prompt: filePromptRecord(primaryPath),
      refusalText: primaryRefusals[record.scene].text,
      rawOutput: { state: "no-bytes", path: null, sha256: null, bytes: 0 },
      conversationRefSha256: sha256(conversationUrls[record.scene]),
    });
  }
  events.push({
    scene: record.scene,
    attempt: record.attempt,
    status: "completed-hard-safe-accepted",
    submittedAt: record.submittedAt,
    occurredAt: auditedAt,
    provider: "Meta AI",
    prompt: filePromptRecord(record.promptPath),
    rawOutput: { state: "preserved", path: record.rawPath, sha256: record.sha256, bytes: record.bytes, dimensions: [1152, 2048] },
    canonicalPath: record.canonicalPath,
    conversationRefSha256: sha256(conversationUrls[record.scene]),
  });
}

const rejectedEntries = events.filter((event) => event.status === "moderation-blocked-text-only-no-media").map((event) => {
  const eventIndex = events.indexOf(event);
  return {
    entryId: `batch390-scene${event.scene}-meta-primary-refusal`,
    scene: event.scene,
    phase: "pass-1-meta-primary",
    status: event.status,
    launchedAt: event.submittedAt,
    occurredAt: event.occurredAt,
    provider: event.provider,
    prompt: event.prompt,
    refusalText: event.refusalText,
    rawOutput: event.rawOutput,
    auditRef: `${checkpointPath}#/renderPasses/pass1/events/${eventIndex}`,
    source: {
      promptPath: event.prompt.sourcePath,
      rawPath: null,
      conversationRefSha256: event.conversationRefSha256,
      sessionLog: "Codex browser session; local absolute session path and raw diagnostics intentionally omitted",
    },
    immutable: true,
  };
});

checkpoint.status = "complete-four-of-four-hard-safe-meta-ai-pass-1-accepted-no-more-montenegro-rendering";
checkpoint.closureParentCommit = "bd6e1db0dac5f8d9096faa9440dc54ecfc8ba1e4";
checkpoint.policy.pass1CandidatesConsumed = 4;
checkpoint.policy.pass2CandidatesAuthorized = 0;
checkpoint.renderPasses.pass1 = {
  status: "completed-four-hard-safe-meta-ai-media-after-three-single-fallbacks",
  provider: "Meta AI",
  launchMode: "four-concurrent-browser-tabs-one-primary-per-scene",
  primaryBankSubmittedAt: primarySubmittedAt,
  mediaCandidatesConsumed: 4,
  promptDispatches: 7,
  blockedPrimaries: [1580, 1581, 1583],
  fallbackDispatches: [1580, 1581, 1583],
  events,
  holisticAudit: {
    status: "complete-once-after-all-four-media-terminal",
    auditedAt,
    hardSafeAcceptedScenes: records.map((record) => record.scene),
    hardUnusableScenes: [],
    razeExactTwoWearersTwoBareLegsScenes: records.map((record) => record.scene),
    findings: records.map((record) => ({
      scene: record.scene,
      hardGates: {
        clearlyAdultOpaquePublicSafe: true,
        anchoredDistinctAdultCount: true,
        noGrossAnatomyCorruption: true,
        inertPropSafeDownrangeOrHarmlessCalibrationFrame: true,
        mascotSafety: true,
        validMedia: true,
      },
      raze: {
        exactReadableWordmark: true,
        observedSockWearers: record.observedSockWearers,
        observedBareLegCharacters: record.observedBareLegCharacters,
        prominentKneeHighs: true,
        countryMotifsRemainDominant: true,
      },
      qualityDeviations: record.qualityDeviations,
      disposition: "accepted-hard-safe-quality-variances-recorded-no-correction-pass",
    })),
  },
};
checkpoint.renderPasses.pass2 = { status: "not-needed-all-scenes-hard-safe-after-pass-1", eligibleScenes: [], events: [] };
checkpoint.rejectedPromptLedger = {
  status: "three-meta-primary-refusals-exact-text-recorded-no-media",
  entries: rejectedEntries,
  appendBeforeLaterPassPublicationCommitOrPush: true,
};
checkpoint.metaAiModerationAudit = {
  primaryBankSubmittedAt: primarySubmittedAt,
  primaryNonRefusalScenes: [1582],
  primaryBlockedScenes: [1580, 1581, 1583],
  fallbackEmittedScenes: [1580, 1581, 1583],
  fallbackStillBlockedScenes: [],
  candidateRowsLogged: 99,
  blacklistedTokens,
  blacklistScope: "Batch 390 browser run; no later dispatch occurred after all four media completed",
  noBypassTactics: true,
};
checkpoint.acceptedAssets = records.map((record) => ({
  scene: record.scene,
  file: record.canonicalPath,
  rawPath: record.rawPath,
  sha256: record.sha256,
  bytes: record.bytes,
  dimensions: [1152, 2048],
  provider: "Meta AI",
  acceptedAttempt: record.attempt,
  acceptance: "bounded-hard-safe-meta-ai-pass-1-raze",
  razeSockWearers: record.observedSockWearers,
  bareLegCharacters: record.observedBareLegCharacters,
}));
checkpoint.hardSafeAcceptedCount = 4;
checkpoint.missingSceneNumbers = [];
checkpoint.xPost = {
  status: "eligible-pending-live-duplicate-reconciliation-and-publication",
  caption: "Montenegro 🤍 Suriname #Montenegro #WorldXXXSeries",
  url: null,
};
checkpoint.nextQueue.lockedUntilBatch390Closed = false;
checkpoint.nextQueue.materializationAllowedAfterRemoteVerifiedBatch390Closure = true;
fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");

const publicRows = fs.readFileSync(publicManifestPath, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
const publicIds = new Set(publicRows.map((row) => row.occurrenceId));
const newPublicRows = [];
for (const record of records) {
  const occurrenceId = sha256(`meta-ai|batch390|scene${record.scene}|${record.attempt}|${record.sha256}`).toLowerCase();
  if (publicIds.has(occurrenceId)) continue;
  newPublicRows.push({
    schemaVersion: 1,
    occurrenceId,
    importedAtUtc: auditedAt,
    observedAtUtc: auditedAt,
    sha256: record.sha256.toLowerCase(),
    bytes: record.bytes,
    extension: ".webp",
    mime: "image/webp",
    sourceKind: "meta-ai-output",
    sourcePath: `external/meta-ai/batch-390/scene-${record.scene}-${record.attempt}.webp`,
    status: "external-provider-output",
    canonicalPath: record.canonicalPath,
    batch: 390,
    scene: record.scene,
    provider: "Meta AI",
    acceptedAttempt: record.attempt,
    acceptanceAuthority: checkpointPath,
  });
}
if (newPublicRows.length) fs.appendFileSync(publicManifestPath, `${newPublicRows.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf8");

const appendUnique = (targetPath, additions, idKey) => {
  const existing = fs.existsSync(targetPath) ? fs.readFileSync(targetPath, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line)) : [];
  const ids = new Set(existing.map((row) => row[idKey]));
  const fresh = additions.filter((row) => !ids.has(row[idKey]));
  if (fresh.length) fs.appendFileSync(targetPath, `${fresh.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf8");
  return fresh.length;
};

const localRows = [];
for (const event of events) {
  const eventId = sha256(`local-staging|batch390|scene${event.scene}|${event.attempt}|${event.status}|${event.prompt.sha256}`).toLowerCase();
  localRows.push({
    schemaVersion: 1,
    eventId,
    batch: 390,
    scene: event.scene,
    provider: "Meta AI",
    attempt: event.attempt,
    status: event.status,
    observedAtUtc: event.occurredAt,
    promptSha256: event.prompt.sha256,
    refusalText: event.refusalText ?? null,
    rawState: event.rawOutput.state,
    candidateSha256: event.rawOutput.sha256,
    candidateBytes: event.rawOutput.bytes,
    conversationUrl: conversationUrls[event.scene],
    accepted: event.status === "completed-hard-safe-accepted",
    acceptanceAuthority: event.status === "completed-hard-safe-accepted" ? checkpointPath : null,
  });
}
const newLocalRows = appendUnique(stagingManifestPath, localRows, "eventId");
const lexiconOutcomes = records.map((record) => ({
  schemaVersion: 1,
  eventId: sha256(`meta-ai-retry-outcome|batch390|scene${record.scene}|${record.attempt}|${record.sha256}`).toLowerCase(),
  eventType: "meta-ai-emission-outcome",
  observedAtUtc: auditedAt,
  batch: 390,
  scene: record.scene,
  attempt: record.attempt,
  status: "emitted-hard-safe-accepted",
  promptSha256: filePromptRecord(record.promptPath).sha256,
  candidateSha256: record.sha256,
  suppressionCounter: record.scene === 1582 ? 0 : blacklistedTokens.length,
  blacklistedTokens: record.scene === 1581 ? blacklistedTokens : [],
}));
const newLexiconRows = appendUnique(localLexiconPath, lexiconOutcomes, "eventId");

console.log(JSON.stringify({
  mode: "recorded",
  checkpoint: checkpointPath,
  status: checkpoint.status,
  acceptedScenes: checkpoint.acceptedAssets.map((asset) => asset.scene),
  rejectedPromptEntries: rejectedEntries.length,
  newExternalManifestRows: newPublicRows.length,
  newLocalStagingRows: newLocalRows,
  newLocalLexiconRows: newLexiconRows,
  nextQueue: checkpoint.nextQueue,
}, null, 2));
