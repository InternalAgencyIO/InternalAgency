import fs from "node:fs";
import path from "node:path";

const repo = "C:/Users/A/Documents/Codex/2026-07-27/hatch-pet-c-users-a-codex/InternalAgency";
const batchDir = path.join(repo, "tmp/world-195x4/batch-362");
const loreDir = path.join(repo, "assets/lore/starlight-era");
const rawImage = "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-5cdf8767-d27f-488e-a327-fba572975f25.png";
const acceptedFile = "1468-burundi-bujumbura-tanganyika-mars-habitat-fast-pass.png";
const checkpointFile = "batch-362-burundi-mars-expedition-checkpoint.json";

const checkpoint = JSON.parse(
  fs.readFileSync(path.join(batchDir, "batch-362-burundi-preflight.json"), "utf8"),
);

fs.copyFileSync(rawImage, path.join(loreDir, acceptedFile));

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
    scene: 1468,
    file: acceptedFile,
    audit: "Accepted fast-pass. Exactly four clearly adult women appear in a recognizable Lake Tanganyika and Bujumbura waterfront composition fused with peaceful fictional Mars-habitat architecture. The quartet has distinct silhouettes and footwear, the adult affection reads through a seated embrace, waist contact, linked hands and a cheek kiss, and ECE alone keeps a two-hand grip on the inert rainbow cinema-training prop toward the clearly empty water marker away from people and camera. Logged deviations: a small toy-like decorative figure appears despite the neither-mascot roll, the country motifs read mainly through dimensional lake and city geography, and some central hand ownership is partially occluded by the close embrace.",
  },
];
checkpoint.rejectedAssets = [
  {
    scene: 1469,
    status: "rejected-output-moderation",
    requestId: "3b273662-124f-40d1-ba2c-4528198f5c67",
    reason: "No image asset was returned.",
  },
  {
    scene: 1470,
    status: "rejected-output-moderation",
    requestId: "be70888a-5ce6-4519-916e-b6c4455d3bdb",
    reason: "No image asset was returned.",
  },
  {
    scene: 1471,
    status: "rejected-output-moderation",
    requestId: "7214062f-367d-43a2-9bb5-c63dd572e0b1",
    reason: "No image asset was returned.",
  },
];
checkpoint.xPost = {
  status: "deferred-insufficient-accepted-assets",
  minimumCurrentCountryAcceptedAssets: 2,
  currentCountryAcceptedAssets: 1,
  caption: "Burundi red-heart Rwanda #Burundi #InternalAgency #WorldXXXSeries",
  reason: "Only one Burundi image is accepted; no Burundi X compose action was opened.",
};
checkpoint.completedAt = new Date().toISOString();
checkpoint.throughputMode = "fast-pass per explicit user direction; minor choreography, motif and mascot deviations are accepted and logged while hard safety and core-cast failures remain rejecting";
checkpoint.queueAdvance = {
  country: "Bolivia",
  batch: 363,
  scenes: [1472, 1473, 1474, 1475],
  cinematicTheme: "Moon-surface expedition couture",
  batchOrdinalWithinTheme: 1,
};

fs.writeFileSync(path.join(loreDir, checkpointFile), `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ acceptedFile, checkpointFile, status: checkpoint.status, next: checkpoint.queueAdvance }));
