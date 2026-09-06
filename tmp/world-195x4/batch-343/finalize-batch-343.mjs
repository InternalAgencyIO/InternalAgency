import fs from "node:fs";
import path from "node:path";

const repo = process.cwd();
const tmp = path.join(repo, "tmp", "world-195x4", "batch-343");
const lore = path.join(repo, "assets", "lore", "starlight-era");
const preflight = JSON.parse(fs.readFileSync(path.join(tmp, "batch-343-monaco-preflight.json"), "utf8"));

const acceptedAssets = [
  {
    scene: 1395,
    file: "1395-monaco-larvotto-moon-planetarium-romance.png",
    audit: "Accepted fast-pass. Exactly four adult women with traceable anatomy, four strongly different lunar-fashion silhouettes, Larvotto beach and Monaco's stepped waterfront skyline, a large peaceful lunar module, storm weather, a portable miniature planetarium, and a readable affectionate pursuit beat. Logged deviations: MAX renders as a stylized pink cat-like mascot, the mission prop and separate holographic route map are absent, and the three-person slow dance resolves as an active linked-arm choice. No unsafe weapon line, firing, ammunition, threat, explicit content, or whole-person duplication appears."
  }
];

const checkpoint = {
  ...preflight,
  status: "terminal-partially-accepted",
  completedAt: new Date().toISOString(),
  throughputMode: "fast-pass per explicit user direction; minor motif, mascot, handler, choreography, garment, hand and missing-prop deviations are logged but do not block an otherwise public-safe coherent image",
  renderAttempts: {
    raw: { status: "complete", requested: 4, fulfilled: 1, moderationBlocked: 3, concurrency: "four independent built-in image generation calls launched together" },
    recovery: { status: "not-used", reason: "Three calls returned no asset due to output moderation; the one durable asset was immediately usable under fast-pass acceptance, so the terminal checkpoint advances without further render delay." }
  },
  acceptedAssets,
  rejectedAssets: [
    { scene: 1392, status: "rejected-output-moderation", requestId: "0e5b526b-6081-4433-9d65-96c67e05044f", reason: "No image asset was returned." },
    { scene: 1393, status: "rejected-output-moderation", requestId: "d86ab27f-c690-4135-9aa9-c9a02484f91b", reason: "No image asset was returned." },
    { scene: 1394, status: "rejected-output-moderation", requestId: "40917cba-0943-4d90-aef8-15fc6390b7f9", reason: "No image asset was returned." }
  ],
  xPost: {
    status: "deferred-insufficient-accepted-assets",
    minimumCurrentCountryAcceptedAssets: 2,
    currentCountryAcceptedAssets: 1,
    caption: preflight.xPublishingPlan.captionIfEligible,
    reason: "Only one accepted current-country image exists; no X compose action was opened."
  },
  queueAdvance: { country: "Marshall Islands", batch: 344, scenes: [1396, 1397, 1398, 1399], cinematicTheme: "Moon-surface expedition couture", batchOrdinalWithinTheme: 2 }
};

const out = path.join(lore, "batch-343-monaco-moon-expedition-checkpoint.json");
fs.writeFileSync(out, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ checkpoint: out, accepted: acceptedAssets.length, rejected: checkpoint.rejectedAssets.length, xPost: checkpoint.xPost, next: checkpoint.queueAdvance }, null, 2));
