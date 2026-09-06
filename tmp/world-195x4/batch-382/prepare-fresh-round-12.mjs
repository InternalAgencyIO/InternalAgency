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
const sourcePath = "tmp/world-195x4/batch-382/raw/fresh-round-11-recovery/scene-1551.png";

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").toUpperCase();
}

if (sha256File(contractPath) !== "F7B247DF3BCE256C2A0BB2B51EB282EC4E6FBC5FE8E85A17970F311F26138FEC") {
  throw new Error("Authoritative contract changed before round 12 materialization");
}
if (sha256File(ledgerPath) !== "B94AA3FB2B1AB1BCAB100CE689F0173C77407B82439D73379D8BC0FA3EEC2455") {
  throw new Error("X publishing ledger changed before round 12 materialization");
}

const plan = checkpoint.scenePlans[String(scene)];
const basePrompt = plan.freshRound9?.prompt;
if (!basePrompt) throw new Error(`Scene ${scene} has no stored authoritative prompt`);

const editDirective = `Use case: precise-object-edit.
Input image: preserve the exact supplied Batumi image pixel-for-pixel except for the white paper target. Preserve all four adult identities and faces, the heavy rain, Batumi skyline, four distinct outfits, Radiance's sole opaque rainbow knee socks and open back, Ellie's visible midriff, Alia's strapless opaque front, visible midriff and open back, the controlled dip, sustained Radiance-ECE eye line, PAWS and MAX, separate blue route map, compass table, inert pistol, complete sand backstop, and all exactly eight currently visible traceable human hands.

ROUND 12 FRESH EDIT: ONE LOCAL CORRECTION ONLY
Move only the complete white paper square and its black route diamond straight DOWN by approximately 24 image pixels, keeping its current size and orientation, until the exact center of the black diamond is on the exact same horizontal pixel row as the center of the orange muzzle plug. In the supplied source, the diamond center is visibly above the orange muzzle center; it must move downward, never upward. Do not move, tilt, rotate, resize, redraw, or alter Alia, either hand, either arm, the inert pistol, the orange muzzle plug, the backstop, the safety panels, or any other pixel. Keep the pistol perfectly horizontal. Preserve a clean empty air gap with no beam, line, tracer, cord, string, dashed path, glow trail, or trajectory mark.

Do not change the hand map: Ellie has two support palms on Radiance; Radiance has one palm on Ellie's shoulder and one hand resting on ECE's left fist; ECE has one fist on each compass handle; Alia has exactly two mission hands. Exactly eight arms and eight hands, two per woman. Preserve Alia's straight trigger index outside the guard. The target-axis correction is the sole permitted change.`;

const prompt = `${editDirective}\n\nAUTHORITATIVE STORED SCENE SPECIFICATION\n${basePrompt.replaceAll("fresh round 9", "fresh round 12")}`;
const promptPath = path.join(root, `scene-${scene}-fresh-round-12-prompt.txt`);
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
  referenceGuidedEdit: true,
  targetCorrections: ["move only the complete paper target downward by approximately 24 pixels onto the unchanged muzzle centerline"],
  solePermittedChange: "paper-target vertical position",
};
plan.freshRound12 = { ...promptAudit, prompt };

const preparedAt = new Date().toISOString();
checkpoint.status = "active-four-scene-gate-fresh-round-12-materialized";
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
  },
  latestVisibleAccountStatus: {
    url: "https://x.com/dogramaci/status/2087184306862985484",
    attachments: 1,
    seriesCaptionPresent: false,
    classification: "unrelated-account-post-not-a-World-Series-ledger-item",
  },
  reconciliationDecision: "No eligible unposted World Series item; do not duplicate Honduras or absorb the unrelated one-image account post into the series ledger.",
};
checkpoint.xPost.status = "blocked-active-country-incomplete-not-skipped";
checkpoint.xPost.url = null;
checkpoint.xPost.acceptedCurrentCountryAssets = 3;
checkpoint.nextQueueStatus = "locked-on-Georgia-until-four-accepted-git-pushed-and-X-live-verified";
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "launch-fresh-round-12-missing-scene-only",
  preserveAcceptedSceneNumbers: [1548, 1549, 1550],
  sceneNumbers: [scene],
  laterCountryStartAllowed: false,
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ status: checkpoint.status, promptAudit }, null, 2));
