import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const root = path.join(repo, "tmp/world-195x4/batch-382");
const checkpointPath = path.join(repo, "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json");
const contractPath = path.join(repo, "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const ledgerPath = path.join(repo, "assets/lore/starlight-era/world-x-publish-ledger.json");
const templatePromptPath = path.join(root, "scene-1551-clean-fresh-round-40-prompt.txt");
const scene = 1551;
const round = 41;
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
const contract = JSON.parse(fs.readFileSync(contractPath, "utf8"));
const plan = checkpoint.scenePlans[String(scene)];
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

if (sha256File(contractPath) !== "69EB6C84A2467A4234D901C3086ECECE9E583B55C41BB9382CD5ED523C482EF5") throw new Error("Contract changed before round 41");
if (sha256File(ledgerPath) !== "B94AA3FB2B1AB1BCAB100CE689F0173C77407B82439D73379D8BC0FA3EEC2455") throw new Error("Ledger changed before round 41");
if (!contract.romance?.radianceRealtimeAgreementPartyRule) throw new Error("Radiance agreement rule missing");
if (checkpoint.status !== "active-four-scene-gate-incomplete-after-clean-fresh-round-40") throw new Error(`Unexpected status: ${checkpoint.status}`);
if (checkpoint.renderStrategyReset?.nextCleanRound !== round) throw new Error("Checkpoint does not authorize round 41");
if (checkpoint.renderAttempts.freshRound41) throw new Error("Round 41 already materialized");

const referenceAudit = references.map(([relativePath, role, expectedSha256], index) => {
  const actualSha256 = sha256File(path.join(repo, relativePath));
  if (actualSha256 !== expectedSha256) throw new Error(`Identity anchor ${index + 1} changed`);
  return { image: index + 1, path: relativePath, role, sha256: actualSha256, exists: true };
});

const invitationKey = "batch382-georgia-scene1551-radianceLiveInvitation-round41";
const responseKey = "batch382-georgia-scene1551-radianceLiveResponse-round41";
const participantsKey = "batch382-georgia-scene1551-radianceLiveParticipants-round41";
const invitationFullHash = fnv1a(invitationKey);
const responseFullHash = fnv1a(responseKey);
const participantsFullHash = fnv1a(participantsKey);
const invitationRoll = invitationFullHash % 100;
const responseRoll = responseFullHash % 100;
const participantsRoll = participantsFullHash % 100;
const invitations = [
  "AI ECE asks Radiance whether she wants to mark the completed route lesson with one restrained mutual smile while Ellie and Alia remain outside the party beat.",
  "Ellie asks Radiance whether she wants to keep the supported lean while sharing one celebratory count with ECE alone.",
  "Alia offers Radiance the choice to answer ECE's route signal with one public-safe mutual nod or return quietly to planning.",
  "AI ECE offers Radiance one optional fully clothed rain-count shared only between them while Ellie keeps the support pose and Alia keeps the safe mission lane.",
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
const radianceResponse = partyActivation
  ? "Radiance explicitly accepts ECE's offered rain-count with one clear up-down nod and a broad willing smile directly toward ECE. She keeps all three existing support contacts with Ellie static as gratitude rather than inviting Ellie into the party beat."
  : responseCategory === "explicit redirect"
    ? "Radiance clearly redirects the invitation with an open palm toward the route map; no party begins."
    : responseCategory === "explicit pause"
      ? "Radiance clearly asks for time with one raised open wait palm and planted feet; no party begins."
      : "Radiance clearly declines with a side-to-side head shake and steps no closer; no party begins.";
const radiancePartyState = {
  round,
  rollMethod: "FNV-1a over recorded round-41 live-narrative keys, reduced modulo 100",
  invitation: { key: invitationKey, fullHash: invitationFullHash, roll: invitationRoll, selectorIndex: invitationRoll % invitations.length },
  response: { key: responseKey, fullHash: responseFullHash, roll: responseRoll, thresholds: "0-69 explicit affirmative; 70-84 explicit redirect; 85-94 explicit pause; 95-99 explicit decline", category: responseCategory },
  participantSelector: { key: participantsKey, fullHash: participantsFullHash, roll: participantsRoll, thresholds: "0-24 Radiance+ECE; 25-49 Radiance+Ellie+ECE; 50-74 all four; 75-99 Radiance+ECE+Alia", hypotheticalSetIfAffirmative: participantSet },
  offeredChoice,
  radianceResponse,
  partyActivation,
  willingParticipants,
  visibleAgreementEvidence: partyActivation ? [
    "Radiance's clear up-down nod and broad willing smile directly toward ECE",
    "ECE's reciprocal willing smile and sustained mutual eye line toward Radiance while both compass hands stay fixed",
    "Ellie's calm hopeful support without a party smile, nod, dance motion, or participant cue",
    "Alia's magnetic-confidence mission focus without a party smile, nod, dance motion, or participant cue",
  ] : [],
  visibleResponseEvidence: partyActivation ? [] : [radianceResponse],
  continuityState: partyActivation
    ? "Radiance accepts exactly one fully clothed public-safe rain-count with ECE. Ellie remains the non-party support partner, and Alia remains the non-party mission handler."
    : "No party activates. Every adult remains in the safe route-lesson pose.",
  consentScope: `This ${responseCategory} applies only to the recorded round-41 invitation in scene 1551 and only to ${willingParticipants.join(", ") || "no party participants"}. It does not transfer to another act, participant, prop interaction, scene, country, or future image.`,
};

let prompt = fs.readFileSync(templatePromptPath, "utf8");
prompt = prompt.replaceAll("round 40", "round 41").replaceAll("round-40", "round-41");

const compositionBlock = /FOUR CLEAR LANES, WIDE CAMERA[\s\S]*?(?=\n\nDETERMINISTIC CHARACTER ROLLS)/;
const newCompositionBlock = `CLEAN FOUR-LANE BLOCKING WITH VISIBLE SPACE BEYOND TARGET
Use one clean 32 mm eye-level full-body exposure from far enough back that every adult, foot, prop, panel, target, and all four edges of the sand backstop sit comfortably inside frame. The wet Batumi promenade visibly continues for a full backstop-width beyond the backstop to the right frame edge.
LANE 1, far left around 9 percent: ECE stands front-on behind one narrow waist-high compass pedestal. Both complete arms descend to two tall opposite handles. Her face turns right toward Radiance. Leave one full shoulder-width of clear pavement between ECE's compass and the relationship pair; no other hand enters this lane.
LANE 2, center-left: Ellie stands around 29 percent in front-three-quarter right-facing view, both feet planted and both shoulders visible. Radiance stands around 43 percent, rear-three-quarter to camera with her entire bare upper and middle back visible and both feet planted in a shallow supported lean toward Ellie. Keep a clear open-air torso gap. Their exact four relationship hands create three contacts: HIGH, Radiance's bare left arm rises diagonally left in front of plain sea and her open left palm rests on Ellie's white-covered right shoulder; MIDDLE, Ellie's white-sleeved left arm rises diagonally right in front of plain sea and her open left palm rests high on Radiance's near left shoulder blade; LOW, Ellie's white-sleeved right arm and Radiance's bare right arm descend separately through the empty gap into one low right-hand clasp below both hips. The two raised forearms form a clean shallow X in open air without touching each other. Show all four shoulders, upper arms, elbows, forearms, wrists, palms, and finger clusters continuously. Radiance's head turns clearly left over her shoulder, chin visibly mid-nod and both eyes aimed directly at ECE rather than Ellie or camera.
LANE 3, right around 59 percent: Alia stands in strict right-facing side profile, complete body and footwear in frame, with one large continuous bare upper and middle back. Her secure self-supporting front-only strapless copper shell ends before both rear ribs with no halter, neck loop, shoulder strap, back strap, rear band, closure, mesh, fabric, or decorative cord. Her exact two arms and hands hold one full-size thirty-centimeter dark polished-metal inert training replica in large side profile. Her straight right trigger index lies flat on the metal side plate above and entirely outside the complete empty black oval guard.
LANE 4, safety lane: put one complete transparent rectangular safety panel centered around 70 percent, with all four orange-capped corners visible. Put one complete narrow freestanding sand backstop centered around 80 percent, its right edge no farther than 86 percent. Leave at least one full backstop-width of empty wet promenade between the backstop and the right frame edge. Fix one white paper route diamond at Alia's exact eye, barrel-center, muzzle-center, and shoulder-height horizontal row. Keep every person, mascot, public path, and occupied object behind and left of the muzzle plane.
Reserve the far lower-left corner for the dry mascot lounge. Preserve Batumi's recognizable Alphabet Tower, Ferris wheel, Black Sea, palms, and skyline across the upper third. No cropped foot, cropped panel, cropped backstop, foreground overlap, layered arm, decorative clutter, curved architecture, hidden contact, or non-ECE hand near the compass.`;
if (!compositionBlock.test(prompt)) throw new Error("Composition block missing");
prompt = prompt.replace(compositionBlock, newCompositionBlock);

const globalBlock = /GLOBAL VISUAL ROLLS[\s\S]*?(?=\n\nROLLED LOVE STORY)/;
const newGlobalBlock = `GLOBAL VISUAL ROLLS
Pole-theme roll 67 = inactive; show no pole. Rainbow-only roll 15 = inactive; do not convert the group wardrobe to rainbow styling. Rainbow-hosiery roll 14 = ACTIVE; wearer selector roll 38 = Radiance; palette selector roll 54 = original independent rainbow gradient. Radiance and ECE remain the affectionate narrative center through a sustained warm mutual eye line. partyActivation is TRUE for exactly Radiance and AI ECE. Express their single rain-count only through Radiance's visible nod and broad willing smile toward ECE and ECE's reciprocal willing smile while both compass hands remain fixed. Ellie keeps the stable support pose with calm hope but no party smile, nod, dance motion, or participant cue. Alia stays outside the party beat with magnetic-confidence focus downrange and no party cue. Add no heel lift and no party object. Alia alone handles the inert mission prop.`;
if (!globalBlock.test(prompt)) throw new Error("Global block missing");
prompt = prompt.replace(globalBlock, newGlobalBlock);

const loveBlock = /ROLLED LOVE STORY[\s\S]*?(?=\n\nRADIANCE LIVE CHOICE AND RESPONSE)/;
const newLoveBlock = `ROLLED LOVE STORY
Romance roll 86 = Alia spins Radiance under linked hands while ECE steadies Radiance and Ellie reaches toward the beacon. Show the completed spin already settled into Ellie's shallow supported lean; do not add literal spin hands beyond the exact graph below.
Compound-love roll 28 = ECE stays close against Radiance's side while warmly greeting Ellie and Alia answers beside them. Materialize its square through Radiance and ECE's sustained affectionate eye line, Ellie's calm willing support, and Alia's magnetic-confidence focus while every task hand remains fixed.
Hard-love roll 40 = a controlled dance dip with stable planted feet and supported back, a second partner catching the dipped adult's free hand, and the fourth answering with visible jealousy or invitation. Ellie supports Radiance through the middle support palm and low caught-hand clasp; Radiance answers with her high palm on Ellie's covered shoulder. These three and only three relationship contacts are large, ordinary, vertically separated, and unmistakable. Alia answers as the guarded non-party fourth through a confident profile while remaining safely downrange. ECE remains the affectionate center through mutual eye line while owning the compass.`;
if (!loveBlock.test(prompt)) throw new Error("Love block missing");
prompt = prompt.replace(loveBlock, newLoveBlock);

const partyBlock = /RADIANCE LIVE CHOICE AND RESPONSE[\s\S]*?(?=\n\nEXACT EIGHT-ARM, EIGHT-HAND GRAPH)/;
const newPartyBlock = `RADIANCE LIVE CHOICE AND RESPONSE
Invitation key ${invitationKey}; full hash ${invitationFullHash}; roll ${invitationRoll}; selector index ${invitationRoll % invitations.length}.
Offered choice: ${offeredChoice}
Response key ${responseKey}; full hash ${responseFullHash}; roll ${responseRoll}; result = ${responseCategory}.
Participant-selector key ${participantsKey}; full hash ${participantsFullHash}; roll ${participantsRoll}; willing participants = ${willingParticipants.join(", ")}.
Radiance response: ${radianceResponse}
partyActivation = TRUE. Show exactly one adult, consensual, fully clothed, public-safe InternalAgency rain-count involving exactly Radiance and AI ECE. Radiance visibly nods and smiles directly toward ECE while all three contacts with Ellie remain static. ECE gives one reciprocal willing smile toward Radiance while both hands remain on opposite compass handles. Ellie remains a calm hopeful support partner but does not smile as a party participant, nod yes, dance, or move her support hands. Alia remains a confident mission handler outside the party beat, with fixed feet, mission hands, and rightward sight line. Add no party object, crowd, drink, confetti, balloon, sign, text, stage, ornament, or unsafe heel lift. Agreement is limited to this exact invitation, participant set, and one rain-count.`;
if (!partyBlock.test(prompt)) throw new Error("Party block missing");
prompt = prompt.replace(partyBlock, newPartyBlock);

const handBlock = /EXACT EIGHT-ARM, EIGHT-HAND GRAPH[\s\S]*?(?=\n\nODD PROP AND ROUTE STRATEGY)/;
const newHandBlock = `EXACT EIGHT-ARM, EIGHT-HAND GRAPH
ECE stands alone at far left. Her left arm descends visibly to the tall left compass handle and her right arm descends visibly to the tall right handle. Both arms and hands are separated by the compass face. ECE touches no person and owns the compass alone; no other hand enters her lane.
Ellie's white-sleeved left arm begins at her fully visible left shoulder and rises diagonally right through clear sea, ending in one open support palm high on Radiance's near left shoulder blade. Ellie's separate white-sleeved right arm begins at her fully visible right shoulder and descends diagonally right through the empty torso gap, ending as the left hand of the low clasp. Show both complete sleeves, elbows, forearms, wrists, palms, and finger clusters continuously.
Radiance's bare left arm begins at her fully visible left shoulder and rises diagonally left through clear sea, ending in one open palm on Ellie's white-covered right shoulder. Radiance's separate bare right arm begins at her fully visible right shoulder and descends diagonally left through the empty torso gap, ending as the right hand of the low clasp. Show both complete upper arms, elbows, forearms, wrists, palms, and finger clusters continuously. Her head alone turns left toward ECE without moving either hand toward the compass.
Alia remains isolated in strict right-facing profile. Her right arm ends in the primary mission grip and her left arm ends in the separate support grip beneath the grip base. Both arms, wrists, palms, and finger clusters are fully separated against plain empty pavement.
Exactly eight human arms and exactly eight human hands, two per woman. The three and only three relationship contacts are Radiance's left palm on Ellie's covered right shoulder, Ellie's left support palm on Radiance's near left shoulder blade, and their low right-hand clasp below both hips. The two raised forearms cross visually in open air but do not touch or merge. No forearm contact or body brace is required. No hand emerges from behind a torso, head, hair, waist, garment, table, prop, or another hand. No extra touch, hidden hand, decorative hand, borrowed limb, fused wrist, duplicate finger cluster, ambiguous owner path, or non-ECE hand on the compass.`;
if (!handBlock.test(prompt)) throw new Error("Hand block missing");
prompt = prompt.replace(handBlock, newHandBlock);

prompt = prompt.replace(
  /ODD PROP AND ROUTE STRATEGY[\s\S]*?(?=\n\nMASCOT STATE)/,
  `ODD PROP AND ROUTE STRATEGY
Odd-prop roll 12 = ACTIVE. Holder selector roll 86 = AI ECE. Prop-family selector roll 88 = one oversized magnetic compass table. Interpret it as one bold circular compass face on a narrow waist-high pedestal in ECE's isolated far-left lane. Two tall separate brass handles stand at opposite edges; ECE alone holds them, one hand per handle. She integrates it into the relationship by rotating the visible compass heading toward Radiance while sharing their sustained mutual eye line. A separate small translucent blue holographic route map rises hands-free from the center, showing a coastline and three route nodes with no readable text or logo. Nobody else touches the compass, map, pedestal, handles, or ECE.`,
);

prompt = prompt.replace(
  /MASCOT STATE[\s\S]*?(?=\n\nMISSION PROP AND TARGET)/,
  `MASCOT STATE
Mascot roll 15 = PAWS plus MAX; mascot holder selector roll 16 = Ellie. Show exactly one tiny collarless golden kitten PAWS and exactly one distinct small young golden retriever puppy MAX sharing one harmless supervised nose-to-paw play beat entirely inside one raised cream padded lounge at the far lower-left corner. All paws stay on its dry cushion. Ellie supervises with one calm secondary glance while keeping both support hands fixed. Keep the lounge behind and left of Alia's muzzle plane and far from the sea edge, wet drop, compass, safety panel, target lane, and every prop. Neither animal wears any collar, ribbon, harness, leash, neckband, or accessory. No duplicate animal, adult dog, ledge, runoff, or unsafe footing.`,
);

prompt = prompt.replace(
  /MISSION PROP AND TARGET[\s\S]*?(?=\n\nDECLUTTER AND FINAL GATES)/,
  `MISSION PROP AND TARGET
Pose-target roll 25; resolved handler = Alia because rainbow hosiery is active. Alia is the rightmost adult in strict right-facing profile and uses one realistic eye-level two-hand large-frame-pistol stance at one plain non-humanoid paper route diamond on a complete narrow freestanding sand backstop. Both hands are visibly owned on one grip, wrists straight, elbows modestly bent, shoulders slightly forward, and sights aligned. Her secure strapless copper front and side shell remains opaque with complete public-safe coverage while its self-supporting side panels terminate before both rear ribs, leaving one continuous bare upper and middle back with no halter, neck loop, shoulder strap, back strap, rear band, closure, mesh, fabric, or decorative cord.
Show exactly one unmistakably full-size approximately thirty-centimeter dark polished-steel Desert Eagle-style large-frame inert cinema-training replica in close side profile occupying about twenty percent of frame width. It has restrained metallic heat-anodized rainbow highlights, a compact short barrel, one substantial grip, one complete oversized black oval trigger guard, and one small orange safety insert only inside the muzzle. It reads as heavy machined metal, never bright plastic, water pistol, toy, rifle, carbine, shotgun, or long gun. Alia's primary right hand wraps the grip. Her right trigger index is one long fully extended straight finger lying flat on the metal side plate above and entirely outside the guard. Show clean air between finger and guard and keep the entire black oval guard visibly empty. Her separate support left palm cups only the lower front of the primary fist and grip base. Show two distinct wrists, palms, and finger clusters.
Place one complete transparent rectangular safety panel centered around 70 percent of frame width, with all four orange-capped corners comfortably inside frame. Beyond it, place one complete narrow tall thick sand backstop centered around 80 percent with its right edge no farther than 86 percent. Leave at least one full backstop-width of empty wet promenade visibly continuing between the backstop and the right frame edge. Fix one white paper square with one black non-humanoid route diamond on the backstop so Alia's dominant eye, barrel center, orange muzzle center, and diamond center occupy one exact horizontal shoulder-height row. Keep clean empty air between muzzle, panel, paper, backstop, and every frame edge. Every person, mascot, landmark, public path, vehicle, and occupied object remains behind and left of the muzzle plane. No beam, tracer, line, laser, cord, string, path, or glow trail.
No ammunition, loose magazine, firing, muzzle flash, reload, holster, threat, injury, combat, or aim at a person, animal, occupied object, or camera. ECE's separate holographic route map remains hands-free.`,
);

prompt = prompt.replace(
  /The clean photograph must pass exact identity,[^\n]+/,
  "The clean photograph must pass exact identity, eight-arm, eight-hand, continuous owner-path, three vertically separated contact romance, explicit Radiance affirmative with partyActivation true for exactly Radiance and ECE, Ellie and Alia visibly outside the party beat, Radiance-ECE affectionate center, ECE-exclusive compass ownership, collarless mascots, wardrobe-roll, Alia strapless fully open back, full-size metallic inert training replica, exact horizontal target axis, complete safety panel, complete four-edge backstop with one backstop-width of visible promenade beyond it, indexed-trigger, location-theme fusion, and surface-quality gates.",
);

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
  "partyActivation = TRUE",
  "willing participants = Radiance, AI ECE",
  "Exactly eight human arms and exactly eight human hands",
  "entire black oval guard visibly empty",
  "one full backstop-width of empty wet promenade",
];
for (const value of required) if (!prompt.includes(value)) throw new Error(`Missing materialized field: ${value}`);
for (const [name, character] of Object.entries(plan.characters)) {
  const emotion = character.emotion.materializedResult ?? character.emotion.result;
  if (!prompt.includes(`${name}: emotion roll ${character.emotion.roll} = ${emotion}`)) throw new Error(`Missing ${name} emotion`);
  if (!prompt.includes(`visible-midriff roll ${character.visibleMidriff.roll}`)) throw new Error(`Missing ${name} midriff`);
  if (!prompt.includes(`strapless roll ${character.straplessDress.roll}`)) throw new Error(`Missing ${name} strapless`);
  if (!prompt.includes(`fully-open-back roll ${character.fullyOpenBack.roll}`)) throw new Error(`Missing ${name} open back`);
}
if (/round40|round-40|willing participants = Radiance, Ellie, AI ECE/.test(prompt)) throw new Error("Stale round-40 party state remains");

const promptPath = path.join(root, `scene-${scene}-clean-fresh-round-${round}-prompt.txt`);
fs.writeFileSync(promptPath, prompt, "utf8");
const promptAudit = {
  path: path.relative(repo, promptPath).replaceAll("\\", "/"),
  sha256: sha256(prompt),
  chars: prompt.length,
  storedContractRollsChanged: false,
  freshRound: round,
  sourceMode: "clean-generation-from-original-identity-anchors",
  priorBatumiRenderInputCount: 0,
  promptTemplate: { path: path.relative(repo, templatePromptPath).replaceAll("\\", "/"), sha256: sha256(fs.readFileSync(templatePromptPath, "utf8")), usage: "text-only contract template; no Batumi image pixels or visual texture inherited" },
  referenceAudit,
  plannedPasses: { cleanFreshPasses: 1, maximumTargetedRecoveryPasses: 1, recoverySourceIfNeeded: "only the clean round 41 fresh raw", laterFreshSourcePolicy: "original identity anchors only" },
  radianceRealtimeAgreementParty: radiancePartyState,
  redesignedComposition: {
    lanes: ["ECE and compass far left", "Ellie and Radiance center-left", "Alia right", "panel and complete backstop middle-right with promenade beyond"],
    eyeLine: "Radiance's head turns left directly to ECE while all four relationship arms remain within the center-left lane",
    handGraph: { ECE: ["left compass handle", "right compass handle"], Ellie: ["middle back-support palm", "low clasp"], Radiance: ["high shoulder palm", "low clasp"], Alia: ["primary mission grip", "separate support grip"] },
    relationshipContacts: 3,
    partyGraph: "party active for Radiance and ECE only; Ellie remains non-party support and Alia remains non-party mission handler",
    missionGeometry: "Alia at 59 percent, complete panel around 70 percent, complete backstop centered around 80 percent with one full backstop-width of visible promenade beyond",
  },
  hardSurfaceQualityGate: ["no wavy or marbled processing", "no liquify or melted geometry", "no embossed or over-sharpened edges", "no rippled skin or fabric", "no bent architecture panel or backstop edges", "clean natural photographic texture"],
};

plan.freshRound41 = { ...promptAudit, prompt };
plan.radianceRealtimeAgreementParty = radiancePartyState;
const preparedAt = new Date().toISOString();
checkpoint.status = "active-four-scene-gate-clean-fresh-round-41-materialized";
checkpoint.checkpointedAt = preparedAt;
checkpoint.terminal = false;
checkpoint.countryCompletionGate = { ...checkpoint.countryCompletionGate, acceptedSceneCount: 3, missingSceneNumbers: [scene], gitCheckpointPushed: true, xPublicStatusVerified: false, queueAdvanceAllowed: false, gateSatisfied: false };
checkpoint.renderAttempts.freshRound41 = {
  status: "materialized-pending-launch",
  preparedAt,
  sceneNumbers: [scene],
  preservedAcceptedSceneNumbers: [1548, 1549, 1550],
  concurrency: "one clean missing-scene built-in generation",
  maximumRecoveryPassesPerBlockedScene: 1,
  promptAudit: { [scene]: promptAudit },
  storedContractRollsChanged: false,
  priorBatumiRenderInputCount: 0,
  radianceRealtimeAgreementParty: radiancePartyState,
};
checkpoint.renderStrategyReset = { ...checkpoint.renderStrategyReset, activeCleanRound: round, activeSourcePolicy: "four original identity anchors only", priorBatumiRenderInputCount: 0 };
checkpoint.xBacklogAudit = {
  ...checkpoint.xBacklogAudit,
  checkedAt: preparedAt,
  signedIn: false,
  sessionState: "in-app-X-webview-attach-timeout-this-wake",
  eligibleBacklogRemaining: 0,
  pendingPost: null,
  preparedPostQueueCount: 0,
  deferredPostCheckpoint: null,
  reconciliationDecision: "The authoritative ledger has no eligible pending, prepared, or deferred item. Live X verification could not attach this wake; Georgia remains publication-blocked at three accepted scenes and no upload or country advance is permitted.",
};
checkpoint.xPost.status = "blocked-active-country-incomplete-and-X-session-retry-required";
checkpoint.xPost.url = null;
checkpoint.xPost.acceptedCurrentCountryAssets = 3;
checkpoint.xPost.note = "Georgia has accepted scenes 1548, 1549, and 1550. Clean round 41 is materialized for missing scene 1551 from original identity anchors only with an explicit Radiance affirmative limited to Radiance and ECE; Ellie remains the non-party support partner and Alia remains the non-party mission handler. The live X webview also requires retry. Publication remains mandatory after scene 1551 is accepted and the four-scene completion checkpoint is pushed.";
checkpoint.nextQueueStatus = "locked-on-Georgia-until-four-accepted-git-pushed-and-X-live-verified";
checkpoint.nextWakeAction = { country: "Georgia", batch: 382, action: "launch-clean-fresh-round-41-from-original-identity-anchors-scene-1551-only", preserveAcceptedSceneNumbers: [1548, 1549, 1550], sceneNumbers: [scene], laterCountryStartAllowed: false };

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ status: checkpoint.status, promptAudit, nextWakeAction: checkpoint.nextWakeAction }, null, 2));
