import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "../../..");
const preflightPath = path.join(scriptDir, "batch-328-barbados-preflight.json");
const checkpointPath = path.join(
  root,
  "assets/lore/starlight-era/batch-328-barbados-relaxed-audit-checkpoint.json",
);

const checkpoint = JSON.parse(fs.readFileSync(preflightPath, "utf8"));
checkpoint.status = "terminal-partially-accepted-three";
checkpoint.completedAt = new Date().toISOString();
checkpoint.acceptancePolicy = {
  mode: "practical-anatomy-strict-safety",
  hardGates: [
    "correct clearly adult cast and identity roles",
    "exactly eight arms and eight hands, or ten arms and ten hands in the male scene",
    "one traceable owner for every limb with no extra, duplicated, fused, floating, borrowed, emerging, or ambiguous anatomy",
    "deterministic ECE or Alia prop handler",
    "visible safe target line away from people and camera",
    "trigger finger indexed outside the guard",
    "secure opaque public-safe clothing",
    "male strongest eye line to ECE",
    "PAWS separated from prop and unsafe footing",
    "large complete secular Barbados motifs on at least two outfits",
  ],
  softDriftAccepted: [
    "ordinary contact occlusion when limb ownership remains clear and no malformed anatomy appears",
    "minor contact-placement drift",
    "subtle emotion intensity",
    "compact group spacing",
    "weather spill under shelter",
    "small non-hazardous editorial accessory drift",
  ],
};
checkpoint.renderAttempts = [
  {
    scene: 1332,
    attempt: 1,
    source: "raw",
    result: "rejected-hard-gate",
    reasons: ["rolled empty harbor marker was absent from the visible muzzle line"],
    preservedAsset: "tmp/world-195x4/batch-328/raw/1332-raw.png",
  },
  {
    scene: 1332,
    attempt: 2,
    source: "single-recovery-pass",
    result: "accepted",
    reasons: [
      "four adults with traceable limb ownership and no extra, fused, floating, or duplicated anatomy",
      "Alia alone handles the inert prop with an indexed trigger finger and visible empty Careenage marker line",
      "Radiance alone wears the rolled country-anchored opaque rainbow knee socks",
      "Radiance and ECE remain the affectionate center",
      "Bridgetown, thunderstorm, complete heels, and large Barbados motifs are visible",
    ],
    asset: "assets/lore/starlight-era/1332-barbados-bridgetown-care-rainbow-harbor-marker-recovery.png",
  },
  {
    scene: 1333,
    attempt: 1,
    source: "raw",
    result: "accepted",
    reasons: [
      "four adults with traceable limb ownership and no extra, fused, floating, or duplicated anatomy",
      "ECE alone handles the inert prop with an indexed trigger finger and visible empty offshore marker line",
      "Bathsheba, double rainbow, complete heels, and large Barbados motifs are visible",
      "ordinary affectionate hand occlusion accepted under the user-requested practical threshold",
    ],
    asset: "assets/lore/starlight-era/1333-barbados-bathsheba-care-ocean-marker.png",
  },
  {
    scene: 1334,
    attempt: 1,
    source: "raw",
    result: "rejected-hard-gate",
    reasons: [
      "rolled illuminated route marker was absent from the visible muzzle line",
      "adult male strongest eye line drifted from ECE",
    ],
    preservedAsset: "tmp/world-195x4/batch-328/raw/1334-raw.png",
  },
  {
    scene: 1334,
    attempt: 2,
    source: "single-recovery-pass",
    result: "terminal-rejected-hard-gate",
    reasons: [
      "illuminated route marker and safe ECE target line were corrected",
      "adult male strongest eye line still landed on the central pair rather than unmistakably on ECE",
      "the binding male-scene relationship gate remained unsatisfied",
    ],
    preservedAsset: "tmp/world-195x4/batch-328/recovery/1334-recovery.png",
  },
  {
    scene: 1335,
    attempt: 1,
    source: "raw",
    result: "rejected-hard-gate",
    reasons: [
      "rolled paper target was absent from the visible muzzle line",
      "stored blizzard weather had no visible materialization",
    ],
    preservedAsset: "tmp/world-195x4/batch-328/raw/1335-raw.png",
  },
  {
    scene: 1335,
    attempt: 2,
    source: "single-recovery-pass",
    result: "accepted",
    reasons: [
      "four adults with traceable limb ownership and no extra, fused, floating, or duplicated anatomy",
      "ECE alone handles the inert prop with an indexed trigger finger and complete visible empty paper-target line",
      "the weather roll is safely visible as dense backlit white ocean-spray flecks with stable footing",
      "Animal Flower Cave, complete heels, and large Barbados motifs are visible",
      "ordinary affectionate hand occlusion accepted under the user-requested practical threshold",
    ],
    asset: "assets/lore/starlight-era/1335-barbados-animal-flower-cave-clinical-paper-target-recovery.png",
  },
];
checkpoint.acceptedAssets = checkpoint.renderAttempts
  .filter((attempt) => attempt.result === "accepted")
  .map((attempt) => attempt.asset);
checkpoint.rejectedAssets = [
  {
    scene: 1334,
    attemptsExhausted: true,
    assets: [
      "tmp/world-195x4/batch-328/raw/1334-raw.png",
      "tmp/world-195x4/batch-328/recovery/1334-recovery.png",
    ],
    terminalReason: "adult male strongest eye line remained away from ECE",
  },
];
checkpoint.queueAdvance = {
  allowed: true,
  reason: "Barbados has accepted local assets and a terminal checkpoint",
  nextCountry: "São Tomé and Príncipe",
  nextBatch: 329,
  nextScenes: [1336, 1337, 1338, 1339],
  nextThemePair: [
    "doctor-clinical-command couture",
    "adult nightlife dance-performance couture",
  ],
};
checkpoint.xPost = {
  status: "pending-publication-after-push",
  caption: checkpoint.xPublishingPlan.captionIfEligible,
  attachmentPolicy: "two accepted Barbados images plus one accepted Vanuatu image",
  eligible: true,
  acceptedCurrentCountryCount: checkpoint.acceptedAssets.length,
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`);
console.log(checkpointPath);
