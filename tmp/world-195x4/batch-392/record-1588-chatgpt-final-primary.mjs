import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const checkpointPath = "assets/lore/starlight-era/batch-392-maldives-orbital-research-station-checkpoint.json";
const promptPath = "tmp/world-195x4/batch-392/scene-1588-chatgpt-final-primary-post-suppression.txt";
const rawPath = "tmp/world-195x4/batch-392/raw/chatgpt-final/scene-1588-chatgpt-final-primary.png";
const finalPath = "assets/lore/starlight-era/1588-maldives-hanifaru-storm-raze-close-love-chatgpt-final.png";
const sourceMetaPath = "tmp/world-195x4/batch-392/raw/in-flight/scene-1588-meta-successor-i-tab-4-primary.webp";

const sha256 = (value) => createHash("sha256").update(value).digest("hex").toUpperCase();
const promptBytes = readFileSync(promptPath);
const rawBytes = readFileSync(rawPath);
const finalBytes = readFileSync(finalPath);

if (sha256(rawBytes) !== "C0FC508A6920543F08DAA0E0625D0CDECC0F78F708E643048DE42C8AD55C18AE") throw new Error("Unexpected ChatGPT final raw hash");
if (sha256(finalBytes) !== sha256(rawBytes)) throw new Error("Canonical copy does not match preserved raw");
if (sha256(readFileSync(sourceMetaPath)) !== "3057271142914A4B78E3AB54942E80D6165151554696E4B7902E9BC87C19C80D") throw new Error("Unexpected selected Meta source hash");

const checkpoint = JSON.parse(readFileSync(checkpointPath, "utf8"));
const eventId = "batch-392-scene-1588-chatgpt-final-primary-accepted";
const acceptedAt = "2026-08-20T14:54:13.9439426Z";
const promptSha256 = sha256(promptBytes);
const outputSha256 = sha256(rawBytes);

checkpoint.status = "active-scene-1588-canonical-final-three-chatgpt-refinements-pending";
checkpoint.lexiconSnapshot = {
  path: "C:/Users/A/Documents/ChatGPT/RENDERS/outputs/meta5_blocked_prompt_lexicon.jsonl",
  sha256: "C59CBB0EC73DDD3C9673A01531373E18ED162C877D127A83137513C5903C603D",
  bytes: 297481,
  observedAtUtc: "2026-08-20T14:47:00.000Z"
};

const event = {
  eventId,
  batch: 392,
  scene: 1588,
  provider: "ChatGPT built-in image generation",
  phase: "chatgpt-final-hem-refinement-primary",
  toolCallCompletedAtUtc: "2026-08-20T14:52:30.000Z",
  observedAtUtc: acceptedAt,
  sourceMeta: {
    path: sourceMetaPath,
    sha256: "3057271142914A4B78E3AB54942E80D6165151554696E4B7902E9BC87C19C80D",
    archivePointer: "progress-reports/codex-generated-media/blobs/30/3057271142914a4b78e3ab54942e80d6165151554696e4b7902e9bc87c19c80d.webp"
  },
  prompt: {
    path: promptPath,
    exactText: promptBytes.toString("utf8").trimEnd(),
    sha256: promptSha256,
    bytes: promptBytes.length,
    suppressionProfile: "bounded-active-twenty-term-profile",
    blacklistSnapshotSha256: "C59CBB0EC73DDD3C9673A01531373E18ED162C877D127A83137513C5903C603D"
  },
  referenceImageShas: [
    "3057271142914A4B78E3AB54942E80D6165151554696E4B7902E9BC87C19C80D",
    "4161C9A5A8F745DF3A976112B6CA539E210DFA4E88E7873760E5CD0FF3F58FF6",
    "0F330D7FF46E226340E5C94261752E73A22B895891E83B72EB8445E4618FCEEB",
    "BA256D750840F38C67E737FAB64BF646E606761DE71AEC9E5374AA0324B1EED1"
  ],
  raw: {
    state: "preserved",
    path: rawPath,
    sha256: outputSha256,
    bytes: rawBytes.length,
    width: 941,
    height: 1672,
    mediaType: "image/png",
    archivePointer: finalPath
  },
  externalStagingRelativePath: "outputs/meta5_batch_staging/batch-392/scene-1588/chatgpt-final-hem-refinement/scene-1588-chatgpt-final-primary.png",
  qaDisposition: "accepted-canonical-first-primary-no-retry",
  qa: {
    validMedia: true,
    clearlyAdultPublicSafeOpaque: true,
    fourDistinctAnchoredFaces: true,
    noCloneOrMerge: true,
    anatomySafe: true,
    propHandlingSafe: true,
    compellingFashionRelationshipMission: true,
    razeBootsAcceptedUnderRelaxedGate: true,
    settingAcceptedUnderRelaxedGate: true
  },
  noRetryReason: "The primary edit passes every active hard gate. Boots, exact setting interpretation, logo geometry and other microdetails are quality targets and do not authorize an aesthetic retry.",
  finalSelectedSha256: outputSha256,
  immutable: true
};

const existingEventIndex = checkpoint.events.findIndex((item) => item.eventId === eventId);
if (existingEventIndex === -1) checkpoint.events.push(event);
else checkpoint.events[existingEventIndex] = event;

const acceptedAsset = {
  scene: 1588,
  path: finalPath,
  sha256: outputSha256,
  bytes: finalBytes.length,
  width: 941,
  height: 1672,
  provider: "ChatGPT built-in image generation",
  sourceProvider: "Meta AI",
  sourceSha256: "3057271142914A4B78E3AB54942E80D6165151554696E4B7902E9BC87C19C80D",
  pass: "bounded-clothing-primary",
  acceptedAt,
  hardSafe: true,
  missionWeightedAcceptance: true,
  immutable: true
};
checkpoint.acceptedAssets = checkpoint.acceptedAssets.filter((item) => item.scene !== 1588);
checkpoint.acceptedAssets.push(acceptedAsset);

checkpoint.scenePlans["1588"].chatgptFinalization.executedPrimary = {
  promptPath,
  promptSha256,
  blacklistSnapshotSha256: "C59CBB0EC73DDD3C9673A01531373E18ED162C877D127A83137513C5903C603D",
  sourceMetaSha256: "3057271142914A4B78E3AB54942E80D6165151554696E4B7902E9BC87C19C80D",
  outputPath: finalPath,
  outputSha256,
  acceptedAt,
  retryConsumed: 0,
  status: "accepted-canonical"
};

checkpoint.rollingState.provisionalMetaSources["1588"].nextGate = "completed bounded ChatGPT primary accepted as canonical";
checkpoint.rollingState.canonicalFinals = checkpoint.rollingState.canonicalFinals ?? {};
checkpoint.rollingState.canonicalFinals["1588"] = {
  path: finalPath,
  sha256: outputSha256,
  sourceMetaSha256: "3057271142914A4B78E3AB54942E80D6165151554696E4B7902E9BC87C19C80D",
  acceptedAt
};

checkpoint.activeMetaLanes.unresolvedScenes = [];
checkpoint.activeMetaLanes.resolvedMetaSourceScenes = [1588, 1589, 1590, 1591];
checkpoint.activeMetaLanes.candidateUnderInspection = "none, all four Maldives Meta scene sources selected";
checkpoint.activeMetaLanes.candidateInFlight = "none";
checkpoint.activeMetaLanes.candidateNPlus2Gate = "closed, no filler after Meta source selection";
checkpoint.activeMetaLanes.nextRequiredStage = "bounded ChatGPT clothing primary for scenes 1589, 1590 and 1591";

writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`);
console.log(JSON.stringify({ eventId, promptSha256, outputSha256, acceptedAt, nextScenes: [1589, 1590, 1591] }, null, 2));
