import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve("tmp/world-195x4/batch-338");
const lore = path.resolve("assets/lore/starlight-era");
const generated = "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086";
const rawDir = path.join(root, "raw");
fs.mkdirSync(rawDir, { recursive: true });
const raw1372 = path.join(rawDir, "1372-antigua-nelsons-dockyard-raw.png");
const raw1374 = path.join(rawDir, "1374-antigua-devils-bridge-raw.png");
fs.copyFileSync(path.join(generated, "exec-52441b79-7520-452c-a97a-2e7e308df7c7.png"), raw1372);
fs.copyFileSync(path.join(generated, "exec-ec861d7f-6576-4324-982f-679a5215bd65.png"), raw1374);

const asset1372 = "1372-antigua-nelsons-dockyard-rescue-vessel.png";
const asset1374 = "1374-antigua-devils-bridge-rescue-vessel-male.png";
fs.copyFileSync(raw1372, path.join(lore, asset1372));
fs.copyFileSync(raw1374, path.join(lore, asset1374));
const sha256 = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").toUpperCase();

const preflight = JSON.parse(fs.readFileSync(path.join(root, "batch-338-antigua-and-barbuda-preflight.json"), "utf8"));
preflight.status = "terminal-partially-accepted";
preflight.renderAttempts = [
  {
    scene: 1372,
    raw: "tmp/world-195x4/batch-338/raw/1372-antigua-nelsons-dockyard-raw.png",
    rawOutcome: "rendered",
    recovery: null,
    recoveryUsed: false,
    result: "accepted",
    acceptedAsset: `assets/lore/starlight-era/${asset1372}`,
    audit: "Exactly four intended adult women, original country-led rescue-vessel couture, Nelson's Dockyard, large vessel, lap-sitting love beat and Ellie's mirrored megaphone are clear. ECE's inert prop points away from the group; the target is not fully visible and is accepted as a logged throughput tolerance.",
  },
  {
    scene: 1373,
    raw: null,
    rawOutcome: "output-stage moderation block",
    rawRequestId: "44bea40e-8912-488d-a58d-a73ae9a45ca2",
    recovery: null,
    recoveryUsed: false,
    result: "rejected",
    audit: "No durable image was emitted. Throughput mode skipped moderation recovery.",
  },
  {
    scene: 1374,
    raw: "tmp/world-195x4/batch-338/raw/1374-antigua-devils-bridge-raw.png",
    rawOutcome: "rendered",
    recovery: null,
    recoveryUsed: false,
    result: "accepted",
    acceptedAsset: `assets/lore/starlight-era/${asset1374}`,
    audit: "All four intended adult women plus the adult male are present with distinct theme-led couture, a dynamic three-person choice, complete Devil's Bridge and the offshore rescue vessel. ECE's prop line terminates at the isolated paper target. The male's strongest ECE eye line is weaker than planned and is accepted as a logged throughput tolerance.",
  },
  {
    scene: 1375,
    raw: null,
    rawOutcome: "output-stage moderation block",
    rawRequestId: "cfc11b67-656b-4fee-8124-ab40f6b54098",
    recovery: null,
    recoveryUsed: false,
    result: "rejected",
    audit: "No durable image was emitted. Throughput mode skipped moderation recovery.",
  },
];
preflight.acceptedAssets = [
  { scene: 1372, file: asset1372, sha256: sha256(path.join(lore, asset1372)), source: "tmp/world-195x4/batch-338/raw/1372-antigua-nelsons-dockyard-raw.png" },
  { scene: 1374, file: asset1374, sha256: sha256(path.join(lore, asset1374)), source: "tmp/world-195x4/batch-338/raw/1374-antigua-devils-bridge-raw.png" },
];
preflight.rejectedAssets = [
  { scene: 1373, reason: "output-stage moderation block with no durable image" },
  { scene: 1375, reason: "output-stage moderation block with no durable image" },
];
preflight.xPost = {
  status: "ready-eligible-assets",
  requiredAcceptedCurrentCountryAssets: 2,
  availableAcceptedCurrentCountryAssets: 2,
  caption: preflight.xPublishingPlan.captionIfEligible,
  primaryAssets: [asset1372, asset1374],
  secondaryAsset: "1369-saint-vincent-dark-view-rescue-vessel-recovery.png",
};
preflight.acceptanceMode = {
  name: "throughput-acceptance-override",
  startingBatch: 336,
  defaultDecision: "accept and log deviations",
  rejectOnly: "missing core cast, decisive unsafe mission-prop line, explicit content, visible firing or ammunition, or glaring unusable whole-limb or person duplication",
};
preflight.terminalAt = new Date().toISOString();
preflight.acceptanceSummary = { attemptedScenes: 4, acceptedScenes: 2, rejectedScenes: 2, terminalOutcomeAllowsQueueAdvance: true, xEligible: true };
const checkpoint = path.join(lore, "batch-338-antigua-and-barbuda-rescue-vessel-checkpoint.json");
fs.writeFileSync(checkpoint, `${JSON.stringify(preflight, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ checkpoint, acceptedAssets: preflight.acceptedAssets }, null, 2));
