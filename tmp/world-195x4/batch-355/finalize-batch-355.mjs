import fs from "node:fs";
import path from "node:path";

const root = path.resolve("tmp/world-195x4/batch-355");
const lore = path.resolve("assets/lore/starlight-era");
const checkpointPath = path.join(lore, "batch-355-ecuador-helicopter-checkpoint.json");
const preflight = JSON.parse(fs.readFileSync(path.join(root, "batch-355-ecuador-preflight.json"), "utf8"));

const checkpoint = {
  ...preflight,
  status: "terminal-zero-accepted",
  renderAttempts: {
    raw: { status: "complete", requested: 4, fulfilled: 1, moderationBlocked: 3, concurrency: "four independent built-in image generation calls launched together" },
    recovery: { status: "not-used", reason: "Fast throughput mode advances terminal batches without retrying output-moderation failures. The sole returned image failed the decisive mission-prop safety line and was preserved only under tmp for audit." },
  },
  acceptedAssets: [],
  rejectedAssets: [
    { scene: 1440, status: "rejected-output-moderation", requestId: "ab123fe8-a050-465d-a992-75706c22c57b", reason: "No image asset was returned." },
    { scene: 1441, status: "rejected-output-moderation", requestId: "b196a728-bb46-44bb-b92e-0b11737f78f1", reason: "No image asset was returned." },
    { scene: 1442, status: "rejected-unsafe-mission-prop-line", preservedRaw: "tmp/world-195x4/batch-355/raw/scene-1442-rejected-unsafe-prop-line.png", reason: "The inert rainbow cinema prop is visibly directed across the adjacent woman's torso at close range. This fails the binding rule that the prop never aim at a person, regardless of otherwise strong Cuenca, helicopter, romance, outfit and odd-prop execution." },
    { scene: 1443, status: "rejected-output-moderation", requestId: "e9c0f0d4-8a2d-4943-91ca-ff1d76501eb8", reason: "No image asset was returned." },
  ],
  xPost: {
    status: "deferred-insufficient-accepted-assets",
    minimumCurrentCountryAcceptedAssets: 2,
    currentCountryAcceptedAssets: 0,
    caption: preflight.xPublishingPlan.captionIfEligible,
    reason: "No accepted current-country images exist; no Ecuador X compose action was opened.",
  },
  completedAt: new Date().toISOString(),
  throughputMode: "fast-pass per explicit user direction; minor motif, mascot, identity, choreography, garment, hand and target deviations are logged, but a prop aimed across a person remains a decisive rejection",
  queueAdvance: { country: "Netherlands", batch: 356, scenes: [1444, 1445, 1446, 1447], cinematicTheme: "civilian helicopter flight couture", batchOrdinalWithinTheme: 2 },
};
fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ checkpointPath, status: checkpoint.status, xPost: checkpoint.xPost, next: checkpoint.queueAdvance }, null, 2));
