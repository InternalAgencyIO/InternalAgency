import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const checkpointPath = path.join(repo, "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json");
const contractPath = path.join(repo, "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const ledgerPath = path.join(repo, "assets/lore/starlight-era/world-x-publish-ledger.json");
const freshRawPath = "tmp/world-195x4/batch-382/raw/clean-fresh-round-28/scene-1551.png";
const recoveryRawPath = "tmp/world-195x4/batch-382/raw/clean-fresh-round-28-recovery/scene-1551.png";
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").toUpperCase();
}

const expectedContractSha = "69EB6C84A2467A4234D901C3086ECECE9E583B55C41BB9382CD5ED523C482EF5";
const expectedLedgerSha = "B94AA3FB2B1AB1BCAB100CE689F0173C77407B82439D73379D8BC0FA3EEC2455";
const expectedFreshSha = "78D9E48EEFB1005D5BDAE50DB6F95248065231587D9C43174672E51A4B2F19F2";
const expectedRecoverySha = "D11C42AD81AC7D9DBFDF4BE0491D7D6E926A91D25E0F3C5472C4FFBEF76F8FC0";
if (sha256File(contractPath) !== expectedContractSha) throw new Error("Contract changed during round 28 recovery");
if (sha256File(ledgerPath) !== expectedLedgerSha) throw new Error("Ledger changed during round 28 recovery");
if (sha256File(path.join(repo, freshRawPath)) !== expectedFreshSha) throw new Error("Round 28 fresh raw changed");
if (sha256File(path.join(repo, recoveryRawPath)) !== expectedRecoverySha) throw new Error("Round 28 recovery raw changed");
if (checkpoint.status !== "active-four-scene-gate-clean-fresh-round-28-recovery-materialized") throw new Error(`Unexpected status: ${checkpoint.status}`);

const completedAt = new Date().toISOString();
const rejectionReasons = [
  "Ellie's second arm and hand remain hidden, so only seven complete owner paths are visually auditable",
  "Radiance's two visible hands do not connect to Ellie as specified; the required low handclasp and shoulder contact are absent",
  "Only Ellie's upper-back palm is a clear relationship contact, so the required three-contact controlled-dip hard-love graph fails",
  "Alia's required three-centimeter bare midriff band remains too narrow or closed to read clearly",
  "The mission replica remains undersized and plastic-toy-like, with the trigger index and empty guard not safely auditable",
  "Alia continues to face only downrange, so her invitation and the all-four affirmative party response do not read clearly",
];
const strictAudit = {
  renderSurfaceQuality: "pass-clean-coherent-photographic-texture-with-straight-rain-and-no-wavy-marbling-after-one-recovery",
  identity: "pass-four-adult-identities-with-Alia-braids",
  anatomy: "reject-Ellie-second-arm-and-hand-remain-hidden; only-seven-complete-owner-paths-auditable",
  handOwnership: "reject-Ellie-Radiance-four-hand-graph-absent; ECE-and-Alia-two-hand-inventories-pass",
  weather: "pass-heavy-individually-straight-rain-streaks-and-wet-tiles",
  locationThemeFusion: "pass-recognizable-Batumi-with-four-distinct-futurist-expedition-silhouettes",
  outfitOriginality: "pass-four-distinct-silhouettes-constructions-hems-and-footwear",
  rolledWardrobe: "reject-Alia-active-visible-midriff-band-not-clearly-readable; Radiance-and-Alia-open-backs-and-other-active-rolls-pass",
  romance: "reject-shallow-lean-has-only-one-clear-contact-and-does-not-perform-the-three-contact-controlled-dip",
  radianceResponse: "partial-Radiance-ECE-eye-line-is-clear-but-Radiance-answer-to-inviting-Alia-is-not-visually-explicit",
  partyActivation: "reject-all-four-willing-participant-response-is-not-clear-because-Alia-remains visually-disconnected-downrange",
  mascots: "pass-one-PAWS-and-one-MAX-together-on-raised-dry-padded-lounge",
  oddProp: "pass-ECE-two-hands-on-opposite-compass-handles",
  routeMap: "pass-separate-hands-free-holographic-map",
  missionHandling: "reject-undersized-plastic-toy-like-replica-and-trigger-index-outside-empty-guard-not-auditable",
  missionTargetAxis: "pass-separated-paper-diamond-complete-backstop-and-safe-right-facing-axis",
  recoveryBudget: "consumed-one-of-one-planned-recovery-no-further-edit-chain-permitted",
  accepted: false,
};

checkpoint.status = "active-four-scene-gate-incomplete-after-clean-fresh-round-28";
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
checkpoint.renderAttempts.freshRound28 = {
  ...checkpoint.renderAttempts.freshRound28,
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
checkpoint.scenePlans["1551"].freshRound28.visualAudit = strictAudit;
checkpoint.rawOutputs.push({
  scene: 1551,
  round: 28,
  kind: "clean-fresh-recovery-rejected",
  path: recoveryRawPath,
  sourcePath: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-c70c348b-f9e3-4d57-b14d-997cda317197.png",
  sha256: expectedRecoverySha,
  dimensions: { width: 941, height: 1672 },
});
checkpoint.rejectedAssets.push({
  scene: 1551,
  round: 28,
  phase: "recovery",
  status: "rejected-strict-visual-audit",
  rawOutput: recoveryRawPath,
  sourceRawOutput: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-c70c348b-f9e3-4d57-b14d-997cda317197.png",
  sha256: expectedRecoverySha,
  dimensions: { width: 941, height: 1672 },
  decisiveRejectionReasons: rejectionReasons,
  recoveryPassConsumedThisRound: true,
});
checkpoint.renderStrategyReset = {
  ...checkpoint.renderStrategyReset,
  activeCleanRound: null,
  lastCompletedCleanRound: 28,
  lastCleanRoundResult: "clean-surface-and-rain-pass-but-rejected-hidden-Ellie-hand-missing-dip-graph-Alia-midriff-and-unsafe-toy-like-replica",
  nextCleanRound: 29,
  nextSourcePolicy: "original identity anchors only; no round 28 image input",
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
checkpoint.xPost.note = "Georgia has accepted scenes 1548, 1549, and 1550. Round 28 scene 1551 exhausted its single clean recovery and still failed exact anatomy, three-contact romance, Alia midriff, mission-replica safety, and all-four party-response gates. Publication remains mandatory after scene 1551 is accepted and the four-scene completion checkpoint is pushed.";
checkpoint.nextQueueStatus = "locked-on-Georgia-until-four-accepted-git-pushed-and-X-live-verified";
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "clean-fresh-round-29-from-original-identity-anchors-scene-1551-only",
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
