import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const root = path.join(repo, "tmp/world-195x4/batch-382");
const checkpointPath = path.join(repo, "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json");
const contractPath = path.join(repo, "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const ledgerPath = path.join(repo, "assets/lore/starlight-era/world-x-publish-ledger.json");
const rawPath = "tmp/world-195x4/batch-382/raw/clean-fresh-round-42/scene-1551.png";
const sourcePath = "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-8d8967fe-e319-4d80-a9ef-f02450bdd373.png";
const expectedRawSha = "9DBF64FF69AFA22C6E024C8F89AECCB85DEA43B974C4AF5488635707B905A810";
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
const ledger = JSON.parse(fs.readFileSync(ledgerPath, "utf8"));

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex").toUpperCase();
}

function sha256File(filePath) {
  return sha256(fs.readFileSync(filePath));
}

if (sha256File(contractPath) !== "69EB6C84A2467A4234D901C3086ECECE9E583B55C41BB9382CD5ED523C482EF5") throw new Error("Contract changed during round 42");
if (sha256File(ledgerPath) !== "B94AA3FB2B1AB1BCAB100CE689F0173C77407B82439D73379D8BC0FA3EEC2455") throw new Error("Ledger changed during round 42");
if (sha256File(path.join(repo, rawPath)) !== expectedRawSha) throw new Error("Clean round 42 raw changed");
if (checkpoint.status !== "active-four-scene-gate-clean-fresh-round-42-materialized") throw new Error(`Unexpected status: ${checkpoint.status}`);

const radiancePartyState = checkpoint.renderAttempts.freshRound42.radianceRealtimeAgreementParty;
if (radiancePartyState?.partyActivation !== true || radiancePartyState?.response?.category !== "explicit affirmative") throw new Error("Round 42 affirmative missing");
if (radiancePartyState.willingParticipants?.join("|") !== "Radiance|AI ECE|Alia") throw new Error("Round 42 participant set changed");

const recoveryPartyState = {
  ...radiancePartyState,
  recoveryDecisionContinuity: "This single correction remains the same round-42 event. Alia's invitation, Radiance's explicit affirmative, partyActivation true, the three willing participants, Ellie's non-party support role, and every invitation-specific consent boundary remain unchanged.",
  recoveryEvidenceRequirement: "Radiance visibly tips her face past Ellie toward ECE in a clear mid-nod and willing smile; ECE reciprocates while both compass hands stay fixed; Alia shows a small willing profile smile while both mission hands and her downrange sight line remain fixed; Ellie stays calm and non-party.",
};

const recoveryPrompt = `Use case: precise local correction of one clean editorial photograph.
Input image: the supplied Georgia Batch 382 scene 1551 clean fresh round 42 raw. It is the only visual source.

ONE PLANNED RECOVERY ONLY
Preserve the clean natural photographic surface and all already-correct content. Do not globally repaint, restyle, relight, sharpen, upscale, liquify, beautify, or add decorative detail. Do not inherit or invent any wavy, marbled, rippled, melted, embossed, painterly, over-sharpened, or processed texture. Keep straight rain, flat tile lines, straight architecture, natural skin, coherent hair, and clean garment edges.
Preserve the same four clearly adult fictional identities, exact four bodies, exact eight existing arms and eight existing hands, exact three existing contacts, exact poses except the named head/face corrections, all four garment families, all footwear, Batumi Boulevard, Black Sea, skyline, Batumi tower, Ferris wheel, palms, compass, hands-free map, panel, one paper target, one sand backstop, one puppy, one kitten, and one dry lounge. Add no person, limb, hand, finger cluster, animal, prop, target, party object, text, logo, badge, patch, epaulette, insignia, or crowd.

LOCAL CORRECTION 1: CERTIFY THE STORED AFFIRMATIVE
Preserve the offered choice: ${recoveryPartyState.offeredChoice}
Preserve Radiance's response: ${recoveryPartyState.radianceResponse}
partyActivation = TRUE for exactly Radiance, AI ECE, and Alia. Ellie remains the non-party support partner.
Keep Radiance as the same blonde adult with the same body, bare uninterrupted open back, cobalt outfit, rainbow knee hosiery, exact two arms, exact two hands, and all three existing support contacts unchanged. Rotate only Radiance's head, eyes, and expression farther left past Ellie so both eyes clearly aim at far-left ECE rather than Ellie or camera. Show one clear up-down mid-nod and one open willing smile toward ECE. Do not move, duplicate, hide, or redraw either Radiance hand.
Keep ECE front-on at far left with the same restrained reciprocal willing smile and direct eye line toward Radiance while both existing hands remain fixed on opposite compass handles. Keep Alia's head in the same strict right-facing profile and add only one small clearly willing smile; her eyes, stance, and both mission hands remain safely downrange. Keep Ellie calm and hopeful without a nod, party smile, dance cue, or participant cue. Add no gesture, heel lift, confetti, drink, balloon, sign, stage, ornament, or party object.

LOCAL CORRECTION 2: CERTIFY ALIA'S ROLLED COUTURE
Keep Alia's same adult face, skin tone, braided ponytail, copper-and-cobalt garment family, strict profile, legs, footwear, exact two arms, exact two hands, and two-hand mission stance. Remove only the visible neck choker or neck loop and every rear copper or black connector, rear band, strap, chain, cord, closure, mesh, or fabric across her back. The secure opaque rigid copper shell must remain front-only, cover her bust completely, end before both rear ribs, and support itself internally with a straight strapless upper edge and bare shoulders. Reveal one unmistakable four-centimeter horizontal band of bare midriff between the short copper shell and the secure high-waisted cobalt pleated skort. Keep one large continuous bare upper and middle back from shoulder blades to the separate bare waist band. Her braided ponytail stays clear of that back field. No nudity, exposed undergarment, transparent intimate area, lingerie, or wardrobe change beyond these exact roll corrections.

LOCAL CORRECTION 3: CERTIFY THE EXISTING TRIGGER INDEX
Preserve exactly one dark polished-metal full-size Desert Eagle-style inert cinema-training replica with restrained rainbow highlights and one small orange safety insert only inside the muzzle. Preserve Alia's existing two-hand grip, wrists, elbows, and downrange axis. Straighten only her existing right trigger index into one long fully extended finger lying flat on the metal side plate above and entirely outside the complete black oval trigger guard. Show clean air between finger and guard. Keep the entire guard visibly empty. Her separate support left palm remains under the primary fist and grip base. Add no digit, hand, wrist, replica, magazine, ammunition, beam, tracer, laser, cord, firing, or muzzle flash.

LOCAL CORRECTION 4: COMPLETE THE SAME TARGET LANE
Apply only a subtle clean optical pullback or equivalent environment extension sufficient to keep every existing adult and contact intact while revealing the right side of the same scene. The final output remains vertical 9:16. Keep all four complete bodies and footwear visible at the same relative scale and order.
Bring the same transparent safety panel and the same single thick sand backstop fully inside the image. Make the panel and backstop modestly narrower and shift the complete assembly left only as needed. Show all four orange-capped panel corners, all four backstop edges, the complete white paper, and the single black non-humanoid route diamond. Leave at least one complete backstop-width of empty wet promenade between the backstop's right edge and the image edge. Keep visible clean air between muzzle, panel, paper, and backstop. Keep Alia's dominant eye, barrel center, orange muzzle center, and diamond center on one exact horizontal shoulder-height row. The sand block remains the complete backstop with no person, animal, public path, vehicle, landmark, or occupied object in the target corridor. Add no second target, panel, barrier, berm, lane, or prop.

LOCK EXACT ANATOMY AND CONTACTS
Preserve exactly eight traceable human arms and eight traceable human hands, two per woman. Preserve exactly three and only three relationship contacts: Radiance's left palm on Ellie's covered outer shoulder or upper arm, Ellie's visible support palm on Radiance's outside waist, and their low right-hand clasp below both hips. Keep every shoulder-to-elbow-to-wrist-to-hand owner path visible and unchanged. ECE touches no person and owns the compass alone with two hands. Alia touches no person and owns the inert replica alone with two hands. No hidden, missing, extra, fused, borrowed, floating, emerging, or duplicated limb, wrist, hand, or finger cluster.

PRESERVE EVERY CURRENT PASS
Preserve four distinct adult identities and Alia's sculptural braided ponytail; clean artifact-free surface; heavy straight rain and wet nonslip tiles; recognizable Batumi with sea, tower, Ferris wheel, skyline, and palms; four structurally distinct Mars-expedition couture silhouettes; Radiance's covered waist and open back; Ellie's visible midriff and covered back; ECE's covered waist and civilian sleeveless no-insignia peplum; Radiance's opaque rainbow knee hosiery; exact three contacts; one collarless tiny golden kitten PAWS; one accessory-free small young golden retriever MAX; ECE's exclusive two-handle compass ownership; separate hands-free holographic route map; complete public-safe coverage; and all feet and footwear.

FINAL SAFETY AND QUALITY GATE
Every person, mascot, landmark, public path, vehicle, and occupied object remains behind and left of the muzzle plane. Never aim at a person, animal, occupied object, or camera. No ammunition, loose magazine, firing, muzzle flash, threat, injury, combat, unsafe footing, explicit sex, nudity, bodily fluids, upskirt framing, coercion, or minor. Output one coherent natural photograph with no wavy or marbled processing, rippled skin or fabric, liquify distortion, melted edge, halo, embossed contour, painterly texture, excessive sharpening, bent tower, warped panel, warped backstop, warped tile, curved rain, or extra atmospheric effect.`;

const promptPath = path.join(root, "scene-1551-clean-fresh-round-42-recovery-prompt.txt");
fs.writeFileSync(promptPath, recoveryPrompt, "utf8");
const materializedAt = new Date().toISOString();
const freshAudit = {
  renderSurfaceQuality: "pass-clean-natural-photographic-texture-with-straight-rain-flat-tiles-straight-architecture-and-no-wavy-marbled-or-liquified-artifacts",
  identity: "pass-four-clearly-adult-distinct-identities-with-Alia-sculptural-braided-ponytail",
  anatomy: "pass-exact-eight-traceable-arms-and-eight-traceable-hands-with-two-per-woman",
  handOwnership: "pass-ECE-two-compass-hands-Ellie-two-contact-hands-Radiance-two-contact-hands-and-Alia-two-mission-hands-all-have-continuous-owner-paths",
  weather: "pass-heavy-straight-rain-and-flat-wet-reflective-tiles",
  locationThemeFusion: "pass-recognizable-Batumi-with-Black-Sea-tower-Ferris-wheel-skyline-palms-and-four-distinct-expedition-couture-silhouettes",
  outfitOriginality: "pass-four-distinct-silhouettes-constructions-hems-materials-and-footwear",
  prohibitedUniformStyling: "pass-ECE-civilian-sleeveless-peplum-has-no-patch-badge-epaulette-logo-or-insignia",
  rolledWardrobe: "reject-Alia-visible-neck-loop-rear-bodice-connector-and-weak-bare-midriff-fail-her-strapless-fully-open-back-and-visible-midriff-materialization; Radiance-open-back-and-hosiery-Ellie-midriff-and-ECE-covered-waist-pass",
  romance: "pass-three-visible-contacts-Radiance-outer-shoulder-palm-Ellie-outside-waist-support-and-low-clasp",
  radianceResponse: "reject-Radiance-looks-directly-at-Ellie-instead-of-answering-ECE-with-the-stored-mid-nod-and-eye-line",
  partyActivation: "reject-Radiance-ECE-Alia-only-party-beat-is-not-certifiable-because-Radiance-ECE-mutual-gaze-and-Alia-willing-profile-smile-are-absent",
  mascots: "pass-one-collarless-tiny-golden-PAWS-and-one-accessory-free-small-young-golden-MAX-sharing-one-dry-lounge",
  oddProp: "pass-ECE-alone-holds-two-opposite-compass-handles",
  routeMap: "pass-separate-hands-free-holographic-route-map",
  missionHandling: "pass-two-hand-stance-and-full-size-metallic-inert-replica-but-trigger-index-needs-clearer-straight-above-and-outside-guard-certification",
  missionTargetAxis: "reject-backstop-is-cropped-at-right-edge-and-no-full-backstop-width-of-empty-promenade-remains-beyond-it; complete-panel-paper-and-horizontal-aim-otherwise-pass",
  accepted: false,
};

checkpoint.status = "active-four-scene-gate-clean-fresh-round-42-recovery-materialized";
checkpoint.checkpointedAt = materializedAt;
checkpoint.terminal = false;
checkpoint.renderAttempts.freshRound42 = {
  ...checkpoint.renderAttempts.freshRound42,
  status: "fresh-completed-rejected-recovery-materialized",
  freshCompletedAt: materializedAt,
  rawOutputs: { 1551: { fresh: { path: rawPath, sha256: expectedRawSha, preserved: true } } },
  freshStrictAudit: freshAudit,
  recoveryDecision: {
    attempted: true,
    reason: "The fresh raw is clean and passes identity, exact anatomy, three contacts, Batumi, outfit originality, mascots, compass, route map, and two-hand mission ownership. One bounded correction can make the stored three-participant affirmative visible, certify Alia's rolled front-only open-back couture and indexed trigger finger, and bring the same target lane fully inside frame.",
    maximumRecoveryPasses: 1,
    recoveryPassNumber: 1,
    sourceRaw: rawPath,
  },
  recoveryPromptAudit: {
    path: path.relative(repo, promptPath).replaceAll("\\", "/"),
    sha256: sha256(recoveryPrompt),
    chars: recoveryPrompt.length,
    sourceMode: "single-targeted-recovery-from-clean-round-42-raw",
    sourceRaw: { path: rawPath, sha256: expectedRawSha },
    priorBatumiRenderInputCount: 1,
    permittedSourceCount: 1,
    recoveryPass: 1,
    maximumRecoveryPasses: 1,
    boundedCorrections: [
      "turn Radiance's head and eye line past Ellie toward ECE with the stored willing smile and mid-nod",
      "make Alia's stored willing profile smile visible without moving her mission hands or downrange sight line",
      "remove Alia's neck and rear connectors and expose her rolled four-centimeter bare midriff while preserving complete public-safe coverage",
      "certify Alia's existing straight trigger index above and outside the complete empty guard",
      "pull the same panel and backstop fully inside frame with one backstop-width of empty promenade beyond while preserving target axis",
    ],
    preserveLocks: [
      "clean artifact-free natural photographic surface with no global processing",
      "exact eight arms and hands with three existing contacts and all owner paths",
      "round-42 explicit affirmative with partyActivation true for exactly Radiance ECE and Alia while Ellie remains non-party",
      "identities garment families Batumi mascots compass map bodies and footwear",
    ],
    radianceRealtimeAgreementParty: recoveryPartyState,
  },
};
checkpoint.scenePlans["1551"].freshRound42.freshVisualAudit = freshAudit;
checkpoint.scenePlans["1551"].freshRound42.recoveryPrompt = recoveryPrompt;
checkpoint.scenePlans["1551"].freshRound42.recoveryPromptSha256 = sha256(recoveryPrompt);
checkpoint.scenePlans["1551"].freshRound42.recoveryRadianceRealtimeAgreementParty = recoveryPartyState;
checkpoint.rawOutputs.push({
  scene: 1551,
  round: 42,
  kind: "clean-fresh-recovery-pending",
  path: rawPath,
  sourcePath,
  sha256: expectedRawSha,
  dimensions: { width: 941, height: 1672 },
});
checkpoint.renderStrategyReset = {
  ...checkpoint.renderStrategyReset,
  activeCleanRound: 42,
  activeSourcePolicy: "single targeted recovery from clean round 42 raw only",
  priorBatumiRenderInputCount: 1,
};
checkpoint.xBacklogAudit = {
  ...checkpoint.xBacklogAudit,
  checkedAt: materializedAt,
  account: "@dogramaci",
  signedIn: true,
  sessionState: "live-signed-in-dogramaci-profile-loaded-this-wake",
  eligibleBacklogRemaining: 0,
  pendingPost: null,
  preparedPostQueueCount: 0,
  deferredPostCheckpoint: null,
  reconciliationDecision: "The signed-in live @dogramaci profile loaded successfully and the authoritative ledger has no eligible pending, prepared, or deferred item. Georgia remains publication-blocked at three accepted scenes, so no upload or country advance is permitted.",
  explicitFullDrainRequestedAt: "2026-08-12T05:05:06.102Z",
  explicitFullDrainCompletedAt: materializedAt,
  explicitFullDrainPostedCount: 0,
  historicalEligibilityAudit: {
    range: [374, 381],
    eligibleCountryCount: 0,
    reason: "Armenia and Qatar each have one accepted asset; Namibia, Lithuania, Jamaica, Gambia, Gabon, and Botswana have zero. Every country remains below the historical two-current-country-image publication threshold.",
  },
};
checkpoint.xPost.status = "blocked-active-country-incomplete";
checkpoint.xPost.url = null;
checkpoint.xPost.acceptedCurrentCountryAssets = 3;
checkpoint.xPost.note = "Georgia has accepted scenes 1548, 1549, and 1550. Clean round 42 scene 1551 is preserved but rejected; its sole bounded recovery is materialized from that clean raw only. The signed-in @dogramaci profile loaded and the ledger remains empty. Publication remains mandatory after scene 1551 is accepted and the four-scene completion checkpoint is pushed.";
checkpoint.nextQueueStatus = "locked-on-Georgia-until-four-accepted-git-pushed-and-X-live-verified";
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "launch-single-clean-fresh-round-42-recovery-scene-1551-only",
  preserveAcceptedSceneNumbers: [1548, 1549, 1550],
  sceneNumbers: [1551],
  laterCountryStartAllowed: false,
};

ledger.latestExplicitDrainAudit = {
  status: "complete-no-eligible-backlog",
  requestedAt: "2026-08-12T05:05:06.102Z",
  completedAt: materializedAt,
  account: "@dogramaci",
  instruction: "post entire X backlog now",
  liveProfileVerified: true,
  signedInAccount: "@dogramaci",
  pendingPost: null,
  preparedPostQueueCount: 0,
  deferredPostCheckpoint: null,
  historicalCheckpointAudit: {
    batchRange: [374, 381],
    eligibleCountryCount: 0,
    insufficientCountries: [
      { batch: 374, country: "Armenia", acceptedCurrentCountryAssets: 1, required: 2 },
      { batch: 375, country: "Namibia", acceptedCurrentCountryAssets: 0, required: 2 },
      { batch: 376, country: "Lithuania", acceptedCurrentCountryAssets: 0, required: 2 },
      { batch: 377, country: "Qatar", acceptedCurrentCountryAssets: 1, required: 2 },
      { batch: 378, country: "Jamaica", acceptedCurrentCountryAssets: 0, required: 2 },
      { batch: 379, country: "Gambia", acceptedCurrentCountryAssets: 0, required: 2 },
      { batch: 380, country: "Gabon", acceptedCurrentCountryAssets: 0, required: 2 },
      { batch: 381, country: "Botswana", acceptedCurrentCountryAssets: 0, required: 2 },
    ],
  },
  activeCountryAudit: { batch: 382, country: "Georgia", acceptedCurrentCountryAssets: 3, required: 4, eligible: false },
  eligibleBacklogRemaining: 0,
  newlyPublished: [],
  action: "No upload was submitted because no country meets its authoritative publication gate.",
  duplicatePrevention: "The live signed-in profile and ledger were reconciled before any composer action; no already-public or ineligible media was re-uploaded.",
};

fs.writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  status: checkpoint.status,
  rawSha256: expectedRawSha,
  recoveryPromptSha256: sha256(recoveryPrompt),
  recoveryPromptChars: recoveryPrompt.length,
  partyActivation: recoveryPartyState.partyActivation,
  willingParticipants: recoveryPartyState.willingParticipants,
  xSignedIn: checkpoint.xBacklogAudit.signedIn,
  explicitBacklogDrain: ledger.latestExplicitDrainAudit,
  nextWakeAction: checkpoint.nextWakeAction,
}, null, 2));
