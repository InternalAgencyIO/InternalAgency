import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const root = path.join(repo, "tmp/world-195x4/batch-382");
const checkpointPath = path.join(repo, "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json");
const contractPath = path.join(repo, "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const ledgerPath = path.join(repo, "assets/lore/starlight-era/world-x-publish-ledger.json");
const templatePromptPath = path.join(root, "scene-1551-clean-fresh-round-33-prompt.txt");
const scene = 1551;
const round = 34;
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

if (sha256File(contractPath) !== "69EB6C84A2467A4234D901C3086ECECE9E583B55C41BB9382CD5ED523C482EF5") throw new Error("Contract changed before round 34");
if (sha256File(ledgerPath) !== "B94AA3FB2B1AB1BCAB100CE689F0173C77407B82439D73379D8BC0FA3EEC2455") throw new Error("Ledger changed before round 34");
if (!contract.romance?.radianceRealtimeAgreementPartyRule) throw new Error("Radiance agreement rule missing");
if (checkpoint.status !== "active-four-scene-gate-incomplete-after-clean-fresh-round-33") throw new Error(`Unexpected status: ${checkpoint.status}`);
if (checkpoint.renderStrategyReset?.nextCleanRound !== round) throw new Error("Checkpoint does not authorize round 34");
if (checkpoint.renderAttempts.freshRound34) throw new Error("Round 34 already materialized");

const referenceAudit = references.map(([relativePath, role, expectedSha256], index) => {
  const actualSha256 = sha256File(path.join(repo, relativePath));
  if (actualSha256 !== expectedSha256) throw new Error(`Identity anchor ${index + 1} changed`);
  return { image: index + 1, path: relativePath, role, sha256: actualSha256, exists: true };
});

const invitationKey = "batch382-georgia-scene1551-radianceLiveInvitation-round34";
const responseKey = "batch382-georgia-scene1551-radianceLiveResponse-round34";
const participantsKey = "batch382-georgia-scene1551-radianceLiveParticipants-round34";
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
const radianceResponse = "Radiance explicitly redirects the optional celebration to quiet planning with one clear side-to-side head shake, a calm closed-mouth expression, and her existing open left palm turned toward ECE's holographic route map. She remains willingly supported in Ellie's shallow dip and approves no party act or participant.";
const radiancePartyState = {
  round,
  rollMethod: "FNV-1a over recorded round-34 live-narrative keys, reduced modulo 100",
  invitation: { key: invitationKey, fullHash: invitationFullHash, roll: invitationRoll, selectorIndex: invitationRoll % invitations.length },
  response: { key: responseKey, fullHash: responseFullHash, roll: responseRoll, thresholds: "0-69 explicit affirmative; 70-84 explicit redirect; 85-94 explicit pause; 95-99 explicit decline", category: responseCategory },
  participantSelector: { key: participantsKey, fullHash: participantsFullHash, roll: participantsRoll, thresholds: "0-24 Radiance+ECE; 25-49 Radiance+Ellie+ECE; 50-74 all four; 75-99 Radiance+ECE+Alia", hypotheticalSetIfAffirmative: participantSet },
  offeredChoice,
  radianceResponse,
  partyActivation,
  willingParticipants,
  visibleAgreementEvidence: [],
  visibleResponseEvidence: [
    "Radiance's clear side-to-side head shake toward ECE",
    "Radiance's calm closed-mouth expression",
    "Radiance's separate open left palm redirected toward ECE's holographic route map",
    "ECE's attentive eye line follows Radiance's redirect to the map without a celebration cue",
  ],
  continuityState: "Radiance redirects the optional celebration to quiet route planning. partyActivation remains false; nobody heel-taps, dances, celebrates, or becomes a party participant. Ellie continues the consensual dip support, ECE retains both compass hands, and Alia retains the closed downrange training line.",
  consentScope: "This scene-specific redirect approves no party act or participant and does not transfer to another act, prop interaction, scene, country, or future image.",
};
if (invitationFullHash !== 3875990635 || invitationRoll !== 35 || invitationRoll % invitations.length !== 3) throw new Error("Round 34 invitation roll changed");
if (responseFullHash !== 2700098575 || responseRoll !== 75 || responseCategory !== "explicit redirect") throw new Error("Round 34 response roll changed");
if (participantsFullHash !== 868362230 || participantsRoll !== 30 || participantSet.join("|") !== "Radiance|Ellie|AI ECE") throw new Error("Round 34 participant roll changed");
if (partyActivation || willingParticipants.length !== 0) throw new Error("Round 34 party must remain inactive");

const templatePrompt = fs.readFileSync(templatePromptPath, "utf8");
let prompt = templatePrompt.replaceAll("round 33", "round 34");

const compositionBlock = /SIMPLE SEPARATED COMPOSITION[\s\S]*?(?=\n\nDETERMINISTIC CHARACTER ROLLS)/;
const newCompositionBlock = `SIMPLE SEPARATED COMPOSITION
Use one clean 24 mm eye-level full-body exposure with generous plain negative space and no layered bodies. At left-center, Ellie stands upright at 22 percent of frame width with stable feet and a calm supportive expression. Radiance is immediately in front at 38 percent, torso leaning back only twenty degrees, head below Ellie's shoulder, and both complete feet firmly planted. Their right-hand clasp is lifted at far left against empty sea. Ellie's separate white-sleeved left arm stays completely visible outside both torso silhouettes and ends in one open support palm spread high on Radiance's bare upper back. Radiance's cobalt-covered left hip and upper thigh press broadly and unmistakably against Ellie's white-covered right hip and thigh with no visible gap; this is the third contact and leaves both open-back surfaces visible. Radiance's separate left arm opens toward ECE's map without touching anyone. Put ECE front-on at 59 percent behind one narrow compass pedestal, in Radiance's eye line, both feet flat and no celebration pose. Put Alia close to camera at 84 percent in rear-three-quarter strict right-facing profile, complete body and footwear in frame. Her strapless copper front-and-side crop shell ends at both side seams, leaving the entire back bare; a clear four-centimeter bare waist band separates it from the cobalt skort. Her two arms and two hands hold one large dark polished-metal inert training replica in unobstructed side profile. The replica occupies at least twenty-five percent of frame width and points only at the complete paper target and backstop. Keep all owner paths visible. Reserve lower-left for the dry mascot lounge and the upper third for Batumi landmarks. No cropped foot, foreground overlap, decorative clutter, or curved architecture.`;
if (!compositionBlock.test(prompt)) throw new Error("Composition block missing");
prompt = prompt.replace(compositionBlock, newCompositionBlock);

prompt = prompt.replace(
  "Radiance and ECE remain the affectionate narrative center through sustained warm mutual eye line and Radiance's open affirmative palm while Alia visibly joins their single willing count and Ellie remains supportive but outside the optional party. Alia alone handles the inert mission prop.",
  "Radiance and ECE remain the affectionate narrative center through sustained warm mutual eye line and Radiance's open redirect palm toward ECE's route map. partyActivation is false; nobody performs a celebration cue. Alia alone handles the inert mission prop.",
);

const loveBlock = /ROLLED LOVE STORY[\s\S]*?(?=\n\nRADIANCE LIVE CHOICE AND RESPONSE)/;
const newLoveBlock = `ROLLED LOVE STORY
Romance roll 86 = Alia spins Radiance under linked hands while ECE steadies Radiance and Ellie reaches toward the beacon. Materialize the completed spin as Radiance willingly settling into Ellie's unmistakable shallow dip while ECE offers the optional final step and Radiance visibly redirects to quiet planning. Do not add literal hands beyond the exact graph below.
Compound-love roll 28 = ECE stays close at Radiance's side while warmly greeting Ellie and Alia answers beside them. Materialize its square through Radiance and ECE's sustained affectionate eye line, Ellie's calm close support, and Alia's attentive but safely downrange presence.
Hard-love roll 40 = a controlled dance dip with stable planted feet and supported back, a second partner catching the dipped adult's free hand, and the fourth answering with visible jealousy or invitation. Ellie visibly supports Radiance: her left palm rests high on Radiance's open upper back and her right hand catches Radiance's right hand in the lifted clasp. Radiance's cobalt-covered left hip and upper thigh press broadly against Ellie's white-covered right hip and thigh as the third contact. ECE visibly offers the optional step through attentive eye line; Radiance clearly redirects to the map. These three and only three relationship contacts are large and unmistakable. Radiance's separate open left palm touches nobody.`;
if (!loveBlock.test(prompt)) throw new Error("Love block missing");
prompt = prompt.replace(loveBlock, newLoveBlock);

const partyBlock = /RADIANCE LIVE CHOICE AND RESPONSE[\s\S]*?(?=\n\nEXACT EIGHT-ARM, EIGHT-HAND GRAPH)/;
const newPartyBlock = `RADIANCE LIVE CHOICE AND RESPONSE
Invitation key ${invitationKey}; full hash ${invitationFullHash}; roll ${invitationRoll}; selector index ${invitationRoll % invitations.length}.
Offered choice: ${offeredChoice}
Response key ${responseKey}; full hash ${responseFullHash}; roll ${responseRoll}; result = ${responseCategory}.
Participant-selector key ${participantsKey}; full hash ${participantsFullHash}; roll ${participantsRoll}; hypothetical affirmative participants = ${participantSet.join(", ")}; actual willing participants = none.
Radiance response: ${radianceResponse}
partyActivation = FALSE. Show no party, dance count, heel-tap, celebratory smile, confetti, drink, balloon, sign, stage, or ornament. Radiance's redirect is explicit and first-read: a clear side-to-side head shake toward ECE, calm closed-mouth expression, and her existing open left palm turned toward ECE's hands-free map. ECE acknowledges by following the gesture to the map while both hands stay on the compass. Ellie remains supportive in the consensual dip. Alia remains attentive but entirely in the safe downrange demonstration. No prior consent or participant selector activates anything.`;
if (!partyBlock.test(prompt)) throw new Error("Party block missing");
prompt = prompt.replace(partyBlock, newPartyBlock);

const handBlock = /EXACT EIGHT-ARM, EIGHT-HAND GRAPH[\s\S]*?(?=\n\nODD PROP AND ROUTE STRATEGY)/;
const newHandBlock = `EXACT EIGHT-ARM, EIGHT-HAND GRAPH
Ellie stands upright at left. Her white-sleeved left arm stays entirely outside both torso silhouettes against plain sea and ends in one open left support palm spread high on Radiance's uninterrupted bare upper back. Her separate white-sleeved right arm extends leftward through clean air and ends in one lifted palm-to-palm clasp with Radiance's right hand. Show both sleeves, elbows, forearms, wrists, palms, and finger clusters continuously.
Radiance performs a shallow rear-three-quarter dip with head below Ellie's shoulder and both complete feet planted. Her right arm extends leftward to the lifted clasp with Ellie's right hand. Her separate left arm extends toward ECE, ending in one large open redirect palm beside the holographic map with all five fingers separated; it touches nobody. Show both shoulders, elbows, forearms, wrists, palms, and finger clusters continuously.
ECE stands front-on in her own lane. Her left arm descends visibly to the tall left compass handle and her right arm descends visibly to the tall right handle. Both arms and hands are separated by the compass face. ECE touches no person and owns the compass alone.
Alia remains isolated in rear-three-quarter strict right-facing profile. Her right arm ends in the primary mission grip and her left arm ends in the separate support grip beneath the grip base. Both arms, wrists, palms, and finger clusters are fully separated and silhouetted against plain empty pavement.
Exactly eight human arms and exactly eight human hands, two per woman. The three and only three relationship contacts are Ellie's left support palm on Radiance's upper back, Ellie and Radiance's lifted right-hand clasp, and Radiance's cobalt-covered left hip and upper thigh pressed broadside against Ellie's white-covered right hip and thigh. Radiance's left redirect palm touches nobody. No hand emerges from behind a torso, waist, garment, table, prop, or another hand. No extra touch, hidden hand, decorative hand, borrowed limb, fused wrist, duplicate finger cluster, or ambiguous owner path.`;
if (!handBlock.test(prompt)) throw new Error("Hand block missing");
prompt = prompt.replace(handBlock, newHandBlock);

prompt = prompt.replace(
  "The clean photograph must pass exact identity, eight-arm, eight-hand, continuous owner-path, three-contact conventional controlled-dip romance, explicit Radiance affirmative with Radiance-ECE-Alia one-count party active and Ellie excluded, Radiance-ECE affectionate center, mascot, wardrobe-roll, full-size metallic inert training replica, target-axis, indexed-trigger, location-theme fusion, and surface-quality gates.",
  "The clean photograph must pass exact identity, eight-arm, eight-hand, continuous owner-path, three-contact conventional controlled-dip romance, explicit Radiance redirect with partyActivation false, Radiance-ECE affectionate center, mascot, wardrobe-roll, full-size metallic inert training replica, target-axis, indexed-trigger, location-theme fusion, and surface-quality gates.",
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
  "trigger guard is visibly empty",
  "at least twenty-five percent of frame width",
];
for (const value of required) if (!prompt.includes(value)) throw new Error(`Missing materialized field: ${value}`);
for (const [name, character] of Object.entries(plan.characters)) {
  const emotion = character.emotion.materializedResult ?? character.emotion.result;
  if (!prompt.includes(`${name}: emotion roll ${character.emotion.roll} = ${emotion}`)) throw new Error(`Missing ${name} emotion`);
  if (!prompt.includes(`visible-midriff roll ${character.visibleMidriff.roll}`)) throw new Error(`Missing ${name} midriff`);
  if (!prompt.includes(`strapless roll ${character.straplessDress.roll}`)) throw new Error(`Missing ${name} strapless`);
  if (!prompt.includes(`fully-open-back roll ${character.fullyOpenBack.roll}`)) throw new Error(`Missing ${name} open back`);
}
if (/partyActivation = TRUE|one-count party active|joins their single willing count/.test(prompt)) throw new Error("Stale active-party instruction remains");

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
  plannedPasses: { cleanFreshPasses: 1, maximumTargetedRecoveryPasses: 1, recoverySourceIfNeeded: "only the clean round 34 fresh raw", laterFreshSourcePolicy: "original identity anchors only" },
  radianceRealtimeAgreementParty: radiancePartyState,
  redesignedComposition: {
    dipOwnership: "Ellie supports Radiance with clasp, visible back palm, and broad covered hip-to-thigh brace",
    handGraph: { Ellie: ["visible support palm", "lifted clasp"], Radiance: ["lifted clasp", "open redirect palm"], ECE: ["left compass handle", "right compass handle"], Alia: ["primary mission grip", "separate support grip"] },
    relationshipContacts: 3,
    partyGraph: "partyActivation false; no willing participants or celebration cues",
    missionGeometry: "Alia close right with full body, completely open back, waist reveal, dark polished-metal inert replica at least twenty-five percent width, and complete backstop",
  },
  hardSurfaceQualityGate: ["no wavy or marbled processing", "no liquify or melted geometry", "no embossed or over-sharpened edges", "no rippled skin or fabric", "no bent architecture or safety panels", "clean natural photographic texture"],
};

plan.freshRound34 = { ...promptAudit, prompt };
plan.radianceRealtimeAgreementParty = radiancePartyState;
const preparedAt = new Date().toISOString();
checkpoint.status = "active-four-scene-gate-clean-fresh-round-34-materialized";
checkpoint.checkpointedAt = preparedAt;
checkpoint.terminal = false;
checkpoint.countryCompletionGate = { ...checkpoint.countryCompletionGate, acceptedSceneCount: 3, missingSceneNumbers: [scene], gitCheckpointPushed: true, xPublicStatusVerified: false, queueAdvanceAllowed: false, gateSatisfied: false };
checkpoint.renderAttempts.freshRound34 = {
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
checkpoint.xPost.note = "Georgia has accepted scenes 1548, 1549, and 1550. Clean round 34 is materialized for missing scene 1551 from original identity anchors only with an explicit Radiance redirect and partyActivation false. Publication remains mandatory after scene 1551 is accepted and the four-scene completion checkpoint is pushed.";
checkpoint.nextQueueStatus = "locked-on-Georgia-until-four-accepted-git-pushed-and-X-live-verified";
checkpoint.nextWakeAction = { country: "Georgia", batch: 382, action: "launch-clean-fresh-round-34-from-original-identity-anchors-scene-1551-only", preserveAcceptedSceneNumbers: [1548, 1549, 1550], sceneNumbers: [scene], laterCountryStartAllowed: false };

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ status: checkpoint.status, promptAudit }, null, 2));
