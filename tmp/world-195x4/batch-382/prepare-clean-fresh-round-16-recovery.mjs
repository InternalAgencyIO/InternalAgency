import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const root = path.join(repo, "tmp/world-195x4/batch-382");
const checkpointPath = path.join(repo, "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json");
const contractPath = path.join(repo, "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const ledgerPath = path.join(repo, "assets/lore/starlight-era/world-x-publish-ledger.json");
const sourcePath = "tmp/world-195x4/batch-382/raw/clean-fresh-round-16/scene-1551.png";
const handsQaPath = "tmp/world-195x4/batch-382/qa/clean-fresh-round-16-scene-1551-hands-crop.png";
const targetQaPath = "tmp/world-195x4/batch-382/qa/clean-fresh-round-16-scene-1551-target-crop.png";
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
const scene = 1551;

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").toUpperCase();
}

if (sha256File(contractPath) !== "F7B247DF3BCE256C2A0BB2B51EB282EC4E6FBC5FE8E85A17970F311F26138FEC") {
  throw new Error("Authoritative contract changed before clean round 16 recovery materialization");
}
if (sha256File(ledgerPath) !== "B94AA3FB2B1AB1BCAB100CE689F0173C77407B82439D73379D8BC0FA3EEC2455") {
  throw new Error("X publishing ledger changed before clean round 16 recovery materialization");
}
if (checkpoint.status !== "active-four-scene-gate-clean-fresh-round-16-materialized") {
  throw new Error(`Unexpected checkpoint status: ${checkpoint.status}`);
}

const plan = checkpoint.scenePlans[String(scene)];
const basePrompt = plan.freshRound9?.prompt;
if (!basePrompt) throw new Error(`Scene ${scene} has no stored authoritative prompt`);

const recoveryDirective = `Use case: precise-pose-edit.
Input image dimensions: 941 by 1672 pixels. Edit only the supplied clean round-sixteen Batumi raw. It is the sole permitted recovery source. Preserve its clean natural photographic rendering, four adult identities, Alia's braids, four distinct outfits, rolled garment cuts, heavy straight rain, Batumi landmarks, straight glass and architecture, floor geometry, PAWS and MAX, romance grouping, separate route map, compass table, single target, complete sand backstop, and public-safe framing.

ONE PLANNED CLEAN RECOVERY
Make only two localized corrections: the exact eight-hand ownership map in the left/center relationship group, and Alia's two existing arms, two existing hands, and already-held pistol alignment in the far-right safety lane. Do not repaint or restyle the image. Do not change any face, body, torso, garment, leg, foot, landmark, mascot, weather, floor, glass panel, backstop, target, or crop.

EXACTLY EIGHT HANDS, ALL VISIBLE AND TRACEABLE
Ellie at far left: preserve her existing hand at Radiance's waist and reveal her other complete hand high between Radiance's shoulder blades. Both Ellie wrists and forearms must trace cleanly to Ellie's two shoulders.
Radiance left-center: reveal one complete hand on Ellie's outer shoulder and preserve one complete hand resting on ECE's near shoulder. Radiance touches no compass handle and no ECE hand.
AI ECE right-center: place both complete hands exclusively on the two opposite compass-table handles, one hand per handle, both wrists and forearms fully visible. ECE clasps no person. No other adult touches the compass table.
Alia far right: preserve exactly her two complete hands on the one pistol grip, with both wrists and forearms continuously visible from her shoulders.
This inventory is exactly eight human hands total: Ellie two, Radiance two, ECE two, Alia two. No hidden, extra, duplicate, fused, borrowed, emerging, cropped, or ambiguous hand or finger cluster.

FREEZE TARGET; ALIGN ALIA'S EXISTING STANCE
The one white paper square, one black route diamond, four mounting dots, complete sand backstop, and every one of their pixels remain unchanged. Move only Alia's two existing arms, two existing hands, and already-held pistol together exactly 14 image pixels UP and 20 image pixels LEFT. Keep her shoulders, torso, head, legs, outfit, and braid fixed, using modestly more bent elbows. The current orange muzzle center is approximately x=858, y=565; the frozen diamond center is approximately x=902, y=551. The final orange muzzle center must be approximately x=838, y=551 on the exact same horizontal row as the diamond center, with at least 30 pixels of clean empty air before the paper begins near x=875. Keep the short stockless pistol horizontal, the orange plug visible, both hands on the grip, and the trigger index straight on the frame outside the guard. Draw no line, beam, ray, tracer, cord, string, path, glow trail, or trajectory mark.

CLEAN SURFACE LOCK
Preserve the clean fresh source's natural skin pores, smooth physically coherent fabric, straight architecture, straight safety glass, flat floor tiles, coherent sand, and straight rain streaks. Add no waves, swirls, marbling, liquify distortion, melted edges, rippled skin, rippled fabric, bent structure, embossed contours, crunchy microtexture, over-sharpening, posterization, excessive HDR, haloing, waxy skin, or illustration processing.`;

const prompt = `${recoveryDirective}\n\nAUTHORITATIVE STORED SCENE SPECIFICATION\n${basePrompt.replaceAll("fresh round 9", "clean fresh round 16 recovery")}`;
const promptPath = path.join(root, `scene-${scene}-clean-fresh-round-16-recovery-prompt.txt`);
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

const promptAudit = {
  path: path.relative(repo, promptPath).replaceAll("\\", "/"),
  sha256: crypto.createHash("sha256").update(prompt).digest("hex").toUpperCase(),
  chars: prompt.length,
  sourceReference: sourcePath,
  sourceReferenceSha256: sha256File(path.join(repo, sourcePath)),
  handsQaReference: handsQaPath,
  handsQaReferenceSha256: sha256File(path.join(repo, handsQaPath)),
  targetQaReference: targetQaPath,
  targetQaReferenceSha256: sha256File(path.join(repo, targetQaPath)),
  storedRollsChanged: false,
  freshRound: 16,
  recoveryPass: 1,
  sourceMode: "single-recovery-from-clean-fresh-round-16-raw",
  priorEditedBatumiInputs: 0,
  laterFreshSourcePolicy: "original identity anchors only",
  localizedCorrections: [
    "restore exact visible eight-hand ownership map and ECE two-hand compass ownership",
    "move Alia's existing stance 14 pixels up and 20 pixels left while freezing target",
  ],
};
plan.freshRound16Recovery = { ...promptAudit, prompt };

const preparedAt = new Date().toISOString();
checkpoint.status = "active-four-scene-gate-clean-fresh-round-16-recovery-materialized";
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
  ...checkpoint.renderAttempts.freshRound16,
  status: "completed-rejected-anatomy-odd-prop-and-target-axis",
  completedAt: preparedAt,
  rawOutputs: {
    [scene]: {
      path: sourcePath,
      sha256: promptAudit.sourceReferenceSha256,
      preserved: true,
    },
  },
  acceptedSceneNumbers: [],
  rejectedSceneNumbers: [scene],
  rejectionReasons: {
    [scene]: [
      "Ellie's second hand and Radiance's second hand are hidden or missing, so the exact eight-hand gate is not visibly satisfied",
      "ECE's right hand leaves the compass and clasps the relationship group instead of ECE owning both compass handles exclusively",
      "Alia's horizontal muzzle axis remains approximately 14 pixels below the paper-diamond center row",
    ],
  },
  strictAudit: {
    renderSurfaceQuality: "pass-clean-natural-photographic-texture-without-wavy-artifacts",
    identity: "pass-four-adult-identities-with-Alia-braids",
    weather: "pass-heavy-straight-rain",
    locationThemeFusion: "pass-Batumi-and-Mars-expedition-couture",
    outfitOriginality: "pass-four-distinct-fingerprints",
    rolledWardrobe: "pass-Radiance-rainbow-hosiery-and-open-back-Ellie-midriff-Alia-strapless-midriff-open-back",
    romance: "pass-supported-leaning-dip-and-clear-affectionate-center",
    mascots: "pass-one-PAWS-and-one-MAX-safe-play",
    anatomy: "reject-two-hidden-or-missing-group-hands",
    oddProp: "reject-ECE-not-using-both-hands-exclusively-on-compass",
    missionHandling: "pass-two-Alia-hands-indexed-trigger-single-target-and-complete-backstop",
    missionTargetAxis: "reject-muzzle-axis-approximately-14-pixels-below-diamond-center-row",
    accepted: false,
  },
};
checkpoint.renderAttempts.freshRound16Recovery = {
  status: "materialized-pending-launch",
  preparedAt,
  sceneNumbers: [scene],
  preservedAcceptedSceneNumbers: [1548, 1549, 1550],
  recoveryPass: 1,
  maximumRecoveryPassesPerBlockedScene: 1,
  promptAudit: { [scene]: promptAudit },
  storedRollsChanged: false,
};
checkpoint.xBacklogAudit = {
  ...checkpoint.xBacklogAudit,
  checkedAt: preparedAt,
  eligibleBacklogRemaining: 0,
  pendingPost: null,
  preparedPostQueueCount: 0,
  reconciliationDecision: "No eligible unposted World Series item. Georgia remains X-blocked until the clean fourth current-country scene passes.",
};
checkpoint.xPost.status = "blocked-active-country-incomplete-not-skipped";
checkpoint.xPost.url = null;
checkpoint.xPost.acceptedCurrentCountryAssets = 3;
checkpoint.nextQueueStatus = "locked-on-Georgia-until-four-accepted-git-pushed-and-X-live-verified";
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "launch-single-planned-clean-round-16-recovery-scene-1551-only",
  preserveAcceptedSceneNumbers: [1548, 1549, 1550],
  sceneNumbers: [scene],
  laterCountryStartAllowed: false,
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ status: checkpoint.status, promptAudit }, null, 2));
