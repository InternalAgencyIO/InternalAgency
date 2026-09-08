import fs from "node:fs";
import path from "node:path";

const repo = process.cwd();
const tmp = path.join(repo, "tmp", "world-195x4", "batch-342");
const lore = path.join(repo, "assets", "lore", "starlight-era");
const preflight = JSON.parse(fs.readFileSync(path.join(tmp, "batch-342-liechtenstein-preflight.json"), "utf8"));

const acceptedAssets = [
  {
    scene: 1389,
    file: "1389-liechtenstein-gutenberg-castle-mars-cello-romance.png",
    audit: "Accepted fast-pass. Four women plus the established adult male, a strong hilltop castle and Alpine setting, four visibly distinct couture systems, a neon acrylic cello, an affectionate jealousy beat, a holographic route map, and an inert rainbow cinema training prop directed away from people and camera. Logged deviations: the castle resembles a romanticized composite rather than exact Gutenberg Castle, the two rolled mascots render as two small dogs instead of PAWS and MAX, the seated-embrace choreography becomes standing affection, and the empty target/backstop is outside the crop. No firing, ammunition, threat, or person-directed line is visible."
  }
];

const checkpoint = {
  ...preflight,
  status: "terminal-partially-accepted",
  completedAt: new Date().toISOString(),
  throughputMode: "fast-pass per explicit user direction; minor motif, mascot, handler, choreography, garment and hand deviations are logged but do not block acceptance",
  renderAttempts: {
    raw: { status: "complete", requested: 4, fulfilled: 2, moderationBlocked: 2, concurrency: "four independent built-in image generation calls launched together" },
    recovery: { status: "complete-moderation-blocked", scene: 1390, attempts: 1, requestId: "373e48c0-8845-4307-857a-19330490a1ad", reason: "The single allowed edit attempted to remove the decisive fifth-person duplicate while preserving the composition; output moderation blocked the edit." }
  },
  acceptedAssets,
  rejectedAssets: [
    { scene: 1388, status: "rejected-output-moderation", requestId: "7711c0c3-2bd4-45dc-923f-25dd89eab6e1", reason: "No image asset was returned." },
    { scene: 1390, status: "rejected-duplicate-whole-person", rawFile: "1390-liechtenstein-malbun-mars-raw.png", reason: "The raw image contains five women in a four-woman scene. This is a decisive whole-person duplication even under fast-pass acceptance; its single recovery pass was output-moderation blocked." },
    { scene: 1391, status: "rejected-output-moderation", requestId: "13d57e9c-bd42-4b7d-9680-df00bcc6e49e", reason: "No image asset was returned." }
  ],
  xPost: {
    status: "deferred-insufficient-accepted-assets",
    minimumCurrentCountryAcceptedAssets: 2,
    currentCountryAcceptedAssets: 1,
    caption: preflight.xPublishingPlan.captionIfEligible,
    reason: "Only one accepted current-country image exists; no X compose action was opened."
  },
  queueAdvance: { country: "Monaco", batch: 343, scenes: [1392, 1393, 1394, 1395], cinematicTheme: "Moon-surface expedition couture", batchOrdinalWithinTheme: 1 }
};

const out = path.join(lore, "batch-342-liechtenstein-mars-expedition-checkpoint.json");
fs.writeFileSync(out, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ checkpoint: out, accepted: acceptedAssets.length, rejected: checkpoint.rejectedAssets.length, xPost: checkpoint.xPost, next: checkpoint.queueAdvance }, null, 2));
