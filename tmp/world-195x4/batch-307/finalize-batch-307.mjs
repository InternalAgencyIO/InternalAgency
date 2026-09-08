import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = process.cwd();
const preflightPath = "tmp/world-195x4/batch-307/batch-307-solomon-islands-preflight.json";
const checkpointPath = "assets/lore/starlight-era/batch-307-solomon-islands-recovery-checkpoint.json";
const ledgerPath = "assets/lore/starlight-era/world-x-publish-ledger.json";

const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const sha256 = (relativePath) => crypto.createHash("sha256").update(fs.readFileSync(path.join(root, relativePath))).digest("hex").toUpperCase();
const artifact = (relativePath) => {
  const stat = fs.statSync(path.join(root, relativePath));
  return { path: relativePath.replaceAll("\\", "/"), bytes: stat.size, sha256: sha256(relativePath) };
};
const imageAsset = (scene, attempt, generatedName, workspacePath, absoluteGeneratedPath) => ({
  scene,
  attempt,
  generatedName,
  workspacePath,
  absoluteGeneratedPath,
  bytes: fs.statSync(path.join(root, workspacePath)).size,
  sha256: sha256(workspacePath),
  width: 941,
  height: 1672,
  preservedOriginal: true,
  copiedToAcceptedAssets: false,
});

const preflight = readJson(preflightPath);
const ledger = readJson(ledgerPath);

const raw1249 = imageAsset(
  1249,
  "raw",
  "exec-19608574-3479-4d51-aace-f3acaa44f921.png",
  "tmp/world-195x4/batch-307/1249-solomon-islands-mataniko-overcast-raw.png",
  "C:\\Users\\A\\.codex\\generated_images\\019fd625-0bf6-78d2-9fb8-3f3e22c1d086\\exec-19608574-3479-4d51-aace-f3acaa44f921.png",
);
const recovery1249 = imageAsset(
  1249,
  "recovery",
  "exec-60e3236a-edc2-498b-89fb-01a8814568a6.png",
  "tmp/world-195x4/batch-307/1249-solomon-islands-mataniko-overcast-recovery.png",
  "C:\\Users\\A\\.codex\\generated_images\\019fd625-0bf6-78d2-9fb8-3f3e22c1d086\\exec-60e3236a-edc2-498b-89fb-01a8814568a6.png",
);
const raw1250 = imageAsset(
  1250,
  "raw",
  "exec-155f8fcb-1c71-45b7-bcbc-23aab552d94c.png",
  "tmp/world-195x4/batch-307/1250-solomon-islands-marovo-thunderstorm-raw.png",
  "C:\\Users\\A\\.codex\\generated_images\\019fd625-0bf6-78d2-9fb8-3f3e22c1d086\\exec-155f8fcb-1c71-45b7-bcbc-23aab552d94c.png",
);
const recovery1250 = imageAsset(
  1250,
  "recovery",
  "exec-5a3aea86-26b2-48ee-8db5-43fabec4af72.png",
  "tmp/world-195x4/batch-307/1250-solomon-islands-marovo-thunderstorm-recovery.png",
  "C:\\Users\\A\\.codex\\generated_images\\019fd625-0bf6-78d2-9fb8-3f3e22c1d086\\exec-5a3aea86-26b2-48ee-8db5-43fabec4af72.png",
);
const raw1251 = imageAsset(
  1251,
  "raw",
  "exec-cc2914c6-d452-4b40-ab06-29427fccf45f.png",
  "tmp/world-195x4/batch-307/1251-solomon-islands-rennell-blizzard-male-raw.png",
  "C:\\Users\\A\\.codex\\generated_images\\019fd625-0bf6-78d2-9fb8-3f3e22c1d086\\exec-cc2914c6-d452-4b40-ab06-29427fccf45f.png",
);
const recovery1251 = imageAsset(
  1251,
  "recovery",
  "exec-23fb0dc6-470a-4ad1-9826-e3c9a3259d0a.png",
  "tmp/world-195x4/batch-307/1251-solomon-islands-rennell-blizzard-male-recovery.png",
  "C:\\Users\\A\\.codex\\generated_images\\019fd625-0bf6-78d2-9fb8-3f3e22c1d086\\exec-23fb0dc6-470a-4ad1-9826-e3c9a3259d0a.png",
);

const rawPrompts = [1248, 1249, 1250, 1251].map((scene) => ({
  scene,
  attempt: "raw",
  ...artifact(`tmp/world-195x4/batch-307/scene-${scene}-prompt.txt`),
}));
const recoveryPrompts = [1248, 1249, 1250, 1251].map((scene) => ({
  scene,
  attempt: "recovery",
  ...artifact(`tmp/world-195x4/batch-307/scene-${scene}-recovery-prompt.txt`),
}));

const sceneResults = {
  "1248": {
    status: "terminal-moderation-blocked-after-recovery",
    raw: {
      status: "moderation-blocked-no-output",
      requestId: "0ba5a9a2-734f-464e-8d56-021b86a97973",
      category: "sexual",
      returnedImage: false,
      workspacePath: null,
      prompt: rawPrompts[0],
      fail: ["The built-in image call returned no pixels, so the raw attempt could not be audited or accepted."],
    },
    recovery: {
      status: "moderation-blocked-no-output",
      requestId: "a3c45c8b-e06c-4df2-b0c9-2cbfd710c903",
      category: "sexual",
      returnedImage: false,
      workspacePath: null,
      prompt: recoveryPrompts[0],
      fail: ["The single sanitized fresh recovery also returned no pixels and exhausted the allowed recovery pass."],
    },
    recoveryAllowanceExhausted: true,
  },
  "1249": {
    status: "terminal-rejected-after-recovery",
    raw: {
      status: "rendered-rejected",
      asset: raw1249,
      pass: [
        "Exactly four clearly adult women, Mataniko Falls, the hidden cave, overcast weather, full footwear, four different silhouettes, visible rolled navels, large Solomon Islands motifs, and multiple affectionate contacts are present.",
        "The returned frame preserves all four identities and Alia's braided look.",
      ],
      fail: ["ECE's index finger enters or crosses the trigger guard instead of remaining straight on the outer frame."],
    },
    recovery: {
      status: "rendered-rejected",
      asset: recovery1249,
      prompt: recoveryPrompts[1],
      auditCrop: artifact("tmp/world-195x4/batch-307/1249-recovery-prop-audit.png"),
      pass: [
        "Mataniko Falls, the cave, four adults, distinct fashion silhouettes, country motifs, visible navels, stable footwear, and public affectionate contacts remain strong.",
      ],
      fail: [
        "The original-resolution crop confirms ECE's index finger remains through the trigger-guard opening.",
        "The dark-haired second woman's second arm and hand disappear behind the group, leaving only seven continuously visible hands.",
      ],
    },
    recoveryAllowanceExhausted: true,
  },
  "1250": {
    status: "terminal-rejected-after-recovery",
    raw: {
      status: "rendered-rejected",
      asset: raw1250,
      pass: [
        "Exactly four clearly adult women, Marovo Lagoon, Uepi Island, coral water, thunderstorm weather, four different rolled cuts, large five-star and marine motifs, full footwear, and multiple affectionate contacts are visible.",
        "ECE's open rear construction and the rolled visible navels are materially present.",
      ],
      fail: ["ECE's index finger enters or crosses the trigger guard instead of remaining straight on the outer frame."],
    },
    recovery: {
      status: "rendered-rejected",
      asset: recovery1250,
      prompt: recoveryPrompts[2],
      auditCrop: artifact("tmp/world-195x4/batch-307/1250-recovery-prop-audit.png"),
      pass: [
        "The Marovo and Uepi setting, storm, four adults, unique silhouettes, exact cut visibility, large country and reef motifs, affectionate contacts, and complete footwear are preserved.",
      ],
      fail: [
        "The original-resolution crop confirms ECE's index finger rests inside the trigger guard.",
        "The green-sleeved woman has an ambiguous extra or borrowed arm path toward ECE while another hand is linked low, so exactly eight owner-traceable arms and hands cannot be certified.",
      ],
    },
    recoveryAllowanceExhausted: true,
  },
  "1251": {
    status: "terminal-rejected-after-recovery",
    raw: {
      status: "rendered-rejected",
      asset: raw1251,
      pass: [
        "Exactly five clearly adult people, East Rennell's Lake Tegano and limestone islets, blizzard weather, the established muscular bearded male, large Solomon Islands motifs, ecology fields, and complete footwear are visible.",
        "The husband has multiple clear public relationship contacts.",
      ],
      fail: [
        "Ellie's rolled cropped waist and visible navel are missing.",
        "The husband's strongest eye line lands on the nearer woman instead of ECE.",
        "The central hand cluster is not continuously owner-traceable and the prop index is inside or across the guard.",
      ],
    },
    recovery: {
      status: "rendered-rejected",
      asset: recovery1251,
      prompt: recoveryPrompts[3],
      auditCrop: artifact("tmp/world-195x4/batch-307/1251-recovery-prop-audit.png"),
      pass: [
        "The recovery preserves five adults, Lake Tegano, limestone islets, the blizzard, the male's beard, fitted short-sleeve polo and black jeans, prominent five-star fashion geometry, ecology motifs, multiple contacts, and full footwear.",
        "The green cropped jacket now exposes an ordinary navel.",
      ],
      fail: [
        "Ellie's anchored dark-haired identity changes to a second blonde identity.",
        "The husband's head and pupils remain fixed on the nearer blonde woman instead of ECE at far left.",
        "The original-resolution crop confirms ECE's index finger remains inside the trigger guard.",
        "The five-person contact cluster contains hidden, borrowed, or ambiguous owner paths, so exactly ten arms and ten hands cannot be certified.",
      ],
    },
    recoveryAllowanceExhausted: true,
  },
};

const rejectedAssets = [raw1249, recovery1249, raw1250, recovery1250, raw1251, recovery1251];
const checkpoint = {
  ...preflight,
  status: "terminal-blocked-after-single-recovery-pass",
  renderAttempts: {
    raw: {
      requested: 4,
      returnedImages: 3,
      moderationBlockedNoOutput: 1,
      concurrency: "Four independent built-in calls were issued serially because the host exposed no supported parallel fan-out primitive.",
      blockedAttempts: [{ scene: 1248, requestId: "0ba5a9a2-734f-464e-8d56-021b86a97973", category: "sexual" }],
    },
    recovery: {
      requested: 4,
      returnedImages: 3,
      moderationBlockedNoOutput: 1,
      maximumPerBlockedScene: 1,
      blockedAttempts: [{ scene: 1248, requestId: "a3c45c8b-e06c-4df2-b0c9-2cbfd710c903", category: "sexual" }],
      allowanceExhaustedForScenes: [1248, 1249, 1250, 1251],
    },
    totalReturnedImages: 6,
    accepted: 0,
    rejected: 6,
    terminal: true,
  },
  acceptedAssets: [],
  rejectedAssets,
  xPost: {
    status: "deferred-insufficient-accepted-assets",
    publishAttempted: false,
    postButtonClicked: false,
    currentCountryAcceptedAssetCount: 0,
    minimumCurrentCountryAcceptedAssets: 2,
    reason: "Solomon Islands has zero accepted current-country images, so no eligible two-main-plus-one-secondary attachment group exists.",
    captionRolls: preflight.xPublishingRolls,
    eligibleCaptionShapeIfAssetsHadPassed: "Solomon Islands red heart Comoros #SolomonIslands",
    hashtagsSuppressedByRoll: ["#InternalAgency", "#WorldXXXSeries"],
    ledger: {
      path: ledgerPath,
      sha256: sha256(ledgerPath),
      pendingPost: ledger.pendingPost,
      preparedPostQueueCount: Array.isArray(ledger.preparedPostQueue) ? ledger.preparedPostQueue.length : 0,
      deferredPostCheckpoint: ledger.deferredPostCheckpoint,
      residualImageNumbers: ledger.backlogDrainPolicy?.residualImageNumbers ?? [],
      backlogDrainStatus: ledger.backlogDrainPolicy?.status ?? null,
      preRenderBacklogStatus: ledger.preRenderBacklogStatus ?? null,
      latestAssistedDrainStatus: ledger.latestAssistedDrain?.status ?? null,
    },
    action: "No browser submission was opened because the two-current-country-image publishing threshold was not met.",
  },
  checkpointType: "terminal-country-recovery-checkpoint",
  preflightPath,
  preflightSha256: sha256(preflightPath),
  promptArtifacts: { raw: rawPrompts, recovery: recoveryPrompts },
  sceneResults,
  shorteningVariants: {
    status: "not-created",
    reason: "Every returned image failed moderation, trigger-index, identity, rolled-cut, eye-line, or strict anatomy gates before garment-length review.",
  },
  queueAdvance: {
    completedCountry: "Solomon Islands",
    completedBatch: 307,
    terminalStatus: "terminal-blocked-after-single-recovery-pass",
    nextCountry: "Bhutan",
    nextBatch: 308,
    nextScenes: [1252, 1253, 1254, 1255],
    nextThemePair: ["doctor-clinical-command couture", "adult nightlife dance-performance couture"],
    reason: "A terminal zero-accepted batch advances after its one recovery pass under the binding queue rule.",
  },
  repositoryScope: {
    checkpointPath,
    stagedFiles: [checkpointPath],
    acceptedAssetsCopied: [],
    acceptedAssetCopied: false,
    xLedgerUpdated: false,
    unrelatedDirtyFilesLeftUntouched: [
      "assets/lore/starlight-era/overnight-campaign.json",
      "assets/lore/starlight-era/world-195x4-campaign.json",
      "assets/lore/starlight-era/world-x-publish-ledger.json",
      "assets/videos/manifest.json",
    ],
  },
  terminalizedAt: new Date().toISOString(),
};

fs.writeFileSync(path.join(root, checkpointPath), `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ checkpointPath, bytes: fs.statSync(path.join(root, checkpointPath)).size, sha256: sha256(checkpointPath), status: checkpoint.status, accepted: checkpoint.acceptedAssets.length, next: checkpoint.queueAdvance }, null, 2));
