import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const preflightPath = path.join(root, "tmp", "world-195x4", "batch-381", "batch-381-botswana-preflight.json");
const checkpointPath = path.join(root, "assets", "lore", "starlight-era", "batch-381-botswana-mars-surface-expedition-checkpoint.json");
const checkpoint = JSON.parse(fs.readFileSync(preflightPath, "utf8"));

checkpoint.status = "terminal-zero-accepted";
checkpoint.renderAttempts = {
  raw: {
    status: "complete",
    requested: 4,
    fulfilled: 0,
    moderationBlocked: 4,
    concurrency: "four independent built-in image generation calls launched together"
  },
  recovery: {
    status: "complete",
    attemptedScenes: [1544, 1545, 1546, 1547],
    fulfilledScenes: [1544, 1545, 1546],
    noAuditableAssetScenes: [1547],
    acceptedScenes: [],
    maximumActualRenderPerBlockedScene: 1,
    reason: "The three delivered recoveries retained at least one hard failure each; scene 1547 delivered no auditable recovery asset."
  }
};
checkpoint.acceptedAssets = [];
checkpoint.rejectedAssets = [
  {
    scene: 1544,
    status: "terminal-rejected-output-block-and-recovery",
    rawRequestId: "68c3c0fe-5555-4c9d-818c-87c8bdeba5ee",
    sourceRecovery: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-c6c3ecff-5d4a-4d30-8701-3ad15d620b3d.png",
    reason: "Raw was blocked before delivery. Recovery preserved five adults, Okavango, Mars construction, PAWS and a visible target-backstop lane, but Radiance was beside rather than securely across Ellie's lap, no linked-hand choice appeared, the male held ECE at the torso instead of providing the rolled wrist guidance, and not all ten hands were continuously traceable."
  },
  {
    scene: 1545,
    status: "terminal-rejected-output-block-and-recovery",
    rawRequestId: "071543f6-2c15-4ec8-a6a8-b9e03463b291",
    sourceRecovery: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-dc5e3a13-8122-4814-964a-e6521947030a.png",
    reason: "Raw was blocked before delivery. Recovery preserved four adults, Makgadikgadi, distinct country-led Mars outfits and the partner-choice contact graph, but ECE's muzzle line continued beyond the frame instead of meeting the visible paper route symbol and complete backstop."
  },
  {
    scene: 1546,
    status: "terminal-rejected-output-block-and-recovery",
    rawRequestId: "c37bee6c-7bc0-42f2-aa8b-d824134765d9",
    sourceRecovery: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-fb9d8e92-d2d8-4538-b89d-1562338861aa.png",
    reason: "Raw was blocked before delivery. Recovery preserved four adults, Tsodilo, Mars construction, MAX and a partial lift-assist affection event, but ECE's muzzle line passed above the paper target, the rise from the bench was not unmistakable, and Alia's rolled fully open back was not visible."
  },
  {
    scene: 1547,
    status: "terminal-renderer-no-auditable-recovery-asset",
    rawRequestId: "fdfbe03f-f309-480a-80ee-84bd170f2d29",
    reason: "Raw was blocked before delivery, and the completed single recovery call produced no auditable asset. No additional recovery is permitted."
  }
];
checkpoint.xPost = {
  status: "deferred-insufficient-accepted-assets",
  minimumCurrentCountryAcceptedAssets: 2,
  acceptedCurrentCountryAssets: 0,
  caption: "Botswana red-heart Qatar #Botswana",
  reason: "No Botswana asset passed the terminal audit; publication requires at least two accepted current-country images. The confirmed live Bolivia post was not duplicated, and the dirty publishing ledger was left untouched."
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`);
console.log(checkpointPath);
