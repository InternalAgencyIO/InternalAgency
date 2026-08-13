import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const root = path.join(repo, "tmp/world-195x4/batch-382");
const loreDir = path.join(repo, "assets/lore/starlight-era");
const preflight = JSON.parse(fs.readFileSync(path.join(root, "batch-382-georgia-preflight.json"), "utf8"));

const checkpoint = {
  ...preflight,
  status: "active-four-scene-gate-preflight-complete",
  checkpointedAt: new Date().toISOString(),
  countryCompletionGate: {
    ...preflight.countryCompletionGate,
    acceptedSceneCount: 0,
    missingSceneNumbers: [1548, 1549, 1550, 1551],
    gitCheckpointPushed: false,
    xPublicStatusVerified: false,
    queueAdvanceAllowed: false
  },
  renderAttempts: {
    raw: {
      status: "pending",
      round: 1,
      requestedSceneNumbers: [1548, 1549, 1550, 1551],
      concurrency: "four independent built-in image generation calls launched together"
    },
    recovery: {
      status: "not-started",
      maximumPerBlockedScenePerRound: 1,
      laterWakeFreshRoundsAllowed: true
    }
  },
  acceptedAssets: [],
  rejectedAssets: [],
  rawOutputs: [],
  xPost: {
    ...preflight.xPost,
    status: "blocked-until-four-accepted-and-git-pushed",
    plannedCaption: preflight.xPublishingPlan.captionIfEligible,
    url: null
  },
  nextQueueStatus: "locked-until-Georgia-four-scene-Git-and-X-completion"
};

const output = path.join(loreDir, "batch-382-georgia-mars-surface-expedition-checkpoint.json");
fs.writeFileSync(output, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(output);
