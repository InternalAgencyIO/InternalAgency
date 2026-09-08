import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const checkpointPath = path.join(repo, "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json");
const contractPath = path.join(repo, "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const ledgerPath = path.join(repo, "assets/lore/starlight-era/world-x-publish-ledger.json");
const rawPath = "tmp/world-195x4/batch-382/raw/clean-fresh-round-19/scene-1551.png";
const handsQaPath = "tmp/world-195x4/batch-382/qa/clean-fresh-round-19-scene-1551-hands-crop.png";
const targetQaPath = "tmp/world-195x4/batch-382/qa/clean-fresh-round-19-scene-1551-target-crop.png";
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").toUpperCase();
}

if (sha256File(contractPath) !== "F7B247DF3BCE256C2A0BB2B51EB282EC4E6FBC5FE8E85A17970F311F26138FEC") {
  throw new Error("Authoritative contract changed during clean round 19");
}
if (sha256File(ledgerPath) !== "B94AA3FB2B1AB1BCAB100CE689F0173C77407B82439D73379D8BC0FA3EEC2455") {
  throw new Error("X publishing ledger changed during clean round 19");
}
if (checkpoint.status !== "active-four-scene-gate-clean-fresh-round-19-materialized") {
  throw new Error(`Unexpected checkpoint status: ${checkpoint.status}`);
}

const completedAt = new Date().toISOString();
const rawSha = sha256File(path.join(repo, rawPath));
const handsQaSha = sha256File(path.join(repo, handsQaPath));
const targetQaSha = sha256File(path.join(repo, targetQaPath));
if (rawSha !== "D0C489B8EA7014CAD3850A24FD390521932BAA8FA6811E3075FF6A770452D3E4") {
  throw new Error("Clean round 19 raw changed before finalization");
}

checkpoint.status = "active-four-scene-gate-incomplete-after-clean-fresh-round-19";
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
checkpoint.renderAttempts.freshRound19 = {
  ...checkpoint.renderAttempts.freshRound19,
  status: "completed-rejected-no-recovery-distributed-gate-failures",
  completedAt,
  rawOutputs: {
    1551: {
      path: rawPath,
      sha256: rawSha,
      preserved: true,
    },
  },
  acceptedSceneNumbers: [],
  rejectedSceneNumbers: [1551],
  rejectionReasons: {
    1551: [
      "Radiance has only one visible arm and hand; her required second palm on Ellie's shoulder is absent",
      "the black paper-diamond center sits visibly below the orange muzzle-center row",
      "Ellie's active visible-midriff roll is not legible",
      "Alia's active strapless construction is replaced by visible shoulder straps",
    ],
  },
  recoveryDecision: {
    attempted: false,
    reason: "The defects span anatomy, target geometry, and two separate garments. A recovery would require broad redraw and risk the wavy multi-pass artifacts prohibited by the clean-source reset.",
    laterFreshSourcePolicy: "original identity anchors only",
  },
  strictAudit: {
    renderSurfaceQuality: "pass-clean-natural-photographic-texture-without-wavy-artifacts",
    identity: "pass-four-adult-identities-with-Alia-braids",
    anatomy: "reject-seven-visible-arms-and-seven-visible-hands-due-missing-Radiance-right-arm",
    handOwnership: "reject-Ellie-two-Radiance-one-ECE-two-Alia-two",
    weather: "pass-heavy-straight-rain",
    locationThemeFusion: "pass-Batumi-and-Mars-expedition-couture",
    outfitOriginality: "pass-four-distinct-silhouettes-and-material-languages",
    rolledWardrobe: "reject-Ellie-midriff-not-visible-and-Alia-not-strapless",
    romance: "pass-controlled-dip-handclasp-waist-support-and-Radiance-ECE-forehead-contact",
    contactGraph: "reject-missing-Radiance-palm-on-Ellie-shoulder-but-at-least-three-other-clear-contacts-present",
    mascots: "pass-one-PAWS-and-one-MAX-safe-play",
    oddProp: "pass-ECE-two-hands-on-opposite-compass-handles",
    routeMap: "pass-separate-hands-free-holographic-map",
    missionHandling: "pass-two-Alia-hands-single-target-complete-backstop-clean-air-gap-and-indexed-trigger",
    missionTargetAxis: "reject-paper-diamond-center-visibly-below-orange-muzzle-center-row",
    recoveryBudget: "unused-by-design-round-closed-after-one-clean-pass-to-avoid-broad-edit",
    qaCrops: {
      hands: { path: handsQaPath, sha256: handsQaSha },
      target: { path: targetQaPath, sha256: targetQaSha },
    },
    accepted: false,
  },
};
checkpoint.scenePlans["1551"].freshRound19.visualAudit = checkpoint.renderAttempts.freshRound19.strictAudit;
checkpoint.renderStrategyReset = {
  ...checkpoint.renderStrategyReset,
  activeCleanRound: null,
  lastCompletedCleanRound: 19,
  lastCleanRoundResult: "clean-surface-pass-contract-reject-without-recovery",
  nextCleanRound: 20,
  nextSourcePolicy: "original identity anchors only; no round 19 image input",
  priorBatumiRenderInputCount: 0,
};
checkpoint.xBacklogAudit = {
  ...checkpoint.xBacklogAudit,
  checkedAt: completedAt,
  eligibleBacklogRemaining: 0,
  pendingPost: null,
  preparedPostQueueCount: 0,
  lastPublicStatusVerified: "https://x.com/dogramaci/status/2087088543499768003",
  lastPublicStatusObservedViews: 54,
  reconciliationDecision: "No eligible unposted World Series item. Georgia still has three accepted current-country scenes; no X upload or later-country advance is permitted.",
};
checkpoint.xPost.status = "blocked-active-country-incomplete-not-skipped";
checkpoint.xPost.url = null;
checkpoint.xPost.acceptedCurrentCountryAssets = 3;
checkpoint.nextQueueStatus = "locked-on-Georgia-until-four-accepted-git-pushed-and-X-live-verified";
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "clean-fresh-round-20-from-original-identity-anchors-scene-1551-only",
  preserveAcceptedSceneNumbers: [1548, 1549, 1550],
  sceneNumbers: [1551],
  laterCountryStartAllowed: false,
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  status: checkpoint.status,
  acceptedSceneCount: checkpoint.countryCompletionGate.acceptedSceneCount,
  missingSceneNumbers: checkpoint.countryCompletionGate.missingSceneNumbers,
  rawSha,
  handsQaSha,
  targetQaSha,
  recoveryAttempted: false,
  nextWakeAction: checkpoint.nextWakeAction,
}, null, 2));
