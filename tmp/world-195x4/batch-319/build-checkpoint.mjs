import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const repo = process.cwd();
const tmp = path.join(repo, "tmp", "world-195x4", "batch-319");
const preflightPath = path.join(tmp, "batch-319-montenegro-preflight.json");
const checkpointPath = path.join(
  repo,
  "assets",
  "lore",
  "starlight-era",
  "batch-319-montenegro-recovery-checkpoint.json",
);
const ledgerPath = path.join(repo, "assets", "lore", "starlight-era", "world-x-publish-ledger.json");

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
  blocked(
    1296,
    "raw",
    "84850ab4-0eba-44dc-8d7e-f3f3ba79c92b",
    "The primary renderer returned no image artifact after output moderation.",
  ),
  artifact(
    1297,
    "raw",
    "exec-46261917-a9f5-4daf-801b-3ac4b85f8bcf.png",
    "tmp/world-195x4/batch-319/raw/1297-raw.png",
    "The quartet, Bay of Kotor walls, coastal sea mist, large Montenegro motifs, and Radiance-only rolled rainbow hosiery are present, but ECE's separate holographic route map is absent. At least one required hand is hidden and the prop support and direction are ambiguous, so the exact eight-hand and safe downrange gates fail.",
  ),
  artifact(
    1298,
    "raw",
    "exec-d7d8d01f-6e35-4955-8eaf-3b431fa83d91.png",
    "tmp/world-195x4/batch-319/raw/1298-raw.png",
    "The five adults, Tara River gorge, five-arch Djurdjevica bridge, heavy rain, large Montenegro motifs, and rolled garment cuts are present, but the male's strongest eye line goes to Ellie instead of ECE. ECE's separate holographic route map is also absent, so the mandatory male eye-line and route-strategist gates fail.",
  ),
  artifact(
    1299,
    "raw",
    "exec-c7f9c71c-92c8-472b-b4eb-aaa63ee9b20c.png",
    "tmp/world-195x4/batch-319/raw/1299-raw.png",
    "The quartet, PAWS, rainbow-only outfits, Skadar Lake setting, large Montenegro motifs, and route map are present, but Radiance's and Ellie's rolled fully open backs are not visibly materialized. PAWS's route ribbon appears attached or tether-like rather than loose and harmless, so the garment and PAWS gates fail.",
  ),
  blocked(
    1296,
    "recovery",
    "caa84714-c1c0-4521-9e81-cb309736dfd8",
    "The single allowed recovery renderer returned no image artifact after output moderation.",
  ),
  artifact(
    1297,
    "recovery",
    "exec-305e971c-4173-43c6-909d-96da8839595c.png",
    "tmp/world-195x4/batch-319/recovery/1297-recovery.png",
    "The quartet, Kotor walls and mist, large Montenegro motifs, Radiance-only rolled rainbow hosiery, and route map are present, but the far-right tray-mounted prop points leftward toward the group. Radiance's second hand is hidden or not continuously traceable, so the safe downrange and exact eight-hand gates fail. The map also contains unwanted readable text.",
  ),
  artifact(
    1298,
    "recovery",
    "exec-e9bd7c47-f6c3-4135-a4c1-8ab92ba57126.png",
    "tmp/world-195x4/batch-319/recovery/1298-recovery.png",
    "The five adults, Tara gorge bridge, heavy rain, large Montenegro motifs, route map, rolled garment cuts, and the male's strongest eye line to ECE are present, but the male has only one clear direct contact. His right hand hangs free instead of forming the required second contact, so the male relationship contract fails.",
  ),
  artifact(
    1299,
    "recovery",
    "exec-09e129ec-5cdd-4c78-bb47-04223cae4112.png",
    "tmp/world-195x4/batch-319/recovery/1299-recovery.png",
    "The quartet, collarless PAWS with a disconnected ribbon, rainbow-only outfits, Skadar Lake setting, large Montenegro motifs, route map, visible rolled open backs, and safely directed prop are present, but Ellie's second hand is hidden behind her body or hair. Exactly eight complete, continuously traceable arms and hands cannot be established. The map also contains unwanted readable text.",
  ),
];

const bySceneAttempt = new Map(attempts.map((item) => [`${item.scene}-${item.attempt}`, item]));
const preflight = JSON.parse(fs.readFileSync(preflightPath, "utf8"));
const ledgerBytes = fs.readFileSync(ledgerPath);
const ledger = JSON.parse(ledgerBytes.toString("utf8"));
const scenes = [1296, 1297, 1298, 1299];
const sceneResults = Object.fromEntries(
  scenes.map((scene) => {
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
  rejectedAssets: [
    bySceneAttempt.get("1296-recovery"),
    bySceneAttempt.get("1297-recovery"),
    bySceneAttempt.get("1298-recovery"),
    bySceneAttempt.get("1299-recovery"),
  ],
  xPost: {
    status: "deferred-insufficient-accepted-assets",
    acceptedCurrentCountryAssets: 0,
    minimumRequired: 2,
    captionIfEligible: preflight.xPublishingPlan.captionIfEligible,
    ledgerModified: false,
    ledgerSha256: crypto.createHash("sha256").update(ledgerBytes).digest("hex").toUpperCase(),
    pendingPost: ledger.pendingPost ?? null,
    preparedPostQueueCount: Array.isArray(ledger.preparedPostQueue)
      ? ledger.preparedPostQueue.length
      : 0,
    deferredPostCheckpoint: ledger.deferredPostCheckpoint ?? null,
    latestAssistedDrainStatus: ledger.latestAssistedDrain?.status ?? null,
    action:
      "No X post was attempted because Montenegro has fewer than two accepted current-country images. The inspected X backlog remains publicly clear.",
  },
  promptMaterialization: {
    deterministicReruns: 2,
    byteStable: true,
    sha256: {
      preflight: sha256(preflightPath),
      primary: Object.fromEntries(
        scenes.map((scene) => [String(scene), sha256(path.join(tmp, `scene-${scene}-prompt.txt`))]),
      ),
      recovery: Object.fromEntries(
        scenes.map((scene) => [
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
    nextCountry: "Malta",
    nextBatch: 320,
    nextScenes: [1300, 1301, 1302, 1303],
    nextThemePair: ["undercover investigator couture", "nurse-care couture"],
  },
  remoteStateAtCheckpoint: {
    localBranch: "agent/iat-launch-window",
    sourceHead: "350371679982e346e47b51d110462f6409eda9e0",
    recoveryRemoteBeforeCommit: "350371679982e346e47b51d110462f6409eda9e0",
    originMain: "6cdd669301029c184322c4fa0be124d309e23533",
    headOnlyCommitsAgainstMain: 18,
    mainOnlyCommitsAgainstHead: 2,
    mainAction: "untouched because origin/main has two independent commits",
  },
  repositoryScope: {
    copiedAcceptedAssets: [],
    stagedPaths: ["assets/lore/starlight-era/batch-319-montenegro-recovery-checkpoint.json"],
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
