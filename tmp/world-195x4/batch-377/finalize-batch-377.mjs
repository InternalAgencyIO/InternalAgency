import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const preflightPath = path.join(root, "tmp", "world-195x4", "batch-377", "batch-377-qatar-preflight.json");
const checkpointPath = path.join(root, "assets", "lore", "starlight-era", "batch-377-qatar-rescue-vessel-checkpoint.json");
const checkpoint = JSON.parse(fs.readFileSync(preflightPath, "utf8"));

checkpoint.status = "terminal-partially-accepted";
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
    attemptedScenes: [1528],
    fulfilledScenes: [1528],
    acceptedScenes: [1528],
    maximumPerBlockedScene: 1,
    reason: "The single permitted recovery corrected the target geometry, complete backstop and rolled odd prop."
  }
};
checkpoint.acceptedAssets = [
  {
    scene: 1528,
    file: "1528-qatar-doha-corniche-rescue-vessel-recovery.png",
    sourceRaw: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-b13fdd80-3627-400d-ac01-10560ee146cf.png",
    audit: "Accepted recovery: exact four-adult quartet; eight traceable arms and hands; ECE alone owns the inert mission prop in a safe side-on line to a plain geometric paper route symbol with a complete earth backstop; Ellie visibly owns the rolled transparent mechanical typewriter; no mascots; distinct Qatar/rescue-vessel outfits and readable Doha Corniche composition."
  }
];
checkpoint.rejectedAssets = [
  {
    scene: 1528,
    status: "rejected-raw-recovered",
    sourceRaw: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-684aeffb-312c-4de0-9b5c-075e7490d4a8.png",
    reason: "Raw used a human-silhouette target instead of an empty geometric route target and omitted the active transparent typewriter."
  },
  {
    scene: 1529,
    status: "terminal-renderer-output-moderation-block",
    requestId: "21a28657-3149-4c82-8331-ed58649039bc",
    reason: "The image service rejected the output before an auditable asset was delivered."
  },
  {
    scene: 1530,
    status: "terminal-renderer-output-moderation-block",
    requestId: "06ab66c4-c2f5-4c28-855d-eb346fa280e6",
    reason: "The image service rejected the output before an auditable asset was delivered."
  },
  {
    scene: 1531,
    status: "terminal-renderer-output-moderation-block",
    requestId: "34a91fe7-43c1-4b15-a51e-7f600b7ce6b3",
    reason: "The image service rejected the output before an auditable asset was delivered."
  }
];
checkpoint.xPost = {
  status: "deferred-insufficient-accepted-assets",
  minimumCurrentCountryAcceptedAssets: 2,
  acceptedCurrentCountryAssets: 1,
  caption: "Qatar red-heart Armenia #Qatar",
  reason: "Only one Qatar asset passed the terminal audit; publication requires at least two accepted current-country images. The existing confirmation-gated Bolivia composer was left untouched."
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`);
console.log(checkpointPath);
