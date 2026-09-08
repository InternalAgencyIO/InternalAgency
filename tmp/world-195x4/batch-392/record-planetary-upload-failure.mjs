#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";

const checkpointPath = "assets/lore/starlight-era/batch-392-maldives-orbital-research-station-checkpoint.json";
const lexiconPath = "C:/Users/A/Documents/ChatGPT/RENDERS/outputs/meta5_blocked_prompt_lexicon.jsonl";
const observedAtUtc = new Date().toISOString();
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex").toUpperCase();
const sourcePaths = [
  "assets/lore/starlight-era/938-central-african-republic-boali-falls-rainbow-star-map-relay.png",
  "assets/lore/starlight-era/936-central-african-republic-bangui-oubangui-rainbow-route-grid.png",
  "assets/lore/starlight-era/937-central-african-republic-dzanga-sangha-rainbow-clinic-signal-cipher.png",
];
const sourceFiles = sourcePaths.map((path, index) => {
  const bytes = fs.readFileSync(path);
  return { order: index + 1, path, sha256: sha256(bytes), bytes: bytes.length };
});
const expectedShas = [
  "4161C9A5A8F745DF3A976112B6CA539E210DFA4E88E7873760E5CD0FF3F58FF6",
  "0F330D7FF46E226340E5C94261752E73A22B895891E83B72EB8445E4618FCEEB",
  "BA256D750840F38C67E737FAB64BF646E606761DE71AEC9E5374AA0324B1EED1",
];
for (let index = 0; index < sourceFiles.length; index += 1) {
  if (sourceFiles[index].sha256 !== expectedShas[index]) throw new Error(`Reference SHA mismatch at order ${index + 1}`);
}

const promptPaths = {
  1588: "tmp/world-195x4/batch-392/scene-1588-meta-successor-c-primary-planetary.txt",
  1589: "tmp/world-195x4/batch-392/scene-1589-meta-successor-c-primary-planetary.txt",
  1590: "tmp/world-195x4/batch-392/scene-1590-meta-successor-b-fallback-planetary.txt",
  1591: "tmp/world-195x4/batch-392/scene-1591-meta-successor-c-primary-planetary.txt",
};
const failureReason = "Meta attachment control did not produce a controllable file chooser; no reference-file transfer was confirmed. Continue through the committed text-only prompt path without another upload attempt for this bank.";
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
checkpoint.referenceUploadAttempts ??= [];
const lexiconRows = fs.readFileSync(lexiconPath, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
const seenLexiconEventIds = new Set(lexiconRows.map((row) => row.eventId).filter(Boolean));
const additions = [];

for (const scene of [1588, 1589, 1590, 1591]) {
  const promptBytes = fs.readFileSync(promptPaths[scene]);
  const promptSha256 = sha256(promptBytes);
  const attempt = {
    eventId: `batch-392-scene-${scene}-planetary-face-reference-upload-failed`,
    batch: 392,
    scene,
    phase: scene === 1590 ? "successor-b-fallback-planetary" : "successor-c-planetary",
    provider: "Meta AI",
    observedAtUtc,
    state: "upload-failed-text-only-continuation",
    sourceFiles,
    plannedPrompt: { sourcePath: promptPaths[scene], sha256: promptSha256, bytes: promptBytes.length },
    failureReason,
    transferState: "no-confirmed-transfer",
    retryDisposition: "no further upload attempt for this bank; proceed text-only",
    immutable: true,
  };
  if (!checkpoint.referenceUploadAttempts.some((entry) => entry.eventId === attempt.eventId)) checkpoint.referenceUploadAttempts.push(attempt);
  if (!checkpoint.events.some((event) => event.eventId === attempt.eventId)) checkpoint.events.push({
    eventId: attempt.eventId,
    eventType: "meta-ai-reference-upload-failure",
    occurredAt: observedAtUtc,
    scene,
    attempt: attempt.phase,
    promptSha256,
    sourceImageShas: sourceFiles.map((source) => source.sha256),
    responseClassification: "upload-failed-before-prompt-send",
    rawState: "no-media-generation-attempted",
    failureReason,
  });
  const lexiconEventId = sha256(`batch392|${scene}|planetary-upload-failure|${promptSha256}|${sourceFiles.map((source) => source.sha256).join("|")}`).toLowerCase();
  if (!seenLexiconEventIds.has(lexiconEventId)) additions.push({
    schemaVersion: 1,
    eventId: lexiconEventId,
    eventType: "meta-ai-upload-failure",
    observedAtUtc,
    batch: 392,
    scene,
    attempt: attempt.phase,
    status: "upload-failed-text-only-continuation",
    plannedPromptSha256: promptSha256,
    sourceImageShas: sourceFiles.map((source) => source.sha256),
    failureReason,
    transferState: "no-confirmed-transfer",
    retryDisposition: "text-only",
  });
}
if (additions.length) fs.appendFileSync(lexiconPath, `${additions.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf8");
const lexiconBytes = fs.readFileSync(lexiconPath);
checkpoint.rollingLexiconSnapshot = {
  ...(checkpoint.rollingLexiconSnapshot ?? {}),
  path: lexiconPath,
  sha256: sha256(lexiconBytes),
  bytes: lexiconBytes.length,
  observedAt: observedAtUtc,
};
checkpoint.status = "active-continuous-meta-planetary-upload-failed-text-only-bank-ready";
checkpoint.rollingState = {
  recordedAt: observedAtUtc,
  candidateUnderInspection: "successor B already classified for all four scenes",
  nextCandidateInFlight: "none pending upload-failure evidence commit and remote verification",
  candidateNPlus2Gate: "closed until four upload-failure records are verified, committed, pushed and remote-verified",
  preparedNextDispatch: "text-only planetary successor C for scenes 1588, 1589 and 1591 plus text-only planetary successor-B fallback for scene 1590",
};
fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  observedAtUtc,
  status: checkpoint.status,
  uploadFailureRecords: checkpoint.referenceUploadAttempts.length,
  lexiconAdditions: additions.length,
  lexiconSha256: sha256(lexiconBytes),
  checkpointSha256: sha256(fs.readFileSync(checkpointPath)),
}, null, 2));
