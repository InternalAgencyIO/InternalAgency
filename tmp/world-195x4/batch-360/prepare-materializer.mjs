import fs from "node:fs";

const source = fs.readFileSync("tmp/world-195x4/batch-359/materialize-batch-359.mjs", "utf8");
const replacements = [
  ['import { guineaPalette, guineaProhibitions, guineaSceneSpecs } from "./guinea-scene-specs.mjs";', 'import { beninPalette, beninProhibitions, beninSceneSpecs } from "./benin-scene-specs.mjs";'],
  ["const batch = 359;", "const batch = 360;"],
  ['const country = "Guinea";', 'const country = "Benin";'],
  ['const countrySlug = "guinea";', 'const countrySlug = "benin";'],
  ["const firstScene = 1456;", "const firstScene = 1460;"],
  ['const root = path.resolve("tmp/world-195x4/batch-359");', 'const root = path.resolve("tmp/world-195x4/batch-360");'],
  ["const palette = guineaPalette;", "const palette = beninPalette;"],
  ["const commonProhibitions = guineaProhibitions;", "const commonProhibitions = beninProhibitions;"],
  ["const sceneSpecs = guineaSceneSpecs;", "const sceneSpecs = beninSceneSpecs;"],
  ["The theme and Guinea location", "The theme and Benin location"],
  ['const hashtags = ["#Guinea"];', 'const hashtags = ["#Benin"];'],
  ["batch359-guinea", "batch360-benin"],
  ['active: "orbital spaceship couture",\n    batchOrdinalWithinTheme: 1,', 'active: "orbital spaceship couture",\n    batchOrdinalWithinTheme: 2,'],
  ['nextQueueCountry: "Benin",', 'nextQueueCountry: "Rwanda",'],
  ["nextQueueBatch: 360,", "nextQueueBatch: 361,"],
  ["nextQueueScenes: [1460, 1461, 1462, 1463],", "nextQueueScenes: [1464, 1465, 1466, 1467],"],
  ['nextCinematicTheme: { active: "orbital spaceship couture", batchOrdinalWithinTheme: 2 },', 'nextCinematicTheme: { active: "Mars-surface expedition couture", batchOrdinalWithinTheme: 1 },'],
  ['{ url: "https://whc.unesco.org/en/list/155/", usedFor: "Mount Nimba ridge, forest and grassland setting" },', '{ url: "https://www.britannica.com/place/Cotonou", usedFor: "Cotonou lagoon and Atlantic urban setting" },'],
  ['{ url: "https://www.britannica.com/place/Fouta-Djallon", usedFor: "Fouta Djallon plateaus, escarpments and waterfalls" },', '{ url: "https://www.britannica.com/place/Benin", usedFor: "Benin geography, Atacora highlands and coastal plains" },'],
  ['{ url: "https://www.britannica.com/place/Conakry", usedFor: "Conakry peninsula and Atlantic coastal setting" },', '{ url: "https://whc.unesco.org/en/list/749/", usedFor: "W-Arly-Pendjari regional landscape context near Atacora" },'],
  ['{ url: "https://www.britannica.com/place/Niger-River", usedFor: "Niger headwaters and Upper Guinea river landscape" },', '{ url: "https://www.britannica.com/place/Mono-River", usedFor: "Mono River estuary and Grand-Popo coastal setting" },'],
  ["No literal Guinea flag, coat of arms, official seal, sacred symbol, copied ceremonial or traditional pattern, political messaging, copied military identity, or official service identity is used. Country-led scenes use large dimensional secular Atlantic currents, island contours, Fouta Djallon escarpments, waterfall ribbons, Nimba ridges and bauxite facets instead.", "No literal Benin flag, coat of arms, official seal, sacred symbol, copied ceremonial or traditional pattern, political messaging, copied military identity, or official service identity is used. Country-led scenes use large dimensional secular lagoon currents, stilt-walkway frames, red-earth terraces, palm fans, waterfall ribbons and cotton-boll arcs instead."],
  ["Scenes 1456 and 1457 each carry hard large Guinea motifs on three women and orbital-spaceship construction language on at least two. Scenes 1458 and 1459 use four different theme-led spaceship outfits without country map prints while Guinea landmarks remain equally foregrounded.", "Scenes 1460 and 1461 each carry hard large Benin motifs on three women and orbital-spaceship construction language on at least two. Scenes 1462 and 1463 use four different theme-led spaceship outfits without country map prints while Benin landmarks remain equally foregrounded."],
  ["The scenes foreground Conakry and the Loos Islands, Fouta Djallon, Mount Nimba, and the Niger headwaters.", "The scenes foreground Cotonou lagoon, Ganvie and Lake Nokoue, Tanougou Falls, and the Grand-Popo Mono estuary."],
  ["two Guinea images plus one accepted Zimbabwe image", "two Benin images plus one accepted Guinea image"],
  ["Guinea ${heartGlyph} Zimbabwe", "Benin ${heartGlyph} Guinea"],
  ["batch-359-guinea-preflight.json", "batch-360-benin-preflight.json"],
  ["restrained Guatemala volcanic-ridge and jade-facet embroidery and subtle private-jet aviation seam tailoring", "restrained Benin lagoon-current and red-earth embroidery with subtle orbital-spaceship seam tailoring"],
];

let output = source;
for (const [from, to] of replacements) {
  if (!output.includes(from)) throw new Error(`Missing replacement token: ${from}`);
  output = output.replace(from, to);
}

fs.writeFileSync("tmp/world-195x4/batch-360/materialize-batch-360.mjs", output);
