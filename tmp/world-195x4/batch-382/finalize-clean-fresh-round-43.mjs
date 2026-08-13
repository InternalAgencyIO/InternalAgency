import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const checkpointPath = path.join(repo, "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json");
const contractPath = path.join(repo, "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const ledgerPath = path.join(repo, "assets/lore/starlight-era/world-x-publish-ledger.json");
const freshRawPath = "tmp/world-195x4/batch-382/raw/clean-fresh-round-43/scene-1551.png";
const sourceRawPath = "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-38ac0f6c-921f-4e92-905e-811e8c8d9c48.png";
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").toUpperCase();
}

const expectedContractSha = "69EB6C84A2467A4234D901C3086ECECE9E583B55C41BB9382CD5ED523C482EF5";
const expectedLedgerSha = "33F29A1FB48F2971D78C9B345AA378B84C73FE16BDBE468AFFF695972B63C44E";
const expectedFreshSha = "CAAA240EE1B6418348E6191081EA5B59C351806096DC759508E16A0524853618";
if (sha256File(contractPath) !== expectedContractSha) throw new Error("Contract changed during round 43");
if (sha256File(ledgerPath) !== expectedLedgerSha) throw new Error("Ledger changed during round 43");
if (sha256File(path.join(repo, freshRawPath)) !== expectedFreshSha) throw new Error("Round 43 fresh raw changed");
if (checkpoint.status !== "active-four-scene-gate-clean-fresh-round-43-materialized") throw new Error(`Unexpected status: ${checkpoint.status}`);
if (checkpoint.rawOutputs.some((item) => item.scene === 1551 && item.round === 43)) throw new Error("Round 43 raw already recorded");

const completedAt = new Date().toISOString();
const rejectionReasons = [
  "Only the Ellie-Radiance hand clasp is visible; the outside-waist support and Radiance palm on Ellie's upper arm are absent, so the required three-contact hard-love event and controlled shallow dip do not read.",
  "Radiance and ECE do exchange a clear willing mutual gaze, but Alia remains focused and neutral without a visible willing smile, so the stored Radiance-ECE-Alia party activation is not fully certifiable.",
  "Radiance's fully open back is not visible from the front-side pose, while Alia's copper shell wraps around the rear ribs with a visible rear closure; both active fully-open-back rolls fail.",
  "Alia has two traceable mission arms and hands, but her trigger index appears inside or against the guard rather than fully straight on the side plate above and outside the empty guard.",
  "Alia aims to camera-right while the paper target and sand backstop sit behind the muzzle to camera-left; the target is not downrange, and less than one full backstop-width of empty promenade remains beyond the backstop.",
];
const strictAudit = {
  renderSurfaceQuality: "pass-clean-natural-photographic-texture-with-straight-landmarks-flat-tiles-coherent-rain-and-no-wavy-marbled-liquified-or-overprocessed-artifacts",
  identity: "pass-four-clearly-adult-distinct-identities-with-Alia-sculptural-braided-ponytail",
  anatomy: "pass-exact-eight-traceable-human-arms-and-eight-traceable-human-hands-with-two-per-woman",
  handOwnership: "pass-Ellie-two-hands-Radiance-two-hands-ECE-two-compass-hands-and-Alia-two-mission-hands-have-continuous-owner-paths",
  weather: "pass-heavy-straight-rain-and-flat-wet-reflective-tiles",
  locationThemeFusion: "pass-recognizable-Batumi-with-Alphabet-Tower-Ferris-wheel-Black-Sea-skyline-palms-and-four-distinct-expedition-couture-silhouettes",
  outfitOriginality: "pass-four-distinct-silhouettes-constructions-hems-materials-and-footwear",
  prohibitedUniformStyling: "pass-ECE-civilian-sleeveless-peplum-has-no-patch-badge-epaulette-logo-or-insignia",
  rolledWardrobe: "reject-Radiance-and-Alia-fully-open-back-rolls-are-not-certifiable; Radiance-hosiery-and-covered-waist-Ellie-midriff-Alia-midriff-and-strapless-and-ECE-covered-waist-otherwise-pass",
  romance: "reject-only-one-Ellie-Radiance-hand-clasp-is-visible-and-the-required-side-waist-support-upper-arm-palm-and-shallow-dip-are-absent",
  radianceResponse: "pass-Radiance-visibly-answers-ECE-with-a-direct-willing-mutual-eye-line-and-open-smile",
  partyActivation: "reject-Radiance-ECE-mutual-agreement-passes-but-Alia-has-no-visible-willing-smile-so-the-three-participant-party-is-not-fully-certifiable",
  mascots: "pass-one-tiny-collarless-golden-PAWS-and-one-small-accessory-free-young-golden-MAX-sharing-one-raised-lounge",
  oddProp: "pass-ECE-alone-holds-the-two-opposite-compass-handles",
  routeMap: "pass-separate-hands-free-holographic-route-map",
  missionHandling: "reject-two-hand-owner-paths-and-full-size-metallic-replica-pass-but-trigger-index-is-not-certifiably-straight-above-and-outside-the-guard",
  missionTargetAxis: "reject-paper-and-backstop-are-behind-the-rightward-muzzle-and-right-side-promenade-is-less-than-one-full-backstop-width; complete-panel-paper-and-backstop-framing-otherwise-pass",
  recoveryDecision: "not-launched-because-failures-span-the-entire-three-contact-romance-graph-two-open-back-wardrobes-Alia-party-evidence-trigger-index-and-reversed-target-axis; one recovery would require broad redraw rather than a narrow correction",
  recoveryBudget: "zero-recovery-passes-used; round-43-closed-after-one-clean-fresh-pass",
  accepted: false,
};

checkpoint.status = "active-four-scene-gate-incomplete-after-clean-fresh-round-43";
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
checkpoint.renderAttempts.freshRound43 = {
  ...checkpoint.renderAttempts.freshRound43,
  status: "completed-rejected-no-recovery-broad-failure",
  completedAt,
  rawOutputs: { 1551: { fresh: { path: freshRawPath, sha256: expectedFreshSha, preserved: true } } },
  acceptedSceneNumbers: [],
  rejectedSceneNumbers: [1551],
  rejectionReasons: { 1551: rejectionReasons },
  strictAudit,
  recoveryDecision: { attempted: false, maximumRecoveryPasses: 1, recoveryPassesUsed: 0, reason: strictAudit.recoveryDecision },
};
checkpoint.scenePlans["1551"].freshRound43.visualAudit = strictAudit;
checkpoint.rawOutputs.push({
  scene: 1551,
  round: 43,
  kind: "clean-fresh-rejected-no-recovery",
  path: freshRawPath,
  sourcePath: sourceRawPath,
  sha256: expectedFreshSha,
  dimensions: { width: 941, height: 1672 },
});
checkpoint.rejectedAssets.push({
  scene: 1551,
  round: 43,
  phase: "fresh",
  status: "rejected-strict-visual-audit-no-recovery-broad-failure",
  rawOutput: freshRawPath,
  sourceRawOutput: sourceRawPath,
  sha256: expectedFreshSha,
  dimensions: { width: 941, height: 1672 },
  decisiveRejectionReasons: rejectionReasons,
  recoveryPassConsumedThisRound: false,
  recoveryNotAttemptedReason: strictAudit.recoveryDecision,
});
checkpoint.renderStrategyReset = {
  ...checkpoint.renderStrategyReset,
  activeCleanRound: null,
  lastCompletedCleanRound: 43,
  lastCleanRoundResult: "clean-artifact-free-Batumi-identities-eight-hands-distinct-outfits-compass-map-and-mascots-pass-but-rejected-three-contact-romance-two-open-backs-Alia-party-evidence-trigger-index-and-reversed-target-axis",
  nextCleanRound: 44,
  nextSourcePolicy: "original identity anchors only; no round 43 image input",
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
  reconciliationDecision: "The signed-in live @dogramaci profile loaded successfully and the authoritative ledger still has no eligible pending, prepared, or deferred item. Georgia remains publication-blocked at three accepted scenes, so no upload or country advance is permitted.",
};
checkpoint.xPost.status = "blocked-active-country-incomplete";
checkpoint.xPost.url = null;
checkpoint.xPost.acceptedCurrentCountryAssets = 3;
checkpoint.xPost.note = "Georgia has accepted scenes 1548, 1549, and 1550. Round 43 scene 1551 rendered with clean artifact-free surfaces and exact eight-hand anatomy but failed the three-contact hard-love graph, both active open-back rolls, Alia's willing party cue, indexed trigger placement, and the downrange target axis. No recovery was launched because those failures require broad redraw. The live @dogramaci profile is verified and the eligible backlog remains zero. Publication remains mandatory after scene 1551 is accepted and the four-scene completion checkpoint is pushed.";
checkpoint.nextQueueStatus = "locked-on-Georgia-until-four-accepted-git-pushed-and-X-live-verified";
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "clean-fresh-round-44-from-original-identity-anchors-scene-1551-only",
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
  surfaceQuality: strictAudit.renderSurfaceQuality,
  accepted: false,
  recoveryDecision: strictAudit.recoveryDecision,
  nextWakeAction: checkpoint.nextWakeAction,
}, null, 2));
