import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const repo = process.cwd();
const tmp = path.join(repo, "tmp", "world-195x4", "batch-316");
const preflightPath = path.join(tmp, "batch-316-bhutan-preflight.json");
const checkpointPath = path.join(repo, "assets", "lore", "starlight-era", "batch-316-bhutan-recovery-checkpoint.json");
const ledgerPath = path.join(repo, "assets", "lore", "starlight-era", "world-x-publish-ledger.json");

const sha256 = (filePath) => crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").toUpperCase();
function pngMetadata(filePath) {
  const bytes = fs.readFileSync(filePath);
  if (bytes.toString("ascii", 1, 4) !== "PNG") throw new Error(`Expected PNG: ${filePath}`);
  return {
    bytes: bytes.length,
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    sha256: crypto.createHash("sha256").update(bytes).digest("hex").toUpperCase(),
  };
}

const generatedRoot = "C:\\Users\\A\\.codex\\generated_images\\019fd625-0bf6-78d2-9fb8-3f3e22c1d086";
const artifact = (scene, attempt, generatedName, workspacePath, reason) => ({
  scene,
  attempt,
  status: "rendered-rejected-by-strict-audit",
  generatedName,
  absoluteGeneratedPath: `${generatedRoot}\\${generatedName}`,
  workspacePath,
  ...pngMetadata(path.join(repo, ...workspacePath.split("/"))),
  preservedOriginal: true,
  copiedToAcceptedAssets: false,
  reason,
});
const blocked = (scene, attempt, requestId, reason) => ({
  scene,
  attempt,
  status: "blocked-output-moderation-no-image",
  category: "sexual",
  requestId,
  reason,
});

const attempts = [
  blocked(1284, "raw", "7c84eee3-ce43-42c1-9694-3b5fcfdc1bf0", "The raw renderer returned no image artifact."),
  artifact(
    1285,
    "raw",
    "exec-95cd6ea2-ed1e-4ff3-92c5-92908aa4ba38.png",
    "tmp/world-195x4/batch-316/raw/1285-raw.png",
    "The five adults, Punakha bridge, large Bhutan motifs, and PAWS-inactive state are present, but the male's strongest eye line goes to Alia instead of ECE. ECE's free hand and the male's second hand are hidden, so ten continuously traceable arms and hands cannot be verified; the separate ECE route map is also absent.",
  ),
  artifact(
    1286,
    "raw",
    "exec-c4d6c330-f489-4e04-b2a2-bb11779d3725.png",
    "tmp/world-195x4/batch-316/raw/1286-raw.png",
    "The quartet, Phobjikha valley, PAWS, ECE-only original rainbow hosiery, Radiance-ECE center, Alia prop handling, lenticular clouds, and Bhutan motifs are present, but ECE's mandatory separate holographic route map is absent and the frozen hand choreography is substantially substituted.",
  ),
  artifact(
    1287,
    "raw",
    "exec-8dd7d70f-712b-4d5f-bfd5-34fd059bd548.png",
    "tmp/world-195x4/batch-316/raw/1287-raw.png",
    "The quartet, Royal Manas landscape, PAWS, wind, and large Bhutan motifs are present, but the inert prop's muzzle points right across the group toward Ellie instead of left across empty water. ECE's separate holographic route map is also absent, so the safety and route-strategist gates fail.",
  ),
  artifact(
    1284,
    "recovery",
    "exec-977bbb65-47d3-4ac5-86bf-e1284606dec0.png",
    "tmp/world-195x4/batch-316/recovery/1284-recovery.png",
    "The quartet, Thimphu civic setting, thunderstorm, map, leftward inert prop, and large complete Bhutan motifs are present, but Alia has only one continuously traceable arm and hand while her second limb is hidden between bodies. ECE's rolled visible waist panel is absent, and Radiance and ECE render below-knee rather than above-knee.",
  ),
  artifact(
    1285,
    "recovery",
    "exec-9e809a39-0895-49b9-8be9-ce1f1dae30c6.png",
    "tmp/world-195x4/batch-316/recovery/1285-recovery.png",
    "The five adults, Punakha bridge, map, safe leftward prop, large Bhutan motifs, and strongest male eye line to ECE are present, but ECE's free contact hand and the male's second hand are hidden or missing. The strict ten-arm and ten-hand owner gate therefore fails.",
  ),
  artifact(
    1286,
    "recovery",
    "exec-447e44d2-2f8d-40c8-b495-836444ff58d4.png",
    "tmp/world-195x4/batch-316/recovery/1286-recovery.png",
    "The quartet, Phobjikha landscape, PAWS, map, Alia-only safe prop handling, ECE-only original rainbow hosiery, Radiance-ECE center, open-back roll, clouds, and large Bhutan motifs are present, but Ellie's second arm and hand are hidden between ECE and Alia. Exactly eight continuously traceable arms and hands cannot be verified.",
  ),
  blocked(1287, "recovery", "cb4643ca-afa3-4206-9382-271d781126e1", "The single allowed recovery renderer returned no image artifact."),
];

const bySceneAttempt = new Map(attempts.map((item) => [`${item.scene}-${item.attempt}`, item]));
const preflight = JSON.parse(fs.readFileSync(preflightPath, "utf8"));
const ledgerBytes = fs.readFileSync(ledgerPath);
const ledger = JSON.parse(ledgerBytes.toString("utf8"));
const sceneResults = Object.fromEntries([1284, 1285, 1286, 1287].map((scene) => {
  const raw = bySceneAttempt.get(`${scene}-raw`);
  const recovery = bySceneAttempt.get(`${scene}-recovery`);
  return [String(scene), {
    rawAudit: { accepted: false, status: raw.status, reason: raw.reason, requestId: raw.requestId ?? null },
    recoveryAudit: { accepted: false, status: recovery.status, reason: recovery.reason, requestId: recovery.requestId ?? null },
    terminalOutcome: "blocked-after-single-recovery-pass",
    acceptedAsset: null,
  }];
}));

const checkpoint = {
  ...preflight,
  status: "terminal-blocked-after-single-recovery-pass",
  renderAttempts: attempts,
  acceptedAssets: [],
  rejectedAssets: [
    bySceneAttempt.get("1284-recovery"),
    bySceneAttempt.get("1285-recovery"),
    bySceneAttempt.get("1286-recovery"),
    bySceneAttempt.get("1287-raw"),
  ],
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
    action: "No X post was attempted because Bhutan has fewer than two accepted current-country images. The inspected X backlog remains publicly clear.",
  },
  promptMaterialization: {
    deterministicReruns: 2,
    byteStable: true,
    sha256: {
      preflight: sha256(preflightPath),
      primary: Object.fromEntries([1284, 1285, 1286, 1287].map((scene) => [String(scene), sha256(path.join(tmp, `scene-${scene}-prompt.txt`))])),
      recovery: Object.fromEntries([1284, 1285, 1286, 1287].map((scene) => [String(scene), sha256(path.join(tmp, `scene-${scene}-recovery-prompt.txt`))])),
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
    reason: "The batch is terminal after one raw pass and one recovery pass per scene, so the binding queue advances despite zero accepted assets.",
    nextCountry: "Luxembourg",
    nextBatch: 317,
    nextScenes: [1288, 1289, 1290, 1291],
    nextThemePair: ["Paris runway model couture", "cleaner and service couture"],
  },
  remoteStateAtCheckpoint: {
    localBranch: "agent/iat-launch-window",
    sourceHead: "bb2aa7b2228f2987eb6863bd824824364f4f24b4",
    recoveryRemoteBeforeCommit: "bb2aa7b2228f2987eb6863bd824824364f4f24b4",
    originMain: "6cdd669301029c184322c4fa0be124d309e23533",
    headOnlyCommitsAgainstMain: 15,
    mainOnlyCommitsAgainstHead: 2,
    mainAction: "untouched because origin/main has two independent commits",
  },
  repositoryScope: {
    copiedAcceptedAssets: [],
    stagedPaths: ["assets/lore/starlight-era/batch-316-bhutan-recovery-checkpoint.json"],
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
  checkpointPath,
  checkpointSha256: sha256(checkpointPath),
  status: checkpoint.status,
  acceptedAssets: checkpoint.acceptedAssets.length,
  renderAttempts: checkpoint.renderAttempts.length,
  nextCountry: checkpoint.queueAdvance.nextCountry,
  xPost: checkpoint.xPost.status,
}, null, 2));
