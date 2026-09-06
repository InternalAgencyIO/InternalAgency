import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve("tmp/world-195x4/batch-319");
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex").toUpperCase();

const directives = {
  1296: [
    "Fresh restrained public-safe recovery recreation of the Durmitor and Black Lake scene after the first renderer returned no image.",
    "Preserve the four established adult faces, rare aurora, complete lake and peaks, exact rolled cuts, large Montenegro motifs, ECE-only Montenegro-palette rainbow hosiery, Alia-only prop handling, and the distinct emotional performances.",
    "Show exactly four adults, eight arms, and eight hands. Fan the cast into a shallow crescent with lake, pale sky, forest, or mountain gaps behind every limb so each arm traces continuously from its own shoulder through elbow and wrist to one separated hand.",
    "Make the exact inventory literal: Alia right supports only the flat paddle; Alia left touches Ellie's forearm; ECE right gently guides Alia's supporting wrist; ECE left links Radiance right; Radiance left touches ECE shoulder; Ellie left touches Radiance waist; Ellie right touches Alia shoulder. No substitute, hidden, or additional hands.",
    "Place a large bright blue hands-free holographic Montenegro route map floating above ECE's left shoulder, separate from the inert prop and unobstructed against the lake.",
    "Keep the inert rainbow-gradient cinema prop fully on the flat opaque paddle in side profile, muzzle unmistakably left across empty Black Lake water away from every person, trail, tree, animal, and camera; magazine absent and no finger near grip or guard.",
    "Turn Radiance, Ellie, and Alia three-quarter-back with hair moved fully forward so all three complete open backs remain visible with their full adult faces. ECE alone wears one pair of opaque Montenegro-palette rainbow-gradient stockings; no other hosiery, kitten, pole, or rainbow-only wardrobe.",
  ].join(" "),
  1297: [
    "Fresh restrained recovery recreation of the Kotor fortified-bay scene.",
    "Correct the missing route map and hidden hand ownership while preserving the quartet, coastal sea mist, complete wall system and bay, exact rolled cuts, large Montenegro motifs, Radiance-only independent rainbow hosiery, and Alia-only prop handling.",
    "Show exactly four adults, eight arms, and eight hands. Keep every shoulder, elbow, wrist, and hand continuously traceable against water, pale mist, wall gaps, or limestone slopes.",
    "Make the exact inventory literal: Alia left supports only the flat paddle; Alia right touches ECE forearm; ECE right gently guides Alia's supporting wrist; ECE left links Radiance right; Radiance left touches ECE upper back; Ellie left touches Radiance shoulder; Ellie right touches Alia shoulder. Keep Radiance's two hands and Alia's two hands fully visible and separated.",
    "Place a large bright blue hands-free holographic Montenegro route map floating above ECE's left shoulder, separate from the prop and unobstructed against the bay.",
    "Keep the inert rainbow-gradient cinema prop fully on the flat opaque paddle in clean side profile, muzzle unmistakably right across empty bay water away from every person, wall, quay, boat, animal, and camera; magazine absent and no finger near it.",
    "Preserve Alia's secure strapless visible waist panel and complete open back. Radiance alone wears one pair of opaque original independent rainbow-gradient stockings. No other hosiery, kitten, pole, or rainbow-only wardrobe.",
  ].join(" "),
  1298: [
    "Fresh restrained recovery recreation of the Tara gorge and Djurdjevica bridge scene.",
    "Correct the male eye line, missing route map, and exact ten-owner hand inventory while preserving the five established adult faces, heavy rain curtain, complete five-arch bridge, exact rolled cuts, and large Montenegro motifs.",
    "Show exactly five adults, ten arms, and ten hands, two per adult. Fan the cast widely with pale rain, bridge arches, canyon air, river, or forest gaps behind every arm so every limb remains continuously traceable.",
    "Place ECE far left, the male left-center, Ellie center, Alia right-center, and Radiance far right. Turn the male's entire face and both pupils strongly left toward ECE as his unmistakable primary eye line. Ellie looks toward Alia, Radiance looks toward Alia, and Alia looks toward the empty canyon route so no competing gaze dominates.",
    "Make the exact inventory literal: ECE right supports only the flat paddle; ECE left touches male forearm; male left touches ECE shoulder; male right touches Ellie forearm; Ellie left touches male forearm; Ellie right links Alia left; Alia right touches Radiance waist; Radiance left touches Alia upper arm; Radiance right touches male upper arm. Keep both male hands and every linked hand fully visible.",
    "Place a large bright blue hands-free holographic Montenegro route map floating above ECE's left shoulder, separate from the prop and visible against the rain.",
    "Keep the inert rainbow-gradient cinema prop fully on the flat opaque paddle in side profile, muzzle unmistakably left across empty Tara water away from the bridge, every person, forest, animal, and camera; magazine absent and no finger near it.",
    "Preserve Ellie's complete open back and all secure opaque above-knee silhouettes. No hosiery, kitten, pole, or rainbow-only wardrobe.",
  ].join(" "),
  1299: [
    "Fresh restrained recovery recreation of the Skadar Lake and Rijeka Crnojevica PAWS scene.",
    "Correct the hidden Radiance and Ellie open backs and the kitten-ribbon ambiguity while preserving the quartet, clear golden hour, rainbow-only outfits, large Montenegro motifs, ECE route map and prop, and one tiny golden PAWS.",
    "Show exactly four adults, eight arms, and eight hands. Keep ECE isolated far left and the affectionate PAWS trio far right with a broad clear-water gap between them. Use water, pale sky, pavilion openings, reeds, or hills behind every arm.",
    "Turn Radiance and Ellie three-quarter-back with all hair moved fully forward so each complete open back from shoulder blades to the waistline is obvious while both adult faces remain fully visible. Keep Radiance's visible waist panel, Ellie's covered waist, Alia's covered waist and closed back, and ECE's strapless visible waist panel exact.",
    "Make the exact inventory literal: ECE right supports only the flat paddle and ECE left stays open at her outer side; Radiance left arm and hand securely cradle PAWS and Radiance right touches Ellie shoulder; Ellie left gently pets PAWS and Ellie right touches Alia shoulder; Alia left touches Radiance upper arm and Alia right holds one loose play ribbon. No hidden or additional hands.",
    "PAWS is one tiny collarless golden kitten. The loose ribbon is visibly disconnected from PAWS, with open air between ribbon and kitten; it is not a collar, leash, tether, costume, or attachment. PAWS remains securely held far from the prop and footing.",
    "Place a large bright blue hands-free holographic Montenegro route map floating above ECE's left shoulder, separate from the prop and unobstructed.",
    "Keep the inert rainbow-gradient cinema prop fully on the flat opaque paddle in side profile, muzzle unmistakably left across empty Skadar water away from PAWS, the trio, every boat, reed bed, person, animal, and camera; magazine absent and no finger near it.",
    "All four outfits remain visibly rainbow themed with large complete Montenegro motifs and unique silhouettes. No hosiery, second kitten, pole, or attached ribbon.",
  ].join(" "),
};

const hashes = {};
for (const scene of [1296, 1297, 1298, 1299]) {
  const primary = fs.readFileSync(path.join(root, `scene-${scene}-prompt.txt`), "utf8").trim();
  const prompt = `${directives[scene]} ${primary}\n`;
  const outputPath = path.join(root, `scene-${scene}-recovery-prompt.txt`);
  fs.writeFileSync(outputPath, prompt, "utf8");
  hashes[scene] = sha256(prompt);
}

console.log(JSON.stringify({ recoveryPromptHashes: hashes }, null, 2));
