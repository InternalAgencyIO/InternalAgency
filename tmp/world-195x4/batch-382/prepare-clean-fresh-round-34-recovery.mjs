import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const root = path.join(repo, "tmp/world-195x4/batch-382");
const checkpointPath = path.join(repo, "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json");
const contractPath = path.join(repo, "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const ledgerPath = path.join(repo, "assets/lore/starlight-era/world-x-publish-ledger.json");
const rawPath = "tmp/world-195x4/batch-382/raw/clean-fresh-round-34/scene-1551.png";
const sourcePath = "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-fc75e18b-7002-4a06-b460-09a368ba1a3d.png";
const expectedRawSha = "99CCED3F5D32590834327D33913D68E89F9C91E30A378E7ECE2E9D91F43A99AA";
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex").toUpperCase();
}

function sha256File(filePath) {
  return sha256(fs.readFileSync(filePath));
}

if (sha256File(contractPath) !== "69EB6C84A2467A4234D901C3086ECECE9E583B55C41BB9382CD5ED523C482EF5") throw new Error("Contract changed during round 34");
if (sha256File(ledgerPath) !== "B94AA3FB2B1AB1BCAB100CE689F0173C77407B82439D73379D8BC0FA3EEC2455") throw new Error("Ledger changed during round 34");
if (sha256File(path.join(repo, rawPath)) !== expectedRawSha) throw new Error("Clean round 34 raw changed");
if (checkpoint.status !== "active-four-scene-gate-clean-fresh-round-34-materialized") throw new Error(`Unexpected status: ${checkpoint.status}`);

const radiancePartyState = checkpoint.renderAttempts.freshRound34.radianceRealtimeAgreementParty;
if (radiancePartyState?.partyActivation !== false || radiancePartyState?.response?.category !== "explicit redirect") throw new Error("Round 34 redirect missing");
if (radiancePartyState.willingParticipants?.length !== 0) throw new Error("Round 34 willing participant set must be empty");
const recoveryPartyState = {
  ...radiancePartyState,
  recoveryDecisionContinuity: "This single correction remains the same round-34 event. ECE's optional invitation, Radiance's explicit redirect, zero willing participants, partyActivation false, and all consent boundaries remain unchanged.",
  recoveryEvidenceRequirement: "Preserve Radiance's calm closed-mouth redirect and open palm toward the map; preserve ECE's attentive map eye line; add no celebration cue to any character.",
};

const recoveryPrompt = `Use case: precise-object-edit.
Input image: the supplied Georgia Batch 382 scene 1551 clean fresh round 34 raw. It is the only visual source.

ONE RECOVERY ONLY
Preserve this clean natural editorial photograph. Keep camera, crop, faces, bodies, all existing feet, dip angle, visible support palm, broad covered hip-to-thigh brace, rain, Black Sea, Ferris wheel, promenade, tiles, reflections, mascots, compass, map, target, safety panel, and the existing large metal training replica. Edit only the lifted-clasp owner path, Alia's rear garment band, the replica index and guard detail, the cropped backstop, and the missing recognizable Alphabet Tower. Do not globally redraw, restyle, sharpen, upscale, relight, liquify, or process the image. Add no limb, hand, finger cluster, person, animal, or extra object.

LOCK THE EXPLICIT REDIRECT
Preserve the offered choice: ${recoveryPartyState.offeredChoice}
Preserve Radiance's explicit response: ${recoveryPartyState.radianceResponse}
partyActivation = FALSE. Actual willing participants remain none. Preserve Radiance's calm closed-mouth expression and open left palm toward ECE's map. Preserve ECE's attentive map eye line. No character heel-taps, dances, celebrates, or displays a party cue. Add no party object.

CORRECTION ZONE 1: TRACE THE EXISTING LIFTED CLASP
Preserve Ellie and Radiance's adult identities, faces, hair, exact four arms, exact four hands, Ellie's visible support palm and white-sleeved owner path, the hip-to-thigh brace, dip angle, planted feet, and Radiance's separate open redirect palm. Keep the two existing clasp hands at upper left. Reveal Radiance's existing bare right arm as one continuous shoulder, upper arm, elbow, forearm, wrist, and inner clasp hand by shifting that arm a few centimeters to the clean sea side of Ellie's head. It must visibly originate at Radiance's right shoulder and never originate from Ellie. Keep Ellie's separate white-sleeved right arm continuously traceable to the outer clasp hand. Do not create or remove a hand. The exact three contacts remain the lifted clasp, Ellie's support palm on Radiance's open back, and the broad covered hip-to-thigh brace.

CORRECTION ZONE 2: ALIA OPEN BACK AND INDEXED SAFETY
Remove only the copper horizontal rear band and center lacing crossing Alia's middle back. Her strapless copper shell must terminate at both side seams with complete opaque front and side coverage, leaving uninterrupted bare skin from shoulder blades down to the secure cobalt high waistband. Preserve the clear bare waist band, braids, body, shoes, stance, exact two arms, and exact two hands.
Preserve the existing large dark polished-metal rainbow-highlighted replica, orange muzzle insert, short barrel, heavy grip, aim direction, and scale. Move only Alia's existing primary index finger so it lies long and straight on the metal side plate above and entirely outside the oversized black oval trigger guard. Show the complete guard visibly empty. Preserve her separate support palm beneath the grip base, two distinct wrists, two palms, and two finger clusters. The muzzle continues to point only at the paper target.

CORRECTION ZONE 3: COMPLETE BACKSTOP AND BATUMI LANDMARK
Extend only the existing sand backstop inward from the right edge so its full top, bottom, left edge, and right edge are all visible with clean air around it. Keep the single white paper diamond target fixed on its center and keep the existing transparent safety panel between Alia and the backstop. Do not add a second target or barrier.
Replace only the generic narrow spired tower in the upper skyline with Batumi's recognizable Alphabet Tower: a tall cylindrical open lattice carrying a clear helical alphabet-band structure and silver globe crown. Preserve the Ferris wheel, sea horizon, Adjara skyline, palms, rain, scale, and perspective. Add no readable lettering, sign, or logo.

PRESERVE EVERY SUCCESS
Preserve exactly four clearly adult fictional women with anchored identities and Alia's sculptural braids; exactly eight human arms and exactly eight human hands, two per woman; the shallow dip, visible support palm, broad covered hip-to-thigh brace, and Radiance's open redirect palm; Radiance and ECE's affectionate center; partyActivation false; ECE's compass and hands-free map; one PAWS kitten and one MAX puppy together on the raised dry bed; straight rain; Batumi's Black Sea, Ferris wheel, skyline, palms, glass rail, flat wet tiles, and reflections; four distinct couture silhouettes; one target; one safety panel; one complete backstop; and all full bodies and footwear.

SURFACE AND SCOPE GATE
No extra person, limb, hand, finger cluster, animal, prop, decoration, crowd, text, logo, target, equipment, or party object. No wavy or marbled processing, liquify distortion, rippled skin or fabric, melted edge, embossed contour, halo, excessive sharpening, painterly texture, bent tower, bent rail, warped tile, or curved rain. Keep one coherent clean photographic exposure.`;

const promptPath = path.join(root, "scene-1551-clean-fresh-round-34-recovery-prompt.txt");
fs.writeFileSync(promptPath, recoveryPrompt, "utf8");
const materializedAt = new Date().toISOString();
const freshAudit = {
  renderSurfaceQuality: "pass-clean-natural-photographic-texture-with-straight-rain-and-no-wavy-artifacts",
  identity: "pass-four-adult-identities-with-Alia-braids",
  anatomy: "partial-eight-hands-visible-but-Radiance-right-arm-owner-path-to-lifted-clasp-crosses-behind-Ellie-and-is-not-continuously-auditable",
  handOwnership: "reject-lifted-clasp-second-bare-arm-origin-ambiguous; support-compass-map-gesture-and-mission-hands-pass",
  weather: "pass-heavy-straight-rain-and-flat-wet-tiles",
  locationThemeFusion: "partial-Batumi-waterfront-Ferris-wheel-sea-and-skyline-pass-but-recognizable-Alphabet-Tower-is-missing",
  outfitOriginality: "pass-four-distinct-silhouettes-constructions-hems-materials-and-footwear",
  rolledWardrobe: "partial-Radiance-open-back-Ellie-midriff-Alia-midriff-and-Alia-strapless-pass-but-Alia-open-back-retains-a-copper-rear-band",
  romance: "partial-shallow-dip-support-palm-and-broad-covered-hip-brace-pass-but-lifted-clasp-owner-path-is-ambiguous",
  radianceResponse: "pass-explicit-redirect-through-calm-closed-mouth-expression-open-palm-to-map-and-ECE-map-eye-line",
  partyActivation: "pass-false-with-no-party-cue-or-willing-participant",
  mascots: "pass-one-PAWS-and-one-MAX-sharing-raised-dry-bed",
  oddProp: "pass-ECE-two-hands-on-opposite-compass-handles",
  routeMap: "pass-separate-hands-free-holographic-map",
  missionHandling: "partial-large-metal-side-profile-replica-and-orange-insert-pass-but-index-outside-empty-guard-needs-clearer-audit",
  missionTargetAxis: "reject-paper-target-and-safe-rightward-axis-pass-but-sand-backstop-is-cropped-by-right-frame-edge",
  accepted: false,
};

checkpoint.status = "active-four-scene-gate-clean-fresh-round-34-recovery-materialized";
checkpoint.checkpointedAt = materializedAt;
checkpoint.terminal = false;
checkpoint.renderAttempts.freshRound34 = {
  ...checkpoint.renderAttempts.freshRound34,
  status: "fresh-completed-rejected-recovery-materialized",
  freshCompletedAt: materializedAt,
  rawOutputs: { 1551: { path: rawPath, sha256: expectedRawSha, preserved: true } },
  freshStrictAudit: freshAudit,
  recoveryDecision: { attempted: true, reason: "The clean raw passes surface, identities, mascots, compass, map, redirect state, wardrobe diversity, large metal replica, target, and most anatomy. One bounded correction clarifies the clasp owner path, opens Alia's back, exposes indexed safety, completes the backstop, and restores the missing Batumi landmark.", maximumRecoveryPasses: 1, recoveryPassNumber: 1, sourceRaw: rawPath },
  recoveryPromptAudit: {
    path: path.relative(repo, promptPath).replaceAll("\\", "/"),
    sha256: sha256(recoveryPrompt),
    chars: recoveryPrompt.length,
    sourceMode: "single-targeted-recovery-from-clean-round-34-raw",
    sourceRaw: { path: rawPath, sha256: expectedRawSha },
    priorBatumiRenderInputCount: 1,
    permittedSourceCount: 1,
    recoveryPass: 1,
    maximumRecoveryPasses: 1,
    boundedCorrections: ["clarify only Radiance's existing right-arm path to the lifted clasp", "remove only Alia's rear copper band and clarify only her indexed safety", "complete only the existing backstop and replace only the generic skyline spire with Alphabet Tower"],
    preserveLocks: ["exact eight arms and hands with visible Ellie support palm and no added hand", "round-34 explicit redirect with partyActivation false", "clean surface rain mascots compass map target safety panel large replica and full bodies"],
    radianceRealtimeAgreementParty: recoveryPartyState,
  },
};
checkpoint.scenePlans["1551"].freshRound34.freshVisualAudit = freshAudit;
checkpoint.scenePlans["1551"].freshRound34.recoveryPrompt = recoveryPrompt;
checkpoint.scenePlans["1551"].freshRound34.recoveryPromptSha256 = sha256(recoveryPrompt);
checkpoint.scenePlans["1551"].freshRound34.recoveryRadianceRealtimeAgreementParty = recoveryPartyState;
checkpoint.rawOutputs.push({ scene: 1551, round: 34, kind: "clean-fresh-recovery-pending", path: rawPath, sourcePath, sha256: expectedRawSha, dimensions: { width: 941, height: 1672 } });
checkpoint.renderStrategyReset = { ...checkpoint.renderStrategyReset, activeCleanRound: 34, activeSourcePolicy: "single targeted recovery from clean round 34 raw only", priorBatumiRenderInputCount: 1 };
checkpoint.xPost.note = "Georgia has accepted scenes 1548, 1549, and 1550. Clean round 34 scene 1551 is preserved but rejected; its sole bounded recovery is materialized from that clean raw only. Publication remains mandatory after scene 1551 is accepted and the four-scene completion checkpoint is pushed.";
checkpoint.nextWakeAction = { country: "Georgia", batch: 382, action: "launch-single-clean-fresh-round-34-recovery-scene-1551-only", preserveAcceptedSceneNumbers: [1548, 1549, 1550], sceneNumbers: [1551], laterCountryStartAllowed: false };

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ status: checkpoint.status, rawSha256: expectedRawSha, recoveryPromptSha256: sha256(recoveryPrompt), recoveryPromptChars: recoveryPrompt.length, partyActivation: recoveryPartyState.partyActivation, willingParticipants: recoveryPartyState.willingParticipants, nextWakeAction: checkpoint.nextWakeAction }, null, 2));
