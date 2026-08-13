import fs from "node:fs";

const source = fs.readFileSync("tmp/world-195x4/batch-368/materialize-batch-368.mjs", "utf8");
const replacements = [
  ['import { jordanPalette, jordanProhibitions, jordanSceneSpecs } from "./jordan-scene-specs.mjs";', 'import { dominicanRepublicPalette, dominicanRepublicProhibitions, dominicanRepublicSceneSpecs } from "./dominican-republic-scene-specs.mjs";'],
  ["const batch = 368;", "const batch = 369;"],
  ['const country = "Jordan";', 'const country = "Dominican Republic";'],
  ['const countrySlug = "jordan";', 'const countrySlug = "dominican-republic";'],
  ["const firstScene = 1492;", "const firstScene = 1496;"],
  ['const root = path.resolve("tmp/world-195x4/batch-368");', 'const root = path.resolve("tmp/world-195x4/batch-369");'],
  ["const palette = jordanPalette;", "const palette = dominicanRepublicPalette;"],
  ["const commonProhibitions = jordanProhibitions;", "const commonProhibitions = dominicanRepublicProhibitions;"],
  ["const sceneSpecs = jordanSceneSpecs;", "const sceneSpecs = dominicanRepublicSceneSpecs;"],
  ["The theme and Jordan location", "The theme and Dominican Republic location"],
  ['const hashtags = ["#Jordan"];', 'const hashtags = ["#DominicanRepublic"];'],
  ["batch368-jordan", "batch369-dominican-republic"],
  ["batch-368-jordan-preflight.json", "batch-369-dominican-republic-preflight.json"],
  ['active: "deep-sea submersible couture",', 'active: "polar airship couture",'],
  ["batchOrdinalWithinTheme: 2,", "batchOrdinalWithinTheme: 1,"],
  ['nextQueueCountry: "Dominican Republic",', 'nextQueueCountry: "United Arab Emirates",'],
  ["nextQueueBatch: 369,", "nextQueueBatch: 370,"],
  ["nextQueueScenes: [1496, 1497, 1498, 1499],", "nextQueueScenes: [1500, 1501, 1502, 1503],"],
  ['nextCinematicTheme: { active: "polar airship couture", batchOrdinalWithinTheme: 1 },', 'nextCinematicTheme: { active: "polar airship couture", batchOrdinalWithinTheme: 2 },'],
  ['{ url: "https://www.britannica.com/place/Amman", usedFor: "Amman Citadel and limestone hill-city setting" },', '{ url: "https://whc.unesco.org/en/list/526/", usedFor: "Santo Domingo Colonial City architecture and Ozama setting" },'],
  ['{ url: "https://www.britannica.com/place/Jordan", usedFor: "Jordan cities, desert geography and Aqaba coastline" },', '{ url: "https://www.britannica.com/place/Dominican-Republic", usedFor: "Dominican Republic geography, cities and coasts" },'],
  ['{ url: "https://whc.unesco.org/en/list/326/", usedFor: "Petra architecture and rose-stone canyon setting" },', '{ url: "https://www.britannica.com/place/Puerto-Plata-Dominican-Republic", usedFor: "Puerto Plata mountain and Atlantic setting" },'],
  ['{ url: "https://whc.unesco.org/en/list/1377/", usedFor: "Wadi Rum desert landscape and sandstone formations" },', '{ url: "https://www.britannica.com/place/Samana-Bay", usedFor: "Samana Bay and peninsula setting" },'],
  ["No literal Jordan flag, coat of arms, official seal, sacred symbol, copied ceremonial or traditional pattern, political messaging, copied military identity, or official service identity is used. Country-led scenes use large dimensional secular limestone terraces, rose-stone facades, canyon strata, desert arches, gulf bands and mountain silhouettes instead.", "No literal Dominican Republic flag, coat of arms, official seal, sacred symbol, copied ceremonial or traditional pattern, political messaging, copied military identity, or official service identity is used. Country-led scenes use large dimensional secular colonial arcades, Ozama river bands, mountain terraces, amber facets, bay curves, palm fans and beach crescents instead."],
  ["Scenes 1492 and 1493 each carry hard large Jordan motifs on three women and submersible construction language on at least two. Scenes 1494 and 1495 use four different theme-led deep-sea outfits without country map prints while Jordan landmarks remain equally foregrounded.", "Scenes 1496 and 1497 each carry hard large Dominican Republic motifs on three women and airship construction language on at least two. Scenes 1498 and 1499 use four different theme-led polar-airship outfits without country map prints while Dominican Republic landmarks remain equally foregrounded."],
  ["The scenes foreground Amman Citadel, Petra, Wadi Rum, and Aqaba.", "The scenes foreground Santo Domingo Colonial City, Puerto Plata, Samaná Bay, and Punta Cana."],
  ["two Jordan images plus one accepted Haiti image", "two Dominican Republic images plus one accepted Jordan image"],
  ["Jordan ${heartGlyph} Haiti", "Dominican Republic ${heartGlyph} Jordan"],
  ["restrained Jordan limestone-terrace and rose-stone embroidery with subtle deep-sea submersible seam tailoring", "restrained Dominican colonial-arcade and Caribbean-shoal embroidery with subtle polar-airship seam tailoring"]
];

let output = source;
for (const [from, to] of replacements) {
  if (!output.includes(from)) throw new Error(`Missing replacement token: ${from}`);
  output = output.replaceAll(from, to);
}
fs.writeFileSync("tmp/world-195x4/batch-369/materialize-batch-369.mjs", output);
