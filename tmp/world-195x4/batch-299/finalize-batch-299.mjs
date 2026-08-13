import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const root = path.resolve("tmp/world-195x4/batch-299");
const preflightPath = path.join(root, "batch-299-sweden-preflight.json");
const checkpointPath = path.resolve("assets/lore/starlight-era/batch-299-sweden-recovery-checkpoint.json");
const generatedRoot = "C:\\Users\\A\\.codex\\generated_images\\019fd625-0bf6-78d2-9fb8-3f3e22c1d086";
const preflight = JSON.parse(fs.readFileSync(preflightPath, "utf8"));

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").toUpperCase();
}

function asset(fileName) {
  const absolutePath = path.join(generatedRoot, fileName);
  const stat = fs.statSync(absolutePath);
  return {
    fileName,
    absolutePath,
    bytes: stat.size,
    sha256: sha256File(absolutePath),
    preservedOriginal: true,
    copiedToAcceptedAssets: false
  };
}

const attempts = {
  "1216": {
    raw: {
      status: "rendered-rejected",
      asset: asset("exec-1bdcfd0e-db0f-4c62-93a1-087b5bb26bc9.png"),
      audit: {
        pass: [
          "exactly four clearly adult women are present",
          "Stockholm, Vasa, Gamla Stan, archipelago, Dala-horse, and fika motifs are large and readable",
          "rolling thunderstorm, complete footwear, and all four distinct silhouettes are visible",
          "Radiance, Alia, and ECE show their rolled exposed waists"
        ],
        fail: [
          "ECE places a trigger finger inside the trigger guard",
          "the muzzle is angled partly toward camera rather than clearly across empty water",
          "Alia's and ECE's rolled complete open backs are not visible",
          "several contact hands are hidden, reassigned, or not continuously traceable"
        ]
      }
    },
    recovery: {
      status: "rendered-rejected",
      asset: asset("exec-580f69d4-5799-4a8a-9700-ee556ef9b342.png"),
      audit: {
        pass: [
          "exactly four clearly adult women are present",
          "Radiance, Alia, and ECE visibly materialize their rolled exposed waists and complete open backs",
          "Alia's rolled bare strapless shoulders are visible",
          "the muzzle points outward across empty water",
          "Stockholm motifs, fika, weather, complete footwear, and distinct silhouettes are preserved"
        ],
        fail: [
          "ECE again places a trigger finger inside the trigger guard",
          "the exact eight-hand inventory is not continuously traceable",
          "multiple listed contact hands are hidden or reassigned"
        ]
      }
    },
    terminalStatus: "blocked-after-single-recovery-pass"
  },
  "1217": {
    raw: {
      status: "rendered-rejected",
      asset: asset("exec-a6922b0e-b232-46d2-9a81-e1bd9dd4ec55.png"),
      audit: {
        pass: [
          "exactly four clearly adult women are present",
          "heavy snow, Gothenburg harbor, ferry, red-cottage, Dala-horse, and fika motifs are readable",
          "the muzzle points outward over empty harbor water",
          "complete footwear and four distinct silhouettes are visible"
        ],
        fail: [
          "ECE's trigger finger is inside the trigger guard",
          "ECE's rolled complete open back is not visible",
          "the empty-magazine-well manipulation and exact hand inventory are not materialized",
          "several hands are hidden or assigned to different contacts"
        ]
      }
    },
    recovery: {
      status: "rendered-rejected",
      asset: asset("exec-27e8564a-c91f-4a26-a35b-0c5b4c8ae6b5.png"),
      audit: {
        pass: [
          "exactly four clearly adult women are present",
          "Gothenburg harbor, ferries, Dala horse, fika, heavy snow, and complete footwear are preserved",
          "ECE's rolled exposed waist is visible",
          "the muzzle remains outward toward empty water"
        ],
        fail: [
          "ECE again places a trigger finger inside the trigger guard",
          "ECE's rolled complete open back is not visible",
          "the exact eight-hand inventory and linked-hand choreography are not continuously traceable"
        ]
      }
    },
    terminalStatus: "blocked-after-single-recovery-pass"
  },
  "1218": {
    raw: {
      status: "rendered-rejected",
      asset: asset("exec-9074f4ac-9dfb-484a-90a5-8ad18e60728c.png"),
      audit: {
        pass: [
          "exactly four clearly adult women are present",
          "Icehotel, northern-light, red-cottage, snow-pine, Dala-horse, and ice motifs are large and readable",
          "Ellie's rolled exposed waist and complete open back are visible",
          "ECE's rolled bare strapless shoulders, dense fog, complete footwear, and public-safe nurse-care silhouettes are visible"
        ],
        fail: [
          "ECE's trigger finger is inside the trigger guard",
          "ECE's rolled complete open back is not visible",
          "Alia's guiding hand overlaps the prop-holder's hands rather than staying on the upper arm",
          "the exact eight-hand inventory is not continuously traceable"
        ]
      }
    },
    recovery: {
      status: "output-safety-blocked",
      asset: null,
      requestId: "866d08da-d771-4e1b-bff5-ab4cee9e25b3",
      moderationCategory: "sexual",
      audit: "No image asset was returned; the single recovery allowance is exhausted."
    },
    terminalStatus: "blocked-after-single-recovery-pass"
  },
  "1219": {
    raw: {
      status: "rendered-rejected",
      asset: asset("exec-0f56fea2-c395-4537-aa95-2fa21c438b1f.png"),
      audit: {
        pass: [
          "exactly five clearly adult people are present without replacing a woman",
          "the male wears his fitted short-sleeve black polo, black jeans, and black boots",
          "all four women's outfits are rainbow themed",
          "ECE alone wears the rolled Sweden-palette rainbow knee socks",
          "the fixed pole, Turning Torso, Oresund Bridge, Malmo Castle, Dala-horse, fika, clear golden hour, and complete footwear are present",
          "the male's strongest visible eye line is toward ECE"
        ],
        fail: [
          "Alia's muzzle crosses the group toward people at torso height",
          "Alia places a trigger finger inside the trigger guard",
          "Radiance and ECE are not the extra-affectionate center",
          "the male does not materialize the required Ellie and Alia contact pattern",
          "the exact ten-hand inventory is not continuously traceable"
        ]
      }
    },
    recovery: {
      status: "rendered-rejected",
      asset: asset("exec-a323f159-2fff-4dc1-8beb-0ee824df18a4.png"),
      audit: {
        pass: [
          "exactly five clearly adult people are present without replacing a woman",
          "the male outfit, rainbow-only wardrobe, ECE's Sweden-palette rainbow knee socks, fixed pole, country motifs, fika, golden hour, and complete footwear are preserved",
          "Ellie's rolled complete open back is visible",
          "Alia alone handles the prop and the muzzle points outward across empty water",
          "the male touches Ellie and Alia"
        ],
        fail: [
          "Alia again places a trigger finger inside the trigger guard",
          "the male's strongest sustained eye line is toward Ellie instead of ECE",
          "ECE's separate route-map gesture is absent",
          "Radiance and ECE are not cheek-close as required",
          "the exact ten-hand inventory remains ambiguous"
        ]
      }
    },
    terminalStatus: "blocked-after-single-recovery-pass"
  }
};

const checkpoint = {
  ...preflight,
  status: "terminal-blocked-after-single-recovery-pass",
  terminalizedAt: new Date().toISOString(),
  checkpointType: "narrow-country-batch-recovery-checkpoint",
  renderAttempts: {
    raw: {
      status: "complete",
      requested: 4,
      rendered: 4,
      accepted: 0,
      rejected: 4,
      concurrency: "four independent built-in image generation calls",
      orchestrationNote: "The first concurrent pool returned Scene 1216 plus one uncorrelated output block before Promise.all aborted. Scenes 1217 through 1219 were immediately rerun with per-scene error capture to complete and correlate the four raw scene attempts.",
      uncorrelatedOutputSafetyBlock: {
        requestId: "06edfeb1-d97b-4ae6-8c05-f3241df13a73",
        moderationCategory: "sexual",
        asset: null,
        countedAsSceneAttempt: false
      }
    },
    recovery: {
      status: "complete",
      requested: 4,
      rendered: 3,
      outputSafetyBlocked: 1,
      accepted: 0,
      rejected: 3,
      maximumPerBlockedScene: 1,
      allowanceExhaustedForScenes: [1216, 1217, 1218, 1219]
    },
    scenes: attempts
  },
  acceptedAssets: [],
  rejectedAssets: Object.values(attempts).flatMap((scene) => [scene.raw.asset, scene.recovery.asset]).filter(Boolean),
  shorteningVariants: {
    status: "not-created",
    reason: "No render passed the strict anatomy, prop-safety, identity, roll, and relationship gates. Originals remain preserved."
  },
  xPost: {
    status: "deferred-insufficient-accepted-assets",
    minimumCurrentCountryAcceptedAssets: 2,
    acceptedCurrentCountryAssets: 0,
    publishAttempted: false,
    captionRolls: preflight.xPublishingRolls,
    eligibleCaptionShapeIfAssetsExisted: "Sweden red-heart secondary-country #Sweden #InternalAgency",
    hashtagsSuppressedByRoll: ["#WorldXXXSeries"]
  },
  queueAdvance: {
    previousCountry: "Sweden",
    previousBatch: 299,
    previousTerminalStatus: "terminal-blocked-after-single-recovery-pass",
    nextCountry: "Switzerland",
    nextBatch: 300,
    nextScenes: [1220, 1221, 1222, 1223],
    nextThemePair: ["nurse-care couture", "doctor-clinical-command couture"],
    reason: "The binding terminal-batch rule advances after the single recovery pass even when zero assets are accepted."
  },
  repositoryScope: {
    checkpointPath: path.relative(repo, checkpointPath).replaceAll("\\", "/"),
    stagedFiles: [path.relative(repo, checkpointPath).replaceAll("\\", "/")],
    unrelatedDirtyFilesLeftUntouched: [
      "assets/lore/starlight-era/overnight-campaign.json",
      "assets/lore/starlight-era/world-195x4-campaign.json",
      "assets/lore/starlight-era/world-x-publish-ledger.json",
      "assets/videos/manifest.json"
    ]
  }
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  checkpointPath,
  status: checkpoint.status,
  acceptedAssets: checkpoint.acceptedAssets.length,
  rejectedAssets: checkpoint.rejectedAssets.length,
  xPost: checkpoint.xPost.status,
  nextCountry: checkpoint.queueAdvance.nextCountry
}, null, 2));
