import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const root = path.join(repo, "tmp/world-195x4/batch-382");
const checkpointPath = path.join(repo, "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json");
const contractPath = path.join(repo, "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const ledgerPath = path.join(repo, "assets/lore/starlight-era/world-x-publish-ledger.json");
const rawPath = "tmp/world-195x4/batch-382/raw/clean-fresh-round-23/scene-1551.png";
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex").toUpperCase();
}

function sha256File(filePath) {
  return sha256(fs.readFileSync(filePath));
}

const expectedContractSha = "69EB6C84A2467A4234D901C3086ECECE9E583B55C41BB9382CD5ED523C482EF5";
const expectedLedgerSha = "B94AA3FB2B1AB1BCAB100CE689F0173C77407B82439D73379D8BC0FA3EEC2455";
const expectedRawSha = "1142A892ECDFA391831615DA0E2D88187999A1AA0FA3CD93A0E4AB20F4800136";
if (sha256File(contractPath) !== expectedContractSha) throw new Error("Authoritative contract changed during round 23");
if (sha256File(ledgerPath) !== expectedLedgerSha) throw new Error("X publishing ledger changed during round 23");
if (sha256File(path.join(repo, rawPath)) !== expectedRawSha) throw new Error("Clean round 23 raw changed before recovery materialization");
if (checkpoint.status !== "active-four-scene-gate-clean-fresh-round-23-materialized") {
  throw new Error(`Unexpected checkpoint status: ${checkpoint.status}`);
}

const radiancePartyState = checkpoint.renderAttempts.freshRound23.radianceRealtimeAgreementParty;
if (radiancePartyState?.partyActivation !== false || radiancePartyState?.response?.category !== "explicit redirect") {
  throw new Error("Round 23 Radiance redirect state missing");
}
const recoveryPartyState = {
  ...radiancePartyState,
  recoveryDecisionContinuity: "This is the single technical correction of the same round-23 image, so the recorded invitation and explicit redirect remain the only story event.",
  recoveryEvidenceRequirement: "Make Radiance's planning-focused redirect visually unmistakable without adding a hand, contact, celebration, or object.",
};

const recoveryPrompt = `Use case: precise-object-edit.
Input: the supplied Georgia Batch 382 scene 1551 clean fresh round 23 raw.

ONE RECOVERY ONLY
This is the single allowed recovery for clean round 23. Edit only the left romance-contact zone and Alia's right-foreground hand zone. Preserve the clean natural photographic surface and the already successful deep target lane. Do not globally redraw, reinterpret, restyle, sharpen, or process the image.

RADIANCE LIVE RESPONSE CONTINUITY
Preserve the recorded offered choice: ${recoveryPartyState.offeredChoice}
Preserve Radiance's explicit response: ${recoveryPartyState.radianceResponse}
partyActivation = FALSE. Willing participants: none. Visible agreement evidence: none. Make the redirect readable through Radiance's firm refusal expression, head and torso turned away from celebration toward ECE's blue holographic map, and sustained planning-focused eye line to that map. Show no celebration choreography, party decor, inferred agreement, or pressure.

CORRECTION ZONE 1: COMPLETE THE THREE-CONTACT DIP GRAPH
Keep Radiance standing left-center and dipped Ellie at far left. Keep Radiance's existing right hand and Ellie's existing left hand in their reciprocal clasp. Move, do not duplicate, Radiance's existing support arm so her bare left shoulder, upper arm, elbow, forearm, wrist, and open left palm are all visible along the outside front edge of Ellie's white torso; the palm supports Ellie high on the upper back. Remove the old low hidden support hand completely.
Move, do not duplicate, Ellie's other existing right arm into clean open air. Show one continuous white sleeve from Ellie's right shoulder through elbow, forearm, wrist, and open right palm to ECE's near high shoulder above the compass. Ellie touches only ECE's shoulder and never the compass. Preserve ECE's two arms and two hands on the two compass handles.
Exactly three relationship contacts remain: Radiance supports Ellie's upper back, Radiance and Ellie clasp, and Ellie's palm rests on ECE's shoulder. No fourth contact. No hand emerges from a waist or behind a torso.

CORRECTION ZONE 2: ENLARGE ALIA'S EXISTING SAFE GRIP
Preserve Alia's adult face, braided ponytail, strapless open-back copper bodice, midriff, skort, legs, and footwear. Preserve the entire successful oblique lane, transparent panel, long empty pavement, distant separate paper target, and complete distant backstop exactly where they are. Do not move or enlarge the target.
Bring only Alia's two existing forearms and hands modestly closer to her chest while maintaining the same downrange angle, so the one inert replica and both hand clusters become large enough to audit. Keep exactly one full-size polished rainbow-gradient Desert Eagle-style inert cinema-training pistol replica with compact short barrel, orange muzzle plug, one grip, and one oversized black oval trigger guard. Angle the right side plate toward camera.
Alia's primary right hand wraps the grip. Her right trigger index is one fully extended straight finger lying flat along the rainbow side plate above and outside the guard. The entire black oval trigger guard is visibly empty. Her support left palm cups the lower front of the primary hand and grip base as a second separate hand cluster below and forward. Show two distinct wrists, two distinct palms, and two distinct finger clusters with clean air around the empty guard. Keep the muzzle aimed only down the existing empty lane toward the distant paper, never at a person, animal, occupied object, or camera.

PRESERVE EVERY OTHER ELEMENT
Preserve all four clearly adult fictional identities, every successful wardrobe roll, Radiance's rainbow hosiery, ECE's two compass hands and hands-free route map, Batumi's Alphabet Tower, Ferris wheel, Black Sea, palms and skyline, heavy straight rain, wet flat tiles, and exactly one PAWS kitten plus one MAX puppy on the dry lounge.
Final anatomy remains exactly eight human arms and exactly eight human hands: Radiance two, Ellie two, ECE two, Alia two. No extra, missing, fused, floating, borrowed, emerging, hidden, or ambiguous limb or finger cluster.

SURFACE AND SCOPE GATE
The only visible changes are the two moved left-side arms, Radiance's clearer planning-focused redirect, and the larger readable positioning of Alia's existing hands and replica. Add no person, limb, hand, animal, prop, decoration, crowd, drink, confetti, text, logo, or target. Add no wavy processing, liquify distortion, marbling, rippled skin, rippled fabric, melted edge, embossed contour, halo, excessive sharpening, bent architecture, or painterly texture. Keep one clean coherent photographic exposure.`;

const promptPath = path.join(root, "scene-1551-clean-fresh-round-23-recovery-prompt.txt");
fs.writeFileSync(promptPath, recoveryPrompt, "utf8");
const materializedAt = new Date().toISOString();
const freshAudit = {
  renderSurfaceQuality: "pass-clean-natural-photographic-texture-without-wavy-artifacts",
  identity: "pass-four-adult-identities-with-Alia-braids",
  anatomy: "reject-Ellie-free-arm-contact-missing-Radiance-support-forearm-hidden-and-Alia-grip-too-small",
  handOwnership: "reject-left-contact-graph-incomplete-and-Alia-two-hand-separation-not-auditable",
  weather: "pass-heavy-straight-rain",
  locationThemeFusion: "pass-recognizable-Batumi-with-distinct-Mars-expedition-couture",
  outfitOriginality: "pass-four-distinct-silhouettes-constructions-and-footwear",
  rolledWardrobe: "pass-all-active-round-23-wardrobe-rolls",
  romance: "reject-only-two-clear-relationship-contacts-and-missing-Ellie-to-ECE-contact",
  radianceResponse: "reject-explicit-planning-redirect-not-clearly-readable-in-eye-line",
  partyActivation: "pass-no-party-or-celebration-decor",
  mascots: "pass-one-PAWS-and-one-MAX-safe-play",
  oddProp: "pass-ECE-two-hands-on-opposite-compass-handles",
  routeMap: "pass-separate-hands-free-holographic-map",
  missionHandling: "reject-prop-and-hand-clusters-too-small-for-unambiguous-trigger-index-and-empty-guard-audit",
  missionTargetAxis: "pass-deep-oblique-lane-with-distant-separate-paper-and-complete-backstop",
  accepted: false,
};

checkpoint.status = "active-four-scene-gate-clean-fresh-round-23-recovery-materialized";
checkpoint.checkpointedAt = materializedAt;
checkpoint.terminal = false;
checkpoint.renderAttempts.freshRound23 = {
  ...checkpoint.renderAttempts.freshRound23,
  status: "fresh-completed-rejected-recovery-materialized",
  freshCompletedAt: materializedAt,
  rawOutputs: { 1551: { path: rawPath, sha256: expectedRawSha, preserved: true } },
  freshStrictAudit: freshAudit,
  recoveryDecision: {
    attempted: true,
    reason: "Two bounded zones remain: incomplete left romance-arm graph and an unauditable but safely oriented Alia grip; the distant target geometry already passes and is locked.",
    maximumRecoveryPasses: 1,
    recoveryPassNumber: 1,
    sourceRaw: rawPath,
  },
  recoveryPromptAudit: {
    path: path.relative(repo, promptPath).replaceAll("\\", "/"),
    sha256: sha256(recoveryPrompt),
    chars: recoveryPrompt.length,
    sourceMode: "single-targeted-recovery-from-clean-round-23-raw",
    sourceRaw: { path: rawPath, sha256: expectedRawSha },
    priorBatumiRenderInputCount: 1,
    permittedSourceCount: 1,
    recoveryPass: 1,
    maximumRecoveryPasses: 1,
    boundedCorrections: [
      "make Radiance's support arm and Ellie's ECE-contact arm continuously visible while preserving exactly three contacts",
      "bring Alia's existing grip closer for a large straight-index empty-guard audit while locking the successful distant target lane",
    ],
    preserveLocks: [
      "all four identities and wardrobe rolls",
      "exactly eight arms and eight hands",
      "Radiance explicit redirect and partyActivation false",
      "ECE two-hand compass ownership and hands-free route map",
      "distant target separation, Batumi landmarks, mascots, and clean surface",
    ],
    radianceRealtimeAgreementParty: recoveryPartyState,
  },
};
checkpoint.scenePlans["1551"].freshRound23.freshVisualAudit = freshAudit;
checkpoint.scenePlans["1551"].freshRound23.recoveryPrompt = recoveryPrompt;
checkpoint.scenePlans["1551"].freshRound23.recoveryPromptSha256 = sha256(recoveryPrompt);
checkpoint.scenePlans["1551"].freshRound23.recoveryRadianceRealtimeAgreementParty = recoveryPartyState;
checkpoint.rawOutputs.push({
  scene: 1551,
  round: 23,
  kind: "clean-fresh-recovery-pending",
  path: rawPath,
  sourcePath: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-766628ed-d365-44e0-8569-daba227f2aa6.png",
  sha256: expectedRawSha,
  dimensions: { width: 941, height: 1672 },
});
checkpoint.renderStrategyReset = {
  ...checkpoint.renderStrategyReset,
  activeCleanRound: 23,
  activeSourcePolicy: "single targeted recovery from clean round 23 raw only",
  priorBatumiRenderInputCount: 1,
};
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "launch-single-clean-fresh-round-23-recovery-scene-1551-only",
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
  nextWakeAction: checkpoint.nextWakeAction,
}, null, 2));
