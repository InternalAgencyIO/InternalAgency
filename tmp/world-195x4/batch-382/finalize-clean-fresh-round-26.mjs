import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const checkpointPath = path.join(repo, "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json");
const contractPath = path.join(repo, "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const ledgerPath = path.join(repo, "assets/lore/starlight-era/world-x-publish-ledger.json");
const freshRawPath = "tmp/world-195x4/batch-382/raw/clean-fresh-round-26/scene-1551.png";
const recoveryRawPath = "tmp/world-195x4/batch-382/raw/clean-fresh-round-26-recovery/scene-1551.png";
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").toUpperCase();
}

const expectedContractSha = "69EB6C84A2467A4234D901C3086ECECE9E583B55C41BB9382CD5ED523C482EF5";
const expectedLedgerSha = "B94AA3FB2B1AB1BCAB100CE689F0173C77407B82439D73379D8BC0FA3EEC2455";
const expectedFreshSha = "788A758ED635B73D7041775BE66593150EF6C4BDBFD45F1F2F181E28C82C1EB8";
const expectedRecoverySha = "6817246F1CC4D62B749ECA001366FA91F23E62F72577F5047B3B43CD869A4054";
if (sha256File(contractPath) !== expectedContractSha) throw new Error("Authoritative contract changed during round 26 recovery");
if (sha256File(ledgerPath) !== expectedLedgerSha) throw new Error("X publishing ledger changed during round 26 recovery");
if (sha256File(path.join(repo, freshRawPath)) !== expectedFreshSha) throw new Error("Clean round 26 fresh raw changed");
if (sha256File(path.join(repo, recoveryRawPath)) !== expectedRecoverySha) throw new Error("Clean round 26 recovery raw changed");
if (checkpoint.status !== "active-four-scene-gate-clean-fresh-round-26-recovery-materialized") {
  throw new Error(`Unexpected checkpoint status: ${checkpoint.status}`);
}

const completedAt = new Date().toISOString();
const rejectionReasons = [
  "Radiance's existing non-clasp arm and hand still hang at her side instead of visibly supporting Ellie's upper back",
  "The left romance group has only the raised clasp and Ellie's palm on Radiance, so the required three-contact supported dip is not the first read",
  "Radiance continues looking toward Ellie instead of visibly redirecting ECE's invitation toward the holographic route map",
  "Alia's strapless copper top meets the cobalt skirt without the required clearly visible restrained midriff band",
  "Alia's upper-back construction is too side-on to prove the active fully-open-back roll",
  "The inert replica's orange muzzle plug and fully indexed trigger finger outside an entirely empty guard are not auditably clear",
];
const strictAudit = {
  renderSurfaceQuality: "pass-clean-natural-photographic-texture-without-wavy-artifacts-after-one-recovery",
  identity: "pass-four-adult-identities-with-Alia-braids",
  anatomy: "pass-exactly-eight-human-arms-and-eight-human-hands-with-traceable-owners",
  handOwnership: "pass-two-hands-per-woman-and-no-extra-fused-floating-or-borrowed-limb",
  weather: "pass-heavy-straight-rain",
  locationThemeFusion: "pass-recognizable-Batumi-with-four-distinct-futurist-expedition-silhouettes",
  outfitOriginality: "pass-four-distinct-silhouettes-constructions-hems-and-footwear",
  rolledWardrobe: "reject-Alia-active-visible-midriff-and-fully-open-back-read; Radiance-open-back-and-other-active-rolls-pass",
  romance: "reject-only-two-clear-relationship-contacts-and-no-visible-upper-back-support-so-hard-love-dip-fails",
  radianceResponse: "reject-round-26-explicit-redirect-to-ECE-route-map-not-visible",
  partyActivation: "pass-party-remains-inactive-with-no-celebration-or-party-object",
  mascots: "pass-one-PAWS-and-one-MAX-together-on-raised-dry-padded-lounge",
  oddProp: "pass-ECE-two-hands-on-opposite-compass-handles",
  routeMap: "pass-separate-hands-free-holographic-map",
  missionHandling: "reject-orange-muzzle-plug-and-indexed-finger-outside-empty-guard-not-auditably-clear",
  missionTargetAxis: "pass-separated-paper-diamond-complete-backstop-and-safe-right-facing-axis",
  recoveryBudget: "consumed-one-of-one-planned-recovery-no-further-edit-chain-permitted",
  accepted: false,
};

checkpoint.status = "active-four-scene-gate-incomplete-after-clean-fresh-round-26";
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
checkpoint.renderAttempts.freshRound26 = {
  ...checkpoint.renderAttempts.freshRound26,
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
checkpoint.scenePlans["1551"].freshRound26.visualAudit = strictAudit;
checkpoint.rawOutputs.push({
  scene: 1551,
  round: 26,
  kind: "clean-fresh-recovery-rejected",
  path: recoveryRawPath,
  sourcePath: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-285775b3-dff0-4c63-b49a-ecade28adf83.png",
  sha256: expectedRecoverySha,
  dimensions: { width: 941, height: 1672 },
});
checkpoint.rejectedAssets.push({
  scene: 1551,
  round: 26,
  phase: "recovery",
  status: "rejected-strict-visual-audit",
  rawOutput: recoveryRawPath,
  sourceRawOutput: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-285775b3-dff0-4c63-b49a-ecade28adf83.png",
  sha256: expectedRecoverySha,
  dimensions: { width: 941, height: 1672 },
  decisiveRejectionReasons: rejectionReasons,
  recoveryPassConsumedThisRound: true,
});
checkpoint.renderStrategyReset = {
  ...checkpoint.renderStrategyReset,
  activeCleanRound: null,
  lastCompletedCleanRound: 26,
  lastCleanRoundResult: "clean-surface-recovery-kept-anatomy-and-improved-backstop-but-rejected-romance-live-response-Alia-rolls-and-prop-audit",
  nextCleanRound: 27,
  nextSourcePolicy: "original identity anchors only; no round 26 image input",
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
  latestVisibleAccountStatuses: [
    "https://x.com/dogramaci/status/2087242564432806133",
    "https://x.com/dogramaci/status/2087241970661941705",
  ],
  reconciliationDecision: "Signed-in live profile checked and no eligible unposted World Series country pair exists. Georgia still has three accepted scenes, so no X upload or country advance is permitted.",
};
checkpoint.xPost.status = "blocked-active-country-incomplete-not-skipped";
checkpoint.xPost.url = null;
checkpoint.xPost.acceptedCurrentCountryAssets = 3;
checkpoint.xPost.note = "Georgia has accepted scenes 1548, 1549, and 1550. Round 26 scene 1551 exhausted its single clean recovery and still failed romance, live-response, Alia wardrobe, and mission-prop audit gates. Publication remains mandatory after scene 1551 is accepted and the four-scene completion checkpoint is pushed.";
checkpoint.nextQueueStatus = "locked-on-Georgia-until-four-accepted-git-pushed-and-X-live-verified";
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "clean-fresh-round-27-from-original-identity-anchors-scene-1551-only",
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
