import fs from "node:fs";

const source = fs.readFileSync("tmp/world-195x4/batch-369/materialize-batch-369.mjs", "utf8");
const replacements = [
  ['import { dominicanRepublicPalette, dominicanRepublicProhibitions, dominicanRepublicSceneSpecs } from "./dominican-republic-scene-specs.mjs";', 'import { unitedArabEmiratesPalette, unitedArabEmiratesProhibitions, unitedArabEmiratesSceneSpecs } from "./united-arab-emirates-scene-specs.mjs";'],
  ["const batch = 369;", "const batch = 370;"],
  ['const country = "Dominican Republic";', 'const country = "United Arab Emirates";'],
  ['const countrySlug = "dominican-republic";', 'const countrySlug = "united-arab-emirates";'],
  ["const firstScene = 1496;", "const firstScene = 1500;"],
  ['const root = path.resolve("tmp/world-195x4/batch-369");', 'const root = path.resolve("tmp/world-195x4/batch-370");'],
  ["const palette = dominicanRepublicPalette;", "const palette = unitedArabEmiratesPalette;"],
  ["const commonProhibitions = dominicanRepublicProhibitions;", "const commonProhibitions = unitedArabEmiratesProhibitions;"],
  ["const sceneSpecs = dominicanRepublicSceneSpecs;", "const sceneSpecs = unitedArabEmiratesSceneSpecs;"],
  ["The theme and Dominican Republic location", "The theme and United Arab Emirates location"],
  ['const hashtags = ["#DominicanRepublic"];', 'const hashtags = ["#UnitedArabEmirates"];'],
  ["batch369-dominican-republic", "batch370-united-arab-emirates"],
  ["batch-369-dominican-republic-preflight.json", "batch-370-united-arab-emirates-preflight.json"],
  ["batchOrdinalWithinTheme: 1,", "batchOrdinalWithinTheme: 2,"],
  ['nextQueueCountry: "United Arab Emirates",', 'nextQueueCountry: "Cuba",'],
  ["nextQueueBatch: 370,", "nextQueueBatch: 371,"],
  ["nextQueueScenes: [1500, 1501, 1502, 1503],", "nextQueueScenes: [1504, 1505, 1506, 1507],"],
  ['nextCinematicTheme: { active: "polar airship couture", batchOrdinalWithinTheme: 2 },', 'nextCinematicTheme: { active: "orbital research-station couture", batchOrdinalWithinTheme: 1 },'],
  ['{ url: "https://whc.unesco.org/en/list/526/", usedFor: "Santo Domingo Colonial City architecture and Ozama setting" },', '{ url: "https://www.britannica.com/place/Dubai-United-Arab-Emirates", usedFor: "Dubai skyline and desert setting" },'],
  ['{ url: "https://www.britannica.com/place/Dominican-Republic", usedFor: "Dominican Republic geography, cities and coasts" },', '{ url: "https://www.britannica.com/place/United-Arab-Emirates", usedFor: "United Arab Emirates cities, Gulf coast and mountain geography" },'],
  ['{ url: "https://www.britannica.com/place/Puerto-Plata-Dominican-Republic", usedFor: "Puerto Plata mountain and Atlantic setting" },', '{ url: "https://whc.unesco.org/en/list/1343/", usedFor: "Al Ain oasis and falaj cultural landscape" },'],
  ['{ url: "https://www.britannica.com/place/Samana-Bay", usedFor: "Samana Bay and peninsula setting" },', '{ url: "https://www.louvreabudhabi.ae/en/about-us", usedFor: "Louvre Abu Dhabi dome and waterfront architecture" },'],
  ["No literal Dominican Republic flag, coat of arms, official seal, sacred symbol, copied ceremonial or traditional pattern, political messaging, copied military identity, or official service identity is used. Country-led scenes use large dimensional secular colonial arcades, Ozama river bands, mountain terraces, amber facets, bay curves, palm fans and beach crescents instead.", "No literal United Arab Emirates flag, coat of arms, official seal, sacred symbol, copied ceremonial or traditional pattern, political messaging, copied military identity, or official service identity is used. Country-led scenes use large dimensional secular skyline spires, Gulf curves, museum-dome lattice, oasis channels, palm fans, mountain switchbacks and escarpment layers instead."],
  ["Scenes 1496 and 1497 each carry hard large Dominican Republic motifs on three women and airship construction language on at least two. Scenes 1498 and 1499 use four different theme-led polar-airship outfits without country map prints while Dominican Republic landmarks remain equally foregrounded.", "Scenes 1500 and 1501 each carry hard large United Arab Emirates motifs on three women and airship construction language on at least two. Scenes 1502 and 1503 use four different theme-led polar-airship outfits without country map prints while United Arab Emirates landmarks remain equally foregrounded."],
  ["The scenes foreground Santo Domingo Colonial City, Puerto Plata, Samaná Bay, and Punta Cana.", "The scenes foreground Dubai, Abu Dhabi, Al Ain Oasis, and Jebel Jais."],
  ["two Dominican Republic images plus one accepted Jordan image", "two United Arab Emirates images plus one accepted Dominican Republic image"],
  ["Dominican Republic ${heartGlyph} Jordan", "United Arab Emirates ${heartGlyph} Dominican Republic"],
  ["restrained Dominican colonial-arcade and Caribbean-shoal embroidery with subtle polar-airship seam tailoring", "restrained Emirates skyline-spire and oasis-channel embroidery with subtle polar-airship seam tailoring"]
];

let output = source;
for (const [from, to] of replacements) {
  if (!output.includes(from)) throw new Error(`Missing replacement token: ${from}`);
  output = output.replaceAll(from, to);
}
fs.writeFileSync("tmp/world-195x4/batch-370/materialize-batch-370.mjs", output);
