import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const root = path.join(repo, "tmp/world-195x4/batch-382");
const checkpointPath = path.join(repo, "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json");
const contractPath = path.join(repo, "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const ledgerPath = path.join(repo, "assets/lore/starlight-era/world-x-publish-ledger.json");
const rawPath = "tmp/world-195x4/batch-382/raw/clean-fresh-round-33/scene-1551.png";
const sourcePath = "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-f0b994a8-4848-4037-a492-1cba4679f33b.png";
const expectedRawSha = "6302AD462F216EDD022224E8F82A946292CB95BE034AFA2CFFE6CF8A7F25ED76";
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex").toUpperCase();
}

function sha256File(filePath) {
  return sha256(fs.readFileSync(filePath));
}

if (sha256File(contractPath) !== "69EB6C84A2467A4234D901C3086ECECE9E583B55C41BB9382CD5ED523C482EF5") throw new Error("Contract changed during round 33");
if (sha256File(ledgerPath) !== "B94AA3FB2B1AB1BCAB100CE689F0173C77407B82439D73379D8BC0FA3EEC2455") throw new Error("Ledger changed during round 33");
if (sha256File(path.join(repo, rawPath)) !== expectedRawSha) throw new Error("Clean round 33 raw changed");
if (checkpoint.status !== "active-four-scene-gate-clean-fresh-round-33-materialized") throw new Error(`Unexpected status: ${checkpoint.status}`);

const radiancePartyState = checkpoint.renderAttempts.freshRound33.radianceRealtimeAgreementParty;
if (radiancePartyState?.partyActivation !== true || radiancePartyState?.response?.category !== "explicit affirmative") throw new Error("Round 33 affirmative missing");
if (radiancePartyState.willingParticipants?.join("|") !== "Radiance|AI ECE|Alia") throw new Error("Round 33 participant set changed");
const recoveryPartyState = {
  ...radiancePartyState,
  recoveryDecisionContinuity: "This single correction remains the same round-33 event. Alia's invitation, Radiance's explicit yes, Radiance-ECE-Alia participant set, Ellie's nonparticipation, one-count limit, and all consent boundaries remain unchanged.",
  recoveryEvidenceRequirement: "Preserve Radiance's willing smile and open palm, keep Ellie calmly supportive, and make only ECE and Alia visibly answer the agreed count.",
};

const recoveryPrompt = `Use case: precise-object-edit.
Input image: the supplied Georgia Batch 382 scene 1551 clean fresh round 33 raw. It is the only visual source.

ONE RECOVERY ONLY
Preserve this clean natural editorial photograph. Keep camera, crop, faces, bodies, all eight existing arms and hands, all feet, clasp, visible support palm, rain, Batumi landmarks, sea, tiles, reflections, mascots, compass, map, target, safety panel, and backstop. Edit only the small body-brace gap, two garment-back bands, ECE and Alia's party evidence, and the existing training-object body. Do not globally redraw, restyle, sharpen, upscale, relight, liquify, or process the image. Add no limb, hand, finger cluster, person, animal, or extra object.

LOCK CONSENT AND PARTICIPANTS
Preserve the offered choice: ${recoveryPartyState.offeredChoice}
Preserve Radiance's explicit response: ${recoveryPartyState.radianceResponse}
partyActivation = TRUE. Willing participants remain exactly Radiance, AI ECE, and Alia. Ellie remains calm and supportive but does not join. Preserve Radiance's broad willing smile and open affirmative palm. Add no party object.

CORRECTION ZONE 1: CLOSE THE EXISTING THIRD CONTACT
Preserve Ellie and Radiance's adult identities, faces, hair, exact four arms, exact four hands, lifted clasp, Ellie's fully visible support palm and white-sleeved owner path, dip angle, planted feet, and open affirmative palm. Shift only Radiance's already-covered left shoulder and side torso a few centimeters left until they visibly rest against Ellie's white-covered front torso. Keep the other two contacts unchanged. The three and only three contacts are the lifted clasp, Ellie's visible support palm on Radiance's back, and this covered shoulder-to-covered-torso brace. No hand or limb may disappear, duplicate, fuse, or change owner.

CORRECTION ZONE 2: OPEN-BACK TAILORING
Radiance: remove only the thin blue or gold strap and any ring, band, mesh, or hair crossing her already-visible upper and middle back. Keep the cobalt dress securely anchored at the high waist with complete opaque front, side, hip, and seat coverage. Preserve her pose, face, arms, hands, and rainbow hosiery.
Alia: remove only the copper horizontal rear band and black lacing crossing her upper or middle back. Keep her strapless copper shell securely fitted at front and sides with complete opaque coverage. Preserve the already-clear four-centimeter waist reveal above the cobalt skort, her braids, body, footwear, two arms, two hands, and safe stance.

CORRECTION ZONE 3: PARTY EVIDENCE AND AUDITABLE INERT TRAINING REPLICA
ECE: turn only her eyes and smile warmly toward Radiance and lift one existing heel a few centimeters while both hands stay on opposite compass handles. Ellie remains unsmiling and does not heel-tap.
Alia: turn only her chin a few degrees left to show a willing profile smile toward Radiance and lift only her rear heel a few centimeters, toe still planted, while her eyes and upper-body line remain safely downrange.
Replace only the undersized bright object body in Alia's existing hands with exactly one full-size approximately 30-centimeter dark polished-steel Desert Eagle-style large-frame inert cinema-training replica in close side profile, occupying at least twenty percent of frame width. Give it restrained heat-anodized rainbow highlights over machined steel, a compact short barrel, substantial heavy grip, oversized black oval trigger guard, and a clearly visible small orange safety insert only inside the muzzle opening. It must read as heavy metal, never bright plastic or a water toy.
Keep Alia's primary hand on the grip and support palm under the grip base. Straighten her existing primary index finger flat along the side plate, clearly above and entirely outside the guard; show the complete guard visibly empty. Keep exactly two wrists, two palms, and two finger clusters. Keep the muzzle aimed only at the paper target and complete backstop. No ammunition, magazine, firing, flash, threat, injury, or combat.

PRESERVE EVERY SUCCESS
Preserve exactly four clearly adult fictional women with anchored identities and Alia's braids; exactly eight human arms and exactly eight human hands, two per woman; the dip, clasp, and visible support palm; Radiance and ECE's affectionate center; Ellie excluded from the optional party; ECE's compass and hands-free map; one PAWS kitten and one MAX puppy on the raised dry bed; straight rain; Batumi's Black Sea, Alphabet Tower, Ferris wheel, skyline, palms, glass rail, flat wet tiles, and reflections; distinct couture; one target; one safety panel; one complete backstop; and all full bodies and footwear.

SURFACE AND SCOPE GATE
No extra person, limb, hand, finger cluster, animal, prop, decoration, crowd, text, logo, target, equipment, or party object. No wavy or marbled processing, liquify distortion, rippled skin or fabric, melted edge, embossed contour, halo, excessive sharpening, painterly texture, bent tower, bent rail, warped tile, or curved rain. Keep one coherent clean photographic exposure.`;

const promptPath = path.join(root, "scene-1551-clean-fresh-round-33-recovery-prompt.txt");
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
  rolledWardrobe: "partial-active-midriff-and-strapless-rolls-pass-but-Radiance-and-Alia-open-backs-remain-interrupted-by-bands",
  romance: "partial-dip-clasp-and-support-palm-pass-but-covered-shoulder-third-contact-is-not-unmistakably-closed",
  radianceResponse: "pass-explicit-affirmative-through-smile-nod-and-open-palm",
  partyActivation: "reject-Radiance-reads-willing-but-ECE-and-Alia-do-not-visibly-answer-the-Radiance-ECE-Alia-count",
  mascots: "pass-one-PAWS-and-one-MAX-sharing-raised-dry-bed",
  oddProp: "pass-ECE-two-hands-on-opposite-compass-handles",
  routeMap: "pass-separate-hands-free-holographic-map",
  missionHandling: "reject-replica-undersized-plastic-reading-orange-insert-missing-and-index-outside-empty-guard-not-auditable",
  missionTargetAxis: "pass-paper-diamond-complete-backstop-safety-panel-and-safe-right-facing-axis",
  accepted: false,
};

checkpoint.status = "active-four-scene-gate-clean-fresh-round-33-recovery-materialized";
checkpoint.checkpointedAt = materializedAt;
checkpoint.terminal = false;
checkpoint.renderAttempts.freshRound33 = {
  ...checkpoint.renderAttempts.freshRound33,
  status: "fresh-completed-rejected-recovery-materialized",
  freshCompletedAt: materializedAt,
  rawOutputs: { 1551: { path: rawPath, sha256: expectedRawSha, preserved: true } },
  freshStrictAudit: freshAudit,
  recoveryDecision: { attempted: true, reason: "The clean raw passes surface, identities, exact anatomy, dip, Batumi, mascots, compass, map, target, and active waist reveals. One bounded correction closes the third contact and fixes only open-back bands, scoped party evidence, and inert-replica safety.", maximumRecoveryPasses: 1, recoveryPassNumber: 1, sourceRaw: rawPath },
  recoveryPromptAudit: {
    path: path.relative(repo, promptPath).replaceAll("\\", "/"),
    sha256: sha256(recoveryPrompt),
    chars: recoveryPrompt.length,
    sourceMode: "single-targeted-recovery-from-clean-round-33-raw",
    sourceRaw: { path: rawPath, sha256: expectedRawSha },
    priorBatumiRenderInputCount: 1,
    permittedSourceCount: 1,
    recoveryPass: 1,
    maximumRecoveryPasses: 1,
    boundedCorrections: ["close only the existing covered shoulder-to-torso brace", "remove only Radiance and Alia back bands", "make only ECE and Alia visibly join and replace only the undersized training-object body"],
    preserveLocks: ["exact eight arms and hands with visible Ellie support palm", "round-33 Radiance-ECE-Alia party with Ellie excluded", "clean surface Batumi rain mascots compass map target safety panel and backstop"],
    radianceRealtimeAgreementParty: recoveryPartyState,
  },
};
checkpoint.scenePlans["1551"].freshRound33.freshVisualAudit = freshAudit;
checkpoint.scenePlans["1551"].freshRound33.recoveryPrompt = recoveryPrompt;
checkpoint.scenePlans["1551"].freshRound33.recoveryPromptSha256 = sha256(recoveryPrompt);
checkpoint.scenePlans["1551"].freshRound33.recoveryRadianceRealtimeAgreementParty = recoveryPartyState;
checkpoint.rawOutputs.push({ scene: 1551, round: 33, kind: "clean-fresh-recovery-pending", path: rawPath, sourcePath, sha256: expectedRawSha, dimensions: { width: 941, height: 1672 } });
checkpoint.renderStrategyReset = { ...checkpoint.renderStrategyReset, activeCleanRound: 33, activeSourcePolicy: "single targeted recovery from clean round 33 raw only", priorBatumiRenderInputCount: 1 };
checkpoint.xPost.note = "Georgia has accepted scenes 1548, 1549, and 1550. Clean round 33 scene 1551 is preserved but rejected; its sole bounded recovery is materialized. Publication remains mandatory after scene 1551 is accepted and the four-scene completion checkpoint is pushed.";
checkpoint.nextWakeAction = { country: "Georgia", batch: 382, action: "launch-single-clean-fresh-round-33-recovery-scene-1551-only", preserveAcceptedSceneNumbers: [1548, 1549, 1550], sceneNumbers: [1551], laterCountryStartAllowed: false };

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ status: checkpoint.status, rawSha256: expectedRawSha, recoveryPromptSha256: sha256(recoveryPrompt), recoveryPromptChars: recoveryPrompt.length, partyActivation: recoveryPartyState.partyActivation, willingParticipants: recoveryPartyState.willingParticipants, nextWakeAction: checkpoint.nextWakeAction }, null, 2));
