import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const root = path.resolve("tmp/world-195x4/batch-298");
const preflightPath = path.join(root, "batch-298-spain-preflight.json");
const checkpointPath = path.resolve("assets/lore/starlight-era/batch-298-spain-recovery-checkpoint.json");
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
  "1212": {
    raw: {
      status: "output-safety-blocked",
      asset: null,
      requestId: "55edad09-52e0-4aaa-953f-a80ae77451ab",
      moderationCategory: "sexual",
      audit: "No image asset was returned."
    },
    recovery: {
      status: "rendered-rejected",
      asset: asset("exec-a3f5d403-a90a-4898-a3fe-8d1783460741.png"),
      audit: {
        pass: [
          "exactly four clearly adult women are present",
          "all four rolled exposed waists and ordinary belly buttons are visible",
          "ECE's rolled strapless shoulders and completely open back are visible",
          "Gaudi mosaic, salamander, Casa Batllo, and Casa Mila motifs are large and readable",
          "crisp blue hour, distinct silhouettes, complete footwear, and full-length framing are present"
        ],
        fail: [
          "the prop is held by its grip rather than supported forward of the trigger guard",
          "the prop-holder's index finger is inside the trigger guard",
          "the prop arm is hidden behind the torso and is not continuously traceable from shoulder to hand",
          "the exact eight-hand and empty-guard gates are not satisfied"
        ]
      }
    },
    terminalStatus: "blocked-after-single-recovery-pass"
  },
  "1213": {
    raw: {
      status: "rendered-rejected",
      asset: asset("exec-39c26646-0f77-4872-a5a4-6d993d919220.png"),
      audit: {
        pass: [
          "exactly five clearly adult people are present without replacing a woman",
          "the established male wears a fitted short-sleeve polo and black jeans",
          "the prop rests on an open palm with a visibly empty trigger guard",
          "Madrid Plaza Mayor, Gran Via, Puerta de Alcala, and radial-road motifs are large and readable",
          "rolling thunderstorm, complete footwear, and rolled waist coverage are visible"
        ],
        fail: [
          "the male's strongest sustained eye line is toward Alia instead of ECE",
          "Ellie's rolled completely open back is not visible",
          "Radiance does not visibly reach the male as required",
          "several listed contact hands are hidden or reassigned and not continuously traceable"
        ]
      }
    },
    recovery: {
      status: "rendered-rejected",
      asset: asset("exec-8d8753f5-6035-4536-a15f-dbb99cf2b19e.png"),
      audit: {
        pass: [
          "exactly five clearly adult people are present without replacing a woman",
          "Ellie's rolled completely open back is unmistakably visible",
          "the established male, distinct outfits, Madrid motifs, thunderstorm, and complete footwear are present"
        ],
        fail: [
          "the male again directs his strongest eye line to Alia instead of ECE",
          "ECE grips the prop and places her index finger inside the trigger guard",
          "the grip-untouched open-palm manipulation is not materialized",
          "Radiance does not visibly touch the male",
          "the exact ten-hand inventory is not continuously traceable"
        ]
      }
    },
    terminalStatus: "blocked-after-single-recovery-pass"
  },
  "1214": {
    raw: {
      status: "rendered-rejected",
      asset: asset("exec-fe604bff-5c57-40d9-b550-d3a29f9a7503.png"),
      audit: {
        pass: [
          "exactly four clearly adult women are present",
          "Radiance and ECE visibly perform distinct versions of their matching sobbing roll",
          "Seville architecture, azulejos, fan, guitar, orange, tapas, and beer culture motifs are large and readable",
          "snow flurries, rolled waist coverage, distinct outfits, and complete footwear are visible"
        ],
        fail: [
          "ECE carries the prop low with a downward muzzle",
          "ECE grips the prop instead of using the forward open-palm display",
          "Ellie's rolled completely open back is not visible",
          "the exact hand-owner inventory is not satisfied"
        ]
      }
    },
    recovery: {
      status: "rendered-rejected",
      asset: asset("exec-34dda395-351b-4923-b130-cee2b70e8150.png"),
      audit: {
        pass: [
          "exactly four clearly adult women are present",
          "Ellie's rolled strapless shoulders, exposed waist, and completely open back are unmistakably visible",
          "both sobbing performances, chest-height prop placement, snow, Seville motifs, culture display, and complete footwear are present"
        ],
        fail: [
          "ECE grips the prop and places her index finger inside the trigger guard",
          "the grip-untouched forward open-palm display is not materialized",
          "several listed contact hands are reassigned or occluded and not continuously traceable"
        ]
      }
    },
    terminalStatus: "blocked-after-single-recovery-pass"
  },
  "1215": {
    raw: {
      status: "output-safety-blocked",
      asset: null,
      requestId: "41aa676b-d86d-4877-9b75-5d6f4d6018c7",
      moderationCategory: "sexual",
      audit: "No image asset was returned."
    },
    recovery: {
      status: "output-safety-blocked",
      asset: null,
      requestId: "84fe9c15-6fe0-4f58-ad28-07b724450ec5",
      moderationCategory: "sexual",
      audit: "No image asset was returned; the single recovery allowance is exhausted."
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
      rendered: 2,
      outputSafetyBlocked: 2,
      accepted: 0,
      rejected: 2,
      concurrency: "four independent built-in image generation calls"
    },
    recovery: {
      status: "complete",
      requested: 4,
      rendered: 3,
      outputSafetyBlocked: 1,
      accepted: 0,
      rejected: 3,
      maximumPerBlockedScene: 1,
      allowanceExhaustedForScenes: [1212, 1213, 1214, 1215]
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
    eligibleCaptionShapeIfAssetsExisted: "Spain red-heart secondary-country #Spain #InternalAgency",
    hashtagsSuppressedByRoll: ["#WorldXXXSeries"]
  },
  queueAdvance: {
    previousCountry: "Spain",
    previousBatch: 298,
    previousTerminalStatus: "terminal-blocked-after-single-recovery-pass",
    nextCountry: "Sweden",
    nextBatch: 299,
    nextScenes: [1216, 1217, 1218, 1219],
    nextThemePair: ["undercover investigator couture", "nurse-care couture"],
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
