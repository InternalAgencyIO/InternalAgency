import fs from "node:fs";

const source = fs.readFileSync("tmp/world-195x4/batch-372/materialize-batch-372.mjs", "utf8");
const replacements = [
  ['import { czechiaPalette, czechiaProhibitions, czechiaSceneSpecs } from "./czechia-scene-specs.mjs";', 'import { hondurasPalette, hondurasProhibitions, hondurasSceneSpecs } from "./honduras-scene-specs.mjs";'],
  ["const batch = 372;", "const batch = 373;"],
  ['const country = "Czechia";', 'const country = "Honduras";'],
  ['const countrySlug = "czechia";', 'const countrySlug = "honduras";'],
  ["const firstScene = 1508;", "const firstScene = 1512;"],
  ['const root = path.resolve("tmp/world-195x4/batch-372");', 'const root = path.resolve("tmp/world-195x4/batch-373");'],
  ["const palette = czechiaPalette;", "const palette = hondurasPalette;"],
  ["const commonProhibitions = czechiaProhibitions;", "const commonProhibitions = hondurasProhibitions;"],
  ["const sceneSpecs = czechiaSceneSpecs;", "const sceneSpecs = hondurasSceneSpecs;"],
  ["The theme and Czechia location", "The theme and Honduras location"],
  ['const hashtags = ["#Czechia"];', 'const hashtags = ["#Honduras"];'],
  ["batch372-czechia", "batch373-honduras"],
  ["batch-372-czechia-preflight.json", "batch-373-honduras-preflight.json"],
  ["batchOrdinalWithinTheme: 2,", "batchOrdinalWithinTheme: 1,"],
  ['nextQueueCountry: "Honduras",', 'nextQueueCountry: "Armenia",'],
  ["nextQueueBatch: 373,", "nextQueueBatch: 374,"],
  ["nextQueueScenes: [1512, 1513, 1514, 1515],", "nextQueueScenes: [1516, 1517, 1518, 1519],"],
  ['nextCinematicTheme: { active: "private-jet aviation couture", batchOrdinalWithinTheme: 1 },', 'nextCinematicTheme: { active: "private-jet aviation couture", batchOrdinalWithinTheme: 2 },'],
  ['{ url: "https://whc.unesco.org/en/list/616/", usedFor: "Prague historic center and Vltava setting" },', '{ url: "https://whc.unesco.org/en/list/129/", usedFor: "Copan archaeological terraces and valley setting" },'],
  ['{ url: "https://www.britannica.com/place/Czech-Republic", usedFor: "Czechia geography, cities and regions" },', '{ url: "https://www.britannica.com/place/Honduras", usedFor: "Honduras geography, cities and regions" },'],
  ['{ url: "https://whc.unesco.org/en/list/617/", usedFor: "Cesky Krumlov town and river setting" },', '{ url: "https://www.britannica.com/place/Tegucigalpa", usedFor: "Tegucigalpa mountain-basin city setting" },'],
  ['{ url: "https://www.britannica.com/place/Karlovy-Vary", usedFor: "Karlovy Vary spa valley and architecture" },', '{ url: "https://www.britannica.com/place/Roatan", usedFor: "Roatan island and Caribbean reef setting" },'],
  ["No literal Czechia flag, coat of arms, official seal, sacred symbol, copied ceremonial or traditional pattern, political messaging, copied military identity, or official service identity is used. Country-led scenes use large dimensional secular bridge arches, Vltava curves, Prague rooflines, Krumlov river bends, karst domes, colonnade rhythms and valley bands instead.", "No literal Honduras flag, coat of arms, official seal, sacred symbol, copied Indigenous glyph, copied ceremonial or traditional pattern, political messaging, copied military identity, or official service identity is used. Country-led scenes use large dimensional secular mountain basins, river bands, civic rooflines, stone terraces, Caribbean reef arcs, lake curves and cloud-forest silhouettes instead."],
  ["Scenes 1508 and 1509 each carry hard large Czechia motifs on three women and orbital-station construction language on at least two. Scenes 1510 and 1511 use four different theme-led orbital-research outfits without country map prints while Czechia landmarks remain equally foregrounded.", "Scenes 1512 and 1513 each carry hard large Honduras motifs on three women and private-jet construction language on at least two. Scenes 1514 and 1515 use four different theme-led private-jet outfits without country map prints while Honduras landmarks remain equally foregrounded."],
  ["The scenes foreground Prague, Český Krumlov, the Moravian Karst, and Karlovy Vary.", "The scenes foreground Tegucigalpa, Copan Ruinas, Roatan, and Lake Yojoa."],
  ["two Czechia images plus one accepted Cuba image", "two Honduras images plus one accepted Czechia image"],
  ["Czechia ${heartGlyph} Cuba", "Honduras ${heartGlyph} Czechia"],
  ["restrained Czech bridge-arch and karst-dome embroidery with subtle orbital-research seam tailoring", "restrained Honduran mountain-basin and reef-arc embroidery with subtle private-jet seam tailoring"],
  ["orbital research-station couture", "private-jet aviation couture"]
];

let output = source;
for (const [from, to] of replacements) {
  if (!output.includes(from)) throw new Error(`Missing replacement token: ${from}`);
  output = output.replaceAll(from, to);
}
fs.writeFileSync("tmp/world-195x4/batch-373/materialize-batch-373.mjs", output);
