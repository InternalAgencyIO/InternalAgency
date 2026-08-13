import fs from "node:fs";
import path from "node:path";

const root = path.resolve("tmp/world-195x4/batch-353");
const lore = path.resolve("assets/lore/starlight-era");
const checkpointPath = path.join(lore, "batch-353-senegal-private-jet-checkpoint.json");
const preflight = JSON.parse(fs.readFileSync(path.join(root, "batch-353-senegal-preflight.json"), "utf8"));
const accepted = {
  scene: 1433,
  file: "1433-senegal-saint-louis-private-jet-male-jealousy.png",
  audit: "Accepted fast-pass. Exactly five clearly adult people appear with the established male added without replacing any woman, a large civilian private jet and Saint-Louis riverfront share the foreground, all four women have distinct silhouettes and footwear, Radiance alone wears the rolled opaque multicolor hosiery, and the adult jealousy split uses several clear contacts. Alia alone owns the inert rainbow cinema prop with both hands and the visible muzzle line clears above the male's shoulder without intersecting any person. Logged deviations: the rolled open mechanism and empty paper target are not visible, the prop is too close to the male for ideal training spacing, the male's strongest eye line favors Alia rather than ECE, and the three-person slow dance resolves as a dramatic seated-to-standing relationship break.",
};
fs.copyFileSync(path.join(root, "raw/scene-1433.png"), path.join(lore, accepted.file));

const checkpoint = {
  ...preflight,
  status: "terminal-partially-accepted",
  renderAttempts: {
    raw: { status: "complete", requested: 4, fulfilled: 1, moderationBlocked: 3, concurrency: "four independent built-in image generation calls launched together" },
    recovery: { status: "not-used", reason: "Three calls returned no asset due to output moderation; the durable asset was accepted under fast throughput mode without delaying the queue." },
  },
  acceptedAssets: [accepted],
  rejectedAssets: [
    { scene: 1432, status: "rejected-output-moderation", requestId: "047c9591-bf7f-4c38-aef1-a4f25033ffb9", reason: "No image asset was returned." },
    { scene: 1434, status: "rejected-output-moderation", requestId: "ecc249e4-2eed-4bd4-b8d2-047145be3c13", reason: "No image asset was returned." },
    { scene: 1435, status: "rejected-output-moderation", requestId: "c3e6937a-0c07-4df5-b36a-d5042f58f6cd", reason: "No image asset was returned." },
  ],
  xPost: {
    status: "deferred-insufficient-accepted-assets",
    minimumCurrentCountryAcceptedAssets: 2,
    currentCountryAcceptedAssets: 1,
    caption: preflight.xPublishingPlan.captionIfEligible,
    reason: "Only one accepted current-country image exists; no Senegal X compose action was opened.",
  },
  completedAt: new Date().toISOString(),
  throughputMode: "fast-pass per explicit user direction; minor motif, mascot, identity, choreography, garment, hand and target deviations are logged but do not block public-safe coherent images",
  queueAdvance: { country: "Guatemala", batch: 354, scenes: [1436, 1437, 1438, 1439], cinematicTheme: "private-jet aviation couture", batchOrdinalWithinTheme: 2 },
};
fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ checkpointPath, accepted: accepted.file, xPost: checkpoint.xPost, next: checkpoint.queueAdvance }, null, 2));
