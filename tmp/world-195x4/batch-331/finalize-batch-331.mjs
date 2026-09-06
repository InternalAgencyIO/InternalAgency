import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "../../..");
const preflightPath = path.join(scriptDir, "batch-331-saint-lucia-preflight.json");
const checkpointPath = path.join(
  root,
  "assets/lore/starlight-era/batch-331-saint-lucia-relaxed-audit-checkpoint.json",
);

const checkpoint = JSON.parse(fs.readFileSync(preflightPath, "utf8"));
checkpoint.status = "terminal-partially-accepted-one";
checkpoint.completedAt = new Date().toISOString();
checkpoint.acceptancePolicy = {
  mode: "practical-anatomy-strict-safety",
  hardGates: [
    "correct clearly adult cast and identity roles",
    "exactly eight arms and eight hands, or ten arms and ten hands in the male scene",
    "one traceable owner for every limb with no extra, duplicated, fused, floating, borrowed, emerging, or ambiguous anatomy",
    "deterministic ECE or Alia prop handler",
    "materialized safe target line away from people and camera",
    "trigger finger indexed outside the guard",
    "secure opaque public-safe clothing",
    "male strongest eye line to ECE",
    "visible separate ECE route map",
    "large complete secular Saint Lucia motifs on at least two outfits",
  ],
  softDriftAccepted: [
    "ordinary contact occlusion when limb ownership remains clear and no malformed anatomy appears",
    "minor contact-placement drift",
    "subtle emotion intensity",
    "compact group spacing",
    "minor weather or surface sheen when footing remains visibly stable",
    "small non-hazardous editorial accessory drift",
  ],
};
checkpoint.renderAttempts = [
  {
    scenes: [1344, 1345, 1346, 1347],
    attempt: 1,
    source: "raw-concurrent",
    result: "no-retained-assets",
    reasons: [
      "one independent output was rejected by output moderation",
      "the concurrent call terminated before the other independent results could be retained",
    ],
  },
  {
    scene: 1344,
    attempt: 2,
    source: "single-recovery-pass",
    result: "accepted",
    reasons: [
      "four clearly adult women with exactly eight traceable arms and hands and no malformed anatomy",
      "ECE alone actively handles the inert prop in a two-hand stance with indexed trigger finger at a visible geometric paper route marker",
      "the separate Saint Lucia route map, complete twin Pitons, secure heels, rain curtain, and large country motifs are visible",
      "ordinary affectionate hand overlap is accepted because ownership remains traceable",
    ],
    asset: "assets/lore/starlight-era/1344-saint-lucia-soufriere-runway-paper-target-recovery.png",
    preservedAsset: "tmp/world-195x4/batch-331/recovery/1344-saint-lucia-soufriere-runway-paper-target-recovery.png",
  },
  {
    scene: 1345,
    attempt: 2,
    source: "single-recovery-pass",
    result: "terminal-rejected-hard-gate",
    reasons: [
      "the rolled open-water navigation marker is absent and the muzzle line terminates on a mountainside",
      "one affectionate contact hand has ambiguous ownership behind the central pair",
    ],
    preservedAsset: "tmp/world-195x4/batch-331/recovery/1345-saint-lucia-tet-paul-runway-recovery.png",
  },
  {
    scene: 1346,
    attempt: 2,
    source: "single-recovery-pass",
    result: "terminal-rejected-hard-gate",
    reasons: [
      "the adult male strongest eye line lands on Radiance rather than ECE",
      "ECE holds a beacon-like orb instead of remaining route strategist through the required separate holographic map",
    ],
    preservedAsset: "tmp/world-195x4/batch-331/recovery/1346-saint-lucia-sulphur-springs-male-recovery.png",
  },
  {
    scene: 1347,
    attempt: 2,
    source: "single-recovery-pass",
    result: "terminal-rejected-hard-gate",
    reasons: [
      "ECE's required separate holographic route map is absent",
      "one contact hand in the right-side group is not continuously traceable to a visible arm owner",
    ],
    preservedAsset: "tmp/world-195x4/batch-331/recovery/1347-saint-lucia-marigot-bay-recovery.png",
  },
];
checkpoint.acceptedAssets = checkpoint.renderAttempts
  .filter((attempt) => attempt.result === "accepted")
  .map((attempt) => attempt.asset);
checkpoint.rejectedAssets = checkpoint.renderAttempts
  .filter((attempt) => attempt.result === "terminal-rejected-hard-gate")
  .map((attempt) => ({
    scene: attempt.scene,
    attemptsExhausted: true,
    asset: attempt.preservedAsset,
    terminalReasons: attempt.reasons,
  }));
checkpoint.queueAdvance = {
  allowed: true,
  reason: "Saint Lucia has one accepted local asset and a terminal checkpoint after its single recovery pass",
  nextCountry: "Kiribati",
  nextBatch: 332,
  nextScenes: [1348, 1349, 1350, 1351],
  nextThemePair: ["cleaner and service couture", "cinematic covert-agent crew couture"],
};
checkpoint.xPost = {
  status: "deferred-insufficient-accepted-assets",
  caption: checkpoint.xPublishingPlan.captionIfEligible,
  attachmentPolicy: "two accepted Saint Lucia images plus one accepted Samoa image",
  eligible: false,
  acceptedCurrentCountryCount: checkpoint.acceptedAssets.length,
  minimumCurrentCountryAcceptedAssets: 2,
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`);
console.log(checkpointPath);
