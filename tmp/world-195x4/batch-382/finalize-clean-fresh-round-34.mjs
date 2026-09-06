import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const checkpointPath = path.join(repo, "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json");
const contractPath = path.join(repo, "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const ledgerPath = path.join(repo, "assets/lore/starlight-era/world-x-publish-ledger.json");
const freshRawPath = "tmp/world-195x4/batch-382/raw/clean-fresh-round-34/scene-1551.png";
const recoveryRawPath = "tmp/world-195x4/batch-382/raw/clean-fresh-round-34-recovery/scene-1551.png";
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").toUpperCase();
}

const expectedContractSha = "69EB6C84A2467A4234D901C3086ECECE9E583B55C41BB9382CD5ED523C482EF5";
const expectedLedgerSha = "B94AA3FB2B1AB1BCAB100CE689F0173C77407B82439D73379D8BC0FA3EEC2455";
const expectedFreshSha = "99CCED3F5D32590834327D33913D68E89F9C91E30A378E7ECE2E9D91F43A99AA";
const expectedRecoverySha = "069C8B0D511DD38339F713F5DC4F8B2531CDE08F6505167F4B368074B6ADF9A5";
if (sha256File(contractPath) !== expectedContractSha) throw new Error("Contract changed during round 34 recovery");
if (sha256File(ledgerPath) !== expectedLedgerSha) throw new Error("Ledger changed during round 34 recovery");
if (sha256File(path.join(repo, freshRawPath)) !== expectedFreshSha) throw new Error("Round 34 fresh raw changed");
if (sha256File(path.join(repo, recoveryRawPath)) !== expectedRecoverySha) throw new Error("Round 34 recovery raw changed");
if (checkpoint.status !== "active-four-scene-gate-clean-fresh-round-34-recovery-materialized") throw new Error(`Unexpected status: ${checkpoint.status}`);

const completedAt = new Date().toISOString();
const rejectionReasons = [
  "The inner lifted-clasp hand still has no continuously visible bare arm path back to Radiance's right shoulder, so exact hand ownership remains ambiguous.",
  "The recovery preserves Ellie's support palm but leaves visible air between Radiance's cobalt-covered hip and Ellie's white-covered hip, so the required third relationship contact is not unmistakable.",
  "Alia's primary index remains curled at or into the trigger-guard area instead of lying visibly straight along the side plate entirely outside a clearly empty guard.",
  "The target remains on a sand backstop cropped by the right frame edge, so the complete backstop is not auditable.",
];
const strictAudit = {
  renderSurfaceQuality: "pass-clean-coherent-photographic-texture-with-straight-rain-flat-tiles-and-no-wavy-marbling-after-one-recovery",
  identity: "pass-four-adult-identities-with-Alia-braids",
  anatomy: "reject-eight-hands-appear-but-Radiance-right-arm-owner-path-to-inner-lifted-clasp-hand-is-missing",
  handOwnership: "reject-inner-clasp-hand-origin-remains-ambiguous; support-compass-redirect-and-mission-owner-paths-pass",
  weather: "pass-heavy-straight-rain-and-flat-wet-tiles",
  locationThemeFusion: "pass-recognizable-Batumi-with-restored-Alphabet-Tower-Ferris-wheel-sea-skyline-and-four-distinct-expedition-silhouettes",
  outfitOriginality: "pass-four-distinct-silhouettes-constructions-hems-materials-and-footwear",
  rolledWardrobe: "pass-Radiance-open-back-Ellie-midriff-Alia-midriff-Alia-strapless-and-Alia-open-back",
  romance: "reject-lifted-clasp-and-visible-support-palm-pass-but-broad-covered-hip-to-thigh-third-contact-remains-open",
  radianceResponse: "pass-explicit-redirect-through-calm-closed-mouth-expression-open-palm-to-map-and-ECE-map-eye-line",
  partyActivation: "pass-false-with-no-party-cue-or-willing-participant",
  mascots: "pass-one-PAWS-and-one-MAX-together-on-raised-dry-bed",
  oddProp: "pass-ECE-two-hands-on-opposite-compass-handles",
  routeMap: "pass-separate-hands-free-holographic-map",
  missionHandling: "reject-large-metal-replica-and-orange-insert-pass-but-index-outside-empty-guard-remains-unauditable",
  missionTargetAxis: "reject-paper-target-and-safe-rightward-axis-pass-but-sand-backstop-remains-cropped",
  recoveryBudget: "consumed-one-of-one-planned-recovery-no-further-edit-chain-permitted",
  accepted: false,
};

checkpoint.status = "active-four-scene-gate-incomplete-after-clean-fresh-round-34";
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
checkpoint.renderAttempts.freshRound34 = {
  ...checkpoint.renderAttempts.freshRound34,
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
checkpoint.scenePlans["1551"].freshRound34.visualAudit = strictAudit;
checkpoint.rawOutputs.push({
  scene: 1551,
  round: 34,
  kind: "clean-fresh-recovery-rejected",
  path: recoveryRawPath,
  sourcePath: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-f2dd846f-7355-4ef7-8112-2b00865fa2c0.png",
  sha256: expectedRecoverySha,
  dimensions: { width: 941, height: 1672 },
});
checkpoint.rejectedAssets.push({
  scene: 1551,
  round: 34,
  phase: "recovery",
  status: "rejected-strict-visual-audit",
  rawOutput: recoveryRawPath,
  sourceRawOutput: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-f2dd846f-7355-4ef7-8112-2b00865fa2c0.png",
  sha256: expectedRecoverySha,
  dimensions: { width: 941, height: 1672 },
  decisiveRejectionReasons: rejectionReasons,
  recoveryPassConsumedThisRound: true,
});
checkpoint.renderStrategyReset = {
  ...checkpoint.renderStrategyReset,
  activeCleanRound: null,
  lastCompletedCleanRound: 34,
  lastCleanRoundResult: "clean-Batumi-identities-wardrobe-redirect-mascots-compass-map-Alphabet-Tower-and-large-replica-pass-but-rejected-clasp-owner-path-third-contact-trigger-index-and-cropped-backstop",
  nextCleanRound: 35,
  nextSourcePolicy: "original identity anchors only; no round 34 image input",
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
  latestVisibleAccountStatus: { url: "https://x.com/dogramaci/status/2087242564432806133", validCountryPairCaption: false, classification: "unrelated-account-post-not-a-World-Series-ledger-item" },
  latestVisibleAccountStatuses: ["https://x.com/dogramaci/status/2087242564432806133", "https://x.com/dogramaci/status/2087241970661941705"],
  reconciliationDecision: "Signed-in live profile checked and no eligible unposted World Series country pair exists. Georgia still has three accepted scenes, so no X upload or country advance is permitted.",
};
checkpoint.xPost.status = "blocked-active-country-incomplete-not-skipped";
checkpoint.xPost.url = null;
checkpoint.xPost.acceptedCurrentCountryAssets = 3;
checkpoint.xPost.note = "Georgia has accepted scenes 1548, 1549, and 1550. Round 34 scene 1551 exhausted its single clean recovery and still failed exact clasp-hand ownership, unmistakable third contact, indexed-trigger safety, and complete-backstop gates. Publication remains mandatory after scene 1551 is accepted and the four-scene completion checkpoint is pushed.";
checkpoint.nextQueueStatus = "locked-on-Georgia-until-four-accepted-git-pushed-and-X-live-verified";
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "clean-fresh-round-35-from-original-identity-anchors-scene-1551-only",
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
