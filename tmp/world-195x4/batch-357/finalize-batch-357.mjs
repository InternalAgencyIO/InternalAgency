import fs from "node:fs";
import path from "node:path";
const root = path.resolve("tmp/world-195x4/batch-357");
const lore = path.resolve("assets/lore/starlight-era");
const checkpointPath = path.join(lore, "batch-357-cambodia-rescue-vessel-checkpoint.json");
const preflight = JSON.parse(fs.readFileSync(path.join(root, "batch-357-cambodia-preflight.json"), "utf8"));
const checkpoint = {
  ...preflight,
  status: "terminal-zero-accepted",
  renderAttempts: {
    raw: { status: "complete", requested: 4, fulfilled: 1, moderationBlocked: 3, concurrency: "four independent built-in image generation calls launched together" },
    recovery: { status: "not-used", reason: "Fast throughput mode advances terminal batches without retrying output-moderation failures. The sole returned image failed the decisive mission-prop safety line and was preserved only under tmp for audit." },
  },
  acceptedAssets: [],
  rejectedAssets: [
    { scene: 1448, status: "rejected-output-moderation", requestId: "ca7edc7e-9f3c-4438-817b-539157388ea0", reason: "No image asset was returned." },
    { scene: 1449, status: "rejected-output-moderation", requestId: "6f9048f2-6445-4639-b6b8-8b6b204efd5b", reason: "No image asset was returned." },
    { scene: 1450, status: "rejected-unsafe-mission-prop-line", preservedRaw: "tmp/world-195x4/batch-357/raw/scene-1450-rejected-unsafe-prop-line.png", reason: "Alia's inert rainbow cinema prop is visibly aimed across the adjacent woman's head and torso at close range. This fails the binding person-targeting prohibition despite strong Tonle Sap, vessel, mascot, hosiery, outfit and romance execution." },
    { scene: 1451, status: "rejected-output-moderation", requestId: "106baae9-6320-486d-814b-bfee37cde92b", reason: "No image asset was returned." },
  ],
  xPost: { status: "deferred-insufficient-accepted-assets", minimumCurrentCountryAcceptedAssets: 2, currentCountryAcceptedAssets: 0, caption: preflight.xPublishingPlan.captionIfEligible, reason: "No accepted current-country images exist; no Cambodia X compose action was opened." },
  completedAt: new Date().toISOString(),
  throughputMode: "fast-pass per explicit user direction; minor deviations are logged, but a prop aimed at a person remains a decisive rejection",
  queueAdvance: { country: "Zimbabwe", batch: 358, scenes: [1452, 1453, 1454, 1455], cinematicTheme: "fictional coast-guard rescue-vessel couture", batchOrdinalWithinTheme: 2 },
};
fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ checkpointPath, status: checkpoint.status, xPost: checkpoint.xPost, next: checkpoint.queueAdvance }, null, 2));
