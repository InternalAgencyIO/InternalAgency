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
    path: "tmp/world-195x4/batch-382/raw/fresh-round-6/scene-1548.png",
    sourcePath: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-eeea27b5-4153-45b8-bc83-4910d1fcc7e2.png",
    sha256: "375AADC91CA950CB36C3151292DF76F79FA472FD72167FC991019FBCCE403F4E",
    dimensions: { width: 941, height: 1672 },
    decisiveRejectionReasons: [
      "The clean raw preserves recognizable Tbilisi, hard hail, MAX, four adult identities, distinct couture, the compact stockless pistol, a separate route map, and a visible empty Mtkvari disk with no rendered connector.",
      "Ellie's second hand and Alia's second hand are hidden in the clustered embrace, so only six of the required eight human hands are unambiguously visible and traceable.",
      "The three standing women read as a static close cluster while ECE remains isolated, so the rolled rotating slow-dance chain and fourth-adult step-through interruption are not visibly performed.",
    ],
  },
  1550: {
    path: "tmp/world-195x4/batch-382/raw/fresh-round-6/scene-1550.png",
    sourcePath: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-824f22d1-ba38-489b-87ce-797f722d060e.png",
    sha256: "591B96CFF99CB7C842E2A7F095B7B1B8A5126858FF80C5302979C8457CFF6073",
    dimensions: { width: 941, height: 1672 },
    decisiveRejectionReasons: [
      "The clean raw preserves recognizable Sighnaghi, the rare aurora, five adult identities, distinct couture, a clear sideways lap seat, linked affection, male-to-ECE contacts, exactly three balloons, and the isolated basin marker.",
      "Radiance grips only the left balloon-bar handle while her right hand rests on her lap, violating the rigid two-handle sole-ownership roll.",
      "ECE's required separate hands-free holographic route map is absent, so the route-strategist field is not materialized.",
    ],
  },
  1551: {
    path: "tmp/world-195x4/batch-382/raw/fresh-round-6/scene-1551.png",
    sourcePath: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-8f8d8ff5-e932-4f60-815e-930b47643dc9.png",
    sha256: "3B76F4926D445154B4FB91BF5888DD525D021247576C0F4F0E5328FBD66EE1FD",
    dimensions: { width: 941, height: 1672 },
    decisiveRejectionReasons: [
      "The clean raw preserves recognizable Batumi, heavy rain, PAWS and MAX, Radiance's sole rainbow hosiery, ECE's two-hand compass ownership, Alia's two-hand stockless pistol, the shallow dip, and aligned paper target with complete sand backstop.",
      "Ellie's upper support hand is fully hidden behind Radiance's torso, so only seven human hands are unambiguously visible and the required separated waist-and-upper-back support cannot pass the anatomy gate.",
      "Alia's trigger-indexing is visually ambiguous at the guard instead of unmistakably straight along the frame outside it.",
    ],
  },
};

const correction = {
  1548: `ROUND 6 RECOVERY, ONE PASS. Preserve unmistakable Tbilisi, hard hail, MAX, four distinct adult identities, four distinct couture fingerprints, the compact stockless rainbow-gradient inert pistol, the separate hands-free route map, and the orange Mtkvari target disk with no visual connector. Use a wide frontal three-quarter camera and stage the three-person slow-dance chain in one shallow foreground plane. Radiance stands front-left, Ellie front-center, and braided Alia rear-right. Show all six dance hands completely: Radiance's left hand and Ellie's right hand form a raised clasp at shoulder height; Ellie's left hand and Alia's right hand form a low clasp at hip height; Alia's left open palm lies visibly on the camera-facing side of Radiance's waist as the behind-waist embrace; Radiance's right open palm lies visibly on Alia's outer shoulder. Keep twenty centimeters of visual separation between every pair of hands. ECE advances dynamically through the open side between Ellie and Alia to interrupt the chain while owning only hands seven and eight on the pistol grip, aimed safely at the empty disk. Every wrist and fingertip stays inside frame and in front of clothing, never behind hair or a torso. Exactly eight visible human hands, four romance contacts, and a clear moving dance interruption.`,
  1550: `ROUND 6 RECOVERY, ONE PASS. Preserve unmistakable Sighnaghi, aurora, five adult identities, distinct couture, the clear sideways lap seat, linked affection, male drama, and transparent basin target with no beam. Correct only ownership and route strategy. Radiance sits upright at far left while Alia sits sideways across both of Radiance's thighs at ninety degrees. Exactly three soft geometric balloon spheres are rigidly mounted above one short horizontal carry-bar, with no stems, strings, or fourth sphere. The bar has two widely separated vertical grips. Radiance's left hand visibly closes around the left grip and her right hand visibly closes around the right grip; both complete hands remain shoulder-width apart and own nothing else. Alia places one visible palm on Radiance's shoulder and links her other visible hand with Ellie. Ellie links one hand with Alia and places her other visible palm on Alia's outer shoulder. ECE kneels separately at right with both complete hands only on the compact stockless pistol grip, aimed down toward the empty basin disk. Add one small separate hands-free blue holographic route map floating beside ECE's outer shoulder, touched by nobody. The male stands behind ECE with one visible palm on her shoulder cap and one visible palm on her outer upper arm, leaving both ECE forearms unobstructed and sustaining his strongest eye line to her. Exactly ten visible hands, three balloons, two Radiance bar grips, and no hidden or reassigned hand.`,
  1551: `ROUND 6 RECOVERY, ONE PASS. Preserve unmistakable Batumi, heavy rain, PAWS and MAX, Radiance's sole opaque rainbow socks and open blue back, ECE's two-hand compass, Alia's two-hand compact stockless pistol, the paper target and full sand backstop, and all couture. Rotate to a side-profile camera so Radiance's blue open back faces the lens during the shallow twenty-degree dip. Ellie stands behind the dipped Radiance relative to camera and supports her with two widely separated fully visible open palms on that camera-facing blue back: the lower palm at the near-side waist and the upper palm high between the shoulder blades, separated by at least twenty centimeters. Neither palm may disappear behind a torso. Radiance's left open palm lies visibly on Ellie's outer shoulder and her right open palm lies visibly on ECE's outer shoulder. ECE stays upright with one complete hand on each opposite side of the compass rim. Alia uses both visible hands only on the pistol grip; her index finger is unmistakably straight and flat along the colored frame above the trigger guard. Exactly eight visible hands and wrists, no overlap, no hidden support hand, and no finger inside the guard.`,
};

const promptAudit = {};
for (const scene of [1548, 1550, 1551]) {
  const plan = checkpoint.scenePlans[String(scene)];
  const base = plan.freshRound6?.prompt;
  if (!base) throw new Error(`Missing round 6 base prompt for scene ${scene}`);
  const prompt = `${correction[scene]}\n\n${base}`;
  const outputPath = path.join(root, `scene-${scene}-fresh-round-6-recovery-prompt.txt`);
  fs.writeFileSync(outputPath, prompt, "utf8");
  const sha256 = crypto.createHash("sha256").update(prompt).digest("hex").toUpperCase();
  const relativePath = path.relative(repo, outputPath).replaceAll("\\", "/");
  promptAudit[scene] = {
    path: relativePath,
    sha256,
    chars: prompt.length,
    storedRollsChanged: false,
    recoveryPass: 1,
    round: 6,
    corrections: rawAudit[scene].decisiveRejectionReasons,
  };
  plan.freshRound6Recovery = { ...promptAudit[scene], prompt };
}

const preparedAt = new Date().toISOString();
checkpoint.status = "active-four-scene-gate-fresh-round-6-recovery-materialized";
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
checkpoint.renderAttempts.freshRound6 = {
  ...checkpoint.renderAttempts.freshRound6,
  status: "raw-complete-zero-new-accepted-recovery-materialized",
  rawCompletedAt: preparedAt,
  rawPerScene: Object.fromEntries(Object.entries(rawAudit).map(([scene, value]) => [scene, {
    status: "rejected-strict-visual-audit",
    ...value,
  }])),
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
  ...checkpoint.rawOutputs.filter((item) => item.round !== 6),
  ...Object.entries(rawAudit).map(([scene, value]) => ({
    scene: Number(scene),
    round: 6,
    kind: "fresh-raw-rejected",
    path: value.path,
    sourcePath: value.sourcePath,
    sha256: value.sha256,
    dimensions: value.dimensions,
  })),
];
checkpoint.rejectedAssets = [
  ...checkpoint.rejectedAssets.filter((item) => item.round !== 6),
  ...Object.entries(rawAudit).map(([scene, value]) => ({
    scene: Number(scene),
    round: 6,
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
  action: "launch-fresh-round-6-recovery-missing-scenes-only",
  preserveAcceptedSceneNumbers: [1549],
  sceneNumbers: [1548, 1550, 1551],
  laterCountryStartAllowed: false,
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify(promptAudit, null, 2));
