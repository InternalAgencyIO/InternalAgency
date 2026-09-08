import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "../../..");
const preflightPath = path.join(scriptDir, "batch-325-bahamas-preflight.json");
const checkpointPath = path.join(
  root,
  "assets/lore/starlight-era/batch-325-bahamas-relaxed-audit-checkpoint.json",
);

const checkpoint = JSON.parse(fs.readFileSync(preflightPath, "utf8"));
checkpoint.status = "terminal-accepted-all-four";
checkpoint.completedAt = new Date().toISOString();
checkpoint.acceptancePolicy = {
  mode: "relaxed-aesthetic-strict-safety",
  hardGates: [
    "correct adult cast and identity roles",
    "exactly eight arms and eight hands, or ten arms and ten hands in the male scene",
    "one traceable owner for every limb and hand",
    "deterministic ECE or Alia prop handler",
    "visible safe target line away from people and camera",
    "trigger finger indexed outside the guard",
    "secure opaque public-safe clothing",
    "male strongest eye line to ECE",
    "PAWS separated from prop and unsafe footing",
    "large complete secular Bahamas motifs on at least two outfits",
  ],
  softDriftAccepted: [
    "minor contact-placement drift",
    "subtle emotion intensity",
    "compact group spacing",
    "weather spill under shelter",
  ],
};
checkpoint.renderAttempts = [
  {
    scene: 1320,
    attempt: 1,
    source: "raw",
    result: "rejected-hard-gate",
    reasons: [
      "paper target absent from the visible muzzle line",
      "adult male strongest eye line drifted from ECE",
    ],
    preservedAsset: "tmp/world-195x4/batch-325/raw/1320-raw.png",
  },
  {
    scene: 1320,
    attempt: 2,
    source: "single-recovery-pass",
    result: "accepted",
    reasons: [
      "five adults with ten traceable arms and hands",
      "ECE two-hand stance and indexed-finger posture",
      "paper target and isolated downrange line visible",
      "adult male strongest eye line to ECE",
      "PAWS securely cradled away from the prop",
    ],
    asset: "assets/lore/starlight-era/1320-bahamas-eleuthera-glass-window-bridge-cleaner-service-paper-target-recovery.png",
  },
  {
    scene: 1321,
    attempt: 1,
    source: "raw",
    result: "accepted",
    reasons: [
      "four adults with eight traceable arms and hands",
      "ECE handler and visible paper target line",
      "secure public-safe outfits and complete Bahamas motifs",
      "soft contact and emotion drift accepted",
    ],
    asset: "assets/lore/starlight-era/1321-bahamas-exuma-cays-cleaner-service-paper-target.png",
  },
  {
    scene: 1322,
    attempt: 1,
    source: "raw",
    result: "accepted",
    reasons: [
      "four adults with eight traceable arms and hands",
      "ECE handler and visible paper target line",
      "rain rendered with stable footing",
      "soft contact and emotion drift accepted",
    ],
    asset: "assets/lore/starlight-era/1322-bahamas-andros-blue-holes-covert-agent-paper-target.png",
  },
  {
    scene: 1323,
    attempt: 1,
    source: "raw",
    result: "accepted",
    reasons: [
      "four adults with eight traceable arms and hands",
      "ECE handler with Alia wrist guidance and visible paper target line",
      "secure public-safe outfits and complete Bahamas motifs",
      "soft contact and emotion drift accepted",
    ],
    asset: "assets/lore/starlight-era/1323-bahamas-gold-rock-beach-covert-agent-wrist-guidance.png",
  },
];
checkpoint.acceptedAssets = checkpoint.renderAttempts
  .filter((attempt) => attempt.result === "accepted")
  .map((attempt) => attempt.asset);
checkpoint.rejectedAssets = [
  {
    scene: 1320,
    asset: "tmp/world-195x4/batch-325/raw/1320-raw.png",
    terminal: false,
    recoveredBy: checkpoint.acceptedAssets[0],
  },
];
checkpoint.queueAdvance = {
  allowed: true,
  reason: "Bahamas has accepted local assets and a terminal checkpoint",
  nextCountry: "Iceland",
  nextBatch: 326,
  nextScenes: [1324, 1325, 1326, 1327],
  nextThemePair: [
    "cinematic covert-agent crew couture",
    "undercover investigator couture",
  ],
};
checkpoint.xPost = {
  status: "pending-publication-after-push",
  caption: "Bahamas 🤍 Belize #Bahamas #InternalAgency",
  attachmentPolicy: "two accepted Bahamas images plus one accepted Belize image",
  eligible: true,
  acceptedCurrentCountryCount: 4,
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`);
console.log(checkpointPath);
