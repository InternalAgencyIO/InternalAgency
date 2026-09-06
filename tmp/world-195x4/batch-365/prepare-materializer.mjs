import fs from "node:fs";

const source = fs.readFileSync("tmp/world-195x4/batch-364/materialize-batch-364.mjs", "utf8");
const replacements = [
  ['import { tunisiaPalette, tunisiaProhibitions, tunisiaSceneSpecs } from "./tunisia-scene-specs.mjs";', 'import { southSudanPalette, southSudanProhibitions, southSudanSceneSpecs } from "./south-sudan-scene-specs.mjs";'],
  ["const batch = 364;", "const batch = 365;"],
  ['const country = "Tunisia";', 'const country = "South Sudan";'],
  ['const countrySlug = "tunisia";', 'const countrySlug = "south-sudan";'],
  ["const firstScene = 1476;", "const firstScene = 1480;"],
  ['const root = path.resolve("tmp/world-195x4/batch-364");', 'const root = path.resolve("tmp/world-195x4/batch-365");'],
  ["const palette = tunisiaPalette;", "const palette = southSudanPalette;"],
  ["const commonProhibitions = tunisiaProhibitions;", "const commonProhibitions = southSudanProhibitions;"],
  ["const sceneSpecs = tunisiaSceneSpecs;", "const sceneSpecs = southSudanSceneSpecs;"],
  ["The theme and Tunisia location", "The theme and South Sudan location"],
  ['const hashtags = ["#Tunisia"];', 'const hashtags = ["#SouthSudan"];'],
  ["batch364-tunisia", "batch365-south-sudan"],
  ['active: "Moon-surface expedition couture",', 'active: "near-Sun solar-observation couture",'],
  ["batchOrdinalWithinTheme: 2,", "batchOrdinalWithinTheme: 1,"],
  ['nextQueueCountry: "South Sudan",', 'nextQueueCountry: "Belgium",'],
  ["nextQueueBatch: 365,", "nextQueueBatch: 366,"],
  ["nextQueueScenes: [1480, 1481, 1482, 1483],", "nextQueueScenes: [1484, 1485, 1486, 1487],"],
  ['nextCinematicTheme: { active: "near-Sun solar-observation couture", batchOrdinalWithinTheme: 1 },', 'nextCinematicTheme: { active: "near-Sun solar-observation couture", batchOrdinalWithinTheme: 2 },'],
  ['{ url: "https://www.britannica.com/place/Tunis", usedFor: "Tunis city, lake and Mediterranean setting" },', '{ url: "https://www.britannica.com/place/Juba", usedFor: "Juba, White Nile and city setting" },'],
  ['{ url: "https://www.britannica.com/place/Tunisia", usedFor: "Tunisia Mediterranean, desert and salt-lake geography" },', '{ url: "https://www.britannica.com/place/South-Sudan", usedFor: "South Sudan rivers, wetlands, savanna and mountains" },'],
  ['{ url: "https://whc.unesco.org/en/list/38/", usedFor: "El Jem amphitheatre architecture" },', '{ url: "https://www.britannica.com/place/Al-Sudd", usedFor: "Sudd wetland channels and reed landscape" },'],
  ['{ url: "https://www.britannica.com/place/Chott-el-Djerid", usedFor: "Chott el Jerid salt-lake landscape" },', '{ url: "https://www.britannica.com/place/Imatong-Mountains", usedFor: "Imatong mountain and highland landscape" },'],
  ["No literal Tunisia flag, coat of arms, official seal, sacred symbol, copied ceremonial or traditional pattern, political messaging, copied military identity, or official service identity is used. Country-led scenes use large dimensional secular Mediterranean currents, white-city terraces, blue door arches, amphitheatre arcades, salt-lake bands and oasis fans instead.", "No literal South Sudan flag, coat of arms, official seal, sacred symbol, copied ceremonial or traditional pattern, political messaging, copied military identity, or official service identity is used. Country-led scenes use large dimensional secular Nile currents, Juba skyline arcs, Sudd reed channels, Nimule rapids, savanna bands and Imatong mountain profiles instead."],
  ["Scenes 1476 and 1477 each carry hard large Tunisia motifs on three women and Moon-expedition construction language on at least two. Scenes 1478 and 1479 use four different theme-led lunar expedition outfits without country map prints while Tunisia landmarks remain equally foregrounded.", "Scenes 1480 and 1481 each carry hard large South Sudan motifs on three women and solar-observation construction language on at least two. Scenes 1482 and 1483 use four different theme-led solar-observation outfits without country map prints while South Sudan landmarks remain equally foregrounded."],
  ["The scenes foreground Tunis, Sidi Bou Said, El Jem, and Chott el Jerid with Tozeur.", "The scenes foreground Juba and the White Nile, the Sudd wetlands, Nimule and Fula Rapids, and the Imatong Mountains."],
  ["two Tunisia images plus one accepted Bolivia image", "two South Sudan images plus one accepted Tunisia image"],
  ["Tunisia ${heartGlyph} Bolivia", "South Sudan ${heartGlyph} Tunisia"],
  ["batch-364-tunisia-preflight.json", "batch-365-south-sudan-preflight.json"],
  ["batch-364-tunisia-preflight.json", "batch-365-south-sudan-preflight.json"],
  ["restrained Tunisia Mediterranean-current and salt-band embroidery with subtle Moon-surface expedition seam tailoring", "restrained South Sudan Nile-current and mountain-profile embroidery with subtle near-Sun solar-observation seam tailoring"],
];

let output = source;
for (const [from, to] of replacements) {
  if (!output.includes(from)) throw new Error(`Missing replacement token: ${from}`);
  output = output.replace(from, to);
}
fs.writeFileSync("tmp/world-195x4/batch-365/materialize-batch-365.mjs", output);
