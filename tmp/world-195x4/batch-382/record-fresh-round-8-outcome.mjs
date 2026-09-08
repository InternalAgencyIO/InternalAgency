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
    rawOutput: "tmp/world-195x4/batch-382/raw/fresh-round-8-recovery/scene-1548.png",
    sourceRawOutput: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-01d8e2f0-dee1-434b-88ef-45da19839668.png",
    sha256: "F2F64707F310EE33617FDAA7C49C775DAFDF1ADF65BBBBF023712755B8E9A704",
    dimensions: { width: 941, height: 1672 },
    decisiveRejectionReasons: [
      "The edit preserves unmistakable Tbilisi, hard hail, MAX, four adult identities, three active midriff bands, distinct country-led couture, a separate route card, and ECE's two-hand compact inert cinema-training pistol.",
      "The required slow-dance contact graph is still replaced by a raised clasp, a chest palm, and an ambiguous low hand cluster; the behind-waist embrace and linked three-person chain are not visibly performed.",
      "ECE remains at the outer right facing away from the dancers rather than stepping through the open side with a jealous eye line, so the rolled interruption is still absent.",
      "The orange Mtkvari disk remains substantially below the horizontal muzzle axis instead of being the visible endpoint of the sight picture.",
    ],
  },
  1551: {
    rawOutput: "tmp/world-195x4/batch-382/raw/fresh-round-8-recovery/scene-1551.png",
    sourceRawOutput: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-bf150399-b243-4267-9860-1a1503b602a6.png",
    sha256: "ABE05B3BB4F8D1BD6D0ADF6EE4FE51923AFB298C6DA0B3C0B60B17C5C77ACD5A",
    dimensions: { width: 941, height: 1672 },
    decisiveRejectionReasons: [
      "The edit preserves unmistakable Batumi, heavy rain, distinct PAWS and MAX, Radiance's sole rainbow hosiery and fully open back, the supported dip, ECE's two compass hands, and excellent horizontal paper-target alignment against a complete sand backstop.",
      "Radiance has only one visible hand while ECE's hands remain exclusively on the compass, leaving seven unambiguous human hands and no caught-hand invitation.",
      "Alia's edit removes required opaque front and side bust coverage, creating public-unsafe exposed breast anatomy; this is an immediate hard rejection regardless of other improvements.",
      "Alia's active restrained midriff construction is still absent, so her full active garment-roll set is not materialized.",
    ],
  },
};

const completedAt = new Date().toISOString();
checkpoint.status = "active-four-scene-gate-incomplete-after-fresh-round-8";
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
checkpoint.renderAttempts.freshRound8 = {
  ...checkpoint.renderAttempts.freshRound8,
  status: "completed-one-new-accepted-two-rejected",
  completedAt,
  recovery: {
    ...checkpoint.renderAttempts.freshRound8.recovery,
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
    laterWakeAction: "Start fresh round 9 for scenes 1548 and 1551 only; preserve accepted scenes 1549 and 1550 and do not advance to Fiji.",
  },
};
checkpoint.rawOutputs = [
  ...checkpoint.rawOutputs.filter((item) => !(item.round === 8 && item.kind === "fresh-recovery-rejected")),
  ...Object.entries(recoveryAudit).map(([scene, value]) => ({
    scene: Number(scene),
    round: 8,
    kind: "fresh-recovery-rejected",
    path: value.rawOutput,
    sourcePath: value.sourceRawOutput,
    sha256: value.sha256,
    dimensions: value.dimensions,
  })),
];
checkpoint.rejectedAssets = [
  ...checkpoint.rejectedAssets.filter((item) => !(item.round === 8 && item.phase === "recovery")),
  ...Object.entries(recoveryAudit).map(([scene, value]) => ({
    scene: Number(scene),
    round: 8,
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
  action: "fresh-round-9-missing-scenes-only",
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
