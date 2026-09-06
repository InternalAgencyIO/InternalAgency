import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const root = path.join(repo, "tmp/world-195x4/batch-382");
const checkpointPath = path.join(repo, "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json");
const contractPath = path.join(repo, "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const ledgerPath = path.join(repo, "assets/lore/starlight-era/world-x-publish-ledger.json");
const rawPath = "tmp/world-195x4/batch-382/raw/clean-fresh-round-31/scene-1551.png";
const sourcePath = "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-86fc20e4-0de6-42a3-a99a-0cac89ac14b5.png";
const expectedRawSha = "B6F3F8B1D7B25B8BF69258674F092F4E59DE8F77DDD9ADE29749CCB55F4E6A30";
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex").toUpperCase();
}

function sha256File(filePath) {
  return sha256(fs.readFileSync(filePath));
}

if (sha256File(contractPath) !== "69EB6C84A2467A4234D901C3086ECECE9E583B55C41BB9382CD5ED523C482EF5") throw new Error("Contract changed during round 31");
if (sha256File(ledgerPath) !== "B94AA3FB2B1AB1BCAB100CE689F0173C77407B82439D73379D8BC0FA3EEC2455") throw new Error("Ledger changed during round 31");
if (sha256File(path.join(repo, rawPath)) !== expectedRawSha) throw new Error("Clean round 31 raw changed");
if (checkpoint.status !== "active-four-scene-gate-clean-fresh-round-31-materialized") throw new Error(`Unexpected status: ${checkpoint.status}`);

const radiancePartyState = checkpoint.renderAttempts.freshRound31.radianceRealtimeAgreementParty;
if (radiancePartyState?.partyActivation !== false || radiancePartyState?.response?.category !== "explicit redirect") throw new Error("Round 31 redirect state missing");
if ((radiancePartyState.willingParticipants ?? []).length !== 0) throw new Error("Round 31 willing participants changed");
const recoveryPartyState = {
  ...radiancePartyState,
  recoveryDecisionContinuity: "This single technical correction remains the same round-31 event. ECE's invitation, Radiance's explicit redirect, partyActivation false, empty willing-participant set, and every consent boundary remain unchanged.",
  recoveryEvidenceRequirement: "Preserve Radiance's open redirect palm, warm ECE eye line, and ECE's accepting compass pose exactly as rendered.",
};

const recoveryPrompt = `Use case: precise-object-edit.
Input image: the supplied Georgia Batch 382 scene 1551 clean fresh round 31 raw. It is the only visual source.

ONE RECOVERY ONLY
This source is already a clean natural editorial photograph. Preserve its camera, crop, faces, bodies, feet, rain, Batumi landmarks, sea, tiles, reflections, mascots, compass, map, target, backstop, and successful eight-limb inventory. Edit only the three small correction zones below. Do not globally redraw, restyle, sharpen, upscale, relight, liquify, or process the image. Move existing hands and garment edges only; add no limb, hand, finger cluster, person, animal, or extra object.

LOCK THE SUCCESSFUL REDIRECT
Preserve the offered choice: ${recoveryPartyState.offeredChoice}
Preserve Radiance's explicit response: ${recoveryPartyState.radianceResponse}
partyActivation = FALSE and willing participants remain none. Keep Radiance's already visible open redirect palm, separated fingers, warm eye line to ECE, and shallow dip. Keep ECE's accepting expression and exact two hands on opposite compass handles. Add no party action or object.

CORRECTION ZONE 1: THREE-CONTACT DIP WITHOUT NEW ANATOMY
Preserve Ellie and Radiance's existing adult identities, faces, hair, complete legs, planted feet, existing shallow dip angle, open redirect palm, and existing far-left shoulder-height clasp. Keep exactly four arms and four hands across them.
Move Ellie's existing support palm from Radiance's side to a clearly visible position high on Radiance's upper back. Keep the entire white-sleeved owner path visible from Ellie's shoulder through elbow, forearm, wrist, palm, and fingers. Shift Radiance's securely covered cobalt hip a few centimeters left until it visibly rests against Ellie's securely covered white hip. Do not change either foot position.
The three and only three relationship contacts must now read clearly: the preserved far-left hand clasp; Ellie's open support palm on Radiance's upper back; and the covered hip-to-covered-hip support point. Radiance's open redirect palm touches nobody. No extra touch, hidden hand, fused wrist, duplicate finger cluster, or ambiguous owner path.

CORRECTION ZONE 2: ACTIVE RUNWAY TAILORING
Preserve all garments' colors, materials, coverage, hems, shoes, and distinct silhouettes. Keep every look fully opaque, fully lined, conservative, and public-safe.
Radiance: turn only her upper torso a few degrees into rear three-quarter while preserving her face, dip, arms, and hand positions. Remove only any cobalt or gold panel, strap, ring, band, mesh, or hair crossing the upper and middle back so one uninterrupted open-back panel is clearly visible down to the secure high waist. Her waist remains fully covered.
Ellie: separate the existing white fan-sleeve top from the high-waisted white trousers just enough to show one restrained continuous three-centimeter runway waist reveal. Keep her back covered and all other tailoring unchanged.
Alia: remove only the dark horizontal band and lacing crossing the upper back. Keep the copper shell securely fitted at front and sides with a straight opaque upper edge. Raise only its lower edge enough to show one continuous four-centimeter runway waist reveal above the cobalt skort. Preserve her strapless open-back construction and complete front coverage.

CORRECTION ZONE 3: AUDITABLE INERT CINEMA-TRAINING REPLICA
Preserve Alia's exact stance, two arms, two hands, target line, safety panel, paper diamond, and complete sand backstop. Replace only the undersized bright-blue object body already in her hands with exactly one full-size approximately 30-centimeter polished-steel large-frame inert cinema-training replica. Use a metallic heat-anodized rainbow finish, compact short barrel, substantial heavy grip, oversized black oval trigger guard, and a small orange safety insert visible only inside the muzzle opening. It must read as heavy polished metal rather than plastic.
Keep Alia's primary hand on the grip and support palm under the grip base. Straighten her existing primary index finger flat along the metal side plate, clearly above and entirely outside the guard; the complete guard must be visibly empty. Show exactly two wrists, two palms, and two distinct finger clusters. Keep the muzzle aimed only at the empty paper target and complete backstop. No ammunition, magazine, firing, flash, threat, injury, or combat.

PRESERVE EVERY SUCCESS
Preserve exactly four clearly adult fictional women with anchored identities and Alia's braids; exactly eight human arms and exactly eight human hands, two per woman; the shallow dip and far-left clasp; Radiance's opaque rainbow knee hosiery; ECE's compass and hands-free blue route map; one PAWS kitten and one MAX puppy together on the raised dry bed; straight rain; Batumi's Black Sea, Alphabet Tower, Ferris wheel, skyline, palms, glass rail, flat wet tiles, and natural reflections; four distinct expedition-couture silhouettes; one paper target; one complete backstop; and all full bodies and footwear.

SURFACE AND SCOPE GATE
No extra person, limb, hand, finger cluster, animal, prop, decoration, crowd, text, logo, target, equipment, or party object. No wavy or marbled processing, liquify distortion, rippled skin or fabric, melted edge, embossed contour, halo, excessive sharpening, painterly texture, bent tower, bent rail, warped tile, or curved rain. Keep one coherent clean photographic exposure.`;

const promptPath = path.join(root, "scene-1551-clean-fresh-round-31-recovery-prompt.txt");
fs.writeFileSync(promptPath, recoveryPrompt, "utf8");
const materializedAt = new Date().toISOString();
const freshAudit = {
  renderSurfaceQuality: "pass-clean-natural-photographic-texture-with-straight-rain-and-no-wavy-artifacts",
  identity: "pass-four-adult-identities-with-Alia-braids",
  anatomy: "pass-exact-eight-arms-eight-hands-with-continuous-owner-paths",
  handOwnership: "pass-two-hands-per-woman-with-clear-clasp-compass-and-mission-grips",
  weather: "pass-heavy-straight-rain-and-flat-wet-tiles",
  locationThemeFusion: "pass-recognizable-Batumi-and-four-distinct-expedition-silhouettes",
  outfitOriginality: "pass-four-distinct-silhouettes-constructions-hems-and-footwear",
  rolledWardrobe: "reject-Radiance-open-back-not-visible-Ellie-midriff-missing-and-Alia-back-band-obstructs-open-back",
  romance: "partial-controlled-dip-and-two-clear-contacts-pass-but-covered-hip-support-third-contact-is-weak",
  radianceResponse: "pass-explicit-redirect-through-open-palm-to-map-and-warm-ECE-eye-line",
  partyActivation: "pass-false-with-no-party-participants-or-party-objects",
  mascots: "pass-one-PAWS-and-one-MAX-sharing-raised-dry-bed",
  oddProp: "pass-ECE-two-hands-on-opposite-compass-handles",
  routeMap: "pass-separate-hands-free-holographic-map",
  missionHandling: "reject-replica-is-undersized-plastic-reading-and-index-outside-empty-guard-is-not-auditable",
  missionTargetAxis: "pass-paper-diamond-complete-backstop-safety-panel-and-safe-right-facing-axis",
  accepted: false,
};

checkpoint.status = "active-four-scene-gate-clean-fresh-round-31-recovery-materialized";
checkpoint.checkpointedAt = materializedAt;
checkpoint.terminal = false;
checkpoint.renderAttempts.freshRound31 = {
  ...checkpoint.renderAttempts.freshRound31,
  status: "fresh-completed-rejected-recovery-materialized",
  freshCompletedAt: materializedAt,
  rawOutputs: { 1551: { path: rawPath, sha256: expectedRawSha, preserved: true } },
  freshStrictAudit: freshAudit,
  recoveryDecision: {
    attempted: true,
    reason: "The clean raw passes surface, identities, exact anatomy, dip, redirect, Batumi, mascots, compass, map, and target. One bounded correction strengthens the third contact, exposes active runway tailoring, and replaces only the undersized plastic-reading inert replica.",
    maximumRecoveryPasses: 1,
    recoveryPassNumber: 1,
    sourceRaw: rawPath,
  },
  recoveryPromptAudit: {
    path: path.relative(repo, promptPath).replaceAll("\\", "/"),
    sha256: sha256(recoveryPrompt),
    chars: recoveryPrompt.length,
    sourceMode: "single-targeted-recovery-from-clean-round-31-raw",
    sourceRaw: { path: rawPath, sha256: expectedRawSha },
    priorBatumiRenderInputCount: 1,
    permittedSourceCount: 1,
    recoveryPass: 1,
    maximumRecoveryPasses: 1,
    boundedCorrections: [
      "move Ellie's existing support palm upward and close the covered hip support point without changing feet or adding anatomy",
      "expose only the active Radiance Ellie and Alia runway tailoring openings",
      "replace only the undersized plastic-reading object body with an auditable full-size metallic inert training replica",
    ],
    preserveLocks: [
      "exact eight-arm eight-hand inventory and all four adult identities",
      "round-31 explicit redirect partyActivation false and empty participant set",
      "clean surface Batumi straight rain mascots compass map target and backstop",
    ],
    radianceRealtimeAgreementParty: recoveryPartyState,
  },
};
checkpoint.scenePlans["1551"].freshRound31.freshVisualAudit = freshAudit;
checkpoint.scenePlans["1551"].freshRound31.recoveryPrompt = recoveryPrompt;
checkpoint.scenePlans["1551"].freshRound31.recoveryPromptSha256 = sha256(recoveryPrompt);
checkpoint.scenePlans["1551"].freshRound31.recoveryRadianceRealtimeAgreementParty = recoveryPartyState;
checkpoint.rawOutputs.push({
  scene: 1551,
  round: 31,
  kind: "clean-fresh-recovery-pending",
  path: rawPath,
  sourcePath,
  sha256: expectedRawSha,
  dimensions: { width: 941, height: 1672 },
});
checkpoint.renderStrategyReset = {
  ...checkpoint.renderStrategyReset,
  activeCleanRound: 31,
  activeSourcePolicy: "single targeted recovery from clean round 31 raw only",
  priorBatumiRenderInputCount: 1,
};
checkpoint.xPost.note = "Georgia has accepted scenes 1548, 1549, and 1550. Clean round 31 scene 1551 is preserved but rejected; its sole bounded recovery is materialized. Publication remains mandatory after scene 1551 is accepted and the four-scene completion checkpoint is pushed.";
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "launch-single-clean-fresh-round-31-recovery-scene-1551-only",
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
