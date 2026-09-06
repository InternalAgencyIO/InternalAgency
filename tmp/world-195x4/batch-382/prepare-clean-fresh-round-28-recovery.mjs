import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const root = path.join(repo, "tmp/world-195x4/batch-382");
const checkpointPath = path.join(repo, "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json");
const contractPath = path.join(repo, "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const ledgerPath = path.join(repo, "assets/lore/starlight-era/world-x-publish-ledger.json");
const rawPath = "tmp/world-195x4/batch-382/raw/clean-fresh-round-28/scene-1551.png";
const sourcePath = "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-7f70439e-c2db-4b14-8fa3-df9849e58108.png";
const expectedRawSha = "78D9E48EEFB1005D5BDAE50DB6F95248065231587D9C43174672E51A4B2F19F2";
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex").toUpperCase();
}

function sha256File(filePath) {
  return sha256(fs.readFileSync(filePath));
}

if (sha256File(contractPath) !== "69EB6C84A2467A4234D901C3086ECECE9E583B55C41BB9382CD5ED523C482EF5") throw new Error("Contract changed during round 28");
if (sha256File(ledgerPath) !== "B94AA3FB2B1AB1BCAB100CE689F0173C77407B82439D73379D8BC0FA3EEC2455") throw new Error("Ledger changed during round 28");
if (sha256File(path.join(repo, rawPath)) !== expectedRawSha) throw new Error("Clean round 28 raw changed");
if (checkpoint.status !== "active-four-scene-gate-clean-fresh-round-28-materialized") throw new Error(`Unexpected status: ${checkpoint.status}`);

const radiancePartyState = checkpoint.renderAttempts.freshRound28.radianceRealtimeAgreementParty;
if (radiancePartyState?.partyActivation !== true || radiancePartyState?.response?.category !== "explicit affirmative") throw new Error("Round 28 affirmative missing");
if (radiancePartyState.willingParticipants?.join("|") !== "Radiance|Ellie|AI ECE|Alia") throw new Error("Round 28 participant set changed");
const recoveryPartyState = {
  ...radiancePartyState,
  recoveryDecisionContinuity: "This single technical correction remains the same round-28 image event, so Alia's invitation, Radiance's explicit yes, the all-four willing party, and every consent boundary remain unchanged.",
  recoveryEvidenceRequirement: "Preserve the all-four willing expressions while turning Radiance's warm eye line to ECE and Alia's confident smile back toward the accepted response; add no hand gesture or participant.",
};

const recoveryPrompt = `Use case: precise-object-edit.
Input: the supplied Georgia Batch 382 scene 1551 clean fresh round 28 raw.

ONE RECOVERY ONLY
This is the single allowed recovery for clean round 28. Preserve the current clean natural photographic surface, four adult identities, Batumi composition, outfits, mascots, compass, route map, complete bodies, and camera. Edit only the existing Ellie-Radiance dip unit, Radiance and Alia eye lines, Alia's narrow waist edge, the existing mission replica, and sparse straight rain. Do not globally redraw, sharpen, restyle, relight, upscale, or process the image. Move the existing eight limbs only; add no limb, hand, finger cluster, person, animal, or extra prop.

RADIANCE LIVE AGREEMENT CONTINUITY
Preserve the offered choice: ${recoveryPartyState.offeredChoice}
Preserve Radiance's explicit response: ${recoveryPartyState.radianceResponse}
partyActivation = TRUE. Willing participants remain exactly Radiance, Ellie, AI ECE, and Alia. Keep all four fully clothed, adult, public-safe, willing, and smiling. Turn Radiance's head and eyes rightward into a sustained warm mutual eye line with ECE while her affirmative chin angle and broad smile answer Alia's invitation. Turn only Alia's eyes and smile slightly back toward Radiance while Alia's arms and muzzle remain safely downrange. Ellie answers through a willing smile and secure dip support. ECE answers through her willing smile and forward torso direction while both hands remain on the compass. Add no party object, text, hand gesture, or extra contact.

CORRECTION ZONE 1: EXACT FOUR-HAND ELLIE-RADIANCE DIP
Preserve Ellie and Radiance's adult identities, faces, hair, garments, complete legs, complete feet, spacing, and clean skin. Keep exactly four arms and four hands across these two women. Reposition their existing arms only; add none.
Tilt Radiance's torso only about twelve degrees farther into a clearly supported shallow rear-three-quarter dance dip while both Radiance feet remain planted, separated, and complete. Preserve her fully covered waist, uninterrupted bare upper back, cobalt dress, and exactly one pair of opaque rainbow knee socks.
Ellie's white-sleeved left arm must be fully visible from shoulder through elbow, forearm, wrist, palm, and fingers against plain sea. It ends in one open left palm spread high and visibly on Radiance's bare upper back. Ellie's separate white-sleeved right arm must be fully visible in a lower path and end in a low palm-to-palm clasp with Radiance's right hand.
Radiance's bare right arm must be fully visible from shoulder through elbow, forearm, wrist, palm, and fingers, descending outside both silhouettes to that same low clasp with Ellie's right hand. Radiance's separate bare left arm must be fully visible on the opposite side and end in one open left palm on Ellie's near shoulder.
The three and only three relationship contacts are Ellie's left palm on Radiance's upper back, the low Ellie-Radiance right-hand clasp, and Radiance's left palm on Ellie's shoulder. Remove Radiance's current hand from the compass rim. Nobody except ECE touches the compass. No hand hides behind a torso, waist, garment, hair, prop, or another hand. Keep four distinct elbows, four distinct wrists, four distinct palms, four distinct finger clusters, and continuous owner paths.

CORRECTION ZONE 2: ALIA WAIST AND SAFE FULL-SIZE REPLICA
Preserve Alia's adult identity, skin, sculptural braided ponytail, exact two arms, exact two hands, legs, feet, rear-three-quarter right-facing stance, copper-and-cobalt silhouette, paper diamond, complete sand backstop, and safe target axis.
Shorten only the bottom edge of Alia's existing copper front-and-side corsage shell enough to reveal one unmistakable restrained three-centimeter horizontal band of bare midriff above the secure cobalt pleated skort. Preserve her already bare collarbones, bare shoulders, and fully open upper back with no rear fabric, strap, halter, neck loop, back band, crossing band, or illusion mesh.
Replace only the current undersized plastic-looking prop body with exactly one full-size heavy polished-metal rainbow-gradient Desert Eagle-style inert cinema-training replica. It has a compact short barrel, one substantial heavy grip, one oversized black oval trigger guard, and one clearly visible orange muzzle plug flush inside the barrel. Keep the existing two-hand downrange pose. Alia's primary right hand wraps the grip; her long right trigger index lies perfectly straight and flat along the metallic side plate above and entirely outside the guard. The whole black oval trigger guard is visibly empty. Her support left palm cups only the lower front of the primary fist and grip base. Keep both wrists, both palms, and both finger clusters distinct with clean air around the guard. No ammunition, loose magazine, firing, muzzle flash, threat, injury, or combat.

PRESERVE EVERY SUCCESSFUL ELEMENT
Preserve exactly four clearly adult fictional women with anchored identities and Alia's braids; exactly eight human arms and exactly eight human hands, two per woman; ECE's two separated hands on opposite compass handles; the hands-free blue route map; four distinct Mars-expedition couture silhouettes; Radiance's open back and rainbow knee socks; Ellie's white jumpsuit and bare midriff; Alia's strapless open-back shell; ECE's covered black-and-gold suit; the Black Sea, Alphabet Tower, Ferris wheel, palms, skyline, wet flat tiles, and glass rail; one paper target and complete backstop; and exactly one PAWS kitten plus one MAX puppy together in the raised dry padded lounge.
Add sparse individually straight rain streaks only through the open sky and sea so weather roll 35 reads as heavy straight rain without wavy haze. Preserve all other camera, lens, lighting, reflections, geometry, and clean texture unchanged.

SURFACE AND SCOPE GATE
Add no person, limb, hand, finger cluster, animal, prop, decoration, crowd, drink, confetti, text, logo, extra target, or scattered equipment. Add no wavy processing, liquify distortion, marbling, rippled skin, rippled fabric, melted edge, embossed contour, halo, excessive sharpening, bent architecture, bent glass, or painterly texture. Keep one clean coherent photographic exposure.`;

const promptPath = path.join(root, "scene-1551-clean-fresh-round-28-recovery-prompt.txt");
fs.writeFileSync(promptPath, recoveryPrompt, "utf8");
const materializedAt = new Date().toISOString();
const freshAudit = {
  renderSurfaceQuality: "pass-clean-natural-photographic-texture-without-wavy-artifacts",
  identity: "pass-four-adult-identities-with-Alia-braids",
  anatomy: "reject-Radiance-and-Ellie-left-center-owner-paths-hidden-or-misdirected",
  handOwnership: "reject-Radiance-touches-compass-and-Ellie-Radiance-four-hand-inventory-is-not-auditable; ECE-and-Alia-hands-pass",
  weather: "reject-wet-overcast-setting-present-but-heavy-straight-rain-streaks-not-visible",
  locationThemeFusion: "pass-recognizable-Batumi-with-four-distinct-expedition-silhouettes",
  outfitOriginality: "pass-four-distinct-silhouettes-constructions-and-footwear",
  rolledWardrobe: "reject-Alia-active-midriff-band-too-narrow-to-read-clearly; other active wardrobe rolls pass",
  romance: "reject-lean-is-not-a-controlled-dip-and-required-three-contact graph is absent",
  radianceResponse: "reject-Radiance-smiles toward-Ellie-instead-of-sustaining-the-recorded-ECE-eye-line",
  partyActivation: "partial-all-four-willing-smiles-present-but-Alia-invitation-response-continuity-is-not-clear",
  mascots: "pass-one-PAWS-and-one-MAX-together-on-raised-dry-padded-lounge",
  oddProp: "pass-ECE-two-hands-on-opposite-compass-handles-and-hands-free-map",
  routeMap: "pass-separate-hands-free-holographic-map",
  missionHandling: "reject-replica-is-undersized-plastic-toy-like-and-indexed-trigger-finger-with-empty-guard-is-not-auditable",
  missionTargetAxis: "pass-separated-paper-diamond-complete-backstop-and-safe-right-facing-axis",
  accepted: false,
};

checkpoint.status = "active-four-scene-gate-clean-fresh-round-28-recovery-materialized";
checkpoint.checkpointedAt = materializedAt;
checkpoint.terminal = false;
checkpoint.renderAttempts.freshRound28 = {
  ...checkpoint.renderAttempts.freshRound28,
  status: "fresh-completed-rejected-recovery-materialized",
  freshCompletedAt: materializedAt,
  rawOutputs: { 1551: { path: rawPath, sha256: expectedRawSha, preserved: true } },
  freshStrictAudit: freshAudit,
  recoveryDecision: {
    attempted: true,
    reason: "The clean raw passes surface, identities, Batumi, outfit originality, compass, mascots, and target; one bounded correction addresses the exact dip hands, eye lines, rain, Alia midriff, and inert-replica handling.",
    maximumRecoveryPasses: 1,
    recoveryPassNumber: 1,
    sourceRaw: rawPath,
  },
  recoveryPromptAudit: {
    path: path.relative(repo, promptPath).replaceAll("\\", "/"),
    sha256: sha256(recoveryPrompt),
    chars: recoveryPrompt.length,
    sourceMode: "single-targeted-recovery-from-clean-round-28-raw",
    sourceRaw: { path: rawPath, sha256: expectedRawSha },
    priorBatumiRenderInputCount: 1,
    permittedSourceCount: 1,
    recoveryPass: 1,
    maximumRecoveryPasses: 1,
    boundedCorrections: [
      "rebuild only the existing Ellie-Radiance four-hand dip graph with three visible contacts",
      "clarify Radiance-ECE and Alia-Radiance eye lines plus Alia's bare midriff and safe full-size inert replica",
      "add sparse straight rain without global processing",
    ],
    preserveLocks: [
      "four adult identities and exactly eight arms and eight hands",
      "round-28 invitation, explicit yes, all-four participant scope, and consent boundary",
      "ECE two-hand compass ownership and hands-free route map",
      "Batumi, clean photographic surface, mascots, target, and complete backstop",
    ],
    radianceRealtimeAgreementParty: recoveryPartyState,
  },
};
checkpoint.scenePlans["1551"].freshRound28.freshVisualAudit = freshAudit;
checkpoint.scenePlans["1551"].freshRound28.recoveryPrompt = recoveryPrompt;
checkpoint.scenePlans["1551"].freshRound28.recoveryPromptSha256 = sha256(recoveryPrompt);
checkpoint.scenePlans["1551"].freshRound28.recoveryRadianceRealtimeAgreementParty = recoveryPartyState;
checkpoint.rawOutputs.push({
  scene: 1551,
  round: 28,
  kind: "clean-fresh-recovery-pending",
  path: rawPath,
  sourcePath,
  sha256: expectedRawSha,
  dimensions: { width: 941, height: 1672 },
});
checkpoint.renderStrategyReset = {
  ...checkpoint.renderStrategyReset,
  activeCleanRound: 28,
  activeSourcePolicy: "single targeted recovery from clean round 28 raw only",
  priorBatumiRenderInputCount: 1,
};
checkpoint.xPost.note = "Georgia has accepted scenes 1548, 1549, and 1550. Clean round 28 scene 1551 is preserved but rejected; its sole bounded recovery is materialized. Publication remains mandatory after scene 1551 is accepted and the four-scene completion checkpoint is pushed.";
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "launch-single-clean-fresh-round-28-recovery-scene-1551-only",
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
