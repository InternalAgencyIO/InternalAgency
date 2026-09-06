import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const root = path.join(repo, "tmp/world-195x4/batch-382");
const checkpointPath = path.join(repo, "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json");
const contractPath = path.join(repo, "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const ledgerPath = path.join(repo, "assets/lore/starlight-era/world-x-publish-ledger.json");
const rawPath = "tmp/world-195x4/batch-382/raw/clean-fresh-round-35/scene-1551.png";
const sourcePath = "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-2d72b53d-c14e-4edc-814f-49e332567f87.png";
const expectedRawSha = "6E760C4765ECF388219CFA428B77794419D8ED818E5F83AD2EFCB6E96DF4729C";
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex").toUpperCase();
}

function sha256File(filePath) {
  return sha256(fs.readFileSync(filePath));
}

if (sha256File(contractPath) !== "69EB6C84A2467A4234D901C3086ECECE9E583B55C41BB9382CD5ED523C482EF5") throw new Error("Contract changed during round 35");
if (sha256File(ledgerPath) !== "B94AA3FB2B1AB1BCAB100CE689F0173C77407B82439D73379D8BC0FA3EEC2455") throw new Error("Ledger changed during round 35");
if (sha256File(path.join(repo, rawPath)) !== expectedRawSha) throw new Error("Clean round 35 raw changed");
if (checkpoint.status !== "active-four-scene-gate-clean-fresh-round-35-materialized") throw new Error(`Unexpected status: ${checkpoint.status}`);

const radiancePartyState = checkpoint.renderAttempts.freshRound35.radianceRealtimeAgreementParty;
if (radiancePartyState?.partyActivation !== true || radiancePartyState?.response?.category !== "explicit affirmative") throw new Error("Round 35 affirmative missing");
if (radiancePartyState.willingParticipants?.join("|") !== "Radiance|Ellie|AI ECE") throw new Error("Round 35 participant set changed");
const recoveryPartyState = {
  ...radiancePartyState,
  recoveryDecisionContinuity: "This single correction remains the same round-35 event. ECE's invitation, Radiance's explicit yes, the Radiance-Ellie-ECE participant set, Alia's nonparticipation, one-step limit, and all consent boundaries remain unchanged.",
  recoveryEvidenceRequirement: "Preserve Radiance, Ellie, and ECE's willing smiles and existing one-step body rhythm; keep Alia neutral and entirely outside the optional party.",
};

const recoveryPrompt = `Use case: precise-object-edit.
Input image: the supplied Georgia Batch 382 scene 1551 clean fresh round 35 raw. It is the only visual source.

ONE LOCAL RECOVERY ONLY
Preserve this clean natural editorial photograph. Keep camera, crop, exposure, faces, bodies, all eight existing arms and hands, all feet, low clasp, visible support palm, covered body brace, party expressions, rain, Batumi landmarks, sea, tiles, reflections, mascots, compass, map, glass safety panel, and every garment. Edit only Alia's existing primary index-finger placement and the existing sand backstop at far right. Do not globally redraw, restyle, sharpen, upscale, relight, liquify, or process the image. Add no limb, hand, finger cluster, person, animal, or extra object.

LOCK CONSENT AND PARTICIPANTS
Preserve the offered choice: ${recoveryPartyState.offeredChoice}
Preserve Radiance's explicit response: ${recoveryPartyState.radianceResponse}
partyActivation = TRUE. Willing participants remain exactly Radiance, Ellie, and AI ECE. Preserve their willing smiles and existing measured rain-step. Alia remains neutral and does not smile, nod, heel-tap, dance, or join. Add no party object.

CORRECTION ZONE 1: INDEXED INERT-REPLICA SAFETY
Preserve Alia's adult identity, face, braids, body, completely open back, strapless copper side shell, bare waist band, cobalt skort, exact two arms, exact two hands, stance, footwear, and safe rightward aim. Preserve the existing realistic dark polished-metal rainbow-highlighted 30-centimeter Desert Eagle-style inert cinema-training replica, its compact barrel, heavy grip, orange muzzle safety insert, scale, and side profile. Preserve Alia's support left palm beneath the grip base as one separate hand cluster.
Move only Alia's existing primary right index finger. Make that same finger one long straight digit lying flat along the metal side plate above and entirely outside the oversized black oval trigger guard. Show clean air between the straight index finger and the guard. Show the complete black oval trigger guard visibly empty. Preserve exactly two wrists, two palms, and two finger clusters for Alia. Do not add, remove, fuse, or duplicate any finger or hand. The muzzle continues to point only at the paper route target.

CORRECTION ZONE 2: COMPLETE EXISTING BACKSTOP
Preserve the single white paper with one black non-humanoid route diamond, its shoulder-height alignment, and the empty pavement lane. Reframe only the existing thick sand backstop at far right by moving and slightly narrowing that same backstop a few centimeters left. Its complete top, bottom, left edge, and right edge must all be visible inside the image with a clear strip of rainy background beyond its right edge. Keep the paper target centered on the same backstop. Keep the existing complete transparent safety panel between Alia and the target. Do not add a second target, barrier, berm, sign, or object.

PRESERVE EVERY SUCCESS
Preserve exactly four clearly adult fictional women with anchored identities and Alia's sculptural braids; exactly eight human arms and exactly eight human hands, two per woman; the low clasp with both complete owner paths, Ellie's visible support palm, and the covered body brace; Radiance and ECE's affectionate eye line; partyActivation true only for Radiance, Ellie, and ECE; Alia's exclusion; ECE's two compass hands and separate hands-free map; one PAWS kitten and one MAX puppy together on the raised dry bed; straight rain; Batumi's Black Sea, recognizable Alphabet Tower, Ferris wheel, skyline, palms, glass rail, flat wet tiles, and reflections; four distinct couture silhouettes; one inert replica; one target; one safety panel; one complete backstop; and all full bodies and footwear.

SURFACE AND SCOPE GATE
No extra person, limb, hand, finger cluster, animal, prop, decoration, crowd, text, logo, target, equipment, or party object. No wavy or marbled processing, liquify distortion, rippled skin or fabric, melted edge, embossed contour, halo, excessive sharpening, painterly texture, bent tower, bent rail, warped tile, or curved rain. Keep one coherent clean photographic exposure.`;

const promptPath = path.join(root, "scene-1551-clean-fresh-round-35-recovery-prompt.txt");
fs.writeFileSync(promptPath, recoveryPrompt, "utf8");
const materializedAt = new Date().toISOString();
const freshAudit = {
  renderSurfaceQuality: "pass-clean-natural-photographic-texture-with-straight-rain-and-no-wavy-artifacts",
  identity: "pass-four-adult-identities-with-Alia-braids",
  anatomy: "pass-exact-eight-arms-and-eight-hands-with-continuous-owner-paths",
  handOwnership: "pass-two-hands-per-woman-with-clear-low-clasp-support-compass-affirmative-and-mission-owner-paths",
  weather: "pass-heavy-straight-rain-and-flat-wet-tiles",
  locationThemeFusion: "pass-recognizable-Batumi-with-Alphabet-Tower-Ferris-wheel-sea-skyline-and-four-distinct-expedition-silhouettes",
  outfitOriginality: "pass-four-distinct-silhouettes-constructions-hems-materials-and-footwear",
  rolledWardrobe: "pass-Radiance-open-back-Ellie-midriff-Alia-midriff-Alia-strapless-and-Alia-open-back",
  romance: "pass-low-clasp-visible-support-palm-and-covered-body-brace-read-as-three-distinct-contacts",
  radianceResponse: "pass-explicit-affirmative-through-willing-smile-ECE-eye-line-and-reciprocal-low-clasp",
  partyActivation: "pass-exactly-Radiance-Ellie-ECE-willing-with-Alia-neutral-and-excluded",
  mascots: "pass-one-PAWS-and-one-MAX-sharing-raised-dry-bed",
  oddProp: "pass-ECE-two-hands-on-opposite-compass-handles",
  routeMap: "pass-separate-hands-free-holographic-map",
  missionHandling: "reject-large-metal-replica-and-orange-insert-pass-but-primary-index-outside-empty-guard-is-not-crisp-enough-to-certify",
  missionTargetAxis: "reject-paper-target-safe-rightward-axis-and-safety-panel-pass-but-sand-backstop-is-cropped-by-right-frame-edge",
  accepted: false,
};

checkpoint.status = "active-four-scene-gate-clean-fresh-round-35-recovery-materialized";
checkpoint.checkpointedAt = materializedAt;
checkpoint.terminal = false;
checkpoint.renderAttempts.freshRound35 = {
  ...checkpoint.renderAttempts.freshRound35,
  status: "fresh-completed-rejected-recovery-materialized",
  freshCompletedAt: materializedAt,
  rawOutputs: { 1551: { path: rawPath, sha256: expectedRawSha, preserved: true } },
  freshStrictAudit: freshAudit,
  recoveryDecision: { attempted: true, reason: "The clean raw passes surface, identities, exact eight-hand anatomy, three-contact romance, scoped party, Batumi, wardrobe rolls, mascots, compass, map, target, safety panel, and large metal replica. One bounded correction changes only the trigger-index read and the cropped backstop.", maximumRecoveryPasses: 1, recoveryPassNumber: 1, sourceRaw: rawPath },
  recoveryPromptAudit: {
    path: path.relative(repo, promptPath).replaceAll("\\", "/"),
    sha256: sha256(recoveryPrompt),
    chars: recoveryPrompt.length,
    sourceMode: "single-targeted-recovery-from-clean-round-35-raw",
    sourceRaw: { path: rawPath, sha256: expectedRawSha },
    priorBatumiRenderInputCount: 1,
    permittedSourceCount: 1,
    recoveryPass: 1,
    maximumRecoveryPasses: 1,
    boundedCorrections: ["move only Alia's existing primary index straight above and outside the empty guard", "move and slightly narrow only the existing sand backstop fully inside frame"],
    preserveLocks: ["exact eight arms and hands with low-clasp owner paths and visible support palm", "round-35 Radiance-Ellie-ECE party with Alia excluded", "clean surface identities wardrobe Batumi mascots compass map safety panel target and full bodies"],
    radianceRealtimeAgreementParty: recoveryPartyState,
  },
};
checkpoint.scenePlans["1551"].freshRound35.freshVisualAudit = freshAudit;
checkpoint.scenePlans["1551"].freshRound35.recoveryPrompt = recoveryPrompt;
checkpoint.scenePlans["1551"].freshRound35.recoveryPromptSha256 = sha256(recoveryPrompt);
checkpoint.scenePlans["1551"].freshRound35.recoveryRadianceRealtimeAgreementParty = recoveryPartyState;
checkpoint.rawOutputs.push({ scene: 1551, round: 35, kind: "clean-fresh-recovery-pending", path: rawPath, sourcePath, sha256: expectedRawSha, dimensions: { width: 941, height: 1672 } });
checkpoint.renderStrategyReset = { ...checkpoint.renderStrategyReset, activeCleanRound: 35, activeSourcePolicy: "single targeted recovery from clean round 35 raw only", priorBatumiRenderInputCount: 1 };
checkpoint.xPost.note = "Georgia has accepted scenes 1548, 1549, and 1550. Clean round 35 scene 1551 is preserved but rejected; its sole bounded recovery is materialized from that clean raw only. Publication remains mandatory after scene 1551 is accepted and the four-scene completion checkpoint is pushed.";
checkpoint.nextWakeAction = { country: "Georgia", batch: 382, action: "launch-single-clean-fresh-round-35-recovery-scene-1551-only", preserveAcceptedSceneNumbers: [1548, 1549, 1550], sceneNumbers: [1551], laterCountryStartAllowed: false };

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ status: checkpoint.status, rawSha256: expectedRawSha, recoveryPromptSha256: sha256(recoveryPrompt), recoveryPromptChars: recoveryPrompt.length, partyActivation: recoveryPartyState.partyActivation, willingParticipants: recoveryPartyState.willingParticipants, nextWakeAction: checkpoint.nextWakeAction }, null, 2));
