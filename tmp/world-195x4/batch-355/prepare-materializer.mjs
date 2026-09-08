import fs from "node:fs";
import path from "node:path";

const sourcePath = path.resolve("tmp/world-195x4/batch-354/materialize-batch-354.mjs");
const outputPath = path.resolve("tmp/world-195x4/batch-355/materialize-batch-355.mjs");
let source = fs.readFileSync(sourcePath, "utf8");

const replacements = [
  ["guatemalaPalette", "ecuadorPalette"],
  ["guatemalaProhibitions", "ecuadorProhibitions"],
  ["guatemalaSceneSpecs", "ecuadorSceneSpecs"],
  ["./guatemala-scene-specs.mjs", "./ecuador-scene-specs.mjs"],
  ["batch-354", "batch-355"],
  ["batch354", "batch355"],
  ["const batch = 354;", "const batch = 355;"],
  ["const country = \"Guatemala\";", "const country = \"Ecuador\";"],
  ["const countrySlug = \"guatemala\";", "const countrySlug = \"ecuador\";"],
  ["const firstScene = 1436;", "const firstScene = 1440;"],
  ["private-jet aviation couture", "civilian helicopter flight couture"],
  ["#Guatemala", "#Ecuador"],
  ["Guatemala ${heartGlyph} Senegal", "Ecuador ${heartGlyph} Guatemala"],
  ["The theme and Guatemala location", "The theme and Ecuador location"],
  ["cloud-white top with restrained Guatemala volcanic-ridge and jade-facet embroidery and subtle civilian helicopter flight couture seam tailoring", "cloud-white top with restrained Ecuador Andean-ridge and volcanic-cone embroidery and subtle civilian helicopter flight couture seam tailoring"],
  ["nextQueueCountry: \"Ecuador\"", "nextQueueCountry: \"Netherlands\""],
  ["nextQueueBatch: 355", "nextQueueBatch: 356"],
  ["nextQueueScenes: [1440, 1441, 1442, 1443]", "nextQueueScenes: [1444, 1445, 1446, 1447]"],
  ["nextCinematicTheme: { active: \"civilian helicopter flight couture\", batchOrdinalWithinTheme: 1 }", "nextCinematicTheme: { active: \"civilian helicopter flight couture\", batchOrdinalWithinTheme: 2 }"],
  ["attachmentShape: \"two Guatemala images plus one accepted Senegal image\"", "attachmentShape: \"two Ecuador images plus one accepted Guatemala image\""],
  ["No literal Guatemala flag, coat of arms, official seal, sacred symbol, copied ceremonial or traditional pattern, political messaging, copied military identity, or official service identity is used. Country-led scenes use large dimensional secular volcanic ridges, jade facets, civic relief grids, colonial arch curves, lake currents and rainforest contours instead.", "No literal Ecuador flag, coat of arms, official seal, sacred symbol, copied ceremonial or traditional pattern, political messaging, copied military identity, or official service identity is used. Country-led scenes use large dimensional secular Andean ridges, volcanic cones, equatorial arcs, river braids, orchid forms and Pacific-current spirals instead."],
  ["The scenes foreground Guatemala City's Centro Civico, Antigua Guatemala's Santa Catalina Arch, Lake Atitlan, and Tikal's Great Plaza.", "The scenes foreground Quito's historic center, Cotopaxi, Cuenca's Tomebamba riverfront, and Bartolome Island in the Galapagos."],
  ["batch-355-guatemala-preflight.json", "batch-355-ecuador-preflight.json"],
];
for (const [from, to] of replacements) source = source.replaceAll(from, to);
source = source.replace(
  /cinematicTheme:\s*\{\s*active: "civilian helicopter flight couture",\s*batchOrdinalWithinTheme: 2,/,
  'cinematicTheme: {\n    active: "civilian helicopter flight couture",\n    batchOrdinalWithinTheme: 1,',
);
source = source.replace(
  /minimumCoverage: "[^"]+"/,
  'minimumCoverage: "Scenes 1440 and 1441 each carry hard large Ecuador motifs on three women and civilian-helicopter construction language on at least two. Scenes 1442 and 1443 use four different theme-led helicopter outfits without country map prints while Ecuador landmarks remain equally foregrounded."',
);
source = source.replace(
  /rollMethod: "[^"]+"/,
  'rollMethod: "FNV-1a over the recorded batch355-ecuador keys, reduced modulo 100. Male scene selection uses the full 32-bit hash reduced modulo 4. Repeated raw emotion labels receive one stored deterministic disambiguation roll so all four visible performances remain distinct. Batch 355 also stores one hard-love roll, mascot-state roll and holder selector, and odd-prop activation, holder, and family selectors per scene."',
);
source = source.replace(
  /researchSources:\s*\[[\s\S]*?\],\s*faceAnchors:/,
  `researchSources: [
    { url: "https://whc.unesco.org/en/list/2/", usedFor: "Quito historic center, urban fabric and Andean setting" },
    { url: "https://whc.unesco.org/en/list/863/", usedFor: "Cuenca historic riverfront, tile roofs and mountain setting" },
    { url: "https://whc.unesco.org/en/list/1/", usedFor: "Galapagos volcanic landscapes, Bartolome and marine setting" },
    { url: "https://www.britannica.com/place/Cotopaxi", usedFor: "Cotopaxi volcanic cone, ice cap and high Andean landscape" },
  ],
  faceAnchors:`,
);
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, source, "utf8");
