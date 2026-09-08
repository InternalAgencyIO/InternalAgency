import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const batch = 299;
const country = "Sweden";
const countrySlug = "sweden";
const firstScene = 1216;
const root = path.resolve("tmp/world-195x4/batch-299");
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
    scene: 1216,
    theme: "undercover investigator couture",
    landmark: "a broad dry waterfront terrace in Stockholm at the edge of Gamla Stan, with pastel old-town facades, the archipelago water and skerries, a full Vasa ship silhouette installation, and clean ferry lines visible through a rolling thunderstorm",
    motifs: [
      "one large complete Gamla Stan pastel-facade and Stockholm archipelago field spanning Radiance and Ellie",
      "one large complete Vasa ship hull, Baltic wave, and red Dala-horse silhouette field spanning Alia and ECE"
    ],
    culture: "A sheltered fika side table far outside the prop lane holds fresh cinnamon buns and plain coffee cups beside one red carved Dala-horse sculpture. No brand, official emblem, sacred symbol, copied folk costume, badge, or literal flag.",
    romance: "This is the safe standing interpretation of the selected route-beacon and behind-embrace rolls. Mischievous Radiance circles one arm around Ellie while holding ECE at the waist. Contained Ellie answers by holding Radiance and tender Alia. Alia stays cheek-close to Ellie, steadies her waist, and sends ECE a playful blown kiss. Joyful ECE gently catches Ellie's wrist with her free hand while conducting one-handed sight alignment toward empty archipelago water. Every contact is consensual adult affection.",
    emotionNuance: {
      Radiance: "playful mischief shown by a bright conspiratorial side glance toward Ellie",
      Ellie: "contained resentment shown by a controlled jaw and guarded eyes toward Radiance",
      Alia: "tender affection shown by a warm cheek-close smile toward Ellie",
      "AI ECE": "romantic joy shown by an open smile toward Radiance while maintaining safe route focus"
    },
    outfits: {
      Radiance: "a cobalt short-sleeve cropped investigator jacket exposing her ordinary waist and belly button, with a completely open oval back visible in three-quarter profile, separate saffron tailored mini skirt carrying a large complete Gamla Stan pastel-facade field, and silver heeled ankle boots",
      Ellie: "a red high-neck sleeveless tailored mini dress with covered waist, covered shoulders, and high closed back, carrying a large complete Stockholm archipelago and ferry-line panorama, with cobalt architectural pumps",
      Alia: "a fully strapless saffron sculpted cropped top with completely bare shoulders, separate cobalt-red tailored mini shorts exposing her ordinary waist and belly button, a completely open back visible from shoulder blades to waist, a large complete Vasa hull and Baltic-wave field, and red platform heels",
      "AI ECE": "an ivory-blue asymmetric cropped investigator top exposing her ordinary waist and belly button, with a completely open back visible from shoulder blades to waist, separate red mini skort carrying a large complete Dala-horse silhouette and archipelago-skerry field, and cobalt slingback heels"
    },
    prop: "ECE alone holds one photorealistic full-size polished rainbow-gradient Desert Eagle-style inert film prop in her right hand at chest height for a controlled one-handed sight-alignment demonstration. Her right index finger is straight and visibly indexed high along the frame outside the trigger guard. The complete trigger guard remains visibly empty. The horizontal muzzle points only across unoccupied archipelago water toward a distant empty route marker, away from every person, the fika table, and camera, never at the sky. Her left hand is off the prop and gently catches Ellie's wrist. A separate hands-free holographic route map floats beside ECE's shoulder.",
    hands: [
      "Radiance left hand rests visibly at ECE's near waist; Radiance right hand rests visibly around Ellie's near shoulder",
      "Ellie left hand rests visibly at Radiance's near waist; Ellie right hand rests visibly on Alia's near shoulder",
      "Alia left hand rests visibly at Ellie's near waist; Alia right open hand stays visibly near her own lips in a blown-kiss gesture toward ECE",
      "ECE right hand alone holds the inert prop with index finger straight along the frame outside the empty guard; ECE left hand gently catches Ellie's visible wrist"
    ]
  },
  {
    scene: 1217,
    theme: "undercover investigator couture",
    landmark: "a broad covered Gothenburg harbor pier with the Lilla Bommen skyline, Gota River, archipelago ferries, fishing-village boathouses, and west-coast granite visible beyond heavy cinematic snow",
    motifs: [
      "one large complete Gothenburg harbor skyline, ferry, and Gota River field spanning Radiance and Ellie",
      "one large complete west-coast granite, fishing-boathouse, cinnamon-bun spiral, and Dala-horse field spanning Alia and ECE"
    ],
    culture: "A dry unattended fika counter far outside the prop lane holds coffee, cinnamon buns, and cardamom buns beside a small red Dala-horse sculpture. The harbor includes secular fishing and ferry details only. No brand, official emblem, sacred symbol, copied folk costume, badge, or literal flag.",
    romance: "This is the safe upright interpretation of the selected linked-turn and close-embrace rolls. Tender Radiance links one hand with angry Alia and leans into confident Ellie's side embrace. Ellie holds Radiance at the waist while reaching toward the hands-free route beacon they are leaving. Alia keeps the linked hand and a protective touch at Radiance's back. Defiant ECE steadies Radiance at the waist while demonstrating the prop's visibly empty magazine well. The women remain standing with clean gaps and stable footing.",
    emotionNuance: {
      Radiance: "tender affection expressed as a soft trusting look toward Ellie",
      Ellie: "magnetic confidence expressed through calm direct eye contact with Radiance",
      Alia: "anger expressed through a tight brow toward Ellie without threat or aggression",
      "AI ECE": "defiance expressed as lifted chin and unwavering route focus"
    },
    outfits: {
      Radiance: "a saffron-blue boat-neck short-sleeve investigator mini coat-dress with covered waist, covered shoulders, and high closed back, carrying a large complete Gothenburg harbor skyline and ferry panorama, with red heeled ankle boots",
      Ellie: "a cobalt cropped mock-neck fitted investigator top exposing her ordinary waist and belly button, separate red tailored mini skirt carrying a large complete Gota River and archipelago-ferry field, covered shoulders and high closed back, with silver pumps",
      Alia: "an ivory-red asymmetric sleeveless tailored mini dress with covered waist, covered shoulders, and high closed back, carrying a large complete fishing-boathouse and west-coast granite field, with cobalt platform heels",
      "AI ECE": "a red-blue one-shoulder cropped investigator top exposing her ordinary waist and belly button, with a completely open back visible from shoulder blades to waist, separate ivory mini shorts carrying a large complete cinnamon-bun spiral and Dala-horse field, and red slingback heels"
    },
    prop: "ECE alone holds one photorealistic full-size polished rainbow-gradient Desert Eagle-style inert film prop at chest height for an unloaded magazine-free manipulation demonstration. Her right hand holds the grip securely while her right index finger stays straight and visibly indexed high along the frame outside the trigger guard. Her left open palm remains several centimetres below the visibly empty magazine well without touching the grip or trigger guard. The muzzle points horizontally across empty harbor water toward an unoccupied route marker, away from every person, the fika counter, and camera, never at the sky. No magazine or ammunition appears. A separate hands-free holographic route beacon floats behind the group.",
    hands: [
      "Radiance left hand links visibly with Alia's left hand; Radiance right hand rests visibly on Ellie's near shoulder",
      "Ellie left hand rests visibly at Radiance's near waist; Ellie right open hand reaches visibly toward the hands-free route beacon",
      "Alia left hand links visibly with Radiance's left hand; Alia right hand rests visibly at Radiance's near back",
      "ECE right hand holds the inert prop with index finger straight outside the empty guard; ECE left open palm demonstrates the empty magazine well below the prop without touching its controls"
    ]
  },
  {
    scene: 1218,
    theme: "nurse-care couture",
    landmark: "a broad dry public fashion gallery beside the Icehotel in Jukkasjarvi, with sculpted transparent ice walls, Torne River ice, Kiruna's distant modern skyline, snow pines, and soft northern-light forms visible through dense rolling fog",
    motifs: [
      "one large complete Icehotel crystal-arch, Torne River, and northern-light field spanning Radiance and Ellie",
      "one large complete red Swedish cottage, snow-pine, Dala-horse, and ice-sculpture field spanning Alia and ECE"
    ],
    culture: "Use only secular arctic architecture, ice art, river geometry, red cottage forms, snow pines, and a stylized Dala-horse silhouette. This is public-safe fashion, not medical treatment. No copied nurse uniform, medical procedure, badge, official emblem, sacred symbol, Indigenous motif, or literal flag.",
    romance: "This is the safe standing interpretation of the selected walking-weave and turning-embrace rolls. Tender Radiance and remorseful Alia share a shoulder-to-shoulder embrace. Radiance sends suspicious ECE a playful blown kiss. Joyful Ellie touches ECE's cheek and maintains eye contact with Radiance. Alia stands closely behind ECE at a clear offset and guides ECE's upper arm and shoulder into a stable two-hand sight line without touching the prop. ECE remains the sole handler and keeps the muzzle downrange toward empty Torne River ice.",
    emotionNuance: {
      Radiance: "tender affection shown by a gentle shoulder embrace with Alia",
      Ellie: "romantic joy shown by a bright smile shared between Radiance and ECE",
      Alia: "guilt and remorse shown by lowered eyes and a protective, apologetic posture",
      "AI ECE": "suspicion shown by a searching side glance toward Radiance while keeping safe route focus"
    },
    outfits: {
      Radiance: "an ivory-blue short-sleeve wrap-front nurse-care mini coat-dress with covered waist, covered shoulders, and high closed back, carrying a large complete Icehotel crystal arch and Torne River field, with cobalt heeled ankle boots",
      Ellie: "a red cropped short-sleeve nurse-care jacket exposing her ordinary waist and belly button, with a completely open back visible from shoulder blades to waist, separate cobalt mini skirt carrying a large complete northern-light and ice-sculpture field, and silver pumps",
      Alia: "a cobalt-red asymmetric sleeveless nurse-care mini dress with covered waist, covered shoulders, and high closed back, carrying a large complete red Swedish cottage and snow-pine field, with ivory platform heels",
      "AI ECE": "a fully strapless ivory-cobalt sculpted nurse-care mini dress with completely bare shoulders, covered waist, and a completely open back visible from shoulder blades to waist, carrying a large complete Dala-horse silhouette and faceted-ice field, with red slingback heels"
    },
    prop: "ECE alone holds one photorealistic full-size polished rainbow-gradient Desert Eagle-style inert film prop in a stable two-hand sight-alignment stance at chest height. Her right hand holds the grip, her right index finger stays straight and visibly indexed high along the frame outside the trigger guard, and her left hand supports the right hand from below without crossing the guard. The complete trigger guard is visible and empty. The horizontal muzzle points only across unoccupied Torne River ice toward a distant empty route marker, away from every person and camera, never at the sky. Alia guides only ECE's shoulder and upper arm, never the prop. A separate hands-free holographic route map floats at ECE's far side.",
    hands: [
      "Radiance left hand rests visibly on Alia's near shoulder; Radiance right open hand stays visibly near her own lips in a blown-kiss gesture toward ECE",
      "Ellie left hand rests visibly at Radiance's near waist; Ellie right hand gently touches ECE's near cheek",
      "Alia left hand rests visibly at Radiance's near waist; Alia right hand guides ECE's near upper arm from a clear offset without touching the prop",
      "ECE right hand holds the inert prop with index finger straight outside the empty guard; ECE left hand supports her right hand from below in the two-hand stance"
    ]
  },
  {
    scene: 1219,
    theme: "nurse-care couture",
    landmark: "a broad dry sheltered promenade at Malmo's Western Harbour during clear golden-hour radiance, with the complete Turning Torso, the Oresund Bridge across empty water, modern waterfront geometry, bicycle lines, and Malmo Castle silhouettes clearly legible",
    motifs: [
      "one large complete Turning Torso twist, Oresund Bridge, and waterfront-bicycle field spanning Radiance and Ellie",
      "one large complete Dala-horse, cinnamon-bun spiral, red cottage, and Malmo Castle field spanning Alia and ECE"
    ],
    culture: "A dry unattended fika table far from the prop and pole holds coffee and cinnamon buns beside one red Dala-horse sculpture. Use public design, bridge, bicycle, castle, red cottage, and fika motifs only. No copied nurse uniform, medical procedure, badge, official emblem, sacred symbol, brand, or literal flag.",
    romance: "This is the safe standing interpretation of the selected walking-hand and turning-embrace rolls, expanded for the male scene. Angry Radiance and jealous ECE are the unmistakable extra-affectionate center, cheek-to-cheek with their left hands linked while Radiance's right hand rests on the fixed pole and ECE's right hand controls the route map. Vulnerable Ellie touches the male's chest and forearm. The tearful male holds Ellie at the waist and remorseful Alia at the near shoulder while his strongest sustained eye line remains only on his wife ECE. Alia receives his touch while alone conducting a two-hand prop sight line across empty Oresund water. Every interaction is consensual, fully clothed adult relationship drama.",
    emotionNuance: {
      Radiance: "anger shown as a sharp betrayed stare softened by choosing cheek-to-cheek closeness with ECE",
      Ellie: "fear and urgent vulnerability shown as tear-bright eyes toward the male",
      Alia: "guilt and remorse shown as an apologetic glance toward ECE while maintaining safe prop focus",
      "AI ECE": "visible jealousy shown by a guarded stare toward Ellie while linking hands with Radiance",
      Male: "crying with visible tears while keeping his strongest sustained eye line only on ECE"
    },
    outfits: {
      Radiance: "a rainbow-only short-sleeve fitted nurse-care mini coat-dress with covered waist, covered shoulders, and high closed back, carrying a large complete multicolor Turning Torso and Oresund Bridge panorama, with cobalt heeled ankle boots",
      Ellie: "a rainbow-only high-neck sleeveless tailored nurse-care mini dress with covered waist, covered shoulders, and a completely open back visible from shoulder blades to waist, carrying a large complete waterfront bicycle and bridge-cable field, with red pumps",
      Alia: "a rainbow-only asymmetric short-sleeve nurse-care mini skort suit with covered waist, covered shoulders, and high closed back, carrying a large complete Dala-horse and cinnamon-bun spiral field, with violet platform heels",
      "AI ECE": "a rainbow-only one-shoulder fitted nurse-care mini dress with covered waist, covered shoulders, and high closed back, carrying a large complete red-cottage and Malmo Castle field, opaque Sweden-palette rainbow-gradient knee socks anchored in cobalt, golden yellow, berry red, pine green, and icy cyan, and white slingback heels",
      Male: "the established adult male face from Scene 1136, closely trimmed beard and muscular special-operative build, a fitted opaque short-sleeve black polo with restrained rainbow-only bridge-cable seams, black jeans, and black boots"
    },
    prop: "Alia alone holds one photorealistic full-size polished rainbow-gradient Desert Eagle-style inert film prop in a stable two-hand sight-alignment stance at chest height. Her right hand holds the grip, her right index finger stays straight and visibly indexed high along the frame outside the trigger guard, and her left hand supports her right hand from below without crossing the guard. The complete trigger guard is visible and empty. The horizontal muzzle points only across unoccupied Oresund water toward a distant empty route marker, away from every person, PAWS, pole, fika table, and camera, never at the sky. ECE uses no prop and points to one separate holographic route map with her free right hand.",
    pole: "Exactly one fixed polished vertical stage-support pole stands at the far left. Radiance merely rests her right hand on it at shoulder height while standing upright with both feet planted. No performance, spin, climb, inversion, dance, second pole, or contact between the pole and the prop.",
    hands: [
      "Radiance left hand links visibly with ECE's left hand; Radiance right hand rests visibly on the fixed vertical pole at shoulder height",
      "Ellie left hand rests visibly on the male's upper chest; Ellie right hand rests visibly on the male's near forearm",
      "Alia right hand holds the inert prop with index finger straight outside the empty guard; Alia left hand supports her right hand from below in the two-hand stance",
      "ECE left hand links visibly with Radiance's left hand; ECE right open hand points visibly to one separate holographic route map",
      "Male left hand rests visibly at Ellie's near waist; Male right hand rests visibly on Alia's near shoulder"
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
if (maleScene !== 1219) throw new Error(`Male scene drifted to ${maleScene}`);

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
    rainbowOnly.active ? "All four women's outfits use rainbow-only colors while retaining every rolled cut and every large Sweden motif." : "Do not convert the full wardrobe to rainbow-only styling.",
    rainbowHosiery.active
      ? `Exactly one rainbow-hosiery wearer: ${rainbowHosiery.wearer.result}, using ${rainbowHosiery.palette.result}. Radiance and ECE are the unmistakable extra-affectionate center, and Alia alone handles the inert prop.`
      : "No rainbow stockings or rainbow knee socks."
  ].filter(Boolean).join(" ");

  const renderPrompt = [
    "Use case: photorealistic-natural. Asset type: vertical World Series public-fashion scene.",
    referenceLine,
    `Create one photorealistic 9:16 full-length cinematic editorial at ${spec.landmark}.`,
    castLine,
    "Preserve the four anchored adult faces, skin tones, and distinct identities. Radiance is the luminous blonde adult. Ellie is the dark-haired adult rival. Alia is the Black adult woman and alone wears a high sculptural braided ponytail with fine face-framing braids. AI ECE is the brunette adult strategist. Do not clone, replace, or merge faces.",
    `Profession theme: ${spec.theme}, treated only as original public-safe fictional fashion with no copied uniform, badge, police impersonation, medical procedure, arrest, raid, assassination, threat, injury, or combat.`,
    `Wardrobe is secure, opaque, lined, above the knee, and uses four unmistakably different silhouettes. Exact rolled outfits: ${outfitLine}.`,
    `Materialize every rolled cut visibly. Large complete secular Sweden motifs must read clearly on at least two outfits: ${spec.motifs.join("; ")}. ${spec.culture}`,
    `Distinct rolled emotional performances: ${emotionLine}${hasMale ? `; Male: ${maleEmotionResult}, performed as ${spec.emotionNuance.Male}` : ""}.`,
    `Selected dynamic romance roll ${romanceBeat.roll}: ${romanceBeat.contractResult} Selected compound love roll ${compoundLoveBeat.roll}: ${compoundLoveBeat.contractResult}`,
    `Materialize both selected love rolls through this exact safe consensual choreography: ${spec.romance}`,
    `Use this exact hand inventory and no other hands: ${spec.hands.join("; ")}.`,
    spec.prop,
    optionalLine,
    `Materialize rolled weather exactly as ${weather.result}. Keep the covered platform stable, dry, and readable while rendering the weather cinematically.`,
    anatomyLine,
    "Every arm is fully visible from shoulder through elbow and wrist to one separated hand. Every hand performs exactly one listed action. Keep all palms and finger clusters separated from garment edges and other hands except for the listed contacts.",
    "Arrange the adults in a shallow asymmetric arc with clean silhouette gaps and relationship motion, not a static lineup. Full-length framing contains every complete face, elbow, wrist, hand, leg, foot, heel, boot, and knee sock.",
    "Strict anatomy gate: no extra, missing, duplicated, floating, fused, borrowed, emerging, ownerless, hidden-owner, cropped, or ambiguous limb, hand, finger cluster, face, person, kitten, leg, or foot.",
    "The single inert film prop remains harmless. Every trigger finger stays straight outside the guard. No ammunition, magazine, live reload, firing, muzzle flash, holster, low-side carry, combat, threat, or injury.",
    "No text, watermark, literal flag, official emblem, sacred symbol, copied costume, brand, minors, teen framing, nudity, explicit sexuality, bodily fluids, upskirt framing, fetish, bondage, restraint, mummification, non-consensual framing, or renderer-bypass wording."
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
      relationship: "married to ECE; fully clothed adult infidelity drama with Alia and Ellie; strongest sustained eye line remains on ECE"
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
if (!scenePlans["1219"].poleDanceTheme.active || !scenePlans["1219"].rainbowOnly.active || !scenePlans["1219"].rainbowHosiery.active) throw new Error("Scene 1219 optional triggers drifted");
if (scenePlans["1219"].rainbowHosiery.wearer.result !== "AI ECE" || scenePlans["1219"].rainbowHosiery.palette.result !== "country-palette rainbow-like gradient") throw new Error("Scene 1219 hosiery selector drifted");
if (Object.values(scenePlans).some((plan) => plan.paws.active)) throw new Error("PAWS eligibility drifted");

const preflight = {
  batch,
  country,
  status: "render-preflight-stored",
  sourceCommit,
  contractSha256: sha256(contractBytes),
  rollMethod: "FNV-1a over the recorded batch299-sweden keys, reduced modulo 100. Male scene selection uses the full 32-bit hash reduced modulo 4.",
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
  themePair: ["undercover investigator couture", "nurse-care couture"],
  nextThemePair: ["nurse-care couture", "doctor-clinical-command couture"],
  nextQueueCountry: "Switzerland",
  researchSources: [
    { url: "https://visitsweden.com/where-to-go/middle-sweden/stockholm/", usedFor: "Gamla Stan, Stockholm archipelago, water, greenery, Vasa, and fika" },
    { url: "https://visitsweden.com/where-to-go/southern-sweden/goteborg/", usedFor: "Gothenburg harbor, archipelago ferries, fishing villages, Gota River, and west-coast character" },
    { url: "https://visitsweden.com/where-to-go/northern-sweden/arctic-sweden/icehotel/", usedFor: "Icehotel, Jukkasjarvi, Torne River ice, ice sculpture, and arctic light" },
    { url: "https://visitsweden.com/where-to-go/southern-sweden/malmo/", usedFor: "Turning Torso, Oresund Bridge, Western Harbour, bicycle routes, and Malmo Castle" },
    { url: "https://visitsweden.com/where-to-go/middle-sweden/dalarna/", usedFor: "Dala horse, Falun-red cottages, and secular Swedish folk-art symbols" },
    { url: "https://visitsweden.com/what-to-do/food-drink/swedish-kitchen/all-about-swedish-fika/", usedFor: "fika, coffee, and cinnamon buns as recognizable Swedish culture" }
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
    flagMotifDecision: "Sweden's flag has no secular pictorial motif suitable for copying, so large researched architecture, archipelago, ship, Dala-horse, red-cottage, fika, bridge, bicycle, ice, and northern-light motifs replace it.",
    palette: "cobalt and golden yellow expanded with Falun red, pine green, Baltic cyan, ice white, berry red, northern-light green, granite gray, and fika cinnamon brown",
    minimumCoverage: "Every scene places large complete secular Sweden motifs across at least two outfits as full bodice, skirt, hip, or panel fields rather than tiny trim.",
    cultureScenes: "Stockholm and Gothenburg include fika with coffee and cinnamon buns plus a Dala-horse sculpture. Jukkasjarvi uses Icehotel, Torne River, red cottage, and ice art. Malmo includes fika, a Dala horse, Turning Torso, Oresund Bridge, bicycles, and Malmo Castle.",
    prohibitions: "No literal flag, official emblem, sacred symbol, copied folk costume, copied uniform, badge, police impersonation, medical procedure, political insignia, branded product, or appropriation of Indigenous motifs."
  },
  xPublishingRolls,
  anatomyGate: {
    fourPersonScenes: "Scenes 1216, 1217, and 1218 require exactly eight arms and eight hands, two per woman, with every limb continuously traceable to one owner.",
    fivePersonScene: "Scene 1219 requires exactly ten arms and ten hands, two per adult, with the male added without replacing any woman.",
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
fs.writeFileSync(path.join(root, "batch-299-sweden-preflight.json"), `${JSON.stringify(preflight, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  preflight: path.join(root, "batch-299-sweden-preflight.json"),
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
