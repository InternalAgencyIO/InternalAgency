import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const batch = 320;
const country = "Malta";
const countrySlug = "malta";
const firstScene = 1300;
const root = path.resolve("tmp/world-195x4/batch-320");
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

const commonProhibitions = "Use secular Maltese harbors, bastion geometry, limestone streets, civic gates, terraced fields, natural arches, sea caves, cliffs, inland-sea tunnels, salt-white stone, boats, paths, and public infrastructure only. No literal flag, Maltese cross, coat of arms, crown, official seal, sacred symbol, religious building, copied ceremonial pattern, copied uniform, badge, readable text, brand, alcohol, or political insignia.";
const palette = "Mediterranean cobalt, Malta red, honey limestone, salt white, harbor turquoise, Gozo ochre, prickly-pear green, sunset coral, warm gold, rain silver, and night charcoal";

const sceneSpecs = [
  {
    "scene": 1300,
    "theme": "undercover investigator couture",
    "landmark": "a broad dry nonslip covered terrace above Valletta's Grand Harbour during a powerful windstorm, with the complete honey-limestone fortified peninsula, bastioned walls, harbor inlets, civic grid streets, stepped quays, colorful secular balconies, one clearly empty marked water route, and no religious or political structure",
    "motifs": [
      "large complete Valletta-peninsula, bastion-angle, Grand-Harbour inlet, civic-street-grid, stepped-quay, balcony-rhythm, wind-ribbon, and empty-water-route compositions across all four outfits",
      "at least two separate outfits each carry one complete full-width secular Malta harbor-and-bastion composition rather than tiny trim"
    ],
    "culture": "Use Valletta's hilly peninsula between natural harbors, uniform civic street grid, honey-colored limestone, bastioned perimeter, public squares, balconies, quays, and harbor routes respectfully. Keep sacred buildings outside the frame. Undercover investigator couture is original fictional film-editorial fashion for a nonviolent public route study, with no police impersonation, official badge, copied uniform, surveillance of people, arrest, raid, threat, injury, combat, or assassination. Use secular Maltese harbors, bastion geometry, limestone streets, civic gates, terraced fields, natural arches, sea caves, cliffs, inland-sea tunnels, salt-white stone, boats, paths, and public infrastructure only. No literal flag, Maltese cross, coat of arms, crown, official seal, sacred symbol, religious building, copied ceremonial pattern, copied uniform, badge, readable text, brand, alcohol, or political insignia.",
    "expected": {
      "weather": "powerful windstorm with controlled fabric motion",
      "paws": false,
      "pole": false,
      "rainbowOnly": false,
      "rainbowHosiery": false,
      "wearer": "AI ECE",
      "palette": "country-palette rainbow-like gradient",
      "cuts": {
        "Radiance": [
          true,
          false,
          false
        ],
        "Ellie": [
          false,
          true,
          true
        ],
        "Alia": [
          false,
          false,
          false
        ],
        "AI ECE": [
          false,
          true,
          false
        ]
      }
    },
    "emotionNuance": {
      "Radiance": "crying with visible tears shown by tear tracks and a trembling but affectionate gaze toward ECE",
      "Ellie": "extreme happiness shown by radiant laughing delight toward Radiance while keeping both shoulder contacts gentle",
      "Alia": "defiance shown by an upright chin and steady gaze across the harbor route while maintaining her supportive forearm contact",
      "AI ECE": "emotional exhaustion shown by heavy eyes and a small grateful breath toward Radiance while maintaining calm route-strategist focus"
    },
    "romance": "Translate the route-card embrace, cheek touch, inches-away jealousy, full shoulder embrace, blown-kiss answer, and returned cheek touch into an open four-adult harbor chain. ECE remains isolated at far left with the prop paddle and answers Radiance through a gentle forearm touch. Radiance rests one hand on ECE's upper arm and one on Ellie's shoulder, sending the rolled kiss only through a soft pursed expression so both hands stay visible. Ellie answers with one hand on Radiance's shoulder and one on Alia's forearm. Alia rests one hand on Ellie's forearm and keeps her outer hand openly visible. The six public contacts and close eye lines are gentle, consensual, and unobstructed.",
    "composition": "Place ECE far left facing the empty harbor route, Radiance left-center turning toward ECE, Ellie right-center in a buoyant wind-braced step, and Alia far right turned three-quarter-left. Use pale windblown sky, harbor water, arch openings, or bastion gaps behind every arm. Keep all four faces and all eight arm paths visible while the group forms a shallow zigzag rather than a line.",
    "outfits": {
      "Radiance": "a Malta-red cropped undercover-investigator jacket exposing a narrow ordinary waist panel, with a separate honey-limestone above-knee A-line skirt carrying a large complete Valletta peninsula and Grand Harbour inlet composition, high closed back, and salt-white pumps",
      "Ellie": "a fully strapless Mediterranean-cobalt undercover-investigator above-knee architectural skort dress with a high straight opaque bustline, covered waist, secure opaque front and sides, and a completely open back from shoulder blades to the separate waistline, carrying a large complete bastion-angle, civic-grid, and stepped-quay composition, with warm-gold slingback heels",
      "Alia": "a prickly-pear-green high-neck sleeveless undercover-investigator above-knee tailored romper with covered waist and high closed back, carrying a large complete balcony-rhythm and wind-ribbon composition, with Gozo-ochre platform heels",
      "AI ECE": "a fully strapless harbor-turquoise undercover-investigator above-knee asymmetric sheath with a high straight opaque bustline, covered waist, and high closed back, carrying a large complete empty-water-route and harbor-current composition, with Malta-red heeled boots"
    },
    "hands": [
      "ECE left open hand supports the opaque inspection paddle and inert prop from beneath; ECE right hand rests visibly on Radiance's near forearm",
      "Radiance left hand rests visibly on ECE's near upper arm; Radiance right hand rests visibly on Ellie's near shoulder",
      "Ellie left hand rests visibly on Radiance's near shoulder; Ellie right hand rests visibly on Alia's near forearm",
      "Alia left hand rests visibly on Ellie's near forearm; Alia right open hand remains clearly visible at her far outer side"
    ],
    "propHandler": "AI ECE",
    "propTarget": "left across clearly empty Grand Harbour water toward one unoccupied route marker, away from every wall, quay, boat, person, animal, and camera"
  },
  {
    "scene": 1301,
    "theme": "undercover investigator couture",
    "landmark": "a broad dry covered civic overlook beside Mdina's fortified hilltop during a sunshower with sparkling droplets, with the complete honey-limestone bastion wall, deep dry ditch, monumental secular city gate, winding lane network, Baroque civic facades, terraced fields below, one clearly empty marked road route, and no religious building",
    "motifs": [
      "large complete Mdina-gate arch, bastion wall, dry-ditch geometry, winding-lane network, civic-facade rhythm, terraced-field contour, sunshower arc, and empty-road-route compositions across all four women's outfits and the male top",
      "at least two separate outfits each carry one complete full-width secular Malta fortified-hilltop composition rather than a tiny crest or trim"
    ],
    "culture": "Use Mdina's fortified hilltop setting, tranquil winding streets, honey-limestone palaces, secular gate, bastion wall, dry ditch, terraces, and surrounding fields respectfully. Keep sacred buildings outside the frame. Undercover investigator couture is original fictional film-editorial fashion for a nonviolent public route study, with no police impersonation, official badge, copied uniform, surveillance of people, arrest, raid, threat, injury, combat, or assassination. Use secular Maltese harbors, bastion geometry, limestone streets, civic gates, terraced fields, natural arches, sea caves, cliffs, inland-sea tunnels, salt-white stone, boats, paths, and public infrastructure only. No literal flag, Maltese cross, coat of arms, crown, official seal, sacred symbol, religious building, copied ceremonial pattern, copied uniform, badge, readable text, brand, alcohol, or political insignia.",
    "expected": {
      "weather": "sunshower with sparkling droplets",
      "paws": false,
      "pole": false,
      "rainbowOnly": false,
      "rainbowHosiery": false,
      "wearer": "Radiance",
      "palette": "original independent rainbow gradient",
      "cuts": {
        "Radiance": [
          true,
          true,
          true
        ],
        "Ellie": [
          false,
          false,
          false
        ],
        "Alia": [
          false,
          false,
          false
        ],
        "AI ECE": [
          true,
          false,
          false
        ]
      }
    },
    "emotionNuance": {
      "Radiance": "determination shown by a focused warm gaze toward Alia while keeping her two neighboring contacts gentle",
      "Ellie": "fear and urgent vulnerability shown by widened eyes and a braced breath while accepting the male's reassuring forearm touch",
      "Alia": "aching romantic longing shown by a softened gaze toward Radiance and a restrained hopeful smile",
      "AI ECE": "suspicion shown by a measured sideways glance toward the male while maintaining safe route focus",
      "Male": "aching romantic longing shown by a restrained warm expression with his head and pupils most strongly fixed on ECE across their direct shoulder contact"
    },
    "romance": "Translate the cheek greeting, shoulder press, retained fingertips, waist embrace, forehead kiss, and ECE's reclaiming step into a five-adult open arc. ECE supports the isolated prop paddle at far left. The male rests one hand on ECE's near shoulder and his other hand on Ellie's near forearm while his strongest sustained eye line remains on ECE. ECE answers at his near forearm. Ellie answers at the male's forearm and rests her other hand on Radiance's shoulder. Radiance answers at Ellie's shoulder and rests her free hand on Alia's forearm while leaning her forehead affectionately toward Alia without hiding either face. Alia answers at Radiance's forearm and keeps her outer hand visible. This is fully clothed consensual adult infidelity drama expressed only through restrained eye lines and gentle public touch.",
    "composition": "Place ECE far left facing the empty road route, the male left-center turned three-quarter-left toward ECE, Ellie center half a step behind him, Radiance right-center in a three-quarter back turn, and Alia far right facing Radiance. Keep pale rain-lit sky, gate openings, ditch space, lane gaps, or terraced fields behind all ten arms. The moving open arc must show every hand endpoint and the male must never look most strongly at another woman.",
    "outfits": {
      "Radiance": "a fully strapless Malta-red cropped undercover-investigator bodice with a high straight opaque bustline exposing a narrow ordinary waist panel, secure opaque front and sides, and a completely open back from shoulder blades to the separate waistline, with a separate salt-white above-knee flared skirt carrying a large complete Mdina gate arch and winding-lane composition, and warm-gold pumps",
      "Ellie": "a Mediterranean-cobalt cap-sleeve undercover-investigator above-knee tailored skort dress with covered waist and high closed back, carrying a large complete bastion-wall, dry-ditch, and sunshower-arc composition, with rain-silver slingback heels",
      "Alia": "a Gozo-ochre high-neck sleeveless undercover-investigator above-knee sculpted dress with covered waist and high closed back, carrying a large complete civic-facade rhythm and terraced-field contour composition, with harbor-turquoise platform heels",
      "AI ECE": "a prickly-pear-green cropped undercover-investigator jacket exposing a narrow ordinary waist panel, with a separate night-charcoal above-knee asymmetric skirt carrying a large complete empty-road-route and hilltop contour composition, high closed back, and Malta-red heeled boots",
      "Male": "the established adult male face from Scene 1136 with closely trimmed beard and athletic muscular build, wearing an opaque fitted honey-limestone short-sleeve top carrying a restrained complete Mdina gate, bastion, and terraced-field composition, fitted black jeans, and practical black boots"
    },
    "hands": [
      "ECE left open hand supports the opaque inspection paddle and inert prop from beneath; ECE right hand rests visibly on the male's near forearm",
      "the male left hand rests visibly on ECE's near shoulder; the male right hand rests visibly on Ellie's near forearm",
      "Ellie left hand rests visibly on the male's near forearm; Ellie right hand rests visibly on Radiance's near shoulder",
      "Radiance left hand rests visibly on Ellie's near shoulder; Radiance right hand rests visibly on Alia's near forearm",
      "Alia left hand rests visibly on Radiance's near forearm; Alia right open hand remains clearly visible at her far outer side"
    ],
    "propHandler": "AI ECE",
    "propTarget": "left across one clearly empty Mdina approach road toward an unoccupied route marker, away from the gate, walls, fields, every person, animal, and camera"
  },
  {
    "scene": 1302,
    "theme": "nurse-care couture",
    "landmark": "a broad dry nonslip covered viewing deck above the Blue Grotto and Wied iz-Zurrieq during cinematic light rain with reflections, with the complete massive honey-limestone sea arch, a chain of blue sea caves, cobalt water, white wave foam, distant uninhabited Filfla silhouette, small moored civilian boats, one clearly empty marked water route, and all rain beyond the shelter",
    "motifs": [
      "large complete Blue-Grotto arch, sea-cave chain, cobalt-reflection band, limestone-layer, white-wave-foam, Filfla silhouette, boat-route, and empty-water-route compositions across all four outfits",
      "at least two separate outfits each carry one complete full-width secular Malta grotto-and-coast composition rather than tiny trim"
    ],
    "culture": "Use Blue Grotto's massive natural limestone arch, linked sea caves, reflected cobalt water, wave foam, cliff layers, Filfla silhouette, and small civilian boat route respectfully. Nurse-care couture is only original public-safe fictional fashion inspired by calm mutual support and route wellness. There is no clinic, patient, diagnosis, treatment, procedure, medical instrument, copied uniform, badge, red cross, caduceus, emergency, injury, or sexualized care. Use secular Maltese harbors, bastion geometry, limestone streets, civic gates, terraced fields, natural arches, sea caves, cliffs, inland-sea tunnels, salt-white stone, boats, paths, and public infrastructure only. No literal flag, Maltese cross, coat of arms, crown, official seal, sacred symbol, religious building, copied ceremonial pattern, copied uniform, badge, readable text, brand, alcohol, or political insignia.",
    "expected": {
      "weather": "cinematic light rain with reflections",
      "paws": true,
      "pole": false,
      "rainbowOnly": false,
      "rainbowHosiery": false,
      "wearer": "Radiance",
      "palette": "country-palette rainbow-like gradient",
      "cuts": {
        "Radiance": [
          false,
          false,
          false
        ],
        "Ellie": [
          false,
          true,
          false
        ],
        "Alia": [
          true,
          false,
          true
        ],
        "AI ECE": [
          true,
          false,
          false
        ]
      }
    },
    "emotionNuance": {
      "Radiance": "overwhelming relief shown by relaxed shoulders and tear-bright smiling eyes while securely cradling PAWS",
      "Ellie": "aching romantic longing shown by a softened gaze toward Radiance while her kitten touch stays gentle",
      "Alia": "hope shown by a quiet upward smile toward ECE while maintaining the linked care chain",
      "AI ECE": "romantic joy shown by a bright affectionate smile toward Alia while maintaining calm route-strategist focus"
    },
    "romance": "Translate the shared-ribbon pull, two calming hands, over-shoulder closeness, behind embrace, cheek greeting, retained handhold, and direct ECE eye line into a PAWS-safe open care chain. ECE remains far left with the prop paddle and rests her free hand gently at Alia's near waist. Alia answers at ECE's forearm and rests her free hand on Ellie's shoulder. Ellie answers at Alia's shoulder and gently pets PAWS with her free hand. Far right, Radiance securely cradles PAWS with one arm and rests her free hand on Ellie's forearm. The chain carries the rolled embrace and cheek-greeting tenderness through open side-by-side eye lines without hiding any hand.",
    "composition": "Place ECE far left facing the empty sea route, Alia left-center in a clear three-quarter back turn, Ellie right-center leaning toward PAWS, and Radiance far right standing upright with PAWS securely against her upper torso. Keep a wide open water gap between the prop and PAWS. Use pale sky, sea, arch openings, cave shadow, or deck rail gaps behind every arm. The group forms an asymmetric rising diagonal, not a lineup.",
    "outfits": {
      "Radiance": "a salt-white short-sleeve nurse-care above-knee tailored skort dress with covered waist and high closed back, carrying a large complete Blue Grotto arch and cobalt-reflection composition, with Malta-red pumps",
      "Ellie": "a fully strapless harbor-turquoise nurse-care above-knee A-line dress with a high straight opaque bustline, covered waist, and high closed back, carrying a large complete sea-cave chain and white-wave-foam composition, with warm-gold slingback heels",
      "Alia": "a Mediterranean-cobalt cropped nurse-care jacket exposing a narrow ordinary waist panel, with secure opaque sides and a completely open back from shoulder blades to the separate waistline, a separate Gozo-ochre above-knee sculpted skirt carrying a large complete limestone-layer and Filfla-silhouette composition, with prickly-pear-green platform heels",
      "AI ECE": "a sunset-coral cap-sleeve cropped nurse-care top exposing a narrow ordinary waist panel, with a separate night-charcoal above-knee tailored skort carrying a large complete boat-route and empty-water-route composition, high closed back, and salt-white heeled boots"
    },
    "hands": [
      "ECE left open hand supports the opaque inspection paddle and inert prop from beneath; ECE right hand rests visibly at Alia's near waist",
      "Alia left hand rests visibly on ECE's near forearm; Alia right hand rests visibly on Ellie's near shoulder",
      "Ellie left hand rests visibly on Alia's near shoulder; Ellie right hand gently pets PAWS on the upper back",
      "Radiance left forearm and hand securely cradle PAWS against her upper torso; Radiance right hand rests visibly on Ellie's near forearm"
    ],
    "propHandler": "AI ECE",
    "propTarget": "left across clearly empty Blue Grotto water toward one unoccupied route marker, away from the arch, boats, PAWS, the affectionate chain, every person, animal, and camera",
    "paws": "PAWS is active as one tiny collarless golden kitten, securely cradled in Radiance's left arm far right from the prop and stable footing. Ellie gently pets PAWS's upper back. No second kitten, collar, costume, leash, ribbon, floor placement, prop proximity, or unsafe footing."
  },
  {
    "scene": 1303,
    "theme": "nurse-care couture",
    "landmark": "a broad dry nonslip covered public overlook above Gozo's Dwejra inland sea during cinematic light rain with reflections, with the complete circular subsidence basin, narrow sea tunnel through honey-limestone cliffs, Dwejra Bay, Fungus Rock sea stack, layered fossil-bearing rock, low reefs, one clearly empty marked water route, and all rain beyond the shelter",
    "motifs": [
      "large complete Dwejra circular-basin, inland-sea tunnel, Fungus-Rock stack, limestone-cliff layer, fossil-band, sea-cave, reef-line, and empty-water-route compositions across all four outfits",
      "at least two separate outfits each carry one complete full-width secular Malta Dwejra geology composition rather than tiny trim"
    ],
    "culture": "Use Dwejra's circular subsidence basin, inland sea, narrow sea tunnel, limestone cliffs, Fungus Rock, fossil layers, sea caves, stacks, reefs, and wilderness seascape respectfully. No protected wildlife appears nearby. Nurse-care couture is only original public-safe fictional fashion inspired by calm mutual support and route wellness. There is no clinic, patient, diagnosis, treatment, procedure, medical instrument, copied uniform, badge, red cross, caduceus, emergency, injury, or sexualized care. Use secular Maltese harbors, bastion geometry, limestone streets, civic gates, terraced fields, natural arches, sea caves, cliffs, inland-sea tunnels, salt-white stone, boats, paths, and public infrastructure only. No literal flag, Maltese cross, coat of arms, crown, official seal, sacred symbol, religious building, copied ceremonial pattern, copied uniform, badge, readable text, brand, alcohol, or political insignia.",
    "expected": {
      "weather": "cinematic light rain with reflections",
      "paws": false,
      "pole": false,
      "rainbowOnly": false,
      "rainbowHosiery": false,
      "wearer": "AI ECE",
      "palette": "original independent rainbow gradient",
      "cuts": {
        "Radiance": [
          false,
          false,
          true
        ],
        "Ellie": [
          true,
          false,
          false
        ],
        "Alia": [
          false,
          true,
          false
        ],
        "AI ECE": [
          false,
          false,
          true
        ]
      }
    },
    "emotionNuance": {
      "Radiance": "aching romantic longing shown by a softened gaze toward ECE while their linked support gesture stays steady",
      "Ellie": "defiance shown by an upright chin and direct gaze toward Alia while keeping both shoulder contacts gentle",
      "Alia": "anger shown by a controlled furrowed brow toward the empty route rather than any person while her forearm contact remains calm",
      "AI ECE": "magnetic confidence shown by a poised half-smile toward Radiance while maintaining calm route-strategist focus"
    },
    "romance": "Translate ECE's rise from the beacon, Radiance's help, Ellie's rear embrace, Alia's downward reach, side-by-side closeness, cheek greeting, and hands-over-hands beat into a stable all-standing Dwejra support chain. ECE remains far left with the prop paddle and rests her free hand on Radiance's forearm. Radiance answers at ECE's upper arm and rests her free hand on Ellie's shoulder. Ellie answers at Radiance's shoulder and rests her other hand on Alia's forearm. Alia answers at Ellie's forearm and keeps her outer hand openly visible. Their close eye lines carry the rolled cheek-greeting and joined-hands tenderness without kneeling, hidden hands, or unsafe footing.",
    "composition": "Place ECE far left facing the empty inland-sea route, Radiance left-center turning three-quarter-back toward ECE, Ellie right-center in a forward supportive step, and Alia far right turning inward. Use pale rain-lit sky, inland water, tunnel opening, cliff gaps, or reef air behind every arm. Show both fully open backs, all faces, and all eight arm paths while the group forms a shallow moving crescent.",
    "outfits": {
      "Radiance": "a Malta-red cap-sleeve nurse-care above-knee A-line dress with covered waist, secure opaque sides, and a completely open back from shoulder blades to the separate waistline, carrying a large complete Dwejra circular basin and inland-sea tunnel composition, with salt-white pumps",
      "Ellie": "a harbor-turquoise cropped nurse-care jacket exposing a narrow ordinary waist panel, with a separate honey-limestone above-knee tailored skirt carrying a large complete limestone-cliff layer and fossil-band composition, high closed back, and warm-gold slingback heels",
      "Alia": "a fully strapless Gozo-ochre nurse-care above-knee architectural skort dress with a high straight opaque bustline, covered waist, and high closed back, carrying a large complete Fungus-Rock stack, sea-cave, and reef-line composition, with Mediterranean-cobalt platform heels",
      "AI ECE": "a prickly-pear-green sleeveless nurse-care above-knee sculpted romper with covered waist, secure opaque sides, and a completely open back from shoulder blades to the separate waistline, carrying a large complete empty-water-route and Dwejra contour composition, with Malta-red heeled boots"
    },
    "hands": [
      "ECE left open hand supports the opaque inspection paddle and inert prop from beneath; ECE right hand rests visibly on Radiance's near forearm",
      "Radiance left hand rests visibly on ECE's near upper arm; Radiance right hand rests visibly on Ellie's near shoulder",
      "Ellie left hand rests visibly on Radiance's near shoulder; Ellie right hand rests visibly on Alia's near forearm",
      "Alia left hand rests visibly on Ellie's near forearm; Alia right open hand remains clearly visible at her far outer side"
    ],
    "propHandler": "AI ECE",
    "propTarget": "left across clearly empty Dwejra inland-sea water toward one unoccupied route marker, away from the tunnel, cliffs, Fungus Rock, reefs, every person, animal, and camera"
  }
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
if (maleScene !== 1301) throw new Error(`Male scene drifted to ${maleScene}`);

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
    ? `Rainbow hosiery is active on exactly ${rainbowHosiery.wearer.result} in ${rainbowHosiery.palette.result}; nobody else wears it. Radiance and ECE are the affectionate center, Alia alone handles the prop, and ECE keeps the separate hands-free holographic route map.`
    : "Rainbow hosiery is inactive. Nobody wears stockings or knee socks. ECE alone handles the prop and keeps a separate hands-free holographic route map.";
  const rainbowOnlyLine = rainbowOnly.active
    ? "Rainbow-only is active. All outfits use varied public-safe rainbow palettes while preserving the large Malta motifs."
    : "Rainbow-only is inactive. Do not convert the wardrobe to rainbow-only styling.";
  const poleLine = poleDanceTheme.active
    ? (spec.pole ?? "Pole theme is active only as a stationary public-safe fashion motif with no dance or suggestive performance.")
    : "Pole theme is inactive. No pole.";

  const renderPrompt = [
    "Use case: photorealistic-natural. Asset type: fresh vertical World Series public-fashion scene.", referenceLine,
    `Create one photorealistic 9:16 full-length editorial at ${spec.landmark}.`, castLine,
    "Every person is a fictional adult visibly over age 28. Preserve the anchored faces, skin tones, and distinct identities: blonde Radiance, dark-haired Ellie, Black Alia with the only high sculptural braided ponytail, brunette AI ECE, and the Scene 1136 bearded male when present. No cloning, replacement, merging, or age shift.",
    `Profession theme: ${spec.theme}, used only as original public-safe fictional fashion. No copied uniform, badge, patient, treatment, diagnosis, procedure, police impersonation, arrest, raid, threat, injury, combat, or sexualized care.`,
    triggerLine, `Exact wardrobe rolls: ${cutLine}.`,
    `Use four unmistakably different secure opaque lined above-knee silhouettes. Exact outfits: ${outfitLine}. Materialize every rolled midriff, strapless cut, and open back exactly.`,
    `Large complete secular Malta motifs dominate at least two outfits: ${spec.motifs.join("; ")}. ${spec.culture}`,
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
  rollMethod: "FNV-1a over the recorded batch320-malta keys, reduced modulo 100. Male scene selection uses the full 32-bit hash reduced modulo 4.",
  rollThresholds: {
    visibleMidriff: "0-49", straplessDress: "0-34", fullyOpenBack: "0-29", paws: "0-24",
    poleDanceTheme: "0-5", rainbowOnly: "0-3", rainbowHosiery: "0-24",
    rainbowHosieryWearer: "0-49 Radiance; 50-99 AI ECE",
    rainbowHosieryPaletteMode: "0-49 country-palette rainbow-like gradient; 50-99 original independent rainbow gradient",
  },
  themePair: ["undercover investigator couture", "nurse-care couture"],
  nextThemePair: ["nurse-care couture", "doctor-clinical-command couture"],
  nextQueueCountry: "Maldives", nextQueueBatch: 321, nextQueueScenes: [1304, 1305, 1306, 1307],
  researchSources: [
    { url: "https://whc.unesco.org/en/list/131", usedFor: "Valletta's fortified hilly peninsula, natural harbors, uniform civic grid, bastioned walls, and historic urban form" },
    { url: "https://whc.unesco.org/en/tentativelists/983/", usedFor: "Mdina's fortified hilltop, winding street system, Baroque urban fabric, defenses, dry ditches, and terraced setting" },
    { url: "https://www.visitmalta.com/en/attraction/blue-grotto-malta/", usedFor: "Blue Grotto as a recognized Maltese sea-cave attraction and boat-route landscape" },
    { url: "https://whc.unesco.org/en/tentativelists/980/", usedFor: "Dwejra's inland sea, circular subsidence structures, sea tunnel, limestone cliffs, caves, stacks, reefs, fossil layers, and Fungus Rock" },
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
    flagMotifDecision: "No literal Malta flag, Maltese cross, coat of arms, crown, or official emblem is copied onto clothing. Large researched secular harbor, bastion, civic-grid, gate, lane, terrace, natural-arch, sea-cave, cliff, inland-sea, tunnel, sea-stack, reef, fossil-layer, boat, and route fields replace them.",
    palette,
    minimumCoverage: "Every scene places multiple large complete secular Malta motifs across at least two outfits as full bodice, skirt, hip, or panel fields rather than tiny trim.",
    cultureScene: "The four scenes foreground Valletta and Grand Harbour, Mdina's fortified hilltop, Blue Grotto and Wied iz-Zurrieq, and Dwejra's inland sea geology.",
    prohibitions: "No literal flag, Maltese cross, coat of arms, crown, official seal, sacred symbol, religious architecture, copied ceremonial pattern, copied investigator or nurse uniform, badge, red cross, caduceus, patient, treatment, diagnosis, procedure, sexualized care, weapon threat, police impersonation, arrest, raid, surveillance of people, assassination, combat, political insignia, or branded product.",
  },
  xPublishingRolls,
  xPublishingPlan: {
    minimumCurrentCountryAcceptedAssets: 2,
    attachmentShape: "two Malta images plus one accepted Maldives image when available",
    captionIfEligible: "Malta white heart Maldives #Malta #WorldXXXSeries",
    internalAgencyHashtagActive: false,
    worldXXXSeriesHashtagActive: true,
  },
  anatomyGate: {
    fourPersonScenes: "Scenes 1300, 1302, and 1303 require exactly eight arms and eight hands, two per woman, with every limb continuously traceable to one owner.",
    fivePersonScene: "Scene 1301 requires exactly ten arms and ten hands, two per adult, with the male added without replacing any woman.",
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
fs.writeFileSync(path.join(root, "batch-320-malta-preflight.json"), `${JSON.stringify(preflight, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  preflight: path.join(root, "batch-320-malta-preflight.json"),
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
