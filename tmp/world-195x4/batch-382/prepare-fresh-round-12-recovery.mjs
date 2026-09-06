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
const sourcePath = "tmp/world-195x4/batch-382/raw/fresh-round-12/scene-1551.png";

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").toUpperCase();
}

if (sha256File(contractPath) !== "F7B247DF3BCE256C2A0BB2B51EB282EC4E6FBC5FE8E85A17970F311F26138FEC") {
  throw new Error("Authoritative contract changed before round 12 recovery materialization");
}
if (sha256File(ledgerPath) !== "B94AA3FB2B1AB1BCAB100CE689F0173C77407B82439D73379D8BC0FA3EEC2455") {
  throw new Error("X publishing ledger changed before round 12 recovery materialization");
}

const plan = checkpoint.scenePlans[String(scene)];
const basePrompt = plan.freshRound12?.prompt;
if (!basePrompt) throw new Error(`Scene ${scene} has no stored round 12 prompt`);

const recoveryDirective = `Use case: precise-object-edit.
Input image: preserve the supplied Batumi image pixel-for-pixel except for the complete white paper target and its black diamond. The round-twelve fresh edit preserved every required adult, hand, garment roll, romance contact, landmark, mascot, route map, compass, safety panel, inert pistol, and complete sand backstop, but moved the paper target too far down.

ROUND 12 RECOVERY: ONE MEASURED LOCAL CORRECTION ONLY
Move only the complete white paper square and its black route diamond straight UP by exactly 52 image pixels, keeping the current size, shape, orientation, mounting dots, and paper appearance unchanged. The measured source centers are approximately target y=663 and orange muzzle y=611, so this 52-pixel upward correction must place the exact center of the black diamond on the exact same horizontal pixel row as the exact center of the unchanged orange muzzle plug. The target is currently visibly below the muzzle axis; move it upward, never downward. Do not move, tilt, rotate, resize, redraw, or alter Alia, either hand, either arm, the inert pistol, the orange muzzle plug, the backstop, the safety panels, or any other image element. Keep the pistol perfectly horizontal. Preserve a clean empty air gap with no beam, line, tracer, cord, string, dashed path, glow trail, or trajectory mark.

Preserve the exact eight-hand map: Ellie has two support palms on Radiance; Radiance has one palm on Ellie's shoulder and one hand resting on ECE's left fist; ECE has one fist on each compass handle; Alia has exactly two mission hands. Preserve Alia's straight trigger index outside the guard. The 52-pixel paper-target translation is the sole permitted change.`;

const prompt = `${recoveryDirective}\n\nAUTHORITATIVE STORED ROUND-TWELVE SCENE SPECIFICATION\n${basePrompt}`;
const promptPath = path.join(root, `scene-${scene}-fresh-round-12-recovery-prompt.txt`);
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

const sourceReferencePath = path.join(repo, sourcePath);
const promptAudit = {
  path: path.relative(repo, promptPath).replaceAll("\\", "/"),
  sha256: crypto.createHash("sha256").update(prompt).digest("hex").toUpperCase(),
  chars: prompt.length,
  sourceReference: sourcePath,
  sourceReferenceSha256: sha256File(sourceReferencePath),
  storedRollsChanged: false,
  freshRound: 12,
  recoveryPass: 1,
  referenceGuidedEdit: true,
  targetCorrections: ["move only the complete paper target upward by the measured 52-pixel overshoot onto the unchanged muzzle centerline"],
  solePermittedChange: "paper-target vertical position",
};
plan.freshRound12Recovery = { ...promptAudit, prompt };

const preparedAt = new Date().toISOString();
checkpoint.status = "active-four-scene-gate-fresh-round-12-recovery-materialized";
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
checkpoint.renderAttempts.freshRound12 = {
  ...checkpoint.renderAttempts.freshRound12,
  status: "completed-rejected-target-axis-overshoot",
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
    [scene]: ["paper target center visibly below the unchanged horizontal orange-muzzle centerline"],
  },
};
checkpoint.renderAttempts.freshRound12Recovery = {
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
  action: "launch-fresh-round-12-single-allowed-recovery-scene-1551-only",
  preserveAcceptedSceneNumbers: [1548, 1549, 1550],
  sceneNumbers: [scene],
  laterCountryStartAllowed: false,
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ status: checkpoint.status, promptAudit }, null, 2));
