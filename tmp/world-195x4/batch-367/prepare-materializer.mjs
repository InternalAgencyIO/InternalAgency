import fs from "node:fs";

const source = fs.readFileSync("tmp/world-195x4/batch-366/materialize-batch-366.mjs", "utf8");
const replacements = [
  ['import { belgiumPalette, belgiumProhibitions, belgiumSceneSpecs } from "./belgium-scene-specs.mjs";', 'import { haitiPalette, haitiProhibitions, haitiSceneSpecs } from "./haiti-scene-specs.mjs";'],
  ["const batch = 366;", "const batch = 367;"],
  ['const country = "Belgium";', 'const country = "Haiti";'],
  ['const countrySlug = "belgium";', 'const countrySlug = "haiti";'],
  ["const firstScene = 1484;", "const firstScene = 1488;"],
  ['const root = path.resolve("tmp/world-195x4/batch-366");', 'const root = path.resolve("tmp/world-195x4/batch-367");'],
  ["const palette = belgiumPalette;", "const palette = haitiPalette;"],
  ["const commonProhibitions = belgiumProhibitions;", "const commonProhibitions = haitiProhibitions;"],
  ["const sceneSpecs = belgiumSceneSpecs;", "const sceneSpecs = haitiSceneSpecs;"],
  ["The theme and Belgium location", "The theme and Haiti location"],
  ['const hashtags = ["#Belgium"];', 'const hashtags = ["#Haiti"];'],
  ["batch366-belgium", "batch367-haiti"],
  ['active: "near-Sun solar-observation couture",', 'active: "deep-sea submersible couture",'],
  ["batchOrdinalWithinTheme: 2,", "batchOrdinalWithinTheme: 1,"],
  ['nextQueueCountry: "Haiti",', 'nextQueueCountry: "Jordan",'],
  ["nextQueueBatch: 367,", "nextQueueBatch: 368,"],
  ["nextQueueScenes: [1488, 1489, 1490, 1491],", "nextQueueScenes: [1492, 1493, 1494, 1495],"],
  ['nextCinematicTheme: { active: "deep-sea submersible couture", batchOrdinalWithinTheme: 1 },', 'nextCinematicTheme: { active: "deep-sea submersible couture", batchOrdinalWithinTheme: 2 },'],
  ['{ url: "https://www.britannica.com/place/Brussels", usedFor: "Brussels Grand Place and city setting" },', '{ url: "https://www.britannica.com/place/Port-au-Prince", usedFor: "Port-au-Prince bay and hillside city setting" },'],
  ['{ url: "https://www.britannica.com/place/Belgium", usedFor: "Belgium cities, rivers and regional geography" },', '{ url: "https://www.britannica.com/place/Haiti", usedFor: "Haiti mountains, bays, islands and cities" },'],
  ['{ url: "https://whc.unesco.org/en/list/996/", usedFor: "Bruges historic center and canal architecture" },', '{ url: "https://whc.unesco.org/en/list/180/", usedFor: "Citadelle Laferrière architecture and mountain setting" },'],
  ['{ url: "https://www.britannica.com/place/Antwerp-Belgium", usedFor: "Antwerp Scheldt waterfront and port setting" },', '{ url: "https://www.britannica.com/place/Jacmel", usedFor: "Jacmel coastal city and regional landscape" },'],
  ["No literal Belgium flag, coat of arms, official seal, sacred symbol, copied ceremonial or traditional pattern, political messaging, copied military identity, or official service identity is used. Country-led scenes use large dimensional secular guildhall rooflines, canal currents, belfry arcs, port geometry, river bands and limestone cliff profiles instead.", "No literal Haiti flag, coat of arms, official seal, sacred symbol, copied ceremonial or traditional pattern, political messaging, copied military identity, or official service identity is used. Country-led scenes use large dimensional secular bay currents, mountain terraces, fortress geometry, Jacmel rooflines, waterfall steps and island reef bands instead."],
  ["Scenes 1484 and 1485 each carry hard large Belgium motifs on three women and solar-observation construction language on at least two. Scenes 1486 and 1487 use four different theme-led solar-observation outfits without country map prints while Belgium landmarks remain equally foregrounded.", "Scenes 1488 and 1489 each carry hard large Haiti motifs on three women and submersible construction language on at least two. Scenes 1490 and 1491 use four different theme-led deep-sea outfits without country map prints while Haiti landmarks remain equally foregrounded."],
  ["The scenes foreground Brussels Grand Place, Bruges canals, Antwerp waterfront, and Dinant on the Meuse.", "The scenes foreground Port-au-Prince Bay, Citadelle Laferrière, Jacmel with Bassin Bleu, and Île-à-Vache."],
  ["two Belgium images plus one accepted South Sudan image", "two Haiti images plus one accepted Belgium image"],
  ["Belgium ${heartGlyph} South Sudan", "Haiti ${heartGlyph} Belgium"],
  ["batch-366-belgium-preflight.json", "batch-367-haiti-preflight.json"],
  ["batch-366-belgium-preflight.json", "batch-367-haiti-preflight.json"],
  ["restrained Belgium guildhall-roofline and canal-current embroidery with subtle near-Sun solar-observation seam tailoring", "restrained Haiti bay-current and mountain-terrace embroidery with subtle deep-sea submersible seam tailoring"],
];

let output = source;
for (const [from, to] of replacements) {
  if (!output.includes(from)) throw new Error(`Missing replacement token: ${from}`);
  output = output.replace(from, to);
}
fs.writeFileSync("tmp/world-195x4/batch-367/materialize-batch-367.mjs", output);
