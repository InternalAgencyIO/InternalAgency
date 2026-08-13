import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const checkpointPath = path.join(repo, "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json");
const contractPath = path.join(repo, "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const ledgerPath = path.join(repo, "assets/lore/starlight-era/world-x-publish-ledger.json");
const freshRawPath = "tmp/world-195x4/batch-382/raw/clean-fresh-round-20/scene-1551.png";
const recoveryRawPath = "tmp/world-195x4/batch-382/raw/clean-fresh-round-20-recovery/scene-1551.png";
const handsQaPath = "tmp/world-195x4/batch-382/qa/clean-fresh-round-20-recovery-scene-1551-hands-crop.png";
const targetQaPath = "tmp/world-195x4/batch-382/qa/clean-fresh-round-20-recovery-scene-1551-target-crop.png";
const triggerQaPath = "tmp/world-195x4/batch-382/qa/clean-fresh-round-20-recovery-scene-1551-trigger-crop-4x.png";
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").toUpperCase();
}

const expectedContractSha = "69EB6C84A2467A4234D901C3086ECECE9E583B55C41BB9382CD5ED523C482EF5";
const expectedLedgerSha = "B94AA3FB2B1AB1BCAB100CE689F0173C77407B82439D73379D8BC0FA3EEC2455";
const expectedFreshSha = "B8076CA0DA60917A5235C2448400FCCAAB203B6194A3B8BB1CA7142C5D24C0D4";
const expectedRecoverySha = "17B562AA995E806EA712A9263BF066B4B0ED3853C22F4EBBD637B39F97919820";
if (sha256File(contractPath) !== expectedContractSha) throw new Error("Authoritative contract changed during round 20 recovery");
if (sha256File(ledgerPath) !== expectedLedgerSha) throw new Error("X publishing ledger changed during round 20 recovery");
if (sha256File(path.join(repo, freshRawPath)) !== expectedFreshSha) throw new Error("Clean round 20 fresh raw changed");
if (sha256File(path.join(repo, recoveryRawPath)) !== expectedRecoverySha) throw new Error("Clean round 20 recovery raw changed");
if (checkpoint.status !== "active-four-scene-gate-clean-fresh-round-20-recovery-materialized") {
  throw new Error(`Unexpected checkpoint status: ${checkpoint.status}`);
}

const completedAt = new Date().toISOString();
const strictAudit = {
  renderSurfaceQuality: "pass-clean-natural-photographic-texture-without-wavy-artifacts-after-one-recovery",
  identity: "pass-four-adult-identities-with-Alia-braids",
  anatomy: "reject-Alia-two-hand-mission-cluster-is-not-separately-traceable",
  handOwnership: "reject-Alia-two-arms-converge-into-one-ambiguous-hand-cluster-at-the-grip",
  weather: "pass-heavy-straight-rain",
  locationThemeFusion: "pass-Batumi-and-Mars-expedition-couture",
  outfitOriginality: "pass-four-distinct-silhouettes-and-material-languages",
  rolledWardrobe: "pass-recovery-removes-Alia-neck-shoulder-and-back-straps-while-preserving-strapless-open-back-midriff-construction",
  romance: "pass-controlled-dip-three-clear-contacts-and-Radiance-ECE-affection-center",
  radianceAgreement: "pass-deliberate-reciprocal-clasp-and-voluntary-turn-toward-ECE-make-agreement-readable",
  partyActivation: "pass-restrained-four-adult-victory-dance-party-beat-without-decorative-clutter",
  mascots: "pass-one-PAWS-and-one-MAX-safe-play",
  oddProp: "pass-ECE-two-hands-on-opposite-compass-handles",
  routeMap: "pass-separate-hands-free-holographic-map",
  missionHandling: "reject-primary-trigger-index-remains-curled-inside-the-guard",
  missionTargetAxis: "pass-orange-muzzle-center-and-black-diamond-center-on-one-horizontal-row",
  recoveryBudget: "consumed-one-of-one-planned-recovery-no-further-edit-chain-permitted",
  qaCrops: {
    hands: { path: handsQaPath, sha256: sha256File(path.join(repo, handsQaPath)) },
    target: { path: targetQaPath, sha256: sha256File(path.join(repo, targetQaPath)) },
    trigger4x: { path: triggerQaPath, sha256: sha256File(path.join(repo, triggerQaPath)) },
  },
  accepted: false,
};

checkpoint.status = "active-four-scene-gate-incomplete-after-clean-fresh-round-20";
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
checkpoint.renderAttempts.freshRound20 = {
  ...checkpoint.renderAttempts.freshRound20,
  status: "completed-rejected-after-single-recovery",
  completedAt,
  recoveryCompletedAt: completedAt,
  rawOutputs: {
    1551: {
      fresh: { path: freshRawPath, sha256: expectedFreshSha, preserved: true },
      recovery: { path: recoveryRawPath, sha256: expectedRecoverySha, preserved: true },
    },
  },
  acceptedSceneNumbers: [],
  rejectedSceneNumbers: [1551],
  rejectionReasons: {
    1551: [
      "Alia's two mission hands converge into one ambiguous grip cluster instead of two separately traceable hands",
      "Alia's primary trigger index remains visibly curled inside the trigger guard instead of lying straight along the frame outside it",
    ],
  },
  strictAudit,
};
checkpoint.scenePlans["1551"].freshRound20.visualAudit = strictAudit;
checkpoint.rawOutputs.push({
  scene: 1551,
  round: 20,
  kind: "clean-fresh-recovery-rejected",
  path: recoveryRawPath,
  sourcePath: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-c27dd687-2460-458c-b728-0a23f38f52a4.png",
  sha256: expectedRecoverySha,
  dimensions: { width: 941, height: 1672 },
});
checkpoint.rejectedAssets.push({
  scene: 1551,
  round: 20,
  phase: "recovery",
  status: "rejected-strict-visual-audit",
  rawOutput: recoveryRawPath,
  sourceRawOutput: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-c27dd687-2460-458c-b728-0a23f38f52a4.png",
  sha256: expectedRecoverySha,
  dimensions: { width: 941, height: 1672 },
  decisiveRejectionReasons: checkpoint.renderAttempts.freshRound20.rejectionReasons[1551],
  recoveryPassConsumedThisRound: true,
});
checkpoint.renderStrategyReset = {
  ...checkpoint.renderStrategyReset,
  activeCleanRound: null,
  lastCompletedCleanRound: 20,
  lastCleanRoundResult: "clean-surface-recovery-wardrobe-pass-mission-hand-safety-reject",
  nextCleanRound: 21,
  nextSourcePolicy: "original identity anchors only; no round 20 image input",
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
  lastPublicStatusVerified: "https://x.com/dogramaci/status/2087088543499768003",
  reconciliationDecision: "Signed-in profile checked and no eligible unposted World Series item remains. Georgia still has three accepted scenes, so no X upload or country advance is permitted.",
};
checkpoint.xPost.status = "blocked-active-country-incomplete-not-skipped";
checkpoint.xPost.url = null;
checkpoint.xPost.acceptedCurrentCountryAssets = 3;
checkpoint.nextQueueStatus = "locked-on-Georgia-until-four-accepted-git-pushed-and-X-live-verified";
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "clean-fresh-round-21-from-original-identity-anchors-scene-1551-only",
  preserveAcceptedSceneNumbers: [1548, 1549, 1550],
  sceneNumbers: [1551],
  laterCountryStartAllowed: false,
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  status: checkpoint.status,
  acceptedSceneCount: checkpoint.countryCompletionGate.acceptedSceneCount,
  missingSceneNumbers: checkpoint.countryCompletionGate.missingSceneNumbers,
  recoveryRawSha256: expectedRecoverySha,
  accepted: false,
  recoveryBudget: strictAudit.recoveryBudget,
  nextWakeAction: checkpoint.nextWakeAction,
}, null, 2));
