import fs from "node:fs";

const source = fs.readFileSync("tmp/world-195x4/batch-370/materialize-batch-370.mjs", "utf8");
const replacements = [
  ['import { unitedArabEmiratesPalette, unitedArabEmiratesProhibitions, unitedArabEmiratesSceneSpecs } from "./united-arab-emirates-scene-specs.mjs";', 'import { cubaPalette, cubaProhibitions, cubaSceneSpecs } from "./cuba-scene-specs.mjs";'],
  ["const batch = 370;", "const batch = 371;"],
  ['const country = "United Arab Emirates";', 'const country = "Cuba";'],
  ['const countrySlug = "united-arab-emirates";', 'const countrySlug = "cuba";'],
  ["const firstScene = 1500;", "const firstScene = 1504;"],
  ['const root = path.resolve("tmp/world-195x4/batch-370");', 'const root = path.resolve("tmp/world-195x4/batch-371");'],
  ["const palette = unitedArabEmiratesPalette;", "const palette = cubaPalette;"],
  ["const commonProhibitions = unitedArabEmiratesProhibitions;", "const commonProhibitions = cubaProhibitions;"],
  ["const sceneSpecs = unitedArabEmiratesSceneSpecs;", "const sceneSpecs = cubaSceneSpecs;"],
  ["The theme and United Arab Emirates location", "The theme and Cuba location"],
  ['const hashtags = ["#UnitedArabEmirates"];', 'const hashtags = ["#Cuba"];'],
  ["batch370-united-arab-emirates", "batch371-cuba"],
  ["batch-370-united-arab-emirates-preflight.json", "batch-371-cuba-preflight.json"],
  ['active: "polar airship couture",', 'active: "orbital research-station couture",'],
  ["batchOrdinalWithinTheme: 2,", "batchOrdinalWithinTheme: 1,"],
  ['nextQueueCountry: "Cuba",', 'nextQueueCountry: "Czechia",'],
  ["nextQueueBatch: 371,", "nextQueueBatch: 372,"],
  ["nextQueueScenes: [1504, 1505, 1506, 1507],", "nextQueueScenes: [1508, 1509, 1510, 1511],"],
  ['nextCinematicTheme: { active: "orbital research-station couture", batchOrdinalWithinTheme: 1 },', 'nextCinematicTheme: { active: "orbital research-station couture", batchOrdinalWithinTheme: 2 },'],
  ['{ url: "https://www.britannica.com/place/Dubai-United-Arab-Emirates", usedFor: "Dubai skyline and desert setting" },', '{ url: "https://whc.unesco.org/en/list/204/", usedFor: "Old Havana architecture and harbor setting" },'],
  ['{ url: "https://www.britannica.com/place/United-Arab-Emirates", usedFor: "United Arab Emirates cities, Gulf coast and mountain geography" },', '{ url: "https://www.britannica.com/place/Cuba", usedFor: "Cuba geography, cities and coasts" },'],
  ['{ url: "https://whc.unesco.org/en/list/1343/", usedFor: "Al Ain oasis and falaj cultural landscape" },', '{ url: "https://whc.unesco.org/en/list/460/", usedFor: "Trinidad urban architecture and valley setting" },'],
  ['{ url: "https://www.louvreabudhabi.ae/en/about-us", usedFor: "Louvre Abu Dhabi dome and waterfront architecture" },', '{ url: "https://whc.unesco.org/en/list/840/", usedFor: "Viñales Valley mogotes and agricultural landscape" },'],
  ["No literal United Arab Emirates flag, coat of arms, official seal, sacred symbol, copied ceremonial or traditional pattern, political messaging, copied military identity, or official service identity is used. Country-led scenes use large dimensional secular skyline spires, Gulf curves, museum-dome lattice, oasis channels, palm fans, mountain switchbacks and escarpment layers instead.", "No literal Cuba flag, coat of arms, official seal, sacred symbol, copied ceremonial or traditional pattern, political messaging, copied military identity, or official service identity is used. Country-led scenes use large dimensional secular Malecón curves, Havana rooflines, Trinidad cobbles, colonial arcades, Viñales mogotes, bay arcs and mountain silhouettes instead."],
  ["Scenes 1500 and 1501 each carry hard large United Arab Emirates motifs on three women and airship construction language on at least two. Scenes 1502 and 1503 use four different theme-led polar-airship outfits without country map prints while United Arab Emirates landmarks remain equally foregrounded.", "Scenes 1504 and 1505 each carry hard large Cuba motifs on three women and orbital-station construction language on at least two. Scenes 1506 and 1507 use four different theme-led orbital-research outfits without country map prints while Cuba landmarks remain equally foregrounded."],
  ["The scenes foreground Dubai, Abu Dhabi, Al Ain Oasis, and Jebel Jais.", "The scenes foreground Havana, Trinidad, Viñales Valley, and Santiago de Cuba Bay."],
  ["two United Arab Emirates images plus one accepted Dominican Republic image", "two Cuba images plus one accepted United Arab Emirates image"],
  ["United Arab Emirates ${heartGlyph} Dominican Republic", "Cuba ${heartGlyph} United Arab Emirates"],
  ["restrained Emirates skyline-spire and oasis-channel embroidery with subtle polar-airship seam tailoring", "restrained Cuba Malecón-curve and mogote embroidery with subtle orbital-research seam tailoring"]
];

let output = source;
for (const [from, to] of replacements) {
  if (!output.includes(from)) throw new Error(`Missing replacement token: ${from}`);
  output = output.replaceAll(from, to);
}
fs.writeFileSync("tmp/world-195x4/batch-371/materialize-batch-371.mjs", output);
