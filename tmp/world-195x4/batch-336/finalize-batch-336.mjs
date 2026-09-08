import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const preflightPath = path.join(root, "tmp/world-195x4/batch-336/batch-336-tonga-preflight.json");
const checkpointPath = path.join(root, "assets/lore/starlight-era/batch-336-tonga-helicopter-checkpoint.json");
const checkpoint = JSON.parse(fs.readFileSync(preflightPath, "utf8"));

checkpoint.status = "terminal-partially-accepted";
checkpoint.acceptanceMode = {
  name: "throughput-acceptance-override",
  startingBatch: 336,
  defaultDecision: "accept and log deviations",
  rejectOnly: "missing core cast, decisive unsafe mission-prop line, explicit content, visible firing or ammunition, or glaring unusable whole-limb duplication",
};
checkpoint.renderAttempts = [
  {
    scene: 1364,
    raw: "tmp/world-195x4/batch-336/raw/1364-tonga-nukualofa-raw.png",
    rawOutcome: "rendered with missing Ellie",
    recovery: "tmp/world-195x4/batch-336/recovery/1364-tonga-recovery.png",
    recoveryUsed: true,
    result: "accepted",
    acceptedAsset: "assets/lore/starlight-era/1364-tonga-nukualofa-helicopter-recovery.png",
    audit: "Recovery restores all four women plus the male, keeps Nuku'alofa and the civilian helicopter foregrounded, and preserves an isolated empty-water prop line. The exact slow-dance chain and male-to-ECE eye line are weaker than planned and are logged as throughput tolerances.",
  },
  {
    scene: 1365,
    raw: null,
    rawOutcome: "output-stage moderation block",
    rawRequestId: "3cc288bc-c094-4272-a9c3-276a0e75985d",
    recovery: null,
    recoveryUsed: false,
    result: "rejected",
    audit: "No durable image was emitted. Throughput mode skipped a moderation recovery.",
  },
  {
    scene: 1366,
    raw: null,
    rawOutcome: "output-stage moderation block",
    rawRequestId: "6fb99f37-be70-40c8-bf62-1ed75c7b159a",
    recovery: null,
    recoveryUsed: false,
    result: "rejected",
    audit: "No durable image was emitted. Throughput mode skipped a moderation recovery.",
  },
  {
    scene: 1367,
    raw: "tmp/world-195x4/batch-336/raw/1367-tonga-vavau-raw.png",
    rawOutcome: "rendered with group-crossing prop direction",
    recovery: "tmp/world-195x4/batch-336/recovery/1367-tonga-recovery.png",
    recoveryUsed: true,
    result: "accepted",
    acceptedAsset: "assets/lore/starlight-era/1367-tonga-vavau-helicopter-recovery.png",
    audit: "Recovery turns ECE fully toward the isolated paper target and backstop, preserves all four women, PAWS, Mount Talau, Port of Refuge and the civilian helicopter. Minor pose and garment deviations are accepted under throughput mode.",
  },
];
checkpoint.acceptedAssets = [
  {
    scene: 1364,
    file: "1364-tonga-nukualofa-helicopter-recovery.png",
    sha256: "5D4E6324CC84EBBCECC9A7D20691B1D8C3E322228345F020FAA2E153F041B183",
    source: "tmp/world-195x4/batch-336/recovery/1364-tonga-recovery.png",
  },
  {
    scene: 1367,
    file: "1367-tonga-vavau-helicopter-recovery.png",
    sha256: "207D9FE1E8E6075F8F1FEF385B48C8DE261B99027891EC0D47D0E2C6F83A334E",
    source: "tmp/world-195x4/batch-336/recovery/1367-tonga-recovery.png",
  },
];
checkpoint.rejectedAssets = [
  { scene: 1365, reason: "output-stage moderation block with no durable image" },
  { scene: 1366, reason: "output-stage moderation block with no durable image" },
];
checkpoint.xPost = {
  status: "ready-eligible-assets",
  requiredAcceptedCurrentCountryAssets: 2,
  availableAcceptedCurrentCountryAssets: 2,
  caption: checkpoint.xPublishingPlan.captionIfEligible,
  primaryAssets: checkpoint.acceptedAssets.map((asset) => asset.file),
  secondaryAsset: "1344-saint-lucia-soufriere-runway-paper-target-recovery.png",
};
checkpoint.terminalAt = new Date().toISOString();
checkpoint.acceptanceSummary = {
  attemptedScenes: 4,
  acceptedScenes: 2,
  rejectedScenes: 2,
  terminalOutcomeAllowsQueueAdvance: true,
  xEligible: true,
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`);
console.log(checkpointPath);
