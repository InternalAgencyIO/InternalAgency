import fs from "node:fs";
import path from "node:path";

const repo = process.cwd();
const tmp = path.join(repo, "tmp", "world-195x4", "batch-339");
const lore = path.join(repo, "assets", "lore", "starlight-era");
const preflight = JSON.parse(fs.readFileSync(path.join(tmp, "batch-339-andorra-preflight.json"), "utf8"));

const acceptedAssets = [
  {
    scene: 1376,
    file: "1376-andorra-casa-de-la-vall-orbital-dance.png",
    audit: "Accepted fast-pass. Four adult women, distinct silhouettes, Casa de la Vall and spacecraft foreground fusion, linked seated romance, and inert prop safely directed away from people. Logged deviations: MAX omitted, dance turn softened, inactive telescope appeared, and country motif specificity is moderate."
  },
  {
    scene: 1377,
    file: "1377-andorra-roc-del-quer-orbital-target-dance.png",
    audit: "Accepted fast-pass. Four adult women, Roc del Quer mountain composition, spacecraft, visible paper target and backstop, indexed prop handling, strong motion and multiple contacts. Logged deviations: MAX omitted, mirrored megaphone omitted, and choreography reads as supported dip rather than a complete linked-hand turn."
  },
  {
    scene: 1379,
    file: "1379-andorra-madriu-valley-orbital-romance-male.png",
    audit: "Accepted fast-pass. Four adult women plus established adult male, distinct orbital silhouettes, Andorran valley and spacecraft, clear romantic contact graph, and inert prop safely aimed away from people. Logged deviations: PAWS rendered as a second pup rather than the golden kitten, target is outside frame, and the slow-dance chain is quieter than rolled."
  }
];

const checkpoint = {
  ...preflight,
  status: "terminal-partially-accepted",
  completedAt: new Date().toISOString(),
  throughputMode: "fast-pass per explicit user direction; minor motif, mascot, odd-prop, choreography, garment, and hand deviations are logged but do not block acceptance",
  renderAttempts: {
    raw: { status: "complete", requested: 4, fulfilled: 3, moderationBlocked: 1, concurrency: "four independent built-in image generation calls launched together" },
    recovery: { status: "not-used", reason: "Scene 1378 produced no durable output after output-stage moderation; accepted scenes had no decisive safety defect." }
  },
  acceptedAssets,
  rejectedAssets: [
    {
      scene: 1378,
      status: "moderation-blocked-no-output",
      requestId: "d7b29f98-e5c7-4890-9f4e-499694f81eb3",
      reason: "Image generation output-stage safety rejection; no durable asset existed to inspect or recover."
    }
  ],
  xPost: {
    status: "published",
    minimumCurrentCountryAcceptedAssets: 2,
    currentCountryAcceptedAssets: 3,
    caption: preflight.xPublishingPlan.captionIfEligible,
    plannedAttachments: [acceptedAssets[0].file, acceptedAssets[1].file, "1372-antigua-nelsons-dockyard-rescue-vessel.png"],
    url: "https://x.com/dogramaci/status/2086787793091534952",
    postedAt: new Date().toISOString(),
    account: "@dogramaci",
    attachmentCount: 3,
    verification: "Returned to X home after one Post click; newest @dogramaci article matched the exact caption and exposed photo/1, photo/2, and photo/3 links."
  },
  queueAdvance: {
    country: "Dominica",
    batch: 340,
    scenes: [1380, 1381, 1382, 1383],
    cinematicTheme: "orbital spaceship couture",
    batchOrdinalWithinTheme: 2
  }
};

fs.writeFileSync(path.join(lore, "batch-339-andorra-orbital-spaceship-checkpoint.json"), `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ checkpoint: path.join(lore, "batch-339-andorra-orbital-spaceship-checkpoint.json"), accepted: acceptedAssets.length, rejected: checkpoint.rejectedAssets.length, xPost: checkpoint.xPost }, null, 2));
