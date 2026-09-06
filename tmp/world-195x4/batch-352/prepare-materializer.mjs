import fs from "node:fs";
import path from "node:path";

const sourcePath = path.resolve("tmp/world-195x4/batch-351/materialize-batch-351.mjs");
const outputPath = path.resolve("tmp/world-195x4/batch-352/materialize-batch-352.mjs");
let source = fs.readFileSync(sourcePath, "utf8");

const replacements = [
  ["southSudanPalette", "somaliaPalette"],
  ["southSudanProhibitions", "somaliaProhibitions"],
  ["southSudanSceneSpecs", "somaliaSceneSpecs"],
  ["./south-sudan-scene-specs.mjs", "./somalia-scene-specs.mjs"],
  ["batch-351", "batch-352"],
  ["batch351", "batch352"],
  ["const batch = 351;", "const batch = 352;"],
  ["const country = \"South Sudan\";", "const country = \"Somalia\";"],
  ["const countrySlug = \"south-sudan\";", "const countrySlug = \"somalia\";"],
  ["const firstScene = 1424;", "const firstScene = 1428;"],
  ["#SouthSudan", "#Somalia"],
  ["South Sudan ${heartGlyph} Djibouti", "Somalia ${heartGlyph} South Sudan"],
  ["The theme and South Sudan location", "The theme and Somalia location"],
  ["station-white top with restrained South Sudan Nile-current and mountain-contour embroidery and subtle orbital research-station seam tailoring", "station-white top with restrained Somalia ocean-current and dune-contour embroidery and subtle orbital research-station seam tailoring"],
  ["nextQueueCountry: \"Somalia\"", "nextQueueCountry: \"Senegal\""],
  ["nextQueueBatch: 352", "nextQueueBatch: 353"],
  ["nextQueueScenes: [1428, 1429, 1430, 1431]", "nextQueueScenes: [1432, 1433, 1434, 1435]"],
  ["nextCinematicTheme: { active: \"orbital research-station couture\", batchOrdinalWithinTheme: 2 }", "nextCinematicTheme: { active: \"private-jet aviation couture\", batchOrdinalWithinTheme: 1 }"],
  ["attachmentShape: \"two South Sudan images plus one accepted Djibouti image\"", "attachmentShape: \"two Somalia images plus one accepted South Sudan image\""],
  ["No literal South Sudan flag, official seal, sacred symbol, copied ceremonial or traditional pattern, political messaging, copied military identity, or official service identity is used. Country-led scenes use large dimensional secular Nile-current bands, papyrus fans, wetland channels, savanna migration arcs and mountain contours instead.", "No literal Somalia flag, official seal, sacred symbol, copied ceremonial or traditional pattern, political messaging, copied military identity, or official service identity is used. Country-led scenes use large dimensional secular ocean currents, lighthouse lenses, dune waves, grassland sweeps and river-estuary contours instead."],
  ["The scenes foreground Juba and the White Nile, the Sudd wetlands, Boma National Park, and the Imatong Mountains.", "The scenes foreground Mogadishu's Secondo-Lido Lighthouse, the Hobyo grassland and dunes, Bushbushle National Park, and the Jubba estuary near Kismayo."],
  ["batch-352-south-sudan-preflight.json", "batch-352-somalia-preflight.json"],
];

for (const [from, to] of replacements) source = source.replaceAll(from, to);
source = source.replace(
  /cinematicTheme:\s*\{\s*active: "orbital research-station couture",\s*batchOrdinalWithinTheme: 1,/,
  'cinematicTheme: {\n    active: "orbital research-station couture",\n    batchOrdinalWithinTheme: 2,',
);
source = source.replace(
  /minimumCoverage: "[^"]+"/,
  'minimumCoverage: "Scenes 1428 and 1429 each carry hard large Somalia motifs on three women and orbital research-station construction language on at least two. Scenes 1430 and 1431 use four different theme-led orbital-station outfits without country map prints while Somalia landmarks remain equally foregrounded."',
);
source = source.replace(
  /researchSources:\s*\[[\s\S]*?\],\s*faceAnchors:/,
  `researchSources: [
    { url: "https://whc.unesco.org/en/tentativelists/6754/", usedFor: "Mogadishu Secondo-Lido Lighthouse and maritime setting" },
    { url: "https://whc.unesco.org/en/tentativelists/6753/", usedFor: "Hobyo white and orange dunes, grassland and shrubland" },
    { url: "https://whc.unesco.org/en/tentativelists/6752/", usedFor: "Bushbushle National Park coastal forest setting" },
    { url: "https://www.fao.org/4/t0361e/t0361e07.htm", usedFor: "Jubba River estuary near Kismayo" },
    { url: "https://somalia.un.org/en/19768-unep-regional-seas-reports-and-studies-no-84-coastal-and-marine-problems-somalia", usedFor: "Somalia Indian Ocean coast and coral-reef context" },
  ],
  faceAnchors:`,
);
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, source, "utf8");

