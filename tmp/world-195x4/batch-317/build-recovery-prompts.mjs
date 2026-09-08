import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve("tmp/world-195x4/batch-317");
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex").toUpperCase();

const directives = {
  1288: [
    "Fresh restrained recovery recreation because the first renderer returned no image.",
    "Keep this unmistakably public and fully clothed: four fictional women visibly over age 28 in secure opaque lined fashion, with ordinary affectionate companionship only.",
    "Show exactly four adults, eight arms, and eight hands. Spread every arm into a bright bridge-arch or valley gap so each limb traces continuously from its own shoulder to one separated hand.",
    "Make the hands inventory literal: ECE right supports the flat paddle; ECE left links Radiance left; Radiance right touches Alia cheek; Alia left touches Radiance waist; Alia right links Ellie left; Ellie right rests on Alia shoulder. No other hands or hidden wrists.",
    "Place a bright separate blue holographic Luxembourg route map floating hands-free beside ECE's left shoulder, visibly distinct from the inert prop.",
    "Keep the inert rainbow-gradient cinema prop fully on the flat opaque paddle in side profile, muzzle left across empty valley water, with absent magazine, empty well, complete guard, and no finger near it.",
    "Preserve all frozen cuts: Radiance covered and not strapless; Ellie strapless with covered waist and closed back; Alia strapless with covered waist and completely open back; ECE strapless with covered waist and closed back. No hosiery, kitten, pole, or rainbow-only wardrobe.",
    "The Adolphe Bridge double arch and Petrousse Valley must remain complete and dominant, with large Luxembourg motifs on at least two outfits.",
  ].join(" "),
  1289: [
    "Fresh restrained recovery recreation of the Belval eclipse scene.",
    "Correct the failed route-strategist and choreography details while preserving the four established adult faces, exact rolled cuts, complete blast furnaces, eclipse, and large Luxembourg motifs.",
    "Show exactly four adults, eight arms, and eight hands. Spread all arms into clear sky, gantry, or building gaps. No arm may disappear behind a torso.",
    "Make the hands inventory literal: ECE right supports the flat paddle; ECE left links Ellie left; Ellie right touches Radiance shoulder; Radiance left touches ECE forearm; Radiance right links Alia left; Alia right touches Radiance forearm. No substitutes and no additional hands.",
    "Add a large bright blue hands-free holographic Luxembourg route map floating beside and above ECE's free-side shoulder, clearly separate from the prop and unobstructed.",
    "Keep the inert rainbow-gradient cinema prop fully on the flat opaque paddle in side profile, muzzle left across an empty industrial lane, magazine absent and no finger near grip or guard.",
    "Preserve no hosiery, no kitten, no pole, no rainbow-only wardrobe, and all secure opaque above-knee silhouettes.",
  ].join(" "),
  1290: [
    "Fresh restrained recovery recreation of the Upper-Sure Lake scene.",
    "Correct the male eye line, hidden male hand, exact ten-limb inventory, and missing ECE route map while preserving the five established adult faces, waterspout, dam, solar boat, exact rolled cuts, and large Luxembourg motifs.",
    "Show exactly five adults, ten arms, and ten hands, two per person. Fan the cast widely with lake or pale-sky gaps behind every arm. Every shoulder, elbow, wrist, and hand must be continuously traceable.",
    "Place ECE far left, Radiance left-center, the male center, Ellie right-center, and Alia far right. Turn the male's entire face and pupils clearly left past Radiance toward ECE as his strongest sustained eye line. Ellie and Alia look away from him.",
    "Make the hands inventory literal: ECE right supports the flat paddle; ECE left links Radiance left; Radiance right touches male upper arm; male left rests on Ellie shoulder; male right rests on Alia forearm; Ellie left touches male forearm; Ellie right links Alia left; Alia right touches male forearm. Keep both male hands fully visible and separated.",
    "Add a large bright blue hands-free holographic Luxembourg route map floating beside and above ECE's left shoulder, separate from the prop and visible against the lake.",
    "Keep the inert rainbow-gradient cinema prop fully on the flat opaque paddle in side profile, muzzle left across empty water away from every person, boat, dam, waterspout, and camera; magazine absent and no finger near it.",
    "No hosiery, kitten, pole, or rainbow-only wardrobe. Keep the adult drama restrained to public eye lines and gentle clothed touch.",
  ].join(" "),
  1291: [
    "Fresh restrained recovery recreation of the Schiessentumpel scene.",
    "Correct the missing ECE route map and exact hand choreography while preserving the four established adult faces, complete triple cascade and sandstone bridge, windstorm, exact rolled cuts, and large Luxembourg motifs.",
    "Show exactly four adults, eight arms, and eight hands. Ellie remains seated at far left with both legs and both heels visible; Radiance stays offset one step forward so no body or arm is hidden.",
    "Make the hands inventory literal: ECE right supports the flat paddle; ECE left touches Ellie shoulder; Ellie left links Radiance left; Ellie right touches Radiance upper back; Radiance right touches Alia cheek; Alia left touches Radiance waist; Alia right touches ECE shoulder. No substitutes or extra hands.",
    "Add a large bright blue hands-free holographic Luxembourg route map floating above ECE's right shoulder, clearly separate from the prop and unobstructed against the forest.",
    "Keep the inert rainbow-gradient cinema prop fully on the flat opaque paddle in side profile, muzzle right across an empty forest route away from every person, bridge, waterfall, and camera; magazine absent and no finger near it.",
    "Preserve no hosiery, no kitten, no pole, no rainbow-only wardrobe, and all secure opaque above-knee silhouettes.",
  ].join(" "),
};

const hashes = {};
for (const scene of [1288, 1289, 1290, 1291]) {
  const primary = fs.readFileSync(path.join(root, `scene-${scene}-prompt.txt`), "utf8").trim();
  const prompt = `${directives[scene]} ${primary}\n`;
  const outputPath = path.join(root, `scene-${scene}-recovery-prompt.txt`);
  fs.writeFileSync(outputPath, prompt, "utf8");
  hashes[scene] = sha256(prompt);
}

console.log(JSON.stringify({ recoveryPromptHashes: hashes }, null, 2));
