import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const temp = path.join(root, "tmp", "world-195x4", "batch-302");
const generated = "C:\\Users\\A\\.codex\\generated_images\\019fd625-0bf6-78d2-9fb8-3f3e22c1d086";
const checkpointPath = path.join(
  root,
  "assets",
  "lore",
  "starlight-era",
  "batch-302-united-kingdom-recovery-checkpoint.json",
);

const checkpoint = JSON.parse(
  fs.readFileSync(path.join(temp, "batch-302-united-kingdom-preflight.json"), "utf8"),
);

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").toUpperCase();
}

function promptRecord(scene, kind) {
  const fileName = `scene-${scene}-${kind === "raw" ? "prompt" : "recovery-prompt"}.txt`;
  const absolutePath = path.join(temp, fileName);
  return {
    workspacePath: path.posix.join("tmp", "world-195x4", "batch-302", fileName),
    bytes: fs.statSync(absolutePath).size,
    sha256: sha256(absolutePath),
  };
}

function assetRecord(fileName, workspaceName) {
  const workspacePath = path.join(temp, workspaceName);
  return {
    fileName,
    absolutePath: path.join(generated, fileName),
    workspaceCopy: path.posix.join("tmp", "world-195x4", "batch-302", workspaceName),
    bytes: fs.statSync(workspacePath).size,
    sha256: sha256(workspacePath),
    preservedOriginal: true,
    copiedToAcceptedAssets: false,
  };
}

const assets = {
  recovery1228: assetRecord(
    "exec-731bd488-7df6-4df8-9306-ae0c278e6997.png",
    "1228-united-kingdom-london-recovery.png",
  ),
  raw1229: assetRecord(
    "exec-ea96f4ef-1e54-46fc-a90f-c8f3f3f1cb44.png",
    "1229-united-kingdom-edinburgh-male-raw.png",
  ),
  raw1230: assetRecord(
    "exec-91cb8025-88c9-4828-8c17-9de9c0d25e29.png",
    "1230-united-kingdom-cardiff-raw.png",
  ),
  recovery1230: assetRecord(
    "exec-8364ca90-c69d-4ab6-8b17-bae17a3c915a.png",
    "1230-united-kingdom-cardiff-recovery.png",
  ),
  recovery1231: assetRecord(
    "exec-80734d1b-8cb8-47aa-b94a-bedc12f97f3c.png",
    "1231-united-kingdom-giants-causeway-paws-recovery.png",
  ),
};

checkpoint.status = "terminal-blocked-after-single-recovery-pass";
checkpoint.renderAttempts = {
  raw: {
    status: "complete",
    requested: 4,
    rendered: 2,
    outputSafetyBlocked: 2,
    accepted: 0,
    rejected: 4,
    concurrency: "four independent built-in image generation calls",
    orchestrationNote: "All four raw calls were started together. Scenes 1229 and 1230 returned assets; Scenes 1228 and 1231 were rejected by the output safety system before assets were produced.",
  },
  recovery: {
    status: "complete",
    requested: 4,
    rendered: 3,
    outputSafetyBlocked: 1,
    accepted: 0,
    rejected: 4,
    maximumPerBlockedScene: 1,
    allowanceExhaustedForScenes: [1228, 1229, 1230, 1231],
    orchestrationNote: "All four single recovery calls were started together. Scenes 1228, 1230, and 1231 returned assets; Scene 1229 was rejected by the output safety system before an asset was produced. No further recovery was attempted.",
  },
  scenes: {
    1228: {
      rawPrompt: promptRecord(1228, "raw"),
      recoveryPrompt: promptRecord(1228, "recovery"),
      raw: {
        status: "output-safety-blocked",
        requestId: "955412df-60c4-4465-8c75-22f472629a1a",
        moderationStage: "output",
        category: "sexual",
        assetProduced: false,
        audit: {
          pass: [],
          fail: ["no raw asset was produced, so the scene cannot pass the visual acceptance gate"],
        },
      },
      recovery: {
        status: "rendered-rejected",
        asset: assets.recovery1228,
        audit: {
          pass: [
            "exactly four clearly adult women, Tower Bridge, the Thames, the Shard, silent heat lightning, large United Kingdom motifs, distinct silhouettes, and complete footwear are present",
            "the triggered visible waists, Alia's strapless cut, and Ellie's camera-visible open back are materially present",
            "ECE alone holds the inert prop at the outer edge and the muzzle points across empty Thames water",
          ],
          fail: [
            "the exact eight-arm and eight-hand inventory is not continuously traceable because central shoulder and waist contacts disappear behind bodies and their ownership is ambiguous",
            "the required hand inventory is reassigned: Alia's free hand hangs at her side instead of remaining visibly on Ellie's shoulder",
            "the requested dynamic rise from the route beacon collapses into a static standing lineup",
          ],
        },
      },
      terminalStatus: "blocked-after-single-recovery-pass",
    },
    1229: {
      rawPrompt: promptRecord(1229, "raw"),
      recoveryPrompt: promptRecord(1229, "recovery"),
      raw: {
        status: "rendered-rejected",
        asset: assets.raw1229,
        audit: {
          pass: [
            "exactly five clearly adult people, Edinburgh Castle, Old Town, Arthur's Seat, golden hour, researched country motifs, a culture table, distinct silhouettes, and complete footwear are present",
            "the established male wears a fitted black short-sleeve polo, black jeans, and black boots and visibly contacts Alia and Ellie",
            "ECE alone holds the inert prop at the outer edge and the muzzle points away from the cast",
          ],
          fail: [
            "the exact ten-arm and ten-hand inventory is not continuously traceable because ribbon and waist hand paths are hidden, reassigned, or owner-ambiguous",
            "the male's strongest eye line lands on Ellie instead of his required strongest eye line to ECE",
            "Alia's rolled completely open back is not visible",
            "ECE's index finger and the empty trigger guard are not unambiguously separated",
          ],
        },
      },
      recovery: {
        status: "output-safety-blocked",
        requestId: "af60def9-d9d7-4b79-a729-469fb11b2fb9",
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
    1230: {
      rawPrompt: promptRecord(1230, "raw"),
      recoveryPrompt: promptRecord(1230, "recovery"),
      raw: {
        status: "rendered-rejected",
        asset: assets.raw1230,
        audit: {
          pass: [
            "exactly four clearly adult women, Cardiff Bay, the Wales Millennium Centre, the Pierhead clock, light rain, large Welsh motifs, distinct silhouettes, and complete footwear are present",
            "all four rolled visible waists and belly buttons and Alia's strapless cut are present",
            "ECE alone holds the inert prop at the outer edge and the muzzle points across empty bay water",
          ],
          fail: [
            "the exact eight-arm and eight-hand inventory is not continuously traceable because Radiance's far arm is hidden and several linked-hand owners are reassigned",
            "Alia's rolled completely open back is not visible",
            "ECE's index finger and the empty trigger guard are not unambiguously separated",
          ],
        },
      },
      recovery: {
        status: "rendered-rejected",
        asset: assets.recovery1230,
        audit: {
          pass: [
            "exactly four clearly adult women, Cardiff Bay, the Wales Millennium Centre, the Pierhead clock, light rain and reflections, large Welsh motifs, distinct silhouettes, and complete footwear are preserved",
            "all four rolled visible waists and belly buttons, Alia's strapless cut, and Alia's complete open back are visible",
            "ECE alone holds the inert prop at the far left and the muzzle points across empty bay water",
          ],
          fail: [
            "the exact eight-arm and eight-hand inventory is not continuously traceable because Radiance's far arm disappears behind Ellie and Alia's far hand is hidden behind her body",
            "the specified shoulder and waist hand inventory is reassigned, leaving multiple owner paths ambiguous",
          ],
        },
      },
      terminalStatus: "blocked-after-single-recovery-pass",
    },
    1231: {
      rawPrompt: promptRecord(1231, "raw"),
      recoveryPrompt: promptRecord(1231, "recovery"),
      raw: {
        status: "output-safety-blocked",
        requestId: "91b9d37e-b339-4337-8f20-fc9f5841ddd9",
        moderationStage: "output",
        category: "sexual",
        assetProduced: false,
        audit: {
          pass: [],
          fail: ["no raw asset was produced, so the scene cannot pass the visual acceptance gate"],
        },
      },
      recovery: {
        status: "rendered-rejected",
        asset: assets.recovery1231,
        audit: {
          pass: [
            "exactly four clearly adult women, the Giant's Causeway basalt columns, Atlantic cliffs, light rain, researched country motifs, distinct silhouettes, and complete footwear are present",
            "PAWS appears once as a collarless golden kitten held at the far left and remains separated from the prop and platform edge",
            "Radiance's and ECE's rolled completely open backs, both triggered visible waists, and both triggered strapless cuts are materially present",
            "ECE alone holds the inert prop at the far right and its muzzle points across empty Atlantic water",
          ],
          fail: [
            "only seven human hands are visibly and continuously traceable because Alia's left hand and arm path disappear behind Radiance, violating the exact eight-hand gate",
            "the required Alia-to-Radiance shoulder contact is missing while a different owner reaches across the center pair",
            "ECE's index finger enters or touches the trigger guard instead of remaining visibly indexed high along the frame",
          ],
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
  eligibleCaptionShapeIfAssetsExisted: "United Kingdom red-heart Vatican City #UnitedKingdom",
  hashtagsSuppressedByRoll: ["#InternalAgency", "#WorldXXXSeries"],
};
checkpoint.terminalizedAt = new Date().toISOString();
checkpoint.checkpointType = "narrow-country-batch-recovery-checkpoint";
checkpoint.shorteningVariants = {
  status: "not-created",
  reason: "No render passed the strict anatomy, prop-safety, identity, roll, and relationship gates. Raw and recovery outputs remain preserved under tmp/world-195x4/batch-302.",
};
checkpoint.queueAdvance = {
  previousCountry: "United Kingdom",
  previousBatch: 302,
  previousTerminalStatus: checkpoint.status,
  nextCountry: "Vatican City",
  nextBatch: 303,
  nextScenes: [1232, 1233, 1234, 1235],
  nextThemePair: checkpoint.nextThemePair,
  reason: "The binding terminal-batch rule advances after the single recovery pass even when zero assets are accepted.",
};
checkpoint.repositoryScope = {
  checkpointPath: "assets/lore/starlight-era/batch-302-united-kingdom-recovery-checkpoint.json",
  stagedFiles: ["assets/lore/starlight-era/batch-302-united-kingdom-recovery-checkpoint.json"],
  unrelatedDirtyFilesLeftUntouched: [
    "assets/lore/starlight-era/overnight-campaign.json",
    "assets/lore/starlight-era/world-195x4-campaign.json",
    "assets/lore/starlight-era/world-x-publish-ledger.json",
    "assets/videos/manifest.json",
  ],
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(checkpointPath);
