import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve("tmp/world-195x4/batch-337");
const lore = path.resolve("assets/lore/starlight-era");
const preflightPath = path.join(root, "batch-337-saint-vincent-and-the-grenadines-preflight.json");
const checkpointPath = path.join(lore, "batch-337-saint-vincent-and-the-grenadines-rescue-vessel-checkpoint.json");
const generated = "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086";
const rawDir = path.join(root, "raw");
const recoveryDir = path.join(root, "recovery");
fs.mkdirSync(rawDir, { recursive: true });
fs.mkdirSync(recoveryDir, { recursive: true });

const copies = [
  [path.join(generated, "exec-08c88629-1df3-40ae-b6ca-c7c63e577c80.png"), path.join(rawDir, "1368-saint-vincent-kingstown-raw.png")],
  [path.join(generated, "exec-c840f93c-7818-4036-af88-708e257018a3.png"), path.join(rawDir, "1369-saint-vincent-dark-view-raw.png")],
  [path.join(generated, "exec-93178f92-ebe1-4a2d-a18a-b3b68c4dd61a.png"), path.join(recoveryDir, "1369-saint-vincent-dark-view-recovery.png")],
];
for (const [source, target] of copies) fs.copyFileSync(source, target);

const acceptedName = "1369-saint-vincent-dark-view-rescue-vessel-recovery.png";
const acceptedPath = path.join(lore, acceptedName);
fs.copyFileSync(copies[2][1], acceptedPath);
const sha256 = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").toUpperCase();

const checkpoint = JSON.parse(fs.readFileSync(preflightPath, "utf8"));
checkpoint.status = "terminal-partially-accepted";
checkpoint.renderAttempts = [
  {
    scene: 1368,
    raw: "tmp/world-195x4/batch-337/raw/1368-saint-vincent-kingstown-raw.png",
    rawOutcome: "rendered with decisive group-crossing mission-prop line",
    recovery: null,
    recoveryUsed: true,
    recoveryOutcome: "output-stage moderation block",
    recoveryRequestId: "455256d7-3deb-4fab-ab92-8d4ff0254bf8",
    result: "rejected",
    audit: "The raw image preserved the complete cast, strong romance, both mascots, giant tuning fork, Fort Charlotte and the rescue vessel, but the mission-prop direction crossed the group. Its single recovery emitted no durable image.",
  },
  {
    scene: 1369,
    raw: "tmp/world-195x4/batch-337/raw/1369-saint-vincent-dark-view-raw.png",
    rawOutcome: "rendered with a duplicated fifth woman",
    recovery: "tmp/world-195x4/batch-337/recovery/1369-saint-vincent-dark-view-recovery.png",
    recoveryUsed: true,
    result: "accepted",
    acceptedAsset: `assets/lore/starlight-era/${acceptedName}`,
    audit: "Recovery restores exactly four intended adult women, MAX on a dry padded bench, the isolated target line, distinct outfits, Dark View Falls and the fictional rescue vessel. The kinetic umbrella and some exact dance choreography are omitted and accepted as logged throughput tolerances.",
  },
  {
    scene: 1370,
    raw: null,
    rawOutcome: "output-stage moderation block",
    rawRequestId: "3cf15217-0029-4c29-8296-c77b076aedd7",
    recovery: null,
    recoveryUsed: false,
    result: "rejected",
    audit: "No durable image was emitted. Throughput mode skipped moderation recovery.",
  },
  {
    scene: 1371,
    raw: null,
    rawOutcome: "output-stage moderation block",
    rawRequestId: "6022e0e8-6251-49da-b4b3-7fbfaaa6c19c",
    recovery: null,
    recoveryUsed: false,
    result: "rejected",
    audit: "No durable image was emitted. Throughput mode skipped moderation recovery.",
  },
];
checkpoint.acceptedAssets = [{ scene: 1369, file: acceptedName, sha256: sha256(acceptedPath), source: "tmp/world-195x4/batch-337/recovery/1369-saint-vincent-dark-view-recovery.png" }];
checkpoint.rejectedAssets = [
  { scene: 1368, reason: "decisive unsafe mission-prop line; single recovery moderation-blocked" },
  { scene: 1370, reason: "output-stage moderation block with no durable image" },
  { scene: 1371, reason: "output-stage moderation block with no durable image" },
];
checkpoint.xPost = {
  status: "deferred-insufficient-accepted-assets",
  requiredAcceptedCurrentCountryAssets: 2,
  availableAcceptedCurrentCountryAssets: 1,
  caption: checkpoint.xPublishingPlan.captionIfEligible,
  primaryAssets: [acceptedName],
};
checkpoint.acceptanceMode = {
  name: "throughput-acceptance-override",
  startingBatch: 336,
  defaultDecision: "accept and log deviations",
  rejectOnly: "missing core cast, decisive unsafe mission-prop line, explicit content, visible firing or ammunition, or glaring unusable whole-limb or person duplication",
};
checkpoint.terminalAt = new Date().toISOString();
checkpoint.acceptanceSummary = {
  attemptedScenes: 4,
  acceptedScenes: 1,
  rejectedScenes: 3,
  terminalOutcomeAllowsQueueAdvance: true,
  xEligible: false,
};
fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ checkpoint: checkpointPath, acceptedPath, acceptedSha256: checkpoint.acceptedAssets[0].sha256 }, null, 2));
