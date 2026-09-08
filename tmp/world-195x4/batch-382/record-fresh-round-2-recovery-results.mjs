import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const checkpointPath = path.join(
  repo,
  "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json",
);
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
const completedAt = new Date().toISOString();

const perScene = {
  1548: {
    status: "rejected-strict-visual-audit",
    rawOutput: "tmp/world-195x4/batch-382/raw/fresh-round-2-recovery/scene-1548.png",
    sourceRawOutput: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-0902d251-4710-4414-becc-3b6c7bc06abb.png",
    sha256: "7FB8BDCD05C0B28822F6ABBC580C2DB42B30A4CF3C5584D1D61F98E4006E1BDC",
    dimensions: { width: 941, height: 1672 },
    decisiveRejectionReasons: [
      "The recovery fixes the eight-hand dance chain, movement, MAX identity, Tbilisi geography, hail, and outfit differentiation.",
      "The mission-prop muzzle points right over the open river while the orange route marker sits below and outside the visible sight line; the required aligned empty water marker and complete catch wall are not visibly present, so the safety line remains ambiguous and fails the hard gate.",
    ],
    recoveryPassConsumedThisRound: true,
  },
  1549: {
    status: "accepted-strict-visual-audit",
    rawOutput: "tmp/world-195x4/batch-382/raw/fresh-round-2-recovery/scene-1549.png",
    sourceRawOutput: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-9dd4eef8-6d62-4db0-952f-23958671ddf1.png",
    acceptedAsset: "1549-georgia-stepantsminda-mars-surface-expedition-round-2-recovery.png",
    sha256: "A3C1E18F6FDC393A36AAABA56394CA4C12EBD83F3646FD58BF227438EC251C99",
    dimensions: { width: 941, height: 1672 },
    audit: {
      coreCast: "Exactly four clearly adult fictional women are present with distinct anchored identities; Alia alone retains the high sculptural braided ponytail.",
      anatomy: "Exactly eight human arms and eight human hands are visibly owned: two on ECE's inert training prop, two supporting the dip by Alia, two owned by dipped Ellie, and two owned by Radiance, with no extra or fused limb cluster.",
      activeRolls: "Soft overcast, neither mascot, no odd prop, no pole, no rainbow-only styling, no hosiery, Radiance/Ellie/ECE midriff cuts, and Ellie/ECE open-back panels are visibly resolved.",
      romance: "The controlled dip, linked-hand choice, protective back support, and ECE's separate invitation create the required first-read adult consensual love beat with more than three clear contacts.",
      missionProp: "ECE alone uses the full-size polished rainbow-gradient inert cinema-training replica in a right-facing two-hand stance; the trigger finger reads indexed outside the guard and the uninterrupted line terminates at a plain paper route symbol on a complete earth backstop behind transparent panels, with every person behind the muzzle plane.",
      themeLocation: "Mount Kazbek, the Terek valley, Darial cliffs, town roofs, and four distinct country-led Mars-expedition couture fingerprints read together without replacing Georgia with a theme landscape.",
      mascotsAndProps: "No mascot or odd prop appears, matching both inactive rolls.",
      decision: "Accepted with no hard-gate deviation.",
    },
    recoveryPassConsumedThisRound: true,
  },
  1550: {
    status: "rejected-strict-visual-audit",
    rawOutput: "tmp/world-195x4/batch-382/raw/fresh-round-2-recovery/scene-1550.png",
    sourceRawOutput: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-bb0caf89-9bb5-4d9b-9800-7cad17344863.png",
    sha256: "A69E02A4B6B6764293A21CBC464BF9B660DA3FAA4C3899615E9DF3AF0B7D6426",
    dimensions: { width: 941, height: 1672 },
    decisiveRejectionReasons: [
      "The recovery fixes the three-piece secured geometric balloon pack, Sighnaghi geography, aurora, five-person cast, male-to-ECE contacts, and right-facing water-marker lane.",
      "The exact love-beat hand graph is not materialized: Ellie's linked-hand choice and sitter-shoulder contact are absent or ambiguous while Alia's contacts remain concentrated on Radiance, so the mandatory contact ownership gate fails.",
    ],
    recoveryPassConsumedThisRound: true,
  },
  1551: {
    status: "rejected-strict-visual-audit",
    rawOutput: "tmp/world-195x4/batch-382/raw/fresh-round-2-recovery/scene-1551.png",
    sourceRawOutput: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-5c62afe4-d8df-4107-9628-f65110f94b2a.png",
    sha256: "529E99E579E76EA29682C565418CE0FBD0B843023C993C148F099C0C34E08CF7",
    dimensions: { width: 941, height: 1672 },
    decisiveRejectionReasons: [
      "The recovery fixes Alia's strapless cut, the distinct golden kitten and golden retriever puppy, Batumi geography, rainbow hosiery, compass table, rain, and isolated paper-target lane.",
      "The controlled-dip hand graph still fails: Ellie's required upper-back support hand is replaced by a contact toward ECE and Radiance's two prescribed contact hands are not both continuously traceable, leaving the exact eight-hand ownership gate ambiguous.",
    ],
    recoveryPassConsumedThisRound: true,
  },
};

checkpoint.status = "active-four-scene-gate-incomplete-after-fresh-round-2";
checkpoint.checkpointedAt = completedAt;
checkpoint.terminal = false;
checkpoint.countryCompletionGate = {
  ...checkpoint.countryCompletionGate,
  acceptedSceneCount: 1,
  missingSceneNumbers: [1548, 1550, 1551],
  gitCheckpointPushed: true,
  xPublicStatusVerified: false,
  queueAdvanceAllowed: false,
  gateSatisfied: false,
};
checkpoint.renderAttempts.freshRound2 = {
  ...checkpoint.renderAttempts.freshRound2,
  status: "completed-one-accepted-three-missing",
  completedAt,
  recovery: {
    ...checkpoint.renderAttempts.freshRound2.recovery,
    status: "completed-one-accepted-three-rejected",
    completedAt,
    perScene,
    acceptedSceneNumbers: [1549],
    rejectedSceneNumbers: [1548, 1550, 1551],
    laterWakeAction: "Start fresh round 3 for scenes 1548, 1550, and 1551 only; preserve accepted scene 1549 and do not advance to Fiji.",
  },
};

checkpoint.rawOutputs = [
  ...checkpoint.rawOutputs.filter((item) => !(item.round === 2 && item.phase === "recovery")),
  ...Object.entries(perScene).map(([scene, value]) => ({
    scene: Number(scene),
    round: 2,
    phase: "recovery",
    kind: value.status.startsWith("accepted") ? "recovery-raw-accepted" : "recovery-raw-rejected",
    path: value.rawOutput,
    sourcePath: value.sourceRawOutput,
    sha256: value.sha256,
    dimensions: value.dimensions,
  })),
];
checkpoint.acceptedAssets = [
  ...checkpoint.acceptedAssets.filter((item) => item.scene !== 1549),
  {
    scene: 1549,
    file: perScene[1549].acceptedAsset,
    decision: "accepted-fresh-round-2-recovery",
    sourceRaw: perScene[1549].sourceRawOutput,
    sha256: perScene[1549].sha256,
    dimensions: perScene[1549].dimensions,
    acceptedAt: completedAt,
    audit: perScene[1549].audit,
  },
];
checkpoint.rejectedAssets = [
  ...checkpoint.rejectedAssets.filter((item) => !(item.round === 2 && item.phase === "recovery")),
  ...[1548, 1550, 1551].map((scene) => ({
    scene,
    round: 2,
    phase: "recovery",
    status: perScene[scene].status,
    rawOutput: perScene[scene].rawOutput,
    sourceRawOutput: perScene[scene].sourceRawOutput,
    sha256: perScene[scene].sha256,
    dimensions: perScene[scene].dimensions,
    decisiveRejectionReasons: perScene[scene].decisiveRejectionReasons,
    recoveryPassConsumedThisRound: true,
  })),
];
checkpoint.xPost = {
  ...checkpoint.xPost,
  status: "blocked-active-country-incomplete-not-skipped",
  acceptedCurrentCountryAssets: 1,
  requiredCurrentCountryAssets: 4,
  url: null,
  note: "Georgia remains active with accepted scene 1549 preserved. X publication is mandatory immediately after scenes 1548, 1550, and 1551 are accepted and the four-scene completion checkpoint is pushed.",
};
checkpoint.nextQueueStatus = "locked-on-Georgia-until-four-accepted-git-pushed-and-X-live-verified";
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "fresh-round-3-missing-scenes-only",
  preserveAcceptedSceneNumbers: [1549],
  sceneNumbers: [1548, 1550, 1551],
  laterCountryStartAllowed: false,
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(checkpointPath);
