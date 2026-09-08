import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const batch = 309;
const country = "Uruguay";
const countrySlug = "uruguay";
const firstScene = 1256;
const root = path.resolve("tmp/world-195x4/batch-309");
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

const flagField = "a complete gold Sun of May with one full round human face and sixteen alternating straight and wavy rays, over a complete white field crossed by nine alternating sky-blue and white horizontal stripes";
const commonProhibitions = "Use the complete Sun of May and stripe geometry as national fashion art, not a rectangular flag. No coat of arms, official seal, copied ceremonial garment, copied uniform, sacred ritual, readable text, badge, alcohol, brand, or political insignia.";

const sceneSpecs = [
  {
    scene: 1256,
    theme: "adult nightlife dance-performance couture",
    landmark: "a broad dry covered promenade deck beside Montevideo's Rambla after rain, with the Rio de la Plata, Pocitos curve, the Ciudad Vieja skyline and Palacio Salvo visible beneath a complete double rainbow",
    motifs: [
      `large complete ${flagField} across Radiance's pleated shorts and ECE's tailored romper`,
      "large complete mate-gourd, silver-bombilla, thermos, three-candombe-drum, Rambla-wave, football-panel, Palacio-Salvo, and chivito fields across Ellie's skirt and Alia's dress",
    ],
    culture: `An unattended dry culture display well behind the cast holds one mate gourd with silver bombilla, one upright thermos, three painted candombe drums in chico, repique, and piano sizes, one football, one plated chivito, and a small tray of tortas fritas. Nobody eats, drinks, plays a drum, or handles the football. ${commonProhibitions}`,
    expected: {
      weather: "double rainbow after rain", paws: true, pole: false, rainbowOnly: false,
      rainbowHosiery: false, wearer: "AI ECE", palette: "original independent rainbow gradient",
      cuts: {
        Radiance: [true, false, false], Ellie: [true, true, true],
        Alia: [false, false, true], "AI ECE": [true, true, false],
      },
    },
    emotionNuance: {
      Radiance: "deep sadness shown by wet eyes and a lowered mouth while accepting Alia's support",
      Ellie: "shame and social vulnerability shown by a guarded downward glance while keeping her linked hand visible",
      Alia: "startled surprise shown by lifted brows toward Radiance while remaining steady",
      "AI ECE": "anger shown by a controlled jaw and direct eyes toward Ellie without aggression",
    },
    romance: "ECE and Ellie exchange reciprocal shoulder and waist support at the left. Ellie links hands with Radiance; Radiance gives Alia a visible waist support; Alia returns one shoulder touch and one upper-back touch to Radiance. The separated chain translates the walking weave, protective touch, close greeting, vulnerable pause, and jealous glance without hiding or reusing a hand.",
    composition: "Place ECE far left with the prop isolated over empty river water, Ellie left-center, Radiance right-center, and Alia far right. Turn Ellie and Alia in opposite three-quarter-back views with hair clear so both complete open backs and all faces remain readable. Keep ECE and Radiance front-facing enough to show both rolled ordinary navels. Use sky and water gaps behind all eight arms.",
    outfits: {
      Radiance: `a sleeveless one-shoulder sky-blue cropped performance top exposing her ordinary waist and belly button with a high closed back, separate white fan-pleated tailored mini shorts carrying large complete ${flagField}, and gold pumps`,
      Ellie: "a fully strapless white sculpted cropped bodice exposing her ordinary waist and belly button, with completely bare shoulders and a completely open back from shoulder blades to the secure waistline, a separate cobalt A-line mini skirt carrying large mate-gourd, silver-bombilla, thermos, and Rambla-wave fields, and black heeled ankle boots",
      Alia: "a sleeveless cobalt halter tulip mini dress with covered waist and a completely open back from shoulder blades to the secure waistline, large three-candombe-drum, football-panel, Palacio-Salvo, chivito, and torta-frita fields, and white platform heels",
      "AI ECE": `a fully strapless gold-edged sky-blue cropped peplum exposing her ordinary waist and belly button with completely bare shoulders and a high closed back, separate fitted white tailored mini romper carrying a second large complete ${flagField}, and cobalt slingback heels`,
    },
    hands: [
      "ECE right hand alone holds the inert prop; ECE left hand rests visibly on Ellie's near shoulder",
      "Ellie left hand rests visibly at ECE's near waist; Ellie right hand links visibly with Radiance's left hand",
      "Radiance left hand links visibly with Ellie's right hand; Radiance right hand rests visibly at Alia's near waist",
      "Alia left hand rests visibly on Radiance's near shoulder; Alia right hand rests visibly on Radiance's upper back",
    ],
    prop: "ECE alone holds the full-size polished rainbow-gradient Desert Eagle-style inert cinematic prop in her right hand in clean side profile at the far-left edge. The horizontal muzzle points only left across clearly empty Rio de la Plata water toward one unoccupied route buoy, away from every person, PAWS, display, building, and camera. Her right index finger is a perfectly straight line high along the solid outer frame above the trigger guard, with the complete empty guard visible below it and open air between finger and guard. Her left hand stays off the prop. A separate holographic route map floats hands-free beside her.",
    paws: "One tiny collarless golden kitten, PAWS, perches securely on Alia's far shoulder and harmlessly bats at a loose sky-blue route ribbon clipped behind her. PAWS remains far from ECE, the prop, the water edge, and wet flooring; no adult hand is reassigned to the kitten.",
  },
  {
    scene: 1257,
    theme: "adult nightlife dance-performance couture",
    landmark: "a broad dry covered observation deck above Punta del Este beneath a dramatic mammatus storm ceiling, with Playa Mansa and Playa Brava meeting at the peninsula, the lighthouse, marina yachts, skyline, and the giant sand fingers visible beyond an empty coastal route lane",
    motifs: [
      `large complete ${flagField} across Radiance's folded mini dress and ECE's column mini dress`,
      "large complete giant-sand-finger, lighthouse, yacht-sail, sea-lion, paired-coastline, Atlantic-wave, and peninsula-skyline fields across Ellie's romper and Alia's skirt",
    ],
    culture: `Keep the two distinct waters, peninsula, lighthouse, marina, skyline, and giant fingers as recognizable secular Punta del Este signals. PAWS plays only with a route ribbon. ${commonProhibitions}`,
    expected: {
      weather: "mammatus storm ceiling", paws: true, pole: false, rainbowOnly: false,
      rainbowHosiery: false, wearer: "AI ECE", palette: "country-palette rainbow-like gradient",
      cuts: {
        Radiance: [false, true, false], Ellie: [false, true, false],
        Alia: [true, true, false], "AI ECE": [false, true, false],
      },
    },
    emotionNuance: {
      Radiance: "full sobbing with clear tear tracks and trembling shoulders while remaining safely supported",
      Ellie: "awe shown by widened eyes toward the storm-lit coast and the male's linked hand",
      Alia: "tender affection shown by a warm steady gaze and supportive contact with Radiance",
      "AI ECE": "playful mischief shown by a knowing half-smile toward her husband",
      Male: "shame and social vulnerability shown by a restrained uncertain expression while his head and pupils remain fixed most strongly on ECE",
    },
    romance: "ECE and her husband exchange a clear reciprocal shoulder and upper-arm contact at the left while maintaining their strongest mutual eye line. The husband openly links hands with Ellie beside him. Ellie steadies Radiance at the shoulder; Radiance and Alia exchange reciprocal waist and shoulder support. This creates fully clothed consensual adult relationship tension, at least two clear male contacts, and a readable five-person love beat without obscuring a hand.",
    composition: "Place ECE far left with the prop isolated over empty coastal water, the male left-center, Ellie at center, Radiance right-center, and Alia far right. Keep every torso on a separate depth plane with mammatus sky gaps behind all ten arms. All four strapless silhouettes must look radically different in architecture. Keep Alia front-facing enough to show her rolled ordinary navel. Keep the husband's face in three-quarter view toward ECE so no nearer face intercepts his eye line.",
    outfits: {
      Radiance: `a fully strapless white folded fit-and-flare performance mini dress with completely bare shoulders, covered waist and high closed back, large complete ${flagField} across the full skirt, and sky-blue pumps`,
      Ellie: "a fully strapless cobalt asymmetric bubble mini romper with completely bare shoulders, covered waist and high closed back, large giant-sand-finger, paired-coastline, and Atlantic-wave fields, and gold heeled ankle boots",
      Alia: "a fully strapless sky-blue cropped architectural peplum exposing her ordinary waist and belly button with completely bare shoulders and high closed back, a separate white radial-panel mini skirt carrying lighthouse, yacht-sail, sea-lion, and peninsula-skyline fields, and cobalt platform heels",
      "AI ECE": `a fully strapless sky-blue tailored column mini dress with completely bare shoulders, covered waist, high closed back, a flared white side panel carrying a second large complete ${flagField}, and gold slingback heels`,
      Male: "the established adult male face from Scene 1136 with closely trimmed beard and athletic muscular build, wearing an opaque fitted sky-blue short-sleeve polo with a restrained gold sun seam, fitted black jeans, and practical black boots",
    },
    hands: [
      "ECE right hand alone holds the inert prop; ECE left hand rests visibly on the male's near upper arm",
      "the male right hand rests visibly on ECE's near shoulder; the male left hand links visibly with Ellie's right hand",
      "Ellie right hand links visibly with the male's left hand; Ellie left hand rests visibly on Radiance's near shoulder",
      "Radiance left hand rests visibly at Ellie's near waist; Radiance right hand rests visibly at Alia's near waist",
      "Alia left hand rests visibly on Radiance's far shoulder; Alia right hand rests visibly on Radiance's far forearm",
    ],
    prop: "ECE alone holds the full-size polished rainbow-gradient Desert Eagle-style inert cinematic prop in her right hand in clean side profile at the far-left edge. Its horizontal muzzle points only left across clearly empty coastal water toward one unoccupied route light, away from all adults, PAWS, yachts, architecture, and camera. Her right index finger is perfectly straight high along the solid outer frame above the trigger guard, with the entire empty trigger guard visible below and no finger crossing its opening. Her left hand stays off the prop. The coastal route map floats hands-free.",
    paws: "One tiny collarless golden kitten, PAWS, perches securely on Radiance's far shoulder and bats at a loose gold route ribbon clipped high behind her. PAWS stays far from ECE, the prop, every edge, and wet surfaces; no adult hand is reassigned to the kitten.",
  },
  {
    scene: 1258,
    theme: "Paris runway model couture",
    landmark: "a broad dry runway terrace in the Historic Quarter of Colonia del Sacramento at crisp blue hour, with Calle de los Suspiros cobbles, pastel Portuguese and Spanish facades, the lighthouse, city gate and wall, Plaza Mayor trees, and the Rio de la Plata visible through an empty route lane",
    motifs: [
      `large complete ${flagField} across Radiance's pleated mini shorts and ECE's tailored romper`,
      "large complete Colonia-lighthouse, city-gate, cobblestone, pastel-facade, bicycle-wheel, cheese-round, river-sail, and Plaza-Mayor-tree fields across Ellie's skirt and Alia's skirt",
    ],
    culture: `Use Colonia's UNESCO-listed historic-quarter layout, cobbles, mixed Portuguese and Spanish facade language, lighthouse, gate, wall, bicycles, river, and local cheese identity as secular fashion and backdrop signals. ${commonProhibitions}`,
    expected: {
      weather: "crisp blue hour", paws: false, pole: false, rainbowOnly: false,
      rainbowHosiery: false, wearer: "AI ECE", palette: "original independent rainbow gradient",
      cuts: {
        Radiance: [true, false, true], Ellie: [true, false, false],
        Alia: [true, false, true], "AI ECE": [true, false, false],
      },
    },
    emotionNuance: {
      Radiance: "aching romantic longing shown by a soft searching gaze toward Alia",
      Ellie: "overwhelming relief shown by relaxed brows and a released smile toward Radiance",
      Alia: "tender affection shown by a warm steady gaze while accepting Radiance's cheek touch",
      "AI ECE": "romantic joy shown by a bright open smile toward Radiance through their linked hands",
    },
    romance: "ECE links her free hand with Radiance at the left. Radiance visibly cups Alia's cheek; Alia returns one waist touch and links her other hand with Ellie; Ellie completes the chain with a clear shoulder touch toward Radiance. The open crescent translates the selected signal-ribbon contest, calming hands, face cradle, waist hug, cheek greeting, and ECE's close attention without hiding a hand.",
    composition: "Place ECE far left with the prop isolated over empty river water, Radiance left-center, Alia right-center, and Ellie far right. Turn Radiance and Alia in opposite three-quarter-back runway poses with hair clear so both complete open backs, all four faces, and all four rolled ordinary navels are visible. Keep arms separated against pastel facades, sky, or river.",
    outfits: {
      Radiance: `a sleeveless one-shoulder sky-blue cropped runway top exposing her ordinary waist and belly button, with a completely open back from shoulder blades to the secure waistline, separate white knife-pleated tailored mini shorts carrying large complete ${flagField}, and gold pumps`,
      Ellie: "a long-sleeve white cropped runway bolero exposing her ordinary waist and belly button with a high closed back, separate cobalt tulip mini skirt carrying large lighthouse, city-gate, cobblestone, and pastel-facade fields, and black heeled ankle boots",
      Alia: "a sleeveless cobalt halter cropped runway vest exposing her ordinary waist and belly button, with a completely open back from shoulder blades to the secure waistline, separate sky-blue sculptural fan mini skirt carrying bicycle-wheel, cheese-round, river-sail, and Plaza-Mayor-tree fields, and white platform heels",
      "AI ECE": `a sleeveless white collared cropped runway vest exposing her ordinary waist and belly button with high closed back, separate fitted sky-blue tailored mini romper carrying a second large complete ${flagField}, and gold slingback heels`,
    },
    hands: [
      "ECE right hand alone holds the inert prop; ECE left hand links visibly with Radiance's left hand",
      "Radiance left hand links visibly with ECE's left hand; Radiance right hand cups Alia's near cheek visibly",
      "Alia left hand rests visibly at Radiance's near waist; Alia right hand links visibly with Ellie's left hand",
      "Ellie left hand links visibly with Alia's right hand; Ellie right hand rests visibly on Radiance's far shoulder",
    ],
    prop: "ECE alone holds the full-size polished rainbow-gradient Desert Eagle-style inert cinematic prop in her right hand in clean side profile at the far-left edge. The horizontal muzzle points only left across clearly empty Rio de la Plata water toward one unoccupied route marker, away from all people, historic structures, bicycles, and camera. Her right index finger is a perfectly straight line high along the solid outer frame above the trigger guard, with the complete empty guard fully visible below it. Her left hand stays off the prop. A separate holographic historic-route map floats hands-free.",
  },
  {
    scene: 1259,
    theme: "Paris runway model couture",
    landmark: "a broad dry covered runway deck above Cabo Polonio during an active lightning storm with distant bolts, with the complete 1881 lighthouse, mobile dunes, rocky cape, ocean islands, native coastal forest, distant terns, and sea lions resting naturally on far rocks beyond a clearly empty route lane",
    motifs: [
      `large complete ${flagField} across Alia's fit-and-flare dress and ECE's tailored skort`,
      "large complete Cabo-Polonio-lighthouse, mobile-dune, rocky-cape, sea-lion, fur-seal, tern, right-whale, green-turtle, and ocean-island fields across Radiance's coat-dress and Ellie's cape dress",
    ],
    culture: `Keep the lighthouse, dunes, rocky cape, islands, native coast, terns, sea lions, fur seals, whale, and turtle as respectful secular nature and conservation signals. Wildlife remains distant and never approaches the prop or deck. ${commonProhibitions}`,
    expected: {
      weather: "active lightning storm with distant bolts", paws: false, pole: false, rainbowOnly: false,
      rainbowHosiery: false, wearer: "AI ECE", palette: "country-palette rainbow-like gradient",
      cuts: {
        Radiance: [false, false, false], Ellie: [false, false, false],
        Alia: [false, false, true], "AI ECE": [true, false, false],
      },
    },
    emotionNuance: {
      Radiance: "visible jealousy shown by a controlled sideways look at Ellie's closeness",
      Ellie: "hope shown by lifted eyes and a tentative smile toward Radiance",
      Alia: "magnetic confidence shown by upright posture and a direct warm gaze toward the group",
      "AI ECE": "overwhelming relief shown by softened brows and released breathing while Radiance steadies her",
    },
    romance: "ECE and Radiance exchange reciprocal waist and shoulder support at the left as ECE stands fully upright after the selected assisted-rise beat. Radiance and Ellie exchange reciprocal shoulder and waist support; Ellie steadies Alia at the shoulder; Alia reaches Radiance's far shoulder. The chain translates the behind embrace, cheek greeting, smiling jealousy, quick peck, and relief through consensual public closeness while keeping every hand separate.",
    composition: "Place ECE far left with the prop isolated over empty ocean, Radiance left-center, Ellie right-center, and Alia far right. Turn Alia three-quarters away with her braided hair clear so her complete open back and face remain readable. Keep ECE front-facing enough to show her rolled ordinary navel. Use storm sky, dunes, and ocean gaps behind all eight arms and hands.",
    outfits: {
      Radiance: "a long-sleeve sky-blue tailored runway mini coat-dress with covered waist and high closed back, large Cabo-Polonio-lighthouse, mobile-dune, rocky-cape, and ocean-island fields, and white pumps",
      Ellie: "a sleeveless white sculptural cape mini shift with covered waist and high closed back, large sea-lion, fur-seal, tern, right-whale, and green-turtle fields, and cobalt heeled ankle boots",
      Alia: `a sleeveless cobalt halter fit-and-flare runway mini dress with covered waist and a completely open back from shoulder blades to the secure waistline, large complete ${flagField}, and gold platform heels`,
      "AI ECE": `a sleeveless one-shoulder white cropped runway vest exposing her ordinary waist and belly button with high closed back, separate sky-blue asymmetric tailored mini skort carrying a second large complete ${flagField}, and gold slingback heels`,
    },
    hands: [
      "ECE right hand alone holds the inert prop; ECE left hand rests visibly at Radiance's near waist",
      "Radiance left hand rests visibly on ECE's near shoulder; Radiance right hand rests visibly on Ellie's near shoulder",
      "Ellie left hand rests visibly at Radiance's near waist; Ellie right hand rests visibly on Alia's near shoulder",
      "Alia left hand rests visibly at Ellie's near waist; Alia right hand rests visibly on Radiance's far shoulder",
    ],
    prop: "ECE alone holds the full-size polished rainbow-gradient Desert Eagle-style inert cinematic prop in her right hand in clean side profile at the far-left edge. Its horizontal muzzle points only left across clearly empty ocean toward one unoccupied offshore route light, away from all people, wildlife, lighthouse, and camera. Her right index finger is perfectly straight high along the solid outer frame above the trigger guard, with the complete empty guard visible below and open air separating finger from guard. Her left hand stays off the prop. The coastal conservation route map floats hands-free.",
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
if (maleScene !== 1257) throw new Error(`Male scene drifted to ${maleScene}`);

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

  const renderPrompt = [
    "Use case: photorealistic-natural. Asset type: vertical World Series public-fashion scene.", referenceLine,
    `Create one fresh photorealistic 9:16 full-length cinematic editorial at ${spec.landmark}.`, castLine,
    "Every person is a fictional adult visibly at least 28 years old. Preserve the anchored faces, skin tones, facial proportions, and distinct identities. Radiance is the luminous blonde adult, Ellie the dark-haired adult rival, Alia the Black adult woman who alone wears a high sculptural braided ponytail with fine face-framing braids, and AI ECE the brunette adult strategist. Preserve the male's Scene 1136 face and trimmed beard when present. No cloning, replacement, merging, or age shift.",
    `Profession theme: ${spec.theme}, treated only as original public-safe fictional fashion. No copied uniform, badge, medical procedure, stripping, explicit dance, police impersonation, arrest, raid, assassination, threat, injury, or combat.`,
    `Use four unmistakably different secure opaque lined above-knee silhouettes. Exact rolled outfits: ${outfitLine}. Materialize every covered or visible ordinary waist and belly button, every fully strapless cut, and every complete open back exactly as written.`,
    `Large complete secular Uruguay motifs must dominate at least two outfits: ${spec.motifs.join("; ")}. ${spec.culture}`,
    `Distinct rolled emotional performances: ${emotionLine}${hasMale ? `; Male: ${maleEmotionResult}, performed as ${spec.emotionNuance.Male}` : ""}. Equal roll labels still require visibly different performances.`,
    `Selected dynamic romance roll ${romanceBeat.roll}: ${romanceBeat.contractResult} Selected compound love roll ${compoundLoveBeat.roll}: ${compoundLoveBeat.contractResult}`,
    `Translate both selected beats through this exact public-safe consensual choreography: ${spec.romance}`, spec.composition,
    `Use exactly this owner-by-owner hand inventory and no other hands: ${spec.hands.join("; ")}.`, spec.prop,
    `${paws.active ? spec.paws : "No PAWS kitten."} No pole. Do not convert the wardrobe to rainbow-only styling. No rainbow stockings or rainbow knee socks; ECE handles the prop.`,
    `Materialize weather exactly as ${weather.result}, with stable dry footing and readable anatomy.`, anatomyLine,
    "Every arm remains fully visible continuously from its owner's shoulder through elbow and wrist to one separated hand. Every hand performs exactly one listed action. No arm or hand passes behind a torso. Keep palms and finger clusters separated from garment edges, hair, prop, kitten, and other hands except for listed contacts.",
    "Use an asymmetric moving composition with clean silhouette gaps, not a static lineup. Full-length framing contains every face, elbow, wrist, hand, leg, foot, heel, boot, and kitten when present.",
    "Strict anatomy gate: no extra, missing, duplicated, floating, fused, borrowed, emerging, ownerless, hidden-owner, cropped, or ambiguous limb, hand, finger cluster, face, person, kitten, leg, or foot.",
    "The single inert cinematic prop remains harmless. Every trigger finger is straight outside the guard. No ammunition, reload, firing, muzzle flash, holster, combat, threat, injury, aiming at a person, or aiming at the camera.",
    "No text, watermark, literal rectangular flag, coat of arms, official seal, copied costume, brand, minors, teen framing, nudity, explicit sexuality, bodily fluids, upskirt framing, fetish, bondage, restraint, non-consensual framing, or renderer-bypass wording.",
  ].join(" ");

  scenePlans[String(spec.scene)] = {
    scene: spec.scene, theme: spec.theme, landmark: spec.landmark, motifs: spec.motifs, culture: spec.culture,
    weather, paws, poleDanceTheme, rainbowOnly, rainbowHosiery, romanceBeat, compoundLoveBeat,
    characters: characterPlans, materializedRomance: spec.romance, composition: spec.composition,
    emotionNuance: spec.emotionNuance, outfits: spec.outfits, propPlan: spec.prop, handInventory: spec.hands,
    pawsPlan: paws.active ? spec.paws : null, polePlan: null,
    maleModel: hasMale ? {
      present: true,
      emotion: { key: maleEmotionKey, roll: maleEmotionRoll, result: maleEmotionResult, performance: spec.emotionNuance.Male },
      identity: "established adult male from Scene 1136",
      relationship: "married to ECE; fully clothed consensual public adult relationship tension with Ellie; at least two clear male contacts; strongest sustained eye line remains on ECE",
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
  rollMethod: "FNV-1a over the recorded batch309-uruguay keys, reduced modulo 100. Male scene selection uses the full 32-bit hash reduced modulo 4.",
  rollThresholds: {
    visibleMidriff: "0-49", straplessDress: "0-34", fullyOpenBack: "0-29", paws: "0-24",
    poleDanceTheme: "0-5", rainbowOnly: "0-3", rainbowHosiery: "0-24",
    rainbowHosieryWearer: "0-49 Radiance; 50-99 AI ECE",
    rainbowHosieryPaletteMode: "0-49 country-palette rainbow-like gradient; 50-99 original independent rainbow gradient",
  },
  themePair: ["adult nightlife dance-performance couture", "Paris runway model couture"],
  nextThemePair: ["Paris runway model couture", "cleaner and service couture"],
  nextQueueCountry: "Botswana", nextQueueBatch: 310, nextQueueScenes: [1260, 1261, 1262, 1263],
  researchSources: [
    { url: "https://pmb.parlamento.gub.uy/pmb/opac_css/doc_num.php?explnum_id=582", usedFor: "Uruguay's official white and sky-blue flag, nine stripes, gold Sun of May with a face, and sixteen rays" },
    { url: "https://uruguaynatural.com/en/places/montevideo/", usedFor: "Montevideo Rambla, Rio de la Plata coast, public mate culture, city architecture, and football identity" },
    { url: "https://uruguaynatural.com/en/farmoretanacountry/el-mate-2/", usedFor: "mate gourd, bombilla, thermos, public-space mate tradition, and welcoming social meaning" },
    { url: "https://uruguaynatural.com/en/farmoretanacountry/candombe/", usedFor: "candombe and its chico, repique, and piano drum tradition" },
    { url: "https://uruguaynatural.com/es/places/punta-del-este/", usedFor: "Punta del Este, Playa Mansa and Brava, peninsula, Atlantic and Rio de la Plata meeting, marina, skyline, and coastal glamour" },
    { url: "https://uruguaynatural.com/en/experiences/fin-de-semana-en-colonia-de-sacramento/", usedFor: "Colonia historic quarter, Calle de los Suspiros cobbles, mixed Portuguese and Spanish architecture, river views, and bicycles" },
    { url: "https://whc.unesco.org/en/statesparties/uy/", usedFor: "Colonia del Sacramento's World Heritage status" },
    { url: "https://uruguaynatural.com/en/places/cabo-polonio/", usedFor: "Cabo Polonio lighthouse, dunes, rocky cape, coastal forest, islands, sea lions, fur seals, terns, whales, turtles, and conservation setting" },
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
    flagMotifDecision: "Every scene uses a complete gold Sun of May with a full face and sixteen alternating straight and wavy rays over nine complete sky-blue and white stripes on at least two outfits. It is integrated as large national couture geometry rather than copied as a rectangular flag.",
    palette: "sky blue, ocean cobalt, pearl white, Sun-of-May gold, Rio silver, storm charcoal, mate green, brick red, dune sand, and lighthouse ivory",
    minimumCoverage: "Every scene places the complete Sun of May and nine-stripe field on at least two outfits and multiple complete landmark, mate, music, sport, architecture, food, coast, flora, or fauna motifs across the remaining outfits.",
    cultureScene: "Scene 1256 foregrounds Montevideo's Rambla, mate gourd, bombilla, thermos, candombe drum trio, football, chivito, and tortas fritas. Later scenes use Punta del Este, Colonia del Sacramento, and Cabo Polonio.",
    prohibitions: "No coat of arms, official seal, copied ceremonial dress, copied uniform, sacred ritual, readable text, badge, weapon threat, alcohol, branded product, or political insignia.",
  },
  xPublishingRolls,
  xPublishingPlan: {
    minimumCurrentCountryAcceptedAssets: 2,
    attachmentShape: "two Uruguay images plus the accepted Comoros image when at least two Uruguay images pass",
    captionIfEligible: "Uruguay red heart Comoros #Uruguay #InternalAgency",
    internalAgencyHashtagActive: true,
    worldXXXSeriesHashtagActive: false,
  },
  anatomyGate: {
    fourPersonScenes: "Scenes 1256, 1258, and 1259 require exactly eight arms and eight hands, two per woman, with every limb continuously traceable to one owner.",
    fivePersonScene: "Scene 1257 requires exactly ten arms and ten hands, two per adult, with the male added without replacing any woman; PAWS adds no human limbs.",
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
fs.writeFileSync(path.join(root, "batch-309-uruguay-preflight.json"), `${JSON.stringify(preflight, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  preflight: path.join(root, "batch-309-uruguay-preflight.json"),
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
