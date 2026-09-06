import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const root = path.join(repo, "tmp/world-195x4/batch-382");
const checkpointPath = path.join(repo, "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json");
const contractPath = path.join(repo, "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const ledgerPath = path.join(repo, "assets/lore/starlight-era/world-x-publish-ledger.json");
const rawPath = "tmp/world-195x4/batch-382/raw/clean-fresh-round-26/scene-1551.png";
const sourcePath = "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-4e28d7c5-4d8a-4f10-a8fa-a78a148d06f3.png";
const expectedRawSha = "788A758ED635B73D7041775BE66593150EF6C4BDBFD45F1F2F181E28C82C1EB8";
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex").toUpperCase();
}

function sha256File(filePath) {
  return sha256(fs.readFileSync(filePath));
}

if (sha256File(contractPath) !== "69EB6C84A2467A4234D901C3086ECECE9E583B55C41BB9382CD5ED523C482EF5") {
  throw new Error("Authoritative contract changed during round 26");
}
if (sha256File(ledgerPath) !== "B94AA3FB2B1AB1BCAB100CE689F0173C77407B82439D73379D8BC0FA3EEC2455") {
  throw new Error("X publishing ledger changed during round 26");
}
if (sha256File(path.join(repo, rawPath)) !== expectedRawSha) throw new Error("Clean round 26 raw changed");
if (checkpoint.status !== "active-four-scene-gate-clean-fresh-round-26-materialized") {
  throw new Error(`Unexpected checkpoint status: ${checkpoint.status}`);
}

const radiancePartyState = checkpoint.renderAttempts.freshRound26.radianceRealtimeAgreementParty;
if (radiancePartyState?.partyActivation !== false || radiancePartyState?.response?.category !== "explicit redirect") {
  throw new Error("Round 26 redirect state missing");
}
if (radiancePartyState.willingParticipants?.length !== 0) throw new Error("Round 26 willing participant set must be empty");
const recoveryPartyState = {
  ...radiancePartyState,
  recoveryDecisionContinuity: "This one technical correction remains the same round-26 image event, so the recorded invitation, explicit redirect, partyActivation false, and empty willing-participant set do not change.",
  recoveryEvidenceRequirement: "Radiance must visibly redirect from ECE's optional invitation to ECE's hands-free route map while the required three-contact dip remains stable and no celebration starts.",
};

const recoveryPrompt = `Use case: precise-object-edit.
Input: the supplied Georgia Batch 382 scene 1551 clean fresh round 26 raw.

ONE RECOVERY ONLY
This is the single allowed recovery for clean round 26. Edit only two bounded zones: the Radiance-Ellie left romance group and Alia's right safety lane. Preserve the clean natural photographic surface and every successful element. Do not globally redraw, reinterpret, sharpen, restyle, or process the image. Move existing limbs only; add no limb, hand, finger cluster, person, animal, or prop.

RADIANCE LIVE RESPONSE CONTINUITY
Preserve the offered choice: ${recoveryPartyState.offeredChoice}
Preserve Radiance's explicit response: ${recoveryPartyState.radianceResponse}
partyActivation = FALSE. Willing participants = none. Radiance visibly redirects ECE's optional celebration toward ECE's hands-free route map. No celebration step, party expression, or party object begins. ECE accepts the redirect with her existing remorseful planning expression and keeps both hands on the compass. This response remains limited to this exact invitation and image.

CORRECTION ZONE 1: REAL SHALLOW DIP, THREE CONTACTS, OPEN BACK, AND REDIRECT
Preserve the current two adult identities, faces, hair, legs, complete feet, raised caught clasp, Ellie's existing palm on Radiance's shoulder, and exactly four left-group arms and four left-group hands. Move existing anatomy only and add none.
Deepen Ellie only slightly into a stable outward side dip toward frame-left: her two complete feet remain planted and separated, one knee softly bent, torso leaning about twenty degrees, face fully visible. Keep her raised left hand clasped with Radiance's raised hand. Keep her existing white-sleeved right arm completely visible and its open palm on Radiance's bare near shoulder.
Move Radiance's existing low dangling non-clasp arm, forearm, wrist, and hand upward as one continuous bare-arm owner path outside Ellie's white torso. Place that existing open palm high and flat on Ellie's far upper back as unmistakable support. Nothing hides the shoulder, elbow, forearm, wrist, palm, or fingers. Radiance remains upright on two planted feet. The three and only relationship contacts are: Radiance's upper-back support on Ellie, the complete caught clasp, and Ellie's palm on Radiance's shoulder.
Remove the blue halter loop, blue neck strap, necklace, chain, crossing band, and every fabric or ornament across Radiance's upper back. Preserve the secure opaque cobalt dress front, side panels, high waist, asymmetrical hem, heels, and exactly one pair of opaque rainbow knee socks. Her upper back is uninterrupted bare skin from shoulder blades to the secure high waist.
Turn Radiance's face and shoulders clearly away from ECE's inviting expression and toward the small blue holographic route map. Give her a calm closed mouth, gently decisive brows, and a visibly redirected planning eye line. Keep the dip stable and do not add a gesture or hand.

CORRECTION ZONE 2: ALIA ROLLS, INDEXED FINGER, AND COMPLETE BACKSTOP
Preserve Alia's adult identity, sculptural braided ponytail, exact two arms, exact two hands, legs, feet, copper-and-cobalt silhouette, full-size metallic rainbow inert training replica, safe right-facing muzzle axis, glass rail, and one existing paper diamond.
Turn only Alia's upper torso a few degrees farther into rear three-quarter view while retaining her right-facing profile and safe two-hand stance. Remove the neck ring, necklace, cord, collar, halter, shoulder strap, back band, crossing band, and every element across her bare upper back. Keep a rigid opaque strapless copper front-and-side corsage with its top edge below completely bare collarbones and shoulders, wide secure side wings that end at her flanks, uninterrupted bare upper back down to the high secure waist, and one clearly visible restrained three-centimeter bare midriff band above the cobalt pleated skort. No transparent area or undergarment.
Keep the existing realistic full-size heavy polished-metal rainbow-gradient Desert Eagle-style inert cinema-training replica, compact barrel, orange muzzle plug, one grip, and one oversized black oval trigger guard. Refine only Alia's existing primary right hand so her right trigger index is one long straight finger lying flat along the metallic side plate above and entirely outside the guard. The whole black oval trigger guard remains visibly empty. Her existing support left palm cups only the lower front of the primary fist and grip base. Keep the two wrists, palms, and finger clusters distinct, with clean air around the guard.
Shift the existing target slab slightly left into frame without changing its distance or axis. Show the entire tall thick sand backstop from all four edges, with the one white paper and one black non-humanoid diamond centered at shoulder height and separated in image space from the muzzle. Keep one complete transparent safety panel and empty pavement between muzzle and backstop. Do not create a second target.

PRESERVE EVERY SUCCESSFUL ELEMENT
Preserve exactly four clearly adult fictional women with anchored identities and Alia's braids; exactly eight human arms and exactly eight human hands, two per woman; ECE's two separated hands on opposite compass handles; the hands-free blue route map; Batumi's Black Sea, skyline, Alphabet Tower, Ferris wheel, palms, straight heavy rain, flat wet tiles, and glass rail; four distinct Mars-expedition couture silhouettes; and exactly one PAWS kitten plus one MAX puppy together inside the raised dry padded lounge.
Preserve all other body anatomy, wardrobe, camera, lens, lighting, landmarks, compass, map, animals, lounge, reflections, and safe downrange geometry unchanged.

SURFACE AND SCOPE GATE
Add no person, limb, hand, finger cluster, animal, prop, decoration, crowd, drink, confetti, text, logo, extra target, or scattered equipment. Add no wavy processing, liquify distortion, marbling, rippled skin, rippled fabric, melted edge, embossed contour, halo, excessive sharpening, bent architecture, bent glass, or painterly texture. Keep one clean coherent photographic exposure.`;

const promptPath = path.join(root, "scene-1551-clean-fresh-round-26-recovery-prompt.txt");
fs.writeFileSync(promptPath, recoveryPrompt, "utf8");
const materializedAt = new Date().toISOString();
const freshAudit = {
  renderSurfaceQuality: "pass-clean-natural-photographic-texture-without-wavy-artifacts",
  identity: "pass-four-adult-identities-with-Alia-braids",
  anatomy: "pass-exactly-eight-arms-and-eight-hands-with-visible-owner-paths",
  handOwnership: "pass-two-hands-per-woman-and-no-extra-or-fused-cluster",
  weather: "pass-heavy-straight-rain",
  locationThemeFusion: "pass-recognizable-Batumi-with-four-distinct-futurist-expedition-silhouettes",
  outfitOriginality: "pass-four-distinct-silhouettes-constructions-and-footwear",
  rolledWardrobe: "reject-Radiance-blue-halter-crosses-active-open-back-and-Alia-open-back-midriff-read-needs-clarification",
  romance: "reject-no-supported-back-and-only-two-clear-relationship-contacts-so-the-required-dip-is-not-first-read",
  radianceResponse: "reject-mapward-eye-line-is-suggested-but-explicit-round-26-redirect-is-not-readable",
  partyActivation: "pass-no-party-or-celebration-starts",
  mascots: "pass-one-PAWS-and-one-MAX-together-on-raised-dry-padded-lounge",
  oddProp: "pass-ECE-two-hands-on-opposite-compass-handles",
  routeMap: "pass-separate-hands-free-holographic-map",
  missionHandling: "reject-trigger-index-and-empty-guard-need-auditable-clarity",
  missionTargetAxis: "reject-target-axis-is-safe-but-complete-backstop-is-cropped-at-right-frame-edge",
  accepted: false,
};

checkpoint.status = "active-four-scene-gate-clean-fresh-round-26-recovery-materialized";
checkpoint.checkpointedAt = materializedAt;
checkpoint.terminal = false;
checkpoint.renderAttempts.freshRound26 = {
  ...checkpoint.renderAttempts.freshRound26,
  status: "fresh-completed-rejected-recovery-materialized",
  freshCompletedAt: materializedAt,
  rawOutputs: { 1551: { path: rawPath, sha256: expectedRawSha, preserved: true } },
  freshStrictAudit: freshAudit,
  recoveryDecision: {
    attempted: true,
    reason: "The clean raw passes surface, cast, exact limb count, identity, compass, mascots, and safe aim; only the left romance/redirect zone and right wardrobe/safety audit zone need correction.",
    maximumRecoveryPasses: 1,
    recoveryPassNumber: 1,
    sourceRaw: rawPath,
  },
  recoveryPromptAudit: {
    path: path.relative(repo, promptPath).replaceAll("\\", "/"),
    sha256: sha256(recoveryPrompt),
    chars: recoveryPrompt.length,
    sourceMode: "single-targeted-recovery-from-clean-round-26-raw",
    sourceRaw: { path: rawPath, sha256: expectedRawSha },
    priorBatumiRenderInputCount: 1,
    permittedSourceCount: 1,
    recoveryPass: 1,
    maximumRecoveryPasses: 1,
    boundedCorrections: [
      "move Radiance's existing free arm into visible upper-back support, clarify the shallow dip and explicit redirect, and clear her active open back",
      "clarify Alia's active strapless open-back midriff construction, indexed trigger finger, empty guard, and complete uncropped backstop",
    ],
    preserveLocks: [
      "four adult identities and exactly eight arms and eight hands",
      "ECE two-hand compass ownership and hands-free route map",
      "Batumi landmarks, heavy straight rain, clean photographic surface, and four distinct outfits",
      "one PAWS and one MAX on the dry lounge",
      "round-26 explicit redirect, partyActivation false, and no willing participants",
    ],
    radianceRealtimeAgreementParty: recoveryPartyState,
  },
};
checkpoint.scenePlans["1551"].freshRound26.freshVisualAudit = freshAudit;
checkpoint.scenePlans["1551"].freshRound26.recoveryPrompt = recoveryPrompt;
checkpoint.scenePlans["1551"].freshRound26.recoveryPromptSha256 = sha256(recoveryPrompt);
checkpoint.scenePlans["1551"].freshRound26.recoveryRadianceRealtimeAgreementParty = recoveryPartyState;
checkpoint.rawOutputs.push({
  scene: 1551,
  round: 26,
  kind: "clean-fresh-recovery-pending",
  path: rawPath,
  sourcePath,
  sha256: expectedRawSha,
  dimensions: { width: 941, height: 1672 },
});
checkpoint.renderStrategyReset = {
  ...checkpoint.renderStrategyReset,
  activeCleanRound: 26,
  activeSourcePolicy: "single targeted recovery from clean round 26 raw only",
  priorBatumiRenderInputCount: 1,
};
checkpoint.xPost.note = "Georgia has accepted scenes 1548, 1549, and 1550. Clean round 26 scene 1551 is preserved but rejected; its sole bounded recovery is materialized. Publication remains mandatory after scene 1551 is accepted and the four-scene completion checkpoint is pushed.";
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "launch-single-clean-fresh-round-26-recovery-scene-1551-only",
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
