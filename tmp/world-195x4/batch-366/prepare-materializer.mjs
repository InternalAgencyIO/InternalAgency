import fs from "node:fs";

const source = fs.readFileSync("tmp/world-195x4/batch-365/materialize-batch-365.mjs", "utf8");
const replacements = [
  ['import { southSudanPalette, southSudanProhibitions, southSudanSceneSpecs } from "./south-sudan-scene-specs.mjs";', 'import { belgiumPalette, belgiumProhibitions, belgiumSceneSpecs } from "./belgium-scene-specs.mjs";'],
  ["const batch = 365;", "const batch = 366;"],
  ['const country = "South Sudan";', 'const country = "Belgium";'],
  ['const countrySlug = "south-sudan";', 'const countrySlug = "belgium";'],
  ["const firstScene = 1480;", "const firstScene = 1484;"],
  ['const root = path.resolve("tmp/world-195x4/batch-365");', 'const root = path.resolve("tmp/world-195x4/batch-366");'],
  ["const palette = southSudanPalette;", "const palette = belgiumPalette;"],
  ["const commonProhibitions = southSudanProhibitions;", "const commonProhibitions = belgiumProhibitions;"],
  ["const sceneSpecs = southSudanSceneSpecs;", "const sceneSpecs = belgiumSceneSpecs;"],
  ["The theme and South Sudan location", "The theme and Belgium location"],
  ['const hashtags = ["#SouthSudan"];', 'const hashtags = ["#Belgium"];'],
  ["batch365-south-sudan", "batch366-belgium"],
  ["batchOrdinalWithinTheme: 1,", "batchOrdinalWithinTheme: 2,"],
  ['nextQueueCountry: "Belgium",', 'nextQueueCountry: "Haiti",'],
  ["nextQueueBatch: 366,", "nextQueueBatch: 367,"],
  ["nextQueueScenes: [1484, 1485, 1486, 1487],", "nextQueueScenes: [1488, 1489, 1490, 1491],"],
  ['nextCinematicTheme: { active: "near-Sun solar-observation couture", batchOrdinalWithinTheme: 2 },', 'nextCinematicTheme: { active: "deep-sea submersible couture", batchOrdinalWithinTheme: 1 },'],
  ['{ url: "https://www.britannica.com/place/Juba", usedFor: "Juba, White Nile and city setting" },', '{ url: "https://www.britannica.com/place/Brussels", usedFor: "Brussels Grand Place and city setting" },'],
  ['{ url: "https://www.britannica.com/place/South-Sudan", usedFor: "South Sudan rivers, wetlands, savanna and mountains" },', '{ url: "https://www.britannica.com/place/Belgium", usedFor: "Belgium cities, rivers and regional geography" },'],
  ['{ url: "https://www.britannica.com/place/Al-Sudd", usedFor: "Sudd wetland channels and reed landscape" },', '{ url: "https://whc.unesco.org/en/list/996/", usedFor: "Bruges historic center and canal architecture" },'],
  ['{ url: "https://www.britannica.com/place/Imatong-Mountains", usedFor: "Imatong mountain and highland landscape" },', '{ url: "https://www.britannica.com/place/Antwerp-Belgium", usedFor: "Antwerp Scheldt waterfront and port setting" },'],
  ["No literal South Sudan flag, coat of arms, official seal, sacred symbol, copied ceremonial or traditional pattern, political messaging, copied military identity, or official service identity is used. Country-led scenes use large dimensional secular Nile currents, Juba skyline arcs, Sudd reed channels, Nimule rapids, savanna bands and Imatong mountain profiles instead.", "No literal Belgium flag, coat of arms, official seal, sacred symbol, copied ceremonial or traditional pattern, political messaging, copied military identity, or official service identity is used. Country-led scenes use large dimensional secular guildhall rooflines, canal currents, belfry arcs, port geometry, river bands and limestone cliff profiles instead."],
  ["Scenes 1480 and 1481 each carry hard large South Sudan motifs on three women and solar-observation construction language on at least two. Scenes 1482 and 1483 use four different theme-led solar-observation outfits without country map prints while South Sudan landmarks remain equally foregrounded.", "Scenes 1484 and 1485 each carry hard large Belgium motifs on three women and solar-observation construction language on at least two. Scenes 1486 and 1487 use four different theme-led solar-observation outfits without country map prints while Belgium landmarks remain equally foregrounded."],
  ["The scenes foreground Juba and the White Nile, the Sudd wetlands, Nimule and Fula Rapids, and the Imatong Mountains.", "The scenes foreground Brussels Grand Place, Bruges canals, Antwerp waterfront, and Dinant on the Meuse."],
  ["two South Sudan images plus one accepted Tunisia image", "two Belgium images plus one accepted South Sudan image"],
  ["South Sudan ${heartGlyph} Tunisia", "Belgium ${heartGlyph} South Sudan"],
  ["batch-365-south-sudan-preflight.json", "batch-366-belgium-preflight.json"],
  ["batch-365-south-sudan-preflight.json", "batch-366-belgium-preflight.json"],
  ["restrained South Sudan Nile-current and mountain-profile embroidery with subtle near-Sun solar-observation seam tailoring", "restrained Belgium guildhall-roofline and canal-current embroidery with subtle near-Sun solar-observation seam tailoring"],
];

let output = source;
for (const [from, to] of replacements) {
  if (!output.includes(from)) throw new Error(`Missing replacement token: ${from}`);
  output = output.replace(from, to);
}
fs.writeFileSync("tmp/world-195x4/batch-366/materialize-batch-366.mjs", output);
