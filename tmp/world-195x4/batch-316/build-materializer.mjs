import fs from "node:fs";

const sourcePath = "tmp/world-195x4/batch-315/materialize-batch-315.mjs";
const targetPath = "tmp/world-195x4/batch-316/materialize-batch-316.mjs";
let source = fs.readFileSync(sourcePath, "utf8");

function replaceRequired(search, replacement) {
  if (!source.includes(search)) throw new Error(`Missing replacement target: ${search.slice(0, 120)}`);
  source = source.replace(search, replacement);
}

function replaceRange(start, end, replacement) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  if (startIndex < 0 || endIndex < 0) throw new Error(`Missing range: ${start} ... ${end}`);
  source = source.slice(0, startIndex) + replacement + source.slice(endIndex + end.length);
}

const commonProhibitions = "Use secular Bhutan landscape, wildlife, food, farming, weaving, conservation, sport, and civic-infrastructure references only. No literal flag, thunder dragon, coat of arms, official seal, sacred symbol, religious building, prayer flag, copied ceremonial dress, copied uniform, badge, readable text, brand, alcohol, or political insignia.";
const palette = "Himalayan-sky blue, alpine green, chili red, rice ivory, charcoal black, rhododendron pink, crane white, river turquoise, cloud silver, and saffron gold";

const sceneSpecs = [
  {
    scene: 1284,
    theme: "adult nightlife dance-performance couture",
    landmark: "a broad dry covered civic arcade overlooking complete Thimphu Clock Tower Square and the secular Changlimithang Stadium during a rolling thunderstorm, with the clock tower, paved plaza, stadium grandstand, contemporary valley roofs, forested Himalayan slopes, and one clearly empty route marker; rain and lightning remain beyond the roof",
    motifs: [
      "large complete Clock-Tower-Square, stadium-grandstand, mountain-valley, archery-target, market-apple, red-chili, handloom, and blue-poppy compositions across all four outfits",
      "at least two separate outfits each carry one complete full-width secular Bhutan civic-and-valley composition rather than tiny trim",
    ],
    culture: "Use Thimphu's civic square, stadium, forested valley, public archery, farm produce, handloom craft, and blue poppies respectfully. Adult nightlife dance-performance couture is only fully clothed public after-show fashion with no dance act, nightclub, alcohol, pole, stripping, or sexual performance. " + commonProhibitions,
    expected: {
      weather: "rolling thunderstorm", paws: false, pole: false, rainbowOnly: false,
      rainbowHosiery: false, wearer: "AI ECE", palette: "country-palette rainbow-like gradient",
      cuts: {
        Radiance: [true, false, false], Ellie: [false, false, false],
        Alia: [true, false, false], "AI ECE": [true, true, false],
      },
    },
    emotionNuance: {
      Radiance: "crying with two visible tears while offering Alia a brief reassuring cheek greeting",
      Ellie: "betrayal shock shown by widened eyes and a still, wounded expression toward ECE",
      Alia: "startled surprise shown by lifted brows while every touch stays gentle",
      "AI ECE": "defiance shown by a level strategist gaze and lifted chin",
    },
    romance: "Translate Radiance's quick cheek greeting to Alia, Ellie's shoulder-close support, ECE's fingertip link to Radiance, Alia's face-to-face closeness with ECE, and Ellie's theatrical jealous look into a wide shallow crescent. ECE and Radiance link one hand pair. Radiance touches Alia's cheek. Alia answers at Radiance's waist and touches ECE's shoulder. Ellie touches Radiance's shoulder and Alia's forearm while looking directly at ECE. All five contacts are visible, public, gentle, and consensual.",
    composition: "Place ECE far left, Radiance left-center, Alia right-center, and Ellie far right in separated depth lanes. Keep bright plaza, stadium, or storm-sky gaps behind every arm. Keep all four faces fully visible and every person upright on the dry arcade floor.",
    outfits: {
      Radiance: "a chili-red cap-sleeve cropped public after-show jacket exposing a narrow ordinary waist panel, with a separate rice-ivory above-knee skirt carrying a large complete Thimphu Clock Tower Square and mountain-valley composition, high closed back, and cloud-silver pumps",
      Ellie: "an alpine-green high-neck short-sleeve public after-show above-knee sheath with covered waist and high closed back, carrying a large complete Changlimithang stadium, public archery-target, and valley-roof composition, with rhododendron-pink slingback heels",
      Alia: "a Himalayan-sky-blue one-shoulder cropped public after-show bodice exposing a narrow ordinary waist panel, with a separate charcoal-black above-knee tailored skort carrying a large complete market-apple, red-chili, and handloom composition, high closed back, and saffron-gold platform heels",
      "AI ECE": "a fully strapless river-turquoise cropped public after-show bodice with a high straight opaque bustline exposing a narrow ordinary waist panel, with a separate crane-white above-knee skirt carrying a large complete blue-poppy, civic-clock, and empty-route composition, high closed back, and chili-red heeled boots",
    },
    hands: [
      "ECE right open hand supports the opaque inspection paddle and inert prop from beneath; ECE left hand links visibly with Radiance's left hand",
      "Radiance left hand links visibly with ECE's left hand; Radiance right hand rests visibly at Alia's near cheek",
      "Alia left hand rests visibly at Radiance's near waist; Alia right hand rests visibly on ECE's near shoulder",
      "Ellie left hand rests visibly on Radiance's far shoulder; Ellie right hand rests visibly on Alia's near forearm",
    ],
    propHandler: "AI ECE",
    propTarget: "left across the clearly empty rain-washed plaza toward one unoccupied civic route marker",
  },
  {
    scene: 1285,
    theme: "adult nightlife dance-performance couture",
    landmark: "a broad dry covered observation deck beside the complete 160-metre Punakha pedestrian suspension bridge over the glacier-fed Po Chhu River during soft dramatic overcast, with the entire bridge span, lush secular Punakha Valley, rice fields, river terraces, distant farmhouses, and one clearly empty marked river route; no religious architecture appears",
    motifs: [
      "large complete Punakha-suspension-bridge, Po-Chhu river, rice-terrace, farmhouse, rafting-paddle, red-rice, chili, and bamboo-weave compositions across all four women's outfits and the male top",
      "at least two separate outfits each carry one complete full-width secular Bhutan bridge-and-river composition",
    ],
    culture: "Use the pedestrian bridge, Po Chhu River, green valley, rice farming, rafting, local produce, and bamboo craft respectfully. Adult nightlife dance-performance couture is only fully clothed public after-show fashion with no dance act, nightclub, alcohol, pole, stripping, or sexual performance. " + commonProhibitions,
    expected: {
      weather: "soft dramatic overcast", paws: false, pole: false, rainbowOnly: false,
      rainbowHosiery: false, wearer: "AI ECE", palette: "country-palette rainbow-like gradient",
      cuts: {
        Radiance: [false, false, false], Ellie: [false, false, false],
        Alia: [true, false, false], "AI ECE": [true, false, false],
      },
    },
    emotionNuance: {
      Radiance: "tender affection shown by a warm cheek-close smile toward ECE",
      Ellie: "playful mischief shown by a teasing smile while touching ECE's cheek",
      Alia: "aching romantic longing shown by a softened distant gaze toward Radiance",
      "AI ECE": "overwhelming relief shown by relaxed shoulders and tear-bright eyes",
      Male: "shame and social vulnerability shown by a lowered brow and guarded mouth while his head and pupils remain most strongly fixed on ECE",
    },
    romance: "Translate ECE's backward beacon step, Radiance's cheek-close follow, Ellie's protective shoulder hook, Alia's playful route block, Alia and Radiance's shoulder embrace, Radiance's blown greeting toward ECE, and Ellie's cheek touch into a wide five-adult arc. ECE touches Ellie's forearm while Ellie touches ECE's cheek and links Radiance. Radiance links Ellie and rests her free hand on Alia's shoulder. Alia answers at Radiance's waist and touches the male's forearm. The male keeps two visible contacts with Alia while turning his head and pupils past the group to ECE as his strongest eye line.",
    composition: "Place ECE far left with the inert prop isolated over empty river, Ellie left-center, Radiance center, Alia right-center, and the male far right. Keep river, bridge cables, or pale sky gaps behind all ten arms. Turn the male's face three-quarter-left toward ECE; Alia looks toward Radiance so the male-Alia gaze cannot dominate. Everyone remains upright on the dry deck.",
    outfits: {
      Radiance: "a chili-red high-neck cap-sleeve public after-show above-knee sheath with covered waist and high closed back, carrying a large complete suspension-bridge and Po-Chhu-river composition, with saffron-gold pumps",
      Ellie: "a Himalayan-sky-blue collared short-sleeve public after-show above-knee tailored romper with covered waist and high closed back, carrying a large complete rice-terrace, river-raft, and farmhouse composition, with alpine-green slingback heels",
      Alia: "a rhododendron-pink one-shoulder cropped public after-show bodice exposing a narrow ordinary waist panel, with a separate charcoal-black above-knee skirt carrying a large complete red-rice, chili, and bamboo-weave composition, high closed back, and river-turquoise platform heels",
      "AI ECE": "a crane-white sleeveless cropped public after-show jacket exposing a narrow ordinary waist panel, with a separate alpine-green above-knee skort carrying a large complete bridge-cable, river-terrace, and empty-route composition, high closed back, and chili-red heeled boots",
      Male: "the established adult male face from Scene 1136 with closely trimmed beard and athletic muscular build, wearing an opaque fitted rice-ivory short-sleeve top carrying a restrained complete Punakha bridge-and-river contour, fitted black jeans, and practical black boots",
    },
    hands: [
      "ECE right open hand supports the opaque inspection paddle and inert prop from beneath; ECE left hand rests visibly on Ellie's near forearm",
      "Ellie left hand rests visibly at ECE's near cheek; Ellie right hand links visibly with Radiance's left hand",
      "Radiance left hand links visibly with Ellie's right hand; Radiance right hand rests visibly on Alia's near shoulder",
      "Alia left hand rests visibly at Radiance's near waist; Alia right hand rests visibly on the male's near forearm",
      "the male left hand rests visibly on Alia's far shoulder; the male right hand rests visibly on Alia's near forearm",
    ],
    propHandler: "AI ECE",
    propTarget: "left across clearly empty Po Chhu water toward one unoccupied river-route marker",
  },
  {
    scene: 1286,
    theme: "Paris runway model couture",
    landmark: "a broad dry covered conservation runway overlooking the complete Phobjikha Valley beneath stacked lenticular clouds, with the wide glacial wetland, dwarf bamboo, potato fields, distant secular farmhouses, a winding nature trail, several faraway black-necked cranes, and one clearly empty marked route; no monastery or religious architecture appears",
    motifs: [
      "large complete Phobjikha-wetland, black-necked-crane, dwarf-bamboo, potato-field, rhododendron, farmhouse, nature-trail, and conservation-monitoring compositions across all four outfits",
      "at least two separate outfits each carry one complete full-width secular Bhutan crane-and-valley composition",
    ],
    culture: "Use Phobjikha's glacial valley, threatened black-necked cranes, wetland, dwarf bamboo, potato farms, rhododendrons, village life, and conservation monitoring respectfully. Paris runway model couture is original fictional fashion with no copied designer, logo, uniform, unsafe runway, or sexualized presentation. " + commonProhibitions,
    expected: {
      weather: "stacked lenticular clouds", paws: true, pole: false, rainbowOnly: false,
      rainbowHosiery: true, wearer: "AI ECE", palette: "original independent rainbow gradient",
      cuts: {
        Radiance: [false, true, false], Ellie: [true, false, false],
        Alia: [false, true, false], "AI ECE": [true, false, true],
      },
    },
    emotionNuance: {
      Radiance: "romantic joy shown by a luminous smile focused on ECE",
      Ellie: "startled surprise shown by lifted brows during ECE's cheek-close greeting",
      Alia: "extreme happiness and radiant laughing delight shown by open laughter while assisting the group",
      "AI ECE": "possessive tension shown by a protective linked grip and intense affectionate gaze toward Radiance",
    },
    romance: "Translate ECE's rise from the route beacon, Radiance's two-person support, Ellie's close support behind Radiance, Alia's reach toward ECE, ECE sitting close against Radiance, ECE's cheek greeting toward Ellie, and Alia's hands-over-the-link beat into a stable rising tableau. Radiance and ECE form the unmistakable affectionate center through a linked hand pair and Radiance's steadying back touch. Ellie touches Radiance's shoulder and ECE's cheek. Alia reaches ECE's forearm while keeping the inert prop isolated on her other hand's paddle. All contacts remain public, gentle, and visible.",
    composition: "Place Radiance left-center and ECE right-center as the clear central pair, Ellie far left, and Alia far right with the prop over an empty route lane. ECE rises from one low supported step with both feet visible and stable; the other three remain upright. Show ECE three-quarter-back with hair moved forward so her complete open back, complete face, and original rainbow-gradient opaque knee socks remain visible. Keep valley or cloud gaps behind all eight arms.",
    outfits: {
      Radiance: "a fully strapless crane-white Paris-runway above-knee dress with a high straight opaque bustline, covered waist, and high closed back, carrying a large complete Phobjikha wetland and black-necked-crane composition, with rhododendron-pink pumps",
      Ellie: "an alpine-green cap-sleeve cropped Paris-runway jacket exposing a narrow ordinary waist panel, with a separate Himalayan-sky-blue above-knee skirt carrying a large complete dwarf-bamboo, potato-field, and farmhouse composition, high closed back, and saffron-gold slingback heels",
      Alia: "a fully strapless chili-red Paris-runway above-knee tailored dress with a high straight opaque bustline, covered waist, and high closed back, carrying a large complete rhododendron, nature-trail, and conservation-monitoring composition, with charcoal-black platform heels",
      "AI ECE": "a river-turquoise sleeveless cropped Paris-runway bodice exposing a narrow ordinary waist panel, with secure opaque sides and a completely open back from shoulder blades to the separate waistline, a separate crane-white above-knee skort carrying a large complete lenticular-cloud, crane-flight, and empty-route composition, original independent opaque rainbow-gradient knee socks flowing through magenta, cyan, lime, violet, and tangerine bands, and cloud-silver heeled boots",
    },
    hands: [
      "Alia right open hand supports the opaque inspection paddle and inert prop from beneath; Alia left hand rests visibly on ECE's near forearm",
      "ECE right hand links visibly with Radiance's left hand; ECE left hand rests visibly at Ellie's near cheek",
      "Radiance left hand links visibly with ECE's right hand; Radiance right hand rests visibly on ECE's upper back",
      "Ellie left hand rests visibly on Radiance's far shoulder; Ellie right hand rests visibly on ECE's far shoulder",
    ],
    propHandler: "Alia",
    propTarget: "right across a clearly empty Phobjikha monitoring lane toward one unoccupied route marker",
    paws: "One tiny collarless golden kitten, PAWS, perches securely on Ellie's far cap-sleeve shoulder with all four paws on opaque fabric and bats a loose cloud-silver route ribbon fixed to Ellie's sleeve. No adult hand is reassigned. PAWS stays far from the prop, cranes, wetland, and platform edge.",
  },
  {
    scene: 1287,
    theme: "Paris runway model couture",
    landmark: "a broad dry covered river observatory in Royal Manas National Park during a powerful windstorm with controlled fabric motion, with the complete broadleaf forest, clearly empty Manas River channel, layered foothills, a distant golden langur canopy crossing, faraway elephant silhouettes, golden-mahseer water, and one clearly empty marked conservation route; wildlife remains distant and undisturbed",
    motifs: [
      "large complete Royal-Manas forest, golden-langur, golden-mahseer, elephant, hornbill, river-stone, biological-corridor, and conservation-route compositions across all four outfits",
      "at least two separate outfits each carry one complete full-width secular Bhutan forest-and-river composition",
    ],
    culture: "Use Royal Manas broadleaf forest, golden langurs, golden mahseer, elephants, hornbills, river habitat, biological corridors, and conservation work respectfully. Paris runway model couture is original fictional fashion with no copied designer, logo, uniform, unsafe runway, or sexualized presentation. " + commonProhibitions,
    expected: {
      weather: "powerful windstorm with controlled fabric motion", paws: true, pole: false, rainbowOnly: false,
      rainbowHosiery: false, wearer: "Radiance", palette: "country-palette rainbow-like gradient",
      cuts: {
        Radiance: [false, false, false], Ellie: [false, false, false],
        Alia: [false, true, false], "AI ECE": [true, false, false],
      },
    },
    emotionNuance: {
      Radiance: "tender affection shown by a reassuring side-hug smile toward Ellie",
      Ellie: "contained resentment shown by a tight controlled gaze directly at ECE",
      Alia: "aching romantic longing shown by a softened cheek-close look toward Radiance",
      "AI ECE": "full sobbing with a tear-streaked face and visibly shaking shoulders while keeping the safe route task controlled",
    },
    romance: "Translate Ellie's rise into Radiance's side hug, ECE's link to Ellie's other hand, Alia's wounded rival glance, ECE's protective closeness behind Alia, Alia's cheek greeting toward Radiance, Ellie's hand link with Radiance, and Ellie's direct stare at ECE into a wind-braced open chain. ECE links Ellie. Ellie links Radiance. Radiance touches Alia's cheek. Alia rests one hand on Radiance and one on ECE. At least five public, gentle, consensual contacts remain visible while ECE's prop stays isolated.",
    composition: "Place ECE far left, Ellie left-center, Radiance right-center, and Alia far right in separated lanes. Keep river, pale sky, or forest gaps behind all eight arms. Wind moves only short secured hems and hair ends; all faces, hands, legs, heels, and stable footing stay unobstructed. PAWS perches on Radiance's far shoulder away from the prop and river edge.",
    outfits: {
      Radiance: "a crane-white short-sleeve Paris-runway above-knee sheath with covered waist and high closed back, carrying a large complete Royal-Manas forest and golden-langur composition, with chili-red pumps",
      Ellie: "a Himalayan-sky-blue high-neck sleeveless Paris-runway above-knee tailored romper with covered waist and high closed back, carrying a large complete golden-mahseer, river-stone, and hornbill composition, with alpine-green slingback heels",
      Alia: "a fully strapless saffron-gold Paris-runway above-knee dress with a high straight opaque bustline, covered waist, and high closed back, carrying a large complete elephant, broadleaf-canopy, and biological-corridor composition, with charcoal-black platform heels",
      "AI ECE": "a rhododendron-pink cap-sleeve cropped Paris-runway jacket exposing a narrow ordinary waist panel, with a separate river-turquoise above-knee skort carrying a large complete conservation-route, forest-foothill, and empty-river composition, high closed back, and cloud-silver heeled boots",
    },
    hands: [
      "ECE right open hand supports the opaque inspection paddle and inert prop from beneath; ECE left hand links visibly with Ellie's left hand",
      "Ellie left hand links visibly with ECE's left hand; Ellie right hand links visibly with Radiance's left hand",
      "Radiance left hand links visibly with Ellie's right hand; Radiance right hand rests visibly at Alia's near cheek",
      "Alia left hand rests visibly on Radiance's near shoulder; Alia right hand rests visibly on ECE's near shoulder",
    ],
    propHandler: "AI ECE",
    propTarget: "left across clearly empty Manas River water toward one unoccupied conservation-route marker",
    paws: "One tiny collarless golden kitten, PAWS, perches securely on Radiance's far short-sleeve shoulder with all four paws on opaque fabric and catches a loose alpine-green route ribbon fixed to Radiance's sleeve. No adult hand is reassigned. PAWS stays far from the prop, wildlife, wind edge, and river.",
  },
];

replaceRequired("const batch = 315;", "const batch = 316;");
replaceRequired('const country = "Solomon Islands";', 'const country = "Bhutan";');
replaceRequired('const countrySlug = "solomon-islands";', 'const countrySlug = "bhutan";');
replaceRequired("const firstScene = 1280;", "const firstScene = 1284;");
replaceRequired('const root = path.resolve("tmp/world-195x4/batch-315");', 'const root = path.resolve("tmp/world-195x4/batch-316");');
replaceRange(
  "const commonProhibitions =",
  "const sceneSpecs = [",
  `const commonProhibitions = ${JSON.stringify(commonProhibitions)};\nconst palette = ${JSON.stringify(palette)};\n\nconst sceneSpecs = [`,
);
replaceRange(
  "const sceneSpecs = [",
  "];\n\nconst maleKey",
  `const sceneSpecs = ${JSON.stringify(sceneSpecs, null, 2)};\n\nconst maleKey`,
);
replaceRequired("if (maleScene !== 1282)", "if (maleScene !== 1285)");
source = source.replaceAll("Solomon Islands", "Bhutan");
source = source.replaceAll("batch315-solomon-islands", "batch316-bhutan");
replaceRange(
  "  rollMethod:",
  "  faceAnchors:",
  `  rollMethod: "FNV-1a over the recorded batch316-bhutan keys, reduced modulo 100. Male scene selection uses the full 32-bit hash reduced modulo 4.",\n  rollThresholds: {\n    visibleMidriff: "0-49", straplessDress: "0-34", fullyOpenBack: "0-29", paws: "0-24",\n    poleDanceTheme: "0-5", rainbowOnly: "0-3", rainbowHosiery: "0-24",\n    rainbowHosieryWearer: "0-49 Radiance; 50-99 AI ECE",\n    rainbowHosieryPaletteMode: "0-49 country-palette rainbow-like gradient; 50-99 original independent rainbow gradient",\n  },\n  themePair: ["adult nightlife dance-performance couture", "Paris runway model couture"],\n  nextThemePair: ["Paris runway model couture", "cleaner and service couture"],\n  nextQueueCountry: "Luxembourg", nextQueueBatch: 317, nextQueueScenes: [1288, 1289, 1290, 1291],\n  researchSources: [\n    { url: "https://services.bhutan.travel/search/hotel/thimphu-towers", usedFor: "Thimphu Clock Tower Square and Changlimithang Stadium civic setting" },\n    { url: "https://bhutan.travel/journal/editorial/bhutan-is-family-friendly", usedFor: "Punakha pedestrian suspension bridge, Po Chhu River, valley views, farming, crafts, and mountain trails" },\n    { url: "https://bhutan.travel/experiences-landing-pages-2/experiences-wildlife-and-nature", usedFor: "Phobjikha black-necked cranes, protected forests, Royal Manas National Park, and Bhutan wildlife" },\n    { url: "https://bhutan.travel/experiences-eco-tourism", usedFor: "Ecotourism, black-necked cranes, golden langurs, golden mahseer, protected areas, and biological corridors" },\n  ],\n  faceAnchors:`,
);
replaceRange(
  "  countryMotifPolicy:",
  "  rollAudit:",
  `  countryMotifPolicy: {\n    flagMotifDecision: "No literal Bhutan flag, thunder dragon, coat of arms, or official emblem is copied onto clothing. Large researched secular civic-square, bridge, river, valley, wetland, wildlife, farming, weaving, sport, and conservation fields replace them.",\n    palette,\n    minimumCoverage: "Every scene places multiple large complete secular Bhutan motifs across at least two outfits as full bodice, skirt, hip, or panel fields rather than tiny trim.",\n    cultureScene: "The four scenes foreground Thimphu civic life, the Punakha suspension bridge and Po Chhu, Phobjikha crane conservation, and Royal Manas biodiversity.",\n    prohibitions: "No literal flag, thunder dragon, coat of arms, official seal, sacred symbol, religious architecture, prayer flag, copied ceremonial dress, copied performance or runway uniform, badge, weapon threat, sexualized performance, alcohol, or branded product.",\n  },\n  xPublishingRolls,\n  xPublishingPlan: {\n    minimumCurrentCountryAcceptedAssets: 2,\n    attachmentShape: "two Bhutan images plus one accepted Luxembourg image when available",\n    captionIfEligible: "Bhutan red heart Luxembourg #Bhutan #WorldXXXSeries",\n    internalAgencyHashtagActive: false,\n    worldXXXSeriesHashtagActive: true,\n  },\n  anatomyGate: {\n    fourPersonScenes: "Scenes 1284, 1286, and 1287 require exactly eight arms and eight hands, two per woman, with every limb continuously traceable to one owner.",\n    fivePersonScene: "Scene 1285 requires exactly ten arms and ten hands, two per adult, with the male added without replacing any woman.",\n    rejectionRule: "Reject every extra, missing, duplicated, floating, fused, borrowed, emerging, ownerless, cropped, hidden-owner, or ambiguous limb, hand, or finger cluster.",\n  },\n  rollAudit:`,
);
replaceRequired(
  'fs.writeFileSync(path.join(root, "batch-315-solomon-islands-preflight.json")',
  'fs.writeFileSync(path.join(root, "batch-316-bhutan-preflight.json")',
);
replaceRequired(
  'preflight: path.join(root, "batch-315-solomon-islands-preflight.json")',
  'preflight: path.join(root, "batch-316-bhutan-preflight.json")',
);

fs.mkdirSync("tmp/world-195x4/batch-316", { recursive: true });
fs.writeFileSync(targetPath, source, "utf8");
console.log(JSON.stringify({ sourcePath, targetPath, bytes: Buffer.byteLength(source) }, null, 2));
