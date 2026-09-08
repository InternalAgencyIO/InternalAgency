import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const checkpointPath = path.join(repo, "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json");
const contractPath = path.join(repo, "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const ledgerPath = path.join(repo, "assets/lore/starlight-era/world-x-publish-ledger.json");
const freshRawPath = "tmp/world-195x4/batch-382/raw/clean-fresh-round-25/scene-1551.png";
const recoveryRawPath = "tmp/world-195x4/batch-382/raw/clean-fresh-round-25-recovery/scene-1551.png";
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").toUpperCase();
}

const expectedContractSha = "69EB6C84A2467A4234D901C3086ECECE9E583B55C41BB9382CD5ED523C482EF5";
const expectedLedgerSha = "B94AA3FB2B1AB1BCAB100CE689F0173C77407B82439D73379D8BC0FA3EEC2455";
const expectedFreshSha = "2990E5B728916EF3946D4A4497EA54EF56BBF055BD1B18D426EC7832C00FBB20";
const expectedRecoverySha = "F27524045E26CC2C61CF10F23F6419317B97DC2AB59D172A3674AF8534E46219";
if (sha256File(contractPath) !== expectedContractSha) throw new Error("Authoritative contract changed during round 25 recovery");
if (sha256File(ledgerPath) !== expectedLedgerSha) throw new Error("X publishing ledger changed during round 25 recovery");
if (sha256File(path.join(repo, freshRawPath)) !== expectedFreshSha) throw new Error("Clean round 25 fresh raw changed");
if (sha256File(path.join(repo, recoveryRawPath)) !== expectedRecoverySha) throw new Error("Clean round 25 recovery raw changed");
if (checkpoint.status !== "active-four-scene-gate-clean-fresh-round-25-recovery-materialized") {
  throw new Error(`Unexpected checkpoint status: ${checkpoint.status}`);
}

const completedAt = new Date().toISOString();
const rejectionReasons = [
  "Radiance's non-clasp support hand and forearm remain hidden between the two left torsos instead of continuously traceable",
  "Radiance continues looking toward Ellie instead of visibly turning and sustaining the recorded affectionate eye line to ECE",
  "Alia's recovery closes her active fully-open-back construction with an opaque copper corset panel",
  "Alia's required restrained visible midriff band is absent in the recovered rear three-quarter view",
  "Alia remains fully focused downrange without a readable willing side-eye nod for the all-four party beat",
];
const strictAudit = {
  renderSurfaceQuality: "pass-clean-natural-photographic-texture-without-wavy-artifacts-after-one-recovery",
  identity: "pass-four-adult-identities-with-Alia-braids",
  anatomy: "reject-Radiance-non-clasp-support-hand-and-forearm-remain-hidden-between-torsos",
  handOwnership: "reject-one-left-support-owner-path-not-continuously-visible; all other arms and hands are distinct",
  weather: "pass-heavy-straight-rain",
  locationThemeFusion: "pass-recognizable-Batumi-with-distinct-Mars-expedition-couture",
  outfitOriginality: "pass-four-distinct-silhouettes-constructions-and-footwear",
  rolledWardrobe: "reject-Alia-active-fully-open-back-and-visible-midriff-rolls; Radiance-open-back-and-other-active-rolls-pass",
  romance: "pass-stable-shallow-dip-reciprocal-clasp-and-three-clear-left-group-contacts",
  radianceResponse: "reject-round-25-affirmative-ECE-eye-line-and-torso-turn-not-visible",
  partyActivation: "reject-all-four-party-beat-because-Radiance-ECE-center-and-Alia-willing-nod-are-not-readable",
  mascots: "pass-one-PAWS-and-one-MAX-together-on-raised-dry-padded-lounge",
  oddProp: "pass-ECE-two-hands-on-opposite-compass-handles",
  routeMap: "pass-separate-hands-free-holographic-map",
  missionHandling: "pass-full-size-heavy-metallic-inert-replica-with-two-distinct-Alia-hands-and-indexed-finger-outside-visible-guard",
  missionTargetAxis: "pass-distant-separated-paper-diamond-and-complete-backstop-aligned-to-safe-muzzle-axis",
  recoveryBudget: "consumed-one-of-one-planned-recovery-no-further-edit-chain-permitted",
  accepted: false,
};

checkpoint.status = "active-four-scene-gate-incomplete-after-clean-fresh-round-25";
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
checkpoint.renderAttempts.freshRound25 = {
  ...checkpoint.renderAttempts.freshRound25,
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
checkpoint.scenePlans["1551"].freshRound25.visualAudit = strictAudit;
checkpoint.rawOutputs.push({
  scene: 1551,
  round: 25,
  kind: "clean-fresh-recovery-rejected",
  path: recoveryRawPath,
  sourcePath: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-90071896-0b5d-4a65-be32-b074a9c409dc.png",
  sha256: expectedRecoverySha,
  dimensions: { width: 941, height: 1672 },
});
checkpoint.rejectedAssets.push({
  scene: 1551,
  round: 25,
  phase: "recovery",
  status: "rejected-strict-visual-audit",
  rawOutput: recoveryRawPath,
  sourceRawOutput: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-90071896-0b5d-4a65-be32-b074a9c409dc.png",
  sha256: expectedRecoverySha,
  dimensions: { width: 941, height: 1672 },
  decisiveRejectionReasons: rejectionReasons,
  recoveryPassConsumedThisRound: true,
});
checkpoint.renderStrategyReset = {
  ...checkpoint.renderStrategyReset,
  activeCleanRound: null,
  lastCompletedCleanRound: 25,
  lastCleanRoundResult: "clean-surface-recovery-improved-mission-and-romance-but-rejected-anatomy-live-response-and-Alia-rolls",
  nextCleanRound: 26,
  nextSourcePolicy: "original identity anchors only; no round 25 image input",
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
checkpoint.xPost.note = "Georgia has accepted scenes 1548, 1549, and 1550. Round 25 scene 1551 exhausted its single recovery and still failed anatomy, live-response, and Alia wardrobe gates. Publication remains mandatory after scene 1551 is accepted and the four-scene completion checkpoint is pushed.";
checkpoint.nextQueueStatus = "locked-on-Georgia-until-four-accepted-git-pushed-and-X-live-verified";
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "clean-fresh-round-26-from-original-identity-anchors-scene-1551-only",
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
