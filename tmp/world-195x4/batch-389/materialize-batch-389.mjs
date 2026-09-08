import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const batch = 389;
const country = "Suriname";
const countrySlug = "suriname";
const firstScene = 1576;
const root = path.resolve("tmp/world-195x4/batch-389");
const checkpointPath = path.resolve(
  "assets/lore/starlight-era/batch-389-suriname-polar-airship-checkpoint.json",
);
const contractPath = path.resolve(
  "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json",
);
const historicalPath = path.resolve(
  "assets/lore/starlight-era/batch-318-suriname-recovery-checkpoint.json",
);
const contractBytes = fs.readFileSync(contractPath);
const contract = JSON.parse(contractBytes.toString("utf8"));
const historical = JSON.parse(fs.readFileSync(historicalPath, "utf8"));
const predecessorPath = path.resolve(
  "assets/lore/starlight-era/batch-388-luxembourg-deep-sea-submersible-checkpoint.json",
);
const predecessorBytes = fs.readFileSync(predecessorPath);
const predecessor = JSON.parse(predecessorBytes.toString("utf8"));
const predecessorGitPath = "assets/lore/starlight-era/batch-388-luxembourg-deep-sea-submersible-checkpoint.json";
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
const EXPECTED_PRIMARY_COUNT = 110;
const EXPECTED_PRIMARY_SHA256 = "3F639FEC72774DAB16E26CBEABD3C279C8986396413579CBA31A74F95EE980AE";
const EXPECTED_SELECTOR_COUNT = 20;
const EXPECTED_SELECTOR_SHA256 = "2C90D1F7A03A4C17CAF6A8437CFD8EC9D2D1BB17B1155E30818446163676FAB3";

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
    scene: 1576,
    layout: "country-led hybrid",
    locationName: "Paramaribo Waterkant and Jules Wijdenbosch Bridge",
    location: "a broad dry covered riverfront pavilion on Paramaribo's Waterkant, with the complete high arc of the Jules Wijdenbosch Bridge over the Suriname River, secular wooden waterfront facades, a broad quay, rain trees, and riverboats secured far away while silent heat lightning remains on the horizon",
    countryMotifs: "large secular Jules-Wijdenbosch-Bridge arc, Suriname-River current, Waterkant-quay, wooden-shutter, riverboat, rain-tree, cassava-leaf and market-fruit fields",
    target: "one plain non-humanoid paper route symbol on a complete thick earth-and-sand backstop behind a transparent safety panel on an isolated dry lane away from the river, bridge traffic and public quay",
    wardrobes: [
      "Radiance wears a clay-red sleeveless cropped airship bodice showing a narrow ordinary midriff with a complete open back to the secure waist over a rice-white upper-thigh skort carrying bridge-arch and gondola geometry",
      "Ellie wears a rainforest-emerald short-sleeve upper-thigh airship mini with covered waist and closed back, carrying Waterkant shutters and pressure-envelope ribbing",
      "Alia wears a Suriname-river-blue high-neck sleeveless upper-thigh tailored romper with covered waist and closed back, carrying quay and brass-navigation-ring fields",
      "ECE wears a sea-turtle-teal one-shoulder cropped airship top showing a narrow ordinary midriff with a complete open back to the secure waist over a granite-silver upper-thigh skort with aurora piping, plus the scene's only opaque original-rainbow knee socks ending below both kneecaps",
    ],
    choreography: "Alia stands fully isolated at far right and uses both hands only on the inert mission prop. Radiance stands beside the protected mascot lounge with both hands open and visible. ECE occupies a separate bay beside the secured odd-prop enclosure, with one hand on its exterior frame and her other hand open. Ellie holds a separated finished-turn pose. There is no human contact and no hidden hand.",
    weatherSafety: "Silent heat lightning stays beyond the pavilion; dry footing, faces, bridge, target and complete backstop remain bright and readable.",
  },
  {
    scene: 1577,
    layout: "country-led hybrid",
    locationName: "Brownsberg and Brokopondo Reservoir",
    location: "a broad dry covered panoramic platform on Brownsberg overlooking the complete Brokopondo Reservoir at clear golden hour, with the vast reservoir, rainforest islands, red-earth ridge, layered Guiana Shield hills, distant treetops and one clearly empty marked water route",
    countryMotifs: "large secular Brokopondo-reservoir, Brownsberg-ridge, rainforest-island, red-earth-road, howler-monkey silhouette, tropical-bird wing and water-route fields",
    target: "one plain non-humanoid paper route symbol on a complete thick earth-and-sand backstop behind a transparent safety panel on an isolated dry lane away from the reservoir, wildlife and public trail",
    wardrobes: [
      "Radiance wears a golden-yellow cap-sleeve cropped airship jacket showing a narrow ordinary midriff over rainforest-emerald upper-thigh shorts, closed back, with reservoir and gondola-panel fields",
      "Ellie wears a secure strapless Suriname-river-blue cropped airship bodice showing a narrow ordinary midriff with a complete open back to the secure waist over a rice-white upper-thigh skort with brass navigation rings",
      "Alia wears a bromeliad-magenta sleeveless upper-thigh airship mini with covered waist and closed back, carrying rainforest-island and pressure-envelope fields",
      "ECE wears a secure strapless granite-silver upper-thigh airship mini with covered waist and closed back, carrying red-earth ridge and aurora-piping fields",
    ],
    choreography: "ECE stands fully isolated at far right and uses both hands only on the inert mission prop. Ellie stands beside the protected mascot lounge with both hands open and visible. Radiance and Alia remain in separate depth lanes with open visible hands. The stored relationship motion is resolved as noncontact eye lines after the movement has ended. There is no human contact and no hidden hand.",
    weatherSafety: "Golden-hour light keeps the dry platform, faces, reservoir, target and complete backstop evenly readable.",
  },
  {
    scene: 1578,
    layout: "theme-led original",
    locationName: "Voltzberg and Raleigh Falls",
    location: "a broad dry covered conservation overlook in the Central Suriname Nature Reserve during coastal sea mist, with the complete rounded granite Voltzberg dome above primary rainforest, Raleigh Falls on the Coppename River, layered canopy, distant macaws and one empty river route",
    countryMotifs: "the landmark remains the Suriname read while all four women's looks use distinct polar-airship pressure-envelope ribs, gondola panels, brass navigation rings, mooring geometry, cloud-silver surfaces and aurora piping",
    target: "one plain non-humanoid paper route symbol on a complete thick earth-and-sand backstop behind a transparent safety panel on an isolated dry lane away from the river, wildlife and conservation route",
    wardrobes: [
      "Radiance wears a night-charcoal high-neck sleeveless upper-thigh airship mini with covered waist and closed back, carrying granite-dome and pressure-envelope fields",
      "Ellie wears a secure strapless rainforest-emerald upper-thigh airship mini with covered waist and closed back, carrying Coppename-water and brass-navigation-ring fields",
      "Alia wears a secure strapless golden-yellow upper-thigh tailored romper with covered waist and closed back, carrying Raleigh-Falls and gondola-panel fields",
      "ECE wears a secure strapless sea-turtle-teal upper-thigh airship mini with covered waist and a complete open back to the secure waist, carrying cloud-silver mooring geometry and aurora piping",
    ],
    choreography: "ECE stands fully isolated at far right and uses both hands only on the inert mission prop. Alia stands beside the protected mascot lounge and secured odd-prop enclosure, with one hand on the enclosure exterior and her other hand open. Radiance and Ellie remain in separate depth lanes with open visible hands. There is no human contact and no hidden hand.",
    weatherSafety: "Sea mist remains beyond the covered overlook; dry footing, faces, Voltzberg, Raleigh Falls, target and complete backstop remain clear.",
  },
  {
    scene: 1579,
    layout: "theme-led original",
    locationName: "Galibi coast and Marowijne River mouth",
    location: "a broad dry covered conservation boardwalk at Galibi while distant lightning stays over the Atlantic, with the complete shoreline, Marowijne River mouth, mangrove fringe, beach-morning-glory vines, protected leatherback tracks, faraway sea turtles and one clearly empty marked ocean route",
    countryMotifs: "the landmark remains the Suriname read while all four looks use distinct polar-airship pressure-envelope ribs, gondola panels, brass navigation rings, mooring geometry, cloud-silver surfaces and aurora piping",
    target: "one plain non-humanoid paper route symbol on a complete thick earth-and-sand backstop behind a transparent safety panel on an isolated dry lane away from the ocean, turtles, tracks, nests and public boardwalk",
    wardrobes: [
      "Radiance wears a clay-red short-sleeve upper-thigh airship mini with covered waist and closed back, carrying Atlantic-wave and cloud-silver envelope fields",
      "Ellie wears a rainforest-emerald high-neck sleeveless upper-thigh skort look with covered waist and closed back, carrying Marowijne-current and brass-navigation-ring fields",
      "Alia wears a bromeliad-magenta one-shoulder cropped airship bodice showing a narrow ordinary midriff with a complete open back to the secure waist over night-charcoal upper-thigh shorts carrying turtle-track and gondola geometry",
      "ECE wears a Suriname-river-blue sleeveless cropped airship top showing a narrow ordinary midriff over a granite-silver upper-thigh skort, closed back, with mangrove-root and aurora-piping fields",
      "the established bearded adult man wears an opaque rice-white short-sleeve airship-panel top, tailored above-knee night-charcoal shorts and complete black shoes",
    ],
    choreography: "ECE stands fully isolated at far right and uses both hands only on the inert mission prop. Alia stands beside MAX's protected lounge with both hands open and visible. Radiance occupies a separate bay beside the secured odd-prop enclosure, with one hand on its exterior frame and her other hand open. Ellie and the man hold separate finished-turn poses with open visible hands. There is no human contact and no hidden hand.",
    weatherSafety: "Distant lightning stays beyond the covered boardwalk; dry footing, faces, coast, target and complete backstop remain clear while wildlife and public paths stay outside the lane.",
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
  if (scene === 1576) return "silent heat lightning on the horizon beyond a fully dry covered riverfront pavilion";
  if (scene === 1577) return "clear golden-hour radiance at a fully dry covered reservoir platform";
  if (scene === 1578) return "coastal sea mist beyond a fully dry covered conservation overlook";
  return "active lightning with distant bolts beyond a fully dry covered coastal boardwalk";
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
  if (plan.mascotState.result === "PAWS and MAX together") return `Exactly PAWS the tiny collarless golden kitten and MAX the young golden-retriever pup rest together on one dry padded lounge in ${plan.mascotHolder.result}'s protected bay, outside every odd-prop and mission lane; no adult hand is reassigned.`;
  if (plan.mascotState.result === "PAWS only") return `Exactly PAWS rests on one dry padded lounge in ${plan.mascotHolder.result}'s protected bay, outside every odd-prop and mission lane; no adult hand is reassigned and no dog appears.`;
  if (plan.mascotState.result === "MAX only") return `Exactly MAX the young golden-retriever pup rests on one dry padded lounge in ${plan.mascotHolder.result}'s protected bay, outside every odd-prop and mission lane; no adult hand is reassigned and no kitten appears.`;
  return "Neither mascot appears.";
};

const oddPropLine = (scene, plan) => {
  if (plan.oddProp.active) return `The active odd prop is ${plan.oddProp.holder.result}'s ${plan.oddProp.family.result}, fully enclosed inside a fixed sealed transparent display. ${plan.oddProp.holder.result} touches only the exterior enclosure frame with one hand; nobody touches the prop and every mascot remains in a separate protected bay.`;
  return "The odd-prop roll is inactive; no odd prop appears.";
};

const poleLine = (scene, plan) => {
  if (plan.pole.active) return "The pole roll is active only as public-safe adult athletics: one non-handler adult performs one simple upright two-hand static hold at a fixed beacon mast with both feet planted, fully clothed and non-explicit, in a separate bay from every mascot, odd prop and mission lane.";
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
    `Scene: ${plan.location}. Polar airship couture is fictional public fashion at this real Suriname location: pressure-envelope ribs, gondola panels, brass navigation rings, mooring geometry, cloud-silver surfaces and aurora piping. Nobody is flying or inside a vehicle. ${plan.layout === "country-led hybrid" ? `Country-led hybrid: two or three looks carry ${plan.countryMotifs}; at least two also carry polar-airship construction.` : `Theme-led original: ${plan.countryMotifs}.`} No literal Suriname flag, central star, coat of arms, official emblem or sacred symbol, religious architecture, copied Indigenous or Maroon ceremonial pattern, copied ceremonial dress or uniform, badge, logo, text or watermark.`,
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
    "assets/lore/starlight-era/batch-388-luxembourg-deep-sea-submersible-checkpoint.json#/nextQueue",
    "assets/lore/starlight-era/batch-317-luxembourg-recovery-checkpoint.json#/nextQueueCountry",
    "assets/lore/starlight-era/world-195x4-campaign.json#/countryPriorityOrder/163",
  ],
  themeEvidence: [
    "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json#/cinematicThemeRotation/orderedThemes/8",
    "assets/lore/starlight-era/batch-388-luxembourg-deep-sea-submersible-checkpoint.json#/nextQueue/cinematicTheme",
  ],
  notGuessed: true,
};
const countryMotifPolicy = {
  flagMotifDecision: historical.countryMotifPolicy.flagMotifDecision,
  palette: historical.countryMotifPolicy.palette,
  minimumCoverage: "Scenes 1576 and 1577 each foreground large Suriname motif fields on two or three looks and polar-airship construction on at least two. Scenes 1578 and 1579 use four distinct theme-led looks while the Suriname landmark remains equally foregrounded.",
  cultureScene: historical.countryMotifPolicy.cultureScene,
  prohibitions: historical.countryMotifPolicy.prohibitions,
};
const expectedPredecessorQueue = {
  nextCountry: "Suriname",
  nextBatch: 389,
  sceneNumbers: [1576, 1577, 1578, 1579],
  cinematicTheme: "polar airship couture",
  themePairPosition: 1,
};
for (const [field, expected] of Object.entries(expectedPredecessorQueue)) {
  if (JSON.stringify(predecessor.nextQueue?.[field]) !== JSON.stringify(expected)) {
    throw new Error(`Luxembourg nextQueue conflict at ${field}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(predecessor.nextQueue?.[field])}`);
  }
}
const predecessorClosed = predecessor.status === "closed-three-of-four-after-cap-no-more-luxembourg-rendering"
  && predecessor.hardSafeAcceptedCount === 3
  && JSON.stringify(predecessor.missingSceneNumbers) === JSON.stringify([1575])
  && predecessor.renderPasses?.pass2?.thirdPassAllowed === false;
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
  requiredRemoteCommit: "51019e0a68150287ce0b2d0e943eeb5de83551d1",
  requiredRemoteCommitMatches: predecessorRemoteCommit === "51019e0a68150287ce0b2d0e943eeb5de83551d1",
  preparationOnly: true,
  batch389RenderAuthorized: predecessorClosed && predecessorRemoteVerified
    && predecessorRemoteCommit === "51019e0a68150287ce0b2d0e943eeb5de83551d1",
  note: "This materialization records no render, publication, commit, push, or X-ledger change.",
  reason: predecessorClosed && predecessorRemoteVerified
    && predecessorRemoteCommit === "51019e0a68150287ce0b2d0e943eeb5de83551d1"
    ? "Batch 388 is closed at three of four after the two-pass cap and remote-verified at the required commit; exactly four concurrent Batch 389 pass-1 slots are prepared but not launched."
    : "Batch 388 is not cap-closed and remote-verified at the required commit; Batch 389 remains queue-locked.",
};
const predecessorReady = predecessorGate.batch389RenderAuthorized;
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
    : "Batch 388 must first cap-close and be remote-verified at the required commit; this preparation artifact grants no render authority.",
};
const nextQueue = {
  nextCountry: "Montenegro",
  nextBatch: 390,
  sceneNumbers: [1580, 1581, 1582, 1583],
  cinematicTheme: "polar airship couture",
  themePairPosition: 2,
  countryEvidence: [
    "assets/lore/starlight-era/batch-318-suriname-recovery-checkpoint.json#/nextQueueCountry",
    "assets/lore/starlight-era/world-195x4-campaign.json#/countryPriorityOrder/164",
  ],
  themeEvidence: [
    "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json#/cinematicThemeRotation/orderedThemes/8",
  ],
  lockedUntilBatch389Closed: true,
};
const xCaption = "Suriname \u{2764}\u{FE0F} Luxembourg #Suriname";

const preflight = {
  batch,
  country,
  status: predecessorReady
    ? "render-preflight-stored-pass-1-not-launched"
    : "queued-prepared-render-locked-until-batch388-closure",
  sourceCommit,
  contractSha256,
  policy,
  queueResolution,
  predecessorGate,
  rollMethod: "FNV-1a over recorded batch389-suriname keys, reduced modulo 100; male scene selection uses the full 32-bit hash modulo 4. Duplicate emotion labels use one stored deterministic disambiguation roll.",
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
    active: "polar airship couture",
    batchOrdinalWithinTheme: 1,
    totalBatchesAtTheme: 2,
    sceneModes: ["country-led hybrid", "country-led hybrid", "theme-led original", "theme-led original"],
  },
  sceneNumbers: [1576, 1577, 1578, 1579],
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
    eligibility: "ineligible until four of four Suriname scenes are hard-safe accepted and the checkpoint is pushed and remote-verified",
  },
  nextQueue,
};

const preflightPath = path.join(root, "batch-389-suriname-preflight.json");
const preflightText = `${JSON.stringify(preflight, null, 2)}\n`;
fs.writeFileSync(preflightPath, preflightText, "utf8");
const preflightBytes = Buffer.from(preflightText, "utf8");

const checkpoint = {
  batch,
  country,
  status: predecessorReady
    ? "active-pass-1-ready-not-launched"
    : "queued-prepared-render-locked-until-batch388-closure",
  sourceCommit,
  contractSha256,
  policy,
  queueResolution,
  predecessorGate,
  rollMethod: preflight.rollMethod,
  cinematicTheme: "polar airship couture",
  themePairPosition: 1,
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
        : "prepared-locked-until-batch388-closure",
      allocation: { A: 1576, B: 1577, C: 1578, D: 1579 },
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
  missingSceneNumbers: [1576, 1577, 1578, 1579],
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
