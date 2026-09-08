import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const preflightPath = path.resolve("tmp/world-195x4/batch-305/batch-305-comoros-preflight.json");
const outputPath = path.resolve("assets/lore/starlight-era/batch-305-comoros-recovery-checkpoint.json");
const contractPath = path.resolve("assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const ledgerPath = path.resolve("assets/lore/starlight-era/world-x-publish-ledger.json");
const acceptedPath = path.resolve("assets/lore/starlight-era/1242-comoros-lac-sale-heavy-rain.png");
const preflightBytes = fs.readFileSync(preflightPath);
const preflight = JSON.parse(preflightBytes.toString("utf8"));
const ledgerBytes = fs.readFileSync(ledgerPath);
const ledger = JSON.parse(ledgerBytes.toString("utf8"));

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex").toUpperCase();
}

function asset(relativePath, generatedName, attempt, copiedToAcceptedAssets = false) {
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
    copiedToAcceptedAssets
  };
}

const returnedAssets = {
  1240: {
    raw: asset(
      "tmp/world-195x4/batch-305/1240-comoros-moroni-blue-hour-rainbow-raw.png",
      "exec-7776ed16-95c5-45ad-adc5-48988a30e243.png",
      "raw"
    ),
    recovery: asset(
      "tmp/world-195x4/batch-305/1240-comoros-moroni-blue-hour-rainbow-recovery.png",
      "exec-a934f976-68b0-4bc5-8845-c9bf4175741f.png",
      "recovery"
    )
  },
  1241: {
    raw: asset(
      "tmp/world-195x4/batch-305/1241-comoros-iconi-overcast-ece-rainbow-hosiery-raw.png",
      "exec-a876210b-c909-4194-84ed-66c576145883.png",
      "raw"
    ),
    recovery: asset(
      "tmp/world-195x4/batch-305/1241-comoros-iconi-overcast-ece-rainbow-hosiery-recovery.png",
      "exec-80e7c646-8bf8-4fe8-b859-669e6682edf8.png",
      "recovery"
    )
  },
  1242: {
    raw: asset(
      "tmp/world-195x4/batch-305/1242-comoros-lac-sale-heavy-rain-raw.png",
      "exec-bef833aa-a792-4870-bbed-2c3ce3704669.png",
      "raw",
      true
    )
  },
  1243: {
    raw: asset(
      "tmp/world-195x4/batch-305/1243-comoros-moheli-snow-male-radiance-rainbow-hosiery-raw.png",
      "exec-d67ef88b-198e-41fe-af6a-239e815936ae.png",
      "raw"
    ),
    recovery: asset(
      "tmp/world-195x4/batch-305/1243-comoros-moheli-snow-male-radiance-rainbow-hosiery-recovery.png",
      "exec-8c2bcf46-1d72-4b4f-aea2-8e9e37d92a2e.png",
      "recovery"
    )
  }
};

const acceptedBytes = fs.readFileSync(acceptedPath);
if (sha256(acceptedBytes) !== returnedAssets[1242].raw.sha256) {
  throw new Error("Accepted Scene 1242 copy does not match its preserved raw render");
}

const acceptedAsset = {
  scene: 1242,
  sourceAttempt: "raw",
  sourceWorkspacePath: returnedAssets[1242].raw.workspacePath,
  acceptedPath: "assets/lore/starlight-era/1242-comoros-lac-sale-heavy-rain.png",
  bytes: acceptedBytes.length,
  sha256: sha256(acceptedBytes),
  copiedFromPreservedOriginal: true,
  shorteningVariant: false
};

const sceneResults = {
  1240: {
    status: "terminal-rejected-after-recovery",
    raw: {
      status: "rendered-rejected",
      asset: returnedAssets[1240].raw,
      pass: [
        "four clearly adult women and the four established identities are present with Alia's braided look",
        "Moroni medina, harbor, volcanic ridge, crisp blue hour, full rainbow wardrobes, large Comoros motifs, and the secular botanical-maritime display are strong",
        "the prop points across empty harbor water and several affectionate contacts are visible"
      ],
      fail: [
        "multiple hands converge in the center clasp and cannot be continuously assigned to one owner",
        "Alia's free hand is hidden or reassigned while Radiance appears to contribute more than the prescribed one hand to the clasp",
        "the strict eight-hand owner trace fails"
      ]
    },
    recovery: {
      status: "rendered-rejected",
      asset: returnedAssets[1240].recovery,
      pass: [
        "the four identities, blue-hour harbor, rainbow wardrobes, large motifs, full framing, and isolated prop direction are preserved",
        "Ellie's raised beacon hand and one waist contact are newly separated"
      ],
      fail: [
        "the central clasp still contains ambiguously merged hand ownership",
        "Alia's second hand remains hidden or reassigned and the requested owner-by-owner inventory is not visible",
        "the strict eight-hand anatomy gate still fails"
      ]
    },
    recoveryAllowanceExhausted: true
  },
  1241: {
    status: "terminal-rejected-after-recovery",
    raw: {
      status: "rendered-rejected",
      asset: returnedAssets[1241].raw,
      pass: [
        "four clearly adult women and the established identities are present with Alia's braids",
        "Iconi palace ruins, Mount Karthala, overcast weather, large secular Comoros motifs, four distinct outfits, and ECE's original rainbow knee socks are visible",
        "Alia holds the prop over empty sea and Radiance with ECE reads as the closest affectionate center"
      ],
      fail: [
        "Ellie's free arm and Radiance's ECE-side hand disappear behind adjacent bodies",
        "at least two hand owners are hidden and the full eight-hand inventory is not continuously traceable",
        "the prop index position and empty magazine well are not sufficiently auditable"
      ]
    },
    recovery: {
      status: "rendered-rejected",
      asset: returnedAssets[1241].recovery,
      pass: [
        "the target's faces, Iconi setting, Karthala, motifs, garment cuts, ECE hosiery, body count, and full footwear are preserved",
        "the central linked hands and ECE's raised route-beacon hand remain clear"
      ],
      fail: [
        "Ellie's free hand and Radiance's free hand remain hidden behind the group",
        "the exact eight-hand owner trace still fails after the only permitted edit",
        "the trigger index remains too close to or inside the trigger-guard opening for acceptance"
      ]
    },
    recoveryAllowanceExhausted: true
  },
  1242: {
    status: "accepted-raw",
    raw: {
      status: "rendered-accepted",
      asset: returnedAssets[1242].raw,
      pass: [
        "exactly four clearly adult women and the established identities are present with Alia's braided look",
        "Lac Sale crater, Mitsamiouli coast, cinematic heavy rain, coelacanth and agriculture display, and large Comoros motifs are visible",
        "all four distinct rolled outfits visibly preserve the required midriff, strapless, covered-back, and above-knee states",
        "exactly eight arms and eight hands are continuously traceable to one owner each with no extra, fused, borrowed, or floating hand",
        "the prop is full size at shoulder height in a controlled two-hand stance, points only across empty crater water, and shows a straight indexed trigger finger outside the guard",
        "the linked-hand chain, shoulder contacts, distinct emotions, full faces, complete feet, and stable footing pass"
      ],
      fail: []
    },
    recovery: {
      status: "not-requested",
      reason: "The raw render passed the complete acceptance gate."
    },
    recoveryAllowanceExhausted: false,
    acceptedAsset
  },
  1243: {
    status: "terminal-rejected-after-recovery",
    raw: {
      status: "rendered-rejected",
      asset: returnedAssets[1243].raw,
      pass: [
        "five clearly adult people are present with the established male added without replacing a woman",
        "Moheli lagoon, turtle beach, coral, snow flurries, full rainbow wardrobes, large marine motifs, and Radiance's Comoros-palette rainbow hosiery are strong",
        "Alia's prop points across empty lagoon water and the male has multiple visible adult relationship contacts"
      ],
      fail: [
        "ECE's second hand and other center hand owners are hidden or ambiguously reassigned",
        "the strict ten-hand inventory is not continuously traceable",
        "the male's strongest eye line lands on a nearer woman rather than ECE"
      ]
    },
    recovery: {
      status: "rendered-rejected",
      asset: returnedAssets[1243].recovery,
      pass: [
        "the five identities, male wardrobe, Moheli setting, snow, rainbow styling, large marine motifs, Radiance hosiery, and full-length framing are preserved",
        "the male's waist contact with Alia and center hand contact remain visible"
      ],
      fail: [
        "ECE's second hand and multiple center hands remain hidden or ambiguously owned",
        "the strict ten-hand inventory still fails",
        "the male's eye line still stops on the nearer center woman instead of reaching ECE"
      ]
    },
    recoveryAllowanceExhausted: true
  }
};

const rejectedAssets = [
  returnedAssets[1240].raw,
  returnedAssets[1240].recovery,
  returnedAssets[1241].raw,
  returnedAssets[1241].recovery,
  returnedAssets[1243].raw,
  returnedAssets[1243].recovery
];
const ledgerResiduals = ledger.backlogDrainPolicy?.residualImageNumbers ?? [];

const checkpoint = {
  ...preflight,
  status: "terminal-partially-accepted-after-single-recovery-pass",
  checkpointType: "narrow-country-batch-recovery-checkpoint",
  preflightPath: "tmp/world-195x4/batch-305/batch-305-comoros-preflight.json",
  preflightSha256: sha256(preflightBytes),
  contractSha256: sha256(fs.readFileSync(contractPath)),
  sceneResults,
  renderAttempts: {
    raw: {
      requested: 4,
      returnedImages: 4,
      moderationBlockedNoOutput: 0,
      concurrency: "four independent built-in calls issued serially because the host exposed no supported parallel fan-out primitive"
    },
    recovery: {
      requested: 3,
      returnedImages: 3,
      moderationBlockedNoOutput: 0,
      maximumPerBlockedScene: 1,
      allowanceExhaustedForScenes: [1240, 1241, 1243]
    },
    totalReturnedImages: 7,
    accepted: 1,
    rejected: 6,
    terminal: true
  },
  acceptedAssets: [acceptedAsset],
  rejectedAssets,
  shorteningVariants: {
    status: "not-created",
    reason: "The accepted Scene 1242 garments already read securely above the knee. Rejected scenes failed anatomy or eye-line gates before garment-length review."
  },
  xPost: {
    status: "deferred-insufficient-accepted-assets",
    publishAttempted: false,
    postButtonClicked: false,
    currentCountryAcceptedAssetCount: 1,
    minimumCurrentCountryAcceptedAssets: 2,
    reason: "Comoros has one accepted current-country image, so no eligible two-main-plus-one-secondary attachment group exists.",
    captionRolls: preflight.xPublishingRolls,
    eligibleCaptionShapeIfAssetsHadPassed: "Comoros red heart Fiji #Comoros",
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
    action: "No browser submission was opened because the two-current-country-image publishing threshold was not met."
  },
  queueAdvance: {
    completedCountry: "Comoros",
    completedBatch: 305,
    terminalStatus: "terminal-partially-accepted-after-single-recovery-pass",
    nextCountry: "Guyana",
    nextBatch: 306,
    nextScenes: [1244, 1245, 1246, 1247],
    nextThemePair: ["undercover investigator couture", "nurse-care couture"],
    reason: "A terminal partially accepted batch advances after its single permitted recovery pass under the binding queue rule."
  },
  repositoryScope: {
    checkpointPath: "assets/lore/starlight-era/batch-305-comoros-recovery-checkpoint.json",
    stagedFiles: [
      "assets/lore/starlight-era/1242-comoros-lac-sale-heavy-rain.png",
      "assets/lore/starlight-era/batch-305-comoros-recovery-checkpoint.json"
    ],
    acceptedAssetsCopied: ["assets/lore/starlight-era/1242-comoros-lac-sale-heavy-rain.png"],
    acceptedAssetCopied: true,
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
console.log(JSON.stringify({
  outputPath,
  status: checkpoint.status,
  acceptedAssets: checkpoint.acceptedAssets,
  rejectedCount: checkpoint.rejectedAssets.length,
  xPost: checkpoint.xPost.status,
  next: checkpoint.queueAdvance
}, null, 2));
