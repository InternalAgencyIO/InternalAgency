import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const preflightPath = path.join(root, "tmp/world-195x4/batch-361/batch-361-rwanda-preflight.json");
const checkpointPath = path.join(root, "assets/lore/starlight-era/batch-361-rwanda-mars-expedition-checkpoint.json");
const checkpoint = JSON.parse(fs.readFileSync(preflightPath, "utf8"));

checkpoint.status = "terminal-partially-accepted";
checkpoint.renderAttempts = {
  raw: {
    status: "complete",
    requested: 4,
    fulfilled: 1,
    moderationBlocked: 3,
    concurrency: "four independent built-in image generation calls launched together with settled-result collection",
  },
  recovery: {
    status: "not-used",
    reason: "One usable fast-pass asset was preserved; throughput mode advances without retrying output-moderation blocks.",
  },
};
checkpoint.acceptedAssets = [
  {
    scene: 1465,
    file: "1465-rwanda-lake-kivu-mars-lander-slow-dance.png",
    audit: "Accepted fast-pass. Exactly four clearly adult women appear, with the Lake Kivu islands and terraced hills sharing the foreground with a large fictional Mars analog lander and solar deck. All four outfits use visibly different dress, jumpsuit, coat-dress and structured-short constructions. The adult romance reads through a cheek kiss, waist hold and joined-hand chain. ECE alone uses a two-hand grip on the inert rainbow cinema prop toward open unoccupied space, away from the group and camera. Logged deviations: the full three-person slow-dance chain resolves as a compact standing affection chain, some hand ownership is partially occluded by the central stack, and the country motifs read more through dimensional lake imagery than through large complete secular emblems.",
  },
];
checkpoint.rejectedAssets = [
  { scene: 1464, status: "rejected-output-moderation", requestId: "791c9263-e54f-4b93-b30e-11804c4e22ab", reason: "No image asset was returned." },
  { scene: 1466, status: "rejected-output-moderation", requestId: "7791210a-3976-4328-856d-bb499a20e12f", reason: "No image asset was returned." },
  { scene: 1467, status: "rejected-output-moderation", requestId: "5e60a659-c401-4f24-a6aa-6ef2f7ee2cf6", reason: "No image asset was returned." },
];
checkpoint.xPost = {
  status: "deferred-insufficient-accepted-assets",
  minimumCurrentCountryAcceptedAssets: 2,
  currentCountryAcceptedAssets: 1,
  caption: "Rwanda red-heart Guinea #Rwanda #InternalAgency",
  reason: "Only one Rwanda image is accepted; no Rwanda X compose action was opened.",
};
checkpoint.completedAt = new Date().toISOString();
checkpoint.throughputMode = "fast-pass per explicit user direction; minor choreography and motif deviations are accepted and logged while hard safety and core-cast failures remain rejecting";
checkpoint.queueAdvance = {
  country: "Burundi",
  batch: 362,
  scenes: [1468, 1469, 1470, 1471],
  cinematicTheme: "Mars-surface expedition couture",
  batchOrdinalWithinTheme: 2,
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`);
console.log(checkpointPath);
