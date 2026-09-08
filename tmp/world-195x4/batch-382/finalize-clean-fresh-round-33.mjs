import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const checkpointPath = path.join(repo, "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json");
const contractPath = path.join(repo, "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const ledgerPath = path.join(repo, "assets/lore/starlight-era/world-x-publish-ledger.json");
const freshRawPath = "tmp/world-195x4/batch-382/raw/clean-fresh-round-33/scene-1551.png";
const recoveryRawPath = "tmp/world-195x4/batch-382/raw/clean-fresh-round-33-recovery/scene-1551.png";
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").toUpperCase();
}

const expectedContractSha = "69EB6C84A2467A4234D901C3086ECECE9E583B55C41BB9382CD5ED523C482EF5";
const expectedLedgerSha = "B94AA3FB2B1AB1BCAB100CE689F0173C77407B82439D73379D8BC0FA3EEC2455";
const expectedFreshSha = "6302AD462F216EDD022224E8F82A946292CB95BE034AFA2CFFE6CF8A7F25ED76";
const expectedRecoverySha = "B273C9E0D8C3E99D49B5E927B7F4478F1D1CBB7F9622F3D491F6DB93C66FFF1D";
if (sha256File(contractPath) !== expectedContractSha) throw new Error("Contract changed during round 33 recovery");
if (sha256File(ledgerPath) !== expectedLedgerSha) throw new Error("Ledger changed during round 33 recovery");
if (sha256File(path.join(repo, freshRawPath)) !== expectedFreshSha) throw new Error("Round 33 fresh raw changed");
if (sha256File(path.join(repo, recoveryRawPath)) !== expectedRecoverySha) throw new Error("Round 33 recovery raw changed");
if (checkpoint.status !== "active-four-scene-gate-clean-fresh-round-33-recovery-materialized") throw new Error(`Unexpected status: ${checkpoint.status}`);

const completedAt = new Date().toISOString();
const rejectionReasons = [
  "The covered shoulder-to-covered-torso brace remains visually ambiguous, so the required third relationship contact is not unmistakably closed.",
  "A copper rear band still crosses Alia's lower-middle back before the secure lower-back waistline, failing her active fully-open-back roll.",
  "ECE visibly answers the agreed one-count party beat, but Alia remains downrange with an unreadable expression and no auditable heel-tap, so the exact Radiance-ECE-Alia participant set is not fully visible.",
  "The inert replica is cleaner and has a visible orange muzzle insert, but it remains below the planned twenty-percent frame width and Alia's straight index entirely outside a visibly empty trigger guard is not auditable.",
];
const strictAudit = {
  renderSurfaceQuality: "pass-clean-coherent-photographic-texture-with-straight-rain-flat-tiles-and-no-wavy-marbling-after-one-recovery",
  identity: "pass-four-adult-identities-with-Alia-braids",
  anatomy: "pass-exact-eight-arms-and-eight-hands-with-continuous-owner-paths",
  handOwnership: "pass-two-hands-per-woman-with-visible-clasp-support-compass-and-mission-grips",
  weather: "pass-heavy-straight-rain-and-flat-wet-tiles",
  locationThemeFusion: "pass-recognizable-Batumi-with-Alphabet-Tower-Ferris-wheel-sea-skyline-and-four-distinct-expedition-silhouettes",
  outfitOriginality: "pass-four-distinct-silhouettes-constructions-hems-materials-and-footwear",
  rolledWardrobe: "partial-active-midriff-and-strapless-rolls-pass-and-Radiance-open-back-passes-but-Alia-open-back-retains-a-crossing-copper-band",
  romance: "reject-lifted-clasp-and-visible-support-palm-pass-but-covered-shoulder-third-contact-remains-ambiguous",
  radianceResponse: "pass-explicit-affirmative-through-broad-willing-smile-and-open-invitation-palm",
  partyActivation: "reject-ECE-visibly-joins-but-Alia-response-remains-unreadable-for-the-exact-Radiance-ECE-Alia-participant-set",
  partyExclusion: "pass-Ellie-remains-calm-supportive-and-outside-the-optional-one-count-party",
  mascots: "pass-one-PAWS-and-one-MAX-together-on-raised-dry-bed",
  oddProp: "pass-ECE-two-hands-on-opposite-compass-handles",
  routeMap: "pass-separate-hands-free-holographic-map",
  missionHandling: "reject-metal-replica-and-orange-muzzle-insert-pass-but-size-and-index-outside-empty-guard-remain-unauditable",
  missionTargetAxis: "pass-paper-diamond-complete-backstop-safety-panel-and-safe-right-facing-axis",
  recoveryBudget: "consumed-one-of-one-planned-recovery-no-further-edit-chain-permitted",
  accepted: false,
};

checkpoint.status = "active-four-scene-gate-incomplete-after-clean-fresh-round-33";
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
checkpoint.renderAttempts.freshRound33 = {
  ...checkpoint.renderAttempts.freshRound33,
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
checkpoint.scenePlans["1551"].freshRound33.visualAudit = strictAudit;
checkpoint.rawOutputs.push({
  scene: 1551,
  round: 33,
  kind: "clean-fresh-recovery-rejected",
  path: recoveryRawPath,
  sourcePath: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-d8900333-1b56-45d3-9247-0e60b94be947.png",
  sha256: expectedRecoverySha,
  dimensions: { width: 941, height: 1672 },
});
checkpoint.rejectedAssets.push({
  scene: 1551,
  round: 33,
  phase: "recovery",
  status: "rejected-strict-visual-audit",
  rawOutput: recoveryRawPath,
  sourceRawOutput: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-d8900333-1b56-45d3-9247-0e60b94be947.png",
  sha256: expectedRecoverySha,
  dimensions: { width: 941, height: 1672 },
  decisiveRejectionReasons: rejectionReasons,
  recoveryPassConsumedThisRound: true,
});
checkpoint.renderStrategyReset = {
  ...checkpoint.renderStrategyReset,
  activeCleanRound: null,
  lastCompletedCleanRound: 33,
  lastCleanRoundResult: "clean-Batumi-identities-anatomy-dip-mascots-compass-map-target-and-replica-insert-pass-but-rejected-ambiguous-third-contact-Alia-back-band-Alia-party-evidence-and-replica-guard-audit",
  nextCleanRound: 34,
  nextSourcePolicy: "original identity anchors only; no round 33 image input",
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
checkpoint.xPost.note = "Georgia has accepted scenes 1548, 1549, and 1550. Round 33 scene 1551 exhausted its single clean recovery and still failed the unmistakable third-contact, Alia open-back, exact scoped-party-evidence, and replica-guard-audit gates. Publication remains mandatory after scene 1551 is accepted and the four-scene completion checkpoint is pushed.";
checkpoint.nextQueueStatus = "locked-on-Georgia-until-four-accepted-git-pushed-and-X-live-verified";
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "clean-fresh-round-34-from-original-identity-anchors-scene-1551-only",
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
