import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const root = path.join(repo, "tmp/world-195x4/batch-382");
const checkpointPath = path.join(repo, "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json");
const contractPath = path.join(repo, "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const ledgerPath = path.join(repo, "assets/lore/starlight-era/world-x-publish-ledger.json");
const rawPath = "tmp/world-195x4/batch-382/raw/clean-fresh-round-36/scene-1551.png";
const sourcePath = "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-4faae566-65bd-4481-8c2f-a8036fdf1363.png";
const expectedRawSha = "B33E63066998CE3B3BD722C6F9F742E81AEB43F0B17A1AC959153CAA7E059035";
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex").toUpperCase();
}

function sha256File(filePath) {
  return sha256(fs.readFileSync(filePath));
}

if (sha256File(contractPath) !== "69EB6C84A2467A4234D901C3086ECECE9E583B55C41BB9382CD5ED523C482EF5") throw new Error("Contract changed during round 36");
if (sha256File(ledgerPath) !== "B94AA3FB2B1AB1BCAB100CE689F0173C77407B82439D73379D8BC0FA3EEC2455") throw new Error("Ledger changed during round 36");
if (sha256File(path.join(repo, rawPath)) !== expectedRawSha) throw new Error("Clean round 36 raw changed");
if (checkpoint.status !== "active-four-scene-gate-clean-fresh-round-36-materialized") throw new Error(`Unexpected status: ${checkpoint.status}`);

const radiancePartyState = checkpoint.renderAttempts.freshRound36.radianceRealtimeAgreementParty;
if (radiancePartyState?.partyActivation !== true || radiancePartyState?.response?.category !== "explicit affirmative") throw new Error("Round 36 affirmative missing");
if (radiancePartyState.willingParticipants?.join("|") !== "Radiance|AI ECE|Alia") throw new Error("Round 36 participant set changed");
const recoveryPartyState = {
  ...radiancePartyState,
  recoveryDecisionContinuity: "This correction remains the same round-36 event. Ellie's invitation, Radiance's explicit yes, the Radiance-ECE-Alia participant set, Ellie's nonparticipation, one-count limit, and every consent boundary remain unchanged.",
  recoveryEvidenceRequirement: "Preserve Radiance and ECE's existing willing smiles and eye line; make Alia's existing right-facing profile show one small closed-mouth willing smile while she keeps both mission hands and her downrange sight line. Ellie stays calm and does not join.",
};

const recoveryPrompt = `Use case: precise-object-edit.
Input image: the supplied Georgia Batch 382 scene 1551 clean fresh round 36 raw. It is the only visual source.

ONE LOCAL RECOVERY ONLY
Preserve this clean natural editorial photograph. Keep the exact camera height, crop, exposure, four adult identities, bodies, eight existing arms, eight existing hands, all feet, existing low clasp, existing support palm, open willing palm, compass grips, mission grips, clean rain, Batumi landmarks, sea, tiles, reflections, mascots, compass, map, glass safety panel, target, and garments. Make only the five tiny corrections listed below. Do not globally redraw, restyle, sharpen, upscale, relight, liquify, or process the photograph. Add no person, limb, hand, finger cluster, animal, prop, or decoration.

LOCK CONSENT AND PARTICIPANTS
Preserve the offered choice: ${recoveryPartyState.offeredChoice}
Preserve Radiance's explicit response: ${recoveryPartyState.radianceResponse}
partyActivation = TRUE. Willing participants remain exactly Radiance, AI ECE, and Alia. Ellie remains the willing dip support but is not a party participant. Preserve Radiance's broad willing smile and open left palm toward ECE and Alia. Preserve ECE's willing smile toward Radiance while both hands remain on the compass. Give Alia one small unmistakable closed-mouth willing profile smile while her eyes and both hands remain safely downrange. Ellie remains calm and does not smile, nod, heel-tap, dance, or join. Add no party object.

CORRECTION ZONE 1: THIRD RELATIONSHIP CONTACT
Preserve Ellie and Radiance's existing low hand clasp and Ellie's existing open support palm on Radiance's near shoulder blade. Preserve each complete shoulder-to-finger owner path and every existing finger. Shift Radiance's complete body only a few centimeters left as one rigid photographic subject, without changing her pose, anatomy, open back, outfit, feet, or hands, until her bare near-left shoulder makes one broad, obvious, physically plausible contact against Ellie's white-sleeved right upper arm. Keep Ellie's body fixed. The three and only three relationship contacts must then read clearly: the existing low clasp, the existing support palm, and this shoulder-to-white-sleeve contact. Do not merge torsos, overlap faces, hide an arm, create a new touch, or add a hand.

CORRECTION ZONE 2: COMPLETE EXISTING BACKSTOP
Preserve the single white paper route target, its black non-humanoid diamond, its shoulder-height alignment, and the empty pavement lane. Move and slightly narrow only the existing thick sand backstop at far right so its complete top, bottom, left edge, and right edge are all visible inside the photograph. Leave a clear vertical strip of rainy sea-and-sky background beyond its right edge. Keep the paper centered on that same backstop. Do not add a second target, barrier, berm, sign, or object.

CORRECTION ZONE 3: INDEXED INERT-REPLICA SAFETY
Preserve Alia's exact two arms, two hands, wrists, stance, body, braids, mission replica, orange muzzle insert, safe rightward aim, target axis, and separate support palm. Move only her existing primary trigger index. Make that same index one long straight finger lying flat along the metallic side plate above and entirely outside the black oval trigger guard. Show clean air between the straight index and the guard, and keep the complete guard visibly empty. Do not add, remove, fuse, or duplicate any finger or hand.

CORRECTION ZONE 4: ALIA OPEN-BACK CLEANUP
Remove only the thin copper-red cord or necklace currently circling Alia's neck. Preserve her sculptural braids, earrings, strapless copper front-and-side shell, large uninterrupted bare upper and middle back, bare waist band, cobalt skort, and footwear. Add no replacement collar, strap, chain, band, fabric, mesh, or rear panel.

CORRECTION ZONE 5: ALIA AGREEMENT EVIDENCE
Change only Alia's existing mouth corners into a small unmistakable closed-mouth willing profile smile. Preserve her adult face, identity, nose, eyes, braids, head angle, and disciplined downrange gaze. Do not turn her head, change her identity, or alter her stance or hands.

PRESERVE EVERY SUCCESS
Preserve exactly four clearly adult fictional women with anchored identities and Alia's sculptural braided ponytail; exactly eight human arms and exactly eight human hands, two per woman; the low clasp and both complete owner paths; Ellie's visible support palm and full owner arm; Radiance's large uninterrupted fully open back; Alia's strapless silhouette, bare waist, and uninterrupted open back; Radiance and ECE's affectionate eye line; partyActivation true only for Radiance, ECE, and Alia with Ellie visibly excluded; ECE's two compass hands and separate hands-free map; one PAWS kitten and one MAX puppy together on the raised dry bed; straight rain; Batumi's Black Sea, recognizable Alphabet Tower, Ferris wheel, skyline, palms, glass rail, flat wet tiles, and reflections; four distinct couture silhouettes; one inert replica; one target; one safety panel; one complete backstop; and all full bodies and footwear.

SURFACE AND SCOPE GATE
No extra person, limb, hand, finger cluster, animal, prop, decoration, crowd, text, logo, target, equipment, or party object. No wavy or marbled processing, liquify distortion, rippled skin or fabric, melted edge, embossed contour, halo, excessive sharpening, painterly texture, bent tower, bent rail, warped tile, or curved rain. Keep one coherent clean photographic exposure.`;

const promptPath = path.join(root, "scene-1551-clean-fresh-round-36-recovery-prompt.txt");
fs.writeFileSync(promptPath, recoveryPrompt, "utf8");
const materializedAt = new Date().toISOString();
const freshAudit = {
  renderSurfaceQuality: "pass-clean-natural-photographic-texture-with-straight-rain-flat-tiles-and-no-wavy-artifacts",
  identity: "pass-four-clearly-adult-identities-with-Alia-braids",
  anatomy: "pass-exact-eight-arms-and-eight-hands-with-continuous-owner-paths",
  handOwnership: "pass-two-hands-per-woman-with-clear-clasp-support-open-palm-compass-and-mission-owner-paths",
  weather: "pass-heavy-straight-rain-and-flat-wet-tiles",
  locationThemeFusion: "pass-recognizable-Batumi-with-Alphabet-Tower-Ferris-wheel-sea-skyline-and-four-distinct-expedition-silhouettes",
  outfitOriginality: "pass-four-distinct-silhouettes-constructions-hems-materials-and-footwear",
  rolledWardrobe: "pass-Radiance-open-back-Ellie-midriff-Alia-midriff-Alia-strapless-and-Alia-open-back; remove-stray-neck-cord-for-crisper-Alia-open-back-read",
  romance: "reject-low-clasp-and-support-palm-pass-but-required-third-shoulder-to-upper-arm-contact-is-separated-by-visible-air",
  radianceResponse: "pass-Radiance-willing-smile-open-palm-and-ECE-eye-line",
  partyActivation: "reject-Radiance-and-ECE-read-willing-but-Alia-participant-response-is-too-neutral-to-certify",
  mascots: "pass-one-PAWS-and-one-MAX-sharing-raised-dry-bed",
  oddProp: "pass-ECE-two-hands-on-opposite-compass-handles",
  routeMap: "pass-separate-hands-free-holographic-map",
  missionHandling: "reject-large-metal-replica-and-orange-insert-pass-but-primary-index-outside-empty-guard-is-not-crisp-enough-to-certify",
  missionTargetAxis: "reject-paper-target-safe-rightward-axis-and-safety-panel-pass-but-sand-backstop-is cropped by right frame edge",
  accepted: false,
};

checkpoint.status = "active-four-scene-gate-clean-fresh-round-36-recovery-materialized";
checkpoint.checkpointedAt = materializedAt;
checkpoint.terminal = false;
checkpoint.renderAttempts.freshRound36 = {
  ...checkpoint.renderAttempts.freshRound36,
  status: "fresh-completed-rejected-recovery-materialized",
  freshCompletedAt: materializedAt,
  rawOutputs: { 1551: { path: rawPath, sha256: expectedRawSha, preserved: true } },
  freshStrictAudit: freshAudit,
  recoveryDecision: {
    attempted: true,
    reason: "The clean raw passes surface, identities, exact eight-hand anatomy, open backs, Batumi, wardrobe rolls, mascots, compass, map, and target axis. One bounded correction closes the missing third contact, brings the existing backstop fully inside frame, clarifies the indexed trigger, removes Alia's stray neck cord, and makes Alia's scoped agreement visible.",
    maximumRecoveryPasses: 1,
    recoveryPassNumber: 1,
    sourceRaw: rawPath,
  },
  recoveryPromptAudit: {
    path: path.relative(repo, promptPath).replaceAll("\\", "/"),
    sha256: sha256(recoveryPrompt),
    chars: recoveryPrompt.length,
    sourceMode: "single-targeted-recovery-from-clean-round-36-raw",
    sourceRaw: { path: rawPath, sha256: expectedRawSha },
    priorBatumiRenderInputCount: 1,
    permittedSourceCount: 1,
    recoveryPass: 1,
    maximumRecoveryPasses: 1,
    boundedCorrections: [
      "shift Radiance a few centimeters left for the third shoulder-to-white-sleeve contact",
      "move and slightly narrow the existing backstop fully inside frame",
      "straighten Alia's existing trigger index above and outside the empty guard",
      "remove Alia's thin neck cord",
      "make Alia's existing profile show one small closed-mouth willing smile",
    ],
    preserveLocks: [
      "clean artifact-free photographic surface",
      "exact eight arms and hands with all owner paths",
      "round-36 Radiance-ECE-Alia party with Ellie excluded",
      "identities wardrobe Batumi mascots compass map safety panel target and full bodies",
    ],
    radianceRealtimeAgreementParty: recoveryPartyState,
  },
};
checkpoint.scenePlans["1551"].freshRound36.freshVisualAudit = freshAudit;
checkpoint.scenePlans["1551"].freshRound36.recoveryPrompt = recoveryPrompt;
checkpoint.scenePlans["1551"].freshRound36.recoveryPromptSha256 = sha256(recoveryPrompt);
checkpoint.scenePlans["1551"].freshRound36.recoveryRadianceRealtimeAgreementParty = recoveryPartyState;
checkpoint.rawOutputs.push({
  scene: 1551,
  round: 36,
  kind: "clean-fresh-recovery-pending",
  path: rawPath,
  sourcePath,
  sha256: expectedRawSha,
  dimensions: { width: 941, height: 1672 },
});
checkpoint.renderStrategyReset = {
  ...checkpoint.renderStrategyReset,
  activeCleanRound: 36,
  activeSourcePolicy: "single targeted recovery from clean round 36 raw only",
  priorBatumiRenderInputCount: 1,
};
checkpoint.xPost.note = "Georgia has accepted scenes 1548, 1549, and 1550. Clean round 36 scene 1551 is preserved but rejected; its sole bounded recovery is materialized from that clean raw only. Publication remains mandatory after scene 1551 is accepted and the four-scene completion checkpoint is pushed.";
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "launch-single-clean-fresh-round-36-recovery-scene-1551-only",
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
