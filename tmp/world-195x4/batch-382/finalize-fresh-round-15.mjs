import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const checkpointPath = path.join(repo, "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json");
const contractPath = path.join(repo, "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const ledgerPath = path.join(repo, "assets/lore/starlight-era/world-x-publish-ledger.json");
const recoveryRawPath = "tmp/world-195x4/batch-382/raw/fresh-round-15-recovery/scene-1551.png";
const recoveryQaPath = "tmp/world-195x4/batch-382/qa/fresh-round-15-recovery-scene-1551-target-crop.png";
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").toUpperCase();
}

if (sha256File(contractPath) !== "F7B247DF3BCE256C2A0BB2B51EB282EC4E6FBC5FE8E85A17970F311F26138FEC") {
  throw new Error("Authoritative contract changed during round 15");
}
if (sha256File(ledgerPath) !== "B94AA3FB2B1AB1BCAB100CE689F0173C77407B82439D73379D8BC0FA3EEC2455") {
  throw new Error("X publishing ledger changed during round 15");
}

const completedAt = new Date().toISOString();
const recoveryRawSha = sha256File(path.join(repo, recoveryRawPath));
const recoveryQaSha = sha256File(path.join(repo, recoveryQaPath));
checkpoint.status = "active-four-scene-gate-incomplete-after-fresh-round-15";
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
checkpoint.renderAttempts.freshRound15Recovery = {
  ...checkpoint.renderAttempts.freshRound15Recovery,
  status: "completed-rejected-target-axis",
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
      "horizontal muzzle axis intersects the lower portion of the paper diamond approximately 11 pixels below its center instead of sharing the stored center row",
      "iterative edit-on-edit accumulation created visible wavy overprocessed texture across rain, skin, garments, architecture, and floor surfaces",
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
    missionHandling: "pass-two-hand-stance-indexed-trigger-single-target-complete-backstop-and-clean-air-gap",
    missionTargetCount: "pass-exactly-one-paper-target",
    missionTargetAxis: "reject-muzzle-axis-approximately-11-pixels-below-diamond-center-row",
    renderSurfaceQuality: "reject-wavy-overprocessed-multi-generation-artifacts",
    providerPersistence: "pass-recovery-raw-preserved-locally",
    qaCrop: {
      path: recoveryQaPath,
      sha256: recoveryQaSha,
    },
    accepted: false,
  },
};
checkpoint.scenePlans["1551"].freshRound15Recovery.visualAudit = checkpoint.renderAttempts.freshRound15Recovery.strictAudit;
checkpoint.xBacklogAudit = {
  ...checkpoint.xBacklogAudit,
  checkedAt: completedAt,
  eligibleBacklogRemaining: 0,
  pendingPost: null,
  preparedPostQueueCount: 0,
  reconciliationDecision: "No eligible unposted World Series item. Georgia still has only three accepted current-country scenes, so no X upload is permitted and no later country can advance.",
};
checkpoint.xPost.status = "blocked-active-country-incomplete-not-skipped";
checkpoint.xPost.url = null;
checkpoint.xPost.acceptedCurrentCountryAssets = 3;
checkpoint.nextQueueStatus = "locked-on-Georgia-until-four-accepted-git-pushed-and-X-live-verified";
checkpoint.renderStrategyReset = {
  requestedAt: completedAt,
  reason: "User rejected visible wavy artifacts caused by repeated edit-on-edit passes.",
  appliesFromFreshRound: 16,
  cleanSourcePolicy: "Every fresh round starts from the original stored identity anchors only and includes no prior Batumi render as an image input.",
  plannedPassPolicy: "One clean fresh render, followed by at most one narrowly targeted recovery from that same clean fresh raw when a local correctable gate fails.",
  antiAccumulationPolicy: "Never use a recovery output or any earlier edited Batumi output as the source of a later fresh round.",
  assetPolicy: "Preserve audit raws under tmp; copy only a fully accepted clean result to assets/lore/starlight-era.",
  originalIdentityAnchors: [
    "assets/lore/starlight-era/937-central-african-republic-dzanga-sangha-rainbow-clinic-signal-cipher.png",
    "assets/lore/starlight-era/938-central-african-republic-boali-falls-rainbow-star-map-relay.png",
    "assets/lore/starlight-era/936-central-african-republic-bangui-oubangui-rainbow-route-grid.png",
    "assets/lore/starlight-era/ece-canonical-identity-v1.png",
  ],
};
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "clean-fresh-round-16-from-original-identity-anchors-scene-1551-only",
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
