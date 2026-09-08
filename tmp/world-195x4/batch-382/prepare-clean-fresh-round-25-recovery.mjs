import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const root = path.join(repo, "tmp/world-195x4/batch-382");
const checkpointPath = path.join(repo, "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json");
const contractPath = path.join(repo, "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const ledgerPath = path.join(repo, "assets/lore/starlight-era/world-x-publish-ledger.json");
const rawPath = "tmp/world-195x4/batch-382/raw/clean-fresh-round-25/scene-1551.png";
const expectedRawSha = "2990E5B728916EF3946D4A4497EA54EF56BBF055BD1B18D426EC7832C00FBB20";
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex").toUpperCase();
}

function sha256File(filePath) {
  return sha256(fs.readFileSync(filePath));
}

if (sha256File(contractPath) !== "69EB6C84A2467A4234D901C3086ECECE9E583B55C41BB9382CD5ED523C482EF5") {
  throw new Error("Authoritative contract changed during round 25");
}
if (sha256File(ledgerPath) !== "B94AA3FB2B1AB1BCAB100CE689F0173C77407B82439D73379D8BC0FA3EEC2455") {
  throw new Error("X publishing ledger changed during round 25");
}
if (sha256File(path.join(repo, rawPath)) !== expectedRawSha) throw new Error("Clean round 25 raw changed");
if (checkpoint.status !== "active-four-scene-gate-clean-fresh-round-25-materialized") {
  throw new Error(`Unexpected checkpoint status: ${checkpoint.status}`);
}

const radiancePartyState = checkpoint.renderAttempts.freshRound25.radianceRealtimeAgreementParty;
if (radiancePartyState?.partyActivation !== true || radiancePartyState?.response?.category !== "explicit affirmative") {
  throw new Error("Round 25 affirmative party state missing");
}
if (radiancePartyState.willingParticipants?.join("|") !== "Radiance|Ellie|AI ECE|Alia") {
  throw new Error("Round 25 all-four willing participant state missing");
}
const recoveryPartyState = {
  ...radiancePartyState,
  recoveryDecisionContinuity: "This single technical correction remains the same round-25 image event, so the recorded invitation, explicit yes, and all-four willing participant set do not change.",
  recoveryEvidenceRequirement: "Radiance's nod, torso turn, and affectionate ECE eye line plus Ellie, ECE, and Alia's willing expressions must be visually explicit without adding a hand, contact, or object.",
};

const recoveryPrompt = `Use case: precise-object-edit.
Input: the supplied Georgia Batch 382 scene 1551 clean fresh round 25 raw.

ONE RECOVERY ONLY
This is the single allowed recovery for clean round 25. Edit only two bounded zones: the Radiance-Ellie left group and Alia's right-foreground back, hands, and inert replica. Preserve the clean natural photographic surface and every successful element. Do not globally redraw, reinterpret, sharpen, restyle, or process the image.

RADIANCE LIVE AGREEMENT CONTINUITY
Preserve the offered choice: ${recoveryPartyState.offeredChoice}
Preserve Radiance's explicit response: ${recoveryPartyState.radianceResponse}
partyActivation = TRUE. Willing participants: Radiance, Ellie, AI ECE, Alia. Radiance gives a clear affirmative nod toward Ellie, keeps the stable dip support and reciprocal clasp, turns her torso toward ECE, and sustains the clearest affectionate eye line to ECE. Ellie answers with a willing smile. Preserve ECE's existing willing smile. Alia adds one subtle willing side-eye nod toward the quartet without changing the safe muzzle axis. This remains one fully clothed, non-explicit quartet victory count with no decor or extra object.

CORRECTION ZONE 1: TRACEABLE LEFT CONTACT GRAPH AND RADIANCE BACK
Preserve the current stable shallow dip, feet, legs, faces, and reciprocal clasp. Keep exactly the current four left-group arms and four left-group hands; move existing limbs only and add none.
Radiance's existing non-clasp support arm becomes fully visible outside Ellie's white torso from bare shoulder through elbow, forearm, wrist, and open palm, with that palm high on Ellie's upper back. Ellie's existing non-clasp white-sleeved arm becomes fully visible in front of blue fabric from shoulder through elbow, forearm, wrist, and open palm, with that palm on Radiance's near shoulder. The three relationship contacts are exactly Radiance's upper-back support, the reciprocal clasp, and Ellie's palm on Radiance's shoulder. Remove the old hidden low waist hands completely; no hand or forearm remains behind a torso.
Turn only Radiance's head and upper torso enough to make her affirmative nod and sustained affectionate eye line to ECE unmistakable while preserving her identity and stable support.
Remove every gold medallion chain, blue or green crossing strap, neck loop, back band, harness, and ornament from Radiance's open-back zone. Preserve her opaque cobalt dress front and side coverage. Her upper back is uninterrupted bare skin from shoulder blades to the high secure waist, with no crossing element. Preserve exactly one pair of opaque rainbow knee socks on Radiance only.

CORRECTION ZONE 2: ALIA OPEN BACK, MIDRIFF, WILLING NOD, AND SAFE METALLIC REPLICA
Preserve Alia's adult face, braided ponytail, body, skort, legs, footwear, exact two arms, exact two hands, transparent safety panels, distant paper diamond, complete sand backstop, and aligned safe downrange axis.
Remove the copper upper-back band, neck jewelry, neck cord, collar, loop, halter, crossing strap, and every band across Alia's bare upper back. Build one secure opaque strapless copper bodice with a high straight front edge below completely bare collarbones and shoulders, wide opaque side panels, a restrained visible three-centimeter midriff band, and uninterrupted fully open upper back to a high secure waist. Add no transparent area or undergarment.
Replace only the tiny toy-like plastic pistol with one full-size heavy polished-metal rainbow-gradient Desert Eagle-style inert cinema-training pistol replica: compact short barrel, one substantial grip, one oversized black oval trigger guard, orange muzzle plug, no water-gun nozzle, no toy plastic, no long gun. Keep its muzzle on the existing distant black-diamond axis.
Alia's primary right hand wraps the grip. Her right trigger index is one long fully extended straight finger flat along the metallic side plate above and outside the guard. The entire black oval trigger guard is visibly empty. Her support left palm cups only the lower front of the primary fist and grip base as a second separate hand cluster below and forward. Show two distinct wrists, palms, and finger clusters with clean air around the empty guard. Add one subtle willing side-eye nod toward the quartet while her muzzle remains safely downrange.

PRESERVE EVERY SUCCESSFUL ELEMENT
Preserve exactly four clearly adult fictional women and their anchored identities; exactly eight human arms and exactly eight human hands, two per woman; ECE's two hands on opposite compass handles; the separate hands-free blue route map; Batumi's Ferris wheel, tower, Black Sea, palms, skyline, rain, wet flat tiles; the aligned distant target and complete backstop; and exactly one PAWS kitten plus one MAX puppy entirely inside the raised dry padded lounge.
Preserve all other wardrobe construction, four distinct outfit silhouettes, feet, footwear, facial identity, camera, lens, lighting, weather, landmarks, map, compass, target, glass, animals, lounge, and reflections unchanged.

SURFACE AND SCOPE GATE
Add no person, limb, hand, finger cluster, animal, prop, decoration, crowd, drink, confetti, text, logo, or target. Add no wavy processing, liquify distortion, marbling, rippled skin, rippled fabric, melted edge, embossed contour, halo, excessive sharpening, bent architecture, bent glass, or painterly texture. Keep one clean coherent photographic exposure.`;

const promptPath = path.join(root, "scene-1551-clean-fresh-round-25-recovery-prompt.txt");
fs.writeFileSync(promptPath, recoveryPrompt, "utf8");
const materializedAt = new Date().toISOString();
const freshAudit = {
  renderSurfaceQuality: "pass-clean-natural-photographic-texture-without-wavy-artifacts",
  identity: "pass-four-adult-identities-with-Alia-braids",
  anatomy: "pass-eight-arms-and-eight-hands-present-but-two-left-non-clasp-owner-paths-need-visibility",
  handOwnership: "reject-hidden-low-left-owner-paths-and-Alia-trigger-hand-audit",
  weather: "pass-heavy-straight-rain",
  locationThemeFusion: "pass-recognizable-Batumi-with-distinct-Mars-expedition-couture",
  outfitOriginality: "pass-four-distinct-silhouettes-constructions-and-footwear",
  rolledWardrobe: "reject-Radiance-and-Alia-active-open-back-rolls-have-forbidden-bands-and-Alia-midriff-is-weak",
  romance: "pass-shallow-supported-dip-reciprocal-clasp-and-three-contact-left-group-structure",
  radianceResponse: "reject-explicit-affirmative-ECE-eye-line-not-visible",
  partyActivation: "reject-Alia-willing-nod-and-Radiance-ECE-affection-center-not-clearly-readable",
  mascots: "pass-one-PAWS-and-one-MAX-together-on-raised-dry-padded-lounge",
  oddProp: "pass-ECE-two-hands-on-opposite-compass-handles",
  routeMap: "pass-separate-hands-free-holographic-map",
  missionHandling: "reject-toy-like-replica-and-trigger-index-empty-guard-audit",
  missionTargetAxis: "pass-distant-separated-paper-diamond-and-complete-backstop-aligned-near-muzzle-axis",
  accepted: false,
};

checkpoint.status = "active-four-scene-gate-clean-fresh-round-25-recovery-materialized";
checkpoint.checkpointedAt = materializedAt;
checkpoint.terminal = false;
checkpoint.renderAttempts.freshRound25 = {
  ...checkpoint.renderAttempts.freshRound25,
  status: "fresh-completed-rejected-recovery-materialized",
  freshCompletedAt: materializedAt,
  rawOutputs: { 1551: { path: rawPath, sha256: expectedRawSha, preserved: true } },
  freshStrictAudit: freshAudit,
  recoveryDecision: {
    attempted: true,
    reason: "The clean raw passes surface, cast, core eight-limb count, dip, compass, mascots, and target geometry; only two bounded visual zones need correction.",
    maximumRecoveryPasses: 1,
    recoveryPassNumber: 1,
    sourceRaw: rawPath,
  },
  recoveryPromptAudit: {
    path: path.relative(repo, promptPath).replaceAll("\\", "/"),
    sha256: sha256(recoveryPrompt),
    chars: recoveryPrompt.length,
    sourceMode: "single-targeted-recovery-from-clean-round-25-raw",
    sourceRaw: { path: rawPath, sha256: expectedRawSha },
    priorBatumiRenderInputCount: 1,
    permittedSourceCount: 1,
    recoveryPass: 1,
    maximumRecoveryPasses: 1,
    boundedCorrections: [
      "make the two existing left non-clasp arm paths visible, show Radiance's affirmative ECE eye line, and clear Radiance's active open back",
      "clear Alia's strapless open-back midriff construction, show her willing nod, and replace the toy-like replica with an auditable metallic safe two-hand grip",
    ],
    preserveLocks: [
      "four adult identities, exactly eight arms and eight hands, stable dip, and reciprocal clasp",
      "ECE two-hand compass ownership and hands-free route map",
      "distant target axis, complete backstop, Batumi landmarks, mascots on dry lounge, and clean photographic surface",
      "round-25 explicit yes, partyActivation true, and all-four willing participants",
    ],
    radianceRealtimeAgreementParty: recoveryPartyState,
  },
};
checkpoint.scenePlans["1551"].freshRound25.freshVisualAudit = freshAudit;
checkpoint.scenePlans["1551"].freshRound25.recoveryPrompt = recoveryPrompt;
checkpoint.scenePlans["1551"].freshRound25.recoveryPromptSha256 = sha256(recoveryPrompt);
checkpoint.scenePlans["1551"].freshRound25.recoveryRadianceRealtimeAgreementParty = recoveryPartyState;
checkpoint.rawOutputs.push({
  scene: 1551,
  round: 25,
  kind: "clean-fresh-recovery-pending",
  path: rawPath,
  sourcePath: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-4a4507b4-2f85-44fd-a2c9-080f520390f8.png",
  sha256: expectedRawSha,
  dimensions: { width: 941, height: 1672 },
});
checkpoint.renderStrategyReset = {
  ...checkpoint.renderStrategyReset,
  activeCleanRound: 25,
  activeSourcePolicy: "single targeted recovery from clean round 25 raw only",
  priorBatumiRenderInputCount: 1,
};
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "launch-single-clean-fresh-round-25-recovery-scene-1551-only",
  preserveAcceptedSceneNumbers: [1548, 1549, 1550],
  sceneNumbers: [1551],
  laterCountryStartAllowed: false,
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  status: checkpoint.status,
  rawSha256: expectedRawSha,
  recoveryPromptSha256: sha256(recoveryPrompt),
  recoveryPromptChars: recoveryPrompt.length,
  partyActivation: recoveryPartyState.partyActivation,
  willingParticipants: recoveryPartyState.willingParticipants,
  nextWakeAction: checkpoint.nextWakeAction,
}, null, 2));
