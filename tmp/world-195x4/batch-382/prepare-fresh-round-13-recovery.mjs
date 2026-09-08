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
const sourcePath = "tmp/world-195x4/batch-382/raw/fresh-round-13/scene-1551.png";
const qaPath = "tmp/world-195x4/batch-382/qa/fresh-round-13-scene-1551-target-crop.png";

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").toUpperCase();
}

if (sha256File(contractPath) !== "F7B247DF3BCE256C2A0BB2B51EB282EC4E6FBC5FE8E85A17970F311F26138FEC") {
  throw new Error("Authoritative contract changed before round 13 recovery materialization");
}
if (sha256File(ledgerPath) !== "B94AA3FB2B1AB1BCAB100CE689F0173C77407B82439D73379D8BC0FA3EEC2455") {
  throw new Error("X publishing ledger changed before round 13 recovery materialization");
}

const plan = checkpoint.scenePlans[String(scene)];
const basePrompt = plan.freshRound13?.prompt;
if (!basePrompt) throw new Error(`Scene ${scene} has no stored round 13 prompt`);

const recoveryDirective = `Use case: precise-object-edit.
Input image dimensions: 940 by 1672 pixels. Preserve the supplied Batumi image pixel-for-pixel except for the complete compact white paper target and its black diamond. The fresh round-thirteen edit correctly preserved every adult, hand, garment roll, romance contact, landmark, mascot, route map, compass, safety panel, inert pistol, and complete sand backstop and correctly made the paper compact, but left its center approximately 60 pixels below the orange muzzle center and left almost no horizontal air gap.

ROUND 13 RECOVERY: TRANSLATE ONLY THE EXISTING COMPACT PAPER TARGET
Move the complete existing compact white paper square, its black route diamond, and its four mounting dots together exactly 60 image pixels UP and exactly 23 image pixels RIGHT. Keep its current compact size, shape, orientation, paper texture, black diamond, and mounting dots unchanged. Place its approximate final bounds at x=900 through x=935 and y=583 through y=627, fully inside the image. Its black diamond center must land at x about 918 and on the exact same horizontal pixel row y=605 as the exact center of the unchanged orange muzzle plug. The unchanged orange muzzle tip ends near x=879, so the translated paper begins near x=900 and leaves at least 20 visible pixels of clean empty air between muzzle and paper.

Do not move, tilt, rotate, resize, redraw, or alter Alia, either hand, either arm, the inert pistol, the orange muzzle plug, the backstop, the safety panels, or any other image element. Keep the pistol perfectly horizontal. No beam, line, tracer, cord, string, dashed path, glow trail, or trajectory mark. Preserve the exact eight-hand map: Ellie has two support palms on Radiance; Radiance has one palm on Ellie's shoulder and one hand resting on ECE's left fist; ECE has one fist on each compass handle; Alia has exactly two mission hands. Preserve Alia's straight trigger index outside the guard. The 60-pixel-up and 23-pixel-right translation of the existing compact target is the sole permitted change.`;

const prompt = `${recoveryDirective}\n\nAUTHORITATIVE STORED ROUND-THIRTEEN SCENE SPECIFICATION\n${basePrompt}`;
const promptPath = path.join(root, `scene-${scene}-fresh-round-13-recovery-prompt.txt`);
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
  qaReference: qaPath,
  qaReferenceSha256: sha256File(path.join(repo, qaPath)),
  storedRollsChanged: false,
  freshRound: 13,
  recoveryPass: 1,
  referenceGuidedEdit: true,
  solePermittedChange: "translate existing compact paper target 60 pixels up and 23 pixels right",
  measuredSourceGeometry: {
    muzzlePlugCenterApprox: { x: 872, y: 605 },
    muzzleTipMaxX: 879,
    compactDiamondCenterApprox: { x: 894, y: 665 },
  },
  translatedTargetGeometry: {
    centerApprox: { x: 918, y: 605 },
    boundsApprox: { left: 900, right: 935, top: 583, bottom: 627 },
    cleanAirGapPixels: 21,
  },
};
plan.freshRound13Recovery = { ...promptAudit, prompt };

const preparedAt = new Date().toISOString();
checkpoint.status = "active-four-scene-gate-fresh-round-13-recovery-materialized";
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
checkpoint.renderAttempts.freshRound13 = {
  ...checkpoint.renderAttempts.freshRound13,
  status: "completed-rejected-target-axis-and-clearance",
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
      "compact paper diamond center remains approximately 60 pixels below the unchanged muzzle centerline",
      "compact paper target begins too close to the orange muzzle tip for the required clean empty-air separation",
    ],
  },
};
checkpoint.renderAttempts.freshRound13Recovery = {
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
  reconciliationDecision: "No eligible unposted World Series item; Georgia remains X-blocked until all four current-country scenes pass.",
};
checkpoint.xPost.status = "blocked-active-country-incomplete-not-skipped";
checkpoint.xPost.url = null;
checkpoint.xPost.acceptedCurrentCountryAssets = 3;
checkpoint.nextQueueStatus = "locked-on-Georgia-until-four-accepted-git-pushed-and-X-live-verified";
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "launch-fresh-round-13-single-allowed-recovery-scene-1551-only",
  preserveAcceptedSceneNumbers: [1548, 1549, 1550],
  sceneNumbers: [scene],
  laterCountryStartAllowed: false,
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ status: checkpoint.status, promptAudit }, null, 2));
