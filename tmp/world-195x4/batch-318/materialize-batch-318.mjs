import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const batch = 318;
const country = "Suriname";
const countrySlug = "suriname";
const firstScene = 1292;
const root = path.resolve("tmp/world-195x4/batch-318");
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

const commonProhibitions = "Use secular Suriname rivers, bridges, rainforest, reservoirs, waterfalls, granite formations, coast, wildlife, agriculture, food, craft, and civic infrastructure only. No literal flag, central star, coat of arms, official seal, sacred symbol, religious building, copied Indigenous or Maroon ceremonial pattern, copied uniform, badge, readable text, brand, alcohol, or political insignia.";
const palette = "rainforest emerald, Suriname-river blue, clay red, rice white, bromeliad magenta, golden yellow, mahogany brown, sea-turtle teal, granite silver, and night charcoal";

const sceneSpecs = [
  {
    "scene": 1292,
    "theme": "cleaner and service couture",
    "landmark": "a broad dry covered riverfront pavilion on Paramaribo's Waterkant during a rolling thunderstorm, with the complete high arc of the Jules Wijdenbosch Bridge over the Suriname River, secular wooden waterfront facades, a broad quay, rain trees, riverboats secured far away, and one clearly empty marked water route; lightning and rain remain beyond the roof",
    "motifs": [
      "large complete Jules-Wijdenbosch-Bridge arc, Suriname-River current, Waterkant quay, wooden-shutter, riverboat, rain-tree, cassava-leaf, and market-fruit compositions across all four outfits",
      "at least two separate outfits each carry one complete full-width secular Suriname riverfront-and-bridge composition rather than tiny trim"
    ],
    "culture": "Use Paramaribo's Suriname River waterfront, Jules Wijdenbosch Bridge, Waterkant quay, secular wooden architecture, river mobility, rain trees, cassava, and market fruit respectfully. Cleaner and service couture is only original fully clothed fictional public-utility tailoring; no copied work uniform, badge, degrading labor, sexualized service, or unsafe cleaning act. Use secular Suriname rivers, bridges, rainforest, reservoirs, waterfalls, granite formations, coast, wildlife, agriculture, food, craft, and civic infrastructure only. No literal flag, central star, coat of arms, official seal, sacred symbol, religious building, copied Indigenous or Maroon ceremonial pattern, copied uniform, badge, readable text, brand, alcohol, or political insignia.",
    "expected": {
      "weather": "rolling thunderstorm",
      "paws": false,
      "pole": false,
      "rainbowOnly": false,
      "rainbowHosiery": false,
      "wearer": "AI ECE",
      "palette": "country-palette rainbow-like gradient",
      "cuts": {
        "Radiance": [
          false,
          true,
          false
        ],
        "Ellie": [
          false,
          false,
          true
        ],
        "Alia": [
          true,
          false,
          true
        ],
        "AI ECE": [
          true,
          true,
          false
        ]
      }
    },
    "emotionNuance": {
      "Radiance": "magnetic confidence shown by a calm upright river-guide gaze while accepting the group embrace",
      "Ellie": "aching romantic longing shown by a softened seated gaze toward Radiance",
      "Alia": "contained resentment shown by a tight controlled glance toward Ellie while keeping both contacts gentle",
      "AI ECE": "suspicion shown by a narrowed strategist gaze toward the empty river route"
    },
    "romance": "Translate Alia's route card against Radiance's back and behind embrace, Ellie's cheek touch, ECE's close controlled jealousy, Ellie's low mission-plinth seat, Radiance's close public hug, Radiance's quick cheek greeting to Alia, and ECE's hand at Ellie's shoulder into a stable open tableau. Ellie sits on a low broad quay bench at left with both legs and heels completely visible. Radiance stands one step forward and slightly offset between Ellie's separated knee lanes, with shoulder-only closeness and no lower-body contact. ECE rests one hand on Ellie's shoulder while her other hand keeps the prop isolated. Ellie links Radiance and touches her cheek. Radiance answers at Alia's cheek. Alia holds a flat route card visibly against Radiance's upper back while her other hand rests at Radiance's waist. All five contacts remain public, gentle, consensual, and unobstructed.",
    "composition": "Place ECE far left, Ellie left-center seated, Radiance center one step forward, and Alia far right slightly behind Radiance. Keep river, bridge, pale storm sky, or pavilion gaps behind all eight arms. No torso, route card, or hair may hide an elbow, wrist, or hand.",
    "outfits": {
      "Radiance": "a fully strapless clay-red cleaner-and-service couture above-knee A-line dress with a high straight opaque bustline, covered waist, and high closed back, carrying a large complete Jules Wijdenbosch Bridge and Suriname River composition, with rice-white pumps",
      "Ellie": "a rainforest-emerald sleeveless cleaner-and-service couture above-knee tailored romper with covered waist, secure opaque sides, and a completely open back from shoulder blades to the separate waistline, carrying a large complete Waterkant quay, wooden-shutter, and rain-tree composition, with golden-yellow slingback heels",
      "Alia": "a Suriname-river-blue cap-sleeve cropped cleaner-and-service couture jacket exposing a narrow ordinary waist panel, with secure opaque sides and a completely open back from shoulder blades to the separate waistline, a separate night-charcoal above-knee skort carrying a large complete riverboat, cassava-leaf, and market-fruit composition, with bromeliad-magenta platform heels",
      "AI ECE": "a fully strapless sea-turtle-teal cropped cleaner-and-service couture bodice with a high straight opaque bustline exposing a narrow ordinary waist panel, with a separate granite-silver above-knee skirt carrying a large complete bridge-arc, river-current, and empty-route composition, high closed back, and clay-red heeled boots"
    },
    "hands": [
      "ECE right open hand supports the opaque inspection paddle and inert prop from beneath; ECE left hand rests visibly on Ellie's far shoulder",
      "Ellie left hand links visibly with Radiance's left hand; Ellie right hand rests visibly at Radiance's near cheek",
      "Radiance left hand links visibly with Ellie's left hand; Radiance right hand rests visibly at Alia's near cheek",
      "Alia left hand rests visibly at Radiance's near waist; Alia right hand holds one flat opaque route card visibly against Radiance's upper back"
    ],
    "propHandler": "AI ECE",
    "propTarget": "left across clearly empty Suriname River water toward one unoccupied route marker, away from bridge traffic and riverboats"
  },
  {
    "scene": 1293,
    "theme": "cleaner and service couture",
    "landmark": "a broad dry covered panoramic platform on Brownsberg overlooking the complete Brokopondo Reservoir during a sunshower with sparkling droplets, with the vast reservoir, rainforest islands, red-earth ridge, layered Guiana Shield hills, distant treetops, a bright rain shaft, and one clearly empty marked water route",
    "motifs": [
      "large complete Brokopondo-reservoir, Brownsberg-ridge, rainforest-island, red-earth-road, rain-shaft, howler-monkey silhouette, tropical-bird wing, and water-route compositions across all four women's outfits and the male top",
      "at least two separate outfits each carry one complete full-width secular Suriname reservoir-and-rainforest composition"
    ],
    "culture": "Use Brownsberg's high rainforest plateau, Brokopondo Reservoir, red earth, Guiana Shield hills, tropical birds, howler monkeys, and watershed landscape respectfully. Wildlife stays distant and undisturbed. Cleaner and service couture is only original fully clothed fictional public-utility tailoring; no copied work uniform, badge, degrading labor, sexualized service, or unsafe cleaning act. Use secular Suriname rivers, bridges, rainforest, reservoirs, waterfalls, granite formations, coast, wildlife, agriculture, food, craft, and civic infrastructure only. No literal flag, central star, coat of arms, official seal, sacred symbol, religious building, copied Indigenous or Maroon ceremonial pattern, copied uniform, badge, readable text, brand, alcohol, or political insignia.",
    "expected": {
      "weather": "sunshower with sparkling droplets",
      "paws": false,
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
          false,
          true
        ],
        "Alia": [
          false,
          false,
          false
        ],
        "AI ECE": [
          false,
          false,
          false
        ]
      }
    },
    "emotionNuance": {
      "Radiance": "anger shown by a firm jaw and focused gaze past the male while every touch stays controlled",
      "Ellie": "overwhelming relief shown by relaxed shoulders and tear-bright eyes toward Alia",
      "Alia": "romantic joy shown by a luminous smile toward Radiance",
      "AI ECE": "overwhelming relief shown differently through one visible tear and a deep steadying breath toward Radiance",
      "Male": "tender affection shown by a warm restrained expression with his head and pupils most strongly fixed on ECE across the group"
    },
    "romance": "Translate Radiance walking with ECE's hand, Ellie's gentle forearm catch, Alia's protective close, and the turning embrace chain into a five-adult open fan. ECE and Radiance link one hand pair. Radiance rests her free hand on the male's upper arm. The male keeps two clear public contacts by resting one hand on Ellie's shoulder and the other on Alia's forearm while his strongest sustained eye line remains on ECE. Ellie answers at the male's forearm and links Alia. Alia links Ellie and answers at the male's forearm. This is fully clothed consensual adult infidelity drama expressed only through restrained eye lines and gentle public touch.",
    "composition": "Place ECE far left, Radiance left-center, the male center, Ellie right-center, and Alia far right in five separated lanes. Keep reservoir, rain shaft, pale sky, or forest gaps behind all ten arms. Turn the male's face three-quarter-left beyond Radiance toward ECE; Radiance looks past him and Ellie and Alia look away so no competing eye line dominates.",
    "outfits": {
      "Radiance": "a clay-red high-neck cap-sleeve cleaner-and-service couture above-knee sheath with covered waist and high closed back, carrying a large complete Brownsberg ridge and Brokopondo reservoir composition, with rice-white pumps",
      "Ellie": "a rainforest-emerald sleeveless cleaner-and-service couture above-knee tailored skort dress with covered waist, secure opaque sides, and a completely open back from shoulder blades to the separate waistline, carrying a large complete rainforest-island, rain-shaft, and red-earth-road composition, with golden-yellow slingback heels",
      "Alia": "a Suriname-river-blue one-shoulder cleaner-and-service couture above-knee sculpted dress with covered waist and high closed back, carrying a large complete tropical-bird wing, howler-monkey silhouette, and Guiana-Shield-hill composition, with bromeliad-magenta platform heels",
      "AI ECE": "a sea-turtle-teal collared short-sleeve cleaner-and-service couture above-knee tailored romper with covered waist and high closed back, carrying a large complete watershed, reservoir-current, and empty-route composition, with clay-red heeled boots",
      "Male": "the established adult male face from Scene 1136 with closely trimmed beard and athletic muscular build, wearing an opaque fitted rice-white short-sleeve top carrying a restrained complete Brownsberg ridge-and-reservoir contour, fitted black jeans, and practical black boots"
    },
    "hands": [
      "ECE right open hand supports the opaque inspection paddle and inert prop from beneath; ECE left hand links visibly with Radiance's left hand",
      "Radiance left hand links visibly with ECE's left hand; Radiance right hand rests visibly on the male's near upper arm",
      "the male left hand rests visibly on Ellie's near shoulder; the male right hand rests visibly on Alia's near forearm",
      "Ellie left hand rests visibly on the male's near forearm; Ellie right hand links visibly with Alia's left hand",
      "Alia left hand links visibly with Ellie's right hand; Alia right hand rests visibly on the male's near forearm"
    ],
    "propHandler": "AI ECE",
    "propTarget": "left across clearly empty Brokopondo water toward one unoccupied water-route marker, away from every island, person, animal, and camera"
  },
  {
    "scene": 1294,
    "theme": "cinematic covert-agent crew couture",
    "landmark": "a broad dry covered conservation overlook in the Central Suriname Nature Reserve during soft dramatic overcast, with the complete rounded granite Voltzberg dome rising above primary rainforest, Raleigh Falls on the Coppename River, layered canopy, distant macaws, one empty river route, and no settlement or sacred structure",
    "motifs": [
      "large complete Voltzberg-granite-dome, Raleigh-Falls, Coppename-river, rainforest-canopy, macaw-wing, giant-river-otter ripple, inselberg, and conservation-route compositions across all four outfits",
      "at least two separate outfits each carry one complete full-width secular Suriname rainforest-and-granite composition"
    ],
    "culture": "Use the Central Suriname Nature Reserve's Voltzberg granite dome, Raleigh Falls, Coppename watershed, primary rainforest, macaws, river otters, and Guiana Shield geology respectfully. Wildlife stays distant and undisturbed. Cinematic covert-agent crew couture is only fictional public route-scout fashion; no assassination, injury, combat, copied uniform, badge, raid, arrest, threat, surveillance of people, or official impersonation. Use secular Suriname rivers, bridges, rainforest, reservoirs, waterfalls, granite formations, coast, wildlife, agriculture, food, craft, and civic infrastructure only. No literal flag, central star, coat of arms, official seal, sacred symbol, religious building, copied Indigenous or Maroon ceremonial pattern, copied uniform, badge, readable text, brand, alcohol, or political insignia.",
    "expected": {
      "weather": "soft dramatic overcast",
      "paws": false,
      "pole": true,
      "rainbowOnly": false,
      "rainbowHosiery": false,
      "wearer": "Radiance",
      "palette": "original independent rainbow gradient",
      "cuts": {
        "Radiance": [
          false,
          true,
          false
        ],
        "Ellie": [
          true,
          false,
          false
        ],
        "Alia": [
          true,
          false,
          false
        ],
        "AI ECE": [
          false,
          false,
          false
        ]
      }
    },
    "emotionNuance": {
      "Radiance": "tender affection shown by a reassuring smile and gentle cheek touch toward Alia",
      "Ellie": "romantic joy shown by a bright rising smile toward Radiance",
      "Alia": "tender affection shown differently through a quiet softened gaze and steadying waist contact",
      "AI ECE": "suspicion shown by an alert strategist gaze toward the empty Coppename route"
    },
    "romance": "Translate Ellie's rise into Radiance's waiting side hug, ECE's retained hand link, Alia's wounded-rival beat, Radiance cradling Alia's face, Alia's waist hug, Ellie's opposite-cheek greeting, and ECE's close watch into a wide shallow crescent. ECE and Radiance link one hand pair. Radiance rests her free hand at Alia's cheek. Alia answers at Radiance's waist and links Ellie. Ellie links Alia and rests her free hand on Radiance's shoulder. All five contacts are visible, public, gentle, and consensual.",
    "composition": "Place ECE far left, Radiance left-center, Alia right-center, and Ellie far right in separated lanes. Keep pale sky, granite dome, waterfall mist, or canopy gaps behind every arm. Place the inactive-touch navigation pole well behind the group on a separate base so no hand, body, or prop overlaps it.",
    "outfits": {
      "Radiance": "a fully strapless rice-white cinematic covert-agent above-knee A-line dress with a high straight opaque bustline, covered waist, and high closed back, carrying a large complete Voltzberg dome and rainforest-canopy composition, with clay-red pumps",
      "Ellie": "a rainforest-emerald short-sleeve cropped cinematic covert-agent jacket exposing a narrow ordinary waist panel, with a separate Suriname-river-blue above-knee tailored skort carrying a large complete Raleigh-Falls, Coppename-current, and macaw-wing composition, high closed back, and golden-yellow slingback heels",
      "Alia": "a bromeliad-magenta one-shoulder cropped cinematic covert-agent bodice exposing a narrow ordinary waist panel, with a separate night-charcoal above-knee skirt carrying a large complete giant-river-otter ripple, inselberg, and conservation composition, high closed back, and granite-silver platform heels",
      "AI ECE": "a sea-turtle-teal high-neck cap-sleeve cinematic covert-agent above-knee tailored romper with covered waist and high closed back, carrying a large complete route-grid, granite-dome, and empty-river composition, with clay-red heeled boots"
    },
    "hands": [
      "ECE right open hand supports the opaque inspection paddle and inert prop from beneath; ECE left hand links visibly with Radiance's left hand",
      "Radiance left hand links visibly with ECE's left hand; Radiance right hand rests visibly at Alia's near cheek",
      "Alia left hand rests visibly at Radiance's near waist; Alia right hand links visibly with Ellie's left hand",
      "Ellie left hand links visibly with Alia's right hand; Ellie right hand rests visibly on Radiance's far shoulder"
    ],
    "propHandler": "AI ECE",
    "propTarget": "left across clearly empty Coppename water toward one unoccupied conservation-route marker, away from every person, animal, waterfall, and camera",
    "pole": "Pole theme is active only as one stationary matte-gold vertical navigation marker on its own weighted base far behind the adults. It carries a small abstract route light and no person touches, approaches, dances with, leans on, or performs around it."
  },
  {
    "scene": 1295,
    "theme": "cinematic covert-agent crew couture",
    "landmark": "a broad dry covered conservation boardwalk at Galibi during a heavy rain curtain, with the Atlantic shoreline, Marowijne River mouth, mangrove fringe, beach-morning-glory vines, distant protected leatherback turtle tracks, faraway sea turtles beyond the route zone, and one clearly empty marked ocean route; all wildlife remains distant and undisturbed",
    "motifs": [
      "large complete Galibi-shoreline, Marowijne-river-mouth, mangrove-root, leatherback-shell contour, turtle-track, Atlantic-wave, beach-flower, and conservation-route compositions across all four outfits",
      "at least two separate outfits each carry one complete full-width secular Suriname coast-and-conservation composition"
    ],
    "culture": "Use Galibi's protected Atlantic coast, Marowijne River mouth, mangroves, beach morning glory, sea-turtle nesting habitat, turtle tracks, and community-led conservation respectfully. Wildlife stays distant and no nest is approached. Cinematic covert-agent crew couture is only fictional public route-scout fashion; no assassination, injury, combat, copied uniform, badge, raid, arrest, threat, surveillance of people, or official impersonation. Use secular Suriname rivers, bridges, rainforest, reservoirs, waterfalls, granite formations, coast, wildlife, agriculture, food, craft, and civic infrastructure only. No literal flag, central star, coat of arms, official seal, sacred symbol, religious building, copied Indigenous or Maroon ceremonial pattern, copied uniform, badge, readable text, brand, alcohol, or political insignia.",
    "expected": {
      "weather": "heavy rain curtain",
      "paws": false,
      "pole": false,
      "rainbowOnly": false,
      "rainbowHosiery": false,
      "wearer": "Radiance",
      "palette": "country-palette rainbow-like gradient",
      "cuts": {
        "Radiance": [
          true,
          false,
          true
        ],
        "Ellie": [
          true,
          false,
          true
        ],
        "Alia": [
          true,
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
      "Radiance": "determination shown by a focused forward gaze while keeping her linked hand gentle",
      "Ellie": "awe shown by wide bright eyes toward the rain-swept Atlantic horizon",
      "Alia": "startled surprise shown by lifted brows during the changing route signal",
      "AI ECE": "calm contentment shown by a serene seated smile toward Ellie"
    },
    "romance": "Translate two characters sitting close on a low mission plinth, a third leaning into a behind hug, the fourth standing between their knees with the beacon, ECE sitting against Radiance's side, Radiance's arm around ECE, ECE's quick cheek greeting to Ellie, and Alia resting both hands above their joined hands into a stable public rain-shelter tableau. ECE and Radiance sit side by side on a low broad bench with every leg and heel visible. Ellie stands one step forward and offset between their separated knee lanes so no body is blocked. Alia kneels upright on one dry raised pad at far right with both lower legs and heels visible. ECE and Radiance link one hand pair; Radiance rests her free hand on ECE's upper back. Ellie rests one hand on ECE's shoulder and links Alia. Alia links Ellie and rests her free hand visibly on Radiance's forearm just above the joined pair. All contacts remain public, gentle, consensual, and unobstructed.",
    "composition": "Place ECE left-center and Radiance right-center seated side by side, Ellie far left one step forward, and Alia far right on the raised pad. Keep ocean, pale rain, mangrove, or boardwalk gaps behind all eight arms. The heavy rain curtain remains beyond the roof and every face, elbow, wrist, hand, leg, foot, and heel stays dry and completely visible.",
    "outfits": {
      "Radiance": "a clay-red sleeveless cropped cinematic covert-agent bodice exposing a narrow ordinary waist panel, with secure opaque sides and a completely open back from shoulder blades to the separate waistline, a separate rice-white above-knee skirt carrying a large complete Galibi shoreline and Atlantic-wave composition, with golden-yellow pumps",
      "Ellie": "a rainforest-emerald cap-sleeve cropped cinematic covert-agent jacket exposing a narrow ordinary waist panel, with secure opaque sides and a completely open back from shoulder blades to the separate waistline, a separate Suriname-river-blue above-knee tailored skort carrying a large complete Marowijne-river-mouth, mangrove-root, and beach-flower composition, with granite-silver slingback heels",
      "Alia": "a bromeliad-magenta one-shoulder cropped cinematic covert-agent bodice exposing a narrow ordinary waist panel, with a separate night-charcoal above-knee skirt carrying a large complete leatherback-shell contour, turtle-track, and conservation composition, high closed back, and sea-turtle-teal platform heels",
      "AI ECE": "a fully strapless sea-turtle-teal cinematic covert-agent above-knee A-line dress with a high straight opaque bustline, covered waist, and high closed back, carrying a large complete rain-curtain, empty-ocean-route, and mangrove-shore composition, with clay-red heeled boots"
    },
    "hands": [
      "ECE right open hand supports the opaque inspection paddle and inert prop from beneath; ECE left hand links visibly with Radiance's left hand",
      "Radiance left hand links visibly with ECE's left hand; Radiance right hand rests visibly on ECE's upper back",
      "Ellie left hand rests visibly on ECE's far shoulder; Ellie right hand links visibly with Alia's right hand",
      "Alia right hand links visibly with Ellie's right hand; Alia left hand rests visibly on Radiance's near forearm just above the linked pair"
    ],
    "propHandler": "AI ECE",
    "propTarget": "left across clearly empty Atlantic water toward one unoccupied route marker, away from every turtle, track, nest, mangrove, person, and camera"
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
if (maleScene !== 1293) throw new Error(`Male scene drifted to ${maleScene}`);

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
    ? "Rainbow-only is active. All outfits use varied public-safe rainbow palettes while preserving the large Suriname motifs."
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
    `Large complete secular Suriname motifs dominate at least two outfits: ${spec.motifs.join("; ")}. ${spec.culture}`,
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
  rollMethod: "FNV-1a over the recorded batch318-suriname keys, reduced modulo 100. Male scene selection uses the full 32-bit hash reduced modulo 4.",
  rollThresholds: {
    visibleMidriff: "0-49", straplessDress: "0-34", fullyOpenBack: "0-29", paws: "0-24",
    poleDanceTheme: "0-5", rainbowOnly: "0-3", rainbowHosiery: "0-24",
    rainbowHosieryWearer: "0-49 Radiance; 50-99 AI ECE",
    rainbowHosieryPaletteMode: "0-49 country-palette rainbow-like gradient; 50-99 original independent rainbow gradient",
  },
  themePair: ["cleaner and service couture", "cinematic covert-agent crew couture"],
  nextThemePair: ["cinematic covert-agent crew couture", "undercover investigator couture"],
  nextQueueCountry: "Montenegro", nextQueueBatch: 319, nextQueueScenes: [1296, 1297, 1298, 1299],
  researchSources: [
    { url: "https://www.suriname-tourism.org/en/", usedFor: "Suriname rivers, rainforest, waterfalls, canoes, biodiversity, Galibi turtles, food, and Paramaribo wooden architecture" },
    { url: "https://gov.sr/wp-content/uploads/2025/05/%40-Magazine-Vision-MIN-OW-SIDPS-2025-2050.pdf", usedFor: "Jules Wijdenbosch Bridge over the Suriname River and national transport infrastructure" },
    { url: "https://whc.unesco.org/fr/list/1017", usedFor: "Central Suriname Nature Reserve, Coppename watershed, granite inselbergs, primary rainforest, and Guiana Shield topography" },
    { url: "https://whc.unesco.org/uploads/nominations/1017.pdf", usedFor: "Raleigh Falls, Voltzberg dome, rainforest species, and conservation landscape" },
    { url: "https://suriname.travel/marowijne/", usedFor: "Galibi protected coast, Marowijne River, mangroves, and sea-turtle nesting habitat" },
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
    flagMotifDecision: "No literal Suriname flag, central star, coat of arms, or official emblem is copied onto clothing. Large researched secular bridge, river, reservoir, rainforest, waterfall, granite, coast, wildlife, agriculture, food, and conservation fields replace them.",
    palette,
    minimumCoverage: "Every scene places multiple large complete secular Suriname motifs across at least two outfits as full bodice, skirt, hip, or panel fields rather than tiny trim.",
    cultureScene: "The four scenes foreground Paramaribo's riverfront and bridge, Brownsberg and Brokopondo Reservoir, Voltzberg and Raleigh Falls, and Galibi's protected coast.",
    prohibitions: "No literal flag, central star, coat of arms, official seal, sacred symbol, religious architecture, copied Indigenous or Maroon ceremonial pattern, copied service or covert uniform, badge, weapon threat, sexualized service, assassination, combat, political insignia, or branded product.",
  },
  xPublishingRolls,
  xPublishingPlan: {
    minimumCurrentCountryAcceptedAssets: 2,
    attachmentShape: "two Suriname images plus one accepted Montenegro image when available",
    captionIfEligible: "Suriname red heart Montenegro #Suriname",
    internalAgencyHashtagActive: false,
    worldXXXSeriesHashtagActive: false,
  },
  anatomyGate: {
    fourPersonScenes: "Scenes 1292, 1294, and 1295 require exactly eight arms and eight hands, two per woman, with every limb continuously traceable to one owner.",
    fivePersonScene: "Scene 1293 requires exactly ten arms and ten hands, two per adult, with the male added without replacing any woman.",
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
fs.writeFileSync(path.join(root, "batch-318-suriname-preflight.json"), `${JSON.stringify(preflight, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  preflight: path.join(root, "batch-318-suriname-preflight.json"),
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
