import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "../../..");
const preflightPath = path.join(scriptDir, "batch-329-sao-tome-and-principe-preflight.json");
const checkpointPath = path.join(
  root,
  "assets/lore/starlight-era/batch-329-sao-tome-and-principe-relaxed-audit-checkpoint.json",
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
    "large complete secular São Tomé and Príncipe motifs on at least two outfits",
  ],
  softDriftAccepted: [
    "ordinary contact occlusion when limb ownership remains clear and no malformed anatomy appears",
    "minor contact-placement drift",
    "subtle emotion intensity",
    "compact group spacing",
    "weather spill under shelter when footing remains visibly stable",
    "small non-hazardous editorial accessory drift",
  ],
};
checkpoint.renderAttempts = [
  {
    scene: 1336,
    attempt: 1,
    source: "raw",
    result: "accepted",
    reasons: [
      "four adults with traceable limb ownership and no extra, fused, floating, or duplicated anatomy",
      "Alia alone handles the inert prop with an indexed trigger finger and visible empty geometric target line",
      "ECE alone wears the rolled country-palette opaque rainbow knee socks",
      "Radiance and ECE remain the affectionate center",
      "Ana Chaves Bay, waterspout, complete heels, and large São Tomé motifs are visible",
    ],
    asset: "assets/lore/starlight-era/1336-sao-tome-ana-chaves-bay-clinical-rainbow-target.png",
  },
  {
    scene: 1337,
    attempt: 1,
    source: "raw",
    result: "rejected-hard-gate",
    reasons: [
      "rolled empty route marker was absent from the visible muzzle line",
      "covered footing read wet rather than dry",
    ],
    preservedAsset: "tmp/world-195x4/batch-329/raw/1337-sao-tome-pico-cao-grande-raw.png",
  },
  {
    scene: 1337,
    attempt: 2,
    source: "single-recovery-pass",
    result: "accepted",
    reasons: [
      "four adults with traceable limb ownership and no extra, fused, floating, or duplicated anatomy",
      "ECE alone handles the inert prop with an indexed trigger finger and a visible empty abstract route marker line",
      "PAWS is securely held far from the prop and the stationary pole motif is harmless",
      "Pico Cão Grande, lightning, complete heels, and large São Tomé motifs are visible",
    ],
    asset: "assets/lore/starlight-era/1337-sao-tome-pico-cao-grande-clinical-marker-recovery.png",
  },
  {
    scene: 1338,
    attempt: 1,
    source: "raw",
    result: "rejected-hard-gate",
    reasons: [
      "paper target used a person-shaped silhouette rather than an unoccupied geometric route marker",
      "ECE's far-right shoe was cropped by the frame",
    ],
    preservedAsset: "tmp/world-195x4/batch-329/raw/1338-sao-tome-cocoa-estate-raw.png",
  },
  {
    scene: 1338,
    attempt: 2,
    source: "single-recovery-pass",
    result: "accepted",
    reasons: [
      "four adults with traceable limb ownership and no extra, fused, floating, or duplicated anatomy",
      "Alia alone handles the inert prop with an indexed trigger finger at a visible abstract geometric route marker",
      "ECE alone wears the rolled original-gradient opaque rainbow hosiery and both heels are fully framed",
      "the covered stance remains stable despite minor rain sheen accepted under the practical threshold",
      "cocoa-estate scenery and large São Tomé motifs are visible",
    ],
    asset: "assets/lore/starlight-era/1338-sao-tome-cocoa-estate-nightlife-paper-target-recovery.png",
  },
  {
    scene: 1339,
    attempt: 1,
    source: "raw",
    result: "rejected-hard-gate",
    reasons: [
      "adult male strongest eye line landed on the woman in red rather than ECE",
      "central contact occlusion left some limb ownership too ambiguous for the male-scene gate",
    ],
    preservedAsset: "tmp/world-195x4/batch-329/raw/1339-principe-praia-banana-male-raw.png",
  },
  {
    scene: 1339,
    attempt: 2,
    source: "single-recovery-pass",
    result: "terminal-rejected-renderer-block",
    reasons: [
      "the single permitted recovery edit was attempted",
      "the renderer blocked the output before a corrected asset was produced",
      "the binding male eye-line and anatomy gates therefore remain unsatisfied",
    ],
  },
];
checkpoint.acceptedAssets = checkpoint.renderAttempts
  .filter((attempt) => attempt.result === "accepted")
  .map((attempt) => attempt.asset);
checkpoint.rejectedAssets = [
  {
    scene: 1339,
    attemptsExhausted: true,
    assets: ["tmp/world-195x4/batch-329/raw/1339-principe-praia-banana-male-raw.png"],
    terminalReason: "male strongest eye line remained away from ECE and recovery output was blocked",
  },
];
checkpoint.queueAdvance = {
  allowed: true,
  reason: "São Tomé and Príncipe has accepted local assets and a terminal checkpoint",
  nextCountry: "Samoa",
  nextBatch: 330,
  nextScenes: [1340, 1341, 1342, 1343],
  nextThemePair: [
    "adult nightlife dance-performance couture",
    "Paris runway model couture",
  ],
};
checkpoint.xPost = {
  status: "pending-publication-after-push",
  caption: checkpoint.xPublishingPlan.captionIfEligible,
  attachmentPolicy: "two accepted São Tomé and Príncipe images plus one accepted Barbados image",
  eligible: true,
  acceptedCurrentCountryCount: checkpoint.acceptedAssets.length,
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`);
console.log(checkpointPath);
