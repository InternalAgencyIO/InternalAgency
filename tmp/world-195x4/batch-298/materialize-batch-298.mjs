import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const batch = 298;
const country = "Spain";
const countrySlug = "spain";
const firstScene = 1212;
const root = path.resolve("tmp/world-195x4/batch-298");
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
    if (value >= Number(startText) && value <= Number(endText)) return entry[resultKey];
  }
  throw new Error(`No distribution result for ${value}`);
}

const primaryPairs = [];
const selectorPairs = [];

function primary(key) {
  const value = roll(key);
  primaryPairs.push([key, value]);
  return { key, roll: value };
}

function selector(key, result) {
  const value = roll(key);
  selectorPairs.push([key, value]);
  return { key, roll: value, result };
}

const sceneSpecs = [
  {
    scene: 1212,
    theme: "cinematic covert-agent crew couture",
    landmark: "a broad dry Passeig de Gracia terrace at crisp blue hour with Casa Batllo's dragon-back roof, Casa Mila's wave facade, Gaudi mosaic forms, and the Barcelona skyline all clearly legible",
    motifs: [
      "one large complete turquoise-red Gaudi mosaic salamander and cobalt ceramic-disc field spanning Radiance and Ellie",
      "one large complete Casa Batllo dragon-back roof and Casa Mila wave-balcony panorama spanning Alia and ECE"
    ],
    culture: "Use secular Gaudi architecture, Mediterranean curves, ceramic mosaics, and city rooflines only. No sacred symbol, club crest, official emblem, literal flag, or branded product.",
    romance: "Joyful Radiance and mischievous Ellie cross in a close laughing turn while Alia leans cheek-to-cheek toward Radiance with visibly aching longing. ECE answers with a distinct restrained longing directed toward Radiance from a clear three-quarter back pose. Radiance touches Ellie and Alia; Ellie steadies both; Alia closes toward ECE; ECE stays emotionally involved while conducting the inert route display.",
    emotionNuance: {
      Radiance: "open romantic joy with bright eyes and an unguarded smile toward Ellie",
      Ellie: "playful mischief with a conspiratorial side glance toward Radiance",
      Alia: "aching romantic longing expressed as a direct tender reach toward Radiance",
      "AI ECE": "aching romantic longing expressed differently as restrained hope and a soft backward glance toward Radiance"
    },
    outfits: {
      Radiance: "a red one-shoulder cropped covert-fashion bodice exposing her ordinary waist and belly button, separate cobalt tailored mini skirt with a large complete turquoise Gaudi salamander and mosaic-disc field, and silver heeled ankle boots",
      Ellie: "a saffron short-sleeve cropped fitted jacket top exposing her ordinary waist and belly button, separate black-white tailored mini shorts with a large complete cobalt-red ceramic-disc and Casa Mila wave field, and red architectural pumps",
      Alia: "a cobalt narrow-strap cropped corsage exposing her ordinary waist and belly button, separate red asymmetric mini skirt with a large complete Casa Batllo dragon-back roof panorama, and saffron platform heels",
      "AI ECE": "a fully strapless ivory-cobalt cropped sculpted bandeau with completely bare shoulders, a completely open back visible from shoulder blades to waist, separate red tailored mini shorts exposing her ordinary waist and belly button with a large complete Casa Mila balcony-wave field, and cobalt slingback heels"
    },
    prop: "ECE alone performs an unloaded magazine-free open-palm manipulation display at the far right. One photorealistic full-size polished rainbow-gradient Desert Eagle-style inert film prop rests across her fully open right palm under the barrel well FORWARD of the trigger guard. The grip is completely untouched. Every right finger is together, flat, and visibly below the forward barrel, nowhere near the trigger or guard. The complete trigger guard and trigger are plainly visible and empty. The horizontal muzzle points toward one distant empty route marker on an unoccupied facade, away from every person and camera, never at the sky. ECE's separate holographic map floats above her left open palm.",
    hands: [
      "Radiance left hand rests visibly on Ellie's near forearm; Radiance right hand rests visibly on Alia's near shoulder",
      "Ellie left hand rests visibly at Radiance's near waist; Ellie right hand rests visibly at Alia's near waist",
      "Alia left hand rests visibly on Radiance's near shoulder; Alia right hand rests visibly on ECE's near upper arm",
      "ECE right open palm supports the inert prop forward of its empty trigger guard; ECE left open palm controls one separate holographic route map"
    ]
  },
  {
    scene: 1213,
    theme: "cinematic covert-agent crew couture",
    landmark: "a broad covered arcade at Madrid's Plaza Mayor during a rolling thunderstorm with the rectangular porticoes, Casa de la Panaderia fresco facade, Gran Via roofline, and distant Puerta de Alcala all clearly legible",
    motifs: [
      "one large complete Plaza Mayor red-arcade and Casa de la Panaderia facade field spanning Radiance and Ellie",
      "one large complete Gran Via roofline, Puerta de Alcala arch, and radial Kilometer Zero road geometry spanning Alia and ECE"
    ],
    culture: "Use secular Madrid architecture, street geometry, rooftop silhouettes, and arcade fresco colors only. No municipal emblem, official seal, literal flag, copied uniform, badge, or brand.",
    romance: "The established male stands centrally in fully clothed public fashion. Content Radiance reaches openly to his forearm while remorseful Ellie touches his chest. Jealous Alia keeps one hand at his shoulder and receives his other waist hold. His other hand holds Ellie's waist, but his strongest sustained eye line passes only to relieved ECE at the far right. ECE remains part of the romance square through Alia's touch while conducting the inert route display. Every contact is consensual adult relationship drama without threat.",
    emotionNuance: {
      Radiance: "calm contentment expressed as a steady affectionate smile toward the male",
      Ellie: "guilt and remorse with lowered eyes toward Radiance",
      Alia: "visible jealousy focused on Ellie while staying close to the male",
      "AI ECE": "overwhelming relief visible in released shoulders and tear-bright eyes toward her husband",
      Male: "visible jealousy toward Ellie and Alia, while his strongest sustained eye line still returns to ECE"
    },
    outfits: {
      Radiance: "a red asymmetric short-sleeve cropped covert top exposing her ordinary waist and belly button, separate black tailored mini skirt with a large complete gold Gran Via roofline and Plaza Mayor arcade field, and cobalt heeled ankle boots",
      Ellie: "a cobalt high-neck halter mini dress with covered waist and a completely open back visible from shoulder blades to waist, one large complete red Plaza Mayor portico and Casa de la Panaderia facade field, and gold slingback pumps",
      Alia: "a fully strapless ivory-red sculpted mini dress with completely bare shoulders and covered waist, one large complete cobalt Puerta de Alcala arch and radial road field, and black platform heels",
      "AI ECE": "a black-white one-shoulder fitted mini skort suit with covered waist and high closed back, one large complete red-gold Kilometer Zero radial geometry and Gran Via crown field, and red architectural pumps",
      Male: "the established adult male face from Scene 1136, closely trimmed beard and muscular special-operative build, a fitted opaque short-sleeve ivory polo with restrained red-cobalt Madrid arcade seams, black jeans, and black boots"
    },
    prop: "ECE alone performs an unloaded magazine-free open-palm manipulation display at the far right. One photorealistic full-size polished rainbow-gradient Desert Eagle-style inert film prop rests across her fully open right palm under the barrel well FORWARD of the trigger guard. The grip is completely untouched. Every right finger is together, flat, and visibly below the forward barrel, nowhere near the trigger or guard. The complete trigger guard and trigger are plainly visible and empty. The horizontal muzzle points toward one distant empty route marker in an unoccupied arcade bay, away from every person and camera, never at the sky. ECE's separate holographic map floats above her left open palm.",
    hands: [
      "Radiance left hand rests visibly on the male's near forearm; Radiance right hand rests visibly on Ellie's near shoulder",
      "Ellie left hand rests visibly on the male's upper chest; Ellie right hand rests visibly at Radiance's near waist",
      "Alia left hand rests visibly on the male's near shoulder; Alia right hand rests visibly on ECE's near upper arm",
      "ECE right open palm supports the inert prop forward of its empty trigger guard; ECE left open palm controls one separate holographic route map",
      "Male left hand rests visibly at Ellie's near waist; Male right hand rests visibly at Alia's near waist"
    ]
  },
  {
    scene: 1214,
    theme: "undercover investigator couture",
    landmark: "a broad covered gallery at Seville's Plaza de Espana with its sweeping semicircle, canal bridges, Triana azulejo tiles, orange trees, and distant Setas de Sevilla all clearly legible beyond cinematic snow flurries",
    motifs: [
      "one large complete Plaza de Espana semicircle, canal bridge, and cobalt-saffron azulejo field spanning Radiance and Ellie",
      "one large complete Spanish guitar, hand-painted folding fan, orange-blossom branch, and Triana ceramic geometry spanning Alia and ECE"
    ],
    culture: "A dry unattended civilian table far from the prop lane holds one Spanish guitar on a stand, hand-painted folding fans, Triana ceramics, orange fruit, a small tapas service, and sealed cold beer bottles. No dancing, copied costume, sacred symbol, official emblem, badge, or brand.",
    romance: "Radiance and ECE both materialize their independently matching full-sobbing rolls but perform them distinctly: Radiance openly collapses toward shocked Ellie with tears and shaking shoulders, while ECE cries in controlled silence at the far right and keeps her route duty. Possessive Alia supports Radiance's forearm, touches ECE's upper arm, and watches Ellie. Ellie steadies Radiance and Alia at their waists. The beat remains consensual, nonviolent, and readable as betrayal, comfort, and rivalry.",
    emotionNuance: {
      Radiance: "full sobbing with tear-streaked face and shaking posture, openly directed toward Ellie",
      Ellie: "betrayal shock with widened eyes and frozen breath toward Radiance",
      Alia: "possessive tension expressed as a protective narrowed gaze toward Ellie",
      "AI ECE": "full sobbing with tear-streaked face and shaking posture, distinct as controlled silent tears while continuing route duty"
    },
    outfits: {
      Radiance: "a saffron short-sleeve fitted investigator mini dress with covered waist and high closed back, one large complete cobalt Plaza de Espana semicircle and canal-bridge panorama, and red heeled ankle boots",
      Ellie: "a fully strapless cobalt cropped bandeau with completely bare shoulders, a completely open back visible from shoulder blades to waist, separate white-red azulejo mini skirt exposing her ordinary waist and belly button, and saffron architectural pumps",
      Alia: "a red narrow-strap cropped tailored top exposing her ordinary waist and belly button, separate white mini shorts with a large complete cobalt-gold Spanish guitar, fan, and orange-blossom field, and cobalt platform heels",
      "AI ECE": "a black-white one-shoulder investigator mini coat-dress with covered waist and high closed back, one large complete red-saffron Triana tile, folding-fan, and orange branch field, and red slingback heels"
    },
    prop: "ECE alone performs an unloaded magazine-free open-palm manipulation display at the far right. One photorealistic full-size polished rainbow-gradient Desert Eagle-style inert film prop rests across her fully open right palm under the barrel well FORWARD of the trigger guard. The grip is completely untouched. Every right finger is together, flat, and visibly below the forward barrel, nowhere near the trigger or guard. The complete trigger guard and trigger are plainly visible and empty. The horizontal muzzle points toward one distant empty route marker on an unoccupied gallery wall, away from every person, culture table, and camera, never at the sky. ECE's separate holographic map floats above her left open palm.",
    hands: [
      "Radiance left hand rests visibly on Ellie's near shoulder; Radiance right hand rests visibly on Alia's near forearm",
      "Ellie left hand rests visibly at Radiance's near waist; Ellie right hand rests visibly at Alia's near waist",
      "Alia left hand rests visibly on Radiance's near forearm; Alia right hand rests visibly on ECE's near upper arm",
      "ECE right open palm supports the inert prop forward of its empty trigger guard; ECE left open palm controls one separate holographic route map"
    ]
  },
  {
    scene: 1215,
    theme: "undercover investigator couture",
    landmark: "a broad dry sheltered terrace beside Valencia's City of Arts and Sciences with its white ribbed forms, reflecting pools, Turia garden curves, Mediterranean light, and a nearby civilian paella table during a sparkling sunshower",
    motifs: [
      "one large complete white City of Arts and Sciences ribbed panorama and turquoise reflecting-pool field spanning Radiance and Ellie",
      "one large complete paella-pan circle, saffron-rice field, Valencia orange branch, and Mediterranean ceramic geometry spanning Alia and ECE"
    ],
    culture: "A dry unattended civilian table far from the prop and pole holds one broad paella pan with saffron rice and vegetables, Valencia oranges, ceramic plates, and horchata glasses. No brand, sacred symbol, official emblem, badge, or copied uniform.",
    romance: "Radiance and ECE are the unmistakable extra-affectionate center: shocked Radiance and remorseful ECE stay cheek-to-cheek while Radiance holds ECE's waist and ECE holds Radiance's forearm. Mischievous Ellie gently pets PAWS and reaches toward tender Alia. Alia returns one waist touch while alone handling the inert prop. The tiny kitten creates a funny interrupted handoff beat, and the fixed pole supports only Radiance's static public-fashion lean.",
    emotionNuance: {
      Radiance: "betrayal shock softened by choosing closeness with ECE",
      Ellie: "playful mischief focused on PAWS and Alia",
      Alia: "tender affection directed toward Ellie during the interrupted handoff",
      "AI ECE": "guilt and remorse expressed through apologetic eye contact with Radiance"
    },
    outfits: {
      Radiance: "a fully strapless saffron-red sculpted investigator mini dress with completely bare shoulders and covered waist, one large complete white City of Arts and Sciences ribbed panorama and turquoise pool field, and silver ankle boots",
      Ellie: "a fully strapless cobalt cropped bandeau with completely bare shoulders, separate white-red tailored mini skirt exposing her ordinary waist and belly button with a large complete paella-pan and Valencia orange field, and red architectural pumps",
      Alia: "a fully strapless red-white architectural mini dress with completely bare shoulders, covered waist, and a completely open back visible from shoulder blades to waist, one large complete saffron paella-rice and Mediterranean ceramic field, and cobalt platform heels",
      "AI ECE": "a cobalt asymmetric short-sleeve cropped investigator top exposing her ordinary waist and belly button, separate red tailored mini shorts with a large complete white futuristic rib and orange-branch field, original independent opaque rainbow-gradient knee socks, and white slingback heels"
    },
    prop: "Alia alone performs an unloaded magazine-free open-palm manipulation display at the far right in a clear three-quarter back pose. One photorealistic full-size polished rainbow-gradient Desert Eagle-style inert film prop rests across her fully open right palm under the barrel well FORWARD of the trigger guard. The grip is completely untouched. Every right finger is together, flat, and visibly below the forward barrel, nowhere near the trigger or guard. The complete trigger guard and trigger are plainly visible and empty. The horizontal muzzle points toward one distant empty route marker across an unoccupied reflecting pool, away from every person, PAWS, pole, culture table, and camera, never at the sky. ECE uses no prop and keeps one separate holographic route map absent from her occupied hands.",
    paws: "PAWS is exactly one tiny collarless golden kitten securely cradled high in ECE's left forearm and hand. Ellie gently pets PAWS between the ears. PAWS is far from the prop, pole, water edge, and unsafe footing, playful and safe, with no second kitten.",
    pole: "Exactly one fixed polished performance pole stands at the far left. Radiance's left hand rests at shoulder height on it for a static, upright, public-safe couture lean with both feet planted. No spin, climb, inversion, explicit dance, second pole, or contact between the pole and PAWS or the prop.",
    hands: [
      "Radiance left hand rests visibly on the fixed pole at shoulder height; Radiance right hand rests visibly at ECE's near waist",
      "Ellie left hand gently pets PAWS between the ears; Ellie right hand rests visibly on Alia's near forearm",
      "Alia left hand rests visibly at Ellie's near waist; Alia right open palm supports the inert prop forward of its empty trigger guard",
      "ECE left forearm and hand securely cradle PAWS; ECE right hand rests visibly on Radiance's near forearm"
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
if (maleScene !== 1213) throw new Error(`Male scene drifted to ${maleScene}`);

const scenePlans = {};
for (const spec of sceneSpecs) {
  const prefix = `batch${batch}-${countrySlug}-scene${spec.scene}`;
  const weather = primary(`${prefix}-weather`);
  weather.result = fromDistribution(weather.roll, contract.weatherRolls.distribution, "weather");
  const paws = primary(`${prefix}-paws`);
  paws.active = paws.roll <= 24;
  const poleDanceTheme = primary(`${prefix}-poleDanceTheme`);
  poleDanceTheme.active = poleDanceTheme.roll <= 5;
  const rainbowOnly = primary(`${prefix}-rainbowOnly`);
  rainbowOnly.active = rainbowOnly.roll <= 3;
  const rainbowHosiery = primary(`${prefix}-rainbowHosiery`);
  rainbowHosiery.active = rainbowHosiery.roll <= 24;
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
    const visibleMidriff = primary(`${prefix}-${character}-visibleMidriff`);
    visibleMidriff.active = visibleMidriff.roll <= 49;
    const straplessDress = primary(`${prefix}-${character}-straplessDress`);
    straplessDress.active = straplessDress.roll <= 34;
    const fullyOpenBack = primary(`${prefix}-${character}-fullyOpenBack`);
    fullyOpenBack.active = fullyOpenBack.roll <= 29;
    characterPlans[character] = { emotion, visibleMidriff, straplessDress, fullyOpenBack };
  }

  const hasMale = spec.scene === maleScene;
  const castLine = hasMale
    ? "Show exactly five clearly adult fictional people: Radiance, Ellie, Alia, AI ECE, and the established adult male from Image 5. Add him without replacing any woman."
    : "Show exactly four clearly adult fictional women: Radiance, Ellie, Alia, and AI ECE.";
  const referenceLine = hasMale
    ? "Image 1 is the quartet face anchor, Image 2 the frontal face supplement, Image 3 the expression supplement, Image 4 ECE's face-detail anchor, and Image 5 the adult male face/build anchor. References control identity only; ignore their clothing, props, and backgrounds."
    : "Image 1 is the quartet face anchor, Image 2 the frontal face supplement, Image 3 the expression supplement, and Image 4 ECE's face-detail anchor. References control identity only; ignore their clothing, props, and backgrounds.";
  const anatomyLine = hasMale
    ? "Exactly five adults, exactly ten arms and exactly ten hands, two per person."
    : "Exactly four adults, exactly eight arms and exactly eight hands, two per woman.";
  const emotionLine = characters.map((character) => `${character}: ${characterPlans[character].emotion.result}, performed as ${spec.emotionNuance[character]}`).join("; ");
  const outfitLine = Object.entries(spec.outfits).map(([name, value]) => `${name}: ${value}`).join("; ");
  const optionalLine = [
    paws.active ? spec.paws : "No PAWS kitten.",
    poleDanceTheme.active ? spec.pole : "No pole.",
    rainbowOnly.active ? "All four outfits use rainbow-only colors while retaining the rolled cuts and motifs." : "Do not convert the full wardrobe to rainbow-only styling.",
    rainbowHosiery.active
      ? `Exactly one rainbow-hosiery wearer: ${rainbowHosiery.wearer.result}, using ${rainbowHosiery.palette.result}. Radiance and ECE are the unmistakable extra-affectionate center, and Alia alone handles the inert prop.`
      : "No rainbow stockings or rainbow knee socks."
  ].filter(Boolean).join(" ");

  const renderPrompt = [
    "Use case: photorealistic-natural. Asset type: vertical World Series fashion scene.",
    referenceLine,
    `Create one photorealistic 9:16 full-length cinematic editorial at ${spec.landmark}.`,
    castLine,
    "Preserve the four anchored adult faces, skin tones, and distinct identities. Radiance is the luminous blonde adult. Ellie is the dark-haired adult rival. Alia is the Black adult woman and alone wears a high sculptural braided ponytail with fine face-framing braids. AI ECE is the brunette adult strategist. Do not clone, replace, or merge faces.",
    `Profession theme: ${spec.theme}, treated only as original public-safe fictional fashion with no copied uniform, badge, police impersonation, arrest, raid, assassination, threat, injury, or combat.`,
    `Wardrobe is secure, opaque, lined, above the knee, and uses four unmistakably different silhouettes. Exact rolled outfits: ${outfitLine}.`,
    `Materialize every rolled cut visibly. Large complete secular Spain motifs must read clearly on at least two outfits: ${spec.motifs.join("; ")}. ${spec.culture}`,
    `Distinct rolled emotional performances: ${emotionLine}${hasMale ? `; Male: ${maleEmotionResult}, performed as ${spec.emotionNuance.Male}` : ""}.`,
    `Materialize the rolled dynamic and compound romance beats through this exact consensual choreography: ${spec.romance}`,
    `Use this exact hand inventory and no other hands: ${spec.hands.join("; ")}.`,
    spec.prop,
    optionalLine,
    `Materialize rolled weather exactly as ${weather.result}. Keep the covered platform stable, dry, and readable while rendering the weather cinematically.`,
    anatomyLine,
    "Every arm is fully visible from shoulder through elbow and wrist to one separated hand. Every hand performs exactly one listed action. Keep all palms and finger clusters separated from garment edges and other hands except for the listed contacts.",
    "Arrange the adults in a shallow asymmetric arc with clean silhouette gaps and relationship motion, not a static lineup. Full-length framing contains every complete face, elbow, wrist, hand, leg, foot, heel, and boot.",
    "Strict anatomy gate: no extra, missing, duplicated, floating, fused, borrowed, emerging, ownerless, hidden-owner, cropped, or ambiguous limb, hand, finger cluster, face, person, kitten, leg, or foot.",
    "The single inert film prop remains harmless. The grip and trigger guard stay untouched. No ammunition, magazine, live reload, firing, muzzle flash, holster, low-side carry, combat, threat, or injury.",
    "No text, watermark, literal flag, coat of arms, official emblem, sacred symbol, copied costume, brand, minors, teen framing, nudity, explicit sexuality, bodily fluids, upskirt framing, fetish, bondage, restraint, mummification, non-consensual framing, or renderer-bypass wording."
  ].join(" ");

  scenePlans[String(spec.scene)] = {
    scene: spec.scene,
    theme: spec.theme,
    landmark: spec.landmark,
    motifs: spec.motifs,
    culture: spec.culture,
    weather,
    paws,
    poleDanceTheme,
    rainbowOnly,
    rainbowHosiery,
    romanceBeat,
    compoundLoveBeat,
    characters: characterPlans,
    materializedRomance: spec.romance,
    emotionNuance: spec.emotionNuance,
    outfits: spec.outfits,
    propPlan: spec.prop,
    handInventory: spec.hands,
    maleModel: hasMale ? {
      present: true,
      emotion: { key: maleEmotionKey, roll: maleEmotionRoll, result: maleEmotionResult, performance: spec.emotionNuance.Male },
      identity: "established adult male from Scene 1136",
      relationship: "married to ECE; fully clothed adult infidelity drama with Alia and Ellie; Radiance reaches for him; strongest sustained eye line remains on ECE"
    } : { present: false },
    renderPrompt
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
if (!scenePlans["1215"].paws.active || !scenePlans["1215"].poleDanceTheme.active || !scenePlans["1215"].rainbowHosiery.active) throw new Error("Scene 1215 optional triggers drifted");
if (scenePlans["1215"].rainbowHosiery.wearer.result !== "AI ECE" || scenePlans["1215"].rainbowHosiery.palette.result !== "original independent rainbow gradient") throw new Error("Scene 1215 hosiery selector drifted");

const preflight = {
  batch,
  country,
  status: "render-preflight-stored",
  sourceCommit,
  contractSha256: sha256(contractBytes),
  rollMethod: "FNV-1a over the recorded batch298-spain keys, reduced modulo 100. Male scene selection uses the full 32-bit hash reduced modulo 4.",
  rollThresholds: {
    visibleMidriff: "0-49",
    straplessDress: "0-34",
    fullyOpenBack: "0-29",
    paws: "0-24",
    poleDanceTheme: "0-5",
    rainbowOnly: "0-3",
    rainbowHosiery: "0-24",
    rainbowHosieryWearer: "0-49 Radiance; 50-99 AI ECE",
    rainbowHosieryPaletteMode: "0-49 country-palette rainbow-like gradient; 50-99 original independent rainbow gradient"
  },
  themePair: ["cinematic covert-agent crew couture", "undercover investigator couture"],
  nextThemePair: ["undercover investigator couture", "nurse-care couture"],
  nextQueueCountry: "Sweden",
  researchSources: [
    { url: "https://www.spain.info/en/destination/barcelona/", usedFor: "Casa Batllo, Casa Mila, Park Guell, Gaudi mosaics, and Barcelona city context" },
    { url: "https://www.spain.info/en/destination/madrid/", usedFor: "Plaza Mayor, Gran Via, Puerta del Sol, and Puerta de Alcala" },
    { url: "https://www.spain.info/en/destination/seville/", usedFor: "Plaza de Espana, Triana ceramics, Spanish guitar, folding fans, orange trees, tapas, and cold beer" },
    { url: "https://www.spain.info/en/destination/valencia/", usedFor: "City of Arts and Sciences, Mediterranean reflecting pools, paella, Valencia oranges, and Turia garden" }
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
    maleEmotion: { key: maleEmotionKey, roll: maleEmotionRoll, result: maleEmotionResult }
  },
  countryMotifPolicy: {
    flagMotifDecision: "Spain's flag contains an official coat of arms, so it is not copied. Large secular architecture, mosaic, street, craft, music, food, agriculture, and modern-design motifs replace it.",
    palette: "red and saffron expanded with cobalt, ivory, black, Gaudi turquoise, Barcelona ceramic colors, Madrid arcade brick, Seville azulejo blue, orange-blossom green, Valencia white, Mediterranean cyan, and paella gold",
    minimumCoverage: "Every scene places large complete secular Spain motifs across at least two outfits as full bodice, skirt, hip, or panel fields rather than tiny trim.",
    cultureScenes: "Scene 1214 uses a Spanish guitar, painted fans, Triana ceramics, oranges, tapas, and sealed cold beer. Scene 1215 uses a paella pan, saffron rice, Valencia oranges, ceramic plates, and horchata.",
    prohibitions: "No literal flag, coat of arms, official emblem, sacred symbol, copied folk costume, copied uniform, badge, police impersonation, political insignia, bullfighting, or branded product."
  },
  xPublishingRolls,
  anatomyGate: {
    fourPersonScenes: "Scenes 1212, 1214, and 1215 require exactly eight arms and eight hands, two per woman, with every limb continuously traceable to one owner.",
    fivePersonScene: "Scene 1213 requires exactly ten arms and ten hands, two per adult, with the male added without replacing any woman.",
    rejectionRule: "Reject every extra, missing, duplicated, floating, fused, borrowed, emerging, ownerless, cropped, hidden-owner, or ambiguous limb, hand, or finger cluster."
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
    raw: { status: "pending", requested: 4, concurrency: "four independent built-in image generation calls" },
    recovery: { status: "not-started", maximumPerBlockedScene: 1 }
  },
  acceptedAssets: [],
  rejectedAssets: [],
  xPost: { status: "pending-asset-audit", minimumCurrentCountryAcceptedAssets: 2 }
};

fs.mkdirSync(root, { recursive: true });
for (const [scene, plan] of Object.entries(scenePlans)) {
  fs.writeFileSync(path.join(root, `scene-${scene}-prompt.txt`), `${plan.renderPrompt}\n`, "utf8");
}
fs.writeFileSync(path.join(root, "batch-298-spain-preflight.json"), `${JSON.stringify(preflight, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  preflight: path.join(root, "batch-298-spain-preflight.json"),
  contractSha256: preflight.contractSha256,
  maleScene,
  scenes: Object.fromEntries(Object.entries(scenePlans).map(([scene, plan]) => [scene, {
    theme: plan.theme,
    weather: plan.weather,
    paws: plan.paws,
    poleDanceTheme: plan.poleDanceTheme,
    rainbowOnly: plan.rainbowOnly,
    rainbowHosiery: plan.rainbowHosiery,
    emotions: Object.fromEntries(Object.entries(plan.characters).map(([character, details]) => [character, { result: details.emotion.result, performance: details.emotion.performance }]))
  }])),
  xPublishingRolls,
  rollAudit: preflight.rollAudit
}, null, 2));
