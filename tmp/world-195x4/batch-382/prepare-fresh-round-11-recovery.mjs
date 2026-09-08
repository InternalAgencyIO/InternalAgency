import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const root = path.join(repo, "tmp/world-195x4/batch-382");
const checkpointPath = path.join(repo, "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json");
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
const scenes = [1548, 1551];
const sourcePaths = {
  1548: "tmp/world-195x4/batch-382/raw/fresh-round-11/scene-1548.png",
  1551: "tmp/world-195x4/batch-382/raw/fresh-round-11/scene-1551.png",
};

function sha256File(relativePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(path.join(repo, relativePath))).digest("hex").toUpperCase();
}

const freshAudit = {
  1548: {
    rawOutput: sourcePaths[1548],
    sourceRawOutput: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-c954af90-f202-4c29-9a6a-4ddcfb6de0c2.png",
    sha256: sha256File(sourcePaths[1548]),
    dimensions: { width: 941, height: 1672 },
    decisiveRejectionReasons: [
      "The fresh edit preserves Tbilisi, hail, MAX, four adult identities, distinct couture, Alia and Ellie's midriff bands, clean target geometry with no tracer, route map, and safe ECE stance.",
      "The high and low clasps are clear, but the sole middle contact reads as Radiance touching Alia while Alia's second hand and forearm to Radiance remain hidden, leaving seven unambiguous hands.",
      "Radiance's active restrained visible-midriff band is absent because her blue jacket meets the bronze skirt.",
    ],
  },
  1551: {
    rawOutput: sourcePaths[1551],
    sourceRawOutput: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-5384dbc9-2143-43eb-8c79-5d77e8a95c30.png",
    sha256: sha256File(sourcePaths[1551]),
    dimensions: { width: 941, height: 1672 },
    decisiveRejectionReasons: [
      "The fresh edit preserves Batumi, rain, PAWS and MAX, four identities, four distinct outfits, Radiance's hosiery and open back, Alia's strapless opaque front and open back, the route map, compass, safe mission stance, and exactly eight traceable hands.",
      "Alia's active restrained bare midriff band remains absent because the copper bodice still meets the copper waistband.",
      "The paper diamond center sits about one paper-height below the horizontal orange muzzle-plug center rather than on the same row.",
    ],
  },
};

const recoveryDirectives = {
  1548: `Use case: precise-object-edit.
Input image: preserve this exact Tbilisi frame and every passed element, including all faces, positions, landmarks, hail, MAX, route map, safe ECE stance, inert pistol, orange water disk, complete backstop, no trajectory line, the raised Radiance-Ellie clasp, the low Alia-Ellie clasp, and Alia and Ellie's visible midriff bands.

ROUND 11 RECOVERY: THREE LOCAL CORRECTIONS ONLY
1. Move Radiance's existing lower blue-sleeved hand upward from Alia's waist to Alia's outer shoulder cap. Keep its entire blue-sleeved forearm and palm visible.
2. Reveal Alia's currently hidden LEFT arm without adding a limb. Show one continuous dark-brown upper arm and forearm curving behind Radiance, ending in Alia's complete left palm visibly wrapped around the camera-facing side of Radiance's bronze-skirt waist. Keep Alia's right hand in the low clasp with Ellie.
3. Shorten only Radiance's blue jacket hem upward by three centimeters to reveal one unmistakable restrained horizontal bare-midriff band above her bronze skirt. Keep full opaque bust and side coverage.

Exact final hands: Radiance has the raised Ellie clasp and one palm on Alia's shoulder; Alia has the low Ellie clasp and one palm around Radiance's waist; Ellie has one hand in each clasp; ECE has two mission hands. Exactly eight arms and eight hands, two per woman. No extra, fused, duplicated, hanging, cropped, missing, or ambiguous hand. Preserve Alia's and Ellie's midriff bands and change nothing else.`,
  1551: `Use case: precise-object-edit.
Input image: preserve this exact Batumi frame and every passed element, especially four identities, rain, skyline, distinct couture, Radiance hosiery and open back, Alia strapless opaque front and open back, the controlled dip, PAWS and MAX, separate route map, compass, complete backstop, safe two-hand mission stance, indexed trigger finger, and the exact existing eight-hand ownership map.

ROUND 11 RECOVERY: TWO LOCAL CORRECTIONS ONLY
1. Move the white paper target UP by approximately one full paper height so that the center of the black diamond lands on the exact same horizontal pixel row as the center of the orange muzzle plug. Do not move, tilt, rotate, resize, or alter Alia or the pistol. Preserve a clean empty air gap and no visible line, beam, tracer, cord, or trajectory mark.
2. Create an unmistakable three-centimeter horizontal band of bare dark-brown midriff skin around Alia by raising the lower hem of the opaque copper bodice slightly and lowering the copper skirt waistband slightly. The skin band must visibly separate bodice from waistband. Preserve complete opaque sternum, bust, side-bust, hip, and seat coverage and the fully open back.

Do not change any hand, arm, face, body, mascot, prop, map, compass, romance contact, outfit fingerprint, landmark, or crop. Exactly eight traceable arms and eight traceable hands remain.`,
};

const promptAudit = {};
for (const scene of scenes) {
  const plan = checkpoint.scenePlans[String(scene)];
  const basePrompt = plan.freshRound9?.prompt;
  if (!basePrompt) throw new Error(`Missing authoritative stored prompt for scene ${scene}`);
  const prompt = `${recoveryDirectives[scene]}\n\nAUTHORITATIVE STORED SCENE SPECIFICATION\n${basePrompt.replaceAll("fresh round 9", "fresh round 11 recovery")}`;
  const promptPath = path.join(root, `scene-${scene}-fresh-round-11-recovery-prompt.txt`);
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
    round: 11,
    phase: "recovery",
    referenceGuidedEdit: true,
  };
  plan.freshRound11Recovery = { ...promptAudit[scene], prompt };
}

const preparedAt = new Date().toISOString();
checkpoint.status = "active-four-scene-gate-fresh-round-11-recovery-materialized";
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
  ...checkpoint.renderAttempts.freshRound11,
  status: "fresh-rejected-recovery-materialized",
  freshCompletedAt: preparedAt,
  freshPerScene: Object.fromEntries(Object.entries(freshAudit).map(([scene, value]) => [scene, { status: "rejected-strict-visual-audit", ...value }])),
  recovery: {
    status: "materialized-pending-launch",
    preparedAt,
    sceneNumbers: scenes,
    maximumPassesThisRound: 1,
    promptAudit,
  },
};
checkpoint.rawOutputs = [
  ...checkpoint.rawOutputs.filter((item) => !(item.round === 11 && item.kind === "fresh-rejected")),
  ...Object.entries(freshAudit).map(([scene, value]) => ({
    scene: Number(scene), round: 11, kind: "fresh-rejected", path: value.rawOutput,
    sourcePath: value.sourceRawOutput, sha256: value.sha256, dimensions: value.dimensions,
  })),
];
checkpoint.rejectedAssets = [
  ...checkpoint.rejectedAssets.filter((item) => !(item.round === 11 && item.phase === "fresh")),
  ...Object.entries(freshAudit).map(([scene, value]) => ({
    scene: Number(scene), round: 11, phase: "fresh", status: "rejected-strict-visual-audit", ...value,
  })),
];
checkpoint.xPost.status = "blocked-active-country-incomplete-not-skipped";
checkpoint.xPost.url = null;
checkpoint.xPost.acceptedCurrentCountryAssets = 2;
checkpoint.nextWakeAction = {
  country: "Georgia", batch: 382, action: "launch-fresh-round-11-recovery-missing-scenes-only",
  preserveAcceptedSceneNumbers: [1549, 1550], sceneNumbers: scenes, laterCountryStartAllowed: false,
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ status: checkpoint.status, promptAudit }, null, 2));
