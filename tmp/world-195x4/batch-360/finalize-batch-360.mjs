import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const preflightPath = path.join(root, "tmp/world-195x4/batch-360/batch-360-benin-preflight.json");
const checkpointPath = path.join(root, "assets/lore/starlight-era/batch-360-benin-orbital-spaceship-checkpoint.json");
const checkpoint = JSON.parse(fs.readFileSync(preflightPath, "utf8"));

checkpoint.status = "terminal-zero-accepted";
checkpoint.renderAttempts = {
  raw: {
    status: "complete-no-assets",
    requested: 4,
    fulfilled: 0,
    moderationBlockedAtLeast: 1,
    uncollectedAfterAggregateFailure: 3,
    concurrency: "four independent built-in image generation calls launched together",
    note: "The aggregate call terminated on the first output-moderation rejection before the remaining lane results could be collected; no new generated file exists for any Benin scene.",
  },
  recovery: {
    status: "not-used",
    reason: "Fast-throughput mode treats the no-asset aggregate result as terminal and advances without another render cycle.",
  },
};
checkpoint.acceptedAssets = [];
checkpoint.rejectedAssets = [
  {
    scenes: [1460, 1461, 1462, 1463],
    status: "terminal-no-assets-after-output-moderation-aggregate-failure",
    requestId: "bd9746d3-36b5-4a67-ac89-a19ffd1ad772",
    reason: "At least one lane was rejected by output moderation and no Benin image file was returned or left in the generated-image directory; the other lane results were not collectable after aggregate termination.",
  },
];
checkpoint.xPost = {
  status: "deferred-insufficient-accepted-assets",
  minimumCurrentCountryAcceptedAssets: 2,
  currentCountryAcceptedAssets: 0,
  caption: "Benin red-heart Guinea #Benin #WorldXXXSeries",
  reason: "No accepted current-country images exist; no Benin X compose action was opened.",
};
checkpoint.completedAt = new Date().toISOString();
checkpoint.throughputMode = "fast-pass per explicit user direction; no-asset output-moderation outcomes are terminal and do not stall the country queue";
checkpoint.queueAdvance = {
  country: "Rwanda",
  batch: 361,
  scenes: [1464, 1465, 1466, 1467],
  cinematicTheme: "Mars-surface expedition couture",
  batchOrdinalWithinTheme: 1,
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`);
console.log(checkpointPath);
