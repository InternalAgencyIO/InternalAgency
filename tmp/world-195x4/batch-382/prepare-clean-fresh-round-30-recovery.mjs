import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const root = path.join(repo, "tmp/world-195x4/batch-382");
const checkpointPath = path.join(repo, "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json");
const contractPath = path.join(repo, "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const ledgerPath = path.join(repo, "assets/lore/starlight-era/world-x-publish-ledger.json");
const rawPath = "tmp/world-195x4/batch-382/raw/clean-fresh-round-30/scene-1551.png";
const sourcePath = "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-0bcb1908-9bb9-4f0c-9168-0440dc04f3b3.png";
const expectedRawSha = "81E0BBA9C73447ED43A59262DF9B59299941FC686EE5778DFD07C04ECE2B2AD9";
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex").toUpperCase();
}

function sha256File(filePath) {
  return sha256(fs.readFileSync(filePath));
}

if (sha256File(contractPath) !== "69EB6C84A2467A4234D901C3086ECECE9E583B55C41BB9382CD5ED523C482EF5") throw new Error("Contract changed during round 30");
if (sha256File(ledgerPath) !== "B94AA3FB2B1AB1BCAB100CE689F0173C77407B82439D73379D8BC0FA3EEC2455") throw new Error("Ledger changed during round 30");
if (sha256File(path.join(repo, rawPath)) !== expectedRawSha) throw new Error("Clean round 30 raw changed");
if (checkpoint.status !== "active-four-scene-gate-clean-fresh-round-30-materialized") throw new Error(`Unexpected status: ${checkpoint.status}`);

const radiancePartyState = checkpoint.renderAttempts.freshRound30.radianceRealtimeAgreementParty;
if (radiancePartyState?.partyActivation !== false || radiancePartyState?.response?.category !== "explicit decline") throw new Error("Round 30 decline state missing");
if ((radiancePartyState.willingParticipants ?? []).length !== 0) throw new Error("Round 30 willing participants changed");
const recoveryPartyState = {
  ...radiancePartyState,
  recoveryDecisionContinuity: "This one technical correction remains the same round-30 event. ECE's invitation, Radiance's explicit decline, partyActivation false, empty willing-participant set, and every consent boundary remain unchanged.",
  recoveryEvidenceRequirement: "Preserve Radiance's already-clear extended open decline palm, head angle, and warm eye line to ECE while changing only the Ellie-Radiance support geometry.",
};

const recoveryPrompt = `Use case: precise-object-edit.
Input image: the supplied Georgia Batch 382 scene 1551 clean fresh round 30 raw. It is the only visual source.

ONE RECOVERY ONLY
Make one clean, tightly localized correction. Preserve the source's natural photographic surface, straight rain, flat wet paving, landmarks, reflections, faces, bodies, camera, lighting, mascots, route map, and all successful spacing. Do not globally redraw, restyle, sharpen, upscale, liquify, or repaint the frame. Move existing anatomy and garment panels only. Add no person, limb, hand, finger cluster, animal, prop, decoration, or background object.

LOCK THE SUCCESSFUL RADIANCE RESPONSE
Preserve the offered choice: ${recoveryPartyState.offeredChoice}
Preserve Radiance's explicit response: ${recoveryPartyState.radianceResponse}
partyActivation = FALSE. Willing participants remain none. Keep Radiance's already visible extended bare arm, large open palm facing ECE, separated fingers, warm direct eye line to ECE, and clear decline unchanged. Keep ECE's accepting expression and both existing hands on opposite compass handles unchanged. The extended open palm touches nobody. Do not turn this decline into a celebration or party.

CORRECTION ZONE 1: SHALLOW CONTROLLED DIP AND EXACT CONTACT GRAPH
Keep Ellie at far left and Radiance immediately right of her. Preserve their adult identities, faces, hair, garments, complete legs, complete feet, and planted footwear. Convert only their existing upright turn into a conventional shallow supported dip: Ellie stays upright and stable; Radiance leans back about twenty degrees toward Ellie while both of Radiance's feet remain fully planted and separated.
Keep exactly four arms and exactly four hands across Ellie and Radiance, two per woman. Keep Radiance's existing extended open decline arm and hand exactly as they are. Reposition the other three existing arms only.
Ellie's near white-sleeved arm must be fully visible from shoulder to elbow to forearm to wrist and end in one open palm spread clearly on Radiance's bare upper back. Ellie's other white-sleeved arm and Radiance's other bare arm form one clear shoulder-height palm-to-palm clasp against plain sea, with both wrists, palms, and finger clusters individually readable. Radiance's securely covered cobalt hip rests visibly against Ellie's covered white hip as stable support.
The three and only three relationship contacts are: the single shoulder-height clasp; Ellie's open support palm on Radiance's upper back; and the covered hip-to-covered-hip support point. Radiance's open decline palm touches nobody. Show continuous owner paths for all four arms and four hands. No hidden hand, hand emerging from a waist, fused wrist, duplicated fingers, extra touch, or ambiguous owner.

CORRECTION ZONE 2: RADIANCE FULLY OPEN BACK
Remove only the blue-and-gold straps, rings, harness pieces, and bands crossing Radiance's upper and middle back. Her cobalt garment remains securely anchored below the waist and remains fully opaque and public-safe. Leave one uninterrupted bare upper and middle back from both shoulders down to the secure waistline. Preserve her visible-midriff result as false, her strapless result as false, her opaque rainbow knee hosiery, shoes, hem, jewelry, identity, and clean skin texture.

CORRECTION ZONE 3: ALIA MIDRIFF AND SAFE INERT REPLICA READ
Preserve Alia's identity, braided ponytail, exact two arms, exact two hands, strict right-facing stance, fully open back, strapless copper shell, cobalt pleated skort, legs, feet, target axis, paper diamond, and complete sand backstop. Shorten only the bottom edge of her copper shell enough to expose one unmistakable continuous four-centimeter band of bare midriff above the cobalt waistband. Keep chest and intimate areas fully opaque and covered.
Clarify the object already in Alia's two hands as exactly one full-size approximately 30-centimeter polished-steel Desert Eagle-style large-frame inert cinema-training replica. Preserve its metallic heat-anodized rainbow finish, substantial grip, and compact barrel. Make the small orange safety insert visible only inside the muzzle opening. Keep Alia's primary hand on the grip and support hand cupping the grip base. Straighten the existing primary index finger flat along the metal side plate, clearly above and entirely outside the oversized black oval trigger guard. The complete guard must be visibly empty. Show exactly two wrists, two palms, and two distinct finger clusters. Keep the muzzle aimed only at the empty paper target and complete backstop. No ammunition, magazine, firing, flash, threat, injury, or combat.

PRESERVE EVERY OTHER SUCCESS
Preserve exactly four clearly adult fictional women with anchored faces and Alia's braids; exactly eight human arms and exactly eight human hands, two per woman; Radiance and ECE's affectionate boundary-setting eye line; ECE's two hands on opposite compass handles; the separate hands-free blue route map; one PAWS kitten and one MAX puppy sharing the raised dry bed; Batumi's Black Sea, skyline, Alphabet Tower, Ferris wheel, palms, glass rail, straight rain, flat wet tiles, and natural reflections; four structurally distinct expedition-couture silhouettes; all footwear; one target; and one complete backstop.

SURFACE AND SCOPE GATE
No extra person, limb, hand, finger cluster, animal, prop, ornament, party object, crowd, drink, confetti, text, logo, target, or equipment. No wavy or marbled processing, liquify distortion, rippled skin or fabric, melted anatomy, embossed contour, halo, excessive sharpening, painterly texture, bent tower, bent rail, warped tile, or curved rain. Keep one coherent clean photographic exposure.`;

const promptPath = path.join(root, "scene-1551-clean-fresh-round-30-recovery-prompt.txt");
fs.writeFileSync(promptPath, recoveryPrompt, "utf8");
const materializedAt = new Date().toISOString();
const freshAudit = {
  renderSurfaceQuality: "pass-clean-natural-photographic-texture-without-wavy-or-marbled-artifacts",
  identity: "pass-four-adult-identities-with-Alia-braids",
  anatomy: "reject-Ellie-support-contact-and-exact-left-couple-owner-inventory-not-fully-auditable",
  handOwnership: "partial-Radiance-decline-arm-ECE-compass-and-Alia-grip-pass-but-Ellie-Radiance-support-graph-fails",
  weather: "pass-heavy-straight-rain-and-flat-wet-tiles",
  locationThemeFusion: "pass-recognizable-Batumi-and-distinct-expedition-couture",
  outfitOriginality: "pass-four-distinct-silhouettes-constructions-hems-and-footwear",
  rolledWardrobe: "reject-Radiance-open-back-obstructed-by-straps-and-Alia-visible-midriff-band-missing",
  romance: "reject-upright-turn-instead-of-controlled-dip-and-fewer-than-three-clear-contacts",
  radianceResponse: "pass-explicit-decline-through-fully-visible-open-palm-and-warm-ECE-eye-line",
  partyActivation: "pass-false-with-no-party-participants-or-party-objects",
  mascots: "pass-one-PAWS-and-one-MAX-sharing-raised-dry-bed",
  oddProp: "pass-ECE-two-hands-on-opposite-compass-handles",
  routeMap: "pass-separate-hands-free-holographic-map",
  missionHandling: "reject-full-size-metallic-read-is-improved-but-empty-guard-indexed-finger-and-orange-insert-remain-ambiguous",
  missionTargetAxis: "pass-paper-diamond-complete-backstop-and-safe-right-facing-axis",
  accepted: false,
};

checkpoint.status = "active-four-scene-gate-clean-fresh-round-30-recovery-materialized";
checkpoint.checkpointedAt = materializedAt;
checkpoint.terminal = false;
checkpoint.renderAttempts.freshRound30 = {
  ...checkpoint.renderAttempts.freshRound30,
  status: "fresh-completed-rejected-recovery-materialized",
  freshCompletedAt: materializedAt,
  rawOutputs: { 1551: { path: rawPath, sha256: expectedRawSha, preserved: true } },
  freshStrictAudit: freshAudit,
  recoveryDecision: {
    attempted: true,
    reason: "The clean raw passes surface, identities, Radiance's explicit decline, ECE eye line, Batumi, mascots, route map, and target. One bounded correction restores the rolled dip and contacts, active wardrobe rolls, and auditable inert-replica safety without touching the successful regions.",
    maximumRecoveryPasses: 1,
    recoveryPassNumber: 1,
    sourceRaw: rawPath,
  },
  recoveryPromptAudit: {
    path: path.relative(repo, promptPath).replaceAll("\\", "/"),
    sha256: sha256(recoveryPrompt),
    chars: recoveryPrompt.length,
    sourceMode: "single-targeted-recovery-from-clean-round-30-raw",
    sourceRaw: { path: rawPath, sha256: expectedRawSha },
    priorBatumiRenderInputCount: 1,
    permittedSourceCount: 1,
    recoveryPass: 1,
    maximumRecoveryPasses: 1,
    boundedCorrections: [
      "convert only Ellie-Radiance upright turn into a shallow supported dip with three explicit contacts and exact owner paths",
      "remove only the straps crossing Radiance's back and expose only Alia's active midriff band",
      "clarify only the existing inert replica's full-size metallic body, orange insert, indexed finger, and empty guard",
    ],
    preserveLocks: [
      "Radiance's visible open decline palm, warm ECE eye line, partyActivation false, and empty participant set",
      "four adult identities and exactly eight arms and eight hands",
      "clean photographic surface, straight rain, Batumi, mascots, compass, route map, target, and backstop",
    ],
    radianceRealtimeAgreementParty: recoveryPartyState,
  },
};
checkpoint.scenePlans["1551"].freshRound30.freshVisualAudit = freshAudit;
checkpoint.scenePlans["1551"].freshRound30.recoveryPrompt = recoveryPrompt;
checkpoint.scenePlans["1551"].freshRound30.recoveryPromptSha256 = sha256(recoveryPrompt);
checkpoint.scenePlans["1551"].freshRound30.recoveryRadianceRealtimeAgreementParty = recoveryPartyState;
checkpoint.rawOutputs.push({
  scene: 1551,
  round: 30,
  kind: "clean-fresh-recovery-pending",
  path: rawPath,
  sourcePath,
  sha256: expectedRawSha,
  dimensions: { width: 941, height: 1672 },
});
checkpoint.renderStrategyReset = {
  ...checkpoint.renderStrategyReset,
  activeCleanRound: 30,
  activeSourcePolicy: "single targeted recovery from clean round 30 raw only",
  priorBatumiRenderInputCount: 1,
};
checkpoint.xPost.note = "Georgia has accepted scenes 1548, 1549, and 1550. Clean round 30 scene 1551 is preserved but rejected; its sole bounded recovery is materialized. Publication remains mandatory after scene 1551 is accepted and the four-scene completion checkpoint is pushed.";
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "launch-single-clean-fresh-round-30-recovery-scene-1551-only",
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
