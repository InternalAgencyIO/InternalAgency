import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const batch = 388;
const country = "Luxembourg";
const countrySlug = "luxembourg";
const firstScene = 1572;
const root = path.resolve("tmp/world-195x4/batch-388");
const checkpointPath = path.resolve(
  "assets/lore/starlight-era/batch-388-luxembourg-deep-sea-submersible-checkpoint.json",
);
const contractPath = path.resolve(
  "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json",
);
const historicalPath = path.resolve(
  "assets/lore/starlight-era/batch-317-luxembourg-recovery-checkpoint.json",
);
const contractBytes = fs.readFileSync(contractPath);
const contract = JSON.parse(contractBytes.toString("utf8"));
const historical = JSON.parse(fs.readFileSync(historicalPath, "utf8"));
const predecessorPath = path.resolve(
  "assets/lore/starlight-era/batch-387-bhutan-deep-sea-submersible-checkpoint.json",
);
const predecessorBytes = fs.readFileSync(predecessorPath);
const predecessor = JSON.parse(predecessorBytes.toString("utf8"));
const predecessorGitPath = "assets/lore/starlight-era/batch-387-bhutan-deep-sea-submersible-checkpoint.json";
const predecessorRemoteRef = "origin/agent/starlight-progress-archive";
const predecessorRemoteCommit = execFileSync("git", ["rev-parse", predecessorRemoteRef], {
  encoding: "utf8",
}).trim();
const predecessorRemoteBytes = execFileSync(
  "git",
  ["show", `${predecessorRemoteRef}:${predecessorGitPath}`],
  { encoding: null },
);
// Bind prep to the remotely verified predecessor closure, not a transient local prep commit.
const sourceCommit = predecessorRemoteCommit;
const characters = ["Radiance", "Ellie", "Alia", "AI ECE"];

const EXPECTED_CONTRACT_SHA256 = "4E207F9C78D29ED9858A3A9B873E35E861CCD16BCEFA4382264F54B43BD8265D";
const EXPECTED_PRIMARY_COUNT = 109;
const EXPECTED_PRIMARY_SHA256 = "C52624F18C13D365A69407673E7E3D1EE4E44EA86BA080BA92C7F3539BFF40A5";
const EXPECTED_SELECTOR_COUNT = 20;
const EXPECTED_SELECTOR_SHA256 = "E626B689EC491178C1747B715391FCCD9245DB3C36247FEC83BE3D4E3F7AA02F";

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
    scene: 1572,
    layout: "country-led hybrid",
    locationName: "Adolphe Bridge and Petrousse Valley",
    location: "a broad dry covered public overlook beneath the complete double stone arch of Adolphe Bridge above the Petrousse Valley, with the full bridge span, suspended pedestrian deck, green cliffs, winding stream, modern tram and valley paths recognizable through a heavy rain curtain",
    countryMotifs: "large secular Adolphe-Bridge double-arch, suspended-walkway, Petrousse-cliff, tram-line, valley-stream, bicycle-path, rose-garden and city-topography fields",
    target: "one plain non-humanoid paper route symbol on a complete thick earth-and-sand backstop behind a transparent safety panel on an isolated dry lane away from the stream and public paths",
    wardrobes: [
      "Radiance wears a secure strapless Grand-Duchy-red upper-thigh mini with covered waist and closed back, carrying broad double-arch and steel pressure-shell fields",
      "Ellie wears a secure strapless ice-blue architectural top showing a narrow ordinary midriff over a steel-silver upper-thigh skort, closed back, with tram-line and porthole-ring geometry",
      "Alia wears a vineyard-green sleeveless upper-thigh mini with covered waist and closed back, carrying Petrousse-cliff and bathymetric fields",
      "ECE wears a secure strapless clean-white upper-thigh mini with covered waist and closed back, carrying valley-stream lines and slate ballast facets",
    ],
    choreography: "ECE stands fully isolated at far right and uses both hands only on the inert mission prop. Alia stands beside the protected mascot lounge with both hands open and visible. Radiance and Ellie remain in separate depth lanes; the stored seated-choice and embrace energy is resolved as eye lines after the movement has ended. There is no human contact and no hidden hand.",
    weatherSafety: "The heavy rain remains beyond the covered overlook; dry footing, faces, bridge, target and complete backstop stay bright and readable.",
  },
  {
    scene: 1573,
    layout: "country-led hybrid",
    locationName: "Belval blast furnaces and university district",
    location: "a broad dry covered observation terrace in the complete Belval industrial district, with both preserved blast furnaces, rust-red steel gantries, former ore hall, modern university cubes, red-earth landscaping and a pale storm sky recognizable while distant lightning remains beyond the roof",
    countryMotifs: "large secular Belval blast-furnace, steel-gantry, ore-cart, red-earth, university-cube, science-grid, rail-line and industrial-light fields",
    target: "one plain non-humanoid paper route symbol on a complete thick sand backstop behind a transparent safety panel on a closed dry service lane away from the furnaces, rails and public route",
    wardrobes: [
      "Radiance wears a steel-silver sleeveless submersible top showing a narrow ordinary midriff over slate-charcoal tailored upper-thigh shorts, closed back, with red-earth bathymetric seams",
      "Ellie wears a secure strapless Grand-Duchy-red upper-thigh mini with covered waist and closed back, carrying blast-furnace and pressure-shell fields",
      "Alia wears a secure strapless ice-blue submersible top showing a narrow ordinary midriff over a vineyard-green upper-thigh skort, closed back, with gantry and porthole geometry",
      "ECE wears a secure strapless clean-white upper-thigh mini with covered waist and closed back, carrying university-grid and steel ballast facets",
    ],
    choreography: "ECE stands fully isolated at far right and uses both hands only on the inert mission prop. Ellie stands in a separate bay beside her secured odd-prop enclosure, with one hand on the exterior enclosure frame and her other hand open at her side. Radiance and Alia hold separated finished-turn poses. The stored dip and embrace energy is resolved as noncontact eye lines. There is no human contact and no hidden hand.",
    weatherSafety: "Lightning remains distant beyond the covered terrace; the dry floor, faces, Belval structures, target and complete backstop remain readable.",
  },
  {
    scene: 1574,
    layout: "theme-led original",
    locationName: "Upper-Sure Lake and dam solar-boat pavilion",
    location: "a broad dry covered solar-boat pavilion overlooking the complete Upper-Sure Lake and dam landscape under soft dramatic overcast, with the wide reservoir, long dam curve, forested slopes, slate cliffs and one small solar excursion boat recognizable",
    countryMotifs: "the landmark remains the Luxembourg read while all four women's looks use distinct deep-sea pressure-shell, porthole, bathymetric, bioluminescent, ballast and manipulator-joint structures",
    target: "one plain non-humanoid paper route symbol on a complete thick earth-and-sand backstop behind a transparent safety panel on an isolated dry lane away from the lake, boat and public route",
    wardrobes: [
      "Radiance wears a lake-cobalt sleeveless upper-thigh submersible mini with covered waist and closed back, carrying clean-white pressure-shell facets, plus the scene's only opaque Luxembourg-palette knee socks ending below both kneecaps",
      "Ellie wears a secure strapless ice-blue submersible top showing a narrow ordinary midriff over slate-charcoal tailored upper-thigh shorts, closed back, with steel-silver porthole rings",
      "Alia wears a forest-emerald sleeveless upper-thigh submersible mini with covered waist and closed back, carrying sandstone-gold ballast ribs",
      "ECE wears a Moselle-teal sleeveless asymmetric submersible top showing a narrow ordinary midriff with a secure front and complete open back to the secure waist, no crossing straps, over a steel-silver upper-thigh skort with cool bioluminescent piping",
      "the established bearded adult man wears an opaque clean-white short-sleeve top, tailored above-knee slate-charcoal shorts and complete black shoes",
    ],
    choreography: "Alia stands fully isolated at far right and uses both hands only on the inert mission prop. The man occupies a separate athletics bay at the fixed beacon mast. Radiance stands beside PAWS's protected lounge with open visible hands; Ellie and ECE remain in separate depth lanes. The stored lift-assist and embrace have already ended. There is no human contact and no hidden hand.",
    weatherSafety: "Soft overcast light keeps the dry pavilion, faces, lake, dam, beacon mast, target and complete backstop evenly readable.",
  },
  {
    scene: 1575,
    layout: "theme-led original",
    locationName: "Schiessentumpel waterfall and Black Ernz",
    location: "a broad dry protected overlook beside the complete Schiessentumpel triple waterfall on the Black Ernz at clear golden hour, with the small sandstone bridge, three separate cascade streams, mossy boulders, layered sandstone formations, beech canopy and forest path recognizable",
    countryMotifs: "the landmark remains the Luxembourg read while all four looks use distinct deep-sea pressure-shell, porthole, bathymetric, bioluminescent, ballast and manipulator-joint structures",
    target: "one plain non-humanoid paper route symbol on a complete thick earth-and-sand backstop behind a transparent safety panel on an isolated dry lane away from the stream, waterfall and hiking path",
    wardrobes: [
      "Radiance wears a sandstone-gold sleeveless upper-thigh submersible mini with covered waist and complete open back to the secure waist, no crossing straps, carrying clean-white porthole rings",
      "Ellie wears a forest-emerald sleeveless upper-thigh skort look with covered waist and complete open back to the secure waist, no crossing straps, with lake-cobalt pressure facets",
      "Alia wears a secure strapless lake-cobalt submersible top showing a narrow ordinary midriff and complete open back to the secure waist over clean-white tailored upper-thigh shorts, with sandstone bathymetric lines",
      "ECE wears a Grand-Duchy-red sleeveless submersible top showing a narrow ordinary midriff over a steel-silver upper-thigh skort, closed back, with cool bioluminescent seams, plus the scene's only opaque Luxembourg-palette knee socks ending below both kneecaps",
    ],
    choreography: "Alia stands fully isolated at far right and uses both hands only on the inert mission prop. ECE occupies a separate athletics bay at the fixed beacon mast. Radiance and Ellie remain in separate depth lanes with open visible hands. The stored slow-dance chain has already ended and is now expressed only through eye lines. There is no human contact and no hidden hand.",
    weatherSafety: "Golden-hour light keeps the dry overlook, faces, waterfall, beacon mast, target and complete backstop clear while every public path remains outside the lane.",
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
  if (scene === 1572) return "a heavy rain curtain beyond a fully dry covered bridge overlook";
  if (scene === 1573) return "an active lightning storm kept distant beyond the covered Belval terrace";
  if (scene === 1574) return "soft dramatic overcast above a fully dry lake pavilion";
  return "clear golden-hour radiance at a fully dry protected waterfall overlook";
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
  if (scene === 1572) return "Exactly PAWS the tiny golden kitten and MAX the young golden-retriever pup rest together on one dry padded lounge in Alia's protected bay, outside every prop and mission lane; no adult hand is reassigned.";
  if (scene === 1574) return "Exactly PAWS rests on one dry padded lounge in Radiance's protected bay, outside every pole, prop and mission lane; no adult hand is reassigned and no dog appears.";
  return "Neither mascot appears.";
};

const oddPropLine = (scene, plan) => {
  if (scene === 1573) return "The active odd prop is Ellie's deactivated chainless cinema-chainsaw sculpture with its blade cover locked, fully enclosed inside a fixed sealed transparent display. Ellie touches only the exterior enclosure frame; nobody touches the sculpture.";
  return "The odd-prop roll is inactive; no odd prop appears.";
};

const poleLine = (scene, plan) => {
  if (scene === 1574) return "The pole roll is active as public-safe adult athletics: the man alone performs one simple upright two-hand static hold at a fixed beacon mast with both feet planted, fully clothed and non-explicit, in a separate bay from PAWS and the mission lane.";
  if (scene === 1575) return "The pole roll is active as public-safe adult athletics: ECE alone performs one simple upright two-hand static hold at a fixed beacon mast with both feet planted, fully clothed and non-explicit, in a separate bay from the mission lane.";
  return "The pole roll is inactive; no pole appears.";
};

const missionLine = (plan) => {
  const direction = `The muzzle points horizontally away from every person, mascot, landmark, occupied object and camera toward ${plan.target}.`;
  if (plan.mission.category === "open-mechanism paper-target inspection") {
    return `${plan.mission.handler} alone handles one full-size polished rainbow-gradient large-frame inert cinema-training replica in an isolated two-hand inspection stance. One hand supports the grip from below; the other stabilizes the upper frame with its index straight outside the empty guard. The inert mechanism is visibly locked open. ${direction} No ammunition, firing, flash, threat, injury, combat or unsafe aim.`;
  }
  if (plan.mission.category === "completed handoff to open-water marker") {
    return `The rolled handoff is complete and noncontact. ${plan.mission.handler} alone now retains one full-size polished rainbow-gradient large-frame inert cinema-training replica in an isolated side-on two-hand stance. Both hands stay on the grip; one index is straight on the upper frame outside the empty guard. ${direction} No ammunition, firing, flash, threat, injury, combat or unsafe aim.`;
  }
  return `${plan.mission.handler} alone handles one full-size polished rainbow-gradient large-frame inert cinema-training replica in an isolated side-on two-hand stance. Both hands stay on the grip; one index is straight on the upper frame outside the empty guard. ${direction} No ammunition, firing, flash, threat, injury, combat or unsafe aim.`;
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
  return [
    "Create one fresh photorealistic 9:16 full-length Starlight World Series public-fashion image.",
    `${reference} Use these original identity references only, never an earlier country render. ${cast} Preserve distinct anchored adult faces and skin tones; no clone, merge, extra person or age shift.`,
    `Scene: ${plan.location}. Deep-sea submersible couture is fictional public fashion at this real Luxembourg location: pressure-shell facets, porthole rings, bathymetric lines, cool bioluminescent piping, ballast geometry and manipulator-joint seams. Nobody is underwater or inside a vehicle. ${plan.layout === "country-led hybrid" ? `Country-led hybrid: two or three looks carry ${plan.countryMotifs}; at least two also carry deep-sea construction.` : `Theme-led original: ${plan.countryMotifs}.`} No literal Luxembourg flag, red lion, coat of arms, crown, official emblem or sacred symbol, religious architecture, copied ceremonial dress or uniform, badge, logo, text or watermark.`,
    `Permanent short foundation: four distinct secure opaque lined upper-thigh women's looks with full public-safe coverage. ${plan.wardrobes.join("; ")}. No long panels, trousers, leggings, jumpsuits, lower hems, sheer coverage or accidental exposure.`,
    `${mascotLine(plan.scene, plan)} ${oddPropLine(plan.scene, plan)} ${poleLine(plan.scene, plan)} The rainbow-only roll is inactive. ${plan.hosiery.active ? `Rainbow hosiery is active: ${plan.hosiery.wearer.result} alone wears the specified ${plan.hosiery.palette.result}; nobody else wears hosiery.` : "Rainbow hosiery is inactive; nobody wears stockings or knee socks."}`,
    `Anatomy-first relationship: ${plan.choreography} Emotions: ${emotionLine(plan)}.${maleEmotionText} This simple topology is the bounded resolution of the stored movement rolls; never add a hidden hand.`,
    missionLine(plan),
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
    "assets/lore/starlight-era/batch-387-bhutan-deep-sea-submersible-checkpoint.json#/nextQueue",
    "assets/lore/starlight-era/batch-316-bhutan-recovery-checkpoint.json#/nextQueueCountry",
    "assets/lore/starlight-era/world-195x4-campaign.json#/countryPriorityOrder/162",
  ],
  themeEvidence: [
    "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json#/cinematicThemeRotation/orderedThemes/7",
    "assets/lore/starlight-era/batch-387-bhutan-deep-sea-submersible-checkpoint.json#/nextQueue/cinematicTheme",
  ],
  notGuessed: true,
};
const countryMotifPolicy = {
  flagMotifDecision: historical.countryMotifPolicy.flagMotifDecision,
  palette: historical.countryMotifPolicy.palette,
  minimumCoverage: "Scenes 1572 and 1573 each foreground large Luxembourg motif fields on two or three looks and deep-sea construction on at least two. Scenes 1574 and 1575 use four distinct theme-led looks while the Luxembourg landmark remains equally foregrounded.",
  cultureScene: historical.countryMotifPolicy.cultureScene,
  prohibitions: historical.countryMotifPolicy.prohibitions,
};
const expectedPredecessorQueue = {
  nextCountry: "Luxembourg",
  nextBatch: 388,
  sceneNumbers: [1572, 1573, 1574, 1575],
  cinematicTheme: "deep-sea submersible couture",
  themePairPosition: 2,
};
for (const [field, expected] of Object.entries(expectedPredecessorQueue)) {
  if (JSON.stringify(predecessor.nextQueue?.[field]) !== JSON.stringify(expected)) {
    throw new Error(`Bhutan nextQueue conflict at ${field}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(predecessor.nextQueue?.[field])}`);
  }
}
const predecessorClosed = predecessor.hardSafeAcceptedCount === 4
  && Array.isArray(predecessor.missingSceneNumbers)
  && predecessor.missingSceneNumbers.length === 0;
const predecessorRemoteCheckpointSha256 = sha256(predecessorRemoteBytes);
const predecessorRemoteVerified =
  predecessorRemoteCheckpointSha256 === sha256(predecessorBytes);
const predecessorGate = {
  checkpointPath: path.relative(process.cwd(), predecessorPath).replaceAll("\\", "/"),
  checkpointSha256: sha256(predecessorBytes),
  observedStatus: predecessor.status,
  observedHardSafeAcceptedCount: predecessor.hardSafeAcceptedCount,
  observedMissingSceneNumbers: predecessor.missingSceneNumbers,
  authoritativeNextQueueMatches: true,
  predecessorClosed,
  remoteRef: predecessorRemoteRef,
  remoteCommit: predecessorRemoteCommit,
  remoteCheckpointSha256: predecessorRemoteCheckpointSha256,
  predecessorRemoteVerified,
  requiredRemoteCommit: "f9b1f6b5cad8382b4ee934d8dcf972038d4add97",
  requiredRemoteCommitMatches: predecessorRemoteCommit === "f9b1f6b5cad8382b4ee934d8dcf972038d4add97",
  preparationOnly: true,
  batch388RenderAuthorized: predecessorClosed && predecessorRemoteVerified
    && predecessorRemoteCommit === "f9b1f6b5cad8382b4ee934d8dcf972038d4add97",
  note: "This materialization records no render, publication, commit, push, or X-ledger change.",
  reason: predecessorClosed && predecessorRemoteVerified
    && predecessorRemoteCommit === "f9b1f6b5cad8382b4ee934d8dcf972038d4add97"
    ? "Batch 387 is closed at four of four and remote-verified at the required commit; exactly four concurrent Batch 388 pass-1 slots are prepared but not launched."
    : "Batch 387 is not closed and remote-verified at the required commit; Batch 388 remains queue-locked.",
};
const predecessorReady = predecessorGate.batch388RenderAuthorized;
const policy = {
  contractSection: "rapidConsolidatedRenderPolicy.boundedFoundationPassPolicy",
  passCeiling: 2,
  pass1CandidatesPrepared: 4,
  pass1CandidatesAuthorized: predecessorReady ? 4 : 0,
  pass1CandidatesConsumed: 0,
  pass2CandidatesConsumed: 0,
  automaticThirdPassAllowed: false,
  authorizationCondition: predecessorReady
    ? "Exactly four concurrent pass-1 candidates, one per scene, may be launched in a separate later action."
    : "Batch 387 must first close and be remote-verified at the required commit; this preparation artifact grants no render authority.",
};
const nextQueue = {
  nextCountry: "Suriname",
  nextBatch: 389,
  sceneNumbers: [1576, 1577, 1578, 1579],
  cinematicTheme: "polar airship couture",
  themePairPosition: 1,
  countryEvidence: [
    "assets/lore/starlight-era/batch-317-luxembourg-recovery-checkpoint.json#/nextQueueCountry",
    "assets/lore/starlight-era/world-195x4-campaign.json#/countryPriorityOrder/163",
  ],
  themeEvidence: [
    "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json#/cinematicThemeRotation/orderedThemes/8",
  ],
  lockedUntilBatch388Closed: true,
};
const xCaption = "Luxembourg \u{1F90D} Bhutan #Luxembourg #WorldXXXSeries";

const preflight = {
  batch,
  country,
  status: predecessorReady
    ? "render-preflight-stored-pass-1-not-launched"
    : "queued-prepared-render-locked-until-batch387-closure",
  sourceCommit,
  contractSha256,
  policy,
  queueResolution,
  predecessorGate,
  rollMethod: "FNV-1a over recorded batch388-luxembourg keys, reduced modulo 100; male scene selection uses the full 32-bit hash modulo 4. Duplicate emotion labels use one stored deterministic disambiguation roll.",
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
    active: "deep-sea submersible couture",
    batchOrdinalWithinTheme: 2,
    totalBatchesAtTheme: 2,
    sceneModes: ["country-led hybrid", "country-led hybrid", "theme-led original", "theme-led original"],
  },
  sceneNumbers: [1572, 1573, 1574, 1575],
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
    eligibility: "ineligible until four of four Luxembourg scenes are hard-safe accepted and the checkpoint is pushed and remote-verified",
  },
  nextQueue,
};

const preflightPath = path.join(root, "batch-388-luxembourg-preflight.json");
const preflightText = `${JSON.stringify(preflight, null, 2)}\n`;
fs.writeFileSync(preflightPath, preflightText, "utf8");
const preflightBytes = Buffer.from(preflightText, "utf8");

const checkpoint = {
  batch,
  country,
  status: predecessorReady
    ? "active-pass-1-ready-not-launched"
    : "queued-prepared-render-locked-until-batch387-closure",
  sourceCommit,
  contractSha256,
  policy,
  queueResolution,
  predecessorGate,
  rollMethod: preflight.rollMethod,
  cinematicTheme: "deep-sea submersible couture",
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
      status: predecessorReady
        ? "ready-exactly-four-concurrent-clean-candidates"
        : "prepared-locked-until-batch387-closure",
      allocation: { A: 1572, B: 1573, C: 1574, D: 1575 },
      candidatesPrepared: 4,
      candidatesAuthorized: predecessorReady ? 4 : 0,
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
  missingSceneNumbers: [1572, 1573, 1574, 1575],
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
