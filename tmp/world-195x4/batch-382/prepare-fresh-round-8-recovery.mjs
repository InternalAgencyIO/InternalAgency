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
const recoveryScenes = [1548, 1551];

const rawAudit = {
  1548: {
    status: "rejected-strict-visual-audit",
    path: "tmp/world-195x4/batch-382/raw/fresh-round-8/scene-1548.png",
    sourcePath: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-9f363fe2-9271-4164-9586-522a7f97c934.png",
    sha256: "41EC24CF2CEFE3799722BF621B2D5A4631E1B8FE37AE3662F60301A0A7D0D84E",
    dimensions: { width: 941, height: 1672 },
    decisiveRejectionReasons: [
      "The raw preserves unmistakable Tbilisi, hard hail, MAX, four distinct adult identities, three visible active midriff bands, four distinct country-led outfits, a separate route card, and the required orange Mtkvari disk.",
      "A hand at Radiance's waist has no unambiguous traceable arm while Alia's other hand is separately visible, so the required behind-waist embrace and exact eight-hand inventory fail.",
      "ECE remains outside the dance rather than visibly stepping through its open side, and her eye line does not perform the rolled jealous interruption.",
      "The orange disk is far below the horizontal muzzle axis, and the trigger index does not read unmistakably straight outside the guard.",
    ],
  },
  1550: {
    status: "accepted-strict-visual-audit",
    path: "tmp/world-195x4/batch-382/raw/fresh-round-8/scene-1550.png",
    sourcePath: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-dc0cf002-1c32-464e-8cc2-b0ebefe1dc96.png",
    sha256: "C22C196BDCE62ACFC1AC000DF6F4BF944B05320D3435462B4F2A4B1CA7014C48",
    dimensions: { width: 941, height: 1672 },
    acceptanceAudit: {
      coreCast: "Exactly five clearly adult fictional people appear: the four distinct anchored women plus the established bearded adult male; Alia alone has the sculptural braided updo.",
      anatomy: "Exactly ten traceable human arms and ten traceable human hands appear: Radiance owns both balloon handles, Alia and Ellie own the linked lap-choice contacts, ECE owns both mission hands, and the male owns his two separate ECE contacts.",
      activeRolls: "The aurora, Radiance's restrained midriff, Alia's strapless bare-shoulder construction, inactive hosiery, no mascots, and no pole or rainbow-only styling all resolve visibly.",
      romance: "Alia sits securely sideways across Radiance's lap while Ellie links the choice and ECE answers with a rival eye line; the male adds two contacts and directs his strongest sustained eye line to ECE.",
      missionProp: "ECE alone holds the full-size polished rainbow-gradient inert cinema-training replica with two hands and an indexed trigger finger; the orange disk lies on the near-horizontal continuation of the muzzle inside the tall transparent basin and complete backstop, with every person left of the muzzle plane.",
      themeLocation: "Sighnaghi's complete defensive wall, towers, vineyard grid, Caucasus horizon, aurora, and four structurally distinct Mars-expedition outfits remain large and recognizable together.",
      mascotsAndProps: "No mascot appears. Exactly three soft geometric spheres share one rigid bar, and Radiance alone owns its two separated handles.",
      decision: "Accepted with no hard-gate deviation.",
    },
  },
  1551: {
    status: "rejected-strict-visual-audit",
    path: "tmp/world-195x4/batch-382/raw/fresh-round-8/scene-1551.png",
    sourcePath: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-21779b9e-ed0f-4e1a-8e91-c379bfcdfa52.png",
    sha256: "8A5A0B99E3641A9B631B43A78C71E42F43277AA4218F8BAA95C7CCB558FC8D88",
    dimensions: { width: 941, height: 1672 },
    decisiveRejectionReasons: [
      "The raw preserves unmistakable Batumi, heavy rain, distinct PAWS and MAX, Radiance's sole rainbow hosiery and open back, the supported dip, ECE's compass, and excellent same-height paper-target alignment against a complete sand backstop.",
      "ECE visibly owns two compass hands plus an additional lower hand in the clasp while Radiance has only one traceable hand, so hand ownership is invalid despite eight total visible hands.",
      "Alia's bodice has shoulder straps and a back band, and her waist is covered, so her active strapless, fully-open-back, and visible-midriff rolls are not materialized.",
    ],
  },
};

const correction = {
  1548: `REFERENCE IMAGE ROLE: edit target. ONE ROUND 8 RECOVERY PASS. Preserve the exact Tbilisi landmarks, hail, MAX, all four faces and bodies, all four outfits and visible midriff bands, lighting, full framing, holographic route card, river, orange disk, and public-safe inert cinema-training pistol style. Change only the failed hand, interruption, and safety geometry. Remove the ambiguous waist hand. Rebuild the six dancer hands with clear owners: retain the raised Radiance-Ellie clasp and low Ellie-Alia clasp; place Alia's complete right palm on the camera-facing side of Radiance's waist with its forearm continuously visible from Alia's shoulder; place Radiance's complete left palm on Alia's outer shoulder with its forearm continuously visible from Radiance's shoulder. Move ECE one full step left into the open side beside Ellie, still rightmost, with a clear crossing stride and jealous eye line toward Radiance; keep both ECE hands exclusively on the pistol. Raise the orange floating disk to the exact horizontal continuation of the barrel and muzzle centers. Keep ECE's trigger index unmistakably straight along the colored frame above and outside the guard. Exactly four adults, eight arms, eight hands, four romance contacts, one puppy, one disk, one route card, and no added object or connector line.`,
  1551: `REFERENCE IMAGE ROLE: edit target. ONE ROUND 8 RECOVERY PASS. Preserve the exact Batumi landmarks, heavy rain, PAWS and MAX, all four faces and bodies, Radiance's rainbow hosiery and fully open cobalt back, Ellie's two support palms, the dip, ECE's compass, Alia's two-hand pistol, indexed trigger finger, horizontal paper diamond, complete sand backstop, lighting, and full framing. Correct only hand ownership and Alia's three active garment rolls. Remove ECE's extra lower clasp hand; ECE must have exactly two hands, one visibly gripping each compass handle. Move Radiance's existing reaching hand upward so its fingertips rest clearly on the back of ECE's left compass hand without touching the compass; ECE's left thumb catches those fingertips while the same hand keeps its handle grip. Add no ECE hand. Bring Radiance's other existing forearm into view and place her complete open palm on Ellie's outer shoulder. Exactly eight arms and eight hands remain continuously traceable: Ellie two support hands, Radiance two relationship hands, ECE two compass hands, Alia two mission hands. Replace Alia's straps and back band with a secure opaque strapless front construction: completely bare shoulders, no strap, sleeve, halter, collar, neckband, crossing strap, back band, fabric panel, or illusion mesh. Show Alia's fully open back from shoulder blades to a high secure waist and one restrained three-centimeter midriff band, with opaque front, side, hip, and seat coverage unchanged. Her braid stays swept away from the open back. Change nothing else.`,
};

const promptAudit = {};
for (const scene of recoveryScenes) {
  const plan = checkpoint.scenePlans[String(scene)];
  const base = plan.freshRound8?.prompt;
  if (!base) throw new Error(`Missing round 8 base prompt for scene ${scene}`);
  const prompt = `${correction[scene]}\n\n${base}`;
  const outputPath = path.join(root, `scene-${scene}-fresh-round-8-recovery-prompt.txt`);
  fs.writeFileSync(outputPath, prompt, "utf8");
  const sha256 = crypto.createHash("sha256").update(prompt).digest("hex").toUpperCase();
  const relativePath = path.relative(repo, outputPath).replaceAll("\\", "/");
  promptAudit[scene] = {
    path: relativePath,
    sha256,
    chars: prompt.length,
    storedRollsChanged: false,
    recoveryPass: 1,
    round: 8,
    corrections: rawAudit[scene].decisiveRejectionReasons,
  };
  plan.freshRound8Recovery = { ...promptAudit[scene], prompt };
}

const acceptedFile = "1550-georgia-sighnaghi-mars-surface-expedition-round-8.png";
const acceptedPath = path.join(repo, "assets/lore/starlight-era", acceptedFile);
if (!fs.existsSync(acceptedPath)) throw new Error(`Missing accepted asset ${acceptedPath}`);
const acceptedHash = crypto.createHash("sha256").update(fs.readFileSync(acceptedPath)).digest("hex").toUpperCase();
if (acceptedHash !== rawAudit[1550].sha256) throw new Error("Accepted scene 1550 copy hash mismatch");

const preparedAt = new Date().toISOString();
checkpoint.status = "active-four-scene-gate-fresh-round-8-recovery-materialized";
checkpoint.checkpointedAt = preparedAt;
checkpoint.terminal = false;
checkpoint.countryCompletionGate = {
  ...checkpoint.countryCompletionGate,
  acceptedSceneCount: 2,
  missingSceneNumbers: recoveryScenes,
  gitCheckpointPushed: true,
  xPublicStatusVerified: false,
  queueAdvanceAllowed: false,
  gateSatisfied: false,
};
checkpoint.renderAttempts.freshRound8 = {
  ...checkpoint.renderAttempts.freshRound8,
  status: "raw-complete-one-new-accepted-recovery-materialized",
  rawCompletedAt: preparedAt,
  rawPerScene: Object.fromEntries(Object.entries(rawAudit).map(([scene, value]) => [scene, value])),
  acceptedRawSceneNumbers: [1550],
  rejectedRawSceneNumbers: recoveryScenes,
  recovery: {
    status: "materialized-pending-launch",
    preparedAt,
    sceneNumbers: recoveryScenes,
    concurrency: "two independent reference-guided built-in image edits with all-settled result capture",
    promptAudit,
    storedRollsChanged: false,
  },
};
checkpoint.rawOutputs = [
  ...checkpoint.rawOutputs.filter((item) => item.round !== 8),
  ...Object.entries(rawAudit).map(([scene, value]) => ({
    scene: Number(scene),
    round: 8,
    kind: value.status.startsWith("accepted") ? "fresh-raw-accepted" : "fresh-raw-rejected",
    path: value.path,
    sourcePath: value.sourcePath,
    sha256: value.sha256,
    dimensions: value.dimensions,
  })),
];
checkpoint.rejectedAssets = [
  ...checkpoint.rejectedAssets.filter((item) => item.round !== 8),
  ...recoveryScenes.map((scene) => ({
    scene,
    round: 8,
    phase: "raw",
    status: rawAudit[scene].status,
    path: rawAudit[scene].path,
    sourcePath: rawAudit[scene].sourcePath,
    sha256: rawAudit[scene].sha256,
    dimensions: rawAudit[scene].dimensions,
    decisiveRejectionReasons: rawAudit[scene].decisiveRejectionReasons,
  })),
];
checkpoint.acceptedAssets = [
  ...checkpoint.acceptedAssets.filter((item) => item.scene !== 1550),
  {
    scene: 1550,
    file: acceptedFile,
    decision: "accepted-fresh-round-8",
    sourceRaw: rawAudit[1550].sourcePath,
    sha256: acceptedHash,
    dimensions: rawAudit[1550].dimensions,
    acceptedAt: preparedAt,
    audit: rawAudit[1550].acceptanceAudit,
  },
].sort((a, b) => a.scene - b.scene);
checkpoint.xPost.status = "blocked-active-country-incomplete-not-skipped";
checkpoint.xPost.url = null;
checkpoint.nextQueueStatus = "locked-on-Georgia-until-four-accepted-git-pushed-and-X-live-verified";
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "launch-fresh-round-8-recovery-missing-scenes-only",
  preserveAcceptedSceneNumbers: [1549, 1550],
  sceneNumbers: recoveryScenes,
  laterCountryStartAllowed: false,
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ accepted: [1550], recoveryScenes, promptAudit }, null, 2));
