import fs from "node:fs";
import path from "node:path";

const root = path.resolve("tmp/world-195x4/batch-351");
const lore = path.resolve("assets/lore/starlight-era");
const checkpointPath = path.join(lore, "batch-351-south-sudan-orbital-research-station-checkpoint.json");
const preflight = JSON.parse(fs.readFileSync(path.join(root, "batch-351-south-sudan-preflight.json"), "utf8"));

const accepted = [
  {
    scene: 1425,
    source: path.join(root, "raw/scene-1425.png"),
    file: "1425-south-sudan-sudd-orbital-research-station-weather-balloon-romance.png",
    audit: "Accepted fast-pass. Four clearly adult women appear with four distinct orbital-research silhouettes, the Sudd wetland and orbital ecology ring share the foreground, the inflated geometric weather-balloon cluster is visibly integrated by one woman, and the inert rainbow cinema prop uses a stable two-hand stance toward a complete empty target and sand backstop. The romance is unmistakable through a direct kiss, waist hold, linked hands and jealous eye line. Logged deviations: PAWS is omitted, the rolled turn becomes a close standing kiss, and some fine finger separation is small at portrait scale.",
  },
  {
    scene: 1427,
    source: path.join(root, "raw/scene-1427.png"),
    file: "1427-south-sudan-imatong-orbital-research-station-male-romance.png",
    audit: "Accepted fast-pass. Five clearly adult people appear, the established adult male is added without reducing the four-woman count, the Imatong mountain and forest foreground is fused with a large peaceful orbital research station, the group performs a strong jealousy and pursuit beat with multiple contacts, and ECE aims the inert rainbow cinema prop safely off-group toward an empty route lane. Logged deviations: the left seated woman's identity and skin tone drift from Ellie's anchor, MAX is omitted, the exact slow-dance chain resolves as a seated-to-standing affection cluster, and the distant route marker is not prominent.",
  },
];

for (const asset of accepted) fs.copyFileSync(asset.source, path.join(lore, asset.file));

const checkpoint = {
  ...preflight,
  status: "terminal-accepted",
  renderAttempts: {
    raw: { status: "complete", requested: 4, fulfilled: 2, moderationBlocked: 2, concurrency: "four independent built-in image generation calls launched together" },
    recovery: { status: "not-used", reason: "Two accepted assets satisfied the posting threshold; output-moderation no-assets were terminal under fast throughput mode." },
  },
  acceptedAssets: accepted.map(({ source, ...asset }) => asset),
  rejectedAssets: [
    { scene: 1424, status: "rejected-output-moderation", requestId: "481b0168-ca64-423c-bd86-126a9eb3002d", reason: "No image asset was returned." },
    { scene: 1426, status: "rejected-output-moderation", requestId: "25880de1-5647-4cc1-b533-f62297da1c3c", reason: "No image asset was returned." },
  ],
  xPost: {
    status: "eligible-awaiting-browser",
    minimumCurrentCountryAcceptedAssets: 2,
    currentCountryAcceptedAssets: 2,
    caption: preflight.xPublishingPlan.captionIfEligible,
    attachments: [accepted[0].file, accepted[1].file, "1422-djibouti-tadjoura-polar-airship-mascot-romance.png"],
  },
  completedAt: new Date().toISOString(),
  throughputMode: "fast-pass per explicit user direction; minor motif, mascot, identity, choreography, garment, hand and target deviations are logged but do not block public-safe coherent images",
  queueAdvance: { country: "Somalia", batch: 352, scenes: [1428, 1429, 1430, 1431], cinematicTheme: "orbital research-station couture", batchOrdinalWithinTheme: 2 },
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ checkpointPath, accepted: accepted.map((asset) => asset.file), xPost: checkpoint.xPost, next: checkpoint.queueAdvance }, null, 2));
