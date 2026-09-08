import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const root = path.join(repo, "tmp/world-195x4/batch-382");
const checkpointPath = path.join(repo, "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json");
const contractPath = path.join(repo, "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const ledgerPath = path.join(repo, "assets/lore/starlight-era/world-x-publish-ledger.json");
const templatePromptPath = path.join(root, "scene-1551-clean-fresh-round-35-prompt.txt");
const scene = 1551;
const round = 36;
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

if (sha256File(contractPath) !== "69EB6C84A2467A4234D901C3086ECECE9E583B55C41BB9382CD5ED523C482EF5") throw new Error("Contract changed before round 36");
if (sha256File(ledgerPath) !== "B94AA3FB2B1AB1BCAB100CE689F0173C77407B82439D73379D8BC0FA3EEC2455") throw new Error("Ledger changed before round 36");
if (!contract.romance?.radianceRealtimeAgreementPartyRule) throw new Error("Radiance agreement rule missing");
if (checkpoint.status !== "active-four-scene-gate-incomplete-after-clean-fresh-round-35") throw new Error(`Unexpected status: ${checkpoint.status}`);
if (checkpoint.renderStrategyReset?.nextCleanRound !== round) throw new Error("Checkpoint does not authorize round 36");
if (checkpoint.renderAttempts.freshRound36) throw new Error("Round 36 already materialized");

const referenceAudit = references.map(([relativePath, role, expectedSha256], index) => {
  const actualSha256 = sha256File(path.join(repo, relativePath));
  if (actualSha256 !== expectedSha256) throw new Error(`Identity anchor ${index + 1} changed`);
  return { image: index + 1, path: relativePath, role, sha256: actualSha256, exists: true };
});

const invitationKey = "batch382-georgia-scene1551-radianceLiveInvitation-round36";
const responseKey = "batch382-georgia-scene1551-radianceLiveResponse-round36";
const participantsKey = "batch382-georgia-scene1551-radianceLiveParticipants-round36";
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
const radianceResponse = "Radiance explicitly accepts Ellie's final-count invitation with a clear up-down nod and broad willing smile, then turns the same willing smile and her existing open left palm toward ECE and Alia. Ellie continues the consensual dip support but does not join the optional celebration.";
const radiancePartyState = {
  round,
  rollMethod: "FNV-1a over recorded round-36 live-narrative keys, reduced modulo 100",
  invitation: { key: invitationKey, fullHash: invitationFullHash, roll: invitationRoll, selectorIndex: invitationRoll % invitations.length },
  response: { key: responseKey, fullHash: responseFullHash, roll: responseRoll, thresholds: "0-69 explicit affirmative; 70-84 explicit redirect; 85-94 explicit pause; 95-99 explicit decline", category: responseCategory },
  participantSelector: { key: participantsKey, fullHash: participantsFullHash, roll: participantsRoll, thresholds: "0-24 Radiance+ECE; 25-49 Radiance+Ellie+ECE; 50-74 all four; 75-99 Radiance+ECE+Alia", hypotheticalSetIfAffirmative: participantSet },
  offeredChoice,
  radianceResponse,
  partyActivation,
  willingParticipants,
  visibleAgreementEvidence: [
    "Radiance's clear up-down nod and broad willing smile",
    "Radiance's open left palm and warm eye line toward ECE and Alia",
    "ECE's willing smile and one small lifted-heel count while both compass hands remain fixed",
    "Alia's willing profile smile and slightly lifted rear heel while both mission hands remain safely downrange",
  ],
  visibleResponseEvidence: [],
  continuityState: "Radiance accepts exactly one fully clothed public-safe final count with ECE and Alia. Ellie remains the willing dip support but does not join the optional party. ECE retains both compass hands and Alia retains the closed downrange training line.",
  consentScope: "This affirmative applies only to this recorded round-36 final-count invitation in scene 1551 and only to Radiance, ECE, and Alia. It does not transfer to Ellie, another act, prop interaction, scene, country, or future image.",
};
if (invitationFullHash !== 3909545873 || invitationRoll !== 73 || invitationRoll % invitations.length !== 1) throw new Error("Round 36 invitation roll changed");
if (responseFullHash !== 2733653813 || responseRoll !== 13 || responseCategory !== "explicit affirmative") throw new Error("Round 36 response roll changed");
if (participantsFullHash !== 834806992 || participantsRoll !== 92 || participantSet.join("|") !== "Radiance|AI ECE|Alia") throw new Error("Round 36 participant roll changed");
if (!partyActivation || willingParticipants.join("|") !== participantSet.join("|")) throw new Error("Round 36 party state mismatch");

const templatePrompt = fs.readFileSync(templatePromptPath, "utf8");
let prompt = templatePrompt.replaceAll("round 35", "round 36");

const compositionBlock = /SIMPLE SEPARATED COMPOSITION[\s\S]*?(?=\n\nDETERMINISTIC CHARACTER ROLLS)/;
const newCompositionBlock = `SIMPLE SEPARATED COMPOSITION
Use one clean 24 mm eye-level full-body exposure with generous plain negative space and no layered arms. At left, Ellie stands front-on at 20 percent of frame width with both feet planted and a calm supportive expression. Radiance occupies 38 percent immediately to Ellie's right, rear-three-quarter to camera so her entire bare upper and middle back is visible, in a shallow twenty-degree supported dip with both complete feet planted and her head turned toward ECE and Alia. Their low right-hand clasp sits at waist height in the empty gap between them: Ellie's white-sleeved right arm and Radiance's bare right arm each have fully visible shoulders, upper arms, elbows, forearms, wrists, palms, and finger clusters. Ellie's separate white-sleeved left arm runs diagonally across the front of her own torso, then through clean air outside Radiance's silhouette to one open palm spread on Radiance's near left shoulder blade; every sleeve segment remains visible and nothing passes behind a body or hair. Radiance's covered left shoulder rests directly against Ellie's covered right upper arm as the third contact. Radiance's separate left arm extends toward ECE and Alia with one open willing palm and touches nobody. Put ECE front-on at 58 percent behind one narrow compass pedestal, in Radiance's eye line, with one small lifted heel for the agreed count. Put Alia at 78 percent in close rear-three-quarter strict right-facing profile, complete body and footwear in frame. Her strapless copper front-and-side crop shell terminates at both side seams, leaving the entire upper and middle back bare; a clear four-centimeter bare waist band separates it from the cobalt skort. Her exact two arms and two hands hold one realistic 30-centimeter dark polished-metal inert training replica in clean side profile. The replica occupies about eighteen percent of frame width, with the orange muzzle insert, straight indexed finger above an empty guard, and separate support hand fully visible. Put the entire thick sand backstop and its single paper route target inside the far-right frame with a visible rainy margin on all four sides. Reserve lower-left for the dry mascot lounge and the upper third for Batumi's recognizable Alphabet Tower, Ferris wheel, sea, palms, and skyline. No cropped foot, foreground overlap, decorative clutter, or curved architecture.`;
if (!compositionBlock.test(prompt)) throw new Error("Composition block missing");
prompt = prompt.replace(compositionBlock, newCompositionBlock);

prompt = prompt.replace(
  "Radiance and ECE remain the affectionate narrative center through sustained warm mutual eye line and Radiance's open left palm toward ECE. partyActivation is true for exactly Radiance, Ellie, and ECE; Alia performs no celebration cue and alone handles the inert mission prop.",
  "Radiance and ECE remain the affectionate narrative center through sustained warm mutual eye line and Radiance's open left palm toward ECE and Alia. partyActivation is true for exactly Radiance, ECE, and Alia; Ellie supports the dip without joining. Alia alone handles the inert mission prop.",
);

const loveBlock = /ROLLED LOVE STORY[\s\S]*?(?=\n\nRADIANCE LIVE CHOICE AND RESPONSE)/;
const newLoveBlock = `ROLLED LOVE STORY
Romance roll 86 = Alia spins Radiance under linked hands while ECE steadies Radiance and Ellie reaches toward the beacon. Materialize the completed spin settling into Ellie's unmistakable shallow dip while Radiance accepts Ellie's final-count invitation with ECE and Alia. The spin is already complete; do not add literal hands beyond the exact graph below.
Compound-love roll 28 = ECE stays close at Radiance's side while warmly greeting Ellie and Alia answers beside them. Materialize its square through Radiance and ECE's sustained affectionate eye line, Alia's willing profile response, and Ellie's calm excluded support.
Hard-love roll 40 = a controlled dance dip with stable planted feet and supported back, a second partner catching the dipped adult's free hand, and the fourth answering with visible jealousy or invitation. Ellie visibly supports Radiance: her left palm rests on Radiance's near shoulder blade and her right hand catches Radiance's right hand in the low clasp. Radiance's covered left shoulder rests directly against Ellie's covered right upper arm as the third contact. Alia answers as the inviting fourth through her willing profile smile and lifted rear heel while remaining safely downrange. These three and only three relationship contacts are large and unmistakable. Radiance's separate open left palm touches nobody.`;
if (!loveBlock.test(prompt)) throw new Error("Love block missing");
prompt = prompt.replace(loveBlock, newLoveBlock);

const partyBlock = /RADIANCE LIVE CHOICE AND RESPONSE[\s\S]*?(?=\n\nEXACT EIGHT-ARM, EIGHT-HAND GRAPH)/;
const newPartyBlock = `RADIANCE LIVE CHOICE AND RESPONSE
Invitation key ${invitationKey}; full hash ${invitationFullHash}; roll ${invitationRoll}; selector index ${invitationRoll % invitations.length}.
Offered choice: ${offeredChoice}
Response key ${responseKey}; full hash ${responseFullHash}; roll ${responseRoll}; result = ${responseCategory}.
Participant-selector key ${participantsKey}; full hash ${participantsFullHash}; roll ${participantsRoll}; willing participants = ${willingParticipants.join(", ")}. Ellie is not a party participant.
Radiance response: ${radianceResponse}
partyActivation = TRUE. Show exactly one adult, consensual, fully clothed, public-safe InternalAgency final count involving only Radiance, AI ECE, and Alia. Radiance visibly nods and smiles toward ECE and Alia. ECE visibly smiles toward Radiance and lifts one existing heel a few centimeters while both hands remain on opposite compass handles. Alia shows one willing profile smile and lifts only her rear heel a few centimeters while both hands remain in the safe downrange line. Ellie remains calm and supportive but does not smile, nod, heel-tap, dance, or join. Add no party object, crowd, drink, confetti, balloon, sign, text, stage, or ornament. Agreement is limited to this exact invitation and participant set.`;
if (!partyBlock.test(prompt)) throw new Error("Party block missing");
prompt = prompt.replace(partyBlock, newPartyBlock);

const handBlock = /EXACT EIGHT-ARM, EIGHT-HAND GRAPH[\s\S]*?(?=\n\nODD PROP AND ROUTE STRATEGY)/;
const newHandBlock = `EXACT EIGHT-ARM, EIGHT-HAND GRAPH
Ellie stands upright at left. Her white-sleeved right arm begins at her fully visible right shoulder and runs diagonally down-right through empty sea to the left hand of the low clasp. Her separate white-sleeved left arm begins at her fully visible left shoulder, crosses visibly in front of her own white torso, then continues through clean air outside Radiance's silhouette to one open support palm spread on Radiance's near left shoulder blade. No part of either arm passes behind a body or hair. Show both sleeves, elbows, forearms, wrists, palms, and finger clusters continuously.
Radiance performs the rear-three-quarter shallow dip with her entire open back facing camera and both complete feet planted. Her bare right arm begins at her fully visible right shoulder and runs diagonally down-left through empty sea to the right hand of the low clasp. Her separate bare left arm extends toward ECE and Alia and ends in one large open willing palm with all five fingers separated; it touches nobody. Show both shoulders, upper arms, elbows, forearms, wrists, palms, and finger clusters continuously.
ECE stands front-on in her own lane. Her left arm descends visibly to the tall left compass handle and her right arm descends visibly to the tall right handle. Both arms and hands are separated by the compass face. ECE touches no person and owns the compass alone.
Alia remains isolated in rear-three-quarter strict right-facing profile. Her right arm ends in the primary mission grip and her left arm ends in the separate support grip beneath the grip base. Both arms, wrists, palms, and finger clusters are fully separated against plain empty pavement.
Exactly eight human arms and exactly eight human hands, two per woman. The three and only three relationship contacts are Ellie and Radiance's low right-hand clasp, Ellie's left support palm on Radiance's near shoulder blade, and Radiance's covered left shoulder resting against Ellie's covered right upper arm. Radiance's left willing palm touches nobody. No hand emerges from behind a torso, head, hair, waist, garment, table, prop, or another hand. No extra touch, hidden hand, decorative hand, borrowed limb, fused wrist, duplicate finger cluster, or ambiguous owner path.`;
if (!handBlock.test(prompt)) throw new Error("Hand block missing");
prompt = prompt.replace(handBlock, newHandBlock);

prompt = prompt.replace(
  "The clean photograph must pass exact identity, eight-arm, eight-hand, continuous owner-path, three-contact conventional controlled-dip romance, explicit Radiance affirmative with partyActivation true for Radiance-Ellie-ECE and Alia excluded, Radiance-ECE affectionate center, mascot, wardrobe-roll, full-size metallic inert training replica, target-axis, indexed-trigger, location-theme fusion, and surface-quality gates.",
  "The clean photograph must pass exact identity, eight-arm, eight-hand, continuous owner-path, three-contact conventional controlled-dip romance, explicit Radiance affirmative with partyActivation true for Radiance-ECE-Alia and Ellie excluded, Radiance-ECE affectionate center, mascot, wardrobe-roll, full-size metallic inert training replica, target-axis, indexed-trigger, location-theme fusion, and surface-quality gates.",
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
  "willing participants = Radiance, AI ECE, Alia",
  "Exactly eight human arms and exactly eight human hands",
  "trigger guard is visibly empty",
  "about eighteen percent of frame width",
];
for (const value of required) if (!prompt.includes(value)) throw new Error(`Missing materialized field: ${value}`);
for (const [name, character] of Object.entries(plan.characters)) {
  const emotion = character.emotion.materializedResult ?? character.emotion.result;
  if (!prompt.includes(`${name}: emotion roll ${character.emotion.roll} = ${emotion}`)) throw new Error(`Missing ${name} emotion`);
  if (!prompt.includes(`visible-midriff roll ${character.visibleMidriff.roll}`)) throw new Error(`Missing ${name} midriff`);
  if (!prompt.includes(`strapless roll ${character.straplessDress.roll}`)) throw new Error(`Missing ${name} strapless`);
  if (!prompt.includes(`fully-open-back roll ${character.fullyOpenBack.roll}`)) throw new Error(`Missing ${name} open back`);
}
if (/willing participants = Radiance, Ellie, AI ECE|partyActivation true for exactly Radiance, Ellie, and ECE/.test(prompt)) throw new Error("Stale round-35 participant state remains");

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
  plannedPasses: { cleanFreshPasses: 1, maximumTargetedRecoveryPasses: 1, recoverySourceIfNeeded: "only the clean round 36 fresh raw", laterFreshSourcePolicy: "original identity anchors only" },
  radianceRealtimeAgreementParty: radiancePartyState,
  redesignedComposition: {
    dipOwnership: "Ellie supports rear-three-quarter Radiance with low clasp, fully traced front-crossing support arm, and covered shoulder brace",
    handGraph: { Ellie: ["low clasp", "visible shoulder-blade support palm"], Radiance: ["low clasp", "open willing palm"], ECE: ["left compass handle", "right compass handle"], Alia: ["primary mission grip", "separate support grip"] },
    relationshipContacts: 3,
    partyGraph: "party active only for Radiance ECE and Alia; Ellie visibly excluded while remaining supportive",
    missionGeometry: "Alia close right with full body, completely open back, waist reveal, physically credible full-size metal inert replica, and complete backstop inside frame",
  },
  hardSurfaceQualityGate: ["no wavy or marbled processing", "no liquify or melted geometry", "no embossed or over-sharpened edges", "no rippled skin or fabric", "no bent architecture or safety panels", "clean natural photographic texture"],
};

plan.freshRound36 = { ...promptAudit, prompt };
plan.radianceRealtimeAgreementParty = radiancePartyState;
const preparedAt = new Date().toISOString();
checkpoint.status = "active-four-scene-gate-clean-fresh-round-36-materialized";
checkpoint.checkpointedAt = preparedAt;
checkpoint.terminal = false;
checkpoint.countryCompletionGate = { ...checkpoint.countryCompletionGate, acceptedSceneCount: 3, missingSceneNumbers: [scene], gitCheckpointPushed: true, xPublicStatusVerified: false, queueAdvanceAllowed: false, gateSatisfied: false };
checkpoint.renderAttempts.freshRound36 = {
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
  signedIn: true,
  eligibleBacklogRemaining: 0,
  pendingPost: null,
  preparedPostQueueCount: 0,
  latestVisibleAccountStatus: { url: "https://x.com/dogramaci/status/2087242564432806133", validCountryPairCaption: false, classification: "unrelated-account-post-not-a-World-Series-ledger-item" },
  latestVisibleAccountStatuses: ["https://x.com/dogramaci/status/2087242564432806133", "https://x.com/dogramaci/status/2087241970661941705"],
  reconciliationDecision: "Signed-in live profile checked. No eligible unposted World Series country pair exists. Georgia remains X-blocked until scene 1551 is accepted.",
};
checkpoint.xPost.status = "blocked-active-country-incomplete-not-skipped";
checkpoint.xPost.url = null;
checkpoint.xPost.acceptedCurrentCountryAssets = 3;
checkpoint.xPost.note = "Georgia has accepted scenes 1548, 1549, and 1550. Clean round 36 is materialized for missing scene 1551 from original identity anchors only with an explicit Radiance affirmative for exactly Radiance, ECE, and Alia. Publication remains mandatory after scene 1551 is accepted and the four-scene completion checkpoint is pushed.";
checkpoint.nextQueueStatus = "locked-on-Georgia-until-four-accepted-git-pushed-and-X-live-verified";
checkpoint.nextWakeAction = { country: "Georgia", batch: 382, action: "launch-clean-fresh-round-36-from-original-identity-anchors-scene-1551-only", preserveAcceptedSceneNumbers: [1548, 1549, 1550], sceneNumbers: [scene], laterCountryStartAllowed: false };

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ status: checkpoint.status, promptAudit }, null, 2));
