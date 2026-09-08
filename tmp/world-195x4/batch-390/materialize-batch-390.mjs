#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const batch = 390;
const country = "Montenegro";
const countrySlug = "montenegro";
const firstScene = 1580;
const root = path.resolve("tmp/world-195x4/batch-390");
const contractRelative = "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json";
const historicalRelative = "assets/lore/starlight-era/batch-319-montenegro-recovery-checkpoint.json";
const predecessorRelative = "assets/lore/starlight-era/batch-389-suriname-polar-airship-checkpoint.json";
const checkpointRelative = "assets/lore/starlight-era/batch-390-montenegro-polar-airship-checkpoint.json";
const preflightRelative = "tmp/world-195x4/batch-390/batch-390-montenegro-preflight.json";
const remoteRef = "origin/agent/starlight-progress-archive";
const expectedContractSha256 = "2FC50AFD166E489F9608633A2447A0EDB461BB1B1A11292BE1F1A1222FAEBFE0";
const expectedSourceCommit = "824dc0b5b64a706b4179a5a172695ae7af42c846";
const characters = ["Radiance", "Ellie", "Alia", "AI ECE"];
const razePairs = [
  ["Radiance", "Ellie"],
  ["Radiance", "Alia"],
  ["Radiance", "AI ECE"],
  ["Ellie", "Alia"],
  ["Ellie", "AI ECE"],
  ["Alia", "AI ECE"],
];

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex").toUpperCase();
const fnv1a = (value) => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
};
const roll = (key) => fnv1a(key) % 100;
const fromDistribution = (value, distribution, resultKey) => {
  for (const entry of distribution) {
    const [startText, endText = startText] = entry.range.split("-");
    if (value >= Number(startText) && value <= Number(endText)) return entry[resultKey];
  }
  throw new Error(`No ${resultKey} distribution entry for ${value}`);
};
const fileRecord = (relative) => {
  const bytes = fs.readFileSync(relative);
  return { file: relative, sha256: sha256(bytes), bytes: bytes.length };
};

const contractBytes = fs.readFileSync(contractRelative);
const contract = JSON.parse(contractBytes.toString("utf8"));
const contractSha256 = sha256(contractBytes);
if (contractSha256 !== expectedContractSha256) {
  throw new Error(`Contract changed: expected ${expectedContractSha256}, received ${contractSha256}`);
}
if (!contract.rapidConsolidatedRenderPolicy?.boundedFoundationPassPolicy?.active) {
  throw new Error("boundedFoundationPassPolicy must be active");
}
if (!contract.countryFashion?.shortHemFoundation?.active) {
  throw new Error("shortHemFoundation must be active");
}
if (!contract.razeFashionLine?.active || contract.razeFashionLine.activeFromBatch !== 390) {
  throw new Error("RAZE fashion capsule must be active from Batch 390");
}

const historical = JSON.parse(fs.readFileSync(historicalRelative, "utf8"));
const predecessorBytes = fs.readFileSync(predecessorRelative);
const predecessor = JSON.parse(predecessorBytes.toString("utf8"));
const remoteCommit = execFileSync("git", ["rev-parse", remoteRef], { encoding: "utf8" }).trim();
if (remoteCommit !== expectedSourceCommit) {
  throw new Error(`Remote source changed: expected ${expectedSourceCommit}, received ${remoteCommit}`);
}
const remotePredecessorBytes = execFileSync(
  "git",
  ["show", `${remoteRef}:${predecessorRelative}`],
  { encoding: null },
);
if (!remotePredecessorBytes.equals(predecessorBytes)) {
  throw new Error("Local predecessor checkpoint does not match the public remote branch");
}
if (predecessor.status !== "complete-four-of-four-hard-safe-meta-ai-pass-2-accepted-no-more-suriname-rendering") {
  throw new Error(`Suriname is not authoritatively closed: ${predecessor.status}`);
}
const expectedQueue = predecessor.nextQueue;
if (
  expectedQueue?.nextCountry !== country ||
  expectedQueue?.nextBatch !== batch ||
  JSON.stringify(expectedQueue?.sceneNumbers) !== JSON.stringify([1580, 1581, 1582, 1583]) ||
  expectedQueue?.cinematicTheme !== "polar airship couture" ||
  expectedQueue?.themePairPosition !== 2
) {
  throw new Error("Batch 389 nextQueue does not authorize Montenegro Batch 390");
}

const historicalPlans = Object.values(historical.scenePlans).sort((a, b) => a.scene - b.scene);
if (historicalPlans.length !== 4) throw new Error("Expected four historical Montenegro scene plans");

const silhouettes = [
  [
    { color: "Montenegro-red and limestone-white", form: "asymmetric upper-thigh airship skort dress", motif: "Durmitor limestone peaks and the Black Lake double basin", shoe: "low-vamp warm-gold pumps" },
    { color: "Durmitor-pine green", form: "tailored upper-thigh airship romper", motif: "black-pine forest, alpine meadow and pressure-envelope ribbing", shoe: "low-vamp limestone-white slingbacks" },
    { color: "Adriatic cobalt and night charcoal", form: "architectural bodice with upper-thigh tailored shorts", motif: "glacial-eye geometry, aurora ribbons and brass navigation rings", shoe: "low-vamp Tara-turquoise pumps" },
    { color: "Black-Lake teal and rain silver", form: "one-shoulder folded upper-thigh airship mini", motif: "empty-lake route, mountain contours and gondola-panel seams", shoe: "low-vamp Montenegro-red slingbacks" },
  ],
  [
    { color: "Adriatic cobalt", form: "sculpted upper-thigh airship mini", motif: "Kotor wall zigzags and Boka Bay axis", shoe: "low-vamp limestone-white pumps" },
    { color: "Montenegro red and limestone white", form: "architectural top with asymmetric upper-thigh skort", motif: "secular stone gates, harbor quays and airship envelope ribs", shoe: "low-vamp warm-gold slingbacks" },
    { color: "Durmitor-pine green", form: "tailored upper-thigh airship romper", motif: "terraced hillsides, limestone slopes and mooring geometry", shoe: "low-vamp Tara-turquoise pumps" },
    { color: "rain silver and Black-Lake teal", form: "folded-bodice upper-thigh airship mini", motif: "bay currents, cloud-silver gondola panels and brass route rings", shoe: "low-vamp Montenegro-red slingbacks" },
  ],
  [
    { color: "warm gold and Tara turquoise", form: "cropped airship vest with upper-thigh tailored shorts", motif: "the five-arch Djurdjevica bridge and Tara river ribbon", shoe: "low-vamp limestone-white pumps" },
    { color: "Montenegro red", form: "one-shoulder upper-thigh airship mini", motif: "limestone gorge walls, black-pine canopy and envelope ribs", shoe: "low-vamp warm-gold slingbacks" },
    { color: "Adriatic cobalt", form: "tailored upper-thigh airship romper", motif: "stone strata, contour lines and brass navigation rings", shoe: "low-vamp Tara-turquoise pumps" },
    { color: "night charcoal and rain silver", form: "corsage-formed top with upper-thigh skort", motif: "empty-river route, bridge arches and aurora piping", shoe: "low-vamp Montenegro-red slingbacks" },
  ],
  [
    { color: "Durmitor-pine green", form: "folded upper-thigh airship skort mini", motif: "Skadar Lake bend, water-lily fields and envelope seams", shoe: "low-vamp limestone-white pumps" },
    { color: "Black-Lake teal and Montenegro red", form: "architectural jacket with upper-thigh tailored shorts", motif: "Rijeka Crnojevica river ribbon, reed beds and gondola panels", shoe: "low-vamp warm-gold slingbacks" },
    { color: "warm gold", form: "sculpted upper-thigh airship mini", motif: "secular stone bridge, bicycle route and navigation rings", shoe: "low-vamp Tara-turquoise pumps" },
    { color: "Adriatic cobalt and rain silver", form: "asymmetric folded-bodice upper-thigh airship mini", motif: "empty-water route, karst contours and aurora piping", shoe: "low-vamp Montenegro-red slingbacks" },
  ],
];

const maleKey = `batch${batch}-${countrySlug}-male-model-scene`;
const maleHash = fnv1a(maleKey);
const malePosition = (maleHash % 4) + 1;
const maleScene = firstScene + malePosition - 1;

const makeOutfit = (idea, plan, sockWearer) => {
  const shoulder = plan.strapless.active ? "fully strapless with a secure high opaque bustline" : "sleeveless with bare arms";
  const waist = plan.visibleMidriff.active
    ? "built as a secure two-piece showing one narrow ordinary waist panel"
    : "with a fully covered waist";
  const back = plan.openBack.active
    ? "and a complete open upper back down to the secure waist"
    : "and a high closed back";
  const hosiery = sockWearer
    ? "wearing two opaque RAZE rainbow-gradient knee-high socks ending immediately below both kneecaps, with the exact readable RAZE wordmark at each outer upper band"
    : "with visibly bare lower legs and no socks, stockings, hosiery or leggings";
  return `${shoulder}, ${idea.color} ${idea.form}, ${waist}, ${back}, carrying a unique 1/1 print of ${idea.motif}, ${hosiery}, and ${idea.shoe}`;
};

const mascotClause = (state) => {
  if (state === "PAWS and MAX together") return "Exactly PAWS the tiny collarless golden kitten and MAX the young golden-retriever pup rest together on one dry padded lounge in a protected bay, far outside the prop lane; no adult hand is reassigned.";
  if (state === "PAWS only") return "Exactly PAWS the tiny collarless golden kitten rests on one dry padded lounge in a protected bay, far outside the prop lane; no adult hand is reassigned.";
  if (state === "MAX only") return "Exactly MAX the young golden-retriever pup rests on one dry padded lounge in a protected bay, far outside the prop lane; no adult hand is reassigned.";
  return "PAWS and MAX are inactive; no mascot appears.";
};

const plans = {};
const promptBank = [];
for (let index = 0; index < 4; index += 1) {
  const scene = firstScene + index;
  const historicalPlan = historicalPlans[index];
  const prefix = `batch${batch}-${countrySlug}-scene${scene}`;
  const key = (suffix) => `${prefix}-${suffix}`;
  const razeKey = `RAZE|batch-${batch}|scene-${scene}|knee-high-wearers`;
  const razeHash = fnv1a(razeKey);
  const razePairIndex = razeHash % razePairs.length;
  const sockWearers = razePairs[razePairIndex];
  const bareLegCharacters = characters.filter((character) => !sockWearers.includes(character));

  const weatherRoll = roll(key("weather"));
  const weather = fromDistribution(weatherRoll, contract.weatherRolls.distribution, "weather");
  const mascotRoll = roll(key("mascotState"));
  const mascotState = fromDistribution(mascotRoll, contract.mascotStateRoll.distribution, "state");
  const oddRoll = roll(key("interestingProp"));
  const oddActive = oddRoll <= 31;
  const oddFamily = contract.interestingPropRoll.orderedPropFamilies[
    fnv1a(key("interestingPropFamily")) % contract.interestingPropRoll.orderedPropFamilies.length
  ];
  const oddHolder = ["Radiance", "Ellie", "Alia"][fnv1a(key("interestingPropHolder")) % 3];
  const poleRoll = roll(key("poleDanceTheme"));
  const poleActive = poleRoll <= 5;
  const rainbowOnlyRoll = roll(key("rainbowOnly"));
  const rainbowOnlyActive = rainbowOnlyRoll <= 3;
  const romanceRoll = roll(key("romanceBeat"));
  const romanceBeat = contract.romance.dynamicBeatRolls[romanceRoll % contract.romance.dynamicBeatRolls.length];
  const compoundRoll = roll(key("compoundLoveBeat"));
  const compoundLoveBeat = contract.romance.compoundLoveBeatRolls[compoundRoll % contract.romance.compoundLoveBeatRolls.length];
  const hardLoveRoll = roll(key("hardLoveBeat"));
  const hardLoveBeat = fromDistribution(hardLoveRoll, contract.romance.hardLoveBeatRoll.distribution, "beat");

  const characterPlans = {};
  for (const character of characters) {
    const emotionRoll = roll(key(`${character}-emotion`));
    characterPlans[character] = {
      emotion: { key: key(`${character}-emotion`), roll: emotionRoll, result: fromDistribution(emotionRoll, contract.emotionRolls.distribution, "emotion") },
      visibleMidriff: { key: key(`${character}-visibleMidriff`), roll: roll(key(`${character}-visibleMidriff`)), active: roll(key(`${character}-visibleMidriff`)) <= 49 },
      strapless: { key: key(`${character}-straplessDress`), roll: roll(key(`${character}-straplessDress`)), active: roll(key(`${character}-straplessDress`)) <= 34 },
      openBack: { key: key(`${character}-fullyOpenBack`), roll: roll(key(`${character}-fullyOpenBack`)), active: roll(key(`${character}-fullyOpenBack`)) <= 29 },
    };
  }

  const outfits = {};
  characters.forEach((character, charIndex) => {
    outfits[character] = makeOutfit(silhouettes[index][charIndex], characterPlans[character], sockWearers.includes(character));
  });
  const malePresent = scene === maleScene;
  const maleClause = malePresent
    ? "Add the established clearly adult athletic bearded man as a fifth person without replacing a woman. He wears an opaque limestone-white short-sleeve airship-panel shirt, tailored night-charcoal above-knee shorts and complete black shoes; his strongest eye line returns to ECE."
    : "No male appears; show exactly the four women.";
  const oddClause = oddActive
    ? `The active odd prop is a ${oddFamily}, secured inside a fixed transparent display in ${oddHolder}'s separate bay; ${oddHolder} touches only the exterior frame with one hand and nobody touches the odd prop itself.`
    : "The odd-prop roll is inactive; no odd prop appears.";
  const poleClause = poleActive
    ? "One fixed public-fashion stage pole appears as a secured airship mooring mast in a separate dry bay; show only a stable finished editorial pose, never explicit choreography."
    : "The pole roll is inactive; no pole appears.";
  const rainbowOnlyClause = rainbowOnlyActive
    ? "The rainbow-only roll is active, but Montenegro motifs remain large and dominant while the four structural silhouettes stay distinct."
    : "The rainbow-only roll is inactive; do not replace Montenegro's palette or motifs with generic rainbow clothing.";
  const emotions = characters.map((character) => `${character}: ${characterPlans[character].emotion.result}`).join("; ");
  const outfitText = characters.map((character) => `${character}: ${outfits[character]}`).join("\n");
  const motifText = historicalPlan.motifs.join("; ");
  const target = index === 0
    ? "a complete thick earth-and-sand backstop behind a transparent safety panel on an isolated dry lane away from Black Lake and public trails"
    : index === 1
      ? "a clearly empty marked Boka Bay water route with a complete unoccupied safety marker, away from walls, quays, boats and people"
      : index === 2
        ? "a complete thick earth-and-sand backstop behind a transparent safety panel on an isolated dry lane away from the Tara River, bridge and forest"
        : "a clearly empty marked Skadar Lake water route with a complete unoccupied safety marker, away from wildlife, boats, reeds and people";

  const primary = `Create one fresh photorealistic 9:16 full-length Starlight World Series public-fashion editorial.\n\nUse original identity anchors only. Show exactly four fictional women visibly over 28: blonde Radiance, dark-haired Ellie, Black Alia with the only high sculptural braided ponytail, and brunette AI ECE. Preserve distinct adult faces and skin tones; no clone, merge, age shift or extra person. ${maleClause}\n\nScene: ${historicalPlan.landmark}. Weather treatment: ${weather}, kept cinematic while footing, faces, landmarks, target and complete endpoints remain dry, bright and readable. Polar airship couture is fictional public fashion at this real Montenegro location: pressure-envelope ribs, gondola panels, brass navigation rings, mooring geometry, cloud-silver surfaces and aurora piping. Nobody flies or enters a vehicle.\n\nRAZE nonprofit 1/1 fashion capsule: exactly ${sockWearers.join(" and ")} wear two opaque rainbow-gradient knee-high socks each, ending immediately below both kneecaps, with the exact readable word RAZE at every outer upper band. Exactly ${bareLegCharacters.join(" and ")} have visibly bare lower legs and no hosiery. Make all four socks prominent through separated front or three-quarter leg lanes and low-vamp shoes. Every garment print is a unique 1/1 layout. RAZE remains secondary to Montenegro: ${motifText}. No literal flag, coat of arms, double-headed eagle, crown, official seal, sacred symbol, religious building, copied ceremonial pattern, uniform, badge or other brand.\n\nFour distinct secure opaque lined upper-thigh looks with full bust, seat, pelvic and intimate coverage:\n${outfitText}\n\nPreserve the adult love beats as a simple open, stable, consensual public tableau: ${romanceBeat} Also preserve this stored compound beat as readable eye-line and gentle-contact continuity: ${compoundLoveBeat} The hard-love roll resolves without hidden hands as: ${hardLoveBeat}. Emotions: ${emotions}. Keep every contact gentle, public, non-explicit and anatomically traceable.\n\n${mascotClause(mascotState)} ${oddClause} ${poleClause} ${rainbowOnlyClause}\n\nAI ECE alone handles one polished rainbow-gradient large-frame Deagle-style inert cinema-training replica in a fully isolated safety bay. It is visibly nonfunctional, unloaded and harmless, with an open mechanism, empty guard and one straight index outside the guard. It points only downrange toward ${target}, away from every person, mascot, landmark, occupied object and camera. No ammunition, firing, flash, threat, injury, combat or unsafe aim.\n\nEye-level 50 mm full-body fashion composition. Render exactly two traceable arms and hands and two complete legs and feet per adult, separated silhouettes, visible joints, one role per hand and complete footwear. Keep every face, joint, hand, sock, bare lower leg, foot, mascot and complete safety endpoint in frame. No gross extra, missing, fused, borrowed, hidden-owner or impossible anatomy. Fully clothed public-safe editorial. No readable text except the exact RAZE sock wordmarks; no watermark.`;

  const fallback = `Generate a photorealistic vertical full-body adult fashion editorial at ${historicalPlan.landmark}. Show the four distinct fictional adult women Radiance, Ellie, Alia and ECE; ${malePresent ? "also include their established adult bearded male companion as a fifth person" : "no other person"}. Use four different secure opaque upper-thigh polar-airship couture silhouettes with large Montenegro landmark motifs and complete footwear.\n\nRAZE 1/1 capsule: only ${sockWearers.join(" and ")} wear matching pairs of vivid opaque rainbow knee-high socks ending below both knees, with the exact word RAZE on each upper band. ${bareLegCharacters.join(" and ")} have bare lower legs with no hosiery. Keep all socks, bare legs and low-vamp shoes prominent and unobstructed; every print layout is unique. Country motifs remain dominant.\n\nShow a warm, consensual adult love-square through one linked-hand pair, one gentle shoulder or waist touch and one readable rival eye line, with open separated arm paths and stable footing. ${mascotClause(mascotState)}\n\nECE alone stands in a separate safety bay beside a polished rainbow open-frame inert cinema calibration prop directed toward ${target}. It is nonfunctional and harmless; no weapon use, ammunition, firing, threat, injury, combat or person/animal/camera aim. Show every adult with two complete arms, hands, legs and feet, no gross anatomy defects, full opaque public coverage, no text except RAZE, and no watermark.`;

  const primaryFile = `tmp/world-195x4/batch-390/scene-${scene}-meta-pass-1-primary.txt`;
  const fallbackFile = `tmp/world-195x4/batch-390/scene-${scene}-meta-pass-1-fallback.txt`;
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(primaryFile, `${primary}\n`, "utf8");
  fs.writeFileSync(fallbackFile, `${fallback}\n`, "utf8");
  const promptRecord = {
    scene,
    primary: fileRecord(primaryFile),
    fallback: fileRecord(fallbackFile),
  };
  promptBank.push(promptRecord);
  plans[scene] = {
    scene,
    historicalSceneEvidence: `${historicalRelative}#/scenePlans/${historicalPlan.scene}`,
    location: historicalPlan.landmark,
    motifs: historicalPlan.motifs,
    culture: historicalPlan.culture,
    cinematicTheme: "polar airship couture",
    themePairPosition: 2,
    weather: { key: key("weather"), roll: weatherRoll, result: weather },
    mascotState: { key: key("mascotState"), roll: mascotRoll, result: mascotState },
    oddProp: { key: key("interestingProp"), roll: oddRoll, active: oddActive, holder: oddActive ? oddHolder : null, family: oddActive ? oddFamily : null },
    pole: { key: key("poleDanceTheme"), roll: poleRoll, active: poleActive },
    rainbowOnly: { key: key("rainbowOnly"), roll: rainbowOnlyRoll, active: rainbowOnlyActive },
    romance: { key: key("romanceBeat"), roll: romanceRoll, result: romanceBeat },
    compoundLove: { key: key("compoundLoveBeat"), roll: compoundRoll, result: compoundLoveBeat },
    hardLove: { key: key("hardLoveBeat"), roll: hardLoveRoll, result: hardLoveBeat },
    characterPlans,
    malePresent,
    raze: {
      key: razeKey,
      fullHash: razeHash,
      pairIndex: razePairIndex,
      sockWearers,
      bareLegCharacters,
      firstPhysicalItem: "opaque rainbow-gradient knee-high socks",
      exactWordmark: "RAZE",
    },
    outfits,
    missionProp: {
      handler: "AI ECE",
      description: "polished rainbow-gradient large-frame inert cinema-training replica",
      target,
      safe: true,
    },
    prompts: promptRecord,
  };
}

const sourceCommit = remoteCommit;
const common = {
  batch,
  country,
  sourceCommit,
  contractSha256,
  providerPolicy: {
    exclusiveImageProvider: "Meta AI",
    browserDrivenOnly: true,
    nonMetaFallbackAllowed: false,
    fourTabDispatch: "exactly four separate Meta AI tabs dispatched concurrently, one scene per tab",
  },
  queueResolution: {
    predecessor: predecessorRelative,
    predecessorCommit: "602a558a92cf3b6f246a2a3fb6b7d3d69be22f6c",
    predecessorStatus: predecessor.status,
    predecessorRemoteVerifiedAtSourceCommit: sourceCommit,
    nextQueueEvidence: `${predecessorRelative}#/nextQueue`,
  },
  rollMethod: "FNV-1a over recorded Batch 390 Montenegro keys. Ordinary rolls reduce modulo 100; male scene uses the full hash modulo 4; the RAZE pair uses the full hash modulo the six stored core-quartet pairs.",
  sceneNumbers: [1580, 1581, 1582, 1583],
  cinematicTheme: "polar airship couture",
  themePairPosition: 2,
  maleModelSelection: { key: maleKey, fullHash: maleHash, position: malePosition, scene: maleScene },
  razeFashionCapsule: {
    contractRef: `${contractRelative}#/razeFashionLine`,
    requiredEveryImage: true,
    perImageRule: "exactly two core women wear paired RAZE rainbow knee-high socks and exactly two core women have bare lower legs",
    wearerPairs: Object.values(plans).map((plan) => ({ scene: plan.scene, ...plan.raze })),
  },
  promptBank,
  scenePlans: plans,
};

const preflight = {
  ...common,
  status: "render-preflight-stored-meta-ai-pass-1-not-launched",
  createdAt: "2026-08-20T06:18:04.9031896Z",
  authorization: "Exactly four primary Meta AI prompts may be dispatched concurrently, one per scene. Each blocked primary may use its stored fallback once. No non-Meta provider is allowed.",
  rendersConsumed: 0,
  note: "This materialization records no render, publication, commit, push, or X action.",
};

const checkpoint = {
  ...common,
  status: "active-pass-1-meta-ai-only-prepared-not-launched",
  preflight: preflightRelative,
  policy: {
    passCeiling: 2,
    pass1CandidatesAuthorized: 4,
    pass1CandidatesConsumed: 0,
    pass2CandidatesAuthorized: "at most one per hard-unusable scene after pass-1 evidence is committed, pushed and remote-verified",
    pass2CandidatesConsumed: 0,
    thirdPassAllowed: false,
  },
  renderPasses: {
    pass1: {
      status: "prepared-not-launched",
      provider: "Meta AI",
      launchMode: "four-concurrent-browser-tabs-one-primary-per-scene",
      sceneNumbers: [1580, 1581, 1582, 1583],
      events: [],
    },
    pass2: { status: "not-open", eligibleScenes: [], events: [] },
  },
  rejectedPromptLedger: {
    status: "no-terminal-nonaccepted-events-before-launch",
    entries: [],
  },
  acceptedAssets: [],
  hardSafeAcceptedCount: 0,
  missingSceneNumbers: [1580, 1581, 1582, 1583],
  xPost: {
    status: "ineligible-until-four-current-country-assets-accepted",
    caption: "Montenegro 🤍 Suriname #Montenegro #WorldXXXSeries",
    url: null,
  },
  nextQueue: {
    nextCountry: "Malta",
    nextBatch: 391,
    sceneNumbers: [1584, 1585, 1586, 1587],
    cinematicTheme: "orbital research-station couture",
    themePairPosition: 1,
    countryEvidence: [
      `${historicalRelative}#/nextQueueCountry`,
      "assets/lore/starlight-era/world-195x4-campaign.json#/countryPriorityOrder/165",
    ],
    themeEvidence: [`${contractRelative}#/cinematicThemeRotation/orderedThemes/9`],
    lockedUntilBatch390Closed: true,
  },
};

fs.writeFileSync(preflightRelative, `${JSON.stringify(preflight, null, 2)}\n`, "utf8");
fs.writeFileSync(checkpointRelative, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  mode: "materialized",
  sourceCommit,
  contractSha256,
  checkpoint: checkpointRelative,
  preflight: preflightRelative,
  status: checkpoint.status,
  maleScene,
  razeWearers: Object.values(plans).map((plan) => ({ scene: plan.scene, sockWearers: plan.raze.sockWearers, bareLegCharacters: plan.raze.bareLegCharacters })),
  prompts: promptBank,
}, null, 2));
