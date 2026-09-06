import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const root = path.join(repo, "tmp/world-195x4/batch-382");
const checkpointPath = path.join(repo, "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json");
const contractPath = path.join(repo, "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const ledgerPath = path.join(repo, "assets/lore/starlight-era/world-x-publish-ledger.json");
const templatePromptPath = path.join(root, "scene-1551-clean-fresh-round-19-prompt.txt");
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
const contract = JSON.parse(fs.readFileSync(contractPath, "utf8"));
const scene = 1551;
const references = [
  {
    path: "assets/lore/starlight-era/937-central-african-republic-dzanga-sangha-rainbow-clinic-signal-cipher.png",
    role: "primary quartet identity anchor only",
    expectedSha256: "BA256D750840F38C67E737FAB64BF646E606761DE71AEC9E5374AA0324B1EED1",
  },
  {
    path: "assets/lore/starlight-era/938-central-african-republic-boali-falls-rainbow-star-map-relay.png",
    role: "frontal quartet face supplement only",
    expectedSha256: "4161C9A5A8F745DF3A976112B6CA539E210DFA4E88E7873760E5CD0FF3F58FF6",
  },
  {
    path: "assets/lore/starlight-era/936-central-african-republic-bangui-oubangui-rainbow-route-grid.png",
    role: "quartet expression and Alia braid supplement only",
    expectedSha256: "0F330D7FF46E226340E5C94261752E73A22B895891E83B72EB8445E4618FCEEB",
  },
  {
    path: "assets/lore/starlight-era/ece-canonical-identity-v1.png",
    role: "AI ECE canonical face and body identity detail only",
    expectedSha256: "B22EF5CD9929D2A09F96DC0765434DB41C964B0F0390589E940EB085935C2315",
  },
];

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex").toUpperCase();
}

function sha256File(filePath) {
  return sha256(fs.readFileSync(filePath));
}

const expectedContractSha = "69EB6C84A2467A4234D901C3086ECECE9E583B55C41BB9382CD5ED523C482EF5";
const expectedLedgerSha = "B94AA3FB2B1AB1BCAB100CE689F0173C77407B82439D73379D8BC0FA3EEC2455";
if (sha256File(contractPath) !== expectedContractSha) {
  throw new Error("Authoritative contract changed before clean round 20 materialization");
}
if (sha256File(ledgerPath) !== expectedLedgerSha) {
  throw new Error("X publishing ledger changed before clean round 20 materialization");
}
if (!contract.romance?.radianceRealtimeAgreementPartyRule) {
  throw new Error("Radiance real-time agreement party rule is missing from the authoritative contract");
}
if (checkpoint.status !== "active-four-scene-gate-incomplete-after-clean-fresh-round-19") {
  throw new Error(`Unexpected checkpoint status: ${checkpoint.status}`);
}
if (checkpoint.renderStrategyReset?.nextCleanRound !== 20) {
  throw new Error("Checkpoint does not authorize clean round 20");
}

const referenceAudit = references.map((reference, index) => {
  const actualSha256 = sha256File(path.join(repo, reference.path));
  if (actualSha256 !== reference.expectedSha256) {
    throw new Error(`Identity anchor ${index + 1} changed: ${reference.path}`);
  }
  return {
    image: index + 1,
    path: reference.path,
    role: reference.role,
    sha256: actualSha256,
    exists: true,
  };
});

const radiancePartyState = {
  offeredChoice: "Ellie offers Radiance her hand to turn the stable controlled dip into the opening step of a rain-lit Batumi victory dance with ECE and Alia after the safe route demonstration.",
  radianceResponse: "Radiance gives an unmistakable affirmative nod, deliberately returns Ellie's offered hand clasp, and turns her affectionate focus toward ECE.",
  partyActivation: true,
  willingParticipants: ["Radiance", "Ellie", "AI ECE", "Alia"],
  visibleAgreementEvidence: [
    "Radiance's clear affirmative nod",
    "Radiance's deliberate reciprocal hand clasp with Ellie",
    "Radiance's voluntary torso turn and sustained affectionate eye line toward ECE",
    "Ellie's hopeful supporting smile, ECE's reciprocal welcome, and Alia's confident affirmative nod",
  ],
  continuityState: "The explicitly accepted invitation becomes a restrained four-adult InternalAgency victory-dance party beat with no decorations, crowd, drinks, confetti, signage, or extra props; ECE and Alia retain safe two-hand ownership of their rolled objects.",
  consentScope: "This agreement applies only to this invitation in scene 1551 and does not transfer to another act, participant, prop interaction, scene, country, or future image.",
};

const templatePrompt = fs.readFileSync(templatePromptPath, "utf8");
const priorGraph = /EXACT SOLVABLE EIGHT-HAND CONTACT GRAPH[\s\S]*?No hand is hidden behind a body, garment, prop, or another hand\./;
const round20Graph = `EXACT SOLVABLE EIGHT-HAND CONTACT GRAPH
Arrange four separated full bodies from left to right: Ellie far left, dipped Radiance left-center, ECE right-center immediately behind the small compass table, and Alia isolated far right in strict right-facing profile. Ellie initiates the stable shallow dip. Ellie's left open palm supports Radiance high on the upper back. Ellie's right hand clasps Radiance's left hand at shoulder height, with both complete clasped hands separately readable. Radiance's right arm stays fully visible in clean open air and ends with her open palm high on ECE's near shoulder, above and left of the compass rim. Radiance and ECE sustain the strongest affectionate eye line.
ECE's left hand grips the tall left compass handle and ECE's right hand grips the tall right compass handle. Both ECE arms descend symmetrically, and both handles and hands remain large, separated, and visible. Alia owns the final two hands, both separated on the one mission-prop grip. Exactly eight human arms and exactly eight human hands, two per woman. The three required relationship contacts are Ellie's upper-back support, the Ellie-Radiance reciprocal clasp, and Radiance's palm on ECE's shoulder. Show every shoulder, elbow, forearm, wrist, palm, and finger cluster continuously connected to one owner against contrasting open space. No Radiance arm, sleeve, wrist, palm, or finger appears on or near the compass surface or handles. No hand is hidden behind a body, garment, prop, or another hand.`;
if (!priorGraph.test(templatePrompt)) throw new Error("Could not locate round 19 hand graph");

let prompt = templatePrompt.replaceAll("round 19", "round 20");
prompt = prompt.replace(priorGraph, round20Graph);
prompt = prompt.replace(
  "The compass and map remain integrated into Radiance's forehead invitation and ECE's remorseful response; no Radiance hand approaches the table.",
  "The compass and map remain integrated into Radiance's explicitly accepted invitation and ECE's remorseful welcome. Radiance touches only ECE's high shoulder, never the table or handles.",
);

const partyBlock = `RADIANCE LIVE AGREEMENT AND PARTY ACTIVATION
Offered choice: ${radiancePartyState.offeredChoice}
Radiance response: ${radiancePartyState.radianceResponse}
partyActivation = TRUE. Willing participants: Radiance, Ellie, AI ECE, and Alia. Show the agreement through Radiance's affirmative nod, deliberate reciprocal clasp, voluntary torso turn, and sustained affectionate eye line. Ellie answers with a hopeful supporting smile, ECE visibly welcomes Radiance while retaining both compass hands, and Alia gives a confident affirmative nod while retaining both mission-prop hands in the isolated safe lane.
The accepted invitation becomes a restrained, fully clothed, non-explicit four-adult InternalAgency victory-dance party beat. It is choreography, not decor: add no crowd, drinks, confetti, balloons, signs, text, lights, stage, ornaments, or extra object. The agreement applies only to this exact invitation and scene. Do not imply consent to any other act or prop interaction.`;
const partyMarker = "\n\nEXACT SOLVABLE EIGHT-HAND CONTACT GRAPH";
if (!prompt.includes(partyMarker)) throw new Error("Could not locate party insertion marker");
prompt = prompt.replace(partyMarker, `\n\n${partyBlock}${partyMarker}`);

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
];
for (const value of required) {
  if (!prompt.includes(value)) throw new Error(`Scene ${scene} missing materialized field: ${value}`);
}
for (const character of Object.values(plan.characters)) {
  const emotion = character.emotion.materializedResult ?? character.emotion.result;
  if (!prompt.includes(`emotion roll ${character.emotion.roll} = ${emotion}`)) {
    throw new Error(`Scene ${scene} missing an emotion materialization`);
  }
}

const promptPath = path.join(root, `scene-${scene}-clean-fresh-round-20-prompt.txt`);
fs.writeFileSync(promptPath, prompt, "utf8");
const promptAudit = {
  path: path.relative(repo, promptPath).replaceAll("\\", "/"),
  sha256: sha256(prompt),
  chars: prompt.length,
  storedRollsChanged: false,
  freshRound: 20,
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
    recoverySourceIfNeeded: "only the clean round 20 fresh raw",
    laterFreshSourcePolicy: "original identity anchors only",
  },
  radianceRealtimeAgreementParty: radiancePartyState,
  separatedHandGraph: {
    Ellie: ["Radiance upper-back support", "reciprocal clasp with Radiance"],
    Radiance: ["reciprocal clasp with Ellie", "ECE high shoulder"],
    ECE: ["left compass handle", "right compass handle"],
    Alia: ["mission grip support", "mission grip primary"],
    relationshipContacts: 3,
  },
  firstPassLocks: {
    humanArms: 8,
    humanHands: 8,
    targetGeometry: "eye, sights, orange muzzle center, and black diamond center on one visible horizontal row",
    routeMap: "hands-free above compass center",
    foregroundClutter: "contract-required objects only; party activation adds no object",
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
plan.freshRound20 = { ...promptAudit, prompt };
plan.radianceRealtimeAgreementParty = radiancePartyState;

const preparedAt = new Date().toISOString();
checkpoint.status = "active-four-scene-gate-clean-fresh-round-20-materialized";
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
checkpoint.renderAttempts.freshRound20 = {
  status: "materialized-pending-launch",
  preparedAt,
  sceneNumbers: [scene],
  preservedAcceptedSceneNumbers: [1548, 1549, 1550],
  concurrency: "one clean missing-scene built-in generation",
  maximumRecoveryPassesPerBlockedScene: 1,
  promptAudit: { [scene]: promptAudit },
  storedRollsChanged: false,
  priorBatumiRenderInputCount: 0,
  radianceRealtimeAgreementParty: radiancePartyState,
};
checkpoint.renderStrategyReset = {
  ...checkpoint.renderStrategyReset,
  activeCleanRound: 20,
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
    attachments: 0,
    validCountryPairCaption: false,
    classification: "unrelated-account-post-not-a-World-Series-ledger-item",
  },
  latestVisibleAccountStatuses: [
    {
      url: "https://x.com/dogramaci/status/2087242564432806133",
      attachments: 0,
      validCountryPairCaption: false,
    },
    {
      url: "https://x.com/dogramaci/status/2087241970661941705",
      attachments: 3,
      validCountryPairCaption: false,
    },
  ],
  reconciliationDecision: "Signed-in profile checked. No eligible unposted World Series item. Georgia remains X-blocked until scene 1551 is accepted.",
};
checkpoint.xPost.status = "blocked-active-country-incomplete-not-skipped";
checkpoint.xPost.url = null;
checkpoint.xPost.acceptedCurrentCountryAssets = 3;
checkpoint.nextQueueStatus = "locked-on-Georgia-until-four-accepted-git-pushed-and-X-live-verified";
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "launch-clean-fresh-round-20-from-original-identity-anchors-scene-1551-only",
  preserveAcceptedSceneNumbers: [1548, 1549, 1550],
  sceneNumbers: [scene],
  laterCountryStartAllowed: false,
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ status: checkpoint.status, promptAudit }, null, 2));
