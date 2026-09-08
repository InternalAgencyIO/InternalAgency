import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const root = path.join(repo, "tmp/world-195x4/batch-382");
const checkpointPath = path.join(repo, "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json");
const contractPath = path.join(repo, "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const ledgerPath = path.join(repo, "assets/lore/starlight-era/world-x-publish-ledger.json");
const rawPath = "tmp/world-195x4/batch-382/raw/clean-fresh-round-21/scene-1551.png";
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex").toUpperCase();
}

function sha256File(filePath) {
  return sha256(fs.readFileSync(filePath));
}

const expectedContractSha = "69EB6C84A2467A4234D901C3086ECECE9E583B55C41BB9382CD5ED523C482EF5";
const expectedLedgerSha = "B94AA3FB2B1AB1BCAB100CE689F0173C77407B82439D73379D8BC0FA3EEC2455";
const expectedRawSha = "FA4D89B194D9FBC52A743A325BFE4F55243F626B78610510C451629B4ECB75FF";
if (sha256File(contractPath) !== expectedContractSha) throw new Error("Authoritative contract changed during round 21");
if (sha256File(ledgerPath) !== expectedLedgerSha) throw new Error("X publishing ledger changed during round 21");
if (sha256File(path.join(repo, rawPath)) !== expectedRawSha) throw new Error("Clean round 21 raw changed before recovery materialization");
if (checkpoint.status !== "active-four-scene-gate-clean-fresh-round-21-materialized") {
  throw new Error(`Unexpected checkpoint status: ${checkpoint.status}`);
}

const recoveryPrompt = `Use case: precise-object-edit.
Input: the supplied Georgia Batch 382 scene 1551 clean fresh round 21 raw.

ONE RECOVERY ONLY
This is the single allowed recovery for clean round 21. Make only the two bounded corrections below. Preserve the clean natural photographic surface. Do not redraw, reinterpret, restyle, or globally process the image.

CORRECTION 1: TRACEABLE ELLIE SUPPORT ARM
At the far left, keep Ellie's right hand and Radiance's left hand in their existing reciprocal clasp. Repair only Ellie's other support arm: show one continuous white-sleeved left arm leaving Ellie's left shoulder, passing in clean open air behind Radiance, and ending in Ellie's one open left palm high on Radiance's upper back. The shoulder, sleeve, elbow, forearm, wrist, and palm must be continuously traceable to Ellie. Remove the ambiguous isolated hand currently emerging at Radiance's waist. Do not add a hand. Preserve Radiance's existing right palm on ECE's high shoulder and the stable shallow dip.

CORRECTION 2: SAFE ALIA MISSION LANE
At the far right, preserve Alia's face, braided ponytail, two arms, two hands, strapless open-back copper bodice, midriff band, skort, legs, and footwear. Keep exactly one short-barrel rainbow-gradient orange-plugged inert cinema-training pistol replica. Bend Alia's elbows modestly so the compact replica sits closer to her torso and leaves broad, obvious empty air between the orange muzzle and the white target paper. Keep the paper and complete sand backstop at the far-right edge.
Make the grip and black trigger guard large and crisp. Alia's primary right hand wraps the grip. Her right trigger index must be fully extended, perfectly straight, and visibly flat along the colored frame above and outside the guard. The black trigger guard below it must be completely empty. Her support left palm and fingers remain a separate readable cluster below and forward of the primary hand at the grip base. Show two distinct wrists, two distinct palms, and two distinct finger clusters with clean air around the guard. Keep Alia's dominant eye, sights, horizontal barrel center, orange muzzle center, and black diamond center in one exact horizontal row. Nobody and no mascot may enter the muzzle plane.

PRESERVE EVERY OTHER ELEMENT
Preserve all four clearly adult fictional identities and all existing wardrobe rolls. Preserve Radiance's rainbow hosiery, explicit affirmative reciprocal clasp, voluntary turn and sustained affectionate eye line toward ECE, and the restrained fully clothed InternalAgency victory-dance party beat. Preserve ECE's exactly two hands on the two separate compass handles and the hands-free holographic map. Preserve Alia's confident affirmative response while both mission hands remain occupied.
Final anatomy must be exactly eight human arms and exactly eight human hands: Ellie two, Radiance two, ECE two, Alia two. No extra, missing, fused, floating, borrowed, emerging, or ambiguous limb or finger cluster.
Preserve the heavy straight rain, Batumi skyline, Alphabet Tower, Ferris wheel, Black Sea, palms, wet flat tiles, transparent safety panel, complete backstop, one white paper, one black route diamond, and exactly one tiny collarless golden kitten PAWS plus one distinct small young golden retriever puppy MAX on the dry lounge.

SURFACE AND SCOPE GATE
The only visible changes are Ellie's support-arm traceability and Alia's safe mission-lane geometry, trigger index, and hand separation. Add no person, limb, hand, animal, prop, decoration, crowd, drink, confetti, text, logo, or target. Add no wavy processing, liquify distortion, marbling, rippled skin, rippled fabric, melted edge, embossed contour, halo, excessive sharpening, bent architecture, or painterly texture. Keep one clean coherent photographic exposure.`;

const promptPath = path.join(root, "scene-1551-clean-fresh-round-21-recovery-prompt.txt");
fs.writeFileSync(promptPath, recoveryPrompt, "utf8");
const materializedAt = new Date().toISOString();
const freshAudit = {
  renderSurfaceQuality: "pass-clean-natural-photographic-texture-without-wavy-artifacts",
  identity: "pass-four-adult-identities-with-Alia-braids",
  anatomy: "reject-Ellie-supporting-hand-has-hidden-ambiguous-forearm-ownership",
  handOwnership: "reject-Ellie-second-arm-not-continuously-traceable-from-shoulder-to-support-palm",
  weather: "pass-heavy-straight-rain",
  locationThemeFusion: "pass-recognizable-Batumi-with-distinct-Mars-expedition-couture",
  outfitOriginality: "pass-four-distinct-silhouettes-constructions-and-footwear",
  rolledWardrobe: "pass-Radiance-open-back-Ellie-midriff-Alia-midriff-strapless-open-back-ECE-covered",
  romance: "pass-controlled-dip-reciprocal-clasp-Radiance-ECE-center-and-three-relationship-contacts",
  radianceAgreement: "pass-deliberate-reciprocal-clasp-voluntary-turn-and-sustained-ECE-eye-line",
  partyActivation: "pass-restrained-four-adult-victory-dance-party-beat",
  mascots: "pass-one-PAWS-and-one-MAX-safe-play",
  oddProp: "pass-ECE-two-hands-on-opposite-compass-handles",
  routeMap: "pass-separate-hands-free-holographic-map",
  missionHandling: "reject-trigger-guard-and-straight-index-are-not-unambiguously-readable",
  missionTargetAxis: "reject-muzzle-is-nearly-touching-paper-without-broad-empty-air",
  accepted: false,
};

checkpoint.status = "active-four-scene-gate-clean-fresh-round-21-recovery-materialized";
checkpoint.checkpointedAt = materializedAt;
checkpoint.terminal = false;
checkpoint.renderAttempts.freshRound21 = {
  ...checkpoint.renderAttempts.freshRound21,
  status: "fresh-completed-rejected-recovery-materialized",
  freshCompletedAt: materializedAt,
  rawOutputs: {
    1551: {
      path: rawPath,
      sha256: expectedRawSha,
      preserved: true,
    },
  },
  freshStrictAudit: freshAudit,
  recoveryDecision: {
    attempted: true,
    reason: "Two localized failures remain: Ellie's hidden support forearm and Alia's compressed mission lane with unreadable trigger-index separation.",
    maximumRecoveryPasses: 1,
    recoveryPassNumber: 1,
    sourceRaw: rawPath,
  },
  recoveryPromptAudit: {
    path: path.relative(repo, promptPath).replaceAll("\\", "/"),
    sha256: sha256(recoveryPrompt),
    chars: recoveryPrompt.length,
    sourceMode: "single-targeted-recovery-from-clean-round-21-raw",
    sourceRaw: {
      path: rawPath,
      sha256: expectedRawSha,
    },
    priorBatumiRenderInputCount: 1,
    permittedSourceCount: 1,
    recoveryPass: 1,
    maximumRecoveryPasses: 1,
    boundedCorrections: [
      "make Ellie's support shoulder, white sleeve, elbow, forearm, wrist, and upper-back palm continuously traceable",
      "move Alia's compact inert replica closer to her torso, create broad muzzle-to-paper air, and show a straight outside index above an empty guard with separate support hand",
    ],
    preserveLocks: [
      "all four identities and wardrobe rolls",
      "exactly eight arms and eight hands",
      "Radiance explicit agreement and active party beat",
      "ECE two-hand compass ownership and hands-free route map",
      "Batumi landmarks, mascots, and clean natural photographic surface",
    ],
  },
};
checkpoint.scenePlans["1551"].freshRound21.freshVisualAudit = freshAudit;
checkpoint.scenePlans["1551"].freshRound21.recoveryPrompt = recoveryPrompt;
checkpoint.scenePlans["1551"].freshRound21.recoveryPromptSha256 = sha256(recoveryPrompt);
checkpoint.rawOutputs.push({
  scene: 1551,
  round: 21,
  kind: "clean-fresh-recovery-pending",
  path: rawPath,
  sourcePath: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-3e42b8e9-4d29-4c6b-b97a-4e40ad717510.png",
  sha256: expectedRawSha,
  dimensions: { width: 941, height: 1672 },
});
checkpoint.renderStrategyReset = {
  ...checkpoint.renderStrategyReset,
  activeCleanRound: 21,
  activeSourcePolicy: "single targeted recovery from clean round 21 raw only",
  priorBatumiRenderInputCount: 1,
};
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "launch-single-clean-fresh-round-21-recovery-scene-1551-only",
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
  nextWakeAction: checkpoint.nextWakeAction,
}, null, 2));
