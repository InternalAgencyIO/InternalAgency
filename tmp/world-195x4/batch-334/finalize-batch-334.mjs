import fs from "node:fs";

const preflightPath = "tmp/world-195x4/batch-334/batch-334-grenada-preflight.json";
const checkpointPath = "assets/lore/starlight-era/batch-334-grenada-private-jet-checkpoint.json";
const preflight = JSON.parse(fs.readFileSync(preflightPath, "utf8"));

const checkpoint = {
  ...preflight,
  status: "terminal-zero-accepted",
  terminalAt: new Date().toISOString(),
  acceptanceGate: {
    anatomy: "strict exact-owner limb and hand audit",
    originality: "distinct silhouette, construction, material, motif technique, hem architecture, and footwear",
    romance: "mandatory hard-love beat must be the first read",
    fusion: "country location and private-jet aviation couture must both read in the foreground",
    prop: "resolved handler, recorded action, safe line, complete target/backstop, and inert cinema prop must all be visible",
  },
  renderAttempts: [
    {
      scene: 1356,
      raw: null,
      rawOutcome: "output-stage moderation block",
      rawRequestId: "db630cad-bfc0-4f58-8242-35c1f0d53d02",
      recovery: "tmp/world-195x4/batch-334/raw/1356-recovery.png",
      recoveryUsed: true,
      result: "rejected",
      audit: "The Carenage dip and country motif work are readable, but the inert cinema prop is replaced by a transparent rectangular object and Alia's above-knee construction is lengthened below the knee.",
    },
    {
      scene: 1357,
      raw: "tmp/world-195x4/batch-334/raw/1357-raw.png",
      rawOutcome: "rendered then visually rejected",
      recovery: null,
      recoveryOutcome: "output-stage moderation block",
      recoveryRequestId: "e7e254da-69bb-46f9-9ec9-728b25f12ecb",
      recoveryUsed: true,
      result: "rejected",
      audit: "The lap romance and outfit separation are strong, but Ellie is positioned partly ahead of Alia's muzzle line. The safety repair produced no file.",
    },
    {
      scene: 1358,
      raw: null,
      rawOutcome: "output-stage moderation block",
      rawRequestId: "2d378c7f-ef75-4ab8-bf62-96f54d6b7219",
      recovery: null,
      recoveryOutcome: "output-stage moderation block",
      recoveryRequestId: "919550b0-ce97-46b5-9032-20fe4dad1f4f",
      recoveryUsed: true,
      result: "rejected",
      audit: "No durable raw or recovery image was emitted.",
    },
    {
      scene: 1359,
      raw: null,
      rawOutcome: "output-stage moderation block",
      rawRequestId: "9934fab5-540e-4873-b606-f2a0e65af6ae",
      recovery: null,
      recoveryOutcome: "output-stage moderation block",
      recoveryRequestId: "89c030fa-360c-46dd-a057-0d213c9b2039",
      recoveryUsed: true,
      result: "rejected",
      audit: "No durable raw or recovery image was emitted.",
    },
  ],
  acceptedAssets: [],
  rejectedAssets: [
    { scene: 1356, reason: "missing recorded mission prop and wrong garment length after recovery" },
    { scene: 1357, reason: "unsafe person crossing the muzzle line; recovery emitted no file" },
    { scene: 1358, reason: "no durable output after raw and recovery attempts" },
    { scene: 1359, reason: "no durable output after raw and recovery attempts" },
  ],
  acceptanceSummary: {
    attemptedScenes: 4,
    acceptedScenes: 0,
    rejectedScenes: 4,
    terminalOutcomeAllowsQueueAdvance: true,
  },
  xPost: {
    status: "deferred-insufficient-accepted-assets",
    requiredAcceptedCurrentCountryAssets: 2,
    availableAcceptedCurrentCountryAssets: 0,
    captionIfAssetsHadQualified: preflight.xPublishingPlan.captionIfEligible,
    reason: "Grenada produced fewer than two accepted current-country assets.",
  },
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
