import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(.:)/, "$1")), "../../..");
const batchDir = path.join(repo, "tmp", "world-195x4", "batch-314");
const assetDir = path.join(repo, "assets", "lore", "starlight-era");
const preflightPath = path.join(batchDir, "batch-314-guyana-preflight.json");
const checkpointPath = path.join(assetDir, "batch-314-guyana-recovery-checkpoint.json");
const preflight = JSON.parse(fs.readFileSync(preflightPath, "utf8"));

const sha256 = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").toUpperCase();
const fileRecord = (file, workspacePath) => {
  const stat = fs.statSync(file);
  return {
    workspacePath,
    bytes: stat.size,
    width: 941,
    height: 1672,
    sha256: sha256(file),
    preservedOriginal: true,
    copiedToAcceptedAssets: false,
  };
};

const raw1276 = path.join(batchDir, "raw", "1276-raw.png");
const recovery1277 = path.join(batchDir, "raw", "1277-recovery.png");
const recovery1278 = path.join(batchDir, "raw", "1278-recovery.png");
const recovery1279 = path.join(batchDir, "raw", "1279-recovery.png");

const promptHashes = {
  preflight: sha256(preflightPath),
  primary: {
    1276: sha256(path.join(batchDir, "scene-1276-prompt.txt")),
    1277: sha256(path.join(batchDir, "scene-1277-prompt.txt")),
    1278: sha256(path.join(batchDir, "scene-1278-prompt.txt")),
    1279: sha256(path.join(batchDir, "scene-1279-prompt.txt")),
  },
  recovery: {
    1276: sha256(path.join(batchDir, "recovery", "scene-1276-recovery-edit-prompt.txt")),
    1277: sha256(path.join(batchDir, "recovery", "scene-1277-recovery-prompt.txt")),
    1278: sha256(path.join(batchDir, "recovery", "scene-1278-recovery-prompt.txt")),
    1279: sha256(path.join(batchDir, "recovery", "scene-1279-recovery-prompt.txt")),
  },
};

const renderAttempts = [
  {
    scene: 1276,
    attempt: "raw",
    status: "rendered-rejected-by-strict-audit",
    generatedName: "exec-bc277424-c2ab-4383-b8f5-3e71196cf482.png",
    absoluteGeneratedPath: "C:\\Users\\A\\.codex\\generated_images\\019fd625-0bf6-78d2-9fb8-3f3e22c1d086\\exec-bc277424-c2ab-4383-b8f5-3e71196cf482.png",
    ...fileRecord(raw1276, "tmp/world-195x4/batch-314/raw/1276-raw.png"),
    reason: "The quartet, Guyana motifs, Orinduik setting, distant dust, and PAWS are present, but ECE's separate holographic map is absent; PAWS wears a red neck accessory instead of being collarless; the overlook floor is wet rather than dry and nonslip; and the magazine-free empty-well condition is not legible. Radiance and Alia also read as mouth-to-mouth rather than the frozen quick cheek greeting.",
  },
  {
    scene: 1277,
    attempt: "raw",
    status: "blocked-output-moderation-no-image",
    category: "sexual",
    requestId: "ac2a48f9-9b19-4db5-b467-46ee85a22b58",
    reason: "The raw renderer returned no image artifact.",
  },
  {
    scene: 1278,
    attempt: "raw",
    status: "blocked-output-moderation-no-image",
    category: "sexual",
    requestId: "e258adf6-23a2-4efd-9042-e03da8d19c23",
    reason: "The raw renderer returned no image artifact.",
  },
  {
    scene: 1279,
    attempt: "raw",
    status: "blocked-output-moderation-no-image",
    category: "sexual",
    requestId: "1a2e647c-ffbc-439b-9a08-621af5277fdb",
    reason: "The raw renderer returned no image artifact.",
  },
  {
    scene: 1276,
    attempt: "recovery",
    status: "blocked-output-moderation-no-image",
    category: "sexual",
    requestId: "b22ea8f8-d1fa-490d-808e-7f9e887d4762",
    reason: "The single allowed correction edit returned no image artifact.",
  },
  {
    scene: 1277,
    attempt: "recovery",
    status: "rendered-rejected-by-strict-audit",
    generatedName: "exec-86378817-7efe-448e-bb5f-c89256a5dd65.png",
    absoluteGeneratedPath: "C:\\Users\\A\\.codex\\generated_images\\019fd625-0bf6-78d2-9fb8-3f3e22c1d086\\exec-86378817-7efe-448e-bb5f-c89256a5dd65.png",
    ...fileRecord(recovery1277, "tmp/world-195x4/batch-314/raw/1277-recovery.png"),
    reason: "ECE has only one continuously traceable arm and hand, so the strict eight-arm and eight-hand owner gate fails. ECE's separate holographic map is absent, the magazine-free empty well is not legible, both crying rolls lack visible tears, and multiple frozen hand contacts are substituted.",
  },
  {
    scene: 1278,
    attempt: "recovery",
    status: "rendered-rejected-by-strict-audit",
    generatedName: "exec-a97ee73e-6b99-4131-8aa0-7dc5af115f4f.png",
    absoluteGeneratedPath: "C:\\Users\\A\\.codex\\generated_images\\019fd625-0bf6-78d2-9fb8-3f3e22c1d086\\exec-a97ee73e-6b99-4131-8aa0-7dc5af115f4f.png",
    ...fileRecord(recovery1278, "tmp/world-195x4/batch-314/raw/1278-recovery.png"),
    reason: "ECE has a hidden second arm and hand, so the strict ten-arm and ten-hand owner gate fails. ECE's separate holographic map is absent, the male's strongest eye line goes to Alia instead of ECE, the ECE-Radiance side embrace is omitted, and the magazine-free empty well is not legible.",
  },
  {
    scene: 1279,
    attempt: "recovery",
    status: "rendered-rejected-by-strict-audit",
    generatedName: "exec-026bba10-f837-4c37-ba8b-9f3c802cde0a.png",
    absoluteGeneratedPath: "C:\\Users\\A\\.codex\\generated_images\\019fd625-0bf6-78d2-9fb8-3f3e22c1d086\\exec-026bba10-f837-4c37-ba8b-9f3c802cde0a.png",
    ...fileRecord(recovery1279, "tmp/world-195x4/batch-314/raw/1279-recovery.png"),
    reason: "ECE has only one continuously traceable arm and hand, so the strict eight-arm and eight-hand owner gate fails. ECE's required wrist catch and separate holographic map are absent, the magazine-free empty well is not legible, and the frozen ribbon-contact inventory is substituted.",
  },
];

const byScene = (scene, attempt) => renderAttempts.find((item) => item.scene === scene && item.attempt === attempt);
const checkpoint = {
  ...preflight,
  status: "terminal-blocked-after-single-recovery-pass",
  promptMaterialization: {
    deterministicReruns: 2,
    byteStable: true,
    sha256: promptHashes,
  },
  renderExecution: {
    mode: "built-in image generation",
    rawLaunch: "four independent 9:16 calls launched concurrently",
    recoveryLaunch: "four independent calls launched concurrently; one correction edit for 1276 and fresh restrained renders for 1277-1279",
    recoveryBudget: "exactly one recovery pass per scene, now exhausted",
  },
  renderAttempts,
  acceptedAssets: [],
  rejectedAssets: renderAttempts.filter((item) => item.status !== "blocked-output-moderation-no-image"),
  sceneResults: Object.fromEntries([1276, 1277, 1278, 1279].map((scene) => [scene, {
    rawAudit: {
      accepted: false,
      status: byScene(scene, "raw").status,
      reason: byScene(scene, "raw").reason,
      requestId: byScene(scene, "raw").requestId ?? null,
    },
    recoveryAudit: {
      accepted: false,
      status: byScene(scene, "recovery").status,
      reason: byScene(scene, "recovery").reason,
      requestId: byScene(scene, "recovery").requestId ?? null,
    },
    terminalOutcome: "blocked-after-single-recovery-pass",
    acceptedAsset: null,
  }])),
  shorteningVariants: [],
  xPost: {
    status: "deferred-insufficient-accepted-assets",
    acceptedCurrentCountryAssets: 0,
    minimumRequired: 2,
    captionIfEligible: preflight.xPublishingPlan.captionIfEligible,
    ledgerModified: false,
    ledgerSha256: "6267A3860AD8064EE392BE7870F81219F73B39AC5C71144AE5704A3AB9A7FC3D",
    pendingPost: null,
    preparedQueueCount: 0,
    latestAssistedDrainStatus: "publicly-clear-live-audited",
    action: "No X post was attempted because Guyana has fewer than two accepted current-country images and the inspected X backlog is clear.",
  },
  queueAdvance: {
    allowed: true,
    reason: "The batch is terminal after one raw pass and one recovery pass per scene, so the binding queue advances despite zero accepted assets.",
    nextCountry: "Solomon Islands",
    nextBatch: 315,
    nextScenes: [1280, 1281, 1282, 1283],
    nextThemePair: ["doctor-clinical-command couture", "adult nightlife dance-performance couture"],
  },
  remoteStateAtCheckpoint: {
    localBranch: "agent/iat-launch-window",
    sourceHead: "f71fb339858507cec71b0571093546a90c9665bc",
    recoveryRemoteBeforeCommit: "f71fb339858507cec71b0571093546a90c9665bc",
    originMain: "6cdd669301029c184322c4fa0be124d309e23533",
    headOnlyCommitsAgainstMain: 13,
    mainOnlyCommitsAgainstHead: 2,
    mainAction: "untouched because origin/main has two independent commits",
  },
  repositoryScope: {
    copiedAcceptedAssets: [],
    stagedPaths: ["assets/lore/starlight-era/batch-314-guyana-recovery-checkpoint.json"],
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
console.log(JSON.stringify({ checkpointPath, sha256: sha256(checkpointPath) }, null, 2));
