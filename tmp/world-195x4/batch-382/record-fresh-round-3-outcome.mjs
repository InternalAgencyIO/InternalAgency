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
    rawOutput: "tmp/world-195x4/batch-382/raw/fresh-round-3-recovery/scene-1548.png",
    sourceRawOutput: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-5333ec44-2823-4675-8ea2-fe934796303d.png",
    sha256: "97294CDBEBA5A189FACC9F68FB65D35501FE7F7B3F71A52A2DD906B2FF884265",
    dimensions: { width: 941, height: 1672 },
    decisiveRejectionReasons: [
      "The recovery preserves Tbilisi, the Peace Bridge, Narikala, sulfur-bath domes, hard hail, MAX, four distinct adults, and a visibly energetic three-woman relationship chain.",
      "Several overlapping dance arms remain owner-ambiguous rather than yielding six independently traceable dance hands, so the exact eight-hand anatomy gate is not satisfied.",
      "The side-on muzzle line enters the sand wall above the paper water marker; the marker remains below the axis instead of lying between muzzle and backstop, so the stored mission target is not materialized.",
    ],
  },
  1550: {
    rawOutput: "tmp/world-195x4/batch-382/raw/fresh-round-3-recovery/scene-1550.png",
    sourceRawOutput: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-dee99521-7df6-4c47-9392-4e84abda746f.png",
    sha256: "7A646CC110374C0C6111AE766AA9E2897EE0763F91991689BE205145C4195D5A",
    dimensions: { width: 941, height: 1672 },
    decisiveRejectionReasons: [
      "The recovery preserves Sighnaghi walls and towers, Alazani vineyards, the aurora, five adult identities, three soft balloon forms, and the male's strongest eye line toward ECE.",
      "Alia sits beside Radiance rather than securely sideways across Radiance's lap, and Alia and Ellie exchange shoulder touches instead of the mandatory linked-hand choice; the rolled hard-love beat and exact ten-hand graph therefore fail.",
      "The basin marker is below the horizontal muzzle axis and the muzzle meets the sand wall without passing through the marker, so the stored target line is not materialized.",
    ],
  },
  1551: {
    rawOutput: "tmp/world-195x4/batch-382/raw/fresh-round-3-recovery/scene-1551.png",
    sourceRawOutput: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-f907406b-613d-4aa7-b72a-06920ab26683.png",
    sha256: "8E08F2455CA6B505DAEA763B85FF9FBBD48D095E90ECDB9D1A0FB53F527152F3",
    dimensions: { width: 941, height: 1672 },
    decisiveRejectionReasons: [
      "The recovery preserves Batumi Boulevard, heavy rain, the exact golden kitten and golden retriever puppy, Radiance's rainbow knee socks, ECE's compass, Alia's strapless open back, and the separate safe lane.",
      "Ellie's upper-back palm is visible, but Ellie's second waist-support hand and Radiance's hand toward Ellie are hidden or ambiguous, so fewer than eight hands are continuously traceable and the exact dip graph fails.",
      "The paper route target is visibly mounted below the muzzle axis rather than intersecting it before the sand wall, so the stored mission target line is not materialized.",
    ],
  },
};

const completedAt = new Date().toISOString();
checkpoint.status = "active-four-scene-gate-incomplete-after-fresh-round-3";
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
checkpoint.renderAttempts.freshRound3 = {
  ...checkpoint.renderAttempts.freshRound3,
  status: "completed-zero-new-accepted-three-rejected",
  completedAt,
  recovery: {
    ...checkpoint.renderAttempts.freshRound3.recovery,
    status: "completed-zero-new-accepted-three-rejected",
    completedAt,
    perScene: Object.fromEntries(
      Object.entries(recoveryAudit).map(([scene, value]) => [scene, {
        status: "rejected-strict-visual-audit",
        ...value,
        recoveryPassConsumedThisRound: true,
      }]),
    ),
    newlyAcceptedSceneNumbers: [],
    rejectedSceneNumbers: [1548, 1550, 1551],
    acceptedSceneNumbersOverall: [1549],
    laterWakeAction: "Start fresh round 4 for scenes 1548, 1550, and 1551 only; preserve accepted scene 1549 and do not advance to Fiji.",
  },
};
checkpoint.rawOutputs = [
  ...checkpoint.rawOutputs.filter((item) => !(item.round === 3 && item.kind === "fresh-recovery-rejected")),
  ...Object.entries(recoveryAudit).map(([scene, value]) => ({
    scene: Number(scene),
    round: 3,
    kind: "fresh-recovery-rejected",
    path: value.rawOutput,
    sourcePath: value.sourceRawOutput,
    sha256: value.sha256,
    dimensions: value.dimensions,
  })),
];
checkpoint.rejectedAssets = [
  ...checkpoint.rejectedAssets.filter((item) => !(item.round === 3 && item.phase === "recovery")),
  ...Object.entries(recoveryAudit).map(([scene, value]) => ({
    scene: Number(scene),
    round: 3,
    phase: "recovery",
    status: "rejected-strict-visual-audit",
    ...value,
    recoveryPassConsumedThisRound: true,
  })),
];
checkpoint.xPost.status = "blocked-active-country-incomplete-not-skipped";
checkpoint.xPost.url = null;
checkpoint.nextQueueStatus = "locked-on-Georgia-until-four-accepted-git-pushed-and-X-live-verified";
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "fresh-round-4-missing-scenes-only",
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
