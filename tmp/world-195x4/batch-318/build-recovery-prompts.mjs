import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve("tmp/world-195x4/batch-318");
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex").toUpperCase();

const directives = {
  1292: [
    "Fresh restrained recovery recreation of the Paramaribo riverfront scene.",
    "Correct the missing route map, unsafe prop direction, and hidden Radiance hand while preserving the four established adult faces, complete bridge, thunderstorm, exact rolled cuts, and large Suriname motifs.",
    "Show exactly four adults, eight arms, and eight hands. Spread every arm into a bright river, bridge, or pavilion gap so each limb traces continuously from its own shoulder through elbow and wrist to one separated hand.",
    "Make the hands inventory literal: ECE right supports only the flat paddle; ECE left touches Ellie shoulder; Ellie left links Radiance left; Ellie right touches Radiance cheek; Radiance right touches Alia cheek; Alia left touches Radiance waist; Alia right holds the flat route card against Radiance upper back. No substitute, hidden, or additional hands.",
    "Place a large bright blue hands-free holographic Suriname route map floating above ECE's left shoulder, separate from the inert prop and unobstructed against the river.",
    "Keep the inert rainbow-gradient cinema prop fully on the flat opaque paddle in clean side profile with its muzzle unmistakably pointing left across empty river water, away from the three women to ECE's right, every boat, bridge, and camera. Magazine absent and no finger near grip or guard.",
    "Preserve Radiance strapless covered waist; Ellie covered waist and completely open back; Alia visible waist panel and completely open back; ECE strapless visible waist panel. No hosiery, kitten, pole, or rainbow-only wardrobe.",
  ].join(" "),
  1293: [
    "Fresh restrained recovery recreation of the Brownsberg and Brokopondo scene.",
    "Correct the male eye line, exact ten-limb inventory, missing route map, and prop direction while preserving the five established adult faces, sunshower, reservoir, exact rolled cuts, and large Suriname motifs.",
    "Show exactly five adults, ten arms, and ten hands, two per adult. Fan the cast widely with reservoir or pale-sky gaps behind every arm. Every shoulder, elbow, wrist, and hand must be continuously traceable.",
    "Place ECE far left, Radiance left-center, the male center, Ellie right-center, and Alia far right. Turn the male's entire face and pupils clearly left past Radiance toward ECE as his strongest sustained eye line. Radiance looks past him; Ellie and Alia look away from him.",
    "Make the hands inventory literal: ECE right supports the flat paddle; ECE left links Radiance left; Radiance right touches male upper arm; male left touches Ellie shoulder; male right touches Alia forearm; Ellie left touches male forearm; Ellie right links Alia left; Alia right touches male forearm. Keep both male hands and both Alia hands fully visible and separated.",
    "Place a large bright blue hands-free holographic Suriname route map floating above ECE's left shoulder, separate from the prop and visible against the reservoir.",
    "Keep the inert rainbow-gradient cinema prop fully on the flat opaque paddle in side profile, muzzle unmistakably left across empty reservoir water away from every person, island, animal, and camera; magazine absent and no finger near it.",
    "Preserve Ellie's completely open back and every secure opaque above-knee silhouette. No hosiery, kitten, pole, or rainbow-only wardrobe.",
  ].join(" "),
  1294: [
    "Fresh restrained recovery recreation of the Voltzberg and Raleigh Falls scene.",
    "Correct the missing route map and unsafe prop direction while preserving the quartet, complete granite dome, waterfall, stationary weighted navigation pole, exact rolled cuts, large Suriname motifs, and eight-owner anatomy.",
    "Show exactly four adults, eight arms, and eight hands. Make the inventory literal: ECE right supports only the flat paddle; ECE left links Radiance left; Radiance right touches Alia cheek; Alia left touches Radiance waist; Alia right links Ellie left; Ellie right touches Radiance shoulder. Keep every arm isolated against sky, dome, mist, or canopy.",
    "Place a large bright blue hands-free holographic Suriname route map floating above ECE's left shoulder, separate from the inert prop and unobstructed.",
    "Keep the inert rainbow-gradient cinema prop fully on the flat opaque paddle in clean side profile with its muzzle unmistakably pointing left across empty Coppename water, away from the three women to ECE's right, every animal, waterfall, and camera. Magazine absent and no finger near grip or guard.",
    "Keep the matte-gold navigation pole far behind the cast on its own weighted base with no person touching or approaching it. No hosiery, kitten, or rainbow-only wardrobe.",
  ].join(" "),
  1295: [
    "Fresh restrained recovery recreation of the Galibi rain-shelter scene.",
    "Correct the missing route map, hidden Radiance open back, Alia's missing second hand, and exact prop presentation while preserving the quartet, heavy rain curtain, protected coast, exact rolled cuts, and large Suriname motifs.",
    "Show exactly four adults, eight arms, and eight hands. Keep ECE and Radiance seated side by side with legs and heels separated; place Ellie standing far left and Alia upright on one knee at far right. Use ocean, pale rain, or boardwalk gaps behind every arm.",
    "Turn Radiance three-quarter-back with hair moved fully forward so her complete open back and visible waist panel are obvious while her complete adult face remains visible. Show Ellie's complete open back and visible waist panel too. Alia's visible waist panel and ECE's strapless covered waist remain exact.",
    "Make the hands inventory literal: ECE right supports only the flat paddle; ECE left links Radiance left; Radiance right rests on ECE upper back; Ellie left touches ECE shoulder; Ellie right links Alia right; Alia left touches Radiance forearm above the joined pair. Show both Alia hands and all wrists clearly.",
    "Place a large bright blue hands-free holographic Suriname route map floating above ECE's left shoulder, separate from the prop and unobstructed against the rain.",
    "Keep the inert rainbow-gradient cinema prop fully on the flat opaque paddle in clean side profile, muzzle unmistakably left across empty Atlantic water away from every person, turtle, track, nest, mangrove, and camera; magazine absent and no finger near it.",
    "No hosiery, kitten, pole, or rainbow-only wardrobe. All affection is ordinary public adult companionship.",
  ].join(" "),
};

const hashes = {};
for (const scene of [1292, 1293, 1294, 1295]) {
  const primary = fs.readFileSync(path.join(root, `scene-${scene}-prompt.txt`), "utf8").trim();
  const prompt = `${directives[scene]} ${primary}\n`;
  const outputPath = path.join(root, `scene-${scene}-recovery-prompt.txt`);
  fs.writeFileSync(outputPath, prompt, "utf8");
  hashes[scene] = sha256(prompt);
}

console.log(JSON.stringify({ recoveryPromptHashes: hashes }, null, 2));
