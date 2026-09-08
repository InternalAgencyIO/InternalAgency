import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const preflightPath = path.join(root, "tmp", "world-195x4", "batch-376", "batch-376-lithuania-preflight.json");
const checkpointPath = path.join(root, "assets", "lore", "starlight-era", "batch-376-lithuania-civilian-helicopter-checkpoint.json");
const checkpoint = JSON.parse(fs.readFileSync(preflightPath, "utf8"));

checkpoint.status = "terminal-zero-accepted";
checkpoint.renderAttempts = {
  raw: {
    status: "complete",
    requested: 4,
    fulfilled: 3,
    moderationBlocked: 1,
    concurrency: "four independent built-in image generation calls launched together"
  },
  recovery: {
    status: "complete",
    attemptedScenes: [1524, 1525, 1526],
    fulfilledScenes: [1524, 1526],
    moderationBlockedScenes: [1525],
    acceptedScenes: [],
    maximumPerBlockedScene: 1,
    reason: "The one permitted recovery pass did not produce a scene with a clearly empty paper route target and complete backstop."
  }
};
checkpoint.acceptedAssets = [];
checkpoint.rejectedAssets = [
  {
    scene: 1524,
    status: "terminal-rejected-raw-and-recovery",
    sourceRaw: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-5d4f0517-623a-409c-9b3e-576f789812fe.png",
    sourceRecovery: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-10dd709c-b9d8-481a-aa94-a2a833b64483.png",
    reason: "Raw aimed out of frame without a target or backstop. Recovery kept exactly four women but again omitted the required empty paper target and complete backstop; the mascot pair also rendered as two dogs instead of PAWS and MAX."
  },
  {
    scene: 1525,
    status: "terminal-rejected-raw-recovery-moderation-block",
    sourceRaw: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-b3774a10-5ef8-4dd2-804c-5fb9e13b3e55.png",
    reason: "Raw aimed the mission prop toward Alia's upper body, a hard unsafe line, and rendered the wrong mascot species. The sole recovery attempt was blocked before an auditable asset was delivered."
  },
  {
    scene: 1526,
    status: "terminal-rejected-raw-and-recovery",
    sourceRaw: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-909d6a07-eb29-485f-96c1-8b5a0ea1602e.png",
    sourceRecovery: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-13372ca8-bcb2-4505-a0e9-ca94be1974d3.png",
    reason: "Raw omitted the mandatory mission prop. Recovery restored the exact five-adult cast and prop, but used a floating ring over water rather than the required empty paper target with complete earth-and-sand backstop."
  },
  {
    scene: 1527,
    status: "terminal-renderer-output-moderation-block",
    requestId: "3c477afb-d15d-4635-b0fe-d632390aa655",
    reason: "The image service rejected the raw output before an auditable asset was delivered; no second attempt was made because only delivered hard-failure scenes receive one recovery pass."
  }
];
checkpoint.xPost = {
  status: "deferred-insufficient-accepted-assets",
  minimumCurrentCountryAcceptedAssets: 2,
  acceptedCurrentCountryAssets: 0,
  caption: "Lithuania red-heart Namibia #Lithuania",
  reason: "No Lithuania asset passed the terminal audit; publication requires at least two accepted current-country images. The existing confirmation-gated Bolivia composer was left untouched."
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`);
console.log(checkpointPath);
