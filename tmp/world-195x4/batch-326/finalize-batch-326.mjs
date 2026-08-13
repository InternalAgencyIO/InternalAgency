import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "../../..");
const preflightPath = path.join(scriptDir, "batch-326-iceland-preflight.json");
const checkpointPath = path.join(
  root,
  "assets/lore/starlight-era/batch-326-iceland-relaxed-audit-checkpoint.json",
);

const checkpoint = JSON.parse(fs.readFileSync(preflightPath, "utf8"));
checkpoint.status = "terminal-partially-accepted-three";
checkpoint.completedAt = new Date().toISOString();
checkpoint.acceptancePolicy = {
  mode: "relaxed-aesthetic-strict-safety",
  hardGates: [
    "correct adult cast and identity roles",
    "exactly eight arms and eight hands, or ten arms and ten hands in the male scene",
    "one visible traceable owner for every limb and hand",
    "deterministic ECE or Alia prop handler",
    "visible safe target line away from people and camera",
    "trigger finger indexed outside the guard",
    "secure opaque public-safe clothing",
    "male strongest eye line to ECE",
    "PAWS separated from prop and unsafe footing",
    "large complete secular Iceland motifs on at least two outfits",
  ],
  softDriftAccepted: [
    "minor contact-placement drift",
    "subtle emotion intensity",
    "compact group spacing",
    "weather spill under shelter",
    "small non-hazardous editorial accessory drift",
  ],
};
checkpoint.renderAttempts = [
  {
    scene: 1324,
    attempt: 1,
    source: "raw",
    result: "blocked-before-asset",
    reasons: ["renderer output moderation returned no image"],
  },
  {
    scene: 1324,
    attempt: 2,
    source: "single-recovery-pass",
    result: "accepted",
    reasons: [
      "four adults with eight separated traceable arms and hands",
      "ECE handler with indexed-finger posture and open-water marker line",
      "Harpa, heavy rain, complete heels, and Iceland motifs visible",
    ],
    asset: "assets/lore/starlight-era/1324-iceland-reykjavik-harpa-covert-agent-harbor-marker-recovery.png",
  },
  {
    scene: 1325,
    attempt: 1,
    source: "raw",
    result: "rejected-hard-gate",
    reasons: ["required paper target was absent from the visible muzzle line"],
    preservedAsset: "tmp/world-195x4/batch-326/raw/1325-raw.png",
  },
  {
    scene: 1325,
    attempt: 2,
    source: "single-recovery-pass",
    result: "accepted",
    reasons: [
      "four adults with eight traceable arms and hands",
      "ECE handler and complete paper-target line visible",
      "PAWS securely held away from the prop",
      "Thingvellir, heat lightning, complete heels, and Iceland motifs visible",
      "minor notebook accessory drift accepted as non-hazardous",
    ],
    asset: "assets/lore/starlight-era/1325-iceland-thingvellir-covert-agent-paper-target-recovery.png",
  },
  {
    scene: 1326,
    attempt: 1,
    source: "raw",
    result: "rejected-hard-gate",
    reasons: ["adult male strongest eye line drifted from ECE"],
    preservedAsset: "tmp/world-195x4/batch-326/raw/1326-raw.png",
  },
  {
    scene: 1326,
    attempt: 2,
    source: "single-recovery-pass",
    result: "terminal-rejected-hard-gate",
    reasons: [
      "adult male eye line was corrected toward ECE",
      "multiple hands remained hidden or ambiguously owned inside the five-person cluster",
      "strict ten-hand anatomy gate could not be verified",
    ],
    preservedAsset: "tmp/world-195x4/batch-326/raw/1326-recovery.png",
  },
  {
    scene: 1327,
    attempt: 1,
    source: "raw",
    result: "accepted",
    reasons: [
      "four adults with eight traceable arms and hands",
      "ECE handler and complete paper-target line visible",
      "Reynisfjara, sea mist, complete heels, and Iceland motifs visible",
      "soft contact and emotion drift accepted",
    ],
    asset: "assets/lore/starlight-era/1327-iceland-reynisfjara-investigator-paper-target.png",
  },
];
checkpoint.acceptedAssets = checkpoint.renderAttempts
  .filter((attempt) => attempt.result === "accepted")
  .map((attempt) => attempt.asset);
checkpoint.rejectedAssets = [
  {
    scene: 1326,
    attemptsExhausted: true,
    assets: [
      "tmp/world-195x4/batch-326/raw/1326-raw.png",
      "tmp/world-195x4/batch-326/raw/1326-recovery.png",
    ],
    terminalReason: "strict ten-hand anatomy gate remained unverifiable",
  },
];
checkpoint.queueAdvance = {
  allowed: true,
  reason: "Iceland has accepted local assets and a terminal checkpoint",
  nextCountry: "Vanuatu",
  nextBatch: 327,
  nextScenes: [1328, 1329, 1330, 1331],
  nextThemePair: [
    "undercover investigator couture",
    "nurse-care couture",
  ],
};
checkpoint.xPost = {
  status: "pending-publication-after-push",
  caption: "Iceland ❤️ Bahamas #Iceland",
  attachmentPolicy: "two accepted Iceland images plus one accepted Bahamas image",
  eligible: true,
  acceptedCurrentCountryCount: 3,
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`);
console.log(checkpointPath);
