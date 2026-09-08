#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";

const checkpointPath = "assets/lore/starlight-era/batch-392-maldives-orbital-research-station-checkpoint.json";
const lexiconPath = "C:/Users/A/Documents/ChatGPT/RENDERS/outputs/meta5_blocked_prompt_lexicon.jsonl";
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex").toUpperCase();
const sourceImageShas = [
  "4161C9A5A8F745DF3A976112B6CA539E210DFA4E88E7873760E5CD0FF3F58FF6",
  "0F330D7FF46E226340E5C94261752E73A22B895891E83B72EB8445E4618FCEEB",
  "BA256D750840F38C67E737FAB64BF646E606761DE71AEC9E5374AA0324B1EED1",
];
const observedAtUtc = "2026-08-20T10:53:58.178Z";
const dispatches = [
  {
    scene: 1588,
    phase: "successor-c-fallback-planetary",
    promptPath: "tmp/world-195x4/batch-392/scene-1588-meta-successor-c-fallback-planetary.txt",
    promptSha256: "8207174FEB21C90807FA903E735F0E6D492141E60DBEBDCBEE39B488A25BCBD4",
    conversationUrl: "https://www.meta.ai/prompt/b65932e9-95ab-47b5-8934-75359c743b57",
    sentAtUtc: "2026-08-20T10:53:48.007Z",
    immediateResponseText: "I'm simplifying the Maldives fashion scene by removing calibration gear, keeping the Dutch tilt, Hanifaru lagoon, and safe lap seating with the cheek peck and eye-line.",
  },
  {
    scene: 1589,
    phase: "successor-d-primary-planetary",
    promptPath: "tmp/world-195x4/batch-392/scene-1589-meta-successor-d-primary-planetary.txt",
    promptSha256: "604198A5F3C03F70BDEE29176CDA6AA0B2871C490912C5BB5C6E0C54C45176FD",
    conversationUrl: "https://www.meta.ai/prompt/31cb52b5-84c9-4ec7-b6e0-49ed8dd969e7",
    sentAtUtc: "2026-08-20T10:53:48.033Z",
    immediateResponseText: "I'm organizing the Fuvahmulah-inspired installation, arranging the floor-adjacent fashion angle, poses, and wardrobe details so the rainbow-gradient RAZE socks, motifs, and interactions fit the speculative setting.",
  },
  {
    scene: 1590,
    phase: "successor-d-primary-planetary",
    promptPath: "tmp/world-195x4/batch-392/scene-1590-meta-successor-d-primary-planetary.txt",
    promptSha256: "AA74D1B26D110D9879E155B0487CCB1A13A1BBD7BA8A03F4B3982706DCFFC9AC",
    conversationUrl: "https://www.meta.ai/prompt/a17c2b6f-b8b9-4fc2-8588-bd504e723b9e",
    sentAtUtc: "2026-08-20T10:53:48.068Z",
    immediateResponseText: "I'm organizing ",
  },
  {
    scene: 1591,
    phase: "successor-d-primary-planetary",
    promptPath: "tmp/world-195x4/batch-392/scene-1591-meta-successor-d-primary-planetary.txt",
    promptSha256: "41EEBCC15671105849DD6123387C5200052BE561F067DDBB7FD19879AEA97CCA",
    conversationUrl: "https://www.meta.ai/prompt/9cbb2683-7fe1-49b6-9c63-156fbac50738",
    sentAtUtc: "2026-08-20T10:53:48.083Z",
    immediateResponseText: "I'm organizing the scene's subjects, poses, and wardrobe details so each character's position, expression, and outfit elements are clear and ready for the visual plan.",
  },
];

const lexiconBytes = fs.readFileSync(lexiconPath);
const lexiconSha256 = sha256(lexiconBytes);
if (lexiconSha256 !== "54E4DBF4EB31115943F0868AA959663097AB7A2C1963144D4496BC8312AD2F6D") throw new Error("Blocked lexicon snapshot changed");

const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
checkpoint.metaDispatches ??= [];
for (const dispatch of dispatches) {
  const promptBytes = fs.readFileSync(dispatch.promptPath);
  if (sha256(promptBytes) !== dispatch.promptSha256) throw new Error(`Prompt SHA mismatch for scene ${dispatch.scene}`);
  const eventId = `batch-392-scene-${dispatch.scene}-${dispatch.phase}-text-dispatched`;
  const record = {
    eventId,
    batch: 392,
    scene: dispatch.scene,
    provider: "Meta AI",
    phase: dispatch.phase,
    sentAtUtc: dispatch.sentAtUtc,
    immediateResponseObservedAtUtc: observedAtUtc,
    prompt: {
      path: dispatch.promptPath,
      sha256: dispatch.promptSha256,
      bytes: promptBytes.length,
      exactText: promptBytes.toString("utf8"),
    },
    blacklistSnapshotSha256: lexiconSha256,
    conversationUrlSha256: sha256(dispatch.conversationUrl),
    referenceProvenance: {
      requestedSourceImageShas: sourceImageShas,
      transferState: "text-only-continued-after-recorded-upload-failure",
      dispatchMode: "text-only",
    },
    immediateResponseText: dispatch.immediateResponseText,
    responseClassification: "non-refusal-in-progress",
    rawState: "no-bytes-in-progress",
    immutable: true,
  };
  if (!checkpoint.metaDispatches.some((candidate) => candidate.eventId === eventId)) checkpoint.metaDispatches.push(record);
  if (!checkpoint.events.some((candidate) => candidate.eventId === eventId)) checkpoint.events.push({
    eventId,
    eventType: "meta-ai-text-dispatch",
    occurredAt: dispatch.sentAtUtc,
    scene: dispatch.scene,
    attempt: dispatch.phase,
    promptSha256: dispatch.promptSha256,
    sourceImageShas,
    blacklistSnapshotSha256: lexiconSha256,
    referenceTransferState: record.referenceProvenance.transferState,
    responseClassification: record.responseClassification,
    immediateResponseText: dispatch.immediateResponseText,
    rawState: record.rawState,
  });
}

checkpoint.status = "active-continuous-meta-planetary-four-lanes-in-flight";
checkpoint.rollingState = {
  recordedAt: observedAtUtc,
  candidateUnderInspection: "the prior refusal and three hard-unusable raws remain fully classified",
  nextCandidateInFlight: "scene 1588 candidate-C fallback plus successor-D primary candidates for scenes 1589, 1590 and 1591",
  candidateNPlus2Gate: "closed until these four results complete and every occurrence is preserved and classified",
  preparedNextDispatch: "none while each unresolved lane already has its permitted successor in flight",
};
checkpoint.policy ??= {};
checkpoint.policy.perpetualGuardianUpdateObservedAtUtc = "2026-08-20T10:53:47.676Z";
checkpoint.policy.perpetualGuardianAutomationId = "starlight-internalagency-24-7-guardian";
checkpoint.policy.perpetualGuardianCadence = "five-minute heartbeat";
fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  status: checkpoint.status,
  dispatchRecords: dispatches.length,
  lexiconSha256,
  checkpointSha256: sha256(fs.readFileSync(checkpointPath)),
}, null, 2));
