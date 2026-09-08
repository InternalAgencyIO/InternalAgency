import fs from "node:fs";
import path from "node:path";

const root = path.resolve("tmp/world-195x4/batch-354");
const lore = path.resolve("assets/lore/starlight-era");
const checkpointPath = path.join(lore, "batch-354-guatemala-private-jet-checkpoint.json");
const preflight = JSON.parse(fs.readFileSync(path.join(root, "batch-354-guatemala-preflight.json"), "utf8"));
const accepted = {
  scene: 1439,
  file: "1439-guatemala-tikal-private-jet-mascot-romance.png",
  audit: "Accepted fast-pass. Exactly four clearly adult women appear with eight traceable arms and hands, Tikal's two major temple profiles and rainforest share the foreground with a large civilian private jet, and the four outfits use distinct column, coat, jumpsuit and structured-short constructions. The romance reads immediately through a direct kiss, waist embrace, linked hands and ECE's jealous counter-action. ECE alone owns the inert rainbow cinema prop with a two-hand grip and its muzzle line clears the group. Logged deviations: PAWS is replaced by an unrequested dark dog, MAX reads as an older golden retriever rather than a young pup, the pair rests on a supervised cushion rather than playing together, the empty paper target and complete backstop are not visible, and the rolled pulled-away choice resolves as a kiss-led jealousy tableau.",
};
fs.copyFileSync(path.join(root, "raw/scene-1439.png"), path.join(lore, accepted.file));

const checkpoint = {
  ...preflight,
  status: "terminal-partially-accepted",
  renderAttempts: {
    raw: { status: "complete", requested: 4, fulfilled: 1, moderationBlocked: 3, concurrency: "four independent built-in image generation calls launched together" },
    recovery: { status: "not-used", reason: "Three calls returned no asset due to output moderation; the durable asset was accepted under fast throughput mode without delaying the queue." },
  },
  acceptedAssets: [accepted],
  rejectedAssets: [
    { scene: 1436, status: "rejected-output-moderation", requestId: "3f4d972a-5afd-4a3a-9d25-3e00761dcbdf", reason: "No image asset was returned." },
    { scene: 1437, status: "rejected-output-moderation", requestId: "68cb69b6-e923-48d6-8c5d-3c4aab808888", reason: "No image asset was returned." },
    { scene: 1438, status: "rejected-output-moderation", requestId: "7acbde5c-bea5-4e98-86a6-6ce65dfdfc64", reason: "No image asset was returned." },
  ],
  xPost: {
    status: "deferred-insufficient-accepted-assets",
    minimumCurrentCountryAcceptedAssets: 2,
    currentCountryAcceptedAssets: 1,
    caption: preflight.xPublishingPlan.captionIfEligible,
    reason: "Only one accepted current-country image exists; no Guatemala X compose action was opened.",
  },
  completedAt: new Date().toISOString(),
  throughputMode: "fast-pass per explicit user direction; minor motif, mascot, identity, choreography, garment, hand and target deviations are logged but do not block public-safe coherent images",
  queueAdvance: { country: "Ecuador", batch: 355, scenes: [1440, 1441, 1442, 1443], cinematicTheme: "civilian helicopter flight couture", batchOrdinalWithinTheme: 1 },
};
fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ checkpointPath, accepted: accepted.file, xPost: checkpoint.xPost, next: checkpoint.queueAdvance }, null, 2));
