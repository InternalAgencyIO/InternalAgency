import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const batch = 312;
const country = "Fiji";
const countrySlug = "fiji";
const firstScene = 1268;
const root = path.resolve("tmp/world-195x4/batch-312");
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

const commonProhibitions = "Fiji's flag contains the Union Jack and official coat of arms, so neither appears on clothing. No literal flag, official emblem, sacred symbol, copied ceremonial dress, copied operative uniform, badge, readable text, brand, alcohol consumption, or political insignia.";

const sceneSpecs = [
  {
    scene: 1268,
    theme: "cinematic covert-agent crew couture",
    landmark: "a broad dry covered harbour overlook in Savusavu on Vanua Levu during a tropical sunshower with sparkling droplets, with the complete natural harbour curve, anchored sailboats, green volcanic hills, distant harmless geothermal steam, waterfront market roofs, and maker studios clearly visible",
    motifs: [
      "large complete Savusavu-harbour wave, white sail, geothermal-steam spiral, pearl-shell, cacao-pod, woven-pandanus, maker-basket, and hibiscus compositions across all four outfits",
      "at least two separate outfits each carry one complete full-width secular Fiji landscape-and-craft composition rather than tiny trim",
    ],
    culture: `Treat hot-spring steam only as a distant geological signal with no bathing. Use the harbour, sails, volcanic hills, makers, pandanus weaving, pearl shell, cacao, baskets, and hibiscus as respectful secular Fiji references. ${commonProhibitions}`,
    expected: {
      weather: "sunshower with sparkling droplets", paws: true, pole: false, rainbowOnly: false,
      rainbowHosiery: true, wearer: "AI ECE", palette: "country-palette rainbow-like gradient",
      cuts: {
        Radiance: [true, false, true], Ellie: [true, false, false],
        Alia: [false, false, false], "AI ECE": [false, false, false],
      },
    },
    emotionNuance: {
      Radiance: "calm contentment shown by a quiet protective smile toward ECE",
      Ellie: "startled surprise shown by lifted brows while she catches the moving embrace",
      Alia: "tender affection shown by softened eyes during the linked-hand pull",
      "AI ECE": "visible jealousy shown by a tight controlled mouth that softens only toward Radiance",
    },
    romance: "Radiance and ECE are the unmistakable affectionate center just after ECE rises from a low beacon check. Radiance's left hand visibly supports ECE's forearm while ECE's right hand settles at Radiance's waist in a moving side hug. Alia catches Radiance's free right hand with her left and gently pulls in the opposite direction while keeping the inert prop isolated in her far right hand. Ellie completes a loose behind-hug geometry with her left hand at Radiance's far shoulder and right hand at Radiance's far waist, both arms fully visible from the side. ECE leans close enough to give Ellie a brief public-safe forehead greeting while keeping her jealous gaze emotionally centered on Radiance.",
    composition: "Place Alia far left with the inspection paddle against empty harbour water, Radiance left-center, ECE right-center, and Ellie offset behind-right with both forearms outside Radiance's silhouette. Keep PAWS high on ECE's far shoulder, far from Alia. Use sparkling rain gaps behind every arm and show all complete heels and all two rolled navels. Turn Radiance three-quarter-back with hair fully forward so her complete rolled open back and face are visible.",
    outfits: {
      Radiance: "a short-sleeve pearl-white cropped covert-fashion shell exposing her ordinary waist and belly button, with secure opaque side structure and a completely open back from shoulder blades to the separate waistline, a reef-blue folded mini skort carrying a large complete Savusavu-harbour wave and white-sail composition, and coral-red pumps",
      Ellie: "a lagoon-blue square-neck cropped covert-fashion vest exposing her ordinary waist and belly button with a high closed back, a separate turmeric-gold tulip mini skirt carrying a large complete geothermal-steam, pearl-shell, and cacao-pod composition, and pearl-white slingback heels",
      Alia: "a coral-red one-shoulder covert-fashion mini dress with covered waist and high closed back, carrying a large complete woven-pandanus and maker-basket composition, and deep-ocean platform heels",
      "AI ECE": "a pearl-white asymmetric short-sleeve strategist mini coat-dress with covered waist and high closed back, carrying a large complete hibiscus, volcanic-hill, and harbour-sail composition, exactly one pair of opaque knee-high stockings in a harmonious Fiji-palette rainbow-like gradient through deep ocean blue, reef blue, pearl white, coral red, leaf green, hibiscus magenta, and turmeric gold, and reef-blue pumps",
    },
    hands: [
      "Alia right open hand supports the opaque inspection paddle and inert prop from beneath; Alia left hand links visibly with Radiance's right hand",
      "Radiance right hand links visibly with Alia's left hand; Radiance left hand visibly supports ECE's near forearm",
      "ECE left hand is open under and clearly controls the separate holographic route map; ECE right hand rests visibly at Radiance's near waist",
      "Ellie left hand rests visibly on Radiance's far shoulder; Ellie right hand rests visibly at Radiance's far waist",
    ],
    propHandler: "Alia",
    propTarget: "left across clearly empty Savusavu harbour water toward one unoccupied route buoy",
    paws: "One tiny collarless golden kitten, PAWS, perches securely on ECE's far shoulder with all four paws settled on opaque fabric and harmlessly bats a loose reef-blue route ribbon. PAWS remains far from Alia, the inspection paddle, harbour edge, and wet surfaces; no adult hand is reassigned to the kitten.",
  },
  {
    scene: 1269,
    theme: "cinematic covert-agent crew couture",
    landmark: "a broad dry glass-roofed forest route pavilion at Colo-i-Suva Forest Park during a heavy rain curtain outside, with dense rainforest, a complete timber footbridge, freshwater creek, upper and lower pool ripples, giant ferns, orchids, butterflies, and native bird silhouettes clearly visible",
    motifs: [
      "large complete Colo-i-Suva fern, creek-ribbon, pool-ripple, timber-footbridge, orchid, butterfly, parrot-finch, and sago-palm compositions across all four women's outfits",
      "at least two separate outfits each carry a complete full-width secular Fiji rainforest-and-wildlife composition",
    ],
    culture: `Keep every pool unoccupied and all cast on the dry nonslip pavilion. Use rainforest, creek, bridge, orchids, butterflies, birdlife, and sago palms as respectful secular conservation references. ${commonProhibitions}`,
    expected: {
      weather: "heavy rain curtain", paws: false, pole: false, rainbowOnly: false,
      rainbowHosiery: false, wearer: "AI ECE", palette: "original independent rainbow gradient",
      cuts: {
        Radiance: [false, true, false], Ellie: [false, true, true],
        Alia: [false, false, false], "AI ECE": [true, true, false],
      },
    },
    emotionNuance: {
      Radiance: "determination shown by level brows while calming the adult relationship tension",
      Ellie: "playful mischief shown by a bright sideways smile during the ribbon rivalry",
      Alia: "tender affection shown by soft eye contact toward Radiance while accepting the male's waist touch",
      "AI ECE": "calm contentment shown by composed route-leader focus toward her husband",
      Male: "aching romantic longing shown by softened brows while his head and pupils remain most strongly fixed on his wife ECE",
    },
    romance: "Use a shallow five-adult arc. The married male rests his right hand on ECE's shoulder and his left hand at Alia's waist. Alia openly accepts the consensual adult infidelity beat with her right hand on his forearm while her left hand hugs Radiance's waist. Radiance cradles Alia's cheek with her left hand and openly seeks the male with her right hand on his upper arm. Ellie keeps one hand on Radiance's far shoulder and holds the loose signal ribbon in her other open hand, leaning toward Radiance for a quick public-safe cheek greeting. ECE remains inches from the group and directs her calm gaze to her husband; his strongest sustained eye line returns unmistakably to ECE. This integrates the selected ribbon pull, two calming hands, face cradle, waist hug, cheek greeting, and linked emotional tension without hiding or reusing a hand.",
    composition: "Place ECE far left with the inspection paddle isolated against empty creek water, male left-center, Alia center, Radiance right-center, and Ellie far right. Keep five rain-bright silhouette lanes and every forearm outside neighboring torsos. Turn Ellie three-quarter-back with hair swept completely forward so the entire rolled open back and complete face are visible. Show both rolled navels and all complete footwear.",
    outfits: {
      Radiance: "a fully strapless pearl-white covert-fashion mini dress with completely bare shoulders, covered waist and opaque enclosed back, carrying a large complete Colo-i-Suva fern and creek-ribbon composition, with leaf-green pumps",
      Ellie: "a fully strapless lagoon-blue covert-fashion mini dress with completely bare shoulders, covered waist, secure opaque side structure, and a completely open back from shoulder blades to the secure waistline, carrying a large complete pool-ripple and timber-footbridge composition, with coral-red heeled boots",
      Alia: "a short-sleeve turmeric-gold tailored covert-fashion mini romper with covered waist and high closed back, carrying a large complete orchid, butterfly, and parrot-finch composition, with deep-ocean platform heels",
      "AI ECE": "a fully strapless pearl-white cropped strategist bodice exposing her ordinary waist and belly button, with completely bare shoulders and opaque enclosed back, a reef-blue radial mini skort carrying a large complete sago-palm, rain, and freshwater-pool composition, and coral-red slingbacks",
      Male: "the established adult male face from Scene 1136 with closely trimmed beard and athletic muscular build, wearing an opaque fitted leaf-green short-sleeve polo with a restrained lagoon-blue fern band, fitted black jeans, and practical black boots",
    },
    hands: [
      "ECE right open hand supports the opaque inspection paddle and inert prop from beneath; ECE left hand is open under and clearly controls the separate holographic route map",
      "the male right hand rests visibly on ECE's near shoulder; the male left hand rests visibly at Alia's near waist",
      "Alia right hand rests visibly on the male's near forearm; Alia left hand rests visibly at Radiance's near waist",
      "Radiance left hand cups Alia's near cheek; Radiance right hand rests visibly on the male's near upper arm",
      "Ellie left hand rests visibly on Radiance's far shoulder; Ellie right open hand holds one loose signal ribbon clear of every body",
    ],
    propHandler: "AI ECE",
    propTarget: "left across clearly empty freshwater creek toward one unoccupied route marker",
  },
  {
    scene: 1270,
    theme: "undercover investigator couture",
    landmark: "a broad dry elevated route deck above Natadola Beach immediately after rain, with soft white sand, clear turquoise water, shallow reef, tide pools, one empty longboard rack, coconut palms, and a complete double rainbow spanning the Pacific sky",
    motifs: [
      "large complete Natadola white-sand curve, turquoise swell, reef fan, tide-pool, longboard, coconut-palm, hibiscus, and drua-sail compositions across all four outfits",
      "at least two separate outfits each carry one complete full-width secular Fiji beach-and-reef composition",
    ],
    culture: `Keep every tide pool and board empty. Use Natadola's white sand, turquoise water, reef, tide pools, beginner surf setting, palms, hibiscus, and drua sail as respectful secular Fiji references. ${commonProhibitions}`,
    expected: {
      weather: "double rainbow after rain", paws: false, pole: false, rainbowOnly: false,
      rainbowHosiery: false, wearer: "Radiance", palette: "country-palette rainbow-like gradient",
      cuts: {
        Radiance: [true, false, false], Ellie: [false, false, false],
        Alia: [true, false, false], "AI ECE": [true, false, false],
      },
    },
    emotionNuance: {
      Radiance: "playful mischief shown by a teasing smile during Alia's quick cheek greeting",
      Ellie: "shame and social vulnerability shown by lowered eyes and a guarded seated posture",
      Alia: "contained resentment shown by a controlled jaw while maintaining a gentle waist contact",
      "AI ECE": "awe shown by widened eyes toward the double rainbow and the relationship weave",
    },
    romance: "Ellie sits on one low mission plinth while Radiance stands offset between her separated knees in a close but fully visible hug. Ellie rests her right hand at Radiance's waist and her left hand on ECE's shoulder. Radiance rests her left hand on Ellie's shoulder and turns for Alia's quick public-safe cheek peck while her right hand cups Alia's cheek. Alia's left hand rests at Radiance's far waist and her right hand holds a loose route ribbon near her own shoulder. ECE stays adjacent at the left with the safe inspection paddle and route map, answering the tight walking weave with an awestruck jealous look. The linked pair energy, protective back touch, cheek pass, close plinth hug, and beacon control remain readable without crossed arms.",
    composition: "Place ECE far left with the prop isolated over empty Pacific water, Ellie seated left-center on the low plinth, Radiance center-right, and Alia far right. Keep a bright sea or sky lane behind each of the eight arms. Show every complete foot and heel and all three rolled navels.",
    outfits: {
      Radiance: "a short-sleeve coral-red cropped investigator-fashion polo exposing her ordinary waist and belly button with a high closed back, a pearl-white folded mini skort carrying a large complete Natadola white-sand curve and turquoise-swell composition, and reef-blue pumps",
      Ellie: "a lagoon-blue cap-sleeve investigator-fashion mini dress with covered waist and high closed back, carrying a large complete shallow-reef, tide-pool, and longboard composition, with pearl-white heeled boots",
      Alia: "a sleeveless leaf-green cropped investigator-fashion vest exposing her ordinary waist and belly button with a high closed back, separate turmeric-gold tailored mini shorts carrying a large complete coconut-palm, hibiscus, and reef-fan composition, and deep-ocean platform heels",
      "AI ECE": "a pearl-white one-shoulder cropped strategist shell exposing her ordinary waist and belly button with a high closed back, a reef-blue radial mini skirt carrying a large complete drua-sail, rain-drop, and Pacific-wave composition, and coral-red slingbacks",
    },
    hands: [
      "ECE right open hand supports the opaque inspection paddle and inert prop from beneath; ECE left hand is open under and clearly controls the separate holographic route map",
      "Ellie left hand rests visibly on ECE's near shoulder; Ellie right hand rests visibly at Radiance's near waist",
      "Radiance left hand rests visibly on Ellie's near shoulder; Radiance right hand cups Alia's near cheek",
      "Alia left hand rests visibly at Radiance's far waist; Alia right open hand holds one loose route ribbon near her own shoulder",
    ],
    propHandler: "AI ECE",
    propTarget: "left across clearly empty Pacific water toward one unoccupied reef-route buoy",
  },
  {
    scene: 1271,
    theme: "undercover investigator couture",
    landmark: "a broad dry waterfront route terrace in Levuka on Ovalau at clear golden hour, with the complete Beach Street weatherboard facades, old trading-store verandas, public school roofline, pier, quiet bay, heritage cutter sails, and steep green Ovalau mountain wall clearly visible",
    motifs: [
      "large complete Levuka Beach-Street facade, weatherboard veranda, Ovalau mountain, bay wave, pier, heritage cutter sail, copra-leaf, and school-roof compositions across all four outfits",
      "at least two separate outfits each carry one complete full-width secular Fiji waterfront-and-heritage composition",
    ],
    culture: `Use only Levuka's secular waterfront, Beach Street, weatherboard stores, verandas, public-school roofline, pier, bay, cutter sails, mountain, and copra leaves. Exclude churches, tombs, Masonic symbols, mission steps, ritual, and alcohol. ${commonProhibitions}`,
    expected: {
      weather: "clear golden-hour radiance", paws: false, pole: false, rainbowOnly: false,
      rainbowHosiery: false, wearer: "AI ECE", palette: "original independent rainbow gradient",
      cuts: {
        Radiance: [false, false, false], Ellie: [false, true, true],
        Alia: [false, false, false], "AI ECE": [false, false, false],
      },
    },
    emotionNuance: {
      Radiance: "determination shown by steady protective eyes during the relay handoff",
      Ellie: "tender affection shown by a soft shoulder-to-shoulder smile toward Radiance",
      Alia: "calm contentment shown by relaxed eyes during Radiance's forehead greeting",
      "AI ECE": "full sobbing with tear-streaked face and shaking posture shown as safe emotional release while she keeps the route stable",
    },
    romance: "Ellie holds Radiance close with her left hand at Radiance's waist and right hand at Radiance's shoulder. Radiance stays shoulder-to-shoulder with Ellie while giving Alia a brief public-safe forehead greeting, her left hand on Alia's shoulder and right hand at Alia's cheek. Alia answers with her left hand at Radiance's far waist and right hand on ECE's upper arm. ECE turns partly away in tearful emotional release while remaining inches from them with the safe inspection paddle and map, visibly stepping into the relationship line to reclaim attention. The relay handoff, cheek and forehead warmth, fingertip-choice tension, waist-and-shoulder hold, and beacon leadership all read without hidden arms.",
    composition: "Place ECE far left with the prop isolated against empty bay water, Alia left-center, Radiance right-center, and Ellie far right. Keep all eight arms in front-edge silhouette lanes. Turn Ellie three-quarter-back with hair fully forward so her complete rolled open back and face are visible. Show all complete footwear.",
    outfits: {
      Radiance: "a pearl-white short-sleeve investigator-fashion mini shift dress with covered waist and high closed back, carrying a large complete Levuka Beach-Street facade and veranda composition, with coral-red pumps",
      Ellie: "a fully strapless deep-ocean investigator-fashion mini dress with completely bare shoulders, covered waist, secure opaque side structure, and a completely open back from shoulder blades to the secure waistline, carrying a large complete Ovalau mountain, bay-wave, and pier composition, with pearl-white heeled boots",
      Alia: "a leaf-green one-shoulder tailored investigator-fashion mini romper with covered waist and high closed back, carrying a large complete heritage-cutter sail and copra-leaf composition, with turmeric-gold platform heels",
      "AI ECE": "a coral-red asymmetric long-sleeve strategist mini coat-dress with covered waist and high closed back, carrying a large complete weatherboard-store, public-school roofline, and quiet-bay composition, with reef-blue slingback heels",
    },
    hands: [
      "ECE right open hand supports the opaque inspection paddle and inert prop from beneath; ECE left hand is open under and clearly controls the separate holographic route map",
      "Alia left hand rests visibly at Radiance's far waist; Alia right hand rests visibly on ECE's near upper arm",
      "Radiance left hand rests visibly on Alia's near shoulder; Radiance right hand cups Alia's near cheek",
      "Ellie left hand rests visibly at Radiance's near waist; Ellie right hand rests visibly on Radiance's far shoulder",
    ],
    propHandler: "AI ECE",
    propTarget: "left across clearly empty Levuka bay water toward one unoccupied route buoy",
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
if (maleScene !== 1269) throw new Error(`Male scene drifted to ${maleScene}`);

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
  const propLine = `${spec.propHandler} alone presents the photorealistic full-size polished rainbow-gradient Desert Eagle-style inert cinematic prop on a thin flat opaque charcoal inspection paddle with no walls, lid, enclosure, or transparent material. The prop rests entirely on top of the paddle in clean side profile; no hand touches its grip, trigger, or trigger guard. The handler's open support hand stays completely underneath the solid paddle, physically separated from the prop. Every support finger is straight, separated, fully visible below the paddle, and nowhere near the complete centered empty trigger guard. The magazine is absent and the empty magazine well is visible. The horizontal muzzle points ${spec.propTarget}, away from every person, kitten, landmark, animal, and camera. This is a controlled unloaded handoff demonstration, not a firing grip.`;
  const hosieryLine = rainbowHosiery.active
    ? `Rainbow-hosiery roll ${rainbowHosiery.roll} is active. Wearer selector ${rainbowHosiery.wearer.roll} selects exactly AI ECE. Palette selector ${rainbowHosiery.palette.roll} selects the specified Fiji-palette rainbow-like gradient. Exactly ECE wears the opaque gradient knee-high stockings; nobody else wears stockings or knee socks. Radiance and ECE are the clear affectionate center. Alia alone handles the inert prop while ECE controls the separate holographic map.`
    : `Rainbow-hosiery roll ${rainbowHosiery.roll} is inactive. No rainbow stockings or rainbow knee socks. ECE alone handles the prop and controls the separate holographic map.`;

  const renderPrompt = [
    "Use case: photorealistic-natural. Asset type: vertical World Series public-fashion scene.", referenceLine,
    `Create one fresh photorealistic 9:16 full-length cinematic editorial at ${spec.landmark}.`, castLine,
    "Every person is a fictional adult visibly at least 28 years old. Preserve the anchored faces, skin tones, facial proportions, and distinct identities. Radiance is the luminous blonde adult, Ellie the dark-haired adult rival, Alia the Black adult woman who alone wears a high sculptural braided ponytail with fine face-framing braids, and AI ECE the brunette adult strategist. Preserve the male's Scene 1136 face and trimmed beard when present. No cloning, replacement, merging, or age shift.",
    `Profession theme: ${spec.theme}, treated only as original public-safe fictional fashion. No copied uniform, badge, police impersonation, arrest, raid, assassination, threat, injury, or combat.`,
    triggerLine, `Exact individual wardrobe rolls: ${cutLine}.`,
    `Use four unmistakably different secure opaque lined above-knee silhouettes. Exact rolled outfits: ${outfitLine}. Materialize every covered or visible ordinary waist and belly button, every fully strapless cut, and every complete open back exactly as written.`,
    `Large complete secular Fiji motifs must dominate at least two outfits in this image: ${spec.motifs.join("; ")}. ${spec.culture}`,
    `Distinct rolled emotional performances: ${emotionLine}${hasMale ? `; Male: roll ${maleEmotionRoll}, ${maleEmotionResult}, performed as ${spec.emotionNuance.Male}` : ""}.`,
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
    "The single inert cinematic prop remains harmless. Its complete trigger guard is visibly empty and physically separated from every hand by the solid paddle. No ammunition, reload, firing, muzzle flash, holster, display case, transparent enclosure, combat, threat, injury, aiming at a person, or aiming at the camera.",
    "No text, watermark, literal flag, Union Jack, coat of arms, official seal, copied costume, brand, minors, teen framing, nudity, explicit sexuality, bodily fluids, upskirt framing, fetish, bondage, restraint, non-consensual framing, or renderer-bypass wording.",
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
  rollMethod: "FNV-1a over the recorded batch312-fiji keys, reduced modulo 100. Male scene selection uses the full 32-bit hash reduced modulo 4.",
  rollThresholds: {
    visibleMidriff: "0-49", straplessDress: "0-34", fullyOpenBack: "0-29", paws: "0-24",
    poleDanceTheme: "0-5", rainbowOnly: "0-3", rainbowHosiery: "0-24",
    rainbowHosieryWearer: "0-49 Radiance; 50-99 AI ECE",
    rainbowHosieryPaletteMode: "0-49 country-palette rainbow-like gradient; 50-99 original independent rainbow gradient",
  },
  themePair: ["cinematic covert-agent crew couture", "undercover investigator couture"],
  nextThemePair: ["undercover investigator couture", "nurse-care couture"],
  nextQueueCountry: "Comoros", nextQueueBatch: 313, nextQueueScenes: [1272, 1273, 1274, 1275],
  researchSources: [
    { url: "https://www.fiji.travel/places-to-go/lau-lomaiviti/locations/best-historical-sites-to-visit-in-levuka", usedFor: "Levuka Beach Street, waterfront, heritage town, public school, verandas, and Ovalau mountain setting" },
    { url: "https://www.fiji.travel/places-to-go/outer-islandslomaiviti-lau/locations/levuka-fiji-s-first-capital", usedFor: "Levuka waterfront, weatherboard buildings, old trading stores, bay, and first-capital context" },
    { url: "https://www.fiji.travel/things-to-do/wildlife/fijis-national-parks-and-marine-sanctuaries", usedFor: "Colo-i-Suva rainforest trails, freshwater pools, birdlife, and conservation context" },
    { url: "https://www.fiji.travel/things-to-do/hikes-walks/the-best-walks-and-hikes-in-fiji", usedFor: "Colo-i-Suva trails, swimming holes, butterflies, lizards, and forest setting" },
    { url: "https://www.fiji.travel/things-to-do/family-adventures/best-public-beaches-on-viti-levu", usedFor: "Natadola white sand, turquoise water, reef, tide pools, and beach setting" },
    { url: "https://www.fiji.travel/things-to-do/surfing/get-ready-for-fiji-surfing", usedFor: "Natadola beginner surf and Pacific-wave context" },
    { url: "https://www.fiji.travel/things-to-do/thrilling/off-the-beaten-track-islands-fiji", usedFor: "Savusavu natural harbour, hot springs, markets, makers, pearl craft, cacao, rainforest, and sailing context" },
    { url: "https://www.fiji.travel/things-to-know/getting-around/water", usedFor: "Fiji harbour, sail, inter-island ferry, and island-route context" },
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
    flagMotifDecision: "Fiji's flag includes the Union Jack and official national coat of arms, so neither is copied onto clothing. Large researched secular landscape, craft, harbour, reef, rainforest, beach, sail, and heritage-town fields replace them.",
    palette: "deep ocean blue, reef blue, pearl white, coral red, leaf green, hibiscus magenta, turmeric gold, masi black, and volcanic charcoal",
    minimumCoverage: "Every scene places multiple large complete secular Fiji motifs across at least two outfits as full bodice, skirt, hip, or panel fields rather than tiny trim.",
    cultureScene: "The four scenes foreground Savusavu harbour and makers, Colo-i-Suva conservation, Natadola beach and reef, and Levuka waterfront heritage.",
    prohibitions: "No literal flag, Union Jack, coat of arms, official emblem, sacred symbol, copied ceremonial dress, copied service or operative uniform, badge, weapon threat, alcohol consumption, or branded product.",
  },
  xPublishingRolls,
  xPublishingPlan: {
    minimumCurrentCountryAcceptedAssets: 2,
    attachmentShape: "two Fiji images plus one accepted secondary-country image when at least two Fiji images pass",
    captionIfEligible: "Fiji red heart Comoros #Fiji",
    internalAgencyHashtagActive: false,
    worldXXXSeriesHashtagActive: false,
  },
  anatomyGate: {
    fourPersonScenes: "Scenes 1268, 1270, and 1271 require exactly eight arms and eight hands, two per woman, with every limb continuously traceable to one owner.",
    fivePersonScene: "Scene 1269 requires exactly ten arms and ten hands, two per adult, with the male added without replacing any woman.",
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
fs.writeFileSync(path.join(root, "batch-312-fiji-preflight.json"), `${JSON.stringify(preflight, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  preflight: path.join(root, "batch-312-fiji-preflight.json"),
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
