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
    path: "tmp/world-195x4/batch-382/raw/fresh-round-5/scene-1548.png",
    sourcePath: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-6080c7cc-8e7c-49a3-8450-aadf4bb13c3e.png",
    sha256: "2CA2365C0D345E2491DEFEF7CAA1A74D97391478B47981132C3FF640FD809D37",
    dimensions: { width: 941, height: 1672 },
    decisiveRejectionReasons: [
      "The clean raw preserves recognizable Tbilisi, hard hail, MAX, four adult identities, distinct couture, a strong three-person romance read, the stockless pistol silhouette, and a visible empty Mtkvari disk.",
      "Radiance's free arm exits the left frame with its hand cropped, while the intended Radiance-to-Alia shoulder contact is missing and Alia's waist contact is reassigned to Ellie, so the exact six-hand dance inventory fails.",
      "The required separate hands-free holographic route map is absent.",
    ],
  },
  1550: {
    path: "tmp/world-195x4/batch-382/raw/fresh-round-5/scene-1550.png",
    sourcePath: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-913367bc-4fe6-46af-8e0f-df4dcd8e36ef.png",
    sha256: "836E6BD3FDA9BFE91D3C8276973C377A878AAB317CE340519686AB18179894EC",
    dimensions: { width: 941, height: 1672 },
    decisiveRejectionReasons: [
      "The clean raw preserves recognizable Sighnaghi, the rare aurora, five adult identities, distinct couture, male-to-ECE contacts, and the isolated transparent basin with empty marker.",
      "Alia sits beside Radiance rather than securely sideways across Radiance's lap, so the mandatory lap-sitting choice is not performed.",
      "Radiance owns the balloon pack with only one hand and more than three balloon cells appear, while ECE holds the mission pistol with one hand, so the exact odd-prop, mission-prop, and ten-hand inventories fail.",
    ],
  },
  1551: {
    path: "tmp/world-195x4/batch-382/raw/fresh-round-5/scene-1551.png",
    sourcePath: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-0dddf4ba-9116-4a76-9091-7fd7a35e6d1b.png",
    sha256: "7FB852B46FD1490B1ED934FE943D8EAE774C46A18D53609D5AE40CF0A9B69F7F",
    dimensions: { width: 941, height: 1672 },
    decisiveRejectionReasons: [
      "The clean raw preserves recognizable Batumi, heavy rain, PAWS and MAX, Radiance's sole rainbow hosiery, ECE's two-hand compass ownership, Alia's two-hand stockless pistol, and excellent horizontal paper-target alignment against the sand backstop.",
      "Both Ellie support palms settle around Radiance's waist instead of separating to waist and upper back, and Radiance's free hand hangs at her own thigh instead of contacting Ellie's shoulder, so the required supported-dip graph is incomplete.",
    ],
  },
};

const correction = {
  1548: `ROUND 5 RECOVERY, ONE PASS. Preserve recognizable Tbilisi, hard hail, MAX, four distinct identities, the strong romance, distinct couture, the compact stockless pistol, and the orange Mtkvari target disk. Pull the camera back ten percent and leave generous clear margins around every complete arm and hand. Correct only the six dance hands: Radiance and Ellie extend one complete linked pair toward the left inside margin; Ellie and Alia extend one complete linked pair toward the right inside margin; Alia's free palm wraps around but remains visibly flat on the front of Radiance's near-side waist; Radiance's free palm remains visibly flat on Alia's outer shoulder. No hand exits the frame, hides behind hair, or changes partner. ECE owns hands seven and eight only on the pistol grip. Preserve the clean muzzle-to-disk geometry with no beam. Add one small separate hands-free blue holographic route map floating beside ECE's shoulder without anyone touching it. Exactly eight visible hands and four dance contacts.`,
  1550: `ROUND 5 RECOVERY, ONE PASS. Preserve recognizable Sighnaghi, aurora, five adult identities, distinct couture, male drama, basin marker geometry, and all stored rolls. Correct the lap seat and exact hand ownership. Radiance sits upright at far left. Alia sits sideways across both of Radiance's thighs at a clear ninety-degree angle with no bench visible between their hips; both Alia feet stay planted. Show exactly three soft geometric balloons, no fourth balloon: Radiance splits their three stems into a one-stem bundle and a two-stem bundle and visibly holds one bundle in each complete hand outside the embrace. Alia uses one visible palm on Radiance's shoulder and links her other visible hand only with Ellie. Ellie kneels in front-right of Alia, links one visible hand only with Alia, and places her other visible palm on Alia's outer shoulder. ECE uses both complete hands only on the stockless pistol grip and angles it down toward the basin disk. The male keeps one visible palm on ECE's upper arm and one visible palm on ECE's near-side waist. Pull back enough to show exactly ten complete hands. No beam, fourth balloon, self-touch, hidden hand, or changed partner.`,
  1551: `ROUND 5 RECOVERY, ONE PASS. Preserve recognizable Batumi, heavy rain, PAWS and MAX, Radiance's sole rainbow socks and open back, ECE's two-hand compass ownership, Alia's two-hand stockless pistol, the perfectly horizontal paper target and sand backstop, couture, and every stored roll. Correct only the dip contacts. Ellie supports Radiance with two widely separated visible open palms: Ellie's lower palm on Radiance's near-side waist and Ellie's upper palm centered high on Radiance's blue upper back between the shoulder blades. Radiance's left palm must move from her own thigh onto Ellie's outer shoulder; Radiance's right palm stays on ECE's outer shoulder. ECE remains upright with one complete hand on each opposite side of the compass rim and touches nobody. Alia uses both visible hands only on the pistol grip. Pull back enough to show exactly eight complete hands and wrists, with no hand behind a torso or beneath the compass.`,
};

const promptAudit = {};
for (const scene of [1548, 1550, 1551]) {
  const plan = checkpoint.scenePlans[String(scene)];
  const base = plan.freshRound5?.prompt;
  if (!base) throw new Error(`Missing round 5 base prompt for scene ${scene}`);
  const prompt = `${correction[scene]}\n\n${base}`;
  const outputPath = path.join(root, `scene-${scene}-fresh-round-5-recovery-prompt.txt`);
  fs.writeFileSync(outputPath, prompt, "utf8");
  const sha256 = crypto.createHash("sha256").update(prompt).digest("hex").toUpperCase();
  const relativePath = path.relative(repo, outputPath).replaceAll("\\", "/");
  promptAudit[scene] = {
    path: relativePath,
    sha256,
    chars: prompt.length,
    storedRollsChanged: false,
    recoveryPass: 1,
    round: 5,
    corrections: rawAudit[scene].decisiveRejectionReasons,
  };
  plan.freshRound5Recovery = { ...promptAudit[scene], prompt };
}

const preparedAt = new Date().toISOString();
checkpoint.status = "active-four-scene-gate-fresh-round-5-recovery-materialized";
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
checkpoint.renderAttempts.freshRound5 = {
  ...checkpoint.renderAttempts.freshRound5,
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
  ...checkpoint.rawOutputs.filter((item) => item.round !== 5),
  ...Object.entries(rawAudit).map(([scene, value]) => ({
    scene: Number(scene),
    round: 5,
    kind: "fresh-raw-rejected",
    path: value.path,
    sourcePath: value.sourcePath,
    sha256: value.sha256,
    dimensions: value.dimensions,
  })),
];
checkpoint.rejectedAssets = [
  ...checkpoint.rejectedAssets.filter((item) => item.round !== 5),
  ...Object.entries(rawAudit).map(([scene, value]) => ({
    scene: Number(scene),
    round: 5,
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
  action: "launch-fresh-round-5-recovery-missing-scenes-only",
  preserveAcceptedSceneNumbers: [1549],
  sceneNumbers: [1548, 1550, 1551],
  laterCountryStartAllowed: false,
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify(promptAudit, null, 2));
