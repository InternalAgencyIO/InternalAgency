import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const root = path.join(repo, "tmp/world-195x4/batch-382");
const checkpointPath = path.join(repo, "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json");
const contractPath = path.join(repo, "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const ledgerPath = path.join(repo, "assets/lore/starlight-era/world-x-publish-ledger.json");
const rawPath = "tmp/world-195x4/batch-382/raw/clean-fresh-round-27/scene-1551.png";
const sourcePath = "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-58f33382-7331-4ecd-8a15-5b85d7d02273.png";
const expectedRawSha = "DE208526E9332B197F3519CD3D5A3EF5DAFEB3B19AD5CD3CF01B0D33237C4B91";
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex").toUpperCase();
}

function sha256File(filePath) {
  return sha256(fs.readFileSync(filePath));
}

if (sha256File(contractPath) !== "69EB6C84A2467A4234D901C3086ECECE9E583B55C41BB9382CD5ED523C482EF5") throw new Error("Contract changed during round 27");
if (sha256File(ledgerPath) !== "B94AA3FB2B1AB1BCAB100CE689F0173C77407B82439D73379D8BC0FA3EEC2455") throw new Error("Ledger changed during round 27");
if (sha256File(path.join(repo, rawPath)) !== expectedRawSha) throw new Error("Clean round 27 raw changed");
if (checkpoint.status !== "active-four-scene-gate-clean-fresh-round-27-materialized") throw new Error(`Unexpected status: ${checkpoint.status}`);

const radiancePartyState = checkpoint.renderAttempts.freshRound27.radianceRealtimeAgreementParty;
if (radiancePartyState?.partyActivation !== true || radiancePartyState?.response?.category !== "explicit affirmative") throw new Error("Round 27 affirmative missing");
if (radiancePartyState.willingParticipants?.join("|") !== "Radiance|AI ECE") throw new Error("Round 27 participant set changed");
const recoveryPartyState = {
  ...radiancePartyState,
  recoveryDecisionContinuity: "This single technical correction remains the same round-27 image event, so the invitation, explicit yes, Radiance-and-ECE-only party, and all other consent boundaries remain unchanged.",
  recoveryEvidenceRequirement: "Preserve Radiance's open palm on ECE's shoulder and their warm mutual eye line while making the separate Ellie support and full left-center limb inventory auditable.",
};

const recoveryPrompt = `Use case: precise-object-edit.
Input: the supplied Georgia Batch 382 scene 1551 clean fresh round 27 raw.

ONE RECOVERY ONLY
This is the single allowed recovery for clean round 27. Edit only two bounded zones: the Ellie-Radiance left-center dip group and Alia's right safety lane. Preserve the clean natural photographic surface and every successful element. Do not globally redraw, reinterpret, sharpen, restyle, or process the image. Move existing limbs only; add no limb, hand, finger cluster, person, animal, or prop.

RADIANCE LIVE AGREEMENT CONTINUITY
Preserve the offered choice: ${recoveryPartyState.offeredChoice}
Preserve Radiance's explicit response: ${recoveryPartyState.radianceResponse}
partyActivation = TRUE. Willing participants are exactly Radiance and AI ECE. Preserve Radiance's existing open right palm on ECE's near shoulder, clear affirmative expression, and warm direct eye line to ECE. Preserve ECE's willing smile and eye line while both ECE hands remain on the compass. Ellie remains only the safe dip supporter and does not join the party. Alia remains outside it. Add no party object or extra contact.

CORRECTION ZONE 1: FOUR VISIBLE LEFT-CENTER ARMS, FOUR CONTACTS, AND SHALLOW DIP
Preserve Ellie and Radiance's adult identities, faces, hair, outfits, complete legs, complete feet, and current spacing. Preserve Radiance's existing right arm, right hand, and open palm on ECE's shoulder exactly. Preserve Ellie's existing lower hand at Radiance's fully covered high waist. Keep exactly four arms and four hands across Ellie and Radiance; reposition existing hidden limbs only and add none.
Tilt Radiance's torso only about fifteen degrees into a clearly supported rear-three-quarter dip toward Ellie while both Radiance feet remain planted and separated. Her fully open back remains visible. Move Radiance's currently hidden non-ECE arm entirely into open air: show bare shoulder, upper arm, elbow, forearm, wrist, open palm, and fingers as one continuous owner path ending with that palm on Ellie's near shoulder.
Move Ellie's currently hidden second support arm entirely outside Radiance's cobalt silhouette. Show its white sleeve, elbow, forearm, wrist, open palm, and fingers as one continuous owner path ending high and flat on Radiance's far upper back. Keep Ellie's other white-sleeved arm and existing waist-support palm visibly lower, with a large vertical gap between the two white hands. Ellie's two feet remain planted; her posture visibly bears the dip.
The four and only relationship contacts are Ellie's upper-back support, Ellie's waist support, Radiance's palm on Ellie's shoulder, and Radiance's preserved palm on ECE's shoulder. No raised clasp, no hidden low hand, no hand behind a torso, and no extra touch.
Remove the blue neck loop, blue collar, halter strip, necklace, chain, crossing strap, and every ornament from Radiance's upper-back zone. Preserve the secure opaque cobalt dress front, sides, high waist, asymmetrical hem, heels, and exactly one pair of opaque rainbow knee socks. Her upper back is uninterrupted bare skin from shoulder blades to the secure high waist.

CORRECTION ZONE 2: ALIA MIDRIFF, OPEN BACK, ORANGE PLUG, AND INDEXED FINGER
Preserve Alia's adult identity, sculptural braided ponytail, exact two arms, exact two hands, legs, feet, copper-and-cobalt silhouette, safe right-facing axis, glass panel, complete sand backstop, and the single existing paper diamond.
Turn only Alia's upper torso a few degrees farther into rear three-quarter view while retaining her strict right-facing profile and safe two-hand stance. Remove every neck ring, necklace, cord, collar, halter, shoulder strap, back band, crossing band, and element across her upper back. Keep a rigid opaque strapless copper front-and-side corsage with its top edge below bare collarbones and shoulders, wide secure side wings ending at her flanks, uninterrupted bare upper back to the high secure waist, and one unmistakable restrained three-centimeter bare midriff band above the cobalt pleated skort. No transparent area or undergarment.
Preserve exactly one full-size heavy polished-metal rainbow-gradient Desert Eagle-style inert cinema-training replica. Add one clearly visible orange muzzle plug flush inside the compact short barrel. Keep one substantial grip and one oversized black oval trigger guard. Alia's primary right hand wraps the grip; her right trigger index is one long straight finger lying flat along the metallic side plate above and entirely outside the guard. The whole black oval trigger guard remains visibly empty. Her support left palm cups only the lower front of the primary fist and grip base. Keep two distinct wrists, palms, and finger clusters with clean air around the guard. Preserve the safe aligned target and complete backstop.

PRESERVE EVERY SUCCESSFUL ELEMENT
Preserve exactly four clearly adult fictional women with anchored identities and Alia's braids; exactly eight human arms and exactly eight human hands, two per woman; Radiance and ECE's visible affirmative shoulder contact and mutual eye line; ECE's two separated hands on opposite compass handles; the hands-free blue route map; Batumi's Black Sea, skyline, Alphabet Tower, Ferris wheel, palms, straight heavy rain, flat wet tiles, and glass rail; four distinct Mars-expedition couture silhouettes; the one paper target and complete backstop; and exactly one PAWS kitten plus one MAX puppy together inside the raised dry padded lounge.
Preserve all other anatomy, wardrobe, camera, lens, lighting, landmarks, compass, map, animals, lounge, reflections, and safe downrange geometry unchanged.

SURFACE AND SCOPE GATE
Add no person, limb, hand, finger cluster, animal, prop, decoration, crowd, drink, confetti, text, logo, extra target, or scattered equipment. Add no wavy processing, liquify distortion, marbling, rippled skin, rippled fabric, melted edge, embossed contour, halo, excessive sharpening, bent architecture, bent glass, or painterly texture. Keep one clean coherent photographic exposure.`;

const promptPath = path.join(root, "scene-1551-clean-fresh-round-27-recovery-prompt.txt");
fs.writeFileSync(promptPath, recoveryPrompt, "utf8");
const materializedAt = new Date().toISOString();
const freshAudit = {
  renderSurfaceQuality: "pass-clean-natural-photographic-texture-without-wavy-artifacts",
  identity: "pass-four-adult-identities-with-Alia-braids",
  anatomy: "reject-one-Radiance-arm-and-one-Ellie-support-hand-hidden-in-left-center-group",
  handOwnership: "reject-left-center-four-hand-inventory-not-fully-auditable; ECE-and-Alia-hands-pass",
  weather: "pass-heavy-straight-rain",
  locationThemeFusion: "pass-recognizable-Batumi-with-four-distinct-futurist-expedition-silhouettes",
  outfitOriginality: "pass-four-distinct-silhouettes-constructions-and-footwear",
  rolledWardrobe: "reject-Radiance-blue-neck-loop-crosses-open-back-and-Alia-midriff-open-back-read-is-incomplete",
  romance: "reject-dip-is-too-upright-and-only-two-contacts-are-clearly-visible",
  radianceResponse: "pass-clear-Radiance-palm-on-ECE-shoulder-and-warm-mutual-eye-line",
  partyActivation: "pass-Radiance-and-ECE-only-affirmative-party-beat-with-Ellie-and-Alia-outside",
  mascots: "pass-one-PAWS-and-one-MAX-together-on-raised-dry-padded-lounge",
  oddProp: "pass-ECE-two-hands-on-opposite-compass-handles",
  routeMap: "pass-separate-hands-free-holographic-map",
  missionHandling: "reject-orange-muzzle-plug-and-indexed-finger-outside-empty-guard-not-auditable",
  missionTargetAxis: "pass-separated-paper-diamond-complete-backstop-and-safe-right-facing-axis",
  accepted: false,
};

checkpoint.status = "active-four-scene-gate-clean-fresh-round-27-recovery-materialized";
checkpoint.checkpointedAt = materializedAt;
checkpoint.terminal = false;
checkpoint.renderAttempts.freshRound27 = {
  ...checkpoint.renderAttempts.freshRound27,
  status: "fresh-completed-rejected-recovery-materialized",
  freshCompletedAt: materializedAt,
  rawOutputs: { 1551: { path: rawPath, sha256: expectedRawSha, preserved: true } },
  freshStrictAudit: freshAudit,
  recoveryDecision: {
    attempted: true,
    reason: "The clean raw passes surface, identities, Radiance-ECE consent beat, compass, mascots, target, and location; only the left dip inventory and right wardrobe/prop audit zones need correction.",
    maximumRecoveryPasses: 1,
    recoveryPassNumber: 1,
    sourceRaw: rawPath,
  },
  recoveryPromptAudit: {
    path: path.relative(repo, promptPath).replaceAll("\\", "/"),
    sha256: sha256(recoveryPrompt),
    chars: recoveryPrompt.length,
    sourceMode: "single-targeted-recovery-from-clean-round-27-raw",
    sourceRaw: { path: rawPath, sha256: expectedRawSha },
    priorBatumiRenderInputCount: 1,
    permittedSourceCount: 1,
    recoveryPass: 1,
    maximumRecoveryPasses: 1,
    boundedCorrections: [
      "expose the two hidden left-center owner paths, clarify the shallow dip and four contacts, and clear Radiance's open back",
      "clarify Alia's strapless open-back midriff construction plus orange muzzle plug and indexed finger outside the empty guard",
    ],
    preserveLocks: [
      "four adult identities and exactly eight arms and eight hands",
      "Radiance-ECE explicit yes, shoulder contact, mutual eye line, and two-person party scope",
      "ECE two-hand compass ownership and hands-free route map",
      "Batumi, heavy straight rain, clean photographic surface, mascots, target, and complete backstop",
    ],
    radianceRealtimeAgreementParty: recoveryPartyState,
  },
};
checkpoint.scenePlans["1551"].freshRound27.freshVisualAudit = freshAudit;
checkpoint.scenePlans["1551"].freshRound27.recoveryPrompt = recoveryPrompt;
checkpoint.scenePlans["1551"].freshRound27.recoveryPromptSha256 = sha256(recoveryPrompt);
checkpoint.scenePlans["1551"].freshRound27.recoveryRadianceRealtimeAgreementParty = recoveryPartyState;
checkpoint.rawOutputs.push({
  scene: 1551,
  round: 27,
  kind: "clean-fresh-recovery-pending",
  path: rawPath,
  sourcePath,
  sha256: expectedRawSha,
  dimensions: { width: 941, height: 1672 },
});
checkpoint.renderStrategyReset = {
  ...checkpoint.renderStrategyReset,
  activeCleanRound: 27,
  activeSourcePolicy: "single targeted recovery from clean round 27 raw only",
  priorBatumiRenderInputCount: 1,
};
checkpoint.xPost.note = "Georgia has accepted scenes 1548, 1549, and 1550. Clean round 27 scene 1551 is preserved but rejected; its sole bounded recovery is materialized. Publication remains mandatory after scene 1551 is accepted and the four-scene completion checkpoint is pushed.";
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "launch-single-clean-fresh-round-27-recovery-scene-1551-only",
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
