import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const root = path.join(repo, "tmp/world-195x4/batch-382");
const checkpointPath = path.join(repo, "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json");
const contractPath = path.join(repo, "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const ledgerPath = path.join(repo, "assets/lore/starlight-era/world-x-publish-ledger.json");
const templatePromptPath = path.join(root, "scene-1551-clean-fresh-round-26-prompt.txt");
const scene = 1551;
const round = 27;
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

const expectedContractSha = "69EB6C84A2467A4234D901C3086ECECE9E583B55C41BB9382CD5ED523C482EF5";
const expectedLedgerSha = "B94AA3FB2B1AB1BCAB100CE689F0173C77407B82439D73379D8BC0FA3EEC2455";
if (sha256File(contractPath) !== expectedContractSha) throw new Error("Authoritative contract changed before clean round 27");
if (sha256File(ledgerPath) !== expectedLedgerSha) throw new Error("X ledger changed before clean round 27");
if (!contract.romance?.radianceRealtimeAgreementPartyRule) throw new Error("Radiance agreement rule missing");
if (checkpoint.status !== "active-four-scene-gate-incomplete-after-clean-fresh-round-26") throw new Error(`Unexpected checkpoint status: ${checkpoint.status}`);
if (checkpoint.renderStrategyReset?.nextCleanRound !== round) throw new Error("Checkpoint does not authorize round 27");

const referenceAudit = references.map(([relativePath, role, expectedSha256], index) => {
  const actualSha256 = sha256File(path.join(repo, relativePath));
  if (actualSha256 !== expectedSha256) throw new Error(`Identity anchor ${index + 1} changed`);
  return { image: index + 1, path: relativePath, role, sha256: actualSha256, exists: true };
});

const invitationKey = "batch382-georgia-scene1551-radianceLiveInvitation-round27";
const responseKey = "batch382-georgia-scene1551-radianceLiveResponse-round27";
const participantsKey = "batch382-georgia-scene1551-radianceLiveParticipants-round27";
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
const radianceResponse = "Radiance gives AI ECE a clear affirmative nod, deliberately places her existing right palm on ECE's near shoulder, sustains warm direct eye contact with ECE, and lets ECE receive that contact as one restrained fully clothed victory count while Ellie keeps the dip securely supported.";
const radiancePartyState = {
  round,
  rollMethod: "FNV-1a over recorded round-27 live-narrative keys, reduced modulo 100",
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
  },
  offeredChoice,
  radianceResponse,
  partyActivation,
  willingParticipants,
  visibleAgreementEvidence: [
    "Radiance's clear affirmative nod directly to AI ECE",
    "Radiance's deliberate open right palm on ECE's near shoulder",
    "Radiance and ECE's sustained warm mutual eye line",
    "ECE's clear willing smile and slight head inclination while both hands remain on the compass",
  ],
  visibleResponseEvidence: [],
  continuityState: "The accepted invitation becomes one restrained, fully clothed, non-explicit InternalAgency victory count for Radiance and AI ECE only; Ellie remains the necessary safe dip supporter and Alia remains outside the party in her isolated lane.",
  consentScope: "This response applies only to this recorded round-27 invitation in scene 1551 and does not transfer to another act, participant, prop interaction, scene, country, or future image.",
};
if (invitationRoll !== 59 || responseRoll !== 3 || participantsRoll !== 10) throw new Error("Round 27 live-narrative rolls changed");
if (!partyActivation || willingParticipants.join("|") !== "Radiance|AI ECE") throw new Error("Round 27 party state mismatch");

const templatePrompt = fs.readFileSync(templatePromptPath, "utf8");
let prompt = templatePrompt.replaceAll("round 26", "round 27");

const compositionBlock = /SIMPLE SEPARATED COMPOSITION[\s\S]*?(?=\n\nDETERMINISTIC CHARACTER ROLLS)/;
const newCompositionBlock = `SIMPLE SEPARATED COMPOSITION
Use a clean 28 mm eye-level full-body exposure and generous negative space. Put Ellie upright at 24 percent of frame width as the sole physical dip supporter. Put Radiance in a very shallow rear-three-quarter dip at 41 percent, between Ellie and ECE, with her fully open back visible and all four left-center arms outside torso silhouettes. Put ECE front-on with the narrow compass pedestal at 60 percent, close enough for Radiance's open right palm to rest visibly on ECE's near shoulder while ECE's hands remain on the handles. Put Alia in rear three-quarter and strict right-facing profile at 82 percent in a fully separate closed training lane. Keep every face, torso, leg, foot, shoulder, elbow, forearm, wrist, palm, and finger cluster visible. Reserve the lower-left for the dry mascot lounge, the upper third for Batumi landmarks, and the far-right middle distance for one complete target and backstop. No raised dance arch, stacked body, crossed silhouette, cropped foot, or foreground clutter.`;
if (!compositionBlock.test(prompt)) throw new Error("Composition block missing");
prompt = prompt.replace(compositionBlock, newCompositionBlock);

const loveBlock = /ROLLED LOVE STORY[\s\S]*?(?=\n\nRADIANCE LIVE CHOICE AND RESPONSE)/;
const newLoveBlock = `ROLLED LOVE STORY
Romance roll 86 = Alia spins Radiance under linked hands while ECE steadies Radiance and Ellie reaches toward the beacon. Materialize its pursuit and interruption through Radiance's torso movement from Ellie's safe support toward ECE's shoulder, ECE's receiving posture, and Alia's excluded side glance; do not add literal hands beyond the exact graph below.
Compound-love roll 28 = ECE stays close at Radiance's side while warmly greeting Ellie and Alia answers beside them. Materialize its three-person affection and Alia's exclusion through the Radiance-ECE eye line, Ellie's supporting proximity, Alia's separate posture, and the exact graph below.
Hard-love roll 40 = a controlled dance dip with stable planted feet and supported back, a second partner catching the dipped adult's free hand, and the fourth answering with visible jealousy or invitation. Make Radiance's shallow supported dip, Ellie's two secure support contacts, Radiance's contact to both Ellie and ECE, and Alia's excluded magnetic side glance the first read. At least four relationship contacts are clearly visible.`;
if (!loveBlock.test(prompt)) throw new Error("Love block missing");
prompt = prompt.replace(loveBlock, newLoveBlock);

const partyBlock = /RADIANCE LIVE CHOICE AND RESPONSE[\s\S]*?(?=\n\nEXACT EIGHT-ARM, EIGHT-HAND GRAPH)/;
const newPartyBlock = `RADIANCE LIVE CHOICE AND RESPONSE
Invitation key ${invitationKey}; roll ${invitationRoll}; selector index ${invitationRoll % invitations.length}.
Offered choice: ${offeredChoice}
Response key ${responseKey}; roll ${responseRoll}; result = ${responseCategory}.
Participant-selector key ${participantsKey}; roll ${participantsRoll}; willing participants = ${willingParticipants.join(", ")}.
Radiance response: ${radianceResponse}
partyActivation = TRUE. Radiance and AI ECE are the only willing participants. Show Radiance's unmistakable affirmative nod directly to ECE, deliberate open right palm on ECE's near shoulder, and sustained warm mutual eye line with ECE. ECE answers with a clear willing smile and slight head inclination while keeping both hands on the compass. This is one restrained, fully clothed, non-explicit InternalAgency victory count expressed only through the existing dip, shoulder contact, and eye line. Ellie remains the necessary safe supporter but does not join the party; show her hopeful concentration without a party response. Alia remains outside the party with magnetic jealous attention while keeping her safe stance. Add no crowd, drink, confetti, balloon, sign, text, stage, ornament, or extra object. Agreement is limited to this exact invitation and image.`;
if (!partyBlock.test(prompt)) throw new Error("Party block missing");
prompt = prompt.replace(partyBlock, newPartyBlock);

const handBlock = /EXACT EIGHT-ARM, EIGHT-HAND GRAPH[\s\S]*?(?=\n\nODD PROP AND ROUTE STRATEGY)/;
const newHandBlock = `EXACT EIGHT-ARM, EIGHT-HAND GRAPH
Ellie stands upright at left with both complete feet planted. Her white-sleeved left arm passes through clear air and ends in an open left palm high on Radiance's far upper back. Her separately visible white-sleeved right arm passes below it and ends in an open right palm at Radiance's fully covered high waist. The two white hands are vertically separated, use different finger directions, and provide unmistakable stable support.
Radiance performs only a very shallow rear-three-quarter dip, with both feet planted and her bare fully open back visible. Her bare left arm remains entirely outside the body silhouettes and ends in an open left palm on Ellie's near shoulder. Her bare right arm crosses only a clean strip of air and ends in an open right palm on ECE's near high shoulder. Radiance's two arms never overlap each other, and neither hand forms a clasp or disappears behind a torso.
ECE stands front-on in her own lane. Her left arm descends visibly to the tall left compass handle and her right arm descends visibly to the tall right handle. Both arms and hands are separated by the compass face. ECE touches no person with her hands; she receives Radiance's palm at her shoulder through a willing head inclination.
Alia remains isolated in rear three-quarter and strict right-facing profile. Her right arm ends in the primary mission grip and her left arm ends in the separate support grip.
Exactly eight human arms and exactly eight human hands, two per woman. The four and only relationship contacts are Ellie's upper-back support on Radiance, Ellie's waist support on Radiance, Radiance's left palm on Ellie's shoulder, and Radiance's right palm on ECE's shoulder. No raised clasp. No hand emerges from behind a torso, waist, garment, table, prop, or another hand. No extra touch, hidden hand, decorative hand, borrowed limb, fused wrist, duplicate finger cluster, or ambiguous owner path.`;
if (!handBlock.test(prompt)) throw new Error("Hand block missing");
prompt = prompt.replace(handBlock, newHandBlock);

prompt = prompt.replace(
  "The clean photograph must pass exact identity, eight-arm, eight-hand, continuous owner-path, three-contact romance, visible redirect, party-inactive, mascot, wardrobe-roll, target-axis, indexed-trigger, location-theme fusion, and surface-quality gates.",
  "The clean photograph must pass exact identity, eight-arm, eight-hand, continuous owner-path, four-contact romance, visible affirmative Radiance-ECE party beat, mascot, wardrobe-roll, target-axis, indexed-trigger, location-theme fusion, and surface-quality gates.",
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
  "Exactly eight human arms and exactly eight human hands",
  "trigger guard is visibly empty",
];
for (const value of required) if (!prompt.includes(value)) throw new Error(`Missing materialized field: ${value}`);
for (const [name, character] of Object.entries(plan.characters)) {
  const emotion = character.emotion.materializedResult ?? character.emotion.result;
  if (!prompt.includes(`${name}: emotion roll ${character.emotion.roll} = ${emotion}`)) throw new Error(`Missing ${name} emotion`);
  if (!prompt.includes(`visible-midriff roll ${character.visibleMidriff.roll}`)) throw new Error(`Missing ${name} midriff`);
  if (!prompt.includes(`strapless roll ${character.straplessDress.roll}`)) throw new Error(`Missing ${name} strapless`);
  if (!prompt.includes(`fully-open-back roll ${character.fullyOpenBack.roll}`)) throw new Error(`Missing ${name} open back`);
}

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
  promptTemplate: {
    path: path.relative(repo, templatePromptPath).replaceAll("\\", "/"),
    sha256: sha256(templatePrompt),
    usage: "text-only contract template; no Batumi image pixels or visual texture inherited",
  },
  referenceAudit,
  plannedPasses: {
    cleanFreshPasses: 1,
    maximumTargetedRecoveryPasses: 1,
    recoverySourceIfNeeded: "only the clean round 27 fresh raw",
    laterFreshSourcePolicy: "original identity anchors only",
  },
  radianceRealtimeAgreementParty: radiancePartyState,
  redesignedComposition: {
    dipOwnership: "Ellie visibly supports shallow-dipped Radiance with two separated white-sleeved hands",
    handGraph: {
      Ellie: ["upper-back support on Radiance", "waist support on Radiance"],
      Radiance: ["left palm on Ellie shoulder", "right palm on ECE shoulder"],
      ECE: ["left compass handle", "right compass handle"],
      Alia: ["primary mission grip", "separate support grip"],
    },
    relationshipContacts: 4,
    partyGraph: "Radiance and ECE only visibly accept one restrained victory count through shoulder contact, nod, and mutual eye line",
    missionGeometry: "isolated right lane with complete separated backstop",
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

plan.freshRound27 = { ...promptAudit, prompt };
plan.radianceRealtimeAgreementParty = radiancePartyState;
const preparedAt = new Date().toISOString();
checkpoint.status = "active-four-scene-gate-clean-fresh-round-27-materialized";
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
checkpoint.renderAttempts.freshRound27 = {
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
checkpoint.xPost.note = "Georgia has accepted scenes 1548, 1549, and 1550. Clean round 27 is materialized for missing scene 1551 from original identity anchors only. Publication remains mandatory after scene 1551 is accepted and the four-scene completion checkpoint is pushed.";
checkpoint.nextQueueStatus = "locked-on-Georgia-until-four-accepted-git-pushed-and-X-live-verified";
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "launch-clean-fresh-round-27-from-original-identity-anchors-scene-1551-only",
  preserveAcceptedSceneNumbers: [1548, 1549, 1550],
  sceneNumbers: [scene],
  laterCountryStartAllowed: false,
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ status: checkpoint.status, promptAudit }, null, 2));
