import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = process.cwd();
const preflightRelative = "tmp/world-195x4/batch-306/batch-306-guyana-preflight.json";
const checkpointRelative = "assets/lore/starlight-era/batch-306-guyana-recovery-checkpoint.json";
const ledgerRelative = "assets/lore/starlight-era/world-x-publish-ledger.json";

const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
const sha256 = (relative) => crypto
  .createHash("sha256")
  .update(fs.readFileSync(path.join(root, relative)))
  .digest("hex")
  .toUpperCase();

const fileRecord = (scene, attempt, generatedName, workspacePath) => {
  const absoluteGeneratedPath = path.join(
    "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086",
    generatedName,
  ).replaceAll("/", "\\");
  const stat = fs.statSync(path.join(root, workspacePath));
  return {
    scene,
    attempt,
    generatedName,
    workspacePath,
    absoluteGeneratedPath,
    bytes: stat.size,
    sha256: sha256(workspacePath),
    preservedOriginal: true,
    copiedToAcceptedAssets: false,
  };
};

const promptRecord = (scene, attempt, relative) => {
  const stat = fs.statSync(path.join(root, relative));
  return { scene, attempt, path: relative, bytes: stat.size, sha256: sha256(relative) };
};

const preflight = readJson(preflightRelative);
const ledger = readJson(ledgerRelative);

const assets = {
  raw1244: fileRecord(1244, "raw", "exec-958aeed4-fc4d-4dd4-bf8c-2cf1e0838165.png", "tmp/world-195x4/batch-306/1244-guyana-georgetown-mammatus-radiance-hosiery-raw.png"),
  recovery1244: fileRecord(1244, "recovery", "exec-663e9af5-a41a-4c08-bdf3-f5a6eb8c34b9.png", "tmp/world-195x4/batch-306/1244-guyana-georgetown-mammatus-radiance-hosiery-recovery.png"),
  raw1245: fileRecord(1245, "raw", "exec-311ea92d-efd7-40bf-a497-8126105f6eba.png", "tmp/world-195x4/batch-306/1245-guyana-kaieteur-fog-male-raw.png"),
  recovery1245: fileRecord(1245, "recovery", "exec-aec212bd-6472-47ec-a467-fb0a60e754d2.png", "tmp/world-195x4/batch-306/1245-guyana-kaieteur-fog-male-recovery.png"),
  raw1246: fileRecord(1246, "raw", "exec-d0363fbb-e2ac-4339-9b0d-8446fc82978c.png", "tmp/world-195x4/batch-306/1246-guyana-rupununi-lightning-rainbow-ece-hosiery-raw.png"),
  recovery1246: fileRecord(1246, "recovery", "exec-d7de15c7-ea43-4164-8c8f-a72d57c85afb.png", "tmp/world-195x4/batch-306/1246-guyana-rupununi-lightning-rainbow-ece-hosiery-recovery.png"),
  recovery1247: fileRecord(1247, "recovery", "exec-2c82b842-63f1-46a2-965a-a7015f8947fb.png", "tmp/world-195x4/batch-306/1247-guyana-iwokrama-windstorm-recovery.png"),
};

const rawPromptRecords = [1244, 1245, 1246, 1247].map((scene) =>
  promptRecord(scene, "raw", `tmp/world-195x4/batch-306/scene-${scene}-prompt.txt`),
);
const recoveryPromptRecords = [1244, 1245, 1246, 1247].map((scene) =>
  promptRecord(scene, "recovery", `tmp/world-195x4/batch-306/scene-${scene}-recovery-prompt.txt`),
);

const sceneResults = {
  "1244": {
    status: "terminal-rejected-after-recovery",
    raw: {
      status: "rendered-rejected",
      asset: assets.raw1244,
      pass: [
        "exactly four clearly adult women and the four established identities are present with Alia's braided look",
        "Stabroek Market, the Demerara River, mammatus weather, country food display, large complete Guyana motifs, four distinct outfits, and Radiance's country-palette rainbow hosiery are visible",
        "the rolled midriff and back states are substantially materialized and the prop points over empty river water",
      ],
      fail: [
        "Alia's free hand is not placed on Ellie as prescribed while a shoulder hand is reassigned from a neighboring body",
        "multiple center hands are hidden or ambiguously owned, so exactly eight continuously traceable hands are not established",
        "the prop index is not visibly straight and high outside the complete trigger guard",
      ],
    },
    recovery: {
      status: "rendered-rejected",
      asset: assets.recovery1244,
      prompt: recoveryPromptRecords[0],
      pass: [
        "the four identities, Stabroek clock tower, mammatus ceiling, food display, large motifs, country-palette hosiery, complete footwear, and public-safe wardrobe remain strong",
        "the prop lane remains isolated over empty Demerara water",
      ],
      fail: [
        "Alia's free hand remains absent from its assigned shoulder contact while Ellie's hand occupies that shoulder",
        "the center hand chain still hides or reassigns hand owners and does not prove exactly eight hands",
        "the trigger finger still reads inside or immediately across the guard rather than indexed along the outer frame",
      ],
    },
    recoveryAllowanceExhausted: true,
  },
  "1245": {
    status: "terminal-rejected-after-recovery",
    raw: {
      status: "rendered-rejected",
      asset: assets.raw1245,
      pass: [
        "exactly five clearly adult people are present with the established male added without replacing a woman",
        "Kaieteur Falls, Potaro River, dense fog, large Guyana motifs, four distinct women's outfits, the male's fitted polo and black jeans, and full footwear are visible",
        "the male has visible adult relationship contacts with Ellie and Alia",
      ],
      fail: [
        "ECE's second arm and hand are hidden and the full ten-hand owner inventory is not continuously traceable",
        "the male's strongest eye line lands on Alia rather than crossing the group to ECE",
        "the prop index is not visibly straight outside the complete trigger guard",
      ],
    },
    recovery: {
      status: "rendered-rejected",
      asset: assets.recovery1245,
      prompt: recoveryPromptRecords[1],
      pass: [
        "the five identities, complete Kaieteur setting, fog, outfits, large country motifs, full shoes, and the male's contacts with Ellie and Alia are preserved",
        "all five adults remain visibly mature and publicly dressed",
      ],
      fail: [
        "ECE's second hand remains hidden, so exactly ten arms and ten hands cannot be traced",
        "the male's strongest eye line stops on Ellie instead of reaching ECE",
        "the trigger finger remains inside or across the guard opening",
      ],
    },
    recoveryAllowanceExhausted: true,
  },
  "1246": {
    status: "terminal-rejected-after-recovery",
    raw: {
      status: "rendered-rejected",
      asset: assets.raw1246,
      pass: [
        "exactly four clearly adult women and the established identities are present with Alia's braided look",
        "Rupununi River, savannah, Pakaraima mountains, silent heat lightning, full rainbow styling, large Guyana motifs, four distinct cuts, ECE's country-palette hosiery, and the affectionate center are visible",
        "the lateral relationship chain and complete footwear are substantially clear",
      ],
      fail: [
        "Alia's right index finger enters or crosses the trigger guard instead of remaining straight along the outer frame",
        "the strict prop-safety gate fails even though the muzzle points across empty water",
      ],
    },
    recovery: {
      status: "rendered-rejected",
      asset: assets.recovery1246,
      prompt: recoveryPromptRecords[2],
      auditCrop: {
        path: "tmp/world-195x4/batch-306/1246-recovery-prop-audit.png",
        bytes: fs.statSync(path.join(root, "tmp/world-195x4/batch-306/1246-recovery-prop-audit.png")).size,
        sha256: sha256("tmp/world-195x4/batch-306/1246-recovery-prop-audit.png"),
      },
      pass: [
        "the identities, Rupununi setting, heat lightning, rainbow styling, four silhouettes, large motifs, ECE hosiery, affectionate contacts, and full framing are preserved",
        "the two-hand prop pose remains pointed only over empty Rupununi water",
      ],
      fail: [
        "the original-resolution prop crop confirms Alia's index finger passes through the guard opening instead of lying straight on the outer frame",
        "the mandatory trigger-index rule still fails after the only permitted recovery",
      ],
    },
    recoveryAllowanceExhausted: true,
  },
  "1247": {
    status: "terminal-rejected-after-recovery",
    raw: {
      status: "moderation-blocked-no-output",
      requestId: "4ebdc960-21c5-4d83-ae89-d7930f4cf795",
      category: "sexual",
      returnedImage: false,
      workspacePath: null,
      pass: [],
      fail: ["the built-in image call returned no image, so the raw attempt could not be audited or accepted"],
    },
    recovery: {
      status: "rendered-rejected",
      asset: assets.recovery1247,
      prompt: recoveryPromptRecords[3],
      pass: [
        "the sanitized fresh recovery returns exactly four clearly adult women with the established identities and Alia's braided look",
        "Iwokrama canopy structures, Essequibo River, Turtle Mountain, wind-driven hair, large secular Guyana motifs, four distinct outfits, and full footwear are visible",
        "the hand links between Radiance, Ellie, and Alia are clearly public-safe",
      ],
      fail: [
        "Radiance's second hand is hidden behind her body, leaving only seven continuously traceable hands",
        "ECE's prop index enters or crosses the trigger guard instead of remaining straight along the outer frame",
        "Radiance's rolled fully open rear design is not visibly auditable",
      ],
    },
    recoveryAllowanceExhausted: true,
  },
};

const checkpoint = {
  ...preflight,
  status: "terminal-blocked-after-single-recovery-pass",
  renderAttempts: {
    raw: {
      requested: 4,
      returnedImages: 3,
      moderationBlockedNoOutput: 1,
      concurrency: "four independent built-in calls issued serially because the host exposed no supported parallel fan-out primitive",
      blockedAttempts: [{ scene: 1247, requestId: "4ebdc960-21c5-4d83-ae89-d7930f4cf795", category: "sexual" }],
    },
    recovery: {
      requested: 4,
      returnedImages: 4,
      moderationBlockedNoOutput: 0,
      maximumPerBlockedScene: 1,
      allowanceExhaustedForScenes: [1244, 1245, 1246, 1247],
    },
    totalReturnedImages: 7,
    accepted: 0,
    rejected: 7,
    terminal: true,
  },
  acceptedAssets: [],
  rejectedAssets: Object.values(assets),
  xPost: {
    status: "deferred-insufficient-accepted-assets",
    publishAttempted: false,
    postButtonClicked: false,
    currentCountryAcceptedAssetCount: 0,
    minimumCurrentCountryAcceptedAssets: 2,
    reason: "Guyana has zero accepted current-country images, so no eligible two-main-plus-one-secondary attachment group exists.",
    captionRolls: preflight.xPublishingRolls,
    eligibleCaptionShapeIfAssetsHadPassed: "Guyana red heart Comoros #Guyana",
    hashtagsSuppressedByRoll: ["#InternalAgency", "#WorldXXXSeries"],
    ledger: {
      path: ledgerRelative,
      sha256: sha256(ledgerRelative),
      pendingPost: ledger.pendingPost,
      preparedPostQueueCount: ledger.preparedPostQueue.length,
      deferredPostCheckpoint: ledger.deferredPostCheckpoint,
      residualImageNumbers: ledger.backlogDrainPolicy.residualImageNumbers,
      backlogDrainStatus: ledger.backlogDrainPolicy.status,
      preRenderBacklogStatus: ledger.preRenderBacklogStatus,
      latestAssistedDrainStatus: ledger.latestAssistedDrain?.status ?? "publicly-clear-live-audited",
    },
    action: "No browser submission was opened because the two-current-country-image publishing threshold was not met.",
  },
  checkpointType: "narrow-country-batch-recovery-checkpoint",
  preflightPath: preflightRelative,
  preflightSha256: sha256(preflightRelative),
  promptArtifacts: {
    raw: rawPromptRecords,
    recovery: recoveryPromptRecords,
  },
  sceneResults,
  shorteningVariants: {
    status: "not-created",
    reason: "Every returned Guyana image failed anatomy, trigger-index, eye-line, or rolled-cut gates before garment-length review.",
  },
  queueAdvance: {
    completedCountry: "Guyana",
    completedBatch: 306,
    terminalStatus: "terminal-blocked-after-single-recovery-pass",
    nextCountry: "Solomon Islands",
    nextBatch: 307,
    nextScenes: [1248, 1249, 1250, 1251],
    nextThemePair: ["nurse-care couture", "doctor-clinical-command couture"],
    reason: "A terminal zero-accepted batch advances after its one recovery pass under the binding queue rule.",
  },
  repositoryScope: {
    checkpointPath: checkpointRelative,
    stagedFiles: [checkpointRelative],
    acceptedAssetsCopied: [],
    acceptedAssetCopied: false,
    xLedgerUpdated: false,
    unrelatedDirtyFilesLeftUntouched: [
      "assets/lore/starlight-era/overnight-campaign.json",
      "assets/lore/starlight-era/world-195x4-campaign.json",
      ledgerRelative,
      "assets/videos/manifest.json",
    ],
  },
  terminalizedAt: new Date().toISOString(),
};

fs.writeFileSync(path.join(root, checkpointRelative), `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  checkpointPath: checkpointRelative,
  checkpointSha256: sha256(checkpointRelative),
  status: checkpoint.status,
  accepted: checkpoint.renderAttempts.accepted,
  rejected: checkpoint.renderAttempts.rejected,
  nextCountry: checkpoint.queueAdvance.nextCountry,
}, null, 2));
