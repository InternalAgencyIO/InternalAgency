import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const root = path.join(repo, "tmp/world-195x4/batch-382");
const checkpointPath = path.join(repo, "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json");
const contractPath = path.join(repo, "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const ledgerPath = path.join(repo, "assets/lore/starlight-era/world-x-publish-ledger.json");
const rawPath = "tmp/world-195x4/batch-382/raw/clean-fresh-round-17/scene-1551.png";
const handsQaPath = "tmp/world-195x4/batch-382/qa/clean-fresh-round-17-scene-1551-hands-crop.png";
const targetQaPath = "tmp/world-195x4/batch-382/qa/clean-fresh-round-17-scene-1551-target-crop.png";
const promptPath = path.join(root, "scene-1551-clean-fresh-round-17-recovery-prompt.txt");
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex").toUpperCase();
}

function sha256File(filePath) {
  return sha256(fs.readFileSync(filePath));
}

if (sha256File(contractPath) !== "F7B247DF3BCE256C2A0BB2B51EB282EC4E6FBC5FE8E85A17970F311F26138FEC") {
  throw new Error("Authoritative contract changed before clean round 17 recovery");
}
if (sha256File(ledgerPath) !== "B94AA3FB2B1AB1BCAB100CE689F0173C77407B82439D73379D8BC0FA3EEC2455") {
  throw new Error("X publishing ledger changed before clean round 17 recovery");
}
if (checkpoint.status !== "active-four-scene-gate-clean-fresh-round-17-safety-retry-materialized") {
  throw new Error(`Unexpected checkpoint status: ${checkpoint.status}`);
}

const rawSha256 = sha256File(path.join(repo, rawPath));
const handsQaSha256 = sha256File(path.join(repo, handsQaPath));
const targetQaSha256 = sha256File(path.join(repo, targetQaPath));
if (rawSha256 !== "04AA9900E9DC50649DCF50396C828969AECDDCFDA24F5C2AF70A52DBFC6DBB60") {
  throw new Error("Clean round 17 raw changed before recovery materialization");
}

const prompt = `Use case: precise-object-edit.
Input image dimensions: 941 by 1672 pixels.
Asset: Georgia Batch 382 scene 1551 clean fresh round 17, single allowed recovery.

SOURCE AND PASS LIMIT
Edit only the supplied clean round 17 raw. This is the one and only recovery pass for this round. Preserve the source's clean photographic surface. Do not introduce waves, marbling, ripples, liquify distortion, melted edges, embossed contours, halos, crunchy texture, bent architecture, bent safety glass, or painterly processing. Outside the four corrections below, keep every pixel-level subject, face, garment, landmark, mascot, weather detail, floor tile, reflection, backstop, and camera property unchanged.

FOUR CORRECTIONS ONLY
1. ECE HANDS: Remove only ECE's current left hand and forearm from Radiance's waist. Rebuild that same left forearm naturally downward to the compass so ECE's left hand closes visibly around the left compass handle. Preserve ECE's existing right hand on the right compass handle. ECE therefore owns exactly two hands and both are exclusively on opposite compass handles.
2. RADIANCE RETURN CONTACT: Reveal Radiance's currently hidden second forearm and open palm reaching backward to rest clearly on Ellie's outer shoulder. Preserve Radiance's existing visible palm on ECE's near shoulder. Radiance therefore owns exactly two hands: one on Ellie and one on ECE. Keep Ellie's two existing hands visibly supporting Radiance at upper back and waist.
3. HANDS-FREE ROUTE MAP: Add one small, crisp, translucent blue holographic route map hovering ten centimeters above the center of the compass table. It is supported by the table, not by a hand. Show a simple coastline and three route nodes with no readable text, no logo, and no extra device. Do not obscure either ECE hand or any face.
4. TARGET ROW: Move the existing white paper square and its black diamond straight upward on the same sand backstop until the exact black-diamond center is on the same visible horizontal row as the orange muzzle center. Preserve the paper size, diamond size, backstop, broad clean air gap, horizontal pistol, Alia's two-hand stance, and safety panels. Make Alia's trigger index plainly straight along the colored frame outside the guard.

EXACT FINAL HAND INVENTORY
Exactly eight human arms and eight human hands, two per woman. Ellie: one palm on Radiance's upper back and one on Radiance's waist. Radiance: one palm on Ellie's outer shoulder and one on ECE's near shoulder. ECE: one hand on each compass handle. Alia: two separated hands on the single mission-prop grip. Every elbow, forearm, wrist, palm, and finger cluster is continuously traceable to one owner and visible against a contrasting surface. Add no hand and hide no hand.

UNCHANGED DETERMINISTIC SCENE FIELDS
Weather roll 35 = heavy rain curtain.
Radiance: emotion roll 56 = aching romantic longing; visible-midriff roll 98 = inactive; strapless roll 37 = inactive; fully-open-back roll 14 = ACTIVE.
Ellie: emotion roll 30 = hope; visible-midriff roll 8 = ACTIVE; strapless roll 59 = inactive; fully-open-back roll 64 = inactive.
Alia: emotion roll 38 = magnetic confidence; visible-midriff roll 40 = ACTIVE; strapless roll 3 = ACTIVE; fully-open-back roll 16 = ACTIVE.
AI ECE: emotion roll 92 = guilt and remorse; visible-midriff roll 58 = inactive; strapless roll 53 = inactive; fully-open-back roll 58 = inactive.
Pole-theme roll 67 = inactive. Rainbow-only roll 15 = inactive. Rainbow-hosiery roll 14 = ACTIVE; wearer selector roll 38 = Radiance; palette selector roll 54 = original independent rainbow gradient.
Romance roll 86 = Alia spins Radiance under linked hands while ECE steadies Radiance and Ellie reaches toward the beacon; use this only as emotional pursuit and movement influence.
Compound-love roll 28 = ECE stays close at Radiance's side while greeting Ellie warmly and Alia answers beside them; resolve all physical contact through the exact eight-hand inventory.
Hard-love roll 40 = stable controlled dance dip, caught free hand, fourth partner's jealousy or invitation.
Mascot roll 15 = exactly one tiny collarless golden kitten PAWS and one distinct small young golden retriever puppy MAX together on the existing dry padded lounge.
Odd-prop roll 12 = ACTIVE; holder selector roll 86 = AI ECE; family selector roll 88 = one oversized magnetic compass table.
Pose-target roll 25 = Alia alone uses the safe two-hand stance toward one plain non-humanoid paper route diamond on a complete sand backstop.
Male selector = inactive; exactly four clearly adult fictional women and no fifth adult.

UNCHANGED FASHION, LOCATION, AND SAFETY
Preserve the four distinct source outfits: Radiance's cobalt high-low aerobrake-halo sheath and sole opaque rainbow knee socks; Ellie's white solar-foil fan-sleeve jumpsuit; Alia's copper dust-shield origami tabard with cobalt pleated skort; ECE's basalt segmented peplum jacket and solar-gold trousers. Preserve the rolled conservative opaque tailoring exactly as shown. Preserve real Batumi Boulevard, Black Sea, Alphabet Tower, Ferris wheel, palms, Adjara skyline, heavy straight rain, and the Mars-expedition construction language. Preserve the single full-size polished rainbow-gradient large-frame inert cinema-training pistol replica with orange muzzle plug. No ammunition, firing, muzzle flash, threat, injury, combat, person targeting, animal targeting, occupied-object targeting, or camera targeting.

FINAL ACCEPTANCE FRAME
Keep the same eye-level full-body 9:16 composition and clean natural fashion-photography finish. The controlled relationship dip remains the first read; the exact eight hands, separate hands-free blue route map, ECE's two compass hands, Alia's safe indexed trigger finger, and muzzle-to-diamond center row must all be plainly readable at normal size.`;

fs.writeFileSync(promptPath, prompt, "utf8");
const promptAudit = {
  path: path.relative(repo, promptPath).replaceAll("\\", "/"),
  sha256: sha256(prompt),
  chars: prompt.length,
  storedRollsChanged: false,
  sourceMode: "single-targeted-recovery-from-clean-round-17-raw",
  sourceRaw: { path: rawPath, sha256: rawSha256 },
  priorBatumiRenderInputCount: 1,
  permittedSourceCount: 1,
  recoveryPass: 1,
  maximumRecoveryPasses: 1,
  boundedCorrections: [
    "ECE left hand to left compass handle",
    "Radiance second palm to Ellie outer shoulder",
    "hands-free holographic route map above compass",
    "paper target raised to muzzle-center row and trigger index clarified",
  ],
  cleanSurfaceGate: "preserve clean fresh raw; reject any wavy edit residue",
};
const preparedAt = new Date().toISOString();
checkpoint.status = "active-four-scene-gate-clean-fresh-round-17-recovery-materialized";
checkpoint.checkpointedAt = preparedAt;
checkpoint.scenePlans["1551"].freshRound17Recovery = { ...promptAudit, prompt };
checkpoint.renderAttempts.freshRound17 = {
  ...checkpoint.renderAttempts.freshRound17,
  status: "fresh-completed-rejected-recovery-materialized",
  completedAt: preparedAt,
  rawOutputs: {
    1551: { path: rawPath, sha256: rawSha256, preserved: true },
  },
  acceptedSceneNumbers: [],
  rejectedSceneNumbers: [1551],
  rejectionReasons: {
    1551: [
      "ECE's left hand remains on Radiance's waist instead of the left compass handle",
      "Radiance's required return palm on Ellie's outer shoulder is not visibly traceable",
      "the separate hands-free holographic route map is absent",
      "the black paper-diamond center sits below the orange muzzle-center row",
    ],
  },
  strictAudit: {
    renderSurfaceQuality: "pass-clean-natural-photographic-texture-without-wavy-artifacts",
    identity: "pass-four-adult-identities-with-Alia-braids",
    anatomy: "reject-one-required-Radiance-hand-not-visibly-traceable",
    weather: "pass-heavy-straight-rain",
    locationThemeFusion: "pass-Batumi-and-Mars-expedition-couture",
    outfitOriginality: "pass-four-distinct-fingerprints",
    rolledWardrobe: "pass-Radiance-rainbow-hosiery-and-open-back-Ellie-midriff-Alia-strapless-midriff-open-back",
    romance: "reject-incomplete-stored-contact-map",
    mascots: "pass-one-PAWS-and-one-MAX-safe-play",
    oddProp: "reject-ECE-only-one-hand-on-compass",
    routeMap: "reject-separate-hands-free-holographic-map-absent",
    missionHandling: "pass-two-Alia-hands-single-target-complete-backstop-and-clean-air-gap; trigger-index-clarity-requires-recovery",
    missionTargetAxis: "reject-paper-diamond-center-below-orange-muzzle-center-row",
    qaCrops: {
      hands: { path: handsQaPath, sha256: handsQaSha256 },
      target: { path: targetQaPath, sha256: targetQaSha256 },
    },
    accepted: false,
  },
};
checkpoint.renderAttempts.freshRound17Recovery = {
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
  reconciliationDecision: "Honduras remains publicly verified. Georgia remains X-blocked while the one clean round 17 recovery is pending.",
};
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "launch-one-clean-fresh-round-17-recovery-from-clean-round-17-raw-scene-1551-only",
  preserveAcceptedSceneNumbers: [1548, 1549, 1550],
  sceneNumbers: [1551],
  laterCountryStartAllowed: false,
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ status: checkpoint.status, rawSha256, handsQaSha256, targetQaSha256, promptAudit }, null, 2));
