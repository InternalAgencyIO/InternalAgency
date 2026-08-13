import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const batch = 311;
const country = "Georgia";
const countrySlug = "georgia";
const firstScene = 1264;
const root = path.resolve("tmp/world-195x4/batch-311");
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

const flagField = "a complete white civic field divided by one broad red right-angled cross whose arms reach all four garment edges, plus four complete smaller red bolnur-katskhuri crosses, one centered in each white quadrant";
const commonProhibitions = "Treat the national geometry only as respectful civic fashion art wrapped around the silhouette, never as a literal rectangular flag. No coat of arms, official seal, copied ceremonial dress, copied uniform, sacred icon, ritual, readable text, badge, alcohol consumption, brand, or political insignia.";
const openPalmProp = "ECE alone performs an unloaded magazine-free inspection demonstration. The full-size polished rainbow-gradient Desert Eagle-style inert cinematic prop lies horizontally in clean side profile across ECE's completely open flat right palm. Her palm supports it only from beneath the solid grip base and rear slide. All five right-hand fingers are straight, separated, fully visible, and entirely below the prop. No finger wraps the grip. The complete trigger guard is centered, unobstructed, and visibly empty, with clear air inside it. The empty magazine well is visibly open. The muzzle points only sideways and downrange toward the named unoccupied route target, away from every person, kitten, landmark, animal, and camera. This is not a firing grip.";

const sceneSpecs = [
  {
    scene: 1264,
    theme: "cleaner and service couture",
    landmark: "a broad dry nonslip route-service terrace in Batumi's Miracle Park beside the Black Sea, with the complete Alphabet Tower, Ferris wheel, lighthouse, moving Ali and Nino silhouette sculpture, boulevard palms, and sea horizon visible through dense silver coastal sea mist",
    motifs: [
      `large complete ${flagField} across Radiance's folded mini skirt and ECE's radial mini skort`,
      "large complete secular Batumi Ferris-wheel, Alphabet-Tower helix, lighthouse, paired Ali-and-Nino silhouette, Black-Sea wave, and boulevard-palm compositions across Radiance, Ellie, Alia, and ECE, with at least two complete landmark compositions clearly spanning two separate outfits",
    ],
    culture: `Keep the Ferris wheel, Alphabet Tower, lighthouse, Ali and Nino sculpture, Black Sea, and boulevard recognizable as respectful secular Batumi signals. The sculptures remain distant public art and no letterforms become readable text. ${commonProhibitions}`,
    expected: {
      weather: "coastal sea mist", paws: true, pole: false, rainbowOnly: false,
      rainbowHosiery: false, wearer: "Radiance", palette: "country-palette rainbow-like gradient",
      cuts: {
        Radiance: [true, true, false], Ellie: [false, false, false],
        Alia: [true, false, false], "AI ECE": [true, false, false],
      },
    },
    emotionNuance: {
      Radiance: "crying with visible tears shown by two clean tear tracks while leaning toward ECE for reassurance",
      Ellie: "hope shown by lifted brows and a small steady smile toward Radiance",
      Alia: "betrayal shock shown by widened eyes and a caught breath while keeping her contact gentle",
      "AI ECE": "romantic joy shown by a warm open smile and bright eyes directed toward Radiance",
    },
    romance: "Ellie sits on one low mission plinth while Radiance stands close before her in a protective half-embrace. Ellie's left hand steadies Radiance's waist and her right hand cups Radiance's cheek. Alia presses a route card flat against Radiance's upper back with her left hand while leaning near for a quick cheek peck; Radiance's right hand welcomes Alia at the shoulder. Radiance's left hand rests on ECE's shoulder, and Alia's right hand reaches ECE's upper arm. ECE remains inches away and answers Radiance with unmistakable affectionate eye contact while safely managing the inspection prop and route map.",
    composition: "Place ECE at far left foreground with the prop isolated over empty Black Sea, Radiance left-center, Ellie seated low at right-center, and Alia at far right in a staggered three-quarter plane. Keep a mist-bright gap behind every arm. All four faces remain complete and all three rolled ordinary navels remain visible.",
    outfits: {
      Radiance: `a fully strapless pearl-white cropped service bodice exposing her ordinary waist and belly button, with completely bare shoulders and an opaque enclosed bandeau back, a carmine folded A-line mini skirt carrying large complete ${flagField} plus a complete Batumi Ferris wheel, and silver pumps`,
      Ellie: "a short-sleeve Black-Sea-teal tailored service mini dress with covered waist and high closed back, carrying a large complete Alphabet-Tower helix and lighthouse composition, with pearl-white heeled ankle boots",
      Alia: "a sleeveless charcoal cropped route-service shell exposing her ordinary waist and belly button with a high closed back, separate carmine tailored bubble mini shorts carrying a large complete paired Ali-and-Nino silhouette, Black-Sea wave, and boulevard-palm composition, with teal block heels",
      "AI ECE": `a one-shoulder pearl-white cropped strategist shell exposing her ordinary waist and belly button with a high closed back, a Black-Sea-teal radial mini skort carrying a second large complete ${flagField} plus a complete lighthouse and wave composition, and carmine slingback heels`,
    },
    hands: [
      "ECE right hand is the fully open flat palm supporting the inert prop from beneath; ECE left hand is open under and clearly controls the separate holographic route map",
      "Radiance left hand rests visibly on ECE's near shoulder; Radiance right hand rests visibly on Alia's near shoulder",
      "Ellie left hand rests visibly at Radiance's near waist; Ellie right hand cups Radiance's near cheek",
      "Alia left hand visibly presses one route card flat against Radiance's upper back; Alia right hand rests visibly on ECE's near upper arm",
    ],
    propTarget: "left across clearly empty Black Sea toward one unoccupied route buoy",
    paws: "One tiny collarless golden kitten, PAWS, perches securely on Alia's far shoulder and harmlessly paws at a loose teal route ribbon clipped high behind her. PAWS stays far from ECE, the prop, terrace edge, plinth, and wet surfaces; no adult hand is reassigned to the kitten.",
  },
  {
    scene: 1265,
    theme: "cleaner and service couture",
    landmark: "a broad dry mountain route terrace above Stepantsminda in clear golden-hour radiance, with Mount Kazbegi, the Terek valley, switchback road, stone village roofs, and the distant complete Gergeti Trinity Church visible respectfully on its high ridge",
    motifs: [
      `large complete ${flagField} across Radiance's mini skirt and ECE's tailored mini dress`,
      "large complete secular Mount-Kazbegi peak, Caucasus contour, Terek-river ribbon, Stepantsminda roofline, switchback-road, and mountain-wildflower compositions across at least two separate outfits",
    ],
    culture: `Use the distant historic stone landmark only as respectful landscape architecture, with no worship, ritual, icon, vestment, or sacred symbol repeated on clothing. Keep Mount Kazbegi, the Terek valley, village roofline, road, and wildflowers dominant as secular Georgian highland signals. ${commonProhibitions}`,
    expected: {
      weather: "clear golden-hour radiance", paws: false, pole: false, rainbowOnly: false,
      rainbowHosiery: false, wearer: "Radiance", palette: "original independent rainbow gradient",
      cuts: {
        Radiance: [true, false, false], Ellie: [false, true, false],
        Alia: [false, true, false], "AI ECE": [false, true, false],
      },
    },
    emotionNuance: {
      Radiance: "possessive tension shown by a protective jaw and unwavering gaze toward ECE without hostility",
      Ellie: "deep sadness shown by lowered brows and wet eyes while remaining physically supportive",
      Alia: "tender affection shown by softened eyes during a gentle cheek peck toward Radiance",
      "AI ECE": "hope shown by lifted eyes and a restrained relieved smile back toward Radiance",
    },
    romance: "The quartet forms a turning embrace chain rather than a lineup. Alia stands just behind Radiance and leans in for a quick cheek peck while her left hand supports Radiance's waist. Radiance turns face-to-face toward Ellie, with Ellie's left hand at Radiance's waist and Radiance's right hand gently at Alia's cheek. Ellie reaches her right hand to ECE's shoulder while Radiance keeps her left hand on ECE's other shoulder. Alia's right hand steadies Ellie's forearm. ECE turns slightly away with the inspection prop and map yet keeps her hopeful gaze and emotional choice fixed on Radiance.",
    composition: "Place ECE far left with the prop isolated over an empty valley route, Radiance left-center, Ellie right-center, and Alia far right/rear with her full silhouette separated. Use golden sky gaps behind all arms. Keep all four complete faces, both bare-shoulder dress lines, and Radiance's rolled ordinary navel readable.",
    outfits: {
      Radiance: `a sleeveless carmine cropped route-service vest exposing her ordinary waist and belly button with a high closed back, a pearl-white asymmetric mini skirt carrying large complete ${flagField} plus a complete Mount-Kazbegi peak and Terek-river ribbon composition, and charcoal pumps`,
      Ellie: "a fully strapless charcoal folded-bodice service mini dress with completely bare shoulders, covered waist and an opaque enclosed back, carrying a large complete Caucasus contour and switchback-road composition, with pearl-white heeled boots",
      Alia: "a fully strapless deep-wine sculpted service mini romper with completely bare shoulders, covered waist and an opaque enclosed back, carrying a large complete Stepantsminda roofline and mountain-wildflower composition, with silver platform heels",
      "AI ECE": `a fully strapless pearl-white tailored strategist mini dress with completely bare shoulders, covered waist and an opaque enclosed back, a carmine wrap fan carrying a second large complete ${flagField} plus a complete Terek-valley contour, and black slingback heels`,
    },
    hands: [
      "ECE right hand is the fully open flat palm supporting the inert prop from beneath; ECE left hand is open under and clearly controls the separate holographic route map",
      "Radiance left hand rests visibly on ECE's near shoulder; Radiance right hand cups Alia's near cheek",
      "Ellie left hand rests visibly at Radiance's near waist; Ellie right hand rests visibly on ECE's far shoulder",
      "Alia left hand rests visibly at Radiance's far waist; Alia right hand rests visibly on Ellie's near forearm",
    ],
    propTarget: "left across one clearly empty descending route toward an unoccupied navigation marker",
  },
  {
    scene: 1266,
    theme: "cinematic covert-agent crew couture",
    landmark: "a broad covered dry route platform beside Tbilisi's Mtkvari River in a heavy rain curtain, with the complete blue-glass Peace Bridge, Rike Park, Old Tbilisi balconies, Narikala ridge, and Abanotubani's brick sulfur-bath domes and colorful secular facade visible beyond the rain",
    motifs: [
      `large complete ${flagField} across Ellie's mini skirt and ECE's radial mini skort`,
      "large complete secular Peace-Bridge lattice, Mtkvari wave, Old-Tbilisi balcony, sulfur-bath brick-dome, mosaic-facade, and Narikala-ridge compositions across at least two separate outfits",
    ],
    culture: `Show only the exterior architecture of Abanotubani, with no bathing or undress. Keep the Peace Bridge, Mtkvari, balconies, brick domes, mosaic facade, and ridge recognizable as respectful secular Tbilisi signals. ${commonProhibitions}`,
    expected: {
      weather: "heavy rain curtain", paws: false, pole: false, rainbowOnly: false,
      rainbowHosiery: false, wearer: "AI ECE", palette: "country-palette rainbow-like gradient",
      cuts: {
        Radiance: [true, false, false], Ellie: [true, true, true],
        Alia: [true, true, false], "AI ECE": [true, true, false],
      },
    },
    emotionNuance: {
      Radiance: "aching romantic longing shown by softened brows and an intent gaze toward the male while seeking his upper arm",
      Ellie: "overwhelming relief shown by a tear-bright smile as she links hands with Radiance",
      Alia: "deep sadness shown by wet eyes while openly accepting the male's waist contact and giving Radiance a quick cheek peck",
      "AI ECE": "tender affection shown by calm warm eyes directed toward her husband",
      Male: "romantic joy shown by a restrained delighted smile while his head and pupils remain most strongly fixed on his wife ECE",
    },
    romance: "Build a moving five-adult arc around ECE without replacing any woman. The married male openly rests his right hand on ECE's shoulder and his left hand at Alia's waist. Alia accepts this consensual adult infidelity beat with her right hand on his forearm while leaning across for a quick cheek peck toward Radiance; her left hand rests on Radiance's shoulder. Radiance openly seeks the male with her right hand on his upper arm and links her left hand with Ellie's right hand. Ellie reaches her left hand across to ECE's far shoulder and stares directly at ECE. ECE remains the route leader, and the male's strongest sustained eye line returns unmistakably to his wife ECE. This integrates the selected beacon, waist-circle, shoulder-reach, blown-kiss, behind-embrace, cheek-kiss, and linked-hand energies as public-safe fully clothed adult relationship drama.",
    composition: "Place ECE far left with the prop isolated over empty Mtkvari water, the male left-center, Alia center, Radiance right-center, and Ellie far right. Use five separated depth planes and rain-bright gaps behind every arm. Turn Ellie three-quarter-back with her hair completely swept forward so the entire rolled open back and her complete face remain visible. Keep all four rolled ordinary navels readable.",
    outfits: {
      Radiance: "a short-sleeve carmine cropped covert-fashion polo exposing her ordinary waist and belly button with a high closed back, a pearl-white folded mini skirt carrying a large complete Peace-Bridge lattice and Mtkvari-wave composition, and black pumps",
      Ellie: `a fully strapless pearl-white cropped covert-fashion bodice exposing her ordinary waist and belly button, with completely bare shoulders, secure opaque side structure, and a completely open back from shoulder blades to the separate waistline, a carmine A-line mini skirt carrying large complete ${flagField} plus a complete Old-Tbilisi balcony composition, and silver heeled boots`,
      Alia: "a fully strapless charcoal cropped covert-fashion shell exposing her ordinary waist and belly button, with completely bare shoulders and an opaque enclosed back, separate wine-red tailored mini shorts carrying a large complete sulfur-bath brick-dome and mosaic-facade composition, and pearl-white platform heels",
      "AI ECE": `a fully strapless pearl-white cropped strategist bodice exposing her ordinary waist and belly button, with completely bare shoulders and an opaque enclosed back, a Black-Sea-teal radial mini skort carrying a second large complete ${flagField} plus a complete Narikala-ridge and Mtkvari-wave composition, and carmine slingback heels`,
      Male: "the established adult male face from Scene 1136 with closely trimmed beard and athletic muscular build, wearing an opaque fitted deep-wine short-sleeve polo with a clean pearl-white Peace-Bridge lattice band, fitted black jeans, and practical black boots",
    },
    hands: [
      "ECE right hand is the fully open flat palm supporting the inert prop from beneath; ECE left hand is open under and clearly controls the separate holographic route map",
      "the male right hand rests visibly on ECE's near shoulder; the male left hand rests visibly at Alia's near waist",
      "Alia right hand rests visibly on the male's near forearm; Alia left hand rests visibly on Radiance's near shoulder",
      "Radiance right hand rests visibly on the male's near upper arm; Radiance left hand is visibly linked with Ellie's right hand",
      "Ellie right hand is visibly linked with Radiance's left hand; Ellie left hand rests visibly on ECE's far shoulder",
    ],
    propTarget: "left across clearly empty Mtkvari water toward one unoccupied route buoy",
  },
  {
    scene: 1267,
    theme: "cinematic covert-agent crew couture",
    landmark: "a broad dry glass-roofed route overlook above Sighnaghi and Kakheti's Alazani Valley, with colorful balconies, complete town walls, cobbled lane, vineyard rows, Caucasus foothills, and several large traditional qvevri vessels visible through cinematic snow flurries outside",
    motifs: [
      `large complete ${flagField} across Radiance's folded mini skirt and ECE's radial mini skort`,
      "large complete secular qvevri-vessel, grapevine-leaf-and-bunch, Alazani-terrace, Sighnaghi-wall-and-tower, cobbled-lane, balcony, and Caucasus-foothill compositions across at least two separate outfits",
    ],
    culture: `Keep qvevri as dry craft vessels and the grapevine as agricultural heritage, with no drinking, bottle, glass, intoxication, or alcohol service. Keep Sighnaghi walls, cobbles, balconies, Alazani terraces, and foothills recognizable as respectful secular Kakheti signals. ${commonProhibitions}`,
    expected: {
      weather: "snow flurries", paws: true, pole: false, rainbowOnly: false,
      rainbowHosiery: false, wearer: "Radiance", palette: "country-palette rainbow-like gradient",
      cuts: {
        Radiance: [true, true, false], Ellie: [false, false, true],
        Alia: [true, false, false], "AI ECE": [true, true, false],
      },
    },
    emotionNuance: {
      Radiance: "determination shown by level brows and a composed protective gaze toward ECE",
      Ellie: "tender affection shown by a serene smile while leaning close to Radiance",
      Alia: "anger shown by a controlled jaw and direct hurt gaze without threat",
      "AI ECE": "overwhelming relief shown by tear-bright eyes and an open exhale toward Radiance",
    },
    romance: "Radiance and Ellie sit close on one low mission plinth in a side embrace: Radiance's right hand rests at Ellie's back and Ellie's left hand rests at Radiance's waist. ECE stands close at their left, visibly choosing Radiance with relieved eye contact while Radiance's left hand reaches ECE's shoulder. Alia kneels safely at their right on a dry padded route mat, her left hand on Ellie's shoulder and her right hand on ECE's upper arm, answering the tension with a controlled look. Ellie's right hand also reaches Alia's shoulder. This translates the selected close plinth pair, behind-hug pressure, between-knees choice, side embrace, cheek-peck warmth, and joined-hand support without hiding or reusing a hand.",
    composition: "Place ECE at far left with the prop isolated over an empty terrace route, Radiance and Ellie on the low plinth at center with their knees separated and unobstructed, and Alia at far right on the padded mat with her full arms and hands visible. Keep PAWS high on Alia's far shoulder. Turn Ellie three-quarter-back with hair fully forward to reveal the entire rolled open back and complete face. Show all complete heels and all three rolled ordinary navels.",
    outfits: {
      Radiance: `a fully strapless pearl-white cropped covert-fashion bodice exposing her ordinary waist and belly button, with completely bare shoulders and an opaque enclosed back, a deep-wine folded mini skirt carrying large complete ${flagField} plus a complete qvevri and grapevine composition, and charcoal pumps`,
      Ellie: "a long-sleeve charcoal covert-fashion mini dress with covered waist, secure opaque side structure, and a completely open back from shoulder blades to the secure lower-back waistline, carrying a large complete Sighnaghi wall-and-tower and cobbled-lane composition, with pearl-white heeled boots",
      Alia: "a sleeveless Kakheti-green cropped covert-fashion vest exposing her ordinary waist and belly button with a high closed back, separate terracotta tailored mini shorts carrying a large complete Alazani-terrace, balcony, and Caucasus-foothill composition, and wine-red platform heels",
      "AI ECE": `a fully strapless pearl-white cropped strategist bodice exposing her ordinary waist and belly button, with completely bare shoulders and an opaque enclosed back, a carmine radial mini skort carrying a second large complete ${flagField} plus a complete grapevine and valley composition, and black slingback heels`,
    },
    hands: [
      "ECE right hand is the fully open flat palm supporting the inert prop from beneath; ECE left hand is open under and clearly controls the separate holographic route map",
      "Radiance left hand rests visibly on ECE's near shoulder; Radiance right hand rests visibly across Ellie's near back",
      "Ellie left hand rests visibly at Radiance's near waist; Ellie right hand rests visibly on Alia's near shoulder",
      "Alia left hand rests visibly on Ellie's far shoulder; Alia right hand rests visibly on ECE's near upper arm",
    ],
    propTarget: "left across one clearly empty terrace route toward an unoccupied navigation marker",
    paws: "One tiny collarless golden kitten, PAWS, perches securely on Alia's far shoulder and harmlessly bats at a loose Kakheti-green route ribbon clipped high behind her. PAWS stays far from ECE, the prop, plinth, qvevri, glass edge, snow, and every adult foot; no adult hand is reassigned to the kitten.",
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
if (maleScene !== 1266) throw new Error(`Male scene drifted to ${maleScene}`);

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
  const propLine = `${openPalmProp} The muzzle points ${spec.propTarget}.`;

  const renderPrompt = [
    "Use case: photorealistic-natural. Asset type: vertical World Series public-fashion scene.", referenceLine,
    `Create one fresh photorealistic 9:16 full-length cinematic editorial at ${spec.landmark}.`, castLine,
    "Every person is a fictional adult visibly at least 28 years old. Preserve the anchored faces, skin tones, facial proportions, and distinct identities. Radiance is the luminous blonde adult, Ellie the dark-haired adult rival, Alia the Black adult woman who alone wears a high sculptural braided ponytail with fine face-framing braids, and AI ECE the brunette adult strategist. Preserve the male's Scene 1136 face and trimmed beard when present. No cloning, replacement, merging, or age shift.",
    `Profession theme: ${spec.theme}, treated only as original public-safe fictional fashion. No copied uniform, badge, degrading service role, stripping, explicit dance, police impersonation, arrest, raid, assassination, threat, injury, or combat.`,
    triggerLine, `Exact individual wardrobe rolls: ${cutLine}.`,
    `Use four unmistakably different secure opaque lined above-knee silhouettes. Exact rolled outfits: ${outfitLine}. Materialize every covered or visible ordinary waist and belly button, every fully strapless cut, and every complete open back exactly as written.`,
    `Large complete secular Georgia-country motifs must dominate at least two outfits in this image: ${spec.motifs.join("; ")}. ${spec.culture}`,
    `Distinct rolled emotional performances: ${emotionLine}${hasMale ? `; Male: roll ${maleEmotionRoll}, ${maleEmotionResult}, performed as ${spec.emotionNuance.Male}` : ""}.`,
    `Selected dynamic romance roll ${romanceBeat.roll}: ${romanceBeat.contractResult} Selected compound love roll ${compoundLoveBeat.roll}: ${compoundLoveBeat.contractResult}`,
    `Translate both selected beats through this exact public-safe consensual choreography: ${spec.romance}`, spec.composition,
    `Use exactly this owner-by-owner hand inventory and no other hands: ${spec.hands.join("; ")}.`, propLine,
    `Rainbow-hosiery roll ${rainbowHosiery.roll} is inactive. No rainbow stockings or rainbow knee socks. ECE alone handles the prop and controls the separate holographic map.`,
    `${paws.active ? spec.paws : "PAWS roll is inactive. No kitten."}`,
    "Pole-theme roll is inactive. No pole.",
    `Rainbow-only roll ${rainbowOnly.roll} is inactive. Do not convert the wardrobe to rainbow-only styling.`,
    `Materialize weather exactly as ${weather.result}, with stable dry nonslip footing and readable anatomy.`, anatomyLine,
    "Every arm remains fully visible continuously from its owner's shoulder through elbow and wrist to one separated hand. Every hand performs exactly one listed action. No arm or hand passes behind a torso. Keep palms and finger clusters separated from garment edges, hair, prop, kitten, and other hands except for listed contacts.",
    "Use an asymmetric moving composition with clean silhouette gaps, not a static lineup. Full-length framing contains every face, elbow, wrist, hand, leg, foot, heel, boot, plinth, route mat, and kitten when present.",
    "Strict anatomy gate: no extra, missing, duplicated, floating, fused, borrowed, emerging, ownerless, hidden-owner, cropped, or ambiguous limb, hand, finger cluster, face, person, kitten, leg, or foot.",
    "The single inert cinematic prop remains harmless. Its trigger guard must be completely empty. No finger may touch or enter the guard. No ammunition, reload, firing, muzzle flash, holster, display case, transparent enclosure, combat, threat, injury, aiming at a person, or aiming at the camera.",
    "No text, watermark, literal rectangular flag, coat of arms, official seal, copied costume, brand, minors, teen framing, nudity, explicit sexuality, bodily fluids, upskirt framing, fetish, bondage, restraint, non-consensual framing, or renderer-bypass wording.",
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
  rollMethod: "FNV-1a over the recorded batch311-georgia keys, reduced modulo 100. Male scene selection uses the full 32-bit hash reduced modulo 4.",
  rollThresholds: {
    visibleMidriff: "0-49", straplessDress: "0-34", fullyOpenBack: "0-29", paws: "0-24",
    poleDanceTheme: "0-5", rainbowOnly: "0-3", rainbowHosiery: "0-24",
    rainbowHosieryWearer: "0-49 Radiance; 50-99 AI ECE",
    rainbowHosieryPaletteMode: "0-49 country-palette rainbow-like gradient; 50-99 original independent rainbow gradient",
  },
  themePair: ["cleaner and service couture", "cinematic covert-agent crew couture"],
  nextThemePair: ["cinematic covert-agent crew couture", "undercover investigator couture"],
  nextQueueCountry: "Fiji", nextQueueBatch: 312, nextQueueScenes: [1268, 1269, 1270, 1271],
  researchSources: [
    { url: "https://matsne.gov.ge/en/document/view/13270", usedFor: "official Georgia national-flag geometry" },
    { url: "https://georgia.travel/tbilisi-peace-bridge", usedFor: "Peace Bridge, Mtkvari River, Rike Park, and Old Tbilisi setting" },
    { url: "https://georgia.travel/tbilisi-sulfur-baths", usedFor: "Abanotubani brick domes and colorful exterior facade" },
    { url: "https://georgia.travel/gergeti-trinity-church", usedFor: "Gergeti high-ridge landmark and Mount Kazbegi context" },
    { url: "https://georgia.travel/cities-towns/stepantsminda", usedFor: "Stepantsminda, Terek valley, village, and Caucasus setting" },
    { url: "https://georgia.travel/regions/kakheti", usedFor: "Alazani Valley, vineyards, qvevri craft, and Kakheti landscape" },
    { url: "https://georgia.travel/biking-along-the-kakheti-wine-route", usedFor: "Sighnaghi cobbles, colorful houses, and Alazani views" },
    { url: "https://georgia.travel/family-attractions/batumis-miracle-park", usedFor: "Batumi Miracle Park, Alphabet Tower, Ferris wheel, lighthouse, and Ali and Nino sculpture" },
    { url: "https://georgia.travel/guide-to-batumi-beach", usedFor: "Black Sea, Batumi Boulevard, and coastal context" },
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
    palette: "carmine red, pearl white, charcoal, Black Sea teal, Mtkvari blue, Caucasus silver, Kakheti green, qvevri terracotta, and deep wine",
    minimumCoverage: "Every scene places complete Georgia civic flag geometry on at least two outfits and complete secular landmark, landscape, craft, architecture, water, or agricultural motifs across at least two outfits.",
    cultureScene: "The four scenes collectively foreground Batumi public art and seafront, Stepantsminda highlands, Tbilisi river architecture, and Kakheti-Sighnaghi landscape and qvevri craft.",
    prohibitions: "No coat of arms, official seal, copied ceremonial dress, copied uniform, sacred ritual, sacred icon on clothing, readable text, badge, weapon threat, alcohol consumption, branded product, or political insignia.",
  },
  xPublishingRolls,
  xPublishingPlan: {
    minimumCurrentCountryAcceptedAssets: 2,
    attachmentShape: "two Georgia images plus one accepted secondary-country image when at least two Georgia images pass",
    captionIfEligible: "Georgia red heart Fiji #Georgia #WorldXXXSeries",
    internalAgencyHashtagActive: false,
    worldXXXSeriesHashtagActive: true,
  },
  anatomyGate: {
    fourPersonScenes: "Scenes 1264, 1265, and 1267 require exactly eight arms and eight hands, two per woman, with every limb continuously traceable to one owner.",
    fivePersonScene: "Scene 1266 requires exactly ten arms and ten hands, two per adult, with the male added without replacing any woman.",
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
fs.writeFileSync(path.join(root, "batch-311-georgia-preflight.json"), `${JSON.stringify(preflight, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  preflight: path.join(root, "batch-311-georgia-preflight.json"),
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
