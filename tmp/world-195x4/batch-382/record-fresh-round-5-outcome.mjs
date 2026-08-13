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
    rawOutput: "tmp/world-195x4/batch-382/raw/fresh-round-5-recovery/scene-1548.png",
    sourceRawOutput: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-35ca6e04-6aea-4840-8018-29ba5c30417c.png",
    sha256: "03AFB3B6441759E55784B5A9320FE411EE9BC52BD630A162261FFAC3E414D8EE",
    dimensions: { width: 941, height: 1672 },
    decisiveRejectionReasons: [
      "The recovery preserves the Tbilisi landmarks, hard hail, MAX, four distinct adult identities, distinct country-led couture, the compact stockless pistol, and the separate holographic route map.",
      "One free dance arm reaches behind toward the prop side with its hand hidden or owner-ambiguous, while the required Radiance-to-Alia shoulder and Alia-to-Radiance waist closure is not visibly resolved, so the exact six-hand graph fails.",
      "The orange floating disk sits above the pistol's horizontal muzzle axis and an added dotted route line points to it from the map area, so the disk is not the visible endpoint of the stored two-hand sight picture.",
    ],
  },
  1550: {
    rawOutput: "tmp/world-195x4/batch-382/raw/fresh-round-5-recovery/scene-1550.png",
    sourceRawOutput: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-1635a8fb-22d2-4785-9491-f49eb30bb806.png",
    sha256: "7BA7DE7986DA9495B3F76E60802F54D72A08511D49D739323D673D3EF068F231",
    dimensions: { width: 941, height: 1672 },
    decisiveRejectionReasons: [
      "The recovery preserves Sighnaghi, aurora, five adult identities, exactly three geometric balloons, a clearer lap seat, the Alia-Ellie link, male contacts, the compact pistol, and the empty basin marker.",
      "Radiance still owns the balloon stems with one hand while her other hand joins the embrace, and ECE still owns the mission pistol with one hand, so both active two-hand prop inventories and the exact ten-hand graph fail.",
      "A visible orange line runs from the muzzle to the basin marker, violating the no-beam and no-firing-effect gate.",
    ],
  },
  1551: {
    rawOutput: "tmp/world-195x4/batch-382/raw/fresh-round-5-recovery/scene-1551.png",
    sourceRawOutput: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-a1bb46f3-2381-4ce2-8ed1-fcd9d3fa4ebd.png",
    sha256: "00CB6E364E97595283099D7B9B7F84C9383DC435C9DD4DC3BFEDC302F587725B",
    dimensions: { width: 941, height: 1672 },
    decisiveRejectionReasons: [
      "The recovery preserves Batumi, heavy rain, PAWS and MAX, Radiance's sole rainbow socks and open back, four distinct outfits, ECE's two compass hands, Alia's two mission-prop hands, and excellent horizontal paper-target alignment.",
      "Only one Ellie support palm is fully visible on Radiance while Ellie's second support hand remains hidden behind the dipped torso, so the exact eight-hand anatomy and separated waist-plus-upper-back support inventory fail.",
    ],
  },
};

const completedAt = new Date().toISOString();
checkpoint.status = "active-four-scene-gate-incomplete-after-fresh-round-5";
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
checkpoint.renderAttempts.freshRound5 = {
  ...checkpoint.renderAttempts.freshRound5,
  status: "completed-zero-new-accepted-three-rejected",
  completedAt,
  recovery: {
    ...checkpoint.renderAttempts.freshRound5.recovery,
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
    laterWakeAction: "Start fresh round 6 for scenes 1548, 1550, and 1551 only; preserve accepted scene 1549 and do not advance to Fiji.",
  },
};
checkpoint.rawOutputs = [
  ...checkpoint.rawOutputs.filter((item) => !(item.round === 5 && item.kind === "fresh-recovery-rejected")),
  ...Object.entries(recoveryAudit).map(([scene, value]) => ({
    scene: Number(scene),
    round: 5,
    kind: "fresh-recovery-rejected",
    path: value.rawOutput,
    sourcePath: value.sourceRawOutput,
    sha256: value.sha256,
    dimensions: value.dimensions,
  })),
];
checkpoint.rejectedAssets = [
  ...checkpoint.rejectedAssets.filter((item) => !(item.round === 5 && item.phase === "recovery")),
  ...Object.entries(recoveryAudit).map(([scene, value]) => ({
    scene: Number(scene),
    round: 5,
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
  action: "fresh-round-6-missing-scenes-only",
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
