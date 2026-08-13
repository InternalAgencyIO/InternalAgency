import fs from "node:fs";

const source = fs.readFileSync("tmp/world-195x4/batch-371/materialize-batch-371.mjs", "utf8");
const replacements = [
  ['import { cubaPalette, cubaProhibitions, cubaSceneSpecs } from "./cuba-scene-specs.mjs";', 'import { czechiaPalette, czechiaProhibitions, czechiaSceneSpecs } from "./czechia-scene-specs.mjs";'],
  ["const batch = 371;", "const batch = 372;"],
  ['const country = "Cuba";', 'const country = "Czechia";'],
  ['const countrySlug = "cuba";', 'const countrySlug = "czechia";'],
  ["const firstScene = 1504;", "const firstScene = 1508;"],
  ['const root = path.resolve("tmp/world-195x4/batch-371");', 'const root = path.resolve("tmp/world-195x4/batch-372");'],
  ["const palette = cubaPalette;", "const palette = czechiaPalette;"],
  ["const commonProhibitions = cubaProhibitions;", "const commonProhibitions = czechiaProhibitions;"],
  ["const sceneSpecs = cubaSceneSpecs;", "const sceneSpecs = czechiaSceneSpecs;"],
  ["The theme and Cuba location", "The theme and Czechia location"],
  ['const hashtags = ["#Cuba"];', 'const hashtags = ["#Czechia"];'],
  ["batch371-cuba", "batch372-czechia"],
  ["batch-371-cuba-preflight.json", "batch-372-czechia-preflight.json"],
  ["batchOrdinalWithinTheme: 1,", "batchOrdinalWithinTheme: 2,"],
  ['nextQueueCountry: "Czechia",', 'nextQueueCountry: "Honduras",'],
  ["nextQueueBatch: 372,", "nextQueueBatch: 373,"],
  ["nextQueueScenes: [1508, 1509, 1510, 1511],", "nextQueueScenes: [1512, 1513, 1514, 1515],"],
  ['nextCinematicTheme: { active: "orbital research-station couture", batchOrdinalWithinTheme: 2 },', 'nextCinematicTheme: { active: "private-jet aviation couture", batchOrdinalWithinTheme: 1 },'],
  ['{ url: "https://whc.unesco.org/en/list/204/", usedFor: "Old Havana architecture and harbor setting" },', '{ url: "https://whc.unesco.org/en/list/616/", usedFor: "Prague historic center and Vltava setting" },'],
  ['{ url: "https://www.britannica.com/place/Cuba", usedFor: "Cuba geography, cities and coasts" },', '{ url: "https://www.britannica.com/place/Czech-Republic", usedFor: "Czechia geography, cities and regions" },'],
  ['{ url: "https://whc.unesco.org/en/list/460/", usedFor: "Trinidad urban architecture and valley setting" },', '{ url: "https://whc.unesco.org/en/list/617/", usedFor: "Cesky Krumlov town and river setting" },'],
  ['{ url: "https://whc.unesco.org/en/list/840/", usedFor: "Viñales Valley mogotes and agricultural landscape" },', '{ url: "https://www.britannica.com/place/Karlovy-Vary", usedFor: "Karlovy Vary spa valley and architecture" },'],
  ["No literal Cuba flag, coat of arms, official seal, sacred symbol, copied ceremonial or traditional pattern, political messaging, copied military identity, or official service identity is used. Country-led scenes use large dimensional secular Malecón curves, Havana rooflines, Trinidad cobbles, colonial arcades, Viñales mogotes, bay arcs and mountain silhouettes instead.", "No literal Czechia flag, coat of arms, official seal, sacred symbol, copied ceremonial or traditional pattern, political messaging, copied military identity, or official service identity is used. Country-led scenes use large dimensional secular bridge arches, Vltava curves, Prague rooflines, Krumlov river bends, karst domes, colonnade rhythms and valley bands instead."],
  ["Scenes 1504 and 1505 each carry hard large Cuba motifs on three women and orbital-station construction language on at least two. Scenes 1506 and 1507 use four different theme-led orbital-research outfits without country map prints while Cuba landmarks remain equally foregrounded.", "Scenes 1508 and 1509 each carry hard large Czechia motifs on three women and orbital-station construction language on at least two. Scenes 1510 and 1511 use four different theme-led orbital-research outfits without country map prints while Czechia landmarks remain equally foregrounded."],
  ["The scenes foreground Havana, Trinidad, Viñales Valley, and Santiago de Cuba Bay.", "The scenes foreground Prague, Český Krumlov, the Moravian Karst, and Karlovy Vary."],
  ["two Cuba images plus one accepted United Arab Emirates image", "two Czechia images plus one accepted Cuba image"],
  ["Cuba ${heartGlyph} United Arab Emirates", "Czechia ${heartGlyph} Cuba"],
  ["restrained Cuba Malecón-curve and mogote embroidery with subtle orbital-research seam tailoring", "restrained Czech bridge-arch and karst-dome embroidery with subtle orbital-research seam tailoring"]
];

let output = source;
for (const [from, to] of replacements) {
  if (!output.includes(from)) throw new Error(`Missing replacement token: ${from}`);
  output = output.replaceAll(from, to);
}
fs.writeFileSync("tmp/world-195x4/batch-372/materialize-batch-372.mjs", output);
