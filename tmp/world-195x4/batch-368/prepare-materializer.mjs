import fs from "node:fs";

const source = fs.readFileSync("tmp/world-195x4/batch-367/materialize-batch-367.mjs", "utf8");
const replacements = [
  ['import { haitiPalette, haitiProhibitions, haitiSceneSpecs } from "./haiti-scene-specs.mjs";', 'import { jordanPalette, jordanProhibitions, jordanSceneSpecs } from "./jordan-scene-specs.mjs";'],
  ["const batch = 367;", "const batch = 368;"],
  ['const country = "Haiti";', 'const country = "Jordan";'],
  ['const countrySlug = "haiti";', 'const countrySlug = "jordan";'],
  ["const firstScene = 1488;", "const firstScene = 1492;"],
  ['const root = path.resolve("tmp/world-195x4/batch-367");', 'const root = path.resolve("tmp/world-195x4/batch-368");'],
  ["const palette = haitiPalette;", "const palette = jordanPalette;"],
  ["const commonProhibitions = haitiProhibitions;", "const commonProhibitions = jordanProhibitions;"],
  ["const sceneSpecs = haitiSceneSpecs;", "const sceneSpecs = jordanSceneSpecs;"],
  ["The theme and Haiti location", "The theme and Jordan location"],
  ['const hashtags = ["#Haiti"];', 'const hashtags = ["#Jordan"];'],
  ["batch367-haiti", "batch368-jordan"],
  ["batch-367-haiti-preflight.json", "batch-368-jordan-preflight.json"],
  ["batchOrdinalWithinTheme: 1,", "batchOrdinalWithinTheme: 2,"],
  ['nextQueueCountry: "Jordan",', 'nextQueueCountry: "Dominican Republic",'],
  ["nextQueueBatch: 368,", "nextQueueBatch: 369,"],
  ["nextQueueScenes: [1492, 1493, 1494, 1495],", "nextQueueScenes: [1496, 1497, 1498, 1499],"],
  ['nextCinematicTheme: { active: "deep-sea submersible couture", batchOrdinalWithinTheme: 2 },', 'nextCinematicTheme: { active: "polar airship couture", batchOrdinalWithinTheme: 1 },'],
  ['{ url: "https://www.britannica.com/place/Port-au-Prince", usedFor: "Port-au-Prince bay and hillside city setting" },', '{ url: "https://www.britannica.com/place/Amman", usedFor: "Amman Citadel and limestone hill-city setting" },'],
  ['{ url: "https://www.britannica.com/place/Haiti", usedFor: "Haiti mountains, bays, islands and cities" },', '{ url: "https://www.britannica.com/place/Jordan", usedFor: "Jordan cities, desert geography and Aqaba coastline" },'],
  ['{ url: "https://whc.unesco.org/en/list/180/", usedFor: "Citadelle Laferrière architecture and mountain setting" },', '{ url: "https://whc.unesco.org/en/list/326/", usedFor: "Petra architecture and rose-stone canyon setting" },'],
  ['{ url: "https://www.britannica.com/place/Jacmel", usedFor: "Jacmel coastal city and regional landscape" },', '{ url: "https://whc.unesco.org/en/list/1377/", usedFor: "Wadi Rum desert landscape and sandstone formations" },'],
  ["No literal Haiti flag, coat of arms, official seal, sacred symbol, copied ceremonial or traditional pattern, political messaging, copied military identity, or official service identity is used. Country-led scenes use large dimensional secular bay currents, mountain terraces, fortress geometry, Jacmel rooflines, waterfall steps and island reef bands instead.", "No literal Jordan flag, coat of arms, official seal, sacred symbol, copied ceremonial or traditional pattern, political messaging, copied military identity, or official service identity is used. Country-led scenes use large dimensional secular limestone terraces, rose-stone facades, canyon strata, desert arches, gulf bands and mountain silhouettes instead."],
  ["Scenes 1488 and 1489 each carry hard large Haiti motifs on three women and submersible construction language on at least two. Scenes 1490 and 1491 use four different theme-led deep-sea outfits without country map prints while Haiti landmarks remain equally foregrounded.", "Scenes 1492 and 1493 each carry hard large Jordan motifs on three women and submersible construction language on at least two. Scenes 1494 and 1495 use four different theme-led deep-sea outfits without country map prints while Jordan landmarks remain equally foregrounded."],
  ["The scenes foreground Port-au-Prince Bay, Citadelle Laferrière, Jacmel with Bassin Bleu, and Île-à-Vache.", "The scenes foreground Amman Citadel, Petra, Wadi Rum, and Aqaba."],
  ["two Haiti images plus one accepted Belgium image", "two Jordan images plus one accepted Haiti image"],
  ["Haiti ${heartGlyph} Belgium", "Jordan ${heartGlyph} Haiti"],
  ["restrained Haiti bay-current and mountain-terrace embroidery with subtle deep-sea submersible seam tailoring", "restrained Jordan limestone-terrace and rose-stone embroidery with subtle deep-sea submersible seam tailoring"]
];

let output = source;
for (const [from, to] of replacements) {
  if (!output.includes(from)) throw new Error(`Missing replacement token: ${from}`);
  output = output.replaceAll(from, to);
}
fs.writeFileSync("tmp/world-195x4/batch-368/materialize-batch-368.mjs", output);
