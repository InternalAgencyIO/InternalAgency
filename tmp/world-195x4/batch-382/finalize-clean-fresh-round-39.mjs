import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const checkpointPath = path.join(repo, "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json");
const contractPath = path.join(repo, "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const ledgerPath = path.join(repo, "assets/lore/starlight-era/world-x-publish-ledger.json");
const freshRawPath = "tmp/world-195x4/batch-382/raw/clean-fresh-round-39/scene-1551.png";
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").toUpperCase();
}

const expectedContractSha = "69EB6C84A2467A4234D901C3086ECECE9E583B55C41BB9382CD5ED523C482EF5";
const expectedLedgerSha = "B94AA3FB2B1AB1BCAB100CE689F0173C77407B82439D73379D8BC0FA3EEC2455";
const expectedFreshSha = "758745E3D073E2AF3FE1DC25D5559CF69538E3C2C7D2CAFA3A7F26A4A5116745";
if (sha256File(contractPath) !== expectedContractSha) throw new Error("Contract changed during round 39");
if (sha256File(ledgerPath) !== expectedLedgerSha) throw new Error("Ledger changed during round 39");
if (sha256File(path.join(repo, freshRawPath)) !== expectedFreshSha) throw new Error("Round 39 fresh raw changed");
if (checkpoint.status !== "active-four-scene-gate-clean-fresh-round-39-materialized") throw new Error(`Unexpected status: ${checkpoint.status}`);

const completedAt = new Date().toISOString();
const rejectionReasons = [
  "Radiance's right hand migrated onto the compass instead of the planned low clasp with Ellie, leaving only two unambiguous relationship contacts and breaking ECE's exclusive two-hand ownership of the odd prop.",
  "The stored round-39 affirmative is not certifiable: Radiance's eye line toward ECE is present, but the required nod and distinct participant/non-participant cues are not all visible while the contact graph is already invalid.",
  "Alia's rolled fully open back fails because visible copper straps cross her back and connect the front shell behind her neck and ribs.",
  "The inert replica is undersized relative to the specified full-size thirty-centimeter side profile, and the trigger index is not independently certifiable as fully straight above and outside the guard.",
  "The transparent safety panel and sand backstop are both cropped by the right frame edge, so complete safety geometry and four-edge backstop gates fail.",
];
const strictAudit = {
  renderSurfaceQuality: "pass-clean-coherent-photographic-texture-with-straight-rain-flat-tiles-and-no-wavy-marbling",
  identity: "pass-four-clearly-adult-distinct-identities-with-Alia-braids",
  anatomy: "pass-exact-eight-arms-and-eight-hands-with-two-per-woman",
  handOwnership: "reject-Radiance-right-hand-owns-compass-rim-instead-of-low-clasp-and-ECE-no-longer-owns-odd-prop-alone",
  weather: "pass-heavy-straight-rain-and-flat-wet-tiles",
  locationThemeFusion: "pass-recognizable-Batumi-with-Ferris-wheel-sea-skyline-palms-and-four-distinct-expedition-silhouettes",
  outfitOriginality: "pass-four-distinct-silhouettes-constructions-hems-materials-and-footwear",
  rolledWardrobe: "reject-Alia-fully-open-back-crossed-by-visible-copper-straps; Radiance-open-back-Ellie-midriff-Alia-midriff-Alia-strapless-Radiance-hosiery-and-ECE-covered-waist-pass",
  romance: "reject-high-shoulder-palm-and-middle-support-palm-pass-but-low-clasp-is-absent-so-only-two-contacts-remain",
  radianceResponse: "reject-Radiance-ECE-eye-line-is-present-but-stored-clear-up-down-nod-is-not-certifiable",
  partyActivation: "reject-three-participant-versus-Ellie-nonparticipant-cues-are-not-fully-certifiable",
  mascots: "pass-one-collarless-PAWS-and-one-accessory-free-MAX-sharing-dry-bed",
  oddProp: "reject-ECE-holds-two-handles-but-Radiance-also-touches-the-compass-rim",
  routeMap: "pass-separate-hands-free-holographic-map",
  missionHandling: "reject-replica-is-undersized-and-primary-index-is-not-certifiably-fully-straight-above-and-outside-guard",
  missionTargetAxis: "reject-panel-and-backstop-are-cropped-by-right-frame-edge",
  recoveryDecision: "not-launched-because-failures-span-contact-graph-odd-prop-ownership-consent-cues-open-back-prop-scale-trigger-index-panel-and-backstop; a recovery would require broad redraw rather than one local correction",
  recoveryBudget: "zero-recovery-passes-used; round-39-closed-after-one-clean-fresh-pass",
  accepted: false,
};

checkpoint.status = "active-four-scene-gate-incomplete-after-clean-fresh-round-39";
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
checkpoint.renderAttempts.freshRound39 = {
  ...checkpoint.renderAttempts.freshRound39,
  status: "completed-rejected-no-recovery-broad-failure",
  completedAt,
  rawOutputs: { 1551: { fresh: { path: freshRawPath, sha256: expectedFreshSha, preserved: true } } },
  acceptedSceneNumbers: [],
  rejectedSceneNumbers: [1551],
  rejectionReasons: { 1551: rejectionReasons },
  strictAudit,
  recoveryDecision: { attempted: false, maximumRecoveryPasses: 1, recoveryPassesUsed: 0, reason: strictAudit.recoveryDecision },
};
checkpoint.scenePlans["1551"].freshRound39.visualAudit = strictAudit;
checkpoint.rawOutputs.push({
  scene: 1551,
  round: 39,
  kind: "clean-fresh-rejected-no-recovery",
  path: freshRawPath,
  sourcePath: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-4ac8028e-7a41-4343-8507-6a6686c4117c.png",
  sha256: expectedFreshSha,
  dimensions: { width: 941, height: 1672 },
});
checkpoint.rejectedAssets.push({
  scene: 1551,
  round: 39,
  phase: "fresh",
  status: "rejected-strict-visual-audit-no-recovery-broad-failure",
  rawOutput: freshRawPath,
  sourceRawOutput: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-4ac8028e-7a41-4343-8507-6a6686c4117c.png",
  sha256: expectedFreshSha,
  dimensions: { width: 941, height: 1672 },
  decisiveRejectionReasons: rejectionReasons,
  recoveryPassConsumedThisRound: false,
  recoveryNotAttemptedReason: strictAudit.recoveryDecision,
});
checkpoint.renderStrategyReset = {
  ...checkpoint.renderStrategyReset,
  activeCleanRound: null,
  lastCompletedCleanRound: 39,
  lastCleanRoundResult: "clean-Batumi-identities-eight-hands-mascots-artifact-free-surface-and-three-distinct-outfit-families-pass-but-rejected-low-clasp-odd-prop-ownership-consent-cues-Alia-open-back-prop-scale-index-panel-and-backstop",
  nextCleanRound: 40,
  nextSourcePolicy: "original identity anchors only; no round 39 image input",
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
checkpoint.xPost.note = "Georgia has accepted scenes 1548, 1549, and 1550. Round 39 scene 1551 was clean but failed contact graph, exclusive compass ownership, invitation-specific party evidence, Alia's fully open back, mission-prop scale and index safety, and complete panel/backstop framing. No recovery was launched because those failures require broad redraw. The live X webview also requires retry. Publication remains mandatory after scene 1551 is accepted and the four-scene completion checkpoint is pushed.";
checkpoint.nextQueueStatus = "locked-on-Georgia-until-four-accepted-git-pushed-and-X-live-verified";
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "clean-fresh-round-40-from-original-identity-anchors-scene-1551-only",
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
