import fs from "node:fs";
import path from "node:path";

const source = path.resolve("tmp/world-195x4/batch-379/materialize-batch-379.mjs");
const target = path.resolve("tmp/world-195x4/batch-380/materialize-batch-380.mjs");
let text = fs.readFileSync(source, "utf8");

const replacements = [
  ["gambiaPalette, gambiaProhibitions, gambiaSceneSpecs", "gabonPalette, gabonProhibitions, gabonSceneSpecs"],
  ["./gambia-scene-specs.mjs", "./gabon-scene-specs.mjs"],
  ["const batch = 379;", "const batch = 380;"],
  ["const country = \"Gambia\";", "const country = \"Gabon\";"],
  ["const countrySlug = \"gambia\";", "const countrySlug = \"gabon\";"],
  ["const firstScene = 1536;", "const firstScene = 1540;"],
  ["tmp/world-195x4/batch-379", "tmp/world-195x4/batch-380"],
  ["const palette = gambiaPalette;", "const palette = gabonPalette;"],
  ["const commonProhibitions = gambiaProhibitions;", "const commonProhibitions = gabonProhibitions;"],
  ["const sceneSpecs = gambiaSceneSpecs;", "const sceneSpecs = gabonSceneSpecs;"],
  ["restrained Gambian river-curve and mangrove-island embroidery with subtle orbital-capsule seam tailoring", "restrained Gabonese estuary-curve and rainforest-waterfall embroidery with subtle orbital-capsule seam tailoring"],
  ["The theme and Gambia location", "The theme and Gabon location"],
  ["#Gambia", "#Gabon"],
  ["batch379-gambia", "batch380-gabon"],
  ["batchOrdinalWithinTheme: 1", "batchOrdinalWithinTheme: 2"],
  ["nextQueueCountry: \"Gabon\"", "nextQueueCountry: \"Botswana\""],
  ["nextQueueBatch: 380", "nextQueueBatch: 381"],
  ["nextQueueScenes: [1540, 1541, 1542, 1543]", "nextQueueScenes: [1544, 1545, 1546, 1547]"],
  ["nextCinematicTheme: { active: \"orbital spaceship couture\", batchOrdinalWithinTheme: 2 }", "nextCinematicTheme: { active: \"Mars-surface expedition couture\", batchOrdinalWithinTheme: 1 }"],
  ["No literal Gambia flag, coat of arms, official seal, sacred symbol, copied traditional pattern, political messaging, copied military identity, police identity, emergency-service identity, or official service identity is used. Country-led scenes use large dimensional secular river-mouth curves, Banjul skyline steps, island outlines, solemn masonry walls and river bands instead.", "No literal Gabon flag, coat of arms, official seal, sacred symbol, copied traditional pattern, political messaging, copied military identity, police identity, emergency-service identity, or official service identity is used. Country-led scenes use large dimensional secular waterfront curves, Libreville skyline terraces, forest-savanna bands, river arcs and hill layers instead."],
  ["Scenes 1536 and 1537 each carry hard large Gambia motifs on three women and orbital-spaceship construction language on at least two. Scenes 1538 and 1539 use four different theme-led orbital-spaceship outfits without country map prints while Gambian landmarks remain equally foregrounded.", "Scenes 1540 and 1541 each carry hard large Gabon motifs on three women and orbital-spaceship construction language on at least two. Scenes 1542 and 1543 use four different theme-led orbital-spaceship outfits without country map prints while Gabonese landmarks remain equally foregrounded."],
  ["The scenes foreground Banjul, Kunta Kinteh Island, Tanji, and the River Gambia mangroves.", "The scenes foreground Libreville, Lopé, Loango, and Kongou Falls."],
  ["two Gambia images plus one accepted Qatar image", "two Gabon images plus one accepted Qatar image"],
  ["captionIfEligible: `Gambia ${heartGlyph} Qatar ${hashtags.join(\" \")}`", "captionIfEligible: `Gabon ${heartGlyph} Qatar ${hashtags.join(\" \")}`"],
  ["batch-379-gambia-preflight.json", "batch-380-gabon-preflight.json"]
];

for (const [from, to] of replacements) {
  if (!text.includes(from)) throw new Error(`Missing replacement source: ${from}`);
  text = text.replaceAll(from, to);
}

text = text.replace(/  researchSources: \[[\s\S]*?\n  \],\n  faceAnchors:/, `  researchSources: [
    { url: "https://www.britannica.com/place/Gabon", usedFor: "Gabon geography and regions" },
    { url: "https://www.britannica.com/place/Libreville", usedFor: "Libreville waterfront setting" },
    { url: "https://whc.unesco.org/en/list/1147/", usedFor: "Lopé forest-savanna landscape" },
    { url: "https://whc.unesco.org/en/tentativelists/6685/", usedFor: "Ivindo and Kongou Falls landscape" },
  ],
  faceAnchors:`);

fs.writeFileSync(target, text);
console.log(target);
