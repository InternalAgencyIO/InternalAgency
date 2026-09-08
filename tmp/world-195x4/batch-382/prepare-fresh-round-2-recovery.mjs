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
    path: "tmp/world-195x4/batch-382/raw/fresh-round-2/scene-1548.png",
    sourcePath: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-0ef54294-9f03-4c20-9fc1-4dc9ede16552.png",
    sha256: "D170A454C6FB18FC03C39E47FD5A4DBC176B041BDEB6E21AF85AD707A13CE4C3",
    dimensions: { width: 941, height: 1672 },
    decisiveRejectionReasons: [
      "The left trio reads as a static clustered lineup instead of the mandatory moving slow-dance chain.",
      "At least one dance arm and hand is obscured rather than continuously traceable, so the exact eight-arm and eight-hand gate is not met.",
    ],
  },
  1549: {
    path: "tmp/world-195x4/batch-382/raw/fresh-round-2/scene-1549.png",
    sourcePath: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-8b166cb8-93c2-4a8a-b5e2-3c138d862466.png",
    sha256: "E4E09F76961F7C6070C16B2233205871FE16FD66C145E62D52C2A956AB27029E",
    dimensions: { width: 941, height: 1672 },
    decisiveRejectionReasons: [
      "Radiance's second arm and shoulder-contact hand are not visible, so the exact eight-arm and eight-hand gate is not met.",
      "Ellie's and ECE's active fully-open-back rolls are not visibly materialized in the camera angle.",
    ],
  },
  1550: {
    path: "tmp/world-195x4/batch-382/raw/fresh-round-2/scene-1550.png",
    sourcePath: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-554bdd65-2ac0-4190-9ac0-7ef009fba059.png",
    sha256: "77404BB4C3AD399C9D0BE2A2BDDF74E22D532DB44C4F35AAA26FA059FDEC11AA",
    dimensions: { width: 941, height: 1672 },
    decisiveRejectionReasons: [
      "The active inflatable geometric weather-balloon pack is reduced to one rigid geometric orb instead of a visibly inflatable secured pack.",
      "At least one non-prop hand is obscured rather than continuously traceable, so the exact ten-arm and ten-hand gate is not met.",
    ],
  },
  1551: {
    path: "tmp/world-195x4/batch-382/raw/fresh-round-2/scene-1551.png",
    sourcePath: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-c5b2655c-99e7-4d9f-a6e9-32f2b19c8428.png",
    sha256: "ABF0914034EDC205818CA8E59C3629EF02572483B3249A7F67FFFA0C3729359A",
    dimensions: { width: 941, height: 1672 },
    decisiveRejectionReasons: [
      "Alia's active strapless roll is not materialized because the copper bodice visibly retains a shoulder strap.",
      "Ellie's upper-back support hand is partially obscured and not continuously traceable through the controlled dip.",
    ],
  },
};

const correction = {
  1548: "TARGETED RECOVERY, FRESH ROUND 2. Preserve every setting, identity, wardrobe roll, weather roll, mascot roll, target, and safety rule from the base prompt. Correct only the failed pose and anatomy: arrange Ellie, Radiance, and Alia as an open triangular slow-dance chain with visible air gaps between all three torsos, bent knees, turning hems, and unmistakable movement, never a lineup. Fan all six dance arms outward so every shoulder, elbow, wrist, and hand is visible against open background. Ellie visibly places one hand at Radiance's waist and one at Alia's shoulder. Radiance visibly places one hand at Ellie's shoulder and one linked with Alia. Alia visibly uses one linked hand and one hand at Ellie's waist. ECE's two prop hands remain spatially separate at far right. Exactly eight visible arms and eight visible hands.",
  1549: "TARGETED RECOVERY, FRESH ROUND 2. Preserve every setting, identity, wardrobe roll, weather roll, empty-mascot roll, target, and safety rule from the base prompt. Correct only the failed anatomy and active back rolls: open the dip into a wide diagonal with visible air gaps. Radiance's two complete arms must both be visible, with one hand holding Ellie's free hand and the other clearly placed at Ellie's shoulder. Rotate dipped Ellie to a face-visible three-quarter rear view so her active open-back panel from shoulder blades to high waist is unmistakable while front and sides remain opaque. Rotate ECE to a face-visible three-quarter rear stance so ECE's active open-back panel is unmistakable while both arms and both prop hands remain fully visible and the muzzle stays rightward at the isolated paper target. Exactly eight visible arms and eight visible hands.",
  1550: "TARGETED RECOVERY, FRESH ROUND 2. Preserve every setting, identity, wardrobe roll, aurora, no-mascot roll, lap-sitting beat, male drama, target, and safety rule from the base prompt. Correct only the failed odd prop and anatomy: Radiance holds a clearly inflatable weather-balloon pack made of three soft air-filled geometric balloons joined by short secured fabric tethers, visibly compressible and buoyant, not one rigid orb. Both of Radiance's hands visibly grip the pack. Space the five adults so every shoulder, elbow, wrist, and hand is fully visible against open background. Alia's shoulder hand and linked hand, Ellie's linked hand and sitter-shoulder hand, ECE's two prop hands, and the male's upper-arm and waist hands must each be visibly separate. Exactly ten visible arms and ten visible hands.",
  1551: "TARGETED RECOVERY, FRESH ROUND 2. Preserve every setting, identity, wardrobe roll, heavy rain, exact golden kitten plus golden puppy, rainbow hosiery, compass table, dip, target, and safety rule from the base prompt. Correct only Alia's neckline and dip anatomy: Alia wears a truly strapless secure opaque copper sculpted bodice with a high straight neckline, completely bare shoulders, and absolutely no shoulder strap, halter strap, sleeve, collar, or illusion mesh; keep her narrow midriff and open-back rolls. Open the dip slightly so Ellie's waist-support hand and upper-back-support hand are both fully visible against Radiance's blue fabric, with both complete arms traceable. Keep Radiance's two contact hands, ECE's two compass hands, and Alia's two prop hands visibly separate. Exactly eight visible arms and eight visible hands.",
};

const promptAudit = {};
for (const scene of [1548, 1549, 1550, 1551]) {
  const basePath = path.join(root, `scene-${scene}-fresh-round-2-prompt.txt`);
  const outputPath = path.join(root, `scene-${scene}-fresh-round-2-recovery-prompt.txt`);
  const base = fs.readFileSync(basePath, "utf8");
  const prompt = `${correction[scene]}\n\n${base}`;
  fs.writeFileSync(outputPath, prompt, "utf8");
  const sha256 = crypto.createHash("sha256").update(prompt).digest("hex").toUpperCase();
  const relativePath = path.relative(repo, outputPath).replaceAll("\\", "/");
  promptAudit[scene] = {
    path: relativePath,
    sha256,
    chars: prompt.length,
    storedRollsChanged: false,
    recoveryPass: 1,
    round: 2,
    corrections: rawAudit[scene].decisiveRejectionReasons,
  };
  checkpoint.scenePlans[String(scene)].freshRound2Recovery = {
    ...promptAudit[scene],
    prompt,
  };
}

const preparedAt = new Date().toISOString();
checkpoint.status = "active-four-scene-gate-fresh-round-2-recovery-materialized";
checkpoint.checkpointedAt = preparedAt;
checkpoint.countryCompletionGate = {
  ...checkpoint.countryCompletionGate,
  acceptedSceneCount: 0,
  missingSceneNumbers: [1548, 1549, 1550, 1551],
  gitCheckpointPushed: true,
  xPublicStatusVerified: false,
  queueAdvanceAllowed: false,
  gateSatisfied: false,
};
checkpoint.renderAttempts.freshRound2 = {
  ...checkpoint.renderAttempts.freshRound2,
  status: "raw-complete-zero-accepted-recovery-materialized",
  rawCompletedAt: preparedAt,
  rawPerScene: Object.fromEntries(
    Object.entries(rawAudit).map(([scene, value]) => [scene, {
      status: "rejected-strict-visual-audit",
      ...value,
    }]),
  ),
  acceptedRawSceneNumbers: [],
  rejectedRawSceneNumbers: [1548, 1549, 1550, 1551],
  recovery: {
    status: "materialized-pending-launch",
    preparedAt,
    sceneNumbers: [1548, 1549, 1550, 1551],
    concurrency: "four independent built-in image generation calls with all-settled result capture",
    promptAudit,
    storedRollsChanged: false,
  },
};

checkpoint.rawOutputs = [
  ...checkpoint.rawOutputs.filter((item) => item.round !== 2),
  ...Object.entries(rawAudit).map(([scene, value]) => ({
    scene: Number(scene),
    round: 2,
    kind: "fresh-raw-rejected",
    path: value.path,
    sourcePath: value.sourcePath,
    sha256: value.sha256,
    dimensions: value.dimensions,
  })),
];
checkpoint.rejectedAssets = [
  ...checkpoint.rejectedAssets.filter((item) => item.round !== 2),
  ...Object.entries(rawAudit).map(([scene, value]) => ({
    scene: Number(scene),
    round: 2,
    status: "rejected-strict-visual-audit",
    ...value,
  })),
];
checkpoint.acceptedAssets = [];
checkpoint.xPost.status = "blocked-active-country-incomplete-not-skipped";
checkpoint.xPost.url = null;
checkpoint.nextQueueStatus = "locked-on-Georgia-until-four-accepted-git-pushed-and-X-live-verified";
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "launch-fresh-round-2-recovery",
  sceneNumbers: [1548, 1549, 1550, 1551],
  laterCountryStartAllowed: false,
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify(promptAudit, null, 2));
