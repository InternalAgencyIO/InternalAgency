import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const checkpointPath = path.join(repo, "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json");
const contractPath = path.join(repo, "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const ledgerPath = path.join(repo, "assets/lore/starlight-era/world-x-publish-ledger.json");
const recoveryRawPath = "tmp/world-195x4/batch-382/raw/clean-fresh-round-17-recovery/scene-1551.png";
const handsQaPath = "tmp/world-195x4/batch-382/qa/clean-fresh-round-17-recovery-scene-1551-hands-crop.png";
const targetQaPath = "tmp/world-195x4/batch-382/qa/clean-fresh-round-17-recovery-scene-1551-target-crop.png";
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").toUpperCase();
}

if (sha256File(contractPath) !== "F7B247DF3BCE256C2A0BB2B51EB282EC4E6FBC5FE8E85A17970F311F26138FEC") {
  throw new Error("Authoritative contract changed during clean round 17");
}
if (sha256File(ledgerPath) !== "B94AA3FB2B1AB1BCAB100CE689F0173C77407B82439D73379D8BC0FA3EEC2455") {
  throw new Error("X publishing ledger changed during clean round 17");
}
if (checkpoint.status !== "active-four-scene-gate-clean-fresh-round-17-recovery-materialized") {
  throw new Error(`Unexpected checkpoint status: ${checkpoint.status}`);
}

const completedAt = new Date().toISOString();
const recoveryRawSha = sha256File(path.join(repo, recoveryRawPath));
const handsQaSha = sha256File(path.join(repo, handsQaPath));
const targetQaSha = sha256File(path.join(repo, targetQaPath));
if (recoveryRawSha !== "CE5476CC6F46575ABF544AF31747179980426F4E4F77D859FEA57809F39C8F0F") {
  throw new Error("Clean round 17 recovery raw changed before finalization");
}

checkpoint.status = "active-four-scene-gate-incomplete-after-clean-fresh-round-17";
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
checkpoint.renderAttempts.freshRound17Recovery = {
  ...checkpoint.renderAttempts.freshRound17Recovery,
  status: "completed-rejected-hand-ownership-and-target-axis",
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
      "ECE's left hand remains on Radiance's waist instead of the left compass handle",
      "Radiance's second hand remains at her own waist instead of Ellie's outer shoulder",
      "the paper-diamond center was raised above rather than aligned to the orange muzzle-center row",
    ],
  },
  strictAudit: {
    renderSurfaceQuality: "pass-clean-natural-photographic-texture-without-wavy-artifacts-after-one-recovery",
    identity: "pass-four-adult-identities-with-Alia-braids",
    anatomy: "pass-exactly-eight-visible-traceable-arms-and-eight-visible-traceable-hands",
    handOwnership: "reject-ECE-left-hand-on-Radiance-and-Radiance-second-hand-on-own-waist",
    weather: "pass-heavy-straight-rain",
    locationThemeFusion: "pass-Batumi-and-Mars-expedition-couture",
    outfitOriginality: "pass-four-distinct-fingerprints",
    rolledWardrobe: "pass-Radiance-rainbow-hosiery-and-open-back-Ellie-midriff-Alia-strapless-midriff-open-back",
    romance: "reject-stored-contact-map-not-completed",
    mascots: "pass-one-PAWS-and-one-MAX-safe-play",
    oddProp: "reject-ECE-only-one-hand-on-compass-table",
    routeMap: "pass-separate-hands-free-holographic-map",
    missionHandling: "pass-two-Alia-hands-single-target-complete-backstop-clean-air-gap-and-indexed-trigger",
    missionTargetAxis: "reject-paper-diamond-center-visibly-above-orange-muzzle-center-row",
    recoveryBudget: "consumed-one-of-one-planned-recovery-no-further-edit-chain-permitted",
    qaCrops: {
      hands: { path: handsQaPath, sha256: handsQaSha },
      target: { path: targetQaPath, sha256: targetQaSha },
    },
    accepted: false,
  },
};
checkpoint.scenePlans["1551"].freshRound17Recovery.visualAudit = checkpoint.renderAttempts.freshRound17Recovery.strictAudit;
checkpoint.renderStrategyReset = {
  ...checkpoint.renderStrategyReset,
  activeCleanRound: null,
  lastCompletedCleanRound: 17,
  lastCleanRoundResult: "clean-surface-pass-contract-reject-after-single-recovery",
  nextCleanRound: 18,
  nextSourcePolicy: "original identity anchors only; no round 17 fresh or recovery image input",
  priorBatumiRenderInputCount: 0,
};
checkpoint.xBacklogAudit = {
  ...checkpoint.xBacklogAudit,
  checkedAt: completedAt,
  eligibleBacklogRemaining: 0,
  pendingPost: null,
  preparedPostQueueCount: 0,
  lastPublicStatusVerified: "https://x.com/dogramaci/status/2087088543499768003",
  lastPublicStatusObservedViews: 52,
  reconciliationDecision: "No eligible unposted World Series item. Georgia still has three accepted current-country scenes; no X upload or later-country advance is permitted.",
};
checkpoint.xPost.status = "blocked-active-country-incomplete-not-skipped";
checkpoint.xPost.url = null;
checkpoint.xPost.acceptedCurrentCountryAssets = 3;
checkpoint.nextQueueStatus = "locked-on-Georgia-until-four-accepted-git-pushed-and-X-live-verified";
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "clean-fresh-round-18-from-original-identity-anchors-scene-1551-only",
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
