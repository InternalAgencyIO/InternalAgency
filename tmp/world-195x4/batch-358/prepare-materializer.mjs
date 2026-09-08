import fs from "node:fs";
import path from "node:path";
const sourcePath=path.resolve("tmp/world-195x4/batch-357/materialize-batch-357.mjs");
const outputPath=path.resolve("tmp/world-195x4/batch-358/materialize-batch-358.mjs");
let source=fs.readFileSync(sourcePath,"utf8");
const replacements=[
 ["cambodiaPalette","zimbabwePalette"],["cambodiaProhibitions","zimbabweProhibitions"],["cambodiaSceneSpecs","zimbabweSceneSpecs"],["./cambodia-scene-specs.mjs","./zimbabwe-scene-specs.mjs"],
 ["batch-357","batch-358"],["batch357","batch358"],["const batch = 357;","const batch = 358;"],["const country = \"Cambodia\";","const country = \"Zimbabwe\";"],["const countrySlug = \"cambodia\";","const countrySlug = \"zimbabwe\";"],["const firstScene = 1448;","const firstScene = 1452;"],
 ["#Cambodia","#Zimbabwe"],["Cambodia ${heartGlyph} Netherlands","Zimbabwe ${heartGlyph} Cambodia"],["The theme and Cambodia location","The theme and Zimbabwe location"],
 ["rescue-white top with restrained Cambodia Mekong-current and sandstone-profile embroidery and subtle fictional coast-guard rescue-vessel couture seam tailoring","rescue-white top with restrained Zimbabwe Zambezi-channel and granite-contour embroidery and subtle fictional coast-guard rescue-vessel couture seam tailoring"],
 ["nextQueueCountry: \"Zimbabwe\"","nextQueueCountry: \"Guinea\""],["nextQueueBatch: 358","nextQueueBatch: 359"],["nextQueueScenes: [1452, 1453, 1454, 1455]","nextQueueScenes: [1456, 1457, 1458, 1459]"],
 ["nextCinematicTheme: { active: \"fictional coast-guard rescue-vessel couture\", batchOrdinalWithinTheme: 2 }","nextCinematicTheme: { active: \"orbital spaceship couture\", batchOrdinalWithinTheme: 1 }"],
 ["attachmentShape: \"two Cambodia images plus one accepted Netherlands image\"","attachmentShape: \"two Zimbabwe images plus one accepted Cambodia image\""],
 ["No literal Cambodia flag, coat of arms, official seal, sacred symbol, copied ceremonial or traditional pattern, political messaging, copied military identity, or official service identity is used. Country-led scenes use large dimensional secular Mekong braids, sandstone tower profiles, sugar-palm fans, lake currents, island contours and coral-water arcs instead.","No literal Zimbabwe flag, official bird emblem, coat of arms, official seal, sacred symbol, copied ceremonial or traditional pattern, political messaging, copied military identity, or official service identity is used. Country-led scenes use large dimensional secular balancing-rock contours, waterfall spray arcs, granite-wall chevrons, jacaranda forms and Zambezi channels instead."],
 ["The scenes foreground Phnom Penh's river confluence, Angkor's archaeological landscape, Tonle Sap, and Koh Rong.","The scenes foreground Harare, Victoria Falls, Great Zimbabwe, and Mana Pools."],
 ["batch-358-cambodia-preflight.json","batch-358-zimbabwe-preflight.json"]
];
for(const [from,to] of replacements) source=source.replaceAll(from,to);
source=source.replace(/cinematicTheme:\s*\{\s*active: "fictional coast-guard rescue-vessel couture",\s*batchOrdinalWithinTheme: 1,/,'cinematicTheme: {\n    active: "fictional coast-guard rescue-vessel couture",\n    batchOrdinalWithinTheme: 2,');
source=source.replace(/minimumCoverage: "[^"]+"/,'minimumCoverage: "Scenes 1452 and 1453 each carry hard large Zimbabwe motifs on three women and fictional rescue-vessel construction language on at least two. Scenes 1454 and 1455 use four different theme-led vessel outfits without country map prints while Zimbabwe landmarks remain equally foregrounded."');
source=source.replace(/rollMethod: "[^"]+"/,'rollMethod: "FNV-1a over the recorded batch358-zimbabwe keys, reduced modulo 100. Male scene selection uses the full 32-bit hash reduced modulo 4. Repeated raw emotion labels receive one stored deterministic disambiguation roll so all four visible performances remain distinct. Batch 358 also stores one hard-love roll, mascot-state roll and holder selector, and odd-prop activation, holder, and family selectors per scene."');
source=source.replace(/researchSources:\s*\[[\s\S]*?\],\s*faceAnchors:/,`researchSources: [
    { url: "https://whc.unesco.org/en/list/509/", usedFor: "Victoria Falls waterfall curtain, gorge and Zambezi setting" },
    { url: "https://whc.unesco.org/en/list/364/", usedFor: "Great Zimbabwe dry-stone walls, conical tower and hill complex" },
    { url: "https://whc.unesco.org/en/list/302/", usedFor: "Mana Pools channels, floodplain and woodland setting" },
    { url: "https://www.britannica.com/place/Harare", usedFor: "Harare skyline, Kopje and highveld setting" },
  ],
  faceAnchors:`);
fs.mkdirSync(path.dirname(outputPath),{recursive:true});
fs.writeFileSync(outputPath,source,"utf8");
