import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "../../..");
const preflightPath = path.join(scriptDir, "batch-327-vanuatu-preflight.json");
const checkpointPath = path.join(
  root,
  "assets/lore/starlight-era/batch-327-vanuatu-relaxed-audit-checkpoint.json",
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
    "large complete secular Vanuatu motifs on at least two outfits",
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
    scene: 1328,
    attempt: 1,
    source: "raw",
    result: "rejected-for-recovery",
    reasons: ["close affectionate contact made the conservative hand audit uncertain"],
    preservedAsset: "tmp/world-195x4/batch-327/raw/1328-raw.png",
  },
  {
    scene: 1328,
    attempt: 2,
    source: "single-recovery-pass",
    result: "accepted",
    reasons: [
      "four adults with traceable limb ownership and no extra, fused, floating, or duplicated anatomy",
      "ECE alone handles the inert prop with an indexed trigger finger and complete visible paper-target line",
      "Port Vila, hail, complete heels, and large Vanuatu motifs are visible",
      "ordinary affectionate hand occlusion accepted under the user-requested practical threshold",
    ],
    asset: "assets/lore/starlight-era/1328-vanuatu-port-vila-investigator-paper-target-recovery.png",
  },
  {
    scene: 1329,
    attempt: 1,
    source: "raw",
    result: "rejected-hard-gate",
    reasons: ["adult male strongest eye line drifted from ECE"],
    preservedAsset: "tmp/world-195x4/batch-327/raw/1329-raw.png",
  },
  {
    scene: 1329,
    attempt: 2,
    source: "single-recovery-pass",
    result: "terminal-rejected-hard-gate",
    reasons: [
      "adult male strongest eye line still landed on another woman rather than ECE",
      "the binding male-scene relationship gate remained unsatisfied",
    ],
    preservedAsset: "tmp/world-195x4/batch-327/recovery/1329-recovery.png",
  },
  {
    scene: 1330,
    attempt: 1,
    source: "raw",
    result: "rejected-hard-gate",
    reasons: ["required empty paper target was absent from the visible muzzle line"],
    preservedAsset: "tmp/world-195x4/batch-327/raw/1330-raw.png",
  },
  {
    scene: 1330,
    attempt: 2,
    source: "single-recovery-pass",
    result: "accepted",
    reasons: [
      "four adults with traceable limb ownership and no extra, fused, floating, or duplicated anatomy",
      "ECE alone handles the inert prop with an indexed trigger finger and complete visible empty paper-target line",
      "Blue Lagoon, red-gold weather, complete heels, and large Vanuatu motifs are visible",
      "ordinary affectionate hand occlusion accepted under the user-requested practical threshold",
    ],
    asset: "assets/lore/starlight-era/1330-vanuatu-blue-lagoon-care-paper-target-recovery.png",
  },
  {
    scene: 1331,
    attempt: 1,
    source: "raw",
    result: "rejected-for-recovery",
    reasons: ["close affectionate contact made the conservative hand audit uncertain"],
    preservedAsset: "tmp/world-195x4/batch-327/raw/1331-raw.png",
  },
  {
    scene: 1331,
    attempt: 2,
    source: "single-recovery-pass",
    result: "accepted",
    reasons: [
      "four adults with traceable limb ownership and no extra, fused, floating, or duplicated anatomy",
      "Alia alone handles the inert prop with an indexed trigger finger and complete visible empty paper-target line",
      "Radiance alone wears the rolled country-anchored opaque rainbow knee socks",
      "Champagne Beach, horizon lightning, complete heels, and large Vanuatu motifs are visible",
      "ordinary affectionate hand occlusion accepted under the user-requested practical threshold",
    ],
    asset: "assets/lore/starlight-era/1331-vanuatu-champagne-beach-care-rainbow-paper-target-recovery.png",
  },
];
checkpoint.acceptedAssets = checkpoint.renderAttempts
  .filter((attempt) => attempt.result === "accepted")
  .map((attempt) => attempt.asset);
checkpoint.rejectedAssets = [
  {
    scene: 1329,
    attemptsExhausted: true,
    assets: [
      "tmp/world-195x4/batch-327/raw/1329-raw.png",
      "tmp/world-195x4/batch-327/recovery/1329-recovery.png",
    ],
    terminalReason: "adult male strongest eye line remained away from ECE",
  },
];
checkpoint.queueAdvance = {
  allowed: true,
  reason: "Vanuatu has accepted local assets and a terminal checkpoint",
  nextCountry: "Barbados",
  nextBatch: 328,
  nextScenes: [1332, 1333, 1334, 1335],
  nextThemePair: [
    "nurse-care couture",
    "doctor-clinical-command couture",
  ],
};
checkpoint.xPost = {
  status: "pending-publication-after-push",
  caption: checkpoint.xPublishingPlan.captionIfEligible,
  attachmentPolicy: "two accepted Vanuatu images plus one accepted Iceland image",
  eligible: true,
  acceptedCurrentCountryCount: checkpoint.acceptedAssets.length,
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`);
console.log(checkpointPath);
