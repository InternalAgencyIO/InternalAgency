import fs from "node:fs";

const sourcePath = "tmp/world-195x4/batch-317/materialize-batch-317.mjs";
const targetPath = "tmp/world-195x4/batch-318/materialize-batch-318.mjs";
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

const commonProhibitions = "Use secular Suriname rivers, bridges, rainforest, reservoirs, waterfalls, granite formations, coast, wildlife, agriculture, food, craft, and civic infrastructure only. No literal flag, central star, coat of arms, official seal, sacred symbol, religious building, copied Indigenous or Maroon ceremonial pattern, copied uniform, badge, readable text, brand, alcohol, or political insignia.";
const palette = "rainforest emerald, Suriname-river blue, clay red, rice white, bromeliad magenta, golden yellow, mahogany brown, sea-turtle teal, granite silver, and night charcoal";

const sceneSpecs = [
  {
    scene: 1292,
    theme: "cleaner and service couture",
    landmark: "a broad dry covered riverfront pavilion on Paramaribo's Waterkant during a rolling thunderstorm, with the complete high arc of the Jules Wijdenbosch Bridge over the Suriname River, secular wooden waterfront facades, a broad quay, rain trees, riverboats secured far away, and one clearly empty marked water route; lightning and rain remain beyond the roof",
    motifs: [
      "large complete Jules-Wijdenbosch-Bridge arc, Suriname-River current, Waterkant quay, wooden-shutter, riverboat, rain-tree, cassava-leaf, and market-fruit compositions across all four outfits",
      "at least two separate outfits each carry one complete full-width secular Suriname riverfront-and-bridge composition rather than tiny trim",
    ],
    culture: "Use Paramaribo's Suriname River waterfront, Jules Wijdenbosch Bridge, Waterkant quay, secular wooden architecture, river mobility, rain trees, cassava, and market fruit respectfully. Cleaner and service couture is only original fully clothed fictional public-utility tailoring; no copied work uniform, badge, degrading labor, sexualized service, or unsafe cleaning act. " + commonProhibitions,
    expected: {
      weather: "rolling thunderstorm", paws: false, pole: false, rainbowOnly: false,
      rainbowHosiery: false, wearer: "AI ECE", palette: "country-palette rainbow-like gradient",
      cuts: {
        Radiance: [false, true, false], Ellie: [false, false, true],
        Alia: [true, false, true], "AI ECE": [true, true, false],
      },
    },
    emotionNuance: {
      Radiance: "magnetic confidence shown by a calm upright river-guide gaze while accepting the group embrace",
      Ellie: "aching romantic longing shown by a softened seated gaze toward Radiance",
      Alia: "contained resentment shown by a tight controlled glance toward Ellie while keeping both contacts gentle",
      "AI ECE": "suspicion shown by a narrowed strategist gaze toward the empty river route",
    },
    romance: "Translate Alia's route card against Radiance's back and behind embrace, Ellie's cheek touch, ECE's close controlled jealousy, Ellie's low mission-plinth seat, Radiance's close public hug, Radiance's quick cheek greeting to Alia, and ECE's hand at Ellie's shoulder into a stable open tableau. Ellie sits on a low broad quay bench at left with both legs and heels completely visible. Radiance stands one step forward and slightly offset between Ellie's separated knee lanes, with shoulder-only closeness and no lower-body contact. ECE rests one hand on Ellie's shoulder while her other hand keeps the prop isolated. Ellie links Radiance and touches her cheek. Radiance answers at Alia's cheek. Alia holds a flat route card visibly against Radiance's upper back while her other hand rests at Radiance's waist. All five contacts remain public, gentle, consensual, and unobstructed.",
    composition: "Place ECE far left, Ellie left-center seated, Radiance center one step forward, and Alia far right slightly behind Radiance. Keep river, bridge, pale storm sky, or pavilion gaps behind all eight arms. No torso, route card, or hair may hide an elbow, wrist, or hand.",
    outfits: {
      Radiance: "a fully strapless clay-red cleaner-and-service couture above-knee A-line dress with a high straight opaque bustline, covered waist, and high closed back, carrying a large complete Jules Wijdenbosch Bridge and Suriname River composition, with rice-white pumps",
      Ellie: "a rainforest-emerald sleeveless cleaner-and-service couture above-knee tailored romper with covered waist, secure opaque sides, and a completely open back from shoulder blades to the separate waistline, carrying a large complete Waterkant quay, wooden-shutter, and rain-tree composition, with golden-yellow slingback heels",
      Alia: "a Suriname-river-blue cap-sleeve cropped cleaner-and-service couture jacket exposing a narrow ordinary waist panel, with secure opaque sides and a completely open back from shoulder blades to the separate waistline, a separate night-charcoal above-knee skort carrying a large complete riverboat, cassava-leaf, and market-fruit composition, with bromeliad-magenta platform heels",
      "AI ECE": "a fully strapless sea-turtle-teal cropped cleaner-and-service couture bodice with a high straight opaque bustline exposing a narrow ordinary waist panel, with a separate granite-silver above-knee skirt carrying a large complete bridge-arc, river-current, and empty-route composition, high closed back, and clay-red heeled boots",
    },
    hands: [
      "ECE right open hand supports the opaque inspection paddle and inert prop from beneath; ECE left hand rests visibly on Ellie's far shoulder",
      "Ellie left hand links visibly with Radiance's left hand; Ellie right hand rests visibly at Radiance's near cheek",
      "Radiance left hand links visibly with Ellie's left hand; Radiance right hand rests visibly at Alia's near cheek",
      "Alia left hand rests visibly at Radiance's near waist; Alia right hand holds one flat opaque route card visibly against Radiance's upper back",
    ],
    propHandler: "AI ECE",
    propTarget: "left across clearly empty Suriname River water toward one unoccupied route marker, away from bridge traffic and riverboats",
  },
  {
    scene: 1293,
    theme: "cleaner and service couture",
    landmark: "a broad dry covered panoramic platform on Brownsberg overlooking the complete Brokopondo Reservoir during a sunshower with sparkling droplets, with the vast reservoir, rainforest islands, red-earth ridge, layered Guiana Shield hills, distant treetops, a bright rain shaft, and one clearly empty marked water route",
    motifs: [
      "large complete Brokopondo-reservoir, Brownsberg-ridge, rainforest-island, red-earth-road, rain-shaft, howler-monkey silhouette, tropical-bird wing, and water-route compositions across all four women's outfits and the male top",
      "at least two separate outfits each carry one complete full-width secular Suriname reservoir-and-rainforest composition",
    ],
    culture: "Use Brownsberg's high rainforest plateau, Brokopondo Reservoir, red earth, Guiana Shield hills, tropical birds, howler monkeys, and watershed landscape respectfully. Wildlife stays distant and undisturbed. Cleaner and service couture is only original fully clothed fictional public-utility tailoring; no copied work uniform, badge, degrading labor, sexualized service, or unsafe cleaning act. " + commonProhibitions,
    expected: {
      weather: "sunshower with sparkling droplets", paws: false, pole: false, rainbowOnly: false,
      rainbowHosiery: false, wearer: "Radiance", palette: "country-palette rainbow-like gradient",
      cuts: {
        Radiance: [false, false, false], Ellie: [false, false, true],
        Alia: [false, false, false], "AI ECE": [false, false, false],
      },
    },
    emotionNuance: {
      Radiance: "anger shown by a firm jaw and focused gaze past the male while every touch stays controlled",
      Ellie: "overwhelming relief shown by relaxed shoulders and tear-bright eyes toward Alia",
      Alia: "romantic joy shown by a luminous smile toward Radiance",
      "AI ECE": "overwhelming relief shown differently through one visible tear and a deep steadying breath toward Radiance",
      Male: "tender affection shown by a warm restrained expression with his head and pupils most strongly fixed on ECE across the group",
    },
    romance: "Translate Radiance walking with ECE's hand, Ellie's gentle forearm catch, Alia's protective close, and the turning embrace chain into a five-adult open fan. ECE and Radiance link one hand pair. Radiance rests her free hand on the male's upper arm. The male keeps two clear public contacts by resting one hand on Ellie's shoulder and the other on Alia's forearm while his strongest sustained eye line remains on ECE. Ellie answers at the male's forearm and links Alia. Alia links Ellie and answers at the male's forearm. This is fully clothed consensual adult infidelity drama expressed only through restrained eye lines and gentle public touch.",
    composition: "Place ECE far left, Radiance left-center, the male center, Ellie right-center, and Alia far right in five separated lanes. Keep reservoir, rain shaft, pale sky, or forest gaps behind all ten arms. Turn the male's face three-quarter-left beyond Radiance toward ECE; Radiance looks past him and Ellie and Alia look away so no competing eye line dominates.",
    outfits: {
      Radiance: "a clay-red high-neck cap-sleeve cleaner-and-service couture above-knee sheath with covered waist and high closed back, carrying a large complete Brownsberg ridge and Brokopondo reservoir composition, with rice-white pumps",
      Ellie: "a rainforest-emerald sleeveless cleaner-and-service couture above-knee tailored skort dress with covered waist, secure opaque sides, and a completely open back from shoulder blades to the separate waistline, carrying a large complete rainforest-island, rain-shaft, and red-earth-road composition, with golden-yellow slingback heels",
      Alia: "a Suriname-river-blue one-shoulder cleaner-and-service couture above-knee sculpted dress with covered waist and high closed back, carrying a large complete tropical-bird wing, howler-monkey silhouette, and Guiana-Shield-hill composition, with bromeliad-magenta platform heels",
      "AI ECE": "a sea-turtle-teal collared short-sleeve cleaner-and-service couture above-knee tailored romper with covered waist and high closed back, carrying a large complete watershed, reservoir-current, and empty-route composition, with clay-red heeled boots",
      Male: "the established adult male face from Scene 1136 with closely trimmed beard and athletic muscular build, wearing an opaque fitted rice-white short-sleeve top carrying a restrained complete Brownsberg ridge-and-reservoir contour, fitted black jeans, and practical black boots",
    },
    hands: [
      "ECE right open hand supports the opaque inspection paddle and inert prop from beneath; ECE left hand links visibly with Radiance's left hand",
      "Radiance left hand links visibly with ECE's left hand; Radiance right hand rests visibly on the male's near upper arm",
      "the male left hand rests visibly on Ellie's near shoulder; the male right hand rests visibly on Alia's near forearm",
      "Ellie left hand rests visibly on the male's near forearm; Ellie right hand links visibly with Alia's left hand",
      "Alia left hand links visibly with Ellie's right hand; Alia right hand rests visibly on the male's near forearm",
    ],
    propHandler: "AI ECE",
    propTarget: "left across clearly empty Brokopondo water toward one unoccupied water-route marker, away from every island, person, animal, and camera",
  },
  {
    scene: 1294,
    theme: "cinematic covert-agent crew couture",
    landmark: "a broad dry covered conservation overlook in the Central Suriname Nature Reserve during soft dramatic overcast, with the complete rounded granite Voltzberg dome rising above primary rainforest, Raleigh Falls on the Coppename River, layered canopy, distant macaws, one empty river route, and no settlement or sacred structure",
    motifs: [
      "large complete Voltzberg-granite-dome, Raleigh-Falls, Coppename-river, rainforest-canopy, macaw-wing, giant-river-otter ripple, inselberg, and conservation-route compositions across all four outfits",
      "at least two separate outfits each carry one complete full-width secular Suriname rainforest-and-granite composition",
    ],
    culture: "Use the Central Suriname Nature Reserve's Voltzberg granite dome, Raleigh Falls, Coppename watershed, primary rainforest, macaws, river otters, and Guiana Shield geology respectfully. Wildlife stays distant and undisturbed. Cinematic covert-agent crew couture is only fictional public route-scout fashion; no assassination, injury, combat, copied uniform, badge, raid, arrest, threat, surveillance of people, or official impersonation. " + commonProhibitions,
    expected: {
      weather: "soft dramatic overcast", paws: false, pole: true, rainbowOnly: false,
      rainbowHosiery: false, wearer: "Radiance", palette: "original independent rainbow gradient",
      cuts: {
        Radiance: [false, true, false], Ellie: [true, false, false],
        Alia: [true, false, false], "AI ECE": [false, false, false],
      },
    },
    emotionNuance: {
      Radiance: "tender affection shown by a reassuring smile and gentle cheek touch toward Alia",
      Ellie: "romantic joy shown by a bright rising smile toward Radiance",
      Alia: "tender affection shown differently through a quiet softened gaze and steadying waist contact",
      "AI ECE": "suspicion shown by an alert strategist gaze toward the empty Coppename route",
    },
    romance: "Translate Ellie's rise into Radiance's waiting side hug, ECE's retained hand link, Alia's wounded-rival beat, Radiance cradling Alia's face, Alia's waist hug, Ellie's opposite-cheek greeting, and ECE's close watch into a wide shallow crescent. ECE and Radiance link one hand pair. Radiance rests her free hand at Alia's cheek. Alia answers at Radiance's waist and links Ellie. Ellie links Alia and rests her free hand on Radiance's shoulder. All five contacts are visible, public, gentle, and consensual.",
    composition: "Place ECE far left, Radiance left-center, Alia right-center, and Ellie far right in separated lanes. Keep pale sky, granite dome, waterfall mist, or canopy gaps behind every arm. Place the inactive-touch navigation pole well behind the group on a separate base so no hand, body, or prop overlaps it.",
    outfits: {
      Radiance: "a fully strapless rice-white cinematic covert-agent above-knee A-line dress with a high straight opaque bustline, covered waist, and high closed back, carrying a large complete Voltzberg dome and rainforest-canopy composition, with clay-red pumps",
      Ellie: "a rainforest-emerald short-sleeve cropped cinematic covert-agent jacket exposing a narrow ordinary waist panel, with a separate Suriname-river-blue above-knee tailored skort carrying a large complete Raleigh-Falls, Coppename-current, and macaw-wing composition, high closed back, and golden-yellow slingback heels",
      Alia: "a bromeliad-magenta one-shoulder cropped cinematic covert-agent bodice exposing a narrow ordinary waist panel, with a separate night-charcoal above-knee skirt carrying a large complete giant-river-otter ripple, inselberg, and conservation composition, high closed back, and granite-silver platform heels",
      "AI ECE": "a sea-turtle-teal high-neck cap-sleeve cinematic covert-agent above-knee tailored romper with covered waist and high closed back, carrying a large complete route-grid, granite-dome, and empty-river composition, with clay-red heeled boots",
    },
    hands: [
      "ECE right open hand supports the opaque inspection paddle and inert prop from beneath; ECE left hand links visibly with Radiance's left hand",
      "Radiance left hand links visibly with ECE's left hand; Radiance right hand rests visibly at Alia's near cheek",
      "Alia left hand rests visibly at Radiance's near waist; Alia right hand links visibly with Ellie's left hand",
      "Ellie left hand links visibly with Alia's right hand; Ellie right hand rests visibly on Radiance's far shoulder",
    ],
    propHandler: "AI ECE",
    propTarget: "left across clearly empty Coppename water toward one unoccupied conservation-route marker, away from every person, animal, waterfall, and camera",
    pole: "Pole theme is active only as one stationary matte-gold vertical navigation marker on its own weighted base far behind the adults. It carries a small abstract route light and no person touches, approaches, dances with, leans on, or performs around it.",
  },
  {
    scene: 1295,
    theme: "cinematic covert-agent crew couture",
    landmark: "a broad dry covered conservation boardwalk at Galibi during a heavy rain curtain, with the Atlantic shoreline, Marowijne River mouth, mangrove fringe, beach-morning-glory vines, distant protected leatherback turtle tracks, faraway sea turtles beyond the route zone, and one clearly empty marked ocean route; all wildlife remains distant and undisturbed",
    motifs: [
      "large complete Galibi-shoreline, Marowijne-river-mouth, mangrove-root, leatherback-shell contour, turtle-track, Atlantic-wave, beach-flower, and conservation-route compositions across all four outfits",
      "at least two separate outfits each carry one complete full-width secular Suriname coast-and-conservation composition",
    ],
    culture: "Use Galibi's protected Atlantic coast, Marowijne River mouth, mangroves, beach morning glory, sea-turtle nesting habitat, turtle tracks, and community-led conservation respectfully. Wildlife stays distant and no nest is approached. Cinematic covert-agent crew couture is only fictional public route-scout fashion; no assassination, injury, combat, copied uniform, badge, raid, arrest, threat, surveillance of people, or official impersonation. " + commonProhibitions,
    expected: {
      weather: "heavy rain curtain", paws: false, pole: false, rainbowOnly: false,
      rainbowHosiery: false, wearer: "Radiance", palette: "country-palette rainbow-like gradient",
      cuts: {
        Radiance: [true, false, true], Ellie: [true, false, true],
        Alia: [true, false, false], "AI ECE": [false, true, false],
      },
    },
    emotionNuance: {
      Radiance: "determination shown by a focused forward gaze while keeping her linked hand gentle",
      Ellie: "awe shown by wide bright eyes toward the rain-swept Atlantic horizon",
      Alia: "startled surprise shown by lifted brows during the changing route signal",
      "AI ECE": "calm contentment shown by a serene seated smile toward Ellie",
    },
    romance: "Translate two characters sitting close on a low mission plinth, a third leaning into a behind hug, the fourth standing between their knees with the beacon, ECE sitting against Radiance's side, Radiance's arm around ECE, ECE's quick cheek greeting to Ellie, and Alia resting both hands above their joined hands into a stable public rain-shelter tableau. ECE and Radiance sit side by side on a low broad bench with every leg and heel visible. Ellie stands one step forward and offset between their separated knee lanes so no body is blocked. Alia kneels upright on one dry raised pad at far right with both lower legs and heels visible. ECE and Radiance link one hand pair; Radiance rests her free hand on ECE's upper back. Ellie rests one hand on ECE's shoulder and links Alia. Alia links Ellie and rests her free hand visibly on Radiance's forearm just above the joined pair. All contacts remain public, gentle, consensual, and unobstructed.",
    composition: "Place ECE left-center and Radiance right-center seated side by side, Ellie far left one step forward, and Alia far right on the raised pad. Keep ocean, pale rain, mangrove, or boardwalk gaps behind all eight arms. The heavy rain curtain remains beyond the roof and every face, elbow, wrist, hand, leg, foot, and heel stays dry and completely visible.",
    outfits: {
      Radiance: "a clay-red sleeveless cropped cinematic covert-agent bodice exposing a narrow ordinary waist panel, with secure opaque sides and a completely open back from shoulder blades to the separate waistline, a separate rice-white above-knee skirt carrying a large complete Galibi shoreline and Atlantic-wave composition, with golden-yellow pumps",
      Ellie: "a rainforest-emerald cap-sleeve cropped cinematic covert-agent jacket exposing a narrow ordinary waist panel, with secure opaque sides and a completely open back from shoulder blades to the separate waistline, a separate Suriname-river-blue above-knee tailored skort carrying a large complete Marowijne-river-mouth, mangrove-root, and beach-flower composition, with granite-silver slingback heels",
      Alia: "a bromeliad-magenta one-shoulder cropped cinematic covert-agent bodice exposing a narrow ordinary waist panel, with a separate night-charcoal above-knee skirt carrying a large complete leatherback-shell contour, turtle-track, and conservation composition, high closed back, and sea-turtle-teal platform heels",
      "AI ECE": "a fully strapless sea-turtle-teal cinematic covert-agent above-knee A-line dress with a high straight opaque bustline, covered waist, and high closed back, carrying a large complete rain-curtain, empty-ocean-route, and mangrove-shore composition, with clay-red heeled boots",
    },
    hands: [
      "ECE right open hand supports the opaque inspection paddle and inert prop from beneath; ECE left hand links visibly with Radiance's left hand",
      "Radiance left hand links visibly with ECE's left hand; Radiance right hand rests visibly on ECE's upper back",
      "Ellie left hand rests visibly on ECE's far shoulder; Ellie right hand links visibly with Alia's right hand",
      "Alia right hand links visibly with Ellie's right hand; Alia left hand rests visibly on Radiance's near forearm just above the linked pair",
    ],
    propHandler: "AI ECE",
    propTarget: "left across clearly empty Atlantic water toward one unoccupied route marker, away from every turtle, track, nest, mangrove, person, and camera",
  },
];

replaceRequired("const batch = 317;", "const batch = 318;");
replaceRequired('const country = "Luxembourg";', 'const country = "Suriname";');
replaceRequired('const countrySlug = "luxembourg";', 'const countrySlug = "suriname";');
replaceRequired("const firstScene = 1288;", "const firstScene = 1292;");
replaceRequired('const root = path.resolve("tmp/world-195x4/batch-317");', 'const root = path.resolve("tmp/world-195x4/batch-318");');
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
replaceRequired("if (maleScene !== 1290)", "if (maleScene !== 1293)");
source = source.replaceAll("Luxembourg", "Suriname");
source = source.replaceAll("batch317-luxembourg", "batch318-suriname");
replaceRequired(
  '    ? "Pole theme is active only as a stationary public-safe fashion motif with no dance or suggestive performance."',
  '    ? (spec.pole ?? "Pole theme is active only as a stationary public-safe fashion motif with no dance or suggestive performance.")',
);
replaceRange(
  "  rollMethod:",
  "  faceAnchors:",
  `  rollMethod: "FNV-1a over the recorded batch318-suriname keys, reduced modulo 100. Male scene selection uses the full 32-bit hash reduced modulo 4.",\n  rollThresholds: {\n    visibleMidriff: "0-49", straplessDress: "0-34", fullyOpenBack: "0-29", paws: "0-24",\n    poleDanceTheme: "0-5", rainbowOnly: "0-3", rainbowHosiery: "0-24",\n    rainbowHosieryWearer: "0-49 Radiance; 50-99 AI ECE",\n    rainbowHosieryPaletteMode: "0-49 country-palette rainbow-like gradient; 50-99 original independent rainbow gradient",\n  },\n  themePair: ["cleaner and service couture", "cinematic covert-agent crew couture"],\n  nextThemePair: ["cinematic covert-agent crew couture", "undercover investigator couture"],\n  nextQueueCountry: "Montenegro", nextQueueBatch: 319, nextQueueScenes: [1296, 1297, 1298, 1299],\n  researchSources: [\n    { url: "https://www.suriname-tourism.org/en/", usedFor: "Suriname rivers, rainforest, waterfalls, canoes, biodiversity, Galibi turtles, food, and Paramaribo wooden architecture" },\n    { url: "https://gov.sr/wp-content/uploads/2025/05/%40-Magazine-Vision-MIN-OW-SIDPS-2025-2050.pdf", usedFor: "Jules Wijdenbosch Bridge over the Suriname River and national transport infrastructure" },\n    { url: "https://whc.unesco.org/fr/list/1017", usedFor: "Central Suriname Nature Reserve, Coppename watershed, granite inselbergs, primary rainforest, and Guiana Shield topography" },\n    { url: "https://whc.unesco.org/uploads/nominations/1017.pdf", usedFor: "Raleigh Falls, Voltzberg dome, rainforest species, and conservation landscape" },\n    { url: "https://suriname.travel/marowijne/", usedFor: "Galibi protected coast, Marowijne River, mangroves, and sea-turtle nesting habitat" },\n  ],\n  faceAnchors:`,
);
replaceRange(
  "  countryMotifPolicy:",
  "  rollAudit:",
  `  countryMotifPolicy: {\n    flagMotifDecision: "No literal Suriname flag, central star, coat of arms, or official emblem is copied onto clothing. Large researched secular bridge, river, reservoir, rainforest, waterfall, granite, coast, wildlife, agriculture, food, and conservation fields replace them.",\n    palette,\n    minimumCoverage: "Every scene places multiple large complete secular Suriname motifs across at least two outfits as full bodice, skirt, hip, or panel fields rather than tiny trim.",\n    cultureScene: "The four scenes foreground Paramaribo's riverfront and bridge, Brownsberg and Brokopondo Reservoir, Voltzberg and Raleigh Falls, and Galibi's protected coast.",\n    prohibitions: "No literal flag, central star, coat of arms, official seal, sacred symbol, religious architecture, copied Indigenous or Maroon ceremonial pattern, copied service or covert uniform, badge, weapon threat, sexualized service, assassination, combat, political insignia, or branded product.",\n  },\n  xPublishingRolls,\n  xPublishingPlan: {\n    minimumCurrentCountryAcceptedAssets: 2,\n    attachmentShape: "two Suriname images plus one accepted Montenegro image when available",\n    captionIfEligible: "Suriname red heart Montenegro #Suriname",\n    internalAgencyHashtagActive: false,\n    worldXXXSeriesHashtagActive: false,\n  },\n  anatomyGate: {\n    fourPersonScenes: "Scenes 1292, 1294, and 1295 require exactly eight arms and eight hands, two per woman, with every limb continuously traceable to one owner.",\n    fivePersonScene: "Scene 1293 requires exactly ten arms and ten hands, two per adult, with the male added without replacing any woman.",\n    rejectionRule: "Reject every extra, missing, duplicated, floating, fused, borrowed, emerging, ownerless, cropped, hidden-owner, or ambiguous limb, hand, or finger cluster.",\n  },\n  rollAudit:`,
);
replaceRequired(
  'fs.writeFileSync(path.join(root, "batch-317-luxembourg-preflight.json")',
  'fs.writeFileSync(path.join(root, "batch-318-suriname-preflight.json")',
);
replaceRequired(
  'preflight: path.join(root, "batch-317-luxembourg-preflight.json")',
  'preflight: path.join(root, "batch-318-suriname-preflight.json")',
);

fs.mkdirSync("tmp/world-195x4/batch-318", { recursive: true });
fs.writeFileSync(targetPath, source, "utf8");
console.log(JSON.stringify({ sourcePath, targetPath, bytes: Buffer.byteLength(source) }, null, 2));
