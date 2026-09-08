import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const batch = 308;
const country = "Bhutan";
const countrySlug = "bhutan";
const firstScene = 1252;
const root = path.resolve("tmp/world-195x4/batch-308");
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

const flagField = "the complete white Druk thunder dragon with its full head, body, tail, four legs, all claws, and four round jewels, spanning a large diagonal field of Bhutan yellow and saffron orange";
const commonProhibitions = "Use the dragon as a complete national fashion motif rather than a literal rectangular flag. No coat of arms, official seal, copied ceremonial garment, copied uniform, sacred ritual, readable scripture, badge, alcohol, brand, or readable text.";

const sceneSpecs = [
  {
    scene: 1252,
    theme: "doctor-clinical-command couture",
    landmark: "a broad dry covered civic-wellness terrace above Paro Valley at crisp blue hour, with the complete whitewashed exterior of Rinpung Dzong, its traditional cantilever bridge, terraced red-rice fields, Paro airport far below, forested Himalayan slopes, and a clearly empty Paro Chhu river route lane",
    motifs: [
      `large complete ${flagField} across Radiance's skirt and ECE's romper`,
      "large complete archery-target, bamboo-bow, blue-poppy, red-rice, green-chili, cheese-bowl, bridge-timber, and Paro-valley fields across Ellie's shorts and Alia's dress",
    ],
    culture: `A dry unattended culture table outside the prop lane visibly holds one bowl of red rice, one bowl of ema datshi with whole green chilies and cheese, and woven bamboo serving vessels; a separate empty display rack holds one unstrung bamboo archery bow beside a painted target. No person eats or handles the bow. ${commonProhibitions}`,
    expected: {
      weather: "crisp blue hour", paws: false, pole: false, rainbowOnly: false,
      rainbowHosiery: false, wearer: "Radiance", palette: "original independent rainbow gradient",
      cuts: {
        Radiance: [true, true, true], Ellie: [true, false, false],
        Alia: [false, false, true], "AI ECE": [false, false, false],
      },
    },
    emotionNuance: {
      Radiance: "calm contentment shown by a settled soft smile toward ECE during the turning hand link",
      Ellie: "romantic joy shown by a bright open smile toward Radiance",
      Alia: "calm contentment shown differently through grounded breathing and a softened gaze toward Ellie",
      "AI ECE": "possessive tension shown by a controlled jaw and unwavering attention on Radiance",
    },
    romance: "ECE and Radiance exchange visible side support at the left while Radiance and Alia link hands in a gentle mid-turn. Alia steadies Ellie at the shoulder, Ellie returns a waist touch to Alia, and Ellie's other hand reaches Radiance's far shoulder. The chain translates the selected spin, side support, close seating, cheek greeting, and joined-hands beat without hiding or reusing a hand.",
    composition: "Place ECE far left with the prop isolated over empty river water, Radiance left-center, Alia right-center, and Ellie far right. Use a curved diagonal rather than a row. Turn Radiance and Alia in opposite three-quarter views with hair clear so both complete rolled open backs and all four faces remain readable. Put every arm beside or in front of its owner's torso with blue-hour background gaps.",
    outfits: {
      Radiance: `a fully strapless yellow sculpted doctor-command cropped bodice exposing her ordinary waist and belly button, with completely bare shoulders and a completely open back from shoulder blades to the secure waistline, a separate saffron-orange fan-pleated mini skirt carrying large complete ${flagField}, and pearl-white pumps`,
      Ellie: "a sleeveless pearl-white asymmetric clinical-command cropped peplum exposing her ordinary waist and belly button with a high closed back, separate saffron tailored high-waist shorts carrying large archery-target, red-rice, green-chili, and cheese-bowl fields, and black heeled ankle boots",
      Alia: "a sleeveless one-shoulder yellow fit-and-flare doctor-command mini dress with covered waist and a completely open back from shoulder blades to the secure waistline, large blue-poppy, bamboo-bow, bridge-timber, and Paro-valley fields, and saffron platform heels",
      "AI ECE": `a sleeveless saffron-orange tailored peplum mini romper with covered waist and high closed back, large complete ${flagField} across the full front and hip panels, and yellow slingback heels`,
    },
    hands: [
      "ECE right hand alone holds the inert prop; ECE left hand rests visibly at Radiance's near waist",
      "Radiance left hand rests visibly on ECE's far shoulder; Radiance right hand links visibly with Alia's left hand",
      "Alia left hand links visibly with Radiance's right hand; Alia right hand rests visibly on Ellie's near shoulder",
      "Ellie left hand rests visibly at Alia's near waist; Ellie right hand rests visibly on Radiance's far shoulder",
    ],
    prop: "ECE alone holds the full-size polished rainbow-gradient Desert Eagle-style inert cinematic prop in her right hand in clean side profile. It stays isolated at the far-left edge, with the horizontal muzzle pointing only left across clearly empty Paro Chhu water toward one unoccupied route marker, away from all people, architecture, food, bow display, aircraft, and camera. Her right index finger is perfectly straight on a bright outer-frame index shelf above the trigger guard, with a clearly visible gap between finger and complete empty guard. Her left hand stays off the prop. A separate holographic route map floats hands-free beside her.",
  },
  {
    scene: 1253,
    theme: "doctor-clinical-command couture",
    landmark: "a broad dry covered river-science terrace above Punakha during a rolling thunderstorm, with the complete whitewashed exterior of Punakha Dzong, the covered Bazam bridge, the long pedestrian suspension bridge, the blue Pho Chhu and brown Mo Chhu meeting below, green valley terraces, and a clearly empty downriver route lane",
    motifs: [
      `large complete ${flagField} across Radiance's skirt and ECE's asymmetric skirt`,
      "large complete Punakha-Dzong, Bazam-bridge, suspension-cable, twin-river-confluence, jacaranda, pomegranate, and terrace fields across Ellie's skirt and Alia's dress",
    ],
    culture: `Use Punakha's fortress exterior, covered bridge, suspension bridge, and two-color river confluence as secular architecture and civil-engineering signals. No interior murals, ritual activity, monks, worship, or sacred iconography. ${commonProhibitions}`,
    expected: {
      weather: "rolling thunderstorm", paws: false, pole: false, rainbowOnly: false,
      rainbowHosiery: false, wearer: "AI ECE", palette: "country-palette rainbow-like gradient",
      cuts: {
        Radiance: [true, true, false], Ellie: [true, false, false],
        Alia: [false, false, false], "AI ECE": [true, true, false],
      },
    },
    emotionNuance: {
      Radiance: "visible jealousy shown by a measured sideways look at Ellie's closeness to Alia",
      Ellie: "romantic joy shown by a luminous laugh while turning toward Alia",
      Alia: "tender affection shown by a warm reassuring gaze and gentle shoulder contact with Ellie",
      "AI ECE": "contained resentment shown by tightened lips and controlled eyes fixed on Radiance",
    },
    romance: "ECE and Radiance exchange reciprocal shoulder and waist support at the left. Radiance steadies Ellie at the shoulder, Ellie returns a waist touch and links her free hand with Alia, and Alia reaches Radiance's far shoulder. The linked crescent translates the selected contested ribbon, calming hands, behind embrace, cheek-to-cheek turn, and wrist catch through consensual public fashion contact.",
    composition: "Place ECE far left with the prop over empty downriver water, Radiance left-center, Ellie right-center, and Alia far right. Use a staggered crescent with the two differently colored rivers visible through gaps. Keep all eight shoulders, elbows, wrists, and hands separated against water or sky.",
    outfits: {
      Radiance: `a fully strapless yellow folded doctor-command cropped bodice exposing her ordinary waist and belly button with completely bare shoulders and high closed back, a separate saffron tulip mini skirt carrying large complete ${flagField}, and white pumps`,
      Ellie: "a sleeveless one-shoulder pearl-white clinical-command cropped top exposing her ordinary waist and belly button with high closed back, a separate yellow scalloped mini skirt carrying large suspension-bridge, twin-river, and jacaranda fields, and saffron heeled boots",
      Alia: "a sleeveless saffron architectural doctor-command mini coat-dress with covered waist and high closed back, large Punakha-Dzong, Bazam-bridge, pomegranate, and green-terrace fields, and black platform heels",
      "AI ECE": `a fully strapless pearl-white sculpted clinical-command peplum exposing her ordinary waist and belly button with completely bare shoulders and high closed back, a separate asymmetric yellow-orange mini skirt carrying a second large complete ${flagField}, and white slingback heels`,
    },
    hands: [
      "ECE right hand alone holds the inert prop; ECE left hand rests visibly on Radiance's near shoulder",
      "Radiance left hand rests visibly at ECE's near waist; Radiance right hand rests visibly on Ellie's near shoulder",
      "Ellie left hand rests visibly at Radiance's near waist; Ellie right hand links visibly with Alia's left hand",
      "Alia left hand links visibly with Ellie's right hand; Alia right hand rests visibly on Radiance's far shoulder",
    ],
    prop: "ECE alone holds the full-size polished rainbow-gradient Desert Eagle-style inert cinematic prop in her right hand in clean side profile. Its horizontal muzzle points only left across clearly empty downriver water toward one unoccupied route buoy, away from all people, bridges, fortress, and camera. Her right index finger is perfectly straight on the solid outer frame above the trigger guard, with a visible band of metal and open air separating it from the complete empty guard. Her left hand stays off the prop. The river route map is hands-free.",
  },
  {
    scene: 1254,
    theme: "adult nightlife dance-performance couture",
    landmark: "a broad dry covered wildlife-observatory performance deck above Phobjikha Valley during a heavy rain curtain, with the complete sweeping glacial valley, wet dwarf-bamboo meadows, forested ridges, distant black-necked cranes in flight, a clearly empty meadow route lane, and no crowd",
    motifs: [
      `large complete ${flagField} across Radiance's skirt and ECE's strapless romper`,
      "large complete black-necked-crane, blue-poppy, takin, red-panda, dwarf-bamboo, rain-ripple, and Phobjikha-ridge fields across Ellie's skirt and Alia's dress",
    ],
    culture: `Treat the nightlife theme only as original after-dark performance fashion, with poised mid-turn poses and no stripping or explicit dance. Black-necked cranes remain distant beyond the covered deck; wildlife also appears as large illustrated couture fields. ${commonProhibitions}`,
    expected: {
      weather: "heavy rain curtain", paws: true, pole: false, rainbowOnly: false,
      rainbowHosiery: true, wearer: "AI ECE", palette: "country-palette rainbow-like gradient",
      cuts: {
        Radiance: [true, false, false], Ellie: [true, false, true],
        Alia: [false, true, false], "AI ECE": [false, true, false],
      },
    },
    emotionNuance: {
      Radiance: "romantic joy shown by delighted eye contact and a warm smile directed to ECE",
      Ellie: "startled surprise shown by lifted brows at the male's linked hand and PAWS's ribbon play",
      Alia: "crying with visible tears shown by clear tear tracks while accepting Ellie's steadying touch and maintaining calm prop discipline",
      "AI ECE": "awe shown by widened luminous eyes at Radiance while also registering her husband's return gaze",
      Male: "playful mischief shown by a restrained half-smile while his head and pupils return unmistakably to ECE",
    },
    romance: "Tearful Alia and surprised Ellie exchange reciprocal shoulder support at the far left. Ellie links hands with the established male, who gives ECE a gentle shoulder touch while his strongest sustained gaze remains on ECE. At the right, ECE and Radiance form the unmistakable affectionate center through a linked hand, waist support, shoulder touch, and mutual delighted eye contact. This keeps the four-woman square readable while layering the adult marriage tension and the male's overt contact with Ellie.",
    composition: "Place Alia far left with the prop isolated over the empty meadow lane, Ellie left-center, the male at center, ECE right-center, and Radiance far right. Keep wide rain-filled gaps behind every limb. Turn Ellie three-quarters away with hair clear so her complete rolled open back and face are both visible. Keep the male's face in three-quarter view toward ECE and do not let any nearer face intercept his eye line.",
    outfits: {
      Radiance: `a sleeveless one-shoulder yellow cropped performance bodice exposing her ordinary waist and belly button with high closed back, a separate saffron asymmetric mini skirt carrying large complete ${flagField}, and pearl-white pumps`,
      Ellie: "a sleeveless white halter cropped performance top exposing her ordinary waist and belly button with a completely open back from shoulder blades to the secure waistline, a separate black-and-white crane-feather mini skirt carrying rain-ripple and dwarf-bamboo fields, and saffron heeled boots",
      Alia: "a fully strapless pearl-white folded performance mini dress with completely bare shoulders, covered waist and high closed back, large black-necked-crane, blue-poppy, takin, red-panda, and Phobjikha-ridge fields, and yellow platform heels",
      "AI ECE": `a fully strapless yellow-orange sculpted performance mini romper with completely bare shoulders, covered waist and high closed back, large complete ${flagField}, opaque knee socks in a Bhutan-anchored rainbow-like gradient of golden yellow, saffron orange, pearl white, pomegranate red, and mountain blue, and white slingback heels`,
      Male: "the established adult male face from Scene 1136 with closely trimmed beard and athletic muscular build, wearing an opaque fitted saffron short-sleeve polo with a yellow diagonal seam and restrained white-dragon contour, fitted black jeans, and practical black boots",
    },
    hands: [
      "Alia right hand alone holds the inert prop; Alia left hand rests visibly on Ellie's near shoulder",
      "Ellie left hand rests visibly on Alia's near shoulder; Ellie right hand links visibly with the male's left hand",
      "the male left hand links visibly with Ellie's right hand; the male right hand rests visibly on ECE's near shoulder",
      "ECE left hand rests visibly at Radiance's near waist; ECE right hand links visibly with Radiance's left hand",
      "Radiance left hand links visibly with ECE's right hand; Radiance right hand rests visibly on ECE's far shoulder",
    ],
    prop: "Alia alone holds the full-size polished rainbow-gradient Desert Eagle-style inert cinematic prop in her right hand in clean side profile. It stays isolated at the far-left edge, with the horizontal muzzle pointing only left across the clearly empty meadow route lane toward one unoccupied marker, away from all adults, PAWS, cranes, buildings, and camera. Her right index finger is perfectly straight on a bright outer-frame index shelf above the trigger guard, with a clearly visible gap to the complete empty guard. Her left hand stays off the prop. ECE remains route strategist through a separate hands-free holographic valley map.",
    paws: "One tiny collarless golden kitten, PAWS, perches securely on the male's far shoulder and harmlessly bats at a loose blue-poppy route ribbon clipped high behind him. PAWS is far from Alia, the prop, the route lane, and every edge or wet surface; no adult hand is reassigned to the kitten.",
  },
  {
    scene: 1255,
    theme: "adult nightlife dance-performance couture",
    landmark: "a broad dry covered rooftop performance deck above Thimphu Valley with the complete whitewashed exterior and red-roofed towers of Tashichho Dzong, the Wang Chhu river, modern Thimphu lights, forested hills, distant Himalayan ridges, and a clearly empty river route lane under silent heat lightning on the horizon",
    motifs: [
      `large complete ${flagField} across Alia's folded dress and ECE's bubble skirt`,
      "large complete takin, blue-poppy, cypress, raven, Wang-Chhu, Thimphu-window, red-roof, and mountain-ridge fields across Radiance's dress and Ellie's tailored shorts",
    ],
    culture: `Treat the nightlife theme only as original public fashion. The single polished route-marker pole is an athletic beacon mast for a controlled one-hand static side pose with both feet grounded and Radiance visibly spotting Ellie at the waist. No stripping, explicit dance, climb, inversion, or crowd. ${commonProhibitions}`,
    expected: {
      weather: "silent heat lightning on the horizon", paws: false, pole: true, rainbowOnly: false,
      rainbowHosiery: false, wearer: "Radiance", palette: "country-palette rainbow-like gradient",
      cuts: {
        Radiance: [false, false, false], Ellie: [false, false, false],
        Alia: [false, true, false], "AI ECE": [true, true, true],
      },
    },
    emotionNuance: {
      Radiance: "intense curiosity shown by alert eyes following Ellie's controlled route-marker pose",
      Ellie: "emotional exhaustion shown by heavy-lidded eyes and steady breathing while accepting Radiance's support",
      Alia: "determination shown by a direct focused gaze across the route chain",
      "AI ECE": "playful mischief shown by a knowing smile toward Radiance while keeping the route action safe",
    },
    romance: "ECE and Alia exchange reciprocal shoulder and waist support at the left. Alia links hands with Radiance; Radiance gives Ellie a clear supportive waist spot; Ellie returns a shoulder touch while using her free hand for the static route-marker pole pose. The asymmetrical chain translates the selected walking weave, protective touch, close greeting, jealous glance, low-plinth closeness, and beacon control without duplicating a hand.",
    composition: "Place ECE far left with the prop isolated over empty river water, Alia left-center, Radiance right-center, and Ellie far right beside one polished vertical beacon pole. Angle ECE three-quarters away with hair clear so her complete face, ordinary belly button, and completely open back are all visible. Ellie keeps both feet flat and separated on the dry deck. Use city and heat-lightning gaps behind all eight arms and hands.",
    outfits: {
      Radiance: "a sleeveless yellow asymmetric fit-and-flare performance mini dress with covered waist and high closed back, large Thimphu-window, red-roof, Wang-Chhu, and mountain-ridge fields, and white pumps",
      Ellie: "a sleeveless saffron peplum performance micro-suit with covered waist, high closed back, separate tailored mini shorts carrying large takin, blue-poppy, cypress, and raven fields, and black heeled ankle boots",
      Alia: `a fully strapless yellow-orange folded performance mini dress with completely bare shoulders, covered waist and high closed back, large complete ${flagField}, and white platform heels`,
      "AI ECE": `a fully strapless pearl-white cropped performance corsage exposing her ordinary waist and belly button, with completely bare shoulders and a completely open back from shoulder blades to the secure waistline, a separate saffron bubble mini skirt carrying a second large complete ${flagField}, and yellow heeled boots`,
    },
    hands: [
      "ECE right hand alone holds the inert prop; ECE left hand rests visibly on Alia's near shoulder",
      "Alia left hand rests visibly at ECE's near waist; Alia right hand links visibly with Radiance's left hand",
      "Radiance left hand links visibly with Alia's right hand; Radiance right hand supports Ellie visibly at the near waist",
      "Ellie left hand rests visibly on Radiance's far shoulder; Ellie right hand grips the route-marker pole visibly at chest height",
    ],
    prop: "ECE alone holds the full-size polished rainbow-gradient Desert Eagle-style inert cinematic prop in her right hand in clean side profile. Its horizontal muzzle points only left across clearly empty Wang Chhu water toward one unoccupied route light, away from all people, the athletic pole, architecture, and camera. Her right index finger is perfectly straight on the solid outer frame above the trigger guard, with a visible band of metal and open air separating it from the complete empty guard. Her left hand stays off the prop. The route map floats hands-free.",
    pole: "Exactly one polished vertical route-marker pole stands at the far-right edge. Ellie alone touches it with her right hand in a controlled static athletic side pose while Radiance supports her waist; both of Ellie's feet remain grounded and all clothing stays secure.",
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
if (maleScene !== 1254) throw new Error(`Male scene drifted to ${maleScene}`);

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
  const emotionLine = characters.map((character) => `${character}: ${characterPlans[character].emotion.result}, performed as ${spec.emotionNuance[character]}`).join("; ");
  const outfitLine = Object.entries(spec.outfits).map(([name, value]) => `${name}: ${value}`).join("; ");
  const anatomyLine = hasMale ? "Exactly five adults, ten arms, and ten hands, two per adult." : "Exactly four adults, eight arms, and eight hands, two per woman.";
  const handler = rainbowHosiery.active ? "Alia" : "ECE";

  const renderPrompt = [
    "Use case: photorealistic-natural. Asset type: vertical World Series public-fashion scene.", referenceLine,
    `Create one fresh photorealistic 9:16 full-length cinematic editorial at ${spec.landmark}.`, castLine,
    "Every person is a fictional adult visibly at least 28 years old. Preserve the anchored faces, skin tones, facial proportions, and distinct identities. Radiance is the luminous blonde adult, Ellie the dark-haired adult rival, Alia the Black adult woman who alone wears a high sculptural braided ponytail with fine face-framing braids, and AI ECE the brunette adult strategist. Preserve the male's Scene 1136 face and trimmed beard when present. No cloning, replacement, merging, or age shift.",
    `Profession theme: ${spec.theme}, treated only as original public-safe fictional fashion. No copied uniform, badge, medical procedure, patient, sexualized care, stripping, explicit dance, police impersonation, arrest, raid, assassination, threat, injury, or combat.`,
    `Use four unmistakably different secure opaque lined above-knee silhouettes. Exact rolled outfits: ${outfitLine}. Materialize every covered or visible ordinary waist and belly button, every fully strapless cut, and every complete open back exactly as written.`,
    `Large complete secular Bhutan motifs must dominate at least two outfits: ${spec.motifs.join("; ")}. ${spec.culture}`,
    `Distinct rolled emotional performances: ${emotionLine}${hasMale ? `; Male: ${maleEmotionResult}, performed as ${spec.emotionNuance.Male}` : ""}. Equal roll labels still require visibly different performances.`,
    `Selected dynamic romance roll ${romanceBeat.roll}: ${romanceBeat.contractResult} Selected compound love roll ${compoundLoveBeat.roll}: ${compoundLoveBeat.contractResult}`,
    `Translate both selected beats through the exact public-safe consensual choreography and hand inventory that follows: ${spec.romance}`, spec.composition,
    `Use exactly this owner-by-owner hand inventory and no other hands: ${spec.hands.join("; ")}.`, spec.prop,
    `${paws.active ? spec.paws : "No PAWS kitten."} ${poleDanceTheme.active ? spec.pole : "No pole."} ${rainbowOnly.active ? "Every adult outfit is visibly full-rainbow while preserving its unique silhouette, exact cut rolls, and large Bhutan motifs." : "Do not convert the wardrobe to rainbow-only styling."} ${rainbowHosiery.active ? `Exactly one hosiery wearer is ${rainbowHosiery.wearer.result}, using the ${rainbowHosiery.palette.result} visibly specified in the outfit; Radiance and ECE are the affectionate center and Alia alone handles the prop.` : `No rainbow stockings or rainbow knee socks; ${handler} handles the prop.`}`,
    `Materialize weather exactly as ${weather.result}, with stable dry footing and readable anatomy.`, anatomyLine,
    "Every arm remains fully visible continuously from its owner's shoulder through elbow and wrist to one separated hand. Every hand performs exactly one listed action. Keep palms and finger clusters separated from garment edges, hair, prop, pole, kitten, and other hands except for listed contacts.",
    "Use an asymmetric moving composition with clean silhouette gaps, not a static lineup. Full-length framing contains every face, elbow, wrist, hand, leg, foot, heel, boot, and any sock.",
    "Strict anatomy gate: no extra, missing, duplicated, floating, fused, borrowed, emerging, ownerless, hidden-owner, cropped, or ambiguous limb, hand, finger cluster, face, person, kitten, leg, or foot.",
    "The single inert cinematic prop remains harmless. Every trigger finger is straight outside the guard. No ammunition, reload, firing, muzzle flash, holster, combat, threat, injury, aiming at a person, or aiming at the camera.",
    "No text, watermark, literal rectangular flag, coat of arms, official seal, copied costume, brand, minors, teen framing, nudity, explicit sexuality, bodily fluids, upskirt framing, fetish, bondage, restraint, mummification, non-consensual framing, or renderer-bypass wording.",
  ].join(" ");

  scenePlans[String(spec.scene)] = {
    scene: spec.scene, theme: spec.theme, landmark: spec.landmark, motifs: spec.motifs, culture: spec.culture,
    weather, paws, poleDanceTheme, rainbowOnly, rainbowHosiery, romanceBeat, compoundLoveBeat,
    characters: characterPlans, materializedRomance: spec.romance, composition: spec.composition,
    emotionNuance: spec.emotionNuance, outfits: spec.outfits, propPlan: spec.prop, handInventory: spec.hands,
    pawsPlan: paws.active ? spec.paws : null, polePlan: poleDanceTheme.active ? spec.pole : null,
    maleModel: hasMale ? {
      present: true,
      emotion: { key: maleEmotionKey, roll: maleEmotionRoll, result: maleEmotionResult, performance: spec.emotionNuance.Male },
      identity: "established adult male from Scene 1136",
      relationship: "married to ECE; fully clothed public adult infidelity drama with Ellie; at least two male contacts; strongest sustained eye line remains on ECE",
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
  rollMethod: "FNV-1a over the recorded batch308-bhutan keys, reduced modulo 100. Male scene selection uses the full 32-bit hash reduced modulo 4.",
  rollThresholds: {
    visibleMidriff: "0-49", straplessDress: "0-34", fullyOpenBack: "0-29", paws: "0-24",
    poleDanceTheme: "0-5", rainbowOnly: "0-3", rainbowHosiery: "0-24",
    rainbowHosieryWearer: "0-49 Radiance; 50-99 AI ECE",
    rainbowHosieryPaletteMode: "0-49 country-palette rainbow-like gradient; 50-99 original independent rainbow gradient",
  },
  themePair: ["doctor-clinical-command couture", "adult nightlife dance-performance couture"],
  nextThemePair: ["adult nightlife dance-performance couture", "Paris runway model couture"],
  nextQueueCountry: "Uruguay", nextQueueBatch: 309, nextQueueScenes: [1256, 1257, 1258, 1259],
  researchSources: [
    { url: "https://oag.gov.bt/wp-content/uploads/2011/02/National-Flag-Rules-1972-English.pdf", usedFor: "Bhutan's yellow-orange diagonal flag construction and the complete white Druk dragon spanning the diagonal" },
    { url: "https://bhutan.travel/about", usedFor: "archery as national sport, red rice, cheese, chilies, forest cover, contemporary arts, and dzong architecture" },
    { url: "https://bhutan.travel/experiences-foodanddrink", usedFor: "ema datshi, red rice, green chilies, cheese, bamboo serving vessels, and regional food culture" },
    { url: "https://bhutan.travel/journal/editorial/bhutan-is-family-friendly", usedFor: "Punakha Dzong exterior, Bazam bridge, long suspension bridge, Po Chhu river, and archery experiences" },
    { url: "https://bhutan.travel/journal/editorial/why-bhutan-is-an-all-year-round-destination", usedFor: "Punakha's Pho Chhu and Mo Chhu confluence, Phobjikha Valley, black-necked cranes, and Himalayan views" },
    { url: "https://bhutan.travel/experiences-eco-tourism", usedFor: "black-necked cranes, red pandas, golden langurs, butterflies, protected landscapes, and Phobjikha ecology" },
    { url: "https://bhutan.travel/experiences-landing-pages-2/experiences-wildlife-and-nature", usedFor: "Bhutan bird diversity, black-necked cranes, forest habitat, and protected-area identity" },
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
    flagMotifDecision: "Every scene uses a complete white Druk thunder dragon with full body, four legs, claws, and four jewels spanning large yellow-orange diagonal fashion fields on at least two outfits. It is integrated as national couture geometry rather than copied as a rectangular flag.",
    palette: "Bhutan yellow, saffron orange, pearl white, pomegranate red, mountain blue, cypress green, raven black, blue-poppy cobalt, and river turquoise",
    minimumCoverage: "Every scene places large complete Druk dragon geometry on at least two outfits and multiple complete architecture, food, sport, flora, fauna, river, bridge, valley, or city motifs across the remaining outfits.",
    cultureScene: "Scene 1252 visibly includes archery, red rice, ema datshi, green chilies, cheese, bamboo serving craft, Paro Valley, and Rinpung Dzong. Later scenes use Punakha civil architecture and river confluence, Phobjikha cranes and wildlife, then Thimphu city, takin, blue poppy, cypress, and raven identity.",
    prohibitions: "No coat of arms, official seal, copied ceremonial dress, copied medical uniform, sacred ritual, readable scripture, badge, weapon threat, alcohol, branded product, or political insignia.",
  },
  xPublishingRolls,
  xPublishingPlan: {
    minimumCurrentCountryAcceptedAssets: 2,
    attachmentShape: "two Bhutan images plus the accepted Comoros image when at least two Bhutan images pass",
    captionIfEligible: "Bhutan red heart Comoros #Bhutan",
    internalAgencyHashtagActive: false,
    worldXXXSeriesHashtagActive: false,
  },
  anatomyGate: {
    fourPersonScenes: "Scenes 1252, 1253, and 1255 require exactly eight arms and eight hands, two per woman, with every limb continuously traceable to one owner.",
    fivePersonScene: "Scene 1254 requires exactly ten arms and ten hands, two per adult, with the male added without replacing any woman; PAWS adds no human limbs.",
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
    raw: { status: "pending", requested: 4, concurrency: "four independent built-in image generation calls; concurrency attempted when the host supports simultaneous calls" },
    recovery: { status: "not-started", maximumPerBlockedScene: 1 },
  },
  acceptedAssets: [], rejectedAssets: [],
  xPost: { status: "pending-asset-audit", minimumCurrentCountryAcceptedAssets: 2 },
};

fs.mkdirSync(root, { recursive: true });
for (const [scene, plan] of Object.entries(scenePlans)) fs.writeFileSync(path.join(root, `scene-${scene}-prompt.txt`), `${plan.renderPrompt}\n`, "utf8");
fs.writeFileSync(path.join(root, "batch-308-bhutan-preflight.json"), `${JSON.stringify(preflight, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  preflight: path.join(root, "batch-308-bhutan-preflight.json"),
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
