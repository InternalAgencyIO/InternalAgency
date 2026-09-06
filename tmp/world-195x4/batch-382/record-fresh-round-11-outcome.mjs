import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const checkpointPath = path.join(repo, "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json");
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
const completedAt = new Date().toISOString();

const accepted1548 = {
  scene: 1548,
  file: "1548-georgia-tbilisi-mars-surface-expedition-round-11-recovery.png",
  decision: "accepted-fresh-round-11-recovery",
  sourceRaw: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-20161aa1-d4ac-4b1a-965e-401d753b8058.png",
  sha256: "E134A6BF66004C33FBD862ECD8B4EF58B15C0CCAFB5011C426461DDC11747738",
  dimensions: { width: 941, height: 1672 },
  acceptedAt: completedAt,
  audit: {
    coreCast: "Exactly four clearly adult fictional women appear with distinct anchored identities; Alia alone retains the high sculptural braided ponytail.",
    anatomy: "Exactly eight human arms and eight human hands are owned: two ECE mission hands, one raised Radiance-Ellie clasp, one low Alia-Ellie clasp, Radiance's palm on Alia's shoulder, and Alia's dark hand and forearm wrapping Radiance's waist.",
    activeRolls: "Hard hail, MAX only, no odd prop, no pole, no rainbow-only styling, no hosiery, and separate restrained midriff bands on Radiance, Ellie, and Alia all resolve visibly; ECE remains waist-covered.",
    romance: "The raised and low linked hands, shoulder invitation, behind-waist embrace, aligned trio eye lines, and ECE's center-right interruption visibly perform the stored three-person slow-dance split with four clear contacts.",
    missionProp: "ECE alone holds the full-size polished rainbow-gradient inert cinema-training pistol replica with two hands and an indexed trigger finger; the short down-right sight picture ends at the orange disk in empty water before a complete transparent backstop, with no tracer or occupied object downrange.",
    themeLocation: "The Peace Bridge, Mtkvari, Old Town balconies, Narikala ridge, sulfur-bath forms, hail, and four distinct country-led Mars-expedition couture fingerprints read together without replacing Georgia with a theme location.",
    mascotsAndProps: "Exactly one small young golden retriever puppy MAX rests on a padded dry lounge far from the prop lane, river, and hazards; no kitten or odd prop appears.",
    decision: "Accepted with no hard-gate deviation.",
  },
};

const rejected1551 = {
  rawOutput: "tmp/world-195x4/batch-382/raw/fresh-round-11-recovery/scene-1551.png",
  sourceRawOutput: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-ff64766a-1615-49cc-9c7f-6b1e7e93a0f6.png",
  sha256: "ED4C22E0795AD65A2225A65D77AD9FDDC33A7E119F6DA2AF1744BFE3BE191172",
  dimensions: { width: 941, height: 1672 },
  decisiveRejectionReasons: [
    "The recovery preserves four adult identities, Batumi, heavy rain, PAWS and MAX, distinct outfits, Radiance's sole rainbow hosiery and open back, Alia's strapless opaque front and open back, Alia's now-visible restrained midriff band, the route map, compass, complete backstop, safe mission stance, and exactly eight traceable hands.",
    "The paper diamond center remains visibly above the horizontal barrel and orange muzzle-plug centerline, so the authoritative paper-route target geometry fails.",
  ],
};

checkpoint.status = "active-four-scene-gate-incomplete-after-fresh-round-11";
checkpoint.checkpointedAt = completedAt;
checkpoint.terminal = false;
checkpoint.countryCompletionGate = {
  ...checkpoint.countryCompletionGate,
  acceptedSceneCount: 3,
  missingSceneNumbers: [1551],
  gitCheckpointPushed: true,
  xPublicStatusVerified: false,
  queueAdvanceAllowed: false,
  gateSatisfied: false,
};
checkpoint.renderAttempts.freshRound11 = {
  ...checkpoint.renderAttempts.freshRound11,
  status: "completed-one-new-accepted-one-rejected",
  completedAt,
  recovery: {
    ...checkpoint.renderAttempts.freshRound11.recovery,
    status: "completed-one-new-accepted-one-rejected",
    completedAt,
    perScene: {
      1548: {
        status: "accepted-strict-visual-audit",
        rawOutput: "tmp/world-195x4/batch-382/raw/fresh-round-11-recovery/scene-1548.png",
        sourceRawOutput: accepted1548.sourceRaw,
        sha256: accepted1548.sha256,
        dimensions: accepted1548.dimensions,
        loreAsset: accepted1548.file,
        recoveryPassConsumedThisRound: true,
      },
      1551: {
        status: "rejected-strict-visual-audit",
        ...rejected1551,
        recoveryPassConsumedThisRound: true,
      },
    },
    newlyAcceptedSceneNumbers: [1548],
    rejectedSceneNumbers: [1551],
    acceptedSceneNumbersOverall: [1548, 1549, 1550],
    laterWakeAction: "Start fresh round 12 for scene 1551 only; preserve accepted scenes 1548, 1549, and 1550 and do not advance to Fiji.",
  },
};
checkpoint.acceptedAssets = [
  ...checkpoint.acceptedAssets.filter((item) => item.scene !== 1548),
  accepted1548,
].sort((a, b) => a.scene - b.scene);
checkpoint.rawOutputs = [
  ...checkpoint.rawOutputs.filter((item) => !(item.round === 11 && item.kind?.startsWith("fresh-recovery"))),
  {
    scene: 1548, round: 11, kind: "fresh-recovery-accepted",
    path: "tmp/world-195x4/batch-382/raw/fresh-round-11-recovery/scene-1548.png",
    sourcePath: accepted1548.sourceRaw, sha256: accepted1548.sha256, dimensions: accepted1548.dimensions,
  },
  {
    scene: 1551, round: 11, kind: "fresh-recovery-rejected",
    path: rejected1551.rawOutput, sourcePath: rejected1551.sourceRawOutput,
    sha256: rejected1551.sha256, dimensions: rejected1551.dimensions,
  },
];
checkpoint.rejectedAssets = [
  ...checkpoint.rejectedAssets.filter((item) => !(item.scene === 1548 && item.round === 11) && !(item.scene === 1551 && item.round === 11 && item.phase === "recovery")),
  {
    scene: 1551, round: 11, phase: "recovery", status: "rejected-strict-visual-audit",
    ...rejected1551, recoveryPassConsumedThisRound: true,
  },
];
checkpoint.xPost.status = "blocked-active-country-incomplete-not-skipped";
checkpoint.xPost.url = null;
checkpoint.xPost.acceptedCurrentCountryAssets = 3;
checkpoint.xPost.note = "Georgia has accepted scenes 1548, 1549, and 1550. Historical X backlog is empty. Publication remains mandatory immediately after scene 1551 is accepted and the four-scene completion checkpoint is pushed.";
checkpoint.nextQueueStatus = "locked-on-Georgia-until-four-accepted-git-pushed-and-X-live-verified";
checkpoint.nextWakeAction = {
  country: "Georgia", batch: 382, action: "fresh-round-12-missing-scene-only",
  preserveAcceptedSceneNumbers: [1548, 1549, 1550], sceneNumbers: [1551], laterCountryStartAllowed: false,
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  status: checkpoint.status,
  acceptedSceneNumbers: [1548, 1549, 1550],
  missingSceneNumbers: [1551],
  terminal: checkpoint.terminal,
  xAcceptedAssets: checkpoint.xPost.acceptedCurrentCountryAssets,
  nextWakeAction: checkpoint.nextWakeAction,
}, null, 2));
