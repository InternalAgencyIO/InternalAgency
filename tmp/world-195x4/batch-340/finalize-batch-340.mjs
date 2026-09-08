import fs from "node:fs";
import path from "node:path";

const repo = process.cwd();
const tmp = path.join(repo, "tmp", "world-195x4", "batch-340");
const lore = path.join(repo, "assets", "lore", "starlight-era");
const preflight = JSON.parse(fs.readFileSync(path.join(tmp, "batch-340-dominica-preflight.json"), "utf8"));

const checkpoint = {
  ...preflight,
  status: "terminal-zero-accepted",
  completedAt: new Date().toISOString(),
  throughputMode: "fast-pass per explicit user direction; minor deviations do not block, but moderation-only failures without assets and glaring duplicated whole people remain terminal rejects",
  renderAttempts: {
    raw: { status: "complete", requested: 4, fulfilled: 1, moderationBlocked: 3, concurrency: "four independent built-in image generation calls launched together" },
    recovery: { status: "not-used", reason: "Three scenes produced no durable outputs after output-stage moderation. The only durable frame had a decisive duplicated whole adult and was not eligible for minor-deviation acceptance." }
  },
  acceptedAssets: [],
  rejectedAssets: [
    { scene: 1380, status: "rejected-decisive-anatomy", rawFile: "1380-dominica-roseau-orbital-raw.png", reason: "Six adults rendered instead of the required four women plus one male; one whole woman is duplicated. Mission prop otherwise points safely away from people." },
    { scene: 1381, status: "moderation-blocked-no-output", requestId: "a62b7984-b671-42f2-b58e-1f7725fe77e3", reason: "Output-stage safety rejection; no durable asset existed to inspect or recover." },
    { scene: 1382, status: "moderation-blocked-no-output", requestId: "43e21d10-f341-450e-87e5-e0c0eda69d6b", reason: "Output-stage safety rejection; no durable asset existed to inspect or recover." },
    { scene: 1383, status: "moderation-blocked-no-output", requestId: "f695cee9-bf76-4a96-9dde-0020ed13c84e", reason: "Output-stage safety rejection; no durable asset existed to inspect or recover." }
  ],
  xPost: {
    status: "deferred-insufficient-accepted-assets",
    minimumCurrentCountryAcceptedAssets: 2,
    currentCountryAcceptedAssets: 0,
    caption: preflight.xPublishingPlan.captionIfEligible
  },
  queueAdvance: {
    country: "Saint Kitts and Nevis",
    batch: 341,
    scenes: [1384, 1385, 1386, 1387],
    cinematicTheme: "Mars-surface expedition couture",
    batchOrdinalWithinTheme: 1
  }
};

const out = path.join(lore, "batch-340-dominica-orbital-spaceship-checkpoint.json");
fs.writeFileSync(out, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ checkpoint: out, accepted: 0, rejected: 4, xPost: checkpoint.xPost, next: checkpoint.queueAdvance }, null, 2));
