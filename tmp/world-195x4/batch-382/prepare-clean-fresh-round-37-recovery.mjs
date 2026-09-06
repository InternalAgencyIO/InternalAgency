import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const root = path.join(repo, "tmp/world-195x4/batch-382");
const checkpointPath = path.join(repo, "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json");
const contractPath = path.join(repo, "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const ledgerPath = path.join(repo, "assets/lore/starlight-era/world-x-publish-ledger.json");
const rawPath = "tmp/world-195x4/batch-382/raw/clean-fresh-round-37/scene-1551.png";
const sourcePath = "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-17f47e63-d04e-42ae-b1a3-cc6369e6bab8.png";
const expectedRawSha = "415E1308BFC54456B0934134E212E73172E55C2E4E9BD90CF6B88EA8B7329073";
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex").toUpperCase();
}

function sha256File(filePath) {
  return sha256(fs.readFileSync(filePath));
}

if (sha256File(contractPath) !== "69EB6C84A2467A4234D901C3086ECECE9E583B55C41BB9382CD5ED523C482EF5") throw new Error("Contract changed during round 37");
if (sha256File(ledgerPath) !== "B94AA3FB2B1AB1BCAB100CE689F0173C77407B82439D73379D8BC0FA3EEC2455") throw new Error("Ledger changed during round 37");
if (sha256File(path.join(repo, rawPath)) !== expectedRawSha) throw new Error("Clean round 37 raw changed");
if (checkpoint.status !== "active-four-scene-gate-clean-fresh-round-37-materialized") throw new Error(`Unexpected status: ${checkpoint.status}`);

const radiancePartyState = checkpoint.renderAttempts.freshRound37.radianceRealtimeAgreementParty;
if (radiancePartyState?.partyActivation !== false || radiancePartyState?.response?.category !== "explicit pause") throw new Error("Round 37 pause missing");
if (radiancePartyState.willingParticipants?.length !== 0) throw new Error("Round 37 willing participant set changed");
const recoveryPartyState = {
  ...radiancePartyState,
  recoveryDecisionContinuity: "This single correction remains the same round-37 event. Alia's invitation, Radiance's explicit pause, partyActivation false, zero willing participants, and every consent boundary remain unchanged.",
  recoveryEvidenceRequirement: "Preserve Radiance's raised open wait palm, thoughtful expression, and planted feet. Keep ECE and Alia task-focused and show no celebration cue from anyone.",
};

const recoveryPrompt = `Use case: precise-object-edit.
Input image: the supplied Georgia Batch 382 scene 1551 clean fresh round 37 raw. It is the only visual source.

ONE LOCAL RECOVERY ONLY
Preserve this clean natural editorial photograph. Keep the exact camera, crop, exposure, four adult identities, all eight existing arms and hands, every complete foot, low clasp, back-support palm, Radiance's wait palm, compass grips, mascots, clean straight rain, Batumi landmarks, sea, tiles, reflections, compass, map, and four garment families. Edit only the relationship brace at left and Alia's existing right-side subject, mission replica, and existing target/backstop lane. Do not globally redraw, restyle, sharpen, upscale, relight, liquify, or process the photograph. Add no person, limb, hand, finger cluster, animal, prop, or decoration.

LOCK RADIANCE'S PAUSE
Preserve the offered choice: ${recoveryPartyState.offeredChoice}
Preserve Radiance's explicit response: ${recoveryPartyState.radianceResponse}
partyActivation = FALSE. Actual willing participants remain none. Preserve Radiance's large raised open left wait palm toward Alia, thoughtful closed-mouth expression, and both planted feet. Preserve ECE's thoughtful task-focused eye line and two compass hands. Alia remains task-focused and questioning, never celebratory. Ellie remains calmly supportive. Nobody dances, nods yes, heel-taps, celebrates, or treats the pause as agreement. Add no party object.

CORRECTION ZONE 1: SAFE RIGHTWARD MISSION LANE
Keep Alia as the same clearly adult Black woman with the same face, body, skin tone, sculptural braided ponytail, cobalt skort, copper footwear, exact two arms, and exact two hands. Move her complete body slightly left within the existing right-side empty pavement and rotate her complete torso, head, arms, and existing replica together into strict RIGHT-facing profile. Her shoulders and both arms must point toward the target at far right, never left toward ECE or any person. Keep all four women, both mascots, and the compass entirely behind and left of the muzzle plane.
Preserve exactly one realistic approximately 30-centimeter dark polished-metal Desert Eagle-style inert cinema-training replica with restrained rainbow highlights and a small orange safety insert only in the muzzle. Make its right side plate visible in clean side profile. Alia's primary right hand wraps the grip. Her existing right trigger index becomes one long fully straight finger lying flat along the metal side plate above and entirely outside the complete black oval trigger guard. Show clean air between finger and guard; the complete guard is visibly empty. Her separate support left palm cups only the lower front of the primary fist and grip base. Keep exactly two wrists, two palms, and two finger clusters, with no duplicated digit.
Move and slightly narrow the same existing thick sand backstop to the far-right middle distance so its complete top, bottom, left edge, and right edge are all inside frame with a wide rainy margin on every side. Keep the single white paper route diamond centered on it. Place that target directly on the shoulder-height continuation of Alia's rightward muzzle line, several visible meters away across an empty pavement strip. Keep one complete transparent safety panel between Alia and target. Do not add a second target, barrier, berm, sign, lane, replica, or object.

CORRECTION ZONE 2: ALIA'S ACTIVE OPEN BACK
Preserve Alia's secure opaque Mars-copper front-only strapless couture shell and complete public-safe bust coverage. Remove only the copper horizontal rear band and every rear closure from her upper and middle back. The front-only molded shell visibly ends before both rear ribs through internal couture structure. Leave one large continuous field of bare upper and middle back from shoulder blades down to the separate four-centimeter bare waist band. Add no strap, collar, necklace, neck loop, chain, rear band, crossing band, rear fabric, or illusion mesh.

CORRECTION ZONE 3: AUDITABLE THIRD AND FOURTH CONTACTS
Preserve Ellie and Radiance's existing low right-hand clasp and Ellie's existing open left support palm on Radiance's near shoulder blade. Preserve both women's complete arms, hands, fingers, faces, outfits, legs, and feet. Move Radiance's complete body only a few centimeters left as one coherent subject without changing her shallow dip, open back, raised wait palm, or anatomy. Make Ellie's broad white-sleeved left forearm press visibly along Radiance's cobalt-covered left side ribs below the support palm. Also make Radiance's cobalt-covered left outer hip rest broadly and firmly on Ellie's white-covered right upper thigh with a compressed garment-to-garment edge and absolutely no air gap. Keep faces and torsos distinct. The four and only four relationship contact regions are the low clasp, broad forearm-to-covered-side brace, support palm on shoulder blade, and covered hip-to-covered-thigh brace. Add no touch or hand.

PRESERVE EVERY SUCCESS
Preserve exactly four clearly adult fictional women with distinct anchored identities and Alia's sculptural braided ponytail; exactly eight human arms and eight human hands, two per woman; Radiance's large uninterrupted open back; Ellie midriff; Alia strapless construction and bare waist; Radiance's opaque original-rainbow knee socks; ECE's covered waist and two compass hands; partyActivation false with Radiance's explicit pause and zero willing participants; one PAWS kitten and one MAX puppy together on the raised dry bed; the hands-free blue route map; Batumi's recognizable Alphabet Tower, Ferris wheel, Black Sea, skyline, palms, glass rail, flat wet tiles, reflections, and straight rain; four distinct couture silhouettes; all full bodies; and all footwear.

SURFACE AND SAFETY GATE
No aim at a person, animal, occupied object, or camera. No ammunition, loose magazine, firing, muzzle flash, threat, injury, or combat. No extra person, limb, hand, finger cluster, animal, prop, decoration, crowd, text, logo, target, equipment, or party object. No wavy or marbled processing, liquify distortion, rippled skin or fabric, melted edge, embossed contour, halo, excessive sharpening, painterly texture, bent tower, bent rail, warped tile, or curved rain. Keep one coherent clean photographic exposure.`;

const promptPath = path.join(root, "scene-1551-clean-fresh-round-37-recovery-prompt.txt");
fs.writeFileSync(promptPath, recoveryPrompt, "utf8");
const materializedAt = new Date().toISOString();
const freshAudit = {
  renderSurfaceQuality: "pass-clean-natural-photographic-texture-with-straight-rain-flat-tiles-and-no-wavy-artifacts",
  identity: "pass-four-clearly-adult-identities-with-Alia-braids",
  anatomy: "pass-exact-eight-arms-and-eight-hands-with-continuous-owner-paths",
  handOwnership: "pass-two-hands-per-woman-with-clear-clasp-support-pause-compass-and-mission-owner-paths",
  weather: "pass-heavy-straight-rain-and-flat-wet-tiles",
  locationThemeFusion: "pass-recognizable-Batumi-with-Alphabet-Tower-Ferris-wheel-sea-skyline-and-four-distinct-expedition-silhouettes",
  outfitOriginality: "pass-four-distinct-silhouettes-constructions-hems-materials-and-footwear",
  rolledWardrobe: "reject-Alia-active-open-back-interrupted-by-copper-rear-band; Radiance-open-back-Ellie-midriff-Alia-midriff-Alia-strapless-and-Radiance-hosiery-pass",
  romance: "reject-low-clasp-and-support-palm-pass-but-side-forearm-and-covered-hip-to-thigh contacts are not distinct enough to certify three contacts",
  radianceResponse: "pass-explicit-pause-through-large-open-wait-palm-thoughtful-expression-and-planted-feet",
  partyActivation: "pass-partyActivation-false-with-zero-willing-participants-and-no-celebration-cue",
  mascots: "pass-one-PAWS-and-one-MAX-sharing-raised-dry-bed",
  oddProp: "pass-ECE-two-hands-on-opposite-compass-handles",
  routeMap: "pass-separate-hands-free-holographic-map",
  missionHandling: "reject-Alia-and-replica-aim-left-across-occupied-group-and-primary-index-outside-empty-guard-is-not-certifiable",
  missionTargetAxis: "reject-target-sits-behind-Alia-outside-the-leftward-muzzle-axis-and-backstop-is-cropped-by-right-frame edge",
  accepted: false,
};

checkpoint.status = "active-four-scene-gate-clean-fresh-round-37-recovery-materialized";
checkpoint.checkpointedAt = materializedAt;
checkpoint.terminal = false;
checkpoint.renderAttempts.freshRound37 = {
  ...checkpoint.renderAttempts.freshRound37,
  status: "fresh-completed-rejected-recovery-materialized",
  freshCompletedAt: materializedAt,
  rawOutputs: { 1551: { path: rawPath, sha256: expectedRawSha, preserved: true } },
  freshStrictAudit: freshAudit,
  recoveryDecision: {
    attempted: true,
    reason: "The clean raw passes surface, identities, exact eight-hand anatomy, Radiance's pause, Batumi, mascots, compass, map, and most wardrobe rolls. One bounded correction reorients only the existing right-side mission subject and lane safely rightward, removes Alia's rear band, and closes the two intended body-brace contacts.",
    maximumRecoveryPasses: 1,
    recoveryPassNumber: 1,
    sourceRaw: rawPath,
  },
  recoveryPromptAudit: {
    path: path.relative(repo, promptPath).replaceAll("\\", "/"),
    sha256: sha256(recoveryPrompt),
    chars: recoveryPrompt.length,
    sourceMode: "single-targeted-recovery-from-clean-round-37-raw",
    sourceRaw: { path: rawPath, sha256: expectedRawSha },
    priorBatumiRenderInputCount: 1,
    permittedSourceCount: 1,
    recoveryPass: 1,
    maximumRecoveryPasses: 1,
    boundedCorrections: [
      "rotate and shift Alia's existing complete subject and replica into a safe right-facing target axis",
      "move and narrow the existing target backstop fully inside the far-right frame",
      "straighten Alia's existing trigger index above and outside the empty guard",
      "remove Alia's copper rear band and rear closure",
      "close the existing side-forearm and covered hip-to-thigh support contacts",
    ],
    preserveLocks: [
      "clean artifact-free photographic surface",
      "exact eight arms and hands with all owner paths",
      "round-37 explicit pause with partyActivation false and zero willing participants",
      "identities Radiance open back Batumi mascots compass map and full bodies",
    ],
    radianceRealtimeAgreementParty: recoveryPartyState,
  },
};
checkpoint.scenePlans["1551"].freshRound37.freshVisualAudit = freshAudit;
checkpoint.scenePlans["1551"].freshRound37.recoveryPrompt = recoveryPrompt;
checkpoint.scenePlans["1551"].freshRound37.recoveryPromptSha256 = sha256(recoveryPrompt);
checkpoint.scenePlans["1551"].freshRound37.recoveryRadianceRealtimeAgreementParty = recoveryPartyState;
checkpoint.rawOutputs.push({
  scene: 1551,
  round: 37,
  kind: "clean-fresh-recovery-pending",
  path: rawPath,
  sourcePath,
  sha256: expectedRawSha,
  dimensions: { width: 941, height: 1672 },
});
checkpoint.renderStrategyReset = {
  ...checkpoint.renderStrategyReset,
  activeCleanRound: 37,
  activeSourcePolicy: "single targeted recovery from clean round 37 raw only",
  priorBatumiRenderInputCount: 1,
};
checkpoint.xPost.note = "Georgia has accepted scenes 1548, 1549, and 1550. Clean round 37 scene 1551 is preserved but rejected; its sole bounded recovery is materialized from that clean raw only. The live X webview also requires retry. Publication remains mandatory after scene 1551 is accepted and the four-scene completion checkpoint is pushed.";
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "launch-single-clean-fresh-round-37-recovery-scene-1551-only",
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
  willingParticipantCount: recoveryPartyState.willingParticipants.length,
  nextWakeAction: checkpoint.nextWakeAction,
}, null, 2));
