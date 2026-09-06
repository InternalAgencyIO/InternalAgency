import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const root = path.join(repo, "tmp/world-195x4/batch-382");
const checkpointPath = path.join(repo, "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json");
const contractPath = path.join(repo, "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const ledgerPath = path.join(repo, "assets/lore/starlight-era/world-x-publish-ledger.json");
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
const scene = 1551;
const references = [
  {
    path: "assets/lore/starlight-era/937-central-african-republic-dzanga-sangha-rainbow-clinic-signal-cipher.png",
    role: "primary quartet identity anchor only",
    expectedSha256: "BA256D750840F38C67E737FAB64BF646E606761DE71AEC9E5374AA0324B1EED1",
  },
  {
    path: "assets/lore/starlight-era/938-central-african-republic-boali-falls-rainbow-star-map-relay.png",
    role: "frontal quartet face supplement only",
    expectedSha256: "4161C9A5A8F745DF3A976112B6CA539E210DFA4E88E7873760E5CD0FF3F58FF6",
  },
  {
    path: "assets/lore/starlight-era/936-central-african-republic-bangui-oubangui-rainbow-route-grid.png",
    role: "quartet expression and Alia braid supplement only",
    expectedSha256: "0F330D7FF46E226340E5C94261752E73A22B895891E83B72EB8445E4618FCEEB",
  },
  {
    path: "assets/lore/starlight-era/ece-canonical-identity-v1.png",
    role: "AI ECE canonical face and body identity detail only",
    expectedSha256: "B22EF5CD9929D2A09F96DC0765434DB41C964B0F0390589E940EB085935C2315",
  },
];

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").toUpperCase();
}

if (sha256File(contractPath) !== "F7B247DF3BCE256C2A0BB2B51EB282EC4E6FBC5FE8E85A17970F311F26138FEC") {
  throw new Error("Authoritative contract changed before clean round 17 materialization");
}
if (sha256File(ledgerPath) !== "B94AA3FB2B1AB1BCAB100CE689F0173C77407B82439D73379D8BC0FA3EEC2455") {
  throw new Error("X publishing ledger changed before clean round 17 materialization");
}
if (checkpoint.status !== "active-four-scene-gate-incomplete-after-clean-fresh-round-16") {
  throw new Error(`Unexpected checkpoint status: ${checkpoint.status}`);
}
if (checkpoint.renderStrategyReset?.nextCleanRound !== 17) {
  throw new Error("Checkpoint does not authorize clean round 17");
}

const referenceAudit = references.map((reference, index) => {
  const actualSha256 = sha256File(path.join(repo, reference.path));
  if (actualSha256 !== reference.expectedSha256) {
    throw new Error(`Identity anchor ${index + 1} changed: ${reference.path}`);
  }
  return {
    image: index + 1,
    path: reference.path,
    role: reference.role,
    sha256: actualSha256,
    exists: true,
  };
});

const plan = checkpoint.scenePlans[String(scene)];
const basePrompt = plan.freshRound9?.prompt;
if (!basePrompt) throw new Error(`Scene ${scene} has no stored authoritative prompt`);

const priorHandMap = /Use one wide respectful rear three-quarter view with four non-overlapping full bodies:[\s\S]*?Radiance and ECE sustain the clearest affectionate eye line while the dip, caught-fingertip invitation, and Alia's jealous answer remain the first read\./;
const cleanHandMap = `Use one wide respectful rear three-quarter view with four non-overlapping full bodies and generous negative space: Ellie far left, dipped Radiance left-center, ECE right-center, and braided Alia isolated far right in strict right-facing side profile. The eight-hand ownership map is non-negotiable and every hand must be fully visible against a contrasting background. Ellie owns exactly two hands: her left open palm supports Radiance high between the shoulder blades and her right open palm supports Radiance at the near waist. Radiance owns exactly two hands: her left open palm rests visibly on Ellie's outer shoulder and her right open palm rests visibly on ECE's near shoulder. ECE owns exactly two hands, both wrapped exclusively around opposite handles of the single oversized magnetic compass table; nobody else touches the compass. Alia owns exactly two hands, both visibly separated on the one mission-prop grip. Show all eight elbows, forearms, wrists, palms, and finger clusters continuously connected to their owners, with no hand hidden behind a torso, garment, prop, or another hand. The four required relationship contacts are Ellie's upper-back support, Ellie's waist support, Radiance's palm on Ellie's shoulder, and Radiance's palm on ECE's shoulder. Radiance and ECE sustain the clearest affectionate eye line while the stable dip and Alia's jealous answer remain the first read.`;
const priorTargetGeometry = /Preserve the authoritative paper marker using exact side-on geometry\.[\s\S]*?No beam, ray, tracer, laser, dashed or dotted path, cord, string, glow trail, or painted trajectory\./;
const cleanTargetGeometry = `Build the paper marker correctly in the initial clean exposure using strict orthographic side-on geometry. Alia is the isolated rightmost adult in an exact right-facing profile, with level shoulders and both forearms forming a single horizontal sighting axis. Her short orange-plugged inert pistol is perfectly horizontal at shoulder height. A tall complete rectangular sand backstop stands on the far right with straight vertical edges. One plain white square paper and one centered black non-humanoid route diamond sit on the backstop. The black diamond center is directly in front of the orange muzzle center on the exact same visible horizontal row: the paper has equal white area above and below that row, and the barrel would meet the diamond center if extended straight ahead. Leave a broad, obvious band of clean empty air between muzzle and paper. Do not put the target above or below the barrel. Every person and mascot remains behind and left of Alia's muzzle plane. Both Alia hands are separated and visible on the grip; her trigger index is unmistakably straight and flat on the colored frame above and outside the guard. Alia's secure strapless copper front is visibly opaque from sternum through both side-bust panels, with no exposed breast, side breast, nipple, under-bust, cleavage, transparent area, or skin gap; the opaque side panels end before the fully open back. No beam, ray, tracer, laser, dashed or dotted path, cord, string, glow trail, or painted trajectory.`;

let storedSpecification = basePrompt.replaceAll("fresh round 9", "clean fresh round 17");
if (!priorHandMap.test(storedSpecification)) throw new Error("Could not locate the prior hand-map paragraph");
storedSpecification = storedSpecification.replace(priorHandMap, cleanHandMap);
if (!priorTargetGeometry.test(storedSpecification)) throw new Error("Could not locate the prior target-geometry paragraph");
storedSpecification = storedSpecification.replace(priorTargetGeometry, cleanTargetGeometry);

const cleanDirective = `Use case: photorealistic-natural.
Asset: Georgia Batch 382 scene 1551 clean fresh round 17, generated completely from scratch.

CLEAN SOURCE RESET
Images 1, 2, and 3 are identity references for the same adult quartet only. Image 4 is AI ECE's canonical identity detail only. Preserve their four distinct adult faces, body identities, skin tones, hair colors, and Alia's sculptural braids. Do not copy any reference wardrobe, pose, setting, prop, rainbow styling, lighting, surface texture, framing, or composition. Do not edit, trace, repaint, warp, upscale, or reuse any earlier Batumi image. Build a new clean photographic exposure directly from the stored scene specification.

ONE PLANNED PASS
Create exactly one clean fresh render. It may receive at most one later narrowly targeted recovery sourced only from this exact clean raw. No recovery output and no earlier Batumi render may seed a later fresh round.

CLEAN PHOTOGRAPHIC SURFACE GATE
Render a clean high-end fashion photograph with natural skin pores, smooth skin transitions, crisp garment seams, straight building edges, flat stable promenade tiles, coherent sand, clear safety glass, and individually readable straight rain streaks. No painterly waves, liquid swirls, marbling, embossed outlines, liquify distortion, melted edges, rippled skin, rippled fabric, bent buildings, bent glass rails, repetitive contour noise, over-sharpening, posterization, halos, excessive HDR, waxy bodies, crunchy microtexture, or processed illustration texture. Use one coherent optical focal plane and restrained cinematic grading.

DECLUTTERED COMPOSITION
Use a wide eye-level full-body 9:16 photograph with all four adults fully visible from head to footwear. Keep the relationship action large on the left and center. Isolate Alia's side-profile cinema-training lane on the far right behind one straight transparent safety panel. Include only the contract-required compass table, hands-free holographic route map, inert mission prop, paper target with complete backstop, PAWS, and MAX. Add no spare consoles, pipes, crates, cables, rails, ornaments, floating particles, decorative props, duplicated target pieces, or scattered equipment. Batumi's Black Sea horizon, Alphabet Tower, Ferris wheel, palms, and skyline remain large and recognizable behind the uncluttered foreground. Mars language comes from the four distinct couture constructions, not environmental clutter.

FIRST-PASS ANATOMY AND TARGET LOCK
Show exactly eight human arms and exactly eight human hands, two per woman, all fully separated and traceable. Ellie has two hands on Radiance: upper back and waist. Radiance has one hand on Ellie's outer shoulder and one hand on ECE's near shoulder. ECE has both hands exclusively on opposite compass handles. Alia has both hands exclusively on the one pistol grip. On the far right, the pistol barrel, orange muzzle center, and black target-diamond center share one unmistakably straight horizontal row with broad clean air between muzzle and paper.`;

const prompt = `${cleanDirective}\n\nAUTHORITATIVE STORED SCENE SPECIFICATION\n${storedSpecification}`;
const promptPath = path.join(root, `scene-${scene}-clean-fresh-round-17-prompt.txt`);
fs.writeFileSync(promptPath, prompt, "utf8");

const required = [
  `Weather roll ${plan.weather.roll} = ${plan.weather.result}`,
  `Hard-love roll ${plan.hardLoveBeat.roll}: ${plan.hardLoveBeat.result}`,
  `Romance roll ${plan.romanceBeat.roll}: ${plan.romanceBeat.contractResult}`,
  `Compound-love roll ${plan.compoundLoveBeat.roll}: ${plan.compoundLoveBeat.contractResult}`,
  `Pose-target roll ${plan.poseTargetRoll.roll}`,
  `Mascot roll ${plan.mascotState.roll}`,
  `Odd-prop roll ${plan.interestingProp.roll}`,
  "exactly 8 human hands",
];
for (const value of required) {
  if (!prompt.includes(value)) throw new Error(`Scene ${scene} missing materialized field: ${value}`);
}
for (const character of Object.values(plan.characters)) {
  const emotion = character.emotion.materializedResult ?? character.emotion.result;
  if (!prompt.includes(`emotion roll ${character.emotion.roll} = ${emotion}`)) {
    throw new Error(`Scene ${scene} missing an emotion materialization`);
  }
}

const promptAudit = {
  path: path.relative(repo, promptPath).replaceAll("\\", "/"),
  sha256: crypto.createHash("sha256").update(prompt).digest("hex").toUpperCase(),
  chars: prompt.length,
  storedRollsChanged: false,
  freshRound: 17,
  sourceMode: "clean-generation-from-original-identity-anchors",
  priorBatumiRenderInputCount: 0,
  referenceAudit,
  plannedPasses: {
    cleanFreshPasses: 1,
    maximumTargetedRecoveryPasses: 1,
    recoverySourceIfNeeded: "only the clean round 17 fresh raw",
    laterFreshSourcePolicy: "original identity anchors only",
  },
  firstPassLocks: {
    humanArms: 8,
    humanHands: 8,
    handOwnership: {
      Ellie: ["Radiance upper back", "Radiance waist"],
      Radiance: ["Ellie outer shoulder", "ECE near shoulder"],
      ECE: ["left compass handle", "right compass handle"],
      Alia: ["mission grip support", "mission grip primary"],
    },
    targetGeometry: "orange muzzle center and black diamond center on one visible horizontal row",
    foregroundClutter: "contract-required objects only",
  },
  hardSurfaceQualityGate: [
    "no wavy or marbled processing",
    "no liquify or melted geometry",
    "no embossed or over-sharpened edges",
    "no rippled skin or fabric",
    "no bent architecture or safety panels",
    "clean natural photographic texture",
  ],
};
plan.freshRound17 = { ...promptAudit, prompt };

const preparedAt = new Date().toISOString();
checkpoint.status = "active-four-scene-gate-clean-fresh-round-17-materialized";
checkpoint.checkpointedAt = preparedAt;
checkpoint.terminal = false;
checkpoint.countryCompletionGate = {
  ...checkpoint.countryCompletionGate,
  acceptedSceneCount: 3,
  missingSceneNumbers: [scene],
  gitCheckpointPushed: true,
  xPublicStatusVerified: false,
  queueAdvanceAllowed: false,
  gateSatisfied: false,
};
checkpoint.renderAttempts.freshRound17 = {
  status: "materialized-pending-launch",
  preparedAt,
  sceneNumbers: [scene],
  preservedAcceptedSceneNumbers: [1548, 1549, 1550],
  concurrency: "one clean missing-scene built-in generation",
  maximumRecoveryPassesPerBlockedScene: 1,
  promptAudit: { [scene]: promptAudit },
  storedRollsChanged: false,
  priorBatumiRenderInputCount: 0,
};
checkpoint.renderStrategyReset = {
  ...checkpoint.renderStrategyReset,
  activeCleanRound: 17,
  activeSourcePolicy: "four original identity anchors only",
  priorBatumiRenderInputCount: 0,
};
checkpoint.xBacklogAudit = {
  ...checkpoint.xBacklogAudit,
  checkedAt: preparedAt,
  eligibleBacklogRemaining: 0,
  pendingPost: null,
  preparedPostQueueCount: 0,
  lastPublicStatusVerified: "https://x.com/dogramaci/status/2087088543499768003",
  lastPublicStatusObservedViews: 52,
  reconciliationDecision: "Honduras remains publicly verified with three images. No eligible unposted World Series item. Georgia remains X-blocked until one clean fourth current-country scene is accepted.",
};
checkpoint.xPost.status = "blocked-active-country-incomplete-not-skipped";
checkpoint.xPost.url = null;
checkpoint.xPost.acceptedCurrentCountryAssets = 3;
checkpoint.nextQueueStatus = "locked-on-Georgia-until-four-accepted-git-pushed-and-X-live-verified";
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "launch-clean-fresh-round-17-from-original-identity-anchors-scene-1551-only",
  preserveAcceptedSceneNumbers: [1548, 1549, 1550],
  sceneNumbers: [scene],
  laterCountryStartAllowed: false,
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ status: checkpoint.status, promptAudit }, null, 2));
