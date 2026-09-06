import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const preflightPath = path.resolve("tmp/world-195x4/batch-323/batch-323-brunei-preflight.json");
const checkpointPath = path.resolve("assets/lore/starlight-era/batch-323-brunei-relaxed-audit-checkpoint.json");
const checkpoint = JSON.parse(fs.readFileSync(preflightPath, "utf8"));
const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex").toUpperCase();
const acceptedFilename = "1312-brunei-kampong-ayer-ash-sunset-paws-wrist-guidance.png";
const acceptedPath = path.resolve("assets/lore/starlight-era", acceptedFilename);
const acceptedBytes = fs.readFileSync(acceptedPath);

checkpoint.status = "terminal-partially-accepted-after-single-recovery-pass";
checkpoint.renderAttempts = {
  raw: {
    status: "completed-with-shared-output-moderation-abort",
    requested: 4,
    fulfilled: 1,
    fulfilledScenes: [1312],
    noPersistedAssetScenes: [1313, 1314, 1315],
    concurrency: "four independent built-in image generation calls launched together",
    rendererSafetyRequestId: "bf19a173-4e17-48a4-9ec9-bef6c48d90a9",
  },
  recovery: {
    status: "completed-with-shared-output-moderation-abort",
    attemptedScenes: [1313, 1314, 1315],
    fulfilled: 0,
    maximumPerBlockedScene: 1,
    furtherRecoveryAllowed: false,
    rendererSafetyRequestId: "a61191ef-c098-4e3e-bfa5-8efc03c45367",
  },
};
checkpoint.acceptancePolicy = {
  hardGates: "identity count, exact arm and hand ownership, resolved handler, active prop use, rolled pose and safe target line, indexed trigger finger, no ammunition or firing, secure opaque clothing, PAWS safety, rainbow-hosiery exclusivity, male eye line, and large complete country motifs",
  relaxedSoftGates: "minor contact-placement drift, subtle emotion drift, weather spill, and compact spacing may pass when every hard gate and the public-safe story remain readable",
};
checkpoint.acceptedAssets = [{
  scene: 1312,
  filename: acceptedFilename,
  pass: "raw",
  hardGate: "accepted: exactly four mature adult women with eight attributable arms and eight hands; ECE alone owns the prop in a safe leftward line to a visible empty paper target and timber backstop; Alia gives visible two-hand forearm guidance without touching the prop; PAWS is securely held far to the right; large complete Kampong Ayer and Brunei River motifs appear across all four outfits",
  relaxedSoftGate: "accepted despite guidance landing partly on ECE's forearm and side rather than both exact wrist points, and despite sunset moisture on the deck; handler, safe line, target, PAWS separation, anatomy, identities, secure clothing, footwear, motifs, and affectionate contacts remain clear",
  bytes: acceptedBytes.length,
  sha256: sha256(acceptedBytes),
  acceptedPath: path.relative(process.cwd(), acceptedPath).replaceAll("\\", "/"),
  copiedFromPreservedOriginal: true,
}];
checkpoint.rejectedAssets = [1313, 1314, 1315].map((scene) => ({
  scene,
  raw: null,
  recovery: null,
  status: "terminal-blocked-no-asset-after-single-recovery-pass",
  reasons: [
    "the shared four-scene raw call ended on output moderation and no local asset for this scene was persisted",
    "the scene was relaunched once with stricter mature, opaque, non-suggestive public-fashion phrasing",
    "the shared recovery call again ended on output moderation before any local asset for Scenes 1313 through 1315 was persisted",
    "no image exists to pass through the hard anatomy, handler, target, identity, hosiery, male-eye-line, or motif gates",
  ],
}));
checkpoint.acceptedCount = 1;
checkpoint.rejectedCount = 3;
checkpoint.queueAdvance = {
  eligible: true,
  reason: "one accepted local Brunei asset exists and Batch 323 is terminal after the single recovery pass; terminal checkpoints advance without stalling",
  country: "Belize",
  batch: 324,
  scenes: [1316, 1317, 1318, 1319],
  themes: [
    "Paris runway model couture",
    "Paris runway model couture",
    "cleaner and service couture",
    "cleaner and service couture",
  ],
};
checkpoint.xPost = {
  status: "deferred-insufficient-accepted-assets",
  minimumCurrentCountryAcceptedAssets: 2,
  currentCountryAcceptedAssets: [acceptedFilename],
  currentCountryAcceptedCount: 1,
  captionHeld: checkpoint.xPublishingPlan.captionIfEligible,
  reason: "only one accepted current-country Brunei image exists",
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({checkpointPath, status: checkpoint.status, acceptedCount: checkpoint.acceptedCount, rejectedCount: checkpoint.rejectedCount, xPost: checkpoint.xPost, queueAdvance: checkpoint.queueAdvance}, null, 2));
