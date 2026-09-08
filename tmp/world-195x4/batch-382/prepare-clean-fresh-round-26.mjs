import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const root = path.join(repo, "tmp/world-195x4/batch-382");
const checkpointPath = path.join(repo, "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json");
const contractPath = path.join(repo, "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const ledgerPath = path.join(repo, "assets/lore/starlight-era/world-x-publish-ledger.json");
const sceneNumber = 1551;
const round = 26;
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
const contract = JSON.parse(fs.readFileSync(contractPath, "utf8"));
const plan = checkpoint.scenePlans[String(sceneNumber)];

const references = [
  ["assets/lore/starlight-era/937-central-african-republic-dzanga-sangha-rainbow-clinic-signal-cipher.png", "primary quartet identity anchor only", "BA256D750840F38C67E737FAB64BF646E606761DE71AEC9E5374AA0324B1EED1"],
  ["assets/lore/starlight-era/938-central-african-republic-boali-falls-rainbow-star-map-relay.png", "frontal quartet face supplement only", "4161C9A5A8F745DF3A976112B6CA539E210DFA4E88E7873760E5CD0FF3F58FF6"],
  ["assets/lore/starlight-era/936-central-african-republic-bangui-oubangui-rainbow-route-grid.png", "quartet expression and Alia braid supplement only", "0F330D7FF46E226340E5C94261752E73A22B895891E83B72EB8445E4618FCEEB"],
  ["assets/lore/starlight-era/ece-canonical-identity-v1.png", "AI ECE canonical face and body identity detail only", "B22EF5CD9929D2A09F96DC0765434DB41C964B0F0390589E940EB085935C2315"],
];

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex").toUpperCase();
}

function sha256File(filePath) {
  return sha256(fs.readFileSync(filePath));
}

function fnv1a(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

const expectedContractSha = "69EB6C84A2467A4234D901C3086ECECE9E583B55C41BB9382CD5ED523C482EF5";
const expectedLedgerSha = "B94AA3FB2B1AB1BCAB100CE689F0173C77407B82439D73379D8BC0FA3EEC2455";
if (sha256File(contractPath) !== expectedContractSha) throw new Error("Authoritative contract changed before clean round 26");
if (sha256File(ledgerPath) !== expectedLedgerSha) throw new Error("X publishing ledger changed before clean round 26");
if (!contract.romance?.radianceRealtimeAgreementPartyRule) throw new Error("Radiance agreement rule missing");
if (checkpoint.status !== "active-four-scene-gate-incomplete-after-clean-fresh-round-25") {
  throw new Error(`Unexpected checkpoint status: ${checkpoint.status}`);
}
if (checkpoint.renderStrategyReset?.nextCleanRound !== round) throw new Error("Checkpoint does not authorize clean round 26");
if (checkpoint.countryCompletionGate?.acceptedSceneCount !== 3) throw new Error("Georgia accepted count changed");
if (checkpoint.countryCompletionGate?.missingSceneNumbers?.join(",") !== String(sceneNumber)) throw new Error("Unexpected missing scene set");

const referenceAudit = references.map(([relativePath, role, expectedSha256], index) => {
  const actualSha256 = sha256File(path.join(repo, relativePath));
  if (actualSha256 !== expectedSha256) throw new Error(`Identity anchor ${index + 1} changed`);
  return { image: index + 1, path: relativePath, role, sha256: actualSha256, exists: true };
});

const invitationKey = `batch382-georgia-scene1551-radianceLiveInvitation-round${round}`;
const responseKey = `batch382-georgia-scene1551-radianceLiveResponse-round${round}`;
const participantsKey = `batch382-georgia-scene1551-radianceLiveParticipants-round${round}`;
const invitationRoll = fnv1a(invitationKey) % 100;
const responseRoll = fnv1a(responseKey) % 100;
const participantsRoll = fnv1a(participantsKey) % 100;
const invitations = [
  "AI ECE asks Radiance whether she wants to lead one measured rain-step that turns the completed safe route lesson into a quartet victory dance.",
  "Ellie asks Radiance whether she wants to hold the shallow dip for one final count while the quartet marks the route lesson as a shared victory.",
  "Alia asks Radiance whether she wants the quartet to answer her safe demonstration with one restrained victory-dance count.",
  "AI ECE offers Radiance the choice to end the route lesson with a single fully clothed quartet celebration step or return quietly to planning.",
];
const offeredChoice = invitations[invitationRoll % invitations.length];
const responseCategory = responseRoll <= 69 ? "explicit affirmative" : responseRoll <= 84 ? "explicit redirect" : responseRoll <= 94 ? "explicit pause" : "explicit decline";
const partyActivation = responseCategory === "explicit affirmative";
const participantSet = participantsRoll <= 24
  ? ["Radiance", "AI ECE"]
  : participantsRoll <= 49
    ? ["Radiance", "Ellie", "AI ECE"]
    : participantsRoll <= 74
      ? ["Radiance", "Ellie", "AI ECE", "Alia"]
      : ["Radiance", "AI ECE", "Alia"];
const willingParticipants = partyActivation ? participantSet : [];
const radianceResponse = "Radiance clearly redirects the optional celebration: she gives AI ECE a gentle but unmistakable side-to-side no, keeps the required safe dip stable, then turns her face and shoulders toward ECE's hands-free holographic route map with a calm closed-mouth planning expression.";
const radiancePartyState = {
  round,
  rollMethod: "FNV-1a over recorded round-26 live-narrative keys, reduced modulo 100",
  invitation: { key: invitationKey, roll: invitationRoll, selectorIndex: invitationRoll % invitations.length },
  response: {
    key: responseKey,
    roll: responseRoll,
    thresholds: "0-69 explicit affirmative; 70-84 explicit redirect; 85-94 explicit pause; 95-99 explicit decline",
    category: responseCategory,
  },
  participantSelector: {
    key: participantsKey,
    roll: participantsRoll,
    thresholds: "0-24 Radiance+ECE; 25-49 Radiance+Ellie+ECE; 50-74 all four; 75-99 Radiance+ECE+Alia",
    selectedSetIfAffirmative: participantSet,
  },
  offeredChoice,
  radianceResponse,
  partyActivation,
  willingParticipants,
  visibleAgreementEvidence: [],
  visibleResponseEvidence: [
    "Radiance's gentle but unmistakable side-to-side no toward AI ECE",
    "Radiance's face and shoulders deliberately redirect to ECE's holographic route map",
    "Radiance keeps the required dip stable without beginning a celebration step",
    "AI ECE accepts the redirect with a remorseful planning expression and both hands retained on the compass",
  ],
  continuityState: "No InternalAgency party activates. The safe route lesson remains the visible scene outcome, and this redirect is a complete valid story result.",
  consentScope: "This response applies only to this recorded round-26 invitation in scene 1551 and does not transfer to another act, participant, prop interaction, scene, country, or future image.",
};
if (invitationRoll !== 40 || responseRoll !== 84 || participantsRoll !== 29) throw new Error("Round 26 deterministic live-narrative rolls changed");
if (partyActivation || willingParticipants.length !== 0) throw new Error("Round 26 must remain party inactive");

const prompt = `Use case: photorealistic-natural.
Asset: Georgia Batch 382 scene 1551 clean fresh round 26, generated completely from scratch.

CLEAN SOURCE AND PASS PLAN
Images 1, 2, and 3 are identity references for the same clearly adult fictional quartet only. Image 4 is AI ECE's canonical identity detail only. Preserve the four distinct adult faces, body identities, skin tones, hair colors, and Alia's sculptural braided ponytail. Do not copy any reference wardrobe, pose, setting, prop, group palette, lighting, surface texture, or composition. Do not edit, trace, repaint, upscale, or reuse any earlier Batumi render. Create one clean photographic exposure from the specification. This fresh pass may receive at most one later narrow recovery sourced only from this exact raw. No edited result may seed a future fresh round.

CLEAN PHOTOGRAPHIC SURFACE
High-end natural editorial photography with clean skin, smooth tonal transitions, crisp garment seams, straight architecture, flat promenade tiles, coherent sand, clear safety glass, individually readable straight rain streaks, one optical focal plane, and restrained cinematic grading. No wavy or marbled processing, no liquid swirls, no liquify distortion, no melted edges, no rippled skin or fabric, no bent building or glass, no contour noise, no over-sharpening, no halos, no excessive HDR, no waxy body, and no painterly finish.

SETTING, MODE, WEATHER, AND CAST
Wide eye-level full-body 9:16 editorial at real Batumi Boulevard in Georgia. Keep the Black Sea horizon, Alphabet Tower, Ferris wheel, palms, and modern Adjara skyline large, sharp, and recognizable in the upper third. Weather roll 35 = heavy rain curtain, shown as straight rainfall and wet reflective nonslip tiles. Scene mode = theme-led original. Active unrelated theme = Mars-surface expedition couture, expressed through the four garments and compact observation objects only. Use no official uniform, logo, badge, seal, readable sign, or insignia.
Show exactly four clearly adult fictional women, all visibly over 28: blonde Radiance, dark-haired Ellie, Black Alia with the only high sculptural braided ponytail, and brunette AI ECE. Preserve four different anchored faces and bodies with no clone, merge, replacement, or age shift. Batch male selector roll 62 selected scene 1550; male emotion roll 95 = shame and social vulnerability there. Scene 1551 male state = inactive: show no man and no fifth adult.

SIMPLE SEPARATED COMPOSITION
Use a clean 28 mm eye-level full-body exposure and generous negative space. Place the dry mascot lounge at 8 percent frame width. Place shallow-dipped Ellie at 26 percent and standing Radiance at 41 percent, with a large triangular gap of blue-gray air between their torsos so all four relationship arms remain outside body silhouettes. Place ECE front-on with a narrow compass pedestal at 60 percent in a fully separate lane. Place Alia in rear three-quarter and strict right-facing profile at 81 percent in a fully separate closed training lane. Keep every face, torso, leg, foot, shoulder, elbow, forearm, wrist, palm, and finger cluster visible. Show Radiance's and Alia's fully open backs simultaneously. Reserve the far-right middle distance for one separated target and full backstop. No stacked body, crossed silhouette, cropped foot, or foreground clutter.

DETERMINISTIC CHARACTER ROLLS
Radiance: emotion roll 56 = aching romantic longing; visible-midriff roll 98 = inactive and waist fully covered; strapless roll 37 = inactive; fully-open-back roll 14 = ACTIVE.
Ellie: emotion roll 30 = hope; visible-midriff roll 8 = ACTIVE; strapless roll 59 = inactive; fully-open-back roll 64 = inactive.
Alia: emotion roll 38 = magnetic confidence; visible-midriff roll 40 = ACTIVE; strapless roll 3 = ACTIVE; fully-open-back roll 16 = ACTIVE.
AI ECE: emotion roll 92 = guilt and remorse; visible-midriff roll 58 = inactive and waist fully covered; strapless roll 53 = inactive; fully-open-back roll 58 = inactive.
Express each emotion distinctly through eyes, face, torso direction, and posture without caricature.

FOUR DISTINCT OUTFIT FINGERPRINTS
Radiance wears a cobalt asymmetric above-knee high-low sheath with side-mounted solar-gold aerobrake arcs, copper lens pucks, a fully covered engineered waist, bare arms, and halo-arch heels. Her respectful upper back is uninterrupted bare skin from shoulder blades to the secure high waist: no yoke across the back, strap, chain, band, fabric, mesh, or hair over it. Exactly Radiance also wears opaque knee socks in an original independent rainbow gradient.
Ellie wears a snow-white fan-sleeve jumpsuit with opaque sulfur-teal side panels, basalt heat-baffle ribs, a deliberate restrained three-centimeter bare midriff band, asymmetric ankle hems, and articulated wedge boots. Her back is securely covered.
Alia wears a rigid front-and-side Mars-copper dust-shield corsage bodice, its high straight edge below completely bare collarbones and shoulders, with wide opaque side wings that stop at her flanks and leave the entire upper back visibly bare to a secure high waist. A restrained three-centimeter bare midriff band separates it from a cobalt pleated skort; braided palm-green conduits finish at the side wings; angular shield pumps complete the look. No shoulder strap, sleeve, halter, collar, necklace, neck loop, back band, crossing band, fabric panel, or illusion mesh.
ECE wears a fully covered basalt segmented peplum jacket with solar-gold stirrup trousers, cobalt pressure discs, and piston-platform shoes.
All four outfits are secure, opaque, fully lined, conservative public-fashion couture. Every silhouette, construction, material language, motif technique, hem architecture, and footwear family is different. No matching mini-dress set, palette-swapped copy, repeated map print, lingerie, exposed undergarment, transparent intimate area, bondage, or restraint.

GLOBAL VISUAL ROLLS
Pole-theme roll 67 = inactive; show no pole. Rainbow-only roll 15 = inactive; do not convert the group wardrobe to rainbow styling. Rainbow-hosiery roll 14 = ACTIVE; wearer selector roll 38 = Radiance; palette selector roll 54 = original independent rainbow gradient. Radiance and ECE remain the affectionate narrative center through Radiance's redirect toward ECE's route map and ECE's remorseful attentive response. Alia alone handles the inert mission prop.

ROLLED LOVE STORY
Romance roll 86 = Alia spins Radiance under linked hands while ECE steadies Radiance and Ellie reaches toward the beacon. Materialize its pursuit and interruption through Alia's excluded side glance, Radiance's torso turn toward ECE, and Ellie's hopeful reach within the exact compatible contact graph below; do not add literal hands beyond that graph.
Compound-love roll 28 = ECE stays close at Radiance's side while warmly greeting Ellie and Alia answers beside them. Materialize its three-person affection and Alia's exclusion through eye lines, spacing, and the exact compatible contact graph below; do not add literal hands beyond that graph.
Hard-love roll 40 = a controlled dance dip with stable planted feet and supported back, a second partner catching the dipped adult's free hand, and the fourth answering with visible jealousy or invitation. Make the stable shallow dip, caught clasp, and Alia's excluded magnetic side glance the first read.

RADIANCE LIVE CHOICE AND RESPONSE
Invitation key ${invitationKey}; roll ${invitationRoll}; selector index ${invitationRoll % invitations.length}.
Offered choice: ${offeredChoice}
Response key ${responseKey}; roll ${responseRoll}; result = ${responseCategory}.
Participant-selector key ${participantsKey}; roll ${participantsRoll}; selected set if affirmative = ${participantSet.join(", ")}.
Radiance response: ${radianceResponse}
partyActivation = FALSE. Willing participants = none. Show Radiance's gentle but unmistakable side-to-side no toward ECE, followed by her deliberate face-and-shoulder redirect toward ECE's small hands-free holographic route map. Her stable support and caught clasp continue, but no celebration step begins. ECE accepts the redirect with a remorseful planning expression while both hands remain on the compass. No other person acts as though a party began. Add no crowd, drink, confetti, balloon, sign, text, stage, or party object. This response is invitation-specific and scene-specific only.

EXACT EIGHT-ARM, EIGHT-HAND GRAPH
Radiance stands planted at center-left in rear three-quarter view, with her open back visible. Her bare left arm is a continuous visible line outside Ellie's white torso from shoulder to elbow to forearm to wrist to open palm; that palm supports Ellie high on the far upper back. Her bare right arm stays in open air above the triangular torso gap and ends in her right hand clasping Ellie's left hand at shoulder height. Both clasped hands are complete and separately readable. Radiance's head and shoulders redirect toward ECE's route map without changing either hand.
Ellie performs a very shallow outward side dip toward frame-left, with both feet visible and one knee softly bent. Her left arm rises through clear air to the caught clasp with Radiance. Her white-sleeved right arm stays fully in front of cobalt fabric from shoulder to elbow to forearm to wrist to open palm; that palm rests on Radiance's bare near shoulder. Ellie's hopeful face remains visible.
ECE stands front-on in her own lane. Her left arm descends visibly to the tall left compass handle and her right arm descends visibly to the tall right handle. Both arms and hands are separated by the compass face and fully visible. ECE touches no person.
Alia remains isolated in rear three-quarter and strict right-facing profile. Her right arm ends in the primary mission grip and her left arm ends in the separate support grip described below.
Exactly eight human arms and exactly eight human hands, two per woman. The three relationship contacts are only Radiance's upper-back support, the Radiance-Ellie caught clasp, and Ellie's palm on Radiance's shoulder. No hand emerges from behind a torso, waist, garment, table, prop, or another hand. No extra touch, hidden hand, decorative hand, borrowed limb, fused wrist, duplicate finger cluster, or ambiguous owner path.

ODD PROP AND ROUTE STRATEGY
Odd-prop roll 12 = ACTIVE. Holder selector roll 86 = AI ECE. Prop-family selector roll 88 = one oversized magnetic compass table. Interpret it as one bold circular compass face on a narrow knee-high pedestal that hides no body part. Two tall separate brass handles stand at opposite edges; ECE alone holds them, one hand per handle. A separate small translucent blue holographic route map rises hands-free from the center, showing a coastline and three route nodes with no readable text or logo. Nobody else touches the compass or ECE.

MASCOT STATE
Mascot roll 15 = PAWS plus MAX; mascot holder selector roll 16 = Ellie. Show exactly one tiny collarless golden kitten PAWS and exactly one distinct small young golden retriever puppy MAX sharing one harmless supervised nose-to-paw play beat entirely inside one raised cream padded lounge at far lower-left. All paws stay on its visibly dry cushion. Ellie supervises by eye line only. Keep the lounge behind and left of Alia's muzzle plane and far from the sea edge, wet drop, compass, safety panel, target lane, and every prop. No duplicate animal, adult dog, collar, ledge, runoff, or unsafe footing.

MISSION PROP AND TARGET
Pose-target roll 25; resolved handler = Alia because rainbow hosiery is active. Alia is large in the right foreground, rear three-quarter and strict right-facing profile, with adult face and sculptural braids visible. She uses one realistic eye-level two-hand stance toward an empty closed training lane. Several visible meters away in the far-right middle distance, show one complete tall thick sand backstop carrying one white paper with one black non-humanoid route diamond. Its center sits exactly on Alia's shoulder-height orange-muzzle sight line. A long empty pavement strip and one complete transparent safety panel separate muzzle and backstop. The paper target never overlaps the replica.
Show exactly one full-size polished rainbow-gradient Desert Eagle-style large-frame inert cinema-training pistol replica made from heavy metal, with compact short barrel, one substantial grip, one oversized black oval trigger guard, and an orange muzzle plug. It is a realistic inert film-training replica, not plastic, not a water pistol, not a squirt gun, and not a toy. Angle its right side plate toward camera. Alia's primary right hand wraps the grip. Her right trigger index is one long fully extended straight finger lying flat along the metallic side plate above and outside the guard. The entire black oval trigger guard is visibly empty. Her support left palm cups only the lower front of the primary fist and grip base as a second separate cluster below and forward. Show two distinct wrists, palms, and finger clusters with clean air around the guard. Keep both shoulders, elbows, forearms, wrists, hands, and finger clusters separate against negative space. Her magnetic-confidence side glance answers the romance while her dominant eye and sights remain safely aligned downrange.
Every person and mascot remains behind and left of the muzzle plane. No ammunition, loose magazine, firing, muzzle flash, threat, injury, combat, or aim at a person, animal, occupied object, or camera.

DECLUTTER AND FINAL GATES
Include only the compass pedestal, hands-free route map, one inert mission prop, one paper target with complete backstop, one safety panel, one PAWS, one MAX, one dry lounge, and recognizable Batumi landmarks. Add no spare console, pipe, crate, cable, rail, ornament, floating particle, extra target, or scattered equipment. Keep all four full bodies, faces, outfits, legs, and footwear in frame. The clean photograph must pass exact identity, eight-arm, eight-hand, continuous owner-path, three-contact romance, visible redirect, party-inactive, mascot, wardrobe-roll, target-axis, indexed-trigger, location-theme fusion, and surface-quality gates.

X CAPTION ROLLS ARE STORED METADATA ONLY, NOT VISIBLE TEXT
Heart roll 71 = red heart. InternalAgency hashtag roll 15 = active. WorldXXXSeries hashtag roll 80 = inactive. Planned caption: Georgia red-heart Honduras; main hashtag Georgia; InternalAgency hashtag active; WorldXXXSeries hashtag inactive. Render no readable caption, hashtag, watermark, literal flag, sacred image, or official seal.`;

const required = [
  `Weather roll ${plan.weather.roll} = ${plan.weather.result}`,
  `Hard-love roll ${plan.hardLoveBeat.roll} = ${plan.hardLoveBeat.result}`,
  `Romance roll ${plan.romanceBeat.roll}`,
  `Compound-love roll ${plan.compoundLoveBeat.roll}`,
  `Pose-target roll ${plan.poseTargetRoll.roll}`,
  `Mascot roll ${plan.mascotState.roll}`,
  `Odd-prop roll ${plan.interestingProp.roll}`,
  `Pole-theme roll ${plan.poleDanceTheme.roll}`,
  `Rainbow-only roll ${plan.rainbowOnly.roll}`,
  `Rainbow-hosiery roll ${plan.rainbowHosiery.roll}`,
  `wearer selector roll ${plan.rainbowHosiery.wearer.roll}`,
  `palette selector roll ${plan.rainbowHosiery.palette.roll}`,
  "partyActivation = FALSE",
  "Exactly eight human arms and exactly eight human hands",
  "trigger guard is visibly empty",
  "Heart roll 71 = red heart",
  "InternalAgency hashtag roll 15 = active",
  "WorldXXXSeries hashtag roll 80 = inactive",
];
for (const value of required) if (!prompt.includes(value)) throw new Error(`Missing materialized field: ${value}`);
for (const [name, character] of Object.entries(plan.characters)) {
  const emotion = character.emotion.materializedResult ?? character.emotion.result;
  if (!prompt.includes(`${name}: emotion roll ${character.emotion.roll} = ${emotion}`)) throw new Error(`Missing ${name} emotion`);
  if (!prompt.includes(`visible-midriff roll ${character.visibleMidriff.roll}`)) throw new Error(`Missing ${name} midriff roll`);
  if (!prompt.includes(`strapless roll ${character.straplessDress.roll}`)) throw new Error(`Missing ${name} strapless roll`);
  if (!prompt.includes(`fully-open-back roll ${character.fullyOpenBack.roll}`)) throw new Error(`Missing ${name} open-back roll`);
}

const promptPath = path.join(root, `scene-${sceneNumber}-clean-fresh-round-${round}-prompt.txt`);
fs.writeFileSync(promptPath, prompt, "utf8");
const promptAudit = {
  path: path.relative(repo, promptPath).replaceAll("\\", "/"),
  sha256: sha256(prompt),
  chars: prompt.length,
  storedContractRollsChanged: false,
  freshRound: round,
  sourceMode: "clean-generation-from-original-identity-anchors",
  priorBatumiRenderInputCount: 0,
  sourceSpecification: "authoritative contract plus stored scene plan; no prior Batumi prompt or image pixels used as a visual source",
  referenceAudit,
  plannedPasses: {
    cleanFreshPasses: 1,
    maximumTargetedRecoveryPasses: 1,
    recoverySourceIfNeeded: "only the clean round 26 fresh raw",
    laterFreshSourcePolicy: "original identity anchors only",
  },
  radianceRealtimeAgreementParty: radiancePartyState,
  redesignedComposition: {
    dipOwnership: "standing rear-three-quarter Radiance supports outward side-dipped Ellie across a large triangular torso gap",
    handGraph: {
      Radiance: ["continuous upper-back support on Ellie", "caught clasp with Ellie"],
      Ellie: ["caught clasp with Radiance", "open palm on Radiance shoulder"],
      ECE: ["left compass handle", "right compass handle"],
      Alia: ["primary mission grip", "separate support grip at base"],
    },
    relationshipContacts: 3,
    responseGraph: "Radiance visibly redirects ECE's invitation to the hands-free route map; no party begins",
    missionGeometry: "isolated right-foreground profile with one separated shoulder-height paper target and complete backstop",
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

plan.freshRound26 = { ...promptAudit, prompt };
plan.radianceRealtimeAgreementParty = radiancePartyState;
const preparedAt = new Date().toISOString();
checkpoint.status = "active-four-scene-gate-clean-fresh-round-26-materialized";
checkpoint.checkpointedAt = preparedAt;
checkpoint.terminal = false;
checkpoint.countryCompletionGate = {
  ...checkpoint.countryCompletionGate,
  acceptedSceneCount: 3,
  missingSceneNumbers: [sceneNumber],
  gitCheckpointPushed: true,
  xPublicStatusVerified: false,
  queueAdvanceAllowed: false,
  gateSatisfied: false,
};
checkpoint.renderAttempts.freshRound26 = {
  status: "materialized-pending-launch",
  preparedAt,
  sceneNumbers: [sceneNumber],
  preservedAcceptedSceneNumbers: [1548, 1549, 1550],
  concurrency: "one clean missing-scene built-in generation",
  maximumRecoveryPassesPerBlockedScene: 1,
  promptAudit: { [sceneNumber]: promptAudit },
  storedContractRollsChanged: false,
  priorBatumiRenderInputCount: 0,
  radianceRealtimeAgreementParty: radiancePartyState,
};
checkpoint.renderStrategyReset = {
  ...checkpoint.renderStrategyReset,
  activeCleanRound: round,
  activeSourcePolicy: "four original identity anchors only",
  priorBatumiRenderInputCount: 0,
};
checkpoint.xBacklogAudit = {
  ...checkpoint.xBacklogAudit,
  checkedAt: preparedAt,
  signedIn: true,
  eligibleBacklogRemaining: 0,
  pendingPost: null,
  preparedPostQueueCount: 0,
  lastPublicStatusVerified: "https://x.com/dogramaci/status/2087088543499768003",
  latestVisibleAccountStatus: {
    url: "https://x.com/dogramaci/status/2087242564432806133",
    validCountryPairCaption: false,
    classification: "unrelated-account-post-not-a-World-Series-ledger-item",
  },
  latestVisibleAccountStatuses: [
    "https://x.com/dogramaci/status/2087242564432806133",
    "https://x.com/dogramaci/status/2087241970661941705",
  ],
  reconciliationDecision: "Signed-in live profile checked. No eligible unposted World Series country pair exists. Georgia remains X-blocked until scene 1551 is accepted.",
};
checkpoint.xPost.status = "blocked-active-country-incomplete-not-skipped";
checkpoint.xPost.url = null;
checkpoint.xPost.acceptedCurrentCountryAssets = 3;
checkpoint.xPost.note = "Georgia has accepted scenes 1548, 1549, and 1550. Clean round 26 is materialized for missing scene 1551 from original identity anchors only. Publication remains mandatory after scene 1551 is accepted and the four-scene completion checkpoint is pushed.";
checkpoint.nextQueueStatus = "locked-on-Georgia-until-four-accepted-git-pushed-and-X-live-verified";
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "launch-clean-fresh-round-26-from-original-identity-anchors-scene-1551-only",
  preserveAcceptedSceneNumbers: [1548, 1549, 1550],
  sceneNumbers: [sceneNumber],
  laterCountryStartAllowed: false,
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ status: checkpoint.status, promptAudit }, null, 2));
