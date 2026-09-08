"use strict";
// Pure local preparation only. Never submits to providers or posts to X.
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const contract = require("../../assets/lore/starlight-era/starlight-editorial-rolls-2026-09-06.json");
const characters = ["Alia", "Radiance", "Ellie", "ECE"];
const sha256 = value => createHash("sha256").update(value, "utf8").digest("hex").toUpperCase();

function draw(key, size = 100) {
  if (!Number.isInteger(size) || size < 1 || size > 256) throw new Error("Invalid draw size");
  const limit = Math.floor(256 / size) * size;
  for (let block = 0; ; block++) {
    const material = block ? `${key}|digest-block-${block}` : key;
    const digest = createHash("sha256").update(material, "utf8").digest();
    for (let index = 0; index < digest.length; index++) {
      if (digest[index] < limit) return { key, block, byteIndex: index, byte: digest[index], value: digest[index] % size + 1 };
    }
  }
}
function chance(key, percent) {
  if (!Number.isInteger(percent) || percent < 0 || percent > 100) throw new Error("Invalid percent");
  const result = draw(key);
  return { ...result, percent, active: result.value <= percent };
}
function shuffle(values, key) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index--) {
    const swap = draw(`${key}|shuffle-${index}`, index + 1).value - 1;
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}
function cameraCategory(roll) {
  const match = contract.camera.mapping.find(x => roll >= x.min && roll <= x.max);
  if (!match) throw new Error("Camera roll outside 1..100");
  return match.label;
}
const poseText = {
  "supported-seated-conversation": "Alia sits sideways on the left end of a broad low bench and catches Radiance's offered hand as Radiance settles onto a higher adjacent cushion. Ellie leans forward from behind the bench with a playful smile; ECE perches on a separate stool to the right and touches Ellie's shoulder. Different elevations and torso directions, an event in progress, no standing row.",
  "head-resting-on-clothed-lap": "Alia rests her supported head and neck sideways on Radiance's fully clothed lap across a broad padded public lounge bench, her face to the left of Radiance's. Radiance leans down affectionately. Ellie crouches beside the bench to offer a hand while ECE sits on a higher adjoining seat and wraps an arm around Ellie's shoulders. Keep the four faces distinct, relaxed and readable; no straddling or intimate contact.",
  "back-hug-turn": "Radiance stands behind seated Alia with her face offset above and to Alia's right, gives a gentle upper-body back hug, and Alia turns back smiling. Ellie steps into the foreground on the right and catches ECE's hand; ECE leans in from behind a separate bench. Staggered depth and an unfinished turning motion, never four parallel bodies.",
  "side-hug-step": "Alia and Radiance step diagonally through a warm side hug, Alia a half step lower and closer to the camera. Ellie sits sideways on a low architectural bench and reaches toward Radiance, while ECE leans around Ellie's shoulder for a temple greeting. Asymmetric negative space and crossing eye lines; no equally spaced catalogue stance."
};
function buildScene({ seed, scene, index, location, country, shoes, poses, angles }) {
  const key = `${seed}|scene-${scene}`;
  const cameraRoll = draw(`${key}|camera`);
  const camera = cameraCategory(cameraRoll.value);
  const imageRolls = Object.fromEntries(Object.entries(contract.retainedImageRolls).map(([field, percent]) => [field, chance(`${key}|image|${field}`, percent)]));
  const cast = characters.map((character, ci) => {
    const prefix = `${key}|character|${character}`;
    const tattoos = Object.fromEntries(contract.tattoos.motifs.map(motif => [motif, chance(`${prefix}|tattoo|${motif}`, 4)]));
    return { character, shoeType: shoes[(index + ci) % shoes.length], rainbowShoes: chance(`${prefix}|rainbow-shoes`, 35), shoeBranding: chance(`${prefix}|shoe-branding`, 40), shoeBrandStyle: draw(`${prefix}|shoe-brand-style`, 2).value === 1 ? "RAZE text" : "original RAZE split-star", flagGarment: chance(`${prefix}|flag-garment`, 33), visibleNavel: chance(`${prefix}|visible-navel`, 45), stockingBranding: chance(`${prefix}|stocking-branding`, 32), tattoos, activeTattoos: Object.keys(tattoos).filter(m => tattoos[m].active) };
  });
  const framing = camera === "extreme-close"
    ? "A genuine tight face-and-shoulder editorial crop: the four faces form an overlapping diagonal composition at different depths. Lower bodies and shoes may be outside the frame. Do not pull back to show feet or hems. The location is a soft contextual fragment, not a full panorama."
    : camera === "intermediate"
      ? "A genuine close waist-to-thigh or seated three-quarter editorial frame, selected to make the relationship action and garment construction readable. A foreground shoe can appear through seated foreshortening, but never widen the crop merely to fit eight shoes."
      : "A true environmental extreme-wide vertical frame with the location dominating and the quartet distributed across different supported seated and standing levels. Keep the affectionate event legible in the scene; do not arrange a distant straight row.";
  const tattooName = motif => motif === "country-death-motif" ? location.deathMotif : motif === "country-love-motif" ? location.loveMotif : (contract.tattoos.labels[motif] || motif.replaceAll("-", " "));
  const wardrobe = cast.map((c, ci) => {
    const design = c.flagGarment.active ? `a fitted mini dress integrating the complete ${country} flag design (${location.flagDescription}) across the garment with correct layout` : location.wardrobes[ci];
    const shoe = `${c.rainbowShoes.active ? "rainbow-gradient" : location.shoeFinishes[ci]} ${c.shoeType.replaceAll("-", " ")} ${c.shoeBranding.active ? `with one subtle ${c.shoeBrandStyle} mark` : "without any branding"}`;
    const marks = c.activeTattoos.length ? `Prominent crisp tattoos: ${c.activeTattoos.map(tattooName).join("; ")}, separated on visible non-intimate upper arm, shoulder or outer calf; prioritize a visible upper arm or shoulder in a close crop.` : "No tattoos.";
    return `${c.character}: ${design}; secure open-back or side-back construction and bare arms, ${c.visibleNavel.active ? "a tasteful cropped or waist-cutout section revealing the navel" : "covered midriff"}; ${shoe}. ${marks}${c.stockingBranding.active ? " If stockings are visible, place one small original RAZE star stocking mark; this is not a tattoo." : ""}`;
  }).join(" ");
  const hosiery = imageRolls.kneeHighRainbows.active ? "Visible hosiery uses knee-high rainbow gradients; this image roll is independent of shoe color." : imageRolls.rainbowStockings.active ? "Visible hosiery uses rainbow stockings; this is independent of shoe color." : imageRolls.kneeHighHosiery.active ? "Use color-coordinated knee-high hosiery when legs are in frame." : "No general hosiery assignment; only individual stocking marks may call for a neutral stocking.";
  const trim = [imageRolls.starHardware.active && "small geometric star clasps", imageRolls.splitStarEmblem.active && "an original split-star garment panel", imageRolls.razeTypeBand.active && "one narrow exact RAZE garment type band"].filter(Boolean);
  const background = imageRolls.fictionalDistantRazedBackground.active ? "A clearly fictional distant uninhabited background includes fires, smoke and a mushroom-shaped cloud, with no victims, gore or immediate danger; the adults remain focused on their affectionate event. Keep this subordinate to the rolled crop and disclose synthetic imagery on publication." : "Keep the background intact, no fire or destruction.";
  const tilt = 9 + draw(`${key}|dutch-tilt`, 16).value;
  const sceneResult = { scene, location: location.name, camera: { ...cameraRoll, category: camera, angle: angles[index], dutchDegrees: tilt, framing }, pose: poses[index], imageRolls, characters: cast };
  sceneResult.prompt = `SCENE ${scene}: ${country.toUpperCase()}. Create one new photorealistic vertical 9:16 adult high-fashion editorial. The three attached project-owned AI-fictional continuity references are ordered 938, 936, 937; use each once for facial identity, never their poses or clothes. Exactly four fictional adult women age21: Black Alia, blonde Radiance, dark-haired Ellie, brunette AI ECE. Preserve distinct facial continuity and viewer-left to right face identity order, with bodies in asymmetric supported positions, not a row. ${location.setting} Camera roll ${cameraRoll.value}/100: ${camera.toUpperCase()}, ${angles[index]} viewpoint and intentional ${tilt}-degree Dutch tilt. ${framing} ${poseText[poses[index]]} ${wardrobe} ${hosiery} ${trim.length ? `Garment trim assignments: ${trim.join(", ")}; do not override independent shoe branding.` : "No extra garment star clasps, split-star panels or type bands."} ${background} Garments are sharply short, fitted and fully opaque with secure lining and complete intimate coverage. Attractive confident fashion, expressive affection and natural anatomy. No nudity, underwear exposure, upskirt or intimate-area camera aim, sexual acts, weapons, bystanders, unrelated logos, captions, borders or watermark. Do not claim designer death or love motifs are authentic traditional national symbols.`;
  sceneResult.promptSha256 = sha256(sceneResult.prompt);
  sceneResult.promptCharacters = sceneResult.prompt.length;
  sceneResult.singleEditPrompt = `One identity-preserving clothing-only tailoring pass for scene ${scene}: substantially shorten mini hems to a wearable upper-thigh silhouette with secure opaque coverage; open the back or side-back garment construction where visible, bare the arms, and preserve legwear and independently rolled shoes. Midriff assignments: ${cast.map(c => `${c.character}=${c.visibleNavel.active ? "visible navel" : "covered"}`).join(", ")}. Preserve the recorded complete flag garment designs, tattoo motif assignments, all four faces and adult ages, body proportions, expressions, poses, contact ownership, camera crop and perspective, lighting and location. Do not widen an extreme-close crop to show shoes or turn bodies to reveal hidden backs. Keep existing correct details; no nudity, exposure or erotic framing. Output one image, no further pass.`;
  sceneResult.singleEditPrompt += ` Apply these exact per-character styling rolls in this same one invocation, retaining correct details and realizing missing selected garment, shoe or tattoo details without altering anatomy: ${wardrobe} ${hosiery}`;
  sceneResult.singleEditPromptSha256 = sha256(sceneResult.singleEditPrompt);
  return sceneResult;
}
function buildBank(brief) {
  if (!Number.isInteger(brief.batch) || !Number.isInteger(brief.firstScene) || !brief.country || brief.locations?.length !== 4) throw new Error("Provide batch, country, firstScene and four locations");
  const seed = `${contract.id}|batch-${brief.batch}|${brief.country.toLowerCase()}`;
  const shoes = shuffle(contract.shoes.types, `${seed}|shoe-deck`);
  const poses = shuffle(contract.poses.deck, `${seed}|pose-deck`);
  const angles = shuffle(contract.camera.angleDeck, `${seed}|angle-deck`);
  return { schemaVersion: 1, batch: brief.batch, country: brief.country, state: "prepared-offline-not-dispatched", contract: contract.id, seed, seedSelection: "Fixed; no outcome search or reroll", provider: "Meta", accountRequired: "leesha007", mode: "Thinking", anchorOrder: [938, 936, 937], browserDispatchCount: 0, editInvocationCount: 0, shoeDeck: shoes, poseDeck: poses, angleDeck: angles, scenes: brief.locations.map((location, index) => buildScene({ seed, scene: brief.firstScene + index, index, location, country: brief.country, shoes, poses, angles })), nextSafeAction: "Inspect actual in-app tabs and current remote authority. Attach exact anchors and verify every composer before one Send. Never treat offline preparation as a provider receipt." };
}
module.exports = { draw, chance, shuffle, cameraCategory, buildBank, sha256 };
if (require.main === module) {
  const briefPath = process.argv[2];
  if (!briefPath) throw new Error("Usage: node scripts/starlight/editorial-rolls.cjs <brief.json>");
  process.stdout.write(JSON.stringify(buildBank(JSON.parse(fs.readFileSync(path.resolve(briefPath), "utf8"))), null, 2) + "\n");
}
