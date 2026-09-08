import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const root = path.join(repo, "tmp/world-195x4/batch-382");
const checkpointPath = path.join(repo, "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json");
const contractPath = path.join(repo, "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const ledgerPath = path.join(repo, "assets/lore/starlight-era/world-x-publish-ledger.json");
const templatePromptPath = path.join(root, "scene-1551-clean-fresh-round-36-prompt.txt");
const scene = 1551;
const round = 37;
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

if (sha256File(contractPath) !== "69EB6C84A2467A4234D901C3086ECECE9E583B55C41BB9382CD5ED523C482EF5") throw new Error("Contract changed before round 37");
if (sha256File(ledgerPath) !== "B94AA3FB2B1AB1BCAB100CE689F0173C77407B82439D73379D8BC0FA3EEC2455") throw new Error("Ledger changed before round 37");
if (!contract.romance?.radianceRealtimeAgreementPartyRule) throw new Error("Radiance agreement rule missing");
if (checkpoint.status !== "active-four-scene-gate-incomplete-after-clean-fresh-round-36") throw new Error(`Unexpected status: ${checkpoint.status}`);
if (checkpoint.renderStrategyReset?.nextCleanRound !== round) throw new Error("Checkpoint does not authorize round 37");
if (checkpoint.renderAttempts.freshRound37) throw new Error("Round 37 already materialized");

const referenceAudit = references.map(([relativePath, role, expectedSha256], index) => {
  const actualSha256 = sha256File(path.join(repo, relativePath));
  if (actualSha256 !== expectedSha256) throw new Error(`Identity anchor ${index + 1} changed`);
  return { image: index + 1, path: relativePath, role, sha256: actualSha256, exists: true };
});

const invitationKey = "batch382-georgia-scene1551-radianceLiveInvitation-round37";
const responseKey = "batch382-georgia-scene1551-radianceLiveResponse-round37";
const participantsKey = "batch382-georgia-scene1551-radianceLiveParticipants-round37";
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
const hypotheticalParticipantSet = participantsRoll <= 24
  ? ["Radiance", "AI ECE"]
  : participantsRoll <= 49
    ? ["Radiance", "Ellie", "AI ECE"]
    : participantsRoll <= 74
      ? ["Radiance", "Ellie", "AI ECE", "Alia"]
      : ["Radiance", "AI ECE", "Alia"];
const willingParticipants = partyActivation ? hypotheticalParticipantSet : [];
const radianceResponse = "Radiance explicitly pauses Alia's optional victory-count invitation by raising her existing open left palm toward Alia in a clear wait gesture, closing her smile into a thoughtful expression, and keeping both planted feet still. She does not begin a victory count.";
const radiancePartyState = {
  round,
  rollMethod: "FNV-1a over recorded round-37 live-narrative keys, reduced modulo 100",
  invitation: { key: invitationKey, fullHash: invitationFullHash, roll: invitationRoll, selectorIndex: invitationRoll % invitations.length },
  response: { key: responseKey, fullHash: responseFullHash, roll: responseRoll, thresholds: "0-69 explicit affirmative; 70-84 explicit redirect; 85-94 explicit pause; 95-99 explicit decline", category: responseCategory },
  participantSelector: { key: participantsKey, fullHash: participantsFullHash, roll: participantsRoll, thresholds: "0-24 Radiance+ECE; 25-49 Radiance+Ellie+ECE; 50-74 all four; 75-99 Radiance+ECE+Alia", hypotheticalSetIfAffirmative: hypotheticalParticipantSet },
  offeredChoice,
  radianceResponse,
  partyActivation,
  willingParticipants,
  visibleAgreementEvidence: [],
  visibleResponseEvidence: [
    "Radiance's large open left palm faces Alia as an unmistakable wait gesture",
    "Radiance's thoughtful closed-mouth expression replaces any celebration smile",
    "Radiance keeps both feet planted and performs no dance count",
    "ECE and Alia continue their separate route tasks without a party cue",
  ],
  continuityState: "Radiance pauses the optional count. Ellie continues the consensual dip support, ECE keeps both compass hands, and Alia maintains the closed safe downrange line. No InternalAgency party activates.",
  consentScope: "This pause applies only to this recorded round-37 invitation in scene 1551. It conveys no agreement to any act, participant, prop interaction, scene, country, or future image.",
};
if (invitationFullHash !== 3892768254 || invitationRoll !== 54 || invitationRoll % invitations.length !== 2) throw new Error("Round 37 invitation roll changed");
if (responseFullHash !== 2716876194 || responseRoll !== 94 || responseCategory !== "explicit pause") throw new Error("Round 37 response roll changed");
if (participantsFullHash !== 851584611 || participantsRoll !== 11 || hypotheticalParticipantSet.join("|") !== "Radiance|AI ECE") throw new Error("Round 37 participant roll changed");
if (partyActivation || willingParticipants.length !== 0) throw new Error("Round 37 party state mismatch");

const templatePrompt = fs.readFileSync(templatePromptPath, "utf8");
let prompt = templatePrompt.replaceAll("round 36", "round 37");

const compositionBlock = /SIMPLE SEPARATED COMPOSITION[\s\S]*?(?=\n\nDETERMINISTIC CHARACTER ROLLS)/;
const newCompositionBlock = `SIMPLE SEPARATED COMPOSITION
Use one clean 24 mm eye-level full-body exposure with generous plain negative space and no layered arms. Ellie stands front-on at far left around 18 percent of frame width with both feet planted wide and her white-covered right upper thigh angled inward as a visible stable brace. Radiance occupies left-center around 36 percent, rear-three-quarter to camera so her entire bare upper and middle back is visible, in a shallow fifteen-degree supported side dip with both complete feet planted. Their low right-hand clasp sits below both waists in the empty gap left of Radiance: Ellie's white-sleeved right arm and Radiance's bare right arm each show complete shoulders, upper arms, elbows, forearms, wrists, palms, and finger clusters. Ellie's separate white-sleeved left arm begins at her fully visible left shoulder, crosses visibly in front of her own torso, then runs through clean air to Radiance. Its broad white forearm presses visibly along Radiance's cobalt-covered left side ribs, and its open palm spreads on the near left shoulder blade while leaving most of Radiance's open back visible. As a fourth unmistakable contact, Radiance's cobalt-covered left outer hip rests firmly on Ellie's white-covered right upper thigh with a compressed garment-to-garment line and absolutely no air gap. Radiance's separate left arm raises one large open palm toward Alia as a clear wait gesture and touches nobody. Put ECE front-on around 57 percent behind one narrow compass pedestal, with both complete arms descending to opposite handles and a thoughtful affectionate eye line toward Radiance. Put Alia around 77 percent in close rear-three-quarter strict right-facing profile, complete body and footwear in frame. Her self-supporting strapless copper front-only shell ends before both rear ribs, leaving the entire upper and middle back bare with no rear closure; a clear four-centimeter bare waist band separates it from the cobalt skort. Her exact two arms and two hands hold one realistic 30-centimeter dark polished-metal inert training replica in clean side profile. The replica occupies about twenty percent of frame width, with its orange muzzle insert, one long straight indexed finger flat above a completely empty guard, and a separate support hand visible. Put the entire thick sand backstop and its single paper route target inside the far-right frame with a wide rainy margin on all four sides. Reserve lower-left for the dry mascot lounge and the upper third for Batumi's recognizable Alphabet Tower, Ferris wheel, sea, palms, and skyline. No cropped foot, foreground overlap, decorative clutter, curved architecture, or body gap at the stated contact regions.`;
if (!compositionBlock.test(prompt)) throw new Error("Composition block missing");
prompt = prompt.replace(compositionBlock, newCompositionBlock);

prompt = prompt.replace(
  /Alia wears a rigid architectural strapless Mars-copper[\s\S]*?angular shield pumps complete the look\./,
  "Alia wears one self-supporting rigid Mars-copper front-only couture shell with a secure opaque straight strapless upper edge and complete public-safe bust coverage. The molded shell covers only her front and side ribs, then visibly terminates before both rear ribs through internal couture structure; there is no rear closure and no material across her upper or middle back. A clearly visible four-centimeter horizontal band of bare midriff separates the short front shell from a secure high-waisted cobalt pleated skort across both side and back. Braided palm-green conduits end only on the front side panels; angular shield pumps complete the look.",
);
prompt = prompt.replace(
  "No shoulder strap, sleeve, halter, collar, necklace, neck loop, rear band, crossing band, rear fabric panel, or illusion mesh. The bare upper back and bare midriff band must both remain large, unobstructed, and visually separate from the prop stance.",
  "No shoulder strap, sleeve, halter, collar, necklace, neck loop, rear closure, rear band, crossing band, rear fabric panel, or illusion mesh. Her bare upper and middle back forms one large continuous field of skin from shoulder blades to the separate bare waist band and remains visually separate from the prop stance.",
);

const globalBlock = /GLOBAL VISUAL ROLLS[\s\S]*?(?=\n\nROLLED LOVE STORY)/;
const newGlobalBlock = `GLOBAL VISUAL ROLLS
Pole-theme roll 67 = inactive; show no pole. Rainbow-only roll 15 = inactive; do not convert the group wardrobe to rainbow styling. Rainbow-hosiery roll 14 = ACTIVE; wearer selector roll 38 = Radiance; palette selector roll 54 = original independent rainbow gradient. Radiance and ECE remain the affectionate narrative center through a thoughtful sustained mutual eye line while Radiance gives Alia the explicit wait palm. partyActivation is FALSE because Radiance explicitly pauses the invitation. Show no party, victory count, dance cue, heel lift, celebratory smile, confetti, drink, crowd, or ornament. Alia alone handles the inert mission prop.`;
if (!globalBlock.test(prompt)) throw new Error("Global block missing");
prompt = prompt.replace(globalBlock, newGlobalBlock);

const loveBlock = /ROLLED LOVE STORY[\s\S]*?(?=\n\nRADIANCE LIVE CHOICE AND RESPONSE)/;
const newLoveBlock = `ROLLED LOVE STORY
Romance roll 86 = Alia spins Radiance under linked hands while ECE steadies Radiance and Ellie reaches toward the beacon. Show the completed spin settling into Ellie's unmistakable shallow side dip while Radiance pauses Alia's optional victory-count invitation. The spin is already complete; do not add literal hands beyond the exact graph below.
Compound-love roll 28 = ECE stays close at Radiance's side while warmly greeting Ellie and Alia answers beside them. Materialize its square through Radiance and ECE's sustained thoughtful affectionate eye line, Radiance's wait palm toward Alia, and Ellie's calm supportive exclusion.
Hard-love roll 40 = a controlled dance dip with stable planted feet and supported back, a second partner catching the dipped adult's free hand, and the fourth answering with visible jealousy or invitation. Ellie visibly supports Radiance with four clear contact regions: the low right-hand clasp, Ellie's broad left forearm along Radiance's covered side ribs, Ellie's open left palm on Radiance's near shoulder blade, and Radiance's covered left hip resting firmly on Ellie's covered right upper thigh. Alia is the inviting fourth through her clearly questioning profile expression while remaining safely downrange. Radiance visibly pauses that invitation with her open left wait palm. Add no other touch.`;
if (!loveBlock.test(prompt)) throw new Error("Love block missing");
prompt = prompt.replace(loveBlock, newLoveBlock);

const partyBlock = /RADIANCE LIVE CHOICE AND RESPONSE[\s\S]*?(?=\n\nEXACT EIGHT-ARM, EIGHT-HAND GRAPH)/;
const newPartyBlock = `RADIANCE LIVE CHOICE AND RESPONSE
Invitation key ${invitationKey}; full hash ${invitationFullHash}; roll ${invitationRoll}; selector index ${invitationRoll % invitations.length}.
Offered choice: ${offeredChoice}
Response key ${responseKey}; full hash ${responseFullHash}; roll ${responseRoll}; result = ${responseCategory}.
Participant-selector key ${participantsKey}; full hash ${participantsFullHash}; roll ${participantsRoll}; hypothetical affirmative set = ${hypotheticalParticipantSet.join(", ")}; actual willing participants = none because Radiance pauses.
Radiance response: ${radianceResponse}
partyActivation = FALSE. Materialize the pause as a valid adult consensual story outcome. Radiance's large open left palm faces Alia in a clear wait gesture, her smile closes into a thoughtful expression, and both feet remain planted. ECE keeps both hands on the compass and looks thoughtfully toward Radiance. Alia keeps both hands safely downrange and shows a clearly questioning rather than celebratory profile expression. Ellie remains calm and supportive. Nobody dances, nods yes, heel-taps, celebrates, or treats the pause as agreement. Add no party object, crowd, drink, confetti, balloon, sign, text, stage, or ornament. The pause is invitation-specific and transfers nowhere.`;
if (!partyBlock.test(prompt)) throw new Error("Party block missing");
prompt = prompt.replace(partyBlock, newPartyBlock);

const handBlock = /EXACT EIGHT-ARM, EIGHT-HAND GRAPH[\s\S]*?(?=\n\nODD PROP AND ROUTE STRATEGY)/;
const newHandBlock = `EXACT EIGHT-ARM, EIGHT-HAND GRAPH
Ellie stands upright at left. Her white-sleeved right arm begins at her fully visible right shoulder and runs diagonally down-right through empty sea to the left hand of the low clasp. Her separate white-sleeved left arm begins at her fully visible left shoulder, crosses visibly in front of her own white torso, and continues through clean air to Radiance. Its broad forearm lies visibly along Radiance's cobalt-covered left side ribs, then its open palm spreads on Radiance's near left shoulder blade. Show both sleeves, elbows, forearms, wrists, palms, and finger clusters continuously.
Radiance performs the rear-three-quarter shallow side dip with her large open back facing camera and both complete feet planted. Her bare right arm begins at her fully visible right shoulder and runs diagonally down-left through empty sea to the right hand of the low clasp. Her separate bare left arm rises toward Alia and ends in one large open wait palm with all five fingers separated; it touches nobody. Show both shoulders, upper arms, elbows, forearms, wrists, palms, and finger clusters continuously.
ECE stands front-on in her own lane. Her left arm descends visibly to the tall left compass handle and her right arm descends visibly to the tall right handle. Both arms and hands are separated by the compass face. ECE touches no person and owns the compass alone.
Alia remains isolated in rear-three-quarter strict right-facing profile. Her right arm ends in the primary mission grip and her left arm ends in the separate support grip beneath the grip base. Both arms, wrists, palms, and finger clusters are fully separated against plain empty pavement.
Exactly eight human arms and exactly eight human hands, two per woman. The four and only four relationship contact regions are Ellie and Radiance's low right-hand clasp, Ellie's broad left forearm against Radiance's covered side ribs, Ellie's open left palm on Radiance's near left shoulder blade, and Radiance's covered left hip resting on Ellie's covered right upper thigh with no air gap. Radiance's left wait palm touches nobody. No hand emerges from behind a torso, head, hair, waist, garment, table, prop, or another hand. No extra touch, hidden hand, decorative hand, borrowed limb, fused wrist, duplicate finger cluster, or ambiguous owner path.`;
if (!handBlock.test(prompt)) throw new Error("Hand block missing");
prompt = prompt.replace(handBlock, newHandBlock);

prompt = prompt.replace(
  /The clean photograph must pass exact identity,[^\n]+/,
  "The clean photograph must pass exact identity, eight-arm, eight-hand, continuous owner-path, four-contact conventional controlled-dip romance, explicit Radiance pause with partyActivation false and zero willing participants, Radiance-ECE affectionate center, mascot, wardrobe-roll, full-size metallic inert training replica, target-axis, indexed-trigger, location-theme fusion, and surface-quality gates.",
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
  "partyActivation = FALSE",
  "actual willing participants = none",
  "Exactly eight human arms and exactly eight human hands",
  "completely empty guard",
  "about twenty percent of frame width",
];
for (const value of required) if (!prompt.includes(value)) throw new Error(`Missing materialized field: ${value}`);
for (const [name, character] of Object.entries(plan.characters)) {
  const emotion = character.emotion.materializedResult ?? character.emotion.result;
  if (!prompt.includes(`${name}: emotion roll ${character.emotion.roll} = ${emotion}`)) throw new Error(`Missing ${name} emotion`);
  if (!prompt.includes(`visible-midriff roll ${character.visibleMidriff.roll}`)) throw new Error(`Missing ${name} midriff`);
  if (!prompt.includes(`strapless roll ${character.straplessDress.roll}`)) throw new Error(`Missing ${name} strapless`);
  if (!prompt.includes(`fully-open-back roll ${character.fullyOpenBack.roll}`)) throw new Error(`Missing ${name} open back`);
}
if (/partyActivation = TRUE|actual willing participants = Radiance/.test(prompt)) throw new Error("Stale affirmative state remains");

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
  plannedPasses: { cleanFreshPasses: 1, maximumTargetedRecoveryPasses: 1, recoverySourceIfNeeded: "only the clean round 37 fresh raw", laterFreshSourcePolicy: "original identity anchors only" },
  radianceRealtimeAgreementParty: radiancePartyState,
  redesignedComposition: {
    dipOwnership: "Ellie supports rear-three-quarter Radiance with low clasp, visible side-rib forearm brace, shoulder-blade palm, and broad covered hip-to-thigh brace",
    handGraph: { Ellie: ["low clasp", "visible shoulder-blade support palm"], Radiance: ["low clasp", "open pause palm"], ECE: ["left compass handle", "right compass handle"], Alia: ["primary mission grip", "separate support grip"] },
    relationshipContactRegions: 4,
    partyGraph: "party inactive after explicit Radiance pause; zero willing participants and no celebration cue",
    missionGeometry: "Alia close right with full body, self-supporting front-only shell, bare back, waist reveal, full-size metal inert replica, and complete backstop inside frame",
  },
  hardSurfaceQualityGate: ["no wavy or marbled processing", "no liquify or melted geometry", "no embossed or over-sharpened edges", "no rippled skin or fabric", "no bent architecture or safety panels", "clean natural photographic texture"],
};

plan.freshRound37 = { ...promptAudit, prompt };
plan.radianceRealtimeAgreementParty = radiancePartyState;
const preparedAt = new Date().toISOString();
checkpoint.status = "active-four-scene-gate-clean-fresh-round-37-materialized";
checkpoint.checkpointedAt = preparedAt;
checkpoint.terminal = false;
checkpoint.countryCompletionGate = { ...checkpoint.countryCompletionGate, acceptedSceneCount: 3, missingSceneNumbers: [scene], gitCheckpointPushed: true, xPublicStatusVerified: false, queueAdvanceAllowed: false, gateSatisfied: false };
checkpoint.renderAttempts.freshRound37 = {
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
checkpoint.xPost.note = "Georgia has accepted scenes 1548, 1549, and 1550. Clean round 37 is materialized for missing scene 1551 from original identity anchors only with an explicit Radiance pause and partyActivation false. The live X webview also requires retry; publication remains mandatory after scene 1551 is accepted and the four-scene completion checkpoint is pushed.";
checkpoint.nextQueueStatus = "locked-on-Georgia-until-four-accepted-git-pushed-and-X-live-verified";
checkpoint.nextWakeAction = { country: "Georgia", batch: 382, action: "launch-clean-fresh-round-37-from-original-identity-anchors-scene-1551-only", preserveAcceptedSceneNumbers: [1548, 1549, 1550], sceneNumbers: [scene], laterCountryStartAllowed: false };

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ status: checkpoint.status, promptAudit, nextWakeAction: checkpoint.nextWakeAction }, null, 2));
