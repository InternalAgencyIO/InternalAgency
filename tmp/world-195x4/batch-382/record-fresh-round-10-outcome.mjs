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
    rawOutput: "tmp/world-195x4/batch-382/raw/fresh-round-10-recovery/scene-1548.png",
    sourceRawOutput: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-d5e57b0e-436e-4341-bcc5-491e82e84e51.png",
    sha256: "9F89195203B57DBACD1DD0224F207687E470265E462B082E91D82BD21764D7D2",
    dimensions: { width: 941, height: 1672 },
    decisiveRejectionReasons: [
      "The recovery preserves four adult identities, Tbilisi, hard hail, MAX, distinct couture, ECE's route map, safe two-hand mission stance, orange disk, complete transparent backstop, and no visible trajectory connector.",
      "The raised Radiance-Ellie clasp, low Alia-Ellie clasp, and Radiance palm on Alia are clear, but Alia's second hand around Radiance is hidden or missing, leaving only seven unambiguous human hands under the strict ownership gate.",
      "Alia's active restrained visible-midriff band is absent after the trio was reposed.",
    ],
  },
  1551: {
    rawOutput: "tmp/world-195x4/batch-382/raw/fresh-round-10-recovery/scene-1551.png",
    sourceRawOutput: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-f5315a4e-f4f9-4f37-998d-161fb25cdd54.png",
    sha256: "F3A6A3BBEE1E303832006F1B02D7BF13C6B24FDDE6E43E252BC83AF270601E62",
    dimensions: { width: 941, height: 1672 },
    decisiveRejectionReasons: [
      "The recovery preserves Batumi, heavy rain, PAWS and MAX, four distinct outfits, Radiance's hosiery and open back, Alia's strapless opaque front and open back, the separate route map, safe mission stance, compass, and complete sand backstop.",
      "Exactly eight human hands are now visually traceable: two Ellie support hands, two Radiance relationship hands, two ECE compass hands, and two Alia mission hands.",
      "Alia's active restrained bare midriff band remains absent; the copper bodice meets the copper waistband without the required visible skin band.",
      "The paper diamond center sits visibly above the horizontal barrel and muzzle centerline rather than on it.",
    ],
  },
};

const completedAt = new Date().toISOString();
checkpoint.status = "active-four-scene-gate-incomplete-after-fresh-round-10";
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
checkpoint.renderAttempts.freshRound10 = {
  ...checkpoint.renderAttempts.freshRound10,
  status: "completed-zero-new-accepted-two-rejected",
  completedAt,
  recovery: {
    ...checkpoint.renderAttempts.freshRound10.recovery,
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
    laterWakeAction: "Start fresh round 11 for scenes 1548 and 1551 only; preserve accepted scenes 1549 and 1550 and do not advance to Fiji.",
  },
};
checkpoint.rawOutputs = [
  ...checkpoint.rawOutputs.filter((item) => !(item.round === 10 && item.kind === "fresh-recovery-rejected")),
  ...Object.entries(recoveryAudit).map(([scene, value]) => ({
    scene: Number(scene),
    round: 10,
    kind: "fresh-recovery-rejected",
    path: value.rawOutput,
    sourcePath: value.sourceRawOutput,
    sha256: value.sha256,
    dimensions: value.dimensions,
  })),
];
checkpoint.rejectedAssets = [
  ...checkpoint.rejectedAssets.filter((item) => !(item.round === 10 && item.phase === "recovery")),
  ...Object.entries(recoveryAudit).map(([scene, value]) => ({
    scene: Number(scene),
    round: 10,
    phase: "recovery",
    status: "rejected-strict-visual-audit",
    ...value,
    recoveryPassConsumedThisRound: true,
  })),
];
checkpoint.xBacklogAudit = {
  ...checkpoint.xBacklogAudit,
  checkedAt: completedAt,
  account: "@dogramaci",
  signedIn: true,
  eligibleBacklogRemaining: 0,
  pendingPost: null,
  preparedPostQueueCount: 0,
  deferredPostCheckpoint: null,
  latestVisibleSeriesStatus: {
    country: "Honduras",
    url: "https://x.com/dogramaci/status/2087088543499768003",
    caption: "Honduras ❤️ Czechia #Honduras",
    attachments: 3,
    liveVerified: true,
  },
  reconciliationDecision: "User requested immediate backlog drain; the authoritative ledger and signed-in live profile have zero eligible unposted historical items, so no duplicate or unauthorized post was sent.",
};
checkpoint.xPost.status = "blocked-active-country-incomplete-not-skipped";
checkpoint.xPost.url = null;
checkpoint.xPost.acceptedCurrentCountryAssets = 2;
checkpoint.xPost.note = "Georgia remains active at two accepted scenes. Historical X backlog is empty. Georgia publication remains mandatory immediately after all four scenes are accepted and the completion checkpoint is pushed.";
checkpoint.nextQueueStatus = "locked-on-Georgia-until-four-accepted-git-pushed-and-X-live-verified";
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "fresh-round-11-missing-scenes-only",
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
  xBacklogRemaining: checkpoint.xBacklogAudit.eligibleBacklogRemaining,
  nextWakeAction: checkpoint.nextWakeAction,
}, null, 2));
