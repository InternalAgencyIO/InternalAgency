import fs from "node:fs";

const sourcePath = "tmp/world-195x4/batch-316/materialize-batch-316.mjs";
const targetPath = "tmp/world-195x4/batch-317/materialize-batch-317.mjs";
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

const commonProhibitions = "Use secular Luxembourg architecture, valleys, industry, waterfalls, lakes, forests, vineyards, mobility, and civic infrastructure only. No literal flag, coat of arms, red lion, crown, official seal, sacred symbol, religious building, copied ceremonial dress, copied uniform, badge, readable text, brand, alcohol, or political insignia.";
const palette = "Grand-Duchy red, ice blue, steel silver, slate charcoal, vineyard green, Moselle teal, sandstone gold, forest emerald, lake cobalt, and clean white";

const sceneSpecs = [
  {
    scene: 1288,
    theme: "Paris runway model couture",
    landmark: "a broad dry public overlook beneath the complete double stone arch of Adolphe Bridge above the Petrousse Valley during a powerful windstorm with controlled fabric motion, with the full bridge span, suspended pedestrian deck, green cliffs, winding stream, modern tram, valley paths, and one clearly empty marked route; no religious or political building appears",
    motifs: [
      "large complete Adolphe-Bridge double-arch, suspended walkway, Petrousse cliff, tram-line, valley-stream, bicycle-path, rose-garden, and city-topography compositions across all four outfits",
      "at least two separate outfits each carry one complete full-width secular Luxembourg bridge-and-valley composition rather than tiny trim",
    ],
    culture: "Use Luxembourg City's Adolphe Bridge, Petrousse Valley, public tram, pedestrian deck, cycling path, cliffs, stream, and urban greenery respectfully. Paris runway model couture is original fictional fashion with no copied designer, logo, uniform, unsafe runway, or sexualized presentation. " + commonProhibitions,
    expected: {
      weather: "powerful windstorm with controlled fabric motion", paws: false, pole: false, rainbowOnly: false,
      rainbowHosiery: false, wearer: "Radiance", palette: "country-palette rainbow-like gradient",
      cuts: {
        Radiance: [false, false, false], Ellie: [false, true, false],
        Alia: [false, true, true], "AI ECE": [false, true, false],
      },
    },
    emotionNuance: {
      Radiance: "visible jealousy shown by a controlled sideways glance toward ECE while keeping a steady public smile",
      Ellie: "aching romantic longing shown by a softened gaze toward Alia and a small hopeful breath",
      Alia: "tender affection shown by a warm reassuring smile toward Radiance",
      "AI ECE": "magnetic confidence shown by a composed route-leader gaze and lifted chin",
    },
    romance: "Translate Ellie's rise into Radiance's waiting side hug, ECE's retained hand link, Alia's wounded-rival beat, Radiance cradling Alia's face, Alia's waist hug, Ellie's opposite-cheek greeting, and ECE's close watch into a wide shallow crescent. ECE and Radiance link one hand pair. Radiance rests her free hand at Alia's cheek. Alia answers at Radiance's waist and links Ellie. Ellie links Alia and rests her free hand on Alia's shoulder while looking tenderly toward her. All five contacts are visible, public, gentle, and consensual.",
    composition: "Place ECE far left, Radiance left-center, Alia right-center, and Ellie far right in separated depth lanes. Keep pale sky, bridge arch, or green valley gaps behind every arm. Wind moves only secured short hems and hair ends; all faces, hands, legs, heels, and stable footing remain unobstructed.",
    outfits: {
      Radiance: "a Grand-Duchy-red high-neck cap-sleeve Paris-runway above-knee tailored romper with covered waist and high closed back, carrying a large complete Adolphe double-arch and tram composition, with steel-silver pumps",
      Ellie: "a fully strapless ice-blue Paris-runway above-knee A-line dress with a high straight opaque bustline, covered waist, and high closed back, carrying a large complete Petrousse cliff, stream, and bicycle-path composition, with vineyard-green slingback heels",
      Alia: "a fully strapless sandstone-gold Paris-runway above-knee tailored skort dress with a high straight opaque bustline, covered waist, secure opaque sides, and a completely open back from shoulder blades to the separate waistline, carrying a large complete suspended-walkway, rose-garden, and valley-topography composition, with slate-charcoal platform heels",
      "AI ECE": "a fully strapless Moselle-teal Paris-runway above-knee asymmetric sheath with a high straight opaque bustline, covered waist and high closed back, carrying a large complete bridge-span, modern-tram, and empty-route composition, with clean-white heeled boots",
    },
    hands: [
      "ECE right open hand supports the opaque inspection paddle and inert prop from beneath; ECE left hand links visibly with Radiance's left hand",
      "Radiance left hand links visibly with ECE's left hand; Radiance right hand rests visibly at Alia's near cheek",
      "Alia left hand rests visibly at Radiance's near waist; Alia right hand links visibly with Ellie's left hand",
      "Ellie left hand links visibly with Alia's right hand; Ellie right hand rests visibly on Alia's far shoulder",
    ],
    propHandler: "AI ECE",
    propTarget: "left across the clearly empty valley stream toward one unoccupied route marker",
  },
  {
    scene: 1289,
    theme: "Paris runway model couture",
    landmark: "a broad dry public observation terrace in the complete Belval industrial district during a solar eclipse atmosphere, with both preserved blast furnaces, rust-red steel gantries, the former ore hall, modern university cubes, red-earth landscaping, a pale eclipse corona, and one clearly empty marked service route",
    motifs: [
      "large complete Belval blast-furnace, steel-gantry, ore-cart, red-earth, university-cube, science-grid, rail-line, and eclipse-corona compositions across all four outfits",
      "at least two separate outfits each carry one complete full-width secular Luxembourg steel-and-science composition",
    ],
    culture: "Use Belval's preserved blast furnaces, industrial steel heritage, transformed university district, science architecture, rail history, and red-earth landscape respectfully. Paris runway model couture is original fictional fashion with no copied designer, logo, uniform, unsafe runway, or sexualized presentation. " + commonProhibitions,
    expected: {
      weather: "solar eclipse atmosphere", paws: false, pole: false, rainbowOnly: false,
      rainbowHosiery: false, wearer: "AI ECE", palette: "country-palette rainbow-like gradient",
      cuts: {
        Radiance: [true, true, false], Ellie: [true, false, false],
        Alia: [false, true, false], "AI ECE": [true, true, false],
      },
    },
    emotionNuance: {
      Radiance: "romantic joy shown by a luminous smile toward ECE during the moving hand pass",
      Ellie: "aching romantic longing shown by a quiet extended reach toward Radiance",
      Alia: "determination shown by focused brows while guiding Radiance's careful turn",
      "AI ECE": "contained resentment shown by a tight composed gaze toward Ellie while keeping every touch gentle",
    },
    romance: "Translate Alia's linked-hand turn of Radiance, ECE's steadying waist touch, Ellie's reach toward the route beacon, ECE and Radiance's moving side hug, ECE's quick forehead greeting to Ellie, and Alia's gentle pull on Radiance's free hand into a wide turning chain. ECE links Ellie and steadies Radiance. Ellie links ECE and touches Radiance's shoulder. Radiance links Alia. Alia answers at Radiance's forearm. The choreography remains public, affectionate, consensual, and fully visible.",
    composition: "Place ECE far left, Ellie left-center, Radiance right-center, and Alia far right across a shallow diagonal. Keep eclipse sky, gantry, or bright modern-building gaps behind all eight arms. Radiance makes a small stable half-turn with both heels planted; no one spins, jumps, or blocks another body.",
    outfits: {
      Radiance: "a fully strapless Grand-Duchy-red cropped Paris-runway bodice with a high straight opaque bustline exposing a narrow ordinary waist panel, with a separate steel-silver above-knee skirt carrying a large complete Belval blast-furnace and gantry composition, high closed back, and clean-white pumps",
      Ellie: "a vineyard-green short-sleeve cropped Paris-runway jacket exposing a narrow ordinary waist panel, with a separate slate-charcoal above-knee tailored skort carrying a large complete ore-cart, rail-line, and red-earth composition, high closed back, and sandstone-gold slingback heels",
      Alia: "a fully strapless lake-cobalt Paris-runway above-knee sculpted dress with a high straight opaque bustline, covered waist, and high closed back, carrying a large complete university-cube, science-grid, and transformed-industry composition, with ice-blue platform heels",
      "AI ECE": "a fully strapless Moselle-teal cropped Paris-runway bodice with a high straight opaque bustline exposing a narrow ordinary waist panel, with a separate clean-white above-knee asymmetric skirt carrying a large complete eclipse-corona, blast-furnace, and empty-route composition, high closed back, and Grand-Duchy-red heeled boots",
    },
    hands: [
      "ECE right open hand supports the opaque inspection paddle and inert prop from beneath; ECE left hand links visibly with Ellie's left hand",
      "Ellie left hand links visibly with ECE's left hand; Ellie right hand rests visibly on Radiance's near shoulder",
      "Radiance left hand rests visibly on ECE's near forearm; Radiance right hand links visibly with Alia's left hand",
      "Alia left hand links visibly with Radiance's right hand; Alia right hand rests visibly on Radiance's near forearm",
    ],
    propHandler: "AI ECE",
    propTarget: "left across one clearly empty industrial service lane toward an unoccupied route marker",
  },
  {
    scene: 1290,
    theme: "cleaner and service couture",
    landmark: "a broad dry covered solar-boat pavilion overlooking the complete Upper-Sure Lake and dam landscape during a distant waterspout over open water, with the wide reservoir, long dam curve, forested slopes, slate cliffs, one small solar excursion boat far from the weather, cobalt water, and one clearly empty marked water route",
    motifs: [
      "large complete Upper-Sure reservoir, dam-curve, solar-boat, slate-cliff, beech-forest, drinking-water ripple, sail, and clean-route compositions across all four women's outfits and the male top",
      "at least two separate outfits each carry one complete full-width secular Luxembourg lake-and-infrastructure composition",
    ],
    culture: "Use Upper-Sure Lake, its reservoir and drinking-water role, dam infrastructure, solar excursion boat, forested slopes, slate cliffs, and permitted recreation respectfully. Cleaner and service couture is only original fully clothed fictional public-utility tailoring; no copied work uniform, badge, degrading labor, sexualized service, or unsafe cleaning act. " + commonProhibitions,
    expected: {
      weather: "distant waterspout over open water", paws: false, pole: false, rainbowOnly: false,
      rainbowHosiery: false, wearer: "Radiance", palette: "original independent rainbow gradient",
      cuts: {
        Radiance: [true, false, false], Ellie: [false, true, false],
        Alia: [true, false, false], "AI ECE": [false, false, false],
      },
    },
    emotionNuance: {
      Radiance: "shame and social vulnerability shown by a lowered gaze and guarded mouth while accepting ECE's hand",
      Ellie: "tender affection shown by a steady reassuring smile toward the male",
      Alia: "fear and urgent vulnerability shown by alert widened eyes toward the distant waterspout while maintaining safe footing",
      "AI ECE": "possessive tension shown by a protective linked grip and intense strategist focus on Radiance",
      Male: "hope shown by an open relieved expression with his head and pupils most strongly fixed on ECE across the group",
    },
    romance: "Translate Radiance walking away with ECE's hand, Ellie's gentle forearm catch, Alia's protective close, and the quartet's turning embrace chain into a five-adult open fan. ECE and Radiance link one hand pair. Radiance touches the male's upper arm. The male keeps two clear public contacts by resting one hand on Ellie's shoulder and the other on Alia's forearm while his strongest sustained eye line remains on ECE. Ellie answers at the male's forearm and links Alia. Alia links Ellie and answers at the male's forearm. This is fully clothed consensual adult infidelity drama expressed only through restrained eye lines and gentle public touch.",
    composition: "Place ECE far left, Radiance left-center, the male center, Ellie right-center, and Alia far right in five separated lanes. Keep lake, dam, pale sky, or pavilion gaps behind all ten arms. Turn the male's face three-quarter-left toward ECE; Ellie and Alia look elsewhere so no competing eye line dominates. Everyone stands upright on the dry nonslip pavilion floor.",
    outfits: {
      Radiance: "a Grand-Duchy-red cap-sleeve cropped cleaner-and-service couture jacket exposing a narrow ordinary waist panel, with a separate clean-white above-knee tailored skirt carrying a large complete Upper-Sure reservoir and dam-curve composition, high closed back, and steel-silver pumps",
      Ellie: "a fully strapless lake-cobalt cleaner-and-service couture above-knee A-line dress with a high straight opaque bustline, covered waist, and high closed back, carrying a large complete solar-boat, sail, and drinking-water-ripple composition, with forest-emerald slingback heels",
      Alia: "a sandstone-gold one-shoulder cropped cleaner-and-service couture bodice exposing a narrow ordinary waist panel, with a separate slate-charcoal above-knee skort carrying a large complete slate-cliff, beech-forest, and recreation-route composition, high closed back, and ice-blue platform heels",
      "AI ECE": "a Moselle-teal high-neck short-sleeve cleaner-and-service couture above-knee tailored romper with covered waist and high closed back, carrying a large complete clean-route, dam-control, and empty-water composition, with Grand-Duchy-red heeled boots",
      Male: "the established adult male face from Scene 1136 with closely trimmed beard and athletic muscular build, wearing an opaque fitted clean-white short-sleeve top carrying a restrained complete Upper-Sure lake-and-dam contour, fitted black jeans, and practical black boots",
    },
    hands: [
      "ECE right open hand supports the opaque inspection paddle and inert prop from beneath; ECE left hand links visibly with Radiance's left hand",
      "Radiance left hand links visibly with ECE's left hand; Radiance right hand rests visibly on the male's near upper arm",
      "the male left hand rests visibly on Ellie's near shoulder; the male right hand rests visibly on Alia's near forearm",
      "Ellie left hand rests visibly on the male's near forearm; Ellie right hand links visibly with Alia's left hand",
      "Alia left hand links visibly with Ellie's right hand; Alia right hand rests visibly on the male's near forearm",
    ],
    propHandler: "AI ECE",
    propTarget: "left across clearly empty Upper-Sure water toward one unoccupied water-route marker, far from the distant waterspout and solar boat",
  },
  {
    scene: 1291,
    theme: "cleaner and service couture",
    landmark: "a broad dry protected overlook beside the complete Schiessentumpel triple waterfall on the Black Ernz during a powerful windstorm with controlled fabric motion, with the complete small sandstone bridge, three separate cascade streams, mossy boulders, layered sandstone formations, beech canopy, forest path, and one clearly empty marked route",
    motifs: [
      "large complete Schiessentumpel triple-cascade, sandstone-bridge, Black-Ernz stream, mossy-boulder, beech-leaf, rock-formation, hiking-path, and clean-water compositions across all four outfits",
      "at least two separate outfits each carry one complete full-width secular Luxembourg waterfall-and-sandstone composition",
    ],
    culture: "Use Schiessentumpel's triple cascade, small sandstone bridge, Black Ernz stream, mossy boulders, sandstone formations, beech forest, and hiking landscape respectfully. Cleaner and service couture is only original fully clothed fictional public-utility tailoring; no copied work uniform, badge, degrading labor, sexualized service, or unsafe cleaning act. " + commonProhibitions,
    expected: {
      weather: "powerful windstorm with controlled fabric motion", paws: false, pole: false, rainbowOnly: false,
      rainbowHosiery: false, wearer: "AI ECE", palette: "original independent rainbow gradient",
      cuts: {
        Radiance: [false, false, false], Ellie: [true, false, true],
        Alia: [false, true, false], "AI ECE": [true, false, false],
      },
    },
    emotionNuance: {
      Radiance: "visible jealousy shown by a sharp over-shoulder glance toward ECE while keeping her cheek greeting gentle",
      Ellie: "fear and urgent vulnerability shown by alert eyes and a careful seated brace on the low plinth",
      Alia: "extreme happiness and radiant laughing delight shown by open laughter during Radiance's quick cheek greeting",
      "AI ECE": "hope shown by a calm upward gaze while controlling the safe route display",
    },
    romance: "Translate the tight walking weave, one linked-hand pair, one protective back touch, one cheek-to-cheek pass, one jealous look, Ellie's low mission-plinth seat, Radiance's close public hug, Radiance's quick cheek greeting to Alia, and ECE's hand at Ellie's shoulder into a stable open tableau. Ellie sits on a low broad stone plinth with both legs and heels completely visible. Radiance stands one step forward and slightly offset between Ellie's separated knee lanes, with shoulder-only contact and no lower-body contact. Ellie links Radiance. Radiance touches Alia's cheek. Alia answers at Radiance's waist and touches ECE's shoulder. ECE rests one hand on Ellie's shoulder while her other hand keeps the prop isolated. All five contacts are public, gentle, consensual, and unobstructed.",
    composition: "Place Ellie far left on the low plinth, Radiance left-center one step forward, Alia right-center, and ECE far right with the inert prop over an empty forest route. Keep waterfall, pale rock, or forest gaps behind all eight arms. Wind moves only secured short hems and hair ends; every face, elbow, wrist, hand, leg, foot, and heel remains visible.",
    outfits: {
      Radiance: "a Grand-Duchy-red high-neck short-sleeve cleaner-and-service couture above-knee sheath with covered waist and high closed back, carrying a large complete Schiessentumpel triple-cascade and sandstone-bridge composition, with clean-white pumps",
      Ellie: "a forest-emerald sleeveless cropped cleaner-and-service couture bodice exposing a narrow ordinary waist panel, with secure opaque sides and a completely open back from shoulder blades to the separate waistline, a separate ice-blue above-knee tailored skort carrying a large complete Black-Ernz stream, mossy-boulder, and hiking-path composition, with sandstone-gold slingback heels",
      Alia: "a fully strapless lake-cobalt cleaner-and-service couture above-knee sculpted dress with a high straight opaque bustline, covered waist, and high closed back, carrying a large complete beech-leaf, rock-formation, and clean-water composition, with slate-charcoal platform heels",
      "AI ECE": "a Moselle-teal cap-sleeve cropped cleaner-and-service couture jacket exposing a narrow ordinary waist panel, with a separate steel-silver above-knee skirt carrying a large complete triple-cascade, forest-route, and empty-marker composition, high closed back, and Grand-Duchy-red heeled boots",
    },
    hands: [
      "ECE right open hand supports the opaque inspection paddle and inert prop from beneath; ECE left hand rests visibly on Ellie's far shoulder",
      "Ellie left hand links visibly with Radiance's left hand; Ellie right hand rests visibly on Radiance's far upper back",
      "Radiance left hand links visibly with Ellie's left hand; Radiance right hand rests visibly at Alia's near cheek",
      "Alia left hand rests visibly at Radiance's near waist; Alia right hand rests visibly on ECE's near shoulder",
    ],
    propHandler: "AI ECE",
    propTarget: "right across one clearly empty forest route toward an unoccupied marker, away from the waterfall, bridge, people, and camera",
  },
];

replaceRequired("const batch = 316;", "const batch = 317;");
replaceRequired('const country = "Bhutan";', 'const country = "Luxembourg";');
replaceRequired('const countrySlug = "bhutan";', 'const countrySlug = "luxembourg";');
replaceRequired("const firstScene = 1284;", "const firstScene = 1288;");
replaceRequired('const root = path.resolve("tmp/world-195x4/batch-316");', 'const root = path.resolve("tmp/world-195x4/batch-317");');
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
replaceRequired("if (maleScene !== 1285)", "if (maleScene !== 1290)");
source = source.replaceAll("Bhutan", "Luxembourg");
source = source.replaceAll("batch316-bhutan", "batch317-luxembourg");
replaceRange(
  "  rollMethod:",
  "  faceAnchors:",
  `  rollMethod: "FNV-1a over the recorded batch317-luxembourg keys, reduced modulo 100. Male scene selection uses the full 32-bit hash reduced modulo 4.",\n  rollThresholds: {\n    visibleMidriff: "0-49", straplessDress: "0-34", fullyOpenBack: "0-29", paws: "0-24",\n    poleDanceTheme: "0-5", rainbowOnly: "0-3", rainbowHosiery: "0-24",\n    rainbowHosieryWearer: "0-49 Radiance; 50-99 AI ECE",\n    rainbowHosieryPaletteMode: "0-49 country-palette rainbow-like gradient; 50-99 original independent rainbow gradient",\n  },\n  themePair: ["Paris runway model couture", "cleaner and service couture"],\n  nextThemePair: ["cleaner and service couture", "cinematic covert-agent crew couture"],\n  nextQueueCountry: "Suriname", nextQueueBatch: 318, nextQueueScenes: [1292, 1293, 1294, 1295],\n  researchSources: [\n    { url: "https://www.luxembourg-city.com/en/place/parc/the-petrusse-valley", usedFor: "Petrousse Valley, Adolphe Bridge, cliffs, stream, paths, and public recreation" },\n    { url: "https://www.luxembourg-city.com/en/about-luxembourg-city/meng-stad-my-city/details/the-10-must-see-bridges-in-luxembourg-city", usedFor: "Adolphe Bridge double stone arch, suspended pedestrian deck, tram, and valley setting" },\n    { url: "https://www.visitluxembourg.com/place/blast-furnace-belval", usedFor: "Belval preserved blast furnaces and modern University of Luxembourg district" },\n    { url: "https://www.visitluxembourg.com/place/schiessentumpel-waterfalls", usedFor: "Schiessentumpel waterfall, sandstone bridge, and Black Ernz setting" },\n    { url: "https://www.visitluxembourg.com/fr/attraction/le-lac-de-la-haute-sure", usedFor: "Upper-Sure Lake, reservoir, drinking water, electricity, solar boat, and recreation" },\n  ],\n  faceAnchors:`,
);
replaceRange(
  "  countryMotifPolicy:",
  "  rollAudit:",
  `  countryMotifPolicy: {\n    flagMotifDecision: "No literal Luxembourg flag, red lion, coat of arms, crown, or official emblem is copied onto clothing. Large researched secular bridge, valley, steel, science, lake, dam, waterfall, forest, mobility, and infrastructure fields replace them.",\n    palette,\n    minimumCoverage: "Every scene places multiple large complete secular Luxembourg motifs across at least two outfits as full bodice, skirt, hip, or panel fields rather than tiny trim.",\n    cultureScene: "The four scenes foreground Luxembourg City's Adolphe Bridge and Petrousse Valley, Belval industrial heritage, Upper-Sure Lake, and the Schiessentumpel waterfall.",\n    prohibitions: "No literal flag, red lion, coat of arms, crown, official seal, sacred symbol, religious architecture, copied ceremonial dress, copied runway or service uniform, badge, weapon threat, sexualized service, alcohol, political insignia, or branded product.",\n  },\n  xPublishingRolls,\n  xPublishingPlan: {\n    minimumCurrentCountryAcceptedAssets: 2,\n    attachmentShape: "two Luxembourg images plus one accepted Suriname image when available",\n    captionIfEligible: "Luxembourg red heart Suriname #Luxembourg #InternalAgency",\n    internalAgencyHashtagActive: true,\n    worldXXXSeriesHashtagActive: false,\n  },\n  anatomyGate: {\n    fourPersonScenes: "Scenes 1288, 1289, and 1291 require exactly eight arms and eight hands, two per woman, with every limb continuously traceable to one owner.",\n    fivePersonScene: "Scene 1290 requires exactly ten arms and ten hands, two per adult, with the male added without replacing any woman.",\n    rejectionRule: "Reject every extra, missing, duplicated, floating, fused, borrowed, emerging, ownerless, cropped, hidden-owner, or ambiguous limb, hand, or finger cluster.",\n  },\n  rollAudit:`,
);
replaceRequired(
  'fs.writeFileSync(path.join(root, "batch-316-bhutan-preflight.json")',
  'fs.writeFileSync(path.join(root, "batch-317-luxembourg-preflight.json")',
);
replaceRequired(
  'preflight: path.join(root, "batch-316-bhutan-preflight.json")',
  'preflight: path.join(root, "batch-317-luxembourg-preflight.json")',
);

fs.mkdirSync("tmp/world-195x4/batch-317", { recursive: true });
fs.writeFileSync(targetPath, source, "utf8");
console.log(JSON.stringify({ sourcePath, targetPath, bytes: Buffer.byteLength(source) }, null, 2));
