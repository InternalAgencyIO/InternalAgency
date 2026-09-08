import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const root = path.join(repo, "tmp/world-195x4/batch-382");
const checkpointPath = path.join(repo, "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json");
const contractPath = path.join(repo, "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const ledgerPath = path.join(repo, "assets/lore/starlight-era/world-x-publish-ledger.json");
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
const scenes = [1548, 1551];
const sourcePaths = {
  1548: "tmp/world-195x4/batch-382/raw/fresh-round-10-recovery/scene-1548.png",
  1551: "tmp/world-195x4/batch-382/raw/fresh-round-10-recovery/scene-1551.png",
};

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").toUpperCase();
}

if (sha256File(contractPath) !== "F7B247DF3BCE256C2A0BB2B51EB282EC4E6FBC5FE8E85A17970F311F26138FEC") {
  throw new Error("Authoritative contract changed before round 11 materialization");
}
if (sha256File(ledgerPath) !== "B94AA3FB2B1AB1BCAB100CE689F0173C77407B82439D73379D8BC0FA3EEC2455") {
  throw new Error("X publishing ledger changed before round 11 materialization");
}

const editDirectives = {
  1548: `Use case: precise-object-edit.
Input image: preserve the exact supplied Tbilisi frame, all four adult identities and faces, the current trio positions, hail, landmarks, couture, MAX, route map, ECE's lunge and two mission hands, indexed trigger finger, inert rainbow pistol, orange empty-water disk, clean air with no trajectory line, complete transparent backstop, full-body crop, and every currently visible hand.

ROUND 11 FRESH EDIT: TWO LOCAL CORRECTIONS ONLY
1. Reveal braided Alia's currently hidden LEFT arm instead of adding a limb. Route that existing left forearm behind blonde Radiance's waist and expose Alia's complete left palm wrapped around the camera-facing side of Radiance's waist above the skirt. Keep Alia's right hand in the existing low clasp with brunette Ellie. Keep Radiance's right hand in the raised clasp with Ellie and Radiance's left palm on Alia's outer upper shoulder. Keep Ellie's left hand in the raised clasp and Ellie's right hand in the low Alia clasp. Keep ECE's two hands on the inert prop. Final total must be exactly eight human arms and exactly eight human hands, two per woman, with every shoulder, elbow, wrist, palm, and finger cluster continuously traceable. No extra, fused, duplicated, hanging, borrowed, cropped, or hidden-owner hand.
2. Lower only the top edge of Alia's white-and-copper skirt by three centimeters to expose one unmistakable restrained horizontal band of bare midriff skin between her opaque teal bodice and skirt. Preserve complete opaque bust, side-bust, hip, and seat coverage. Preserve Radiance's and Ellie's separate existing restrained midriff bands.

Keep the raised Radiance-Ellie clasp, low Alia-Ellie clasp, Alia waist embrace, Radiance shoulder contact, and ECE interruption as the clear three-person slow-dance chain with four romance contacts. Change nothing else.`,
  1551: `Use case: precise-object-edit.
Input image: preserve the exact supplied Batumi frame, all four adult identities and faces, rain, skyline, four distinct outfits, Radiance's sole opaque rainbow knee socks and open back, Alia's strapless opaque front and open back, the controlled dip, sustained Radiance-ECE eye line, PAWS and MAX, separate blue route map, compass table, inert pistol, complete sand backstop, and all exactly eight currently visible traceable human hands.

ROUND 11 FRESH EDIT: TWO LOCAL CORRECTIONS ONLY
1. Move only the white paper target DOWN until the center of its black route diamond is exactly horizontally level with the center of the orange muzzle plug and barrel. The target currently sits above the muzzle axis. Do not move, tilt, rotate, resize, or alter Alia or the pistol. Preserve the clean empty air gap and complete backstop, with every person and mascot behind the muzzle plane. No visible beam, line, tracer, cord, or trajectory mark.
2. Lower only the top edge of Alia's blue-and-copper skirt by three centimeters to expose one unmistakable restrained horizontal band of bare midriff skin between her opaque copper strapless bodice and skirt. Preserve complete opaque sternum, bust, side-bust, hip, and seat coverage and her fully open back.

Do not change the hand map: Ellie has two support palms on Radiance; Radiance has one palm on Ellie's shoulder and one hand resting on ECE's left fist; ECE has one fist on each compass handle; Alia has exactly two mission hands. Exactly eight arms and eight hands, two per woman. Preserve the straight trigger index outside the guard and change nothing else.`,
};

const promptAudit = {};
for (const scene of scenes) {
  const plan = checkpoint.scenePlans[String(scene)];
  const basePrompt = plan.freshRound9?.prompt;
  if (!basePrompt) throw new Error(`Scene ${scene} has no stored authoritative prompt`);
  const prompt = `${editDirectives[scene]}\n\nAUTHORITATIVE STORED SCENE SPECIFICATION\n${basePrompt.replaceAll("fresh round 9", "fresh round 11")}`;
  const promptPath = path.join(root, `scene-${scene}-fresh-round-11-prompt.txt`);
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
  const sourcePath = path.join(repo, sourcePaths[scene]);
  promptAudit[scene] = {
    path: path.relative(repo, promptPath).replaceAll("\\", "/"),
    sha256: crypto.createHash("sha256").update(prompt).digest("hex").toUpperCase(),
    chars: prompt.length,
    sourceReference: sourcePaths[scene],
    sourceReferenceSha256: sha256File(sourcePath),
    storedRollsChanged: false,
    freshRound: 11,
    referenceGuidedEdit: true,
    targetCorrections: scene === 1548
      ? ["reveal Alia's existing waist-embrace hand for exactly eight traceable hands", "materialize Alia's restrained bare midriff band"]
      : ["move paper diamond down onto the existing horizontal muzzle axis", "materialize Alia's restrained bare midriff band"],
  };
  plan.freshRound11 = { ...promptAudit[scene], prompt };
}

const preparedAt = new Date().toISOString();
checkpoint.status = "active-four-scene-gate-fresh-round-11-materialized";
checkpoint.checkpointedAt = preparedAt;
checkpoint.terminal = false;
checkpoint.countryCompletionGate = {
  ...checkpoint.countryCompletionGate,
  acceptedSceneCount: 2,
  missingSceneNumbers: scenes,
  gitCheckpointPushed: true,
  xPublicStatusVerified: false,
  queueAdvanceAllowed: false,
  gateSatisfied: false,
};
checkpoint.renderAttempts.freshRound11 = {
  status: "materialized-pending-launch",
  preparedAt,
  sceneNumbers: scenes,
  preservedAcceptedSceneNumbers: [1549, 1550],
  concurrency: "two independent reference-guided built-in image edits with all-settled capture",
  maximumRecoveryPassesPerBlockedScene: 1,
  promptAudit,
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
    caption: "Honduras ❤️ Czechia #Honduras",
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
checkpoint.xPost.acceptedCurrentCountryAssets = 2;
checkpoint.nextQueueStatus = "locked-on-Georgia-until-four-accepted-git-pushed-and-X-live-verified";
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "launch-fresh-round-11-missing-scenes-only",
  preserveAcceptedSceneNumbers: [1549, 1550],
  sceneNumbers: scenes,
  laterCountryStartAllowed: false,
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ status: checkpoint.status, promptAudit }, null, 2));
