import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const root = path.join(repo, "tmp/world-195x4/batch-382");
const checkpointPath = path.join(
  repo,
  "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json",
);
const contractPath = path.join(
  repo,
  "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json",
);
const ledgerPath = path.join(
  repo,
  "assets/lore/starlight-era/world-x-publish-ledger.json",
);

const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
const scenes = [1548, 1551];
const sourcePaths = {
  1548: "tmp/world-195x4/batch-382/raw/fresh-round-9-recovery/scene-1548.png",
  1551: "tmp/world-195x4/batch-382/raw/fresh-round-9-recovery/scene-1551.png",
};

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").toUpperCase();
}

const expectedContractSha256 = "F7B247DF3BCE256C2A0BB2B51EB282EC4E6FBC5FE8E85A17970F311F26138FEC";
const expectedLedgerSha256 = "B94AA3FB2B1AB1BCAB100CE689F0173C77407B82439D73379D8BC0FA3EEC2455";
if (sha256File(contractPath) !== expectedContractSha256) {
  throw new Error("Authoritative contract changed before round 10 materialization");
}
if (sha256File(ledgerPath) !== expectedLedgerSha256) {
  throw new Error("X publishing ledger changed before round 10 materialization");
}

const editDirectives = {
  1548: `Use case: precise-object-edit.
Input image: preserve this exact accepted-near-pass Georgia/Tbilisi frame, its four adult identities, faces, body proportions, camera, crop, hail, lighting, landmarks, couture, MAX, route map, orange water disk, complete transparent backstop, ECE's lunge, indexed trigger finger, and all eight existing human hands.

ROUND 10 SURGICAL CHANGES ONLY
1. Remove the thin pink trajectory connector between the muzzle and orange disk completely. Replace it with ordinary unobstructed river air and water. There must be no beam, ray, tracer, laser, glow trail, string, cord, painted line, dotted line, dashed line, or visible connection of any color. Keep the orange disk, pistol, muzzle angle, transparent backstop, and empty downrange lane in their same positions.
2. Correct only the low dance clasp. The brunette woman Ellie and the far-left braided Black woman Alia must clasp one existing hand each in one unmistakable low hand-to-hand link against the cobalt-blue trouser background. Continuous forearms must trace that clasp to Ellie and Alia. Do not let blonde Radiance own either hand in this low clasp. Preserve the separate raised Radiance-Ellie clasp, Alia's other hand around Radiance's waist, and Radiance's other hand on Alia's outer shoulder.

Exact final hand inventory: Radiance has two hands, one in the raised clasp with Ellie and one on Alia's outer shoulder. Ellie has two hands, one in the raised clasp with Radiance and one in the low clasp with Alia. Alia has two hands, one in the low clasp with Ellie and one around Radiance's waist. ECE has exactly two hands on the inert prop. Exactly eight human arms and eight human hands total. No hand is added, removed, hidden, fused, borrowed, duplicated, or ambiguously owned. Change nothing else.`,
  1551: `Use case: precise-object-edit.
Input image: preserve this exact accepted-near-pass Georgia/Batumi frame, its four adult identities, faces, body proportions, camera, crop, rain, skyline, couture, rainbow hosiery, compass table, PAWS and MAX play beat, inert pistol, sand backstop, and public-safe styling.

ROUND 10 SURGICAL CHANGES ONLY
1. Make Ellie's two support hands unambiguous: far-left brunette Ellie has one open palm high between Radiance's shoulder blades and a second open palm at Radiance's near waist. Show both complete forearms.
2. Make Radiance's two hands unambiguous: dipped blonde Radiance has one complete palm on Ellie's outer shoulder and the fingertips of her other complete hand resting on top of ECE's already-visible left fist. Radiance does not grip the compass.
3. Preserve ECE's exactly two fists, one around each compass handle. Preserve Alia's exactly two hands on the inert pistol grip. Final total is exactly eight human arms and eight human hands, two per woman, with every wrist and forearm traceable to one owner. Add no other hand or finger cluster.
4. Add one small separate hands-free blue holographic route map floating beside ECE's outer shoulder, clearly distinct from the physical compass and touched by nobody.
5. Tailor one restrained three-centimeter bare midriff band around Alia between her opaque copper strapless bodice and skirt. Preserve complete opaque front, side-bust, hip, and seat coverage and the existing fully open back.
6. Lower only the white paper target or its black diamond so the diamond center sits exactly on the horizontal barrel and muzzle centerline. Keep the complete sand backstop, clean empty air gap, and every person and mascot behind the muzzle plane.

Preserve the straight trigger index outside the guard, both active open backs, Radiance's sole opaque rainbow knee socks, four distinct outfits, the controlled dip and jealous invitation, all Georgia landmarks, mascots, and safe footing. Change nothing else.`,
};

const promptAudit = {};
for (const scene of scenes) {
  const plan = checkpoint.scenePlans[String(scene)];
  const basePrompt = plan.freshRound9?.prompt;
  if (!basePrompt) throw new Error(`Scene ${scene} has no stored round 9 prompt`);
  const prompt = `${editDirectives[scene]}\n\nAUTHORITATIVE STORED SCENE SPECIFICATION\n${basePrompt.replaceAll("fresh round 9", "fresh round 10")}`;
  const promptPath = path.join(root, `scene-${scene}-fresh-round-10-prompt.txt`);
  fs.writeFileSync(promptPath, prompt, "utf8");
  const relativePromptPath = path.relative(repo, promptPath).replaceAll("\\", "/");
  const sourcePath = path.join(repo, sourcePaths[scene]);
  const required = [
    `Weather roll ${plan.weather.roll} = ${plan.weather.result}`,
    `Hard-love roll ${plan.hardLoveBeat.roll}: ${plan.hardLoveBeat.result}`,
    `Romance roll ${plan.romanceBeat.roll}: ${plan.romanceBeat.contractResult}`,
    `Compound-love roll ${plan.compoundLoveBeat.roll}: ${plan.compoundLoveBeat.contractResult}`,
    `Pose-target roll ${plan.poseTargetRoll.roll}`,
    `Mascot roll ${plan.mascotState.roll}`,
    `Odd-prop roll ${plan.interestingProp.roll}`,
    `exactly 8 human hands`,
  ];
  for (const value of required) {
    if (!prompt.includes(value)) throw new Error(`Scene ${scene} is missing materialized field: ${value}`);
  }
  for (const character of Object.values(plan.characters)) {
    const emotion = character.emotion.materializedResult ?? character.emotion.result;
    if (!prompt.includes(`emotion roll ${character.emotion.roll} = ${emotion}`)) {
      throw new Error(`Scene ${scene} is missing an emotion materialization`);
    }
  }
  promptAudit[scene] = {
    path: relativePromptPath,
    sha256: crypto.createHash("sha256").update(prompt).digest("hex").toUpperCase(),
    chars: prompt.length,
    sourceReference: sourcePaths[scene],
    sourceReferenceSha256: sha256File(sourcePath),
    storedRollsChanged: false,
    freshRound: 10,
    referenceGuidedEdit: true,
    targetCorrections: scene === 1548
      ? [
          "remove forbidden visible trajectory connector while preserving target geometry",
          "rewire low clasp to Ellie-Alia while preserving the other six hand assignments",
          "preserve all eight traceable hands and every passed visual element",
        ]
      : [
          "expose Ellie's two support hands and Radiance's two romance hands",
          "preserve both ECE compass hands and both Alia mission hands for exactly eight total",
          "add a separate hands-free holographic route map",
          "materialize Alia's restrained midriff band with opaque coverage",
          "lower paper diamond center to the horizontal muzzle axis",
        ],
  };
  plan.freshRound10 = { ...promptAudit[scene], prompt };
}

const preparedAt = new Date().toISOString();
checkpoint.status = "active-four-scene-gate-fresh-round-10-materialized";
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
  status: "materialized-pending-launch",
  preparedAt,
  sceneNumbers: scenes,
  preservedAcceptedSceneNumbers: [1549, 1550],
  concurrency: "two independent reference-guided built-in image edits with all-settled capture",
  maximumRecoveryPassesPerBlockedScene: 1,
  promptAudit,
  storedRollsChanged: false,
};
checkpoint.xBacklogAudit = {
  ...checkpoint.xBacklogAudit,
  checkedAt: preparedAt,
  account: "@dogramaci",
  signedIn: true,
  eligibleBacklogRemaining: 0,
  latestVisibleSeriesStatus: {
    country: "Honduras",
    url: "https://x.com/dogramaci/status/2087088543499768003",
    caption: "Honduras ❤️ Czechia #Honduras",
    attachments: 3,
    liveVerified: true,
  },
  reconciliationDecision: "Live Honduras status matches the ledger; no eligible historical post remains and no duplicate upload is allowed.",
};
checkpoint.xPost.status = "blocked-active-country-incomplete-not-skipped";
checkpoint.xPost.url = null;
checkpoint.xPost.acceptedCurrentCountryAssets = 2;
checkpoint.nextQueueStatus = "locked-on-Georgia-until-four-accepted-git-pushed-and-X-live-verified";
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "launch-fresh-round-10-missing-scenes-only",
  preserveAcceptedSceneNumbers: [1549, 1550],
  sceneNumbers: scenes,
  laterCountryStartAllowed: false,
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ status: checkpoint.status, promptAudit }, null, 2));
