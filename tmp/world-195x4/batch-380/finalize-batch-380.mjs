import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const preflightPath = path.join(root, "tmp", "world-195x4", "batch-380", "batch-380-gabon-preflight.json");
const checkpointPath = path.join(root, "assets", "lore", "starlight-era", "batch-380-gabon-orbital-spaceship-checkpoint.json");
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
    attemptedScenes: [1540, 1541, 1542, 1543],
    fulfilledScenes: [1540, 1541, 1543],
    moderationBlockedScenes: [1542],
    acceptedScenes: [],
    requestValidationCorrections: [
      {
        scene: 1541,
        reason: "The initial edit invocation exceeded the five-reference API limit and entered no render; the corrected five-reference invocation produced the one actual recovery render."
      }
    ],
    maximumActualRenderPerBlockedScene: 1,
    reason: "No delivered recovery cleared every active-roll, safe-line, anatomy, and hard-love gate."
  }
};
checkpoint.acceptedAssets = [];
checkpoint.rejectedAssets = [
  {
    scene: 1540,
    status: "terminal-rejected-output-block-and-recovery",
    rawRequestId: "a7944e00-ccd6-47e1-a6d3-a8e741ccf959",
    sourceRecovery: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-fe6e4c8b-6437-49ba-a500-1cc420c8089b.png",
    reason: "The raw output was blocked before delivery. Recovery preserved the quartet, Libreville, MAX, romance turn, and safe target-backstop line but omitted Ellie's active inflatable geometric weather-balloon pack, so an active deterministic roll was missing."
  },
  {
    scene: 1541,
    status: "terminal-rejected-raw-and-recovery",
    sourceRaw: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-0aa9a45d-c938-4316-ad13-78bfd36d10b9.png",
    sourceRecovery: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-465ae06f-f961-403a-892d-a9893cff0ba5.png",
    reason: "Raw omitted the visible empty-water route marker. Recovery added a marker but the prop line did not align to it, left the safe line outside the frame, and did not provide ten continuously traceable arms and hands."
  },
  {
    scene: 1542,
    status: "terminal-rejected-raw-and-recovery-output-block",
    sourceRaw: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-18fa02ef-9540-4931-a96c-0c0112a7ccba.png",
    recoveryRequestId: "e33963dd-d4d5-4311-b350-3ac6d9e6ef92",
    reason: "Raw preserved Loango and a visible safe target-backstop line but omitted the mandatory seated-to-standing lift-assist, bench, cheek kiss, and blocked-route love beat. Recovery was blocked before an auditable asset was delivered."
  },
  {
    scene: 1543,
    status: "terminal-rejected-raw-and-recovery",
    sourceRaw: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-9b2eaa5d-c625-4346-a3cb-ca70040a2317.png",
    sourceRecovery: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-ed8f1600-f09c-4f3b-b65b-43a4dfed39d3.png",
    reason: "Raw omitted PAWS, the active stationary pole motif, and rainbow-only wardrobe. Recovery corrected PAWS and rainbow-only wardrobe while preserving Kongou Falls and the target-backstop line, but still omitted the active stationary pole motif."
  }
];
checkpoint.xPost = {
  status: "deferred-insufficient-accepted-assets",
  minimumCurrentCountryAcceptedAssets: 2,
  acceptedCurrentCountryAssets: 0,
  caption: "Gabon red-heart Qatar #Gabon #InternalAgency",
  reason: "No Gabon asset passed the terminal audit; publication requires at least two accepted current-country images. The confirmed live Bolivia post was not duplicated, and the dirty publishing ledger was left untouched."
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`);
console.log(checkpointPath);
