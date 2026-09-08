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

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex").toUpperCase();
}

function sha256File(filePath) {
  return sha256(fs.readFileSync(filePath));
}

if (sha256File(contractPath) !== "F7B247DF3BCE256C2A0BB2B51EB282EC4E6FBC5FE8E85A17970F311F26138FEC") {
  throw new Error("Authoritative contract changed before clean round 18 materialization");
}
if (sha256File(ledgerPath) !== "B94AA3FB2B1AB1BCAB100CE689F0173C77407B82439D73379D8BC0FA3EEC2455") {
  throw new Error("X publishing ledger changed before clean round 18 materialization");
}
if (checkpoint.status !== "active-four-scene-gate-incomplete-after-clean-fresh-round-17") {
  throw new Error(`Unexpected checkpoint status: ${checkpoint.status}`);
}
if (checkpoint.renderStrategyReset?.nextCleanRound !== 18) {
  throw new Error("Checkpoint does not authorize clean round 18");
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
const prompt = `Use case: photorealistic-natural.
Asset: Georgia Batch 382 scene 1551 clean fresh round 18, generated completely from scratch.

CLEAN SOURCE RESET
Images 1, 2, and 3 are identity references for the same clearly adult fictional quartet only. Image 4 is AI ECE's canonical identity detail only. Preserve the four distinct adult faces, body identities, skin tones, hair colors, and Alia's sculptural braided ponytail. Do not copy any reference wardrobe, pose, setting, prop, rainbow group styling, lighting, surface texture, or composition. Do not edit, trace, repaint, upscale, or reuse any Batumi render. Construct a new clean photographic exposure from this specification.

ONE PLANNED PASS
Create one clean fresh render. It may receive at most one later narrowly targeted recovery sourced only from this exact clean raw. No recovery output or earlier Batumi image may seed a later fresh round.

CLEAN PHOTOGRAPHIC SURFACE
Produce a high-end natural fashion photograph with clean skin detail, smooth tonal transitions, crisp garment seams, straight architecture, flat promenade tiles, coherent sand, clear safety glass, and individually readable straight rain streaks. Keep physically smooth materials smooth. No painterly waves, liquid swirls, marbling, embossed contours, liquify distortion, melted edges, rippled skin, rippled fabric, bent buildings, bent glass, repetitive contour noise, over-sharpening, posterization, halos, excessive HDR, waxy bodies, crunchy texture, or processed illustration finish. Use one coherent optical focal plane and restrained cinematic grading.

SETTING, MODE, AND WEATHER
Use a wide eye-level full-body 9:16 editorial at real Batumi Boulevard in Georgia. Keep the Black Sea horizon, Alphabet Tower, Ferris wheel, palms, and modern Adjara skyline large, sharp, and recognizable. Weather roll 35 = heavy rain curtain, shown through straight rainfall and wet reflective tiles while every foot remains on stable nonslip ground. Scene mode = theme-led original. Active unrelated theme = Mars-surface expedition couture, expressed through garment construction and compact observation objects only. Keep the foreground uncluttered. Use no official uniform, logo, badge, seal, or insignia.

ADULT CAST AND IDENTITY
Show exactly four clearly adult fictional women, all visibly over 28: blonde Radiance, dark-haired Ellie, Black Alia with the only high sculptural braided ponytail, and brunette AI ECE. Preserve four different anchored faces and bodies with no clone, merge, replacement, or age shift. Male selector = inactive; show no man and no fifth adult.

DETERMINISTIC CHARACTER ROLLS
Radiance: emotion roll 56 = aching romantic longing; visible-midriff roll 98 = inactive; strapless roll 37 = inactive; fully-open-back roll 14 = ACTIVE.
Ellie: emotion roll 30 = hope; visible-midriff roll 8 = ACTIVE; strapless roll 59 = inactive; fully-open-back roll 64 = inactive.
Alia: emotion roll 38 = magnetic confidence; visible-midriff roll 40 = ACTIVE; strapless roll 3 = ACTIVE; fully-open-back roll 16 = ACTIVE.
AI ECE: emotion roll 92 = guilt and remorse; visible-midriff roll 58 = inactive; strapless roll 53 = inactive; fully-open-back roll 58 = inactive.
Express each emotion distinctly through eyes, face, torso direction, and posture without caricature.

FOUR DISTINCT OUTFIT FINGERPRINTS
Radiance wears a cobalt asymmetric high-low sheath with a solar-gold aerobrake halo yoke, copper lens pucks, a fully covered engineered waist, a respectful architectural open back, and halo-arch heels. Exactly Radiance also wears opaque knee socks in an original independent rainbow gradient.
Ellie wears a snow-white fan-sleeve jumpsuit with opaque sulfur-teal side panels, basalt heat-baffle ribs, a restrained three-centimeter midriff band, and articulated wedge boots.
Alia wears a Mars-copper asymmetric dust-shield origami tabard with a high straight strapless top edge, wide continuous opaque wraparound side panels, a restrained three-centimeter midriff band, a respectful architectural open back, a cobalt pleated skort, braided palm-green conduits, and angular shield pumps.
ECE wears a basalt segmented peplum jacket with solar-gold stirrup trousers, cobalt pressure discs, and piston-platform shoes; her torso, waist, and back remain fully covered.
All four outfits are secure, opaque, fully lined, conservative public-fashion couture. Give every woman a different silhouette, construction, material language, motif technique, hem architecture, and footwear. Keep complete torso and lower-body coverage and a respectful full-body camera.

GLOBAL VISUAL ROLLS
Pole-theme roll 67 = inactive; show no pole. Rainbow-only roll 15 = inactive; do not convert the group wardrobe to rainbow styling. Rainbow-hosiery roll 14 = ACTIVE; wearer selector roll 38 = Radiance; palette selector roll 54 = original independent rainbow gradient. Radiance and ECE are the clear affectionate center, and Alia alone handles the inert mission prop.

ROLLED RELATIONSHIP ACTION
Romance roll 86 = Alia spins Radiance under linked hands while ECE steadies Radiance and Ellie reaches toward the beacon. Materialize its pursuit, interruption, and choice through facial expression, torso movement, and the exact compatible contact graph below; do not add literal hands beyond that graph.
Compound-love roll 28 = ECE stays close at Radiance's side while warmly greeting Ellie and Alia answers beside them. Materialize its three-person affection and Alia's exclusion through eye lines, proximity, and the exact compatible contact graph below; do not add literal hands beyond that graph.
Hard-love roll 40 = a controlled dance dip with stable planted feet and supported back, a second partner catching the dipped adult's free hand, and the fourth answering with visible jealousy or invitation. Perform this beat visibly and make it the first read.

EXACT SOLVABLE EIGHT-HAND CONTACT GRAPH
Arrange four non-overlapping full bodies from left to right: Ellie, dipped Radiance, ECE behind the compass table, and isolated Alia in strict right-facing profile. Ellie initiates the stable dip. Ellie's left open palm supports Radiance high on the upper back. Ellie's right hand clasps Radiance's left hand at shoulder height; both complete clasped hands remain separately readable. Radiance's right open palm rests on ECE's near shoulder while Radiance and ECE sustain the strongest affectionate eye line. ECE's left hand grips the tall left compass handle and ECE's right hand grips the tall right compass handle; both handles and both hands are large, separated, and visible. Alia owns the final two hands, both separated on the one mission-prop grip.
Exactly eight human arms and exactly eight human hands, two per woman. The three clear relationship contacts are Ellie's upper-back support, the Ellie-Radiance hand clasp, and Radiance's palm on ECE's shoulder. Show every shoulder, elbow, forearm, wrist, palm, and finger cluster continuously connected to one owner against contrasting open space. No hand is hidden behind a body, garment, prop, or another hand.

ODD PROP AND ROUTE STRATEGY
Odd-prop roll 12 = ACTIVE. Holder selector roll 86 = AI ECE. Prop-family selector roll 88 = one oversized magnetic compass table. Make it a waist-high round table with two tall separate brass handles at opposite left and right edges. ECE faces the camera front-on with level shoulders and both arms descending symmetrically to the two handles. Nobody else touches the compass. A separate small translucent blue holographic route map rises hands-free from the center of the table, showing a simple coastline and three route nodes with no readable text or logo. The compass and map remain integrated into Radiance's invitation and ECE's remorseful response.

MASCOT STATE
Mascot roll 15 = PAWS and MAX together. On one dry padded lounge at the far lower-left, show exactly one tiny collarless golden kitten PAWS and one distinct small young golden retriever puppy MAX sharing a harmless nose-to-paw play beat. Ellie supervises by eye line only. Keep both far from the compass, mission lane, rain runoff, sea edge, ledges, and unsafe footing.

MISSION PROP AND TARGET
Pose-target roll 25; resolved handler = Alia because rainbow hosiery is active. Alia stands isolated at the far right behind one straight transparent safety panel in exact right-facing profile. She uses a realistic eye-level two-hand stance with one full-size polished rainbow-gradient Desert Eagle-style large-frame inert cinema-training pistol replica. It has a short barrel, one grip, an orange muzzle plug, and a compact stockless silhouette. Both Alia hands are separated and visible on the grip, wrists straight, elbows modestly bent, shoulders slightly forward, and trigger index straight along the colored frame outside the guard.
A tall complete rectangular sand backstop fills the far-right edge. Fix one plain white square paper with one centered black non-humanoid route diamond to the backstop. Build the alignment correctly in the initial exposure: Alia's dominant eye, pistol sights, horizontal barrel center, orange muzzle center, and black diamond center occupy one unmistakably straight horizontal row. The paper has equal white area above and below the muzzle row. Leave a broad obvious band of clean empty air between orange muzzle and paper. Every person and mascot remains behind and left of Alia's muzzle plane. The target lane is empty except for the one paper and complete backstop. No ammunition, loose magazine, firing, muzzle flash, threat, injury, combat, or aiming at a person, animal, occupied object, or camera.

DECLUTTER AND FINAL GATES
Include only the compass table, hands-free route map, one inert mission prop, one paper target with complete backstop, one safety panel, PAWS, MAX, and the recognizable Batumi landmarks. Add no spare console, pipe, crate, cable, rail, ornament, floating particle, extra target, or scattered equipment. Keep all four full bodies, faces, outfits, legs, and footwear in frame. The clean photograph must pass exact identity, eight-arm, eight-hand, hand-ownership, romance, mascot, wardrobe-roll, target-axis, indexed-trigger, location-theme fusion, and surface-quality gates.

X CAPTION ROLLS ARE STORED METADATA ONLY, NOT VISIBLE TEXT
Planned caption: Georgia red-heart Honduras; main hashtag Georgia; InternalAgency hashtag active; WorldXXXSeries hashtag inactive. Render no readable caption, hashtag, watermark, literal flag, sacred image, or official seal.`;

const promptPath = path.join(root, `scene-${scene}-clean-fresh-round-18-prompt.txt`);
fs.writeFileSync(promptPath, prompt, "utf8");

const required = [
  `Weather roll ${plan.weather.roll} = ${plan.weather.result}`,
  `Hard-love roll ${plan.hardLoveBeat.roll} = ${plan.hardLoveBeat.result}`,
  `Romance roll ${plan.romanceBeat.roll}`,
  `Compound-love roll ${plan.compoundLoveBeat.roll}`,
  `Pose-target roll ${plan.poseTargetRoll.roll}`,
  `Mascot roll ${plan.mascotState.roll}`,
  `Odd-prop roll ${plan.interestingProp.roll}`,
  "Exactly eight human arms and exactly eight human hands",
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
  sha256: sha256(prompt),
  chars: prompt.length,
  storedRollsChanged: false,
  freshRound: 18,
  sourceMode: "clean-generation-from-original-identity-anchors",
  priorBatumiRenderInputCount: 0,
  inheritedPromptInputCount: 0,
  referenceAudit,
  plannedPasses: {
    cleanFreshPasses: 1,
    maximumTargetedRecoveryPasses: 1,
    recoverySourceIfNeeded: "only the clean round 18 fresh raw",
    laterFreshSourcePolicy: "original identity anchors only",
  },
  compatibleHandGraph: {
    Ellie: ["Radiance upper-back support", "clasp Radiance left hand"],
    Radiance: ["clasp Ellie right hand", "ECE near shoulder"],
    ECE: ["left compass handle", "right compass handle"],
    Alia: ["mission grip support", "mission grip primary"],
    relationshipContacts: 3,
  },
  firstPassLocks: {
    humanArms: 8,
    humanHands: 8,
    targetGeometry: "eye, sights, orange muzzle center, and black diamond center on one visible horizontal row",
    routeMap: "hands-free above compass center",
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
plan.freshRound18 = { ...promptAudit, prompt };

const preparedAt = new Date().toISOString();
checkpoint.status = "active-four-scene-gate-clean-fresh-round-18-materialized";
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
checkpoint.renderAttempts.freshRound18 = {
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
  activeCleanRound: 18,
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
  lastPublicStatusObservedViews: 53,
  reconciliationDecision: "Honduras remains publicly verified with three images. No eligible unposted World Series item. Georgia remains X-blocked until one clean fourth current-country scene is accepted.",
};
checkpoint.xPost.status = "blocked-active-country-incomplete-not-skipped";
checkpoint.xPost.url = null;
checkpoint.xPost.acceptedCurrentCountryAssets = 3;
checkpoint.nextQueueStatus = "locked-on-Georgia-until-four-accepted-git-pushed-and-X-live-verified";
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "launch-clean-fresh-round-18-from-original-identity-anchors-scene-1551-only",
  preserveAcceptedSceneNumbers: [1548, 1549, 1550],
  sceneNumbers: [scene],
  laterCountryStartAllowed: false,
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ status: checkpoint.status, promptAudit }, null, 2));
