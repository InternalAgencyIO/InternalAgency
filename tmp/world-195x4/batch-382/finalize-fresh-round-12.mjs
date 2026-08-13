import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const checkpointPath = path.join(repo, "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json");
const contractPath = path.join(repo, "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const ledgerPath = path.join(repo, "assets/lore/starlight-era/world-x-publish-ledger.json");
const recoveryRawPath = "tmp/world-195x4/batch-382/raw/fresh-round-12-recovery/scene-1551.png";
const recoveryQaPath = "tmp/world-195x4/batch-382/qa/fresh-round-12-recovery-scene-1551-target-crop.png";
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").toUpperCase();
}

if (sha256File(contractPath) !== "F7B247DF3BCE256C2A0BB2B51EB282EC4E6FBC5FE8E85A17970F311F26138FEC") {
  throw new Error("Authoritative contract changed during round 12");
}
if (sha256File(ledgerPath) !== "B94AA3FB2B1AB1BCAB100CE689F0173C77407B82439D73379D8BC0FA3EEC2455") {
  throw new Error("X publishing ledger changed during round 12");
}

const completedAt = new Date().toISOString();
const recoveryRawSha = sha256File(path.join(repo, recoveryRawPath));
const recoveryQaSha = sha256File(path.join(repo, recoveryQaPath));
checkpoint.status = "active-four-scene-gate-incomplete-after-fresh-round-12";
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
checkpoint.renderAttempts.freshRound12Recovery = {
  ...checkpoint.renderAttempts.freshRound12Recovery,
  status: "completed-rejected-target-axis-and-clearance",
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
      "paper diamond center remains visibly above the unchanged orange-muzzle centerline",
      "paper target is too close to the muzzle to preserve the required clean empty-air separation",
    ],
  },
  strictAudit: {
    identity: "pass-four-adult-identities-with-Alia-braids",
    anatomy: "pass-exactly-eight-traceable-arms-and-eight-traceable-hands",
    weather: "pass-heavy-rain",
    locationThemeFusion: "pass-Batumi-and-Mars-expedition-couture",
    outfitOriginality: "pass-four-distinct-fingerprints",
    rolledWardrobe: "pass-Radiance-rainbow-hosiery-and-open-back-Ellie-midriff-Alia-strapless-midriff-open-back",
    romance: "pass-controlled-dip-and-required-contact-map",
    mascots: "pass-one-PAWS-and-one-MAX-safe-play",
    oddProp: "pass-ECE-compass-table",
    routeMap: "pass-separate-hands-free-holographic-map",
    missionHandling: "pass-two-hand-stance-indexed-trigger-and-complete-backstop",
    missionTargetAxis: "reject-diamond-center-above-muzzle-centerline-and-insufficient-air-gap",
    qaCrop: {
      path: recoveryQaPath,
      sha256: recoveryQaSha,
    },
    accepted: false,
  },
};
checkpoint.scenePlans["1551"].freshRound12Recovery.visualAudit = checkpoint.renderAttempts.freshRound12Recovery.strictAudit;
checkpoint.xBacklogAudit = {
  ...checkpoint.xBacklogAudit,
  checkedAt: completedAt,
  eligibleBacklogRemaining: 0,
  pendingPost: null,
  preparedPostQueueCount: 0,
  reconciliationDecision: "No eligible unposted World Series item. Georgia has only three accepted current-country scenes, so no X upload is permitted and no later country can advance.",
};
checkpoint.xPost.status = "blocked-active-country-incomplete-not-skipped";
checkpoint.xPost.url = null;
checkpoint.xPost.acceptedCurrentCountryAssets = 3;
checkpoint.nextQueueStatus = "locked-on-Georgia-until-four-accepted-git-pushed-and-X-live-verified";
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "fresh-round-13-missing-scene-only",
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
  recoveryQaSha,
  nextWakeAction: checkpoint.nextWakeAction,
}, null, 2));
