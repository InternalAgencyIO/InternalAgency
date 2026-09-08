import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const checkpointPath = path.join(repo, "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json");
const contractPath = path.join(repo, "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const ledgerPath = path.join(repo, "assets/lore/starlight-era/world-x-publish-ledger.json");
const freshRawPath = "tmp/world-195x4/batch-382/raw/clean-fresh-round-42/scene-1551.png";
const recoveryRawPath = "tmp/world-195x4/batch-382/raw/clean-fresh-round-42/scene-1551-recovery.png";
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").toUpperCase();
}

const expectedContractSha = "69EB6C84A2467A4234D901C3086ECECE9E583B55C41BB9382CD5ED523C482EF5";
const expectedLedgerSha = "33F29A1FB48F2971D78C9B345AA378B84C73FE16BDBE468AFFF695972B63C44E";
const expectedFreshSha = "9DBF64FF69AFA22C6E024C8F89AECCB85DEA43B974C4AF5488635707B905A810";
const expectedRecoverySha = "C24574DEF892F69DA212E7E6EE1588ACD03B34DF88986696543E03682599B799";
if (sha256File(contractPath) !== expectedContractSha) throw new Error("Contract changed during round 42 recovery");
if (sha256File(ledgerPath) !== expectedLedgerSha) throw new Error("Ledger changed during round 42 recovery");
if (sha256File(path.join(repo, freshRawPath)) !== expectedFreshSha) throw new Error("Round 42 fresh raw changed");
if (sha256File(path.join(repo, recoveryRawPath)) !== expectedRecoverySha) throw new Error("Round 42 recovery raw changed");
if (checkpoint.status !== "active-four-scene-gate-clean-fresh-round-42-recovery-materialized") throw new Error(`Unexpected status: ${checkpoint.status}`);

const completedAt = new Date().toISOString();
const rejectionReasons = [
  "Radiance still turns her face and sustained eye line toward Ellie instead of visibly answering ECE with the stored mid-nod, so the round-42 invitation-specific affirmative is not certifiable.",
  "Alia remains neutral in profile without an unambiguous willing smile, so the stored Radiance-ECE-Alia participant activation is not fully visible.",
  "Alia's copper shell still does not expose a certifiable four-centimeter bare midriff, and her strict side profile does not certify one uninterrupted bare upper and middle back free of every neck or rear connector.",
  "Alia's primary trigger index is not certifiably one fully straight finger on the side plate above and entirely outside the empty guard.",
  "The backstop is now complete, but the wet promenade between its right edge and the image edge remains substantially narrower than one complete backstop-width.",
];
const strictAudit = {
  renderSurfaceQuality: "pass-clean-coherent-natural-photographic-texture-with-straight-rain-flat-tiles-straight-architecture-and-no-wavy-marbled-liquified-or-overprocessed-artifacts-after-one-recovery",
  identity: "pass-four-clearly-adult-distinct-identities-with-Alia-sculptural-braided-ponytail",
  anatomy: "pass-exact-eight-traceable-arms-and-eight-traceable-hands-with-two-per-woman",
  handOwnership: "pass-ECE-two-compass-hands-Ellie-two-contact-hands-Radiance-two-contact-hands-and-Alia-two-mission-hands-all-have-continuous-owner-paths",
  weather: "pass-heavy-straight-rain-and-flat-wet-reflective-tiles",
  locationThemeFusion: "pass-recognizable-Batumi-with-Black-Sea-tower-Ferris-wheel-skyline-palms-and-four-distinct-expedition-couture-silhouettes",
  outfitOriginality: "pass-four-distinct-silhouettes-constructions-hems-materials-and-footwear",
  prohibitedUniformStyling: "pass-ECE-civilian-sleeveless-peplum-has-no-patch-badge-epaulette-logo-or-insignia",
  rolledWardrobe: "reject-Alia-visible-midriff-and-fully-open-back-rolls-remain-uncertifiable; Radiance-open-back-and-hosiery-Ellie-midriff-Alia-strapless-front-ECE-covered-waist-and-public-safe-coverage-otherwise-pass",
  romance: "pass-three-visible-contacts-Radiance-outer-shoulder-palm-Ellie-outside-waist-support-and-low-clasp",
  radianceResponse: "reject-Radiance-still-looks-to-Ellie-instead-of-visibly-answering-ECE-with-the-stored-mid-nod",
  partyActivation: "reject-Radiance-ECE-Alia-only-party-beat-is-not-certifiable-because-Radiance-ECE-mutual-gaze-and-Alia-willing-profile-smile-remain-absent",
  mascots: "pass-one-collarless-tiny-golden-PAWS-and-one-accessory-free-small-young-golden-MAX-sharing-one-dry-lounge",
  oddProp: "pass-ECE-alone-holds-two-opposite-compass-handles",
  routeMap: "pass-separate-hands-free-holographic-route-map",
  missionHandling: "reject-two-hand-stance-and-metallic-inert-replica-pass-but-primary-index-is-not-certifiably-fully-straight-on-side-plate-above-and-outside-empty-guard",
  missionTargetAxis: "reject-complete-panel-paper-backstop-and-horizontal-aim-pass-but-right-side-empty-promenade-is-less-than-one-complete-backstop-width",
  recoveryBudget: "consumed-one-of-one-planned-recovery-no-further-edit-chain-permitted",
  accepted: false,
};

checkpoint.status = "active-four-scene-gate-incomplete-after-clean-fresh-round-42";
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
checkpoint.renderAttempts.freshRound42 = {
  ...checkpoint.renderAttempts.freshRound42,
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
  recoveryDecision: {
    attempted: true,
    maximumRecoveryPasses: 1,
    recoveryPassesUsed: 1,
    reason: "The one permitted bounded recovery was used. It preserved clean surfaces, exact anatomy, and contacts and completed the backstop, but the invitation-specific eye line and participant cue, Alia wardrobe rolls, trigger index, and required right-side promenade clearance remain unresolved.",
  },
};
checkpoint.scenePlans["1551"].freshRound42.visualAudit = strictAudit;
checkpoint.rawOutputs.push({
  scene: 1551,
  round: 42,
  kind: "clean-fresh-recovery-rejected",
  path: recoveryRawPath,
  sourcePath: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-8b00881e-2501-498e-893e-93b279770166.png",
  sha256: expectedRecoverySha,
  dimensions: { width: 941, height: 1672 },
});
checkpoint.rejectedAssets.push({
  scene: 1551,
  round: 42,
  phase: "recovery",
  status: "rejected-strict-visual-audit",
  rawOutput: recoveryRawPath,
  sourceRawOutput: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-8b00881e-2501-498e-893e-93b279770166.png",
  sha256: expectedRecoverySha,
  dimensions: { width: 941, height: 1672 },
  decisiveRejectionReasons: rejectionReasons,
  recoveryPassConsumedThisRound: true,
});
checkpoint.renderStrategyReset = {
  ...checkpoint.renderStrategyReset,
  activeCleanRound: null,
  lastCompletedCleanRound: 42,
  lastCleanRoundResult: "clean-Batumi-identities-eight-hands-three-contacts-distinct-outfits-mascots-compass-map-and-artifact-free-surface-pass-but-rejected-Radiance-to-ECE-response-Alia-party-cue-Alia-midriff-open-back-certification-index-and-right-side-backstop-clearance",
  nextCleanRound: 43,
  nextSourcePolicy: "original identity anchors only; no round 42 image input",
  activeSourcePolicy: "four original identity anchors only",
  priorBatumiRenderInputCount: 0,
};
checkpoint.xBacklogAudit = {
  ...checkpoint.xBacklogAudit,
  checkedAt: completedAt,
  signedIn: true,
  sessionState: "live-signed-in-dogramaci-profile-loaded-this-wake",
  eligibleBacklogRemaining: 0,
  pendingPost: null,
  preparedPostQueueCount: 0,
  deferredPostCheckpoint: null,
  reconciliationDecision: "The user-requested full X backlog drain completed after live signed-in @dogramaci reconciliation. No historical country or active Georgia meets its authoritative publication gate, so zero uploads were submitted and no duplicate was created.",
};
checkpoint.xPost.status = "blocked-active-country-incomplete";
checkpoint.xPost.url = null;
checkpoint.xPost.acceptedCurrentCountryAssets = 3;
checkpoint.xPost.note = "Georgia has accepted scenes 1548, 1549, and 1550. Round 42 scene 1551 exhausted its single clean recovery and still failed the invitation-specific Radiance-to-ECE response, Radiance-ECE-Alia party visibility, Alia midriff/open-back certification, indexed-trigger placement, and full right-side backstop clearance. The explicit full X backlog drain found zero eligible posts and submitted no duplicates. Publication remains mandatory after scene 1551 is accepted and the four-scene completion checkpoint is pushed.";
checkpoint.nextQueueStatus = "locked-on-Georgia-until-four-accepted-git-pushed-and-X-live-verified";
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "clean-fresh-round-43-from-original-identity-anchors-scene-1551-only",
  preserveAcceptedSceneNumbers: [1548, 1549, 1550],
  sceneNumbers: [1551],
  laterCountryStartAllowed: false,
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  status: checkpoint.status,
  acceptedSceneCount: checkpoint.countryCompletionGate.acceptedSceneCount,
  missingSceneNumbers: checkpoint.countryCompletionGate.missingSceneNumbers,
  freshRawSha256: expectedFreshSha,
  recoveryRawSha256: expectedRecoverySha,
  accepted: false,
  recoveryBudget: strictAudit.recoveryBudget,
  eligibleXBacklogRemaining: checkpoint.xBacklogAudit.eligibleBacklogRemaining,
  nextWakeAction: checkpoint.nextWakeAction,
}, null, 2));
