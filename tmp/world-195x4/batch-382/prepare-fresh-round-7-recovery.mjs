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
    path: "tmp/world-195x4/batch-382/raw/fresh-round-7/scene-1548.png",
    sourcePath: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-6ceb2f7d-da7d-4d1c-87af-12fe6324c2e4.png",
    sha256: "ADA6BB0F00140858910E8AADEDAAFD553D9D7CF6091454C0B5B748D17E2781DB",
    dimensions: { width: 941, height: 1672 },
    decisiveRejectionReasons: [
      "The clean raw preserves unmistakable Tbilisi, hard hail, MAX, four distinct adult identities, distinct country-led couture, ECE's two-hand compact pistol, a separate route card, and the empty orange Mtkvari disk with no rendered connector.",
      "Radiance's free shoulder-contact hand remains concealed while the other five dance hands are visible, so only seven of the required eight human hands are unambiguous.",
      "ECE remains isolated at far right instead of visibly stepping through the dance's open side, leaving the rolled interruption unperformed.",
      "The floating disk sits substantially below the pistol's horizontal muzzle axis instead of directly on it.",
    ],
  },
  1550: {
    path: "tmp/world-195x4/batch-382/raw/fresh-round-7/scene-1550.png",
    sourcePath: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-7f10c149-6b8c-4de5-acea-23f248a1d51f.png",
    sha256: "4F1D311130168D06165412E8A76ADCE58690810E6FB89D62B9FAEB4C0A74BC3E",
    dimensions: { width: 941, height: 1672 },
    decisiveRejectionReasons: [
      "The clean raw preserves unmistakable Sighnaghi, aurora, five adult identities, distinct couture, a clear sideways lap seat, linked affection, exactly three balloons, Radiance's two-handle ownership, ten traceable hands, two male contacts with his strongest eye line to ECE, ECE's two-hand pistol, the separate route card, and the empty basin disk.",
      "The pistol points laterally past the basin while the orange disk lies below-left of the muzzle, so the stored empty-water-marker target is not the visible endpoint of the sight picture.",
    ],
  },
  1551: {
    path: "tmp/world-195x4/batch-382/raw/fresh-round-7/scene-1551.png",
    sourcePath: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-6bf9a711-bd7e-4bcb-b8fb-264d49881f52.png",
    sha256: "1CD0D72E5F46D8BE730B1C48F8B11771B37CB8A68E48CDC0DECC2DE1F8FFFA2C",
    dimensions: { width: 941, height: 1672 },
    decisiveRejectionReasons: [
      "The clean raw preserves unmistakable Batumi, heavy rain, distinct PAWS and MAX, Radiance's sole rainbow hosiery and open back, four distinct outfits, the shallow romantic dip, ECE's two-hand compass, Alia's two-hand compact pistol with indexed trigger finger, and excellent same-height paper-target alignment against a complete sand backstop.",
      "Ellie's upper support hand is fully hidden behind Radiance while her lower waist hand is visible, so only seven human hands are unambiguous and the separated two-palm support inventory fails.",
    ],
  },
};

const correction = {
  1548: `REFERENCE-GUIDED EDIT OF THE PROVIDED ROUND 7 IMAGE, ONE RECOVERY PASS. Preserve the exact Tbilisi background, hail, MAX, faces, bodies, couture, lighting, color, framing, route card, and public-safe pistol style. Change only three failed geometries. First, bring Radiance's currently hidden free forearm into the foreground and place its complete open hand flat on braided Alia's outer shoulder; retain the existing raised Radiance-Ellie clasp, low Ellie-Alia clasp, and Alia waist palm, yielding exactly six visible dance hands and exactly eight human hands overall. Second, move ECE one full step left into the open gap beside Ellie with a clear crossing stride and jealous eye line toward Radiance while keeping ECE's two existing hands on the pistol. Third, rotate ECE's two forearms and pistol together down-right so the orange disk center lies exactly on the barrel centerline, with clean air and no rendered connector. Do not change any face, outfit, landmark, weather, mascot, map, target count, person count, limb count, or hand ownership.`,
  1550: `REFERENCE-GUIDED EDIT OF THE PROVIDED ROUND 7 IMAGE, ONE RECOVERY PASS. Preserve every person, face, pose, outfit, lap seat, relationship contact, all ten existing hands, exactly three balloons, both Radiance handle grips, both ECE pistol hands, male contacts and ECE eye line, Sighnaghi, aurora, route card, basin, lighting, and framing. Change only the safe target axis: rotate ECE's forearms and the compact stockless pistol together about twenty-five degrees down-right without changing either hand or finger, so the orange disk in the basin sits exactly on the visible continuation of the barrel centerline. Keep the indexed trigger finger straight along the frame, every other adult behind the muzzle plane, the complete basin and backstop visible, and no beam, line, flash, or trajectory mark. Do not move or duplicate any hand, person, balloon, map, disk, or relationship contact.`,
  1551: `REFERENCE-GUIDED EDIT OF THE PROVIDED ROUND 7 IMAGE, ONE RECOVERY PASS. Preserve the exact Batumi background, heavy rain, PAWS, MAX, all four faces and outfits, Radiance's sole rainbow socks and open blue back, the dip, Radiance's two existing shoulder contacts, ECE's two compass hands, Alia's two pistol hands and indexed finger, the perfectly aligned paper diamond and complete sand backstop, lighting, and framing. Change only Ellie's hidden upper support arm: bring that existing forearm around the camera-facing side and place its complete open palm high between Radiance's shoulder blades on the exposed blue back, at least twenty centimeters above Ellie's already-visible lower waist palm. Show the new upper hand, wrist, elbow, and continuous owner clearly without adding a limb. The result has exactly eight human arms and exactly eight visible human hands. Do not alter any other hand, target, mascot, prop, face, outfit, or landmark.`,
};

const promptAudit = {};
for (const scene of [1548, 1550, 1551]) {
  const plan = checkpoint.scenePlans[String(scene)];
  const base = plan.freshRound7?.prompt;
  if (!base) throw new Error(`Missing round 7 base prompt for scene ${scene}`);
  const prompt = `${correction[scene]}\n\n${base}`;
  const outputPath = path.join(root, `scene-${scene}-fresh-round-7-recovery-prompt.txt`);
  fs.writeFileSync(outputPath, prompt, "utf8");
  const sha256 = crypto.createHash("sha256").update(prompt).digest("hex").toUpperCase();
  const relativePath = path.relative(repo, outputPath).replaceAll("\\", "/");
  promptAudit[scene] = {
    path: relativePath,
    sha256,
    chars: prompt.length,
    storedRollsChanged: false,
    recoveryPass: 1,
    round: 7,
    corrections: rawAudit[scene].decisiveRejectionReasons,
  };
  plan.freshRound7Recovery = { ...promptAudit[scene], prompt };
}

const preparedAt = new Date().toISOString();
checkpoint.status = "active-four-scene-gate-fresh-round-7-recovery-materialized";
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
checkpoint.renderAttempts.freshRound7 = {
  ...checkpoint.renderAttempts.freshRound7,
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
    concurrency: "three independent reference-guided built-in image edits with all-settled result capture",
    promptAudit,
    storedRollsChanged: false,
  },
};
checkpoint.rawOutputs = [
  ...checkpoint.rawOutputs.filter((item) => item.round !== 7),
  ...Object.entries(rawAudit).map(([scene, value]) => ({
    scene: Number(scene),
    round: 7,
    kind: "fresh-raw-rejected",
    path: value.path,
    sourcePath: value.sourcePath,
    sha256: value.sha256,
    dimensions: value.dimensions,
  })),
];
checkpoint.rejectedAssets = [
  ...checkpoint.rejectedAssets.filter((item) => item.round !== 7),
  ...Object.entries(rawAudit).map(([scene, value]) => ({
    scene: Number(scene),
    round: 7,
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
  action: "launch-fresh-round-7-recovery-missing-scenes-only",
  preserveAcceptedSceneNumbers: [1549],
  sceneNumbers: [1548, 1550, 1551],
  laterCountryStartAllowed: false,
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify(promptAudit, null, 2));
