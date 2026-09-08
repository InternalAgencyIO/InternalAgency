import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const root = path.join(repo, "tmp/world-195x4/batch-382");
const checkpointPath = path.join(repo, "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json");
const contractPath = path.join(repo, "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const ledgerPath = path.join(repo, "assets/lore/starlight-era/world-x-publish-ledger.json");
const templatePromptPath = path.join(root, "scene-1551-clean-fresh-round-20-prompt.txt");
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

const expectedContractSha = "69EB6C84A2467A4234D901C3086ECECE9E583B55C41BB9382CD5ED523C482EF5";
const expectedLedgerSha = "B94AA3FB2B1AB1BCAB100CE689F0173C77407B82439D73379D8BC0FA3EEC2455";
if (sha256File(contractPath) !== expectedContractSha) throw new Error("Authoritative contract changed before clean round 21");
if (sha256File(ledgerPath) !== expectedLedgerSha) throw new Error("X publishing ledger changed before clean round 21");
if (!contract.romance?.radianceRealtimeAgreementPartyRule) throw new Error("Radiance agreement rule missing");
if (checkpoint.status !== "active-four-scene-gate-incomplete-after-clean-fresh-round-20") {
  throw new Error(`Unexpected checkpoint status: ${checkpoint.status}`);
}
if (checkpoint.renderStrategyReset?.nextCleanRound !== 21) throw new Error("Checkpoint does not authorize clean round 21");

const referenceAudit = references.map(([relativePath, role, expectedSha256], index) => {
  const actualSha256 = sha256File(path.join(repo, relativePath));
  if (actualSha256 !== expectedSha256) throw new Error(`Identity anchor ${index + 1} changed`);
  return { image: index + 1, path: relativePath, role, sha256: actualSha256, exists: true };
});

const priorDecision = checkpoint.scenePlans[String(scene)].radianceRealtimeAgreementParty;
if (!priorDecision?.partyActivation) throw new Error("Scene 1551 Radiance decision continuity is missing");
const radiancePartyState = {
  ...priorDecision,
  decisionContinuity: "Locked from scene 1551 clean round 20 because this is a fresh technical rerender of the same scene, not a new invitation or a new story event.",
  rerenderEvidenceRequirement: "Repeat the same deliberate reciprocal Ellie hand clasp, voluntary turn toward ECE, and visibly willing four-adult response without adding a hand or object.",
};

const templatePrompt = fs.readFileSync(templatePromptPath, "utf8");
let prompt = templatePrompt.replaceAll("round 20", "round 21");

const priorPartyBlock = /RADIANCE LIVE AGREEMENT AND PARTY ACTIVATION[\s\S]*?(?=\n\nEXACT SOLVABLE EIGHT-HAND CONTACT GRAPH)/;
const partyBlock = `RADIANCE LIVE AGREEMENT AND PARTY ACTIVATION
This is the same technical rerender of scene 1551, so preserve the recorded invitation and decision rather than inventing a new story event.
Offered choice: ${radiancePartyState.offeredChoice}
Radiance response: ${radiancePartyState.radianceResponse}
partyActivation = TRUE. Willing participants: Radiance, Ellie, AI ECE, and Alia. Show the explicit agreement through Radiance's deliberate reciprocal clasp with Ellie, voluntary torso turn, and sustained affectionate eye line toward ECE. Ellie answers with a hopeful supporting smile, ECE visibly welcomes Radiance while retaining both compass hands, and Alia gives a confident affirmative nod while retaining both mission-prop hands.
The accepted invitation remains a restrained, fully clothed, non-explicit four-adult InternalAgency victory-dance party beat. It is choreography, not decor: add no crowd, drinks, confetti, balloons, signs, text, lights, stage, ornaments, or extra object. Agreement remains limited to this exact invitation and scene.`;
if (!priorPartyBlock.test(prompt)) throw new Error("Could not locate round 20 Radiance party block");
prompt = prompt.replace(priorPartyBlock, partyBlock);

const priorMissionBlock = /MISSION PROP AND TARGET[\s\S]*?(?=\n\nDECLUTTER AND FINAL GATES)/;
const missionBlock = `MISSION PROP AND TARGET
Pose-target roll 25; resolved handler = Alia because rainbow hosiery is active. Give the isolated rightmost Alia lane the full right third of the frame so her two hands, trigger guard, orange muzzle, paper diamond, and complete backstop are large and crisp. Alia stands in strict right-facing side profile behind one straight transparent safety panel with modestly bent elbows and level forearms.
Show exactly one full-size polished rainbow-gradient Desert Eagle-style large-frame inert cinema-training pistol replica: short barrel, one grip, orange muzzle plug, compact stockless silhouette. Make the grip and trigger guard oversized enough for unambiguous hand anatomy. Alia's primary right hand wraps the grip while her right trigger index is fully extended, straight, and visibly resting flat along the colored frame above and outside the guard. The black trigger guard is completely empty and visibly separated below that straight finger. Alia's support left hand cups the lower front of the primary gripping hand and grip base; show the left thumb and four left fingers separately below and forward of the right-hand finger cluster. Two distinct wrists, two distinct palms, and two distinct finger clusters must remain readable with clean air around the guard. Never merge or stack the two hands into one cluster.
Alia's copper bodice is one secure opaque strapless construction with a high straight top edge, bare shoulders, wide opaque side panels, a restrained three-centimeter bare midriff band, and a fully open upper back. Add no neck loop, shoulder strap, halter, collar, back strap, crossing band, fabric panel, or illusion mesh. Preserve her cobalt pleated skort, braids, green conduits, and complete boots.
A tall complete rectangular sand backstop fills the far-right edge. Fix one plain white square paper and one centered black non-humanoid route diamond to it. Build the alignment correctly in the initial clean exposure: Alia's dominant eye, pistol sights, horizontal barrel center, orange muzzle center, and black diamond center occupy one unmistakably straight horizontal row. Give the paper equal white area above and below that row and leave broad empty air between muzzle and paper. Every person and mascot remains behind and left of the muzzle plane. No ammunition, loose magazine, firing, muzzle flash, threat, injury, combat, or aiming at a person, animal, occupied object, or camera.`;
if (!priorMissionBlock.test(prompt)) throw new Error("Could not locate round 20 mission block");
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
  "trigger guard is completely empty",
];
for (const value of required) if (!prompt.includes(value)) throw new Error(`Missing materialized field: ${value}`);
for (const character of Object.values(plan.characters)) {
  const emotion = character.emotion.materializedResult ?? character.emotion.result;
  if (!prompt.includes(`emotion roll ${character.emotion.roll} = ${emotion}`)) throw new Error("Missing emotion materialization");
}

const promptPath = path.join(root, `scene-${scene}-clean-fresh-round-21-prompt.txt`);
fs.writeFileSync(promptPath, prompt, "utf8");
const promptAudit = {
  path: path.relative(repo, promptPath).replaceAll("\\", "/"),
  sha256: sha256(prompt),
  chars: prompt.length,
  storedRollsChanged: false,
  freshRound: 21,
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
    recoverySourceIfNeeded: "only the clean round 21 fresh raw",
    laterFreshSourcePolicy: "original identity anchors only",
  },
  radianceRealtimeAgreementParty: radiancePartyState,
  handGraphPreservedFromPassingFreshRound20: {
    Ellie: ["Radiance upper-back support", "reciprocal clasp with Radiance"],
    Radiance: ["reciprocal clasp with Ellie", "ECE high shoulder"],
    ECE: ["left compass handle", "right compass handle"],
    Alia: ["primary mission grip", "separated support hand at grip base"],
    relationshipContacts: 3,
  },
  redesignedMissionFirstPassLocks: {
    primaryTriggerIndex: "straight along colored frame above and outside guard",
    triggerGuard: "empty and visibly separated",
    supportHand: "separate palm and fingers below and forward of primary hand",
    targetGeometry: "eye, sights, orange muzzle center, and black diamond center on one horizontal row",
    AliaWardrobe: "opaque strapless open-back bodice with bare shoulders and no straps",
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
plan.freshRound21 = { ...promptAudit, prompt };
plan.radianceRealtimeAgreementParty = radiancePartyState;

const preparedAt = new Date().toISOString();
checkpoint.status = "active-four-scene-gate-clean-fresh-round-21-materialized";
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
checkpoint.renderAttempts.freshRound21 = {
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
  activeCleanRound: 21,
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
  action: "launch-clean-fresh-round-21-from-original-identity-anchors-scene-1551-only",
  preserveAcceptedSceneNumbers: [1548, 1549, 1550],
  sceneNumbers: [scene],
  laterCountryStartAllowed: false,
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ status: checkpoint.status, promptAudit }, null, 2));
