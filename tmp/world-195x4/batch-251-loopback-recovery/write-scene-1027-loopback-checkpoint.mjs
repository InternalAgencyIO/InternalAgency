import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve("tmp/world-195x4/batch-251-loopback-recovery");
const preflightPath = path.join(root, "scene-1027-loopback-recovery-preflight.json");
const outputPath = path.resolve("assets/lore/starlight-era/batch-251-djibouti-loopback-recovery-checkpoint.json");
const ledgerPath = path.resolve("assets/lore/starlight-era/world-x-publish-ledger.json");
const assetPath = path.join(root, "1027-djibouti-tadjoura-heavy-rain-loopback-recovery.png");
const preflight = JSON.parse(fs.readFileSync(preflightPath, "utf8"));
const ledgerBytes = fs.readFileSync(ledgerPath);
const assetBytes = fs.readFileSync(assetPath);

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex").toUpperCase();
const existingAccepted = [
  "1024-djibouti-day-forest-overcast-route-grid.png",
  "1025-djibouti-lake-assal-golden-signal-cipher.png",
  "1026-djibouti-lac-abbe-blue-hour-star-map-relay.png",
].map((fileName) => {
  const filePath = path.resolve("assets/lore/starlight-era", fileName);
  const bytes = fs.readFileSync(filePath);
  return {
    fileName,
    bytes: fs.statSync(filePath).size,
    sha256: sha256(bytes),
    status: "historical-accepted-preserved",
  };
});

const rejectedAsset = {
  fileName: "exec-6ecc7701-5cef-4c33-b193-b04715951970.png",
  absolutePath: "C:\\Users\\A\\.codex\\generated_images\\019fd625-0bf6-78d2-9fb8-3f3e22c1d086\\exec-6ecc7701-5cef-4c33-b193-b04715951970.png",
  workspaceCopy: "tmp/world-195x4/batch-251-loopback-recovery/1027-djibouti-tadjoura-heavy-rain-loopback-recovery.png",
  bytes: fs.statSync(assetPath).size,
  sha256: sha256(assetBytes),
  preservedOriginal: true,
  copiedToAcceptedAssets: false,
};

const checkpoint = {
  ...preflight,
  status: "terminal-blocked-after-scheduled-loopback-recovery",
  renderAttempt: {
    status: "rendered-rejected",
    requested: 1,
    rendered: 1,
    accepted: 0,
    rejected: 1,
    maximumCalls: 1,
    allowanceExhausted: true,
    reason: "The binding post-loopback queue returned to blocked Scene 1027 exactly once. No replacement or edit was started.",
    asset: rejectedAsset,
    audit: {
      pass: [
        "exactly four clearly adult women are present with the four established identities and Alia's braided hairstyle",
        "Tadjoura's whitewashed waterfront, Gulf, dhow, volcanic shore, Goda Mountains, and heavy rain curtain are recognizable",
        "Radiance alone wears the active original-spectrum rainbow knee socks and remains the affectionate center with ECE",
        "Radiance and Ellie have the rolled fully strapless silhouettes, Radiance and Alia show the rolled ordinary waists and belly buttons, and ECE shows the rolled completely open back",
        "four unmistakably different secure above-knee outfits, complete footwear, and two large complete red five-point star adaptations are visible",
        "Alia is the sole inert-prop handler and her prop arm is separated at the right edge with the muzzle directed over empty Gulf water",
        "the close group contains at least three clear consensual adult affection contacts",
      ],
      fail: [
        "Ellie's free arm and hand disappear behind the central pair, so her second hand is not continuously traceable",
        "ECE's free hand is hidden or reassigned inside the embrace, so the stored eight-hand inventory is not visibly present",
        "multiple center hands are naturally occluded but still ambiguous under the strict owner-by-owner anatomy gate",
        "Alia's index finger curls into or too close to the trigger-guard opening instead of remaining visibly straight along the frame",
      ],
      anatomyDecision: "reject",
      propSafetyDecision: "reject",
    },
  },
  historicalAcceptedAssets: existingAccepted,
  newAcceptedAssets: [],
  rejectedAssets: [rejectedAsset],
  shorteningVariants: {
    status: "not-created",
    reason: "The only loopback render failed the anatomy and trigger-index gates before garment-length review.",
  },
  xPost: {
    status: "not-submitted-backlog-already-clear",
    publishAttempted: false,
    postButtonClicked: false,
    directUserDrainRequestAudited: true,
    reason: "The signed-in X account and local ledger were audited immediately. pendingPost, preparedPostQueue, deferredPostCheckpoint, and residual image numbers were empty. The publicly audited Batch 285 through 299 boundary remained live with all three attachments, and Scene 1027 added no accepted media. A new submission would create an unprepared or duplicate post.",
    historicalDjiboutiAcceptedAssetCount: existingAccepted.length,
    newDjiboutiAcceptedAssetCount: 0,
    captionRolls: preflight.xPublishingRolls,
    eligibleCaptionShapeIfANewLogicalGroupWerePrepared: "Djibouti white-heart Fiji #Djibouti",
    hashtagsSuppressedByRoll: ["#InternalAgency", "#WorldXXXSeries"],
    ledger: {
      path: "assets/lore/starlight-era/world-x-publish-ledger.json",
      sha256: sha256(ledgerBytes),
      pendingPost: null,
      preparedPostQueueCount: 0,
      deferredPostCheckpoint: null,
      residualImageNumbers: [],
      latestAssistedDrainStatus: "publicly-clear-live-audited",
    },
    liveAudit: {
      account: "@dogramaci",
      signedIn: true,
      verifiedBoundaryStatusUrl: "https://x.com/dogramaci/status/2086336194346958963",
      verifiedBoundaryAttachmentCount: 3,
      result: "no eligible backlog item and zero Post clicks",
    },
  },
  terminalizedAt: new Date().toISOString(),
  checkpointType: "narrow-historical-scene-loopback-recovery-checkpoint",
  queueAdvance: {
    completedCountry: "Djibouti",
    completedBatch: 251,
    completedScene: 1027,
    terminalStatus: "terminal-blocked-after-scheduled-loopback-recovery",
    nextCountry: "Fiji",
    nextBatch: 304,
    nextScenes: [1236, 1237, 1238, 1239],
    nextThemePair: ["cleaner and service couture", "cinematic covert-agent crew couture"],
    reason: "The binding loopback queue is complete. Resume the prior country order after Djibouti, whose next country is Fiji.",
  },
  repositoryScope: {
    checkpointPath: "assets/lore/starlight-era/batch-251-djibouti-loopback-recovery-checkpoint.json",
    stagedFiles: [
      "assets/lore/starlight-era/batch-251-djibouti-loopback-recovery-checkpoint.json",
    ],
    acceptedAssetCopied: false,
    xLedgerUpdated: false,
    unrelatedDirtyFilesLeftUntouched: [
      "assets/lore/starlight-era/overnight-campaign.json",
      "assets/lore/starlight-era/world-195x4-campaign.json",
      "assets/lore/starlight-era/world-x-publish-ledger.json",
      "assets/videos/manifest.json",
    ],
  },
};

fs.writeFileSync(outputPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(outputPath);
