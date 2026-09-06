import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = process.cwd();
const batchRoot = path.resolve("tmp/world-195x4/batch-310");
const preflightPath = path.join(batchRoot, "batch-310-botswana-preflight.json");
const checkpointPath = path.resolve("assets/lore/starlight-era/batch-310-botswana-recovery-checkpoint.json");
const ledgerPath = path.resolve("assets/lore/starlight-era/world-x-publish-ledger.json");
const preflightBytes = fs.readFileSync(preflightPath);
const preflight = JSON.parse(preflightBytes.toString("utf8"));
const ledgerBytes = fs.readFileSync(ledgerPath);
const ledger = JSON.parse(ledgerBytes.toString("utf8"));
const generatedRoot = "C:\\Users\\A\\.codex\\generated_images\\019fd625-0bf6-78d2-9fb8-3f3e22c1d086";

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex").toUpperCase();
const slash = (value) => value.replaceAll("\\", "/");
const relative = (value) => slash(path.relative(repo, value));

function pngDimensions(buffer) {
  if (buffer.toString("ascii", 1, 4) !== "PNG") throw new Error("Not a PNG");
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function artifact(workspacePath) {
  const absolute = path.resolve(workspacePath);
  const bytes = fs.readFileSync(absolute);
  return { path: relative(absolute), bytes: bytes.length, sha256: sha256(bytes) };
}

const renderedSpecs = [
  { scene: 1260, attempt: "raw", generatedName: "exec-6b71e2e7-2c1c-4b01-835f-103e2069abbd.png", workspacePath: "tmp/world-195x4/batch-310/1260-botswana-makgadikgadi-sandstorm-paws-raw.png", reason: "The prop-hand index finger visibly curls through the trigger guard. The group overlap also leaves Radiance's second hand ownership ambiguous." },
  { scene: 1261, attempt: "raw", generatedName: "exec-dff4164b-9b38-4196-ac14-bf96a40edeca.png", workspacePath: "tmp/world-195x4/batch-310/1261-botswana-okavango-mist-pole-hosiery-raw.png", reason: "The prop-hand index finger visibly curls through the trigger guard, failing the binding prop-safety gate." },
  { scene: 1262, attempt: "raw", generatedName: "exec-cdde36ee-f9ca-45ac-a917-dce4db1b8aae.png", workspacePath: "tmp/world-195x4/batch-310/1262-botswana-gaborone-ash-sunset-male-raw.png", reason: "The prop-hand index finger visibly curls through the trigger guard. The compressed five-person contact cluster also obscures at least one male or Ellie hand owner." },
  { scene: 1263, attempt: "raw", generatedName: "exec-57e73de3-1c89-4193-9711-924f10f121db.png", workspacePath: "tmp/world-195x4/batch-310/1263-botswana-chobe-blizzard-paws-raw.png", reason: "The prop-hand index finger visibly curls through the trigger guard, and the center-right embrace leaves a hand-owner transition ambiguous." },
  { scene: 1260, attempt: "recovery", generatedName: "exec-9fc805ea-ee3e-4f4e-9e6a-3cb433d117c2.png", workspacePath: "tmp/world-195x4/batch-310/1260-botswana-makgadikgadi-sandstorm-paws-recovery.png", reason: "The single recovery still visibly places the prop-hand index finger inside the trigger guard." },
  { scene: 1261, attempt: "recovery", generatedName: "exec-b307b954-7ca2-49b6-86b5-901aba601022.png", workspacePath: "tmp/world-195x4/batch-310/1261-botswana-okavango-mist-pole-hosiery-recovery.png", reason: "The single recovery still visibly places the prop-hand index finger inside the trigger guard." },
  { scene: 1262, attempt: "recovery", generatedName: "exec-7d8a9352-e839-4621-89fc-b2e8813391d9.png", workspacePath: "tmp/world-195x4/batch-310/1262-botswana-gaborone-ash-sunset-male-recovery.png", reason: "The single recovery still visibly places the prop-hand index finger inside the trigger guard." },
  { scene: 1263, attempt: "recovery", generatedName: "exec-8d8c8a49-102f-4fd5-b042-21394649b59f.png", workspacePath: "tmp/world-195x4/batch-310/1263-botswana-chobe-blizzard-paws-recovery.png", reason: "The single recovery still visibly places the prop-hand index finger inside the trigger guard." },
];

const renderedAssets = renderedSpecs.map((spec) => {
  const absoluteWorkspacePath = path.resolve(spec.workspacePath);
  const bytes = fs.readFileSync(absoluteWorkspacePath);
  return {
    ...spec,
    absoluteGeneratedPath: path.join(generatedRoot, spec.generatedName),
    bytes: bytes.length,
    sha256: sha256(bytes),
    ...pngDimensions(bytes),
    preservedOriginal: true,
    copiedToAcceptedAssets: false,
  };
});

const promptArtifacts = [];
for (const scene of [1260, 1261, 1262, 1263]) {
  promptArtifacts.push(artifact(path.join(batchRoot, `scene-${scene}-prompt.txt`)));
  promptArtifacts.push(artifact(path.join(batchRoot, `scene-${scene}-recovery-prompt.txt`)));
}

const auditCrops = fs.readdirSync(batchRoot)
  .filter((name) => name.endsWith("audit.png"))
  .sort()
  .map((name) => artifact(path.join(batchRoot, name)));

const sceneResults = {};
for (const scene of [1260, 1261, 1262, 1263]) {
  const raw = renderedSpecs.find((item) => item.scene === scene && item.attempt === "raw");
  const recovery = renderedSpecs.find((item) => item.scene === scene && item.attempt === "recovery");
  sceneResults[String(scene)] = {
    rawAudit: { accepted: false, reason: raw.reason },
    recoveryAudit: { accepted: false, reason: recovery.reason },
    terminalOutcome: "blocked-after-single-recovery-pass",
    acceptedAsset: null,
  };
}

const checkpoint = {
  ...preflight,
  status: "terminal-blocked-after-single-recovery-pass",
  renderAttempts: {
    raw: {
      status: "complete",
      execution: "Four independent built-in image generation calls completed concurrently with all-settled result handling.",
      requested: 4,
      returnedImages: 4,
      moderationBlockedNoOutput: 0,
    },
    recovery: {
      status: "complete-exhausted",
      execution: "One independent image edit per rejected scene completed concurrently with all-settled result handling. Every scene used its single permitted recovery pass.",
      requested: 4,
      returnedImages: 4,
      moderationBlockedNoOutput: 0,
      maximumPerBlockedScene: 1,
    },
    total: {
      requested: 8,
      returnedImages: 8,
      acceptedImages: 0,
      terminalRejectedScenes: 4,
    },
  },
  acceptedAssets: [],
  rejectedAssets: renderedAssets,
  xPost: {
    status: "deferred-insufficient-accepted-assets",
    publishAttempted: false,
    postButtonClicked: false,
    currentCountryAcceptedAssetCount: 0,
    minimumCurrentCountryAcceptedAssets: 2,
    reason: "Botswana has zero accepted current-country images, so no eligible two-main-plus-one-secondary attachment group exists.",
    captionRolls: preflight.xPublishingRolls,
    eligibleCaptionShapeIfAssetsHadPassed: "Botswana red heart Georgia #Botswana #InternalAgency",
    hashtagsSuppressedByRoll: ["#WorldXXXSeries"],
    ledger: {
      path: relative(ledgerPath),
      sha256: sha256(ledgerBytes),
      pendingPost: ledger.pendingPost,
      preparedPostQueueCount: Array.isArray(ledger.preparedPostQueue) ? ledger.preparedPostQueue.length : 0,
      deferredPostCheckpoint: ledger.deferredPostCheckpoint,
      residualImageNumbers: ledger.preRenderBacklogResidualImageNumbers ?? [],
      backlogDrainStatus: "drained-clear",
      preRenderBacklogStatus: ledger.preRenderBacklogStatus,
      latestAssistedDrainStatus: ledger.latestAssistedDrain?.status ?? null,
    },
    action: "No browser submission was opened because the two-current-country-image publishing threshold was not met and the existing X backlog was already clear.",
  },
  moderationBlocks: [],
  checkpointType: "narrow-terminal-batch-checkpoint",
  preflightPath: relative(preflightPath),
  preflightSha256: sha256(preflightBytes),
  promptArtifacts,
  auditCrops,
  renderedAssets,
  sceneResults,
  shorteningVariants: [],
  queueAdvance: {
    allowed: true,
    reason: "The batch is terminal after one raw pass and one recovery pass per scene, so the binding queue advances despite zero accepted assets.",
    nextCountry: "Georgia",
    nextBatch: 311,
    nextScenes: [1264, 1265, 1266, 1267],
    nextThemePair: ["cleaner and service couture", "cinematic covert-agent crew couture"],
  },
  repositoryScope: {
    copiedAcceptedAssets: [],
    stagedPaths: ["assets/lore/starlight-era/batch-310-botswana-recovery-checkpoint.json"],
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
console.log(JSON.stringify({
  checkpoint: relative(checkpointPath),
  checkpointSha256: sha256(fs.readFileSync(checkpointPath)),
  status: checkpoint.status,
  returnedImages: checkpoint.renderAttempts.total.returnedImages,
  acceptedImages: checkpoint.renderAttempts.total.acceptedImages,
  xPost: checkpoint.xPost.status,
  next: checkpoint.queueAdvance,
}, null, 2));
