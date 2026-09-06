import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const preflightPath = path.join(root, "tmp/world-195x4/batch-367/batch-367-haiti-preflight.json");
const checkpointPath = path.join(root, "assets/lore/starlight-era/batch-367-haiti-deep-sea-submersible-checkpoint.json");
const rawPath = "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-cef17bea-bd73-462d-ab9e-f7321862062e.png";
const assetName = "1491-haiti-ile-a-vache-deep-sea-submersible-fast-pass.png";
const assetPath = path.join(root, "assets/lore/starlight-era", assetName);

const checkpoint = JSON.parse(fs.readFileSync(preflightPath, "utf8"));
fs.copyFileSync(rawPath, assetPath);

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
  scene: 1491,
  file: assetName,
  sourceRaw: rawPath,
  decision: "accepted-fast-pass",
  audit: {
    coreCast: "Exactly four clearly adult core women are present; Alia retains the braided anchor.",
    anatomy: "No glaring extra whole person or limb is visible; eight arms and eight owned hands read plausibly in the full-frame audit.",
    missionProp: "AI ECE alone uses a two-hand grip and directs the inert rainbow-gradient cinema training prop over an empty cordoned water lane, away from every person and the camera; no ammunition, firing, flash, or threat is present.",
    romance: "Radiance, Ellie, and Alia form a clear contact chain with aligned emotional attention while ECE performs the mission beat.",
    themeLocation: "Deep-sea pressure-hull couture and research architecture are strongly fused with the tropical island, reef, and storm setting.",
    deviations: [
      "Rolled MAX-only mascot is absent; a stylized fish accessory appeared instead.",
      "The rolled inflatable geometric weather-balloon pack reads as a compact stained-glass geometric balloon rather than an inflatable pack.",
      "The exact three-person slow-dance choreography resolves as a stationary reconciliation/contact chain."
    ]
  }
}];
checkpoint.rejectedAssets = [
  {
    scene: 1488,
    status: "terminal-renderer-output-moderation-block",
    requestId: "ed1cce54-a94b-4bc3-b438-39dc93c9255e",
    reason: "The image service rejected the output before an auditable asset was delivered."
  },
  {
    scene: 1489,
    status: "terminal-renderer-output-moderation-block",
    requestId: "841df320-44f2-44ac-9c7a-4144e3494bf9",
    reason: "The image service rejected the output before an auditable asset was delivered."
  },
  {
    scene: 1490,
    status: "terminal-renderer-output-moderation-block",
    requestId: "1cffd504-e826-4469-827e-357f42996b86",
    reason: "The image service rejected the output before an auditable asset was delivered."
  }
];
checkpoint.xPost = {
  status: "deferred-insufficient-accepted-assets",
  minimumCurrentCountryAcceptedAssets: 2,
  acceptedCurrentCountryAssets: 1,
  captionIfEligible: "Haiti red-heart Belgium #Haiti",
  reason: "Haiti has fewer than two accepted current-country assets. The existing confirmation-gated Bolivia composer remains untouched."
};
checkpoint.queueAdvance = {
  country: "Jordan",
  batch: 368,
  scenes: [1492, 1493, 1494, 1495],
  cinematicTheme: "deep-sea submersible couture",
  batchOrdinalWithinTheme: 2
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`);
console.log(JSON.stringify({ checkpointPath, assetPath, status: checkpoint.status }, null, 2));
