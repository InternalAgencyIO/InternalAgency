import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const rel = (...parts) => path.join(...parts).replaceAll("\\", "/");
const abs = (relativePath) => path.join(root, relativePath);
const sha256 = (relativePath) => crypto.createHash("sha256").update(fs.readFileSync(abs(relativePath))).digest("hex").toUpperCase();

function fileArtifact(relativePath) {
  return { path: relativePath, bytes: fs.statSync(abs(relativePath)).size, sha256: sha256(relativePath) };
}

function pngArtifact({ scene, attempt, workspacePath, generatedPath }) {
  const buffer = fs.readFileSync(abs(workspacePath));
  if (buffer.toString("ascii", 1, 4) !== "PNG") throw new Error(`Not a PNG: ${workspacePath}`);
  return {
    scene,
    attempt,
    generatedName: path.basename(generatedPath),
    workspacePath,
    absoluteGeneratedPath: generatedPath,
    bytes: buffer.length,
    sha256: crypto.createHash("sha256").update(buffer).digest("hex").toUpperCase(),
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    preservedOriginal: true,
    copiedToAcceptedAssets: false,
  };
}

function promptArtifact(scene, attempt) {
  const suffix = attempt === "raw" ? "prompt" : "recovery-prompt";
  const promptPath = rel("tmp", "world-195x4", "batch-309", `scene-${scene}-${suffix}.txt`);
  return { scene, attempt, ...fileArtifact(promptPath) };
}

const preflightPath = rel("tmp", "world-195x4", "batch-309", "batch-309-uruguay-preflight.json");
const preflight = JSON.parse(fs.readFileSync(abs(preflightPath), "utf8"));
const generatedRoot = "C:\\Users\\A\\.codex\\generated_images\\019fd625-0bf6-78d2-9fb8-3f3e22c1d086";

const assets = {
  raw1256: pngArtifact({
    scene: 1256,
    attempt: "raw",
    workspacePath: rel("tmp", "world-195x4", "batch-309", "1256-uruguay-montevideo-double-rainbow-raw.png"),
    generatedPath: path.join(generatedRoot, "exec-516c9032-b78f-40f6-b408-e2f63976c740.png"),
  }),
  raw1257: pngArtifact({
    scene: 1257,
    attempt: "raw",
    workspacePath: rel("tmp", "world-195x4", "batch-309", "1257-uruguay-punta-del-este-mammatus-male-paws-raw.png"),
    generatedPath: path.join(generatedRoot, "exec-1df62e86-31f5-4d5f-84b3-176797e3a1db.png"),
  }),
  raw1258: pngArtifact({
    scene: 1258,
    attempt: "raw",
    workspacePath: rel("tmp", "world-195x4", "batch-309", "1258-uruguay-colonia-blue-hour-raw.png"),
    generatedPath: path.join(generatedRoot, "exec-ea83a574-0afd-4ab4-a859-af9a7bab0f50.png"),
  }),
  raw1259: pngArtifact({
    scene: 1259,
    attempt: "raw",
    workspacePath: rel("tmp", "world-195x4", "batch-309", "1259-uruguay-cabo-polonio-lightning-raw.png"),
    generatedPath: path.join(generatedRoot, "exec-1a550a00-7ce9-4e9d-ac2b-5e920f159178.png"),
  }),
};

const prompts = {
  raw: [1256, 1257, 1258, 1259].map((scene) => promptArtifact(scene, "raw")),
  recovery: [1256, 1257, 1258, 1259].map((scene) => promptArtifact(scene, "recovery")),
};

const auditCrops = Object.fromEntries([1256, 1257, 1258, 1259].map((scene) => {
  const cropPath = rel("tmp", "world-195x4", "batch-309", `${scene}-raw-prop-audit.png`);
  return [scene, { scene, attempt: "raw", ...fileArtifact(cropPath) }];
}));

const promptFor = (scene, attempt) => prompts[attempt].find((entry) => entry.scene === scene);
const concurrentRecoveryFailure = {
  status: "no-output-after-concurrent-recovery-set-failure",
  returnedImage: false,
  concurrentSetRequestId: "71ff71ee-b498-49e7-9f81-adcaeb4a7e9b",
  knownSetFailureCategory: "sexual",
  laneAttribution: "The aggregate Promise rejection did not identify which one of the four concurrently launched scene calls produced the moderation block.",
  siblingDrainCheck: "No recovery image appeared in the generated-image directory during the immediate check or the later ninety-second drain check.",
};

const sceneResults = {
  "1256": {
    status: "terminal-rejected-after-recovery-set-failure",
    raw: {
      status: "rendered-rejected",
      asset: assets.raw1256,
      prompt: promptFor(1256, "raw"),
      auditCrop: auditCrops[1256],
      pass: [
        "Exactly four clearly adult women, Montevideo's Rambla and skyline, a complete double rainbow, mate and thermos, three candombe drums, football and food signals, tiny PAWS, full footwear, four distinct silhouettes, and two large complete Sun of May fields are present.",
        "Radiance's sadness, ECE's controlled anger, Alia's braided identity, and multiple public affectionate contacts read clearly.",
      ],
      fail: [
        "The original-resolution crop confirms ECE's index finger enters the trigger guard.",
        "Ellie's rolled ordinary navel is not visible while her open back faces the camera.",
        "Several contact arms pass behind torsos, leaving hidden or ambiguous owner paths, so exactly eight traceable arms and hands cannot be certified.",
      ],
    },
    recovery: { ...concurrentRecoveryFailure, prompt: promptFor(1256, "recovery") },
    recoveryAllowanceExhausted: true,
  },
  "1257": {
    status: "terminal-rejected-after-recovery-set-failure",
    raw: {
      status: "rendered-rejected",
      asset: assets.raw1257,
      prompt: promptFor(1257, "raw"),
      auditCrop: auditCrops[1257],
      pass: [
        "Exactly five clearly adult people plus tiny PAWS, Punta del Este's paired coasts, lighthouse, marina, skyline, giant sand fingers, mammatus storm ceiling, the established bearded male in a fitted short-sleeve polo and black jeans, complete footwear, and two large Sun of May fields are present.",
        "The husband has clear contact with ECE and Ellie, and his strongest head and pupil direction remains on ECE.",
      ],
      fail: [
        "The original-resolution crop confirms ECE's index finger rests inside the trigger guard.",
        "Alia's rolled fully strapless cut becomes a one-shoulder top.",
        "Radiance does not show the rolled full sobbing performance with clear tear tracks and shaking posture.",
        "At least one central contact arm is hidden behind a torso, so exactly ten continuously traceable arms and hands cannot be certified.",
      ],
    },
    recovery: { ...concurrentRecoveryFailure, prompt: promptFor(1257, "recovery") },
    recoveryAllowanceExhausted: true,
  },
  "1258": {
    status: "terminal-rejected-after-recovery-set-failure",
    raw: {
      status: "rendered-rejected",
      asset: assets.raw1258,
      prompt: promptFor(1258, "raw"),
      auditCrop: auditCrops[1258],
      pass: [
        "Exactly four clearly adult women, Colonia del Sacramento's cobbles, pastel facades, lighthouse, city gate and river, crisp blue hour, four distinct runway silhouettes, full footwear, two complete Sun of May fields, and large historic-quarter motifs are present.",
        "Radiance's and Alia's open backs, all four identities, Alia's braids, and multiple affectionate contacts read clearly.",
      ],
      fail: [
        "The original-resolution crop confirms ECE's index finger enters the trigger guard.",
        "Radiance's and Alia's rolled ordinary navels are not visible in their back-facing poses.",
        "The waist and low linked-hand contacts contain hidden owner paths and drift from the stored inventory, so exactly eight traceable arms and hands cannot be certified.",
      ],
    },
    recovery: { ...concurrentRecoveryFailure, prompt: promptFor(1258, "recovery") },
    recoveryAllowanceExhausted: true,
  },
  "1259": {
    status: "terminal-rejected-after-recovery-set-failure",
    raw: {
      status: "rendered-rejected",
      asset: assets.raw1259,
      prompt: promptFor(1259, "raw"),
      auditCrop: auditCrops[1259],
      pass: [
        "Exactly four clearly adult women, Cabo Polonio lighthouse, dunes, rocky coast, distant sea lions and birds, active distant lightning, four distinct runway silhouettes, full footwear, two large complete Sun of May fields, Alia's complete open back, and ECE's rolled ordinary navel are present.",
      ],
      fail: [
        "The original-resolution crop confirms ECE's index finger curls inside the trigger guard.",
        "The Alia and Ellie shoulder contact forms an overlapping finger cluster while other stored hand positions are missing, so exactly eight separated owner-traceable hands cannot be certified.",
      ],
    },
    recovery: { ...concurrentRecoveryFailure, prompt: promptFor(1259, "recovery") },
    recoveryAllowanceExhausted: true,
  },
};

const ledgerPath = rel("assets", "lore", "starlight-era", "world-x-publish-ledger.json");
const ledger = JSON.parse(fs.readFileSync(abs(ledgerPath), "utf8"));

const checkpoint = {
  ...preflight,
  status: "terminal-blocked-after-single-recovery-pass",
  renderAttempts: {
    raw: {
      status: "complete",
      execution: "Four independent built-in image generation calls completed concurrently.",
      requested: 4,
      returnedImages: 4,
      moderationBlockedNoOutput: 0,
    },
    recovery: {
      status: "complete-exhausted-no-output",
      execution: "One independent edit recovery call per scene was launched concurrently. The aggregate call failed after one output-stage moderation block; no sibling recovery image materialized during the later drain check.",
      requested: 4,
      returnedImages: 0,
      knownModerationBlocks: 1,
      siblingCallsWithoutOutput: 3,
      maximumPerBlockedScene: 1,
    },
    total: {
      requested: 8,
      returnedImages: 4,
      acceptedImages: 0,
      rejectedImages: 4,
    },
  },
  acceptedAssets: [],
  rejectedAssets: Object.values(assets),
  moderationBlocks: [{
    attempt: "recovery-concurrent-set",
    scenesLaunched: [1256, 1257, 1258, 1259],
    requestId: "71ff71ee-b498-49e7-9f81-adcaeb4a7e9b",
    category: "sexual",
    moderationStage: "output",
    returnedImage: false,
    laneAttribution: "unknown-within-concurrent-set",
  }],
  checkpointType: "terminal-country-recovery-checkpoint",
  preflightPath,
  preflightSha256: sha256(preflightPath),
  promptArtifacts: prompts,
  auditCrops: Object.values(auditCrops),
  renderedAssets: Object.values(assets),
  sceneResults,
  shorteningVariants: {
    status: "not-created",
    reason: "Every raw image failed the trigger-index and strict anatomy gates, and no recovery image materialized. All raw originals remain preserved.",
  },
  xPost: {
    status: "deferred-insufficient-accepted-assets",
    publishAttempted: false,
    postButtonClicked: false,
    currentCountryAcceptedAssetCount: 0,
    minimumCurrentCountryAcceptedAssets: 2,
    reason: "Uruguay has zero accepted current-country images, so no eligible two-main-plus-one-secondary attachment group exists.",
    captionRolls: preflight.xPublishingRolls,
    eligibleCaptionShapeIfAssetsHadPassed: "Uruguay red heart Comoros #Uruguay #InternalAgency",
    hashtagsSuppressedByRoll: ["#WorldXXXSeries"],
    ledger: {
      path: ledgerPath,
      sha256: sha256(ledgerPath),
      pendingPost: ledger.pendingPost,
      preparedPostQueueCount: ledger.preparedPostQueue.length,
      deferredPostCheckpoint: ledger.deferredPostCheckpoint,
      residualImageNumbers: ledger.preRenderBacklogResidualImageNumbers,
      backlogDrainStatus: "drained-clear",
      preRenderBacklogStatus: ledger.preRenderBacklogStatus,
      latestAssistedDrainStatus: ledger.latestAssistedDrain.status,
    },
    action: "No browser submission was opened because the two-current-country-image publishing threshold was not met.",
  },
  queueAdvance: {
    completedCountry: "Uruguay",
    completedBatch: 309,
    terminalStatus: "terminal-blocked-after-single-recovery-pass",
    nextCountry: "Botswana",
    nextBatch: 310,
    nextScenes: [1260, 1261, 1262, 1263],
    nextThemePair: ["Paris runway model couture", "cleaner and service couture"],
    reason: "A terminal zero-accepted batch advances after its one recovery pass under the binding queue rule.",
  },
  repositoryScope: {
    checkpointPath: rel("assets", "lore", "starlight-era", "batch-309-uruguay-recovery-checkpoint.json"),
    stagedFiles: [rel("assets", "lore", "starlight-era", "batch-309-uruguay-recovery-checkpoint.json")],
    acceptedAssetsCopied: [],
    acceptedAssetCopied: false,
    xLedgerUpdated: false,
    unrelatedDirtyFilesLeftUntouched: [
      rel("assets", "lore", "starlight-era", "overnight-campaign.json"),
      rel("assets", "lore", "starlight-era", "world-195x4-campaign.json"),
      ledgerPath,
      rel("assets", "videos", "manifest.json"),
    ],
  },
  terminalizedAt: new Date().toISOString(),
};

const checkpointPath = checkpoint.repositoryScope.checkpointPath;
fs.writeFileSync(abs(checkpointPath), `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  checkpointPath,
  bytes: fs.statSync(abs(checkpointPath)).size,
  sha256: sha256(checkpointPath),
  accepted: checkpoint.acceptedAssets.length,
  rejected: checkpoint.rejectedAssets.length,
  next: checkpoint.queueAdvance,
}, null, 2));
