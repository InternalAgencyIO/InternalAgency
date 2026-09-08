import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const root = path.join(repo, "tmp/world-195x4/batch-382");
const checkpointPath = path.join(repo, "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json");
const contractPath = path.join(repo, "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const ledgerPath = path.join(repo, "assets/lore/starlight-era/world-x-publish-ledger.json");
const templatePromptPath = path.join(root, "scene-1551-clean-fresh-round-31-prompt.txt");
const scene = 1551;
const round = 32;
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
if (sha256File(contractPath) !== expectedContractSha) throw new Error("Authoritative contract changed before clean round 32");
if (sha256File(ledgerPath) !== expectedLedgerSha) throw new Error("X ledger changed before clean round 32");
if (!contract.romance?.radianceRealtimeAgreementPartyRule) throw new Error("Radiance agreement rule missing");
if (checkpoint.status !== "active-four-scene-gate-incomplete-after-clean-fresh-round-31") throw new Error(`Unexpected checkpoint status: ${checkpoint.status}`);
if (checkpoint.renderStrategyReset?.nextCleanRound !== round) throw new Error("Checkpoint does not authorize round 32");
if (checkpoint.renderAttempts.freshRound32) throw new Error("Round 32 was already materialized");

const referenceAudit = references.map(([relativePath, role, expectedSha256], index) => {
  const actualSha256 = sha256File(path.join(repo, relativePath));
  if (actualSha256 !== expectedSha256) throw new Error(`Identity anchor ${index + 1} changed`);
  return { image: index + 1, path: relativePath, role, sha256: actualSha256, exists: true };
});

const invitationKey = "batch382-georgia-scene1551-radianceLiveInvitation-round32";
const responseKey = "batch382-georgia-scene1551-radianceLiveResponse-round32";
const participantsKey = "batch382-georgia-scene1551-radianceLiveParticipants-round32";
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
const radianceResponse = "Radiance explicitly accepts Ellie's one-count invitation with one clear up-down nod, a broad willing smile directed first to Ellie and then ECE, and a deliberate lift of their existing clasp while she remains securely supported in the shallow dip. Her separate open left palm turns upward toward ECE as an invitation to share the same synchronized foot count.";
const radiancePartyState = {
  round,
  rollMethod: "FNV-1a over recorded round-32 live-narrative keys, reduced modulo 100",
  invitation: { key: invitationKey, fullHash: invitationFullHash, roll: invitationRoll, selectorIndex: invitationRoll % invitations.length },
  response: {
    key: responseKey,
    fullHash: responseFullHash,
    roll: responseRoll,
    thresholds: "0-69 explicit affirmative; 70-84 explicit redirect; 85-94 explicit pause; 95-99 explicit decline",
    category: responseCategory,
  },
  participantSelector: {
    key: participantsKey,
    fullHash: participantsFullHash,
    roll: participantsRoll,
    thresholds: "0-24 Radiance+ECE; 25-49 Radiance+Ellie+ECE; 50-74 all four; 75-99 Radiance+ECE+Alia",
    hypotheticalSetIfAffirmative: participantSet,
  },
  offeredChoice,
  radianceResponse,
  partyActivation,
  willingParticipants,
  visibleAgreementEvidence: [
    "Radiance's clear up-down nod and broad willing smile to Ellie",
    "Radiance and Ellie's deliberately lifted existing clasp",
    "Radiance's open left palm inviting ECE into the same one-count foot rhythm",
    "ECE and Alia each answer with a visible synchronized heel tap and willing smile while keeping their assigned two-hand tasks safe",
  ],
  visibleResponseEvidence: [],
  continuityState: "Radiance accepts exactly one fully clothed public-safe victory count. Ellie, ECE, and Alia visibly opt into that same count. ECE retains both compass hands and Alia retains the closed downrange training line; the party beat ends after the single synchronized count.",
  consentScope: "This affirmative applies only to this recorded round-32 one-count invitation in scene 1551 and does not transfer to another act, participant, prop interaction, scene, country, or future image.",
};
if (invitationFullHash !== 3976656349 || invitationRoll !== 49 || invitationRoll % invitations.length !== 1) throw new Error("Round 32 invitation roll changed");
if (responseFullHash !== 2666543337 || responseRoll !== 37 || responseCategory !== "explicit affirmative") throw new Error("Round 32 response roll changed");
if (participantsFullHash !== 901917468 || participantsRoll !== 68 || participantSet.join("|") !== "Radiance|Ellie|AI ECE|Alia") throw new Error("Round 32 participant roll changed");
if (!partyActivation || willingParticipants.join("|") !== participantSet.join("|")) throw new Error("Round 32 party state mismatch");

const templatePrompt = fs.readFileSync(templatePromptPath, "utf8");
let prompt = templatePrompt.replaceAll("round 31", "round 32");

const compositionBlock = /SIMPLE SEPARATED COMPOSITION[\s\S]*?(?=\n\nDETERMINISTIC CHARACTER ROLLS)/;
const newCompositionBlock = `SIMPLE SEPARATED COMPOSITION
Use one clean 24 mm eye-level full-body exposure with generous plain negative space. At left-center, Ellie stands upright at 23 percent of frame width with stable feet; Radiance is immediately in front of her at 39 percent, torso leaning back twenty-five degrees with head lower than Ellie's shoulder and both complete feet planted. Their existing right-hand clasp is lifted at far left in clean air. Ellie's separate white-sleeved support arm remains fully visible and ends high on Radiance's uninterrupted open back. Radiance's covered left shoulder and side torso visibly rest against Ellie's white-covered front torso as the third support contact. Radiance's separate left arm opens toward ECE without touching her. Put ECE front-on at 60 percent behind one narrow knee-high compass pedestal, directly inside Radiance's warm eye line, with one heel visibly lifted for the shared count. Put Alia closer to camera at 86 percent in rear-three-quarter strict right-facing profile, complete body and footwear still in frame. Her strapless open-back copper shell, clear waist reveal, exact two arms, exact two hands, and large polished-metal inert training replica are unobstructed; the side-on replica occupies at least twenty percent of frame width while remaining aimed only at the complete target and backstop. Alia answers the shared count with a willing smile and a lifted rear heel without changing her safe upper-body line. Keep every face, torso, leg, foot, shoulder, elbow, forearm, wrist, palm, and finger cluster visible. Reserve lower-left for the dry mascot lounge and upper third for Batumi landmarks. No stacked body, cropped foot, layered foreground, or decorative clutter.`;
if (!compositionBlock.test(prompt)) throw new Error("Composition block missing");
prompt = prompt.replace(compositionBlock, newCompositionBlock);

const loveBlock = /ROLLED LOVE STORY[\s\S]*?(?=\n\nRADIANCE LIVE CHOICE AND RESPONSE)/;
const newLoveBlock = `ROLLED LOVE STORY
Romance roll 86 = Alia spins Radiance under linked hands while ECE steadies Radiance and Ellie reaches toward the beacon. Materialize the completed spin settling into Ellie's unmistakable shallow dip while all four visibly agree to one shared victory count. Alia stays in the safe mission lane while answering with a willing side glance and heel tap. Do not add literal hands beyond the exact graph below.
Compound-love roll 28 = ECE stays close at Radiance's side while warmly greeting Ellie and Alia answers beside them. Materialize its emotional square through Radiance and Ellie's explicit yes, Radiance and ECE's affectionate eye line, and Alia's willing answer from the separate lane.
Hard-love roll 40 = a controlled dance dip with stable planted feet and supported back, a second partner catching the dipped adult's free hand, and the fourth answering with visible jealousy or invitation. Ellie visibly supports Radiance: her left palm rests high on Radiance's open upper back and her right hand catches Radiance's right hand in the lifted clasp. Radiance's covered left shoulder and side torso rest visibly against Ellie's covered front torso as the third contact. Alia answers as the fourth through her willing smile and synchronized heel tap. These three and only three relationship contacts are large and unmistakable. Radiance's separate open left palm touches nobody.`;
if (!loveBlock.test(prompt)) throw new Error("Love block missing");
prompt = prompt.replace(loveBlock, newLoveBlock);

const partyBlock = /RADIANCE LIVE CHOICE AND RESPONSE[\s\S]*?(?=\n\nEXACT EIGHT-ARM, EIGHT-HAND GRAPH)/;
const newPartyBlock = `RADIANCE LIVE CHOICE AND RESPONSE
Invitation key ${invitationKey}; full hash ${invitationFullHash}; roll ${invitationRoll}; selector index ${invitationRoll % invitations.length}.
Offered choice: ${offeredChoice}
Response key ${responseKey}; full hash ${responseFullHash}; roll ${responseRoll}; result = ${responseCategory}.
Participant-selector key ${participantsKey}; full hash ${participantsFullHash}; roll ${participantsRoll}; willing participants = ${willingParticipants.join(", ")}.
Radiance response: ${radianceResponse}
partyActivation = TRUE. Show exactly one adult, consensual, fully clothed, public-safe InternalAgency victory count involving only Radiance, Ellie, AI ECE, and Alia. Radiance visibly nods yes and lifts the existing clasp with Ellie; ECE and Alia each answer with a willing smile and one synchronized heel tap. ECE keeps both hands on the compass and Alia keeps both hands in the safe closed training line. The one-count party ends within this image. Add no crowd, drink, confetti, balloon, sign, text, stage, ornament, or party object. Agreement is limited to this exact invitation and image.`;
if (!partyBlock.test(prompt)) throw new Error("Party block missing");
prompt = prompt.replace(partyBlock, newPartyBlock);

const handBlock = /EXACT EIGHT-ARM, EIGHT-HAND GRAPH[\s\S]*?(?=\n\nODD PROP AND ROUTE STRATEGY)/;
const newHandBlock = `EXACT EIGHT-ARM, EIGHT-HAND GRAPH
Ellie stands upright at left. Her white-sleeved left arm stays entirely outside both torso silhouettes and ends in one open left palm spread high on Radiance's uninterrupted open upper back. Her separate white-sleeved right arm extends leftward through clean air and ends in one lifted palm-to-palm clasp with Radiance's right hand. Show both sleeves, elbows, forearms, wrists, palms, and finger clusters continuously.
Radiance performs a conventional shallow rear-three-quarter dip with head lower than Ellie's shoulder and both complete feet planted. Her right arm extends leftward to the lifted clasp with Ellie's right hand. Her separate left arm extends toward ECE, ending in one large open affirmative palm with all five fingers separated; it touches nobody. Show both shoulders, elbows, forearms, wrists, palms, and finger clusters continuously.
ECE stands front-on in her own lane. Her left arm descends visibly to the tall left compass handle and her right arm descends visibly to the tall right handle. Both arms and hands are separated by the compass face. ECE touches no person and owns the compass alone.
Alia remains isolated in rear-three-quarter strict right-facing profile. Her right arm ends in the primary mission grip and her left arm ends in the separate support grip. Both arms and hands are silhouetted against plain empty pavement.
Exactly eight human arms and exactly eight human hands, two per woman. The three and only three relationship contacts are Ellie's left palm on Radiance's upper back, Ellie and Radiance's lifted right-hand clasp, and Radiance's covered left shoulder and side torso visibly resting against Ellie's covered front torso. Radiance's left affirmative palm touches nobody. No hand emerges from behind a torso, waist, garment, table, prop, or another hand. No extra touch, hidden hand, decorative hand, borrowed limb, fused wrist, duplicate finger cluster, or ambiguous owner path.`;
if (!handBlock.test(prompt)) throw new Error("Hand block missing");
prompt = prompt.replace(handBlock, newHandBlock);

prompt = prompt.replace(
  "Radiance and ECE remain the affectionate narrative center through sustained warm mutual eye line, Radiance's clear open-palm redirect toward ECE's map, and ECE's remorseful accepting nod while Ellie's dip support remains equally legible.",
  "Radiance and ECE remain the affectionate narrative center through sustained warm mutual eye line and Radiance's open affirmative palm while Ellie's supported dip and the quartet's single willing victory count remain equally legible.",
);
prompt = prompt.replace(
  "Show exactly one unmistakably full-size approximately 30-centimeter polished-steel Desert Eagle-style large-frame inert cinema-training replica occupying at least sixteen percent of frame width. It has a metallic heat-anodized rainbow gradient, compact short barrel, one substantial heavy grip, one oversized black oval trigger guard, and a small orange muzzle insert only inside the barrel opening. It must read as heavy polished metal, never bright plastic, a water pistol, a squirt gun, or a toy.",
  "Show exactly one unmistakably full-size approximately 30-centimeter dark polished-steel Desert Eagle-style large-frame inert cinema-training replica in close side profile occupying at least twenty percent of frame width. It has a restrained metallic heat-anodized rainbow gradient over a steel base, compact short barrel, one substantial heavy grip, one oversized black oval trigger guard, and a clearly visible small orange safety insert only inside the barrel opening. It must read as heavy machined metal, never bright blue plastic, a water pistol, a squirt gun, or a toy.",
);
prompt = prompt.replace(
  "The clean photograph must pass exact identity, eight-arm, eight-hand, continuous owner-path, three-contact conventional controlled-dip romance, explicit Radiance redirect with party inactive, Radiance-ECE affectionate center, mascot, wardrobe-roll, full-size metallic inert training replica, target-axis, indexed-trigger, location-theme fusion, and surface-quality gates.",
  "The clean photograph must pass exact identity, eight-arm, eight-hand, continuous owner-path, three-contact conventional controlled-dip romance, explicit Radiance affirmative with all-four one-count party active, Radiance-ECE affectionate center, mascot, wardrobe-roll, full-size metallic inert training replica, target-axis, indexed-trigger, location-theme fusion, and surface-quality gates.",
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
  "at least twenty percent of frame width",
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
    recoverySourceIfNeeded: "only the clean round 32 fresh raw",
    laterFreshSourcePolicy: "original identity anchors only",
  },
  radianceRealtimeAgreementParty: radiancePartyState,
  redesignedComposition: {
    dipOwnership: "Ellie supports Radiance in a diagonal shallow dip during one all-four victory count",
    handGraph: {
      Ellie: ["left palm supports Radiance upper back", "right hand lifts Radiance right hand in clasp"],
      Radiance: ["right hand lifts clasp with Ellie", "left open affirmative palm invites ECE without contact"],
      ECE: ["left compass handle", "right compass handle"],
      Alia: ["primary mission grip", "separate support grip"],
    },
    relationshipContacts: 3,
    partyGraph: "party active for exactly all four through one synchronized heel count, willing smiles, Radiance nod, and lifted clasp",
    missionGeometry: "Alia closer at right with full body visible, open-back strapless shell, waist reveal, dark polished-metal inert training replica occupying at least twenty percent width, and complete backstop",
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

plan.freshRound32 = { ...promptAudit, prompt };
plan.radianceRealtimeAgreementParty = radiancePartyState;
const preparedAt = new Date().toISOString();
checkpoint.status = "active-four-scene-gate-clean-fresh-round-32-materialized";
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
checkpoint.renderAttempts.freshRound32 = {
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
checkpoint.xPost.note = "Georgia has accepted scenes 1548, 1549, and 1550. Clean round 32 is materialized for missing scene 1551 from original identity anchors only. Publication remains mandatory after scene 1551 is accepted and the four-scene completion checkpoint is pushed.";
checkpoint.nextQueueStatus = "locked-on-Georgia-until-four-accepted-git-pushed-and-X-live-verified";
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "launch-clean-fresh-round-32-from-original-identity-anchors-scene-1551-only",
  preserveAcceptedSceneNumbers: [1548, 1549, 1550],
  sceneNumbers: [scene],
  laterCountryStartAllowed: false,
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ status: checkpoint.status, promptAudit }, null, 2));
