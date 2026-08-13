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
    status: "rejected-output-moderation-no-raw",
    rawOutput: null,
    moderationCategories: ["sexual"],
    requestId: "36ea6a8f-a516-496a-b3bb-addd41e0ec49",
    recoveryPassConsumedThisRound: true,
  },
  1549: {
    status: "rejected-output-moderation-no-raw",
    rawOutput: null,
    moderationCategories: ["violence", "sexual"],
    requestId: "3a17c36b-3f6a-4f4a-82e1-0a2f21d887ea",
    recoveryPassConsumedThisRound: true,
  },
  1550: {
    status: "rejected-strict-visual-audit",
    rawOutput: "tmp/world-195x4/batch-382/raw/recovery-round-1/scene-1550.png",
    sourceRawOutput: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-774d0075-d594-4da4-99a5-338146986187.png",
    sha256: "F09EB669BCCA2CC7E5AA2C7F319779837C90ADD8467A41CAFD4F38361DA1C8F2",
    dimensions: { width: 941, height: 1672 },
    decisiveRejectionReasons: [
      "The inert mission-prop muzzle line points left across the occupied romance group instead of terminating at the clearly empty blue water marker and complete safe backstop.",
      "The unsafe occupied line fails the mission-prop acceptance gate even though the five adults, Sighnaghi landmarks, aurora, male drama, and geometric balloon pack are visible.",
    ],
    recoveryPassConsumedThisRound: true,
  },
  1551: {
    status: "rejected-strict-visual-audit",
    rawOutput: "tmp/world-195x4/batch-382/raw/recovery-round-1/scene-1551.png",
    sourceRawOutput: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-644df9dc-a5cc-44eb-9ea1-b130a9436ea1.png",
    sha256: "BCF0D3FFABD1478080B57143AB2D1FEA81C9CA74F9076DE93597AB870797597F",
    dimensions: { width: 941, height: 1672 },
    decisiveRejectionReasons: [
      "The required PAWS-plus-MAX state is malformed: the render shows one adult golden retriever and one black-and-tan dog instead of a tiny collarless golden kitten and a distinct small young golden retriever pup.",
      "Mascot identity is a hard gate even though Batumi landmarks, heavy rain, Radiance rainbow hosiery, the controlled dip, magnetic compass table, and isolated paper-target line are visible.",
    ],
    recoveryPassConsumedThisRound: true,
  },
};

checkpoint.status = "active-four-scene-gate-incomplete-after-round-1";
checkpoint.checkpointedAt = completedAt;
checkpoint.terminal = false;
checkpoint.countryCompletionGate = {
  ...checkpoint.countryCompletionGate,
  acceptedSceneCount: 0,
  missingSceneNumbers: [1548, 1549, 1550, 1551],
  gitCheckpointPushed: true,
  xPublicStatusVerified: false,
  queueAdvanceAllowed: false,
  gateSatisfied: false,
};
checkpoint.renderAttempts.recovery = {
  ...checkpoint.renderAttempts.recovery,
  status: "completed-zero-accepted",
  completedAt,
  perScene,
  acceptedSceneNumbers: [],
  rejectedSceneNumbers: [1548, 1549, 1550, 1551],
  laterWakeAction: "Start a fresh recovery round for the same Georgia batch; do not advance to Fiji.",
};
checkpoint.rawOutputs = [
  {
    scene: 1550,
    round: 1,
    kind: "recovery-raw-rejected",
    path: perScene[1550].rawOutput,
    sourcePath: perScene[1550].sourceRawOutput,
    sha256: perScene[1550].sha256,
    dimensions: perScene[1550].dimensions,
  },
  {
    scene: 1551,
    round: 1,
    kind: "recovery-raw-rejected",
    path: perScene[1551].rawOutput,
    sourcePath: perScene[1551].sourceRawOutput,
    sha256: perScene[1551].sha256,
    dimensions: perScene[1551].dimensions,
  },
];
checkpoint.acceptedAssets = [];
checkpoint.rejectedAssets = Object.entries(perScene).map(([scene, result]) => ({
  scene: Number(scene),
  ...result,
}));
checkpoint.xPost = {
  ...checkpoint.xPost,
  status: "blocked-active-country-incomplete-not-skipped",
  acceptedCurrentCountryAssets: 0,
  requiredCurrentCountryAssets: 4,
  url: null,
  note: "Georgia remains active. X is not terminally deferred; posting is mandatory immediately after all four accepted assets and the pushed completion checkpoint exist.",
};
checkpoint.nextQueueStatus = "locked-on-Georgia-until-four-accepted-git-pushed-and-X-live-verified";
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "fresh-recovery-round",
  sceneNumbers: [1548, 1549, 1550, 1551],
  laterCountryStartAllowed: false,
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(checkpointPath);
