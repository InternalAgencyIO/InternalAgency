import fs from "node:fs";
import path from "node:path";

const root = path.resolve("tmp/world-195x4/batch-352");
const lore = path.resolve("assets/lore/starlight-era");
const checkpointPath = path.join(lore, "batch-352-somalia-orbital-research-station-checkpoint.json");
const preflight = JSON.parse(fs.readFileSync(path.join(root, "batch-352-somalia-preflight.json"), "utf8"));
const accepted = {
  scene: 1428,
  file: "1428-somalia-mogadishu-lighthouse-orbital-research-station-mascots-tuning-fork-romance.png",
  audit: "Accepted fast-pass. Exactly four clearly adult women appear with distinct country-led orbital-research silhouettes, Mogadishu's lighthouse and Indian Ocean are foregrounded beside a large peaceful station, PAWS and MAX share one supervised padded-bench beat, one woman owns the giant tuning-fork prop, and a seated jealousy and reconciliation event supplies multiple clear contacts. Alia uses a stable two-hand sight picture with the inert rainbow cinema prop toward empty ocean left of the group. Logged deviations: the lighthouse is stylized rather than a literal architectural copy, Radiance wears unrolled rainbow knee socks, the tuning fork holder differs from the selector, and fine trigger-index detail is small at portrait scale.",
};
fs.copyFileSync(path.join(root, "raw/scene-1428.png"), path.join(lore, accepted.file));

const checkpoint = {
  ...preflight,
  status: "terminal-partially-accepted",
  renderAttempts: {
    raw: { status: "complete", requested: 4, fulfilled: 1, moderationBlocked: 3, concurrency: "four independent built-in image generation calls launched together" },
    recovery: { status: "not-used", reason: "Three calls returned no asset due to output moderation; the durable asset was immediately usable, so the terminal checkpoint advances under fast throughput mode." },
  },
  acceptedAssets: [accepted],
  rejectedAssets: [
    { scene: 1429, status: "rejected-output-moderation", requestId: "cc30d79e-d337-45de-ac83-499b2bf30c3f", reason: "No image asset was returned." },
    { scene: 1430, status: "rejected-output-moderation", requestId: "983b59e5-a9e1-4621-ad4a-8b01ad35b98d", reason: "No image asset was returned." },
    { scene: 1431, status: "rejected-output-moderation", requestId: "64881b76-466e-4020-9617-5df6b1cb80d3", reason: "No image asset was returned." },
  ],
  xPost: {
    status: "deferred-insufficient-accepted-assets",
    minimumCurrentCountryAcceptedAssets: 2,
    currentCountryAcceptedAssets: 1,
    caption: preflight.xPublishingPlan.captionIfEligible,
    reason: "Only one accepted current-country image exists; no Somalia X compose action was opened.",
  },
  completedAt: new Date().toISOString(),
  throughputMode: "fast-pass per explicit user direction; minor motif, mascot, identity, choreography, garment, hand and target deviations are logged but do not block public-safe coherent images",
  queueAdvance: { country: "Senegal", batch: 353, scenes: [1432, 1433, 1434, 1435], cinematicTheme: "private-jet aviation couture", batchOrdinalWithinTheme: 1 },
};
fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ checkpointPath, accepted: accepted.file, xPost: checkpoint.xPost, next: checkpoint.queueAdvance }, null, 2));
