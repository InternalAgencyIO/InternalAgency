import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const batch = 305;
const country = "Comoros";
const countrySlug = "comoros";
const firstScene = 1240;
const root = path.resolve("tmp/world-195x4/batch-305");
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
    scene: 1240,
    theme: "cinematic covert-agent crew couture",
    landmark: "a broad dry covered seafront terrace beside Moroni's old volcanic-stone medina and harbor, with complete carved monumental doors, narrow basalt lanes, weathered white arcades, anchored wooden lateen-sail boats, the dark Grande Comore volcanic ridge, and a long clearly empty Indian Ocean route lane visible at crisp blue hour; exclude mosques and all sacred buildings",
    motifs: [
      "large complete yellow ylang-ylang blossom, green vanilla-pod, and red clove-spice fields across Radiance's coat-dress and Ellie's skort",
      "large complete blue coelacanth, violet lateen-sail, carved-door, and black volcanic-basalt fields across Alia's skirt and ECE's asymmetric set"
    ],
    culture: "A dry unattended scent-botanical and maritime display well outside the prop lane visibly holds fresh ylang-ylang blossoms, bundled vanilla pods, bowls of cloves, a small lateen-sail boat model, and a scientific coelacanth relief. These are secular Comoros agriculture, seafaring, and marine-science references, not generic decoration. No literal flag, crescent, star, coat of arms, official emblem, sacred symbol, religious building, copied ceremonial dress, copied operative uniform, badge, brand, alcohol, or readable text.",
    expected: {
      weather: "crisp blue hour", paws: false, pole: false, rainbowOnly: true,
      rainbowHosiery: false, wearer: "AI ECE", palette: "original independent rainbow gradient",
      cuts: {
        Radiance: [false, false, false], Ellie: [true, false, false],
        Alia: [true, false, false], "AI ECE": [true, false, true]
      }
    },
    romance: "Playfully mischievous Radiance has just finished turning beneath her linked hand with startled Alia and now stays close against ECE's side. Possessive ECE steadies Radiance at the waist while keeping her prop arm isolated over empty harbor water. Alia stands one step lower, links Radiance's hand, and steadies Ellie at the shoulder. Possessive Ellie answers from a separate lane with a visible waist touch on Alia while her other hand reaches toward the separate holographic route beacon. ECE leans near Ellie's cheek in the harmless finish of the selected cheek-greeting beat, while Radiance remains her closest body contact. The linked hand, waist steady, shoulder touch, reciprocal waist touch, side closeness, cheek-near pass, and beacon reach read as one consensual adult romance-square movement.",
    composition: "Place ECE at the far left with her prop arm completely isolated against empty harbor water, Radiance center-left, Alia center-right one broad step lower, and Ellie at the far right. Keep ECE three-quarters away with hair moved clear so her complete rolled open back and complete face are both visible. Separate all four torsos, elbows, wrists, lower bodies, and heels with strips of harbor, basalt lane, or terrace background.",
    emotionNuance: {
      Radiance: "playful mischief shown by a knowing side smile toward ECE",
      Ellie: "possessive tension shown by focused eyes on ECE while her mouth remains softly amused",
      Alia: "startled surprise shown by widened eyes at the sudden linked-hand turn without fear",
      "AI ECE": "possessive tension performed differently from Ellie through a protective waist hold and calm fixed eye line toward Radiance"
    },
    outfits: {
      Radiance: "a rainbow-only cap-sleeve structured mini coat-dress with covered waist and high closed back, shifting through scarlet, orange, gold, leaf green, ocean blue, indigo, and violet, carrying a large complete yellow ylang-ylang and green vanilla-pod field, with violet heeled ankle boots",
      Ellie: "a rainbow-only cobalt wide-strap cropped route bodice exposing her ordinary waist and belly button with a high closed back, paired with a separate scarlet-to-gold pleated mini skort carrying a large complete red clove and carved-door field, with leaf-green pumps",
      Alia: "a rainbow-only emerald halter cropped tailored vest exposing her ordinary waist and belly button with a high closed back, paired with a separate violet architectural bubble mini skirt carrying a large complete blue coelacanth and black volcanic-basalt field, with orange platform heels",
      "AI ECE": "a rainbow-only indigo one-shoulder cropped long-sleeve route top exposing her ordinary waist and belly button and a completely open back from shoulder blades to the secure waistline, paired with a separate blue-to-green asymmetric A-line mini skirt carrying a large complete violet lateen-sail and yellow ylang-ylang field, with scarlet slingback heels"
    },
    prop: "ECE alone handles one photorealistic full-size polished rainbow-gradient Desert Eagle-style inert cinematic prop in her right hand at chest height for controlled sight alignment. The prop is shown in clean side profile. Her right index finger is straight and visibly indexed high along the frame outside the complete unobstructed empty trigger guard. The horizontal muzzle points only far left across clearly empty harbor water toward one unoccupied floating route marker, away from every person, boat, terrace, building, display, and camera, never upward or at the sky. Her left hand stays off the prop at Radiance's waist. A separate hands-free holographic route map floats beside ECE's far shoulder.",
    paws: "",
    hands: [
      "ECE right hand alone holds the inert prop with index finger straight outside the empty guard; ECE left hand rests visibly at Radiance's near waist",
      "Radiance left hand rests visibly on ECE's near shoulder; Radiance right hand links visibly with Alia's left hand",
      "Alia left hand links visibly with Radiance's right hand; Alia right hand rests visibly on Ellie's near shoulder",
      "Ellie left hand rests visibly at Alia's near waist; Ellie right open hand reaches visibly toward the separate holographic beacon"
    ]
  },
  {
    scene: 1241,
    theme: "cinematic covert-agent crew couture",
    landmark: "a broad dry covered coastal heritage platform at Iconi beside the complete sea-facing ruins of Palais Kapviridjohe, with its weathered palace arches, cliff edge, old volcanic masonry, the Indian Ocean, and the full Mount Karthala profile clearly recognizable under soft dramatic overcast; exclude mosques and all sacred buildings",
    motifs: [
      "large complete palace-arch, carved-door, and Mount Karthala contour fields across Radiance's shift dress and Ellie's skirt",
      "large complete ylang-ylang blossom, vanilla vine, clove cluster, and ocean-swell fields across Alia's skort and ECE's skirt"
    ],
    culture: "Use only secular Iconi palace architecture, Karthala geology, ylang-ylang, vanilla, cloves, volcanic stone, and coast geometry. A small dry botanical evidence tray holds labeled-by-shape but text-free ylang-ylang flowers, vanilla pods, and cloves. No literal flag, crescent, star, coat of arms, official emblem, sacred symbol, religious building, copied ceremonial dress, copied operative uniform, badge, brand, alcohol, or readable text.",
    expected: {
      weather: "soft dramatic overcast", paws: false, pole: false, rainbowOnly: false,
      rainbowHosiery: true, wearer: "AI ECE", palette: "original independent rainbow gradient",
      cuts: {
        Radiance: [false, false, false], Ellie: [true, true, false],
        Alia: [true, false, false], "AI ECE": [true, false, false]
      }
    },
    romance: "Angry Radiance keeps her expression controlled and nonthreatening as tender ECE becomes her unmistakable extra-affectionate center through reciprocal waist contact and close face-to-face eye contact. Radiance also links hands with radiantly laughing Ellie, who reaches the group through that clean side link. Shame-struck Alia keeps her prop arm isolated over empty sea, rests her free hand on Ellie's shoulder, and offers Radiance a small blown kiss using only her lips. Ellie steadies Alia at the waist with her free hand. ECE raises her free index hand toward the separate overhead route beacon. This safely translates the selected overhead-beacon, waist-circle, shoulder-reach, blown-kiss, behind-hug, cheek-kiss, linked-hand, and direct-look beats without assigning any hand twice.",
    composition: "Place Alia at the far left with her prop arm completely outside every silhouette against empty ocean, Ellie left-center, Radiance right-center, and ECE at the far right as Radiance's nearest body. Every woman occupies a separate depth lane. Keep all eight arms continuously visible and separate all wrists, hands, waists, lower bodies, and heels with ocean, palace-arch, or mountain background.",
    emotionNuance: {
      Radiance: "anger shown by a firm jaw and wet bright eyes that soften only toward ECE, never as aggression",
      Ellie: "extreme happiness shown by open radiant adult laughter during the linked-hand contact",
      Alia: "shame and social vulnerability shown by lowered tear-bright eyes during the restrained blown kiss",
      "AI ECE": "tender affection shown by a warm protective gaze and gentle reciprocal waist touch toward Radiance"
    },
    outfits: {
      Radiance: "an emerald cap-sleeve covert-editorial mini shift dress with covered waist and high closed back, carrying a large complete pearl palace-arch and charcoal Mount Karthala contour field, with clove-red ankle boots",
      Ellie: "a fully strapless pearl-white sculpted cropped covert-editorial bodice with completely bare shoulders, exposed ordinary waist and belly button, and a high closed back, paired with a separate deep-ocean pleated mini skirt carrying a large complete carved-door and volcanic-masonry field, with ylang-yellow slingback heels",
      Alia: "a clove-red one-shoulder cropped covert-editorial waistcoat exposing her ordinary waist and belly button with a high closed back, paired with a separate vanilla-gold tailored mini skort carrying large complete ylang-ylang blossom and vanilla-vine fields, with black platform heels",
      "AI ECE": "a reef-blue square-neck cropped route-command top exposing her ordinary waist and belly button with wide secure straps and a high closed back, paired with a separate emerald asymmetric mini skirt carrying a large complete ocean-swell and clove-cluster field, opaque knee socks in an original red-orange-yellow-green-blue-indigo-violet gradient unrelated to Comoros colors, and pearl-white pumps"
    },
    prop: "Because rainbow hosiery is active, Alia alone handles one photorealistic full-size polished rainbow-gradient Desert Eagle-style inert cinematic prop in her right hand at shoulder height for an unloaded magazine-free manipulation demonstration. The magazine is absent and the empty magazine well is clearly visible. The prop is shown in clean side profile. Her right index finger is straight and visibly indexed high along the frame outside the complete unobstructed empty trigger guard. The horizontal muzzle points only far left across clearly empty Indian Ocean water toward an unoccupied route marker, away from every person, palace ruin, cliff, mountain, tray, and camera, never upward or at the sky. Her left hand stays off the prop on Ellie's shoulder. ECE remains route strategist through a separate hands-free holographic map above her far shoulder.",
    paws: "",
    hands: [
      "Alia right hand alone holds the inert prop with index finger straight outside the empty guard; Alia left hand rests visibly on Ellie's near shoulder",
      "Ellie left hand rests visibly at Alia's near waist; Ellie right hand links visibly with Radiance's left hand",
      "Radiance left hand links visibly with Ellie's right hand; Radiance right hand rests visibly at ECE's near waist",
      "ECE left hand rests visibly at Radiance's near waist; ECE right index hand points visibly toward the separate overhead holographic beacon"
    ]
  },
  {
    scene: 1242,
    theme: "undercover investigator couture",
    landmark: "a broad dry covered volcanic-geology lookout above the complete Lac Sale crater near Mitsamiouli, with the round deep-blue crater lake, black basalt rim, coastal scrub, distant white-sand shoreline, and empty Indian Ocean horizon clearly recognizable beyond a cinematic heavy rain curtain",
    motifs: [
      "large complete concentric Lac Sale crater, black basalt, and rain-ripple fields across Radiance's raincoat dress and Ellie's skort",
      "large complete coelacanth, coral-reef, vanilla-vine, and clove-blossom fields across Alia's skirt and ECE's skirt"
    ],
    culture: "A dry unbranded geology-and-botany station outside the prop lane holds a black basalt sample, a text-free crater relief, vanilla pods, cloves, and a coelacanth study model. Use these only as secular science and agriculture references. No literal flag, crescent, star, coat of arms, official emblem, sacred symbol, religious building, copied police uniform, official badge, police impersonation, arrest, raid, threat, brand, alcohol, or readable text.",
    expected: {
      weather: "heavy rain curtain", paws: false, pole: false, rainbowOnly: false,
      rainbowHosiery: false, wearer: "AI ECE", palette: "original independent rainbow gradient",
      cuts: {
        Radiance: [false, false, false], Ellie: [true, false, false],
        Alia: [true, false, false], "AI ECE": [true, true, false]
      }
    },
    romance: "Sobbing Radiance takes one visible step along the dry lookout while still linking hands with magnetically confident Alia. Remorseful Ellie stays close in a separate lane and links her other hand with Radiance, forming a fully visible three-woman chain. Alia steadies betrayal-shocked ECE at the shoulder from behind while ECE keeps both hands on the inert prop in the controlled two-hand stance. Ellie rests her free hand on Radiance's shoulder. This safely translates the selected walk-away hand link, gentle catch, protective support, face-to-face concern, finger link, shoulder press, and theatrical jealous look into four clean contacts with no crossed or borrowed arms.",
    composition: "Place ECE at the far left with both prop hands isolated against empty crater-lake water, Alia left-center one half-step behind ECE, Radiance right-center, and Ellie at the far right. Use clear lateral spacing rather than a tight cluster. Separate every shoulder, elbow, wrist, hand, torso edge, lower body, and heel with crater, basalt, rain, or lookout background.",
    emotionNuance: {
      Radiance: "full sobbing shown by visible tear tracks and a shaking but upright adult posture on stable dry footing",
      Ellie: "guilt and remorse shown by lowered eyes and a careful consoling shoulder touch",
      Alia: "magnetic confidence shown by calm posture and a protective steadying touch toward ECE",
      "AI ECE": "betrayal shock shown by widened tear-bright eyes while maintaining disciplined prop safety"
    },
    outfits: {
      Radiance: "a pearl-white cap-sleeve investigator-editorial mini raincoat dress with covered waist and high closed back, carrying a large complete deep-blue Lac Sale crater and black-basalt rim field, with reef-blue heeled boots",
      Ellie: "a clove-red square-neck wide-strap cropped investigator vest exposing her ordinary waist and belly button with a high closed back, paired with a separate charcoal pleated mini skort carrying a large complete silver rain-ripple and crater-contour field, with pearl-white pumps",
      Alia: "a vanilla-gold one-shoulder cropped investigator blouse exposing her ordinary waist and belly button with a high closed back, paired with a separate emerald tulip mini skirt carrying large complete blue coelacanth and coral-reef fields, with black platform heels",
      "AI ECE": "a fully strapless deep-ocean sculpted cropped investigator bodice with completely bare shoulders, exposed ordinary waist and belly button, and a high closed back, paired with a separate ylang-yellow architectural A-line mini skirt carrying a large complete vanilla-vine and clove-blossom field, with clove-red slingback heels"
    },
    prop: "ECE alone handles one photorealistic full-size polished rainbow-gradient Desert Eagle-style inert cinematic prop in a disciplined two-hand stance lesson at shoulder height. Her right hand holds the grip; her left hand supports the right grip without covering the guard. Her right index finger is straight and visibly indexed high along the frame outside the complete unobstructed empty trigger guard. The prop is shown in clean side profile, and ECE looks down the aligned sights. The horizontal muzzle points only far left across clearly empty Lac Sale water toward an unoccupied floating route target, away from every person, lookout, station, crater wall, shoreline, and camera, never upward or at the sky. A separate hands-free holographic route map floats beside ECE's far shoulder.",
    paws: "",
    hands: [
      "ECE right hand holds the inert prop with index finger straight outside the empty guard; ECE left hand supports her right grip while leaving the guard fully visible",
      "Alia left hand rests visibly on ECE's far shoulder from a separate rear lane; Alia right hand links visibly with Radiance's left hand",
      "Radiance left hand links visibly with Alia's right hand; Radiance right hand links visibly with Ellie's left hand",
      "Ellie left hand links visibly with Radiance's right hand; Ellie right hand rests visibly on Radiance's far shoulder"
    ]
  },
  {
    scene: 1243,
    theme: "undercover investigator couture",
    landmark: "a broad dry covered marine-research pier in Moheli Marine Park, with complete turquoise lagoon water, green-turtle nesting beach, coral shallows, seagrass, forested volcanic islets, and a clearly empty marked ocean route lane visible through rare cinematic snow flurries",
    motifs: [
      "large complete green sea-turtle, coral-reef, and seagrass fields across Radiance's skirt and Ellie's dress",
      "large complete blue coelacanth, humpback-whale, volcanic-islet, and ylang-ylang fields across Alia's dress and ECE's skort"
    ],
    culture: "A dry community marine-science table far outside the prop lane holds a text-free turtle track cast, coral-safe monitoring floats, a coelacanth relief, ylang-ylang blossoms, and a small island contour model. Use only secular conservation, marine-life, volcanic-island, and agriculture references. No literal flag, crescent, star, coat of arms, official emblem, sacred symbol, religious building, copied police uniform, official badge, police impersonation, arrest, raid, threat, brand, alcohol, or readable text.",
    expected: {
      weather: "snow flurries", paws: false, pole: false, rainbowOnly: true,
      rainbowHosiery: true, wearer: "Radiance", palette: "country-palette rainbow-like gradient",
      cuts: {
        Radiance: [true, false, true], Ellie: [false, false, true],
        Alia: [false, true, true], "AI ECE": [true, false, false]
      }
    },
    romance: "Tender Radiance and equally tender ECE form the unmistakable extra-affectionate center at the right through linked hands, ECE's visible waist touch, sustained eye contact, and cheek-close body lines. At the left, remorseful Alia keeps her prop arm isolated over empty lagoon water and rests her free hand at the male's waist. The awestruck established male reciprocates at Alia's waist while linking his other hand with resentful Ellie, creating two clear fully clothed adult infidelity-drama contacts in front of his wife. Ellie keeps her other hand on Radiance's shoulder, and Radiance returns a visible waist touch to Ellie while remaining linked to ECE. The male's strongest sustained eye line crosses the clean gaps only to ECE. This honors the selected walking weave, linked pair, protective touches, cheek-near pass, jealous look, shoulder embrace, restrained blown-kiss energy, cheek-touch energy, and direct eye contact without obscuring a hand.",
    composition: "Place Alia at the far left with her prop arm fully isolated against empty lagoon water, the male left-center, Ellie at center, Radiance right-center, and ECE at the far right. Keep all five adults in separate lateral and depth lanes. Angle Radiance, Ellie, and Alia three-quarters away with hair moved clear so all three rolled complete open backs and all five complete faces remain visible. Separate every shoulder, elbow, wrist, hand, torso, lower body, heel, boot, and knee sock with lagoon, pier, beach, or islet background.",
    emotionNuance: {
      Radiance: "tender affection shown by a soft smile and strongest closeness toward ECE",
      Ellie: "contained resentment shown by narrowed sideways eyes toward the male while her touch on Radiance stays gentle",
      Alia: "guilt and remorse shown by lowered tear-bright eyes while preserving controlled prop handling",
      "AI ECE": "tender affection performed differently from Radiance through a calm protective gaze and steady waist touch",
      Male: "awe shown by lifted brows and an open softened expression, with his strongest sustained eye line fixed on ECE"
    },
    outfits: {
      Radiance: "a rainbow-only wide-strap halter cropped investigator top exposing her ordinary waist and belly button and a completely open back from shoulder blades to the secure waistline, paired with a separate emerald-to-blue architectural mini skirt carrying a large complete green sea-turtle and coral-reef field, opaque knee socks in a harmonious Comoros-palette rainbow-like gradient of lagoon blue, reef green, pearl white, clove red, ylang yellow, vanilla gold, volcanic charcoal, and orchid violet, with pearl-white pumps",
      Ellie: "a rainbow-only violet cap-sleeve investigator mini dress with covered waist and a completely open back from shoulder blades to waist, carrying a large complete turquoise seagrass and green-turtle field, with ylang-yellow slingback heels",
      Alia: "a rainbow-only fully strapless scarlet-to-orange sculpted investigator mini dress with completely bare shoulders, covered waist, and a completely open back from shoulder blades to waist, carrying large complete blue coelacanth and violet humpback-whale fields, with emerald platform heels",
      "AI ECE": "a rainbow-only cobalt one-shoulder cropped investigator top exposing her ordinary waist and belly button with a high closed back, paired with a separate gold-to-green tailored mini skort carrying a large complete volcanic-islet and ylang-ylang field, with clove-red heeled boots",
      Male: "the established adult male face from Scene 1136 with closely trimmed beard and muscular special-operative build, wearing an opaque fitted short-sleeve polo in a saturated red-orange-yellow-green-blue-indigo-violet gradient with a restrained coelacanth contour, fitted black jeans, and practical black boots"
    },
    prop: "Because rainbow hosiery is active, Alia alone handles one photorealistic full-size polished rainbow-gradient Desert Eagle-style inert cinematic prop in her right hand at shoulder height and visibly looks down its aligned sights toward an unoccupied marine-route target. The prop is shown in clean side profile. Her right index finger is straight and visibly indexed high along the frame outside the complete unobstructed empty trigger guard. The horizontal muzzle points only far left across clearly empty lagoon water, away from every person, turtle beach, reef, pier, table, islet, and camera, never upward or at the sky. Her left hand stays off the prop at the male's waist. ECE remains route strategist through a separate hands-free holographic map beside her far shoulder.",
    paws: "",
    hands: [
      "Alia right hand alone holds the inert prop with index finger straight outside the empty guard; Alia left hand rests visibly at the male's near waist",
      "the male left hand rests visibly at Alia's near waist; the male right hand links visibly with Ellie's left hand",
      "Ellie left hand links visibly with the male's right hand; Ellie right hand rests visibly on Radiance's near shoulder",
      "Radiance left hand rests visibly at Ellie's near waist; Radiance right hand links visibly with ECE's left hand",
      "ECE left hand links visibly with Radiance's right hand; ECE right hand rests visibly at Radiance's near waist"
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
if (maleScene !== 1243) throw new Error(`Male scene drifted to ${maleScene}`);

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
    const actualCuts = [visibleMidriff.active, straplessDress.active, fullyOpenBack.active];
    if (JSON.stringify(actualCuts) !== JSON.stringify(spec.expected.cuts[character])) {
      throw new Error(`${spec.scene} ${character} cut drift: ${JSON.stringify(actualCuts)}`);
    }
  }

  for (const [actual, expected, label] of [
    [weather.result, spec.expected.weather, "weather"],
    [paws.active, spec.expected.paws, "PAWS"],
    [poleDanceTheme.active, spec.expected.pole, "pole"],
    [rainbowOnly.active, spec.expected.rainbowOnly, "rainbow-only"],
    [rainbowHosiery.active, spec.expected.rainbowHosiery, "rainbow hosiery"],
    [rainbowHosiery.wearer.result, spec.expected.wearer, "hosiery wearer"],
    [rainbowHosiery.palette.result, spec.expected.palette, "hosiery palette"]
  ]) {
    if (actual !== expected) throw new Error(`${spec.scene} ${label} drifted: ${actual}`);
  }

  const hasMale = spec.scene === maleScene;
  const castLine = hasMale
    ? "Show exactly five clearly adult fictional people: Radiance, Ellie, Alia, AI ECE, and the established adult male from Image 5. Add him without replacing any woman."
    : "Show exactly four clearly adult fictional women: Radiance, Ellie, Alia, and AI ECE.";
  const referenceLine = hasMale
    ? "Image 1 is the quartet face anchor, Image 2 the frontal face supplement, Image 3 the expression supplement, Image 4 ECE's face-detail anchor, and Image 5 the adult male face and build anchor. References control identity only; ignore their clothing, props, poses, and backgrounds."
    : "Image 1 is the quartet face anchor, Image 2 the frontal face supplement, Image 3 the expression supplement, and Image 4 ECE's face-detail anchor. References control identity only; ignore their clothing, props, poses, and backgrounds.";
  const anatomyLine = hasMale
    ? "Exactly five adults, exactly ten arms and exactly ten hands, two per person."
    : "Exactly four adults, exactly eight arms and exactly eight hands, two per woman.";
  const emotionLine = characters.map((character) => `${character}: ${characterPlans[character].emotion.result}, performed as ${spec.emotionNuance[character]}`).join("; ");
  const outfitLine = Object.entries(spec.outfits).map(([name, value]) => `${name}: ${value}`).join("; ");
  const optionalLine = [
    paws.active ? spec.paws : "No PAWS kitten.",
    poleDanceTheme.active ? "A single fixed dance pole may appear only as a distant adult athletic fashion-stage element." : "No pole.",
    rainbowOnly.active ? "Every adult outfit is visibly rainbow themed while retaining every rolled cut, distinct silhouette, and large Comoros motif." : "Do not convert the full wardrobe to rainbow-only styling.",
    rainbowHosiery.active
      ? `Exactly one rainbow-hosiery wearer: ${rainbowHosiery.wearer.result}, using ${rainbowHosiery.palette.result}. Radiance and ECE are the unmistakable extra-affectionate center, and Alia alone handles the inert prop.`
      : "No rainbow stockings or rainbow knee socks."
  ].join(" ");

  const renderPrompt = [
    "Use case: photorealistic-natural. Asset type: vertical World Series public-fashion scene.",
    referenceLine,
    `Create one fresh photorealistic 9:16 full-length cinematic editorial at ${spec.landmark}.`,
    castLine,
    "All women are clearly adult fictional professionals, visibly at least 28 years old. Preserve the four anchored adult faces, skin tones, facial proportions, and distinct identities. Radiance is the luminous blonde adult. Ellie is the dark-haired adult rival. Alia is the Black adult woman and alone wears a high sculptural braided ponytail with fine face-framing braids. AI ECE is the brunette adult strategist. Do not clone, replace, merge, or age-shift faces.",
    `Profession theme: ${spec.theme}, treated only as original public-safe fictional fashion with no copied uniform, badge, impersonation, arrest, raid, assassination, threat, injury, or combat.`,
    `Wardrobe is secure, opaque, lined, above the knee, and uses four unmistakably different silhouettes. Exact rolled outfits: ${outfitLine}.`,
    `Materialize every rolled waist, ordinary belly button, fully strapless cut, and complete open back visibly. Angle every rolled open-back wearer three-quarters away with hair moved clear while keeping her complete face visible. Large complete secular Comoros motifs must read clearly on at least two outfits: ${spec.motifs.join("; ")}. ${spec.culture}`,
    `Distinct rolled emotional performances: ${emotionLine}${hasMale ? `; Male: ${maleEmotionResult}, performed as ${spec.emotionNuance.Male}` : ""}. Where two distribution labels tie, make their facial and body performances visibly different without changing either stored roll.`,
    `Selected dynamic romance roll ${romanceBeat.roll}: ${romanceBeat.contractResult} Selected compound love roll ${compoundLoveBeat.roll}: ${compoundLoveBeat.contractResult}`,
    `Materialize both selected relationship beats through this exact safe consensual choreography. The exact hand inventory, active hosiery center, and prop-safety rules resolve any conflicting hand placement: ${spec.romance}`,
    spec.composition,
    `Use this exact owner-by-owner hand inventory and no other hands: ${spec.hands.join("; ")}.`,
    spec.prop,
    optionalLine,
    `Materialize rolled weather exactly as ${weather.result}. Keep the covered platform stable, dry, and readable while rendering the weather cinematically.`,
    anatomyLine,
    "Every arm is fully visible continuously from shoulder through elbow and wrist to one separated hand. Every hand performs exactly one listed action. Keep all palms and finger clusters separated from garment edges, hair, props, and other hands except for the listed contacts.",
    "Arrange the adults in an asymmetric moving relationship composition with clean silhouette gaps, not a static lineup. Full-length framing contains every complete face, elbow, wrist, hand, leg, foot, heel, boot, and knee sock.",
    "Strict anatomy gate: no extra, missing, duplicated, floating, fused, borrowed, emerging, ownerless, hidden-owner, cropped, or ambiguous limb, hand, finger cluster, face, person, kitten, leg, or foot.",
    "The single inert cinematic prop remains harmless. Every trigger finger stays straight outside the guard. No ammunition, live reload, firing, muzzle flash, holster, low-side carry, combat, threat, injury, aiming at a person, or aiming at the camera.",
    "No text, watermark, literal flag, crescent, star, coat of arms, official emblem, sacred symbol, religious building, copied costume, brand, minors, teen framing, nudity, explicit sexuality, bodily fluids, upskirt framing, fetish, bondage, restraint, mummification, non-consensual framing, or renderer-bypass wording."
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
    composition: spec.composition,
    emotionNuance: spec.emotionNuance,
    outfits: spec.outfits,
    propPlan: spec.prop,
    handInventory: spec.hands,
    maleModel: hasMale ? {
      present: true,
      emotion: { key: maleEmotionKey, roll: maleEmotionRoll, result: maleEmotionResult, performance: spec.emotionNuance.Male },
      identity: "established adult male from Scene 1136",
      relationship: "married to ECE; fully clothed consensual adult infidelity drama with Alia and Ellie; strongest sustained eye line remains on ECE"
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

const preflight = {
  batch,
  country,
  status: "render-preflight-stored",
  sourceCommit,
  contractSha256: sha256(contractBytes),
  rollMethod: "FNV-1a over the recorded batch305-comoros keys, reduced modulo 100. Male scene selection uses the full 32-bit hash reduced modulo 4.",
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
  nextQueueCountry: "Guyana",
  nextQueueBatch: 306,
  nextQueueScenes: [1244, 1245, 1246, 1247],
  researchSources: [
    { url: "https://www.comorostourism.com/fr/activites/sites_touristiques", usedFor: "Iconi, Palais Kapviridjohe, former Sultan Said Ali residence, coast, and secular palace architecture" },
    { url: "https://www.comorostourism.com/fr/decouvrir/geographie", usedFor: "Grande Comore volcanic landscape, Karthala, ylang-ylang, vanilla, lagoons, reefs, and Moheli nature context" },
    { url: "https://whc.unesco.org/en/tentativelists/5109/", usedFor: "Medinas of Iconi and Moroni, palace ruins by the sea, old houses, narrow lanes, and monumental decorated doors" },
    { url: "https://whc.unesco.org/en/tentativelists/5107/", usedFor: "Coelacanth Marine Park, volcanic caves, coelacanth, whales, dolphins, and Moheli marine ecosystems" },
    { url: "https://whc.unesco.org/en/tentativelists/6974/", usedFor: "Moheli Marine Park, coral reefs, seagrass, turtle nesting beaches, humpback whales, dolphins, volcanic mountains, and lagoons" }
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
    flagMotifDecision: "The Comoros flag includes a crescent and stars, so no literal flag, crescent, star, or official emblem is copied. Large researched secular ylang-ylang, vanilla, clove, coelacanth, turtle, reef, volcanic, palace-arch, carved-door, crater, and lateen-sail fields replace them.",
    palette: "lagoon blue, reef green, pearl white, clove red, ylang yellow, vanilla gold, volcanic charcoal, orchid violet, coral orange, and deep ocean blue",
    minimumCoverage: "Every scene places multiple large complete secular Comoros motifs across at least two outfits as full bodice, skirt, hip, or panel fields rather than tiny trim.",
    cultureScene: "Scene 1240 visibly includes ylang-ylang, vanilla, cloves, a lateen-sail boat model, and a coelacanth relief. The other scenes extend Iconi palace architecture, Karthala geology, Lac Sale, volcanic basalt, and Moheli marine conservation.",
    prohibitions: "No literal flag, crescent, star, coat of arms, official emblem, sacred symbol, religious architecture, copied ceremonial dress, copied uniform, badge, weapon threat, alcohol, or branded product."
  },
  xPublishingRolls,
  xPublishingPlan: {
    minimumCurrentCountryAcceptedAssets: 2,
    attachmentShape: "two Comoros images plus one historical Fiji image when at least two Comoros images pass",
    captionIfEligible: "Comoros red heart Fiji #Comoros",
    internalAgencyHashtagActive: false,
    worldXXXSeriesHashtagActive: false
  },
  anatomyGate: {
    fourPersonScenes: "Scenes 1240, 1241, and 1242 require exactly eight arms and eight hands, two per woman, with every limb continuously traceable to one owner.",
    fivePersonScene: "Scene 1243 requires exactly ten arms and ten hands, two per adult, with the male added without replacing any woman.",
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
    raw: { status: "pending", requested: 4, concurrency: "four independent built-in image generation calls; concurrency attempted when the host supports simultaneous calls" },
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
fs.writeFileSync(path.join(root, "batch-305-comoros-preflight.json"), `${JSON.stringify(preflight, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  preflight: path.join(root, "batch-305-comoros-preflight.json"),
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
