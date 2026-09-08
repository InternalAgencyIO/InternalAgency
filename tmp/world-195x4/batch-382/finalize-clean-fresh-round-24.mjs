import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const checkpointPath = path.join(repo, "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json");
const contractPath = path.join(repo, "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const ledgerPath = path.join(repo, "assets/lore/starlight-era/world-x-publish-ledger.json");
const rawPath = "tmp/world-195x4/batch-382/raw/clean-fresh-round-24/scene-1551.png";
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").toUpperCase();
}

const expectedContractSha = "69EB6C84A2467A4234D901C3086ECECE9E583B55C41BB9382CD5ED523C482EF5";
const expectedLedgerSha = "B94AA3FB2B1AB1BCAB100CE689F0173C77407B82439D73379D8BC0FA3EEC2455";
const expectedRawSha = "9ABA91F43F79B6E16B9EB6956D668E68C3352B6216356D4C1D7D515A34A9746B";
if (sha256File(contractPath) !== expectedContractSha) throw new Error("Authoritative contract changed during round 24");
if (sha256File(ledgerPath) !== expectedLedgerSha) throw new Error("X publishing ledger changed during round 24");
if (sha256File(path.join(repo, rawPath)) !== expectedRawSha) throw new Error("Clean round 24 raw changed");
if (checkpoint.status !== "active-four-scene-gate-clean-fresh-round-24-materialized") {
  throw new Error(`Unexpected checkpoint status: ${checkpoint.status}`);
}

const completedAt = new Date().toISOString();
const rejectionReasons = [
  "Ellie remains upright instead of performing the mandatory stable controlled dance dip",
  "Radiance and Ellie's second arms do not remain continuously visible and the required Ellie-to-ECE shoulder contact is absent",
  "Radiance looks toward Ellie instead of visibly affirming Alia's invitation and sustaining the recorded affectionate eye line to ECE",
  "Alia's bodice adds a forbidden neck loop and upper-back band despite the active strapless and fully-open-back rolls",
  "Alia's mission hands remain fused at the small replica, leaving the straight indexed trigger finger and empty trigger guard unauditable",
  "PAWS and MAX stand on wet tiles instead of the required dry padded lounge",
];
const strictAudit = {
  renderSurfaceQuality: "pass-clean-natural-photographic-texture-without-wavy-artifacts",
  identity: "pass-four-adult-identities-with-Alia-braids",
  anatomy: "reject-left-contact-graph-has-hidden-or-missing-second-arm-paths-and-Alia-hand-clusters-are-fused",
  handOwnership: "reject-required-eight-distinct-traceable-arms-and-hands-not-auditable",
  weather: "pass-heavy-straight-rain",
  locationThemeFusion: "pass-recognizable-Batumi-with-distinct-Mars-expedition-couture",
  outfitOriginality: "pass-four-distinct-silhouettes-constructions-and-footwear",
  rolledWardrobe: "reject-Alia-active-strapless-and-fully-open-back-rolls-because-neck-and-back-bands-appear",
  romance: "reject-Ellie-is-upright-and-required-controlled-dip-plus-three-contact-graph-is-missing",
  radianceResponse: "reject-round-24-explicit-affirmative-response-not-visible-in-head-torso-or-eye-line",
  partyActivation: "reject-party-is-not-readable-for-the-recorded-Radiance-ECE-Alia-willing-participants",
  mascots: "reject-one-PAWS-and-one-MAX-appear-but-on-wet-tiles-without-the-required-dry-padded-lounge",
  oddProp: "pass-ECE-two-hands-on-opposite-compass-handles",
  routeMap: "pass-separate-hands-free-holographic-map",
  missionHandling: "reject-Alia-two-hand-separation-straight-index-and-empty-trigger-guard-remain-unauditable",
  missionTargetAxis: "pass-paper-diamond-is-distant-separated-and-near-the-visible-shoulder-height-axis",
  recoveryDecision: "not-attempted-because-six-independent-zones-failed-and-a-broad-edit-would-violate-the-clean-planned-pass-policy",
  accepted: false,
};

checkpoint.status = "active-four-scene-gate-incomplete-after-clean-fresh-round-24";
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
checkpoint.renderAttempts.freshRound24 = {
  ...checkpoint.renderAttempts.freshRound24,
  status: "completed-rejected-without-recovery",
  completedAt,
  rawOutputs: {
    1551: { path: rawPath, sha256: expectedRawSha, preserved: true },
  },
  acceptedSceneNumbers: [],
  rejectedSceneNumbers: [1551],
  rejectionReasons: { 1551: rejectionReasons },
  recoveryDecision: {
    attempted: false,
    maximumRecoveryPasses: 1,
    recoveryPassesUsed: 0,
    reason: "The clean raw misses anatomy, hard-love action, live agreement, wardrobe, mission-hand, and mascot-footing gates across six zones; start a new clean round instead of a broad artifact-prone edit.",
  },
  strictAudit,
};
checkpoint.scenePlans["1551"].freshRound24.visualAudit = strictAudit;
checkpoint.rawOutputs.push({
  scene: 1551,
  round: 24,
  kind: "clean-fresh-rejected-no-recovery",
  path: rawPath,
  sourcePath: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-bcf9cb76-2c09-4378-98bc-b4accfe59c54.png",
  sha256: expectedRawSha,
  dimensions: { width: 941, height: 1672 },
});
checkpoint.rejectedAssets.push({
  scene: 1551,
  round: 24,
  phase: "fresh",
  status: "rejected-strict-visual-audit-no-recovery",
  rawOutput: rawPath,
  sourceRawOutput: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-bcf9cb76-2c09-4378-98bc-b4accfe59c54.png",
  sha256: expectedRawSha,
  dimensions: { width: 941, height: 1672 },
  decisiveRejectionReasons: rejectionReasons,
  recoveryPassConsumedThisRound: false,
  broadRecoveryDeclinedToPreventArtifactAccumulation: true,
});
checkpoint.renderStrategyReset = {
  ...checkpoint.renderStrategyReset,
  activeCleanRound: null,
  lastCompletedCleanRound: 24,
  lastCleanRoundResult: "clean-surface-fresh-rejected-without-broad-recovery",
  nextCleanRound: 25,
  nextSourcePolicy: "original identity anchors only; no round 24 image input",
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
  latestVisibleAccountStatus: {
    url: "https://x.com/dogramaci/status/2087242564432806133",
    validCountryPairCaption: false,
    classification: "unrelated-account-post-not-a-World-Series-ledger-item",
  },
  reconciliationDecision: "Signed-in profile checked and no eligible unposted World Series country pair remains. Georgia still has three accepted scenes, so no X upload or country advance is permitted.",
};
checkpoint.xPost.status = "blocked-active-country-incomplete-not-skipped";
checkpoint.xPost.url = null;
checkpoint.xPost.acceptedCurrentCountryAssets = 3;
checkpoint.xPost.note = "Georgia has accepted scenes 1548, 1549, and 1550. Round 24 scene 1551 failed broad strict gates and received no recovery to avoid artifact accumulation. Publication remains mandatory after scene 1551 is accepted and the four-scene completion checkpoint is pushed.";
checkpoint.nextQueueStatus = "locked-on-Georgia-until-four-accepted-git-pushed-and-X-live-verified";
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "clean-fresh-round-25-from-original-identity-anchors-scene-1551-only",
  preserveAcceptedSceneNumbers: [1548, 1549, 1550],
  sceneNumbers: [1551],
  laterCountryStartAllowed: false,
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  status: checkpoint.status,
  acceptedSceneCount: checkpoint.countryCompletionGate.acceptedSceneCount,
  missingSceneNumbers: checkpoint.countryCompletionGate.missingSceneNumbers,
  rawSha256: expectedRawSha,
  accepted: false,
  recoveryAttempted: false,
  nextWakeAction: checkpoint.nextWakeAction,
}, null, 2));
