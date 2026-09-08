import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const rel = (...parts) => path.join(...parts).replaceAll("\\", "/");
const abs = (relativePath) => path.join(root, relativePath);
const sha256 = (relativePath) => crypto
  .createHash("sha256")
  .update(fs.readFileSync(abs(relativePath)))
  .digest("hex")
  .toUpperCase();

function fileArtifact(relativePath) {
  const stat = fs.statSync(abs(relativePath));
  return {
    path: relativePath,
    bytes: stat.size,
    sha256: sha256(relativePath),
  };
}

function pngArtifact({ scene, attempt, workspacePath, generatedPath }) {
  const buffer = fs.readFileSync(abs(workspacePath));
  if (buffer.toString("ascii", 1, 4) !== "PNG") {
    throw new Error(`Not a PNG: ${workspacePath}`);
  }
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
  const promptPath = rel("tmp", "world-195x4", "batch-308", `scene-${scene}-${suffix}.txt`);
  return { scene, attempt, ...fileArtifact(promptPath) };
}

const preflightPath = rel("tmp", "world-195x4", "batch-308", "batch-308-bhutan-preflight.json");
const preflight = JSON.parse(fs.readFileSync(abs(preflightPath), "utf8"));
const generatedRoot = "C:\\Users\\A\\.codex\\generated_images\\019fd625-0bf6-78d2-9fb8-3f3e22c1d086";

const assets = {
  raw1253: pngArtifact({
    scene: 1253,
    attempt: "raw",
    workspacePath: rel("tmp", "world-195x4", "batch-308", "1253-bhutan-punakha-thunderstorm-raw.png"),
    generatedPath: path.join(generatedRoot, "exec-6618a244-d401-45ce-b305-5582c44f857d.png"),
  }),
  recovery1252: pngArtifact({
    scene: 1252,
    attempt: "recovery",
    workspacePath: rel("tmp", "world-195x4", "batch-308", "1252-bhutan-paro-blue-hour-recovery.png"),
    generatedPath: path.join(generatedRoot, "exec-f29a5a89-3a59-40de-839b-f3f09d0c5925.png"),
  }),
  recovery1253: pngArtifact({
    scene: 1253,
    attempt: "recovery",
    workspacePath: rel("tmp", "world-195x4", "batch-308", "1253-bhutan-punakha-thunderstorm-recovery.png"),
    generatedPath: path.join(generatedRoot, "exec-3a4003bb-a45e-4cec-a04e-700349cee407.png"),
  }),
  recovery1254: pngArtifact({
    scene: 1254,
    attempt: "recovery",
    workspacePath: rel("tmp", "world-195x4", "batch-308", "1254-bhutan-phobjikha-rain-male-paws-hosiery-recovery.png"),
    generatedPath: path.join(generatedRoot, "exec-edc1dcd4-e1d4-4797-a130-9c23878b6b5d.png"),
  }),
  recovery1255: pngArtifact({
    scene: 1255,
    attempt: "recovery",
    workspacePath: rel("tmp", "world-195x4", "batch-308", "1255-bhutan-thimphu-heat-lightning-pole-recovery.png"),
    generatedPath: path.join(generatedRoot, "exec-68342417-18fa-47b6-a5f7-fefa5fbe0b67.png"),
  }),
};

const prompts = {
  raw: [1252, 1253, 1254, 1255].map((scene) => promptArtifact(scene, "raw")),
  recovery: [1252, 1253, 1254, 1255].map((scene) => promptArtifact(scene, "recovery")),
};

const auditCrops = Object.fromEntries([1252, 1253, 1254, 1255].map((scene) => {
  const cropPath = rel("tmp", "world-195x4", "batch-308", `${scene}-recovery-prop-audit.png`);
  return [scene, { scene, attempt: "recovery", ...fileArtifact(cropPath) }];
}));

const promptFor = (scene, attempt) => prompts[attempt].find((entry) => entry.scene === scene);

const sceneResults = {
  "1252": {
    status: "terminal-rejected-after-recovery",
    raw: {
      status: "moderation-blocked-no-output",
      requestId: "eb2a42d6-ec90-473b-97cf-9ff086bd3820",
      category: "sexual",
      returnedImage: false,
      workspacePath: null,
      prompt: promptFor(1252, "raw"),
      fail: ["The built-in image call returned no pixels, so the raw attempt could not be audited or accepted."],
    },
    recovery: {
      status: "rendered-rejected",
      asset: assets.recovery1252,
      prompt: promptFor(1252, "recovery"),
      auditCrop: auditCrops[1252],
      pass: [
        "Exactly four clearly adult women, Rinpung Dzong, Paro Valley, crisp blue-hour weather, archery and food displays, four recognizable identities, full footwear, two large complete Druk motifs, and multiple affectionate contacts are present.",
        "Radiance and Ellie show their rolled visible waists and ordinary navels, and Radiance's strapless construction is visible.",
      ],
      fail: [
        "Radiance's and Alia's rolled completely open backs are not visible because both face the camera from front or shallow three-quarter views.",
        "The linked central hand chain contains hidden or ambiguous owner paths, so exactly eight continuously traceable arms and hands cannot be certified.",
        "The original-resolution crop confirms ECE's index finger curls inside the trigger guard instead of staying straight on the outer frame.",
      ],
    },
    recoveryAllowanceExhausted: true,
  },
  "1253": {
    status: "terminal-rejected-after-recovery",
    raw: {
      status: "rendered-rejected",
      asset: assets.raw1253,
      prompt: promptFor(1253, "raw"),
      pass: [
        "Exactly four clearly adult women, Punakha Dzong, both bridges, the visibly different Pho Chhu and Mo Chhu confluence, rolling thunderstorm weather, full footwear, large Druk motifs, and every rolled visible navel are present.",
      ],
      fail: [
        "Radiance's and ECE's strapless silhouettes read too similarly for the binding all-four-different-style requirement.",
        "The central contact chain contains hidden or ambiguous hand ownership, so exactly eight traceable arms and hands cannot be certified.",
        "ECE's index finger enters the trigger guard instead of staying straight on the outer frame.",
      ],
    },
    recovery: {
      status: "rendered-rejected",
      asset: assets.recovery1253,
      prompt: promptFor(1253, "recovery"),
      auditCrop: auditCrops[1253],
      pass: [
        "Punakha Dzong, both bridges, confluence colors, storm weather, identities, large complete Druk motifs, full footwear, and distinct outfit architecture are preserved.",
        "ECE's white architectural peplum separates her silhouette more clearly from Radiance's outfit.",
      ],
      fail: [
        "ECE's rolled visible waist and ordinary navel are hidden by the recovery peplum.",
        "The central contact chain still contains hidden or ambiguous hand ownership, so exactly eight traceable arms and hands cannot be certified.",
        "The original-resolution crop confirms ECE's index finger remains inside the trigger guard.",
      ],
    },
    recoveryAllowanceExhausted: true,
  },
  "1254": {
    status: "terminal-rejected-after-recovery",
    raw: {
      status: "moderation-blocked-no-output",
      requestId: "1e3ed076-0153-4e16-9685-d545abb1180b",
      category: "sexual",
      returnedImage: false,
      workspacePath: null,
      prompt: promptFor(1254, "raw"),
      fail: ["The built-in image call returned no pixels, so the raw attempt could not be audited or accepted."],
    },
    recovery: {
      status: "rendered-rejected",
      asset: assets.recovery1254,
      prompt: promptFor(1254, "recovery"),
      auditCrop: auditCrops[1254],
      pass: [
        "Exactly five clearly adult people plus one tiny golden kitten, Phobjikha Valley, heavy rain, distant black-necked cranes, the established bearded male in a fitted polo and black jeans, two large complete Druk motifs, and full footwear are present.",
        "Alia visibly cries while she alone handles the inert prop; ECE wears the exact Bhutan-palette rainbow knee socks; PAWS stays securely on the male's shoulder far from the prop; the male has multiple contacts and his strongest eye line lands on ECE.",
      ],
      fail: [
        "Ellie's rolled completely open back is not visible because she faces front.",
        "Alia's dress extends below the knee instead of remaining above-knee.",
        "At least one ECE hand has a hidden or ambiguous owner path, so exactly ten continuously traceable arms and hands cannot be certified.",
        "The original-resolution crop confirms Alia's index finger is inside the trigger guard.",
      ],
    },
    recoveryAllowanceExhausted: true,
  },
  "1255": {
    status: "terminal-rejected-after-recovery",
    raw: {
      status: "moderation-blocked-no-output",
      requestId: "0282646a-63ed-4b2d-8f95-32f5fd3929bb",
      category: "sexual",
      returnedImage: false,
      workspacePath: null,
      prompt: promptFor(1255, "raw"),
      fail: ["The built-in image call returned no pixels, so the raw attempt could not be audited or accepted."],
    },
    recovery: {
      status: "rendered-rejected",
      asset: assets.recovery1255,
      prompt: promptFor(1255, "recovery"),
      auditCrop: auditCrops[1255],
      pass: [
        "Exactly four clearly adult women, one polished route-marker pole, Thimphu city and river, Tashichho-style architecture, silent heat lightning, four distinct outfits, two large complete Druk motifs, additional takin and blue-poppy fields, and full footwear are present.",
        "ECE's strapless and completely open-back construction reads clearly, and the pole remains a public-safe grounded athletic route-marker pose.",
      ],
      fail: [
        "ECE's rolled visible waist and ordinary navel are not visible because her front turns away from the camera.",
        "Radiance's asymmetrical dress has a long front panel extending below the knee.",
        "The ECE and Alia contact cluster contains hidden or ambiguous hand ownership, so exactly eight continuously traceable arms and hands cannot be certified.",
        "The original-resolution crop confirms ECE's index finger curls inside the trigger guard instead of staying straight on the outer frame.",
      ],
    },
    recoveryAllowanceExhausted: true,
  },
};

const ledgerPath = rel("assets", "lore", "starlight-era", "world-x-publish-ledger.json");
const ledger = JSON.parse(fs.readFileSync(abs(ledgerPath), "utf8"));

const checkpoint = {
  ...preflight,
  status: "terminal-blocked-after-single-recovery-pass",
  renderAttempts: {
    execution: "Four independent raw calls were attempted serially because this host exposed no supported image-call fan-out primitive.",
    raw: {
      status: "complete",
      requested: 4,
      returnedImages: 1,
      moderationBlockedNoOutput: 3,
    },
    recovery: {
      status: "complete-exhausted",
      requested: 4,
      returnedImages: 4,
      moderationBlockedNoOutput: 0,
      maximumPerBlockedScene: 1,
    },
    total: {
      requested: 8,
      returnedImages: 5,
      acceptedImages: 0,
      rejectedImages: 5,
    },
  },
  acceptedAssets: [],
  rejectedAssets: Object.values(assets),
  moderationBlocks: [
    { scene: 1252, attempt: "raw", requestId: "eb2a42d6-ec90-473b-97cf-9ff086bd3820", category: "sexual", returnedImage: false },
    { scene: 1254, attempt: "raw", requestId: "1e3ed076-0153-4e16-9685-d545abb1180b", category: "sexual", returnedImage: false },
    { scene: 1255, attempt: "raw", requestId: "0282646a-63ed-4b2d-8f95-32f5fd3929bb", category: "sexual", returnedImage: false },
  ],
  checkpointType: "terminal-country-recovery-checkpoint",
  preflightPath,
  preflightSha256: sha256(preflightPath),
  promptArtifacts: prompts,
  auditCrops: Object.values(auditCrops),
  renderedAssets: Object.values(assets),
  sceneResults,
  shorteningVariants: {
    status: "not-created",
    reason: "Every recovery failed a stricter trigger-index, anatomy, rolled-cut, or eye-line gate before garment-length repair could make the image acceptable. Originals remain preserved.",
  },
  xPost: {
    status: "deferred-insufficient-accepted-assets",
    publishAttempted: false,
    postButtonClicked: false,
    currentCountryAcceptedAssetCount: 0,
    minimumCurrentCountryAcceptedAssets: 2,
    reason: "Bhutan has zero accepted current-country images, so no eligible two-main-plus-one-secondary attachment group exists.",
    captionRolls: preflight.xPublishingRolls,
    eligibleCaptionShapeIfAssetsHadPassed: "Bhutan red heart Comoros #Bhutan",
    hashtagsSuppressedByRoll: ["#InternalAgency", "#WorldXXXSeries"],
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
    completedCountry: "Bhutan",
    completedBatch: 308,
    terminalStatus: "terminal-blocked-after-single-recovery-pass",
    nextCountry: "Uruguay",
    nextBatch: 309,
    nextScenes: [1256, 1257, 1258, 1259],
    nextThemePair: ["adult nightlife dance-performance couture", "Paris runway model couture"],
    reason: "A terminal zero-accepted batch advances after its one recovery pass under the binding queue rule.",
  },
  repositoryScope: {
    checkpointPath: rel("assets", "lore", "starlight-era", "batch-308-bhutan-recovery-checkpoint.json"),
    stagedFiles: [rel("assets", "lore", "starlight-era", "batch-308-bhutan-recovery-checkpoint.json")],
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
