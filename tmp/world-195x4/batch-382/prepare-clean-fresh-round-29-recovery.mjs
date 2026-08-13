import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const root = path.join(repo, "tmp/world-195x4/batch-382");
const checkpointPath = path.join(repo, "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json");
const contractPath = path.join(repo, "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const ledgerPath = path.join(repo, "assets/lore/starlight-era/world-x-publish-ledger.json");
const rawPath = "tmp/world-195x4/batch-382/raw/clean-fresh-round-29/scene-1551.png";
const sourcePath = "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-e3dcea1e-f6b7-4289-8a18-e7e1c40fc174.png";
const expectedRawSha = "3AF93A022813CCFF02B39F137518A01151AF7E361F72F0C0875E60183F7CC83F";
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex").toUpperCase();
}

function sha256File(filePath) {
  return sha256(fs.readFileSync(filePath));
}

if (sha256File(contractPath) !== "69EB6C84A2467A4234D901C3086ECECE9E583B55C41BB9382CD5ED523C482EF5") throw new Error("Contract changed during round 29");
if (sha256File(ledgerPath) !== "B94AA3FB2B1AB1BCAB100CE689F0173C77407B82439D73379D8BC0FA3EEC2455") throw new Error("Ledger changed during round 29");
if (sha256File(path.join(repo, rawPath)) !== expectedRawSha) throw new Error("Clean round 29 raw changed");
if (checkpoint.status !== "active-four-scene-gate-clean-fresh-round-29-materialized") throw new Error(`Unexpected status: ${checkpoint.status}`);

const radiancePartyState = checkpoint.renderAttempts.freshRound29.radianceRealtimeAgreementParty;
if (radiancePartyState?.partyActivation !== true || radiancePartyState?.response?.category !== "explicit affirmative") throw new Error("Round 29 affirmative missing");
if (radiancePartyState.willingParticipants?.join("|") !== "Radiance|Ellie|AI ECE") throw new Error("Round 29 participant set changed");
const recoveryPartyState = {
  ...radiancePartyState,
  recoveryDecisionContinuity: "This single technical correction remains the same round-29 image event, so Ellie's invitation, Radiance's explicit yes, the Radiance-Ellie-ECE participant set, Alia's exclusion, and every consent boundary remain unchanged.",
  recoveryEvidenceRequirement: "Preserve the visible clasp and dip while exposing Radiance's shoulder-contact arm and turning the Radiance-ECE eye line into the affectionate center.",
};

const recoveryPrompt = `Use case: precise-object-edit.
Input: the supplied Georgia Batch 382 scene 1551 clean fresh round 29 raw.

ONE RECOVERY ONLY
This is the single allowed recovery for clean round 29. Preserve the current clean natural photographic surface and every successful element. Edit only the existing Ellie-Radiance left-center arm inventory, Radiance and ECE eye lines, and Alia's existing mission replica with its two existing hands. Do not globally redraw, sharpen, restyle, relight, upscale, or process the image. Move existing limbs only; add no limb, hand, finger cluster, person, animal, or extra prop.

RADIANCE LIVE AGREEMENT CONTINUITY
Preserve the offered choice: ${recoveryPartyState.offeredChoice}
Preserve Radiance's explicit response: ${recoveryPartyState.radianceResponse}
partyActivation = TRUE. Willing participants remain exactly Radiance, Ellie, and AI ECE. Alia remains outside the party. Preserve Radiance and Ellie's existing shoulder-height right-hand clasp, Radiance's broad willing smile, and the clear supported dip. Turn only Radiance's eyes and chin slightly rightward into a sustained warm mutual eye line with ECE. Turn only ECE's eyes toward Radiance while preserving ECE's willing smile and both hands on the compass. The clasp, dip, and newly visible shoulder palm remain Radiance's explicit yes to Ellie. Add no hand gesture, party object, or extra contact.

CORRECTION ZONE 1: COMPLETE FOUR-HAND DIP INVENTORY
Preserve Ellie and Radiance's adult identities, faces, hair, garments, complete legs, complete feet, spacing, current dip angle, current shoulder-height right-hand clasp, Radiance's fully covered waist, uninterrupted bare upper back, cobalt dress, and exactly one pair of opaque rainbow knee socks.
Keep exactly four arms and four hands across Ellie and Radiance. Reposition their existing hidden limbs only and add none.
Preserve Ellie's existing visible right arm and right hand in the shoulder-height clasp. Preserve Radiance's existing visible right arm and right hand in that same clasp. Keep both clasp wrists and both palms individually readable.
Move Radiance's currently hidden left arm entirely into clean air between her torso and Ellie's near shoulder. Show Radiance's bare left shoulder, upper arm, elbow, forearm, wrist, open palm, and fingers as one continuous owner path ending with that palm flat and visibly on Ellie's near shoulder.
Preserve Ellie's existing support palm on Radiance's bare upper back, but move the hidden white-sleeved forearm outside Radiance's silhouette. Show Ellie's left shoulder, white sleeve, elbow, forearm, wrist, palm, and fingers continuously against the plain sea, ending at the same visible upper-back support contact.
The three and only three relationship contacts are the preserved right-hand clasp, Ellie's open left palm on Radiance's upper back, and Radiance's open left palm on Ellie's shoulder. No hand hides behind a torso, waist, garment, hair, prop, or another hand. No extra touch, fused wrist, duplicate fingers, or ambiguous owner path.

CORRECTION ZONE 2: FULL-SIZE METALLIC INERT REPLICA
Preserve Alia's adult identity, braided ponytail, exact two arms, exact two hands, strapless fully open-back copper crop shell, clearly bare midriff band, cobalt pleated skort, legs, feet, strict right-facing stance, safe target axis, paper diamond, and complete sand backstop.
Replace only the undersized bright prop body in her existing hands with exactly one unmistakably full-size approximately 27-centimeter polished-steel Desert Eagle-style large-frame inert cinema-training replica. Give it a metallic heat-anodized rainbow finish, compact short barrel, substantial heavy grip, oversized black oval trigger guard, and a small orange muzzle insert only inside the barrel opening. It must read as heavy polished metal, never plastic, a water pistol, a squirt gun, or a toy.
Keep Alia's primary right hand wrapped around the grip. Straighten her existing right trigger index into one long clearly separate finger lying flat along the metallic side plate above and entirely outside the guard. The whole black oval trigger guard must be visibly empty. Keep her support left palm cupping only the lower front of the primary fist and grip base. Show two distinct wrists, palms, and finger clusters with clean air around the guard. Keep the muzzle aimed only at the empty paper target and complete backstop. No ammunition, loose magazine, firing, muzzle flash, threat, injury, or combat.

PRESERVE EVERY SUCCESSFUL ELEMENT
Preserve exactly four clearly adult fictional women with anchored identities and Alia's braids; exactly eight human arms and exactly eight human hands, two per woman; the standard supported dip and existing shoulder-height clasp; ECE's two separated hands on opposite compass handles; the hands-free blue route map; straight heavy rain; Batumi's Black Sea, skyline, Alphabet Tower, Ferris wheel, palms, flat wet tiles, and glass rail; four distinct Mars-expedition couture silhouettes; Radiance's open back and rainbow knee socks; Ellie and Alia's clear bare midriff bands; Alia's strapless open back; one paper target and complete backstop; and exactly one PAWS kitten plus one MAX puppy together in the raised dry padded lounge.
Preserve all other camera, lens, lighting, reflections, anatomy, wardrobe, geometry, and clean texture unchanged.

SURFACE AND SCOPE GATE
Add no person, limb, hand, finger cluster, animal, prop, decoration, crowd, drink, confetti, text, logo, extra target, or scattered equipment. Add no wavy processing, liquify distortion, marbling, rippled skin, rippled fabric, melted edge, embossed contour, halo, excessive sharpening, bent architecture, bent glass, or painterly texture. Keep one clean coherent photographic exposure.`;

const promptPath = path.join(root, "scene-1551-clean-fresh-round-29-recovery-prompt.txt");
fs.writeFileSync(promptPath, recoveryPrompt, "utf8");
const materializedAt = new Date().toISOString();
const freshAudit = {
  renderSurfaceQuality: "pass-clean-natural-photographic-texture-without-wavy-artifacts",
  identity: "pass-four-adult-identities-with-Alia-braids",
  anatomy: "reject-Radiance-left-arm-and-hand-hidden-and-Ellie-support-owner-path-hidden",
  handOwnership: "reject-only-six-complete-arm-paths-plus-one-hidden-Ellie-path-are-auditable; ECE-and-Alia-hands-pass",
  weather: "pass-heavy-individually-straight-rain-streaks-and-wet-tiles",
  locationThemeFusion: "pass-recognizable-Batumi-with-four-distinct-expedition-silhouettes",
  outfitOriginality: "pass-four-distinct-silhouettes-constructions-hems-and-footwear",
  rolledWardrobe: "pass-Radiance-and-Alia-open-backs-Ellie-and-Alia-midriff-bands-and-Alia-strapless-shell",
  romance: "reject-standard-dip-and-two-contacts-pass-but-third-shoulder-contact-is-missing",
  radianceResponse: "pass-Radiance-Ellie-clasp-and-committed-dip-as-explicit-yes",
  partyActivation: "partial-Radiance-and-Ellie-read-clearly-but-ECE-eye-line-does-not-yet-form-affectionate-center",
  mascots: "pass-one-PAWS-and-one-MAX-together-on-raised-dry-padded-lounge",
  oddProp: "pass-ECE-two-hands-on-opposite-compass-handles",
  routeMap: "pass-separate-hands-free-holographic-map",
  missionHandling: "reject-replica-remains-undersized-and-trigger-index-outside-empty-guard-is-not-auditable",
  missionTargetAxis: "pass-separated-paper-diamond-complete-backstop-and-safe-right-facing-axis",
  accepted: false,
};

checkpoint.status = "active-four-scene-gate-clean-fresh-round-29-recovery-materialized";
checkpoint.checkpointedAt = materializedAt;
checkpoint.terminal = false;
checkpoint.renderAttempts.freshRound29 = {
  ...checkpoint.renderAttempts.freshRound29,
  status: "fresh-completed-rejected-recovery-materialized",
  freshCompletedAt: materializedAt,
  rawOutputs: { 1551: { path: rawPath, sha256: expectedRawSha, preserved: true } },
  freshStrictAudit: freshAudit,
  recoveryDecision: {
    attempted: true,
    reason: "The clean raw passes surface, identities, standard dip, two contacts, Batumi, wardrobe, compass, mascots, and target; one bounded correction exposes two hidden owner paths, restores the third contact and ECE eye line, and replaces only the unsafe undersized replica.",
    maximumRecoveryPasses: 1,
    recoveryPassNumber: 1,
    sourceRaw: rawPath,
  },
  recoveryPromptAudit: {
    path: path.relative(repo, promptPath).replaceAll("\\", "/"),
    sha256: sha256(recoveryPrompt),
    chars: recoveryPrompt.length,
    sourceMode: "single-targeted-recovery-from-clean-round-29-raw",
    sourceRaw: { path: rawPath, sha256: expectedRawSha },
    priorBatumiRenderInputCount: 1,
    permittedSourceCount: 1,
    recoveryPass: 1,
    maximumRecoveryPasses: 1,
    boundedCorrections: [
      "expose Radiance's hidden shoulder-contact arm and Ellie's hidden support forearm without changing the existing clasp",
      "turn only Radiance and ECE eye lines into the affectionate center",
      "replace only the undersized prop body with a full-size metallic inert replica and clearly indexed finger",
    ],
    preserveLocks: [
      "four adult identities and exactly eight arms and eight hands",
      "round-29 invitation, explicit yes, Radiance-Ellie-ECE party scope, and Alia exclusion",
      "ECE two-hand compass ownership and hands-free route map",
      "Batumi, straight rain, clean photographic surface, wardrobe rolls, mascots, target, and complete backstop",
    ],
    radianceRealtimeAgreementParty: recoveryPartyState,
  },
};
checkpoint.scenePlans["1551"].freshRound29.freshVisualAudit = freshAudit;
checkpoint.scenePlans["1551"].freshRound29.recoveryPrompt = recoveryPrompt;
checkpoint.scenePlans["1551"].freshRound29.recoveryPromptSha256 = sha256(recoveryPrompt);
checkpoint.scenePlans["1551"].freshRound29.recoveryRadianceRealtimeAgreementParty = recoveryPartyState;
checkpoint.rawOutputs.push({
  scene: 1551,
  round: 29,
  kind: "clean-fresh-recovery-pending",
  path: rawPath,
  sourcePath,
  sha256: expectedRawSha,
  dimensions: { width: 941, height: 1672 },
});
checkpoint.renderStrategyReset = {
  ...checkpoint.renderStrategyReset,
  activeCleanRound: 29,
  activeSourcePolicy: "single targeted recovery from clean round 29 raw only",
  priorBatumiRenderInputCount: 1,
};
checkpoint.xPost.note = "Georgia has accepted scenes 1548, 1549, and 1550. Clean round 29 scene 1551 is preserved but rejected; its sole bounded recovery is materialized. Publication remains mandatory after scene 1551 is accepted and the four-scene completion checkpoint is pushed.";
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "launch-single-clean-fresh-round-29-recovery-scene-1551-only",
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
