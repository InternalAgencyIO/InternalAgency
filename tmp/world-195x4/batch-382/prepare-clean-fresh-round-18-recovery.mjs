import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const root = path.join(repo, "tmp/world-195x4/batch-382");
const checkpointPath = path.join(repo, "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json");
const contractPath = path.join(repo, "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const ledgerPath = path.join(repo, "assets/lore/starlight-era/world-x-publish-ledger.json");
const rawPath = "tmp/world-195x4/batch-382/raw/clean-fresh-round-18/scene-1551.png";
const handsQaPath = "tmp/world-195x4/batch-382/qa/clean-fresh-round-18-scene-1551-hands-crop.png";
const targetQaPath = "tmp/world-195x4/batch-382/qa/clean-fresh-round-18-scene-1551-target-crop.png";
const promptPath = path.join(root, "scene-1551-clean-fresh-round-18-recovery-prompt.txt");
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex").toUpperCase();
}

function sha256File(filePath) {
  return sha256(fs.readFileSync(filePath));
}

if (sha256File(contractPath) !== "F7B247DF3BCE256C2A0BB2B51EB282EC4E6FBC5FE8E85A17970F311F26138FEC") {
  throw new Error("Authoritative contract changed before clean round 18 recovery");
}
if (sha256File(ledgerPath) !== "B94AA3FB2B1AB1BCAB100CE689F0173C77407B82439D73379D8BC0FA3EEC2455") {
  throw new Error("X publishing ledger changed before clean round 18 recovery");
}
if (checkpoint.status !== "active-four-scene-gate-clean-fresh-round-18-materialized") {
  throw new Error(`Unexpected checkpoint status: ${checkpoint.status}`);
}

const rawSha256 = sha256File(path.join(repo, rawPath));
const handsQaSha256 = sha256File(path.join(repo, handsQaPath));
const targetQaSha256 = sha256File(path.join(repo, targetQaPath));
if (rawSha256 !== "57A809E37471F301292BFC761EE9EB81A7365F6A95D33F53289316D2A479E80D") {
  throw new Error("Clean round 18 raw changed before recovery materialization");
}

const prompt = `Use case: precise-object-edit.
Input image dimensions: 941 by 1672 pixels.
Asset: Georgia Batch 382 scene 1551 clean fresh round 18, single allowed recovery.

SOURCE AND PASS LIMIT
Edit only the supplied clean round 18 raw. This is the one and only recovery for this round. Preserve the clean natural photographic surface and coherent rain. Outside the two corrections below, preserve every face, body, intended limb, hand, garment, landmark, mascot, route map, compass, mission prop, safety panel, backstop, floor tile, reflection, lighting value, crop, and camera property exactly as supplied. Do not redraw the whole image.

CORRECTION 1: REMOVE ONE EXTRA RADIANCE ARM
Radiance currently has three arms. Delete only the unwanted third blue-sleeved arm that descends from Radiance toward the near-left edge of the compass table and ends as a flat palm on the tabletop. Remove that entire extra sleeve, extra forearm, extra wrist, extra palm, and extra finger cluster. Restore the clean blue dress edge, open air, and unchanged compass rim behind it.
Preserve Radiance's two intended arms exactly: her left arm remains fully extended to the far-left clasp with Ellie's right hand, and her right arm remains raised with its palm on ECE's near shoulder. Do not move or redraw either intended Radiance arm or hand. Preserve Ellie's two hands exactly: one clasped with Radiance and one supporting Radiance's upper back. Preserve ECE's two hands exactly, one on each tall brass compass handle. Preserve Alia's two hands exactly on the one inert mission-prop grip.
Final anatomy must be exactly eight human arms and exactly eight human hands, two per woman, all continuously traceable and visible.

CORRECTION 2: RAISE ONLY THE PAPER TARGET TWELVE PIXELS
On the far-right sand backstop, move the existing white paper square and its existing centered black route diamond straight upward by exactly twelve source-image pixels. Preserve their current size, shape, orientation, contrast, and backstop attachment. Do not move, tilt, resize, or redraw Alia, her two arms, either hand, the horizontal pistol, orange muzzle plug, safety glass, sand backstop, or any other object. After the twelve-pixel upward move, the black diamond center and orange muzzle center must share one exact horizontal source-image row with the same broad clean air gap. Keep Alia's trigger index straight along the colored frame outside the guard.

UNCHANGED ROLLS AND VISIBLE CONTRACT
Weather roll 35 = heavy rain curtain.
Radiance: emotion roll 56 = aching romantic longing; visible-midriff roll 98 = inactive; strapless roll 37 = inactive; fully-open-back roll 14 = ACTIVE.
Ellie: emotion roll 30 = hope; visible-midriff roll 8 = ACTIVE; strapless roll 59 = inactive; fully-open-back roll 64 = inactive.
Alia: emotion roll 38 = magnetic confidence; visible-midriff roll 40 = ACTIVE; strapless roll 3 = ACTIVE; fully-open-back roll 16 = ACTIVE.
AI ECE: emotion roll 92 = guilt and remorse; visible-midriff roll 58 = inactive; strapless roll 53 = inactive; fully-open-back roll 58 = inactive.
Pole-theme roll 67 = inactive. Rainbow-only roll 15 = inactive. Rainbow-hosiery roll 14 = ACTIVE; wearer selector roll 38 = Radiance; palette selector roll 54 = original independent rainbow gradient.
Romance roll 86 and compound-love roll 28 remain materialized through the preserved pursuit, proximity, and exact contact graph. Hard-love roll 40 = a controlled dance dip with stable planted feet and supported back, a second partner catching the dipped adult's free hand, and the fourth answering with visible jealousy or invitation.
Mascot roll 15 = exactly one tiny collarless golden kitten PAWS and one distinct small young golden retriever puppy MAX together on the dry padded lounge.
Odd-prop roll 12 = ACTIVE; holder selector roll 86 = AI ECE; family selector roll 88 = one oversized magnetic compass table. Preserve ECE's two hands on its opposite handles and the separate hands-free blue holographic route map.
Pose-target roll 25 = Alia alone uses the safe two-hand stance toward one plain non-humanoid paper route diamond on a complete sand backstop. Male selector = inactive; exactly four clearly adult fictional women and no fifth adult.

UNCHANGED LOCATION, FASHION, AND SAFETY
Preserve Batumi Boulevard, Black Sea, Alphabet Tower, Ferris wheel, palms, Adjara skyline, heavy straight rain, and Mars-surface expedition couture. Preserve Radiance's cobalt high-low sheath, open-back construction, and sole opaque rainbow knee socks; Ellie's white fan-sleeve jumpsuit and restrained midriff band; Alia's copper strapless origami tabard, restrained midriff band, open-back construction, and cobalt skort; ECE's fully covered basalt peplum jacket and gold trousers. Preserve the single full-size polished rainbow-gradient large-frame inert cinema-training pistol replica with orange muzzle plug. No ammunition, firing, muzzle flash, threat, injury, combat, or aiming at any person, animal, occupied object, or camera.

FINAL SURFACE AND SCOPE GATE
Keep straight architecture, flat tiles, clean glass, smooth skin transitions, crisp seams, coherent sand, and straight rainfall. Add no waves, marbling, ripples, liquify distortion, melted edge, embossed contour, halo, crunchy texture, bent geometry, extra object, extra target, extra arm, extra hand, or painterly processing. The only visible differences from the supplied raw are removal of the one extra blue-sleeved Radiance arm and the twelve-pixel upward relocation of the existing paper target.`;

fs.writeFileSync(promptPath, prompt, "utf8");
const promptAudit = {
  path: path.relative(repo, promptPath).replaceAll("\\", "/"),
  sha256: sha256(prompt),
  chars: prompt.length,
  storedRollsChanged: false,
  sourceMode: "single-targeted-recovery-from-clean-round-18-raw",
  sourceRaw: { path: rawPath, sha256: rawSha256 },
  priorBatumiRenderInputCount: 1,
  permittedSourceCount: 1,
  recoveryPass: 1,
  maximumRecoveryPasses: 1,
  boundedCorrections: [
    "remove one extra blue-sleeved Radiance arm and palm from compass table",
    "raise existing paper target and diamond exactly twelve source pixels",
  ],
  preservedIntendedHandGraph: {
    Ellie: ["Radiance hand clasp", "Radiance upper-back support"],
    Radiance: ["Ellie hand clasp", "ECE near shoulder"],
    ECE: ["left compass handle", "right compass handle"],
    Alia: ["mission grip support", "mission grip primary"],
  },
  cleanSurfaceGate: "preserve clean fresh raw; reject any wavy edit residue",
};
const preparedAt = new Date().toISOString();
checkpoint.status = "active-four-scene-gate-clean-fresh-round-18-recovery-materialized";
checkpoint.checkpointedAt = preparedAt;
checkpoint.scenePlans["1551"].freshRound18Recovery = { ...promptAudit, prompt };
checkpoint.renderAttempts.freshRound18 = {
  ...checkpoint.renderAttempts.freshRound18,
  status: "fresh-completed-rejected-recovery-materialized",
  completedAt: preparedAt,
  rawOutputs: {
    1551: { path: rawPath, sha256: rawSha256, preserved: true },
  },
  acceptedSceneNumbers: [],
  rejectedSceneNumbers: [1551],
  rejectionReasons: {
    1551: [
      "Radiance has one extra blue-sleeved third arm ending as a palm on the compass table",
      "the black paper-diamond center sits approximately twelve pixels below the orange muzzle-center row",
    ],
  },
  strictAudit: {
    renderSurfaceQuality: "pass-clean-natural-photographic-texture-without-wavy-artifacts",
    identity: "pass-four-adult-identities-with-Alia-braids",
    anatomy: "reject-nine-visible-arms-and-nine-visible-hands-due-one-extra-Radiance-limb",
    handOwnership: "pass-all-eight-intended-hands-plus-one-clearly-isolated-extra-Radiance-hand",
    weather: "pass-heavy-straight-rain",
    locationThemeFusion: "pass-Batumi-and-Mars-expedition-couture",
    outfitOriginality: "pass-four-distinct-fingerprints",
    rolledWardrobe: "pass-Radiance-rainbow-hosiery-and-open-back-Ellie-midriff-Alia-strapless-midriff-open-back",
    romance: "pass-controlled-dip-and-three-clear-intended-contact-points",
    mascots: "pass-one-PAWS-and-one-MAX-safe-play",
    oddProp: "pass-ECE-two-hands-on-opposite-compass-handles",
    routeMap: "pass-separate-hands-free-holographic-map",
    missionHandling: "pass-two-Alia-hands-single-target-complete-backstop-clean-air-gap-and-indexed-trigger",
    missionTargetAxis: "reject-black-diamond-center-approximately-twelve-pixels-below-orange-muzzle-center-row",
    qaCrops: {
      hands: { path: handsQaPath, sha256: handsQaSha256 },
      target: { path: targetQaPath, sha256: targetQaSha256 },
    },
    accepted: false,
  },
};
checkpoint.renderAttempts.freshRound18Recovery = {
  status: "materialized-pending-launch",
  preparedAt,
  sceneNumbers: [1551],
  promptAudit: { 1551: promptAudit },
  sourceRaw: { path: rawPath, sha256: rawSha256 },
  maximumRecoveryPassesPerBlockedScene: 1,
  recoveryPassNumber: 1,
};
checkpoint.xBacklogAudit = {
  ...checkpoint.xBacklogAudit,
  checkedAt: preparedAt,
  eligibleBacklogRemaining: 0,
  reconciliationDecision: "Honduras remains publicly verified. Georgia remains X-blocked while the one clean round 18 recovery is pending.",
};
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "launch-one-clean-fresh-round-18-recovery-from-clean-round-18-raw-scene-1551-only",
  preserveAcceptedSceneNumbers: [1548, 1549, 1550],
  sceneNumbers: [1551],
  laterCountryStartAllowed: false,
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ status: checkpoint.status, rawSha256, handsQaSha256, targetQaSha256, promptAudit }, null, 2));
