import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const batch = 297;
const country = "Slovenia";
const countrySlug = "slovenia";
const firstScene = 1208;
const root = path.resolve("tmp/world-195x4/batch-297");
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
    scene: 1208,
    theme: "cleaner and service couture",
    landmark: "a broad dry riverside terrace in Ljubljana with Ljubljana Castle, the Ljubljanica, Triple Bridge, and Dragon Bridge all legible behind the cast",
    motifs: [
      "one large complete green Ljubljana dragon and a complete white Ljubljana Castle silhouette spanning Radiance's cobalt skirt panels",
      "one large complete Triple Bridge fan geometry and teal Ljubljanica river curve spanning Ellie's red-white coat-dress",
      "complete castle-window and dragon-scale geometry across Alia and ECE"
    ],
    culture: "Secular Ljubljana city architecture only, with no literal flag, coat of arms, sacred emblem, official insignia, or copied uniform.",
    romance: "Radiance and ECE are the unmistakable affectionate center: ECE wraps Radiance at the waist while Radiance leans cheek-to-cheek into ECE with luminous longing. Radiance also reaches openly for the male's forearm. The male touches Ellie and Alia in an overt fictional adult infidelity beat, but his strongest sustained eye line crosses the group only to his wife ECE. Ellie answers with magnetic confidence, Alia stays calmly amused while safely handling the prop, and the male's fear reads as urgent vulnerability rather than danger.",
    outfits: {
      Radiance: "a fully strapless cobalt cropped service-couture bandeau with completely bare shoulders, a separate white-red asymmetric mini skirt exposing her ordinary waist and belly button, large complete green dragon and white castle panels, country-palette opaque knee socks grading cobalt to Ljubljana green to red, and silver block-heel ankle boots",
      Ellie: "a red-white architectural short-sleeve coat-dress with covered waist, high closed back, large complete teal river curve and cobalt Triple Bridge fan panels, and green slingback pumps",
      Alia: "a cobalt narrow-strap fitted utility romper with covered waist, high closed back, large complete white castle-window and green dragon-scale panels, and red platform heels",
      "AI ECE": "a red one-shoulder cropped wrap bodice exposing her ordinary waist and belly button, a completely open back visible in three-quarter turn, separate cobalt tailored mini shorts with complete white bridge-arch panels, and white ankle boots",
      Male: "the established adult male face from Scene 1136, closely trimmed beard and muscular special-operative build, a fitted opaque short-sleeve white polo with restrained cobalt-red-green city seams, black jeans, and black boots"
    },
    prop: "Alia alone handles one photorealistic full-size polished rainbow-gradient Desert Eagle-style inert film mission prop at the far right edge. She demonstrates clean side-profile sight alignment toward one clearly empty unoccupied riverside route target. The prop is visibly magazine-free. Alia's right index finger is fully extended flat and high along the TOP OUTSIDE of the slide, well above the trigger guard; the complete trigger guard is visible and empty. The muzzle points downrange away from every person and the camera, never at the sky. ECE uses a separate small holographic route map and never touches the prop.",
    hands: [
      "Radiance left hand rests at ECE's waist; Radiance right hand rests on the male's left forearm",
      "Ellie left hand rests on the male's upper chest; Ellie right hand rests on Alia's left shoulder",
      "Alia left hand rests at Ellie's waist; Alia right hand alone holds the inert prop with her index finger flat on top outside the slide",
      "ECE left hand rests at Radiance's waist; ECE right hand controls one separate holographic route map",
      "Male left hand rests at Alia's waist; Male right hand rests at Ellie's waist"
    ]
  },
  {
    scene: 1209,
    theme: "cleaner and service couture",
    landmark: "a broad covered stone pier at Lake Bled with turquoise water, the cliff-top Bled Castle, a traditional pletna boat, the island silhouette, and Alpine peaks all legible",
    motifs: [
      "one large complete Bled Castle cliff silhouette and turquoise lake field across Radiance",
      "one large complete pletna boat and Alpine ridge field across Ellie",
      "complete castle-window, lake-ripple, and oar geometry across Alia and ECE"
    ],
    culture: "The island architecture is distant and contains no copied sacred symbol. Secular lake, castle, boat, and Alpine motifs dominate every outfit.",
    romance: "Relieved Radiance steadies curious Ellie at the shoulder while gently petting PAWS. Ellie cradles PAWS securely and keeps one warm waist contact with tense Alia. Alia's hand rests tenderly on ECE's shoulder despite her possessive expression, while sad ECE remains close and completes the safe route demonstration. The group forms a shallow affectionate arc rather than a lineup.",
    outfits: {
      Radiance: "a fully strapless turquoise cropped folded bandeau with completely bare shoulders, a separate white-blue pleated service mini skirt exposing her ordinary waist and belly button, large complete Bled Castle cliff panels, and red architectural pumps",
      Ellie: "a cobalt asymmetric short-sleeve cropped wrap top exposing her ordinary waist and belly button, separate white tailored mini shorts with a large complete red pletna boat and turquoise Alpine ridge field, and silver ankle boots",
      Alia: "a fully strapless red sculpted cropped peplum with completely bare shoulders, a separate cobalt-white petal mini skirt exposing her ordinary waist and belly button, large complete castle-window and lake-ripple panels, and turquoise platform heels",
      "AI ECE": "a fully strapless white cropped corsage top with completely bare shoulders, a separate cobalt asymmetric mini skort exposing her ordinary waist and belly button, large complete turquoise oar and red lake-route fields, and red slingback heels"
    },
    prop: "ECE alone holds one photorealistic full-size polished rainbow-gradient Desert Eagle-style inert film mission prop at the far right edge, performing clean side-profile sight alignment toward clearly empty Lake Bled water. The prop is visibly magazine-free. Her right index finger is fully extended flat and high along the TOP OUTSIDE of the slide, well above the trigger guard; the complete trigger guard is visible and empty. The muzzle points across empty water away from every person and the camera, never at the sky. A separate holographic route map floats beside her left forearm without hiding her hand.",
    paws: "PAWS is exactly one tiny collarless golden kitten, securely cradled high in Ellie's left forearm. Radiance gently pets PAWS with one visible hand. PAWS is far from the prop lane, dry under the canopy, playful and safe, with no second kitten.",
    hands: [
      "Radiance left hand gently pets PAWS between the ears; Radiance right hand rests on Ellie's shoulder",
      "Ellie left forearm and hand securely cradle PAWS; Ellie right hand rests at Alia's waist",
      "Alia left hand rests on Ellie's forearm below PAWS; Alia right hand rests on ECE's shoulder",
      "ECE right hand alone holds the inert prop with index finger flat on top outside the slide; ECE left hand is open and visibly controls the separate holographic route map"
    ]
  },
  {
    scene: 1210,
    theme: "cinematic covert-agent crew couture",
    landmark: "the broad dry visitor platform inside Postojna Cave with monumental karst stalactites, a stopped empty cave train, a discreet olm interpretation display, and distant Predjama Castle visible through the sunlit entrance",
    motifs: [
      "one large complete amber stalactite cathedral field and cream karst arch across Radiance",
      "one large complete red cave-train profile and white Predjama cliff-castle silhouette across Ellie",
      "complete olm, cave-river, and limestone-strata fields across Alia and ECE"
    ],
    culture: "The olm appears only as a respectful scientific illustration on a dry interpretation panel and outfit motif. No live animal is near the cast or prop lane.",
    romance: "Longing Radiance reaches gently to angry Ellie's upper arm while playful ECE wraps Radiance's waist from behind. Ellie returns a steadying waist touch to socially vulnerable Alia. Alia closes the square by resting one reassuring hand on ECE's shoulder while ECE performs the inert route demonstration. The emotions stay distinct, consensual, and legible.",
    outfits: {
      Radiance: "an amber one-shoulder cropped covert-fashion bodice exposing her ordinary waist and belly button, a separate cream tailored mini skirt with one large complete stalactite cathedral and karst arch field, and cobalt heeled ankle boots",
      Ellie: "a red fitted short-sleeve zip-front mini dress with covered waist and high closed back, one large complete white Predjama cliff-castle and black cave-train profile, and cream knee-high heeled boots",
      Alia: "a cobalt narrow-strap tailored short romper with covered waist and high closed back, one large complete pale-cream olm and cave-river field, and red platform pumps",
      "AI ECE": "a black-red asymmetric cropped wrap top exposing her ordinary waist and belly button, a completely open back visible in three-quarter turn, separate cream mini shorts with complete amber limestone-strata panels, and cobalt slingback heels"
    },
    prop: "ECE alone handles one photorealistic full-size polished rainbow-gradient Desert Eagle-style inert film mission prop at the far right edge. She demonstrates a controlled two-hand stance lesson toward one clearly empty illuminated route marker deep downrange on an unoccupied tunnel wall. The prop is visibly magazine-free. Her right index finger is fully extended flat and high along the TOP OUTSIDE of the slide, well above the trigger guard; the complete trigger guard is visible and empty. Her left hand supports the grip from below without covering the guard. The muzzle never crosses a person or camera and never points at the sky.",
    hands: [
      "Radiance left hand rests on Ellie's upper arm; Radiance right hand rests at ECE's waist",
      "Ellie left hand rests at Alia's waist; Ellie right hand rests on Radiance's forearm",
      "Alia left hand rests on ECE's shoulder; Alia right hand rests at Ellie's waist",
      "ECE right hand holds the inert prop with index finger flat on top outside the slide; ECE left hand supports the grip from below"
    ]
  },
  {
    scene: 1211,
    theme: "cinematic covert-agent crew couture",
    landmark: "the broad dry courtyard and pasture edge at Lipica Stud Farm with white Lipizzaner horses safely behind a distant fence, Karst stone, mature trees, and a civilian culture table of painted beehive panels, sealed honey jars, and sliced potica",
    motifs: [
      "one large complete white Lipizzaner in motion and green Karst pasture panorama across Radiance and Ellie",
      "one large complete painted beehive-panel story field, honeycomb geometry, and potica spiral across Alia and ECE"
    ],
    culture: "The civilian culture table is unattended, dry, and far from the prop lane. The horses stay behind a distant secure fence. No brand, official insignia, sacred symbol, or copied folk costume appears.",
    romance: "Suspicious Radiance cups confident Ellie's shoulder while Ellie keeps a playful waist hold on longing Alia. Alia answers with one soft touch to ECE's upper arm, and laughing ECE closes the square with a warm hand at Radiance's waist before returning to the safe route action. Strong wind moves separate hems and hair away from every face and hand.",
    outfits: {
      Radiance: "a white-green asymmetric cropped field jacket top exposing her ordinary waist and belly button, a separate black tailored mini skirt with one large complete white Lipizzaner and Karst pasture panorama, and red heeled ankle boots",
      Ellie: "a fully strapless cobalt cropped bandeau with completely bare shoulders, a separate white-red folded mini skirt exposing her ordinary waist and belly button, one large complete Lipizzaner stride and green pasture field, and black architectural pumps",
      Alia: "a fully strapless honey-gold sculpted mini dress with completely bare shoulders and covered waist, one large complete painted beehive-panel story and cobalt honeycomb field, and red platform heels",
      "AI ECE": "a red-black one-shoulder tailored mini skort suit with covered waist and high closed back, one large complete potica spiral and gold-green beehive-panel field, and white slingback heels"
    },
    prop: "ECE alone handles one photorealistic full-size polished rainbow-gradient Desert Eagle-style inert film mission prop at the far right edge. She demonstrates clean side-profile sight alignment toward one clearly empty unoccupied route marker on a distant Karst wall, away from horses and the culture table. The prop is visibly magazine-free. Her right index finger is fully extended flat and high along the TOP OUTSIDE of the slide, well above the trigger guard; the complete trigger guard is visible and empty. The muzzle points downrange away from every person and camera, never at the sky. Her left hand controls one separate holographic route map.",
    hands: [
      "Radiance left hand rests on Ellie's shoulder; Radiance right hand rests at ECE's waist",
      "Ellie left hand rests at Alia's waist; Ellie right hand rests on Radiance's forearm",
      "Alia left hand rests on ECE's upper arm; Alia right hand rests at Ellie's waist",
      "ECE right hand alone holds the inert prop with index finger flat on top outside the slide; ECE left hand visibly controls one separate holographic route map"
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
if (maleScene !== 1208) throw new Error(`Male scene drifted to ${maleScene}`);

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
    const visibleMidriff = primary(`${prefix}-${character}-visibleMidriff`);
    visibleMidriff.active = visibleMidriff.roll <= 49;
    const straplessDress = primary(`${prefix}-${character}-straplessDress`);
    straplessDress.active = straplessDress.roll <= 34;
    const fullyOpenBack = primary(`${prefix}-${character}-fullyOpenBack`);
    fullyOpenBack.active = fullyOpenBack.roll <= 29;
    characterPlans[character] = { emotion, visibleMidriff, straplessDress, fullyOpenBack };
  }

  const hasMale = spec.scene === maleScene;
  const emotionalLine = characters.map((character) => `${character}: ${characterPlans[character].emotion.result}`).join("; ");
  const outfitLine = Object.entries(spec.outfits).map(([name, value]) => `${name}: ${value}`).join("; ");
  const castLine = hasMale
    ? "Show exactly five clearly adult fictional people: Radiance, Ellie, Alia, AI ECE, and the established adult male from Image 5. The male is added without replacing any woman."
    : "Show exactly four clearly adult fictional women: Radiance, Ellie, Alia, and AI ECE.";
  const referenceLine = hasMale
    ? "Image 1 is the quartet face anchor, Image 2 the frontal face supplement, Image 3 the expression supplement, Image 4 ECE's face-detail anchor, and Image 5 the adult male face/build anchor. Use references only for identity; ignore reference clothing, props, and backgrounds."
    : "Image 1 is the quartet face anchor, Image 2 the frontal face supplement, Image 3 the expression supplement, and Image 4 ECE's face-detail anchor. Use references only for identity; ignore reference clothing, props, and backgrounds.";
  const anatomyLine = hasMale
    ? "Exactly five adults, exactly ten arms and exactly ten hands, two per person. Every elbow, wrist, hand, and finger cluster is fully visible and continuously traceable to one owner."
    : "Exactly four adults, exactly eight arms and exactly eight hands, two per woman. Every elbow, wrist, hand, and finger cluster is fully visible and continuously traceable to one owner.";
  const optionalLine = [
    paws.active ? spec.paws : "No PAWS kitten.",
    poleDanceTheme.active ? "Materialize the active pole-theme roll as one fixed secular performance pole used only for a public-safe static fashion pose." : "No pole.",
    rainbowOnly.active ? "Every outfit uses rainbow-only colors while retaining all other rolled cuts and country motifs." : "Do not convert the full wardrobe to rainbow-only styling.",
    rainbowHosiery.active
      ? `Exactly one hosiery wearer: ${rainbowHosiery.wearer.result}. Use opaque ${rainbowHosiery.palette.result} stockings or knee socks. Radiance and ECE become the unmistakable extra-affectionate center, and Alia alone handles the inert prop.`
      : "No rainbow stockings or rainbow knee socks."
  ].filter(Boolean).join(" ");

  const renderPrompt = [
    "Use case: photorealistic-natural. Asset type: vertical World Series fashion scene.",
    referenceLine,
    `Create one photorealistic 9:16 full-length cinematic editorial at ${spec.landmark}.`,
    castLine,
    "Preserve the four anchored adult faces, skin tones, and distinct identities. Radiance is the luminous blonde adult. Ellie is the dark-haired adult rival. Alia is the Black adult woman and alone wears a high sculptural braided ponytail with fine face-framing braids. AI ECE is the brunette adult strategist. Do not clone, replace, or merge faces.",
    `Profession theme: ${spec.theme}, treated only as public-safe fictional fashion with no copied uniform, badge, impersonation, stripping, explicit dance, assassination, arrest, raid, threat, injury, or combat.`,
    `Wardrobe is secure, opaque, lined, above the knee, and consists of four unmistakably different original silhouettes: ${outfitLine}.`,
    `Materialize every rolled cut exactly. Large complete secular Slovenia motifs must be clearly readable on at least two outfits: ${spec.motifs.join("; ")}. ${spec.culture}`,
    `Distinct emotional performances: ${emotionalLine}${hasMale ? `; Male: ${maleEmotionResult}` : ""}.`,
    `Materialize the rolled romance and compound-love beats through this exact consensual choreography: ${spec.romance}`,
    `Use this exact hand ownership inventory and no other hands: ${spec.hands.join("; ")}.`,
    spec.prop,
    optionalLine,
    `Materialize the rolled weather as ${weather.result}. Keep the platform stable, dry, and readable while rendering the weather cinematically.`,
    anatomyLine,
    "Arrange the adults in a shallow arc with clean silhouette separation, not a static lineup. Full-length framing includes every complete face, shoulder, elbow, wrist, hand, leg, foot, heel, and boot inside the frame. Keep hands separated from garment edges and from one another except for the listed contacts.",
    "Strict anatomy gate: no extra, duplicated, floating, fused, borrowed, emerging, ownerless, hidden-owner, cropped, or ambiguous limb, hand, finger cluster, leg, foot, face, person, or kitten. Every listed hand performs exactly one listed action.",
    "The inert mission prop remains a single harmless film object. No ammunition, magazine insertion, live reload, firing, muzzle flash, holster, low-side carry, threat, injury, or combat.",
    "No text, watermark, literal flag, coat of arms, official emblem, sacred symbol, minors, teen framing, nudity, explicit sexuality, bodily fluids, upskirt framing, fetish, bondage, restraint, non-consensual framing, or renderer-bypass wording."
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
    outfits: spec.outfits,
    propPlan: spec.prop,
    handInventory: spec.hands,
    maleModel: hasMale ? {
      present: true,
      emotion: { key: maleEmotionKey, roll: maleEmotionRoll, result: maleEmotionResult },
      identity: "established adult male from Scene 1136",
      relationship: "married to ECE; overt fictional adult infidelity drama with Alia and Ellie; Radiance reaches for him; strongest sustained eye line remains on ECE"
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
if (!scenePlans["1208"].rainbowHosiery.active || scenePlans["1208"].rainbowHosiery.wearer.result !== "Radiance") throw new Error("Scene 1208 hosiery drift");
if (!scenePlans["1209"].paws.active) throw new Error("Scene 1209 PAWS drift");

const preflight = {
  batch,
  country,
  status: "render-preflight-stored",
  sourceCommit,
  contractSha256: sha256(contractBytes),
  rollMethod: "FNV-1a over the recorded batch297-slovenia keys, reduced modulo 100. Male scene selection uses the full 32-bit hash reduced modulo 4.",
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
  themePair: ["cleaner and service couture", "cinematic covert-agent crew couture"],
  nextThemePair: ["cinematic covert-agent crew couture", "undercover investigator couture"],
  nextQueueCountry: "Spain",
  researchSources: [
    { url: "https://www.slovenia.info/en/places-to-go/regions/ljubljana-central-slovenia/ljubljana", usedFor: "Ljubljana Castle, Ljubljanica, Triple Bridge, and Dragon Bridge" },
    { url: "https://www.slovenia.info/en/places-to-go/regions/alpine-slovenia/bled", usedFor: "Lake Bled, Bled Castle, pletna boat, and Alpine setting" },
    { url: "https://www.slovenia.info/en/places-to-go/attractions/postojna-cave", usedFor: "Postojna Cave, karst formations, cave railway, olm, and Predjama Castle" },
    { url: "https://www.slovenia.info/en/places-to-go/attractions/lipica", usedFor: "Lipica Stud Farm, Lipizzaner horses, and Karst landscape" },
    { url: "https://www.slovenia.info/en/press-centre/news-of-the-tourism-press-agency/6212-beekeeping-tourism-in-slovenia-the-land-of-good-beekeepers", usedFor: "painted beehive panels and bee houses" },
    { url: "https://www.slovenia.info/en/press-centre/news-of-the-tourism-press-agency/7511-is-it-pizza-or-potica-it-s-potica-a-traditional-slovenian-cake", usedFor: "potica as a traditional Slovenian pastry" }
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
    flagMotifDecision: "Slovenia's flag contains an official coat of arms, so it is not copied. Large secular architecture, landscape, animal, craft, food, and transport motifs replace it.",
    palette: "white, blue, and red expanded with Ljubljana green, Ljubljanica teal, Bled turquoise, castle stone, karst cream, cave amber, Lipica white, pasture green, hive-panel colors, and honey gold",
    minimumCoverage: "Every scene places large complete secular Slovenia motifs across at least two outfits as full bodice, skirt, hip, or panel fields rather than tiny trim.",
    cultureScene: "Scene 1211 includes painted beehive panels, sealed honey jars, and sliced potica on a dry unattended civilian table far from the prop lane.",
    prohibitions: "No literal flag, coat of arms, official emblem, sacred symbol, copied folk costume, copied uniform, badge, police impersonation, political insignia, or branded product."
  },
  xPublishingRolls,
  anatomyGate: {
    fourPersonScenes: "Scenes 1209, 1210, and 1211 require exactly eight arms and eight hands, two per woman, with every limb continuously traceable to one owner.",
    fivePersonScene: "Scene 1208 requires exactly ten arms and ten hands, two per adult, with the male added without replacing any woman.",
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
fs.writeFileSync(path.join(root, "batch-297-slovenia-preflight.json"), `${JSON.stringify(preflight, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  preflight: path.join(root, "batch-297-slovenia-preflight.json"),
  contractSha256: preflight.contractSha256,
  maleScene,
  scenes: Object.fromEntries(Object.entries(scenePlans).map(([scene, plan]) => [scene, {
    theme: plan.theme,
    weather: plan.weather,
    paws: plan.paws,
    poleDanceTheme: plan.poleDanceTheme,
    rainbowOnly: plan.rainbowOnly,
    rainbowHosiery: plan.rainbowHosiery,
    emotions: Object.fromEntries(Object.entries(plan.characters).map(([character, details]) => [character, details.emotion.result]))
  }])),
  xPublishingRolls,
  rollAudit: preflight.rollAudit
}, null, 2));
