import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const preflightPath = path.join(root, "tmp", "world-195x4", "batch-379", "batch-379-gambia-preflight.json");
const checkpointPath = path.join(root, "assets", "lore", "starlight-era", "batch-379-gambia-orbital-spaceship-checkpoint.json");
const checkpoint = JSON.parse(fs.readFileSync(preflightPath, "utf8"));

checkpoint.status = "terminal-zero-accepted";
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
    attemptedScenes: [1537],
    fulfilledScenes: [1537],
    acceptedScenes: [],
    maximumPerBlockedScene: 1,
    reason: "The sole delivered recovery did not clear the target-backstop and hosiery-wearer gates."
  }
};
checkpoint.acceptedAssets = [];
checkpoint.rejectedAssets = [
  {
    scene: 1536,
    status: "terminal-renderer-output-moderation-block",
    requestId: "01fdc7b2-9f0d-4c73-87ef-75da120eb6ef",
    reason: "The image service rejected the output before an auditable asset was delivered."
  },
  {
    scene: 1537,
    status: "terminal-rejected-raw-and-recovery",
    sourceRaw: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-9f9284c0-ba69-4899-b283-3543b180ebf4.png",
    sourceRecovery: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-97f03455-0791-46ac-9b65-84e0c1416f87.png",
    reason: "Raw crossed the mission-prop line toward the male with no visible target. Recovery moved the line away from people but placed the route symbol over open river without a complete earth-and-sand backstop and put the active hosiery on Alia instead of ECE."
  },
  {
    scene: 1538,
    status: "terminal-renderer-output-moderation-block",
    requestId: "31e53669-6bb6-428b-ba55-46e416b73a88",
    reason: "The image service rejected the output before an auditable asset was delivered."
  },
  {
    scene: 1539,
    status: "terminal-renderer-output-moderation-block",
    requestId: "674e81af-bfe4-442e-aff6-f1566870205a",
    reason: "The image service rejected the output before an auditable asset was delivered."
  }
];
checkpoint.xPost = {
  status: "deferred-insufficient-accepted-assets",
  minimumCurrentCountryAcceptedAssets: 2,
  acceptedCurrentCountryAssets: 0,
  caption: "Gambia red-heart Qatar #Gambia #WorldXXXSeries",
  reason: "No Gambia asset passed the terminal audit; publication requires at least two accepted current-country images. The confirmed live Bolivia post was not duplicated, and the dirty publishing ledger was left untouched."
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`);
console.log(checkpointPath);
