import fs from "node:fs";
import path from "node:path";

const repo = process.cwd();
const tmp = path.join(repo, "tmp", "world-195x4", "batch-348");
const lore = path.join(repo, "assets", "lore", "starlight-era");
const preflight = JSON.parse(fs.readFileSync(path.join(tmp, "batch-348-tuvalu-preflight.json"), "utf8"));
const acceptedAssets = [{
  scene: 1414,
  file: "1414-tuvalu-nanumea-submersible-route-romance.png",
  audit: "Accepted fast-pass. Exactly four adult women are visible, Nanumea Atoll is large and recognizable, the civilian deep-sea research craft is foregrounded, all four couture constructions are distinct, the affection event has multiple clear contacts, and the inert cinema prop is held in a two-hand stance toward a clearly empty digital route marker over unoccupied water. Logged deviations: the rolled seated embrace becomes a standing kiss plus seated invitation, weather reads as bright spray rather than cinematic light rain, and some finger details are small at portrait scale."
}];
const checkpoint = {
  ...preflight,
  status: "terminal-partially-accepted",
  completedAt: new Date().toISOString(),
  throughputMode: "fast-pass per explicit user direction; minor motif, mascot, handler, choreography, garment, hand and target deviations are logged but do not block public-safe coherent images",
  renderAttempts: {
    raw: { status: "complete", requested: 4, fulfilled: 1, moderationBlocked: 3, concurrency: "four independent built-in image generation calls launched together" },
    recovery: { status: "not-used", reason: "Three calls returned no asset due to output moderation; the durable asset was immediately usable, so the terminal checkpoint advances without delay." }
  },
  acceptedAssets,
  rejectedAssets: [
    { scene: 1412, status: "rejected-output-moderation", requestId: "049523a8-506f-4971-8511-604461293d9a", reason: "No image asset was returned." },
    { scene: 1413, status: "rejected-output-moderation", requestId: "26c13303-d696-4668-8285-69dfe25a490f", reason: "No image asset was returned." },
    { scene: 1415, status: "rejected-output-moderation", requestId: "69286f46-36ac-475a-9243-39379d9df71f", reason: "No image asset was returned." }
  ],
  xPost: { status: "deferred-insufficient-accepted-assets", minimumCurrentCountryAcceptedAssets: 2, currentCountryAcceptedAssets: 1, caption: preflight.xPublishingPlan.captionIfEligible, reason: "Only one accepted current-country image exists; no X compose action was opened." },
  queueAdvance: { country: "Vatican City", batch: 349, scenes: [1416, 1417, 1418, 1419], cinematicTheme: "polar airship couture", batchOrdinalWithinTheme: 1 }
};
const out = path.join(lore, "batch-348-tuvalu-deep-sea-submersible-checkpoint.json");
fs.writeFileSync(out, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ checkpoint: out, accepted: 1, rejected: 3, xPost: checkpoint.xPost, next: checkpoint.queueAdvance }, null, 2));
