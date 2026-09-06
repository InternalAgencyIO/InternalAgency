import fs from "node:fs";
import path from "node:path";

const sourcePath = path.resolve("tmp/world-195x4/batch-353/materialize-batch-353.mjs");
const outputPath = path.resolve("tmp/world-195x4/batch-354/materialize-batch-354.mjs");
let source = fs.readFileSync(sourcePath, "utf8");

const replacements = [
  ["senegalPalette", "guatemalaPalette"],
  ["senegalProhibitions", "guatemalaProhibitions"],
  ["senegalSceneSpecs", "guatemalaSceneSpecs"],
  ["./senegal-scene-specs.mjs", "./guatemala-scene-specs.mjs"],
  ["batch-353", "batch-354"],
  ["batch353", "batch354"],
  ["const batch = 353;", "const batch = 354;"],
  ["const country = \"Senegal\";", "const country = \"Guatemala\";"],
  ["const countrySlug = \"senegal\";", "const countrySlug = \"guatemala\";"],
  ["const firstScene = 1432;", "const firstScene = 1436;"],
  ["#Senegal", "#Guatemala"],
  ["Senegal ${heartGlyph} Somalia", "Guatemala ${heartGlyph} Senegal"],
  ["The theme and Senegal location", "The theme and Guatemala location"],
  ["ivory top with restrained Senegal river-current and mangrove-contour embroidery and subtle private-jet aviation seam tailoring", "cloud-white top with restrained Guatemala volcanic-ridge and jade-facet embroidery and subtle private-jet aviation seam tailoring"],
  ["nextQueueCountry: \"Guatemala\"", "nextQueueCountry: \"Ecuador\""],
  ["nextQueueBatch: 354", "nextQueueBatch: 355"],
  ["nextQueueScenes: [1436, 1437, 1438, 1439]", "nextQueueScenes: [1440, 1441, 1442, 1443]"],
  ["nextCinematicTheme: { active: \"private-jet aviation couture\", batchOrdinalWithinTheme: 2 }", "nextCinematicTheme: { active: \"civilian helicopter flight couture\", batchOrdinalWithinTheme: 1 }"],
  ["attachmentShape: \"two Senegal images plus one accepted Somalia image\"", "attachmentShape: \"two Guatemala images plus one accepted Senegal image\""],
  ["No literal Senegal flag, official seal, sacred symbol, copied ceremonial or traditional pattern, political messaging, copied military identity, or official service identity is used. Country-led scenes use large dimensional secular river currents, island-quay geometry, wetland channels, mangrove fans, shell-islet arcs and Atlantic wave bands instead.", "No literal Guatemala flag, coat of arms, official seal, sacred symbol, copied ceremonial or traditional pattern, political messaging, copied military identity, or official service identity is used. Country-led scenes use large dimensional secular volcanic ridges, jade facets, civic relief grids, colonial arch curves, lake currents and rainforest contours instead."],
  ["The scenes foreground Dakar's Atlantic coast, Saint-Louis island and river mouth, Djoudj wetlands, and the Saloum Delta.", "The scenes foreground Guatemala City's Centro Civico, Antigua Guatemala's Santa Catalina Arch, Lake Atitlan, and Tikal's Great Plaza."],
  ["batch-354-senegal-preflight.json", "batch-354-guatemala-preflight.json"],
];
for (const [from, to] of replacements) source = source.replaceAll(from, to);
source = source.replace(
  /cinematicTheme:\s*\{\s*active: "private-jet aviation couture",\s*batchOrdinalWithinTheme: 1,/,
  'cinematicTheme: {\n    active: "private-jet aviation couture",\n    batchOrdinalWithinTheme: 2,',
);
source = source.replace(
  /minimumCoverage: "[^"]+"/,
  'minimumCoverage: "Scenes 1436 and 1437 each carry hard large Guatemala motifs on three women and private-jet aviation construction language on at least two. Scenes 1438 and 1439 use four different theme-led private-jet outfits without country map prints while Guatemala landmarks remain equally foregrounded."',
);
source = source.replace(
  /rollMethod: "[^"]+"/,
  'rollMethod: "FNV-1a over the recorded batch354-guatemala keys, reduced modulo 100. Male scene selection uses the full 32-bit hash reduced modulo 4. Repeated raw emotion labels receive one stored deterministic disambiguation roll so all four visible performances remain distinct. Batch 354 also stores one hard-love roll, mascot-state roll and holder selector, and odd-prop activation, holder, and family selectors per scene."',
);
source = source.replace(
  /researchSources:\s*\[[\s\S]*?\],\s*faceAnchors:/,
  `researchSources: [
    { url: "https://whc.unesco.org/en/list/65/", usedFor: "Antigua Guatemala urban fabric, Santa Catalina Arch setting and Volcan de Agua alignment" },
    { url: "https://whc.unesco.org/en/list/64/", usedFor: "Tikal Great Plaza, limestone temple profiles and rainforest setting" },
    { url: "https://www.britannica.com/place/Lake-Atitlan", usedFor: "Lake Atitlan volcanic basin, steep rim and volcano skyline" },
    { url: "https://culturaguate.com/centro-civico-de-guatemala/", usedFor: "Guatemala City Centro Civico modernist ensemble and relief facades" },
  ],
  faceAnchors:`,
);
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, source, "utf8");
