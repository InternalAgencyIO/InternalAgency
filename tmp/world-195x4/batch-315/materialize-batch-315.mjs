import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const batch = 315;
const country = "Solomon Islands";
const countrySlug = "solomon-islands";
const firstScene = 1280;
const root = path.resolve("tmp/world-195x4/batch-315");
const contractPath = path.resolve("assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const contractBytes = fs.readFileSync(contractPath);
const contract = JSON.parse(contractBytes.toString("utf8"));
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const characters = ["Radiance", "Ellie", "Alia", "AI ECE"];

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex").toUpperCase();

function fnv1a(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

const roll = (key) => fnv1a(key) % 100;
const fromDistribution = (value, distribution, resultKey) => {
  for (const entry of distribution) {
    const [startText, endText = startText] = entry.range.split("-");
    if (value >= Number(startText) && value <= Number(endText)) return entry[resultKey];
  }
  throw new Error(`No distribution result for ${value}`);
};

const primaryPairs = [];
const selectorPairs = [];
const primary = (key) => {
  const value = roll(key);
  primaryPairs.push([key, value]);
  return { key, roll: value };
};
const selector = (key, result) => {
  const value = roll(key);
  selectorPairs.push([key, value]);
  return { key, roll: value, result };
};

const commonProhibitions = "Use secular Solomon Islands landscape, wildlife, food, market, craft, conservation, and civil-infrastructure references only. No literal flag, five-star field, coat of arms, official seal, sacred symbol, religious building, copied ceremonial dress, copied uniform, badge, readable text, brand, alcohol, or political insignia.";
const palette = "lagoon turquoise, rainforest green, hibiscus red, shell ivory, volcanic black, sunrise gold, orchid violet, coral rose, sea-glass blue, and pandanus tan";

const sceneSpecs = [
  {
    scene: 1280,
    theme: "doctor-clinical-command couture",
    landmark: "a broad dry covered public lookout beside the complete Matanikau cascade on Guadalcanal during cinematic light rain, with tiered rainforest falls, a clear river pool, Guadalcanal's green mountain ridges, a distant glimpse of Honiara roofs and Point Cruz harbor, and one clearly empty marked water route; rain falls beyond the roof and makes reflections only on distant stone",
    motifs: [
      "large complete Matanikau-cascade, Guadalcanal-ridge, Central-Market produce, Point-Cruz harbor, woven-basket, coconut, taro, sweet-potato, and yellow-bibbed-lory compositions across all four outfits",
      "at least two separate outfits each carry one complete full-width secular Solomon Islands waterfall-and-market composition rather than tiny trim",
    ],
    culture: "Use Guadalcanal cascades, mountain rainforest, Honiara market produce, harbor boats, woven baskets, coconut, taro, sweet potato, and endemic birds respectfully. Doctor-clinical-command couture remains abstract public fashion with no patient, diagnosis, procedure, copied uniform, badge, injury, or sexualized care. " + commonProhibitions,
    expected: {
      weather: "cinematic light rain with reflections", paws: false, pole: false, rainbowOnly: false,
      rainbowHosiery: false, wearer: "Radiance", palette: "country-palette rainbow-like gradient",
      cuts: {
        Radiance: [true, false, true], Ellie: [true, true, false],
        Alia: [false, true, true], "AI ECE": [false, false, false],
      },
    },
    emotionNuance: {
      Radiance: "calm contentment shown by a steady reassuring smile while she keeps the group balanced",
      Ellie: "tender affection shown by a warm cheek-close social greeting toward Radiance",
      Alia: "anger shown by a firm brow while every ribbon and waist contact remains gentle",
      "AI ECE": "magnetic confidence shown by a direct strategist gaze beside Radiance",
    },
    romance: "Translate the shared-ribbon pull, Radiance's calming center, ECE's close lean, Radiance's face cradle, Alia's waist embrace, Ellie's opposite-cheek greeting, and ECE's fingertip link into a shallow moving arc. ECE and Radiance link one hand pair. Radiance cradles Alia's cheek. Alia answers at Radiance's waist and holds one ribbon end. Ellie holds the opposite ribbon end, touches Radiance's far shoulder, and leans cheek-close for a brief public greeting. All contacts stay visible and consensual.",
    composition: "Place ECE far left, Radiance left-center, Alia right-center, and Ellie far right in four separated depth lanes. Keep bright waterfall, river, or sky gaps behind every arm. Angle Radiance and Alia three-quarter-back with hair moved forward so both complete rolled open backs and complete faces remain visible. Keep rain outside the shelter and the full floor dry.",
    outfits: {
      Radiance: "a rainforest-green short-sleeve cropped doctor-command jacket exposing her ordinary waist and belly button, with secure opaque sides and a completely open back from shoulder blades to the separate waistline, a coral-rose above-knee skirt carrying a large complete Matanikau cascade and Guadalcanal-ridge composition, with sunrise-gold pumps",
      Ellie: "a fully strapless sea-glass-blue cropped doctor-command bodice with a high straight opaque bustline exposing her ordinary waist and belly button and a high closed back, a separate shell-ivory above-knee folded skort carrying a large complete Central-Market produce and woven-basket composition, with hibiscus-red slingback heels",
      Alia: "a fully strapless hibiscus-red above-knee doctor-command dress with a high straight opaque bustline, covered waist, secure opaque sides, and a completely open back from shoulder blades to the secure waistline, carrying a large complete Point-Cruz harbor, coconut, and yellow-bibbed-lory composition, with volcanic-black platform heels",
      "AI ECE": "a shell-ivory high-neck cap-sleeve doctor-command coat-dress with covered waist and high closed back, carrying a large complete taro, sweet-potato, market-roof, and river-route composition, with lagoon-turquoise heeled boots",
    },
    hands: [
      "ECE right open hand supports the opaque inspection paddle and inert prop from beneath; ECE left hand links visibly with Radiance's left hand",
      "Radiance left hand links visibly with ECE's left hand; Radiance right hand rests visibly at Alia's near cheek",
      "Alia left hand rests visibly at Radiance's near waist; Alia right open hand holds one end of the loose market-blue signal ribbon",
      "Ellie left open hand holds the opposite end of the loose signal ribbon; Ellie right hand rests visibly on Radiance's far shoulder",
    ],
    propHandler: "AI ECE",
    propTarget: "left across clearly empty Matanikau river-pool water toward one unoccupied route marker",
  },
  {
    scene: 1281,
    theme: "doctor-clinical-command couture",
    landmark: "a broad dry covered marine-observation terrace above the complete Marovo Lagoon during an active lightning storm with distant bolts, with the double barrier lagoon, chains of raised reef islands, turquoise channels, mangrove fringe, seagrass shallows, Vangunu and Gatokae rainforest slopes, and one clearly empty marked water route; every bolt remains far beyond the lagoon",
    motifs: [
      "large complete Marovo double-barrier, raised-reef-island, mangrove, seagrass, giant-clam, coral-fish, white-eye-bird, and Vangunu-rainforest compositions across all four outfits",
      "at least two separate outfits each carry one complete full-width secular Solomon Islands lagoon-and-biodiversity composition",
    ],
    culture: "Use Marovo's double barrier lagoon, coral reefs, mangroves, seagrass, rainforest, fish diversity, giant clams, and endemic white-eye birds respectfully. Doctor-clinical-command couture remains abstract public fashion with no patient, diagnosis, procedure, copied uniform, badge, injury, or sexualized care. " + commonProhibitions,
    expected: {
      weather: "active lightning storm with distant bolts", paws: false, pole: false, rainbowOnly: false,
      rainbowHosiery: false, wearer: "Radiance", palette: "country-palette rainbow-like gradient",
      cuts: {
        Radiance: [false, false, false], Ellie: [true, true, false],
        Alia: [false, false, false], "AI ECE": [false, true, false],
      },
    },
    emotionNuance: {
      Radiance: "visible jealousy shown by one controlled side glance toward ECE during the completed turn",
      Ellie: "determination shown by a steady protective stance and focused eyes",
      Alia: "overwhelming relief shown by released shoulders and a bright grateful smile",
      "AI ECE": "guilt and remorse shown by lowered tear-bright eyes while steadying Radiance",
    },
    romance: "Translate Alia's completed linked-hand turn with Radiance, ECE's steadying waist touch, Ellie's beaconward reach, Ellie's face-to-face embrace, Radiance's brief public cheek greeting toward ECE, and Alia's relieved watch into one open spiral. ECE steadies Radiance at the waist. Radiance answers at ECE's shoulder and links her other hand with Alia at shoulder height. Alia completes the turn and touches Radiance's far shoulder. Ellie maintains two visible protective contacts at Radiance's forearm and near shoulder while facing the hands-free beacon.",
    composition: "Place ECE far left, Radiance left-center, Ellie right-center half a step forward, and Alia far right. Keep lagoon or storm-lit sky gaps behind every arm, and keep all distant bolts well beyond the people and route marker. The group remains upright under the dry roof.",
    outfits: {
      Radiance: "a lagoon-turquoise short-sleeve doctor-command above-knee sheath with covered waist and high closed back, carrying a large complete Marovo double-barrier and raised-reef-island composition, with hibiscus-red pumps",
      Ellie: "a fully strapless sunrise-gold cropped doctor-command bodice with a high straight opaque bustline exposing her ordinary waist and belly button and a high closed back, a separate rainforest-green above-knee architectural skort carrying a large complete mangrove and seagrass composition, with sea-glass-blue slingbacks",
      Alia: "an orchid-violet one-shoulder doctor-command above-knee romper with covered waist and high closed back, carrying a large complete giant-clam, coral-fish, and white-eye-bird composition, with volcanic-black platform heels",
      "AI ECE": "a fully strapless shell-ivory doctor-command above-knee dress with a high straight opaque bustline, covered waist, and high closed back, carrying a large complete Vangunu-rainforest, Gatokae-slope, and lagoon-route composition, with coral-rose heeled boots",
    },
    hands: [
      "ECE right open hand supports the opaque inspection paddle and inert prop from beneath; ECE left hand rests visibly at Radiance's near waist",
      "Radiance left hand rests visibly on ECE's near shoulder; Radiance right hand links visibly with Alia's left hand at shoulder height",
      "Alia left hand links visibly with Radiance's right hand; Alia right hand rests visibly on Radiance's far shoulder",
      "Ellie left hand rests visibly on Radiance's near forearm; Ellie right hand rests visibly on Radiance's near shoulder",
    ],
    propHandler: "AI ECE",
    propTarget: "left across clearly empty Marovo Lagoon water toward one unoccupied marine route buoy",
  },
  {
    scene: 1282,
    theme: "adult nightlife dance-performance couture",
    landmark: "a broad dry covered conservation boardwalk on uninhabited Tetepare Island during crisp blue hour, with the complete lowland primary rainforest, rugged volcanic-and-reef shoreline, fringing coral, empty leatherback nesting beach, distant ranger observation hut, and one clearly empty marked marine route; no wildlife is approached or disturbed",
    motifs: [
      "large complete Tetepare-rainforest, leatherback, hawksbill, green-turtle, dugong, flying-fox, prehensile-tailed-skink, coral-reef, and ranger-monitoring compositions across all four women's outfits",
      "at least two separate outfits each carry one complete full-width secular Solomon Islands Tetepare conservation composition",
    ],
    culture: "Use Tetepare lowland rainforest, reef limestone, volcanic shoreline, marine turtles, dugong, flying fox, endemic skink, and community conservation monitoring respectfully. Adult nightlife dance-performance couture is used only as fully clothed public after-show fashion with no stripping, explicit dance, nightclub, alcohol, pole, or sexual performance. " + commonProhibitions,
    expected: {
      weather: "crisp blue hour", paws: true, pole: false, rainbowOnly: false,
      rainbowHosiery: false, wearer: "AI ECE", palette: "original independent rainbow gradient",
      cuts: {
        Radiance: [false, true, false], Ellie: [false, false, false],
        Alia: [false, false, false], "AI ECE": [false, true, false],
      },
    },
    emotionNuance: {
      Radiance: "extreme happiness and radiant laughing delight shown by open laughter toward ECE",
      Ellie: "overwhelming relief shown by softened eyes while keeping ECE steady",
      Alia: "contained resentment shown by a tight restrained smile during Radiance's embrace",
      "AI ECE": "playful mischief shown by a knowing grin while her gaze answers Radiance",
      Male: "suspicion shown by narrowed eyes and a guarded jaw while his head and pupils remain most strongly fixed on ECE",
    },
    romance: "Translate the walking weave, one linked-hand pair, one protective touch, one cheek-close pass, one jealous look, Alia and Radiance's shoulder embrace, Radiance's blown greeting toward ECE, and Ellie's cheek touch into a wide five-adult arc. ECE touches Ellie's shoulder while Ellie touches ECE's cheek and links her other hand with Radiance. Radiance links Ellie and rests her free hand on Alia's shoulder. Alia answers at Radiance's waist and touches the male's shoulder. The male keeps two visible contacts with Alia while looking most strongly across the group to ECE.",
    composition: "Place ECE far left with the prop isolated over empty sea, Ellie left-center, Radiance center, Alia right-center, and the male far right. Keep ocean, pale sky, or empty beach gaps behind all ten arms. PAWS perches on Ellie's far fabric-covered shoulder, far from the prop and boardwalk edge. Everyone remains upright and moving gently along the dry boardwalk.",
    outfits: {
      Radiance: "a fully strapless hibiscus-red public after-show above-knee dress with a high straight opaque bustline, covered waist, and high closed back, carrying a large complete Tetepare rainforest and leatherback composition, with sunrise-gold pumps",
      Ellie: "a sea-glass-blue cap-sleeve public after-show above-knee tailored romper with covered waist and high closed back, carrying a large complete hawksbill, green-turtle, and coral-reef composition, with rainforest-green slingback heels",
      Alia: "a sunrise-gold one-shoulder public after-show above-knee dress with covered waist and high closed back, carrying a large complete dugong, flying-fox, and ranger-monitoring composition, with volcanic-black platform heels",
      "AI ECE": "a fully strapless lagoon-turquoise public after-show above-knee dress with a high straight opaque bustline, covered waist, and high closed back, carrying a large complete prehensile-tailed-skink, reef-limestone, and marine-route composition, with orchid-violet heeled boots",
      Male: "the established adult male face from Scene 1136 with closely trimmed beard and athletic muscular build, wearing an opaque fitted shell-ivory short-sleeve top with a restrained Tetepare forest-and-reef contour, fitted black jeans, and practical black boots",
    },
    hands: [
      "ECE right open hand supports the opaque inspection paddle and inert prop from beneath; ECE left hand rests visibly on Ellie's near shoulder",
      "Ellie right hand rests visibly at ECE's near cheek; Ellie left hand links visibly with Radiance's right hand",
      "Radiance right hand links visibly with Ellie's left hand; Radiance left hand rests visibly on Alia's near shoulder",
      "Alia left hand rests visibly at Radiance's near waist; Alia right hand rests visibly on the male's near shoulder",
      "the male left hand rests visibly at Alia's near waist; the male right hand rests visibly on Alia's near forearm",
    ],
    propHandler: "AI ECE",
    propTarget: "left across clearly empty Tetepare coastal water toward one unoccupied conservation-route marker",
    paws: "One tiny collarless golden kitten, PAWS, perches securely on Ellie's far cap-sleeve shoulder with all four paws on opaque fabric and bats a loose sea-glass route ribbon fixed to Ellie's sleeve. No adult hand is reassigned. PAWS stays far from the prop, wildlife, water, and edge.",
  },
  {
    scene: 1283,
    theme: "adult nightlife dance-performance couture",
    landmark: "a broad dry covered karst observatory beside the complete Lake Tegano in East Rennell during a hailstorm with suspended ice and hard backlight, with the brackish former lagoon, rugged limestone islets, raised coral-atoll rim, dense indigenous forest canopy, distant empty marine horizon, and one clearly empty marked water route; hail remains beyond the roof and falls into the unoccupied lake",
    motifs: [
      "large complete Lake-Tegano, limestone-islet, raised-coral-atoll, forest-canopy, endemic-bird, diatom, land-snail, coconut, and lake-monitoring compositions across all four outfits",
      "at least two separate outfits each carry one complete full-width secular Solomon Islands East-Rennell ecology composition",
    ],
    culture: "Use East Rennell's raised coral-atoll geology, Lake Tegano, limestone islets, dense forest, endemic birds, diatoms, land snails, coconut, and community conservation monitoring respectfully. Adult nightlife dance-performance couture is used only as fully clothed public after-show fashion with no stripping, explicit dance, nightclub, alcohol, pole, or sexual performance. " + commonProhibitions,
    expected: {
      weather: "hailstorm with suspended ice and hard backlight", paws: false, pole: false, rainbowOnly: false,
      rainbowHosiery: false, wearer: "Radiance", palette: "original independent rainbow gradient",
      cuts: {
        Radiance: [false, false, false], Ellie: [false, false, true],
        Alia: [false, false, false], "AI ECE": [false, true, true],
      },
    },
    emotionNuance: {
      Radiance: "crying with visible tears shown by two clear tears while giving Alia a brief reassuring cheek greeting",
      Ellie: "magnetic confidence shown by a warm command smile and steady shoulder contact",
      Alia: "determination shown by a firm focused gaze while the embrace remains gentle",
      "AI ECE": "magnetic confidence performed differently through cool strategist poise and a lifted chin while linking Radiance",
    },
    romance: "Translate Radiance's quick cheek greeting toward Alia, Ellie's shoulder press, ECE's fingertip link, Alia and ECE's face-to-face embrace, and Ellie's theatrical jealous look into a shallow crescent. ECE and Radiance link one hand pair. Radiance touches Alia's cheek. Alia answers at Radiance's waist and touches ECE's near shoulder. Ellie touches Radiance's shoulder and Alia's forearm while looking across to ECE. All contacts are public, gentle, visible, and consensual.",
    composition: "Place ECE far left, Radiance left-center, Alia right-center, and Ellie far right. Keep backlit lake, pale hail, or forest gaps behind every arm. Angle Ellie and ECE three-quarter-back with all hair moved forward so both complete rolled open backs and complete faces remain visible. Keep every person under the dry roof while hail remains outside.",
    outfits: {
      Radiance: "a hibiscus-red short-sleeve public after-show above-knee sheath with covered waist and high closed back, carrying a large complete Lake-Tegano and limestone-islet composition, with sunrise-gold pumps",
      Ellie: "a rainforest-green halter public after-show above-knee dress with covered waist, secure opaque sides, and a completely open back from shoulder blades to the secure waistline, carrying a large complete raised-coral-atoll and forest-canopy composition, with coral-rose slingback heels",
      Alia: "a sunrise-gold one-shoulder public after-show above-knee tailored romper with covered waist and high closed back, carrying a large complete endemic-bird, diatom, and land-snail composition, with volcanic-black platform heels",
      "AI ECE": "a fully strapless sea-glass-blue public after-show above-knee dress with a high straight opaque bustline, covered waist, secure opaque sides, and a completely open back from shoulder blades to the secure waistline, carrying a large complete coconut, lake-monitoring, and empty-route composition, with shell-ivory heeled boots",
    },
    hands: [
      "ECE right open hand supports the opaque inspection paddle and inert prop from beneath; ECE left hand links visibly with Radiance's left hand",
      "Radiance left hand links visibly with ECE's left hand; Radiance right hand rests visibly at Alia's near cheek",
      "Alia left hand rests visibly at Radiance's near waist; Alia right hand rests visibly on ECE's near shoulder",
      "Ellie left hand rests visibly on Radiance's far shoulder; Ellie right hand rests visibly on Alia's near forearm",
    ],
    propHandler: "AI ECE",
    propTarget: "left across clearly empty Lake Tegano water toward one unoccupied lake-monitoring route marker",
  },
];

const maleKey = `batch${batch}-${countrySlug}-male-model-scene`;
const maleHash = fnv1a(maleKey);
primaryPairs.push([maleKey, maleHash % 100]);
const maleScenePosition = (maleHash % 4) + 1;
const maleScene = firstScene + maleScenePosition - 1;
const maleEmotionKey = `batch${batch}-${countrySlug}-scene${maleScenePosition}-male-emotion`;
const maleEmotionRoll = roll(maleEmotionKey);
primaryPairs.push([maleEmotionKey, maleEmotionRoll]);
const maleEmotionResult = fromDistribution(maleEmotionRoll, contract.emotionRolls.distribution, "emotion");
if (maleScene !== 1282) throw new Error(`Male scene drifted to ${maleScene}`);

const scenePlans = {};
for (const spec of sceneSpecs) {
  const prefix = `batch${batch}-${countrySlug}-scene${spec.scene}`;
  const weather = primary(`${prefix}-weather`);
  weather.result = fromDistribution(weather.roll, contract.weatherRolls.distribution, "weather");
  const paws = primary(`${prefix}-paws`); paws.active = paws.roll <= 24;
  const poleDanceTheme = primary(`${prefix}-poleDanceTheme`); poleDanceTheme.active = poleDanceTheme.roll <= 5;
  const rainbowOnly = primary(`${prefix}-rainbowOnly`); rainbowOnly.active = rainbowOnly.roll <= 3;
  const rainbowHosiery = primary(`${prefix}-rainbowHosiery`); rainbowHosiery.active = rainbowHosiery.roll <= 24;
  rainbowHosiery.wearer = selector(`${prefix}-rainbowHosieryWearer`, roll(`${prefix}-rainbowHosieryWearer`) <= 49 ? "Radiance" : "AI ECE");
  rainbowHosiery.palette = selector(`${prefix}-rainbowHosieryPaletteMode`, roll(`${prefix}-rainbowHosieryPaletteMode`) <= 49 ? "country-palette rainbow-like gradient" : "original independent rainbow gradient");
  const romanceBeat = primary(`${prefix}-romanceBeat`);
  romanceBeat.dynamicIndex = romanceBeat.roll % contract.romance.dynamicBeatRolls.length;
  romanceBeat.contractResult = contract.romance.dynamicBeatRolls[romanceBeat.dynamicIndex];
  const compoundLoveBeat = primary(`${prefix}-compoundLoveBeat`);
  compoundLoveBeat.index = compoundLoveBeat.roll % contract.romance.compoundLoveBeatRolls.length;
  compoundLoveBeat.contractResult = contract.romance.compoundLoveBeatRolls[compoundLoveBeat.index];

  const characterPlans = {};
  for (const character of characters) {
    const emotion = primary(`${prefix}-${character}-emotion`);
    emotion.result = fromDistribution(emotion.roll, contract.emotionRolls.distribution, "emotion");
    emotion.performance = spec.emotionNuance[character];
    const visibleMidriff = primary(`${prefix}-${character}-visibleMidriff`); visibleMidriff.active = visibleMidriff.roll <= 49;
    const straplessDress = primary(`${prefix}-${character}-straplessDress`); straplessDress.active = straplessDress.roll <= 34;
    const fullyOpenBack = primary(`${prefix}-${character}-fullyOpenBack`); fullyOpenBack.active = fullyOpenBack.roll <= 29;
    characterPlans[character] = { emotion, visibleMidriff, straplessDress, fullyOpenBack };
    const actualCuts = [visibleMidriff.active, straplessDress.active, fullyOpenBack.active];
    if (JSON.stringify(actualCuts) !== JSON.stringify(spec.expected.cuts[character])) throw new Error(`${spec.scene} ${character} cut drift`);
  }

  for (const [actual, expected, label] of [
    [weather.result, spec.expected.weather, "weather"], [paws.active, spec.expected.paws, "PAWS"],
    [poleDanceTheme.active, spec.expected.pole, "pole"], [rainbowOnly.active, spec.expected.rainbowOnly, "rainbow-only"],
    [rainbowHosiery.active, spec.expected.rainbowHosiery, "rainbow hosiery"], [rainbowHosiery.wearer.result, spec.expected.wearer, "wearer"],
    [rainbowHosiery.palette.result, spec.expected.palette, "palette"],
  ]) if (actual !== expected) throw new Error(`${spec.scene} ${label} drifted: ${actual}`);

  const hasMale = spec.scene === maleScene;
  const referenceLine = hasMale
    ? "Images 1 through 4 anchor the adult quartet and ECE; Image 5 anchors the established adult male. References control identity only."
    : "Images 1 through 4 anchor the adult quartet and ECE. References control identity only.";
  const castLine = hasMale
    ? "Show exactly five clearly adult fictional people: Radiance, Ellie, Alia, AI ECE, and the established adult male. Add him without replacing a woman."
    : "Show exactly four clearly adult fictional women: Radiance, Ellie, Alia, and AI ECE.";
  const emotionLine = characters.map((character) => `${character}: roll ${characterPlans[character].emotion.roll}, ${characterPlans[character].emotion.result}, performed as ${spec.emotionNuance[character]}`).join("; ");
  const outfitLine = Object.entries(spec.outfits).map(([name, value]) => `${name}: ${value}`).join("; ");
  const cutLine = characters.map((character) => `${character}: midriff ${characterPlans[character].visibleMidriff.roll}=${characterPlans[character].visibleMidriff.active ? "visible" : "covered"}, strapless ${characterPlans[character].straplessDress.roll}=${characterPlans[character].straplessDress.active ? "active" : "inactive"}, open back ${characterPlans[character].fullyOpenBack.roll}=${characterPlans[character].fullyOpenBack.active ? "active" : "inactive"}`).join("; ");
  const anatomyLine = hasMale ? "Exactly five adults, ten arms, and ten hands, two per adult." : "Exactly four adults, eight arms, and eight hands, two per woman.";
  const triggerLine = `Stored scene rolls: weather ${weather.roll}=${weather.result}; PAWS ${paws.roll}=${paws.active ? "active" : "inactive"}; pole theme ${poleDanceTheme.roll}=${poleDanceTheme.active ? "active" : "inactive"}; rainbow-only ${rainbowOnly.roll}=${rainbowOnly.active ? "active" : "inactive"}; rainbow hosiery ${rainbowHosiery.roll}=${rainbowHosiery.active ? "active" : "inactive"}; hosiery wearer selector ${rainbowHosiery.wearer.roll}=${rainbowHosiery.wearer.result}; hosiery palette selector ${rainbowHosiery.palette.roll}=${rainbowHosiery.palette.result}; romance ${romanceBeat.roll}; compound love ${compoundLoveBeat.roll}.`;
  const propLine = `${spec.propHandler} alone presents one photorealistic full-size polished rainbow-gradient Desert Eagle-style inert cinema prop on a thin flat opaque charcoal inspection paddle. The prop rests entirely on top in clean side profile; no hand touches the grip, trigger, or guard. Magazine absent, empty magazine well and complete empty trigger guard visible. The horizontal muzzle points ${spec.propTarget}, away from every person, kitten, landmark, animal, and camera. This is a controlled unloaded handoff demonstration.`;
  const hosieryLine = rainbowHosiery.active
    ? `Rainbow hosiery is active on exactly ${rainbowHosiery.wearer.result} in ${rainbowHosiery.palette.result}; nobody else wears it. Radiance and ECE are the affectionate center, Alia alone handles the prop, and ECE keeps the separate hands-free route map.`
    : "Rainbow hosiery is inactive. Nobody wears stockings or knee socks. ECE alone handles the prop and keeps a separate hands-free holographic route map.";
  const rainbowOnlyLine = rainbowOnly.active
    ? "Rainbow-only is active. All outfits use varied public-safe rainbow palettes while preserving the large Solomon Islands motifs."
    : "Rainbow-only is inactive. Do not convert the wardrobe to rainbow-only styling.";
  const poleLine = poleDanceTheme.active
    ? "Pole theme is active only as a stationary public-safe fashion motif with no dance or suggestive performance."
    : "Pole theme is inactive. No pole.";

  const renderPrompt = [
    "Use case: photorealistic-natural. Asset type: fresh vertical World Series public-fashion scene.", referenceLine,
    `Create one photorealistic 9:16 full-length editorial at ${spec.landmark}.`, castLine,
    "Every person is a fictional adult visibly over age 28. Preserve the anchored faces, skin tones, and distinct identities: blonde Radiance, dark-haired Ellie, Black Alia with the only high sculptural braided ponytail, brunette AI ECE, and the Scene 1136 bearded male when present. No cloning, replacement, merging, or age shift.",
    `Profession theme: ${spec.theme}, used only as original public-safe fictional fashion. No copied uniform, badge, patient, treatment, diagnosis, procedure, police impersonation, arrest, raid, threat, injury, combat, or sexualized care.`,
    triggerLine, `Exact wardrobe rolls: ${cutLine}.`,
    `Use four unmistakably different secure opaque lined above-knee silhouettes. Exact outfits: ${outfitLine}. Materialize every rolled midriff, strapless cut, and open back exactly.`,
    `Large complete secular Solomon Islands motifs dominate at least two outfits: ${spec.motifs.join("; ")}. ${spec.culture}`,
    `Distinct emotions: ${emotionLine}${hasMale ? `; Male: roll ${maleEmotionRoll}, ${maleEmotionResult}, performed as ${spec.emotionNuance.Male}` : ""}. Duplicate labels must have visibly different performances.`,
    `Selected romance roll ${romanceBeat.roll}: ${romanceBeat.contractResult} Selected compound roll ${compoundLoveBeat.roll}: ${compoundLoveBeat.contractResult}`,
    `Materialize both through this exact consensual public choreography: ${spec.romance}`, spec.composition,
    `Exact hands, no others: ${spec.hands.join("; ")}.`, propLine, hosieryLine,
    paws.active ? spec.paws : "PAWS is inactive. No kitten.", poleLine, rainbowOnlyLine,
    `Render ${weather.result} cinematically while keeping dry stable nonslip footing.`, anatomyLine,
    "Every arm is continuously visible from its own shoulder through elbow and wrist to one separated hand. No arm passes behind a torso. Show every face, elbow, wrist, hand, finger cluster, leg, foot, heel, and boot. Reject every extra, missing, duplicated, fused, floating, borrowed, hidden-owner, cropped, or ambiguous limb or finger cluster.",
    "Keep the inert prop fully separated from hands by the solid paddle. No ammunition, reload, firing, muzzle flash, holster, threat, combat, injury, aiming at a person, or aiming at the camera. Asymmetric moving composition, not a static lineup. Fully clothed public-safe editorial, no text or watermark.",
  ].join(" ");

  scenePlans[String(spec.scene)] = {
    scene: spec.scene, theme: spec.theme, landmark: spec.landmark, motifs: spec.motifs, culture: spec.culture,
    weather, paws, poleDanceTheme, rainbowOnly, rainbowHosiery, romanceBeat, compoundLoveBeat,
    characters: characterPlans, materializedRomance: spec.romance, composition: spec.composition,
    emotionNuance: spec.emotionNuance, outfits: spec.outfits, propPlan: propLine, handInventory: spec.hands,
    pawsPlan: paws.active ? spec.paws : null, polePlan: poleDanceTheme.active ? poleLine : null,
    maleModel: hasMale ? {
      present: true,
      emotion: { key: maleEmotionKey, roll: maleEmotionRoll, result: maleEmotionResult, performance: spec.emotionNuance.Male },
      identity: "established adult male from Scene 1136",
      relationship: "married to ECE; fully clothed consensual adult infidelity drama with Alia and Ellie; at least two clear male contacts; strongest sustained eye line remains on ECE",
    } : { present: false },
    renderPrompt,
  };
}

const xPublishingRolls = {};
for (const [name, suffix] of [["heart", "x-heart"], ["internalAgency", "x-internalagency"], ["worldXXXSeries", "x-worldxxxseries"]]) {
  const item = primary(`batch${batch}-${countrySlug}-${suffix}`);
  if (name === "heart") item.result = item.roll <= 82 ? "red heart" : "white heart";
  else item.active = item.roll <= 24;
  xPublishingRolls[name] = item;
}

if (primaryPairs.length !== 97) throw new Error(`Expected 97 primary roll pairs, found ${primaryPairs.length}`);
if (selectorPairs.length !== 8) throw new Error(`Expected 8 selector pairs, found ${selectorPairs.length}`);

const preflight = {
  batch, country, status: "render-preflight-stored", sourceCommit,
  contractSha256: sha256(contractBytes),
  rollMethod: "FNV-1a over the recorded batch315-solomon-islands keys, reduced modulo 100. Male scene selection uses the full 32-bit hash reduced modulo 4.",
  rollThresholds: {
    visibleMidriff: "0-49", straplessDress: "0-34", fullyOpenBack: "0-29", paws: "0-24",
    poleDanceTheme: "0-5", rainbowOnly: "0-3", rainbowHosiery: "0-24",
    rainbowHosieryWearer: "0-49 Radiance; 50-99 AI ECE",
    rainbowHosieryPaletteMode: "0-49 country-palette rainbow-like gradient; 50-99 original independent rainbow gradient",
  },
  themePair: ["doctor-clinical-command couture", "adult nightlife dance-performance couture"],
  nextThemePair: ["adult nightlife dance-performance couture", "Paris runway model couture"],
  nextQueueCountry: "Bhutan", nextQueueBatch: 316, nextQueueScenes: [1284, 1285, 1286, 1287],
  researchSources: [
    { url: "https://www.visitsolomons.com.sb/about-the-solomon/provinces/", usedFor: "Guadalcanal mountains, Matanikau cascade, Honiara Central Market, Point Cruz, Marau Sound, Marovo Lagoon, Western Province islands, and Lake Tegano" },
    { url: "https://www.visitsolomons.com.sb/about-the-solomon/people-culture/", usedFor: "Honiara Central Market produce and crafts, coconut, sweet potato, taro, fishing, stilt houses, and modern urban context" },
    { url: "https://whc.unesco.org/en/tentativelists/5414", usedFor: "Marovo double barrier lagoon, Tetepare lowland rainforest, coral reefs, mangroves, seagrass, endemic wildlife, marine turtles, dugong, and community conservation" },
    { url: "https://whc.unesco.org/en/list/854/", usedFor: "East Rennell raised coral atoll, Lake Tegano, limestone islets, dense forest, endemic species, and customary community management" },
    { url: "https://whc.unesco.org/en/news/2443", usedFor: "Lake Tegano World Heritage Site Association and community-led nature-based conservation livelihoods" },
  ],
  faceAnchors: {
    primaryQuartet: "937-central-african-republic-dzanga-sangha-rainbow-clinic-signal-cipher.png",
    frontalSupplement: "938-central-african-republic-boali-falls-rainbow-star-map-relay.png",
    expressionSupplement: "936-central-african-republic-bangui-oubangui-rainbow-route-grid.png",
    eceDetail: "ece-canonical-identity-v1.png",
    male: "1136-italy-rome-lenticular-care-male-colosseum-route.png",
  },
  maleModelSelection: {
    key: maleKey, fullHash: maleHash, roll: maleHash % 100,
    selectedScenePosition: maleScenePosition, selectedScene: maleScene,
    maleEmotion: { key: maleEmotionKey, roll: maleEmotionRoll, result: maleEmotionResult },
  },
  countryMotifPolicy: {
    flagMotifDecision: "No literal Solomon Islands flag, five-star field, coat of arms, or official emblem is copied onto clothing. Large researched secular waterfall, market, harbor, lagoon, reef, rainforest, lake, raised-atoll, wildlife, food, craft, and conservation fields replace them.",
    palette,
    minimumCoverage: "Every scene places multiple large complete secular Solomon Islands motifs across at least two outfits as full bodice, skirt, hip, or panel fields rather than tiny trim.",
    cultureScene: "The four scenes foreground Guadalcanal cascades and Honiara market life, Marovo Lagoon biodiversity, Tetepare conservation, and East Rennell/Lake Tegano ecology.",
    prohibitions: "No literal flag, five-star field, coat of arms, official seal, sacred symbol, religious architecture, copied ceremonial dress, copied medical, command, or performance uniform, badge, weapon threat, sexualized care or performance, alcohol, or branded product.",
  },
  xPublishingRolls,
  xPublishingPlan: {
    minimumCurrentCountryAcceptedAssets: 2,
    attachmentShape: "two Solomon Islands images plus one accepted Bhutan image when at least two Solomon Islands images pass",
    captionIfEligible: "Solomon Islands white heart Bhutan #SolomonIslands",
    internalAgencyHashtagActive: false,
    worldXXXSeriesHashtagActive: false,
  },
  anatomyGate: {
    fourPersonScenes: "Scenes 1280, 1281, and 1283 require exactly eight arms and eight hands, two per woman, with every limb continuously traceable to one owner.",
    fivePersonScene: "Scene 1282 requires exactly ten arms and ten hands, two per adult, with the male added without replacing any woman.",
    rejectionRule: "Reject every extra, missing, duplicated, floating, fused, borrowed, emerging, ownerless, cropped, hidden-owner, or ambiguous limb, hand, or finger cluster.",
  },
  rollAudit: {
    primaryRollPairs: primaryPairs, hosierySelectorPairs: selectorPairs,
    primaryPairCount: primaryPairs.length, hosierySelectorPairCount: selectorPairs.length,
    mismatchCount: 0, primaryPairsSha256: sha256(JSON.stringify(primaryPairs)),
    hosierySelectorPairsSha256: sha256(JSON.stringify(selectorPairs)),
  },
  scenePlans,
  renderAttempts: {
    raw: { status: "pending", requested: 4, concurrency: "four independent built-in image generation calls launched together with all-settled result handling" },
    recovery: { status: "not-started", maximumPerBlockedScene: 1 },
  },
  acceptedAssets: [], rejectedAssets: [],
  xPost: { status: "pending-asset-audit", minimumCurrentCountryAcceptedAssets: 2 },
};

fs.mkdirSync(root, { recursive: true });
for (const [scene, plan] of Object.entries(scenePlans)) fs.writeFileSync(path.join(root, `scene-${scene}-prompt.txt`), `${plan.renderPrompt}\n`, "utf8");
fs.writeFileSync(path.join(root, "batch-315-solomon-islands-preflight.json"), `${JSON.stringify(preflight, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  preflight: path.join(root, "batch-315-solomon-islands-preflight.json"),
  contractSha256: preflight.contractSha256, maleScene,
  scenes: Object.fromEntries(Object.entries(scenePlans).map(([scene, plan]) => [scene, {
    theme: plan.theme, weather: plan.weather, paws: plan.paws, poleDanceTheme: plan.poleDanceTheme,
    rainbowOnly: plan.rainbowOnly, rainbowHosiery: plan.rainbowHosiery,
    cuts: Object.fromEntries(Object.entries(plan.characters).map(([name, value]) => [name, {
      midriff: value.visibleMidriff.active, strapless: value.straplessDress.active, openBack: value.fullyOpenBack.active,
    }])),
    emotions: Object.fromEntries(Object.entries(plan.characters).map(([name, value]) => [name, value.emotion.result])),
  }])),
  xPublishingRolls, rollAudit: preflight.rollAudit,
}, null, 2));
