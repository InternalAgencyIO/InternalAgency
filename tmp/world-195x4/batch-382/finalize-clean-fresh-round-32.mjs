import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const checkpointPath = path.join(repo, "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json");
const contractPath = path.join(repo, "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const ledgerPath = path.join(repo, "assets/lore/starlight-era/world-x-publish-ledger.json");
const freshRawPath = "tmp/world-195x4/batch-382/raw/clean-fresh-round-32/scene-1551.png";
const recoveryRawPath = "tmp/world-195x4/batch-382/raw/clean-fresh-round-32-recovery/scene-1551.png";
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").toUpperCase();
}

const expectedContractSha = "69EB6C84A2467A4234D901C3086ECECE9E583B55C41BB9382CD5ED523C482EF5";
const expectedLedgerSha = "B94AA3FB2B1AB1BCAB100CE689F0173C77407B82439D73379D8BC0FA3EEC2455";
const expectedFreshSha = "8BA958AE36FC789304465592B4E45ED08D8FCF68EC97DFA501673DC1F7E6833D";
const expectedRecoverySha = "3E90DCE69841401E6B1226B15CA5BD3E6A182C91E2F89E56EE6EC16C05AC5EB8";
if (sha256File(contractPath) !== expectedContractSha) throw new Error("Contract changed during round 32 recovery");
if (sha256File(ledgerPath) !== expectedLedgerSha) throw new Error("Ledger changed during round 32 recovery");
if (sha256File(path.join(repo, freshRawPath)) !== expectedFreshSha) throw new Error("Round 32 fresh raw changed");
if (sha256File(path.join(repo, recoveryRawPath)) !== expectedRecoverySha) throw new Error("Round 32 recovery raw changed");
if (checkpoint.status !== "active-four-scene-gate-clean-fresh-round-32-recovery-materialized") throw new Error(`Unexpected status: ${checkpoint.status}`);

const completedAt = new Date().toISOString();
const rejectionReasons = [
  "Ellie's support hand and its white-sleeved owner path disappear behind Radiance in the recovery, leaving only seven complete visible human hands.",
  "The missing support palm breaks both the exact eight-hand gate and the required three-contact controlled-dip graph.",
  "Alia's active visible-midriff roll remains absent because the copper shell continues directly to the cobalt waistband without a clear continuous waist reveal.",
  "The recovery improves the object to a heavy metal large-frame replica, but the required orange muzzle insert and straight indexed finger entirely outside a visibly empty guard remain unclear.",
];
const strictAudit = {
  renderSurfaceQuality: "pass-clean-coherent-photographic-texture-with-straight-rain-and-no-wavy-marbling-after-one-recovery",
  identity: "pass-four-adult-identities-with-Alia-braids",
  anatomy: "reject-only-seven-complete-visible-hand-owner-paths-because-Ellie-support-hand-is-hidden",
  handOwnership: "reject-Ellie-second-hand-and-forearm-not-auditable; Radiance-ECE-Alia-hands-pass",
  weather: "pass-heavy-straight-rain-and-flat-wet-tiles",
  locationThemeFusion: "pass-recognizable-Batumi-with-four-distinct-expedition-silhouettes",
  outfitOriginality: "pass-four-distinct-silhouettes-constructions-hems-and-footwear",
  rolledWardrobe: "partial-Radiance-open-back-Ellie-midriff-Alia-strapless-and-Alia-open-back-pass-but-Alia-midriff-remains-absent",
  romance: "reject-lifted-clasp-and-body-brace-pass-but-hidden-Ellie-support-palm-breaks-third-contact-and-eight-hand-audit",
  radianceResponse: "pass-explicit-affirmative-through-willing-smile-lifted-clasp-and-open-invitation-palm",
  partyActivation: "pass-all-four-willing-smiles-and-one-count-body-rhythm-without-party-clutter",
  mascots: "pass-one-PAWS-and-one-MAX-together-on-raised-dry-bed",
  oddProp: "pass-ECE-two-hands-on-opposite-compass-handles",
  routeMap: "pass-separate-hands-free-holographic-map",
  missionHandling: "partial-heavy-metal-large-frame-replica-pass-but-orange-insert-and-index-outside-empty-guard-remain-unclear",
  missionTargetAxis: "pass-paper-diamond-complete-backstop-safety-panel-and-safe-right-facing-axis",
  recoveryBudget: "consumed-one-of-one-planned-recovery-no-further-edit-chain-permitted",
  accepted: false,
};

checkpoint.status = "active-four-scene-gate-incomplete-after-clean-fresh-round-32";
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
checkpoint.renderAttempts.freshRound32 = {
  ...checkpoint.renderAttempts.freshRound32,
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
  rejectionReasons: { 1551: rejectionReasons },
  strictAudit,
};
checkpoint.scenePlans["1551"].freshRound32.visualAudit = strictAudit;
checkpoint.rawOutputs.push({
  scene: 1551,
  round: 32,
  kind: "clean-fresh-recovery-rejected",
  path: recoveryRawPath,
  sourcePath: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-78d9d781-3f1d-4541-bea1-3a605da1cc8b.png",
  sha256: expectedRecoverySha,
  dimensions: { width: 941, height: 1672 },
});
checkpoint.rejectedAssets.push({
  scene: 1551,
  round: 32,
  phase: "recovery",
  status: "rejected-strict-visual-audit",
  rawOutput: recoveryRawPath,
  sourceRawOutput: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-78d9d781-3f1d-4541-bea1-3a605da1cc8b.png",
  sha256: expectedRecoverySha,
  dimensions: { width: 941, height: 1672 },
  decisiveRejectionReasons: rejectionReasons,
  recoveryPassConsumedThisRound: true,
});
checkpoint.renderStrategyReset = {
  ...checkpoint.renderStrategyReset,
  activeCleanRound: null,
  lastCompletedCleanRound: 32,
  lastCleanRoundResult: "clean-Batumi-party-open-backs-mascots-compass-map-and-metal-replica-improved-but-rejected-hidden-Ellie-hand-third-contact-Alia-midriff-and-replica-safety-details",
  nextCleanRound: 33,
  nextSourcePolicy: "original identity anchors only; no round 32 image input",
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
  reconciliationDecision: "Signed-in live profile checked and no eligible unposted World Series country pair exists. Georgia still has three accepted scenes, so no X upload or country advance is permitted.",
};
checkpoint.xPost.status = "blocked-active-country-incomplete-not-skipped";
checkpoint.xPost.url = null;
checkpoint.xPost.acceptedCurrentCountryAssets = 3;
checkpoint.xPost.note = "Georgia has accepted scenes 1548, 1549, and 1550. Round 32 scene 1551 exhausted its single clean recovery and still failed exact visible-hand anatomy, third-contact romance, Alia midriff, and replica-safety-detail gates. Publication remains mandatory after scene 1551 is accepted and the four-scene completion checkpoint is pushed.";
checkpoint.nextQueueStatus = "locked-on-Georgia-until-four-accepted-git-pushed-and-X-live-verified";
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "clean-fresh-round-33-from-original-identity-anchors-scene-1551-only",
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
