import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const checkpointPath = path.join(repo, "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json");
const contractPath = path.join(repo, "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const ledgerPath = path.join(repo, "assets/lore/starlight-era/world-x-publish-ledger.json");
const freshRawPath = "tmp/world-195x4/batch-382/raw/clean-fresh-round-30/scene-1551.png";
const expectedFreshSha = "81E0BBA9C73447ED43A59262DF9B59299941FC686EE5778DFD07C04ECE2B2AD9";
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").toUpperCase();
}

if (sha256File(contractPath) !== "69EB6C84A2467A4234D901C3086ECECE9E583B55C41BB9382CD5ED523C482EF5") throw new Error("Contract changed during round 30 recovery");
if (sha256File(ledgerPath) !== "B94AA3FB2B1AB1BCAB100CE689F0173C77407B82439D73379D8BC0FA3EEC2455") throw new Error("Ledger changed during round 30 recovery");
if (sha256File(path.join(repo, freshRawPath)) !== expectedFreshSha) throw new Error("Round 30 fresh raw changed");
if (checkpoint.status !== "active-four-scene-gate-clean-fresh-round-30-recovery-materialized") throw new Error(`Unexpected status: ${checkpoint.status}`);

const completedAt = new Date().toISOString();
const requestId = "3f7f0af1-23dc-4a03-bb48-bb7b21c87292";
const rejectionReasons = [
  "The clean fresh raw remains an upright turn rather than the rolled shallow controlled dip.",
  "Ellie's support contact and the required three-contact relationship graph are absent or not auditable.",
  "Radiance's fully-open-back roll is obstructed by blue-and-gold crossing straps.",
  "Alia's active visible-midriff roll lacks a clear continuous bare band.",
  "The inert replica's indexed finger outside an empty guard and orange muzzle insert are not fully auditable.",
  "The sole targeted recovery produced no image because output moderation rejected it.",
];
const strictAudit = {
  renderSurfaceQuality: "pass-clean-coherent-photographic-texture-with-straight-rain-and-no-wavy-or-marbled-processing",
  identity: "pass-four-adult-identities-with-Alia-braids",
  anatomy: "reject-Ellie-Radiance-support-owner-path-and-exact-contact-graph-not-fully-auditable",
  handOwnership: "partial-Radiance-decline-arm-ECE-compass-and-Alia-grip-pass-but-left-couple-support-graph-fails",
  weather: "pass-heavy-straight-rain-and-flat-wet-tiles",
  locationThemeFusion: "pass-recognizable-Batumi-with-four-distinct-expedition-silhouettes",
  outfitOriginality: "pass-four-distinct-silhouettes-constructions-hems-and-footwear",
  rolledWardrobe: "reject-Radiance-fully-open-back-obstructed-and-Alia-visible-midriff-band-missing",
  romance: "reject-upright-turn-instead-of-controlled-dip-and-fewer-than-three-clear-contacts",
  radianceResponse: "pass-explicit-decline-through-visible-open-palm-and-warm-ECE-eye-line",
  partyActivation: "pass-false-with-empty-willing-participant-set-and-no-party-objects",
  mascots: "pass-one-PAWS-and-one-MAX-sharing-raised-dry-bed",
  oddProp: "pass-ECE-two-hands-on-opposite-compass-handles",
  routeMap: "pass-separate-hands-free-holographic-map",
  missionHandling: "reject-indexed-trigger-finger-empty-guard-and-orange-insert-remain-ambiguous",
  missionTargetAxis: "pass-paper-diamond-complete-backstop-and-safe-right-facing-axis",
  recoveryResult: "rejected-output-moderation-no-raw",
  recoveryBudget: "consumed-one-of-one-planned-recovery-no-further-edit-chain-permitted",
  accepted: false,
};
const recoveryFailure = {
  status: "rejected-output-moderation-no-raw",
  rawOutput: null,
  moderationStage: "output",
  moderationCategories: ["sexual"],
  requestId,
  recoveryPassConsumedThisRound: true,
  sourceRawOutput: freshRawPath,
  sourceRawSha256: expectedFreshSha,
  note: "The single round-30 recovery request returned no image. No alternate edit, older render, or generated file was substituted.",
};

checkpoint.status = "active-four-scene-gate-incomplete-after-clean-fresh-round-30";
checkpoint.checkpointedAt = completedAt;
checkpoint.terminal = false;
checkpoint.countryCompletionGate = {
  ...checkpoint.countryCompletionGate,
  acceptedSceneCount: 3,
  missingSceneNumbers: [1551],
  gitCheckpointPushed: true,
  xPublicStatusVerified: false,
  queueAdvanceAllowed: false,
  gateSatisfied: false,
};
checkpoint.renderAttempts.freshRound30 = {
  ...checkpoint.renderAttempts.freshRound30,
  status: "completed-rejected-after-single-recovery-output-moderation-no-raw",
  completedAt,
  recoveryCompletedAt: completedAt,
  rawOutputs: {
    1551: {
      fresh: { path: freshRawPath, sha256: expectedFreshSha, preserved: true },
      recovery: null,
    },
  },
  acceptedSceneNumbers: [],
  rejectedSceneNumbers: [1551],
  rejectionReasons: { 1551: rejectionReasons },
  strictAudit,
  recoveryResult: recoveryFailure,
};
checkpoint.scenePlans["1551"].freshRound30.visualAudit = strictAudit;
checkpoint.scenePlans["1551"].freshRound30.recoveryResult = recoveryFailure;
for (const item of checkpoint.rawOutputs) {
  if (item.scene === 1551 && item.round === 30 && item.kind === "clean-fresh-recovery-pending") {
    item.kind = "clean-fresh-recovery-attempt-blocked-no-output";
    item.recoveryOutput = null;
    item.requestId = requestId;
  }
}
checkpoint.rejectedAssets.push({
  scene: 1551,
  round: 30,
  phase: "recovery",
  ...recoveryFailure,
  decisiveRejectionReasons: rejectionReasons,
});
checkpoint.renderStrategyReset = {
  ...checkpoint.renderStrategyReset,
  activeCleanRound: null,
  lastCompletedCleanRound: 30,
  lastCleanRoundResult: "clean-surface-decline-ECE-center-Batumi-and-mascots-pass-but-fresh-rejected-dip-contact-open-back-midriff-and-replica-audit; sole-recovery-output-moderated-no-raw",
  nextCleanRound: 31,
  nextSourcePolicy: "original identity anchors only; no round 30 image input",
  activeSourcePolicy: "four original identity anchors only",
  priorBatumiRenderInputCount: 0,
};
checkpoint.xBacklogAudit = {
  ...checkpoint.xBacklogAudit,
  checkedAt: completedAt,
  signedIn: true,
  eligibleBacklogRemaining: 0,
  pendingPost: null,
  preparedPostQueueCount: 0,
  reconciliationDecision: "Signed-in live profile was checked and no eligible unposted World Series country pair exists. Georgia still has three accepted scenes, so no X upload or country advance is permitted.",
};
checkpoint.xPost.status = "blocked-active-country-incomplete-not-skipped";
checkpoint.xPost.url = null;
checkpoint.xPost.acceptedCurrentCountryAssets = 3;
checkpoint.xPost.note = "Georgia has accepted scenes 1548, 1549, and 1550. Round 30 scene 1551 kept a clean surface and clear Radiance decline but failed the controlled-dip contact graph, active back and midriff rolls, and replica-safety audit; its sole recovery returned no image after output moderation. Publication remains mandatory after scene 1551 is accepted and the four-scene completion checkpoint is pushed.";
checkpoint.nextQueueStatus = "locked-on-Georgia-until-four-accepted-git-pushed-and-X-live-verified";
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "clean-fresh-round-31-from-original-identity-anchors-scene-1551-only",
  preserveAcceptedSceneNumbers: [1548, 1549, 1550],
  sceneNumbers: [1551],
  laterCountryStartAllowed: false,
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  status: checkpoint.status,
  acceptedSceneCount: checkpoint.countryCompletionGate.acceptedSceneCount,
  missingSceneNumbers: checkpoint.countryCompletionGate.missingSceneNumbers,
  recoveryOutput: null,
  moderationRequestId: requestId,
  accepted: false,
  recoveryBudget: strictAudit.recoveryBudget,
  nextWakeAction: checkpoint.nextWakeAction,
}, null, 2));
