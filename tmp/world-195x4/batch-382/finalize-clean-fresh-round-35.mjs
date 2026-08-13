import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const checkpointPath = path.join(repo, "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json");
const contractPath = path.join(repo, "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const ledgerPath = path.join(repo, "assets/lore/starlight-era/world-x-publish-ledger.json");
const freshRawPath = "tmp/world-195x4/batch-382/raw/clean-fresh-round-35/scene-1551.png";
const recoveryRawPath = "tmp/world-195x4/batch-382/raw/clean-fresh-round-35-recovery/scene-1551.png";
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").toUpperCase();
}

const expectedContractSha = "69EB6C84A2467A4234D901C3086ECECE9E583B55C41BB9382CD5ED523C482EF5";
const expectedLedgerSha = "B94AA3FB2B1AB1BCAB100CE689F0173C77407B82439D73379D8BC0FA3EEC2455";
const expectedFreshSha = "6E760C4765ECF388219CFA428B77794419D8ED818E5F83AD2EFCB6E96DF4729C";
const expectedRecoverySha = "E5C127B2C65BED2FCA11380EDF02B400BC882B7CEA14325BD975B451409C9101";
if (sha256File(contractPath) !== expectedContractSha) throw new Error("Contract changed during round 35 recovery");
if (sha256File(ledgerPath) !== expectedLedgerSha) throw new Error("Ledger changed during round 35 recovery");
if (sha256File(path.join(repo, freshRawPath)) !== expectedFreshSha) throw new Error("Round 35 fresh raw changed");
if (sha256File(path.join(repo, recoveryRawPath)) !== expectedRecoverySha) throw new Error("Round 35 recovery raw changed");
if (checkpoint.status !== "active-four-scene-gate-clean-fresh-round-35-recovery-materialized") throw new Error(`Unexpected status: ${checkpoint.status}`);

const completedAt = new Date().toISOString();
const rejectionReasons = [
  "Ellie's visible support hand rests on Radiance's shoulder, but no continuous white-sleeved arm path connects that hand back to Ellie's shoulder, failing exact hand ownership.",
  "The low clasp and support hand are visible, but Radiance and Ellie's covered hips remain separated by clear air, so the required third relationship contact is absent.",
  "Radiance faces front-three-quarter and her active fully-open back is not visibly presented from shoulder blades to the secure waistline.",
  "A copper horizontal rear band still crosses Alia's middle back, failing her active fully-open-back roll.",
  "Alia's primary index remains bent at the trigger-guard area instead of visibly straight along the side plate entirely outside a clearly empty guard.",
];
const strictAudit = {
  renderSurfaceQuality: "pass-clean-coherent-photographic-texture-with-straight-rain-flat-tiles-and-no-wavy-marbling-after-one-recovery",
  identity: "pass-four-adult-identities-with-Alia-braids",
  anatomy: "reject-eight-hands-appear-but-Ellie-support-hand-lacks-a-continuous-owner-arm-path",
  handOwnership: "reject-Ellie-support-hand-owner-path; low-clasp-compass-affirmative-and-mission-owner-paths-pass",
  weather: "pass-heavy-straight-rain-and-flat-wet-tiles",
  locationThemeFusion: "pass-recognizable-Batumi-with-Alphabet-Tower-Ferris-wheel-sea-skyline-and-four-distinct-expedition-silhouettes",
  outfitOriginality: "pass-four-distinct-silhouettes-constructions-hems-materials-and-footwear",
  rolledWardrobe: "reject-Radiance-open-back-not-presented-and-Alia-open-back-interrupted-by-copper-band; Ellie-midriff-Alia-midriff-and-Alia-strapless-pass",
  romance: "reject-low-clasp-and-support-hand-pass-but-covered-hip-to-thigh-third-contact-is-absent",
  radianceResponse: "pass-explicit-affirmative-through-willing-smile-ECE-eye-line-and-low-clasp",
  partyActivation: "pass-exactly-Radiance-Ellie-ECE-willing-with-Alia-neutral-and-excluded",
  mascots: "pass-one-PAWS-and-one-MAX-together-on-raised-dry-bed",
  oddProp: "pass-ECE-two-hands-on-opposite-compass-handles",
  routeMap: "pass-separate-hands-free-holographic-map",
  missionHandling: "reject-large-metal-replica-and-orange-insert-pass-but-primary-index-outside-empty-guard-remains-unauditable",
  missionTargetAxis: "pass-paper-target-complete-backstop-safety-panel-and-safe-rightward-axis",
  recoveryBudget: "consumed-one-of-one-planned-recovery-no-further-edit-chain-permitted",
  accepted: false,
};

checkpoint.status = "active-four-scene-gate-incomplete-after-clean-fresh-round-35";
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
checkpoint.renderAttempts.freshRound35 = {
  ...checkpoint.renderAttempts.freshRound35,
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
checkpoint.scenePlans["1551"].freshRound35.visualAudit = strictAudit;
checkpoint.rawOutputs.push({
  scene: 1551,
  round: 35,
  kind: "clean-fresh-recovery-rejected",
  path: recoveryRawPath,
  sourcePath: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-5e3e5842-601e-4fe1-abf4-3d78a1baded9.png",
  sha256: expectedRecoverySha,
  dimensions: { width: 941, height: 1672 },
});
checkpoint.rejectedAssets.push({
  scene: 1551,
  round: 35,
  phase: "recovery",
  status: "rejected-strict-visual-audit",
  rawOutput: recoveryRawPath,
  sourceRawOutput: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-5e3e5842-601e-4fe1-abf4-3d78a1baded9.png",
  sha256: expectedRecoverySha,
  dimensions: { width: 941, height: 1672 },
  decisiveRejectionReasons: rejectionReasons,
  recoveryPassConsumedThisRound: true,
});
checkpoint.renderStrategyReset = {
  ...checkpoint.renderStrategyReset,
  activeCleanRound: null,
  lastCompletedCleanRound: 35,
  lastCleanRoundResult: "clean-Batumi-identities-low-clasp-scoped-party-mascots-compass-map-and-complete-backstop-pass-but-rejected-support-hand-owner-path-third-contact-two-open-backs-and-trigger-index",
  nextCleanRound: 36,
  nextSourcePolicy: "original identity anchors only; no round 35 image input",
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
checkpoint.xPost.note = "Georgia has accepted scenes 1548, 1549, and 1550. Round 35 scene 1551 exhausted its single clean recovery and still failed exact support-hand ownership, third-contact romance, two open-back rolls, and indexed-trigger safety. Publication remains mandatory after scene 1551 is accepted and the four-scene completion checkpoint is pushed.";
checkpoint.nextQueueStatus = "locked-on-Georgia-until-four-accepted-git-pushed-and-X-live-verified";
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "clean-fresh-round-36-from-original-identity-anchors-scene-1551-only",
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
