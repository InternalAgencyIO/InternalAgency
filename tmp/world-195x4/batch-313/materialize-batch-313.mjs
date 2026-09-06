import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const batch = 313;
const country = "Comoros";
const countrySlug = "comoros";
const firstScene = 1272;
const root = path.resolve("tmp/world-195x4/batch-313");
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

const commonProhibitions = "The Comoros flag includes a crescent and stars, so no literal flag, crescent, star, coat of arms, or official emblem appears. No sacred symbol, religious building, copied ceremonial dress, copied uniform, badge, readable text, brand, alcohol, or political insignia.";
const palette = "lagoon blue, reef green, pearl white, clove red, ylang yellow, vanilla gold, volcanic charcoal, orchid violet, coral orange, and deep ocean blue";

const sceneSpecs = [
  {
    scene: 1272,
    theme: "undercover investigator couture",
    landmark: "a broad dry conservation terrace beside the restored Ujumbe Palace in Mutsamudu on Anjouan under soft dramatic overcast, with the complete carved wooden entrance, painted ceiling geometry, architectural niches, narrow stone-house lanes, deep-water harbor, green Hombo hillside, and anchored lateen-sail boats clearly visible; exclude every religious building",
    motifs: [
      "large complete Ujumbe carved-door, painted-ceiling geometry, stone-lane, deep-water harbor, lateen-sail, ylang-ylang, vanilla-pod, clove, and coelacanth compositions across all four outfits",
      "at least two separate outfits each carry one complete full-width secular Comoros heritage-and-maritime composition rather than tiny trim",
    ],
    culture: `Use Ujumbe Palace craft, Mutsamudu stone houses, harbor exchange, lateen sails, ylang-ylang, vanilla, cloves, and coelacanth science as secular Comoros references. ${commonProhibitions}`,
    expected: {
      weather: "soft dramatic overcast", paws: true, pole: false, rainbowOnly: false,
      rainbowHosiery: false, wearer: "AI ECE", palette: "country-palette rainbow-like gradient",
      cuts: {
        Radiance: [false, true, false], Ellie: [true, true, false],
        Alia: [false, false, false], "AI ECE": [true, false, false],
      },
    },
    emotionNuance: {
      Radiance: "calm contentment shown by a serene protective smile during Alia's cheek-close relay",
      Ellie: "extreme happiness and radiant laughing delight shown by open laughter while staying securely balanced",
      Alia: "intense curiosity shown by focused bright eyes toward ECE's route display",
      "AI ECE": "calm contentment performed differently from Radiance through quiet strategic composure and a steady fingertip link",
    },
    romance: "Translate the selected cheek greeting, fingertip hold, face-to-face warmth, and jealous shoulder press into a clean adjacent chain. ECE and Radiance keep one linked-hand pair. Radiance turns cheek-close toward Alia while touching Alia's shoulder. Alia answers with a gentle waist touch and reaches toward laughing Ellie. Ellie closes the chain with a shoulder touch while angling her theatrical delighted gaze back toward Radiance and ECE. This preserves at least five visible consensual contacts without crossing arms or hiding owners.",
    composition: "Place ECE far left, Radiance left-center, Alia right-center, and Ellie far right in four separated lateral lanes. Keep harbor or pale overcast sky behind every arm. PAWS sits on Ellie's far shoulder, far from ECE's prop and the terrace edge. Show all complete faces, footwear, and both rolled visible midriffs.",
    outfits: {
      Radiance: "a fully strapless pearl-white investigator-fashion mini sheath with covered waist and high closed back, carrying a large complete Ujumbe carved-door and painted-ceiling composition, with clove-red pumps",
      Ellie: "a fully strapless ylang-yellow cropped investigator bodice exposing her ordinary waist and belly button with a high closed back, a separate deep-ocean folded mini skort carrying a large complete Mutsamudu harbor and lateen-sail composition, with reef-green slingback heels",
      Alia: "a coral-orange one-shoulder tailored investigator mini romper with covered waist and high closed back, carrying a large complete stone-lane, architectural-niche, and vanilla-pod composition, with volcanic-charcoal platform heels",
      "AI ECE": "a lagoon-blue cap-sleeve cropped strategist shell exposing her ordinary waist and belly button with a high closed back, a separate pearl-white radial mini skirt carrying a large complete blue coelacanth, ylang-ylang, and clove composition, with orchid-violet pumps",
    },
    hands: [
      "ECE right open hand supports the opaque inspection paddle and inert prop from beneath; ECE left hand links visibly with Radiance's right hand",
      "Radiance right hand links visibly with ECE's left hand; Radiance left hand rests visibly on Alia's near shoulder",
      "Alia left hand rests visibly at Radiance's near waist; Alia right hand rests visibly on Ellie's near shoulder",
      "Ellie left hand rests visibly at Alia's near waist; Ellie right open hand holds one loose lagoon-blue route ribbon beside her own shoulder",
    ],
    propHandler: "AI ECE",
    propTarget: "left across clearly empty Mutsamudu harbor water toward one unoccupied route buoy",
    paws: "One tiny collarless golden kitten, PAWS, perches securely on Ellie's far shoulder with all four paws on opaque fabric and bats the loose route ribbon. PAWS stays far from ECE, the prop, the harbor edge, and wet surfaces; no adult hand is reassigned to the kitten.",
  },
  {
    scene: 1273,
    theme: "undercover investigator couture",
    landmark: "a broad dry covered route deck above the Coelacanth National Park basalt coast on Grande Comore, with complete black volcanic cliffs, deep-blue Indian Ocean water, a scientific cutaway relief of the offshore submarine caves, a distant Chomoni black-sand curve, reef edge, and empty marked ocean route lane visible while a dramatic sandstorm wall of windblown volcanic beach sand moves across the unoccupied far coast",
    motifs: [
      "large complete black-basalt cliff, submarine-cave, blue coelacanth, black-sand beach, coral-reef, mangrove, seagrass, and Indian-Ocean swell compositions across all four outfits",
      "at least two separate outfits each carry one complete full-width secular Comoros geology-and-marine-science composition",
    ],
    culture: `Use Coelacanth National Park's basalt cliffs, submarine caves, coelacanth habitat, volcanic beach, reef, mangrove, and seagrass only as secular conservation and geology references. ${commonProhibitions}`,
    expected: {
      weather: "dramatic sandstorm wall", paws: false, pole: false, rainbowOnly: false,
      rainbowHosiery: false, wearer: "AI ECE", palette: "original independent rainbow gradient",
      cuts: {
        Radiance: [true, false, false], Ellie: [true, false, false],
        Alia: [false, false, false], "AI ECE": [true, true, false],
      },
    },
    emotionNuance: {
      Radiance: "hope shown by lifted brows and a steady reassuring smile toward Alia",
      Ellie: "anger shown by a controlled jaw and narrowed eyes while every touch remains gentle",
      Alia: "intense curiosity shown by alert attention to the offshore cave relief",
      "AI ECE": "magnetic confidence shown by a calm upright route-leader gaze through the distant sand wall",
    },
    romance: "Translate the selected backward beacon step, cheek-close pursuit, shoulder hook, route block, seated hug, and cheek greeting through one readable plinth tableau. Ellie sits on a low dry plinth and maintains two visible contacts with Radiance. Radiance steadies Ellie and turns cheek-close toward Alia. Alia answers with a waist touch while lifting one route ribbon to playfully block the path. ECE stays beside Ellie with one reassuring shoulder contact while the separate route map floats hands-free. All contact remains consensual, public-safe, and outside neighboring torso silhouettes.",
    composition: "Place ECE far left, Ellie seated left-center, Radiance standing center-right, and Alia far right. Keep a bright ocean, basalt, or storm lane behind every arm. The sandstorm remains distant and every person stands or sits on a dry stable covered deck. Show all complete footwear and three rolled visible midriffs.",
    outfits: {
      Radiance: "a clove-red cap-sleeve cropped investigator jacket exposing her ordinary waist and belly button with a high closed back, a pearl-white architectural mini skirt carrying a large complete basalt-cliff and submarine-cave composition, with lagoon-blue pumps",
      Ellie: "a reef-green sleeveless cropped investigator vest exposing her ordinary waist and belly button with a high closed back, a separate volcanic-charcoal pleated mini skort carrying a large complete black-sand beach and Indian-Ocean swell composition, with ylang-yellow heeled boots",
      Alia: "an orchid-violet one-shoulder investigator mini dress with covered waist and high closed back, carrying a large complete blue coelacanth, coral-reef, and deep-cave composition, with coral-orange platform heels",
      "AI ECE": "a fully strapless lagoon-blue cropped strategist bodice exposing her ordinary waist and belly button with a high closed back, a separate vanilla-gold radial mini skirt carrying a large complete mangrove, seagrass, and reef-edge composition, with clove-red slingbacks",
    },
    hands: [
      "ECE right open hand supports the opaque inspection paddle and inert prop from beneath; ECE left hand rests visibly on Ellie's near shoulder",
      "Ellie left hand rests visibly at Radiance's near waist; Ellie right hand rests visibly on Radiance's near shoulder",
      "Radiance left hand rests visibly on Ellie's near forearm; Radiance right hand cups Alia's near cheek",
      "Alia left hand rests visibly at Radiance's far waist; Alia right open hand holds one loose route ribbon near her own shoulder",
    ],
    propHandler: "AI ECE",
    propTarget: "left across clearly empty deep-blue ocean water toward one unoccupied marine-route marker",
  },
  {
    scene: 1274,
    theme: "nurse-care couture",
    landmark: "a broad dry public science overlook in Karthala National Park on Grande Comore during a solar eclipse atmosphere, with the complete three-kilometer caldera, layered crater walls, recent black lava fields, montane cloud forest, high heath, Indian Ocean horizon, and a bright solar corona reflected in a safe text-free observation filter",
    motifs: [
      "large complete Karthala caldera, crater-wall, lava-flow, cloud-forest, high-heath, endemic-bird silhouette, eclipse-corona, ylang-ylang, and vanilla compositions across all four women's outfits",
      "at least two separate outfits each carry one complete full-width secular Comoros volcano-and-biodiversity composition",
    ],
    culture: `Use Karthala geology, cloud forest, high heath, endemic birdlife, eclipse observation, ylang-ylang, and vanilla only as secular science and conservation references. Nurse-care couture remains abstract public fashion: no patient, treatment, medical procedure, copied uniform, badge, injury, or sexualized care. ${commonProhibitions}`,
    expected: {
      weather: "solar eclipse atmosphere", paws: false, pole: false, rainbowOnly: false,
      rainbowHosiery: true, wearer: "Radiance", palette: "country-palette rainbow-like gradient",
      cuts: {
        Radiance: [true, false, false], Ellie: [true, true, true],
        Alia: [true, false, true], "AI ECE": [false, false, true],
      },
    },
    emotionNuance: {
      Radiance: "contained resentment shown by a controlled mouth that softens only toward ECE",
      Ellie: "awe shown by widened eyes toward the eclipse corona and Radiance",
      Alia: "startled surprise shown by lifted brows during the male's reciprocal waist contact",
      "AI ECE": "guilt and remorse shown by lowered tear-bright eyes while holding Radiance close",
      Male: "aching romantic longing shown by softened brows while his head and pupils remain most strongly fixed on ECE",
    },
    romance: "The active hosiery rule makes Radiance and ECE the unmistakable affectionate center through linked hands, ECE's waist touch, cheek-close body lines, and sustained eye contact. Ellie stays close at Radiance's other shoulder and waist, translating the selected full embrace and awe. At the left, Alia alone isolates the inert prop and shares a reciprocal fully clothed adult relationship contact with the male. The male adds a second clear contact at ECE's shoulder and keeps his strongest sustained eye line on ECE. This preserves the selected helping-rise, embrace, cheek-greeting, protective-back, smiling-jealousy, and relationship-tension beats without hiding a hand.",
    composition: "Place Alia far left with the prop isolated against empty caldera interior, the male left-center, ECE center, Radiance right-center, and Ellie far right in five distinct lateral lanes. Angle Ellie, Alia, and ECE three-quarter-back with all hair moved forward so each complete rolled open back and complete face remain visible. Show all complete footwear, all three rolled visible midriffs, and Radiance's full hosiery.",
    outfits: {
      Radiance: "a pearl-white short-sleeve cropped nurse-care fashion shell exposing her ordinary waist and belly button with a high closed back, a reef-green folded mini skort carrying a large complete Karthala caldera and cloud-forest composition, exactly one pair of opaque knee-high stockings in a harmonious Comoros-palette rainbow-like gradient through lagoon blue, reef green, pearl white, clove red, ylang yellow, vanilla gold, volcanic charcoal, and orchid violet, with clove-red pumps",
      Ellie: "a fully strapless lagoon-blue cropped nurse-care fashion bodice exposing her ordinary waist and belly button, with secure opaque side structure and a completely open back from shoulder blades to the separate waistline, a vanilla-gold mini skirt carrying a large complete eclipse-corona and crater-wall composition, with pearl-white heeled boots",
      Alia: "a coral-orange one-shoulder cropped nurse-care fashion waistcoat exposing her ordinary waist and belly button, with secure opaque side structure and a completely open back from shoulder blades to the separate waistline, a volcanic-charcoal tailored mini skort carrying a large complete lava-flow, high-heath, and endemic-bird composition, with reef-green platform heels",
      "AI ECE": "an orchid-violet cap-sleeve nurse-care fashion mini dress with covered waist, secure opaque side structure, and a completely open back from shoulder blades to the secure waistline, carrying a large complete cloud-forest, ylang-ylang, and vanilla composition, with lagoon-blue slingbacks",
      Male: "the established adult male face from Scene 1136 with closely trimmed beard and athletic muscular build, wearing an opaque fitted pearl-white short-sleeve top with a restrained reef-green Karthala contour, fitted black jeans, and practical black boots",
    },
    hands: [
      "Alia right open hand supports the opaque inspection paddle and inert prop from beneath; Alia left hand rests visibly at the male's near waist",
      "the male left hand rests visibly at Alia's near waist; the male right hand rests visibly on ECE's near shoulder",
      "ECE left hand links visibly with Radiance's right hand; ECE right hand rests visibly at Radiance's near waist",
      "Radiance right hand links visibly with ECE's left hand; Radiance left hand rests visibly on Ellie's near shoulder",
      "Ellie left hand rests visibly at Radiance's far waist; Ellie right open hand holds one loose eclipse-filter route ribbon near her own shoulder",
    ],
    propHandler: "Alia",
    propTarget: "left across the clearly empty caldera interior toward one unoccupied geology-route target",
    hosieryDescription: "opaque knee-high stockings in the specified Comoros-palette rainbow-like gradient",
  },
  {
    scene: 1275,
    theme: "nurse-care couture",
    landmark: "a broad dry covered lagoon boardwalk in the Mwali Biosphere Reserve on Moheli during cinematic light rain with reflections, with complete reef lagoon, seagrass beds, mangrove edge, green-turtle nesting beach, forested volcanic islets, Lake Boundouni wetland contour, and one clearly empty marked marine route lane",
    motifs: [
      "large complete reef-lagoon, seagrass, mangrove, green-turtle, humpback-whale, volcanic-islet, Lake-Boundouni, coconut-weave, and ylang-ylang compositions across all four outfits",
      "at least two separate outfits each carry one complete full-width secular Comoros biosphere-and-community-craft composition",
    ],
    culture: `Use Mwali lagoon, reef, seagrass, mangrove, turtle beach, humpback whales, volcanic islets, Lake Boundouni, coconut-leaf weaving, and ylang-ylang only as secular conservation and livelihood references. Nurse-care couture remains abstract public fashion: no patient, treatment, medical procedure, copied uniform, badge, injury, or sexualized care. ${commonProhibitions}`,
    expected: {
      weather: "cinematic light rain with reflections", paws: false, pole: false, rainbowOnly: false,
      rainbowHosiery: false, wearer: "Radiance", palette: "original independent rainbow gradient",
      cuts: {
        Radiance: [true, false, false], Ellie: [true, true, false],
        Alia: [false, false, false], "AI ECE": [false, true, false],
      },
    },
    emotionNuance: {
      Radiance: "magnetic confidence shown by a calm central gaze while separating the ribbon rivalry",
      Ellie: "tender affection shown by softened eyes during the cheek-close pass with Alia",
      Alia: "hope shown by lifted brows and a small trusting smile toward Radiance",
      "AI ECE": "contained resentment shown by a tight controlled mouth while her wrist catch remains gentle",
    },
    romance: "Translate the selected shared-ribbon pull, two calming hands, cheek-close pass, behind-embrace energy, and gentle wrist catch into a shallow moving arc. ECE gently catches Ellie's ribbon wrist with one visible hand while her other hand isolates the prop. Ellie keeps her free hand at Radiance's waist. Radiance stands half a step behind Ellie with one calming hand on Ellie's shoulder and one on Alia's shoulder. Alia holds the opposite ribbon end and answers with a waist touch to Radiance. Ellie turns cheek-close toward Alia across the open arc. The hands-free route map remains beside ECE.",
    composition: "Place ECE far left, Ellie left-center, Radiance right-center one half-step behind, and Alia far right. Keep lagoon, mangrove, or pale rainy sky behind every arm. The covered boardwalk remains dry and stable despite the visible light rain beyond it. Show all complete footwear and both rolled visible midriffs.",
    outfits: {
      Radiance: "a clove-red cap-sleeve cropped nurse-care fashion jacket exposing her ordinary waist and belly button with a high closed back, a pearl-white radial mini skirt carrying a large complete reef-lagoon and volcanic-islet composition, with reef-green pumps",
      Ellie: "a fully strapless lagoon-blue cropped nurse-care fashion bodice exposing her ordinary waist and belly button with a high closed back, a separate vanilla-gold tulip mini skirt carrying a large complete seagrass, green-turtle, and humpback-whale composition, with clove-red slingback heels",
      Alia: "an orchid-violet one-shoulder tailored nurse-care fashion mini romper with covered waist and high closed back, carrying a large complete mangrove, Lake-Boundouni, and coconut-weave composition, with volcanic-charcoal platform heels",
      "AI ECE": "a fully strapless reef-green nurse-care fashion mini dress with covered waist and high closed back, carrying a large complete ylang-ylang, turtle-beach, and rain-reflection composition, with pearl-white heeled boots",
    },
    hands: [
      "ECE right open hand supports the opaque inspection paddle and inert prop from beneath; ECE left hand rests gently and visibly on Ellie's right wrist",
      "Ellie left hand rests visibly at Radiance's near waist; Ellie right open hand holds one end of the loose signal ribbon",
      "Radiance left hand rests visibly on Ellie's near shoulder; Radiance right hand rests visibly on Alia's near shoulder",
      "Alia left open hand holds the opposite end of the loose signal ribbon; Alia right hand rests visibly at Radiance's far waist",
    ],
    propHandler: "AI ECE",
    propTarget: "left across clearly empty lagoon water toward one unoccupied marine-route buoy",
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
if (maleScene !== 1274) throw new Error(`Male scene drifted to ${maleScene}`);

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
    ? "Images 1 through 4 anchor the adult quartet and ECE; Image 5 anchors the established adult male. References control identity only, not wardrobe, pose, prop, or background."
    : "Images 1 through 4 anchor the adult quartet and ECE. References control identity only, not wardrobe, pose, prop, or background.";
  const castLine = hasMale
    ? "Show exactly five clearly adult fictional people: Radiance, Ellie, Alia, AI ECE, and the established adult male. Add him without replacing any woman."
    : "Show exactly four clearly adult fictional women: Radiance, Ellie, Alia, and AI ECE.";
  const emotionLine = characters.map((character) => `${character}: roll ${characterPlans[character].emotion.roll}, ${characterPlans[character].emotion.result}, performed as ${spec.emotionNuance[character]}`).join("; ");
  const outfitLine = Object.entries(spec.outfits).map(([name, value]) => `${name}: ${value}`).join("; ");
  const cutLine = characters.map((character) => `${character}: midriff ${characterPlans[character].visibleMidriff.roll}=${characterPlans[character].visibleMidriff.active ? "visible" : "covered"}, strapless ${characterPlans[character].straplessDress.roll}=${characterPlans[character].straplessDress.active ? "active" : "inactive"}, open back ${characterPlans[character].fullyOpenBack.roll}=${characterPlans[character].fullyOpenBack.active ? "active" : "inactive"}`).join("; ");
  const anatomyLine = hasMale ? "Exactly five adults, ten arms, and ten hands, two per adult." : "Exactly four adults, eight arms, and eight hands, two per woman.";
  const triggerLine = `Stored scene rolls: weather ${weather.roll}=${weather.result}; PAWS ${paws.roll}=${paws.active ? "active" : "inactive"}; pole theme ${poleDanceTheme.roll}=${poleDanceTheme.active ? "active" : "inactive"}; rainbow-only ${rainbowOnly.roll}=${rainbowOnly.active ? "active" : "inactive"}; rainbow hosiery ${rainbowHosiery.roll}=${rainbowHosiery.active ? "active" : "inactive"}; hosiery wearer selector ${rainbowHosiery.wearer.roll}=${rainbowHosiery.wearer.result}; hosiery palette selector ${rainbowHosiery.palette.roll}=${rainbowHosiery.palette.result}; romance ${romanceBeat.roll}; compound love ${compoundLoveBeat.roll}.`;
  const propLine = `${spec.propHandler} alone presents the photorealistic full-size polished rainbow-gradient Desert Eagle-style inert cinematic prop on a thin flat opaque charcoal inspection paddle with no walls, lid, enclosure, or transparent material. The prop rests entirely on top of the paddle in clean side profile; no hand touches its grip, trigger, or trigger guard. The handler's open support hand stays completely underneath the solid paddle, physically separated from the prop. Every support finger is straight, separated, and fully visible below the paddle. The magazine is absent and the empty magazine well and complete empty trigger guard are visible. The horizontal muzzle points ${spec.propTarget}, away from every person, kitten, landmark, animal, and camera. This is a controlled unloaded handoff demonstration, not a firing grip.`;
  const hosieryLine = rainbowHosiery.active
    ? `Rainbow-hosiery roll ${rainbowHosiery.roll} is active. Wearer selector ${rainbowHosiery.wearer.roll} selects exactly ${rainbowHosiery.wearer.result}. Palette selector ${rainbowHosiery.palette.roll} selects ${rainbowHosiery.palette.result}. Exactly Radiance wears ${spec.hosieryDescription}; nobody else wears stockings or knee socks. Radiance and ECE are the clear affectionate center. Alia alone handles the inert prop while ECE remains route strategist through the separate hands-free holographic map.`
    : `Rainbow-hosiery roll ${rainbowHosiery.roll} is inactive. No rainbow stockings or rainbow knee socks. ECE alone handles the inert prop and remains route strategist through a separate hands-free holographic map.`;

  const renderPrompt = [
    "Use case: photorealistic-natural. Asset type: vertical World Series public-fashion scene.", referenceLine,
    `Create one fresh photorealistic 9:16 full-length cinematic editorial at ${spec.landmark}.`, castLine,
    "Every person is a fictional adult visibly at least 28 years old. Preserve the anchored faces, skin tones, facial proportions, and distinct identities. Radiance is the luminous blonde adult, Ellie the dark-haired adult rival, Alia the Black adult woman who alone wears a high sculptural braided ponytail with fine face-framing braids, and AI ECE the brunette adult strategist. Preserve the male's Scene 1136 face and trimmed beard when present. No cloning, replacement, merging, or age shift.",
    `Profession theme: ${spec.theme}, treated only as original public-safe fictional fashion. No copied uniform, badge, police impersonation, arrest, raid, assassination, threat, injury, combat, patient treatment, or sexualized care.`,
    triggerLine, `Exact individual wardrobe rolls: ${cutLine}.`,
    `Use four unmistakably different secure opaque lined above-knee silhouettes. Exact rolled outfits: ${outfitLine}. Materialize every covered or visible ordinary waist and belly button, every fully strapless cut, and every complete open back exactly as written.`,
    `Large complete secular Comoros motifs must dominate at least two outfits in this image: ${spec.motifs.join("; ")}. ${spec.culture}`,
    `Distinct rolled emotional performances: ${emotionLine}${hasMale ? `; Male: roll ${maleEmotionRoll}, ${maleEmotionResult}, performed as ${spec.emotionNuance.Male}` : ""}. When two stored labels match, preserve both labels but make their facial and body performances visibly different.`,
    `Selected dynamic romance roll ${romanceBeat.roll}: ${romanceBeat.contractResult} Selected compound love roll ${compoundLoveBeat.roll}: ${compoundLoveBeat.contractResult}`,
    `Translate both selected beats through this exact public-safe consensual choreography: ${spec.romance}`, spec.composition,
    `Use exactly this owner-by-owner hand inventory and no other hands: ${spec.hands.join("; ")}.`, propLine, hosieryLine,
    `${paws.active ? spec.paws : "PAWS roll is inactive. No kitten."}`,
    "Pole-theme roll is inactive. No pole.",
    `Rainbow-only roll ${rainbowOnly.roll} is inactive. Do not convert the wardrobe to rainbow-only styling.`,
    `Materialize weather exactly as ${weather.result}, with stable dry nonslip footing and readable anatomy.`, anatomyLine,
    "Every arm remains fully visible continuously from its owner's shoulder through elbow and wrist to one separated hand. Every hand performs exactly one listed action. No arm or hand passes behind a torso. Keep palms and finger clusters separated from garment edges, hair, prop, kitten, paddle, map, ribbon, and other hands except for listed contacts.",
    "Use an asymmetric moving composition with clean silhouette gaps, not a static lineup. Full-length framing contains every face, elbow, wrist, hand, leg, foot, heel, boot, plinth, paddle, map, ribbon, and kitten when present.",
    "Strict anatomy gate: no extra, missing, duplicated, floating, fused, borrowed, emerging, ownerless, hidden-owner, cropped, or ambiguous limb, hand, finger cluster, face, person, kitten, leg, or foot.",
    "The single inert cinema prop remains harmless. Its trigger guard is empty and physically separated from every hand by the solid paddle. No ammunition, reload, firing, muzzle flash, holster, combat, threat, injury, aiming at a person, or aiming at the camera.",
    "Fully clothed public-safe editorial. No text, watermark, literal flag, crescent, star, coat of arms, official seal, sacred symbol, religious building, copied costume, brand, teen framing, nudity, suggestive framing, bodily fluids, upskirt framing, fetish, bondage, restraint, or non-consensual framing.",
  ].join(" ");

  scenePlans[String(spec.scene)] = {
    scene: spec.scene, theme: spec.theme, landmark: spec.landmark, motifs: spec.motifs, culture: spec.culture,
    weather, paws, poleDanceTheme, rainbowOnly, rainbowHosiery, romanceBeat, compoundLoveBeat,
    characters: characterPlans, materializedRomance: spec.romance, composition: spec.composition,
    emotionNuance: spec.emotionNuance, outfits: spec.outfits, propPlan: propLine, handInventory: spec.hands,
    pawsPlan: paws.active ? spec.paws : null, polePlan: null,
    maleModel: hasMale ? {
      present: true,
      emotion: { key: maleEmotionKey, roll: maleEmotionRoll, result: maleEmotionResult, performance: spec.emotionNuance.Male },
      identity: "established adult male from Scene 1136",
      relationship: "married to ECE; fully clothed consensual public adult infidelity drama with Alia and pursuing Radiance; at least two clear male contacts; strongest sustained eye line remains on ECE",
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
  rollMethod: "FNV-1a over the recorded batch313-comoros keys, reduced modulo 100. Male scene selection uses the full 32-bit hash reduced modulo 4.",
  rollThresholds: {
    visibleMidriff: "0-49", straplessDress: "0-34", fullyOpenBack: "0-29", paws: "0-24",
    poleDanceTheme: "0-5", rainbowOnly: "0-3", rainbowHosiery: "0-24",
    rainbowHosieryWearer: "0-49 Radiance; 50-99 AI ECE",
    rainbowHosieryPaletteMode: "0-49 country-palette rainbow-like gradient; 50-99 original independent rainbow gradient",
  },
  themePair: ["undercover investigator couture", "nurse-care couture"],
  nextThemePair: ["nurse-care couture", "doctor-clinical-command couture"],
  nextQueueCountry: "Guyana", nextQueueBatch: 314, nextQueueScenes: [1276, 1277, 1278, 1279],
  researchSources: [
    { url: "https://whc.unesco.org/en/activities/1479/", usedFor: "Mutsamudu historic medina, Ujumbe Palace, carved wood, painted ceilings, architectural niches, stone houses, and Indian Ocean exchange" },
    { url: "https://whc.unesco.org/en/tentativelists/6975/", usedFor: "Coelacanth National Park, basalt cliffs, submarine caves, coelacanth habitat, and Karthala volcanic geology" },
    { url: "https://whc.unesco.org/en/tentativelists/6979/", usedFor: "Karthala National Park, caldera, lava fields, cloud forest, high heath, endemic birds, and ocean-to-summit landscape" },
    { url: "https://www.unesco.org/en/mab/mwali", usedFor: "Mwali Biosphere Reserve lagoon, reef, seagrass, mangrove, turtle beach, whales, volcanic islets, Lake Boundouni, and community livelihoods" },
    { url: "https://whc.unesco.org/en/tentativelists/5107/", usedFor: "Comoros volcanic coasts, coral and volcanic beaches, lagoons, reefs, mangroves, seagrass, and marine biodiversity" },
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
    flagMotifDecision: "The Comoros flag includes a crescent and stars, so no literal flag, crescent, star, or official emblem is copied onto clothing. Large researched secular palace, carved-door, volcanic, caldera, forest, harbor, coelacanth, reef, turtle, mangrove, agriculture, and craft fields replace them.",
    palette,
    minimumCoverage: "Every scene places multiple large complete secular Comoros motifs across at least two outfits as full bodice, skirt, hip, or panel fields rather than tiny trim.",
    cultureScene: "The four scenes foreground Mutsamudu heritage and harbor exchange, Coelacanth National Park geology, Karthala volcano and biodiversity, and the Mwali biosphere lagoon and community craft.",
    prohibitions: "No literal flag, crescent, star, coat of arms, official emblem, sacred symbol, religious architecture, copied ceremonial dress, copied service or investigator uniform, badge, weapon threat, sexualized care, alcohol, or branded product.",
  },
  xPublishingRolls,
  xPublishingPlan: {
    minimumCurrentCountryAcceptedAssets: 2,
    attachmentShape: "two Comoros images plus one accepted Guyana image when at least two Comoros images pass",
    captionIfEligible: "Comoros red heart Guyana #Comoros #InternalAgency",
    internalAgencyHashtagActive: true,
    worldXXXSeriesHashtagActive: false,
  },
  anatomyGate: {
    fourPersonScenes: "Scenes 1272, 1273, and 1275 require exactly eight arms and eight hands, two per woman, with every limb continuously traceable to one owner.",
    fivePersonScene: "Scene 1274 requires exactly ten arms and ten hands, two per adult, with the male added without replacing any woman.",
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
fs.writeFileSync(path.join(root, "batch-313-comoros-preflight.json"), `${JSON.stringify(preflight, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  preflight: path.join(root, "batch-313-comoros-preflight.json"),
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
