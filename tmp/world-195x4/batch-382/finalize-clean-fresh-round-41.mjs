import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const checkpointPath = path.join(repo, "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json");
const contractPath = path.join(repo, "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const ledgerPath = path.join(repo, "assets/lore/starlight-era/world-x-publish-ledger.json");
const freshRawPath = "tmp/world-195x4/batch-382/raw/clean-fresh-round-41/scene-1551.png";
const sourceRawPath = "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-f1aa604b-1c1d-4eff-9468-6726eff31017.png";
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").toUpperCase();
}

const expectedContractSha = "69EB6C84A2467A4234D901C3086ECECE9E583B55C41BB9382CD5ED523C482EF5";
const expectedLedgerSha = "B94AA3FB2B1AB1BCAB100CE689F0173C77407B82439D73379D8BC0FA3EEC2455";
const expectedFreshSha = "215C4BCA5DC79A5E3326C1C30008EDEE77B738E52F474B542B0BF86FC539E003";
if (sha256File(contractPath) !== expectedContractSha) throw new Error("Contract changed during round 41");
if (sha256File(ledgerPath) !== expectedLedgerSha) throw new Error("Ledger changed during round 41");
if (sha256File(path.join(repo, freshRawPath)) !== expectedFreshSha) throw new Error("Round 41 fresh raw changed");
if (checkpoint.status !== "active-four-scene-gate-clean-fresh-round-41-materialized") throw new Error(`Unexpected status: ${checkpoint.status}`);
if (checkpoint.rawOutputs.some((item) => item.scene === 1551 && item.round === 41)) throw new Error("Round 41 raw already recorded");

const completedAt = new Date().toISOString();
const rejectionReasons = [
  "Ellie's left support arm and hand are absent and Alia's support arm and hand are absent, leaving only six traceable human arms and hands instead of exactly eight.",
  "Only Radiance's high shoulder palm and the low clasp are visible, leaving two relationship contacts instead of the required three-contact hard-love graph.",
  "Radiance looks directly at Ellie rather than visibly answering ECE with the stored nod and sustained mutual eye line, so the round-41 invitation-specific affirmative and Radiance-ECE-only party beat are not certifiable.",
  "Alia's copper shell has a visible rear connector across her back, failing the fully-open-back construction gate; ECE's sleeve patch and epaulette-like treatment also violate the no-logo-or-insignia styling gate.",
  "Alia holds the undersized inert replica one-handed, her trigger index is not certifiably straight above and outside the guard, the muzzle has almost no clear separation from the paper, and less than one full backstop-width of empty promenade remains beyond the backstop.",
];
const strictAudit = {
  renderSurfaceQuality: "pass-clean-natural-photographic-texture-with-straight-rain-flat-tiles-straight-landmarks-and-no-wavy-marbled-liquified-or-overprocessed-artifacts",
  identity: "pass-four-clearly-adult-distinct-identities-with-Alia-sculptural-braided-ponytail",
  anatomy: "reject-only-six-traceable-human-arms-and-hands-because-Ellie-left-support-and-Alia-left-support-limbs-are-absent",
  handOwnership: "reject-Ellie-has-only-low-clasp-hand-and-Alia-has-only-primary-grip-hand; ECE-compass-and-Radiance-contact-owner-paths-pass",
  weather: "pass-heavy-straight-rain-and-flat-wet-reflective-tiles",
  locationThemeFusion: "pass-recognizable-Batumi-with-Alphabet-Tower-Ferris-wheel-Black-Sea-skyline-palms-and-four-distinct-expedition-couture-silhouettes",
  outfitOriginality: "pass-four-distinct-silhouettes-constructions-hems-materials-and-footwear",
  prohibitedUniformStyling: "reject-ECE-has-a-visible-round-sleeve-patch-and-epaulette-like-shoulder-treatment",
  rolledWardrobe: "reject-Alia-fully-open-back-roll-due-to-visible-rear-connector; Radiance-open-back-and-hosiery-Ellie-midriff-Alia-midriff-and-strapless-and-ECE-covered-waist-otherwise-pass",
  romance: "reject-high-shoulder-palm-and-low-clasp-pass-but-Ellie-support-palm-is-absent-so-only-two-contacts-remain",
  radianceResponse: "reject-Radiance-looks-to-Ellie-instead-of-visibly-answering-ECE-with-stored-nod-and-mutual-eye-line",
  partyActivation: "reject-Radiance-ECE-only-party-beat-is-not-certifiable-because-the-required-Radiance-ECE-response-evidence-is-absent",
  mascots: "pass-one-tiny-collarless-golden-PAWS-and-one-small-accessory-free-young-golden-MAX-sharing-one-raised-lounge",
  oddProp: "pass-ECE-alone-holds-the-two-opposite-compass-handles",
  routeMap: "pass-separate-hands-free-holographic-route-map",
  missionHandling: "reject-one-handed-undersized-replica-with-trigger-index-not-certifiably-straight-above-and-outside-the-guard",
  missionTargetAxis: "reject-muzzle-paper-gap-is-negligible-and-less-than-one-full-backstop-width-of-empty-promenade-remains-beyond-the-backstop; complete-panel-and-backstop-framing-otherwise-pass",
  recoveryDecision: "not-launched-because-failures-span-two-missing-limbs-contact-graph-consent-eye-line-party-evidence-Alia-wardrobe-ECE-insignia-styling-prop-scale-two-hand-handling-trigger-index-and-safety-clearance; a recovery would require broad redraw rather than one local correction",
  recoveryBudget: "zero-recovery-passes-used; round-41-closed-after-one-clean-fresh-pass",
  accepted: false,
};

checkpoint.status = "active-four-scene-gate-incomplete-after-clean-fresh-round-41";
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
checkpoint.renderAttempts.freshRound41 = {
  ...checkpoint.renderAttempts.freshRound41,
  status: "completed-rejected-no-recovery-broad-failure",
  completedAt,
  rawOutputs: { 1551: { fresh: { path: freshRawPath, sha256: expectedFreshSha, preserved: true } } },
  acceptedSceneNumbers: [],
  rejectedSceneNumbers: [1551],
  rejectionReasons: { 1551: rejectionReasons },
  strictAudit,
  recoveryDecision: { attempted: false, maximumRecoveryPasses: 1, recoveryPassesUsed: 0, reason: strictAudit.recoveryDecision },
};
checkpoint.scenePlans["1551"].freshRound41.visualAudit = strictAudit;
checkpoint.rawOutputs.push({
  scene: 1551,
  round: 41,
  kind: "clean-fresh-rejected-no-recovery",
  path: freshRawPath,
  sourcePath: sourceRawPath,
  sha256: expectedFreshSha,
  dimensions: { width: 941, height: 1672 },
});
checkpoint.rejectedAssets.push({
  scene: 1551,
  round: 41,
  phase: "fresh",
  status: "rejected-strict-visual-audit-no-recovery-broad-failure",
  rawOutput: freshRawPath,
  sourceRawOutput: sourceRawPath,
  sha256: expectedFreshSha,
  dimensions: { width: 941, height: 1672 },
  decisiveRejectionReasons: rejectionReasons,
  recoveryPassConsumedThisRound: false,
  recoveryNotAttemptedReason: strictAudit.recoveryDecision,
});
checkpoint.renderStrategyReset = {
  ...checkpoint.renderStrategyReset,
  activeCleanRound: null,
  lastCompletedCleanRound: 41,
  lastCleanRoundResult: "clean-artifact-free-Batumi-identities-distinct-outfits-compass-map-and-mascots-pass-but-rejected-two-missing-limbs-three-contacts-consent-party-eye-line-Alia-back-ECE-insignia-prop-handling-index-and-safety-clearance",
  nextCleanRound: 42,
  nextSourcePolicy: "original identity anchors only; no round 41 image input",
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
checkpoint.xPost.note = "Georgia has accepted scenes 1548, 1549, and 1550. Round 41 scene 1551 rendered with clean artifact-free surfaces but failed exact eight-hand anatomy, three-contact romance, invitation-specific Radiance-ECE agreement evidence, Alia's fully open back, no-insignia styling, two-hand prop handling, trigger index, and target-lane clearance. No recovery was launched because those failures require broad redraw. The live X webview also requires retry. Publication remains mandatory after scene 1551 is accepted and the four-scene completion checkpoint is pushed.";
checkpoint.nextQueueStatus = "locked-on-Georgia-until-four-accepted-git-pushed-and-X-live-verified";
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "clean-fresh-round-42-from-original-identity-anchors-scene-1551-only",
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
  surfaceQuality: strictAudit.renderSurfaceQuality,
  accepted: false,
  recoveryDecision: strictAudit.recoveryDecision,
  nextWakeAction: checkpoint.nextWakeAction,
}, null, 2));
