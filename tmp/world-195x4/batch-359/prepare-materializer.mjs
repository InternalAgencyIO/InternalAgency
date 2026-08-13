import fs from "node:fs";
import path from "node:path";
const sourcePath=path.resolve("tmp/world-195x4/batch-358/materialize-batch-358.mjs");
const outputPath=path.resolve("tmp/world-195x4/batch-359/materialize-batch-359.mjs");
let source=fs.readFileSync(sourcePath,"utf8");
const replacements=[
 ["zimbabwePalette","guineaPalette"],["zimbabweProhibitions","guineaProhibitions"],["zimbabweSceneSpecs","guineaSceneSpecs"],["./zimbabwe-scene-specs.mjs","./guinea-scene-specs.mjs"],
 ["batch-358","batch-359"],["batch358","batch359"],["const batch = 358;","const batch = 359;"],["const country = \"Zimbabwe\";","const country = \"Guinea\";"],["const countrySlug = \"zimbabwe\";","const countrySlug = \"guinea\";"],["const firstScene = 1452;","const firstScene = 1456;"],
 ["fictional coast-guard rescue-vessel couture","orbital spaceship couture"],["#Zimbabwe","#Guinea"],["Zimbabwe ${heartGlyph} Cambodia","Guinea ${heartGlyph} Zimbabwe"],["The theme and Zimbabwe location","The theme and Guinea location"],
 ["rescue-white top with restrained Zimbabwe Zambezi-channel and granite-contour embroidery and subtle orbital spaceship couture seam tailoring","orbital-white top with restrained Guinea Atlantic-current and highland-ridge embroidery and subtle orbital spaceship couture seam tailoring"],
 ["nextQueueCountry: \"Guinea\"","nextQueueCountry: \"Benin\""],["nextQueueBatch: 359","nextQueueBatch: 360"],["nextQueueScenes: [1456, 1457, 1458, 1459]","nextQueueScenes: [1460, 1461, 1462, 1463]"],
 ["nextCinematicTheme: { active: \"orbital spaceship couture\", batchOrdinalWithinTheme: 1 }","nextCinematicTheme: { active: \"orbital spaceship couture\", batchOrdinalWithinTheme: 2 }"],
 ["attachmentShape: \"two Zimbabwe images plus one accepted Cambodia image\"","attachmentShape: \"two Guinea images plus one accepted Zimbabwe image\""],
 ["No literal Zimbabwe flag, official bird emblem, coat of arms, official seal, sacred symbol, copied ceremonial or traditional pattern, political messaging, copied military identity, or official service identity is used. Country-led scenes use large dimensional secular balancing-rock contours, waterfall spray arcs, granite-wall chevrons, jacaranda forms and Zambezi channels instead.","No literal Guinea flag, coat of arms, official seal, sacred symbol, copied ceremonial or traditional pattern, political messaging, copied military identity, or official service identity is used. Country-led scenes use large dimensional secular Atlantic currents, island contours, Fouta Djallon escarpments, waterfall ribbons, Nimba ridges and bauxite facets instead."],
 ["The scenes foreground Harare, Victoria Falls, Great Zimbabwe, and Mana Pools.","The scenes foreground Conakry and the Loos Islands, Fouta Djallon, Mount Nimba, and the Niger headwaters."],
 ["batch-359-zimbabwe-preflight.json","batch-359-guinea-preflight.json"]
];
for(const [from,to] of replacements) source=source.replaceAll(from,to);
source=source.replace(/cinematicTheme:\s*\{\s*active: "orbital spaceship couture",\s*batchOrdinalWithinTheme: 2,/,'cinematicTheme: {\n    active: "orbital spaceship couture",\n    batchOrdinalWithinTheme: 1,');
source=source.replace(/minimumCoverage: "[^"]+"/,'minimumCoverage: "Scenes 1456 and 1457 each carry hard large Guinea motifs on three women and orbital-spaceship construction language on at least two. Scenes 1458 and 1459 use four different theme-led spaceship outfits without country map prints while Guinea landmarks remain equally foregrounded."');
source=source.replace(/rollMethod: "[^"]+"/,'rollMethod: "FNV-1a over the recorded batch359-guinea keys, reduced modulo 100. Male scene selection uses the full 32-bit hash reduced modulo 4. Repeated raw emotion labels receive one stored deterministic disambiguation roll so all four visible performances remain distinct. Batch 359 also stores one hard-love roll, mascot-state roll and holder selector, and odd-prop activation, holder, and family selectors per scene."');
source=source.replace(/researchSources:\s*\[[\s\S]*?\],\s*faceAnchors:/,`researchSources: [
    { url: "https://whc.unesco.org/en/list/155/", usedFor: "Mount Nimba ridge, forest and grassland setting" },
    { url: "https://www.britannica.com/place/Fouta-Djallon", usedFor: "Fouta Djallon plateaus, escarpments and waterfalls" },
    { url: "https://www.britannica.com/place/Conakry", usedFor: "Conakry peninsula and Atlantic coastal setting" },
    { url: "https://www.britannica.com/place/Niger-River", usedFor: "Niger headwaters and Upper Guinea river landscape" },
  ],
  faceAnchors:`);
fs.mkdirSync(path.dirname(outputPath),{recursive:true}); fs.writeFileSync(outputPath,source,"utf8");
