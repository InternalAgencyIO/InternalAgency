import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "../../..");
const preflightPath = path.join(scriptDir, "batch-330-samoa-preflight.json");
const checkpointPath = path.join(
  root,
  "assets/lore/starlight-era/batch-330-samoa-relaxed-audit-checkpoint.json",
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
    "large complete secular Samoa motifs on at least two outfits",
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
    scene: 1340,
    attempt: 1,
    source: "raw",
    result: "rejected-hard-gate",
    reasons: [
      "rolled empty harbor marker was absent from the visible muzzle line",
      "adult male strongest eye line landed on the central pair rather than ECE",
    ],
    preservedAsset: "tmp/world-195x4/batch-330/raw/1340-samoa-apia-male-raw.png",
  },
  {
    scene: 1340,
    attempt: 2,
    source: "single-recovery-pass",
    result: "terminal-rejected-hard-gate",
    reasons: [
      "the empty floating harbor marker and dry footing were corrected",
      "adult male strongest eye line still landed on the central pair rather than unmistakably on ECE",
      "the binding male relationship gate remained unsatisfied",
    ],
    preservedAsset: "tmp/world-195x4/batch-330/recovery/1340-samoa-apia-male-recovery.png",
  },
  {
    scene: 1341,
    attempt: 1,
    source: "raw",
    result: "accepted",
    reasons: [
      "four adults with traceable limb ownership and no extra, fused, floating, or duplicated anatomy",
      "ECE alone actively handles the inert prop in the completed wrist-guidance lesson with an indexed trigger finger and visible empty geometric target line",
      "PAWS is securely held far from the prop and muzzle line",
      "To Sua, complete heels, and large Samoa motifs are visible",
      "ordinary hand overlap is accepted under the practical threshold because ownership remains traceable",
    ],
    asset: "assets/lore/starlight-era/1341-samoa-to-sua-nightlife-wrist-guidance-paws.png",
  },
  {
    scene: 1342,
    attempt: 1,
    source: "raw",
    result: "rejected-hard-gate",
    reasons: [
      "rolled abstract paper route marker and safety backstop were absent from the visible muzzle line",
      "covered footing read wet rather than dry",
    ],
    preservedAsset: "tmp/world-195x4/batch-330/raw/1342-samoa-alofaaga-raw.png",
  },
  {
    scene: 1342,
    attempt: 2,
    source: "single-recovery-pass",
    result: "accepted",
    reasons: [
      "four adults with traceable limb ownership and no extra, fused, floating, or duplicated anatomy",
      "Alia alone handles the inert prop with an indexed trigger finger at a visible abstract geometric route marker and complete backstop",
      "ECE alone wears the rolled Samoa-palette opaque rainbow knee socks",
      "PAWS is securely held far from the prop and muzzle line",
      "Alofaaga plumes, ochre mist wall, dry footing, complete heels, and large Samoa motifs are visible",
    ],
    asset: "assets/lore/starlight-era/1342-samoa-alofaaga-runway-paper-target-recovery.png",
  },
  {
    scene: 1343,
    attempt: 1,
    source: "raw",
    result: "accepted",
    reasons: [
      "four adults with traceable limb ownership and no extra, fused, floating, or duplicated anatomy",
      "ECE alone actively handles the inert prop during safe behind-the-shoulder wrist guidance with an indexed trigger finger and visible empty geometric target line",
      "Lalomanu, distant rain veil, complete heels, and large Samoa motifs are visible",
      "ordinary affectionate hand overlap is accepted under the practical threshold because ownership remains traceable",
    ],
    asset: "assets/lore/starlight-era/1343-samoa-lalomanu-runway-wrist-guidance.png",
  },
];
checkpoint.acceptedAssets = checkpoint.renderAttempts
  .filter((attempt) => attempt.result === "accepted")
  .map((attempt) => attempt.asset);
checkpoint.rejectedAssets = [
  {
    scene: 1340,
    attemptsExhausted: true,
    assets: [
      "tmp/world-195x4/batch-330/raw/1340-samoa-apia-male-raw.png",
      "tmp/world-195x4/batch-330/recovery/1340-samoa-apia-male-recovery.png",
    ],
    terminalReason: "adult male strongest eye line remained away from ECE",
  },
];
checkpoint.queueAdvance = {
  allowed: true,
  reason: "Samoa has accepted local assets and a terminal checkpoint",
  nextCountry: "Saint Lucia",
  nextBatch: 331,
  nextScenes: [1344, 1345, 1346, 1347],
  nextThemePair: ["Paris runway model couture", "cleaner and service couture"],
};
checkpoint.xPost = {
  status: "pending-publication-after-push",
  caption: checkpoint.xPublishingPlan.captionIfEligible,
  attachmentPolicy: "two accepted Samoa images plus one accepted São Tomé and Príncipe image",
  eligible: true,
  acceptedCurrentCountryCount: checkpoint.acceptedAssets.length,
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`);
console.log(checkpointPath);
