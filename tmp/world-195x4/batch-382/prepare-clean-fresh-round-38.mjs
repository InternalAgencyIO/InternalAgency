import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const root = path.join(repo, "tmp/world-195x4/batch-382");
const checkpointPath = path.join(repo, "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json");
const contractPath = path.join(repo, "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const ledgerPath = path.join(repo, "assets/lore/starlight-era/world-x-publish-ledger.json");
const templatePromptPath = path.join(root, "scene-1551-clean-fresh-round-37-prompt.txt");
const scene = 1551;
const round = 38;
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

if (sha256File(contractPath) !== "69EB6C84A2467A4234D901C3086ECECE9E583B55C41BB9382CD5ED523C482EF5") throw new Error("Contract changed before round 38");
if (sha256File(ledgerPath) !== "B94AA3FB2B1AB1BCAB100CE689F0173C77407B82439D73379D8BC0FA3EEC2455") throw new Error("Ledger changed before round 38");
if (!contract.romance?.radianceRealtimeAgreementPartyRule) throw new Error("Radiance agreement rule missing");
if (checkpoint.status !== "active-four-scene-gate-incomplete-after-clean-fresh-round-37") throw new Error(`Unexpected status: ${checkpoint.status}`);
if (checkpoint.renderStrategyReset?.nextCleanRound !== round) throw new Error("Checkpoint does not authorize round 38");
if (checkpoint.renderAttempts.freshRound38) throw new Error("Round 38 already materialized");

const referenceAudit = references.map(([relativePath, role, expectedSha256], index) => {
  const actualSha256 = sha256File(path.join(repo, relativePath));
  if (actualSha256 !== expectedSha256) throw new Error(`Identity anchor ${index + 1} changed`);
  return { image: index + 1, path: relativePath, role, sha256: actualSha256, exists: true };
});

const invitationKey = "batch382-georgia-scene1551-radianceLiveInvitation-round38";
const responseKey = "batch382-georgia-scene1551-radianceLiveResponse-round38";
const participantsKey = "batch382-georgia-scene1551-radianceLiveParticipants-round38";
const invitationFullHash = fnv1a(invitationKey);
const responseFullHash = fnv1a(responseKey);
const participantsFullHash = fnv1a(participantsKey);
const invitationRoll = invitationFullHash % 100;
const responseRoll = responseFullHash % 100;
const participantsRoll = participantsFullHash % 100;
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
const radianceResponse = "Radiance explicitly accepts ECE's offered single celebration step with one clear up-down nod and broad willing smile toward ECE, then gives Ellie's existing low clasp one visible reciprocal squeeze while keeping her other palm on Ellie's shoulder.";
const radiancePartyState = {
  round,
  rollMethod: "FNV-1a over recorded round-38 live-narrative keys, reduced modulo 100",
  invitation: { key: invitationKey, fullHash: invitationFullHash, roll: invitationRoll, selectorIndex: invitationRoll % invitations.length },
  response: { key: responseKey, fullHash: responseFullHash, roll: responseRoll, thresholds: "0-69 explicit affirmative; 70-84 explicit redirect; 85-94 explicit pause; 95-99 explicit decline", category: responseCategory },
  participantSelector: { key: participantsKey, fullHash: participantsFullHash, roll: participantsRoll, thresholds: "0-24 Radiance+ECE; 25-49 Radiance+Ellie+ECE; 50-74 all four; 75-99 Radiance+ECE+Alia", hypotheticalSetIfAffirmative: participantSet },
  offeredChoice,
  radianceResponse,
  partyActivation,
  willingParticipants,
  visibleAgreementEvidence: [
    "Radiance's clear up-down nod and broad willing smile toward ECE",
    "Radiance's reciprocal squeeze in the existing low clasp with Ellie",
    "Ellie's willing smile while maintaining stable support",
    "ECE's willing smile toward Radiance while both compass hands stay fixed",
    "Alia's willing profile smile while both mission hands and her downrange sight line stay fixed",
  ],
  visibleResponseEvidence: [],
  continuityState: "Radiance accepts exactly one fully clothed public-safe celebration step with Ellie, ECE, and Alia. Ellie retains stable dip support, ECE retains both compass hands, and Alia retains both mission hands in the closed safe lane.",
  consentScope: "This affirmative applies only to this recorded round-38 one-step invitation in scene 1551 and only to Radiance, Ellie, ECE, and Alia. It does not transfer to another act, prop interaction, scene, country, or future image.",
};
if (invitationFullHash !== 3808880159 || invitationRoll !== 59 || invitationRoll % invitations.length !== 3) throw new Error("Round 38 invitation roll changed");
if (responseFullHash !== 2767209051 || responseRoll !== 51 || responseCategory !== "explicit affirmative") throw new Error("Round 38 response roll changed");
if (participantsFullHash !== 1069693658 || participantsRoll !== 58 || participantSet.join("|") !== "Radiance|Ellie|AI ECE|Alia") throw new Error("Round 38 participant roll changed");
if (!partyActivation || willingParticipants.join("|") !== participantSet.join("|")) throw new Error("Round 38 party state mismatch");

const templatePrompt = fs.readFileSync(templatePromptPath, "utf8");
let prompt = templatePrompt.replaceAll("round 37", "round 38");

const compositionBlock = /SIMPLE SEPARATED COMPOSITION[\s\S]*?(?=\n\nDETERMINISTIC CHARACTER ROLLS)/;
const newCompositionBlock = `SIMPLE SEPARATED COMPOSITION
Use one clean 24 mm eye-level full-body exposure with generous plain negative space and no layered arms. Ellie stands at far left around 16 percent of frame width in front-three-quarter right-facing view, both feet planted and both shoulders visible. Radiance stands left-center around 34 percent, rear-three-quarter to camera with her entire bare upper and middle back visible, both complete feet planted in a shallow fifteen-degree supported lean toward Ellie. Keep a twenty-centimeter open-air gap between their torsos. Arrange their four relationship hands as three vertically separated contacts: HIGH contact, Radiance's bare left arm extends left through clear sky and her open left palm rests on top of Ellie's white-covered right shoulder; MIDDLE contact, Ellie's white-sleeved left arm extends right through clear sea and her open left palm rests high on Radiance's near left shoulder blade; LOW contact, Ellie's white-sleeved right arm and Radiance's bare right arm descend separately into the empty gap and meet in one low right-hand clasp below both hips. Every shoulder, upper arm, elbow, forearm, wrist, palm, and finger cluster is visible continuously, with no arm hidden behind a torso or hair. Put ECE front-on around 54 percent behind one narrow compass pedestal with both complete arms descending to opposite tall handles. Put Alia around 73 percent in close rear-three-quarter strict right-facing profile, complete body and footwear in frame, with her large continuous bare upper and middle back visible. Her front-only strapless copper shell ends before both rear ribs and has no rear closure; a four-centimeter bare waist band separates it from the cobalt skort. Alia's exact two arms and hands hold one full-size 30-centimeter dark polished-metal inert training replica in large clean side profile occupying about twenty-two percent of frame width. Her right trigger index is one long straight finger flat along the metal side plate above and entirely outside a complete empty black oval guard. Place one complete transparent rectangular safety panel with four small orange corner caps in the empty lane to the right of the muzzle. Place one complete thick sand backstop just beyond that panel, fully inside the far-right frame with rainy margin on all four sides. Fix one white paper route diamond at Alia's exact eye, barrel-center, muzzle-center, and shoulder-height horizontal row. Keep every person, mascot, and occupied object behind and left of the muzzle plane. Reserve lower-left for the dry mascot lounge and the upper third for Batumi's recognizable Alphabet Tower, Ferris wheel, Black Sea, palms, and skyline. No cropped foot, foreground overlap, decorative clutter, curved architecture, or hidden contact.`;
if (!compositionBlock.test(prompt)) throw new Error("Composition block missing");
prompt = prompt.replace(compositionBlock, newCompositionBlock);

const globalBlock = /GLOBAL VISUAL ROLLS[\s\S]*?(?=\n\nROLLED LOVE STORY)/;
const newGlobalBlock = `GLOBAL VISUAL ROLLS
Pole-theme roll 67 = inactive; show no pole. Rainbow-only roll 15 = inactive; do not convert the group wardrobe to rainbow styling. Rainbow-hosiery roll 14 = ACTIVE; wearer selector roll 38 = Radiance; palette selector roll 54 = original independent rainbow gradient. Radiance and ECE remain the affectionate narrative center through a sustained warm mutual eye line. partyActivation is TRUE for exactly Radiance, Ellie, AI ECE, and Alia. Express their shared one-step celebration only through willing smiles, Radiance's nod and clasp squeeze, Ellie's stable support, ECE's eye line while both compass hands remain fixed, and Alia's willing profile smile while both mission hands remain fixed. Add no heel lift in the mission lane and no party object. Alia alone handles the inert mission prop.`;
if (!globalBlock.test(prompt)) throw new Error("Global block missing");
prompt = prompt.replace(globalBlock, newGlobalBlock);

const loveBlock = /ROLLED LOVE STORY[\s\S]*?(?=\n\nRADIANCE LIVE CHOICE AND RESPONSE)/;
const newLoveBlock = `ROLLED LOVE STORY
Romance roll 86 = Alia spins Radiance under linked hands while ECE steadies Radiance and Ellie reaches toward the beacon. Show the completed spin settling into Ellie's shallow supported lean while Radiance accepts ECE's offered single celebration step. The spin is already complete; do not add literal hands beyond the exact graph below.
Compound-love roll 28 = ECE stays close at Radiance's side while warmly greeting Ellie and Alia answers beside them. Materialize its square through Radiance and ECE's sustained affectionate eye line, Ellie's willing support, and Alia's willing profile smile while every task hand remains fixed.
Hard-love roll 40 = a controlled dance dip with stable planted feet and supported back, a second partner catching the dipped adult's free hand, and the fourth answering with visible jealousy or invitation. Ellie visibly supports Radiance through the middle support palm and low caught-hand clasp; Radiance visibly answers with her high palm on Ellie's covered shoulder. These three and only three relationship contacts are large, ordinary, vertically separated, and unmistakable. Alia answers as the inviting fourth through her willing profile smile while remaining safely downrange. ECE remains the affectionate center through eye line while owning the compass.`;
if (!loveBlock.test(prompt)) throw new Error("Love block missing");
prompt = prompt.replace(loveBlock, newLoveBlock);

const partyBlock = /RADIANCE LIVE CHOICE AND RESPONSE[\s\S]*?(?=\n\nEXACT EIGHT-ARM, EIGHT-HAND GRAPH)/;
const newPartyBlock = `RADIANCE LIVE CHOICE AND RESPONSE
Invitation key ${invitationKey}; full hash ${invitationFullHash}; roll ${invitationRoll}; selector index ${invitationRoll % invitations.length}.
Offered choice: ${offeredChoice}
Response key ${responseKey}; full hash ${responseFullHash}; roll ${responseRoll}; result = ${responseCategory}.
Participant-selector key ${participantsKey}; full hash ${participantsFullHash}; roll ${participantsRoll}; willing participants = ${willingParticipants.join(", ")}.
Radiance response: ${radianceResponse}
partyActivation = TRUE. Show exactly one adult, consensual, fully clothed, public-safe InternalAgency celebration step involving exactly Radiance, Ellie, AI ECE, and Alia. Radiance visibly nods and smiles toward ECE while squeezing Ellie's existing low clasp. Ellie gives one willing smile while maintaining stable support. ECE gives one willing smile toward Radiance while both hands remain on opposite compass handles. Alia gives one willing profile smile while both mission hands, both feet, and her rightward sight line remain fixed. Add no party object, crowd, drink, confetti, balloon, sign, text, stage, ornament, or unsafe heel lift. Agreement is limited to this exact invitation, participant set, and one step.`;
if (!partyBlock.test(prompt)) throw new Error("Party block missing");
prompt = prompt.replace(partyBlock, newPartyBlock);

const handBlock = /EXACT EIGHT-ARM, EIGHT-HAND GRAPH[\s\S]*?(?=\n\nODD PROP AND ROUTE STRATEGY)/;
const newHandBlock = `EXACT EIGHT-ARM, EIGHT-HAND GRAPH
Ellie's white-sleeved left arm begins at her fully visible left shoulder and extends horizontally right through clear sea, ending in one open support palm high on Radiance's near left shoulder blade. Ellie's separate white-sleeved right arm begins at her fully visible right shoulder and descends diagonally right through the empty torso gap, ending as the left hand of the low clasp. Show both complete sleeves, elbows, forearms, wrists, palms, and finger clusters continuously.
Radiance's bare left arm begins at her fully visible left shoulder and extends horizontally left through clear sky, ending in one open palm on top of Ellie's white-covered right shoulder. Radiance's separate bare right arm begins at her fully visible right shoulder and descends diagonally left through the empty torso gap, ending as the right hand of the low clasp. Show both complete upper arms, elbows, forearms, wrists, palms, and finger clusters continuously.
ECE stands front-on in her own lane. Her left arm descends visibly to the tall left compass handle and her right arm descends visibly to the tall right handle. Both arms and hands are separated by the compass face. ECE touches no person and owns the compass alone.
Alia remains isolated in rear-three-quarter strict right-facing profile. Her right arm ends in the primary mission grip and her left arm ends in the separate support grip beneath the grip base. Both arms, wrists, palms, and finger clusters are fully separated against plain empty pavement.
Exactly eight human arms and exactly eight human hands, two per woman. The three and only three relationship contacts are Radiance's left palm on Ellie's covered right shoulder, Ellie's left support palm on Radiance's near left shoulder blade, and their low right-hand clasp below both hips. No forearm contact or body brace is required. No hand emerges from behind a torso, head, hair, waist, garment, table, prop, or another hand. No extra touch, hidden hand, decorative hand, borrowed limb, fused wrist, duplicate finger cluster, or ambiguous owner path.`;
if (!handBlock.test(prompt)) throw new Error("Hand block missing");
prompt = prompt.replace(handBlock, newHandBlock);

prompt = prompt.replace(
  /MISSION PROP AND TARGET[\s\S]*?(?=\n\nDECLUTTER AND FINAL GATES)/,
  `MISSION PROP AND TARGET
Pose-target roll 25; resolved handler = Alia because rainbow hosiery is active. Alia is the rightmost adult in strict right-facing profile and uses one realistic eye-level two-hand large-frame-pistol stance at one plain non-humanoid paper route diamond on a complete thick sand backstop. Both hands are visibly owned on one grip, wrists straight, elbows modestly bent, shoulders slightly forward, and sights aligned. Alia's secure strapless copper front and side shell remains fully opaque with complete public-safe bust coverage while its side panels stop before her fully open back.
Show exactly one unmistakably full-size approximately 30-centimeter dark polished-steel Desert Eagle-style large-frame inert cinema-training replica in close side profile occupying about twenty-two percent of frame width. It has restrained metallic heat-anodized rainbow highlights over steel, a compact short barrel, one substantial grip, one complete oversized black oval trigger guard, and one small orange safety insert only inside the muzzle. It reads as heavy machined metal, never bright plastic, water pistol, squirt gun, toy, rifle, carbine, shotgun, or long gun. Angle its right side plate toward camera. Alia's primary right hand wraps the grip. Her right trigger index is one long fully extended straight finger lying flat on the metal side plate above and entirely outside the guard. Show clean air between finger and guard and keep the entire black oval guard visibly empty. Her support left palm cups only the lower front of the primary fist and grip base as a second separate cluster below and forward. Show two distinct wrists, palms, and finger clusters with clean air around the guard.
Place one complete transparent rectangular safety panel with four small orange corner caps several visible meters to the right of the muzzle. Beyond it, place one complete tall thick sand backstop fully inside frame with rainy margin on top, bottom, left, and right. Fix one white paper square with one black non-humanoid route diamond on the backstop so Alia's dominant eye, barrel center, orange muzzle center, and diamond center occupy one exact horizontal shoulder-height row. Keep clean empty air between muzzle, panel, paper, and backstop. The paper never overlaps the replica. Every person, mascot, landmark, public path, vehicle, and occupied object remains behind and left of the muzzle plane. No beam, tracer, line, laser, cord, string, path, or glow trail.
No ammunition, loose magazine, firing, muzzle flash, reload, holster, threat, injury, combat, or aim at a person, animal, occupied object, or camera. ECE's separate holographic route map remains hands-free.`,
);

prompt = prompt.replace(
  "No duplicate animal, adult dog, collar, ledge, runoff, or unsafe footing.",
  "Neither animal wears any collar, ribbon, harness, leash, neckband, or accessory. No duplicate animal, adult dog, ledge, runoff, or unsafe footing.",
);
prompt = prompt.replace(
  /The clean photograph must pass exact identity,[^\n]+/,
  "The clean photograph must pass exact identity, eight-arm, eight-hand, continuous owner-path, three vertically separated contact romance, explicit Radiance affirmative with partyActivation true for all four willing adults, Radiance-ECE affectionate center, collarless mascots, wardrobe-roll, full-size metallic inert training replica, exact horizontal target axis, complete safety panel, indexed-trigger, location-theme fusion, and surface-quality gates.",
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
  "willing participants = Radiance, Ellie, AI ECE, Alia",
  "Exactly eight human arms and exactly eight human hands",
  "entire black oval guard visibly empty",
  "about twenty-two percent of frame width",
];
for (const value of required) if (!prompt.includes(value)) throw new Error(`Missing materialized field: ${value}`);
for (const [name, character] of Object.entries(plan.characters)) {
  const emotion = character.emotion.materializedResult ?? character.emotion.result;
  if (!prompt.includes(`${name}: emotion roll ${character.emotion.roll} = ${emotion}`)) throw new Error(`Missing ${name} emotion`);
  if (!prompt.includes(`visible-midriff roll ${character.visibleMidriff.roll}`)) throw new Error(`Missing ${name} midriff`);
  if (!prompt.includes(`strapless roll ${character.straplessDress.roll}`)) throw new Error(`Missing ${name} strapless`);
  if (!prompt.includes(`fully-open-back roll ${character.fullyOpenBack.roll}`)) throw new Error(`Missing ${name} open back`);
}
if (/partyActivation = FALSE|actual willing participants = none|explicit pause/.test(prompt)) throw new Error("Stale pause state remains");

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
  promptTemplate: { path: path.relative(repo, templatePromptPath).replaceAll("\\", "/"), sha256: sha256(templatePrompt), usage: "text-only contract template; no Batumi image pixels or visual texture inherited" },
  referenceAudit,
  plannedPasses: { cleanFreshPasses: 1, maximumTargetedRecoveryPasses: 1, recoverySourceIfNeeded: "only the clean round 38 fresh raw", laterFreshSourcePolicy: "original identity anchors only" },
  radianceRealtimeAgreementParty: radiancePartyState,
  redesignedComposition: {
    dipOwnership: "Ellie and rear-three-quarter Radiance use high shoulder palm, middle back-support palm, and low clasp with all four owner arms visible through separate air lanes",
    handGraph: { Ellie: ["middle back-support palm", "low clasp"], Radiance: ["high shoulder palm", "low clasp"], ECE: ["left compass handle", "right compass handle"], Alia: ["primary mission grip", "separate support grip"] },
    relationshipContacts: 3,
    partyGraph: "party active for all four through smiles, nod, clasp squeeze, eye lines, and fixed safe task hands",
    missionGeometry: "Alia close right with self-supporting front-only shell, open back, large metal side-profile replica, complete empty guard, complete panel, and exact horizontal target row",
  },
  hardSurfaceQualityGate: ["no wavy or marbled processing", "no liquify or melted geometry", "no embossed or over-sharpened edges", "no rippled skin or fabric", "no bent architecture or safety panels", "clean natural photographic texture"],
};

plan.freshRound38 = { ...promptAudit, prompt };
plan.radianceRealtimeAgreementParty = radiancePartyState;
const preparedAt = new Date().toISOString();
checkpoint.status = "active-four-scene-gate-clean-fresh-round-38-materialized";
checkpoint.checkpointedAt = preparedAt;
checkpoint.terminal = false;
checkpoint.countryCompletionGate = { ...checkpoint.countryCompletionGate, acceptedSceneCount: 3, missingSceneNumbers: [scene], gitCheckpointPushed: true, xPublicStatusVerified: false, queueAdvanceAllowed: false, gateSatisfied: false };
checkpoint.renderAttempts.freshRound38 = {
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
  reconciliationDecision: "The authoritative ledger has no eligible pending or prepared item. Live X verification could not attach this wake; Georgia remains publication-blocked at three accepted scenes and no upload or country advance is permitted.",
};
checkpoint.xPost.status = "blocked-active-country-incomplete-and-X-session-retry-required";
checkpoint.xPost.url = null;
checkpoint.xPost.acceptedCurrentCountryAssets = 3;
checkpoint.xPost.note = "Georgia has accepted scenes 1548, 1549, and 1550. Clean round 38 is materialized for missing scene 1551 from original identity anchors only with an explicit Radiance affirmative for all four adults. The live X webview also requires retry; publication remains mandatory after scene 1551 is accepted and the four-scene completion checkpoint is pushed.";
checkpoint.nextQueueStatus = "locked-on-Georgia-until-four-accepted-git-pushed-and-X-live-verified";
checkpoint.nextWakeAction = { country: "Georgia", batch: 382, action: "launch-clean-fresh-round-38-from-original-identity-anchors-scene-1551-only", preserveAcceptedSceneNumbers: [1548, 1549, 1550], sceneNumbers: [scene], laterCountryStartAllowed: false };

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ status: checkpoint.status, promptAudit, nextWakeAction: checkpoint.nextWakeAction }, null, 2));
