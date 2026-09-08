import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const repo = process.cwd();
const tmp = path.join(repo, "tmp", "world-195x4", "batch-317");
const preflightPath = path.join(tmp, "batch-317-luxembourg-preflight.json");
const checkpointPath = path.join(repo, "assets", "lore", "starlight-era", "batch-317-luxembourg-recovery-checkpoint.json");
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
  blocked(1288, "raw", "24b74922-0736-4ecb-9623-eecc28381740", "The raw renderer returned no image artifact."),
  artifact(
    1289,
    "raw",
    "exec-8bbaaf52-8f45-4af4-bc0b-7b44e59a749c.png",
    "tmp/world-195x4/batch-317/raw/1289-raw.png",
    "The quartet, Belval blast furnaces, eclipse, large Luxembourg motifs, exact rolled cuts, and safe leftward inert prop are present, but ECE's mandatory separate holographic route map is absent and the frozen hand choreography is substantially substituted. The strict route-strategist and owner-traceable hand gates fail.",
  ),
  artifact(
    1290,
    "raw",
    "exec-4f09ebae-575b-4991-aef8-0df1a044dcf3.png",
    "tmp/world-195x4/batch-317/raw/1290-raw.png",
    "The five adults, Upper-Sure Lake, dam, solar boat, distant waterspout, large Luxembourg motifs, exact rolled cuts, and safe leftward inert prop are present, but the male's strongest eye line goes to Ellie instead of ECE. His second hand is hidden and ECE's separate holographic route map is absent, so ten continuously traceable arms and hands cannot be verified.",
  ),
  artifact(
    1291,
    "raw",
    "exec-e1782a33-4dfd-4074-b941-09c748c2329e.png",
    "tmp/world-195x4/batch-317/raw/1291-raw.png",
    "The quartet, Schiessentumpel waterfall, windstorm, large Luxembourg motifs, exact rolled cuts, and safe rightward inert prop are present, but ECE's mandatory separate holographic route map is absent and the frozen hand choreography is substituted. The strict route-strategist gate fails.",
  ),
  blocked(1288, "recovery", "12500dfc-e02c-4ecd-887c-a839424a9b59", "The single allowed recovery renderer returned no image artifact."),
  artifact(
    1289,
    "recovery",
    "exec-8b165d74-f368-478c-a330-85ba848eae0a.png",
    "tmp/world-195x4/batch-317/recovery/1289-recovery.png",
    "The quartet, Belval blast furnaces, eclipse, large Luxembourg motifs, route map, exact rolled cuts, and safe leftward inert prop are present, but ECE already uses one hand for the paddle and one at Ellie's shoulder while an additional ownerless linked-hand cluster appears between ECE and Ellie. Exactly eight continuously traceable arms and hands cannot be established.",
  ),
  artifact(
    1290,
    "recovery",
    "exec-13f43b5b-d63b-4e08-b7bc-235d256b076a.png",
    "tmp/world-195x4/batch-317/recovery/1290-recovery.png",
    "The five adults, Upper-Sure Lake, dam, solar boat, distant waterspout, large Luxembourg motifs, route map, exact rolled cuts, and safe leftward inert prop are present, but the male's strongest eye line still goes to Radiance instead of ECE. Alia's second contact hand is not continuously traceable and the frozen hand inventory is substituted, so the strict ten-arm and ten-hand owner gate fails.",
  ),
  blocked(1291, "recovery", "f45191dc-1c32-4bee-b0e9-038ab07aba5a", "The single allowed recovery renderer returned no image artifact."),
];

const bySceneAttempt = new Map(attempts.map((item) => [`${item.scene}-${item.attempt}`, item]));
const preflight = JSON.parse(fs.readFileSync(preflightPath, "utf8"));
const ledgerBytes = fs.readFileSync(ledgerPath);
const ledger = JSON.parse(ledgerBytes.toString("utf8"));
const sceneResults = Object.fromEntries([1288, 1289, 1290, 1291].map((scene) => {
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
    bySceneAttempt.get("1288-recovery"),
    bySceneAttempt.get("1289-recovery"),
    bySceneAttempt.get("1290-recovery"),
    bySceneAttempt.get("1291-raw"),
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
    action: "No X post was attempted because Luxembourg has fewer than two accepted current-country images. The inspected X backlog remains publicly clear.",
  },
  promptMaterialization: {
    deterministicReruns: 2,
    byteStable: true,
    sha256: {
      preflight: sha256(preflightPath),
      primary: Object.fromEntries([1288, 1289, 1290, 1291].map((scene) => [String(scene), sha256(path.join(tmp, `scene-${scene}-prompt.txt`))])),
      recovery: Object.fromEntries([1288, 1289, 1290, 1291].map((scene) => [String(scene), sha256(path.join(tmp, `scene-${scene}-recovery-prompt.txt`))])),
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
    nextCountry: "Suriname",
    nextBatch: 318,
    nextScenes: [1292, 1293, 1294, 1295],
    nextThemePair: ["cleaner and service couture", "cinematic covert-agent crew couture"],
  },
  remoteStateAtCheckpoint: {
    localBranch: "agent/iat-launch-window",
    sourceHead: "1131f4318cb44b74eebbda7e977790b22aac4158",
    recoveryRemoteBeforeCommit: "1131f4318cb44b74eebbda7e977790b22aac4158",
    originMain: "6cdd669301029c184322c4fa0be124d309e23533",
    headOnlyCommitsAgainstMain: 16,
    mainOnlyCommitsAgainstHead: 2,
    mainAction: "untouched because origin/main has two independent commits",
  },
  repositoryScope: {
    copiedAcceptedAssets: [],
    stagedPaths: ["assets/lore/starlight-era/batch-317-luxembourg-recovery-checkpoint.json"],
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
