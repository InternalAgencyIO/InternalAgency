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
const sourcePath = "tmp/world-195x4/batch-382/raw/fresh-round-14/scene-1551.png";
const qaPath = "tmp/world-195x4/batch-382/qa/fresh-round-14-scene-1551-target-crop.png";

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").toUpperCase();
}

if (sha256File(contractPath) !== "F7B247DF3BCE256C2A0BB2B51EB282EC4E6FBC5FE8E85A17970F311F26138FEC") {
  throw new Error("Authoritative contract changed before round 14 recovery materialization");
}
if (sha256File(ledgerPath) !== "B94AA3FB2B1AB1BCAB100CE689F0173C77407B82439D73379D8BC0FA3EEC2455") {
  throw new Error("X publishing ledger changed before round 14 recovery materialization");
}

const plan = checkpoint.scenePlans[String(scene)];
const basePrompt = plan.freshRound14?.prompt;
if (!basePrompt) throw new Error(`Scene ${scene} has no stored round 14 prompt`);

const recoveryDirective = `Use case: precise-pose-edit.
Input image dimensions: 940 by 1672 pixels. Preserve the supplied Batumi image pixel-for-pixel except for the position of Alia's two existing arms, two existing hands, and the inert rainbow pistol they already hold. The fresh round-fourteen image passes all other strict gates: four adult identities, Alia's braids, exactly eight traceable arms and hands, every rolled garment detail, heavy rain, Batumi landmarks, distinct Mars-expedition couture, controlled romance dip, PAWS and MAX, ECE's two-hand compass ownership, separate route map, one paper target, complete backstop, transparent safety panels, and indexed trigger safety.

ROUND 14 RECOVERY: FREEZE THE TARGET; MOVE ONLY ALIA'S EXISTING TWO-HAND STANCE
The existing single white paper square, black route diamond, four mounting dots, sand backstop, and every one of their pixels are correct and must remain absolutely unchanged. Do not add, remove, duplicate, move, resize, redraw, or alter the target or backstop.

Move Alia's two existing arms, two existing hands, and the already-held inert rainbow pistol together exactly 19 image pixels UP and exactly 30 image pixels LEFT from their positions in this supplied recovery source. Keep Alia's shoulders, torso, head, legs, garment, and body fixed; accomplish the small retraction through modestly more bent elbows. Keep the pistol perfectly horizontal. The current orange muzzle-plug center is approximately x=849, y=610 while the unchanged black diamond center is approximately x=872, y=591. The final orange muzzle-plug center must be approximately x=819, y=591, on the exact same horizontal pixel row as the unchanged diamond. The current muzzle tip near x=852 moves to about x=822, leaving at least 20 visible pixels of clean empty air before the unchanged paper begins near x=844.

Preserve exactly two Alia arms and exactly two Alia hands, continuously traceable from her fixed shoulders through modestly bent elbows to both hands on the one pistol grip. Preserve the realistic two-hand large-frame-pistol stance, straight wrists, slightly forward shoulders, short stockless pistol silhouette, orange muzzle plug, and Alia's trigger index straight and flat along the frame outside the guard. Do not create, remove, duplicate, merge, hide, crop, or alter any hand or finger cluster. Do not change any other adult, body, face, garment, romance contact, mascot, compass, route map, landmark, rain, safety panel, target, or crop. No beam, line, tracer, cord, string, dashed path, glow trail, or trajectory mark. This 19-pixel-up and 30-pixel-left move of Alia's existing two-hand stance is the sole permitted change.`;

const prompt = `${recoveryDirective}\n\nAUTHORITATIVE STORED ROUND-FOURTEEN SCENE SPECIFICATION\n${basePrompt}`;
const promptPath = path.join(root, `scene-${scene}-fresh-round-14-recovery-prompt.txt`);
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
  freshRound: 14,
  recoveryPass: 1,
  referenceGuidedEdit: true,
  solePermittedChange: "move Alia's existing two arms, two hands, and held pistol 19 pixels up and 30 pixels left",
  measuredSourceGeometry: {
    muzzlePlugCenterApprox: { x: 849, y: 610 },
    muzzleTipMaxXApprox: 852,
    frozenDiamondCenterApprox: { x: 872, y: 591 },
    frozenPaperLeftApprox: 844,
  },
  targetPoseGeometry: {
    muzzlePlugCenterApprox: { x: 819, y: 591 },
    muzzleTipMaxXApprox: 822,
    frozenDiamondCenterApprox: { x: 872, y: 591 },
    cleanAirGapPixelsApprox: 22,
  },
};
plan.freshRound14Recovery = { ...promptAudit, prompt };

const preparedAt = new Date().toISOString();
checkpoint.status = "active-four-scene-gate-fresh-round-14-recovery-materialized";
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
checkpoint.renderAttempts.freshRound14 = {
  ...checkpoint.renderAttempts.freshRound14,
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
      "orange muzzle center remains approximately 19 pixels below the frozen paper-diamond centerline",
      "orange muzzle tip still overlaps the frozen paper's left edge instead of leaving clean empty-air separation",
    ],
  },
};
checkpoint.renderAttempts.freshRound14Recovery = {
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
  action: "launch-fresh-round-14-single-allowed-recovery-scene-1551-only",
  preserveAcceptedSceneNumbers: [1548, 1549, 1550],
  sceneNumbers: [scene],
  laterCountryStartAllowed: false,
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ status: checkpoint.status, promptAudit }, null, 2));
