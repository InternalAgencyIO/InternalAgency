import fs from "node:fs";
import path from "node:path";

const sourcePath = path.resolve("tmp/world-195x4/batch-352/materialize-batch-352.mjs");
const outputPath = path.resolve("tmp/world-195x4/batch-353/materialize-batch-353.mjs");
let source = fs.readFileSync(sourcePath, "utf8");

const replacements = [
  ["somaliaPalette", "senegalPalette"],
  ["somaliaProhibitions", "senegalProhibitions"],
  ["somaliaSceneSpecs", "senegalSceneSpecs"],
  ["./somalia-scene-specs.mjs", "./senegal-scene-specs.mjs"],
  ["batch-352", "batch-353"],
  ["batch352", "batch353"],
  ["const batch = 352;", "const batch = 353;"],
  ["const country = \"Somalia\";", "const country = \"Senegal\";"],
  ["const countrySlug = \"somalia\";", "const countrySlug = \"senegal\";"],
  ["const firstScene = 1428;", "const firstScene = 1432;"],
  ["#Somalia", "#Senegal"],
  ["Somalia ${heartGlyph} South Sudan", "Senegal ${heartGlyph} Somalia"],
  ["The theme and Somalia location", "The theme and Senegal location"],
  ["station-white top with restrained Somalia ocean-current and dune-contour embroidery and subtle orbital research-station seam tailoring", "ivory top with restrained Senegal river-current and mangrove-contour embroidery and subtle private-jet aviation seam tailoring"],
  ["nextQueueCountry: \"Senegal\"", "nextQueueCountry: \"Guatemala\""],
  ["nextQueueBatch: 353", "nextQueueBatch: 354"],
  ["nextQueueScenes: [1432, 1433, 1434, 1435]", "nextQueueScenes: [1436, 1437, 1438, 1439]"],
  ["nextCinematicTheme: { active: \"private-jet aviation couture\", batchOrdinalWithinTheme: 1 }", "nextCinematicTheme: { active: \"private-jet aviation couture\", batchOrdinalWithinTheme: 2 }"],
  ["attachmentShape: \"two Somalia images plus one accepted South Sudan image\"", "attachmentShape: \"two Senegal images plus one accepted Somalia image\""],
  ["No literal Somalia flag, official seal, sacred symbol, copied ceremonial or traditional pattern, political messaging, copied military identity, or official service identity is used. Country-led scenes use large dimensional secular ocean currents, lighthouse lenses, dune waves, grassland sweeps and river-estuary contours instead.", "No literal Senegal flag, official seal, sacred symbol, copied ceremonial or traditional pattern, political messaging, copied military identity, or official service identity is used. Country-led scenes use large dimensional secular river currents, island-quay geometry, wetland channels, mangrove fans, shell-islet arcs and Atlantic wave bands instead."],
  ["The scenes foreground Mogadishu's Secondo-Lido Lighthouse, the Hobyo grassland and dunes, Bushbushle National Park, and the Jubba estuary near Kismayo.", "The scenes foreground Dakar's Atlantic coast, Saint-Louis island and river mouth, Djoudj wetlands, and the Saloum Delta."],
  ["batch-353-somalia-preflight.json", "batch-353-senegal-preflight.json"],
];
for (const [from, to] of replacements) source = source.replaceAll(from, to);
source = source.replace(
  /cinematicTheme:\s*\{\s*active: "orbital research-station couture",\s*batchOrdinalWithinTheme: 2,/,
  'cinematicTheme: {\n    active: "private-jet aviation couture",\n    batchOrdinalWithinTheme: 1,',
);
source = source.replace(
  /minimumCoverage: "[^"]+"/,
  'minimumCoverage: "Scenes 1432 and 1433 each carry hard large Senegal motifs on three women and private-jet aviation construction language on at least two. Scenes 1434 and 1435 use four different theme-led private-jet outfits without country map prints while Senegal landmarks remain equally foregrounded."',
);
source = source.replace(
  /researchSources:\s*\[[\s\S]*?\],\s*faceAnchors:/,
  `researchSources: [
    { url: "https://whc.unesco.org/en/list/956/", usedFor: "Saint-Louis island, Senegal River mouth, quays and town plan" },
    { url: "https://whc.unesco.org/en/list/25/", usedFor: "Djoudj lake, streams, ponds, backwaters and sandbanks" },
    { url: "https://whc.unesco.org/en/list/1359/", usedFor: "Saloum brackish channels, mangroves, islands and Atlantic setting" },
    { url: "https://www.unesco.org/en/mab/delta-du-saloum", usedFor: "Saloum mangroves, sandy islets, lagoons and shorelines" },
  ],
  faceAnchors:`,
);
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, source, "utf8");

