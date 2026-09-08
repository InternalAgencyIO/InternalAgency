import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const checkpointPath = path.join(repo, "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json");
const contractPath = path.join(repo, "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const ledgerPath = path.join(repo, "assets/lore/starlight-era/world-x-publish-ledger.json");
const freshRawPath = "tmp/world-195x4/batch-382/raw/clean-fresh-round-36/scene-1551.png";
const recoveryRawPath = "tmp/world-195x4/batch-382/raw/clean-fresh-round-36-recovery/scene-1551.png";
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").toUpperCase();
}

const expectedContractSha = "69EB6C84A2467A4234D901C3086ECECE9E583B55C41BB9382CD5ED523C482EF5";
const expectedLedgerSha = "B94AA3FB2B1AB1BCAB100CE689F0173C77407B82439D73379D8BC0FA3EEC2455";
const expectedFreshSha = "B33E63066998CE3B3BD722C6F9F742E81AEB43F0B17A1AC959153CAA7E059035";
const expectedRecoverySha = "17401C751AC78845540065147CD94A9CA035DA1DD2F7BB1677C484D7408DE124";
if (sha256File(contractPath) !== expectedContractSha) throw new Error("Contract changed during round 36 recovery");
if (sha256File(ledgerPath) !== expectedLedgerSha) throw new Error("Ledger changed during round 36 recovery");
if (sha256File(path.join(repo, freshRawPath)) !== expectedFreshSha) throw new Error("Round 36 fresh raw changed");
if (sha256File(path.join(repo, recoveryRawPath)) !== expectedRecoverySha) throw new Error("Round 36 recovery raw changed");
if (checkpoint.status !== "active-four-scene-gate-clean-fresh-round-36-recovery-materialized") throw new Error(`Unexpected status: ${checkpoint.status}`);

const completedAt = new Date().toISOString();
const rejectionReasons = [
  "The low clasp and Ellie's support palm are visible, but Radiance's near shoulder remains separated from Ellie's white-sleeved upper arm by clear air, so the required third relationship contact is absent.",
  "Alia's primary index remains curled at the trigger-guard area instead of lying visibly straight along the metal side plate entirely above and outside a clearly empty guard.",
  "Alia's face remains neutral in strict profile, so her required explicit visible willing response as one of the three recorded party participants cannot be certified.",
  "A copper rear band still crosses Alia's middle back, interrupting the large continuous bare-back construction required by her active fully-open-back roll.",
];
const strictAudit = {
  renderSurfaceQuality: "pass-clean-coherent-photographic-texture-with-straight-rain-flat-tiles-and-no-wavy-marbling-after-one-recovery",
  identity: "pass-four-clearly-adult-identities-with-Alia-braids",
  anatomy: "pass-exact-eight-arms-and-eight-hands-with-continuous-owner-paths",
  handOwnership: "pass-two-hands-per-woman-with-clear-clasp-support-open-palm-compass-and-mission-owner-paths",
  weather: "pass-heavy-straight-rain-and-flat-wet-tiles",
  locationThemeFusion: "pass-recognizable-Batumi-with-Alphabet-Tower-Ferris-wheel-sea-skyline-and-four-distinct-expedition-silhouettes",
  outfitOriginality: "pass-four-distinct-silhouettes-constructions-hems-materials-and-footwear",
  rolledWardrobe: "reject-Alia-active-open-back-interrupted-by-copper-rear-band; Radiance-open-back-Ellie-midriff-Alia-midriff-and-Alia-strapless-pass",
  romance: "reject-low-clasp-and-support-palm-pass-but-required-third-shoulder-to-upper-arm-contact-remains-separated",
  radianceResponse: "pass-Radiance-willing-smile-open-palm-and-ECE-eye-line",
  partyActivation: "reject-Radiance-and-ECE-read-willing-but-Alia-participant-response-remains-neutral-and-uncertifiable",
  mascots: "pass-one-PAWS-and-one-MAX-together-on-raised-dry-bed",
  oddProp: "pass-ECE-two-hands-on-opposite-compass-handles",
  routeMap: "pass-separate-hands-free-holographic-map",
  missionHandling: "reject-large-metal-replica-and-orange-insert-pass-but-primary-index-remains-curled-at-guard-and-empty-guard-is-uncertifiable",
  missionTargetAxis: "pass-paper-target-complete-backstop-and-safe-rightward-axis-after-recovery",
  recoveryBudget: "consumed-one-of-one-planned-recovery-no-further-edit-chain-permitted",
  accepted: false,
};

checkpoint.status = "active-four-scene-gate-incomplete-after-clean-fresh-round-36";
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
checkpoint.renderAttempts.freshRound36 = {
  ...checkpoint.renderAttempts.freshRound36,
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
checkpoint.scenePlans["1551"].freshRound36.visualAudit = strictAudit;
checkpoint.rawOutputs.push({
  scene: 1551,
  round: 36,
  kind: "clean-fresh-recovery-rejected",
  path: recoveryRawPath,
  sourcePath: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-c9b70d33-a2c8-489c-b043-b9da74b7c43b.png",
  sha256: expectedRecoverySha,
  dimensions: { width: 941, height: 1672 },
});
checkpoint.rejectedAssets.push({
  scene: 1551,
  round: 36,
  phase: "recovery",
  status: "rejected-strict-visual-audit",
  rawOutput: recoveryRawPath,
  sourceRawOutput: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-c9b70d33-a2c8-489c-b043-b9da74b7c43b.png",
  sha256: expectedRecoverySha,
  dimensions: { width: 941, height: 1672 },
  decisiveRejectionReasons: rejectionReasons,
  recoveryPassConsumedThisRound: true,
});
checkpoint.renderStrategyReset = {
  ...checkpoint.renderStrategyReset,
  activeCleanRound: null,
  lastCompletedCleanRound: 36,
  lastCleanRoundResult: "clean-Batumi-identities-eight-hand-anatomy-open-Radiance-back-mascots-compass-map-and-complete-backstop-pass-but-rejected-third-contact-Alia-response-Alia-open-back-and-trigger-index",
  nextCleanRound: 37,
  nextSourcePolicy: "original identity anchors only; no round 36 image input",
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
checkpoint.xPost.note = "Georgia has accepted scenes 1548, 1549, and 1550. Round 36 scene 1551 exhausted its single clean recovery and still failed the third relationship contact, Alia's visible party response, Alia's active open-back construction, and indexed-trigger safety. Publication remains mandatory after scene 1551 is accepted and the four-scene completion checkpoint is pushed.";
checkpoint.nextQueueStatus = "locked-on-Georgia-until-four-accepted-git-pushed-and-X-live-verified";
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "clean-fresh-round-37-from-original-identity-anchors-scene-1551-only",
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
