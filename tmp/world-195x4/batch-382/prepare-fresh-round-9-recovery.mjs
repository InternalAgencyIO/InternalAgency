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

const rawAudit = {
  1548: {
    path: "tmp/world-195x4/batch-382/raw/fresh-round-9/scene-1548.png",
    sourcePath: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-cd153a40-5b40-4471-b171-df3a65ac0ec0.png",
    sha256: "45DE9490A08D5BD55FED8EC2CEA487ECAD5A8FDC06B1973028B23B694B025B92",
    dimensions: { width: 941, height: 1672 },
    decisiveRejectionReasons: [
      "The raw preserves unmistakable Tbilisi, hard hail, MAX, four distinct adults, three active midriff bands, four distinct country-led outfits, a strong adult romance read, a separate route card, and ECE's two-hand inert cinema-training pistol.",
      "Alia has only one unambiguous visible hand and the required low Ellie-Alia clasp plus behind-waist embrace are absent, leaving seven traceable hands and an incomplete stored dance chain.",
      "The floating Mtkvari disk and complete backstop are entirely missing because the muzzle reaches the right frame edge, so the authoritative mission target is not materialized.",
      "ECE's trigger index does not read unmistakably straight outside the guard.",
    ],
  },
  1551: {
    path: "tmp/world-195x4/batch-382/raw/fresh-round-9/scene-1551.png",
    sourcePath: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-6aebcab2-5751-4659-a8d1-b641d8bd5709.png",
    sha256: "14CFCBC702619F123D36F22CDD04B3B1893CD54BEC835B7DD6DD6833FFFDB214",
    dimensions: { width: 941, height: 1672 },
    decisiveRejectionReasons: [
      "The raw preserves unmistakable Batumi, heavy rain, distinct PAWS and MAX, Radiance's sole rainbow hosiery and open back, distinct outfits, a strong dip, ECE's route display, and excellent paper-target alignment against the complete sand backstop.",
      "Radiance has only one unambiguous hand while ECE uses both hands on Radiance and no hand on the compass, leaving seven traceable hands and violating exact odd-prop ownership.",
      "Ellie does not provide the required two-palm dip support, so the stored four-adult hard-love contact graph is not performed.",
      "Alia retains shoulder straps and no restrained midriff band, so her active strapless and midriff rolls fail; her trigger index is curled into the guard.",
    ],
  },
};

const correction = {
  1548: `CLEAN CORRECTIVE RECOVERY RENDER, NOT AN EDIT. Keep every stored roll and all public-safe content below, but obey this screen-space blueprint before all prose. In the 9:16 frame, reserve x=0-52% for the three-person dance, x=52-72% for ECE's center-foreground crossing lunge, and x=72-100% for a completely empty mission lane. Put ECE's muzzle at x=72%, y=53%; the orange floating disk center at x=82%, y=57%; and the complete transparent water backstop at x=90%, y=57%. The muzzle must not touch the frame edge. The disk is one large obvious circle on the exact twenty-degree down-right continuation of the barrel centerline. Place Radiance at x=18%, Ellie at x=38%, braided Alia at x=28% rear, and ECE at x=60%. Render exactly eight hands with no hidden hand: Radiance right plus Ellie left raised clasp; Ellie right plus Alia left low clasp; Alia right visibly around Radiance's waist; Radiance left visibly on Alia's shoulder; ECE's two hands visibly on the pistol. Every hand has a complete visible forearm. ECE's straight trigger index lies above and outside the guard. ECE's lunge visibly crosses between Radiance and Ellie while all three dancers stay behind the muzzle plane. Do not omit the disk, backstop, low clasp, waist palm, shoulder palm, or any hand.`,
  1551: `CLEAN CORRECTIVE RECOVERY RENDER, NOT AN EDIT. Keep every stored roll and all public-safe content below, but obey this screen-space blueprint before all prose. Use a wide rear-three-quarter 9:16 frame: Ellie x=12%, dipped Radiance x=35%, ECE x=58%, braided Alia x=78%, paper target x=92%. Put the oversized compass on a waist-high pedestal directly in front of ECE at x=58%, with one left handle and one right handle. Render exactly eight hands and no others: Ellie's two open palms visibly support Radiance's open back at upper back and waist; Radiance's left palm is visibly on Ellie's shoulder; Radiance's right fingertips rest visibly on top of ECE's left compass fist; ECE's left fist stays on the left compass handle and catches those fingertips with its thumb; ECE's right fist stays on the right compass handle; Alia's two hands stay on the pistol. Every wrist and forearm is fully traceable. Alia's trigger index is one straight finger flat above and outside the guard. Alia wears a secure high-cut opaque copper strapless front with rigid opaque side-bust panels, no shoulder strap, halter, neckband, back band, exposed breast, side breast, nipple, under-bust, or cleavage. Show Alia's completely open back and a separate restrained three-centimeter midriff band without reducing opaque front, side, hip, or seat coverage. Show Radiance's fully open back, Ellie and Alia midriff bands, Radiance's sole opaque rainbow knee socks, both safe mascots, the complete sand backstop, and the paper diamond.`,
};

const promptAudit = {};
for (const scene of scenes) {
  const plan = checkpoint.scenePlans[String(scene)];
  const base = plan.freshRound9?.prompt;
  if (!base) throw new Error(`Missing round 9 base prompt for scene ${scene}`);
  const prompt = `${correction[scene]}\n\n${base}`;
  const outputPath = path.join(root, `scene-${scene}-fresh-round-9-recovery-prompt.txt`);
  fs.writeFileSync(outputPath, prompt, "utf8");
  const sha256 = crypto.createHash("sha256").update(prompt).digest("hex").toUpperCase();
  const relativePath = path.relative(repo, outputPath).replaceAll("\\", "/");
  promptAudit[scene] = {
    path: relativePath,
    sha256,
    chars: prompt.length,
    storedRollsChanged: false,
    recoveryPass: 1,
    round: 9,
    recoveryMode: "clean-corrective-rerender",
    corrections: rawAudit[scene].decisiveRejectionReasons,
  };
  plan.freshRound9Recovery = { ...promptAudit[scene], prompt };
}

const preparedAt = new Date().toISOString();
checkpoint.status = "active-four-scene-gate-fresh-round-9-recovery-materialized";
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
checkpoint.renderAttempts.freshRound9 = {
  ...checkpoint.renderAttempts.freshRound9,
  status: "raw-complete-zero-new-accepted-recovery-materialized",
  rawCompletedAt: preparedAt,
  rawPerScene: Object.fromEntries(Object.entries(rawAudit).map(([scene, value]) => [scene, {
    status: "rejected-strict-visual-audit",
    ...value,
  }])),
  acceptedRawSceneNumbers: [],
  rejectedRawSceneNumbers: scenes,
  recovery: {
    status: "materialized-pending-launch",
    preparedAt,
    sceneNumbers: scenes,
    concurrency: "two independent clean corrective built-in image generations with all-settled result capture",
    promptAudit,
    storedRollsChanged: false,
  },
};
checkpoint.rawOutputs = [
  ...checkpoint.rawOutputs.filter((item) => item.round !== 9),
  ...Object.entries(rawAudit).map(([scene, value]) => ({
    scene: Number(scene),
    round: 9,
    kind: "fresh-raw-rejected",
    path: value.path,
    sourcePath: value.sourcePath,
    sha256: value.sha256,
    dimensions: value.dimensions,
  })),
];
checkpoint.rejectedAssets = [
  ...checkpoint.rejectedAssets.filter((item) => item.round !== 9),
  ...Object.entries(rawAudit).map(([scene, value]) => ({
    scene: Number(scene),
    round: 9,
    phase: "raw",
    status: "rejected-strict-visual-audit",
    ...value,
  })),
];
checkpoint.xPost.status = "blocked-active-country-incomplete-not-skipped";
checkpoint.xPost.url = null;
checkpoint.xPost.acceptedCurrentCountryAssets = 2;
checkpoint.nextQueueStatus = "locked-on-Georgia-until-four-accepted-git-pushed-and-X-live-verified";
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "launch-fresh-round-9-recovery-missing-scenes-only",
  preserveAcceptedSceneNumbers: [1549, 1550],
  sceneNumbers: scenes,
  laterCountryStartAllowed: false,
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify(promptAudit, null, 2));
