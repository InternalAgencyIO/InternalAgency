import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const root = path.resolve("tmp/world-195x4/batch-300");
const preflightPath = path.join(root, "batch-300-switzerland-preflight.json");
const checkpointPath = path.resolve("assets/lore/starlight-era/batch-300-switzerland-recovery-checkpoint.json");
const generatedRoot = "C:\\Users\\A\\.codex\\generated_images\\019fd625-0bf6-78d2-9fb8-3f3e22c1d086";
const preflight = JSON.parse(fs.readFileSync(preflightPath, "utf8"));

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").toUpperCase();
}

function asset(fileName, workspaceCopy) {
  const absolutePath = path.join(generatedRoot, fileName);
  const copyPath = path.join(root, workspaceCopy);
  const stat = fs.statSync(absolutePath);
  if (!fs.existsSync(copyPath)) throw new Error(`Missing preserved workspace copy: ${copyPath}`);
  if (sha256File(copyPath) !== sha256File(absolutePath)) throw new Error(`Workspace copy hash mismatch: ${workspaceCopy}`);
  return {
    fileName,
    absolutePath,
    workspaceCopy: path.relative(repo, copyPath).replaceAll("\\", "/"),
    bytes: stat.size,
    sha256: sha256File(absolutePath),
    preservedOriginal: true,
    copiedToAcceptedAssets: false
  };
}

const attempts = {
  "1220": {
    raw: {
      status: "rendered-rejected",
      asset: asset("exec-1c7e71f8-eddb-4ec1-91c2-aff0c7963b69.png", "1220-switzerland-zurich-raw.png"),
      audit: {
        pass: [
          "exactly four clearly adult women are present",
          "Zurich Hauptbahnhof, Limmat, Old Town, double rainbow, large city, rail, watch, edelweiss, and Alpine motifs are readable",
          "four distinct silhouettes, the three rolled exposed waists, and complete footwear are visible",
          "the prop muzzle points outward toward empty background"
        ],
        fail: [
          "the exact eight-hand inventory is not continuously traceable and multiple listed contacts are hidden or reassigned",
          "the prop hand and trigger-guard relationship is not unambiguously readable under the strict safety gate",
          "Ellie's and Alia's rolled completely open backs are not visibly materialized"
        ]
      }
    },
    recovery: {
      status: "rendered-rejected",
      asset: asset("exec-2ab41de0-6b59-4a23-90b0-2ac9a47ca6d7.png", "1220-switzerland-zurich-recovery.png"),
      audit: {
        pass: [
          "exactly four clearly adult women, Zurich, double rainbow, large country motifs, full-length framing, and complete footwear are preserved",
          "the visible tram is removed and the muzzle remains directed into empty background"
        ],
        fail: [
          "an ambiguous extra or borrowed forearm appears near ECE's prop hand and the exact eight-hand inventory is not continuously traceable",
          "Alia's rolled exposed waist and assigned green cropped silhouette drift to a covered orange dress",
          "Ellie's and Alia's rolled completely open backs remain invisible",
          "the trigger finger remains too close to the guard to pass the strict safety gate"
        ]
      }
    },
    terminalStatus: "blocked-after-single-recovery-pass"
  },
  "1221": {
    raw: {
      status: "rendered-rejected",
      asset: asset("exec-b679ca07-d6e0-474b-850f-ab8e3e0a85e1.png", "1221-switzerland-chillon-raw.png"),
      audit: {
        pass: [
          "exactly four clearly adult women are present",
          "Chillon Castle, Lake Geneva, light rain, reflections, large castle, lake, edelweiss, watch, and vineyard motifs are readable",
          "four distinct silhouettes, complete footwear, and the three rolled exposed waists are visible",
          "the muzzle points outward across empty water"
        ],
        fail: [
          "a literal Swiss flag and cross appear on the castle tower",
          "the exact eight-hand inventory is not continuously traceable and several hands are hidden behind adjacent bodies",
          "the empty magazine well is not visibly demonstrated",
          "the trigger finger and empty guard are not unambiguously separated"
        ]
      }
    },
    recovery: {
      status: "rendered-rejected",
      asset: asset("exec-65e6d17b-b0ec-49fb-9a23-c0d346e01388.png", "1221-switzerland-chillon-recovery.png"),
      audit: {
        pass: [
          "exactly four clearly adult women, Chillon Castle, Lake Geneva, light rain, motifs, outfits, and complete footwear are preserved",
          "the literal Swiss flag and cross are removed",
          "the muzzle remains directed outward across empty water"
        ],
        fail: [
          "the exact eight-hand inventory remains untraceable with hidden-owner waist and shoulder contacts",
          "the listed playful route-blocking hand and multiple assigned contacts are absent or reassigned",
          "the empty magazine well is still not visibly demonstrated",
          "the trigger finger and guard separation remains too ambiguous for acceptance"
        ]
      }
    },
    terminalStatus: "blocked-after-single-recovery-pass"
  },
  "1222": {
    raw: {
      status: "rendered-rejected",
      asset: asset("exec-801818d9-1f24-48d0-bf92-28dd28aaca77.png", "1222-switzerland-aletsch-raw.png"),
      audit: {
        pass: [
          "exactly four clearly adult women are present",
          "Great Aletsch Glacier, Alpine skyline, dense fog, large glacier, edelweiss, watch, forest, and rail motifs are readable",
          "four distinct silhouettes, both rolled strapless tops, both rolled exposed waists, and complete footwear are visible",
          "the muzzle points outward toward empty glacier background"
        ],
        fail: [
          "the raised linked-hand cluster is fused or ambiguous and the exact eight-hand inventory is not continuously traceable",
          "multiple waist, shoulder, and guidance contacts are hidden or reassigned",
          "Radiance's, Ellie's, and Alia's rolled completely open backs are not visibly materialized",
          "the trigger finger and empty guard are not unambiguously separated"
        ]
      }
    },
    recovery: {
      status: "rendered-rejected",
      asset: asset("exec-7951e39d-6f0e-446f-b709-f55b2eaab50a.png", "1222-switzerland-aletsch-recovery.png"),
      audit: {
        pass: [
          "exactly four clearly adult women, Aletsch Glacier, dense fog, large motifs, outfits, and complete footwear are preserved",
          "the muzzle remains directed toward empty glacier background"
        ],
        fail: [
          "Alia's hands cluster around Radiance's linked hand while other listed contacts disappear, so the exact eight-hand inventory remains untraceable",
          "ECE's free hand appears on the far side instead of at Radiance's waist and has an ambiguous owner path",
          "the three rolled completely open backs remain invisible",
          "the trigger finger and empty guard separation remains too ambiguous for acceptance"
        ]
      }
    },
    terminalStatus: "blocked-after-single-recovery-pass"
  },
  "1223": {
    raw: {
      status: "rendered-rejected",
      asset: asset("exec-5e37cb5b-474f-4018-9c1c-f4e53695388c.png", "1223-switzerland-landwasser-male-raw.png"),
      audit: {
        pass: [
          "exactly five clearly adult people are present without replacing a woman",
          "the established male wears a fitted short-sleeve graphite top, black jeans, and black boots and keeps his strongest eye line on ECE",
          "Landwasser Viaduct, golden hour, large rail, Alpine, chocolate, cheese, cowbell, edelweiss, and watch motifs plus the culture table are readable",
          "the four distinct women's silhouettes, rolled cuts, and complete footwear are visible",
          "the muzzle points outward toward empty background"
        ],
        fail: [
          "a train occupies the route that was required to remain empty",
          "the exact ten-hand inventory is not continuously traceable and several arms disappear behind adjacent bodies",
          "the male's required separate Ellie and Alia contacts are not clearly materialized",
          "the trigger finger and empty guard are not unambiguously separated"
        ]
      }
    },
    recovery: {
      status: "rendered-rejected",
      asset: asset("exec-66039043-2c9e-493b-b834-f5895c6dab59.png", "1223-switzerland-landwasser-male-recovery.png"),
      audit: {
        pass: [
          "exactly five clearly adult people, the established male, Landwasser, golden hour, culture table, large country motifs, rolled outfits, and complete footwear are preserved",
          "the train is removed and the route is empty",
          "the male's strongest sustained eye line remains on ECE",
          "the muzzle points outward toward empty tunnel-side background"
        ],
        fail: [
          "the exact ten-hand inventory remains untraceable with several hidden-owner or missing arms behind the close group",
          "the male's two required contacts with Ellie and Alia are not both clearly visible",
          "ECE's free-arm embrace and multiple linked-hand contacts are absent or reassigned",
          "the trigger finger remains inside or too close to the guard to pass the strict safety gate"
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
      orchestrationNote: "All four raw calls were started together and returned four correlated assets."
    },
    recovery: {
      status: "complete",
      requested: 4,
      rendered: 4,
      accepted: 0,
      rejected: 4,
      maximumPerBlockedScene: 1,
      allowanceExhaustedForScenes: [1220, 1221, 1222, 1223],
      orchestrationNote: "The first recovery pool produced Scenes 1220 through 1222, while Scene 1223 was rejected before invocation because six reference paths exceeded the five-path tool limit. Scene 1223 was immediately invoked once with the target plus four essential identity references."
    },
    scenes: attempts
  },
  acceptedAssets: [],
  rejectedAssets: Object.values(attempts).flatMap((scene) => [scene.raw.asset, scene.recovery.asset]),
  shorteningVariants: {
    status: "not-created",
    reason: "No render passed the strict anatomy, prop-safety, identity, roll, and relationship gates. Originals and recovery outputs remain preserved."
  },
  xPost: {
    status: "deferred-insufficient-accepted-assets",
    minimumCurrentCountryAcceptedAssets: 2,
    acceptedCurrentCountryAssets: 0,
    publishAttempted: false,
    captionRolls: preflight.xPublishingRolls,
    eligibleCaptionShapeIfAssetsExisted: "Switzerland white-heart Ukraine #Switzerland #InternalAgency #WorldXXXSeries",
    hashtagsSuppressedByRoll: []
  },
  queueAdvance: {
    previousCountry: "Switzerland",
    previousBatch: 300,
    previousTerminalStatus: "terminal-blocked-after-single-recovery-pass",
    nextCountry: "Ukraine",
    nextBatch: 301,
    nextScenes: [1224, 1225, 1226, 1227],
    nextThemePair: ["doctor-clinical-command couture", "adult nightlife dance-performance couture"],
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
