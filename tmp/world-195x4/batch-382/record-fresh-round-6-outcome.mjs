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
    rawOutput: "tmp/world-195x4/batch-382/raw/fresh-round-6-recovery/scene-1548.png",
    sourceRawOutput: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-54f485f8-618d-45e7-9544-d97686dbd250.png",
    sha256: "EDD96563CEA560A2899CB68A69CBEF9DDEF04B1797ED43F8B7D6423B222C4565",
    dimensions: { width: 941, height: 1672 },
    decisiveRejectionReasons: [
      "The recovery preserves unmistakable Tbilisi, hard hail, MAX, four distinct adult identities, distinct country-led couture, the compact stockless pistol, the separate route map, and the empty orange Mtkvari disk with no rendered connector.",
      "Radiance's free shoulder-contact hand remains hidden while the other five dance hands are visible, so only seven of the required eight human hands are unambiguous.",
      "ECE remains kneeling outside the three-woman cluster instead of stepping through its open side, leaving the rolled moving slow-dance interruption visibly unperformed.",
      "The orange disk sits substantially below the pistol's horizontal muzzle axis rather than directly in front of it.",
    ],
  },
  1550: {
    rawOutput: "tmp/world-195x4/batch-382/raw/fresh-round-6-recovery/scene-1550.png",
    sourceRawOutput: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-a2b7710c-2747-4cdb-a856-7d3d52b784e0.png",
    sha256: "35938723FF201F9E4E4FEAB5547A09362AF2EBBE4EAF12FB336E919034BCD090",
    dimensions: { width: 941, height: 1672 },
    decisiveRejectionReasons: [
      "The recovery preserves unmistakable Sighnaghi, aurora, five adult identities, exactly three geometric balloons on one bar, Radiance's two-handle ownership, a clear lap seat, the Alia-Ellie link, two male contacts, ECE's two-hand pistol, the separate route map, and the empty basin marker.",
      "The pistol points laterally out of frame while the basin disk lies far below and left of its muzzle axis, so the stored empty-water-marker target is not the visible endpoint of the sight picture.",
      "The male's sustained face direction favors Ellie and the lap pair instead of ECE, violating his strongest-eye-line requirement.",
    ],
  },
  1551: {
    rawOutput: "tmp/world-195x4/batch-382/raw/fresh-round-6-recovery/scene-1551.png",
    sourceRawOutput: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-e4389e89-b3e8-496a-94e2-5062387dfa79.png",
    sha256: "E2604ABE3E70F4A895975F160E1FAE09E39669C3718ABAC8F15145B1DEBB59FB",
    dimensions: { width: 941, height: 1672 },
    decisiveRejectionReasons: [
      "The recovery preserves unmistakable Batumi, heavy rain, distinct PAWS and MAX, Radiance's sole rainbow socks and open back, four distinct outfits, the shallow dip with eight traceable hands, ECE's two compass hands, Alia's two mission-prop hands, and a complete sand backstop.",
      "The pistol's horizontal muzzle axis passes clearly above the paper marker instead of terminating on it, so the stored paper-target mission action is not visibly performed.",
    ],
  },
};

const completedAt = new Date().toISOString();
checkpoint.status = "active-four-scene-gate-incomplete-after-fresh-round-6";
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
checkpoint.renderAttempts.freshRound6 = {
  ...checkpoint.renderAttempts.freshRound6,
  status: "completed-zero-new-accepted-three-rejected",
  completedAt,
  recovery: {
    ...checkpoint.renderAttempts.freshRound6.recovery,
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
    laterWakeAction: "Start fresh round 7 for scenes 1548, 1550, and 1551 only; preserve accepted scene 1549 and do not advance to Fiji.",
  },
};
checkpoint.rawOutputs = [
  ...checkpoint.rawOutputs.filter((item) => !(item.round === 6 && item.kind === "fresh-recovery-rejected")),
  ...Object.entries(recoveryAudit).map(([scene, value]) => ({
    scene: Number(scene),
    round: 6,
    kind: "fresh-recovery-rejected",
    path: value.rawOutput,
    sourcePath: value.sourceRawOutput,
    sha256: value.sha256,
    dimensions: value.dimensions,
  })),
];
checkpoint.rejectedAssets = [
  ...checkpoint.rejectedAssets.filter((item) => !(item.round === 6 && item.phase === "recovery")),
  ...Object.entries(recoveryAudit).map(([scene, value]) => ({
    scene: Number(scene),
    round: 6,
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
  action: "fresh-round-7-missing-scenes-only",
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
