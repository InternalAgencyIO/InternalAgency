import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const root = path.join(repo, "tmp/world-195x4/batch-382");
const checkpointPath = path.join(repo, "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json");
const contractPath = path.join(repo, "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const ledgerPath = path.join(repo, "assets/lore/starlight-era/world-x-publish-ledger.json");
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
const scene = 1551;
const references = [
  {
    path: "assets/lore/starlight-era/937-central-african-republic-dzanga-sangha-rainbow-clinic-signal-cipher.png",
    role: "primary quartet identity anchor only",
  },
  {
    path: "assets/lore/starlight-era/938-central-african-republic-boali-falls-rainbow-star-map-relay.png",
    role: "frontal quartet face supplement only",
  },
  {
    path: "assets/lore/starlight-era/936-central-african-republic-bangui-oubangui-rainbow-route-grid.png",
    role: "quartet expression and Alia braid supplement only",
  },
  {
    path: "assets/lore/starlight-era/ece-canonical-identity-v1.png",
    role: "AI ECE canonical face and body identity detail only",
  },
];

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").toUpperCase();
}

if (sha256File(contractPath) !== "F7B247DF3BCE256C2A0BB2B51EB282EC4E6FBC5FE8E85A17970F311F26138FEC") {
  throw new Error("Authoritative contract changed before clean round 16 materialization");
}
if (sha256File(ledgerPath) !== "B94AA3FB2B1AB1BCAB100CE689F0173C77407B82439D73379D8BC0FA3EEC2455") {
  throw new Error("X publishing ledger changed before clean round 16 materialization");
}
if (checkpoint.status !== "active-four-scene-gate-incomplete-after-fresh-round-15") {
  throw new Error(`Unexpected checkpoint status: ${checkpoint.status}`);
}

const plan = checkpoint.scenePlans[String(scene)];
const basePrompt = plan.freshRound9?.prompt;
if (!basePrompt) throw new Error(`Scene ${scene} has no stored authoritative prompt`);

const cleanDirective = `Use case: photorealistic-natural.
Asset: Georgia Batch 382 scene 1551 clean fresh round 16, generated completely from scratch.

CLEAN SOURCE RESET
Images 1, 2, and 3 are identity references for the same adult quartet only. Image 4 is AI ECE's canonical identity detail only. Preserve their four distinct adult faces, body identities, skin tones, hair colors, and Alia's sculptural braids. Do not copy any reference image's wardrobe, rainbow group styling, pose, setting, prop, lighting, surface texture, framing, or composition. Do not edit, trace, repaint, warp, upscale, or reuse any prior Batumi render. Build an entirely new clean photographic scene from the stored specification below.

PLANNED PASS
This is one clean fresh render. It may receive at most one later narrowly targeted recovery from this exact clean raw. No recovery output or earlier edited Batumi image may ever seed another fresh round.

CLEAN PHOTOGRAPHIC SURFACE GATE
Use natural optical detail with clean skin pores, crisp garment seams, straight architectural edges, flat stable floor tiles, coherent sand texture, and individually readable straight rain streaks. Reject painterly waves, liquid swirls, marbling, embossed outlines, liquify distortion, melted edges, rippled skin, rippled fabric, bent buildings, bent glass rails, repetitive contour noise, over-sharpening, posterization, haloing, excessive HDR, waxy skin, plastic bodies, crunchy microtexture, or a processed illustration look. Keep materials smooth where physically smooth and textured only where the real material requires it. The result must read as a clean high-end fashion photograph, not an image that has been repeatedly edited.

COMPOSITION PRIORITY
Use a wide eye-level full-body 9:16 fashion photograph. Keep the relationship action large on the left and center, and isolate Alia's side-profile cinema-training lane on the far right behind a clean straight transparent safety panel. Place exactly one white square paper with one black route diamond on a tall complete sand backstop, with abundant empty air between the orange muzzle plug and paper. Lock Alia's dominant eye, pistol sights, horizontal barrel center, orange muzzle center, and black diamond center to one visibly straight horizontal row. Do not draw that row. Keep every adult and both mascots completely behind and left of Alia's muzzle plane.`;

const prompt = `${cleanDirective}\n\nAUTHORITATIVE STORED SCENE SPECIFICATION\n${basePrompt.replaceAll("fresh round 9", "clean fresh round 16")}`;
const promptPath = path.join(root, `scene-${scene}-clean-fresh-round-16-prompt.txt`);
fs.writeFileSync(promptPath, prompt, "utf8");

const required = [
  `Weather roll ${plan.weather.roll} = ${plan.weather.result}`,
  `Hard-love roll ${plan.hardLoveBeat.roll}: ${plan.hardLoveBeat.result}`,
  `Romance roll ${plan.romanceBeat.roll}: ${plan.romanceBeat.contractResult}`,
  `Compound-love roll ${plan.compoundLoveBeat.roll}: ${plan.compoundLoveBeat.contractResult}`,
  `Pose-target roll ${plan.poseTargetRoll.roll}`,
  `Mascot roll ${plan.mascotState.roll}`,
  `Odd-prop roll ${plan.interestingProp.roll}`,
  "exactly 8 human hands",
];
for (const value of required) {
  if (!prompt.includes(value)) throw new Error(`Scene ${scene} missing materialized field: ${value}`);
}
for (const character of Object.values(plan.characters)) {
  const emotion = character.emotion.materializedResult ?? character.emotion.result;
  if (!prompt.includes(`emotion roll ${character.emotion.roll} = ${emotion}`)) {
    throw new Error(`Scene ${scene} missing an emotion materialization`);
  }
}

const referenceAudit = references.map((reference, index) => ({
  image: index + 1,
  ...reference,
  sha256: sha256File(path.join(repo, reference.path)),
  exists: true,
}));
const promptAudit = {
  path: path.relative(repo, promptPath).replaceAll("\\", "/"),
  sha256: crypto.createHash("sha256").update(prompt).digest("hex").toUpperCase(),
  chars: prompt.length,
  storedRollsChanged: false,
  freshRound: 16,
  sourceMode: "clean-generation-from-original-identity-anchors",
  priorBatumiRenderInputCount: 0,
  referenceAudit,
  plannedPasses: {
    cleanFreshPasses: 1,
    maximumTargetedRecoveryPasses: 1,
    recoverySourceIfNeeded: "only the clean round 16 fresh raw",
    laterFreshSourcePolicy: "original identity anchors only",
  },
  hardSurfaceQualityGate: [
    "no wavy or marbled processing",
    "no liquify or melted geometry",
    "no embossed or over-sharpened edges",
    "no rippled skin or fabric",
    "no bent architecture or safety panels",
    "clean natural photographic texture",
  ],
};
plan.freshRound16 = { ...promptAudit, prompt };

const preparedAt = new Date().toISOString();
checkpoint.status = "active-four-scene-gate-clean-fresh-round-16-materialized";
checkpoint.checkpointedAt = preparedAt;
checkpoint.terminal = false;
checkpoint.countryCompletionGate = {
  ...checkpoint.countryCompletionGate,
  acceptedSceneCount: 3,
  missingSceneNumbers: [scene],
  gitCheckpointPushed: true,
  xPublicStatusVerified: false,
  queueAdvanceAllowed: false,
  gateSatisfied: false,
};
checkpoint.renderAttempts.freshRound16 = {
  status: "materialized-pending-launch",
  preparedAt,
  sceneNumbers: [scene],
  preservedAcceptedSceneNumbers: [1548, 1549, 1550],
  concurrency: "one clean missing-scene built-in generation",
  maximumRecoveryPassesPerBlockedScene: 1,
  promptAudit: { [scene]: promptAudit },
  storedRollsChanged: false,
  priorBatumiRenderInputCount: 0,
};
checkpoint.xBacklogAudit = {
  ...checkpoint.xBacklogAudit,
  checkedAt: preparedAt,
  eligibleBacklogRemaining: 0,
  pendingPost: null,
  preparedPostQueueCount: 0,
  reconciliationDecision: "No eligible unposted World Series item. Georgia remains X-blocked until one clean fourth current-country scene is accepted.",
};
checkpoint.xPost.status = "blocked-active-country-incomplete-not-skipped";
checkpoint.xPost.url = null;
checkpoint.xPost.acceptedCurrentCountryAssets = 3;
checkpoint.nextQueueStatus = "locked-on-Georgia-until-four-accepted-git-pushed-and-X-live-verified";
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "launch-clean-fresh-round-16-from-original-identity-anchors-scene-1551-only",
  preserveAcceptedSceneNumbers: [1548, 1549, 1550],
  sceneNumbers: [scene],
  laterCountryStartAllowed: false,
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ status: checkpoint.status, promptAudit }, null, 2));
