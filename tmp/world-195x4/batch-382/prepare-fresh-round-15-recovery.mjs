import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const root = path.join(repo, "tmp/world-195x4/batch-382");
const checkpointPath = path.join(repo, "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json");
const contractPath = path.join(repo, "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const ledgerPath = path.join(repo, "assets/lore/starlight-era/world-x-publish-ledger.json");
const providerPath = "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-eca46f79-871c-4305-acfb-1354ba257d6c.png";
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
const scene = 1551;

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").toUpperCase();
}

if (sha256File(contractPath) !== "F7B247DF3BCE256C2A0BB2B51EB282EC4E6FBC5FE8E85A17970F311F26138FEC") {
  throw new Error("Authoritative contract changed before round 15 recovery materialization");
}
if (sha256File(ledgerPath) !== "B94AA3FB2B1AB1BCAB100CE689F0173C77407B82439D73379D8BC0FA3EEC2455") {
  throw new Error("X publishing ledger changed before round 15 recovery materialization");
}
if (!fs.existsSync(providerPath) || fs.statSync(providerPath).size !== 0) {
  throw new Error("Expected the documented zero-byte provider persistence failure");
}

const plan = checkpoint.scenePlans[String(scene)];
const basePrompt = plan.freshRound9?.prompt;
if (!basePrompt) throw new Error(`Scene ${scene} has no stored authoritative prompt`);

const recoveryDirective = `Use case: precise-pose-edit.
Edit the most recent generated Batumi image supplied in conversation. Preserve it pixel-for-pixel except for the position of Alia's two existing arms, two existing hands, and the inert rainbow pistol they already hold. The visible round-fifteen image passes every other strict gate: four adult identities, Alia's braids, exactly eight traceable arms and hands, every rolled garment detail, heavy rain, Batumi landmarks, four distinct Mars-expedition couture fingerprints, controlled romance dip, PAWS and MAX, ECE's two-hand compass ownership, separate holographic route map, exactly one paper target, complete sand backstop, transparent safety panels, clean muzzle-to-paper air, and indexed trigger safety.

ROUND 15 SINGLE RECOVERY: FREEZE THE TARGET AND LIFT ONLY ALIA'S EXISTING TWO-HAND STANCE
The single white paper square, black route diamond, four mounting dots, sand backstop, and every one of their pixels are correct. Keep their count, size, shape, texture, x position, y position, and pixels absolutely unchanged. Do not add, remove, duplicate, move, resize, redraw, or alter the target or backstop.

Move Alia's two existing arms, two existing hands, and their already-held inert rainbow pistol together exactly 15 image pixels UP and exactly 12 image pixels LEFT from the supplied generated image. Keep Alia's shoulders, torso, head, legs, garment, and body fixed; use modestly more bent elbows. Keep the short pistol perfectly horizontal. The current orange muzzle-plug center is approximately x=817, y=605 while the frozen black diamond center is approximately x=872, y=590. The final orange muzzle-plug center must be approximately x=805, y=590, on the exact same horizontal pixel row as the unchanged diamond. The current muzzle tip near x=827 moves to about x=815, leaving approximately 27 visible pixels of clean empty air before the unchanged paper begins near x=842.

Preserve exactly two Alia arms and exactly two Alia hands, continuously traceable from her fixed shoulders through modestly bent elbows to both hands on the one pistol grip. Preserve the realistic two-hand large-frame-pistol stance, straight wrists, slightly forward shoulders, short stockless pistol silhouette, orange muzzle plug, and Alia's trigger index straight and flat along the frame outside the guard. Do not create, remove, duplicate, merge, hide, crop, or alter any hand or finger cluster. Do not change any other adult, body, face, garment, romance contact, mascot, compass, route map, landmark, rain, safety panel, target, or crop. No beam, line, tracer, cord, string, dashed path, glow trail, or trajectory mark. This 15-pixel-up and 12-pixel-left move of Alia's existing two-hand stance is the sole permitted change.`;

const prompt = `${recoveryDirective}\n\nAUTHORITATIVE STORED SCENE SPECIFICATION\n${basePrompt.replaceAll("fresh round 9", "fresh round 15 recovery")}`;
const promptPath = path.join(root, `scene-${scene}-fresh-round-15-recovery-prompt.txt`);
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
  sourceReferenceMode: "most-recent-conversation-generated-image",
  providerOutputPath: providerPath,
  providerOutputBytes: 0,
  providerPersistenceStatus: "failed-zero-byte-file-after-render-was-visibly-returned",
  storedRollsChanged: false,
  freshRound: 15,
  recoveryPass: 1,
  referenceGuidedEdit: true,
  solePermittedChange: "move Alia's existing two arms, two hands, and held pistol 15 pixels up and 12 pixels left",
  measuredSourceGeometry: {
    muzzlePlugCenterApprox: { x: 817, y: 605 },
    muzzleTipMaxXApprox: 827,
    frozenDiamondCenterApprox: { x: 872, y: 590 },
    frozenPaperLeftApprox: 842,
    cleanAirGapPixelsApprox: 15,
  },
  targetPoseGeometry: {
    muzzlePlugCenterApprox: { x: 805, y: 590 },
    muzzleTipMaxXApprox: 815,
    frozenDiamondCenterApprox: { x: 872, y: 590 },
    cleanAirGapPixelsApprox: 27,
  },
};
plan.freshRound15Recovery = { ...promptAudit, prompt };

const preparedAt = new Date().toISOString();
checkpoint.status = "active-four-scene-gate-fresh-round-15-recovery-materialized";
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
  ...checkpoint.renderAttempts.freshRound15,
  status: "completed-rejected-target-axis-provider-save-failed",
  completedAt: preparedAt,
  rawOutputs: {
    [scene]: {
      providerPath,
      bytes: 0,
      sha256: null,
      preserved: false,
      persistenceFailure: "Built-in image tool visibly returned the rendered image, but its automatic local file remained zero bytes after repeated checks.",
    },
  },
  acceptedSceneNumbers: [],
  rejectedSceneNumbers: [scene],
  rejectionReasons: {
    [scene]: [
      "orange muzzle center remains approximately 15 pixels below the frozen paper-diamond centerline",
      "automatic provider save produced a zero-byte file, so the visible fresh output could not be archived locally",
    ],
  },
  strictAudit: {
    identity: "pass-four-adult-identities-with-Alia-braids",
    anatomy: "pass-exactly-eight-traceable-arms-and-eight-traceable-hands",
    weather: "pass-heavy-rain",
    locationThemeFusion: "pass-Batumi-and-Mars-expedition-couture",
    outfitOriginality: "pass-four-distinct-fingerprints",
    rolledWardrobe: "pass-Radiance-rainbow-hosiery-and-open-back-Ellie-midriff-Alia-strapless-midriff-open-back",
    romance: "pass-controlled-dip-and-required-contact-map",
    mascots: "pass-one-PAWS-and-one-MAX-safe-play",
    oddProp: "pass-ECE-compass-table",
    routeMap: "pass-separate-hands-free-holographic-map",
    missionHandling: "pass-two-hand-stance-indexed-trigger-single-target-and-complete-backstop",
    missionTargetAxis: "reject-diamond-center-approximately-15-pixels-above-muzzle-centerline",
    providerPersistence: "reject-zero-byte-local-output",
    accepted: false,
  },
};
checkpoint.renderAttempts.freshRound15Recovery = {
  status: "materialized-pending-launch",
  preparedAt,
  sceneNumbers: [scene],
  preservedAcceptedSceneNumbers: [1548, 1549, 1550],
  recoveryPass: 1,
  maximumRecoveryPassesPerBlockedScene: 1,
  sourceReferenceMode: "most-recent-conversation-generated-image",
  promptAudit: { [scene]: promptAudit },
  storedRollsChanged: false,
};
checkpoint.xBacklogAudit = {
  ...checkpoint.xBacklogAudit,
  checkedAt: preparedAt,
  eligibleBacklogRemaining: 0,
  pendingPost: null,
  preparedPostQueueCount: 0,
  reconciliationDecision: "No eligible unposted World Series item. Georgia remains X-blocked until the fourth current-country scene is accepted.",
};
checkpoint.xPost.status = "blocked-active-country-incomplete-not-skipped";
checkpoint.xPost.url = null;
checkpoint.xPost.acceptedCurrentCountryAssets = 3;
checkpoint.nextQueueStatus = "locked-on-Georgia-until-four-accepted-git-pushed-and-X-live-verified";
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "launch-fresh-round-15-single-allowed-recovery-scene-1551-only",
  preserveAcceptedSceneNumbers: [1548, 1549, 1550],
  sceneNumbers: [scene],
  laterCountryStartAllowed: false,
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ status: checkpoint.status, promptAudit }, null, 2));
