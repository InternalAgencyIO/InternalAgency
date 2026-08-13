import fs from "node:fs";
import path from "node:path";

const repo = process.cwd();
const tmp = path.join(repo, "tmp", "world-195x4", "batch-346");
const lore = path.join(repo, "assets", "lore", "starlight-era");
const preflight = JSON.parse(fs.readFileSync(path.join(tmp, "batch-346-palau-preflight.json"), "utf8"));

const acceptedAssets = [{
  scene: 1404,
  file: "1404-palau-rock-islands-solar-storm-romance.png",
  audit: "Accepted fast-pass. Exactly four adult women, a recognizable Rock Islands lagoon, rolling storm weather, a foreground solar-observation platform, four materially distinct couture silhouettes, three readable affectionate contacts, and the inert cinema prop pointed upward and away from every person and camera. Logged deviations: the dance-chain beat resolves as lap seating plus hand-linked invitation, the route target is adjacent rather than aligned, the mission-prop handler and rainbow-hosiery identity are visually ambiguous, and the trigger-index detail is not fully legible at portrait scale."
}];

const checkpoint = {
  ...preflight,
  status: "terminal-partially-accepted",
  completedAt: new Date().toISOString(),
  throughputMode: "fast-pass per explicit user direction; minor motif, mascot, handler, choreography, garment, hand and target deviations are logged but do not block public-safe coherent images",
  renderAttempts: {
    raw: { status: "complete", requested: 4, fulfilled: 1, moderationBlocked: 3, concurrency: "four independent built-in image generation calls launched together" },
    recovery: { status: "not-used", reason: "Three calls returned no asset due to output moderation; the one durable asset was immediately usable, so the terminal checkpoint advances without further render delay." }
  },
  acceptedAssets,
  rejectedAssets: [
    { scene: 1405, status: "rejected-output-moderation", requestId: "02e8b87a-5d4f-4c95-b538-7eb5feded9f3", reason: "No image asset was returned." },
    { scene: 1406, status: "rejected-output-moderation", requestId: "a015f9d6-5448-45e8-82f0-086d3c8aeed9", reason: "No image asset was returned." },
    { scene: 1407, status: "rejected-output-moderation", requestId: "780ffdb4-ef1d-4fe8-8707-8f9c8521e35d", reason: "No image asset was returned." }
  ],
  xPost: {
    status: "deferred-insufficient-accepted-assets",
    minimumCurrentCountryAcceptedAssets: 2,
    currentCountryAcceptedAssets: 1,
    caption: preflight.xPublishingPlan.captionIfEligible,
    reason: "Only one accepted current-country image exists; no X compose action was opened."
  },
  queueAdvance: {
    country: "Nauru",
    batch: 347,
    scenes: [1408, 1409, 1410, 1411],
    cinematicTheme: "deep-sea submersible couture",
    batchOrdinalWithinTheme: 1
  }
};

const out = path.join(lore, "batch-346-palau-solar-observation-checkpoint.json");
fs.writeFileSync(out, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ checkpoint: out, accepted: 1, rejected: 3, xPost: checkpoint.xPost, next: checkpoint.queueAdvance }, null, 2));
