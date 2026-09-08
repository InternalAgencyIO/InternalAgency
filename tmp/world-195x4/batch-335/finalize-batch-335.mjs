import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const preflightPath = path.join(
  root,
  "tmp/world-195x4/batch-335/batch-335-micronesia-preflight.json",
);
const checkpointPath = path.join(
  root,
  "assets/lore/starlight-era/batch-335-micronesia-helicopter-checkpoint.json",
);

const checkpoint = JSON.parse(fs.readFileSync(preflightPath, "utf8"));

checkpoint.status = "terminal-zero-accepted";
checkpoint.renderAttempts = [
  {
    scene: 1360,
    raw: "tmp/world-195x4/batch-335/raw/1360-micronesia-nan-madol-raw.png",
    rawOutcome: "rendered then visually rejected",
    recovery: "tmp/world-195x4/batch-335/recovery/1360-micronesia-recovery.png",
    recoveryUsed: true,
    result: "rejected",
    audit:
      "The recovery foregrounds both Nan Madol and the civilian helicopter, preserves PAWS, the telescope and Radiance hosiery, but it does not perform the stored seated-to-standing support graph. ECE supports Ellie instead of Radiance, one ECE hand is hidden, and the exact eight-hand ownership graph is not continuously traceable.",
  },
  {
    scene: 1361,
    raw: "tmp/world-195x4/batch-335/raw/1361-micronesia-lelu-kosrae-raw.png",
    rawOutcome: "rendered then visually rejected",
    recovery: "tmp/world-195x4/batch-335/recovery/1361-micronesia-recovery.png",
    recoveryUsed: true,
    result: "rejected",
    audit:
      "The recovery gives Lelu, the helicopter and the controlled dip equal foreground weight, with distinct outfits and a safe open-water line, but Alia's far arm and hand disappear behind Radiance during the dip. The exact eight-arm and eight-hand anatomy gate therefore fails.",
  },
  {
    scene: 1362,
    raw: null,
    rawOutcome: "output-stage moderation block",
    rawRequestId: "89641088-7591-4767-af13-0772770d029b",
    recovery: "tmp/world-195x4/batch-335/recovery/1362-micronesia-recovery.png",
    recoveryUsed: true,
    result: "rejected",
    audit:
      "The recovery renders Chuuk Lagoon, the civilian helicopter, five adults, PAWS and MAX, and a strong controlled dip, but the inert-prop line crosses the blonde and male instead of reaching the isolated backstop. The male's strongest eye line remains on Ellie rather than ECE, so both the prop-safety and male-story gates fail.",
  },
  {
    scene: 1363,
    raw: null,
    rawOutcome: "output-stage moderation block",
    rawRequestId: "5662e017-ca4b-49cf-8ccd-d5c6535c7d37",
    recovery: "tmp/world-195x4/batch-335/recovery/1363-micronesia-recovery.png",
    recoveryUsed: true,
    result: "rejected",
    audit:
      "The recovery renders Yap's rai-stone path, the civilian helicopter, all four distinct outfits, PAWS and MAX, and an eight-hand contact chain, but ECE's inert-prop line crosses the three-person dance group instead of the isolated paper target. The prop-safety gate fails.",
  },
];
checkpoint.acceptedAssets = [];
checkpoint.rejectedAssets = [
  {
    scene: 1360,
    reason: "stored seated-assist hand graph missing and one hand has hidden ownership after recovery",
  },
  {
    scene: 1361,
    reason: "one arm and hand are hidden through the controlled dip after recovery",
  },
  {
    scene: 1362,
    reason: "unsafe person-crossing prop line and male eye line does not select ECE after recovery",
  },
  {
    scene: 1363,
    reason: "unsafe prop line crosses the three-person dance group after recovery",
  },
];
checkpoint.xPost = {
  status: "deferred-insufficient-accepted-assets",
  requiredAcceptedCurrentCountryAssets: 2,
  availableAcceptedCurrentCountryAssets: 0,
  captionIfAssetsHadQualified: checkpoint.xPublishingPlan.captionIfEligible,
  reason: "Micronesia produced fewer than two accepted current-country assets.",
};
checkpoint.terminalAt = new Date().toISOString();
checkpoint.acceptanceGate = {
  anatomy: "strict exact-owner limb and hand audit",
  originality:
    "distinct silhouette, construction, material, motif technique, hem architecture, and footwear",
  romance: "mandatory hard-love beat and stored contact graph must be the first read",
  fusion:
    "Micronesia location and civilian-helicopter flight couture must both read in the foreground",
  prop:
    "resolved handler, recorded action, isolated safe line, complete target or backstop, and inert cinema prop must all be visible",
};
checkpoint.acceptanceSummary = {
  attemptedScenes: 4,
  acceptedScenes: 0,
  rejectedScenes: 4,
  terminalOutcomeAllowsQueueAdvance: true,
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`);
console.log(checkpointPath);
