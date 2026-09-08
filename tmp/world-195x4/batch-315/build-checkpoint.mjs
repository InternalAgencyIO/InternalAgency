import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const repo = process.cwd();
const tmp = path.join(repo, "tmp", "world-195x4", "batch-315");
const preflightPath = path.join(tmp, "batch-315-solomon-islands-preflight.json");
const checkpointPath = path.join(
  repo,
  "assets",
  "lore",
  "starlight-era",
  "batch-315-solomon-islands-recovery-checkpoint.json",
);
const ledgerPath = path.join(
  repo,
  "assets",
  "lore",
  "starlight-era",
  "world-x-publish-ledger.json",
);

const sha256 = (filePath) =>
  crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").toUpperCase();

function pngMetadata(filePath) {
  const bytes = fs.readFileSync(filePath);
  if (bytes.toString("ascii", 1, 4) !== "PNG") {
    throw new Error(`Expected PNG: ${filePath}`);
  }
  return {
    bytes: bytes.length,
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    sha256: crypto.createHash("sha256").update(bytes).digest("hex").toUpperCase(),
  };
}

const generatedRoot = "C:\\Users\\A\\.codex\\generated_images\\019fd625-0bf6-78d2-9fb8-3f3e22c1d086";
const attempts = [
  {
    scene: 1280,
    attempt: "raw",
    status: "rendered-rejected-by-strict-audit",
    generatedName: "exec-67e3d28e-adb0-4e02-8418-1004fedd405f.png",
    absoluteGeneratedPath: `${generatedRoot}\\exec-67e3d28e-adb0-4e02-8418-1004fedd405f.png`,
    workspacePath: "tmp/world-195x4/batch-315/raw/1280-raw.png",
    ...pngMetadata(path.join(tmp, "raw", "1280-raw.png")),
    preservedOriginal: true,
    copiedToAcceptedAssets: false,
    reason:
      "The quartet, Matanikau setting, light rain, large Solomon Islands outfit motifs, and inert prop are present, but Alia's second arm and hand are hidden between torsos, so exactly eight continuously traceable arms and hands cannot be verified. The frozen hand inventory and separate holographic map are also not fully materialized.",
  },
  {
    scene: 1281,
    attempt: "raw",
    status: "blocked-output-moderation-no-image",
    category: "sexual",
    requestId: "9c43b59a-c976-4263-a7f2-db1979daa7bc",
    reason: "The raw renderer returned no image artifact.",
  },
  {
    scene: 1282,
    attempt: "raw",
    status: "rendered-rejected-by-strict-audit",
    generatedName: "exec-a8894bb9-112e-42c1-9578-5a9735e14654.png",
    absoluteGeneratedPath: `${generatedRoot}\\exec-a8894bb9-112e-42c1-9578-5a9735e14654.png`,
    workspacePath: "tmp/world-195x4/batch-315/raw/1282-raw.png",
    ...pngMetadata(path.join(tmp, "raw", "1282-raw.png")),
    preservedOriginal: true,
    copiedToAcceptedAssets: false,
    reason:
      "The five adults, PAWS, Tetepare setting, large Solomon Islands outfit motifs, and inert prop are present, but the male's strongest eye line goes to Alia instead of ECE. Multiple hands at the Alia-male edge overlap or remain hidden, so exactly ten continuously traceable arms and hands cannot be verified.",
  },
  {
    scene: 1283,
    attempt: "raw",
    status: "blocked-output-moderation-no-image",
    category: "sexual",
    requestId: "998321d7-6921-48e9-b27b-a88684637f75",
    reason: "The raw renderer returned no image artifact.",
  },
  {
    scene: 1280,
    attempt: "recovery",
    status: "rendered-rejected-by-strict-audit",
    generatedName: "exec-4805f227-7688-4d56-9281-c0bb499eb99b.png",
    absoluteGeneratedPath: `${generatedRoot}\\exec-4805f227-7688-4d56-9281-c0bb499eb99b.png`,
    workspacePath: "tmp/world-195x4/batch-315/recovery/1280-recovery.png",
    ...pngMetadata(path.join(tmp, "recovery", "1280-recovery.png")),
    preservedOriginal: true,
    copiedToAcceptedAssets: false,
    reason:
      "The quartet, Matanikau setting, rain, route map, inert prop, and large complete secular motifs are present, but Alia again has only one continuously traceable arm and hand. Her second limb is hidden between Radiance and Ellie, so the exact eight-arm and eight-hand owner gate fails.",
  },
  {
    scene: 1281,
    attempt: "recovery",
    status: "rendered-rejected-by-strict-audit",
    generatedName: "exec-7ce7d73a-d794-494f-8917-08c846599956.png",
    absoluteGeneratedPath: `${generatedRoot}\\exec-7ce7d73a-d794-494f-8917-08c846599956.png`,
    workspacePath: "tmp/world-195x4/batch-315/recovery/1281-recovery.png",
    ...pngMetadata(path.join(tmp, "recovery", "1281-recovery.png")),
    preservedOriginal: true,
    copiedToAcceptedAssets: false,
    reason:
      "The quartet, Marovo lagoon, lightning, route map, inert prop, and large complete secular motifs are present, but ECE's waist-contact hand and Ellie's supporting contact hand are hidden behind adjacent bodies. The exact eight continuously traceable arms and hands cannot be verified, and Ellie's rolled visible waist panel is absent.",
  },
  {
    scene: 1282,
    attempt: "recovery",
    status: "rendered-rejected-by-strict-audit",
    generatedName: "exec-30bb35ee-24e4-4577-96f0-d2997218d5dd.png",
    absoluteGeneratedPath: `${generatedRoot}\\exec-30bb35ee-24e4-4577-96f0-d2997218d5dd.png`,
    workspacePath: "tmp/world-195x4/batch-315/recovery/1282-recovery.png",
    ...pngMetadata(path.join(tmp, "recovery", "1282-recovery.png")),
    preservedOriginal: true,
    copiedToAcceptedAssets: false,
    reason:
      "The five adults, collarless PAWS, Tetepare setting, route map, inert prop, and large complete secular motifs are present, but the male again looks most strongly at Alia instead of ECE. Several required hands are substituted or hidden between torsos, so the exact ten-arm and ten-hand owner gate also fails.",
  },
  {
    scene: 1283,
    attempt: "recovery",
    status: "blocked-output-moderation-no-image",
    category: "sexual",
    requestId: "1d64f72a-81f8-44d7-af78-d270f8cfcdb5",
    reason: "The single allowed recovery renderer returned no image artifact.",
  },
];

const bySceneAttempt = new Map(attempts.map((item) => [`${item.scene}-${item.attempt}`, item]));
const artifactFields = [
  "scene",
  "attempt",
  "status",
  "generatedName",
  "absoluteGeneratedPath",
  "workspacePath",
  "bytes",
  "width",
  "height",
  "sha256",
  "preservedOriginal",
  "copiedToAcceptedAssets",
  "reason",
];
const pick = (value, fields) => Object.fromEntries(fields.map((field) => [field, value[field]]));

const preflight = JSON.parse(fs.readFileSync(preflightPath, "utf8"));
const ledgerBytes = fs.readFileSync(ledgerPath);
const ledger = JSON.parse(ledgerBytes.toString("utf8"));

const sceneResults = Object.fromEntries(
  [1280, 1281, 1282, 1283].map((scene) => {
    const raw = bySceneAttempt.get(`${scene}-raw`);
    const recovery = bySceneAttempt.get(`${scene}-recovery`);
    return [
      String(scene),
      {
        rawAudit: {
          accepted: false,
          status: raw.status,
          reason: raw.reason,
          requestId: raw.requestId ?? null,
        },
        recoveryAudit: {
          accepted: false,
          status: recovery.status,
          reason: recovery.reason,
          requestId: recovery.requestId ?? null,
        },
        terminalOutcome: "blocked-after-single-recovery-pass",
        acceptedAsset: null,
      },
    ];
  }),
);

const checkpoint = {
  ...preflight,
  status: "terminal-blocked-after-single-recovery-pass",
  renderAttempts: attempts,
  acceptedAssets: [],
  rejectedAssets: [1280, 1281, 1282].map((scene) =>
    pick(bySceneAttempt.get(`${scene}-recovery`), artifactFields),
  ),
  xPost: {
    status: "deferred-insufficient-accepted-assets",
    acceptedCurrentCountryAssets: 0,
    minimumRequired: 2,
    captionIfEligible: preflight.xPublishingPlan.captionIfEligible,
    ledgerModified: false,
    ledgerSha256: crypto.createHash("sha256").update(ledgerBytes).digest("hex").toUpperCase(),
    pendingPost: ledger.pendingPost ?? null,
    preparedQueueCount: Array.isArray(ledger.preparedQueue) ? ledger.preparedQueue.length : 0,
    deferred: ledger.deferred ?? null,
    latestAssistedDrainStatus: ledger.latestAssistedDrain?.status ?? null,
    action:
      "No X post was attempted because Solomon Islands has fewer than two accepted current-country images. The inspected X backlog remains publicly clear.",
  },
  promptMaterialization: {
    deterministicReruns: 2,
    byteStable: true,
    sha256: {
      preflight: sha256(preflightPath),
      primary: Object.fromEntries(
        [1280, 1281, 1282, 1283].map((scene) => [
          String(scene),
          sha256(path.join(tmp, `scene-${scene}-prompt.txt`)),
        ]),
      ),
      recovery: Object.fromEntries(
        [1280, 1281, 1282, 1283].map((scene) => [
          String(scene),
          sha256(path.join(tmp, `scene-${scene}-recovery-prompt.txt`)),
        ]),
      ),
    },
  },
  renderExecution: {
    mode: "built-in image generation",
    rawLaunch: "four independent 9:16 calls launched concurrently with all-settled handling",
    recoveryLaunch: "four independent fresh restrained recovery calls launched concurrently",
    recoveryBudget: "exactly one recovery pass per scene, now exhausted",
  },
  sceneResults,
  shorteningVariants: [],
  queueAdvance: {
    allowed: true,
    reason:
      "The batch is terminal after one raw pass and one recovery pass per scene, so the binding queue advances despite zero accepted assets.",
    nextCountry: "Bhutan",
    nextBatch: 316,
    nextScenes: [1284, 1285, 1286, 1287],
    nextThemePair: [
      "adult nightlife dance-performance couture",
      "Paris runway model couture",
    ],
  },
  remoteStateAtCheckpoint: {
    localBranch: "agent/iat-launch-window",
    sourceHead: "55213c2fb79046335a9e7e9019d1ee9a8959d3da",
    recoveryRemoteBeforeCommit: "55213c2fb79046335a9e7e9019d1ee9a8959d3da",
    originMain: "6cdd669301029c184322c4fa0be124d309e23533",
    headOnlyCommitsAgainstMain: 14,
    mainOnlyCommitsAgainstHead: 2,
    mainAction: "untouched because origin/main has two independent commits",
  },
  repositoryScope: {
    copiedAcceptedAssets: [],
    stagedPaths: [
      "assets/lore/starlight-era/batch-315-solomon-islands-recovery-checkpoint.json",
    ],
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
      renderAttempts: checkpoint.renderAttempts.length,
      nextCountry: checkpoint.queueAdvance.nextCountry,
      xPost: checkpoint.xPost.status,
    },
    null,
    2,
  ),
);
