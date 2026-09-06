import fs from "node:fs";
import path from "node:path";

const source = path.resolve("tmp/world-195x4/batch-378/materialize-batch-378.mjs");
const target = path.resolve("tmp/world-195x4/batch-379/materialize-batch-379.mjs");
let text = fs.readFileSync(source, "utf8");

const replacements = [
  ["jamaicaPalette, jamaicaProhibitions, jamaicaSceneSpecs", "gambiaPalette, gambiaProhibitions, gambiaSceneSpecs"],
  ["./jamaica-scene-specs.mjs", "./gambia-scene-specs.mjs"],
  ["const batch = 378;", "const batch = 379;"],
  ["const country = \"Jamaica\";", "const country = \"Gambia\";"],
  ["const countrySlug = \"jamaica\";", "const countrySlug = \"gambia\";"],
  ["const firstScene = 1532;", "const firstScene = 1536;"],
  ["tmp/world-195x4/batch-378", "tmp/world-195x4/batch-379"],
  ["const palette = jamaicaPalette;", "const palette = gambiaPalette;"],
  ["const commonProhibitions = jamaicaProhibitions;", "const commonProhibitions = gambiaProhibitions;"],
  ["const sceneSpecs = jamaicaSceneSpecs;", "const sceneSpecs = gambiaSceneSpecs;"],
  ["restrained Jamaican harbor-curve and mountain-water embroidery with subtle rescue-vessel seam tailoring", "restrained Gambian river-curve and mangrove-island embroidery with subtle orbital-capsule seam tailoring"],
  ["fictional coast-guard rescue-vessel couture", "orbital spaceship couture"],
  ["The theme and Jamaica location", "The theme and Gambia location"],
  ["#Jamaica", "#Gambia"],
  ["batch378-jamaica", "batch379-gambia"],
  ["batchOrdinalWithinTheme: 2", "batchOrdinalWithinTheme: 1"],
  ["nextQueueCountry: \"Gambia\"", "nextQueueCountry: \"Gabon\""],
  ["nextQueueBatch: 379", "nextQueueBatch: 380"],
  ["nextQueueScenes: [1536, 1537, 1538, 1539]", "nextQueueScenes: [1540, 1541, 1542, 1543]"],
  ["nextCinematicTheme: { active: \"orbital spaceship couture\", batchOrdinalWithinTheme: 1 }", "nextCinematicTheme: { active: \"orbital spaceship couture\", batchOrdinalWithinTheme: 2 }"],
  ["No literal Jamaica flag, coat of arms, official seal, sacred symbol, copied traditional pattern, political messaging, copied military identity, police identity, emergency-service identity, or official service identity is used. Country-led scenes use large dimensional secular harbor curves, skyline terraces, mountain layers, shoreline bands, fort-wall geometry and harbor-mouth arcs instead.", "No literal Gambia flag, coat of arms, official seal, sacred symbol, copied traditional pattern, political messaging, copied military identity, police identity, emergency-service identity, or official service identity is used. Country-led scenes use large dimensional secular river-mouth curves, Banjul skyline steps, island outlines, solemn masonry walls and river bands instead."],
  ["Scenes 1532 and 1533 each carry hard large Jamaica motifs on three women and fictional rescue-vessel construction language on at least two. Scenes 1534 and 1535 use four different theme-led rescue-vessel outfits without country map prints while Jamaica landmarks remain equally foregrounded.", "Scenes 1536 and 1537 each carry hard large Gambia motifs on three women and orbital-spaceship construction language on at least two. Scenes 1538 and 1539 use four different theme-led orbital-spaceship outfits without country map prints while Gambian landmarks remain equally foregrounded."],
  ["The scenes foreground Kingston Harbour, Port Royal, Dunn's River Falls, and Negril.", "The scenes foreground Banjul, Kunta Kinteh Island, Tanji, and the River Gambia mangroves."],
  ["two Jamaica images plus one accepted Qatar image", "two Gambia images plus one accepted Qatar image"],
  ["captionIfEligible: `Jamaica ${heartGlyph} Qatar ${hashtags.join(\" \")}`", "captionIfEligible: `Gambia ${heartGlyph} Qatar ${hashtags.join(\" \")}`"],
  ["batch-378-jamaica-preflight.json", "batch-379-gambia-preflight.json"]
];

for (const [from, to] of replacements) {
  if (!text.includes(from)) throw new Error(`Missing replacement source: ${from}`);
  text = text.replaceAll(from, to);
}

text = text.replace(/  researchSources: \[[\s\S]*?\n  \],\n  faceAnchors:/, `  researchSources: [
    { url: "https://www.britannica.com/place/The-Gambia", usedFor: "Gambia geography and River Gambia setting" },
    { url: "https://whc.unesco.org/en/list/761/", usedFor: "Kunta Kinteh Island and related solemn heritage" },
    { url: "https://www.britannica.com/place/Banjul", usedFor: "Banjul city and river-mouth setting" },
    { url: "https://www.britannica.com/place/Gambia-River", usedFor: "River Gambia channels and landscape" },
  ],
  faceAnchors:`);

fs.writeFileSync(target, text);
console.log(target);
