import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const root = path.join(repo, "tmp/world-195x4/batch-382");
const checkpointPath = path.join(repo, "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json");
const contractPath = path.join(repo, "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const ledgerPath = path.join(repo, "assets/lore/starlight-era/world-x-publish-ledger.json");
const rawPath = "tmp/world-195x4/batch-382/raw/clean-fresh-round-38/scene-1551.png";
const sourcePath = "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-711782b1-3c2d-4684-be94-0a9afea15604.png";
const expectedRawSha = "0205A153F478CEC5A9A39067CF9F43B1A5B6F5B606A029AF37E56EF5892D5914";
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex").toUpperCase();
}

function sha256File(filePath) {
  return sha256(fs.readFileSync(filePath));
}

if (sha256File(contractPath) !== "69EB6C84A2467A4234D901C3086ECECE9E583B55C41BB9382CD5ED523C482EF5") throw new Error("Contract changed during round 38");
if (sha256File(ledgerPath) !== "B94AA3FB2B1AB1BCAB100CE689F0173C77407B82439D73379D8BC0FA3EEC2455") throw new Error("Ledger changed during round 38");
if (sha256File(path.join(repo, rawPath)) !== expectedRawSha) throw new Error("Clean round 38 raw changed");
if (checkpoint.status !== "active-four-scene-gate-clean-fresh-round-38-materialized") throw new Error(`Unexpected status: ${checkpoint.status}`);

const radiancePartyState = checkpoint.renderAttempts.freshRound38.radianceRealtimeAgreementParty;
if (radiancePartyState?.partyActivation !== true || radiancePartyState?.response?.category !== "explicit affirmative") throw new Error("Round 38 affirmative missing");
if (radiancePartyState.willingParticipants?.join("|") !== "Radiance|Ellie|AI ECE|Alia") throw new Error("Round 38 participant set changed");

const recoveryPartyState = {
  ...radiancePartyState,
  recoveryDecisionContinuity: "This single correction remains the same round-38 event. ECE's invitation, Radiance's explicit affirmative, partyActivation true, the four willing participants, and every invitation-specific consent boundary remain unchanged.",
  recoveryEvidenceRequirement: "Radiance visibly smiles and tips her face toward ECE in a clear mid-nod while squeezing the existing low clasp. Ellie and ECE visibly smile. Alia visibly smiles in profile while her gaze and both mission hands remain safely downrange.",
};

const recoveryPrompt = `Use case: precise local cleanup of one clean editorial photograph.
Input image: the supplied Georgia Batch 382 scene 1551 clean fresh round 38 raw. It is the only visual source.

ONE PLANNED RECOVERY ONLY
Preserve the exact camera, crop, clean natural photographic surface, exposure, straight rain, flat wet tiles, Batumi skyline, Alphabet Tower, Ferris wheel, Black Sea, palms, four adult identities, all eight existing arms and hands, all four complete bodies and footwear, three existing hand contacts, four garment families, rainbow knee hosiery, compass, holographic route map, safety panel, target lane, puppy, kitten, and dry mascot bed. Do not globally redraw, restyle, relight, sharpen, upscale, liquify, or add decorative detail. Add no person, limb, hand, finger cluster, animal, prop, party object, text, logo, or crowd.

LOCAL CORRECTION 1: MAKE THE STORED AFFIRMATIVE VISIBLE
Preserve the offered choice: ${recoveryPartyState.offeredChoice}
Preserve Radiance's response: ${recoveryPartyState.radianceResponse}
partyActivation = TRUE for exactly Radiance, Ellie, AI ECE, and Alia, limited to this one fully clothed public-safe celebration step.
Keep Radiance as the same blonde adult with the same body, uninterrupted open back, blue outfit, rainbow knee hosiery, exact two arms, and exact two hands. Rotate only her face and eye line slightly right toward ECE, with a broad willing smile and chin visibly tipped in a clear mid-nod. Keep Radiance's existing high palm on Ellie's covered shoulder and her existing low clasp hand exactly where they are; make the clasp read as one visible reciprocal squeeze without adding or duplicating fingers.
Keep Ellie in the same position with one willing smile, her existing middle support palm on Radiance's shoulder blade, and her existing low clasp hand. Keep ECE front-on with one willing smile and sustained warm eye line toward Radiance while both existing hands remain fixed on the two compass handles. Keep Alia in the same strict right-facing profile and give her one clearly visible willing profile smile; her eyes remain rightward downrange and both mission hands remain fixed. No dancing body distortion, heel lift, new gesture, confetti, drink, balloon, sign, or party object.

LOCAL CORRECTION 2: CERTIFY THE EXISTING MISSION HAND
Keep Alia's same right-facing stance, exact two arms, exact two hands, copper front-only strapless shell, continuous bare upper and middle back, cobalt skort, and footwear. Preserve exactly one full-size dark polished-metal large-frame inert cinema-training replica with the existing compact orange muzzle insert. Straighten only Alia's existing right trigger index into one long fully extended finger lying flat on the metal side plate above and entirely outside the complete black oval trigger guard. Show clean air between the straight finger and the guard, and keep the entire guard visibly empty. Her separate support left palm remains under the primary fist and grip base. Do not duplicate a digit, hand, wrist, replica, magazine, or safety insert.

LOCAL CORRECTION 3: COMPLETE THE EXISTING BACKSTOP
Keep the transparent safety panel complete and unchanged. Move the same existing sand backstop slightly left and make it slightly narrower so its complete top, bottom, left edge, and right edge are all visibly inside the frame with rainy margin on all four sides. Keep the single white paper route diamond fixed to it. Place the diamond center on the exact same shoulder-height horizontal row as Alia's dominant eye, barrel center, and orange muzzle center. Keep empty pavement and clean air between muzzle, panel, paper, and backstop. Add no second target, barrier, berm, lane, replica, beam, tracer, laser, cord, or line.

LOCK THE THREE CONTACTS AND EXACT ANATOMY
Preserve exactly three and only three relationship contacts: Radiance's left palm on Ellie's covered right shoulder, Ellie's left support palm on Radiance's near shoulder blade, and their low right-hand clasp below the hips. Keep the four owner arms separately traceable through clear air. ECE touches no person and owns the compass alone with two hands. Alia touches no person and owns the inert replica alone with two hands. Exactly four adult women, eight human arms, and eight human hands, two per woman. No hidden, missing, extra, fused, borrowed, floating, or emerging limb or finger cluster.

PRESERVE EVERY PASS
Preserve four distinct recognizable adult identities and Alia's sculptural braided ponytail; clean artifact-free skin, fabric, architecture, panel edges, tile lines, and straight rain; Radiance and ECE as the affectionate center; Radiance open back; Ellie visible midriff; Alia strapless open-back construction and bare waist; ECE covered waist; opaque public-safe clothing; PAWS as one tiny collarless golden kitten and MAX as one small young golden retriever pup, both without collar, ribbon, harness, leash, neckband, or accessory; four structurally different outfits; recognizable Batumi; separate hands-free route map; all feet and footwear; and one coherent natural photograph.

FINAL SAFETY AND SURFACE GATE
Every person, mascot, landmark, public path, and occupied object remains behind and left of the muzzle plane. Never aim at a person, animal, occupied object, or camera. No ammunition, loose magazine, firing, muzzle flash, threat, injury, combat, or unsafe footing. No wavy or marbled processing, rippled skin or fabric, liquify distortion, melted edge, halo, embossed contour, painterly texture, excessive sharpening, bent tower, warped panel, warped tile, curved rain, or extra atmospheric effect.`;

const promptPath = path.join(root, "scene-1551-clean-fresh-round-38-recovery-prompt.txt");
fs.writeFileSync(promptPath, recoveryPrompt, "utf8");
const materializedAt = new Date().toISOString();
const freshAudit = {
  renderSurfaceQuality: "pass-clean-natural-photographic-texture-with-straight-rain-flat-tiles-and-no-wavy-artifacts",
  identity: "pass-four-clearly-adult-distinct-identities-with-Alia-braids",
  anatomy: "pass-exact-eight-arms-and-eight-hands-with-two-per-woman",
  handOwnership: "pass-three-distinct-relationship-contacts-plus-ECE-compass-and-Alia-mission-owner-paths",
  weather: "pass-heavy-straight-rain-and-flat-wet-tiles",
  locationThemeFusion: "pass-recognizable-Batumi-with-Alphabet-Tower-Ferris-wheel-sea-skyline-and-four-distinct-expedition-silhouettes",
  outfitOriginality: "pass-four-distinct-silhouettes-constructions-hems-materials-and-footwear",
  rolledWardrobe: "pass-Radiance-open-back-Ellie-midriff-Alia-midriff-Alia-strapless-open-back-Radiance-rainbow-hosiery-and-ECE-covered-waist",
  romance: "pass-three-visible-contacts-high-shoulder-palm-middle-support-palm-and-low-clasp",
  radianceResponse: "reject-Radiance-smiles-toward-Ellie-instead-of-visibly-answering-ECE-with-the-stored-nod-and-eye-line",
  partyActivation: "reject-Ellie-and-ECE-read-willing-but-Alia-does-not-visibly-join-the-stored-all-four-celebration",
  mascots: "pass-one-collarless-PAWS-and-one-accessory-free-MAX-sharing-dry-bed",
  oddProp: "pass-ECE-two-hands-on-opposite-compass-handles",
  routeMap: "pass-separate-hands-free-holographic-map",
  missionHandling: "reject-primary-index-is-not-certifiably-fully-straight-above-and-outside-the-empty-guard",
  missionTargetAxis: "reject-right-edge-of-sand-backstop-is-cropped-even-though-panel-and-single-target-are-visible",
  accepted: false,
};

checkpoint.status = "active-four-scene-gate-clean-fresh-round-38-recovery-materialized";
checkpoint.checkpointedAt = materializedAt;
checkpoint.terminal = false;
checkpoint.renderAttempts.freshRound38 = {
  ...checkpoint.renderAttempts.freshRound38,
  status: "fresh-completed-rejected-recovery-materialized",
  freshCompletedAt: materializedAt,
  rawOutputs: { 1551: { path: rawPath, sha256: expectedRawSha, preserved: true } },
  freshStrictAudit: freshAudit,
  recoveryDecision: {
    attempted: true,
    reason: "The fresh raw is clean and passes identity, exact anatomy, three contacts, Batumi, wardrobe, mascots, compass, and route-map gates. One bounded local correction makes the stored all-four affirmative visible, certifies the existing indexed trigger finger, and brings the existing backstop fully inside frame.",
    maximumRecoveryPasses: 1,
    recoveryPassNumber: 1,
    sourceRaw: rawPath,
  },
  recoveryPromptAudit: {
    path: path.relative(repo, promptPath).replaceAll("\\", "/"),
    sha256: sha256(recoveryPrompt),
    chars: recoveryPrompt.length,
    sourceMode: "single-targeted-recovery-from-clean-round-38-raw",
    sourceRaw: { path: rawPath, sha256: expectedRawSha },
    priorBatumiRenderInputCount: 1,
    permittedSourceCount: 1,
    recoveryPass: 1,
    maximumRecoveryPasses: 1,
    boundedCorrections: [
      "turn Radiance's face and eye line toward ECE with the stored willing smile and mid-nod",
      "make Alia's stored willing profile smile visible without moving her mission hands or sight line",
      "straighten Alia's existing trigger index above and outside the complete empty guard",
      "move and narrow the existing sand backstop fully inside frame while preserving exact target axis",
    ],
    preserveLocks: [
      "clean artifact-free photographic surface with no global processing",
      "exact eight arms and hands with the three existing contacts and all owner paths",
      "round-38 explicit affirmative with partyActivation true for exactly all four adults",
      "identities garments Batumi mascots compass map panel full bodies and footwear",
    ],
    radianceRealtimeAgreementParty: recoveryPartyState,
  },
};
checkpoint.scenePlans["1551"].freshRound38.freshVisualAudit = freshAudit;
checkpoint.scenePlans["1551"].freshRound38.recoveryPrompt = recoveryPrompt;
checkpoint.scenePlans["1551"].freshRound38.recoveryPromptSha256 = sha256(recoveryPrompt);
checkpoint.scenePlans["1551"].freshRound38.recoveryRadianceRealtimeAgreementParty = recoveryPartyState;
checkpoint.rawOutputs.push({
  scene: 1551,
  round: 38,
  kind: "clean-fresh-recovery-pending",
  path: rawPath,
  sourcePath,
  sha256: expectedRawSha,
  dimensions: { width: 941, height: 1672 },
});
checkpoint.renderStrategyReset = {
  ...checkpoint.renderStrategyReset,
  activeCleanRound: 38,
  activeSourcePolicy: "single targeted recovery from clean round 38 raw only",
  priorBatumiRenderInputCount: 1,
};
checkpoint.xPost.note = "Georgia has accepted scenes 1548, 1549, and 1550. Clean round 38 scene 1551 is preserved but rejected; its sole bounded recovery is materialized from that clean raw only. The live X webview also requires retry. Publication remains mandatory after scene 1551 is accepted and the four-scene completion checkpoint is pushed.";
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "launch-single-clean-fresh-round-38-recovery-scene-1551-only",
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
