import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const root = path.join(repo, "tmp/world-195x4/batch-382");
const checkpointPath = path.join(
  repo,
  "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json",
);
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
const scenes = [1548, 1551];
const sourcePaths = {
  1548: "tmp/world-195x4/batch-382/raw/fresh-round-10/scene-1548.png",
  1551: "tmp/world-195x4/batch-382/raw/fresh-round-10/scene-1551.png",
};

function fileSha256(relativePath) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(path.join(repo, relativePath)))
    .digest("hex")
    .toUpperCase();
}

const freshAudit = {
  1548: {
    rawOutput: sourcePaths[1548],
    sourceRawOutput: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-7ef8f5fe-954b-448e-933c-2cbbdeed22fb.png",
    sha256: fileSha256(sourcePaths[1548]),
    dimensions: { width: 941, height: 1672 },
    decisiveRejectionReasons: [
      "The fresh edit preserves four adult identities, Tbilisi, hard hail, MAX, distinct couture, active midriffs, ECE's route map, safe prop stance, orange disk, complete backstop, and removes the forbidden visible trajectory connector.",
      "The low clasp remains owned by the wrong pair while the far-left braided Alia retains a free hanging hand, so the rolled Ellie-Alia link and complete three-person chain are not performed.",
      "The left trio's forearm paths remain too overlapped to prove exactly two unambiguous hands per dancer under the strict eight-hand ownership gate.",
    ],
  },
  1551: {
    rawOutput: sourcePaths[1551],
    sourceRawOutput: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-86ec4c45-2a17-43a1-834d-9fb08c91d91a.png",
    sha256: fileSha256(sourcePaths[1551]),
    dimensions: { width: 941, height: 1672 },
    decisiveRejectionReasons: [
      "The fresh edit preserves Batumi, heavy rain, PAWS and MAX, distinct outfits, Radiance hosiery and open back, Alia's strapless opaque front and open back, ECE's two compass hands, the separate route map, safe two-hand mission stance, and complete sand backstop.",
      "Ellie's two support palms are now clear, but Radiance still has only the long hand reaching ECE; her second hand and traceable forearm to Ellie's shoulder are missing, leaving seven unambiguous hands.",
      "Alia's active restrained bare midriff band is still absent.",
      "The paper diamond center now sits visibly below the horizontal barrel and muzzle centerline rather than on it.",
    ],
  },
};

const recoveryDirectives = {
  1548: `Use case: precise-object-edit.
Input image: preserve the exact supplied Tbilisi frame and every element that already passes, especially ECE, her two mission hands, indexed trigger finger, inert pistol, empty water disk, clear air gap with no trajectory line, complete transparent backstop, route map, MAX, hail, landmarks, couture, faces, and full 9:16 crop.

ROUND 10 RECOVERY: REPOSE ONLY THE LEFT THREE-WOMAN DANCE GROUP
Separate the three dancers enough that every complete forearm is visible. Place blonde Radiance at left, braided Black Alia at center, and brunette Ellie at right, all still beside ECE and inside one cohesive composition. Use exactly these six dancer hands and no others:
- Radiance right hand clasps Ellie's left hand once in the raised overhead link.
- Radiance left palm rests visibly on Alia's outer shoulder, with a bent blue-sleeved forearm fully traceable to Radiance.
- Alia right hand wraps visibly around Radiance's near waist.
- Alia left hand clasps Ellie's right hand once in a low link centered against Ellie's plain cobalt-blue trouser background.
- Ellie left hand belongs only to the raised Radiance clasp.
- Ellie right hand belongs only to the low Alia clasp.
No dancer hand hangs free. No pair repeats a clasp. Keep the raised and low clasps separated by open air. ECE retains exactly two hands on the inert prop. Final total: exactly eight human arms and exactly eight human hands, two per woman, all continuously traceable, with no fused, borrowed, duplicated, cropped, or hidden-owner cluster.

Preserve Radiance, Ellie, and Alia's separate three-centimeter midriff bands, Alia's only braided ponytail, all distinct outfits, the slow-dance interruption, and every passed safety detail. Change nothing outside the dance trio.`,
  1551: `Use case: precise-object-edit.
Input image: preserve the exact supplied Batumi frame and every element that already passes, including four adult identities, Ellie’s two visible support palms, Radiance’s long right arm and caught-hand contact with ECE, both ECE compass fists, both Alia mission hands, the separate blue route map, rain, skyline, PAWS and MAX, Radiance hosiery and open back, Alia strapless opaque front and open back, inert prop, and complete sand backstop.

ROUND 10 RECOVERY: THREE LOCAL CORRECTIONS ONLY
1. Reveal Radiance's currently hidden LEFT arm instead of adding a limb. Bend that existing left arm back toward far-left Ellie and place Radiance's complete left palm flat on Ellie's outer shoulder cap. Show the entire shoulder-to-elbow-to-wrist-to-palm path against open contrasting fabric. Preserve Radiance's right hand resting on ECE's already-visible left fist. Final hand inventory must be exactly: Ellie two support palms on Radiance; Radiance one palm on Ellie and one hand at ECE; ECE one fist on each compass handle; Alia two mission hands. Exactly eight arms and eight hands, two per woman, no extra finger cluster.
2. Lower only the top edge of Alia's blue-and-copper skirt by three centimeters to reveal one unmistakable restrained horizontal band of bare midriff skin between her opaque copper strapless bodice and skirt. Keep complete opaque sternum, bust, side-bust, hip, and seat coverage and the fully open back.
3. Move only the white paper target UP until the center of the black diamond is exactly level with the center of the horizontal barrel and orange-plugged muzzle. Preserve the clean empty air gap and complete backstop. Do not tilt or move Alia, the pistol, or any adult.

Preserve the indexed trigger finger outside the guard, route map, compass, controlled dip, sustained Radiance-ECE eye line, mascot play, all landmarks, and every other passed element.`,
};

const promptAudit = {};
for (const scene of scenes) {
  const plan = checkpoint.scenePlans[String(scene)];
  const basePrompt = plan.freshRound9?.prompt;
  if (!basePrompt) throw new Error(`Missing authoritative stored prompt for scene ${scene}`);
  const prompt = `${recoveryDirectives[scene]}\n\nAUTHORITATIVE STORED SCENE SPECIFICATION\n${basePrompt.replaceAll("fresh round 9", "fresh round 10 recovery")}`;
  const promptPath = path.join(root, `scene-${scene}-fresh-round-10-recovery-prompt.txt`);
  fs.writeFileSync(promptPath, prompt, "utf8");
  const required = [
    `Weather roll ${plan.weather.roll} = ${plan.weather.result}`,
    `Hard-love roll ${plan.hardLoveBeat.roll}: ${plan.hardLoveBeat.result}`,
    `Mascot roll ${plan.mascotState.roll}`,
    `Odd-prop roll ${plan.interestingProp.roll}`,
    `Pose-target roll ${plan.poseTargetRoll.roll}`,
    "exactly 8 human hands",
  ];
  for (const value of required) {
    if (!prompt.includes(value)) throw new Error(`Scene ${scene} missing materialized value: ${value}`);
  }
  promptAudit[scene] = {
    path: path.relative(repo, promptPath).replaceAll("\\", "/"),
    sha256: crypto.createHash("sha256").update(prompt).digest("hex").toUpperCase(),
    chars: prompt.length,
    sourceReference: sourcePaths[scene],
    sourceReferenceSha256: freshAudit[scene].sha256,
    storedRollsChanged: false,
    round: 10,
    phase: "recovery",
    referenceGuidedEdit: true,
  };
  plan.freshRound10Recovery = { ...promptAudit[scene], prompt };
}

const preparedAt = new Date().toISOString();
checkpoint.status = "active-four-scene-gate-fresh-round-10-recovery-materialized";
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
checkpoint.renderAttempts.freshRound10 = {
  ...checkpoint.renderAttempts.freshRound10,
  status: "fresh-rejected-recovery-materialized",
  freshCompletedAt: preparedAt,
  freshPerScene: Object.fromEntries(Object.entries(freshAudit).map(([scene, value]) => [scene, {
    status: "rejected-strict-visual-audit",
    ...value,
  }])),
  recovery: {
    status: "materialized-pending-launch",
    preparedAt,
    sceneNumbers: scenes,
    maximumPassesThisRound: 1,
    promptAudit,
  },
};
checkpoint.rawOutputs = [
  ...checkpoint.rawOutputs.filter((item) => !(item.round === 10 && item.kind === "fresh-rejected")),
  ...Object.entries(freshAudit).map(([scene, value]) => ({
    scene: Number(scene),
    round: 10,
    kind: "fresh-rejected",
    path: value.rawOutput,
    sourcePath: value.sourceRawOutput,
    sha256: value.sha256,
    dimensions: value.dimensions,
  })),
];
checkpoint.rejectedAssets = [
  ...checkpoint.rejectedAssets.filter((item) => !(item.round === 10 && item.phase === "fresh")),
  ...Object.entries(freshAudit).map(([scene, value]) => ({
    scene: Number(scene),
    round: 10,
    phase: "fresh",
    status: "rejected-strict-visual-audit",
    ...value,
  })),
];
checkpoint.xPost.status = "blocked-active-country-incomplete-not-skipped";
checkpoint.xPost.url = null;
checkpoint.xPost.acceptedCurrentCountryAssets = 2;
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "launch-fresh-round-10-recovery-missing-scenes-only",
  preserveAcceptedSceneNumbers: [1549, 1550],
  sceneNumbers: scenes,
  laterCountryStartAllowed: false,
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ status: checkpoint.status, promptAudit }, null, 2));
