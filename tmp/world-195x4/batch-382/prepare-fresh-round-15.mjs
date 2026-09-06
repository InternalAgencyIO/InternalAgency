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
const sourcePath = "tmp/world-195x4/batch-382/raw/fresh-round-14-recovery/scene-1551.png";
const sourceQaPath = "tmp/world-195x4/batch-382/qa/fresh-round-14-recovery-scene-1551-target-crop.png";

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").toUpperCase();
}

if (sha256File(contractPath) !== "F7B247DF3BCE256C2A0BB2B51EB282EC4E6FBC5FE8E85A17970F311F26138FEC") {
  throw new Error("Authoritative contract changed before round 15 materialization");
}
if (sha256File(ledgerPath) !== "B94AA3FB2B1AB1BCAB100CE689F0173C77407B82439D73379D8BC0FA3EEC2455") {
  throw new Error("X publishing ledger changed before round 15 materialization");
}
if (checkpoint.status !== "active-four-scene-gate-incomplete-after-fresh-round-14") {
  throw new Error(`Unexpected checkpoint status: ${checkpoint.status}`);
}

const plan = checkpoint.scenePlans[String(scene)];
const basePrompt = plan.freshRound9?.prompt;
if (!basePrompt) throw new Error(`Scene ${scene} has no stored authoritative prompt`);

const editDirective = `Use case: precise-pose-edit.
Input image dimensions: 941 by 1672 pixels. Preserve the supplied Batumi image pixel-for-pixel except for the position of Alia's two existing arms, two existing hands, and the inert rainbow pistol they already hold. The supplied source passes every other strict gate: four adult identities, Alia's braids, exactly eight traceable arms and hands, every rolled garment detail, heavy rain, Batumi landmarks, four distinct Mars-expedition couture fingerprints, controlled romance dip, PAWS and MAX, ECE's two-hand compass ownership, separate holographic route map, exactly one correctly formed paper target, complete sand backstop, transparent safety panels, a clean muzzle-to-paper air gap, and indexed trigger safety.

FRESH ROUND 15: FREEZE THE TARGET AND RAISE ONLY ALIA'S EXISTING TWO-HAND STANCE
The single white paper square, black route diamond, four mounting dots, sand backstop, and every one of their pixels are correct. Keep their count, size, shape, texture, x position, y position, and pixels absolutely unchanged. Do not add, remove, duplicate, move, resize, redraw, or alter the target or backstop.

Move Alia's two existing arms, two existing hands, and their already-held inert rainbow pistol together exactly 12 image pixels UP and exactly 20 image pixels LEFT from the supplied source. Keep Alia's shoulders, torso, head, legs, garment, and body fixed; use modestly more bent elbows. Keep the short pistol perfectly horizontal. The current orange muzzle-plug center is approximately x=819, y=603 while the frozen black diamond center is approximately x=872, y=591. The final orange muzzle-plug center must be approximately x=799, y=591, on the exact same horizontal pixel row as the unchanged diamond. The current muzzle tip near x=835 moves to about x=815, leaving approximately 29 visible pixels of clean empty air before the unchanged paper begins near x=844.

Preserve exactly two Alia arms and exactly two Alia hands, continuously traceable from her fixed shoulders through modestly bent elbows to both hands on the one pistol grip. Preserve the realistic two-hand large-frame-pistol stance, straight wrists, slightly forward shoulders, short stockless pistol silhouette, orange muzzle plug, and Alia's trigger index straight and flat along the frame outside the guard. Do not create, remove, duplicate, merge, hide, crop, or alter any hand or finger cluster. Do not change any other adult, body, face, garment, romance contact, mascot, compass, route map, landmark, rain, safety panel, target, or crop. No beam, line, tracer, cord, string, dashed path, glow trail, or trajectory mark. This 12-pixel-up and 20-pixel-left move of Alia's existing two-hand stance is the sole permitted change.`;

const prompt = `${editDirective}\n\nAUTHORITATIVE STORED SCENE SPECIFICATION\n${basePrompt.replaceAll("fresh round 9", "fresh round 15")}`;
const promptPath = path.join(root, `scene-${scene}-fresh-round-15-prompt.txt`);
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
  sourceQaReference: sourceQaPath,
  sourceQaReferenceSha256: sha256File(path.join(repo, sourceQaPath)),
  storedRollsChanged: false,
  freshRound: 15,
  referenceGuidedEdit: true,
  sourceSelectionRationale: "Round 14 recovery passes every strict non-target gate and preserves exactly one correct target; move only Alia's existing stance to close the remaining axis and clearance defects.",
  solePermittedChange: "move Alia's existing two arms, two hands, and held pistol 12 pixels up and 20 pixels left",
  measuredSourceGeometry: {
    muzzlePlugCenterApprox: { x: 819, y: 603 },
    muzzleTipMaxXApprox: 835,
    frozenDiamondCenterApprox: { x: 872, y: 591 },
    frozenPaperLeftApprox: 844,
    cleanAirGapPixelsApprox: 9,
  },
  targetPoseGeometry: {
    muzzlePlugCenterApprox: { x: 799, y: 591 },
    muzzleTipMaxXApprox: 815,
    frozenDiamondCenterApprox: { x: 872, y: 591 },
    cleanAirGapPixelsApprox: 29,
  },
};
plan.freshRound15 = { ...promptAudit, prompt };

const preparedAt = new Date().toISOString();
checkpoint.status = "active-four-scene-gate-fresh-round-15-materialized";
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
checkpoint.renderAttempts.freshRound15 = {
  status: "materialized-pending-launch",
  preparedAt,
  sceneNumbers: [scene],
  preservedAcceptedSceneNumbers: [1548, 1549, 1550],
  concurrency: "one missing-scene reference-guided built-in image edit",
  maximumRecoveryPassesPerBlockedScene: 1,
  promptAudit: { [scene]: promptAudit },
  storedRollsChanged: false,
};
checkpoint.xBacklogAudit = {
  ...checkpoint.xBacklogAudit,
  checkedAt: preparedAt,
  account: "@dogramaci",
  signedIn: true,
  eligibleBacklogRemaining: 0,
  pendingPost: null,
  preparedPostQueueCount: 0,
  deferredPostCheckpoint: null,
  latestVisibleSeriesStatus: {
    country: "Honduras",
    url: "https://x.com/dogramaci/status/2087088543499768003",
    caption: "Honduras heart Czechia #Honduras",
    attachments: 3,
    liveVerified: true,
    viewsAtAudit: 42,
  },
  reconciliationDecision: "No eligible unposted World Series item; do not duplicate Honduras. Georgia remains blocked until scene 1551 passes.",
};
checkpoint.xPost.status = "blocked-active-country-incomplete-not-skipped";
checkpoint.xPost.url = null;
checkpoint.xPost.acceptedCurrentCountryAssets = 3;
checkpoint.nextQueueStatus = "locked-on-Georgia-until-four-accepted-git-pushed-and-X-live-verified";
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "launch-fresh-round-15-missing-scene-only",
  preserveAcceptedSceneNumbers: [1548, 1549, 1550],
  sceneNumbers: [scene],
  laterCountryStartAllowed: false,
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ status: checkpoint.status, promptAudit }, null, 2));
