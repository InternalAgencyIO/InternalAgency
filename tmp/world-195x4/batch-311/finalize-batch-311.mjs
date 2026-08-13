import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = process.cwd();
const batchRoot = path.resolve("tmp/world-195x4/batch-311");
const preflightPath = path.join(batchRoot, "batch-311-georgia-preflight.json");
const checkpointPath = path.resolve("assets/lore/starlight-era/batch-311-georgia-recovery-checkpoint.json");
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
  {
    scene: 1264,
    attempt: "raw",
    generatedName: "exec-d6ddd023-5b85-43e1-81d0-bc75bb60984e.png",
    workspacePath: "tmp/world-195x4/batch-311/1264-georgia-batumi-mist-paws-raw.png",
    reason: "The inert prop floats across Radiance's waistline without a traceable handler, its muzzle intersects the group, and at least one center hand owner is hidden or ambiguous.",
  },
  {
    scene: 1264,
    attempt: "recovery",
    generatedName: "exec-61f7dc86-36d4-4926-84d7-a914c9478a09.png",
    workspacePath: "tmp/world-195x4/batch-311/1264-georgia-batumi-mist-paws-recovery.png",
    reason: "Two support fingers visibly rise through the trigger guard, and the compressed center-right cluster still leaves a hand-owner path ambiguous.",
  },
  {
    scene: 1265,
    attempt: "raw",
    generatedName: "exec-bef58a97-97ce-4047-97e0-59b8b9d0ff4b.png",
    workspacePath: "tmp/world-195x4/batch-311/1265-georgia-stepantsminda-golden-raw.png",
    reason: "ECE holds the inert prop in a conventional firing grip with a finger inside the trigger guard.",
  },
  {
    scene: 1265,
    attempt: "recovery",
    generatedName: "exec-139e59db-b940-47d9-8477-e4a6068f3b32.png",
    workspacePath: "tmp/world-195x4/batch-311/1265-georgia-stepantsminda-golden-recovery.png",
    reason: "The open-palm prop correction leaves the trigger guard empty, but multiple shoulder-to-hand paths disappear behind neighboring torsos, failing the strict continuous-owner anatomy gate.",
  },
  {
    scene: 1267,
    attempt: "raw",
    generatedName: "exec-79c861e8-12d2-4065-ad54-f862a4971f6d.png",
    workspacePath: "tmp/world-195x4/batch-311/1267-georgia-kakheti-snow-paws-raw.png",
    reason: "The prop loses the required complete grip and trigger-guard silhouette, and the seated embrace compresses multiple wrist-to-hand ownership paths behind torsos.",
  },
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

const moderationBlocks = [
  {
    scene: 1266,
    attempt: "raw",
    status: "renderer-block-no-output",
    returnedImage: false,
    requestId: null,
    category: "not surfaced by the concurrent result transcript",
    recoveryAllowed: true,
  },
  {
    scene: 1266,
    attempt: "recovery",
    status: "moderation-blocked-no-output",
    returnedImage: false,
    requestId: "64e27e13-ee89-4b73-8d9f-f91255211d4b",
    category: "sexual",
    recoveryAllowed: false,
  },
  {
    scene: 1267,
    attempt: "recovery",
    status: "moderation-blocked-no-output",
    returnedImage: false,
    requestId: "7a76a8b2-256f-4e23-86c6-084aed81003f",
    category: "sexual",
    recoveryAllowed: false,
  },
];

const promptArtifacts = [];
for (const scene of [1264, 1265, 1266, 1267]) {
  promptArtifacts.push(artifact(path.join(batchRoot, `scene-${scene}-prompt.txt`)));
  promptArtifacts.push(artifact(path.join(batchRoot, `scene-${scene}-recovery-prompt.txt`)));
}

const auditCrops = fs.readdirSync(batchRoot)
  .filter((name) => name.endsWith("audit.png"))
  .sort()
  .map((name) => artifact(path.join(batchRoot, name)));

const sceneResults = {
  "1264": {
    rawAudit: { accepted: false, reason: renderedSpecs.find((item) => item.scene === 1264 && item.attempt === "raw").reason },
    recoveryAudit: { accepted: false, reason: renderedSpecs.find((item) => item.scene === 1264 && item.attempt === "recovery").reason },
    terminalOutcome: "blocked-after-single-recovery-pass",
    acceptedAsset: null,
  },
  "1265": {
    rawAudit: { accepted: false, reason: renderedSpecs.find((item) => item.scene === 1265 && item.attempt === "raw").reason },
    recoveryAudit: { accepted: false, reason: renderedSpecs.find((item) => item.scene === 1265 && item.attempt === "recovery").reason },
    terminalOutcome: "blocked-after-single-recovery-pass",
    acceptedAsset: null,
  },
  "1266": {
    rawAudit: { accepted: false, reason: "The raw renderer returned no image." },
    recoveryAudit: { accepted: false, reason: "The single permitted recovery was blocked by the renderer's output safety system and returned no image." },
    terminalOutcome: "blocked-after-single-recovery-pass",
    acceptedAsset: null,
  },
  "1267": {
    rawAudit: { accepted: false, reason: renderedSpecs.find((item) => item.scene === 1267 && item.attempt === "raw").reason },
    recoveryAudit: { accepted: false, reason: "The single permitted recovery was blocked by the renderer's output safety system and returned no image." },
    terminalOutcome: "blocked-after-single-recovery-pass",
    acceptedAsset: null,
  },
};

const checkpoint = {
  ...preflight,
  status: "terminal-blocked-after-single-recovery-pass",
  renderAttempts: {
    raw: {
      status: "complete",
      execution: "Four independent built-in image generation calls completed concurrently with all-settled result handling.",
      requested: 4,
      returnedImages: 3,
      rendererBlockedNoOutput: 1,
    },
    recovery: {
      status: "complete-exhausted",
      execution: "One independent recovery per scene completed concurrently with all-settled result handling. Scenes 1264, 1265, and 1267 used targeted edits; Scene 1266 used a fresh recovery because its raw call produced no image.",
      requested: 4,
      returnedImages: 2,
      moderationBlockedNoOutput: 2,
      maximumPerBlockedScene: 1,
    },
    total: {
      requested: 8,
      returnedImages: 5,
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
    reason: "Georgia has zero accepted current-country images, so no eligible two-main-plus-one-secondary attachment group exists.",
    captionRolls: preflight.xPublishingRolls,
    eligibleCaptionShapeIfAssetsHadPassed: "Georgia red heart Fiji #Georgia #WorldXXXSeries",
    hashtagsSuppressedByRoll: ["#InternalAgency"],
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
  moderationBlocks,
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
    nextCountry: "Fiji",
    nextBatch: 312,
    nextScenes: [1268, 1269, 1270, 1271],
    nextThemePair: ["cinematic covert-agent crew couture", "undercover investigator couture"],
  },
  repositoryScope: {
    copiedAcceptedAssets: [],
    stagedPaths: ["assets/lore/starlight-era/batch-311-georgia-recovery-checkpoint.json"],
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
