#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";

const checkpointPath = "assets/lore/starlight-era/batch-392-maldives-orbital-research-station-checkpoint.json";
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex").toUpperCase();
const sourceImageShas = [
  "4161C9A5A8F745DF3A976112B6CA539E210DFA4E88E7873760E5CD0FF3F58FF6",
  "0F330D7FF46E226340E5C94261752E73A22B895891E83B72EB8445E4618FCEEB",
  "BA256D750840F38C67E737FAB64BF646E606761DE71AEC9E5374AA0324B1EED1",
];

const dispatches = [
  {
    scene: 1588,
    phase: "successor-c-planetary",
    promptPath: "tmp/world-195x4/batch-392/scene-1588-meta-successor-c-primary-planetary.txt",
    promptSha256: "71991C6E261BA05225DCE2DC986C632A71267846C229D0579AF13D8890E267B6",
    conversationUrl: "https://www.meta.ai/prompt/b65932e9-95ab-47b5-8934-75359c743b57",
    sentAtUtc: "2026-08-20T10:34:17.236Z",
    immediateResponseText: "I'm mapping the 14-degree Dutch tilt and diagonal depth for the orbital lounge, placing the heart-shaped lagoon, faro rings, and manta-current arcs while positioning Radiance, Alia, Ellie, and ECE with their rainbow-gradient socks and reef-motif outfits.",
  },
  {
    scene: 1589,
    phase: "successor-c-planetary",
    promptPath: "tmp/world-195x4/batch-392/scene-1589-meta-successor-c-primary-planetary.txt",
    promptSha256: "4EE864093DA71EA7F597766FDC1C9A5040CC55070930998A2ED9E46B23B46C33",
    conversationUrl: "https://www.meta.ai/prompt/31cb52b5-84c9-4ec7-b6e0-49ed8dd969e7",
    sentAtUtc: "2026-08-20T10:34:17.250Z",
    immediateResponseText: "I'm organizing the protected habitat setup with deep violet dusk, the calibration frame, and the four women in secure fashion, making sure the Maldives-inspired installation and orbital deck details are ready for the image.",
  },
  {
    scene: 1590,
    phase: "successor-b-fallback-planetary",
    promptPath: "tmp/world-195x4/batch-392/scene-1590-meta-successor-b-fallback-planetary.txt",
    promptSha256: "B2C510BD60D2D8388F33011F4BF656AE42BB7922B4D50ECA91B39DD0E33A268D",
    conversationUrl: "https://www.meta.ai/prompt/a17c2b6f-b8b9-4fc2-8588-bd504e723b9e",
    sentAtUtc: "2026-08-20T10:34:17.284Z",
    immediateResponseText: "I'm arranging a close standing group in the orbital lounge above Addu Atoll, setting the high oblique angle, Dutch roll, and warm sunrise light while placing the lagoon, causeway, and reef details behind the figures.",
  },
  {
    scene: 1591,
    phase: "successor-c-planetary",
    promptPath: "tmp/world-195x4/batch-392/scene-1591-meta-successor-c-primary-planetary.txt",
    promptSha256: "8B5BD2CB39488826F4031C6D2245D1DA28A71C303E161E87694A5B9F8510D1F9",
    conversationUrl: "https://www.meta.ai/prompt/9cbb2683-7fe1-49b6-9c63-156fbac50738",
    sentAtUtc: "2026-08-20T10:34:17.328Z",
    immediateResponseText: "I'm staging a canted moving portrait above Baa Atoll, positioning Radiance in the near foreground with Ellie and Alia interacting mid-frame while ECE holds the calibration frame at the outer edge, and mapping micro-atoll rings, reef chains, and cupola ribs into the background.",
  },
];

const observedAtUtc = "2026-08-20T10:34:27.298Z";
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
checkpoint.metaDispatches ??= [];

for (const dispatch of dispatches) {
  const prompt = fs.readFileSync(dispatch.promptPath);
  if (sha256(prompt) !== dispatch.promptSha256) throw new Error(`Prompt SHA mismatch for scene ${dispatch.scene}`);
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
      bytes: prompt.length,
      exactText: prompt.toString("utf8"),
    },
    conversationUrlSha256: sha256(dispatch.conversationUrl),
    referenceProvenance: {
      requestedSourceImageShas: sourceImageShas,
      transferState: "not-transferred-upload-failed-before-dispatch",
      dispatchMode: "text-only",
    },
    immediateResponseText: dispatch.immediateResponseText,
    responseClassification: "non-refusal-in-progress",
    rawState: "no-bytes-in-progress",
    immutable: true,
  };
  if (!checkpoint.metaDispatches.some((entry) => entry.eventId === eventId)) checkpoint.metaDispatches.push(record);
  if (!checkpoint.events.some((entry) => entry.eventId === eventId)) checkpoint.events.push({
    eventId,
    eventType: "meta-ai-text-dispatch",
    occurredAt: dispatch.sentAtUtc,
    scene: dispatch.scene,
    attempt: dispatch.phase,
    promptSha256: dispatch.promptSha256,
    sourceImageShas,
    referenceTransferState: record.referenceProvenance.transferState,
    responseClassification: record.responseClassification,
    immediateResponseText: record.immediateResponseText,
    rawState: record.rawState,
  });
}

checkpoint.status = "active-continuous-meta-planetary-four-lanes-in-flight";
checkpoint.rollingState = {
  recordedAt: observedAtUtc,
  candidateUnderInspection: "successor B remains classified for all four scenes",
  nextCandidateInFlight: "planetary text-only successor C for scenes 1588, 1589 and 1591; planetary text-only successor-B fallback for scene 1590",
  candidateNPlus2Gate: "closed until these four results complete and each occurrence is preserved and classified",
  preparedNextDispatch: "none while one successor is in flight in every unresolved lane",
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  status: checkpoint.status,
  dispatchRecords: checkpoint.metaDispatches.length,
  checkpointSha256: sha256(fs.readFileSync(checkpointPath)),
}, null, 2));
