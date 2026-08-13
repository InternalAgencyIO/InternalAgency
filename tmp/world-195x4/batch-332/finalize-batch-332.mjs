import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "../../..");
const preflightPath = path.join(scriptDir, "batch-332-kiribati-preflight.json");
const contractPath = path.join(root, "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const checkpointPath = path.join(
  root,
  "assets/lore/starlight-era/batch-332-kiribati-originality-reset-checkpoint.json",
);
const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex").toUpperCase();
const checkpoint = JSON.parse(fs.readFileSync(preflightPath, "utf8"));
const amendedContractBytes = fs.readFileSync(contractPath);

checkpoint.status = "terminal-blocked-zero-accepted-originality-reset";
checkpoint.completedAt = new Date().toISOString();
checkpoint.contractSha256AtRender = checkpoint.contractSha256;
checkpoint.postBatchContractAmendment = {
  reason: "Direct user correction after the Kiribati renders: restore structural outfit originality, hard relationship storytelling, cinematic theme and country-location fusion, deterministic odd props, and joint PAWS/MAX mascot states.",
  activeFromBatch: 333,
  sha256: sha256(amendedContractBytes),
  nextBatchMode: {
    country: "Seychelles",
    batch: 333,
    locations: "four different recognizable Seychelles locations",
    scenesOneAndTwo: "country-led hybrid with two or three hard country-motif looks and at least two private-jet thematic looks",
    scenesThreeAndFour: "theme-led private-jet aviation couture at two additional Seychelles landmarks",
    themeDuration: "private-jet aviation couture remains active for Batches 333 and 334",
  },
};
checkpoint.acceptancePolicy = {
  mode: "strict-anatomy-safety-originality-soul",
  hardGates: [
    "exact cast, identity, and limb ownership",
    "safe deterministic inert-prop handler and target",
    "rolled mascot and odd-prop materialization",
    "four structurally different outfit fingerprints rather than palette-swapped copies",
    "country and theme both foregrounded according to scene mode",
    "specific readable adult relationship event rather than generic clustered posing",
    "male strongest sustained eye line to ECE in the selected male scene",
  ],
  userRejectedPattern: [
    "same short map-print garment family repeated across the quartet",
    "color swaps acting as the main outfit difference",
    "repeated clustered cheek-touch tableau",
    "weak relationship narrative and lost project personality",
  ],
};
checkpoint.renderAttempts = [
  {
    scene: 1348,
    attempt: 1,
    source: "raw",
    result: "rejected-hard-gate",
    reasons: ["rolled paper target absent", "Alia's second guidance hand not continuously traceable"],
    preservedAsset: "tmp/world-195x4/batch-332/raw/1348-kiribati-south-tarawa-raw.png",
  },
  {
    scene: 1348,
    attempt: 2,
    source: "single-recovery-pass",
    result: "terminal-rejected-originality-soul",
    reasons: ["target and guidance improved", "quartet still converged on the same short printed garment family", "romance remained a generic paired kiss cluster rather than a specific dynamic choice"],
    preservedAsset: "tmp/world-195x4/batch-332/recovery/1348-kiribati-south-tarawa-recovery.png",
  },
  {
    scene: 1349,
    attempt: 1,
    source: "raw",
    result: "rejected-hard-gate",
    reasons: ["rolled open-water marker absent"],
    preservedAsset: "tmp/world-195x4/batch-332/raw/1349-kiribati-abaiang-raw.png",
  },
  {
    scene: 1349,
    attempt: 2,
    source: "single-recovery-pass",
    result: "terminal-rejected-originality-soul",
    reasons: ["water marker corrected", "outfits remained palette-swapped map-print copies", "clustered cheek-touch staging repeated the preceding scene's contact graph"],
    preservedAsset: "tmp/world-195x4/batch-332/recovery/1349-kiribati-abaiang-recovery.png",
  },
  {
    scene: 1350,
    attempt: 1,
    source: "raw",
    result: "rejected-hard-gate",
    reasons: ["adult male strongest eye line landed on the central pair instead of ECE", "rolled open-water marker absent"],
    preservedAsset: "tmp/world-195x4/batch-332/raw/1350-kiribati-kiritimati-male-raw.png",
  },
  {
    scene: 1350,
    attempt: 2,
    source: "single-recovery-pass",
    result: "terminal-rejected-originality-soul",
    reasons: ["male eye line and marker corrected", "quartet still used the repeated map-print mini-set family", "five-person relationship beat remained a static cluster without the required infidelity story"],
    preservedAsset: "tmp/world-195x4/batch-332/recovery/1350-kiribati-kiritimati-male-recovery.png",
  },
  {
    scene: 1351,
    attempt: 1,
    source: "raw",
    result: "rejected-hard-gate",
    reasons: ["rolled paper target and separate ECE route map absent"],
    preservedAsset: "tmp/world-195x4/batch-332/raw/1351-kiribati-kanton-raw.png",
  },
  {
    scene: 1351,
    attempt: 2,
    source: "single-recovery-pass",
    result: "terminal-rejected-originality-soul",
    reasons: ["paper target and route map corrected", "same map-print mini-set family persisted", "relationship staging repeated the same cheek-touch cluster and failed the soul gate"],
    preservedAsset: "tmp/world-195x4/batch-332/recovery/1351-kiribati-kanton-recovery.png",
  },
];
checkpoint.acceptedAssets = [];
checkpoint.rejectedAssets = [1348, 1349, 1350, 1351].map((scene) => ({
  scene,
  attemptsExhausted: true,
  raw: checkpoint.renderAttempts.find((item) => item.scene === scene && item.attempt === 1).preservedAsset,
  recovery: checkpoint.renderAttempts.find((item) => item.scene === scene && item.attempt === 2).preservedAsset,
  terminalReason: "direct user originality and relationship-story rejection after the single recovery pass",
}));
checkpoint.queueAdvance = {
  allowed: true,
  reason: "Kiribati reached a terminal zero-accepted checkpoint after its single recovery pass; the revised contract begins with Seychelles.",
  nextCountry: "Seychelles",
  nextBatch: 333,
  nextScenes: [1352, 1353, 1354, 1355],
  activeCinematicTheme: "private-jet aviation couture",
  themeBatchOrdinal: 1,
};
checkpoint.xPost = {
  status: "deferred-insufficient-accepted-assets",
  eligible: false,
  acceptedCurrentCountryCount: 0,
  minimumCurrentCountryAcceptedAssets: 2,
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`);
console.log(checkpointPath);
