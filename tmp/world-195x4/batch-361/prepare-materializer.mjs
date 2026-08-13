import fs from "node:fs";

const source = fs.readFileSync("tmp/world-195x4/batch-360/materialize-batch-360.mjs", "utf8");
const replacements = [
  ['import { beninPalette, beninProhibitions, beninSceneSpecs } from "./benin-scene-specs.mjs";', 'import { rwandaPalette, rwandaProhibitions, rwandaSceneSpecs } from "./rwanda-scene-specs.mjs";'],
  ["const batch = 360;", "const batch = 361;"],
  ['const country = "Benin";', 'const country = "Rwanda";'],
  ['const countrySlug = "benin";', 'const countrySlug = "rwanda";'],
  ["const firstScene = 1460;", "const firstScene = 1464;"],
  ['const root = path.resolve("tmp/world-195x4/batch-360");', 'const root = path.resolve("tmp/world-195x4/batch-361");'],
  ["const palette = beninPalette;", "const palette = rwandaPalette;"],
  ["const commonProhibitions = beninProhibitions;", "const commonProhibitions = rwandaProhibitions;"],
  ["const sceneSpecs = beninSceneSpecs;", "const sceneSpecs = rwandaSceneSpecs;"],
  ["The theme and Benin location", "The theme and Rwanda location"],
  ['const hashtags = ["#Benin"];', 'const hashtags = ["#Rwanda"];'],
  ["batch360-benin", "batch361-rwanda"],
  ["orbital spaceship couture", "Mars-surface expedition couture"],
  ["batchOrdinalWithinTheme: 2,", "batchOrdinalWithinTheme: 1,"],
  ['nextQueueCountry: "Rwanda",', 'nextQueueCountry: "Burundi",'],
  ["nextQueueBatch: 361,", "nextQueueBatch: 362,"],
  ["nextQueueScenes: [1464, 1465, 1466, 1467],", "nextQueueScenes: [1468, 1469, 1470, 1471],"],
  ['nextCinematicTheme: { active: "Mars-surface expedition couture", batchOrdinalWithinTheme: 1 },', 'nextCinematicTheme: { active: "Mars-surface expedition couture", batchOrdinalWithinTheme: 2 },'],
  ['{ url: "https://www.britannica.com/place/Cotonou", usedFor: "Cotonou lagoon and Atlantic urban setting" },', '{ url: "https://www.britannica.com/place/Kigali", usedFor: "Kigali rolling-hill city setting" },'],
  ['{ url: "https://www.britannica.com/place/Benin", usedFor: "Benin geography, Atacora highlands and coastal plains" },', '{ url: "https://www.britannica.com/place/Rwanda", usedFor: "Rwanda rolling hills, lakes and volcanic geography" },'],
  ['{ url: "https://whc.unesco.org/en/list/749/", usedFor: "W-Arly-Pendjari regional landscape context near Atacora" },', '{ url: "https://whc.unesco.org/en/list/1697/", usedFor: "Nyungwe forest landscape and biodiversity context" },'],
  ['{ url: "https://www.britannica.com/place/Mono-River", usedFor: "Mono River estuary and Grand-Popo coastal setting" },', '{ url: "https://www.britannica.com/place/Lake-Kivu", usedFor: "Lake Kivu shoreline and island landscape" },'],
  ["No literal Benin flag, coat of arms, official seal, sacred symbol, copied ceremonial or traditional pattern, political messaging, copied military identity, or official service identity is used. Country-led scenes use large dimensional secular lagoon currents, stilt-walkway frames, red-earth terraces, palm fans, waterfall ribbons and cotton-boll arcs instead.", "No literal Rwanda flag, coat of arms, official seal, sacred symbol, copied ceremonial or traditional pattern, political messaging, copied military identity, or official service identity is used. Country-led scenes use large dimensional secular rolling-hill terraces, lake currents, volcanic profiles, canopy layers, tea-field ribbons and city-light arcs instead."],
  ["Scenes 1460 and 1461 each carry hard large Benin motifs on three women and orbital-spaceship construction language on at least two. Scenes 1462 and 1463 use four different theme-led spaceship outfits without country map prints while Benin landmarks remain equally foregrounded.", "Scenes 1464 and 1465 each carry hard large Rwanda motifs on three women and Mars-expedition construction language on at least two. Scenes 1466 and 1467 use four different theme-led Mars expedition outfits without country map prints while Rwanda landmarks remain equally foregrounded."],
  ["The scenes foreground Cotonou lagoon, Ganvie and Lake Nokoue, Tanougou Falls, and the Grand-Popo Mono estuary.", "The scenes foreground Kigali, Lake Kivu, the Virunga volcano chain, and Nyungwe rainforest."],
  ["two Benin images plus one accepted Guinea image", "two Rwanda images plus one accepted Guinea image"],
  ["Benin ${heartGlyph} Guinea", "Rwanda ${heartGlyph} Guinea"],
  ["batch-360-benin-preflight.json", "batch-361-rwanda-preflight.json"],
  ["batch-360-benin-preflight.json", "batch-361-rwanda-preflight.json"],
  ["restrained Benin lagoon-current and red-earth embroidery with subtle orbital-spaceship seam tailoring", "restrained Rwanda rolling-hill and lake-current embroidery with subtle Mars-surface expedition seam tailoring"],
];

let output = source;
for (const [from, to] of replacements) {
  if (!output.includes(from)) throw new Error(`Missing replacement token: ${from}`);
  output = output.replace(from, to);
}
fs.writeFileSync("tmp/world-195x4/batch-361/materialize-batch-361.mjs", output);
