import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const root = path.join(repo, "tmp/world-195x4/batch-382");
const checkpointPath = path.join(repo, "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json");
const contractPath = path.join(repo, "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const ledgerPath = path.join(repo, "assets/lore/starlight-era/world-x-publish-ledger.json");
const templatePromptPath = path.join(root, "scene-1551-clean-fresh-round-23-prompt.txt");
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
const contract = JSON.parse(fs.readFileSync(contractPath, "utf8"));
const scene = 1551;
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
if (sha256File(contractPath) !== expectedContractSha) throw new Error("Authoritative contract changed before clean round 24");
if (sha256File(ledgerPath) !== expectedLedgerSha) throw new Error("X publishing ledger changed before clean round 24");
if (!contract.romance?.radianceRealtimeAgreementPartyRule) throw new Error("Radiance agreement rule missing");
if (checkpoint.status !== "active-four-scene-gate-incomplete-after-clean-fresh-round-23") {
  throw new Error(`Unexpected checkpoint status: ${checkpoint.status}`);
}
if (checkpoint.renderStrategyReset?.nextCleanRound !== 24) throw new Error("Checkpoint does not authorize clean round 24");

const referenceAudit = references.map(([relativePath, role, expectedSha256], index) => {
  const actualSha256 = sha256File(path.join(repo, relativePath));
  if (actualSha256 !== expectedSha256) throw new Error(`Identity anchor ${index + 1} changed`);
  return { image: index + 1, path: relativePath, role, sha256: actualSha256, exists: true };
});

const invitationKey = "batch382-georgia-scene1551-radianceLiveInvitation-round24";
const responseKey = "batch382-georgia-scene1551-radianceLiveResponse-round24";
const participantsKey = "batch382-georgia-scene1551-radianceLiveParticipants-round24";
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
const participantSets = participantsRoll <= 24
  ? ["Radiance", "AI ECE"]
  : participantsRoll <= 49
    ? ["Radiance", "Ellie", "AI ECE"]
    : participantsRoll <= 74
      ? ["Radiance", "Ellie", "AI ECE", "Alia"]
      : ["Radiance", "AI ECE", "Alia"];
const willingParticipants = partyActivation ? participantSets : [];
const radianceResponse = partyActivation
  ? "Radiance gives a clear affirmative nod to Alia's invitation, deliberately firms her supporting stance, voluntarily turns her shoulders toward ECE, and sustains an affectionate eye line to ECE while keeping Ellie safely supported."
  : responseCategory === "explicit redirect"
    ? "Radiance clearly shakes her head once and turns her torso and sustained eye line back to ECE's holographic route map."
    : responseCategory === "explicit pause"
      ? "Radiance holds the safe pose and clearly signals a pause through her face without starting a celebration."
      : "Radiance clearly shakes her head, turns away from the offered celebration, and keeps only the required safe support contact.";
const radiancePartyState = {
  round: 24,
  rollMethod: "FNV-1a over recorded round-24 live-narrative keys, reduced modulo 100",
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
  visibleAgreementEvidence: partyActivation ? [
    "Radiance's clear affirmative nod toward Alia",
    "Radiance's deliberately firm supporting stance",
    "Radiance's voluntary shoulder turn toward ECE",
    "Radiance's sustained affectionate eye line to ECE",
    "ECE and Alia each answer with a clear willing nod while retaining their assigned hands",
    "Ellie remains outside the invitation-specific party with a neutral jealous expression",
  ] : [],
  visibleResponseEvidence: partyActivation ? [] : [radianceResponse],
  continuityState: partyActivation
    ? "The accepted invitation becomes one restrained, fully clothed, non-explicit InternalAgency victory count for Radiance, AI ECE, and Alia only. Ellie remains outside that invitation-specific party while safely performing the rolled controlled-dip story beat."
    : "No party activates; the safe route lesson remains the visible scene outcome.",
  consentScope: "This response applies only to this recorded round-24 invitation in scene 1551 and does not transfer to another act, participant, prop interaction, scene, country, or future image.",
};
if (!partyActivation || willingParticipants.join("|") !== "Radiance|AI ECE|Alia") throw new Error("Round 24 deterministic party state mismatch");

const templatePrompt = fs.readFileSync(templatePromptPath, "utf8");
let prompt = templatePrompt.replaceAll("round 23", "round 24");

const castBlock = /ADULT CAST AND IDENTITY[\s\S]*?(?=\n\nDETERMINISTIC CHARACTER ROLLS)/;
const stagedCastBlock = `ADULT CAST AND IDENTITY
Show exactly four clearly adult fictional women, all visibly over 28: blonde Radiance, dark-haired Ellie, Black Alia with the only high sculptural braided ponytail, and brunette AI ECE. Preserve four different anchored faces and bodies with no clone, merge, replacement, or age shift. Male selector = inactive; show no man and no fifth adult.

COLOR-SEPARATED COMPOSITION BLUEPRINT
Use a clean 28 mm eye-level full-body portrait exposure with generous negative space and no stacked bodies. Place Radiance at 22 percent of frame width in a respectful rear three-quarter view, shallow-dipped Ellie immediately beside her at 37 percent, ECE and her narrow compass pedestal close by at 53 percent, and Alia larger in a separate right foreground lane at 78 percent. The short Ellie-to-ECE shoulder reach crosses a clear strip of sky-blue negative space. Send Alia's closed training lane diagonally away from the camera toward a tall shoulder-height backstop in the far-right middle distance. Keep every face, torso, leg, foot, shoulder, elbow, forearm, wrist, palm, and finger cluster visible. Show Radiance's and Alia's rolled open backs simultaneously. Reserve the upper third for Batumi landmarks and the lower-left corner for the mascots.`;
if (!castBlock.test(prompt)) throw new Error("Could not locate cast block");
prompt = prompt.replace(castBlock, stagedCastBlock);

const priorPartyBlock = /RADIANCE LIVE AGREEMENT AND PARTY ACTIVATION[\s\S]*?(?=\n\nEXACT SOLVABLE EIGHT-HAND CONTACT GRAPH)/;
const partyBlock = `RADIANCE LIVE AGREEMENT AND PARTY ACTIVATION
This fresh round records a new invitation and explicit response before rendering.
Invitation key ${invitationKey}; roll ${invitationRoll}; selector index ${invitationRoll % invitations.length}.
Offered choice: ${offeredChoice}
Response key ${responseKey}; roll ${responseRoll}; result = ${responseCategory}.
Radiance response: ${radianceResponse}
Participant-selector key ${participantsKey}; roll ${participantsRoll}; willing participants = ${willingParticipants.join(", ")}.
partyActivation = TRUE. Show Radiance's explicit affirmative nod toward Alia, deliberately firm supporting stance, voluntary shoulder turn toward ECE, and sustained affectionate eye line to ECE. ECE and Alia each answer with a clear willing nod while keeping both assigned hands on their safe props. Ellie is not a willing participant in this invitation-specific party: she retains a neutral jealous expression and performs only the required safe dip and contact graph. The accepted invitation becomes one restrained, fully clothed, non-explicit InternalAgency victory count for Radiance, ECE, and Alia only. Add no crowd, drinks, confetti, balloons, signs, text, stage, ornaments, or extra object. Agreement is limited to this exact invitation and image.`;
if (!priorPartyBlock.test(prompt)) throw new Error("Could not locate Radiance party block");
prompt = prompt.replace(priorPartyBlock, partyBlock);

const priorHandBlock = /EXACT SOLVABLE EIGHT-HAND CONTACT GRAPH[\s\S]*?(?=\n\nODD PROP AND ROUTE STRATEGY)/;
const handBlock = `EXACT SOLVABLE EIGHT-HAND CONTACT GRAPH
Radiance stands at left in a respectful rear three-quarter view with both feet planted and supports a very shallow backward dip of Ellie immediately to her right. Radiance's bare left shoulder, upper arm, elbow, forearm, wrist, and open left palm form one continuous visible cobalt-against-white line; her left palm supports Ellie high on the upper back. Nothing hides this support arm. Radiance's bare right arm remains visible in open air and ends in her right hand clasping Ellie's left hand at shoulder height. Show both complete clasped hands separately. Radiance's fully open upper back remains clearly visible while she gives the affirmative nod toward Alia and turns her shoulders and strongest eye line toward ECE.
Ellie's free right shoulder, white sleeve, elbow, short forearm, wrist, and open right palm form one continuous visible white-against-blue arc through a dedicated strip of negative space to ECE's near high shoulder. Ellie touches only ECE's shoulder and never the compass. Ellie's neutral jealous expression keeps her visibly outside the invitation-specific party.
ECE stands front-on in her own lane. Her left arm descends visibly to the tall left compass handle and her right arm descends visibly to the tall right handle. Both arms and both hands remain separated and fully visible. ECE touches no person.
Alia remains isolated in an oblique right-facing lane. Her right arm ends in the primary mission grip and her left arm ends in the separate support grip described below.
Exactly eight human arms and exactly eight human hands, two per woman. The three relationship contacts are only Radiance's upper-back support on Ellie, the Radiance-Ellie reciprocal clasp, and Ellie's palm on ECE's shoulder. No hand emerges from behind a torso, waist, garment, table, prop, or another hand. No extra touch, decorative hand, hidden hand, borrowed limb, fused wrist, or ambiguous finger cluster.`;
if (!priorHandBlock.test(prompt)) throw new Error("Could not locate hand block");
prompt = prompt.replace(priorHandBlock, handBlock);

const priorOddPropBlock = /ODD PROP AND ROUTE STRATEGY[\s\S]*?(?=\n\nMASCOT STATE)/;
const oddPropBlock = `ODD PROP AND ROUTE STRATEGY
Odd-prop roll 12 = ACTIVE. Holder selector roll 86 = AI ECE. Prop-family selector roll 88 = one oversized magnetic compass table. Interpret oversized as a bold readable circular compass face on a narrow knee-high pedestal that does not hide any torso, arm, wrist, hand, leg, or foot. Put two tall separate brass handles at opposite edges. ECE faces camera front-on with level shoulders and both arms descending symmetrically in clear air to the two handles. Nobody else touches the compass. A separate small translucent blue holographic route map rises hands-free from its center, showing a coastline and three route nodes with no readable text or logo. Radiance's affirmative shoulder turn and eye line center on ECE while ECE answers with a clear willing nod. Ellie's palm touches only ECE's high shoulder, never the table or handles.`;
if (!priorOddPropBlock.test(prompt)) throw new Error("Could not locate odd-prop block");
prompt = prompt.replace(priorOddPropBlock, oddPropBlock);

const priorMissionBlock = /MISSION PROP AND TARGET[\s\S]*?(?=\n\nDECLUTTER AND FINAL GATES)/;
const missionBlock = `MISSION PROP AND TARGET
Pose-target roll 25; resolved handler = Alia because rainbow hosiery is active. Use an oblique deep-perspective closed training lane instead of a flat side-on diagram. Put Alia large in the right foreground in three-quarter back and strict right-facing profile, with her adult face and braided identity visible. Her compact replica points diagonally away from the camera into an empty lane. Place one complete tall thick sand backstop with one white paper and one black non-humanoid route diamond several visible meters away in the far-right middle distance. Raise the paper so its black-diamond center is exactly at Alia's shoulder-height orange-muzzle sight line. Show a long strip of empty wet pavement and one transparent safety panel between muzzle and backstop. The target must be entirely separate from the replica in image space, with no overlap or contact.
Show exactly one full-size polished rainbow-gradient Desert Eagle-style large-frame inert cinema-training pistol replica with a compact short barrel, one grip, one oversized black oval trigger guard, and an orange muzzle plug. Angle its right side plate toward the camera so the safety hand position is large and readable. Alia's primary right hand wraps the grip. Her right trigger index is one fully extended straight finger lying flat along the rainbow side plate above and outside the guard. The entire black oval trigger guard is visibly empty. Alia's support left palm cups the lower front of the primary hand and grip base as a second separate cluster below and forward, with a clear band of air between the two wrists and visually different finger directions. Show both shoulders, elbows, forearms, wrists, palms, and finger clusters separately against negative space. Alia gives Radiance one clear willing side-eye nod without changing the safe muzzle axis.
Alia wears one secure opaque strapless copper bodice with a high straight top edge, bare shoulders, wide opaque side panels, a restrained three-centimeter midriff band, and a fully open upper back. No necklace, neckband, collar, neck loop, strap, sleeve, halter, back band, crossing band, fabric panel, or illusion mesh. Preserve her cobalt pleated skort, braids, green conduits, and complete boots.
Align Alia's dominant eye and top sights toward the distant black diamond along the receding lane. Every person and mascot remains behind and left of the muzzle plane. No ammunition, loose magazine, firing, muzzle flash, threat, injury, combat, or aiming at a person, animal, occupied object, or camera.`;
if (!priorMissionBlock.test(prompt)) throw new Error("Could not locate mission block");
prompt = prompt.replace(priorMissionBlock, missionBlock);

const plan = checkpoint.scenePlans[String(scene)];
const required = [
  `Weather roll ${plan.weather.roll} = ${plan.weather.result}`,
  `Hard-love roll ${plan.hardLoveBeat.roll} = ${plan.hardLoveBeat.result}`,
  `Romance roll ${plan.romanceBeat.roll}`,
  `Compound-love roll ${plan.compoundLoveBeat.roll}`,
  `Pose-target roll ${plan.poseTargetRoll.roll}`,
  `Mascot roll ${plan.mascotState.roll}`,
  `Odd-prop roll ${plan.interestingProp.roll}`,
  "partyActivation = TRUE",
  "Exactly eight human arms and exactly eight human hands",
  "trigger guard is visibly empty",
];
for (const value of required) if (!prompt.includes(value)) throw new Error(`Missing materialized field: ${value}`);
for (const character of Object.values(plan.characters)) {
  const emotion = character.emotion.materializedResult ?? character.emotion.result;
  if (!prompt.includes(`emotion roll ${character.emotion.roll} = ${emotion}`)) throw new Error("Missing emotion materialization");
}

const promptPath = path.join(root, `scene-${scene}-clean-fresh-round-24-prompt.txt`);
fs.writeFileSync(promptPath, prompt, "utf8");
const promptAudit = {
  path: path.relative(repo, promptPath).replaceAll("\\", "/"),
  sha256: sha256(prompt),
  chars: prompt.length,
  storedContractRollsChanged: false,
  freshRound: 24,
  sourceMode: "clean-generation-from-original-identity-anchors",
  priorBatumiRenderInputCount: 0,
  promptTemplate: {
    path: path.relative(repo, templatePromptPath).replaceAll("\\", "/"),
    sha256: sha256(templatePrompt),
    usage: "text-only contract template; no image pixels or visual texture inherited",
  },
  referenceAudit,
  plannedPasses: {
    cleanFreshPasses: 1,
    maximumTargetedRecoveryPasses: 1,
    recoverySourceIfNeeded: "only the clean round 24 fresh raw",
    laterFreshSourcePolicy: "original identity anchors only",
  },
  radianceRealtimeAgreementParty: radiancePartyState,
  redesignedComposition: {
    dipOwnership: "rear-three-quarter Radiance supports shallow-dipped Ellie with short visible paths to nearby ECE",
    handGraph: {
      Radiance: ["continuous bare-arm upper-back support on Ellie", "reciprocal clasp with Ellie"],
      Ellie: ["reciprocal clasp with Radiance", "continuous white-sleeved contact on ECE shoulder"],
      ECE: ["left compass handle", "right compass handle"],
      Alia: ["primary mission grip", "separate support grip at base"],
    },
    relationshipContacts: 3,
    partyGraph: "Radiance, ECE, and Alia explicitly accept one restrained victory count; Ellie remains outside the invitation-specific party",
    missionGeometry: "oblique deep-perspective lane with Alia and replica large in foreground and a shoulder-height entirely separate distant paper/backstop",
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
plan.freshRound24 = { ...promptAudit, prompt };
plan.radianceRealtimeAgreementParty = radiancePartyState;

const preparedAt = new Date().toISOString();
checkpoint.status = "active-four-scene-gate-clean-fresh-round-24-materialized";
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
checkpoint.renderAttempts.freshRound24 = {
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
  activeCleanRound: 24,
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
  reconciliationDecision: "Signed-in profile checked. No eligible unposted World Series country pair. Georgia remains X-blocked until scene 1551 is accepted.",
};
checkpoint.xPost.status = "blocked-active-country-incomplete-not-skipped";
checkpoint.xPost.url = null;
checkpoint.xPost.acceptedCurrentCountryAssets = 3;
checkpoint.nextQueueStatus = "locked-on-Georgia-until-four-accepted-git-pushed-and-X-live-verified";
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "launch-clean-fresh-round-24-from-original-identity-anchors-scene-1551-only",
  preserveAcceptedSceneNumbers: [1548, 1549, 1550],
  sceneNumbers: [scene],
  laterCountryStartAllowed: false,
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ status: checkpoint.status, promptAudit }, null, 2));
