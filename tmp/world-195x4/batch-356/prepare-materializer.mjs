import fs from "node:fs";
import path from "node:path";

const sourcePath = path.resolve("tmp/world-195x4/batch-355/materialize-batch-355.mjs");
const outputPath = path.resolve("tmp/world-195x4/batch-356/materialize-batch-356.mjs");
let source = fs.readFileSync(sourcePath, "utf8");
const replacements = [
  ["ecuadorPalette", "netherlandsPalette"], ["ecuadorProhibitions", "netherlandsProhibitions"], ["ecuadorSceneSpecs", "netherlandsSceneSpecs"], ["./ecuador-scene-specs.mjs", "./netherlands-scene-specs.mjs"],
  ["batch-355", "batch-356"], ["batch355", "batch356"], ["const batch = 355;", "const batch = 356;"], ["const country = \"Ecuador\";", "const country = \"Netherlands\";"], ["const countrySlug = \"ecuador\";", "const countrySlug = \"netherlands\";"], ["const firstScene = 1440;", "const firstScene = 1444;"],
  ["#Ecuador", "#Netherlands"], ["Ecuador ${heartGlyph} Guatemala", "Netherlands ${heartGlyph} Ecuador"], ["The theme and Ecuador location", "The theme and Netherlands location"],
  ["cloud-white top with restrained Ecuador Andean-ridge and volcanic-cone embroidery and subtle civilian helicopter flight couture seam tailoring", "cloud-white top with restrained Netherlands canal-arch and windmill-blade embroidery and subtle civilian helicopter flight couture seam tailoring"],
  ["nextQueueCountry: \"Netherlands\"", "nextQueueCountry: \"Cambodia\""], ["nextQueueBatch: 356", "nextQueueBatch: 357"], ["nextQueueScenes: [1444, 1445, 1446, 1447]", "nextQueueScenes: [1448, 1449, 1450, 1451]"],
  ["nextCinematicTheme: { active: \"civilian helicopter flight couture\", batchOrdinalWithinTheme: 2 }", "nextCinematicTheme: { active: \"fictional coast-guard rescue-vessel couture\", batchOrdinalWithinTheme: 1 }"],
  ["attachmentShape: \"two Ecuador images plus one accepted Guatemala image\"", "attachmentShape: \"two Netherlands images plus one accepted Ecuador image\""],
  ["No literal Ecuador flag, coat of arms, official seal, sacred symbol, copied ceremonial or traditional pattern, political messaging, copied military identity, or official service identity is used. Country-led scenes use large dimensional secular Andean ridges, volcanic cones, equatorial arcs, river braids, orchid forms and Pacific-current spirals instead.", "No literal Netherlands flag, coat of arms, official seal, sacred symbol, copied ceremonial or traditional pattern, political messaging, copied military identity, or official service identity is used. Country-led scenes use large dimensional secular canal-house rhythms, windmill blades, tulip forms, dike contours, bridge cables and North Sea currents instead."],
  ["The scenes foreground Quito's historic center, Cotopaxi, Cuenca's Tomebamba riverfront, and Bartolome Island in the Galapagos.", "The scenes foreground Amsterdam's canal belt, Kinderdijk, Rotterdam's Erasmus Bridge, and the Texel Wadden coast."],
  ["batch-356-ecuador-preflight.json", "batch-356-netherlands-preflight.json"],
];
for (const [from, to] of replacements) source = source.replaceAll(from, to);
source = source.replace(/cinematicTheme:\s*\{\s*active: "civilian helicopter flight couture",\s*batchOrdinalWithinTheme: 1,/, 'cinematicTheme: {\n    active: "civilian helicopter flight couture",\n    batchOrdinalWithinTheme: 2,');
source = source.replace(/minimumCoverage: "[^"]+"/, 'minimumCoverage: "Scenes 1444 and 1445 each carry hard large Netherlands motifs on three women and civilian-helicopter construction language on at least two. Scenes 1446 and 1447 use four different theme-led helicopter outfits without country map prints while Netherlands landmarks remain equally foregrounded."');
source = source.replace(/rollMethod: "[^"]+"/, 'rollMethod: "FNV-1a over the recorded batch356-netherlands keys, reduced modulo 100. Male scene selection uses the full 32-bit hash reduced modulo 4. Repeated raw emotion labels receive one stored deterministic disambiguation roll so all four visible performances remain distinct. Batch 356 also stores one hard-love roll, mascot-state roll and holder selector, and odd-prop activation, holder, and family selectors per scene."');
source = source.replace(/researchSources:\s*\[[\s\S]*?\],\s*faceAnchors:/, `researchSources: [
    { url: "https://whc.unesco.org/en/list/1349/", usedFor: "Amsterdam canal belt, waterways and gabled urban fabric" },
    { url: "https://whc.unesco.org/en/list/818/", usedFor: "Kinderdijk windmills, waterways and polder engineering" },
    { url: "https://www.rotterdam.nl/erasmusbrug", usedFor: "Erasmus Bridge cable fan and Nieuwe Maas waterfront" },
    { url: "https://whc.unesco.org/en/list/1314/", usedFor: "Wadden Sea tidal flats, channels, dunes and coastal setting" },
  ],
  faceAnchors:`);
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, source, "utf8");
