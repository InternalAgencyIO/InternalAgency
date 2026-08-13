import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const temp = path.join(root, "tmp", "world-195x4", "batch-301");
const generated = "C:\\Users\\A\\.codex\\generated_images\\019fd625-0bf6-78d2-9fb8-3f3e22c1d086";
const checkpointPath = path.join(
  root,
  "assets",
  "lore",
  "starlight-era",
  "batch-301-ukraine-recovery-checkpoint.json",
);

const checkpoint = JSON.parse(
  fs.readFileSync(path.join(temp, "batch-301-ukraine-preflight.json"), "utf8"),
);

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").toUpperCase();
}

function promptRecord(scene, kind) {
  const fileName = `scene-${scene}-${kind === "raw" ? "prompt" : "recovery-prompt"}.txt`;
  const absolutePath = path.join(temp, fileName);
  return {
    workspacePath: path.posix.join("tmp", "world-195x4", "batch-301", fileName),
    bytes: fs.statSync(absolutePath).size,
    sha256: sha256(absolutePath),
  };
}

function assetRecord(fileName, workspaceName) {
  const workspacePath = path.join(temp, workspaceName);
  return {
    fileName,
    absolutePath: path.join(generated, fileName),
    workspaceCopy: path.posix.join("tmp", "world-195x4", "batch-301", workspaceName),
    bytes: fs.statSync(workspacePath).size,
    sha256: sha256(workspacePath),
    preservedOriginal: true,
    copiedToAcceptedAssets: false,
  };
}

const assets = {
  raw1224: assetRecord("exec-d3548622-a3e9-434b-b28f-d8ad74cab548.png", "1224-ukraine-kyiv-raw.png"),
  recovery1224: assetRecord("exec-673ac9c9-c99a-451e-95ae-270e1b4b79c8.png", "1224-ukraine-kyiv-recovery.png"),
  raw1225: assetRecord("exec-2fac8925-ae19-42f5-961b-f0a15ad7c63d.png", "1225-ukraine-lviv-raw.png"),
  raw1226: assetRecord("exec-3f4a2802-e250-4964-8044-74135c565360.png", "1226-ukraine-synevyr-male-raw.png"),
  recovery1226: assetRecord("exec-db3ec43e-a536-4f66-a078-dbef2c3f360b.png", "1226-ukraine-synevyr-male-recovery.png"),
};

checkpoint.status = "terminal-blocked-after-single-recovery-pass";
checkpoint.renderAttempts = {
  raw: {
    status: "complete",
    requested: 4,
    rendered: 3,
    outputSafetyBlocked: 1,
    accepted: 0,
    rejected: 4,
    concurrency: "four independent built-in image generation calls",
    orchestrationNote: "All four raw calls were started together. Scenes 1224 through 1226 returned correlated assets; Scene 1227 was rejected by the output safety system before an asset was produced.",
  },
  recovery: {
    status: "complete",
    requested: 4,
    rendered: 2,
    outputSafetyBlocked: 2,
    accepted: 0,
    rejected: 4,
    maximumPerBlockedScene: 1,
    allowanceExhaustedForScenes: [1224, 1225, 1226, 1227],
    orchestrationNote: "All four single recovery calls were started together. Scenes 1224 and 1226 returned assets; Scenes 1225 and 1227 were rejected by the output safety system before assets were produced. No further recovery was attempted.",
  },
  scenes: {
    1224: {
      rawPrompt: promptRecord(1224, "raw"),
      recoveryPrompt: promptRecord(1224, "recovery"),
      raw: {
        status: "rendered-rejected",
        asset: assets.raw1224,
        audit: {
          pass: [
            "exactly four clearly adult women, Kyiv bridge, Dnipro, rolling thunderstorm, large country motifs, complete footwear, and four distinct silhouettes are present",
            "Radiance visibly wears the activated opaque Ukraine-palette rainbow-gradient knee socks",
            "Alia alone holds the inert prop and the muzzle points outward across empty water",
          ],
          fail: [
            "the exact eight-hand inventory is not continuously traceable and multiple shoulder, waist, and linked-hand contacts are hidden or reassigned",
            "Alia's trigger finger and the empty guard are not unambiguously separated",
            "Alia's rolled full sobbing performance is not visibly materialized",
            "Ellie's and Alia's rolled completely open backs are not both clearly visible",
          ],
        },
      },
      recovery: {
        status: "rendered-rejected",
        asset: assets.recovery1224,
        audit: {
          pass: [
            "exactly four clearly adult women, Kyiv, Dnipro, rolling thunderstorm, large country motifs, four distinct silhouettes, complete footwear, and the activated Ukraine-gradient knee socks are preserved",
            "Alia remains the sole prop handler and the muzzle stays directed across empty water",
          ],
          fail: [
            "the lower linked-hand cluster is fused and owner-ambiguous while another upper arm disappears behind the center pair, so the exact eight-arm and eight-hand inventory is not continuously traceable",
            "Alia's index finger remains inside or too close to the guard to pass the strict prop-safety gate",
            "Ellie's rolled completely open back is not visibly materialized",
          ],
        },
      },
      terminalStatus: "blocked-after-single-recovery-pass",
    },
    1225: {
      rawPrompt: promptRecord(1225, "raw"),
      recoveryPrompt: promptRecord(1225, "recovery"),
      raw: {
        status: "rendered-rejected",
        asset: assets.raw1225,
        audit: {
          pass: [
            "exactly four clearly adult women, Lviv Rynok Square, blue hour, tram and cafe context, large country motifs, distinct silhouettes, and complete footwear are present",
            "Radiance and Alia visibly materialize their rolled exposed waists and Alia's strapless cut",
            "ECE alone holds the inert prop and the muzzle points outward across an empty route",
          ],
          fail: [
            "the exact eight-hand inventory is not continuously traceable and several listed links are reassigned or hidden",
            "ECE's trigger finger and the empty guard are not unambiguously separated",
            "the required unloaded magazine-free manipulation is not visibly demonstrated",
            "Radiance's rolled completely open back is not visible",
          ],
        },
      },
      recovery: {
        status: "output-safety-blocked",
        requestId: "416d792c-93f6-4395-8eec-40277b875df0",
        moderationStage: "output",
        category: "sexual",
        assetProduced: false,
        audit: {
          pass: [],
          fail: ["no recovery asset was produced, so the scene cannot pass the visual acceptance gate"],
        },
      },
      terminalStatus: "blocked-after-single-recovery-pass",
    },
    1226: {
      rawPrompt: promptRecord(1226, "raw"),
      recoveryPrompt: promptRecord(1226, "recovery"),
      raw: {
        status: "rendered-rejected",
        asset: assets.raw1226,
        audit: {
          pass: [
            "exactly five clearly adult people are present without replacing a woman",
            "the established male wears a fitted short-sleeve black top, black jeans, and black boots and keeps his strongest eye line toward ECE",
            "Lake Synevyr, central island, Carpathian forest, heavy rain, tram silhouette, large country motifs, distinct silhouettes, and complete footwear are present",
            "ECE alone holds the inert prop and the muzzle points outward across empty water",
          ],
          fail: [
            "the exact ten-hand inventory is not continuously traceable and several hands or owner paths disappear behind the close group",
            "the male's required separate Ellie and Alia contacts are not both clearly visible",
            "ECE's trigger finger and the empty guard are not unambiguously separated",
            "Alia's rolled completely open back is not visible",
          ],
        },
      },
      recovery: {
        status: "rendered-rejected",
        asset: assets.recovery1226,
        audit: {
          pass: [
            "Lake Synevyr, central island, Carpathian forest, heavy rain, country motifs, the established male, and complete footwear are preserved",
            "the male's strongest eye line remains on ECE and the muzzle remains directed toward empty water",
          ],
          fail: [
            "only four adults are present because Ellie is missing, violating the required five-person cast and ten-arm and ten-hand anatomy gate",
            "the activated male scene therefore cannot preserve all four women or the required adult relationship beat",
            "the prop finger and empty guard remain insufficiently separated for strict acceptance",
          ],
        },
      },
      terminalStatus: "blocked-after-single-recovery-pass",
    },
    1227: {
      rawPrompt: promptRecord(1227, "raw"),
      recoveryPrompt: promptRecord(1227, "recovery"),
      raw: {
        status: "output-safety-blocked",
        requestId: "a9afec2f-ee85-4983-bd1e-47868ef89900",
        moderationStage: "output",
        category: "sexual",
        assetProduced: false,
        audit: {
          pass: [],
          fail: ["no raw asset was produced, so the scene cannot pass the visual acceptance gate"],
        },
      },
      recovery: {
        status: "output-safety-blocked",
        requestId: "66d9d8eb-be84-433b-be39-492480b182c5",
        moderationStage: "output",
        category: "sexual",
        assetProduced: false,
        audit: {
          pass: [],
          fail: ["no recovery asset was produced, so the scene cannot pass the visual acceptance gate"],
        },
      },
      terminalStatus: "blocked-after-single-recovery-pass",
    },
  },
};

checkpoint.acceptedAssets = [];
checkpoint.rejectedAssets = Object.values(assets);
checkpoint.xPost = {
  status: "deferred-insufficient-accepted-assets",
  minimumCurrentCountryAcceptedAssets: 2,
  acceptedCurrentCountryAssets: 0,
  publishAttempted: false,
  captionRolls: checkpoint.xPublishingRolls,
  eligibleCaptionShapeIfAssetsExisted: "Ukraine red-heart United Kingdom #Ukraine",
  hashtagsSuppressedByRoll: ["#InternalAgency", "#WorldXXXSeries"],
};
checkpoint.terminalizedAt = new Date().toISOString();
checkpoint.checkpointType = "narrow-country-batch-recovery-checkpoint";
checkpoint.shorteningVariants = {
  status: "not-created",
  reason: "No render passed the strict anatomy, prop-safety, identity, roll, and relationship gates. Raw and recovery outputs remain preserved under tmp/world-195x4/batch-301.",
};
checkpoint.queueAdvance = {
  previousCountry: "Ukraine",
  previousBatch: 301,
  previousTerminalStatus: checkpoint.status,
  nextCountry: "United Kingdom",
  nextBatch: 302,
  nextScenes: [1228, 1229, 1230, 1231],
  nextThemePair: checkpoint.nextThemePair,
  reason: "The binding terminal-batch rule advances after the single recovery pass even when zero assets are accepted.",
};
checkpoint.repositoryScope = {
  checkpointPath: "assets/lore/starlight-era/batch-301-ukraine-recovery-checkpoint.json",
  stagedFiles: ["assets/lore/starlight-era/batch-301-ukraine-recovery-checkpoint.json"],
  unrelatedDirtyFilesLeftUntouched: [
    "assets/lore/starlight-era/overnight-campaign.json",
    "assets/lore/starlight-era/world-195x4-campaign.json",
    "assets/lore/starlight-era/world-x-publish-ledger.json",
    "assets/videos/manifest.json",
  ],
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(checkpointPath);
