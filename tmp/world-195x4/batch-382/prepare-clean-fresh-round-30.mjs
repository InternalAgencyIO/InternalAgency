import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const root = path.join(repo, "tmp/world-195x4/batch-382");
const checkpointPath = path.join(repo, "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json");
const contractPath = path.join(repo, "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const ledgerPath = path.join(repo, "assets/lore/starlight-era/world-x-publish-ledger.json");
const templatePromptPath = path.join(root, "scene-1551-clean-fresh-round-29-prompt.txt");
const scene = 1551;
const round = 30;
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
if (sha256File(contractPath) !== expectedContractSha) throw new Error("Authoritative contract changed before clean round 30");
if (sha256File(ledgerPath) !== expectedLedgerSha) throw new Error("X ledger changed before clean round 30");
if (!contract.romance?.radianceRealtimeAgreementPartyRule) throw new Error("Radiance agreement rule missing");
if (checkpoint.status !== "active-four-scene-gate-incomplete-after-clean-fresh-round-29") throw new Error(`Unexpected checkpoint status: ${checkpoint.status}`);
if (checkpoint.renderStrategyReset?.nextCleanRound !== round) throw new Error("Checkpoint does not authorize round 30");

const referenceAudit = references.map(([relativePath, role, expectedSha256], index) => {
  const actualSha256 = sha256File(path.join(repo, relativePath));
  if (actualSha256 !== expectedSha256) throw new Error(`Identity anchor ${index + 1} changed`);
  return { image: index + 1, path: relativePath, role, sha256: actualSha256, exists: true };
});

const invitationKey = "batch382-georgia-scene1551-radianceLiveInvitation-round30";
const responseKey = "batch382-georgia-scene1551-radianceLiveResponse-round30";
const participantsKey = "batch382-georgia-scene1551-radianceLiveParticipants-round30";
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
const radianceResponse = "Radiance clearly declines ECE's celebration offer with one visible side-to-side head shake and her existing left arm fully extended toward ECE in an open-palm no-further-celebration gesture; she maintains warm direct eye contact so the boundary reads affectionate rather than fearful, while Ellie securely completes the already-begun controlled dip.";
const radiancePartyState = {
  round,
  rollMethod: "FNV-1a over recorded round-30 live-narrative keys, reduced modulo 100",
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
    hypotheticalSetIfAffirmative: participantSet,
  },
  offeredChoice,
  radianceResponse,
  partyActivation,
  willingParticipants,
  visibleAgreementEvidence: [],
  visibleResponseEvidence: [
    "Radiance's unmistakable side-to-side head-shake angle toward ECE",
    "Radiance's fully visible left arm and open palm facing ECE as a clear no-further-celebration boundary",
    "Radiance and ECE's warm direct mutual eye line",
    "ECE's calm accepting nod while both hands remain on the compass",
  ],
  continuityState: "Radiance declines the celebration and chooses a quiet return to planning. partyActivation remains false for everyone. Ellie completes only the already-begun public-safe controlled dip; ECE accepts the boundary; Alia remains in her separate mission lane.",
  consentScope: "This decline applies only to this recorded round-30 invitation in scene 1551 and does not transfer to another act, participant, prop interaction, scene, country, or future image.",
};
if (invitationRoll !== 11 || responseRoll !== 99 || participantsRoll !== 6) throw new Error("Round 30 live-narrative rolls changed");
if (partyActivation || willingParticipants.length !== 0) throw new Error("Round 30 party state mismatch");

const templatePrompt = fs.readFileSync(templatePromptPath, "utf8");
let prompt = templatePrompt.replaceAll("round 29", "round 30");

const compositionBlock = /SIMPLE SEPARATED COMPOSITION[\s\S]*?(?=\n\nDETERMINISTIC CHARACTER ROLLS)/;
const newCompositionBlock = `SIMPLE SEPARATED COMPOSITION
Use one clean 28 mm eye-level full-body exposure with generous plain negative space and no layered foreground. Build a conventional two-person dance dip at left-center: Ellie stands upright at 28 percent of frame width and Radiance leans back about twenty degrees at 42 percent, both pairs of feet fully planted and separated. Ellie and Radiance's right arms make one clear shoulder-height clasp against plain dark sea. Radiance's separate left arm extends diagonally toward camera and ECE, ending in a large open palm with every finger visible; it touches nobody and crosses no torso. Put ECE front-on at 60 percent behind one narrow knee-high compass pedestal, directly inside Radiance's warm eye line but with no hand contact. Put Alia large at 82 percent in a rear-three-quarter strict right-facing closed training lane. Her bare upper back, bare four-centimeter midriff band, exact two arms, exact two hands, and metallic replica occupying at least sixteen percent of frame width all remain separate from the complete target and backstop. Keep every face, torso, leg, foot, shoulder, elbow, forearm, wrist, palm, and finger cluster visible. Reserve the lower-left for the dry mascot lounge and the upper third for Batumi landmarks. No stacked body, cropped foot, or decorative clutter.`;
if (!compositionBlock.test(prompt)) throw new Error("Composition block missing");
prompt = prompt.replace(compositionBlock, newCompositionBlock);

const loveBlock = /ROLLED LOVE STORY[\s\S]*?(?=\n\nRADIANCE LIVE CHOICE AND RESPONSE)/;
const newLoveBlock = `ROLLED LOVE STORY
Romance roll 86 = Alia spins Radiance under linked hands while ECE steadies Radiance and Ellie reaches toward the beacon. Materialize the interrupted pursuit as the completed turn settling into Ellie's supported dip while Radiance declines ECE's proposed celebration through her open palm and warm eye line. Alia stays separated in jealous profile. Do not add literal hands beyond the exact graph below.
Compound-love roll 28 = ECE stays close at Radiance's side while warmly greeting Ellie and Alia answers beside them. Materialize its emotional triangle through Radiance and ECE's affectionate boundary-setting eye line, Ellie's willing support, and Alia's excluded tight-jaw profile.
Hard-love roll 40 = a controlled dance dip with stable planted feet and supported back, a second partner catching the dipped adult's free hand, and the fourth answering with visible jealousy or invitation. Ellie is the visible second partner: her left palm supports Radiance's bare upper back and her right hand catches Radiance's right hand in a shoulder-height clasp. Radiance's securely covered cobalt hip rests visibly against Ellie's covered white hip as a stable third contact. Alia is the fourth and shows excluded jealousy through her separated torso and tight-jaw profile. These three and only three relationship contacts are large and unmistakable; Radiance's open decline palm touches nobody.`;
if (!loveBlock.test(prompt)) throw new Error("Love block missing");
prompt = prompt.replace(loveBlock, newLoveBlock);

const partyBlock = /RADIANCE LIVE CHOICE AND RESPONSE[\s\S]*?(?=\n\nEXACT EIGHT-ARM, EIGHT-HAND GRAPH)/;
const newPartyBlock = `RADIANCE LIVE CHOICE AND RESPONSE
Invitation key ${invitationKey}; roll ${invitationRoll}; selector index ${invitationRoll % invitations.length}.
Offered choice: ${offeredChoice}
Response key ${responseKey}; roll ${responseRoll}; result = ${responseCategory}.
Participant-selector key ${participantsKey}; roll ${participantsRoll}; hypothetical affirmative participants = ${participantSet.join(", ")}; willing participants = none because Radiance declined.
Radiance response: ${radianceResponse}
partyActivation = FALSE. No one participates in an InternalAgency party beat. Show Radiance's clear head-shake angle toward ECE, her fully visible open left palm facing ECE, and their sustained warm mutual eye line. ECE gives one calm accepting nod while keeping both hands on the compass. Ellie completes only the already-begun stable public-safe dip and does not convert it into a celebration. Alia remains separate. A decline is a complete valid story outcome. Add no crowd, drink, confetti, balloon, sign, text, stage, ornament, or party object. The decline is limited to this exact invitation and image.`;
if (!partyBlock.test(prompt)) throw new Error("Party block missing");
prompt = prompt.replace(partyBlock, newPartyBlock);

const handBlock = /EXACT EIGHT-ARM, EIGHT-HAND GRAPH[\s\S]*?(?=\n\nODD PROP AND ROUTE STRATEGY)/;
const newHandBlock = `EXACT EIGHT-ARM, EIGHT-HAND GRAPH
Ellie stands upright at left with both complete feet planted. Her white-sleeved left arm remains entirely outside both torso silhouettes and ends in one open left palm spread high and visibly on Radiance's bare upper back. Her separate white-sleeved right arm extends toward camera through clean air and ends at shoulder height in one clear palm-to-palm clasp with Radiance's right hand. Show both white sleeves, elbows, forearms, wrists, palms, and finger clusters continuously.
Radiance performs a conventional shallow rear-three-quarter dip with both complete feet planted and her uninterrupted fully open upper back facing camera. Her bare right arm extends toward camera through clean air to the shoulder-height clasp with Ellie's right hand. Her separate bare left arm extends diagonally away from every body and prop toward ECE, ending in one large open decline palm facing ECE with all five fingers separated. It touches nobody. Show both bare shoulders, elbows, forearms, wrists, palms, and finger clusters continuously.
ECE stands front-on in her own lane. Her left arm descends visibly to the tall left compass handle and her right arm descends visibly to the tall right handle. Both arms and hands are separated by the compass face. ECE touches no person with her hands and owns the compass alone.
Alia remains isolated in rear three-quarter and strict right-facing profile. Her right arm ends in the primary mission grip and her left arm ends in the separate support grip. Both arms and hands are silhouetted against plain empty pavement.
Exactly eight human arms and exactly eight human hands, two per woman. The three and only three relationship contacts are Ellie's left palm on Radiance's upper back, Ellie and Radiance's shoulder-height right-hand clasp, and Radiance's securely covered cobalt hip resting against Ellie's covered white hip. Radiance's left decline palm touches nobody. No hand emerges from behind a torso, waist, garment, table, prop, or another hand. No extra touch, hidden hand, decorative hand, borrowed limb, fused wrist, duplicate finger cluster, or ambiguous owner path.`;
if (!handBlock.test(prompt)) throw new Error("Hand block missing");
prompt = prompt.replace(handBlock, newHandBlock);

prompt = prompt.replace(
  "Radiance and ECE remain the affectionate narrative center through sustained warm mutual eye line, inward torso direction, and ECE's remorseful willing response while Ellie's dip contact remains equally legible.",
  "Radiance and ECE remain the affectionate narrative center through sustained warm mutual eye line, Radiance's clear but gentle open-palm boundary, and ECE's remorseful accepting nod while Ellie's dip support remains equally legible.",
);
prompt = prompt.replace(
  "Show exactly one unmistakably full-size approximately 27-centimeter polished steel Desert Eagle-style large-frame inert cinema-training replica with a metallic heat-anodized rainbow gradient, compact short barrel, one substantial heavy grip, one oversized black oval trigger guard, and a small orange muzzle insert only inside the barrel opening. It must read as heavy polished metal, never bright plastic or a toy.",
  "Show exactly one unmistakably full-size approximately 30-centimeter polished-steel Desert Eagle-style large-frame inert cinema-training replica occupying at least sixteen percent of frame width. It has a metallic heat-anodized rainbow gradient, compact short barrel, one substantial heavy grip, one oversized black oval trigger guard, and a small orange muzzle insert only inside the barrel opening. It must read as heavy polished metal, never bright plastic, a water pistol, a squirt gun, or a toy.",
);
prompt = prompt.replace(
  "The clean photograph must pass exact identity, eight-arm, eight-hand, continuous owner-path, three-contact conventional controlled-dip romance, visible affirmative Radiance-Ellie-ECE party beat with Alia excluded, mascot, wardrobe-roll, full-size metallic replica, target-axis, indexed-trigger, location-theme fusion, and surface-quality gates.",
  "The clean photograph must pass exact identity, eight-arm, eight-hand, continuous owner-path, three-contact conventional controlled-dip romance, explicit Radiance decline with party inactive, Radiance-ECE affectionate boundary, mascot, wardrobe-roll, full-size metallic replica, target-axis, indexed-trigger, location-theme fusion, and surface-quality gates.",
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
    recoverySourceIfNeeded: "only the clean round 30 fresh raw",
    laterFreshSourcePolicy: "original identity anchors only",
  },
  radianceRealtimeAgreementParty: radiancePartyState,
  redesignedComposition: {
    dipOwnership: "conventional Ellie-Radiance clasp dip with Radiance free arm fully extended as the decline response",
    handGraph: {
      Ellie: ["left palm supports Radiance upper back", "right hand shoulder-height-clasps Radiance right hand"],
      Radiance: ["right hand shoulder-height-clasps Ellie right hand", "left open decline palm extends toward ECE without contact"],
      ECE: ["left compass handle", "right compass handle"],
      Alia: ["primary mission grip", "separate support grip"],
    },
    relationshipContacts: 3,
    partyGraph: "party inactive; Radiance explicitly declines ECE through head shake and open palm while preserving warm mutual eye line",
    missionGeometry: "isolated right lane with open back, four-centimeter midriff band, replica occupying at least sixteen percent of frame width, and complete backstop",
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

plan.freshRound30 = { ...promptAudit, prompt };
plan.radianceRealtimeAgreementParty = radiancePartyState;
const preparedAt = new Date().toISOString();
checkpoint.status = "active-four-scene-gate-clean-fresh-round-30-materialized";
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
checkpoint.renderAttempts.freshRound30 = {
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
checkpoint.xPost.note = "Georgia has accepted scenes 1548, 1549, and 1550. Clean round 30 is materialized for missing scene 1551 from original identity anchors only. Publication remains mandatory after scene 1551 is accepted and the four-scene completion checkpoint is pushed.";
checkpoint.nextQueueStatus = "locked-on-Georgia-until-four-accepted-git-pushed-and-X-live-verified";
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "launch-clean-fresh-round-30-from-original-identity-anchors-scene-1551-only",
  preserveAcceptedSceneNumbers: [1548, 1549, 1550],
  sceneNumbers: [scene],
  laterCountryStartAllowed: false,
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ status: checkpoint.status, promptAudit }, null, 2));
