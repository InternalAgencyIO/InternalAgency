import fs from "node:fs";
import path from "node:path";
const sourcePath = path.resolve("tmp/world-195x4/batch-356/materialize-batch-356.mjs");
const outputPath = path.resolve("tmp/world-195x4/batch-357/materialize-batch-357.mjs");
let source = fs.readFileSync(sourcePath, "utf8");
const replacements = [
  ["netherlandsPalette", "cambodiaPalette"], ["netherlandsProhibitions", "cambodiaProhibitions"], ["netherlandsSceneSpecs", "cambodiaSceneSpecs"], ["./netherlands-scene-specs.mjs", "./cambodia-scene-specs.mjs"],
  ["batch-356", "batch-357"], ["batch356", "batch357"], ["const batch = 356;", "const batch = 357;"], ["const country = \"Netherlands\";", "const country = \"Cambodia\";"], ["const countrySlug = \"netherlands\";", "const countrySlug = \"cambodia\";"], ["const firstScene = 1444;", "const firstScene = 1448;"],
  ["civilian helicopter flight couture", "fictional coast-guard rescue-vessel couture"], ["#Netherlands", "#Cambodia"], ["Netherlands ${heartGlyph} Ecuador", "Cambodia ${heartGlyph} Netherlands"], ["The theme and Netherlands location", "The theme and Cambodia location"],
  ["cloud-white top with restrained Netherlands canal-arch and windmill-blade embroidery and subtle fictional coast-guard rescue-vessel couture seam tailoring", "rescue-white top with restrained Cambodia Mekong-current and sandstone-profile embroidery and subtle fictional coast-guard rescue-vessel couture seam tailoring"],
  ["nextQueueCountry: \"Cambodia\"", "nextQueueCountry: \"Zimbabwe\""], ["nextQueueBatch: 357", "nextQueueBatch: 358"], ["nextQueueScenes: [1448, 1449, 1450, 1451]", "nextQueueScenes: [1452, 1453, 1454, 1455]"],
  ["nextCinematicTheme: { active: \"fictional coast-guard rescue-vessel couture\", batchOrdinalWithinTheme: 1 }", "nextCinematicTheme: { active: \"fictional coast-guard rescue-vessel couture\", batchOrdinalWithinTheme: 2 }"],
  ["attachmentShape: \"two Netherlands images plus one accepted Ecuador image\"", "attachmentShape: \"two Cambodia images plus one accepted Netherlands image\""],
  ["No literal Netherlands flag, coat of arms, official seal, sacred symbol, copied ceremonial or traditional pattern, political messaging, copied military identity, or official service identity is used. Country-led scenes use large dimensional secular canal-house rhythms, windmill blades, tulip forms, dike contours, bridge cables and North Sea currents instead.", "No literal Cambodia flag, coat of arms, official seal, sacred symbol, copied ceremonial or traditional pattern, political messaging, copied military identity, or official service identity is used. Country-led scenes use large dimensional secular Mekong braids, sandstone tower profiles, sugar-palm fans, lake currents, island contours and coral-water arcs instead."],
  ["The scenes foreground Amsterdam's canal belt, Kinderdijk, Rotterdam's Erasmus Bridge, and the Texel Wadden coast.", "The scenes foreground Phnom Penh's river confluence, Angkor's archaeological landscape, Tonle Sap, and Koh Rong."],
  ["batch-357-netherlands-preflight.json", "batch-357-cambodia-preflight.json"],
];
for (const [from, to] of replacements) source = source.replaceAll(from, to);
source = source.replace(/cinematicTheme:\s*\{\s*active: "fictional coast-guard rescue-vessel couture",\s*batchOrdinalWithinTheme: 2,/, 'cinematicTheme: {\n    active: "fictional coast-guard rescue-vessel couture",\n    batchOrdinalWithinTheme: 1,');
source = source.replace(/minimumCoverage: "[^"]+"/, 'minimumCoverage: "Scenes 1448 and 1449 each carry hard large Cambodia motifs on three women and fictional rescue-vessel construction language on at least two. Scenes 1450 and 1451 use four different theme-led vessel outfits without country map prints while Cambodia landmarks remain equally foregrounded."');
source = source.replace(/rollMethod: "[^"]+"/, 'rollMethod: "FNV-1a over the recorded batch357-cambodia keys, reduced modulo 100. Male scene selection uses the full 32-bit hash reduced modulo 4. Repeated raw emotion labels receive one stored deterministic disambiguation roll so all four visible performances remain distinct. Batch 357 also stores one hard-love roll, mascot-state roll and holder selector, and odd-prop activation, holder, and family selectors per scene."');
source = source.replace(/researchSources:\s*\[[\s\S]*?\],\s*faceAnchors:/, `researchSources: [
    { url: "https://whc.unesco.org/en/list/668/", usedFor: "Angkor archaeological landscape, tower silhouettes and causeways" },
    { url: "https://www.mrcmekong.org/", usedFor: "Mekong and Tonle Sap river systems" },
    { url: "https://www.unesco.org/en/mab/tonle-sap", usedFor: "Tonle Sap lake, flooded forest and settlement setting" },
    { url: "https://tourismcambodia.org/", usedFor: "Phnom Penh riverfront and Koh Rong coastal setting" },
  ],
  faceAnchors:`);
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, source, "utf8");
