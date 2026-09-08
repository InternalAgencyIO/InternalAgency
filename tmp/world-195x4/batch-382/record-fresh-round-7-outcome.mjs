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
    rawOutput: "tmp/world-195x4/batch-382/raw/fresh-round-7-recovery/scene-1548.png",
    sourceRawOutput: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-ca3d1f92-f30f-4966-84f8-5b3e38fcd14f.png",
    sha256: "CE83FFA9EFBBFAF1F80CAFAD81EFE117A7D447FD3EF8B8392426B95E66E8F3B2",
    dimensions: { width: 941, height: 1672 },
    decisiveRejectionReasons: [
      "The edit preserves unmistakable Tbilisi, hard hail, MAX, four adult identities, distinct couture, a separate route card, the compact pistol, and improved disk alignment with no rendered connector.",
      "ECE's left hand is reassigned to a link with Ellie while only her right hand owns the pistol, violating the mandatory two-hand mission stance and the stored six-hand dance ownership graph.",
      "ECE remains on the outer right edge rather than visibly crossing through the open side to split the pair, so the rolled moving interruption is still weak.",
    ],
  },
  1550: {
    rawOutput: "tmp/world-195x4/batch-382/raw/fresh-round-7-recovery/scene-1550.png",
    sourceRawOutput: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-ed2a4159-d3fb-4896-b447-5c80993335c9.png",
    sha256: "5ECDA744D88DA7CF9ED83D08BBECF1DAB12C859444D40AC698A7122BCCA416E8",
    dimensions: { width: 941, height: 1672 },
    decisiveRejectionReasons: [
      "The edit preserves unmistakable Sighnaghi, aurora, five adults, exactly three balloons, Radiance's two-handle ownership, the lap seat, linked affection, ten traceable hands, male contacts and ECE eye line, the separate route card, ECE's two-hand pistol, and the empty basin disk.",
      "The rotated muzzle still extends down-right past the basin while the orange disk remains below-left and behind the muzzle plane, so it is not the visible endpoint of the stored sight picture.",
    ],
  },
  1551: {
    rawOutput: "tmp/world-195x4/batch-382/raw/fresh-round-7-recovery/scene-1551.png",
    sourceRawOutput: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-3afd3b66-c94c-417a-8dd6-7fef29e03642.png",
    sha256: "86D7678F2DF6940FF089BCA0BD77AA045E15D3D7AA736B1834CE839389811842",
    dimensions: { width: 941, height: 1672 },
    decisiveRejectionReasons: [
      "The edit preserves unmistakable Batumi, heavy rain, distinct PAWS and MAX, Radiance's sole rainbow socks and open back, four distinct silhouettes, the shallow dip with both separated Ellie support palms and eight traceable hands, ECE's two compass hands, Alia's two mission-prop hands, and excellent paper-target alignment against a complete sand backstop.",
      "The close crop shows Alia's trigger index curled into the guard rather than straight along the frame, failing the non-negotiable handling gate.",
      "Alia's active strapless and fully-open-back rolls are not materialized: a connected halter collar and horizontal back band remain visible.",
    ],
  },
};

const completedAt = new Date().toISOString();
checkpoint.status = "active-four-scene-gate-incomplete-after-fresh-round-7";
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
checkpoint.renderAttempts.freshRound7 = {
  ...checkpoint.renderAttempts.freshRound7,
  status: "completed-zero-new-accepted-three-rejected",
  completedAt,
  recovery: {
    ...checkpoint.renderAttempts.freshRound7.recovery,
    status: "completed-zero-new-accepted-three-rejected",
    completedAt,
    perScene: Object.fromEntries(Object.entries(recoveryAudit).map(([scene, value]) => [scene, {
      status: "rejected-strict-visual-audit",
      ...value,
      recoveryPassConsumedThisRound: true,
    }])),
    newlyAcceptedSceneNumbers: [],
    rejectedSceneNumbers: [1548, 1550, 1551],
    acceptedSceneNumbersOverall: [1549],
    laterWakeAction: "Start fresh round 8 for scenes 1548, 1550, and 1551 only; preserve accepted scene 1549 and do not advance to Fiji.",
  },
};
checkpoint.rawOutputs = [
  ...checkpoint.rawOutputs.filter((item) => !(item.round === 7 && item.kind === "fresh-recovery-rejected")),
  ...Object.entries(recoveryAudit).map(([scene, value]) => ({
    scene: Number(scene),
    round: 7,
    kind: "fresh-recovery-rejected",
    path: value.rawOutput,
    sourcePath: value.sourceRawOutput,
    sha256: value.sha256,
    dimensions: value.dimensions,
  })),
];
checkpoint.rejectedAssets = [
  ...checkpoint.rejectedAssets.filter((item) => !(item.round === 7 && item.phase === "recovery")),
  ...Object.entries(recoveryAudit).map(([scene, value]) => ({
    scene: Number(scene),
    round: 7,
    phase: "recovery",
    status: "rejected-strict-visual-audit",
    ...value,
    recoveryPassConsumedThisRound: true,
  })),
];
checkpoint.xPost.status = "blocked-active-country-incomplete-not-skipped";
checkpoint.xPost.url = null;
checkpoint.xPost.acceptedCurrentCountryAssets = 1;
checkpoint.xPost.note = "Georgia remains active with accepted scene 1549 preserved. X publication is mandatory only after scenes 1548, 1550, and 1551 are accepted and the four-scene completion checkpoint is pushed.";
checkpoint.nextQueueStatus = "locked-on-Georgia-until-four-accepted-git-pushed-and-X-live-verified";
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "fresh-round-8-missing-scenes-only",
  preserveAcceptedSceneNumbers: [1549],
  sceneNumbers: [1548, 1550, 1551],
  laterCountryStartAllowed: false,
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  status: checkpoint.status,
  acceptedSceneNumbers: [1549],
  missingSceneNumbers: [1548, 1550, 1551],
  terminal: checkpoint.terminal,
  nextWakeAction: checkpoint.nextWakeAction,
}, null, 2));
