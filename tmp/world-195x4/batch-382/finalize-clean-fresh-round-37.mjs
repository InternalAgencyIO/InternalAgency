import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const checkpointPath = path.join(repo, "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json");
const contractPath = path.join(repo, "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const ledgerPath = path.join(repo, "assets/lore/starlight-era/world-x-publish-ledger.json");
const freshRawPath = "tmp/world-195x4/batch-382/raw/clean-fresh-round-37/scene-1551.png";
const recoveryRawPath = "tmp/world-195x4/batch-382/raw/clean-fresh-round-37-recovery/scene-1551.png";
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").toUpperCase();
}

const expectedContractSha = "69EB6C84A2467A4234D901C3086ECECE9E583B55C41BB9382CD5ED523C482EF5";
const expectedLedgerSha = "B94AA3FB2B1AB1BCAB100CE689F0173C77407B82439D73379D8BC0FA3EEC2455";
const expectedFreshSha = "415E1308BFC54456B0934134E212E73172E55C2E4E9BD90CF6B88EA8B7329073";
const expectedRecoverySha = "681FBB937C2726B75D0D0D261088A31A27B8D9F231E284C8200EC8E0DFCE25AD";
if (sha256File(contractPath) !== expectedContractSha) throw new Error("Contract changed during round 37 recovery");
if (sha256File(ledgerPath) !== expectedLedgerSha) throw new Error("Ledger changed during round 37 recovery");
if (sha256File(path.join(repo, freshRawPath)) !== expectedFreshSha) throw new Error("Round 37 fresh raw changed");
if (sha256File(path.join(repo, recoveryRawPath)) !== expectedRecoverySha) throw new Error("Round 37 recovery raw changed");
if (checkpoint.status !== "active-four-scene-gate-clean-fresh-round-37-recovery-materialized") throw new Error(`Unexpected status: ${checkpoint.status}`);

const completedAt = new Date().toISOString();
const rejectionReasons = [
  "Alia now faces safely right with everyone behind the muzzle plane, but her primary index remains curled at the trigger-guard area instead of lying straight above and entirely outside a clearly empty guard.",
  "The paper route target and complete backstop are visible, but the target center sits substantially above the shoulder-height muzzle continuation and no complete safety panel is auditable between muzzle and target.",
  "Ellie's support palm is visible on Radiance's back, but the white-sleeved owner arm disappears behind Radiance; the intended forearm-to-side and covered hip-to-thigh braces are absent, leaving only two unambiguous relationship contacts.",
  "MAX wears a visible dark collar despite the required small young collarless golden retriever state.",
];
const strictAudit = {
  renderSurfaceQuality: "pass-clean-coherent-photographic-texture-with-straight-rain-flat-tiles-and-no-wavy-marbling-after-one-recovery",
  identity: "pass-four-clearly-adult-identities-with-Alia-braids",
  anatomy: "pass-exact-eight-arms-and-eight-hands",
  handOwnership: "reject-Ellie-support-hand-owner-arm-disappears-behind-Radiance; clasp-pause-compass-and-mission-owner-paths-pass",
  weather: "pass-heavy-straight-rain-and-flat-wet-tiles",
  locationThemeFusion: "pass-recognizable-Batumi-with-Alphabet-Tower-Ferris-wheel-sea-skyline-and-four-distinct-expedition-silhouettes",
  outfitOriginality: "pass-four-distinct-silhouettes-constructions-hems-materials-and-footwear",
  rolledWardrobe: "pass-Radiance-open-back-Ellie-midriff-Alia-midriff-Alia-strapless-Alia-open-back-and-Radiance-hosiery",
  romance: "reject-low-clasp-and-support-palm-pass-but-visible-forearm-side-brace-and-covered-hip-thigh-contact-are-absent",
  radianceResponse: "pass-explicit-pause-through-large-open-wait-palm-thoughtful-expression-and-planted-feet",
  partyActivation: "pass-partyActivation-false-with-zero-willing-participants-and-no-celebration-cue",
  mascots: "reject-one-PAWS-and-one-MAX-are-on-raised-bed-but-MAX-has-a-visible-dark-collar",
  oddProp: "pass-ECE-two-hands-on-opposite-compass-handles",
  routeMap: "pass-separate-hands-free-holographic-map",
  missionHandling: "reject-safe-right-facing-metal-replica-and-orange-insert-pass-but-primary-index-remains-curled-at-guard",
  missionTargetAxis: "reject-complete-target-and-backstop-pass-but-paper-center-is-above-muzzle-continuation-and-complete-safety-panel-is-not-auditable",
  recoveryBudget: "consumed-one-of-one-planned-recovery-no-further-edit-chain-permitted",
  accepted: false,
};

checkpoint.status = "active-four-scene-gate-incomplete-after-clean-fresh-round-37";
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
checkpoint.renderAttempts.freshRound37 = {
  ...checkpoint.renderAttempts.freshRound37,
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
checkpoint.scenePlans["1551"].freshRound37.visualAudit = strictAudit;
checkpoint.rawOutputs.push({
  scene: 1551,
  round: 37,
  kind: "clean-fresh-recovery-rejected",
  path: recoveryRawPath,
  sourcePath: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-86c6b11a-21e6-4dad-bf8e-96cecaac244d.png",
  sha256: expectedRecoverySha,
  dimensions: { width: 941, height: 1672 },
});
checkpoint.rejectedAssets.push({
  scene: 1551,
  round: 37,
  phase: "recovery",
  status: "rejected-strict-visual-audit",
  rawOutput: recoveryRawPath,
  sourceRawOutput: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-86c6b11a-21e6-4dad-bf8e-96cecaac244d.png",
  sha256: expectedRecoverySha,
  dimensions: { width: 941, height: 1672 },
  decisiveRejectionReasons: rejectionReasons,
  recoveryPassConsumedThisRound: true,
});
checkpoint.renderStrategyReset = {
  ...checkpoint.renderStrategyReset,
  activeCleanRound: null,
  lastCompletedCleanRound: 37,
  lastCleanRoundResult: "clean-Batumi-identities-eight-hands-pause-open-backs-safe-rightward-lane-and-complete-backstop-pass-but-rejected-support-owner-path-three-contact-romance-trigger-index-target-axis-panel-and-MAX-collar",
  nextCleanRound: 38,
  nextSourcePolicy: "original identity anchors only; no round 37 image input",
  activeSourcePolicy: "four original identity anchors only",
  priorBatumiRenderInputCount: 0,
};
checkpoint.xBacklogAudit = {
  ...checkpoint.xBacklogAudit,
  checkedAt: completedAt,
  signedIn: false,
  sessionState: "in-app-X-webview-attach-timeout-this-wake",
  eligibleBacklogRemaining: 0,
  pendingPost: null,
  preparedPostQueueCount: 0,
  reconciliationDecision: "The authoritative ledger has no eligible pending or prepared item. Live X verification could not attach this wake; Georgia remains publication-blocked at three accepted scenes and no upload or country advance is permitted.",
};
checkpoint.xPost.status = "blocked-active-country-incomplete-and-X-session-retry-required";
checkpoint.xPost.url = null;
checkpoint.xPost.acceptedCurrentCountryAssets = 3;
checkpoint.xPost.note = "Georgia has accepted scenes 1548, 1549, and 1550. Round 37 scene 1551 exhausted its single clean recovery and still failed support-hand owner-path, three-contact romance, trigger-index safety, target-axis and safety-panel geometry, and MAX's collarless state. The live X webview also requires retry. Publication remains mandatory after scene 1551 is accepted and the four-scene completion checkpoint is pushed.";
checkpoint.nextQueueStatus = "locked-on-Georgia-until-four-accepted-git-pushed-and-X-live-verified";
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "clean-fresh-round-38-from-original-identity-anchors-scene-1551-only",
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
  nextWakeAction: checkpoint.nextWakeAction,
}, null, 2));
