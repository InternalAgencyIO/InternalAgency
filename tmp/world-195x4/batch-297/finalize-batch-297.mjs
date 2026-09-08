import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const root = path.resolve("tmp/world-195x4/batch-297");
const preflightPath = path.join(root, "batch-297-slovenia-preflight.json");
const checkpointPath = path.resolve("assets/lore/starlight-era/batch-297-slovenia-recovery-checkpoint.json");
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
  "1208": {
    raw: {
      status: "output-safety-blocked",
      asset: null,
      requestId: "9a0985db-007c-4488-a845-9d68748aaae0",
      moderationCategory: "sexual",
      audit: "No image asset was returned."
    },
    recovery: {
      status: "rendered-rejected",
      asset: asset("exec-4d45f959-45f8-4ff4-b1cf-5ea8fa86c042.png"),
      audit: {
        pass: [
          "exactly five clearly adult people are present",
          "Radiance wears the active country-palette rainbow knee socks",
          "all four women and the established male are recognizable",
          "Ljubljana architecture, dragon, castle, and bridge motifs are large and readable",
          "hail and hard backlight are visibly materialized",
          "full-length footwear and above-knee opaque outfits are present"
        ],
        fail: [
          "an ownerless arm and hand emerge at the far-right edge holding the prop, exceeding the exact ten-arm and ten-hand gate",
          "the prop is not held by Alia as required by the active hosiery transfer",
          "Radiance and ECE are not the unmistakable affectionate center",
          "the male's strongest sustained eye line is toward Alia rather than ECE",
          "the exact hand-owner inventory is not satisfied"
        ]
      }
    },
    terminalStatus: "blocked-after-single-recovery-pass"
  },
  "1209": {
    raw: {
      status: "rendered-rejected",
      asset: asset("exec-ed3b3660-62d2-447a-ae89-2453a1d30795.png"),
      audit: {
        pass: [
          "exactly four clearly adult women and exactly one tiny collarless golden kitten are present",
          "Lake Bled, Bled Castle, pletna boat, and Alpine motifs are legible",
          "all four rolled midriffs and the three rolled strapless cuts are visible",
          "PAWS is safely held and far from the prop lane",
          "light rain and full-length footwear are visible"
        ],
        fail: [
          "ECE's right index finger is inside the trigger guard",
          "several contact hands overlap and are not continuously traceable to one owner"
        ]
      }
    },
    recovery: {
      status: "rendered-rejected",
      asset: asset("exec-5ff825cc-dd57-4a59-81ed-eb8456d7998a.png"),
      audit: {
        pass: [
          "the pistol grip is untouched and the full trigger guard is visibly empty",
          "exactly four clearly adult women and one tiny collarless golden kitten are present",
          "PAWS is securely cradled and gently petted far from the prop lane",
          "all four rolled midriffs, three rolled strapless cuts, distinct silhouettes, Lake Bled motifs, rain, and complete footwear are visible"
        ],
        fail: [
          "Ellie's required Alia-waist contact hand is occluded behind Alia",
          "Alia's required ECE-shoulder contact hand is occluded behind ECE",
          "all eight hands are therefore not fully visible and continuously traceable to owners",
          "the strict hidden-owner and ambiguous-hand rejection gate is triggered"
        ]
      }
    },
    terminalStatus: "blocked-after-single-recovery-pass"
  },
  "1210": {
    raw: {
      status: "rendered-rejected",
      asset: asset("exec-dcf9e534-b0bc-4590-8b94-97dd35ebd541.png"),
      audit: {
        pass: [
          "exactly four clearly adult women are present",
          "Postojna karst, cave train, olm, and Predjama motifs are large and readable",
          "the rolled Radiance and ECE midriffs, distinct covert silhouettes, golden light, and complete footwear are visible"
        ],
        fail: [
          "ECE's right index finger is inside the trigger guard",
          "ECE's rolled fully open back is not visible",
          "multiple contact hands are occluded and not continuously traceable"
        ]
      }
    },
    recovery: {
      status: "rendered-rejected",
      asset: asset("exec-ce4d05de-ee34-4f99-9610-8f185d0dd3f7.png"),
      audit: {
        pass: [
          "the trigger guard is unobstructed and empty",
          "ECE's rolled completely open back is unmistakably visible",
          "exactly four clearly adult women, distinct outfits, Postojna motifs, golden-hour cave light, and complete footwear are present"
        ],
        fail: [
          "only one ECE prop-support hand is visible; her second required arm and hand are absent or fully occluded",
          "the exact eight-arm and eight-hand anatomy gate is not met",
          "the listed two-hand manipulation and full hand-owner inventory are not satisfied"
        ]
      }
    },
    terminalStatus: "blocked-after-single-recovery-pass"
  },
  "1211": {
    raw: {
      status: "rendered-rejected",
      asset: asset("exec-79057de8-6772-4cde-b856-f5a4ecf36527.png"),
      audit: {
        pass: [
          "exactly four clearly adult women are present",
          "Lipizzaner, Karst, painted beehive-panel, honey, and potica motifs are large and readable",
          "rolled midriffs and strapless cuts, strong wind, complete footwear, and four distinct silhouettes are visible"
        ],
        fail: [
          "ECE's right index finger is inside the trigger guard",
          "contact hands overlap and are not all continuously traceable"
        ]
      }
    },
    recovery: {
      status: "rendered-rejected",
      asset: asset("exec-424c43fd-5a19-4035-93cd-5666a9991813.png"),
      audit: {
        pass: [
          "exactly four clearly adult women are present",
          "all rolled cuts, four distinct silhouettes, complete footwear, Lipizzaner and food-craft motifs, and cinematic wind are visible"
        ],
        fail: [
          "ECE grips the prop and places her right index finger inside the trigger guard",
          "the required top-slide manipulation and empty-guard safety gate are not satisfied",
          "several affectionate contact hands remain overlapped or occluded"
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
      rendered: 3,
      outputSafetyBlocked: 1,
      accepted: 0,
      rejected: 3,
      concurrency: "four independent built-in image generation calls"
    },
    recovery: {
      status: "complete",
      requested: 4,
      rendered: 4,
      accepted: 0,
      rejected: 4,
      maximumPerBlockedScene: 1,
      allowanceExhaustedForScenes: [1208, 1209, 1210, 1211]
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
    eligibleCaptionShapeIfAssetsExisted: "Slovenia red-heart secondary-country #Slovenia",
    hashtagsSuppressedByRoll: ["#InternalAgency", "#WorldXXXSeries"]
  },
  queueAdvance: {
    previousCountry: "Slovenia",
    previousBatch: 297,
    previousTerminalStatus: "terminal-blocked-after-single-recovery-pass",
    nextCountry: "Spain",
    nextBatch: 298,
    nextScenes: [1212, 1213, 1214, 1215],
    nextThemePair: ["cinematic covert-agent crew couture", "undercover investigator couture"],
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
