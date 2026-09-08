import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const checkpointPath = path.join(repo, "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json");
const contractPath = path.join(repo, "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const ledgerPath = path.join(repo, "assets/lore/starlight-era/world-x-publish-ledger.json");
const freshRawPath = "tmp/world-195x4/batch-382/raw/clean-fresh-round-29/scene-1551.png";
const recoveryRawPath = "tmp/world-195x4/batch-382/raw/clean-fresh-round-29-recovery/scene-1551.png";
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").toUpperCase();
}

const expectedContractSha = "69EB6C84A2467A4234D901C3086ECECE9E583B55C41BB9382CD5ED523C482EF5";
const expectedLedgerSha = "B94AA3FB2B1AB1BCAB100CE689F0173C77407B82439D73379D8BC0FA3EEC2455";
const expectedFreshSha = "3AF93A022813CCFF02B39F137518A01151AF7E361F72F0C0875E60183F7CC83F";
const expectedRecoverySha = "71F674E95C5BC050DA9D9CF8966CABC1D3E73608E5A2757D1ED48A8867D894A7";
if (sha256File(contractPath) !== expectedContractSha) throw new Error("Contract changed during round 29 recovery");
if (sha256File(ledgerPath) !== expectedLedgerSha) throw new Error("Ledger changed during round 29 recovery");
if (sha256File(path.join(repo, freshRawPath)) !== expectedFreshSha) throw new Error("Round 29 fresh raw changed");
if (sha256File(path.join(repo, recoveryRawPath)) !== expectedRecoverySha) throw new Error("Round 29 recovery raw changed");
if (checkpoint.status !== "active-four-scene-gate-clean-fresh-round-29-recovery-materialized") throw new Error(`Unexpected status: ${checkpoint.status}`);

const completedAt = new Date().toISOString();
const rejectionReasons = [
  "Radiance's left arm and shoulder-contact hand remain fully absent from view",
  "Ellie's visible support palm still emerges from behind Radiance without a continuously traceable white-sleeved arm",
  "Only seven hands and seven complete owner paths are auditable, below the exact eight required",
  "The dip has only the right-hand clasp and Ellie's support palm, so the required third shoulder contact is missing",
  "Radiance continues looking only at Ellie, so the required Radiance-ECE affectionate center and ECE party participation do not read",
  "The metallic replica remains undersized, its orange muzzle insert is absent or unreadable, and the trigger index outside the empty guard is not auditable",
];
const strictAudit = {
  renderSurfaceQuality: "pass-clean-coherent-photographic-texture-with-straight-rain-and-no-wavy-marbling-after-one-recovery",
  identity: "pass-four-adult-identities-with-Alia-braids",
  anatomy: "reject-Radiance-left-arm-and-hand-missing-and-Ellie-support-arm-hidden; only-seven-complete-owner-paths-auditable",
  handOwnership: "reject-Ellie-Radiance-four-hand-inventory-incomplete; ECE-and-Alia-two-hand-inventories-pass",
  weather: "pass-heavy-individually-straight-rain-streaks-and-wet-tiles",
  locationThemeFusion: "pass-recognizable-Batumi-with-four-distinct-futurist-expedition-silhouettes",
  outfitOriginality: "pass-four-distinct-silhouettes-constructions-hems-and-footwear",
  rolledWardrobe: "pass-Radiance-and-Alia-open-backs-Ellie-and-Alia-midriff-bands-Alia-strapless-shell-and-Radiance-rainbow-hosiery",
  romance: "reject-controlled-dip-and-two-contacts-pass-but-third-shoulder-contact-and-eight-hand-anatomy-fail",
  radianceResponse: "pass-Radiance-Ellie-clasp-and-committed-dip-as-explicit-yes-to-Ellie",
  partyActivation: "reject-Radiance-and-Ellie-read-but-ECE-is-not-in-the-mutual-eye-line-and-does-not-visibly-join",
  mascots: "pass-one-PAWS-and-one-MAX-together-on-raised-dry-padded-lounge",
  oddProp: "pass-ECE-two-hands-on-opposite-compass-handles",
  routeMap: "pass-separate-hands-free-holographic-map",
  missionHandling: "reject-replica-still-undersized-orange-insert-unreadable-and-indexed-trigger-finger-outside-empty-guard-not-auditable",
  missionTargetAxis: "pass-separated-paper-diamond-complete-backstop-and-safe-right-facing-axis",
  recoveryBudget: "consumed-one-of-one-planned-recovery-no-further-edit-chain-permitted",
  accepted: false,
};

checkpoint.status = "active-four-scene-gate-incomplete-after-clean-fresh-round-29";
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
checkpoint.renderAttempts.freshRound29 = {
  ...checkpoint.renderAttempts.freshRound29,
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
checkpoint.scenePlans["1551"].freshRound29.visualAudit = strictAudit;
checkpoint.rawOutputs.push({
  scene: 1551,
  round: 29,
  kind: "clean-fresh-recovery-rejected",
  path: recoveryRawPath,
  sourcePath: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-1a6dd62e-2c8a-4e66-bb32-8b9d8d286845.png",
  sha256: expectedRecoverySha,
  dimensions: { width: 941, height: 1672 },
});
checkpoint.rejectedAssets.push({
  scene: 1551,
  round: 29,
  phase: "recovery",
  status: "rejected-strict-visual-audit",
  rawOutput: recoveryRawPath,
  sourceRawOutput: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-1a6dd62e-2c8a-4e66-bb32-8b9d8d286845.png",
  sha256: expectedRecoverySha,
  dimensions: { width: 941, height: 1672 },
  decisiveRejectionReasons: rejectionReasons,
  recoveryPassConsumedThisRound: true,
});
checkpoint.renderStrategyReset = {
  ...checkpoint.renderStrategyReset,
  activeCleanRound: null,
  lastCompletedCleanRound: 29,
  lastCleanRoundResult: "clean-standard-dip-and-wardrobe-pass-but-rejected-missing-Radiance-arm-hidden-Ellie-support-third-contact-ECE-center-and-replica-safety",
  nextCleanRound: 30,
  nextSourcePolicy: "original identity anchors only; no round 29 image input",
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
checkpoint.xPost.note = "Georgia has accepted scenes 1548, 1549, and 1550. Round 29 scene 1551 exhausted its single clean recovery and still failed exact anatomy, third-contact romance, Radiance-ECE center, ECE party participation, and mission-replica safety gates. Publication remains mandatory after scene 1551 is accepted and the four-scene completion checkpoint is pushed.";
checkpoint.nextQueueStatus = "locked-on-Georgia-until-four-accepted-git-pushed-and-X-live-verified";
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "clean-fresh-round-30-from-original-identity-anchors-scene-1551-only",
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
