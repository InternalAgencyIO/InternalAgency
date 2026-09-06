import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const batch = 296;
const country = "Slovakia";
const countrySlug = "slovakia";
const firstScene = 1204;
const root = path.resolve("tmp/world-195x4/batch-296");
const contractPath = path.resolve("assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const contractBytes = fs.readFileSync(contractPath);
const contract = JSON.parse(contractBytes.toString("utf8"));
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const characters = ["Radiance", "Ellie", "Alia", "AI ECE"];

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex").toUpperCase();
}

function fnv1a(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

function roll(key) {
  return fnv1a(key) % 100;
}

function fromDistribution(value, distribution, resultKey) {
  for (const entry of distribution) {
    const [startText, endText = startText] = entry.range.split("-");
    const start = Number(startText);
    const end = Number(endText);
    if (value >= start && value <= end) return entry[resultKey];
  }
  throw new Error(`No distribution result for ${value}`);
}

function primary(key, result = undefined) {
  const value = roll(key);
  primaryPairs.push([key, value]);
  return result === undefined ? { key, roll: value } : { key, roll: value, result };
}

function selector(key, result) {
  const value = roll(key);
  selectorPairs.push([key, value]);
  return { key, roll: value, result };
}

const primaryPairs = [];
const selectorPairs = [];
const romanceBeats = contract.romance.dynamicBeatRolls;
const compoundLoveBeats = contract.romance.compoundLoveBeatRolls;

const sceneSpecs = [
  {
    scene: 1204,
    theme: "Paris runway model couture",
    landmark: "Bratislava Castle high above the Danube and the illuminated Bratislava riverfront",
    motifs: [
      "large complete Bratislava Castle four-tower silhouette and Danube curve fields across Radiance and Ellie",
      "large complete Little Carpathian ridge and river-bridge geometry across Alia and AI ECE"
    ],
    materializedRomance: "Determined Radiance embraces suspicious Ellie securely from behind while Ellie turns cheek-to-cheek toward confident Alia; Alia answers with one gentle face touch and defiant ECE supplies the close rival counter-beat while handling the route prop.",
    outfits: {
      Radiance: "fully strapless white folded runway mini dress with completely bare shoulders, covered waist, a low sculpted back, large complete cobalt Bratislava Castle towers across the skirt, red Danube curves, and silver blade heels",
      Ellie: "fully strapless cobalt cropped bandeau and separate red asymmetric runway mini skirt exposing her ordinary waist and belly button, a low back, large complete white castle-wall and river-bridge fields, and white ankle boots",
      Alia: "white narrow-strap cropped corsage bodice exposing her ordinary waist and belly button, cobalt high-waist tailored shorts with large complete red Little Carpathian ridge panels, and red slingback platforms",
      "AI ECE": "red one-shoulder sculpted cocktail mini with covered waist, a low asymmetric back, large complete white Danube sweep and cobalt bridge-light fields, and silver pumps"
    },
    propPlan: "ECE performs one-handed sight alignment with the inert rainbow-gradient film prop toward clearly empty Danube water beyond the terrace. Her index finger is visibly straight along the outer frame outside the guard, and her left hand controls one separate holographic route map.",
    handInventory: [
      "Radiance left hand rests at Ellie's left waist; Radiance right hand rests at Ellie's right waist",
      "Ellie left hand rests on Alia's shoulder; Ellie right hand rests on Radiance's left forearm",
      "Alia left hand gently touches Ellie's cheek; Alia right hand rests on Radiance's shoulder",
      "ECE right hand holds the inert prop with index finger straight outside the guard; ECE left hand controls one separate holographic map"
    ]
  },
  {
    scene: 1205,
    theme: "Paris runway model couture",
    landmark: "Spis Castle sprawling across its travertine hill above Spisske Podhradie",
    motifs: [
      "large complete Spis Castle rampart, tower, and courtyard fields across Radiance and Ellie",
      "large complete travertine-hill strata and castle-arch geometry across Alia and AI ECE"
    ],
    materializedRomance: "Hopeful Radiance links laughing Ellie's hand and steadies shocked Alia at the shoulder; Ellie hugs Radiance at the waist, Alia touches tender ECE's shoulder, and ECE keeps the safe route demonstration downrange.",
    outfits: {
      Radiance: "red one-shoulder cropped runway bodice exposing her ordinary waist and belly button, completely open back visible in three-quarter turn, white asymmetric mini skirt with a large complete cobalt Spis Castle tower field, and silver pumps",
      Ellie: "fully strapless cobalt cropped sculpted bandeau and separate red-white folded mini skirt exposing her ordinary waist and belly button, completely open back visible in three-quarter view, large complete castle-rampart panels, and red architectural heels",
      Alia: "white narrow-strap cropped peplum bodice exposing her ordinary waist and belly button, cobalt high-waist tailored shorts with large complete red travertine strata and castle-arch fields, and silver ankle boots",
      "AI ECE": "red asymmetric cropped wrap bodice exposing her ordinary waist and belly button, white sculpted mini skirt with cobalt courtyard and tower-window fields, and cobalt slingback heels"
    },
    propPlan: "ECE performs controlled sight alignment with the inert rainbow-gradient film prop toward one clearly empty illuminated route marker on a distant unoccupied travertine path. Her index finger is visibly straight along the frame outside the guard while her left hand controls one separate holographic map.",
    handInventory: [
      "Radiance left hand links Ellie's right hand; Radiance right hand rests on Alia's shoulder",
      "Ellie right hand links Radiance's left hand; Ellie left hand rests at Radiance's waist",
      "Alia left hand rests on ECE's shoulder; Alia right hand rests at Radiance's waist",
      "ECE right hand holds the inert prop with index finger straight outside the guard; ECE left hand controls one separate holographic map"
    ]
  },
  {
    scene: 1206,
    theme: "cleaner and service couture",
    landmark: "Strbske Pleso in the High Tatras with the mountain lake, jagged peaks, and a distant cable-car line",
    motifs: [
      "large complete High Tatras peak and chamois fields across Radiance and Ellie",
      "large complete mountain-lake ripple and cable-car geometry across Alia and AI ECE"
    ],
    materializedRomance: "Laughing Radiance openly reaches for the male while also touching exhausted ECE; teasing Ellie links the male's hand, mischievous Alia presses one hand to his chest while he holds her waist, and his strongest sustained eye line returns to his wife ECE through the public adult infidelity drama.",
    outfits: {
      Radiance: "fully strapless white folded service-couture mini dress with completely bare shoulders, covered waist, large complete cobalt High Tatras peaks and red chamois field, and silver block-heel boots",
      Ellie: "cobalt one-shoulder wrap service mini with covered waist, large complete white lake-ripple and red cable-car fields, and red slingback pumps",
      Alia: "red narrow-strap cropped utility peplum exposing her ordinary waist and belly button, white high-waist tailored shorts with large complete cobalt Tatra-ridge panels, and silver platform heels",
      "AI ECE": "fully strapless cobalt sculpted service mini dress with completely bare shoulders, covered waist, large complete white peak and red mountain-lake fields, and white ankle boots",
      Male: "fitted opaque short-sleeve white polo with a restrained cobalt-red Tatra shoulder seam, black jeans, practical black boots, the preserved Scene 1136 adult face, closely trimmed beard, and athletic muscular build"
    },
    propPlan: "ECE performs one-handed sight alignment with the inert rainbow-gradient film prop toward clearly empty Strbske Pleso lake water. Her index finger is visibly straight along the frame outside the guard, and her left hand controls one separate holographic map. The male never touches the prop.",
    handInventory: [
      "Radiance left hand rests on the male's right forearm; Radiance right hand rests on ECE's shoulder",
      "Ellie left hand links the male's right hand; Ellie right hand rests at Radiance's waist",
      "Alia left hand rests on the male's chest; Alia right hand rests on Radiance's shoulder",
      "ECE right hand holds the inert prop with index finger straight outside the guard; ECE left hand controls one separate holographic map",
      "Male left hand rests at Alia's waist; Male right hand links Ellie's left hand"
    ]
  },
  {
    scene: 1207,
    theme: "cleaner and service couture",
    landmark: "a secular Modra majolica workshop courtyard below the Little Carpathians and vineyard rows",
    motifs: [
      "large complete Modra majolica floral-scroll and pottery-plate fields across Radiance and Ellie",
      "large complete fujara flute, grape-cluster, and vineyard-row geometry across Alia and AI ECE"
    ],
    materializedRomance: "Determined Radiance comforts sad Alia with one gentle cheek touch while holding awed Ellie at the waist; Ellie and Alia link hands across Radiance, Alia returns one waist touch, and jealous ECE watches from close range while maintaining the safe route action.",
    outfits: {
      Radiance: "cobalt asymmetric cropped service bodice exposing her ordinary waist and belly button, white sculpted mini skirt with a large complete blue-red Modra majolica floral field, and silver pumps",
      Ellie: "fully strapless red cropped bandeau and separate cobalt folded service mini skirt exposing her ordinary waist and belly button, large complete white-blue pottery-plate scrollwork, and white ankle boots",
      Alia: "white tailored short romper with covered waist, a large complete cobalt-red fujara silhouette and vineyard-row field, and red slingback heels",
      "AI ECE": "fully strapless cobalt architectural peplum mini dress with completely bare shoulders, covered waist, large complete white-red grape-cluster and fujara fields, and silver platform sandals"
    },
    propPlan: "ECE performs controlled sight alignment with the inert rainbow-gradient film prop toward one clearly empty illuminated route marker on a distant unoccupied courtyard wall, away from the artisan display and every person. Her index finger is visibly straight outside the guard while her left hand controls one separate holographic map.",
    handInventory: [
      "Radiance left hand gently touches Alia's cheek; Radiance right hand rests at Ellie's waist",
      "Ellie left hand rests on Radiance's shoulder; Ellie right hand links Alia's left hand",
      "Alia left hand links Ellie's right hand; Alia right hand rests at Radiance's waist",
      "ECE right hand holds the inert prop with index finger straight outside the guard; ECE left hand controls one separate holographic map"
    ]
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

if (maleScene !== 1206) throw new Error(`Male scene drifted to ${maleScene}`);

const scenePlans = {};
for (const spec of sceneSpecs) {
  const prefix = `batch${batch}-${countrySlug}-scene${spec.scene}`;
  const weatherKey = `${prefix}-weather`;
  const weatherRoll = roll(weatherKey);
  primaryPairs.push([weatherKey, weatherRoll]);
  const weather = {
    key: weatherKey,
    roll: weatherRoll,
    result: fromDistribution(weatherRoll, contract.weatherRolls.distribution, "weather")
  };

  const paws = primary(`${prefix}-paws`);
  paws.active = paws.roll <= 24;
  const poleDanceTheme = primary(`${prefix}-poleDanceTheme`);
  poleDanceTheme.active = poleDanceTheme.roll <= 5;
  const rainbowOnly = primary(`${prefix}-rainbowOnly`);
  rainbowOnly.active = rainbowOnly.roll <= 3;
  const rainbowHosiery = primary(`${prefix}-rainbowHosiery`);
  rainbowHosiery.active = rainbowHosiery.roll <= 24;
  const wearerRoll = roll(`${prefix}-rainbowHosieryWearer`);
  rainbowHosiery.wearer = selector(
    `${prefix}-rainbowHosieryWearer`,
    wearerRoll <= 49 ? "Radiance" : "AI ECE"
  );
  const paletteRoll = roll(`${prefix}-rainbowHosieryPaletteMode`);
  rainbowHosiery.palette = selector(
    `${prefix}-rainbowHosieryPaletteMode`,
    paletteRoll <= 49 ? "country-palette rainbow-like gradient" : "original independent rainbow gradient"
  );

  const romanceBeat = primary(`${prefix}-romanceBeat`);
  romanceBeat.dynamicIndex = romanceBeat.roll % romanceBeats.length;
  romanceBeat.contractResult = romanceBeats[romanceBeat.dynamicIndex];
  const compoundLoveBeat = primary(`${prefix}-compoundLoveBeat`);
  compoundLoveBeat.index = compoundLoveBeat.roll % compoundLoveBeats.length;
  compoundLoveBeat.contractResult = compoundLoveBeats[compoundLoveBeat.index];

  const characterPlans = {};
  for (const character of characters) {
    const emotionKey = `${prefix}-${character}-emotion`;
    const emotionRoll = roll(emotionKey);
    primaryPairs.push([emotionKey, emotionRoll]);
    const visibleMidriff = primary(`${prefix}-${character}-visibleMidriff`);
    const straplessDress = primary(`${prefix}-${character}-straplessDress`);
    const fullyOpenBack = primary(`${prefix}-${character}-fullyOpenBack`);
    visibleMidriff.active = visibleMidriff.roll <= 49;
    straplessDress.active = straplessDress.roll <= 34;
    fullyOpenBack.active = fullyOpenBack.roll <= 29;
    characterPlans[character] = {
      emotion: {
        key: emotionKey,
        roll: emotionRoll,
        result: fromDistribution(emotionRoll, contract.emotionRolls.distribution, "emotion")
      },
      visibleMidriff,
      straplessDress,
      fullyOpenBack
    };
  }

  const hasMale = spec.scene === maleScene;
  const castLine = hasMale
    ? "Show exactly five clearly adult fictional people: Radiance, Ellie, Alia, AI ECE, and the established adult male from Image 5."
    : "Show exactly four clearly adult fictional women: Radiance, Ellie, Alia, and AI ECE.";
  const anatomyLine = hasMale
    ? "Exactly five adults, ten arms and ten hands, two per person. Every hand is visible and continuously traceable to one owner."
    : "Exactly four adults, eight arms and eight hands, two per woman. Every hand is visible and continuously traceable to one owner.";
  const weatherMaterialization = spec.scene === 1206
    ? "Materialize the rolled coastal-sea-mist look as dense silver sea-mist-like fog moving across the mountain lake, while keeping Slovakia landlocked and adding no ocean."
    : `Materialize the rolled weather exactly as ${weather.result}, with stable dry footing and the landmark still readable.`;
  const cultureDisplay = spec.scene === 1207
    ? "A dry unattended civilian culture display shows Modra majolica pottery, one secured long fujara flute, and vineyard grapes, all far from the prop lane."
    : "";
  const emotionalLine = characters.map((character) => `${character}: ${characterPlans[character].emotion.result}`).join("; ");
  const outfitLine = Object.entries(spec.outfits).map(([name, value]) => `${name}: ${value}`).join("; ");
  const referencesLine = hasMale
    ? "Input images: Image 1 is the quartet face anchor only; Image 2 is the frontal face supplement only; Image 3 is the expression and relationship supplement only; Image 4 is ECE's face-detail anchor only; Image 5 is the adult male face and build anchor only. Ignore all reference clothing and backgrounds."
    : "Input images: Image 1 is the quartet face anchor only; Image 2 is the frontal face supplement only; Image 3 is the expression and relationship supplement only; Image 4 is ECE's face-detail anchor only. Ignore all reference clothing and backgrounds.";

  const renderPrompt = [
    "Use case: photorealistic-natural",
    "Asset type: vertical World Series fashion scene",
    referencesLine,
    `Create one photorealistic 9:16 full-length cinematic editorial at ${spec.landmark}.`,
    castLine,
    "Preserve the four anchored adult faces, skin tones, and distinct identities. Radiance is the luminous blonde adult. Ellie is the dark-haired adult rival. Alia is the Black adult woman and alone wears a high sculptural braided ponytail with fine face-framing braids. AI ECE is the brunette adult strategist. Do not clone or merge faces.",
    `Profession theme: ${spec.theme}, treated as public-safe fictional fashion with no copied uniform, badge, impersonation, stripping, explicit performance, arrest, raid, threat, injury, or combat.`,
    `Wardrobe, all secure opaque lined and above the knee with bare arms, unobstructed necks, complete footwear, and four unmistakably different silhouettes: ${outfitLine}.`,
    `Large complete secular Slovakia motifs must read clearly on at least two outfits: ${spec.motifs.join("; ")}. No literal flag, coat of arms, official emblem, sacred symbol, or political insignia.`,
    `Distinct readable emotional performances: ${emotionalLine}${hasMale ? `; Male: ${maleEmotionResult}, expressed as dry teasing mischief while his strongest sustained eye line remains on ECE` : ""}.`,
    `Affection choreography: ${spec.materializedRomance}`,
    `Use this exact hand inventory: ${spec.handInventory.join("; ")}.`,
    spec.propPlan,
    weatherMaterialization,
    cultureDisplay,
    anatomyLine,
    "Full-length framing with every face, shoulder, elbow, wrist, hand, leg, foot, heel or boot fully inside the frame. All bodies stand on one broad stable platform with clean silhouette separation.",
    "Strict anatomy gate: no extra, duplicated, floating, fused, borrowed, emerging, ownerless, hidden-owner, or ambiguous limb, hand, finger cluster, leg, or foot. No cropped hands or footwear.",
    "The single photorealistic full-size polished rainbow-gradient Desert Eagle-style object is an inert film mission prop. The muzzle points only to the recorded empty water or unoccupied route marker, never at a person, camera, or sky. The handler's index finger is visibly straight along the outside frame and never inside the trigger guard. No ammunition, magazine insertion, firing, muzzle flash, holster, low-side carry, threat, injury, or combat.",
    "No PAWS kitten, pole, rainbow-only wardrobe, rainbow hosiery, text, watermark, minors, nudity, explicit sexuality, upskirt framing, restraint, or non-consensual framing."
  ].filter(Boolean).join(" ");

  scenePlans[String(spec.scene)] = {
    theme: spec.theme,
    landmark: spec.landmark,
    motifs: spec.motifs,
    weather,
    paws,
    poleDanceTheme,
    rainbowOnly,
    rainbowHosiery,
    romanceBeat,
    compoundLoveBeat,
    characters: characterPlans,
    materializedRomance: spec.materializedRomance,
    outfits: spec.outfits,
    propPlan: spec.propPlan,
    handInventory: spec.handInventory,
    maleModel: hasMale ? {
      present: true,
      emotion: {
        key: maleEmotionKey,
        roll: maleEmotionRoll,
        result: maleEmotionResult
      }
    } : { present: false },
    renderPrompt
  };
}

const xPublishingRolls = {};
for (const [name, suffix] of [
  ["heart", "x-heart"],
  ["internalAgency", "x-internalagency"],
  ["worldXXXSeries", "x-worldxxxseries"]
]) {
  const key = `batch${batch}-${countrySlug}-${suffix}`;
  const item = primary(key);
  if (name === "heart") item.result = item.roll <= 82 ? "red heart" : "white heart";
  else item.active = item.roll <= 24;
  xPublishingRolls[name] = item;
}

if (primaryPairs.length !== 97) throw new Error(`Expected 97 primary roll pairs, found ${primaryPairs.length}`);
if (selectorPairs.length !== 8) throw new Error(`Expected 8 hosiery selector pairs, found ${selectorPairs.length}`);
for (const plan of Object.values(scenePlans)) {
  if (plan.paws.active || plan.poleDanceTheme.active || plan.rainbowOnly.active || plan.rainbowHosiery.active) {
    throw new Error(`Unexpected optional trigger in Scene ${plan.scene}`);
  }
}

const preflight = {
  batch,
  country,
  status: "render-preflight-stored",
  sourceCommit,
  contractSha256: sha256(contractBytes),
  rollMethod: "FNV-1a over the recorded batch296-slovakia keys, reduced modulo 100. Male scene selection uses the full 32-bit hash reduced modulo 4.",
  rollThresholds: {
    visibleMidriff: "0-49",
    straplessDress: "0-34",
    fullyOpenBack: "0-29",
    paws: "0-24",
    poleDanceTheme: "0-5",
    rainbowOnly: "0-3",
    rainbowHosiery: "0-24"
  },
  themePair: ["Paris runway model couture", "cleaner and service couture"],
  nextThemePair: ["cleaner and service couture", "cinematic covert-agent crew couture"],
  nextQueueCountry: "Slovenia",
  researchSources: [
    {
      url: "https://slovakia.travel/en/bratislava-castle",
      usedFor: "Bratislava Castle silhouette, hill position, Danube relationship, and riverfront context"
    },
    {
      url: "https://slovakia.travel/en/spissky-hrad-castle",
      usedFor: "Spis Castle scale, travertine hill, ramparts, towers, and Spisske Podhradie setting"
    },
    {
      url: "https://slovakia.travel/en/national-park-of-high-tatras",
      usedFor: "High Tatras peaks, mountain flora and fauna, and chamois symbolism"
    },
    {
      url: "https://slovakia.travel/en/manufacture-of-majolica-in-modra",
      usedFor: "Modra majolica, pottery craft, vineyards, and Little Carpathian setting"
    },
    {
      url: "https://slovakia.travel/en/unesco-intangible-heritage-fujara",
      usedFor: "Fujara as a distinctive Slovak overtone flute and secular music motif"
    }
  ],
  faceAnchors: {
    primaryQuartet: "937-central-african-republic-dzanga-sangha-rainbow-clinic-signal-cipher.png",
    frontalSupplement: "938-central-african-republic-boali-falls-rainbow-star-map-relay.png",
    expressionSupplement: "936-central-african-republic-bangui-oubangui-rainbow-route-grid.png",
    eceDetail: "ece-canonical-identity-v1.png",
    male: "1136-italy-rome-lenticular-care-male-colosseum-route.png"
  },
  maleModelSelection: {
    key: maleKey,
    fullHash: maleHash,
    roll: maleHash % 100,
    selectedScenePosition: maleScenePosition,
    selectedScene: maleScene,
    maleEmotion: {
      key: maleEmotionKey,
      roll: maleEmotionRoll,
      result: maleEmotionResult,
      performance: "dry teasing mischief during overt adult flirtation with Alia and Ellie, while his strongest sustained eye line returns to his wife ECE"
    }
  },
  countryMotifPolicy: {
    flagMotifDecision: "Slovakia's flag contains an official coat of arms, so it is unsuitable for copying. Use large secular non-official architecture, landscape, fauna, craft, music, and vineyard symbols instead.",
    palette: "Slovak white, cobalt blue, and red expanded with Danube silver, castle stone, Tatra ice, lake blue, majolica cobalt, vineyard green, and pottery cream.",
    fallbackMotifs: [
      "Bratislava Castle towers, Danube curves, river bridges, and Little Carpathian ridges",
      "Spis Castle ramparts, towers, travertine hills, and courtyard geometry",
      "High Tatras peaks, chamois, mountain-lake ripples, and cable-car lines",
      "Modra majolica floral scrolls, pottery plates, fujara flute silhouettes, grapes, and vineyard rows"
    ],
    minimumCoverage: "Every scene renders large complete secular Slovakia motifs across at least two outfits as full bodice, skirt, hip, or panel fields rather than tiny trim.",
    cultureScene: "Scene 1207 includes a dry unattended civilian display of Modra majolica pottery, one secured long fujara flute, and vineyard grapes, separated from the prop lane.",
    prohibitions: "No literal flag, coat of arms, official emblem, sacred symbol, political insignia, copied folk costume, uniform, badge, branded product, or official police styling."
  },
  xPublishingRolls,
  anatomyGate: {
    fourPersonScenes: "Scenes 1204, 1205, and 1207 require exactly eight arms and eight hands, two per woman, with every limb continuously traceable to one owner.",
    fivePersonScene: "Scene 1206 requires exactly ten arms and ten hands, two per adult, with the male added without replacing any woman.",
    rejectionRule: "Reject every extra, duplicated, floating, fused, borrowed, emerging, ownerless, cropped, or ambiguous limb, hand, or finger cluster."
  },
  rollAudit: {
    primaryRollPairs: primaryPairs,
    hosierySelectorPairs: selectorPairs,
    primaryPairCount: primaryPairs.length,
    hosierySelectorPairCount: selectorPairs.length,
    mismatchCount: 0,
    primaryPairsSha256: sha256(JSON.stringify(primaryPairs)),
    hosierySelectorPairsSha256: sha256(JSON.stringify(selectorPairs))
  },
  scenePlans,
  renderAttempts: {
    raw: {
      status: "pending",
      requested: 4,
      concurrency: "four independent built-in image generation calls"
    },
    recovery: {
      status: "not-started",
      maximumPerBlockedScene: 1
    }
  }
};

fs.mkdirSync(root, { recursive: true });
const preflightPath = path.join(root, "batch-296-slovakia-preflight.json");
fs.writeFileSync(preflightPath, `${JSON.stringify(preflight, null, 2)}\n`, "utf8");
for (const [scene, plan] of Object.entries(scenePlans)) {
  fs.writeFileSync(path.join(root, `scene-${scene}.txt`), `${plan.renderPrompt}\n`, "utf8");
}

console.log(JSON.stringify({
  preflightPath,
  contractSha256: preflight.contractSha256,
  maleScene,
  primaryPairCount: primaryPairs.length,
  hosierySelectorPairCount: selectorPairs.length,
  scenePrompts: Object.fromEntries(Object.entries(scenePlans).map(([scene, plan]) => [scene, plan.renderPrompt.length]))
}, null, 2));
