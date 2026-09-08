#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const batch = 391;
const country = "Malta";
const countrySlug = "malta";
const firstScene = 1584;
const root = path.resolve("tmp/world-195x4/batch-391");
const contractPath = "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json";
const predecessorPath = "assets/lore/starlight-era/batch-390-montenegro-polar-airship-checkpoint.json";
const historyPath = "tmp/world-195x4/batch-320/batch-320-malta-preflight.json";
const checkpointPath = "assets/lore/starlight-era/batch-391-malta-orbital-research-station-checkpoint.json";
const preflightPath = "tmp/world-195x4/batch-391/batch-391-malta-preflight.json";
const remoteRef = "origin/agent/starlight-progress-archive";
const expectedSourceCommit = "6d6d6de494a0ee50c8a3052a61199acb49b55a74";
const expectedContractSha256 = "7CD14D921342CB03E23F194BE87F516B4F77CD36DF8BEA66547C53779C360AE5";
const characters = ["Radiance", "Ellie", "Alia", "AI ECE"];
const razePairs = [
  ["Radiance", "Ellie"],
  ["Radiance", "Alia"],
  ["Radiance", "AI ECE"],
  ["Ellie", "Alia"],
  ["Ellie", "AI ECE"],
  ["Alia", "AI ECE"],
];
const suppressedTokens = new Set([
  "16", "9", "anchors", "create", "editorial", "fresh", "full-length", "identity", "one", "only",
  "original", "photorealistic", "public-fashion", "series", "starlight", "use", "world",
]);

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex").toUpperCase();
const fnv1a = (value) => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
};
const fileRecord = (file) => {
  const bytes = fs.readFileSync(file);
  return { file, sha256: sha256(bytes), bytes: bytes.length, chars: bytes.toString("utf8").length };
};
const assertSuppressedTokensAbsent = (text, label) => {
  const words = text.toLowerCase().match(/[a-z0-9]+(?:-[a-z0-9]+)*/g) ?? [];
  const conflicts = [...new Set(words.filter((word) => suppressedTokens.has(word)))];
  if (conflicts.length) throw new Error(`${label} reintroduces run-suppressed tokens: ${conflicts.join(", ")}`);
};

const contractBytes = fs.readFileSync(contractPath);
const contract = JSON.parse(contractBytes.toString("utf8"));
const contractSha256 = sha256(contractBytes);
if (contractSha256 !== expectedContractSha256) throw new Error(`Contract SHA changed: ${contractSha256}`);
if (!contract.razeFashionLine?.active) throw new Error("RAZE capsule is inactive");
if (!contract.closeLoveMissionRestoration?.active || contract.closeLoveMissionRestoration.activeFromBatch !== 391) {
  throw new Error("closeLoveMissionRestoration must be active from Batch 391");
}
if (!contract.rapidConsolidatedRenderPolicy?.boundedFoundationPassPolicy?.active) {
  throw new Error("boundedFoundationPassPolicy is inactive");
}

const remoteCommit = execFileSync("git", ["rev-parse", remoteRef], { encoding: "utf8" }).trim();
if (remoteCommit !== expectedSourceCommit) throw new Error(`Remote source changed: ${remoteCommit}`);
const predecessorBytes = fs.readFileSync(predecessorPath);
const remotePredecessorBytes = execFileSync("git", ["show", `${remoteRef}:${predecessorPath}`], { encoding: null });
if (!predecessorBytes.equals(remotePredecessorBytes)) throw new Error("Predecessor differs from public remote");
const predecessor = JSON.parse(predecessorBytes.toString("utf8"));
if (predecessor.status !== "complete-four-of-four-hard-safe-meta-ai-pass-1-accepted-no-more-montenegro-rendering") {
  throw new Error(`Montenegro is not closed: ${predecessor.status}`);
}
const queue = predecessor.nextQueue;
if (
  queue?.nextCountry !== country ||
  queue?.nextBatch !== batch ||
  JSON.stringify(queue?.sceneNumbers) !== JSON.stringify([1584, 1585, 1586, 1587]) ||
  queue?.cinematicTheme !== "orbital research-station couture" ||
  queue?.themePairPosition !== 1
) throw new Error("Batch 390 nextQueue does not authorize Malta Batch 391");

const history = JSON.parse(fs.readFileSync(historyPath, "utf8"));
const historicalPlans = Object.values(history.scenePlans).sort((a, b) => a.scene - b.scene);
if (historicalPlans.length !== 4) throw new Error("Expected four Malta history scenes");

const signatureActions = [
  "Radiance sits securely sideways across Ellie's lap on a low orbital banquette; Alia leans in for a quick cheek peck, while ECE closes from the outer edge with her free hand at Ellie's shoulder and a playful rival gaze.",
  "Ellie sits face-to-face with Radiance in a close embrace; Alia gives Radiance a quick forehead peck, while ECE links her free hand with Ellie's and the established adult man stays behind ECE with his strongest gaze returning to her.",
  "Alia settles sideways across Radiance's lap during a playful turn; ECE gives Ellie a quick temple peck with her free side, and Ellie catches Alia's hand to interrupt the pair.",
  "Radiance and Alia move through a near-camera side embrace; Ellie catches Radiance's free hand and gives her a quick cheek peck, while ECE answers from inches away with a close inviting gaze and her free hand at Alia's shoulder.",
];
const locations = [
  {
    name: "Valletta Grand Harbour",
    landmark: "a near-camera orbital research lounge above Valletta Grand Harbour, with honey-limestone bastions, the fortified peninsula, stepped quays and cobalt harbor water clearly recognizable behind the group",
    motifs: "Valletta bastion angles, Grand Harbour inlets, stepped quays, balcony rhythms and orbital window arcs",
    target: "a complete thick lunar-soil backstop behind a transparent safety screen in an empty calibration lane at far right",
  },
  {
    name: "Mdina fortified hilltop",
    landmark: "a near-camera orbital observation banquette beside Mdina's honey-limestone fortified hilltop, with the secular gate, bastion wall, dry ditch and terraced fields clearly readable beyond the window",
    motifs: "Mdina gate arches, bastion walls, winding lanes, terraced fields and research-station docking rings",
    target: "a complete thick inert composite backstop behind a transparent safety screen in an empty calibration lane at far right",
  },
  {
    name: "Blue Grotto and Wied iz-Zurrieq",
    landmark: "a near-camera orbital glass lounge above the Blue Grotto, with the massive honey-limestone sea arch, cobalt cave water, white foam and distant Filfla silhouette clearly visible",
    motifs: "Blue Grotto arches, sea-cave chains, cobalt reflection bands, limestone layers and orbital solar-panel facets",
    target: "a clearly empty marked water-calibration lane beyond the glass at far right, with no boat, swimmer, animal or occupied structure",
  },
  {
    name: "Dwejra inland sea",
    landmark: "a near-camera orbital research banquette above Gozo's Dwejra inland sea, with the circular basin, narrow sea tunnel, honey-limestone cliffs and Fungus Rock silhouette clearly readable",
    motifs: "Dwejra basin rings, inland-sea tunnels, fossil layers, reef lines and orbital navigation arcs",
    target: "a clearly empty marked water-calibration lane beyond the glass at far right, away from cliffs, reefs, animals and people",
  },
];
const palettes = [
  ["Malta red with warm gold", "harbor turquoise with honey limestone", "Mediterranean cobalt with salt white", "prickly-pear green with rain silver"],
  ["honey limestone with Malta red", "night charcoal with harbor turquoise", "warm gold with Mediterranean cobalt", "salt white with prickly-pear green"],
  ["Mediterranean cobalt with white foam", "Malta red with honey limestone", "harbor turquoise with warm gold", "night charcoal with rain silver"],
  ["prickly-pear green with honey limestone", "Mediterranean cobalt with Malta red", "warm gold with salt white", "harbor turquoise with rain silver"],
];
const forms = [
  "strapless upper-thigh skort dress with an open shoulder-blade back",
  "cropped asymmetric orbital jacket with tailored upper-thigh shorts and a secure low back",
  "sculpted sleeveless upper-thigh mini with a narrow ordinary waist opening",
  "folded one-shoulder upper-thigh romper with an open upper back",
];
const shoes = ["low-vamp gold pumps", "open-front salt-white slingbacks", "low-vamp cobalt pumps", "open-front turquoise heels"];

const maleKey = `batch${batch}-${countrySlug}-male-model-scene`;
const maleHash = fnv1a(maleKey);
const maleScene = firstScene + (maleHash % 4);
const scenePlans = {};
const promptBank = [];
fs.mkdirSync(root, { recursive: true });

for (let index = 0; index < 4; index += 1) {
  const scene = firstScene + index;
  const razeKey = `RAZE|batch-${batch}|scene-${scene}|knee-high-wearers`;
  const razeHash = fnv1a(razeKey);
  const sockWearers = razePairs[razeHash % razePairs.length];
  const bareLegCharacters = characters.filter((character) => !sockWearers.includes(character));
  const malePresent = scene === maleScene;
  const location = locations[index];
  const outfitLines = characters.map((character, characterIndex) => {
    const hosiery = sockWearers.includes(character)
      ? "paired opaque rainbow-gradient knee-high socks ending below both knees, exact readable RAZE wordmarks at the outer bands"
      : "visibly bare lower legs without hosiery";
    return `${character}: ${palettes[index][characterIndex]} ${forms[(characterIndex + index) % forms.length]}, unique Malta 1/1 print built from ${location.motifs}, ${hosiery}, ${shoes[characterIndex]}`;
  });
  const maleClause = malePresent
    ? "Add the established clearly adult athletic bearded man as a fifth figure behind ECE. His opaque Malta-limestone orbital shirt, tailored dark shorts and complete shoes remain distinct; he never enters the four-woman sock count."
    : "No male figure appears.";
  const mascotClause = index % 2 === 0
    ? "PAWS the tiny collarless golden kitten and MAX the golden-retriever pup rest together inside a protected padded nook behind the love group, far from the calibration lane."
    : "PAWS and MAX are absent.";
  const primary = `Render a vertical 1152 by 2048 realistic cinematic fashion photograph. Malta Scene ${scene} places the camera inside a close adult relationship moment, with large faces and the cast filling about eighty-five percent of the frame.

Exactly four fictional women visibly over age twenty-eight appear: blonde Radiance, dark-haired Ellie, Black Alia with the sole high sculptural braided ponytail, and brunette AI ECE. Preserve their established distinct faces, skin tones and adult ages. ${maleClause}

Location and theme: ${location.landmark}. Orbital research-station couture adds curved glass, docking rings, solar facets, navigation light and silver structural ribs while Malta stays unmistakable through ${location.motifs}. No flag, Maltese cross, coat of arms, crown, sacred symbol, religious building, uniform, badge, copied logo or unrelated brand.

Love mission foreground: ${signatureActions[index]} The event reads immediately as willing adult pursuit, choice and playful rivalry. Show reciprocal lean, relaxed expressions and accepted touch. A quick peck stays closed-mouth, affectionate and public-safe. The low banquette gives stable support; lap seating is sideways with opaque seat and pelvic coverage, planted supporting feet, no straddling and no intimate-angle framing. Zero static lineup, zero equal spacing, zero parallel standing poses. Keep faces close, torso directions varied and the relationship event more prominent than the background, socks or calibration prop.

RAZE nonprofit 1/1 capsule: exactly ${sockWearers.join(" and ")} wear paired opaque rainbow-gradient knee-high socks with readable RAZE upper-band wordmarks. Exactly ${bareLegCharacters.join(" and ")} show bare lower legs without socks, stockings or leggings. Bring the four complete leg paths and shoes forward through seated, lap and staggered depth; never separate the cast into hosiery display lanes. Every print layout differs.

Secure opaque upper-thigh wardrobe with complete bust, seat, pelvic and intimate coverage:
${outfitLines.join("\n")}

AI ECE is the sole handler of a polished rainbow-gradient large-frame inert cinema-training replica. Her outer hand keeps it low and directed strictly toward ${location.target}; her index stays straight outside the empty guard, the mechanism is visibly open, and no ammunition appears. Her free hand alone may join the stated love beat. The replica never crosses a person, mascot, occupied object or camera. No firing, flash, threat, injury or combat. ${mascotClause}

Near-camera seated head-to-shoe composition, natural perspective, crisp fashion lighting. Show every adult face, each complete arm path, every hand owner, both legs and complete footwear. Natural overlap is welcome, but no gross extra, missing, fused, floating, borrowed or impossible anatomy. No exposed underwear, accidental exposure, coercion or explicit sexuality. Visible text is restricted to exact RAZE sock bands; no watermark.`;

  const fallback = `Cinematic vertical Malta fashion photograph, Scene ${scene}, framed from a physically close camera. The clearly adult cast fills the frame in a warm active relationship moment at ${location.name}, with Malta motifs and orbital research-lounge architecture behind them.

${signatureActions[index]} Keep the peck brief and affectionate, the lap or bench support stable, all participation willing, and the clothing opaque. No distant tableau or standing lineup.

RAZE allocation: ${sockWearers.join(" and ")} wear paired rainbow knee-high socks marked RAZE; ${bareLegCharacters.join(" and ")} have bare lower legs. Show complete legs and footwear through close seated depth. ${malePresent ? "The established adult bearded man appears behind ECE without hosiery." : "No male appears."}

Four distinct upper-thigh Malta orbital-couture looks carry large ${location.motifs}. ECE alone holds a harmless rainbow open-frame cinema calibration replica toward ${location.target}, away from people, animals and camera. No ammunition, firing, threat, injury or combat. Plausible adult anatomy, attributable hands, complete coverage, no explicit sexuality, no text beyond RAZE, no watermark.`;

  assertSuppressedTokensAbsent(primary, `Scene ${scene} primary`);
  assertSuppressedTokensAbsent(fallback, `Scene ${scene} fallback`);
  const primaryFile = `tmp/world-195x4/batch-391/scene-${scene}-meta-pass-1-primary.txt`;
  const fallbackFile = `tmp/world-195x4/batch-391/scene-${scene}-meta-pass-1-fallback.txt`;
  fs.writeFileSync(primaryFile, `${primary}\n`, "utf8");
  fs.writeFileSync(fallbackFile, `${fallback}\n`, "utf8");
  promptBank.push({ scene, primary: fileRecord(primaryFile), fallback: fileRecord(fallbackFile) });
  scenePlans[scene] = {
    scene,
    historicalSceneEvidence: `${historyPath}#/scenePlans/${historicalPlans[index].scene}`,
    location,
    theme: "orbital research-station couture",
    closeLoveMission: {
      signatureActionIndex: index,
      action: signatureActions[index],
      closeCamera: true,
      lapSitting: index === 0 || index === 2,
      visiblePeck: true,
      closeEmbrace: true,
      staticLineup: false,
    },
    raze: {
      key: razeKey,
      hash: razeHash,
      pairIndex: razeHash % razePairs.length,
      sockWearers,
      bareLegCharacters,
    },
    maleModel: { key: maleKey, hash: maleHash, present: malePresent },
    outfits: Object.fromEntries(characters.map((character, characterIndex) => [character, outfitLines[characterIndex]])),
    propHandler: "AI ECE",
    prompt: promptBank[promptBank.length - 1],
  };
}

const preflight = {
  schemaVersion: 1,
  batch,
  country,
  status: "ready-four-tab-meta-ai-pass-1",
  generatedAt: "2026-08-20T07:28:00.000Z",
  sourceCommit: expectedSourceCommit,
  contract: { path: contractPath, sha256: contractSha256 },
  predecessor: { path: predecessorPath, sha256: sha256(predecessorBytes), status: predecessor.status },
  queueAuthorization: queue,
  provider: "Meta AI only",
  passPolicy: { passOne: 4, concurrency: 4, passTwoMaximumPerHardUnusableScene: 1, thirdPassAllowed: false },
  closeLoveBankMinimums: contract.closeLoveMissionRestoration.fourSceneBankMinimums,
  closeLoveBankActual: { closeCameraScenes: 4, lapSittingScenes: 2, visiblePeckScenes: 4, closeEmbraceScenes: 4, staticLineupScenes: 0 },
  suppressionPolicy: { sameRun: true, blacklistedSingleTokens: [...suppressedTokens], promptChecksPassed: 8 },
  maleModel: { key: maleKey, hash: maleHash, scene: maleScene },
  promptBank,
};
fs.writeFileSync(preflightPath, `${JSON.stringify(preflight, null, 2)}\n`, "utf8");

const checkpoint = {
  schemaVersion: 1,
  batch,
  country,
  status: "active-pass-1-meta-ai-only-prepared-not-launched",
  sourceCommit: expectedSourceCommit,
  contractSha256,
  providerRestriction: "Meta AI only",
  queueAuthorization: queue,
  cinematicTheme: { name: "orbital research-station couture", ordinal: 1, pairSize: 2 },
  sceneNumbers: [1584, 1585, 1586, 1587],
  policy: {
    passOneCandidatesAuthorized: 4,
    passOneCandidatesConsumed: 0,
    promptDispatchesConsumed: 0,
    passTwoCandidatesConsumed: 0,
    thirdPassAllowed: false,
    concurrentTabsRequired: 4,
    closeLoveMissionRestoration: true,
  },
  closeLoveBankMinimums: contract.closeLoveMissionRestoration.fourSceneBankMinimums,
  scenePlans,
  preflight: fileRecord(preflightPath),
  promptBank,
  events: [],
  rejectedPromptLedger: { appendOnly: true, entries: [] },
  acceptedAssets: [],
  rejectedAssets: [],
  xPost: { status: "ineligible-active-country", caption: "Malta ❤️ Montenegro #Malta #WorldXXXSeries", url: null },
  nextQueue: { status: "locked-until-batch-391-closure", resolution: "authoritative queue/history only; never guess" },
};
fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  status: checkpoint.status,
  checkpoint: fileRecord(checkpointPath),
  preflight: fileRecord(preflightPath),
  contractSha256,
  sourceCommit: expectedSourceCommit,
  maleScene,
  scenes: Object.values(scenePlans).map((plan) => ({
    scene: plan.scene,
    sockWearers: plan.raze.sockWearers,
    bareLegCharacters: plan.raze.bareLegCharacters,
    lapSitting: plan.closeLoveMission.lapSitting,
    visiblePeck: plan.closeLoveMission.visiblePeck,
  })),
  promptBank,
}, null, 2));
