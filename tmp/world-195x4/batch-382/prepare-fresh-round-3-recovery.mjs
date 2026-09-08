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

const rawAudit = {
  1548: {
    path: "tmp/world-195x4/batch-382/raw/fresh-round-3/scene-1548.png",
    sourcePath: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-5bd10008-4876-4696-9c09-dc8b9435c03a.png",
    sha256: "9862D59ABCA9EF391E393ACFCDF4A025B59F51B10BD0D819FF97BDD40D4D7D69",
    dimensions: { width: 941, height: 1672 },
    decisiveRejectionReasons: [
      "The Tbilisi location, hail, MAX-only state, four identities, and separated ECE prop hands are visible, but several hands in the three-woman dance chain remain hidden or owner-ambiguous instead of providing exactly eight traceable hands.",
      "The water basin and route marker sit well below the muzzle axis while the sand wall is offset beneath it, so the required uninterrupted muzzle-to-marker-to-backstop line is not materialized.",
    ],
  },
  1550: {
    path: "tmp/world-195x4/batch-382/raw/fresh-round-3/scene-1550.png",
    sourcePath: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-61a5fb58-461e-4acd-adfc-0e82d921808d.png",
    sha256: "3ADD3B00116B71CB9B7FBEE937483642D93B465ABD90B6E13051FFB5557D24E1",
    dimensions: { width: 941, height: 1672 },
    decisiveRejectionReasons: [
      "The Sighnaghi location, aurora, five adults, lap sitting, three soft balloons, and male-to-ECE waist contact are visible, but Ellie clasps her own hands while Alia concentrates both hands on Radiance, so the required Alia-Ellie linked choice and exact ten-hand graph are absent.",
      "The muzzle terminates at a floating holographic ring over an open water channel rather than a clearly empty route marker with a complete physical catch wall.",
    ],
  },
  1551: {
    path: "tmp/world-195x4/batch-382/raw/fresh-round-3/scene-1551.png",
    sourcePath: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-5d1372d9-aff3-4890-916b-42ea731fef5b.png",
    sha256: "3AAB2D1493A060344575D78D35447343EBE9AB0A0394E81DDED1B6B0AAE2718F",
    dimensions: { width: 941, height: 1672 },
    decisiveRejectionReasons: [
      "Batumi, heavy rain, the exact kitten-plus-puppy pair, rainbow socks, compass table, strapless open-back Alia, and the isolated paper target are all correctly visible.",
      "Ellie's waist-support hand is clear but her second hand is hidden behind Radiance instead of visibly spread on Radiance's upper back, leaving only seven continuously traceable hands and failing the exact hand graph.",
    ],
  },
};

const recoveryCorrection = {
  1548: `ROUND 3 RECOVERY, SINGLE DECISIVE PASS. Keep every stored roll and every successful visible element from the complete base prompt. Rebuild only the hand display and target lane. CAMERA-FACING DANCE DIAGRAM: arrange Radiance at left, Ellie in the center, and Alia at right in a shallow open triangle with forty centimeters of air between torsos. All three turn toward camera with knees bent and hems moving. Put every contact on a near-side surface, never behind a body. Display exactly six dance hands: (1) Ellie's left palm visibly on Radiance's near-side waist; (2) Ellie's right palm visibly on Alia's near-side shoulder; (3) Radiance's left palm visibly on Ellie's near-side shoulder; (4) Radiance's right hand visibly linked with (5) Alia's left hand at chest height in front of open background; (6) Alia's right palm visibly on Ellie's near-side waist. No hand may be hidden by fabric, torso, hair, or another arm. ECE at far right supplies hands (7) and (8), visibly separated on the inert replica. TARGET-LINE DIAGRAM: raise the transparent shallow blue basin on a secure pedestal to the exact height of ECE's horizontal muzzle. Put one empty floating paper route marker in the direct center of the muzzle axis and a thick sand catch wall immediately behind the basin at the same height. In side profile, show one straight uninterrupted line: orange safety plug, muzzle, floating marker, sand wall. The river remains behind the cast, never downrange.`,
  1550: `ROUND 3 RECOVERY, SINGLE DECISIVE PASS. Keep every stored roll and every successful visible element from the complete base prompt. Rebuild only the lap-choice hand display and physical target lane. LAP-CHOICE DIAGRAM: Radiance sits at far left with Alia securely sideways across her lap. Radiance's hands (1) and (2) both visibly hold the three soft geometric balloons low at her outer left side. Alia's hand (3) rests visibly on Radiance's near-side shoulder. Alia's hand (4) extends right and links visibly with Ellie's hand (5) against open sky. Ellie stands immediately right of the bench and uses her hand (6) visibly on Alia's outer shoulder; Ellie never clasps her own hands and never touches her own body. ECE stands at far right in profile, with hands (7) and (8) visibly separated on the inert replica. Offset the male half a step behind and camera-left of ECE so his hand (9) is plainly visible on ECE's upper arm and hand (10) is plainly visible on ECE's near-side waist. No hidden or extra hand. TARGET-LINE DIAGRAM: raise a transparent shallow blue basin on a secure pedestal to ECE's muzzle height. Center one empty floating paper route marker directly on the horizontal muzzle axis and place a thick sand catch wall immediately behind the basin. Show orange plug, muzzle, marker, and wall in one side-profile line. No holographic ring, open-air target, or open water channel downrange.`,
  1551: `ROUND 3 RECOVERY, SINGLE DECISIVE PASS. Keep every stored roll and every successful visible element from the complete base prompt. Correct only Ellie's missing upper-back hand. Rotate Radiance into a shallow three-quarter rear dip so the blue upper-back fabric faces the camera while her adult face remains visible in profile. Ellie stands camera-left of Radiance. Ellie's first hand is visibly spread on Radiance's near-side waist. Ellie's second hand is a fully visible open palm spread flat across the center of Radiance's blue upper back, surrounded by blue fabric and never hidden behind Radiance. Radiance keeps one visible hand on Ellie's near-side shoulder and one visible hand on ECE's near-side shoulder. ECE keeps two visibly separated hands on the compass table and no hand on Radiance. Alia keeps two visibly separated hands on the inert replica. Count exactly eight hands and expose all eight wrists against contrasting background. Keep the kitten and puppy entirely on their lounge and preserve the side-on orange-plug-to-paper-target-to-sand-wall line.`,
};

const promptAudit = {};
for (const scene of [1548, 1550, 1551]) {
  const plan = checkpoint.scenePlans[String(scene)];
  const base = plan.freshRound3?.prompt;
  if (!base) {
    throw new Error(`Missing fresh round 3 prompt for scene ${scene}`);
  }
  const prompt = `${recoveryCorrection[scene]}\n\n${base}`;
  const outputPath = path.join(root, `scene-${scene}-fresh-round-3-recovery-prompt.txt`);
  fs.writeFileSync(outputPath, prompt, "utf8");
  const sha256 = crypto.createHash("sha256").update(prompt).digest("hex").toUpperCase();
  const relativePath = path.relative(repo, outputPath).replaceAll("\\", "/");
  promptAudit[scene] = {
    path: relativePath,
    sha256,
    chars: prompt.length,
    storedRollsChanged: false,
    recoveryPass: 1,
    round: 3,
    corrections: rawAudit[scene].decisiveRejectionReasons,
  };
  plan.freshRound3Recovery = { ...promptAudit[scene], prompt };
}

const preparedAt = new Date().toISOString();
checkpoint.status = "active-four-scene-gate-fresh-round-3-recovery-materialized";
checkpoint.checkpointedAt = preparedAt;
checkpoint.terminal = false;
checkpoint.countryCompletionGate = {
  ...checkpoint.countryCompletionGate,
  acceptedSceneCount: 1,
  missingSceneNumbers: [1548, 1550, 1551],
  gitCheckpointPushed: true,
  xPublicStatusVerified: false,
  queueAdvanceAllowed: false,
  gateSatisfied: false,
};
checkpoint.renderAttempts.freshRound3 = {
  ...checkpoint.renderAttempts.freshRound3,
  status: "raw-complete-zero-new-accepted-recovery-materialized",
  rawCompletedAt: preparedAt,
  rawPerScene: Object.fromEntries(
    Object.entries(rawAudit).map(([scene, value]) => [scene, {
      status: "rejected-strict-visual-audit",
      ...value,
    }]),
  ),
  acceptedRawSceneNumbers: [],
  rejectedRawSceneNumbers: [1548, 1550, 1551],
  recovery: {
    status: "materialized-pending-launch",
    preparedAt,
    sceneNumbers: [1548, 1550, 1551],
    concurrency: "three independent built-in image generation calls with all-settled result capture",
    promptAudit,
    storedRollsChanged: false,
  },
};
checkpoint.rawOutputs = [
  ...checkpoint.rawOutputs.filter((item) => item.round !== 3),
  ...Object.entries(rawAudit).map(([scene, value]) => ({
    scene: Number(scene),
    round: 3,
    kind: "fresh-raw-rejected",
    path: value.path,
    sourcePath: value.sourcePath,
    sha256: value.sha256,
    dimensions: value.dimensions,
  })),
];
checkpoint.rejectedAssets = [
  ...checkpoint.rejectedAssets.filter((item) => item.round !== 3),
  ...Object.entries(rawAudit).map(([scene, value]) => ({
    scene: Number(scene),
    round: 3,
    phase: "raw",
    status: "rejected-strict-visual-audit",
    ...value,
  })),
];
checkpoint.xPost.status = "blocked-active-country-incomplete-not-skipped";
checkpoint.xPost.url = null;
checkpoint.nextQueueStatus = "locked-on-Georgia-until-four-accepted-git-pushed-and-X-live-verified";
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "launch-fresh-round-3-recovery-missing-scenes-only",
  preserveAcceptedSceneNumbers: [1549],
  sceneNumbers: [1548, 1550, 1551],
  laterCountryStartAllowed: false,
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify(promptAudit, null, 2));
