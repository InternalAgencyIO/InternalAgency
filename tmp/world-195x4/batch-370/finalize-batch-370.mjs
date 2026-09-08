import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const generated = "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086";
const preflightPath = path.join(root, "tmp/world-195x4/batch-370/batch-370-united-arab-emirates-preflight.json");
const checkpointPath = path.join(root, "assets/lore/starlight-era/batch-370-united-arab-emirates-polar-airship-checkpoint.json");
const assetName = "1500-united-arab-emirates-dubai-polar-airship-fast-pass.png";
const acceptedRaw = `${generated}/exec-ad79f9b8-c1e7-4b37-994a-29b6862fe4cd.png`;

const checkpoint = JSON.parse(fs.readFileSync(preflightPath, "utf8"));
fs.copyFileSync(acceptedRaw, path.join(root, "assets/lore/starlight-era", assetName));

checkpoint.status = "terminal-partially-accepted";
checkpoint.completedAt = new Date().toISOString();
checkpoint.throughputMode = {
  active: true,
  policy: "Fast-pass acceptance preserves structurally safe usable renders while recording minor visual deviations; hard safety, explicit-content, missing-core-character, and glaring extra-person or extra-limb failures remain terminal rejects."
};
checkpoint.renderAttempts = {
  raw: {
    status: "complete",
    requested: 4,
    fulfilled: 1,
    moderationBlocked: 3,
    concurrency: "four independent built-in image generation calls launched together"
  },
  recovery: {
    status: "not-used",
    maximumPerBlockedScene: 1,
    reason: "The only delivered render passed the fast-pass hard gates; moderation-blocked calls produced no auditable image and were not retried."
  }
};
checkpoint.acceptedAssets = [{
  scene: 1500,
  file: assetName,
  sourceRaw: acceptedRaw,
  decision: "accepted-fast-pass",
  audit: {
    coreCast: "Exactly four clearly adult core women are present; Alia retains the braided anchor.",
    anatomy: "No glaring extra whole person or limb is visible; eight owned arms and hands read plausibly.",
    missionProp: "ECE alone uses a two-hand side-on grip toward a visible empty paper target and complete earthen backstop, away from every person and the camera; no ammunition, firing, flash or threat appears.",
    romance: "Radiance, Ellie and Alia form a readable hand, forearm and waist contact chain with aligned attention while ECE remains isolated on the mission beat.",
    themeLocation: "Burj Khalifa, Downtown Dubai, fountain basin, heavy rain, civilian airship gondola and polar lift-cell couture read together immediately.",
    deviations: [
      "The pulled-away protective hard beat resolves as a standing three-woman choice rather than a full behind embrace.",
      "Country motifs read most strongly through skyline-shaped metallic construction rather than three equally large sculptural motifs."
    ]
  }
}];
checkpoint.rejectedAssets = [
  {
    scene: 1501,
    status: "terminal-renderer-output-moderation-block",
    requestId: "a6d32193-c796-4fe4-b40b-37f13860a5e2",
    reason: "The image service rejected the output before an auditable asset was delivered."
  },
  {
    scene: 1502,
    status: "terminal-renderer-output-moderation-block",
    requestId: "c987e267-a0b6-4458-bea9-31a9d6528bef",
    reason: "The image service rejected the output before an auditable asset was delivered."
  },
  {
    scene: 1503,
    status: "terminal-renderer-output-moderation-block",
    requestId: "ca8261aa-8f27-4f05-8b3e-29338792a3c9",
    reason: "The image service rejected the output before an auditable asset was delivered."
  }
];
checkpoint.xPost = {
  status: "deferred-insufficient-accepted-assets",
  minimumCurrentCountryAcceptedAssets: 2,
  acceptedCurrentCountryAssets: 1,
  captionIfEligible: "United Arab Emirates white-heart Dominican Republic #UnitedArabEmirates",
  reason: "United Arab Emirates has fewer than two accepted current-country assets. The existing confirmation-gated Bolivia composer remains untouched."
};
checkpoint.queueAdvance = {
  country: "Cuba",
  batch: 371,
  scenes: [1504, 1505, 1506, 1507],
  cinematicTheme: "orbital research-station couture",
  batchOrdinalWithinTheme: 1
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`);
console.log(JSON.stringify({ checkpointPath, assetName, status: checkpoint.status }, null, 2));
