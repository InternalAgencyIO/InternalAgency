#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";

const checkpointPath = "assets/lore/starlight-era/batch-392-maldives-orbital-research-station-checkpoint.json";
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex").toUpperCase();
const recordFile = (file) => {
  const bytes = fs.readFileSync(file);
  return { file, text: bytes.toString("utf8"), sha256: sha256(bytes), encoding: "utf8", bytes: bytes.length, fidelity: "runtime-launch-byte-exact" };
};
const rawFile = (file, width = 1152, height = 2048) => {
  const bytes = fs.readFileSync(file);
  return { state: "preserved", path: file, sha256: sha256(bytes), bytes: bytes.length, width, height };
};

const completedAt = {
  1588: "2026-08-20T09:45:28.7991306Z",
  1589: "2026-08-20T09:44:19.0525128Z",
  1590: "2026-08-20T09:44:18.9971910Z",
  1591: "2026-08-20T09:44:19.1101055Z",
};
const promptThreadUrls = {
  1588: "https://www.meta.ai/prompt/b65932e9-95ab-47b5-8934-75359c743b57",
  1589: "https://www.meta.ai/prompt/31cb52b5-84c9-4ec7-b6e0-49ed8dd969e7",
  1590: "https://www.meta.ai/prompt/a17c2b6f-b8b9-4fc2-8588-bd504e723b9e",
  1591: "https://www.meta.ai/prompt/9cbb2683-7fe1-49b6-9c63-156fbac50738",
};
const rejectionReasons = {
  1588: "Hard-unusable: the inert prop's open end crosses the seated cast and no complete downrange target/backstop is visible. The text-only result does not preserve the exact scene-938/936/937 age-21 faces.",
  1589: "Hard-unusable: the inert prop faces inward without a complete visible target/backstop lane. The text-only result does not preserve the exact scene-938/936/937 age-21 faces.",
  1590: "Hard-unusable: the inert prop lacks the required visible empty-water marker and complete catch screen/backstop, and the outside trigger-index geometry is absent. The text-only result does not preserve the exact scene-938/936/937 age-21 faces.",
  1591: "Hard-unusable: the inert prop presents toward the camera without the complete separate empty-water marker and catch screen/backstop. The text-only result does not preserve the exact scene-938/936/937 age-21 faces.",
};

checkpoint.status = "active-continuous-meta-successor-b-in-flight-initial-four-hard-rejected";
checkpoint.policy.initialCandidatesConsumed = 4;
checkpoint.policy.promptDispatchesConsumed = 8;
checkpoint.policy.initialDispatchAt = "2026-08-20T09:41:10.102Z";
checkpoint.policy.successorBDispatchAt = "2026-08-20T09:47:03.013Z";
checkpoint.rollingState = {
  recordedAt: "2026-08-20T09:49:30.000Z",
  candidateUnderInspection: "initial-primary classified hard-unusable for all four scenes",
  nextCandidateInFlight: "successor-b dispatched for all four scenes",
  candidateNPlus2Gate: "closed until all initial rejections and raw media are archived, ledgered, verified, committed, pushed, and remote-verified",
};

for (const scene of [1588, 1589, 1590, 1591]) {
  const prompt = recordFile(`tmp/world-195x4/batch-392/scene-${scene}-meta-initial-primary.txt`);
  prompt.sourcePath = prompt.file;
  delete prompt.file;
  const raw = rawFile(`tmp/world-195x4/batch-392/raw/initial/scene-${scene}-meta-ai-primary.webp`);
  const conversationRefSha256 = sha256(promptThreadUrls[scene]);
  const rejectionEntry = {
    entryId: `batch-392-scene-${scene}-meta-ai-initial-primary-visually-rejected`,
    batch: 392,
    scene,
    phase: "initial-primary",
    status: "completed-output-visually-rejected-hard-unusable",
    provider: "Meta AI",
    occurredAt: completedAt[scene],
    prompt,
    faceReferenceTransfer: {
      state: "text-only",
      manifestSha256: checkpoint.faceManifest.sha256,
      referencesTransferred: false,
      provenance: "No reference files were transferred in this browser dispatch; the exact age/name/position map and source hashes were preserved in the committed preflight and prompt text.",
    },
    refusalText: null,
    rawOutput: raw,
    rejectionReason: rejectionReasons[scene],
    conversationRefSha256,
    immutable: true,
  };
  checkpoint.rejectedPromptLedger.entries.push(rejectionEntry);
  checkpoint.rejectedAssets.push({
    scene,
    attempt: "initial-primary",
    path: raw.path,
    sha256: raw.sha256,
    bytes: raw.bytes,
    status: "visually-rejected-hard-unusable",
    rejectionReason: rejectionReasons[scene],
    immutable: true,
  });
  checkpoint.events.push({
    eventId: `batch-392-scene-${scene}-initial-primary-completed-rejected`,
    eventType: "meta-ai-candidate-completed",
    occurredAt: completedAt[scene],
    scene,
    attempt: "initial-primary",
    promptSha256: prompt.sha256,
    rawSha256: raw.sha256,
    rawBytes: raw.bytes,
    responseClassification: "emitted",
    qaDisposition: "visually-rejected-hard-unusable",
    rejectionReason: rejectionReasons[scene],
    conversationRefSha256,
  });

  const successor = recordFile(`tmp/world-195x4/batch-392/scene-${scene}-meta-successor-b.txt`);
  checkpoint.events.push({
    eventId: `batch-392-scene-${scene}-successor-b-dispatched`,
    eventType: "meta-ai-candidate-dispatched",
    occurredAt: "2026-08-20T09:47:03.013Z",
    scene,
    attempt: "successor-b",
    prompt: {
      sourcePath: successor.file,
      text: successor.text,
      sha256: successor.sha256,
      encoding: successor.encoding,
      bytes: successor.bytes,
      fidelity: successor.fidelity,
    },
    responseClassification: "in-flight-no-immediate-refusal",
    refusalText: null,
    faceReferenceTransfer: "text-only",
    conversationRefSha256,
  });
}

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  status: checkpoint.status,
  events: checkpoint.events.length,
  rejectedPromptEntries: checkpoint.rejectedPromptLedger.entries.length,
  rejectedAssets: checkpoint.rejectedAssets.length,
  checkpointSha256: sha256(fs.readFileSync(checkpointPath)),
}, null, 2));
