import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const preflightPath = path.join(root, "tmp/world-195x4/batch-333/batch-333-seychelles-preflight.json");
const checkpointPath = path.join(root, "assets/lore/starlight-era/batch-333-seychelles-private-jet-checkpoint.json");
const preflight = JSON.parse(fs.readFileSync(preflightPath, "utf8"));

const checkpoint = {
  ...preflight,
  status: "terminal-partially-accepted",
  terminalAt: new Date().toISOString(),
  acceptanceGate: {
    anatomy: "strict exact-owner limb and hand audit",
    originality: "distinct silhouette, construction, material, motif technique, hem architecture, and footwear",
    romance: "mandatory hard-love beat must be the first read",
    fusion: "country location and private-jet aviation couture must both read in the foreground",
  },
  renderAttempts: [
    {
      scene: 1352,
      raw: "tmp/world-195x4/batch-333/raw/1352-raw.png",
      recoveryUsed: false,
      result: "accepted",
      audit: "Four adults, eight traceable arms and hands, Alia alone owns the downrange prop, MAX is safely held by ECE, the partner turn is readable, and all four outfit constructions remain distinct.",
    },
    {
      scene: 1353,
      raw: null,
      recovery: "tmp/world-195x4/batch-333/raw/1353-recovery.png",
      recoveryUsed: true,
      result: "rejected",
      audit: "Five adults and the male dance are present, but at least one owner hand is hidden or ambiguous and the recorded competing-dance contact graph is not fully materialized.",
    },
    {
      scene: 1354,
      raw: "tmp/world-195x4/batch-333/raw/1354-raw.png",
      recovery: "tmp/world-195x4/batch-333/raw/1354-recovery.png",
      recoveryUsed: true,
      result: "accepted",
      audit: "Four adults, eight traceable arms and hands, ECE alone owns the downrange prop, PAWS and MAX share a safe supervised play beat, the three-person moving dance is readable, and the four theme-led constructions remain distinct.",
    },
    {
      scene: 1355,
      raw: "tmp/world-195x4/batch-333/raw/1355-raw.png",
      recovery: "tmp/world-195x4/batch-333/raw/1355-recovery.png",
      recoveryUsed: true,
      result: "rejected",
      audit: "The pursuit and MAX beat read clearly, but Alia's second hand remains hidden or ambiguously merged after the single recovery pass.",
    },
  ],
  acceptedAssets: [
    "assets/lore/starlight-era/1352-seychelles-victoria-private-jet-dance-max.png",
    "assets/lore/starlight-era/1354-seychelles-anse-source-dargent-private-jet-slow-dance-paws-max.png",
  ],
  rejectedAssets: [
    { scene: 1353, reason: "strict anatomy and recorded-contact-graph failure after recovery" },
    { scene: 1355, reason: "strict anatomy failure after recovery" },
  ],
  acceptanceSummary: {
    attemptedScenes: 4,
    acceptedScenes: 2,
    rejectedScenes: 2,
    originalityGatePassedByAcceptedScenes: true,
    hardLoveGatePassedByAcceptedScenes: true,
  },
  xPost: {
    status: "eligible-pending-publication",
    requiredAcceptedCurrentCountryAssets: 2,
    availableAcceptedCurrentCountryAssets: 2,
    caption: preflight.xPublishingPlan.captionIfEligible,
    attachments: [
      "assets/lore/starlight-era/1352-seychelles-victoria-private-jet-dance-max.png",
      "assets/lore/starlight-era/1354-seychelles-anse-source-dargent-private-jet-slow-dance-paws-max.png",
      "assets/lore/starlight-era/1344-saint-lucia-soufriere-runway-paper-target-recovery.png",
    ],
  },
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(checkpointPath);
