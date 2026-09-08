import fs from "node:fs";
import path from "node:path";

const root = path.resolve("tmp/world-195x4/batch-356");
const lore = path.resolve("assets/lore/starlight-era");
const checkpointPath = path.join(lore, "batch-356-netherlands-helicopter-checkpoint.json");
const preflight = JSON.parse(fs.readFileSync(path.join(root, "batch-356-netherlands-preflight.json"), "utf8"));
const checkpoint = {
  ...preflight,
  status: "terminal-zero-accepted",
  renderAttempts: {
    raw: { status: "complete", requested: 4, fulfilled: 1, moderationBlocked: 3, concurrency: "four independent built-in image generation calls launched together" },
    recovery: { status: "not-used", reason: "Fast throughput mode advances terminal batches without retrying output-moderation failures. The sole returned image failed the exact-cast gate and was preserved only under tmp for audit." },
  },
  acceptedAssets: [],
  rejectedAssets: [
    { scene: 1444, status: "rejected-extra-people-and-mascot-substitution", preservedRaw: "tmp/world-195x4/batch-356/raw/scene-1444-rejected-extra-people.png", reason: "The Amsterdam image contains additional visible human figures inside the helicopter cockpit beyond the required four-woman cast. PAWS and MAX are also replaced by two adult dogs. These failures override the otherwise strong canal, helicopter, outfit and lap-sitting execution." },
    { scene: 1445, status: "rejected-output-moderation", requestId: "75634eaf-3e70-4d79-a36a-f7e09bb337c6", reason: "No image asset was returned." },
    { scene: 1446, status: "rejected-output-moderation", requestId: "18defc42-f6b8-4cb2-adcc-1f731a03726e", reason: "No image asset was returned." },
    { scene: 1447, status: "rejected-output-moderation", requestId: "5aad7354-62d8-4f38-ab3a-becfb9d84415", reason: "No image asset was returned." },
  ],
  xPost: {
    status: "deferred-insufficient-accepted-assets",
    minimumCurrentCountryAcceptedAssets: 2,
    currentCountryAcceptedAssets: 0,
    caption: preflight.xPublishingPlan.captionIfEligible,
    reason: "No accepted current-country images exist; no Netherlands X compose action was opened.",
  },
  completedAt: new Date().toISOString(),
  throughputMode: "fast-pass per explicit user direction; minor deviations are logged, but extra people beyond the exact cast remain a decisive rejection",
  queueAdvance: { country: "Cambodia", batch: 357, scenes: [1448, 1449, 1450, 1451], cinematicTheme: "fictional coast-guard rescue-vessel couture", batchOrdinalWithinTheme: 1 },
};
fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ checkpointPath, status: checkpoint.status, xPost: checkpoint.xPost, next: checkpoint.queueAdvance }, null, 2));
