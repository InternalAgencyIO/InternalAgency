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
    path: "tmp/world-195x4/batch-382/raw/fresh-round-4/scene-1548.png",
    sourcePath: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-d7aa1efe-c6a9-4301-b36c-9d507ffeb5a3.png",
    sha256: "75BFE1ADB2DE21CA37CC2A54171CFC02B48FA98AD0BB13CBB4171D3BC525F6F8",
    dimensions: { width: 941, height: 1672 },
    decisiveRejectionReasons: [
      "The clean raw preserves Tbilisi, hail, MAX, all four identities, distinct couture, the overhead Radiance-Alia dance link, and ECE's two-hand ownership.",
      "Ellie's two required outward contacts are hidden or reassigned, leaving the six dance hands owner-ambiguous rather than independently traceable.",
      "ECE holds the prop horizontally while the orange Mtkvari route disk remains far below the muzzle axis, so the stored water target is not the visible endpoint.",
    ],
  },
  1550: {
    path: "tmp/world-195x4/batch-382/raw/fresh-round-4/scene-1550.png",
    sourcePath: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-b336511d-a083-4a5d-9a14-1c88bcd56935.png",
    sha256: "6507BE2A7A4550AF289FBF6B2375C642DB8B15758CDA5EFF4A28D42E0CE9BB0B",
    dimensions: { width: 941, height: 1672 },
    decisiveRejectionReasons: [
      "The clean raw preserves Sighnaghi, aurora, five adults, Alia's secure seated relationship beat, the three balloon forms, male contacts, and a visibly aligned basin marker.",
      "Radiance holds the balloon pack with one hand, ECE uses one hand on the mission prop and links the other with Alia, and Ellie does not form the rolled link, so the exact ten-hand inventory fails.",
      "A bright emitted beam appears from the muzzle even though no beam or firing effect is permitted.",
    ],
  },
  1551: {
    path: "tmp/world-195x4/batch-382/raw/fresh-round-4/scene-1551.png",
    sourcePath: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-abcd5c18-6fff-4a92-9940-016ca9d0ec93.png",
    sha256: "D3A3541C818980B7E48B4BAD53D7B0FF38D26B33C9BD33988B58FCA7C03FE16E",
    dimensions: { width: 941, height: 1672 },
    decisiveRejectionReasons: [
      "The clean raw preserves Batumi, heavy rain, PAWS and MAX, rainbow socks, Alia's active cuts, a clear dip, and a correctly aligned paper target with sand backstop.",
      "ECE uses only one hand on the compass while leaning into an added kiss, and at least one Ellie support hand and one Radiance contact hand remain hidden, so the exact eight-hand graph fails.",
    ],
  },
};

const correction = {
  1548: `ROUND 4 RECOVERY, ONE PASS. Preserve the successful Georgia setting, hard hail, MAX, couture, overhead Radiance-Alia linked-hand arch, ECE identity, and all stored rolls. Correct only Ellie's hands and ECE's angle. Ellie stands slightly forward between Radiance and Alia and extends both complete arms outward like a wide letter T. Ellie's left open palm is fully visible on Radiance's exposed near-side waist. Ellie's right open palm is fully visible on Alia's exposed near-side shoulder. Ellie never touches her own body and neither Ellie hand is hidden. Radiance keeps one hand linked overhead with Alia and puts her other visible palm on Ellie's opposite shoulder. Alia keeps one hand in the overhead link and puts her other visible palm on Ellie's opposite near-side waist. ECE owns hands seven and eight on the inert prop. ECE's shoulders, both forearms, wrists, prop, and muzzle must visibly slope steeply down-right at 35 degrees toward the orange floating disk. The prop must not be horizontal. Place the disk immediately down-right of the muzzle in the water so it is obviously the endpoint. No beam, laser, wall target, basin, boat, person, animal, bank, or building downrange.`,
  1550: `ROUND 4 RECOVERY, ONE PASS. Preserve Sighnaghi, aurora, five adult identities, Alia securely sideways across Radiance's lap, the three soft geometric balloons, male drama, basin marker geometry, couture, and all stored rolls. Correct only hand ownership and remove the emitted beam. Radiance separates the three balloon stems into two visible bundles and holds one bundle in each hand, with both hands far left against open sky. Alia uses one visible palm on Radiance's shoulder and links her other visible hand only with Ellie. Ellie stands immediately beside Alia, links one visible hand only with Alia, and puts her other visible palm on Alia's outer shoulder. Keep a full arm's-width gap between Ellie and ECE so ECE cannot join that link. ECE uses both visible hands only on the inert prop, one above the other on the grip, and angles it down toward the orange disk. The male keeps one visible hand on ECE's upper arm and one visible hand on ECE's near-side waist. Exactly ten hands. No hand hangs idle, touches its owner, or changes partner. Show no laser, beam, light ray, glow ray, firing effect, ammunition, or magazine.`,
  1551: `ROUND 4 RECOVERY, ONE PASS. Preserve Batumi, heavy rain, PAWS and MAX, Radiance's rainbow socks and open back, Alia's strapless open-back midriff look, the correctly aligned paper target and sand backstop, couture, and all stored rolls. Correct only the romance and compass hands. Ellie supports Radiance with two separated visible open palms: one on the near-side waist and one centered on the blue upper back. Radiance keeps one visible hand on Ellie's outer shoulder and one visible hand on ECE's outer shoulder. ECE stands upright half a step right of Radiance and places both visible hands on opposite sides of the compass rim. ECE does not kiss, hug, touch, or lean into Ellie or Radiance; guilt and affection read only through eye line and face while Radiance supplies the single shoulder contact. Alia uses both visible hands only on the inert prop. Exactly eight hands and eight traceable wrists. No hand is behind a torso or beneath the compass.`,
};

const promptAudit = {};
for (const scene of [1548, 1550, 1551]) {
  const plan = checkpoint.scenePlans[String(scene)];
  const base = plan.freshRound4?.prompt;
  if (!base) throw new Error(`Missing round 4 base prompt for scene ${scene}`);
  const prompt = `${correction[scene]}\n\n${base}`;
  const outputPath = path.join(root, `scene-${scene}-fresh-round-4-recovery-prompt.txt`);
  fs.writeFileSync(outputPath, prompt, "utf8");
  const sha256 = crypto.createHash("sha256").update(prompt).digest("hex").toUpperCase();
  const relativePath = path.relative(repo, outputPath).replaceAll("\\", "/");
  promptAudit[scene] = {
    path: relativePath,
    sha256,
    chars: prompt.length,
    storedRollsChanged: false,
    recoveryPass: 1,
    round: 4,
    corrections: rawAudit[scene].decisiveRejectionReasons,
  };
  plan.freshRound4Recovery = { ...promptAudit[scene], prompt };
}

const preparedAt = new Date().toISOString();
checkpoint.status = "active-four-scene-gate-fresh-round-4-recovery-materialized";
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
checkpoint.renderAttempts.freshRound4 = {
  ...checkpoint.renderAttempts.freshRound4,
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
  ...checkpoint.rawOutputs.filter((item) => item.round !== 4),
  ...Object.entries(rawAudit).map(([scene, value]) => ({
    scene: Number(scene),
    round: 4,
    kind: "fresh-raw-rejected",
    path: value.path,
    sourcePath: value.sourcePath,
    sha256: value.sha256,
    dimensions: value.dimensions,
  })),
];
checkpoint.rejectedAssets = [
  ...checkpoint.rejectedAssets.filter((item) => item.round !== 4),
  ...Object.entries(rawAudit).map(([scene, value]) => ({
    scene: Number(scene),
    round: 4,
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
  action: "launch-fresh-round-4-recovery-missing-scenes-only",
  preserveAcceptedSceneNumbers: [1549],
  sceneNumbers: [1548, 1550, 1551],
  laterCountryStartAllowed: false,
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify(promptAudit, null, 2));
