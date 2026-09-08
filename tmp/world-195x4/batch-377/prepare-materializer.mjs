import fs from "node:fs";
import path from "node:path";

const source = path.resolve("tmp/world-195x4/batch-376/materialize-batch-376.mjs");
const target = path.resolve("tmp/world-195x4/batch-377/materialize-batch-377.mjs");
let text = fs.readFileSync(source, "utf8");

const replacements = [
  ["lithuaniaPalette, lithuaniaProhibitions, lithuaniaSceneSpecs", "qatarPalette, qatarProhibitions, qatarSceneSpecs"],
  ["./lithuania-scene-specs.mjs", "./qatar-scene-specs.mjs"],
  ["const batch = 376;", "const batch = 377;"],
  ["const country = \"Lithuania\";", "const country = \"Qatar\";"],
  ["const countrySlug = \"lithuania\";", "const countrySlug = \"qatar\";"],
  ["const firstScene = 1524;", "const firstScene = 1528;"],
  ["tmp/world-195x4/batch-376", "tmp/world-195x4/batch-377"],
  ["const palette = lithuaniaPalette;", "const palette = qatarPalette;"],
  ["const commonProhibitions = lithuaniaProhibitions;", "const commonProhibitions = qatarProhibitions;"],
  ["const sceneSpecs = lithuaniaSceneSpecs;", "const sceneSpecs = qatarSceneSpecs;"],
  ["restrained Lithuanian river-curve and dune-arc embroidery with subtle civilian-helicopter seam tailoring", "restrained Qatari Corniche-curve and dune-water embroidery with subtle rescue-vessel seam tailoring"],
  ["civilian helicopter flight couture", "fictional coast-guard rescue-vessel couture"],
  ["The theme and Lithuania location", "The theme and Qatar location"],
  ["#Lithuania", "#Qatar"],
  ["batch376-lithuania", "batch377-qatar"],
  ["active: \"fictional coast-guard rescue-vessel couture\",\n    batchOrdinalWithinTheme: 2", "active: \"fictional coast-guard rescue-vessel couture\",\n    batchOrdinalWithinTheme: 1"],
  ["nextQueueCountry: \"Qatar\"", "nextQueueCountry: \"Jamaica\""],
  ["nextQueueBatch: 377", "nextQueueBatch: 378"],
  ["nextQueueScenes: [1528, 1529, 1530, 1531]", "nextQueueScenes: [1532, 1533, 1534, 1535]"],
  ["nextCinematicTheme: { active: \"fictional coast-guard rescue-vessel couture\", batchOrdinalWithinTheme: 1 }", "nextCinematicTheme: { active: \"fictional coast-guard rescue-vessel couture\", batchOrdinalWithinTheme: 2 }"],
  ["No literal Lithuania flag, coat of arms, official seal, sacred symbol, copied folk pattern, copied ceremonial pattern, political messaging, copied military identity, police identity, emergency-service identity, or official service identity is used. Country-led scenes use large dimensional secular river curves, Old Town rooflines, lake bands, brick towers, dune arcs, forest strips and confluence curves instead.", "No literal Qatar flag, coat of arms, official seal, sacred symbol, copied traditional pattern, political messaging, copied military identity, police identity, emergency-service identity, or official service identity is used. Country-led scenes use large dimensional secular Corniche curves, skyline fins, dhow-harbor ribs, fort walls, corner towers and settlement grids instead."],
  ["Scenes 1524 and 1525 each carry hard large Lithuania motifs on three women and civilian-helicopter construction language on at least two. Scenes 1526 and 1527 use four different theme-led civilian-helicopter outfits without country map prints while Lithuania landmarks remain equally foregrounded.", "Scenes 1528 and 1529 each carry hard large Qatar motifs on three women and fictional rescue-vessel construction language on at least two. Scenes 1530 and 1531 use four different theme-led rescue-vessel outfits without country map prints while Qatar landmarks remain equally foregrounded."],
  ["The scenes foreground Vilnius, Trakai, the Curonian Spit, and Kaunas.", "The scenes foreground Doha Corniche, Al Zubarah, Khor Al Adaid, and Al Thakhira mangroves."],
  ["two Lithuania images plus one accepted Namibia image", "two Qatar images plus one accepted Armenia image"],
  ["captionIfEligible: `Lithuania ${heartGlyph} Namibia ${hashtags.join(\" \")}`", "captionIfEligible: `Qatar ${heartGlyph} Armenia ${hashtags.join(\" \")}`"],
  ["batch-376-lithuania-preflight.json", "batch-377-qatar-preflight.json"]
];

for (const [from, to] of replacements) {
  if (!text.includes(from)) throw new Error(`Missing replacement source: ${from}`);
  text = text.replaceAll(from, to);
}

text = text.replace(/  researchSources: \[[\s\S]*?\n  \],\n  faceAnchors:/, `  researchSources: [
    { url: "https://www.britannica.com/place/Qatar", usedFor: "Qatar geography and regions" },
    { url: "https://whc.unesco.org/en/list/1402/", usedFor: "Al Zubarah archaeological landscape" },
    { url: "https://visitqatar.com/intl-en/things-to-do/adventure-sports/nature/khor-al-adaid", usedFor: "Khor Al Adaid dunes and Inland Sea" },
    { url: "https://visitqatar.com/intl-en/things-to-do/adventure-sports/nature/al-thakira-mangroves", usedFor: "Al Thakhira mangrove setting" },
  ],
  faceAnchors:`);

fs.writeFileSync(target, text);
console.log(target);
