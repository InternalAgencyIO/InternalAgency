import { createHash } from "node:crypto";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const batchDir = resolve(root, "tmp/world-195x4/batch-303");
const checkpointPath = resolve(
  root,
  "assets/lore/starlight-era/batch-303-vatican-city-recovery-checkpoint.json",
);
const preflight = JSON.parse(
  readFileSync(resolve(batchDir, "batch-303-vatican-city-preflight.json"), "utf8"),
);

const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex").toUpperCase();
const promptRecord = (fileName) => {
  const path = resolve(batchDir, fileName);
  const contents = readFileSync(path, "utf8");
  return {
    workspacePath: `tmp/world-195x4/batch-303/${fileName}`,
    sha256: sha256(Buffer.from(contents, "utf8")),
    contents,
  };
};
const assetRecord = ({ fileName, generatedPath, workspaceFile }) => {
  const workspacePath = resolve(batchDir, workspaceFile);
  const buffer = readFileSync(workspacePath);
  return {
    fileName,
    absolutePath: generatedPath,
    workspaceCopy: `tmp/world-195x4/batch-303/${workspaceFile}`,
    bytes: statSync(workspacePath).size,
    sha256: sha256(buffer),
    preservedOriginal: true,
    copiedToAcceptedAssets: false,
  };
};

const rawPromptRecords = Object.fromEntries(
  [1232, 1233, 1234, 1235].map((scene) => [
    String(scene),
    promptRecord(`scene-${scene}-prompt.txt`),
  ]),
);
const recoveryPromptRecords = Object.fromEntries(
  [1232, 1233, 1234, 1235].map((scene) => [
    String(scene),
    promptRecord(`scene-${scene}-recovery-prompt.txt`),
  ]),
);

const assets = {
  raw1232: assetRecord({
    fileName: "exec-df65d423-cbd5-44cd-9e6a-41a728aea4c5.png",
    generatedPath: "C:\\Users\\A\\.codex\\generated_images\\019fd625-0bf6-78d2-9fb8-3f3e22c1d086\\exec-df65d423-cbd5-44cd-9e6a-41a728aea4c5.png",
    workspaceFile: "1232-vatican-city-colonnade-paws-radiance-hosiery-raw.png",
  }),
  recovery1232: assetRecord({
    fileName: "exec-548f102a-017a-42fd-b1f6-8bdf839d77a4.png",
    generatedPath: "C:\\Users\\A\\.codex\\generated_images\\019fd625-0bf6-78d2-9fb8-3f3e22c1d086\\exec-548f102a-017a-42fd-b1f6-8bdf839d77a4.png",
    workspaceFile: "1232-vatican-city-colonnade-paws-radiance-hosiery-recovery.png",
  }),
  raw1233: assetRecord({
    fileName: "exec-1d510f59-df72-4162-a749-4b2b2619fb0d.png",
    generatedPath: "C:\\Users\\A\\.codex\\generated_images\\019fd625-0bf6-78d2-9fb8-3f3e22c1d086\\exec-1d510f59-df72-4162-a749-4b2b2619fb0d.png",
    workspaceFile: "1233-vatican-city-momo-stair-paws-ece-hosiery-raw.png",
  }),
  recovery1233: assetRecord({
    fileName: "exec-cfc530d3-1d36-48bd-8de0-0e5993d162b0.png",
    generatedPath: "C:\\Users\\A\\.codex\\generated_images\\019fd625-0bf6-78d2-9fb8-3f3e22c1d086\\exec-cfc530d3-1d36-48bd-8de0-0e5993d162b0.png",
    workspaceFile: "1233-vatican-city-momo-stair-paws-ece-hosiery-recovery.png",
  }),
  raw1234: assetRecord({
    fileName: "exec-5b53719d-c238-4b10-969b-5df2c4c14050.png",
    generatedPath: "C:\\Users\\A\\.codex\\generated_images\\019fd625-0bf6-78d2-9fb8-3f3e22c1d086\\exec-5b53719d-c238-4b10-969b-5df2c4c14050.png",
    workspaceFile: "1234-vatican-city-gardens-service-raw.png",
  }),
  recovery1234: assetRecord({
    fileName: "exec-8b2a60ec-d48b-4dfe-a8f9-76b79889c2ce.png",
    generatedPath: "C:\\Users\\A\\.codex\\generated_images\\019fd625-0bf6-78d2-9fb8-3f3e22c1d086\\exec-8b2a60ec-d48b-4dfe-a8f9-76b79889c2ce.png",
    workspaceFile: "1234-vatican-city-gardens-service-recovery.png",
  }),
};

const renderedRejected = (asset, pass, fail) => ({
  status: "rendered-rejected",
  asset,
  audit: { pass, fail },
});
const outputBlocked = (requestId) => ({
  status: "output-safety-blocked",
  requestId,
  moderationStage: "output",
  category: "sexual",
  assetCreated: false,
});

const sceneResults = {
  "1232": {
    raw: renderedRejected(
      assets.raw1232,
      [
        "exactly four clearly adult women, Bernini colonnade, snow flurries, large secular Vatican motifs, PAWS, the Vatican-palette hosiery, and complete footwear are present",
        "the four established adult identities and the rolled exposed waists and open backs are broadly readable",
      ],
      [
        "the prop appears in an ownerless detached hand beyond Alia, creating an extra-hand failure",
        "the exact eight-hand inventory is not continuously traceable and several selected contacts are reassigned",
        "the prop index and empty trigger guard are not unambiguously separated",
      ],
    ),
    recovery: renderedRejected(
      assets.recovery1232,
      [
        "exactly four clearly adult women, the colonnade, snow, PAWS, large motifs, Radiance's Vatican-palette hosiery, rolled waists, open backs, and complete footwear are preserved",
        "the affectionate center and blown-kiss beat remain visible",
      ],
      [
        "a detached ownerless prop hand remains beyond Alia, so the scene has a ninth apparent hand and fails the strict anatomy gate",
        "Alia's listed prop arm is not continuously traceable from shoulder through elbow and wrist",
        "the exact eight-hand choreography is not materialized and the safety-index relationship is ownerless",
      ],
    ),
    terminalStatus: "blocked-after-single-recovery-pass",
  },
  "1233": {
    raw: renderedRejected(
      assets.raw1233,
      [
        "exactly four clearly adult women, Momo staircase, lightning, PAWS, ECE's original-rainbow hosiery, large secular motifs, and complete footwear are present",
        "Alia holds the inert prop toward an empty side passage",
      ],
      [
        "Ellie's forearm catch and ECE's waist contact are absent or reassigned",
        "PAWS support and central hand ownership are ambiguous, so the exact eight-hand inventory fails",
        "Alia's rolled exposed waist and belly button are not clearly materialized and the trigger index is too close to the guard",
      ],
    ),
    recovery: renderedRejected(
      assets.recovery1233,
      [
        "exactly four clearly adult women, Momo staircase, lightning, PAWS, large secular motifs, ECE's independent-rainbow hosiery, and complete footwear are preserved",
        "Alia's prop arm is connected and points into an empty passage",
      ],
      [
        "ECE's free hand and Ellie's kitten-support hand are hidden or missing, leaving fewer than eight continuously traceable hands",
        "the required forearm catch, waist contacts, and PAWS support are reassigned",
        "the magazine-free manipulation and trigger-index separation are not unambiguously readable",
      ],
    ),
    terminalStatus: "blocked-after-single-recovery-pass",
  },
  "1234": {
    raw: renderedRejected(
      assets.raw1234,
      [
        "exactly four clearly adult women, Vatican Gardens, windstorm, conservation details, large secular motifs, ECE's exposed waist and open back, and complete footwear are present",
        "the inert prop points across empty water",
      ],
      [
        "the exact eight-hand inventory is reassigned: the ECE-Radiance link, Ellie shoulder pair, and Alia blown kiss do not match the stored plan",
        "multiple central arms and hands have hidden or ambiguous owners",
        "the prop index and empty guard are not unambiguously separated",
      ],
    ),
    recovery: renderedRejected(
      assets.recovery1234,
      [
        "exactly four clearly adult women, Vatican Gardens, windstorm, large secular motifs, cleaner-service silhouettes, ECE's open back, and complete footwear are preserved",
        "the inert prop points outward across empty garden water",
      ],
      [
        "the central shoulder and face-touch cluster has ambiguous arm ownership and the exact eight-hand inventory is not continuously traceable",
        "Ellie's two specified shoulder contacts and Alia's waist hold and blown kiss are absent or reassigned",
        "the prop arm emerges from behind ECE without a fully visible shoulder-to-wrist path, so the strict anatomy gate fails",
      ],
    ),
    terminalStatus: "blocked-after-single-recovery-pass",
  },
  "1235": {
    raw: outputBlocked("2d582eeb-ae1f-4d93-a810-5d0c9a369f10"),
    recovery: outputBlocked("fd7778f4-498e-4466-9541-c931d9b0dd20"),
    terminalStatus: "blocked-after-single-recovery-pass",
  },
};

const rejectedAssets = [
  assets.raw1232,
  assets.recovery1232,
  assets.raw1233,
  assets.recovery1233,
  assets.raw1234,
  assets.recovery1234,
];

const checkpoint = {
  ...preflight,
  status: "terminal-blocked-after-single-recovery-pass",
  promptAudit: {
    raw: rawPromptRecords,
    recovery: recoveryPromptRecords,
  },
  renderAttempts: {
    raw: {
      status: "complete",
      requested: 4,
      rendered: 3,
      outputSafetyBlocked: 1,
      accepted: 0,
      rejected: 4,
      concurrency: "four independent built-in image generation calls",
      orchestrationNote: "All four raw calls were started together. Scenes 1232 through 1234 returned assets and Scene 1235 was blocked at output moderation.",
    },
    recovery: {
      status: "complete",
      requested: 4,
      rendered: 3,
      outputSafetyBlocked: 1,
      accepted: 0,
      rejected: 4,
      maximumPerBlockedScene: 1,
      allowanceExhaustedForScenes: [1232, 1233, 1234, 1235],
      orchestrationNote: "All four final attempts were started together. Scenes 1232 through 1234 returned recovery variants and Scene 1235 was again blocked at output moderation. No further render was started.",
    },
    scenes: sceneResults,
  },
  acceptedAssets: [],
  rejectedAssets,
  xPost: {
    status: "deferred-insufficient-accepted-assets",
    minimumCurrentCountryAcceptedAssets: 2,
    acceptedCurrentCountryAssets: 0,
    publishAttempted: false,
    postButtonClicked: false,
    reason: "The signed-in X profile was checked on direct request, but the prepared queue was empty and Vatican City produced zero accepted assets. Posting would duplicate an audited public batch or bypass the current-country acceptance gate.",
    captionRolls: preflight.xPublishingRolls,
    eligibleCaptionShapeIfAssetsExisted: "Vatican City red-heart Djibouti #VaticanCity",
    hashtagsSuppressedByRoll: ["#InternalAgency", "#WorldXXXSeries"],
    backlogAudit: {
      signedInProfile: "@dogramaci",
      pendingPost: null,
      preparedPostQueueCount: 0,
      deferredPostCheckpoint: null,
      previouslyAuditedPublicDrain: "Batches 285 through 299, 51 public statuses, publicly-clear-live-audited",
      post299Eligibility: "Batches 300 through 303 each have zero accepted current-country assets",
      result: "no eligible backlog item and no duplicate submission",
    },
  },
  terminalizedAt: new Date().toISOString(),
  checkpointType: "narrow-country-batch-recovery-checkpoint",
  shorteningVariants: {
    status: "not-created",
    reason: "No render passed the strict anatomy, prop-safety, identity, roll, and relationship gates. Raw and recovery outputs remain preserved.",
  },
  queueAdvance: {
    previousCountry: "Vatican City",
    previousBatch: 303,
    previousTerminalStatus: "terminal-blocked-after-single-recovery-pass",
    nextCountry: "Djibouti",
    nextBatch: 251,
    nextScenes: [1027],
    nextQueueAction: "one recovery attempt for blocked Djibouti Scene 1027, then resume the prior country order",
    nextThemePair: preflight.nextThemePair,
    reason: "The binding terminal-batch rule advances after the single recovery pass even when zero assets are accepted.",
  },
  repositoryScope: {
    checkpointPath: "assets/lore/starlight-era/batch-303-vatican-city-recovery-checkpoint.json",
    stagedFiles: [
      "assets/lore/starlight-era/batch-303-vatican-city-recovery-checkpoint.json",
    ],
    xLedgerUpdated: false,
    unrelatedDirtyFilesLeftUntouched: [
      "assets/lore/starlight-era/overnight-campaign.json",
      "assets/lore/starlight-era/world-195x4-campaign.json",
      "assets/lore/starlight-era/world-x-publish-ledger.json",
      "assets/videos/manifest.json",
    ],
  },
};

writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(checkpointPath);
