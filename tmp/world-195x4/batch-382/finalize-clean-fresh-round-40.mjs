import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const checkpointPath = path.join(repo, "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json");
const contractPath = path.join(repo, "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const ledgerPath = path.join(repo, "assets/lore/starlight-era/world-x-publish-ledger.json");
const freshRawPath = "tmp/world-195x4/batch-382/raw/clean-fresh-round-40/scene-1551.png";
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").toUpperCase();
}

const expectedContractSha = "69EB6C84A2467A4234D901C3086ECECE9E583B55C41BB9382CD5ED523C482EF5";
const expectedLedgerSha = "B94AA3FB2B1AB1BCAB100CE689F0173C77407B82439D73379D8BC0FA3EEC2455";
const expectedFreshSha = "59453A521C19133C93501B2FAD12715E3095416A1A5DA5CD5A673944D2BC2EFD";
if (sha256File(contractPath) !== expectedContractSha) throw new Error("Contract changed during round 40");
if (sha256File(ledgerPath) !== expectedLedgerSha) throw new Error("Ledger changed during round 40");
if (sha256File(path.join(repo, freshRawPath)) !== expectedFreshSha) throw new Error("Round 40 fresh raw changed");
if (checkpoint.status !== "active-four-scene-gate-clean-fresh-round-40-materialized") throw new Error(`Unexpected status: ${checkpoint.status}`);

const completedAt = new Date().toISOString();
const rejectionReasons = [
  "Radiance has only one traceable arm and hand: her left shoulder-palm arm is absent, so the four-person anatomy gate fails with seven traceable hands and the high relationship contact is missing.",
  "Only Ellie's support palm and the low clasp are visible, leaving two relationship contacts instead of the required three-contact hard-love graph.",
  "Radiance looks directly at Ellie rather than visibly answering ECE with the stored nod and sustained mutual eye line, so the round-40 invitation-specific affirmative is not certifiable.",
  "Alia's copper shell has visible neck/back straps and rear connections, failing both strapless and fully-open-back rolls.",
  "The inert replica remains undersized, its trigger index is not certifiably straight above and outside the guard, and both the safety panel and sand backstop are cropped by the right frame edge.",
];
const strictAudit = {
  renderSurfaceQuality: "pass-clean-coherent-photographic-texture-with-straight-rain-flat-tiles-and-no-wavy-marbling",
  identity: "pass-four-clearly-adult-distinct-identities-with-Alia-braids",
  anatomy: "reject-only-seven-traceable-human-arms-and-hands-because-Radiance-left-arm-and-hand-are-absent",
  handOwnership: "reject-Radiance-has-only-low-clasp-hand; ECE-compass-Ellie-support-and-clasp-and-Alia-mission-owner-paths-otherwise-pass",
  weather: "pass-heavy-straight-rain-and-flat-wet-tiles",
  locationThemeFusion: "pass-recognizable-Batumi-with-Alphabet-Tower-Ferris-wheel-sea-skyline-palms-and-four-distinct-expedition-silhouettes",
  outfitOriginality: "pass-four-distinct-silhouettes-constructions-hems-materials-and-footwear",
  rolledWardrobe: "reject-Alia-strapless-and-fully-open-back-rolls-due-to-visible-neck-back-straps-and-rear-connections; Radiance-open-back-Ellie-midriff-Alia-midriff-Radiance-hosiery-and-ECE-covered-waist-pass",
  romance: "reject-support-palm-and-low-clasp-pass-but-high-shoulder-palm-is-absent-so-only-two-contacts-remain",
  radianceResponse: "reject-Radiance-looks-to-Ellie-instead-of-visibly-answering-ECE-with-stored-nod-and-mutual-eye-line",
  partyActivation: "reject-Radiance-Ellie-ECE-participant-cues-are-not-certifiable-because-Radiance-ECE-response-is-absent",
  mascots: "pass-one-collarless-PAWS-and-one-accessory-free-MAX-sharing-dry-bed",
  oddProp: "pass-ECE-alone-holds-two-opposite-compass-handles",
  routeMap: "pass-separate-hands-free-holographic-map",
  missionHandling: "reject-replica-is-undersized-and-primary-index-is-not-certifiably-fully-straight-above-and-outside-guard",
  missionTargetAxis: "reject-panel-and-backstop-are-cropped-by-right-frame-edge",
  recoveryDecision: "not-launched-because-failures-span-missing-limb-contact-graph-consent-eye-line-Alia-wardrobe-prop-scale-trigger-index-panel-and-backstop; a recovery would require broad redraw rather than one local correction",
  recoveryBudget: "zero-recovery-passes-used; round-40-closed-after-one-clean-fresh-pass",
  accepted: false,
};

checkpoint.status = "active-four-scene-gate-incomplete-after-clean-fresh-round-40";
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
checkpoint.renderAttempts.freshRound40 = {
  ...checkpoint.renderAttempts.freshRound40,
  status: "completed-rejected-no-recovery-broad-failure",
  completedAt,
  rawOutputs: { 1551: { fresh: { path: freshRawPath, sha256: expectedFreshSha, preserved: true } } },
  acceptedSceneNumbers: [],
  rejectedSceneNumbers: [1551],
  rejectionReasons: { 1551: rejectionReasons },
  strictAudit,
  recoveryDecision: { attempted: false, maximumRecoveryPasses: 1, recoveryPassesUsed: 0, reason: strictAudit.recoveryDecision },
};
checkpoint.scenePlans["1551"].freshRound40.visualAudit = strictAudit;
checkpoint.rawOutputs.push({
  scene: 1551,
  round: 40,
  kind: "clean-fresh-rejected-no-recovery",
  path: freshRawPath,
  sourcePath: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-5d18c523-12ad-4bd6-b2a1-2e6ca44bd8ae.png",
  sha256: expectedFreshSha,
  dimensions: { width: 941, height: 1672 },
});
checkpoint.rejectedAssets.push({
  scene: 1551,
  round: 40,
  phase: "fresh",
  status: "rejected-strict-visual-audit-no-recovery-broad-failure",
  rawOutput: freshRawPath,
  sourceRawOutput: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-5d18c523-12ad-4bd6-b2a1-2e6ca44bd8ae.png",
  sha256: expectedFreshSha,
  dimensions: { width: 941, height: 1672 },
  decisiveRejectionReasons: rejectionReasons,
  recoveryPassConsumedThisRound: false,
  recoveryNotAttemptedReason: strictAudit.recoveryDecision,
});
checkpoint.renderStrategyReset = {
  ...checkpoint.renderStrategyReset,
  activeCleanRound: null,
  lastCompletedCleanRound: 40,
  lastCleanRoundResult: "clean-Batumi-identities-ECE-compass-mascots-artifact-free-surface-and-distinct-outfits-pass-but-rejected-eight-hand-anatomy-three-contacts-consent-eye-line-Alia-wardrobe-prop-scale-index-panel-and-backstop",
  nextCleanRound: 41,
  nextSourcePolicy: "original identity anchors only; no round 40 image input",
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
  deferredPostCheckpoint: null,
  reconciliationDecision: "The authoritative ledger has no eligible pending, prepared, or deferred item. Live X verification could not attach this wake; Georgia remains publication-blocked at three accepted scenes and no upload or country advance is permitted.",
};
checkpoint.xPost.status = "blocked-active-country-incomplete-and-X-session-retry-required";
checkpoint.xPost.url = null;
checkpoint.xPost.acceptedCurrentCountryAssets = 3;
checkpoint.xPost.note = "Georgia has accepted scenes 1548, 1549, and 1550. Round 40 scene 1551 was clean but failed exact anatomy, three-contact romance, invitation-specific Radiance-ECE evidence, Alia's strapless fully open back, mission-prop scale and index safety, and complete panel/backstop framing. No recovery was launched because those failures require broad redraw. The live X webview also requires retry. Publication remains mandatory after scene 1551 is accepted and the four-scene completion checkpoint is pushed.";
checkpoint.nextQueueStatus = "locked-on-Georgia-until-four-accepted-git-pushed-and-X-live-verified";
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "clean-fresh-round-41-from-original-identity-anchors-scene-1551-only",
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
  accepted: false,
  recoveryDecision: strictAudit.recoveryDecision,
  nextWakeAction: checkpoint.nextWakeAction,
}, null, 2));
