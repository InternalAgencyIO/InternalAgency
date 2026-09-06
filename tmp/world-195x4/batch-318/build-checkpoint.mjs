import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const repo = process.cwd();
const tmp = path.join(repo, "tmp", "world-195x4", "batch-318");
const preflightPath = path.join(tmp, "batch-318-suriname-preflight.json");
const checkpointPath = path.join(repo, "assets", "lore", "starlight-era", "batch-318-suriname-recovery-checkpoint.json");
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
  artifact(
    1292,
    "raw",
    "exec-89a9aacd-0fd7-4bb1-b2c4-1cec76c2e38f.png",
    "tmp/world-195x4/batch-318/raw/1292-raw.png",
    "The quartet, Paramaribo Waterkant, Jules Wijdenbosch Bridge, rolling thunderstorm, large Suriname motifs, and rolled garment cuts are present, but ECE's separate holographic route map is absent. The inert prop points rightward toward the cast and Radiance's second hand is hidden, so the safe downrange and exact eight-hand gates fail.",
  ),
  artifact(
    1293,
    "raw",
    "exec-364c7cf0-c3c6-44a6-af88-6dd7ad9f324c.png",
    "tmp/world-195x4/batch-318/raw/1293-raw.png",
    "The five adults, Brownsberg overlook, Brokopondo Reservoir, sunshower, large Suriname motifs, and rolled garment cuts are present, but the male's strongest eye line does not go to ECE. ECE's separate holographic route map is absent, the prop direction is unsafe or ambiguous toward the group, and exactly ten continuously traceable hands cannot be verified.",
  ),
  artifact(
    1294,
    "raw",
    "exec-6f31ac11-c73b-4300-9aff-a5dfe89cae25.png",
    "tmp/world-195x4/batch-318/raw/1294-raw.png",
    "The quartet, Voltzberg dome, Raleigh Falls, soft overcast weather, large Suriname motifs, rolled garment cuts, and the stationary navigation pole marker are present, but ECE's separate holographic route map is absent and the prop points rightward toward the cast. The route-strategist and safe downrange gates fail.",
  ),
  artifact(
    1295,
    "raw",
    "exec-7beb3b35-f081-4176-bce7-80ecee31c9c5.png",
    "tmp/world-195x4/batch-318/raw/1295-raw.png",
    "The quartet, Galibi coast, Marowijne mouth, mangroves, heavy rain curtain, and large Suriname motifs are present, but Radiance's rolled fully open back is not visibly materialized. ECE's separate holographic route map is absent, the prop support and direction are ambiguous, and Alia's second hand is not continuously traceable.",
  ),
  blocked(
    1292,
    "recovery",
    "f5ab4e6e-e2ef-4e54-b03b-6fe0461eb114",
    "The single allowed recovery renderer returned no image artifact after output moderation.",
  ),
  artifact(
    1293,
    "recovery",
    "exec-63c66221-05c4-467b-bec2-f15859d37100.png",
    "tmp/world-195x4/batch-318/recovery/1293-recovery.png",
    "The five adults, Brownsberg overlook, Brokopondo Reservoir, sunshower, large Suriname motifs, rolled garment cuts, and separate route map are present, but the male's strongest eye line still goes to Ellie instead of ECE. The tray-mounted prop points rightward toward the cast, so the mandatory eye-line and safe downrange gates fail.",
  ),
  artifact(
    1294,
    "recovery",
    "exec-9caf653e-ec5d-44e9-80a6-1856f808ae0c.png",
    "tmp/world-195x4/batch-318/recovery/1294-recovery.png",
    "The quartet, Voltzberg dome, Raleigh Falls, soft overcast weather, large Suriname motifs, route map, stationary navigation pole marker, rolled garment cuts, and safely leftward tray-mounted prop are present, but Ellie's second hand is concealed behind Alia. Exactly eight complete, continuously traceable arms and hands cannot be established.",
  ),
  artifact(
    1295,
    "recovery",
    "exec-ba318295-be6e-4c13-8bf0-dfc8ecafecf4.png",
    "tmp/world-195x4/batch-318/recovery/1295-recovery.png",
    "The quartet, Galibi coast, Marowijne mouth, mangroves, heavy rain curtain, large Suriname motifs, route map, rolled garment cuts, and safely leftward tray-mounted prop are present, but the standing left woman's second arm and hand are hidden behind her body. Exactly eight complete, continuously traceable arms and hands cannot be established.",
  ),
];

const bySceneAttempt = new Map(attempts.map((item) => [`${item.scene}-${item.attempt}`, item]));
const preflight = JSON.parse(fs.readFileSync(preflightPath, "utf8"));
const ledgerBytes = fs.readFileSync(ledgerPath);
const ledger = JSON.parse(ledgerBytes.toString("utf8"));
const scenes = [1292, 1293, 1294, 1295];
const sceneResults = Object.fromEntries(scenes.map((scene) => {
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
    bySceneAttempt.get("1292-raw"),
    bySceneAttempt.get("1293-recovery"),
    bySceneAttempt.get("1294-recovery"),
    bySceneAttempt.get("1295-recovery"),
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
    action: "No X post was attempted because Suriname has fewer than two accepted current-country images. The inspected X backlog remains publicly clear.",
  },
  promptMaterialization: {
    deterministicReruns: 2,
    byteStable: true,
    sha256: {
      preflight: sha256(preflightPath),
      primary: Object.fromEntries(scenes.map((scene) => [String(scene), sha256(path.join(tmp, `scene-${scene}-prompt.txt`))])),
      recovery: Object.fromEntries(scenes.map((scene) => [String(scene), sha256(path.join(tmp, `scene-${scene}-recovery-prompt.txt`))])),
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
    nextCountry: "Montenegro",
    nextBatch: 319,
    nextScenes: [1296, 1297, 1298, 1299],
    nextThemePair: ["cinematic covert-agent crew couture", "undercover investigator couture"],
  },
  remoteStateAtCheckpoint: {
    localBranch: "agent/iat-launch-window",
    sourceHead: "4d0ea714ddfc184e6ddbd9907c883c0aac85eef7",
    recoveryRemoteBeforeCommit: "4d0ea714ddfc184e6ddbd9907c883c0aac85eef7",
    originMain: "6cdd669301029c184322c4fa0be124d309e23533",
    headOnlyCommitsAgainstMain: 17,
    mainOnlyCommitsAgainstHead: 2,
    mainAction: "untouched because origin/main has two independent commits",
  },
  repositoryScope: {
    copiedAcceptedAssets: [],
    stagedPaths: ["assets/lore/starlight-era/batch-318-suriname-recovery-checkpoint.json"],
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
