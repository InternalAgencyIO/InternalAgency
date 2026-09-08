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
  throw new Error("Authoritative contract changed before round 13 materialization");
}
if (sha256File(ledgerPath) !== "B94AA3FB2B1AB1BCAB100CE689F0173C77407B82439D73379D8BC0FA3EEC2455") {
  throw new Error("X publishing ledger changed before round 13 materialization");
}

const plan = checkpoint.scenePlans[String(scene)];
const basePrompt = plan.freshRound9?.prompt;
if (!basePrompt) throw new Error(`Scene ${scene} has no stored authoritative prompt`);

const editDirective = `Use case: precise-object-edit.
Input image dimensions: 940 by 1672 pixels. Preserve the exact supplied Batumi image pixel-for-pixel except for the existing white paper target and its black route diamond. Preserve all four adult identities and faces, heavy rain, Batumi skyline, four distinct outfits, Radiance's sole opaque rainbow knee socks and open back, Ellie's visible midriff, Alia's strapless opaque front, visible midriff and open back, the controlled dip, sustained Radiance-ECE eye line, PAWS and MAX, separate blue route map, compass table, inert pistol, complete sand backstop, transparent safety panels, and exactly eight currently visible traceable human hands.

ROUND 13 FRESH EDIT: REPLACE ONLY THE PAPER TARGET
Delete only the current too-large white paper square and its black diamond from the sand backstop. In its place mount one smaller but plainly visible white paper square exactly 40 by 40 image pixels, centered at image coordinate x=918, y=603, with one centered black non-humanoid route diamond. Keep the whole replacement inside the frame: left edge x=898, right edge x=938, top edge y=583, bottom edge y=623. The exact diamond center at y=603 must be on the exact same horizontal pixel row as the unchanged orange muzzle-plug center at y=603. The unchanged orange muzzle tip ends near x=877, so the replacement paper begins at x=898 and leaves at least 20 visible pixels of clean empty air between muzzle and paper. Do not move, tilt, rotate, resize, redraw, or alter Alia, either hand, either arm, the inert pistol, the orange muzzle plug, the backstop, the safety panels, or any other image element. Keep the pistol perfectly horizontal. No beam, line, tracer, cord, string, dashed path, glow trail, or trajectory mark.

Do not change the hand map: Ellie has two support palms on Radiance; Radiance has one palm on Ellie's shoulder and one hand resting on ECE's left fist; ECE has one fist on each compass handle; Alia has exactly two mission hands. Exactly eight arms and eight hands, two per woman. Preserve Alia's straight trigger index outside the guard. The 40-pixel replacement paper target is the sole permitted change.`;

const prompt = `${editDirective}\n\nAUTHORITATIVE STORED SCENE SPECIFICATION\n${basePrompt.replaceAll("fresh round 9", "fresh round 13")}`;
const promptPath = path.join(root, `scene-${scene}-fresh-round-13-prompt.txt`);
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
  storedRollsChanged: false,
  freshRound: 13,
  referenceGuidedEdit: true,
  solePermittedChange: "replace existing paper target with a smaller coordinate-locked paper target",
  measuredSourceGeometry: {
    canvas: { width: 940, height: 1672 },
    muzzlePlugCenter: { x: 872, y: 603 },
    muzzleTipMaxX: 877,
    existingDiamondCenterApprox: { x: 885, y: 669 },
  },
  replacementTargetGeometry: {
    center: { x: 918, y: 603 },
    bounds: { left: 898, right: 938, top: 583, bottom: 623 },
    cleanAirGapPixels: 21,
  },
};
plan.freshRound13 = { ...promptAudit, prompt };

const preparedAt = new Date().toISOString();
checkpoint.status = "active-four-scene-gate-fresh-round-13-materialized";
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
    viewsAtAudit: 38,
  },
  latestVisibleAccountStatuses: [
    { url: "https://x.com/dogramaci/status/2087193408670412911", attachments: 1, seriesCaptionPresent: false },
    { url: "https://x.com/dogramaci/status/2087193349614649405", attachments: 1, seriesCaptionPresent: false },
    { url: "https://x.com/dogramaci/status/2087193317226266640", attachments: 1, seriesCaptionPresent: false },
  ],
  reconciliationDecision: "No eligible unposted World Series item. The three newer captionless single-image account posts are unrelated and remain outside the series ledger; do not duplicate Honduras.",
};
checkpoint.xPost.status = "blocked-active-country-incomplete-not-skipped";
checkpoint.xPost.url = null;
checkpoint.xPost.acceptedCurrentCountryAssets = 3;
checkpoint.nextQueueStatus = "locked-on-Georgia-until-four-accepted-git-pushed-and-X-live-verified";
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "launch-fresh-round-13-missing-scene-only",
  preserveAcceptedSceneNumbers: [1548, 1549, 1550],
  sceneNumbers: [scene],
  laterCountryStartAllowed: false,
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ status: checkpoint.status, promptAudit }, null, 2));
