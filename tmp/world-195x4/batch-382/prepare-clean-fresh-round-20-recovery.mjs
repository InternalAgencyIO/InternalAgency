import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const root = path.join(repo, "tmp/world-195x4/batch-382");
const checkpointPath = path.join(repo, "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json");
const contractPath = path.join(repo, "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const ledgerPath = path.join(repo, "assets/lore/starlight-era/world-x-publish-ledger.json");
const rawPath = "tmp/world-195x4/batch-382/raw/clean-fresh-round-20/scene-1551.png";
const handsQaPath = "tmp/world-195x4/batch-382/qa/clean-fresh-round-20-scene-1551-hands-crop.png";
const targetQaPath = "tmp/world-195x4/batch-382/qa/clean-fresh-round-20-scene-1551-target-crop.png";
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex").toUpperCase();
}

function sha256File(filePath) {
  return sha256(fs.readFileSync(filePath));
}

const expectedContractSha = "69EB6C84A2467A4234D901C3086ECECE9E583B55C41BB9382CD5ED523C482EF5";
const expectedLedgerSha = "B94AA3FB2B1AB1BCAB100CE689F0173C77407B82439D73379D8BC0FA3EEC2455";
const expectedRawSha = "B8076CA0DA60917A5235C2448400FCCAAB203B6194A3B8BB1CA7142C5D24C0D4";
if (sha256File(contractPath) !== expectedContractSha) throw new Error("Authoritative contract changed during round 20");
if (sha256File(ledgerPath) !== expectedLedgerSha) throw new Error("X publishing ledger changed during round 20");
if (sha256File(path.join(repo, rawPath)) !== expectedRawSha) throw new Error("Clean round 20 raw changed before recovery materialization");
if (checkpoint.status !== "active-four-scene-gate-clean-fresh-round-20-materialized") {
  throw new Error(`Unexpected checkpoint status: ${checkpoint.status}`);
}

const recoveryPrompt = `Use case: precise-object-edit.
Input: the supplied Georgia Batch 382 scene 1551 clean fresh round 20 raw.

ONE RECOVERY ONLY
This is the single allowed recovery for clean round 20. Edit only the clearly adult fictional Alia at the far right. Preserve the clean natural photographic surface. Do not redraw, reinterpret, or restyle the full image.

CORRECTION 1: ALIA'S STRAPLESS OPEN-BACK COUTURE
Remove only the thin metallic neck loop, every thin shoulder strap, every diagonal upper-back strap, and every crossing back band from Alia's copper top. Rebuild only the top edge as one secure opaque sculpted strapless copper bodice with a high straight front edge and wide continuous wraparound side panels. Both shoulders and the full upper back from shoulder blades to the existing secure high waist remain visibly bare, with no strap, sleeve, halter, collar, neckband, crossing band, fabric panel, or illusion mesh. Preserve complete opaque breast and side coverage, the existing restrained three-centimeter bare midriff band, the cobalt pleated skort, green conduits, boots, braided ponytail, face, body, stance, and respectful public-fashion framing.

CORRECTION 2: INDEXED TRIGGER FINGER
Keep the one rainbow-gradient short-barrel orange-plugged inert cinema-training pistol replica in exactly the same position, angle, scale, and two-hand grip. Straighten only Alia's primary trigger index so it lies fully extended and flat along the colored frame above and outside the trigger guard. Leave the trigger guard visibly empty. Preserve both existing hands, wrists, arms, elbows, shoulders, the orange muzzle, and the exact muzzle-to-diamond axis.

PRESERVE EVERY OTHER ELEMENT
Preserve Radiance, Ellie, and AI ECE pixel-faithfully, including all six of their arms and hands, the reciprocal Ellie-Radiance clasp, Ellie's back support, Radiance's palm on ECE's shoulder, Radiance's affirmative acceptance and rainbow hosiery, ECE's two compass hands, the hands-free holographic map, and the clean InternalAgency victory-dance party beat. Preserve Alia's two existing arms and two existing hands with no added or removed limb. Final anatomy remains exactly eight human arms and exactly eight human hands.
Preserve the heavy straight rain, Batumi skyline, Alphabet Tower, Ferris wheel, Black Sea, palms, wet flat tiles, transparent safety panel, complete sand backstop, one white paper, and one black route diamond. The orange muzzle center and black diamond center already share one horizontal row; do not move either one. Preserve exactly one tiny collarless golden kitten PAWS and one distinct small young golden retriever puppy MAX together on the dry lounge.

SURFACE AND SCOPE GATE
The only visible changes are removal of Alia's thin straps and straightening of her trigger index outside the guard. Add no person, limb, hand, animal, prop, decoration, crowd, drink, confetti, text, logo, or target. Add no wavy processing, liquify distortion, marbling, rippled skin, rippled fabric, melted edge, embossed contour, halo, excessive sharpening, bent architecture, or painterly texture. Keep one clean coherent photographic exposure.`;

const promptPath = path.join(root, "scene-1551-clean-fresh-round-20-recovery-prompt.txt");
fs.writeFileSync(promptPath, recoveryPrompt, "utf8");
const materializedAt = new Date().toISOString();
const freshAudit = {
  renderSurfaceQuality: "pass-clean-natural-photographic-texture-without-wavy-artifacts",
  identity: "pass-four-adult-identities-with-Alia-braids",
  anatomy: "pass-exactly-eight-visible-traceable-arms-and-eight-visible-traceable-hands",
  handOwnership: "pass-Ellie-two-Radiance-two-ECE-two-Alia-two",
  weather: "pass-heavy-straight-rain",
  locationThemeFusion: "pass-Batumi-and-Mars-expedition-couture",
  outfitOriginality: "pass-four-distinct-silhouettes-and-material-languages",
  rolledWardrobe: "reject-Alia-thin-neck-and-back-straps-violate-active-strapless-and-fully-open-back-rolls",
  romance: "pass-controlled-dip-three-clear-contacts-and-Radiance-ECE-affection-center",
  radianceAgreement: "pass-deliberate-reciprocal-clasp-and-voluntary-turn-toward-ECE-make-agreement-readable",
  partyActivation: "pass-restrained-four-adult-victory-dance-party-beat-without-decorative-clutter",
  mascots: "pass-one-PAWS-and-one-MAX-safe-play",
  oddProp: "pass-ECE-two-hands-on-opposite-compass-handles",
  routeMap: "pass-separate-hands-free-holographic-map",
  missionHandling: "reject-trigger-index-not-clearly-straight-outside-the-guard",
  missionTargetAxis: "pass-orange-muzzle-center-and-black-diamond-center-on-one-horizontal-row",
  accepted: false,
};

checkpoint.status = "active-four-scene-gate-clean-fresh-round-20-recovery-materialized";
checkpoint.checkpointedAt = materializedAt;
checkpoint.terminal = false;
checkpoint.renderAttempts.freshRound20 = {
  ...checkpoint.renderAttempts.freshRound20,
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
    reason: "Only two localized failures remain on Alia at far right: thin wardrobe straps and trigger-index placement. One bounded recovery is permitted from this clean raw.",
    maximumRecoveryPasses: 1,
    recoveryPassNumber: 1,
    sourceRaw: rawPath,
  },
  recoveryPromptAudit: {
    path: path.relative(repo, promptPath).replaceAll("\\", "/"),
    sha256: sha256(recoveryPrompt),
    chars: recoveryPrompt.length,
    sourceMode: "single-targeted-recovery-from-clean-round-20-raw",
    sourceRaw: {
      path: rawPath,
      sha256: expectedRawSha,
    },
    priorBatumiRenderInputCount: 1,
    permittedSourceCount: 1,
    recoveryPass: 1,
    maximumRecoveryPasses: 1,
    boundedCorrections: [
      "remove Alia's thin neck, shoulder, and back straps while preserving secure opaque strapless coverage and open back",
      "straighten Alia's primary trigger index along the colored frame outside the guard",
    ],
    preserveLocks: [
      "all four identities",
      "exactly eight arms and eight hands",
      "Radiance explicit agreement and active party beat",
      "muzzle-to-diamond axis",
      "clean natural photographic surface",
    ],
  },
};
checkpoint.scenePlans["1551"].freshRound20.freshVisualAudit = freshAudit;
checkpoint.scenePlans["1551"].freshRound20.recoveryPrompt = recoveryPrompt;
checkpoint.scenePlans["1551"].freshRound20.recoveryPromptSha256 = sha256(recoveryPrompt);
checkpoint.rawOutputs.push({
  scene: 1551,
  round: 20,
  kind: "clean-fresh-recovery-pending",
  path: rawPath,
  sourcePath: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-c66e7070-8aa9-4903-a81b-42759f66ec33.png",
  sha256: expectedRawSha,
  dimensions: { width: 941, height: 1672 },
});
checkpoint.renderStrategyReset = {
  ...checkpoint.renderStrategyReset,
  activeCleanRound: 20,
  activeSourcePolicy: "single targeted recovery from clean round 20 raw only",
  priorBatumiRenderInputCount: 1,
};
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "launch-single-clean-fresh-round-20-recovery-scene-1551-only",
  preserveAcceptedSceneNumbers: [1548, 1549, 1550],
  sceneNumbers: [1551],
  laterCountryStartAllowed: false,
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  status: checkpoint.status,
  rawSha256: expectedRawSha,
  handsQaSha256: sha256File(path.join(repo, handsQaPath)),
  targetQaSha256: sha256File(path.join(repo, targetQaPath)),
  recoveryPromptSha256: sha256(recoveryPrompt),
  nextWakeAction: checkpoint.nextWakeAction,
}, null, 2));
