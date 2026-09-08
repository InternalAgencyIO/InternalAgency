import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const batchDir = path.join(root, "tmp", "world-195x4", "batch-312");
const preflightPath = path.join(batchDir, "batch-312-fiji-preflight.json");
const checkpointPath = path.join(
  root,
  "assets",
  "lore",
  "starlight-era",
  "batch-312-fiji-recovery-checkpoint.json",
);

const hashFile = (filePath) =>
  crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").toUpperCase();

const imageRecord = (scene, attempt, generatedName, workspacePath, reason) => {
  const absoluteWorkspacePath = path.join(root, ...workspacePath.split("/"));
  const stat = fs.statSync(absoluteWorkspacePath);
  return {
    scene,
    attempt,
    generatedName,
    workspacePath,
    reason,
    absoluteGeneratedPath: path.join(
      "C:\\Users\\A\\.codex\\generated_images\\019fd625-0bf6-78d2-9fb8-3f3e22c1d086",
      generatedName,
    ),
    bytes: stat.size,
    sha256: hashFile(absoluteWorkspacePath),
    width: 941,
    height: 1672,
    preservedOriginal: true,
    copiedToAcceptedAssets: false,
  };
};

const preflight = JSON.parse(fs.readFileSync(preflightPath, "utf8"));
const contractPath = path.join(
  root,
  "assets",
  "lore",
  "starlight-era",
  "batch-240-plus-country-glamour-romance-contract.json",
);
const ledgerPath = path.join(
  root,
  "assets",
  "lore",
  "starlight-era",
  "world-x-publish-ledger.json",
);

const raw1269Reason =
  "The male's strongest eye line goes to Alia instead of ECE, ECE does not clearly control both the separate route map and inert prop, and several shoulder-to-hand owner paths are hidden or ambiguous.";
const recoveryReasons = {
  1268:
    "The prop's clear route away from the group is ambiguous, Ellie reassigns a hand to PAWS, and multiple shoulder-to-hand paths disappear behind neighboring bodies, failing the strict eight-arm and eight-hand ownership gate.",
  1269:
    "The male gains the correct eye line to ECE but has only one clear contact because his second hand hangs at his side, while several required hand contacts and continuous owner paths remain hidden or substituted.",
  1270:
    "The scene preserves the double rainbow, outfits, emotions, and safe paddle presentation, but the seated embrace sends arm segments behind adjacent torsos, so all eight arms and hands are not continuously traceable to one owner.",
  1271:
    "Several hands and arm-owner paths are hidden or replaced, and the mostly plain garments omit the required large complete secular Fiji motifs on at least two outfits.",
};

const renderedAssets = [
  imageRecord(
    1269,
    "raw",
    "exec-2f2fe24e-995a-406f-a817-913e112be545.png",
    "tmp/world-195x4/batch-312/raw/1269-raw.png",
    raw1269Reason,
  ),
  imageRecord(
    1268,
    "recovery",
    "exec-bfcd7cae-4994-4066-bae2-534a9ff5b557.png",
    "tmp/world-195x4/batch-312/recovery/1268-recovery.png",
    recoveryReasons[1268],
  ),
  imageRecord(
    1269,
    "recovery",
    "exec-8dcc421d-d0a7-4e6e-8ea1-f75b8d7bf1d0.png",
    "tmp/world-195x4/batch-312/recovery/1269-recovery.png",
    recoveryReasons[1269],
  ),
  imageRecord(
    1270,
    "recovery",
    "exec-463d0ca4-ea24-44e4-a7ad-0b1c85443956.png",
    "tmp/world-195x4/batch-312/recovery/1270-recovery.png",
    recoveryReasons[1270],
  ),
  imageRecord(
    1271,
    "recovery",
    "exec-4b84b90f-4456-40a1-8f24-fc36a0b1fca3.png",
    "tmp/world-195x4/batch-312/recovery/1271-recovery.png",
    recoveryReasons[1271],
  ),
];

const blockedRaw = {
  1268: {
    status: "blocked-output-moderation-no-image",
    category: "sexual",
    requestId: "abb3c862-cf2c-4e4e-a23b-e11a9dfe7715",
  },
  1270: {
    status: "blocked-output-moderation-no-image",
    category: "sexual",
    requestId: "45450843-1eeb-4c62-9b71-2425694148a4",
  },
  1271: {
    status: "blocked-output-moderation-no-image",
    category: "sexual",
    requestId: "2b34d75f-60e5-4334-a241-2c64bd21247a",
  },
};

const checkpoint = {
  ...preflight,
  status: "terminal-blocked-after-single-recovery-pass",
  contractSha256: hashFile(contractPath),
  inputHashes: {
    preflightSha256: hashFile(preflightPath),
    recoveryPromptSha256: {
      1268: hashFile(path.join(batchDir, "scene-1268-recovery-prompt.txt")),
      1269: hashFile(path.join(batchDir, "scene-1269-recovery-prompt.txt")),
      1270: hashFile(path.join(batchDir, "scene-1270-recovery-prompt.txt")),
      1271: hashFile(path.join(batchDir, "scene-1271-recovery-prompt.txt")),
    },
    xPublishingLedgerSha256: hashFile(ledgerPath),
  },
  renderAttempts: {
    raw: {
      status: "complete",
      requested: 4,
      concurrency: "four independent built-in image generation calls launched together with all-settled result handling",
      returnedImages: [1269],
      blockedNoImage: blockedRaw,
    },
    recovery: {
      status: "complete-single-pass-exhausted",
      maximumPerBlockedScene: 1,
      attemptedScenes: [1268, 1269, 1270, 1271],
      returnedImages: [1268, 1269, 1270, 1271],
      acceptedScenes: [],
    },
  },
  renderedAssets,
  sceneResults: {
    1268: {
      rawAudit: {
        accepted: false,
        reason: "The raw renderer's output moderation returned no image.",
        ...blockedRaw[1268],
      },
      recoveryAudit: { accepted: false, reason: recoveryReasons[1268] },
      terminalOutcome: "blocked-after-single-recovery-pass",
      acceptedAsset: null,
    },
    1269: {
      rawAudit: { accepted: false, reason: raw1269Reason },
      recoveryAudit: { accepted: false, reason: recoveryReasons[1269] },
      terminalOutcome: "blocked-after-single-recovery-pass",
      acceptedAsset: null,
    },
    1270: {
      rawAudit: {
        accepted: false,
        reason: "The raw renderer's output moderation returned no image.",
        ...blockedRaw[1270],
      },
      recoveryAudit: { accepted: false, reason: recoveryReasons[1270] },
      terminalOutcome: "blocked-after-single-recovery-pass",
      acceptedAsset: null,
    },
    1271: {
      rawAudit: {
        accepted: false,
        reason: "The raw renderer's output moderation returned no image.",
        ...blockedRaw[1271],
      },
      recoveryAudit: { accepted: false, reason: recoveryReasons[1271] },
      terminalOutcome: "blocked-after-single-recovery-pass",
      acceptedAsset: null,
    },
  },
  acceptedAssets: [],
  rejectedAssets: [1268, 1269, 1270, 1271],
  shorteningVariants: [],
  xPost: {
    status: "deferred-insufficient-accepted-assets",
    minimumCurrentCountryAcceptedAssets: 2,
    acceptedCurrentCountryAssets: 0,
    reason: "Fiji has zero accepted current-country images after its single recovery pass.",
    ledgerModified: false,
  },
  queueAdvance: {
    allowed: true,
    reason: "The batch is terminal after one raw pass and one recovery pass per scene, so the binding queue advances despite zero accepted assets.",
    nextCountry: preflight.nextQueueCountry,
    nextBatch: preflight.nextQueueBatch,
    nextScenes: preflight.nextQueueScenes,
    nextThemePair: preflight.nextThemePair,
  },
  repositoryScope: {
    copiedAcceptedAssets: [],
    stagedPaths: [
      "assets/lore/starlight-era/batch-312-fiji-recovery-checkpoint.json",
    ],
    unrelatedDirtyFilesPreserved: [
      "assets/lore/starlight-era/overnight-campaign.json",
      "assets/lore/starlight-era/world-195x4-campaign.json",
      "assets/lore/starlight-era/world-x-publish-ledger.json",
      "assets/videos/manifest.json",
    ],
  },
  terminalizedAt: new Date().toISOString(),
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`);
console.log(
  JSON.stringify(
    {
      checkpointPath,
      bytes: fs.statSync(checkpointPath).size,
      sha256: hashFile(checkpointPath),
      accepted: checkpoint.acceptedAssets.length,
      next: checkpoint.queueAdvance,
    },
    null,
    2,
  ),
);
