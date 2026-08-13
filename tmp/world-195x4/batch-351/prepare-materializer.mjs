import fs from "node:fs";
import path from "node:path";

const sourcePath = path.resolve("tmp/world-195x4/batch-350/materialize-batch-350.mjs");
const outputPath = path.resolve("tmp/world-195x4/batch-351/materialize-batch-351.mjs");
let source = fs.readFileSync(sourcePath, "utf8");

const replacements = [
  ["djiboutiPalette", "southSudanPalette"],
  ["djiboutiProhibitions", "southSudanProhibitions"],
  ["djiboutiSceneSpecs", "southSudanSceneSpecs"],
  ["./djibouti-scene-specs.mjs", "./south-sudan-scene-specs.mjs"],
  ["batch-350", "batch-351"],
  ["batch350", "batch351"],
  ["const batch = 350;", "const batch = 351;"],
  ["const country = \"Djibouti\";", "const country = \"South Sudan\";"],
  ["const countrySlug = \"djibouti\";", "const countrySlug = \"south-sudan\";"],
  ["const firstScene = 1420;", "const firstScene = 1424;"],
  ["scene-1420", "scene-1424"],
  ["scene-1421", "scene-1425"],
  ["scene-1422", "scene-1426"],
  ["scene-1423", "scene-1427"],
  ["#Djibouti", "#SouthSudan"],
  ["Djibouti ${heartGlyph} Vatican City", "South Sudan ${heartGlyph} Djibouti"],
  ["The theme and Djibouti location", "The theme and South Sudan location"],
  ["salt-white top with restrained Djibouti rift-and-gulf embroidery and subtle polar-airship seam tailoring", "station-white top with restrained South Sudan Nile-current and mountain-contour embroidery and subtle orbital research-station seam tailoring"],
  ["active: \"polar airship couture\",\n+    batchOrdinalWithinTheme: 2", "active: \"orbital research-station couture\",\n+    batchOrdinalWithinTheme: 1"],
  ["nextQueueCountry: \"South Sudan\"", "nextQueueCountry: \"Somalia\""],
  ["nextQueueBatch: 351", "nextQueueBatch: 352"],
  ["nextQueueScenes: [1424, 1425, 1426, 1427]", "nextQueueScenes: [1428, 1429, 1430, 1431]"],
  ["nextCinematicTheme: { active: \"orbital research-station couture\", batchOrdinalWithinTheme: 1 }", "nextCinematicTheme: { active: \"orbital research-station couture\", batchOrdinalWithinTheme: 2 }"],
  ["attachmentShape: \"two Djibouti images plus one accepted Vatican City image\"", "attachmentShape: \"two South Sudan images plus one accepted Djibouti image\""],
  ["active: \"polar airship couture\",\r\n    batchOrdinalWithinTheme: 2", "active: \"orbital research-station couture\",\r\n    batchOrdinalWithinTheme: 1"],
  ["Scenes 1420 and 1421 each carry hard large Djibouti motifs on three women and polar-airship construction language on at least two. Scenes 1422 and 1423 use four different theme-led polar-airship outfits without country map prints while Djibouti landmarks remain equally foregrounded.", "Scenes 1424 and 1425 each carry hard large South Sudan motifs on three women and orbital research-station construction language on at least two. Scenes 1426 and 1427 use four different theme-led orbital-station outfits without country map prints while South Sudan landmarks remain equally foregrounded."],
  ["{ url: \"https://whc.unesco.org/en/tentativelists/5959/\", usedFor: \"Lake Assal mineral lake and rift landscape\" },\r\n    { url: \"https://whc.unesco.org/en/tentativelists/5965/\", usedFor: \"Lake Abbe chimneys and natural ecosystem\" },\r\n    { url: \"https://whc.unesco.org/en/tentativelists/5962/\", usedFor: \"Day Forest and Goda massif landscape\" }", "{ url: \"https://rsis.ramsar.org/RISapp/files/RISrep/SS1622RIS.pdf\", usedFor: \"Sudd freshwater channels, floodplain and wetland vegetation\" },\r\n    { url: \"https://wedocs.unep.org/bitstream/handle/20.500.11822/25528/SouthSudan_SoE2018.pdf\", usedFor: \"Boma National Park floodplain, plateau, hills and woodland\" },\r\n    { url: \"https://unoceans.un.org/www.cbd.int/doc/nr/nr-06/ss-nr-06-en.pdf\", usedFor: \"Imatong montane forest and biodiversity setting\" },\r\n    { url: \"https://blogs.worldbank.org/en/climatechange/new-energy-south-sudan\", usedFor: \"Juba and White Nile setting\" }"],
  ["batch-351-djibouti-preflight.json", "batch-351-south-sudan-preflight.json"],
  ["FNV-1a over the recorded batch351-djibouti keys", "FNV-1a over the recorded batch351-south-sudan keys"],
  ["Batch 347 also stores", "Batch 351 also stores"],
  ["No literal Djibouti flag, official seal, sacred symbol, copied ceremonial or traditional pattern, political messaging, copied military identity, or official service identity is used. Country-led scenes use large dimensional secular salt crystals, rift arcs, geothermal chimneys, gulf contours and juniper fans instead.", "No literal South Sudan flag, official seal, sacred symbol, copied ceremonial or traditional pattern, political messaging, copied military identity, or official service identity is used. Country-led scenes use large dimensional secular Nile-current bands, papyrus fans, wetland channels, savanna migration arcs and mountain contours instead."],
  ["Scenes 1424 and 1425 each carry hard large Djibouti motifs on three women and polar-airship construction language on at least two. Scenes 1426 and 1427 use four different theme-led polar-airship outfits without country map prints while Djibouti landmarks remain equally foregrounded.", "Scenes 1424 and 1425 each carry hard large South Sudan motifs on three women and orbital research-station construction language on at least two. Scenes 1426 and 1427 use four different theme-led orbital-station outfits without country map prints while South Sudan landmarks remain equally foregrounded."],
  ["The scenes foreground Lake Assal, Lake Abbe, the Gulf of Tadjoura, and Day Forest National Park.", "The scenes foreground Juba and the White Nile, the Sudd wetlands, Boma National Park, and the Imatong Mountains."],
  ["{ url: \"https://whc.unesco.org/en/tentativelists/5959/\", usedFor: \"Lake Assal mineral lake and rift landscape\" },\n+    { url: \"https://whc.unesco.org/en/tentativelists/5965/\", usedFor: \"Lake Abbe chimneys and natural ecosystem\" },\n+    { url: \"https://whc.unesco.org/en/tentativelists/5962/\", usedFor: \"Day Forest and Goda massif landscape\" }", "{ url: \"https://rsis.ramsar.org/RISapp/files/RISrep/SS1622RIS.pdf\", usedFor: \"Sudd freshwater channels, floodplain and wetland vegetation\" },\n+    { url: \"https://wedocs.unep.org/bitstream/handle/20.500.11822/25528/SouthSudan_SoE2018.pdf\", usedFor: \"Boma National Park floodplain, plateau, hills and woodland\" },\n+    { url: \"https://unoceans.un.org/www.cbd.int/doc/nr/nr-06/ss-nr-06-en.pdf\", usedFor: \"Imatong montane forest and biodiversity setting\" },\n+    { url: \"https://blogs.worldbank.org/en/climatechange/new-energy-south-sudan\", usedFor: \"Juba and White Nile setting\" }"],
];

for (const [from, to] of replacements) source = source.replaceAll(from, to);
source = source.replace(
  /cinematicTheme:\s*\{\s*active: "polar airship couture",\s*batchOrdinalWithinTheme: 2,/,
  'cinematicTheme: {\n    active: "orbital research-station couture",\n    batchOrdinalWithinTheme: 1,',
);
source = source.replace(
  /researchSources:\s*\[[\s\S]*?\],\s*faceAnchors:/,
  `researchSources: [
    { url: "https://rsis.ramsar.org/RISapp/files/RISrep/SS1622RIS.pdf", usedFor: "Sudd freshwater channels, floodplain and wetland vegetation" },
    { url: "https://wedocs.unep.org/bitstream/handle/20.500.11822/25528/SouthSudan_SoE2018.pdf", usedFor: "Boma National Park floodplain, plateau, hills and woodland" },
    { url: "https://unoceans.un.org/www.cbd.int/doc/nr/nr-06/ss-nr-06-en.pdf", usedFor: "Imatong montane forest and biodiversity setting" },
    { url: "https://blogs.worldbank.org/en/climatechange/new-energy-south-sudan", usedFor: "Juba and White Nile setting" },
  ],
  faceAnchors:`,
);
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, source, "utf8");
