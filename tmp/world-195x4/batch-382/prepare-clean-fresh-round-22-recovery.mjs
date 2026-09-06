import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const root = path.join(repo, "tmp/world-195x4/batch-382");
const checkpointPath = path.join(repo, "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json");
const contractPath = path.join(repo, "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const ledgerPath = path.join(repo, "assets/lore/starlight-era/world-x-publish-ledger.json");
const rawPath = "tmp/world-195x4/batch-382/raw/clean-fresh-round-22/scene-1551.png";
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex").toUpperCase();
}

function sha256File(filePath) {
  return sha256(fs.readFileSync(filePath));
}

const expectedContractSha = "69EB6C84A2467A4234D901C3086ECECE9E583B55C41BB9382CD5ED523C482EF5";
const expectedLedgerSha = "B94AA3FB2B1AB1BCAB100CE689F0173C77407B82439D73379D8BC0FA3EEC2455";
const expectedRawSha = "3CBB053F2D2A0667D7789E24A4A5D9976901D9EF101E499F70E7B5D3E9669F7E";
if (sha256File(contractPath) !== expectedContractSha) throw new Error("Authoritative contract changed during round 22");
if (sha256File(ledgerPath) !== expectedLedgerSha) throw new Error("X publishing ledger changed during round 22");
if (sha256File(path.join(repo, rawPath)) !== expectedRawSha) throw new Error("Clean round 22 raw changed before recovery materialization");
if (checkpoint.status !== "active-four-scene-gate-clean-fresh-round-22-materialized") {
  throw new Error(`Unexpected checkpoint status: ${checkpoint.status}`);
}

const radiancePartyState = checkpoint.renderAttempts.freshRound22.radianceRealtimeAgreementParty;
if (!radiancePartyState?.partyActivation) throw new Error("Round 22 Radiance affirmative party state missing");
const recoveryPartyState = {
  ...radiancePartyState,
  recoveryDecisionContinuity: "This is a single technical correction of the same round-22 image, so the already recorded invitation and explicit affirmative response remain the only story event.",
  recoveryEvidenceRequirement: "Preserve Radiance's clear nod, deliberate Ellie clasp, voluntary torso turn, and sustained ECE eye line without adding a contact or hand.",
};

const recoveryPrompt = `Use case: precise-object-edit.
Input: the supplied Georgia Batch 382 scene 1551 clean fresh round 22 raw.

ONE RECOVERY ONLY
This is the single allowed recovery for clean round 22. Edit only the two bounded zones below. Preserve the clean natural photographic surface and every unmentioned pixel-level subject relationship. Do not globally redraw, reinterpret, restyle, sharpen, or process the image.

RADIANCE LIVE AGREEMENT CONTINUITY
This is a technical correction of the same image, not a new story event. Preserve the recorded invitation: ${recoveryPartyState.offeredChoice}
Preserve Radiance's explicit response: ${recoveryPartyState.radianceResponse}
partyActivation = TRUE. Willing participants: Radiance, Ellie, AI ECE, and Alia. Preserve Radiance's clear affirmative nod, deliberate reciprocal clasp with Ellie, voluntary torso turn, and sustained affectionate eye line to ECE. Preserve the restrained fully clothed one-count InternalAgency quartet victory-dance beat. Add no new contact, hand, object, decoration, or participant.

CORRECTION ZONE 1: MOVE ELLIE'S EXISTING SUPPORT ARM
At the far left, keep Ellie's existing right hand and Radiance's existing left hand in their current reciprocal clasp. Move, do not duplicate, Ellie's other existing left support hand from Radiance's waist to Radiance's high upper back. Expose one continuous white-sleeved left arm from Ellie's left shoulder through elbow, forearm, wrist, and open palm, visible against the outside edge of Radiance's cobalt dress. Remove the old waist hand completely. Exactly one support hand remains. Do not alter Radiance's existing bare right arm and palm on ECE's shoulder.

CORRECTION ZONE 2: REBUILD ONLY ALIA'S RIGHTMOST SAFETY LANE
Preserve Alia's adult face, body, braided ponytail, expression, copper-and-cobalt couture materials, legs, and footwear. Remove the thin turquoise neckband and every neck, shoulder, halter, or back strap. Rebuild only the copper bodice as one secure opaque strapless construction with a high straight top edge, bare shoulders, wide continuous opaque side panels, the existing restrained midriff band, and a fully open upper back. No collar, necklace, neck loop, strap, sleeve, halter, back band, crossing band, fabric panel, or illusion mesh.

Shift Alia and her two existing arms and two existing hands modestly left as one coherent figure so her elbows remain bent and the compact inert replica ends well left of the paper. Keep exactly one full-size polished rainbow-gradient Desert Eagle-style large-frame inert cinema-training pistol replica with a compact short barrel, one grip, one large black oval trigger guard, and an orange muzzle plug. Place the orange muzzle near 79 percent of frame width and the paper near 93 percent, leaving a broad unmistakable empty band between them. No replica pixel may overlap or touch the paper.
Alia's primary right hand wraps the grip. Her right trigger index is one fully extended straight horizontal finger resting flat on the rainbow side plate above and outside the guard. The entire black oval trigger guard below it is visibly empty. Her support left palm cups the lower front of the primary hand and grip base as a second separate hand cluster below and forward. Show two distinct wrists, two distinct palms, and two distinct finger clusters with clean air around the empty guard. Align Alia's dominant eye, sights, horizontal barrel center, orange muzzle center, and black diamond center on one exact horizontal row. Preserve the complete backstop and transparent safety panel. No ammunition, loose magazine, firing, muzzle flash, threat, injury, or combat.

PRESERVE EVERY OTHER ELEMENT
Preserve all four clearly adult fictional identities, Radiance's open-back cobalt dress and rainbow hosiery, Ellie's midriff jumpsuit, ECE's fully covered jacket and trousers, ECE's exactly two hands on the two compass handles, the hands-free holographic route map, Batumi's Alphabet Tower, Ferris wheel, Black Sea, palms and skyline, the heavy straight rain, wet flat tiles, and exactly one PAWS kitten plus one MAX puppy on the dry lounge.
Final anatomy remains exactly eight human arms and exactly eight human hands: Ellie two, Radiance two, ECE two, Alia two. No extra, missing, fused, floating, borrowed, emerging, hidden, or ambiguous limb or finger cluster.

SURFACE AND SCOPE GATE
The only visible changes are Ellie's moved and exposed support arm plus Alia's strapless bodice and safe mission-lane geometry. Add no person, limb, hand, animal, prop, decoration, crowd, drink, confetti, text, logo, or target. Add no wavy processing, liquify distortion, marbling, rippled skin, rippled fabric, melted edge, embossed contour, halo, excessive sharpening, bent architecture, or painterly texture. Keep one clean coherent photographic exposure.`;

const promptPath = path.join(root, "scene-1551-clean-fresh-round-22-recovery-prompt.txt");
fs.writeFileSync(promptPath, recoveryPrompt, "utf8");
const materializedAt = new Date().toISOString();
const freshAudit = {
  renderSurfaceQuality: "pass-clean-natural-photographic-texture-without-wavy-artifacts",
  identity: "pass-four-adult-identities-with-Alia-braids",
  anatomy: "reject-Ellie-support-forearm-hidden-and-Alia-two-hand-grip-not-separately-traceable",
  handOwnership: "reject-Ellie-support-hand-emerges-at-waist-without-continuous-forearm",
  weather: "pass-heavy-straight-rain",
  locationThemeFusion: "pass-recognizable-Batumi-with-distinct-Mars-expedition-couture",
  outfitOriginality: "pass-four-distinct-silhouettes-constructions-and-footwear",
  rolledWardrobe: "reject-Alia-thin-neckband-violates-active-strapless-and-open-back-rolls",
  romance: "pass-shallow-controlled-dip-three-contacts-and-Radiance-ECE-center",
  radianceAgreement: "pass-round-22-explicit-affirmative-evidence",
  partyActivation: "pass-restrained-four-adult-one-count-victory-dance",
  mascots: "pass-one-PAWS-and-one-MAX-safe-play",
  oddProp: "pass-ECE-two-hands-on-opposite-compass-handles",
  routeMap: "pass-separate-hands-free-holographic-map",
  missionHandling: "reject-trigger-index-empty-guard-and-two-hand-separation-not-unambiguously-readable",
  missionTargetAxis: "reject-replica-overlaps-paper-without-broad-empty-air",
  accepted: false,
};

checkpoint.status = "active-four-scene-gate-clean-fresh-round-22-recovery-materialized";
checkpoint.checkpointedAt = materializedAt;
checkpoint.terminal = false;
checkpoint.renderAttempts.freshRound22 = {
  ...checkpoint.renderAttempts.freshRound22,
  status: "fresh-completed-rejected-recovery-materialized",
  freshCompletedAt: materializedAt,
  rawOutputs: {
    1551: { path: rawPath, sha256: expectedRawSha, preserved: true },
  },
  freshStrictAudit: freshAudit,
  recoveryDecision: {
    attempted: true,
    reason: "Two bounded visual zones remain: Ellie's hidden support forearm and Alia's wardrobe plus compressed mission-safety lane.",
    maximumRecoveryPasses: 1,
    recoveryPassNumber: 1,
    sourceRaw: rawPath,
  },
  recoveryPromptAudit: {
    path: path.relative(repo, promptPath).replaceAll("\\", "/"),
    sha256: sha256(recoveryPrompt),
    chars: recoveryPrompt.length,
    sourceMode: "single-targeted-recovery-from-clean-round-22-raw",
    sourceRaw: { path: rawPath, sha256: expectedRawSha },
    priorBatumiRenderInputCount: 1,
    permittedSourceCount: 1,
    recoveryPass: 1,
    maximumRecoveryPasses: 1,
    boundedCorrections: [
      "move Ellie's existing support hand from waist to upper back and expose its continuous white-sleeved arm",
      "remove Alia's neck and back straps, shift her coherent lane left, separate both mission hands, empty the guard, straighten the index, and create broad muzzle-to-paper air",
    ],
    preserveLocks: [
      "all four identities and unmentioned wardrobe",
      "exactly eight arms and eight hands",
      "Radiance explicit round-22 agreement and active party beat",
      "ECE two-hand compass ownership and hands-free route map",
      "Batumi landmarks, mascots, and clean natural photographic surface",
    ],
    radianceRealtimeAgreementParty: recoveryPartyState,
  },
};
checkpoint.scenePlans["1551"].freshRound22.freshVisualAudit = freshAudit;
checkpoint.scenePlans["1551"].freshRound22.recoveryPrompt = recoveryPrompt;
checkpoint.scenePlans["1551"].freshRound22.recoveryPromptSha256 = sha256(recoveryPrompt);
checkpoint.scenePlans["1551"].freshRound22.recoveryRadianceRealtimeAgreementParty = recoveryPartyState;
checkpoint.rawOutputs.push({
  scene: 1551,
  round: 22,
  kind: "clean-fresh-recovery-pending",
  path: rawPath,
  sourcePath: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-4ce8d119-2b52-4d3c-86e2-6fbbdf21da2f.png",
  sha256: expectedRawSha,
  dimensions: { width: 941, height: 1672 },
});
checkpoint.renderStrategyReset = {
  ...checkpoint.renderStrategyReset,
  activeCleanRound: 22,
  activeSourcePolicy: "single targeted recovery from clean round 22 raw only",
  priorBatumiRenderInputCount: 1,
};
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "launch-single-clean-fresh-round-22-recovery-scene-1551-only",
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
