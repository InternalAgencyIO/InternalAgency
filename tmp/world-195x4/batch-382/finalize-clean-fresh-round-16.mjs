import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const checkpointPath = path.join(repo, "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json");
const contractPath = path.join(repo, "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const ledgerPath = path.join(repo, "assets/lore/starlight-era/world-x-publish-ledger.json");
const recoveryRawPath = "tmp/world-195x4/batch-382/raw/clean-fresh-round-16-recovery/scene-1551.png";
const handsQaPath = "tmp/world-195x4/batch-382/qa/clean-fresh-round-16-recovery-scene-1551-hands-crop.png";
const targetQaPath = "tmp/world-195x4/batch-382/qa/clean-fresh-round-16-recovery-scene-1551-target-crop.png";
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").toUpperCase();
}

if (sha256File(contractPath) !== "F7B247DF3BCE256C2A0BB2B51EB282EC4E6FBC5FE8E85A17970F311F26138FEC") {
  throw new Error("Authoritative contract changed during clean round 16");
}
if (sha256File(ledgerPath) !== "B94AA3FB2B1AB1BCAB100CE689F0173C77407B82439D73379D8BC0FA3EEC2455") {
  throw new Error("X publishing ledger changed during clean round 16");
}

const completedAt = new Date().toISOString();
const recoveryRawSha = sha256File(path.join(repo, recoveryRawPath));
const handsQaSha = sha256File(path.join(repo, handsQaPath));
const targetQaSha = sha256File(path.join(repo, targetQaPath));
checkpoint.status = "active-four-scene-gate-incomplete-after-clean-fresh-round-16";
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
checkpoint.renderAttempts.freshRound16Recovery = {
  ...checkpoint.renderAttempts.freshRound16Recovery,
  status: "completed-rejected-target-axis-and-contact-map",
  completedAt,
  rawOutputs: {
    1551: {
      path: recoveryRawPath,
      sha256: recoveryRawSha,
      preserved: true,
    },
  },
  acceptedSceneNumbers: [],
  rejectedSceneNumbers: [1551],
  rejectionReasons: {
    1551: [
      "Alia's horizontal muzzle axis remains approximately 13 pixels below the paper-diamond center row",
      "Radiance's recovered second hand lands at her own waist instead of completing the stored hand contact on Ellie's outer shoulder",
    ],
  },
  strictAudit: {
    renderSurfaceQuality: "pass-clean-natural-photographic-texture-without-wavy-artifacts",
    identity: "pass-four-adult-identities-with-Alia-braids",
    anatomy: "pass-exactly-eight-visible-traceable-arms-and-eight-visible-traceable-hands",
    weather: "pass-heavy-straight-rain",
    locationThemeFusion: "pass-Batumi-and-Mars-expedition-couture",
    outfitOriginality: "pass-four-distinct-fingerprints",
    rolledWardrobe: "pass-Radiance-rainbow-hosiery-and-open-back-Ellie-midriff-Alia-strapless-midriff-open-back",
    romance: "reject-Radiance-second-hand-does-not-complete-stored-Ellie-shoulder-contact",
    mascots: "pass-one-PAWS-and-one-MAX-safe-play",
    oddProp: "pass-ECE-both-hands-exclusively-on-compass-table",
    routeMap: "pass-separate-hands-free-holographic-map",
    missionHandling: "pass-two-Alia-hands-indexed-trigger-single-target-complete-backstop-and-clean-air-gap",
    missionTargetAxis: "reject-muzzle-axis-approximately-13-pixels-below-diamond-center-row",
    recoveryBudget: "consumed-one-of-one-planned-recovery-no-further-edit-chain-permitted",
    qaCrops: {
      hands: { path: handsQaPath, sha256: handsQaSha },
      target: { path: targetQaPath, sha256: targetQaSha },
    },
    accepted: false,
  },
};
checkpoint.scenePlans["1551"].freshRound16Recovery.visualAudit = checkpoint.renderAttempts.freshRound16Recovery.strictAudit;
checkpoint.renderStrategyReset = {
  ...checkpoint.renderStrategyReset,
  lastCompletedCleanRound: 16,
  lastCleanRoundResult: "clean-surface-pass-contract-reject-after-single-recovery",
  nextCleanRound: 17,
  nextSourcePolicy: "original identity anchors only; no round 16 fresh or recovery image input",
};
checkpoint.xBacklogAudit = {
  ...checkpoint.xBacklogAudit,
  checkedAt: completedAt,
  eligibleBacklogRemaining: 0,
  pendingPost: null,
  preparedPostQueueCount: 0,
  reconciliationDecision: "No eligible unposted World Series item. Georgia still has three accepted current-country scenes; no X upload or later-country advance is permitted.",
};
checkpoint.xPost.status = "blocked-active-country-incomplete-not-skipped";
checkpoint.xPost.url = null;
checkpoint.xPost.acceptedCurrentCountryAssets = 3;
checkpoint.nextQueueStatus = "locked-on-Georgia-until-four-accepted-git-pushed-and-X-live-verified";
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "clean-fresh-round-17-from-original-identity-anchors-scene-1551-only",
  preserveAcceptedSceneNumbers: [1548, 1549, 1550],
  sceneNumbers: [1551],
  laterCountryStartAllowed: false,
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  status: checkpoint.status,
  acceptedSceneCount: checkpoint.countryCompletionGate.acceptedSceneCount,
  missingSceneNumbers: checkpoint.countryCompletionGate.missingSceneNumbers,
  recoveryRawSha,
  handsQaSha,
  targetQaSha,
  nextWakeAction: checkpoint.nextWakeAction,
}, null, 2));
