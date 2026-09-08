import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const batch = 386;
const country = "Solomon Islands";
const countrySlug = "solomon-islands";
const firstScene = 1564;
const root = path.resolve("tmp/world-195x4/batch-386");
const checkpointPath = path.resolve(
  "assets/lore/starlight-era/batch-386-solomon-islands-near-sun-solar-observation-checkpoint.json",
);
const contractPath = path.resolve(
  "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json",
);
const historicalPath = path.resolve(
  "assets/lore/starlight-era/batch-315-solomon-islands-recovery-checkpoint.json",
);
const contractBytes = fs.readFileSync(contractPath);
const contract = JSON.parse(contractBytes.toString("utf8"));
const historical = JSON.parse(fs.readFileSync(historicalPath, "utf8"));
const predecessorPath = path.resolve(
  "assets/lore/starlight-era/batch-385-guyana-near-sun-solar-observation-checkpoint.json",
);
const predecessorBytes = fs.readFileSync(predecessorPath);
const predecessor = JSON.parse(predecessorBytes.toString("utf8"));
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const characters = ["Radiance", "Ellie", "Alia", "AI ECE"];

const EXPECTED_CONTRACT_SHA256 = "4E207F9C78D29ED9858A3A9B873E35E861CCD16BCEFA4382264F54B43BD8265D";
const EXPECTED_PRIMARY_COUNT = 111;
const EXPECTED_PRIMARY_SHA256 = "C8CF9C3A1BA9F5CE57DB1E26328BE677AD247E42A3B4C185A8A014730C3930DE";
const EXPECTED_SELECTOR_COUNT = 20;
const EXPECTED_SELECTOR_SHA256 = "8D5BA9BFFDA1321BBA20E33DD437AB596D07FFDA103AA0D76AA0BA6D9192DD9F";

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex").toUpperCase();
const contractSha256 = sha256(contractBytes);
if (contractSha256 !== EXPECTED_CONTRACT_SHA256) {
  throw new Error(`Contract changed: expected ${EXPECTED_CONTRACT_SHA256}, received ${contractSha256}`);
}
if (!contract.rapidConsolidatedRenderPolicy?.boundedFoundationPassPolicy?.active) {
  throw new Error("boundedFoundationPassPolicy must be active");
}
if (!contract.countryFashion?.shortHemFoundation?.active) {
  throw new Error("shortHemFoundation must be active");
}

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

const faceAnchors = [
  ["assets/lore/starlight-era/937-central-african-republic-dzanga-sangha-rainbow-clinic-signal-cipher.png", "BA256D750840F38C67E737FAB64BF646E606761DE71AEC9E5374AA0324B1EED1"],
  ["assets/lore/starlight-era/938-central-african-republic-boali-falls-rainbow-star-map-relay.png", "4161C9A5A8F745DF3A976112B6CA539E210DFA4E88E7873760E5CD0FF3F58FF6"],
  ["assets/lore/starlight-era/936-central-african-republic-bangui-oubangui-rainbow-route-grid.png", "0F330D7FF46E226340E5C94261752E73A22B895891E83B72EB8445E4618FCEEB"],
  ["assets/lore/starlight-era/ece-canonical-identity-v1.png", "B22EF5CD9929D2A09F96DC0765434DB41C964B0F0390589E940EB085935C2315"],
  ["assets/lore/starlight-era/1136-italy-rome-lenticular-care-male-colosseum-route.png", "0030FD9FBBFA17FE4E08A64E99BF9A9583E2E7376F18E3A03BC99FCC54EFB94C"],
].map(([file, expected]) => {
  const actual = sha256(fs.readFileSync(file));
  if (actual !== expected) throw new Error(`Anchor changed: ${file}`);
  return { file, sha256: actual };
});

const sceneSpecs = [
  {
    scene: 1564,
    layout: "country-led hybrid",
    locationName: "Matanikau cascade, Guadalcanal",
    location: "a broad dry covered public lookout beside the complete Matanikau cascade on Guadalcanal, with tiered rainforest falls, a clear pool, green mountain ridges, and distant Honiara roofs and Point Cruz recognizable beyond a rolling thunderstorm",
    countryMotifs: "large secular Matanikau-waterfall, Guadalcanal-ridge, Honiara-market, Point-Cruz-harbor, woven-basket, coconut, taro and endemic-bird fields",
    target: "one plain non-humanoid paper route symbol on a complete thick earth-and-sand backstop behind a transparent safety panel on an isolated dry lane",
    wardrobes: [
      "Radiance wears a rainforest-green sleeveless upper-thigh mini with covered waist and closed back, carrying broad waterfall and gold thermal-shield fields",
      "Ellie wears a secure strapless lagoon-turquoise upper-thigh skort look with covered waist and complete open upper back to the secure waist, carrying market and solar-filter geometry",
      "Alia wears a hibiscus-red sleeveless architectural top showing a narrow ordinary midriff over volcanic-black tailored upper-thigh shorts, closed back, with Guadalcanal contours",
      "ECE wears a shell-ivory sleeveless upper-thigh mini with covered waist and closed back, carrying Point Cruz arcs and sunrise-gold radiator seams",
    ],
    choreography: "ECE stands fully isolated at far right and uses both hands only on the inert mission prop; the rolled wrist guidance is already complete and noncontact. Radiance supports Ellie's shallow controlled dip with one hand at Ellie's upper back and one at her near forearm. Alia stands separately beside her secured odd-prop pedestal. These are the only two human contacts; every other hand is fully visible and separated.",
    weatherSafety: "The thunderstorm remains beyond the covered lookout; dry footing, faces, cascade, target and complete backstop stay bright and readable.",
  },
  {
    scene: 1565,
    layout: "country-led hybrid",
    locationName: "Marovo Lagoon marine-observation terrace",
    location: "a broad dry covered marine-observation terrace above Marovo Lagoon, with the complete double barrier lagoon, raised reef islands, turquoise channels, mangrove and seagrass edges, and Vangunu and Gatokae slopes recognizable beyond a strong windstorm",
    countryMotifs: "large secular double-barrier-lagoon, reef-island, mangrove, seagrass, canoe-craft and conservation fields",
    target: "one plain non-humanoid paper route symbol on a complete thick sand backstop behind a transparent safety panel on a closed dry lane away from water and public routes",
    wardrobes: [
      "Radiance wears a sunrise-gold asymmetric upper-thigh mini with covered waist and closed back, carrying lagoon channels and pearl thermal facets",
      "Ellie wears a sea-glass-blue sleeveless upper-thigh mini with covered waist and closed back, carrying a complete reef-island field and gold radiator seams",
      "Alia wears a rainforest-green sleeveless solar top showing a narrow ordinary midriff over a coral-rose upper-thigh skort, closed back, with mangrove arcs",
      "ECE wears a secure strapless shell-ivory solar top showing a narrow ordinary midriff over volcanic-black tailored upper-thigh shorts, closed back, with smoked-filter geometry",
    ],
    choreography: "ECE stands fully isolated at far right and uses both hands only on the inert mission prop. Ellie stands separately with both hands visibly supporting the locked kinetic umbrella shaft. Radiance and Alia stand in separated three-quarter poses with both hands open and visible. There is no human contact and no hidden hand.",
    weatherSafety: "The windstorm remains beyond the shielded terrace; the umbrella mechanism is locked and dry footing, faces, lagoon, target and complete backstop stay readable.",
  },
  {
    scene: 1566,
    layout: "theme-led original",
    locationName: "Tetepare Island conservation boardwalk",
    location: "a broad dry covered conservation boardwalk on Tetepare Island, with intact lowland rainforest, rugged volcanic and reef shoreline, bright coral shallows, an empty leatherback-turtle nesting beach, and a small ranger hut recognizable while hail falls safely beyond an impact-rated clear canopy",
    countryMotifs: "the landmark remains the Solomon Islands read while all four women's looks use distinct near-Sun thermal, corona, solar-filter, radiator and sunshield structures",
    target: "one highly visible orange unoccupied route marker on clearly empty ocean water, with no swimmer, boat, animal, person, structure or camera in or beyond the line",
    wardrobes: [
      "Radiance wears a sunrise-gold sleeveless upper-thigh solar mini with covered waist and complete open upper back to the secure waist, plus shell-ivory thermal facets",
      "Ellie wears a sea-glass-blue sleeveless solar top showing a narrow ordinary midriff over volcanic-black tailored upper-thigh shorts, closed back, with gold radiator seams",
      "Alia wears a secure strapless rainforest-green upper-thigh solar mini with covered waist and closed back, carrying coral-rose corona arcs",
      "ECE wears a secure strapless shell-ivory solar top showing a narrow ordinary midriff over an orchid-violet upper-thigh skort, closed back, with smoked sunshield ribs",
      "the established bearded adult man wears an opaque shell-ivory short-sleeve top, tailored above-knee volcanic-black shorts and complete black shoes",
    ],
    choreography: "ECE stands fully isolated at far right and uses both hands only on the inert mission prop. Radiance stands separately with both hands on the secured miniature planetarium controls. Ellie, Alia and the man remain in separated three-quarter poses with open visible hands; the man's strongest eye line returns to ECE. There is no human contact and no hidden hand.",
    weatherSafety: "Hail remains outside the impact-rated canopy; the protected boardwalk, faces, projector, beach and empty-water marker stay dry and readable.",
  },
  {
    scene: 1567,
    layout: "theme-led original",
    locationName: "Lake Tegano, East Rennell karst observatory",
    location: "a broad dry covered karst observatory above Lake Tegano on East Rennell, with the vast brackish former lagoon, limestone islets, raised coral-atoll rim, dense forest and distant marine horizon recognizable through harmless white sea-mist flecks",
    countryMotifs: "the landmark remains the Solomon Islands read while all four looks use distinct near-Sun thermal, corona, solar-filter, radiator and sunshield structures",
    target: "one plain non-humanoid paper route symbol on a complete thick earth-and-sand backstop behind a transparent safety panel on an isolated dry lane",
    wardrobes: [
      "Radiance wears a sea-glass-blue sleeveless solar top showing a narrow ordinary midriff over a sunrise-gold upper-thigh skort, closed back, with pearl thermal facets",
      "Ellie wears a rainforest-green sleeveless upper-thigh solar mini with covered waist and closed back, carrying shell-ivory radiator seams",
      "Alia wears a secure strapless coral-rose solar top showing a narrow ordinary midriff over volcanic-black tailored upper-thigh shorts, closed back, with gold corona arcs",
      "ECE wears a shell-ivory sleeveless upper-thigh solar mini with covered waist and closed back, carrying smoked-filter and orchid-violet sunshield geometry",
    ],
    choreography: "ECE stands fully isolated at far right and uses both hands only on the inert mission prop. Ellie supports Radiance's shallow controlled dip with one hand at Radiance's upper back and one at her near forearm. Alia stands separately and holds the locked clockwork bouquet with both visible hands. These are the only two human contacts; every other hand is fully visible and separated.",
    weatherSafety: "The raw snow-flurry roll is localized as harmless white sea-mist flecks beyond the shelter, with no accumulation; footing, faces, lake, target and complete backstop remain dry and readable.",
  },
];

const maleKey = `batch${batch}-${countrySlug}-male-model-scene`;
const maleHash = fnv1a(maleKey);
primaryPairs.push([maleKey, maleHash % 100]);
const malePosition = (maleHash % 4) + 1;
const maleScene = firstScene + malePosition - 1;
const maleEmotion = primary(`batch${batch}-${countrySlug}-scene${malePosition}-male-emotion`);
maleEmotion.result = fromDistribution(maleEmotion.roll, contract.emotionRolls.distribution, "emotion");

const weatherMaterialization = (weather, scene) => {
  if (scene === 1564) return "a rolling thunderstorm beyond a fully dry covered waterfall lookout";
  if (scene === 1565) return "a strong windstorm beyond the shielded dry lagoon terrace";
  if (scene === 1566) return "hail safely outside an impact-rated clear canopy";
  return "harmless white sea-mist flecks beyond the dry Lake Tegano shelter, with no snow accumulation";
};

const scenePlans = {};
for (const spec of sceneSpecs) {
  const prefix = `batch${batch}-${countrySlug}-scene${spec.scene}`;
  const key = (suffix) => `${prefix}-${suffix}`;

  const weather = primary(key("weather"));
  weather.result = fromDistribution(weather.roll, contract.weatherRolls.distribution, "weather");
  weather.materialized = weatherMaterialization(weather.result, spec.scene);
  const mascotState = primary(key("mascotState"));
  mascotState.result = fromDistribution(mascotState.roll, contract.mascotStateRoll.distribution, "state");
  const mascotHolderValue = roll(key("mascotHolder"));
  const pole = primary(key("poleDanceTheme"));
  pole.active = pole.roll <= 5;
  const rainbowOnly = primary(key("rainbowOnly"));
  rainbowOnly.active = rainbowOnly.roll <= 3;
  const hosiery = primary(key("rainbowHosiery"));
  hosiery.active = hosiery.roll <= 24;
  hosiery.wearer = selector(key("rainbowHosieryWearer"), roll(key("rainbowHosieryWearer")) <= 49 ? "Radiance" : "AI ECE");
  hosiery.palette = selector(key("rainbowHosieryPaletteMode"), roll(key("rainbowHosieryPaletteMode")) <= 49 ? "country-palette rainbow-like gradient" : "original independent rainbow gradient");
  const romance = primary(key("romanceBeat"));
  romance.index = romance.roll % contract.romance.dynamicBeatRolls.length;
  romance.result = contract.romance.dynamicBeatRolls[romance.index];
  const compound = primary(key("compoundLoveBeat"));
  compound.index = compound.roll % contract.romance.compoundLoveBeatRolls.length;
  compound.result = contract.romance.compoundLoveBeatRolls[compound.index];
  const hardLove = primary(key("hardLoveBeat"));
  hardLove.result = fromDistribution(hardLove.roll, contract.romance.hardLoveBeatRoll.distribution, "beat");
  const oddProp = primary(key("interestingProp"));
  oddProp.active = oddProp.roll <= 31;
  const oddHolderValue = roll(key("interestingPropHolder"));
  const oddFamilyValue = roll(key("interestingPropFamily"));
  const mission = primary(key("eceMissionProp-poseTargetRoll"));

  const characterPlans = {};
  const usedEmotions = new Set();
  for (const character of characters) {
    const emotion = primary(key(`${character}-emotion`));
    emotion.result = fromDistribution(emotion.roll, contract.emotionRolls.distribution, "emotion");
    emotion.materialized = emotion.result;
    if (usedEmotions.has(emotion.materialized)) {
      const disambiguation = primary(key(`${character}-emotion-disambiguation`));
      emotion.disambiguation = disambiguation;
      for (let step = 1; step <= 100; step += 1) {
        const candidate = fromDistribution(
          (disambiguation.roll + step) % 100,
          contract.emotionRolls.distribution,
          "emotion",
        );
        if (!usedEmotions.has(candidate)) {
          emotion.materialized = candidate;
          break;
        }
      }
    }
    usedEmotions.add(emotion.materialized);
    const visibleMidriff = primary(key(`${character}-visibleMidriff`));
    visibleMidriff.active = visibleMidriff.roll <= 49;
    const strapless = primary(key(`${character}-straplessDress`));
    strapless.active = strapless.roll <= 34;
    const openBack = primary(key(`${character}-fullyOpenBack`));
    openBack.active = openBack.roll <= 29;
    characterPlans[character] = { emotion, visibleMidriff, strapless, openBack };
  }

  const handler = hosiery.active ? "Alia" : "AI ECE";
  const eligibleNonHandlers = characters.filter((character) => character !== handler);
  const mascotHolder = selector(key("mascotHolder"), eligibleNonHandlers[mascotHolderValue % eligibleNonHandlers.length]);
  const oddHolder = selector(key("interestingPropHolder"), eligibleNonHandlers[oddHolderValue % eligibleNonHandlers.length]);
  const oddFamily = selector(
    key("interestingPropFamily"),
    contract.interestingPropRoll.orderedPropFamilies[oddFamilyValue % contract.interestingPropRoll.orderedPropFamilies.length],
  );

  mission.category = mission.roll <= 34
    ? "two-hand paper-target stance"
    : mission.roll <= 59
      ? "two-hand open-water sight picture"
      : mission.roll <= 74
        ? "behind-shoulder wrist guidance to paper target"
        : mission.roll <= 87
          ? "completed handoff to open-water marker"
          : "open-mechanism paper-target inspection";
  mission.handler = handler;
  mission.target = mission.roll <= 34 || (mission.roll >= 60 && mission.roll <= 74) || mission.roll >= 88
    ? "paper target and complete backstop"
    : "unoccupied open-water marker";

  scenePlans[spec.scene] = {
    ...spec,
    weather,
    mascotState,
    mascotHolder,
    oddProp: { ...oddProp, holder: oddHolder, family: oddFamily },
    pole,
    rainbowOnly,
    hosiery,
    romance,
    compound,
    hardLove,
    mission,
    characters: characterPlans,
    malePresent: spec.scene === maleScene,
  };
}

const xPublishing = {};
for (const [name, suffix] of [["heart", "x-heart"], ["internalAgency", "x-internalagency"], ["worldXXXSeries", "x-worldxxxseries"]]) {
  const item = primary(`batch${batch}-${countrySlug}-${suffix}`);
  if (name === "heart") item.result = item.roll <= 82 ? "red heart" : "white heart";
  else item.active = item.roll <= 24;
  xPublishing[name] = item;
}

const primarySha256 = sha256(JSON.stringify(primaryPairs));
const selectorSha256 = sha256(JSON.stringify(selectorPairs));
if (primaryPairs.length !== EXPECTED_PRIMARY_COUNT || primarySha256 !== EXPECTED_PRIMARY_SHA256) {
  throw new Error(`Primary roll audit mismatch: ${primaryPairs.length} ${primarySha256}`);
}
if (selectorPairs.length !== EXPECTED_SELECTOR_COUNT || selectorSha256 !== EXPECTED_SELECTOR_SHA256) {
  throw new Error(`Selector roll audit mismatch: ${selectorPairs.length} ${selectorSha256}`);
}

const emotionLine = (plan) => characters
  .map((character) => `${character}: ${plan.characters[character].emotion.materialized}`)
  .join("; ");

const mascotLine = (scene, plan) => {
  if (scene === 1564) return "Exactly PAWS the tiny golden kitten and MAX the young golden-retriever pup rest together on one dry padded lounge in Radiance's protected bay, outside every prop and mission lane; no adult hand is reassigned to them.";
  if (scene === 1566) return "Exactly PAWS and MAX rest together on one dry padded lounge in Alia's protected bay, outside every prop and mission lane; no adult hand is reassigned to them.";
  if (scene === 1567) return "Exactly PAWS and MAX rest together on one dry padded lounge in Radiance's protected bay, outside every prop and mission lane; no adult hand is reassigned to them.";
  return "Neither mascot appears.";
};

const oddPropLine = (scene, plan) => {
  if (scene === 1564) return "The active odd prop is Alia's giant tuning-fork instrument, locked upright in a fixed transparent pedestal with no swinging part; she indicates it without touching.";
  if (scene === 1565) return "The active odd prop is Ellie's kinetic umbrella with rotating mirrored petals; its dry mechanism is visibly locked and she supports its stable vertical shaft with both hands.";
  if (scene === 1566) return "The active odd prop is Radiance's portable miniature planetarium projector, fixed on a broad stable console with cool harmless light and no loose parts.";
  return "The active odd prop is Alia's clockwork flower bouquet with slow safe petals; its mechanism is locked and she holds the opaque stems with both hands.";
};

const promptFor = (plan) => {
  const cast = plan.malePresent
    ? "Exactly five fictional adults visibly over 28: blonde Radiance, dark-haired Ellie, Black Alia with the only high sculptural braided ponytail, brunette AI ECE, and the established athletic bearded man from Image 5."
    : "Exactly four fictional women visibly over 28: blonde Radiance, dark-haired Ellie, Black Alia with the only high sculptural braided ponytail, and brunette AI ECE.";
  const reference = plan.malePresent
    ? "Images 1-3 anchor the four women, Image 4 anchors ECE, and Image 5 anchors the man."
    : "Images 1-3 anchor the four women and Image 4 anchors ECE.";
  const count = plan.malePresent ? "ten arms, ten hands, ten legs and ten complete feet" : "eight arms, eight hands, eight legs and eight complete feet";
  const maleEmotionText = plan.malePresent ? ` The man's stored emotion is ${maleEmotion.result}.` : "";
  const missionDetail = plan.mission.target === "paper target and complete backstop"
    ? plan.target
    : plan.target;
  return [
    "Create one fresh photorealistic 9:16 full-length Starlight World Series public-fashion image.",
    `${reference} Use these original identity references only, never an earlier country render. ${cast} Preserve distinct anchored adult faces and skin tones; no clone, merge, extra person or age shift.`,
    `Scene: ${plan.location}. Near-Sun solar-observation couture is fictional shielded fashion at this real Solomon Islands location: pearl-gold thermal facets, abstract corona arcs, smoked-filter geometry, radiator seams and compact sunshield panels. Nobody is literally on or near the Sun. ${plan.layout === "country-led hybrid" ? `Country-led hybrid: two or three looks carry ${plan.countryMotifs}; at least two also carry solar construction.` : `Theme-led original: ${plan.countryMotifs}.`} No literal Solomon Islands flag, five-star field, official emblem or sacred symbol, religious architecture, copied ceremonial dress or uniform, badge, logo, text or watermark.`,
    `Permanent short foundation: four distinct secure opaque lined upper-thigh women's looks with full public-safe coverage. ${plan.wardrobes.join("; ")}. No long panels, trousers, leggings, jumpsuits, lower hems, sheer coverage or accidental exposure.`,
    `${mascotLine(plan.scene, plan)} ${oddPropLine(plan.scene, plan)} Pole and rainbow-only rolls are inactive. ${plan.hosiery.active ? `Rainbow hosiery is active: ${plan.hosiery.wearer.result} alone wears the specified ${plan.hosiery.palette.result}; nobody else wears hosiery.` : "Rainbow hosiery is inactive; nobody wears stockings or knee socks."}`,
    `Anatomy-first relationship: ${plan.choreography} Emotions: ${emotionLine(plan)}.${maleEmotionText} This simple topology is the bounded resolution of the stored movement rolls; never add a hidden hand.`,
    `${plan.mission.handler} alone handles one full-size polished rainbow-gradient large-frame inert cinema-training replica in a side-on two-hand stance. Both hands stay on the grip; one index is straight on the upper frame outside the empty guard. The muzzle points horizontally away from every person, mascot, landmark, occupied object and camera toward ${missionDetail}. No ammunition, firing, flash, threat, injury, combat or unsafe aim.`,
    `${plan.weatherSafety} Eye-level 50 mm full-body editorial. Render exactly ${count}, two arms/hands and two legs/feet each. Keep every face, joint, hand, leg, foot, mascot, active odd prop and complete endpoint in frame. One role per hand, traceable limbs, separated silhouettes and complete footwear; no extra, missing, fused, grossly malformed, ownerless or impossible anatomy.`,
  ].join("\n\n") + "\n";
};

fs.mkdirSync(root, { recursive: true });
const promptRecords = {};
for (const scene of Object.keys(scenePlans).map(Number).sort((a, b) => a - b)) {
  const prompt = promptFor(scenePlans[scene]);
  const promptPath = path.join(root, `scene-${scene}-initial-prompt.txt`);
  fs.writeFileSync(promptPath, prompt, "utf8");
  const bytes = Buffer.from(prompt, "utf8");
  promptRecords[scene] = {
    path: path.relative(process.cwd(), promptPath).replaceAll("\\", "/"),
    sha256: sha256(bytes),
    bytes: bytes.length,
  };
}

const numericRollAudit = Object.fromEntries(Object.entries(scenePlans).map(([scene, plan]) => {
  const emotions = Object.fromEntries(characters.map((character) => [character, plan.characters[character].emotion.roll]));
  for (const character of characters) {
    const disambiguation = plan.characters[character].emotion.disambiguation;
    if (disambiguation) emotions[`${character} disambiguation`] = disambiguation.roll;
  }
  if (plan.malePresent) emotions.Male = maleEmotion.roll;
  return [scene, {
    weather: plan.weather.roll,
    mascotState: plan.mascotState.roll,
    mascotHolder: plan.mascotHolder.roll,
    oddProp: plan.oddProp.roll,
    oddHolder: plan.oddProp.holder.roll,
    oddFamily: plan.oddProp.family.roll,
    pole: plan.pole.roll,
    rainbowOnly: plan.rainbowOnly.roll,
    hosiery: plan.hosiery.roll,
    hosieryWearer: plan.hosiery.wearer.roll,
    hosieryPalette: plan.hosiery.palette.roll,
    romance: plan.romance.roll,
    compound: plan.compound.roll,
    hardLove: plan.hardLove.roll,
    missionPoseTarget: plan.mission.roll,
    emotions,
    cuts: Object.fromEntries(characters.map((character) => [character, [
      plan.characters[character].visibleMidriff.roll,
      plan.characters[character].strapless.roll,
      plan.characters[character].openBack.roll,
    ]])),
  }];
}));

const activeFields = Object.fromEntries(Object.entries(scenePlans).map(([scene, plan]) => [scene, {
  location: plan.locationName,
  layout: plan.layout,
  weather: { roll: plan.weather.roll, raw: plan.weather.result, materialized: plan.weather.materialized },
  mascot: { roll: plan.mascotState.roll, state: plan.mascotState.result, holder: plan.mascotHolder },
  oddProp: { roll: plan.oddProp.roll, active: plan.oddProp.active, holder: plan.oddProp.holder, family: plan.oddProp.family },
  pole: { roll: plan.pole.roll, active: plan.pole.active },
  rainbowOnly: { roll: plan.rainbowOnly.roll, active: plan.rainbowOnly.active },
  hosiery: plan.hosiery,
  romance: plan.romance,
  compound: plan.compound,
  hardLove: plan.hardLove,
  mission: plan.mission,
  emotions: Object.fromEntries(Object.entries(plan.characters).map(([character, details]) => [character, details.emotion])),
  cuts: Object.fromEntries(Object.entries(plan.characters).map(([character, details]) => [character, {
    visibleMidriff: details.visibleMidriff,
    strapless: details.strapless,
    openBack: details.openBack,
  }])),
  malePresent: plan.malePresent,
  prompt: promptRecords[scene],
}]));

const queueResolution = {
  countryEvidence: [
    "assets/lore/starlight-era/batch-385-guyana-near-sun-solar-observation-checkpoint.json#/nextQueue",
    "assets/lore/starlight-era/batch-314-guyana-recovery-checkpoint.json#/nextQueueCountry",
    "assets/lore/starlight-era/world-195x4-campaign.json#/countryPriorityOrder/160",
  ],
  themeEvidence: [
    "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json#/cinematicThemeRotation",
    "assets/lore/starlight-era/batch-385-guyana-near-sun-solar-observation-checkpoint.json#/nextQueue/cinematicTheme",
  ],
  notGuessed: true,
};
const countryMotifPolicy = {
  flagMotifDecision: historical.countryMotifPolicy.flagMotifDecision,
  palette: historical.countryMotifPolicy.palette,
  minimumCoverage: "Scenes 1564 and 1565 each foreground large Solomon Islands motif fields on two or three looks and near-Sun construction on at least two. Scenes 1566 and 1567 use four distinct theme-led looks while the Solomon Islands landmark remains equally foregrounded.",
  cultureScene: historical.countryMotifPolicy.cultureScene,
  prohibitions: historical.countryMotifPolicy.prohibitions,
};
const expectedPredecessorQueue = {
  nextCountry: "Solomon Islands",
  nextBatch: 386,
  sceneNumbers: [1564, 1565, 1566, 1567],
  cinematicTheme: "near-Sun solar-observation couture",
  themePairPosition: 2,
};
for (const [field, expected] of Object.entries(expectedPredecessorQueue)) {
  if (JSON.stringify(predecessor.nextQueue?.[field]) !== JSON.stringify(expected)) {
    throw new Error(`Guyana nextQueue conflict at ${field}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(predecessor.nextQueue?.[field])}`);
  }
}
const predecessorClosed = predecessor.hardSafeAcceptedCount === 4
  && Array.isArray(predecessor.missingSceneNumbers)
  && predecessor.missingSceneNumbers.length === 0;
const predecessorGate = {
  checkpointPath: path.relative(process.cwd(), predecessorPath).replaceAll("\\", "/"),
  checkpointSha256: sha256(predecessorBytes),
  observedStatus: predecessor.status,
  observedHardSafeAcceptedCount: predecessor.hardSafeAcceptedCount,
  observedMissingSceneNumbers: predecessor.missingSceneNumbers,
  authoritativeNextQueueMatches: true,
  predecessorClosed,
  preparationOnly: true,
  batch386RenderAuthorized: predecessorClosed,
  reason: predecessorClosed
    ? "Batch 385 is closed at four of four; Batch 386 pass 1 may be launched only as a separate later action."
    : "Batch 385 is not closed; Batch 386 remains queue-locked.",
};
const policy = {
  contractSection: "rapidConsolidatedRenderPolicy.boundedFoundationPassPolicy",
  passCeiling: 2,
  pass1CandidatesPrepared: 4,
  pass1CandidatesAuthorized: predecessorClosed ? 4 : 0,
  pass1CandidatesConsumed: 0,
  pass2CandidatesConsumed: 0,
  automaticThirdPassAllowed: false,
  authorizationCondition: predecessorClosed
    ? "Batch 385 is closed; exactly four concurrent pass-1 candidates are authorized but not launched by this materializer."
    : "Batch 385 must first close; this preparation artifact grants no render authority.",
};
const nextQueue = {
  nextCountry: "Bhutan",
  nextBatch: 387,
  sceneNumbers: [1568, 1569, 1570, 1571],
  cinematicTheme: "deep-sea submersible couture",
  themePairPosition: 1,
  countryEvidence: [
    "assets/lore/starlight-era/batch-315-solomon-islands-recovery-checkpoint.json#/nextQueueCountry",
    "assets/lore/starlight-era/world-195x4-campaign.json#/countryPriorityOrder/161",
  ],
  themeEvidence: [
    "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json#/cinematicThemeRotation/orderedThemes/7",
  ],
  lockedUntilBatch386Closed: true,
};
const xCaption = "Solomon Islands \u{1F90D} Guyana #SolomonIslands";

const preflight = {
  batch,
  country,
  status: predecessorClosed
    ? "render-preflight-stored-pass-1-not-launched"
    : "queued-prepared-render-locked-until-batch385-closure",
  sourceCommit,
  contractSha256,
  policy,
  queueResolution,
  predecessorGate,
  rollMethod: "FNV-1a over recorded batch386-solomon-islands keys, reduced modulo 100; male scene selection uses the full 32-bit hash modulo 4. Duplicate emotion labels use one stored deterministic disambiguation roll.",
  rollThresholds: {
    visibleMidriff: "0-49",
    straplessDress: "0-34",
    fullyOpenBack: "0-29",
    mascotState: "0-22 PAWS and MAX; 23-37 PAWS only; 38-52 MAX only; 53-99 neither",
    interestingProp: "0-31 active; 32-99 inactive",
    poleDanceTheme: "0-5",
    rainbowOnly: "0-3",
    rainbowHosiery: "0-24",
    missionPropPoseTarget: "0-34 paper target/backstop; 35-59 open-water marker; 60-74 wrist-guidance category at paper target/backstop; 75-87 completed-handoff category at open-water marker; 88-99 open-mechanism category at paper target/backstop",
  },
  cinematicTheme: {
    active: "near-Sun solar-observation couture",
    batchOrdinalWithinTheme: 2,
    totalBatchesAtTheme: 2,
    sceneModes: ["country-led hybrid", "country-led hybrid", "theme-led original", "theme-led original"],
  },
  sceneNumbers: [1564, 1565, 1566, 1567],
  researchSources: historical.researchSources,
  faceAnchors,
  maleModelSelection: {
    key: maleKey,
    fullHash: maleHash,
    roll: maleHash % 100,
    position: malePosition,
    scene: maleScene,
    emotion: maleEmotion,
  },
  countryMotifPolicy,
  rollAudit: {
    primaryRollPairs: primaryPairs,
    selectorPairs,
    primaryPairCount: primaryPairs.length,
    selectorPairCount: selectorPairs.length,
    primarySha256,
    selectorSha256,
    mismatchCount: 0,
    scenes: numericRollAudit,
  },
  scenePlans: activeFields,
  renderPlan: {
    pass1: "Exactly four clean candidates, one per scene, launched concurrently from original identity anchors only.",
    pass2: "Only hard-unusable scenes may receive one fresh holistic correction candidate each, launched concurrently; no filler variants.",
    archiveBeforeLaterWork: true,
    thirdPassAllowed: false,
  },
  xPublishing: {
    rolls: xPublishing,
    captionIfEligible: xCaption,
    eligibility: "ineligible until four of four Solomon Islands scenes are hard-safe accepted and the checkpoint is pushed and remote-verified",
  },
  nextQueue,
};

const preflightPath = path.join(root, "batch-386-solomon-islands-preflight.json");
const preflightText = `${JSON.stringify(preflight, null, 2)}\n`;
fs.writeFileSync(preflightPath, preflightText, "utf8");
const preflightBytes = Buffer.from(preflightText, "utf8");

const checkpoint = {
  batch,
  country,
  status: predecessorClosed
    ? "active-pass-1-ready-not-launched"
    : "queued-prepared-render-locked-until-batch385-closure",
  sourceCommit,
  contractSha256,
  policy,
  queueResolution,
  predecessorGate,
  rollMethod: preflight.rollMethod,
  cinematicTheme: "near-Sun solar-observation couture",
  themePairPosition: 2,
  sceneNumbers: preflight.sceneNumbers,
  researchSources: historical.researchSources,
  faceAnchors,
  maleModelSelection: {
    key: maleKey,
    fullHash: maleHash,
    position: malePosition,
    scene: maleScene,
    emotionRoll: maleEmotion.roll,
    emotion: maleEmotion.result,
  },
  countryMotifPolicy,
  rollAudit: numericRollAudit,
  rollAuditHashes: {
    primaryPairCount: primaryPairs.length,
    primarySha256,
    selectorPairCount: selectorPairs.length,
    selectorSha256,
  },
  scenePlans: Object.fromEntries(Object.entries(scenePlans).map(([scene, plan]) => [scene, {
    location: plan.locationName,
    layout: plan.layout,
    promptPath: promptRecords[scene].path,
    promptSha256: promptRecords[scene].sha256,
    promptBytes: promptRecords[scene].bytes,
  }])),
  renderPasses: {
    pass1: {
      status: predecessorClosed
        ? "ready-exactly-four-concurrent-clean-candidates"
        : "prepared-locked-until-batch385-closure",
      allocation: { A: 1564, B: 1565, C: 1566, D: 1567 },
      candidatesPrepared: 4,
      candidatesAuthorized: predecessorClosed ? 4 : 0,
      candidatesConsumed: 0,
      launchWhenUnlocked: "Exactly four concurrent clean candidates, one per scene.",
      sourceMode: "original identity anchors only; no prior country render input",
      events: [],
    },
    pass2: {
      status: "locked-until-single-pass-1-hard-gate-audit",
      rule: "At most one fresh corrected candidate per hard-unusable scene; launch only those one to four calls concurrently.",
      candidatesConsumed: 0,
      thirdPassAllowed: false,
    },
  },
  acceptedAssets: [],
  rejectedAssets: [],
  rejectedPromptLedger: {
    status: "empty-before-render",
    entries: [],
    appendBeforeLaterPassPublicationCommitOrPush: true,
  },
  hardSafeAcceptedCount: 0,
  missingSceneNumbers: [1564, 1565, 1566, 1567],
  xPost: {
    status: "ineligible-until-four-of-four-and-git-remote-verification",
    caption: xCaption,
    url: null,
  },
  nextQueue,
  preflight: {
    path: path.relative(process.cwd(), preflightPath).replaceAll("\\", "/"),
    sha256: sha256(preflightBytes),
    bytes: preflightBytes.length,
  },
};

const checkpointText = `${JSON.stringify(checkpoint, null, 2)}\n`;
fs.writeFileSync(checkpointPath, checkpointText, "utf8");

console.log(JSON.stringify({
  batch,
  country,
  sourceCommit,
  contractSha256,
  maleModelSelection: checkpoint.maleModelSelection,
  rollAuditHashes: checkpoint.rollAuditHashes,
  prompts: promptRecords,
  preflight: checkpoint.preflight,
  checkpoint: {
    path: path.relative(process.cwd(), checkpointPath).replaceAll("\\", "/"),
    sha256: sha256(Buffer.from(checkpointText, "utf8")),
    bytes: Buffer.byteLength(checkpointText, "utf8"),
  },
}, null, 2));
