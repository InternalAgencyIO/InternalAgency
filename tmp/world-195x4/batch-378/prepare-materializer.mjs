import fs from "node:fs";
import path from "node:path";

const source = path.resolve("tmp/world-195x4/batch-377/materialize-batch-377.mjs");
const target = path.resolve("tmp/world-195x4/batch-378/materialize-batch-378.mjs");
let text = fs.readFileSync(source, "utf8");

const replacements = [
  ["qatarPalette, qatarProhibitions, qatarSceneSpecs", "jamaicaPalette, jamaicaProhibitions, jamaicaSceneSpecs"],
  ["./qatar-scene-specs.mjs", "./jamaica-scene-specs.mjs"],
  ["const batch = 377;", "const batch = 378;"],
  ["const country = \"Qatar\";", "const country = \"Jamaica\";"],
  ["const countrySlug = \"qatar\";", "const countrySlug = \"jamaica\";"],
  ["const firstScene = 1528;", "const firstScene = 1532;"],
  ["tmp/world-195x4/batch-377", "tmp/world-195x4/batch-378"],
  ["const palette = qatarPalette;", "const palette = jamaicaPalette;"],
  ["const commonProhibitions = qatarProhibitions;", "const commonProhibitions = jamaicaProhibitions;"],
  ["const sceneSpecs = qatarSceneSpecs;", "const sceneSpecs = jamaicaSceneSpecs;"],
  ["restrained Qatari Corniche-curve and dune-water embroidery with subtle rescue-vessel seam tailoring", "restrained Jamaican harbor-curve and mountain-water embroidery with subtle rescue-vessel seam tailoring"],
  ["The theme and Qatar location", "The theme and Jamaica location"],
  ["#Qatar", "#Jamaica"],
  ["batch377-qatar", "batch378-jamaica"],
  ["batchOrdinalWithinTheme: 1", "batchOrdinalWithinTheme: 2"],
  ["nextQueueCountry: \"Jamaica\"", "nextQueueCountry: \"Gambia\""],
  ["nextQueueBatch: 378", "nextQueueBatch: 379"],
  ["nextQueueScenes: [1532, 1533, 1534, 1535]", "nextQueueScenes: [1536, 1537, 1538, 1539]"],
  ["nextCinematicTheme: { active: \"fictional coast-guard rescue-vessel couture\", batchOrdinalWithinTheme: 2 }", "nextCinematicTheme: { active: \"orbital spaceship couture\", batchOrdinalWithinTheme: 1 }"],
  ["No literal Qatar flag, coat of arms, official seal, sacred symbol, copied traditional pattern, political messaging, copied military identity, police identity, emergency-service identity, or official service identity is used. Country-led scenes use large dimensional secular Corniche curves, skyline fins, dhow-harbor ribs, fort walls, corner towers and settlement grids instead.", "No literal Jamaica flag, coat of arms, official seal, sacred symbol, copied traditional pattern, political messaging, copied military identity, police identity, emergency-service identity, or official service identity is used. Country-led scenes use large dimensional secular harbor curves, skyline terraces, mountain layers, shoreline bands, fort-wall geometry and harbor-mouth arcs instead."],
  ["Scenes 1528 and 1529 each carry hard large Qatar motifs on three women and fictional rescue-vessel construction language on at least two. Scenes 1530 and 1531 use four different theme-led rescue-vessel outfits without country map prints while Qatar landmarks remain equally foregrounded.", "Scenes 1532 and 1533 each carry hard large Jamaica motifs on three women and fictional rescue-vessel construction language on at least two. Scenes 1534 and 1535 use four different theme-led rescue-vessel outfits without country map prints while Jamaica landmarks remain equally foregrounded."],
  ["The scenes foreground Doha Corniche, Al Zubarah, Khor Al Adaid, and Al Thakhira mangroves.", "The scenes foreground Kingston Harbour, Port Royal, Dunn's River Falls, and Negril."],
  ["two Qatar images plus one accepted Armenia image", "two Jamaica images plus one accepted Qatar image"],
  ["captionIfEligible: `Qatar ${heartGlyph} Armenia ${hashtags.join(\" \")}`", "captionIfEligible: `Jamaica ${heartGlyph} Qatar ${hashtags.join(\" \")}`"],
  ["batch-377-qatar-preflight.json", "batch-378-jamaica-preflight.json"]
];

for (const [from, to] of replacements) {
  if (!text.includes(from)) throw new Error(`Missing replacement source: ${from}`);
  text = text.replaceAll(from, to);
}

text = text.replace(/  researchSources: \[[\s\S]*?\n  \],\n  faceAnchors:/, `  researchSources: [
    { url: "https://www.britannica.com/place/Jamaica", usedFor: "Jamaica geography and regions" },
    { url: "https://www.britannica.com/place/Kingston-Jamaica", usedFor: "Kingston Harbour and city setting" },
    { url: "https://www.jnht.com/site_port_royal.php", usedFor: "Port Royal shoreline and Fort Charles exterior" },
    { url: "https://www.visitjamaica.com/listing/dunns-river-falls-and-park/440/", usedFor: "Dunn's River limestone cascades" },
  ],
  faceAnchors:`);

fs.writeFileSync(target, text);
console.log(target);
