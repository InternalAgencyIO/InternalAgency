import fs from "node:fs";
import path from "node:path";

const repo = process.cwd();
const tmp = path.join(repo, "tmp", "world-195x4", "batch-347");
const lore = path.join(repo, "assets", "lore", "starlight-era");
const preflight = JSON.parse(fs.readFileSync(path.join(tmp, "batch-347-nauru-preflight.json"), "utf8"));
const acceptedAssets = [{
  scene: 1408,
  file: "1408-nauru-anibare-submersible-lap-romance.png",
  audit: "Accepted fast-pass. The complete four-woman cast plus established adult male is present, Anibare Bay and limestone pinnacles are recognizable, the civilian bathysphere is foregrounded, the four women have distinct constructions, the seated lap-romance choice has multiple clear contacts, and the inert prop points upward away from every person and camera. Logged deviations: the male contact graph is gentler than rolled, the route target is adjacent rather than aligned, outfit motif coverage is uneven, and indexed-trigger detail is not fully legible at portrait scale."
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
    { scene: 1409, status: "rejected-output-moderation", requestId: "4342bd7c-60be-4bc5-b7ad-ffcc163040fd", reason: "No image asset was returned." },
    { scene: 1410, status: "rejected-output-moderation", requestId: "58c90583-cba6-4c28-aa73-5a4f52f6c220", reason: "No image asset was returned." },
    { scene: 1411, status: "rejected-output-moderation", requestId: "ed62321a-c37b-48d7-9515-b40c428198da", reason: "No image asset was returned." }
  ],
  xPost: { status: "deferred-insufficient-accepted-assets", minimumCurrentCountryAcceptedAssets: 2, currentCountryAcceptedAssets: 1, caption: preflight.xPublishingPlan.captionIfEligible, reason: "Only one accepted current-country image exists; no X compose action was opened." },
  queueAdvance: { country: "Tuvalu", batch: 348, scenes: [1412, 1413, 1414, 1415], cinematicTheme: "deep-sea submersible couture", batchOrdinalWithinTheme: 2 }
};
const out = path.join(lore, "batch-347-nauru-deep-sea-submersible-checkpoint.json");
fs.writeFileSync(out, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ checkpoint: out, accepted: 1, rejected: 3, xPost: checkpoint.xPost, next: checkpoint.queueAdvance }, null, 2));
