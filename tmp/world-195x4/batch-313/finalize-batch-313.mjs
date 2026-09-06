import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..", "..", "..");
const batchDir = path.join(root, "tmp", "world-195x4", "batch-313");
const preflightPath = path.join(batchDir, "batch-313-comoros-preflight.json");
const checkpointPath = path.join(
  root,
  "assets",
  "lore",
  "starlight-era",
  "batch-313-comoros-recovery-checkpoint.json",
);

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").toUpperCase();
}

function pngMetadata(filePath) {
  const bytes = fs.readFileSync(filePath);
  return {
    bytes: bytes.length,
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    sha256: crypto.createHash("sha256").update(bytes).digest("hex").toUpperCase(),
  };
}

function renderedAsset({ scene, attempt, generatedName, generatedPath, workspacePath, reason }) {
  return {
    scene,
    attempt,
    generatedName,
    workspacePath: workspacePath.replaceAll("\\", "/"),
    reason,
    absoluteGeneratedPath: generatedPath,
    ...pngMetadata(path.join(root, workspacePath)),
    preservedOriginal: true,
    copiedToAcceptedAssets: false,
  };
}

const preflight = JSON.parse(fs.readFileSync(preflightPath, "utf8"));
const generatedRoot = "C:\\Users\\A\\.codex\\generated_images\\019fd625-0bf6-78d2-9fb8-3f3e22c1d086";

const raw1275Reason =
  "The scene contains the four adults, Mwali setting, rain, large marine motifs, inert prop, and route map, but central hand-owner paths are hidden and the prescribed ECE wrist catch, Ellie waist touch, and exact calming-hand choreography are substituted.";
const recovery1272Reason =
  "Radiance has only one continuously traceable arm and hand because her second arm disappears behind Alia. Several prescribed contacts are also substituted, so the strict eight-arm, eight-hand ownership and exact choreography gates fail.";
const recovery1274Reason =
  "The hosiery trigger is materially wrong: rainbow hosiery appears on Alia rather than selected wearer Radiance. Alia is not the sole prop handler, the expected identity positions are substituted, and the exact male contact choreography is not preserved.";
const recovery1275Reason =
  "ECE touches Ellie's shoulder rather than catching Ellie's wrist, Ellie's free hand hangs instead of touching Radiance's waist, and Alia's waist-touch arm passes behind Radiance. The frozen contact choreography and continuous owner-path anatomy gate therefore fail.";

const renderedAssets = [
  renderedAsset({
    scene: 1275,
    attempt: "raw",
    generatedName: "exec-8d809b58-b79b-430e-b8d6-dbe53fbf5782.png",
    generatedPath: path.join(generatedRoot, "exec-8d809b58-b79b-430e-b8d6-dbe53fbf5782.png"),
    workspacePath: path.join("tmp", "world-195x4", "batch-313", "raw", "1275-raw.png"),
    reason: raw1275Reason,
  }),
  renderedAsset({
    scene: 1272,
    attempt: "recovery",
    generatedName: "exec-3f4d1c6d-6b78-4150-827c-04b61309bc48.png",
    generatedPath: path.join(generatedRoot, "exec-3f4d1c6d-6b78-4150-827c-04b61309bc48.png"),
    workspacePath: path.join("tmp", "world-195x4", "batch-313", "recovery", "1272-recovery.png"),
    reason: recovery1272Reason,
  }),
  renderedAsset({
    scene: 1274,
    attempt: "recovery",
    generatedName: "exec-dd6fab44-be26-4ae4-8ed1-eb6d6c57397b.png",
    generatedPath: path.join(generatedRoot, "exec-dd6fab44-be26-4ae4-8ed1-eb6d6c57397b.png"),
    workspacePath: path.join("tmp", "world-195x4", "batch-313", "recovery", "1274-recovery.png"),
    reason: recovery1274Reason,
  }),
  renderedAsset({
    scene: 1275,
    attempt: "recovery",
    generatedName: "exec-ecc36521-a391-4430-9451-db869fc3187d.png",
    generatedPath: path.join(generatedRoot, "exec-ecc36521-a391-4430-9451-db869fc3187d.png"),
    workspacePath: path.join("tmp", "world-195x4", "batch-313", "recovery", "1275-recovery.png"),
    reason: recovery1275Reason,
  }),
];

const rawBlocks = {
  "1272": {
    status: "blocked-output-moderation-no-image",
    category: "sexual",
    requestId: "8b36a773-2b1b-4928-8890-7838a7be127c",
  },
  "1273": {
    status: "blocked-output-moderation-no-image",
    category: "sexual",
    requestId: "cfaa66da-32dc-49cb-9fac-ee5acb2a74a9",
  },
  "1274": {
    status: "blocked-output-moderation-no-image",
    category: "sexual",
    requestId: "269cc40a-6d8e-4af6-ae13-7041099a559c",
  },
};

const checkpoint = {
  ...preflight,
  status: "terminal-blocked-after-single-recovery-pass",
  renderAttempts: {
    raw: {
      status: "complete",
      requested: 4,
      concurrency: preflight.renderAttempts.raw.concurrency,
      returnedImages: [1275],
      blockedNoImage: rawBlocks,
    },
    recovery: {
      status: "complete-single-pass-exhausted",
      maximumPerBlockedScene: 1,
      attemptedScenes: [1272, 1273, 1274, 1275],
      returnedImages: [1272, 1274, 1275],
      blockedNoImage: {
        "1273": {
          status: "recovery-returned-no-image",
          category: "not-available-in-retained-tool-output",
          requestId: null,
          note: "The concurrent recovery call completed without a Scene 1273 artifact; its detailed error item was not retained in the bounded tool output.",
        },
      },
      acceptedScenes: [],
    },
  },
  acceptedAssets: [],
  rejectedAssets: [1272, 1273, 1274, 1275],
  xPost: {
    status: "deferred-insufficient-accepted-assets",
    minimumCurrentCountryAcceptedAssets: 2,
    acceptedCurrentCountryAssets: 0,
    reason: "Comoros has zero accepted current-country images after its single recovery pass.",
    ledgerModified: false,
  },
  inputHashes: {
    preflightSha256: sha256(preflightPath),
    rawPromptSha256: {
      "1272": "CF0321271CDC379B80D29FCEB36A9C347B9895B0997ACE5272E63FC1193F355C",
      "1273": "5261A9892792F91FA853C781E5274492B5E820ACF00265E649E37EB5B2FD5DF1",
      "1274": "656791BF33836C0260E16288F87D8DB80B6CB8A9AD34D27CFDEA9A3345EA9DD2",
      "1275": "A93317BB2BE5B5C184D17549D537696EE7F0B3B277A3664EEE244BF2CD2BBF35",
    },
    recoveryPromptSha256: {
      "1272": "9A68CFA715804F22E45250FF7F26732FDB44824735C552F230DD81C655FC79A0",
      "1273": "FE41D967F6602537299A2BCF8057B2A1BF24BBD0C519252EA4C7A5E85B983A0C",
      "1274": "FD62D92E61E8A5FB0B593A822B610836E249315FA6DD8C4830AFEBB9739306FE",
      "1275": "5C7E95E43CC98D260CF38008EEF3859227C27317B35C79F83AEE7C9747C8E6DC",
    },
    xPublishingLedgerSha256: sha256(
      path.join(root, "assets", "lore", "starlight-era", "world-x-publish-ledger.json"),
    ),
  },
  renderedAssets,
  sceneResults: {
    "1272": {
      rawAudit: {
        accepted: false,
        reason: "The raw renderer's output moderation returned no image.",
        ...rawBlocks["1272"],
      },
      recoveryAudit: { accepted: false, reason: recovery1272Reason },
      terminalOutcome: "blocked-after-single-recovery-pass",
      acceptedAsset: null,
    },
    "1273": {
      rawAudit: {
        accepted: false,
        reason: "The raw renderer's output moderation returned no image.",
        ...rawBlocks["1273"],
      },
      recoveryAudit: {
        accepted: false,
        reason: "The single allowed recovery call returned no image artifact.",
        status: "recovery-returned-no-image",
        requestId: null,
      },
      terminalOutcome: "blocked-after-single-recovery-pass",
      acceptedAsset: null,
    },
    "1274": {
      rawAudit: {
        accepted: false,
        reason: "The raw renderer's output moderation returned no image.",
        ...rawBlocks["1274"],
      },
      recoveryAudit: { accepted: false, reason: recovery1274Reason },
      terminalOutcome: "blocked-after-single-recovery-pass",
      acceptedAsset: null,
    },
    "1275": {
      rawAudit: { accepted: false, reason: raw1275Reason },
      recoveryAudit: { accepted: false, reason: recovery1275Reason },
      terminalOutcome: "blocked-after-single-recovery-pass",
      acceptedAsset: null,
    },
  },
  shorteningVariants: [],
  queueAdvance: {
    allowed: true,
    reason: "The batch is terminal after one raw pass and one recovery pass per scene, so the binding queue advances despite zero accepted assets.",
    nextCountry: "Guyana",
    nextBatch: 314,
    nextScenes: [1276, 1277, 1278, 1279],
    nextThemePair: ["nurse-care couture", "doctor-clinical-command couture"],
  },
  repositoryScope: {
    copiedAcceptedAssets: [],
    stagedPaths: ["assets/lore/starlight-era/batch-313-comoros-recovery-checkpoint.json"],
    unrelatedDirtyFilesPreserved: [
      "assets/lore/starlight-era/overnight-campaign.json",
      "assets/lore/starlight-era/world-195x4-campaign.json",
      "assets/lore/starlight-era/world-x-publish-ledger.json",
      "assets/videos/manifest.json",
    ],
  },
  terminalizedAt: new Date().toISOString(),
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(
  JSON.stringify(
    {
      checkpointPath,
      checkpointSha256: sha256(checkpointPath),
      status: checkpoint.status,
      acceptedAssets: checkpoint.acceptedAssets.length,
      next: checkpoint.queueAdvance,
    },
    null,
    2,
  ),
);
