import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const preflightPath = path.resolve("tmp/world-195x4/batch-304/batch-304-fiji-preflight.json");
const outputPath = path.resolve("assets/lore/starlight-era/batch-304-fiji-recovery-checkpoint.json");
const contractPath = path.resolve("assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const ledgerPath = path.resolve("assets/lore/starlight-era/world-x-publish-ledger.json");
const preflightBytes = fs.readFileSync(preflightPath);
const preflight = JSON.parse(preflightBytes.toString("utf8"));
const ledgerBytes = fs.readFileSync(ledgerPath);
const ledger = JSON.parse(ledgerBytes.toString("utf8"));

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex").toUpperCase();
}

function asset(relativePath, generatedName, attempt) {
  const absolutePath = path.resolve(relativePath);
  const bytes = fs.readFileSync(absolutePath);
  return {
    scene: Number(path.basename(relativePath).slice(0, 4)),
    attempt,
    generatedName,
    workspacePath: relativePath.replaceAll("\\", "/"),
    absoluteGeneratedPath: path.resolve(
      "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086",
      generatedName
    ),
    bytes: bytes.length,
    sha256: sha256(bytes),
    preservedOriginal: true,
    copiedToAcceptedAssets: false
  };
}

const returnedAssets = {
  1236: {
    raw: asset(
      "tmp/world-195x4/batch-304/1236-fiji-suva-heritage-golden-hour-raw.png",
      "exec-77d30eaf-b150-4caa-a369-24cf64875a5f.png",
      "raw"
    ),
    recovery: asset(
      "tmp/world-195x4/batch-304/1236-fiji-suva-heritage-golden-hour-recovery.png",
      "exec-d84ad2ab-0bb7-40d6-babf-b2cfa4b465c3.png",
      "recovery"
    )
  },
  1237: {
    recovery: asset(
      "tmp/world-195x4/batch-304/1237-fiji-sleeping-giant-heat-lightning-recovery.png",
      "exec-fb48eef4-674e-4ac9-a83e-49a4abb67f00.png",
      "recovery"
    )
  },
  1238: {
    raw: asset(
      "tmp/world-195x4/batch-304/1238-fiji-sigatoka-dunes-sea-mist-male-paws-raw.png",
      "exec-d2ab4440-85ad-4d2e-8865-e32f6849a688.png",
      "raw"
    ),
    recovery: asset(
      "tmp/world-195x4/batch-304/1238-fiji-sigatoka-dunes-sea-mist-male-paws-recovery.png",
      "exec-91d250fe-b6fe-43af-a257-7fa05db683d6.png",
      "recovery"
    )
  },
  1239: {
    raw: asset(
      "tmp/world-195x4/batch-304/1239-fiji-tavoro-falls-overcast-paws-raw.png",
      "exec-173128f5-ef56-432b-9fa3-fb44c4f5e29d.png",
      "raw"
    )
  }
};

const expectedHashes = {
  "1236-raw": "1944DF546E1E1C815EB5B2B3F3D60880D24484A11C40B6EF18D24822C08FDAB7",
  "1236-recovery": "7638F729D26ADCA7E9AEF55E97546BEB931DE3CFB28AD1B2A24C4641E5C3A9F1",
  "1237-recovery": "049BE5A145739ABF1FDBD507739D4C894989747AC077B3A486DDFD075A3AD9D8",
  "1238-raw": "F2807E62FC3A56164BA2399B691E56DDB0695DE4A372FBC5721F1ED246A85D46",
  "1238-recovery": "DFF5E622CC3A571E38619171911C2A66EDA5806481384A31DEDD87D6CC5887EB",
  "1239-raw": "CCE321559EC32C4EA6AE5A4A7547AC12919069AD9DC6961FB23D881DD5F1785A"
};

for (const [scene, attempts] of Object.entries(returnedAssets)) {
  for (const [attempt, details] of Object.entries(attempts)) {
    const expected = expectedHashes[`${scene}-${attempt}`];
    if (details.sha256 !== expected) throw new Error(`${scene} ${attempt} hash drifted`);
  }
}

const sceneResults = {
  1236: {
    status: "terminal-rejected-after-recovery",
    raw: {
      status: "rendered-rejected",
      asset: returnedAssets[1236].raw,
      pass: [
        "four clearly adult women and the four established identities are present",
        "Suva heritage architecture, harbour, tropical craft display, market produce, golden-hour weather, large Fiji motifs, and original-spectrum ECE hosiery are strong",
        "Alia alone handles the prop at the isolated water edge and at least three affectionate contacts are visible"
      ],
      fail: [
        "Radiance's free arm and ECE's free hand are hidden or reassigned inside the central group",
        "the complete eight-hand inventory is not continuously traceable owner by owner",
        "Alia's index finger curls into the trigger-guard opening"
      ]
    },
    recovery: {
      status: "rendered-rejected",
      asset: returnedAssets[1236].recovery,
      pass: [
        "the target's faces, waterfront, craft display, outfit variety, large Fiji motifs, hosiery, and full-length framing are preserved",
        "the far-right woman's two hands are separately visible and the central linked-hand contact is clear"
      ],
      fail: [
        "Alia's non-prop hand, Radiance's free hand, and ECE's free hand remain hidden or ambiguously reassigned",
        "the strict eight-hand owner trace still fails",
        "Alia's index finger remains curled at or inside the trigger guard"
      ]
    },
    recoveryAllowanceExhausted: true
  },
  1237: {
    status: "terminal-rejected-after-recovery",
    raw: {
      status: "moderation-blocked-no-output",
      requestId: "128e0c5c-7e33-4d86-9cc7-61d44dceb1c7",
      category: "sexual",
      fileCreated: false
    },
    recovery: {
      status: "rendered-rejected",
      asset: returnedAssets[1237].recovery,
      pass: [
        "four clearly adult women and the four established identities are present with Alia's braids",
        "Sleeping Giant mountain, orchids, lily pond, lightning, large Fiji botanical motifs, distinct outfits, and full footwear are visible",
        "eight arms and eight hands are plausibly present with several readable contacts"
      ],
      fail: [
        "ECE carries a small prop low beside her thigh instead of actively demonstrating the required full-size chest-height route prop",
        "the prop reads toy-like, its trigger index is not auditable, and its muzzle does not point across the prescribed empty pond route",
        "Alia's rolled complete open back is not visibly established"
      ]
    },
    recoveryAllowanceExhausted: true
  },
  1238: {
    status: "terminal-rejected-after-recovery",
    raw: {
      status: "rendered-rejected",
      asset: returnedAssets[1238].raw,
      pass: [
        "five clearly adult people are present with the established male added without replacing a woman",
        "Sigatoka dunes, river mouth, Pacific shore, coastal mist, Fiji motifs, male wardrobe, PAWS, and Fiji-palette ECE hosiery are visible",
        "the male has two separate relationship contacts while his strongest gaze returns to ECE"
      ],
      fail: [
        "Alia's free hand and multiple center hands are hidden or ambiguously reassigned",
        "the strict ten-hand inventory is not continuously traceable",
        "Alia's index finger is inside or directly on the trigger guard"
      ]
    },
    recovery: {
      status: "rendered-rejected",
      asset: returnedAssets[1238].recovery,
      interfaceValidationNote: "An initial six-reference edit request was rejected locally before generation because the tool allows at most five paths. It did not consume a generation attempt. The same recovery then ran once with five paths.",
      pass: [
        "the target's five adult identities, male relationship integration, dunes, PAWS, hosiery, motifs, outfits, and full-length framing are preserved",
        "the male and Ellie hand link, male and Alia waist contact, Ellie and Radiance contact, and ECE handling of PAWS are visible"
      ],
      fail: [
        "Alia's free hand remains absent and multiple center hand owners remain ambiguous",
        "the strict ten-hand inventory still fails",
        "Alia's index finger remains visibly inside the trigger guard"
      ]
    },
    recoveryAllowanceExhausted: true
  },
  1239: {
    status: "terminal-rejected-after-recovery",
    raw: {
      status: "rendered-rejected",
      asset: returnedAssets[1239].raw,
      pass: [
        "four clearly adult women and the four established identities are present with Alia's braids",
        "Tavoro waterfall, plunge pool, rainforest, overcast weather, large Fiji motifs, PAWS, original-spectrum ECE hosiery, and complete footwear are visible",
        "the active love center and several affectionate contacts read clearly"
      ],
      fail: [
        "the arm reaching to the prop does not originate continuously from Alia's shoulder and reads as borrowed from the center group",
        "Alia simultaneously appears to have two other central arms, producing an extra or reassigned arm",
        "the trigger-index position is unsafe or unauditable"
      ]
    },
    recovery: {
      status: "moderation-blocked-no-output",
      requestId: "39b1a18e-586f-4193-bdb8-39831fac9678",
      category: "sexual",
      fileCreated: false
    },
    recoveryAllowanceExhausted: true
  }
};

const rejectedAssets = Object.values(returnedAssets).flatMap((attempts) => Object.values(attempts));
const ledgerResiduals = ledger.backlogDrainPolicy?.residualImageNumbers ?? [];

const checkpoint = {
  ...preflight,
  status: "terminal-blocked-after-single-recovery-pass",
  checkpointType: "narrow-country-batch-recovery-checkpoint",
  preflightPath: "tmp/world-195x4/batch-304/batch-304-fiji-preflight.json",
  preflightSha256: sha256(preflightBytes),
  contractSha256: sha256(fs.readFileSync(contractPath)),
  sceneResults,
  renderAttempts: {
    raw: {
      requested: 4,
      returnedImages: 3,
      moderationBlockedNoOutput: 1,
      concurrency: "four independent built-in calls issued serially because the host exposed no supported parallel fan-out primitive"
    },
    recovery: {
      requested: 4,
      returnedImages: 3,
      moderationBlockedNoOutput: 1,
      maximumPerBlockedScene: 1,
      allowanceExhaustedForScenes: [1236, 1237, 1238, 1239]
    },
    totalReturnedImages: 6,
    accepted: 0,
    rejected: 6,
    terminal: true
  },
  acceptedAssets: [],
  rejectedAssets,
  shorteningVariants: {
    status: "not-created",
    reason: "Every returned image failed anatomy, prop, or required-roll visibility before garment-length review."
  },
  xPost: {
    status: "deferred-insufficient-accepted-assets",
    publishAttempted: false,
    postButtonClicked: false,
    currentCountryAcceptedAssetCount: 0,
    minimumCurrentCountryAcceptedAssets: 2,
    reason: "Fiji has zero accepted current-country images, so no eligible two-main-plus-one-secondary attachment group exists.",
    captionRolls: preflight.xPublishingRolls,
    eligibleCaptionShapeIfAssetsHadPassed: "Fiji white heart Djibouti #Fiji",
    hashtagsSuppressedByRoll: ["#InternalAgency", "#WorldXXXSeries"],
    ledger: {
      path: "assets/lore/starlight-era/world-x-publish-ledger.json",
      sha256: sha256(ledgerBytes),
      pendingPost: ledger.pendingPost,
      preparedPostQueueCount: Array.isArray(ledger.preparedPostQueue) ? ledger.preparedPostQueue.length : 0,
      deferredPostCheckpoint: ledger.deferredPostCheckpoint,
      residualImageNumbers: ledgerResiduals,
      backlogDrainStatus: ledger.backlogDrainPolicy?.status,
      preRenderBacklogStatus: ledger.preRenderBacklogStatus,
      latestAssistedDrainStatus: ledger.latestAssistedDrain?.status
    },
    action: "No browser submission was opened because the acceptance gate failed before publishing."
  },
  queueAdvance: {
    completedCountry: "Fiji",
    completedBatch: 304,
    terminalStatus: "terminal-blocked-after-single-recovery-pass",
    nextCountry: "Comoros",
    nextBatch: 305,
    nextScenes: [1240, 1241, 1242, 1243],
    nextThemePair: ["cinematic covert-agent crew couture", "undercover investigator couture"],
    reason: "A terminal zero-accepted batch advances after its one recovery pass under the binding queue rule."
  },
  repositoryScope: {
    checkpointPath: "assets/lore/starlight-era/batch-304-fiji-recovery-checkpoint.json",
    stagedFiles: ["assets/lore/starlight-era/batch-304-fiji-recovery-checkpoint.json"],
    acceptedAssetsCopied: [],
    acceptedAssetCopied: false,
    xLedgerUpdated: false,
    unrelatedDirtyFilesLeftUntouched: [
      "assets/lore/starlight-era/overnight-campaign.json",
      "assets/lore/starlight-era/world-195x4-campaign.json",
      "assets/lore/starlight-era/world-x-publish-ledger.json",
      "assets/videos/manifest.json"
    ]
  },
  terminalizedAt: new Date().toISOString()
};

fs.writeFileSync(outputPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(outputPath);
