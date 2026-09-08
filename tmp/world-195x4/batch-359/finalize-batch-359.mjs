import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const preflightPath = path.join(root, "tmp/world-195x4/batch-359/batch-359-guinea-preflight.json");
const checkpointPath = path.join(root, "assets/lore/starlight-era/batch-359-guinea-orbital-spaceship-checkpoint.json");
const checkpoint = JSON.parse(fs.readFileSync(preflightPath, "utf8"));

checkpoint.status = "terminal-partially-accepted";
checkpoint.renderAttempts = {
  raw: {
    status: "complete",
    requested: 4,
    fulfilled: 2,
    moderationBlocked: 2,
    concurrency: "four independent built-in image generation calls launched together",
  },
  recovery: {
    status: "not-used",
    reason: "Two usable fast-pass assets satisfy X eligibility; output-moderation no-assets are terminal under the explicit throughput direction.",
  },
};
checkpoint.acceptedAssets = [
  {
    scene: 1457,
    file: "1457-guinea-fouta-djallon-orbital-waterfall-cupola.png",
    audit: "Accepted fast-pass. Exactly four clearly adult women appear with eight traceable arms and hands, the Fouta Djallon waterfall and highlands share the foreground with a fictional orbital cupola, and all four outfits have visibly different constructions. ECE alone uses a two-hand grip on the inert rainbow cinema prop toward clearly empty water, away from the group and camera. The romance reads through waist support, linked contact and a protective behind embrace. Logged deviations: the controlled-dip beat resolves as a standing support tableau, large Guinea motifs are subtler than requested, and the composition is less kinetic than the stored choreography.",
  },
  {
    scene: 1459,
    file: "1459-guinea-niger-headwaters-orbital-choice.png",
    audit: "Accepted fast-pass. The established adult male is added without replacing any of the four adult women; five adults and ten traceable arms and hands are present. The Niger headwaters and orbital research deck are both foreground reads, the quartet uses distinct orbital silhouettes, and the romance is immediate through a cheek kiss, seated hand stack, close body orientation and the male's sustained ECE-facing attention. ECE alone aims the inert rainbow cinema prop toward an empty paper target and backstop. Logged deviations: PAWS is replaced by an unrequested dark dog, MAX reads as an older golden retriever, the mechanical ribbon loom is absent, the pulled-away choice resolves as a seated three-person affection tableau, and the mascots do not perform the rolled supervised play beat.",
  },
];
checkpoint.rejectedAssets = [
  {
    scene: 1456,
    status: "rejected-output-moderation",
    requestId: "b92ff757-b3b9-4b14-b365-1539ee2cd703",
    reason: "No image asset was returned.",
  },
  {
    scene: 1458,
    status: "rejected-output-moderation",
    requestId: "211c2a62-b821-4f59-b540-0f33739a1c94",
    reason: "No image asset was returned.",
  },
];
checkpoint.xPost = {
  status: "eligible-not-published-this-wake",
  minimumCurrentCountryAcceptedAssets: 2,
  currentCountryAcceptedAssets: 2,
  caption: "Guinea red-heart Zimbabwe #Guinea #InternalAgency #WorldXXXSeries",
  reason: "Two Guinea assets are accepted. Publishing remains in the signed-in browser backlog after the required git checkpoint and push.",
};
checkpoint.completedAt = new Date().toISOString();
checkpoint.throughputMode = "fast-pass per explicit user direction; minor mascot, motif and choreography deviations are accepted and logged while hard safety and core-cast failures remain rejecting";
checkpoint.queueAdvance = {
  country: "Benin",
  batch: 360,
  scenes: [1460, 1461, 1462, 1463],
  cinematicTheme: "orbital spaceship couture",
  batchOrdinalWithinTheme: 2,
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`);
console.log(checkpointPath);
