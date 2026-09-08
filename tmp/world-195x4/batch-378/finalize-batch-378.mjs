import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const preflightPath = path.join(root, "tmp", "world-195x4", "batch-378", "batch-378-jamaica-preflight.json");
const checkpointPath = path.join(root, "assets", "lore", "starlight-era", "batch-378-jamaica-rescue-vessel-checkpoint.json");
const checkpoint = JSON.parse(fs.readFileSync(preflightPath, "utf8"));

checkpoint.status = "terminal-zero-accepted";
checkpoint.renderAttempts = {
  raw: {
    status: "complete",
    requested: 4,
    fulfilled: 2,
    moderationBlocked: 2,
    concurrency: "four independent built-in image generation calls launched together"
  },
  recovery: {
    status: "complete",
    attemptedScenes: [1532, 1535],
    fulfilledScenes: [1532, 1535],
    acceptedScenes: [],
    maximumPerBlockedScene: 1,
    reason: "Neither delivered recovery cleared the mandatory mission-prop target and ownership gates."
  }
};
checkpoint.acceptedAssets = [];
checkpoint.rejectedAssets = [
  {
    scene: 1532,
    status: "terminal-rejected-raw-and-recovery",
    sourceRaw: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-83699270-8977-49f0-8321-e765e61055dd.png",
    sourceRecovery: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-00444ead-be10-4cdb-8a96-b37a499a5853.png",
    reason: "Raw omitted the mandatory mission prop and rendered PAWS as a dog. Recovery restored the prop but aimed it out of frame without the required geometric target and complete backstop, and duplicated PAWS as two kittens."
  },
  {
    scene: 1533,
    status: "terminal-renderer-output-moderation-block",
    requestId: "93e80db3-4c5b-40a3-9c6c-ef45e4060c93",
    reason: "The image service rejected the output before an auditable asset was delivered."
  },
  {
    scene: 1534,
    status: "terminal-renderer-output-moderation-block",
    requestId: "9f86a0d4-067f-415e-b6be-c1fb160b1a57",
    reason: "The image service rejected the output before an auditable asset was delivered."
  },
  {
    scene: 1535,
    status: "terminal-rejected-raw-and-recovery",
    sourceRaw: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-ad6be8f3-4f0e-40a2-bf80-141e1816e961.png",
    sourceRecovery: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-28a99fea-c0af-4fb6-a85d-57caea21b301.png",
    reason: "Raw gave the mission prop to ECE instead of rolled handler Alia and rendered the mascots as two dogs. Recovery corrected the mascot species and ECE hosiery but omitted the mandatory mission prop entirely."
  }
];
checkpoint.xPost = {
  status: "deferred-insufficient-accepted-assets",
  minimumCurrentCountryAcceptedAssets: 2,
  acceptedCurrentCountryAssets: 0,
  caption: "Jamaica red-heart Qatar #Jamaica #InternalAgency",
  reason: "No Jamaica asset passed the terminal audit; publication requires at least two accepted current-country images. The confirmed live Bolivia post was not duplicated, and the dirty publishing ledger was left untouched."
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`);
console.log(checkpointPath);
