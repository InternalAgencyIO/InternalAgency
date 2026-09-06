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
    rawOutput: "tmp/world-195x4/batch-382/raw/fresh-round-4-recovery/scene-1548.png",
    sourceRawOutput: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-845b0378-16b1-45e1-9c36-b2bcf70b701c.png",
    sha256: "1854E4359C71054F8E67B4E441885F0E43E4AC9F8163B19FC9CCF7364CBDA395",
    dimensions: { width: 941, height: 1672 },
    decisiveRejectionReasons: [
      "The recovery preserves the Tbilisi landmarks, hard hail, MAX, four distinct adult identities, country-led couture, and an active overhead dance arch.",
      "The required full-size rainbow-gradient Desert Eagle-style inert training prop mutates into a long-gun form, which fails the mission-prop identity gate.",
      "The dance contact graph remains reassigned and owner-ambiguous, including a reach toward the prop-side adult instead of the stored six-hand dance inventory.",
    ],
  },
  1550: {
    rawOutput: "tmp/world-195x4/batch-382/raw/fresh-round-4-recovery/scene-1550.png",
    sourceRawOutput: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-2bc3d9b1-a1e1-4827-b185-7eb69f5b65c2.png",
    sha256: "AA43DC95A323801499B35A2BF568CBFBA33E0B7D5544EF3596F1A05F03A92D83",
    dimensions: { width: 941, height: 1672 },
    decisiveRejectionReasons: [
      "The recovery preserves Sighnaghi, aurora, five adult identities, three geometric balloons, an Alia-Ellie link, male contacts, and the empty basin marker.",
      "The required large-frame inert pistol mutates into a long-gun form, Radiance still owns the balloons with one visible hand, and her other arm exits the frame, failing prop identity and exact ten-hand anatomy.",
      "Alia sits beside Radiance rather than securely sideways across Radiance's lap, so the rolled hard-love beat is incomplete.",
    ],
  },
  1551: {
    rawOutput: "tmp/world-195x4/batch-382/raw/fresh-round-4-recovery/scene-1551.png",
    sourceRawOutput: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-a3093074-4839-476d-9b52-f9f5e1f01873.png",
    sha256: "154319D9F7E7503BB54CC3389257434191C906DC38348135A3E6C6CCB19906C4",
    dimensions: { width: 941, height: 1672 },
    decisiveRejectionReasons: [
      "The recovery preserves Batumi, heavy rain, PAWS and MAX, Radiance's rainbow socks and open back, Alia's active cuts, ECE's two compass hands, and Alia's two mission-prop hands.",
      "Ellie's upper-back support hand and Radiance's contact hand toward Ellie remain hidden or owner-ambiguous, so the exact eight-hand dip graph fails.",
      "The muzzle meets the lower edge of the paper while the black route diamond remains visibly above the muzzle axis, so the stored target is not aligned.",
    ],
  },
};

const completedAt = new Date().toISOString();
checkpoint.status = "active-four-scene-gate-incomplete-after-fresh-round-4";
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
checkpoint.renderAttempts.freshRound4 = {
  ...checkpoint.renderAttempts.freshRound4,
  status: "completed-zero-new-accepted-three-rejected",
  completedAt,
  recovery: {
    ...checkpoint.renderAttempts.freshRound4.recovery,
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
    laterWakeAction: "Start fresh round 5 for scenes 1548, 1550, and 1551 only; preserve accepted scene 1549 and do not advance to Fiji.",
  },
};
checkpoint.rawOutputs = [
  ...checkpoint.rawOutputs.filter((item) => !(item.round === 4 && item.kind === "fresh-recovery-rejected")),
  ...Object.entries(recoveryAudit).map(([scene, value]) => ({
    scene: Number(scene),
    round: 4,
    kind: "fresh-recovery-rejected",
    path: value.rawOutput,
    sourcePath: value.sourceRawOutput,
    sha256: value.sha256,
    dimensions: value.dimensions,
  })),
];
checkpoint.rejectedAssets = [
  ...checkpoint.rejectedAssets.filter((item) => !(item.round === 4 && item.phase === "recovery")),
  ...Object.entries(recoveryAudit).map(([scene, value]) => ({
    scene: Number(scene),
    round: 4,
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
  action: "fresh-round-5-missing-scenes-only",
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
