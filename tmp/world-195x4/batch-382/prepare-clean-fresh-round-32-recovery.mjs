import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const root = path.join(repo, "tmp/world-195x4/batch-382");
const checkpointPath = path.join(repo, "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json");
const contractPath = path.join(repo, "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const ledgerPath = path.join(repo, "assets/lore/starlight-era/world-x-publish-ledger.json");
const rawPath = "tmp/world-195x4/batch-382/raw/clean-fresh-round-32/scene-1551.png";
const sourcePath = "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-052482ec-d472-47f0-8f30-0a6f03c37e93.png";
const expectedRawSha = "8BA958AE36FC789304465592B4E45ED08D8FCF68EC97DFA501673DC1F7E6833D";
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex").toUpperCase();
}

function sha256File(filePath) {
  return sha256(fs.readFileSync(filePath));
}

if (sha256File(contractPath) !== "69EB6C84A2467A4234D901C3086ECECE9E583B55C41BB9382CD5ED523C482EF5") throw new Error("Contract changed during round 32");
if (sha256File(ledgerPath) !== "B94AA3FB2B1AB1BCAB100CE689F0173C77407B82439D73379D8BC0FA3EEC2455") throw new Error("Ledger changed during round 32");
if (sha256File(path.join(repo, rawPath)) !== expectedRawSha) throw new Error("Clean round 32 raw changed");
if (checkpoint.status !== "active-four-scene-gate-clean-fresh-round-32-materialized") throw new Error(`Unexpected status: ${checkpoint.status}`);

const radiancePartyState = checkpoint.renderAttempts.freshRound32.radianceRealtimeAgreementParty;
if (radiancePartyState?.partyActivation !== true || radiancePartyState?.response?.category !== "explicit affirmative") throw new Error("Round 32 affirmative state missing");
if (radiancePartyState.willingParticipants?.join("|") !== "Radiance|Ellie|AI ECE|Alia") throw new Error("Round 32 participant set changed");
const recoveryPartyState = {
  ...radiancePartyState,
  recoveryDecisionContinuity: "This single technical correction remains the same round-32 event. Ellie's invitation, Radiance's explicit yes, all-four willing participant set, one-count limit, and every consent boundary remain unchanged.",
  recoveryEvidenceRequirement: "Preserve Radiance and Ellie's willing smiles and lifted clasp, preserve ECE's willing smile and compass pose, and make only Alia's existing profile visibly answer the shared count.",
};

const recoveryPrompt = `Use case: precise-object-edit.
Input image: the supplied Georgia Batch 382 scene 1551 clean fresh round 32 raw. It is the only visual source.

ONE RECOVERY ONLY
The source is already a clean natural editorial photograph with a successful dip and exact anatomy. Preserve camera, crop, faces, bodies, all eight existing arms and hands, all feet, rain, Batumi landmarks, sea, tiles, reflections, mascots, compass, map, target, backstop, and successful romance contacts. Edit only Radiance's upper-back garment visibility and Alia's existing right-side lane. Do not globally redraw, restyle, sharpen, upscale, relight, liquify, or process the image. Add no limb, hand, finger cluster, person, animal, or object.

LOCK THE SUCCESSFUL AFFIRMATIVE
Preserve the offered choice: ${recoveryPartyState.offeredChoice}
Preserve Radiance's explicit response: ${recoveryPartyState.radianceResponse}
partyActivation = TRUE. Willing participants remain exactly Radiance, Ellie, AI ECE, and Alia. Preserve Radiance and Ellie's smiles, lifted clasp, supported shallow dip, three existing relationship contacts, and ECE's willing smile with both hands on opposite compass handles. The party remains one fully clothed public-safe synchronized count with no added object.

CORRECTION ZONE 1: RADIANCE OPEN-BACK VISIBILITY
Preserve Radiance's identity, face, hair, dip angle, both complete feet, opaque rainbow knee hosiery, two arms, two hands, lifted clasp, open affirmative palm, and all contacts. Turn only her upper torso a few degrees into rear three-quarter without moving her arms or feet. Remove only any cobalt or gold yoke, strap, ring, band, mesh, or hair crossing the upper and middle back so one uninterrupted open-back panel is clearly visible from shoulder blades to the secure high waist. Keep the front, sides, waist, hip, and seat fully opaque and public-safe.

CORRECTION ZONE 2: ALIA PARTY, TAILORING, AND SAFE TRAINING OBJECT
Preserve Alia's identity, braids, full-body placement, exact two arms, exact two hands, planted front foot, safe right-facing upper-body line, target, safety panel, and backstop.
Turn only Alia's chin a few degrees left enough to show a willing profile smile toward the quartet while her eyes and upper-body line remain safely downrange. Lift only her existing rear heel a few centimeters for the synchronized count; keep the toe planted and stance stable.
Remove only the copper horizontal rear band and any lacing crossing her upper or middle back. Keep the copper shell securely fitted at front and sides with an opaque straight upper edge. Remove the separate copper waist band and raise only the shell's lower edge enough to show one continuous four-centimeter runway waist reveal above the cobalt skort. Keep complete front and side coverage.
Replace only the undersized bright object body already in her hands with exactly one full-size approximately 30-centimeter dark polished-steel Desert Eagle-style large-frame inert cinema-training replica in close side profile, occupying at least twenty percent of frame width. Use a restrained heat-anodized rainbow sheen over machined steel, compact short barrel, substantial heavy grip, oversized black oval trigger guard, and a clearly visible small orange safety insert only inside the muzzle opening. It must read as heavy metal, never bright blue plastic or a water toy.
Keep Alia's primary hand on the grip and support palm under the grip base. Straighten her existing primary index finger flat along the steel side plate, clearly above and entirely outside the guard; show the complete guard visibly empty. Keep exactly two wrists, two palms, and two finger clusters. Keep the muzzle aimed only at the paper target and complete backstop. No ammunition, magazine, firing, flash, threat, injury, or combat.

PRESERVE EVERY SUCCESS
Preserve exactly four clearly adult fictional women with anchored identities and Alia's braids; exactly eight human arms and exactly eight human hands, two per woman; the three-contact supported dip; Radiance and ECE's affectionate center; ECE's compass and hands-free blue route map; one PAWS kitten and one MAX puppy together on the raised dry bed; straight rain; Batumi's Black Sea, Alphabet Tower, Ferris wheel, skyline, palms, glass rail, flat wet tiles, and natural reflections; four distinct expedition-couture silhouettes; one paper target; one safety panel; one complete backstop; and all full bodies and footwear.

SURFACE AND SCOPE GATE
No extra person, limb, hand, finger cluster, animal, prop, decoration, crowd, text, logo, target, equipment, or party object. No wavy or marbled processing, liquify distortion, rippled skin or fabric, melted edge, embossed contour, halo, excessive sharpening, painterly texture, bent tower, bent rail, warped tile, or curved rain. Keep one coherent clean photographic exposure.`;

const promptPath = path.join(root, "scene-1551-clean-fresh-round-32-recovery-prompt.txt");
fs.writeFileSync(promptPath, recoveryPrompt, "utf8");
const materializedAt = new Date().toISOString();
const freshAudit = {
  renderSurfaceQuality: "pass-clean-natural-photographic-texture-with-straight-rain-and-no-wavy-artifacts",
  identity: "pass-four-adult-identities-with-Alia-braids",
  anatomy: "pass-exact-eight-arms-eight-hands-with-continuous-owner-paths",
  handOwnership: "pass-two-hands-per-woman-with-clear-clasp-support-compass-and-mission-grips",
  weather: "pass-heavy-straight-rain-and-flat-wet-tiles",
  locationThemeFusion: "pass-recognizable-Batumi-and-four-distinct-expedition-silhouettes",
  outfitOriginality: "pass-four-distinct-silhouettes-constructions-hems-and-footwear",
  rolledWardrobe: "reject-Radiance-open-back-not-visible-and-Alia-rear-bands-obstruct-open-back-and-midriff",
  romance: "pass-controlled-dip-with-lifted-clasp-support-palm-and-visible-shoulder-to-torso-third-contact",
  radianceResponse: "pass-explicit-affirmative-through-nod-smile-lifted-clasp-and-open-invitation-palm",
  partyActivation: "partial-Radiance-Ellie-ECE-read-willing-but-Alia-does-not-visibly-answer-the-all-four-count",
  mascots: "pass-one-PAWS-and-one-MAX-sharing-raised-dry-bed",
  oddProp: "pass-ECE-two-hands-on-opposite-compass-handles",
  routeMap: "pass-separate-hands-free-holographic-map",
  missionHandling: "reject-replica-is-undersized-plastic-reading-orange-insert-missing-and-index-outside-empty-guard-not-auditable",
  missionTargetAxis: "pass-paper-diamond-complete-backstop-safety-panel-and-safe-right-facing-axis",
  accepted: false,
};

checkpoint.status = "active-four-scene-gate-clean-fresh-round-32-recovery-materialized";
checkpoint.checkpointedAt = materializedAt;
checkpoint.terminal = false;
checkpoint.renderAttempts.freshRound32 = {
  ...checkpoint.renderAttempts.freshRound32,
  status: "fresh-completed-rejected-recovery-materialized",
  freshCompletedAt: materializedAt,
  rawOutputs: { 1551: { path: rawPath, sha256: expectedRawSha, preserved: true } },
  freshStrictAudit: freshAudit,
  recoveryDecision: {
    attempted: true,
    reason: "The clean raw passes surface, identities, exact anatomy, all three romance contacts, Batumi, mascots, compass, map, and target. One bounded correction exposes Radiance's active back and fixes only Alia's party evidence, active tailoring, and inert-replica safety read.",
    maximumRecoveryPasses: 1,
    recoveryPassNumber: 1,
    sourceRaw: rawPath,
  },
  recoveryPromptAudit: {
    path: path.relative(repo, promptPath).replaceAll("\\", "/"),
    sha256: sha256(recoveryPrompt),
    chars: recoveryPrompt.length,
    sourceMode: "single-targeted-recovery-from-clean-round-32-raw",
    sourceRaw: { path: rawPath, sha256: expectedRawSha },
    priorBatumiRenderInputCount: 1,
    permittedSourceCount: 1,
    recoveryPass: 1,
    maximumRecoveryPasses: 1,
    boundedCorrections: [
      "expose Radiance's active open-back panel without changing her arms feet contacts or expression",
      "make Alia visibly join the one-count party through only her existing chin and rear heel",
      "remove only Alia's rear bands and replace only the undersized object body with a full-size metallic inert training replica",
    ],
    preserveLocks: [
      "exact eight-arm eight-hand inventory all four identities and three-contact dip",
      "round-32 explicit yes all-four participant set and one-count limit",
      "clean surface Batumi straight rain mascots compass map target safety panel and backstop",
    ],
    radianceRealtimeAgreementParty: recoveryPartyState,
  },
};
checkpoint.scenePlans["1551"].freshRound32.freshVisualAudit = freshAudit;
checkpoint.scenePlans["1551"].freshRound32.recoveryPrompt = recoveryPrompt;
checkpoint.scenePlans["1551"].freshRound32.recoveryPromptSha256 = sha256(recoveryPrompt);
checkpoint.scenePlans["1551"].freshRound32.recoveryRadianceRealtimeAgreementParty = recoveryPartyState;
checkpoint.rawOutputs.push({
  scene: 1551,
  round: 32,
  kind: "clean-fresh-recovery-pending",
  path: rawPath,
  sourcePath,
  sha256: expectedRawSha,
  dimensions: { width: 941, height: 1672 },
});
checkpoint.renderStrategyReset = {
  ...checkpoint.renderStrategyReset,
  activeCleanRound: 32,
  activeSourcePolicy: "single targeted recovery from clean round 32 raw only",
  priorBatumiRenderInputCount: 1,
};
checkpoint.xPost.note = "Georgia has accepted scenes 1548, 1549, and 1550. Clean round 32 scene 1551 is preserved but rejected; its sole bounded recovery is materialized. Publication remains mandatory after scene 1551 is accepted and the four-scene completion checkpoint is pushed.";
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "launch-single-clean-fresh-round-32-recovery-scene-1551-only",
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
