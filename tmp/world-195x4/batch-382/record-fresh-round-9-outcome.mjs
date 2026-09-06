import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const checkpointPath = path.join(
  repo,
  "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json",
);
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));

const recoveryAudit = {
  1548: {
    rawOutput: "tmp/world-195x4/batch-382/raw/fresh-round-9-recovery/scene-1548.png",
    sourceRawOutput: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-1484203a-265e-4216-9ce1-b7fadcf76680.png",
    sha256: "BCCE549700D79D828FBBC6AC662EB81E4DF76F5AD6949AF9472F00DD28880A33",
    dimensions: { width: 941, height: 1672 },
    decisiveRejectionReasons: [
      "The recovery preserves unmistakable Tbilisi, hard hail, MAX, four adult identities, distinct country-led couture, all three active midriff bands, eight traceable hands, ECE's center-foreground lunge, a separate route card, the orange disk, and complete transparent backstop.",
      "A visible pink trajectory connector runs from the muzzle to the orange disk, violating the explicit no beam, ray, tracer, laser, path, or trajectory-line gate.",
      "The low linked clasp repeats the Radiance-Ellie pair while Alia's second hand hangs free, so the rolled three-person linked chain and required Ellie-Alia link are not performed.",
    ],
  },
  1551: {
    rawOutput: "tmp/world-195x4/batch-382/raw/fresh-round-9-recovery/scene-1551.png",
    sourceRawOutput: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-8e15ce28-5c2f-4d3d-923d-59e642b364b1.png",
    sha256: "12B6F61C04990A971E47456C01C6C2A6E1691D765EDA27C937D055E78FE6BF62",
    dimensions: { width: 941, height: 1672 },
    decisiveRejectionReasons: [
      "The recovery preserves unmistakable Batumi, heavy rain, distinct PAWS and MAX, Radiance's sole rainbow hosiery and open back, Alia's strapless opaque side coverage and open back, ECE's two-hand compass ownership, and the complete paper-target backstop.",
      "Ellie has only one unambiguous support hand and Radiance has only one unambiguous hand, so the required eight-hand ownership map and caught-hand dip graph remain incomplete.",
      "The separate hands-free blue holographic route map is missing, so ECE's route-strategist roll is not materialized independently from the compass.",
      "Alia has no visible restrained midriff band despite that active roll, and the paper diamond center sits visibly above rather than on the horizontal muzzle axis.",
    ],
  },
};

const completedAt = new Date().toISOString();
checkpoint.status = "active-four-scene-gate-incomplete-after-fresh-round-9";
checkpoint.checkpointedAt = completedAt;
checkpoint.terminal = false;
checkpoint.countryCompletionGate = {
  ...checkpoint.countryCompletionGate,
  acceptedSceneCount: 2,
  missingSceneNumbers: [1548, 1551],
  gitCheckpointPushed: true,
  xPublicStatusVerified: false,
  queueAdvanceAllowed: false,
  gateSatisfied: false,
};
checkpoint.renderAttempts.freshRound9 = {
  ...checkpoint.renderAttempts.freshRound9,
  status: "completed-zero-new-accepted-two-rejected",
  completedAt,
  recovery: {
    ...checkpoint.renderAttempts.freshRound9.recovery,
    status: "completed-zero-new-accepted-two-rejected",
    completedAt,
    perScene: Object.fromEntries(Object.entries(recoveryAudit).map(([scene, value]) => [scene, {
      status: "rejected-strict-visual-audit",
      ...value,
      recoveryPassConsumedThisRound: true,
    }])),
    newlyAcceptedSceneNumbers: [],
    rejectedSceneNumbers: [1548, 1551],
    acceptedSceneNumbersOverall: [1549, 1550],
    laterWakeAction: "Start fresh round 10 for scenes 1548 and 1551 only; preserve accepted scenes 1549 and 1550 and do not advance to Fiji.",
  },
};
checkpoint.rawOutputs = [
  ...checkpoint.rawOutputs.filter((item) => !(item.round === 9 && item.kind === "fresh-recovery-rejected")),
  ...Object.entries(recoveryAudit).map(([scene, value]) => ({
    scene: Number(scene),
    round: 9,
    kind: "fresh-recovery-rejected",
    path: value.rawOutput,
    sourcePath: value.sourceRawOutput,
    sha256: value.sha256,
    dimensions: value.dimensions,
  })),
];
checkpoint.rejectedAssets = [
  ...checkpoint.rejectedAssets.filter((item) => !(item.round === 9 && item.phase === "recovery")),
  ...Object.entries(recoveryAudit).map(([scene, value]) => ({
    scene: Number(scene),
    round: 9,
    phase: "recovery",
    status: "rejected-strict-visual-audit",
    ...value,
    recoveryPassConsumedThisRound: true,
  })),
];
checkpoint.xPost.status = "blocked-active-country-incomplete-not-skipped";
checkpoint.xPost.url = null;
checkpoint.xPost.acceptedCurrentCountryAssets = 2;
checkpoint.xPost.note = "Georgia remains active with accepted scenes 1549 and 1550 preserved. X publication is mandatory only after scenes 1548 and 1551 are accepted and the four-scene completion checkpoint is pushed.";
checkpoint.nextQueueStatus = "locked-on-Georgia-until-four-accepted-git-pushed-and-X-live-verified";
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "fresh-round-10-missing-scenes-only",
  preserveAcceptedSceneNumbers: [1549, 1550],
  sceneNumbers: [1548, 1551],
  laterCountryStartAllowed: false,
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  status: checkpoint.status,
  acceptedSceneNumbers: [1549, 1550],
  missingSceneNumbers: [1548, 1551],
  terminal: checkpoint.terminal,
  nextWakeAction: checkpoint.nextWakeAction,
}, null, 2));
