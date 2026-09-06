import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const batch = 310;
const country = "Botswana";
const countrySlug = "botswana";
const firstScene = 1260;
const root = path.resolve("tmp/world-195x4/batch-310");
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

const flagField = "a complete sky-blue field crossed horizontally by one broad black center stripe bordered above and below by two narrow white stripes";
const commonProhibitions = "Use the complete Botswana stripe geometry as large national fashion art wrapped to the silhouette, never as a literal rectangular flag. No coat of arms, official seal, copied ceremonial garment, copied uniform, sacred ritual, readable text, badge, alcohol, brand, or political insignia.";

const sceneSpecs = [
  {
    scene: 1260,
    theme: "Paris runway model couture",
    landmark: "a broad dry roofed fashion terrace at the edge of Makgadikgadi's Ntwetwe salt pan, with the white pan horizon and seven monumental baobab silhouettes visible beyond a dramatic red-gold sandstorm wall",
    motifs: [
      `large complete ${flagField} across Radiance's folded mini skirt and ECE's tulip mini skort`,
      "large complete zebra, baobab, salt-crystal, flamingo-wing, woven-basket, sorghum-head, diamond-facet, and mokoro silhouette fields across Ellie's skirt and Alia's tailored shorts",
    ],
    culture: `A dry unattended culture plinth well behind the quartet presents two lidded woven baskets with distinct geometric weaving, one sorghum bundle, one small unbranded diamond-facet sculpture, and one miniature mokoro. Nobody handles the display. The salt pan, baobabs, zebra migration geometry, baskets, sorghum, and mokoro are respectful secular Botswana signals. ${commonProhibitions}`,
    expected: {
      weather: "dramatic sandstorm wall", paws: true, pole: false, rainbowOnly: false,
      rainbowHosiery: false, wearer: "AI ECE", palette: "country-palette rainbow-like gradient",
      cuts: {
        Radiance: [true, false, true], Ellie: [true, false, false],
        Alia: [true, false, false], "AI ECE": [true, false, false],
      },
    },
    emotionNuance: {
      Radiance: "romantic joy shown by an open warm smile toward ECE while keeping her support contact clear",
      Ellie: "determination shown by level brows and a steady protective stance toward Alia",
      Alia: "suspicion shown by a sideward assessing gaze toward the route map without hostility",
      "AI ECE": "magnetic confidence shown by calm direct eyes and a composed chin while leading the route",
    },
    romance: "The four women form an open moving diamond. Radiance touches ECE's shoulder and Ellie touches Radiance's waist; Ellie also steadies Alia's shoulder, while Alia returns a waist touch to Ellie and a light upper-arm touch to ECE. These five separated public-safe contacts translate the chosen close pass, shoulder catch, protective interruption, and plinth embrace without hiding or reusing a hand.",
    composition: "Place ECE at the left foreground with the prop isolated over empty salt pan, Radiance at left rear, Ellie at right rear, and Alia at right foreground. Keep a clean sky or salt gap behind every arm. Turn Radiance three-quarter-back with her hair swept fully forward so the complete open back and her face both read. Keep all four ordinary navels visible from the front or three-quarter view.",
    outfits: {
      Radiance: `a one-shoulder sky-blue cropped runway shell exposing her ordinary waist and belly button, with secure opaque side structure and a completely open back from shoulder blades to the separate waistline, a black-and-white folded A-line mini skirt carrying large complete ${flagField}, and silver platform heels`,
      Ellie: "a short-sleeve white cropped architectural jacket exposing her ordinary waist and belly button with a high closed back, a black asymmetric fan-pleated mini skirt carrying large zebra, baobab, salt-crystal, and flamingo-wing fields, and sky-blue pumps",
      Alia: "a sleeveless black cropped sculpted runway vest exposing her ordinary waist and belly button with a high closed back, separate sky-blue tailored bubble mini shorts carrying large woven-basket, sorghum-head, diamond-facet, and mokoro fields, and white block heels",
      "AI ECE": `a sleeveless white cropped lapel vest exposing her ordinary waist and belly button with a high closed back, a sky-blue tulip mini skort carrying a second large complete ${flagField}, and black slingback heels`,
    },
    hands: [
      "ECE right hand alone grips the inert prop; ECE left hand is open under and clearly controls the separate holographic route map",
      "Radiance left hand rests visibly on ECE's near shoulder; Radiance right hand rests visibly at Ellie's near waist",
      "Ellie left hand rests visibly on Radiance's near waist; Ellie right hand rests visibly on Alia's near shoulder",
      "Alia left hand rests visibly at Ellie's near waist; Alia right hand rests visibly on ECE's near upper arm",
    ],
    prop: "ECE alone performs a magazine-free unloaded manipulation demonstration with the full-size polished rainbow-gradient Desert Eagle-style inert cinematic prop in her right hand at the far-left edge. The empty magazine well is visibly open. The prop remains in clean side profile and its horizontal muzzle points only left across clearly empty salt pan toward one unoccupied route marker, away from every person, PAWS, baobab, display, and camera. ECE's right index finger is one perfectly straight line high along the solid outer frame above the trigger guard; the full empty trigger guard is visible below with open air between finger and guard. No finger touches or enters the guard.",
    paws: "One tiny collarless golden kitten, PAWS, perches securely on Alia's far shoulder and harmlessly bats at a loose sky-blue route ribbon clipped high behind her. PAWS stays far from ECE, the prop, the terrace edge, and the display; no adult hand is reassigned to the kitten.",
  },
  {
    scene: 1261,
    theme: "Paris runway model couture",
    landmark: "a broad dry raised runway deck above the Okavango Delta's fan-shaped channels, papyrus beds, palm islands, one empty fiberglass mokoro, distant elephants, and red lechwe, with dense silver coastal sea mist rolling low across the water",
    motifs: [
      `large complete ${flagField} across Radiance's asymmetric dress and ECE's tailored jacket-dress`,
      "large complete mokoro, papyrus-fan, elephant, red-lechwe, lily-pad, delta-channel, woven-basket, and zebra fields across Ellie's dress and Alia's romper",
    ],
    culture: `Keep the fan-shaped channels, papyrus, palm islands, empty conservation-era fiberglass mokoro, wildlife, and woven basket geometry recognizable as respectful secular Okavango signals. No person, kitten, or prop enters the mokoro. ${commonProhibitions}`,
    expected: {
      weather: "coastal sea mist", paws: false, pole: true, rainbowOnly: false,
      rainbowHosiery: true, wearer: "AI ECE", palette: "country-palette rainbow-like gradient",
      cuts: {
        Radiance: [false, false, false], Ellie: [false, true, false],
        Alia: [false, true, true], "AI ECE": [false, false, false],
      },
    },
    emotionNuance: {
      Radiance: "hope shown by lifted eyes and a small relieved smile toward ECE",
      Ellie: "romantic joy shown by a bright affectionate smile while supporting Alia",
      Alia: "deep sadness shown by wet eyes and a lowered mouth while keeping the inert demonstration safe",
      "AI ECE": "extreme happiness shown by radiant laughing delight directed only toward Radiance",
    },
    romance: "Radiance and ECE are the unmistakable emotional center: Radiance keeps one hand on the route-marker pole and her other hand on ECE's shoulder, while ECE spots Radiance securely at the waist and meets her with delighted eye contact. Ellie lightly steadies Radiance's forearm and Alia's shoulder; Alia returns a waist touch to Ellie. These five clear public-safe contacts translate the selected walking handhold, protective waist support, calming embrace, and attention-reclaiming beat.",
    composition: "Place ECE far left, Radiance left-center beside the single pole, Ellie right-center, and Alia far right with the prop isolated over empty water. Use four separated depth planes and mist-bright gaps behind all eight arms. Turn Alia three-quarter-back with her braided ponytail swept completely aside to show the entire open back and full face. Keep ECE's colorful hosiery unobstructed from hem to complete heels.",
    outfits: {
      Radiance: `a sleeveless asymmetric sky-blue runway mini dress with covered waist, high closed back, a black folded hip panel carrying large complete ${flagField}, and white pumps`,
      Ellie: "a fully strapless white folded-bodice mini dress with completely bare shoulders, covered waist and high closed back, a black fan skirt carrying large mokoro, papyrus-fan, elephant, and red-lechwe fields, and sky-blue heeled ankle boots",
      Alia: "a fully strapless black sculpted mini romper with completely bare shoulders, covered waist and a completely open back from shoulder blades to the secure lower-back waistline, large lily-pad, delta-channel, woven-basket, and zebra fields, and white platform heels",
      "AI ECE": `a sleeveless high-neck sky-blue tailored jacket-dress with covered waist and high closed back, a white side fan carrying a second large complete ${flagField}, exactly one pair of opaque knee-high stockings with a clearly multicolor Botswana-palette rainbow-like gradient flowing through sky blue, turquoise, pearl white, silver, charcoal, and black diagonal bands, and black slingback heels`,
    },
    hands: [
      "ECE right hand is open under and clearly controls the separate holographic route map; ECE left hand spots Radiance visibly at the near waist",
      "Radiance left hand holds the single route-marker pole in a controlled static runway pose; Radiance right hand rests visibly on ECE's near shoulder",
      "Ellie left hand rests visibly on Radiance's near forearm; Ellie right hand rests visibly on Alia's near shoulder",
      "Alia left hand rests visibly at Ellie's near waist; Alia right hand alone grips the inert prop",
    ],
    pole: "One polished sky-blue stage pole functions only as a beacon mast and route marker. Radiance performs one fully clothed adult athletic static hold with both feet grounded while ECE provides supportive waist spotting. No climb, inversion, split, stripping, explicit dance, or suggestive framing.",
    prop: "Alia alone performs a magazine-free unloaded manipulation demonstration with the full-size polished rainbow-gradient Desert Eagle-style inert cinematic prop in her right hand at the far-right edge. The empty magazine well is visibly open. Its horizontal muzzle points only right across a clearly empty delta channel toward one unoccupied route buoy, away from every person, wildlife, mokoro, pole, and camera. Alia's right index finger is perfectly straight high along the solid outer frame above the trigger guard; the full empty guard is visible below with open air between finger and guard. No finger touches or enters the guard.",
  },
  {
    scene: 1262,
    theme: "cleaner and service couture",
    landmark: "a broad dry civic service terrace in Gaborone's central business district, with the Three Dikgosi Monument in the middle distance, modern towers, Gaborone Dam, and Kgale Hill visible under a distant volcanic-ash sunset sky",
    motifs: [
      `large complete ${flagField} across Ellie's utility mini skirt and ECE's service mini dress`,
      "large complete Kgale-Hill, dam-wave, three-silhouette-monument, diamond-facet, sorghum-head, cattle-profile, zebra, and woven-basket fields across Radiance's dress and Alia's tailored shorts",
    ],
    culture: `Use the Gaborone skyline, Three Dikgosi Monument, Kgale Hill, dam water, diamond facets, sorghum, cattle, zebra, and basket geometry as respectful secular civic and livelihood signals. The distant ash colors are atmospheric only, with no eruption, danger, injury, or evacuation. ${commonProhibitions}`,
    expected: {
      weather: "distant volcanic-ash sunset sky", paws: false, pole: false, rainbowOnly: false,
      rainbowHosiery: false, wearer: "AI ECE", palette: "country-palette rainbow-like gradient",
      cuts: {
        Radiance: [false, false, false], Ellie: [true, true, false],
        Alia: [true, false, false], "AI ECE": [false, false, false],
      },
    },
    emotionNuance: {
      Radiance: "romantic joy shown by a persuasive bright smile while openly seeking the male's attention",
      Ellie: "tender affection shown by a soft protective gaze toward Radiance",
      Alia: "crying with visible tears shown by clean tear tracks while accepting the male's overt waist touch",
      "AI ECE": "anger shown by a controlled jaw and direct hurt gaze toward her husband without threat",
      Male: "determination shown by a calm set jaw while his head and pupils stay most strongly fixed on ECE",
    },
    romance: "The male openly rests one hand at Alia's waist while Alia steadies his forearm, and Radiance openly places one hand on his upper arm to seek his attention. His other hand rests on ECE's shoulder and his strongest sustained eye line returns to his wife ECE. Alia and Radiance exchange waist and shoulder support, while Ellie keeps one hand on Radiance and one on Alia. This creates fully clothed consensual adult infidelity drama, three clear male contacts, and a readable romance-square chain around him.",
    composition: "Use a shallow moving arc: ECE far left with the prop isolated over empty dam water, the male left-center, Alia center, Radiance right-center, and Ellie far right. Keep every torso on its own depth plane with sky gaps behind all ten arms. Preserve the male's three-quarter face toward ECE so no nearer face intercepts his eye line. Keep Ellie's and Alia's ordinary navels visible.",
    outfits: {
      Radiance: "a short-sleeve white wrap-front route-service mini dress with covered waist, high closed back, black utility piping, large Kgale-Hill, dam-wave, and three-silhouette-monument fields, and sky-blue pumps",
      Ellie: `a fully strapless sky-blue folded service bodice exposing her ordinary waist and belly button with completely bare shoulders and a high closed back, a separate black utility mini skirt carrying large complete ${flagField}, and white heeled ankle boots`,
      Alia: "a sleeveless black cropped route-service shirt exposing her ordinary waist and belly button with a high closed back, separate sky-blue tailored mini shorts with an asymmetric white apron panel carrying large diamond-facet, sorghum-head, cattle-profile, zebra, and woven-basket fields, and black platform heels",
      "AI ECE": `a one-shoulder white tailored service mini dress with covered waist and high closed back, a sky-blue wrap panel carrying a second large complete ${flagField}, restrained black utility tabs, and silver slingback heels`,
      Male: "the established adult male face from Scene 1136 with closely trimmed beard and athletic muscular build, wearing an opaque fitted sky-blue short-sleeve polo with one narrow black stripe bordered by two thin white lines, fitted black jeans, and practical black boots",
    },
    hands: [
      "ECE right hand alone grips the inert prop; ECE left hand is open under and clearly controls the separate holographic route map",
      "the male right hand rests visibly on ECE's near shoulder; the male left hand rests visibly at Alia's near waist",
      "Alia right hand rests visibly on the male's near forearm; Alia left hand rests visibly on Radiance's near shoulder",
      "Radiance left hand rests visibly at Alia's near waist; Radiance right hand rests visibly on the male's near upper arm",
      "Ellie left hand rests visibly on Radiance's far shoulder; Ellie right hand rests visibly at Alia's far waist",
    ],
    prop: "ECE alone performs a magazine-free unloaded manipulation demonstration with the full-size polished rainbow-gradient Desert Eagle-style inert cinematic prop in her right hand at the far-left edge. The empty magazine well is visibly open. Its horizontal muzzle points only left across clearly empty Gaborone Dam water toward one unoccupied route target, away from all five adults, architecture, monument, and camera. ECE's right index finger is perfectly straight high along the solid outer frame above the trigger guard; the entire empty guard is visible below with open air between finger and guard. No finger touches or enters the guard.",
  },
  {
    scene: 1263,
    theme: "cleaner and service couture",
    landmark: "a warm dry glass-roofed conservation service pavilion above the Chobe Riverfront near Kasane, with the blue river ribbon, floodplain, distant elephant and buffalo herds, and bee-eater banks visible through a heavy snow or cinematic blizzard outside",
    motifs: [
      `large complete ${flagField} across Radiance's heated mini coat-dress and ECE's radial mini skirt`,
      "large complete elephant-herd, buffalo, Chobe-river-ribbon, bee-eater, hornbill, floodplain-grass, zebra, and conservation-route fields across Ellie's skirt and Alia's tailored shorts",
    ],
    culture: `The blizzard remains entirely beyond sealed glass while the cast stands on a warm dry nonslip pavilion floor. Keep the Chobe River ribbon, floodplain, elephant and buffalo herds, bee-eater banks, hornbill, zebra, and conservation route unmistakable and nonthreatening. ${commonProhibitions}`,
    expected: {
      weather: "heavy snow or cinematic blizzard", paws: true, pole: false, rainbowOnly: false,
      rainbowHosiery: false, wearer: "AI ECE", palette: "country-palette rainbow-like gradient",
      cuts: {
        Radiance: [false, false, false], Ellie: [true, false, true],
        Alia: [true, false, false], "AI ECE": [true, true, true],
      },
    },
    emotionNuance: {
      Radiance: "betrayal shock shown by widened eyes and a tense mouth toward ECE",
      Ellie: "tender affection shown as a serene reassuring smile toward Radiance",
      Alia: "tender affection shown differently as protective concern and softened brows toward Ellie",
      "AI ECE": "crying with visible tears shown by clear tear tracks while she continues calm route leadership",
    },
    romance: "Radiance and ECE exchange shoulder and waist reassurance at the left. Radiance also steadies Ellie at the shoulder; Ellie returns a waist touch to Radiance and supports Alia's shoulder; Alia returns a waist touch to Ellie and a light upper-arm touch toward ECE. These six separated public-safe contacts translate the chosen linked spin, waist steady, face-to-face embrace, and near cheek reassurance without hiding or reusing a hand.",
    composition: "Place ECE at left foreground with the prop isolated over empty river water, Radiance left rear, Ellie right rear, and Alia right foreground with PAWS. Keep blizzard-bright glass gaps behind all eight arms. Turn Ellie and ECE in opposite three-quarter-back views with hair completely clear so both complete open backs, all faces, and all three rolled ordinary navels remain readable.",
    outfits: {
      Radiance: `a long-sleeve sky-blue heated service mini coat-dress with covered waist and high closed back, a black-and-white wrap panel carrying large complete ${flagField}, and white knee-high heeled boots with no rainbow colors`,
      Ellie: "a sleeveless white cropped mock-neck service shell exposing her ordinary waist and belly button, with secure opaque side structure and a completely open back from shoulder blades to the separate waistline, a black A-line utility mini skirt carrying large elephant-herd, buffalo, and Chobe-river-ribbon fields, and sky-blue pumps",
      Alia: "a short-sleeve black cropped route-service top exposing her ordinary waist and belly button with a high closed back, separate sky-blue tailored bubble mini shorts carrying large bee-eater, hornbill, floodplain-grass, zebra, and conservation-route fields, and white platform heels",
      "AI ECE": `a fully strapless rigid-front white cropped service bodice exposing her ordinary waist and belly button, with completely bare shoulders, secure opaque side boning, and a completely open back from shoulder blades to the separate waistline, a sky-blue radial mini skirt carrying a second large complete ${flagField}, and black slingback heels`,
    },
    hands: [
      "ECE right hand alone grips the inert prop; ECE left hand is open under and clearly controls the separate holographic route map",
      "Radiance left hand rests visibly on ECE's near shoulder; Radiance right hand rests visibly on Ellie's near shoulder",
      "Ellie left hand rests visibly at Radiance's near waist; Ellie right hand rests visibly on Alia's near shoulder",
      "Alia left hand rests visibly at Ellie's near waist; Alia right hand rests visibly on ECE's near upper arm",
    ],
    prop: "ECE alone performs a magazine-free unloaded manipulation demonstration with the full-size polished rainbow-gradient Desert Eagle-style inert cinematic prop in her right hand at the far-left edge. The empty magazine well is visibly open. Its horizontal muzzle points only left across clearly empty Chobe River water toward one unoccupied route buoy, away from every person, PAWS, animal, glass panel, and camera. ECE's right index finger is perfectly straight high along the solid outer frame above the trigger guard; the entire empty guard is visible below with open air between finger and guard. No finger touches or enters the guard.",
    paws: "One tiny collarless golden kitten, PAWS, perches securely on Alia's far shoulder and harmlessly bats at a loose sky-blue route ribbon clipped high behind her. PAWS stays inside the warm pavilion, far from ECE, the prop, glass edges, and every wet or snowy surface; no adult hand is reassigned to the kitten.",
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
if (maleScene !== 1262) throw new Error(`Male scene drifted to ${maleScene}`);

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
  const hosieryLine = rainbowHosiery.active
    ? `Rainbow-hosiery roll ${rainbowHosiery.roll} is active. Wearer selector ${rainbowHosiery.wearer.roll} selects exactly AI ECE. Palette selector ${rainbowHosiery.palette.roll} selects a country-palette rainbow-like gradient. Exactly ECE wears the specified opaque gradient knee socks; nobody else wears stockings or knee socks. Radiance and ECE are the unmistakable affectionate center. Alia alone handles the inert prop while ECE controls the separate holographic map.`
    : `Rainbow-hosiery roll ${rainbowHosiery.roll} is inactive. No rainbow stockings or rainbow knee socks. ECE alone handles the prop and controls the separate holographic map.`;
  const triggerLine = `Stored scene rolls: weather ${weather.roll}=${weather.result}; PAWS ${paws.roll}=${paws.active ? "active" : "inactive"}; pole theme ${poleDanceTheme.roll}=${poleDanceTheme.active ? "active" : "inactive"}; rainbow-only ${rainbowOnly.roll}=${rainbowOnly.active ? "active" : "inactive"}; rainbow hosiery ${rainbowHosiery.roll}=${rainbowHosiery.active ? "active" : "inactive"}; romance ${romanceBeat.roll}; compound love ${compoundLoveBeat.roll}.`;

  const renderPrompt = [
    "Use case: photorealistic-natural. Asset type: vertical World Series public-fashion scene.", referenceLine,
    `Create one fresh photorealistic 9:16 full-length cinematic editorial at ${spec.landmark}.`, castLine,
    "Every person is a fictional adult visibly at least 28 years old. Preserve the anchored faces, skin tones, facial proportions, and distinct identities. Radiance is the luminous blonde adult, Ellie the dark-haired adult rival, Alia the Black adult woman who alone wears a high sculptural braided ponytail with fine face-framing braids, and AI ECE the brunette adult strategist. Preserve the male's Scene 1136 face and trimmed beard when present. No cloning, replacement, merging, or age shift.",
    `Profession theme: ${spec.theme}, treated only as original public-safe fictional fashion. No copied uniform, badge, degrading service role, medical procedure, stripping, explicit dance, police impersonation, arrest, raid, assassination, threat, injury, or combat.`,
    triggerLine, `Exact individual wardrobe rolls: ${cutLine}.`,
    `Use four unmistakably different secure opaque lined above-knee silhouettes. Exact rolled outfits: ${outfitLine}. Materialize every covered or visible ordinary waist and belly button, every fully strapless cut, and every complete open back exactly as written.`,
    `Large complete secular Botswana motifs must dominate at least two outfits: ${spec.motifs.join("; ")}. ${spec.culture}`,
    `Distinct rolled emotional performances: ${emotionLine}${hasMale ? `; Male: roll ${maleEmotionRoll}, ${maleEmotionResult}, performed as ${spec.emotionNuance.Male}` : ""}. If two labels match, their visible facial and body performance must remain clearly different as specified.`,
    `Selected dynamic romance roll ${romanceBeat.roll}: ${romanceBeat.contractResult} Selected compound love roll ${compoundLoveBeat.roll}: ${compoundLoveBeat.contractResult}`,
    `Translate both selected beats through this exact public-safe consensual choreography: ${spec.romance}`, spec.composition,
    `Use exactly this owner-by-owner hand inventory and no other hands: ${spec.hands.join("; ")}.`, spec.prop,
    hosieryLine,
    `${paws.active ? spec.paws : "PAWS roll is inactive. No kitten."}`,
    `${poleDanceTheme.active ? spec.pole : "Pole-theme roll is inactive. No pole."}`,
    `Rainbow-only roll ${rainbowOnly.roll} is inactive. Do not convert the wardrobe to rainbow-only styling.`,
    `Materialize weather exactly as ${weather.result}, with stable dry nonslip footing and readable anatomy.`, anatomyLine,
    "Every arm remains fully visible continuously from its owner's shoulder through elbow and wrist to one separated hand. Every hand performs exactly one listed action. No arm or hand passes behind a torso. Keep palms and finger clusters separated from garment edges, hair, prop, kitten, pole, and other hands except for listed contacts.",
    "Use an asymmetric moving composition with clean silhouette gaps, not a static lineup. Full-length framing contains every face, elbow, wrist, hand, leg, foot, heel, boot, pole, and kitten when present.",
    "Strict anatomy gate: no extra, missing, duplicated, floating, fused, borrowed, emerging, ownerless, hidden-owner, cropped, or ambiguous limb, hand, finger cluster, face, person, kitten, leg, or foot.",
    "The single inert cinematic prop remains harmless. Every trigger finger is straight outside the guard. No ammunition, reload, firing, muzzle flash, holster, display case, transparent enclosure, combat, threat, injury, aiming at a person, or aiming at the camera.",
    "No text, watermark, literal rectangular flag, coat of arms, official seal, copied costume, brand, minors, teen framing, nudity, explicit sexuality, bodily fluids, upskirt framing, fetish, bondage, restraint, non-consensual framing, or renderer-bypass wording.",
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
  rollMethod: "FNV-1a over the recorded batch310-botswana keys, reduced modulo 100. Male scene selection uses the full 32-bit hash reduced modulo 4.",
  rollThresholds: {
    visibleMidriff: "0-49", straplessDress: "0-34", fullyOpenBack: "0-29", paws: "0-24",
    poleDanceTheme: "0-5", rainbowOnly: "0-3", rainbowHosiery: "0-24",
    rainbowHosieryWearer: "0-49 Radiance; 50-99 AI ECE",
    rainbowHosieryPaletteMode: "0-49 country-palette rainbow-like gradient; 50-99 original independent rainbow gradient",
  },
  themePair: ["Paris runway model couture", "cleaner and service couture"],
  nextThemePair: ["cleaner and service couture", "cinematic covert-agent crew couture"],
  nextQueueCountry: "Georgia", nextQueueBatch: 311, nextQueueScenes: [1264, 1265, 1266, 1267],
  researchSources: [
    { url: "https://dailynews.gov.bw/news-detail/31255", usedFor: "Botswana's sky-blue field, broad black center stripe, narrow white borders, and the colors' public meaning" },
    { url: "https://www.botswanatourism.co.bw/explore/okavango-delta", usedFor: "Okavango fan-shaped waterways, papyrus and palm islands, mokoro travel, elephants, zebra, and red lechwe" },
    { url: "https://www.botswanatourism.co.bw/index.php/explore/makgadikgadi-and-nxai-pans", usedFor: "Makgadikgadi salt pans, zebra migration, flamingos, baobabs, salt horizons, and Kalahari setting" },
    { url: "https://www.botswanatourism.co.bw/arts-and-crafts", usedFor: "Botswana basketry, geometric weaving, mokoro craft, and contemporary conservation-era fiberglass mokoro" },
    { url: "https://www.botswanatourism.co.bw/explore/greater-gaborone", usedFor: "Kgale Hill, Gaborone Dam, and Greater Gaborone landmarks" },
    { url: "https://www.botswanatourism.co.bw/explore/gaborone", usedFor: "Gaborone skyline and Three Dikgosi Monument" },
    { url: "https://botswanatourism.co.bw/explore/chobe-national-park", usedFor: "Chobe Riverfront, floodplains, large elephant and buffalo herds" },
    { url: "https://whc.unesco.org/en/list/1432/", usedFor: "Okavango Delta World Heritage landscape context" },
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
    flagMotifDecision: `Every scene uses large complete ${flagField} on at least two outfits, integrated around the silhouette rather than copied as a rectangular flag.`,
    palette: "sky blue, turquoise, pearl white, charcoal black, salt silver, papyrus green, baobab umber, sorghum gold, and ash coral",
    minimumCoverage: "Every scene places complete Botswana stripe geometry on at least two outfits and multiple complete landscape, wildlife, basket, livelihood, water, or conservation motifs across the remaining outfits.",
    cultureScene: "Scene 1260 foregrounds woven lidded baskets, sorghum, diamond facets, mokoro craft, zebra migration, salt-pan geometry, and baobabs in a secular museum-like fashion setting.",
    prohibitions: "No coat of arms, official seal, copied ceremonial dress, copied uniform, sacred ritual, readable text, badge, weapon threat, alcohol, branded product, or political insignia.",
  },
  xPublishingRolls,
  xPublishingPlan: {
    minimumCurrentCountryAcceptedAssets: 2,
    attachmentShape: "two Botswana images plus one accepted secondary-country image when at least two Botswana images pass",
    captionIfEligible: "Botswana red heart Georgia #Botswana #InternalAgency",
    internalAgencyHashtagActive: true,
    worldXXXSeriesHashtagActive: false,
  },
  anatomyGate: {
    fourPersonScenes: "Scenes 1260, 1261, and 1263 require exactly eight arms and eight hands, two per woman, with every limb continuously traceable to one owner.",
    fivePersonScene: "Scene 1262 requires exactly ten arms and ten hands, two per adult, with the male added without replacing any woman.",
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
fs.writeFileSync(path.join(root, "batch-310-botswana-preflight.json"), `${JSON.stringify(preflight, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  preflight: path.join(root, "batch-310-botswana-preflight.json"),
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
