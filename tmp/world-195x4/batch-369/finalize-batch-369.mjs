import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const generated = "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086";
const preflightPath = path.join(root, "tmp/world-195x4/batch-369/batch-369-dominican-republic-preflight.json");
const checkpointPath = path.join(root, "assets/lore/starlight-era/batch-369-dominican-republic-polar-airship-checkpoint.json");
const assetName = "1498-dominican-republic-samana-bay-polar-airship-male-recovery.png";
const acceptedRaw = `${generated}/exec-751f69e2-38f7-478b-9dfb-35283b1b37c0.png`;

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
    status: "complete",
    attemptedScenes: [1498],
    acceptedScenes: [1498],
    maximumPerBlockedScene: 1,
    reason: "The delivered raw scene added a fifth woman and produced six adults; one exact-cast side-profile recovery passed."
  }
};
checkpoint.acceptedAssets = [{
  scene: 1498,
  file: assetName,
  sourceRaw: acceptedRaw,
  decision: "accepted-recovery-fast-pass",
  audit: {
    coreCast: "Exactly the four clearly adult core women plus the established adult male are present; Alia retains the only braided anchor.",
    anatomy: "No glaring extra whole person or limb is visible; the five-adult composition reads with ten plausibly owned arms and hands, though some male-side contact detail is partially occluded.",
    missionProp: "ECE is isolated at far left in side profile with a two-hand stance toward a clearly empty projected route marker over open Samaná Bay, away from every person and the camera.",
    romance: "Radiance, Ellie, Alia and the male form a clear affection and jealousy cluster with hand, shoulder and cheek contacts; the male's attention remains directed into the relationship group.",
    themeLocation: "Samaná Bay, karst silhouettes, fog, civilian airship gondola and lift-cell couture form one immediate foreground composition.",
    deviations: [
      "The controlled dance dip resolves as a standing and kneeling affection cluster.",
      "The male's strongest sustained eye line reads toward the group rather than clearly toward ECE.",
      "The route marker is holographic rather than a physical buoy."
    ]
  }
}];
checkpoint.rejectedAssets = [
  {
    scene: 1496,
    status: "terminal-renderer-output-moderation-block",
    requestId: "995e8546-623d-4a9a-88ce-ee48b8b77c84",
    reason: "The image service rejected the output before an auditable asset was delivered."
  },
  {
    scene: 1497,
    status: "terminal-renderer-output-moderation-block",
    requestId: "ae909989-4d28-4d78-9ab1-e18d10f5a98a",
    reason: "The image service rejected the output before an auditable asset was delivered."
  },
  {
    scene: 1499,
    status: "terminal-renderer-output-moderation-block",
    requestId: "6a59760f-33a2-4770-9c00-b59aa5e58c52",
    reason: "The image service rejected the output before an auditable asset was delivered."
  },
  {
    scene: 1498,
    status: "rejected-raw-replaced-by-accepted-recovery",
    sourceRaw: `${generated}/exec-b94acf88-70b9-4266-91ed-a34b68a161e0.png`,
    reason: "The raw render contained six adults: the required quartet and male plus an extra duplicate woman."
  }
];
checkpoint.xPost = {
  status: "deferred-insufficient-accepted-assets",
  minimumCurrentCountryAcceptedAssets: 2,
  acceptedCurrentCountryAssets: 1,
  captionIfEligible: "Dominican Republic red-heart Jordan #DominicanRepublic",
  reason: "Dominican Republic has fewer than two accepted current-country assets. The existing confirmation-gated Bolivia composer remains untouched."
};
checkpoint.queueAdvance = {
  country: "United Arab Emirates",
  batch: 370,
  scenes: [1500, 1501, 1502, 1503],
  cinematicTheme: "polar airship couture",
  batchOrdinalWithinTheme: 2
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`);
console.log(JSON.stringify({ checkpointPath, assetName, status: checkpoint.status }, null, 2));
