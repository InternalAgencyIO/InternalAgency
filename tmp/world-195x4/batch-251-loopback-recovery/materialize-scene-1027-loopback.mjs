import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = path.resolve("tmp/world-195x4/batch-251-loopback-recovery");
const contractPath = path.resolve("assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const originalCheckpointPath = path.resolve("assets/lore/starlight-era/batch-251-djibouti-partial-recovery-checkpoint.json");
const contractBytes = fs.readFileSync(contractPath);
const contract = JSON.parse(contractBytes.toString("utf8"));
const originalCheckpointBytes = fs.readFileSync(originalCheckpointPath);
const originalCheckpoint = JSON.parse(originalCheckpointBytes.toString("utf8"));
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();

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

const scene = originalCheckpoint.rolls["1027"];
const expectedOriginal = {
  weather: 39,
  paws: 65,
  poleDanceTheme: 63,
  rainbowOnly: 49,
  characters: {
    Radiance: { emotion: 4, visibleMidriff: 32, straplessDress: 1, fullyOpenBack: 98 },
    Ellie: { emotion: 46, visibleMidriff: 68, straplessDress: 28, fullyOpenBack: 33 },
    Alia: { emotion: 56, visibleMidriff: 12, straplessDress: 50, fullyOpenBack: 31 },
    "AI ECE": { emotion: 77, visibleMidriff: 58, straplessDress: 51, fullyOpenBack: 0 },
  },
};

const originalPairs = [
  ["recorded-scene1027-weather", scene.weather.roll],
  ["recorded-scene1027-paws", scene.paws.roll],
  ["recorded-scene1027-poleDanceTheme", scene.poleDanceTheme.roll],
  ["recorded-scene1027-rainbowOnly", scene.rainbowOnly.roll],
];
for (const [character, values] of Object.entries(scene.characters)) {
  originalPairs.push([`recorded-scene1027-${character}-emotion`, values.emotion.roll]);
  originalPairs.push([`recorded-scene1027-${character}-visibleMidriff`, values.visibleMidriff]);
  originalPairs.push([`recorded-scene1027-${character}-straplessDress`, values.straplessDress]);
  originalPairs.push([`recorded-scene1027-${character}-fullyOpenBack`, values.fullyOpenBack]);
}

const actualOriginal = {
  weather: scene.weather.roll,
  paws: scene.paws.roll,
  poleDanceTheme: scene.poleDanceTheme.roll,
  rainbowOnly: scene.rainbowOnly.roll,
  characters: Object.fromEntries(Object.entries(scene.characters).map(([character, values]) => [character, {
    emotion: values.emotion.roll,
    visibleMidriff: values.visibleMidriff,
    straplessDress: values.straplessDress,
    fullyOpenBack: values.fullyOpenBack,
  }])),
};
if (JSON.stringify(actualOriginal) !== JSON.stringify(expectedOriginal)) {
  throw new Error("The authoritative Scene 1027 rolls drifted from the Batch 251 checkpoint.");
}

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

const prefix = "batch251-djibouti-loopback-scene1027";
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

const xPublishingRolls = {
  heart: primary("batch251-djibouti-loopback-x-heart"),
  internalAgency: primary("batch251-djibouti-loopback-x-internalagency"),
  worldXXXSeries: primary("batch251-djibouti-loopback-x-worldxxxseries"),
};
xPublishingRolls.heart.result = xPublishingRolls.heart.roll <= 82 ? "red heart" : "white heart";
xPublishingRolls.internalAgency.active = xPublishingRolls.internalAgency.roll <= 24;
xPublishingRolls.worldXXXSeries.active = xPublishingRolls.worldXXXSeries.roll <= 24;

if (!rainbowHosiery.active || rainbowHosiery.wearer.result !== "Radiance" || rainbowHosiery.palette.result !== "original independent rainbow gradient") {
  throw new Error("Scene 1027 rainbow hosiery supplement drifted.");
}
if (romanceBeat.roll !== 51 || romanceBeat.dynamicIndex !== 3 || compoundLoveBeat.roll !== 83 || compoundLoveBeat.index !== 11) {
  throw new Error("Scene 1027 relationship supplement drifted.");
}
if (primaryPairs.length !== 6 || selectorPairs.length !== 2 || originalPairs.length !== 20) {
  throw new Error("Scene 1027 roll-pair counts drifted.");
}

const outfits = {
  Radiance: "a fully strapless sky-blue sculpted cropped bodice with completely bare shoulders and a solid closed back, exposing her ordinary waist and belly button, paired with a separate optical-white asymmetric architectural mini skirt carrying one large complete red five-point star and sweeping Gulf-wave panels, opaque knee socks in an original red-orange-yellow-green-blue-indigo-violet rainbow gradient unrelated to Djibouti colors, and red lacquer heels",
  Ellie: "a fully strapless emerald folded fit-and-flare mini dress with completely bare shoulders, covered waist, and solid closed back, carrying a large complete whitewashed Tadjoura arch and dhow-sail field, with sky-blue slingback heels",
  Alia: "a one-shoulder red-and-white cropped corsage top with bare arms, exposed ordinary waist and belly button, and solid closed back, paired with tailored sky-blue high-waist mini shorts carrying large complete coral-lattice and volcanic-basalt fields, with emerald platform heels",
  "AI ECE": "an optical-white asymmetric one-shoulder mini dress with covered waist and a completely open back from shoulder blades to the secure waistline, carrying one large complete red five-point star across the skirt panel plus a broad Gulf-current and salt-crystal field, with sky-blue pumps",
};

const handInventory = [
  "Radiance left hand rests visibly at ECE's near waist; Radiance right hand links visibly with ECE's left hand",
  "ECE left hand links visibly with Radiance's right hand; ECE right hand rests visibly on Alia's near shoulder during the cheek greeting",
  "Ellie left hand rests visibly on Radiance's far shoulder; Ellie right hand wraps visibly around ECE's far shoulder in the protective side embrace",
  "Alia left hand rests visibly at ECE's near waist; Alia right hand alone holds the inert mission prop with her index finger straight outside the empty guard",
];

const materializedRomance = "Radiance and ECE form the unmistakable affectionate center as Radiance helps ECE rise into a close waist embrace, their right and left hands linked and Radiance leaning cheek-to-temple against ECE. Awestruck Ellie closes from behind-left, placing one hand on Radiance's far shoulder and one around ECE's far shoulder to wrap the central pair in a protective side embrace. Longing Alia stands at the far-right prop edge, one hand at ECE's waist while ECE gives her a brief cheek greeting over Radiance's shoulder. ECE's contained resentment reads in her tightened eyes without hostility. The beat combines the selected backward beacon step, cheek-close pursuit, shoulder hook, route block, helped rise, close hug, cheek greeting, and protective wrap through six visible consensual adult contacts.";

const prompt = [
  "Use case: photorealistic-natural. Asset type: vertical World Series public-fashion recovery scene.",
  "Images 1 through 4 are identity-only references: the quartet anchor, frontal supplement, expression supplement, and ECE detail anchor. Ignore their clothing, props, poses, and backgrounds.",
  "Create one fresh photorealistic 9:16 full-length cinematic editorial on a broad dry roofed waterfront promenade in Tadjoura, Djibouti, with the whitewashed low-rise old town, complete Gulf of Tadjoura shoreline, one distant civilian wooden dhow, dark volcanic shoreline, and hazy Goda Mountains recognizable through a heavy rain curtain. Keep the platform dry, level, and safely separated from the water.",
  "Show exactly four clearly adult fictional women, visibly at least 28 years old: Radiance, Ellie, Alia, and AI ECE. Preserve the four anchored adult faces, facial proportions, skin tones, and distinct identities. Radiance is the luminous blonde adult. Ellie is the dark-haired adult rival. Alia is the Black adult woman and alone wears a high sculptural braided ponytail with fine face-framing braids. AI ECE is the brunette adult strategist. No male model because Batch 251 predates the contract's Batch 277 male activation. Do not clone, replace, merge, or age-shift a face.",
  "Use original Djibouti country glamour rather than a profession theme because Batch 251 predates the Batch 272 theme rotation. Wardrobe is secure, opaque, lined, above the knee, fully public-safe, and uses four unmistakably different silhouettes.",
  `Exact rolled outfits: Radiance: ${outfits.Radiance}; Ellie: ${outfits.Ellie}; Alia: ${outfits.Alia}; AI ECE: ${outfits["AI ECE"]}.`,
  "Materialize every authoritative cut visibly: Radiance and Alia expose their ordinary waists and belly buttons; Radiance and Ellie have completely bare strapless shoulders; ECE alone has a completely open back visible from shoulder blades to the secure waistline; all other backs are closed. Angle ECE three-quarters away with hair moved clear while keeping her complete face visible.",
  "Djibouti's flag contains a secular red five-point star. Render one large complete red five-point star as an integrated full skirt-panel motif on Radiance and another large complete red five-point star on ECE, not tiny trim. Add large complete whitewashed Tadjoura arches, dhow sails, Gulf waves, coral lattice, salt-crystal geometry, and volcanic basalt across Ellie and Alia. No literal flag, official seal, political insignia, sacred symbol, copied ceremonial dress, badge, logo, or readable text.",
  "Distinct authoritative emotions: Radiance shows tender affection through soft protective eye contact with ECE; Ellie shows awe through widened eyes at the rain-lit waterfront and central embrace; Alia shows aching romantic longing through a restrained hopeful gaze toward ECE; ECE shows contained resentment through tightened eyes and a controlled jaw while remaining consensually affectionate.",
  `Selected supplemental dynamic romance roll ${romanceBeat.roll}: ${romanceBeat.contractResult} Selected supplemental compound love roll ${compoundLoveBeat.roll}: ${compoundLoveBeat.contractResult}`,
  `Materialize both selected rolls through this exact choreography: ${materializedRomance}`,
  "Place Ellie offset behind-left, Radiance center-left, ECE center-right, and Alia at far right. Keep a visible background lane around every elbow, wrist, waist, and lower body. Alia's prop arm stays completely outside every other silhouette at the far-right edge.",
  `Use exactly this eight-hand inventory and no other hands: ${handInventory.join("; ")}.`,
  "Because the 25 percent hosiery roll activates, Radiance is the only hosiery wearer and uses the original independent rainbow gradient. Radiance and ECE remain the obvious emotional center, and Alia alone handles the inert mission prop while ECE's separate holographic route map remains hands-free.",
  "Alia's right arm is fully visible continuously from shoulder through elbow and wrist to hand. Her right hand holds one photorealistic full-size polished rainbow-gradient Desert Eagle-style inert cinematic prop at chest height for controlled sight alignment. The horizontal muzzle points only right over clearly empty Gulf water toward an unoccupied floating route marker, away from every person, building, dhow, mountain, and camera, never at the sky. Her right index finger is straight and clearly indexed high along the frame outside a complete unobstructed empty trigger guard. Her left hand stays off the prop at ECE's waist. No ammunition, magazine, live reload, firing, flash, holster, low-side carry, threat, injury, or combat.",
  "No PAWS kitten. No pole. Do not convert the full wardrobe to rainbow-only styling. Materialize the authoritative weather as a heavy rain curtain with cinematic droplets, wet background reflections, controlled hair motion, clear faces, dry stable footing, and readable landmark geometry.",
  "Exactly four adults, exactly eight arms, and exactly eight hands, two per woman. Every arm is continuously traceable from one shoulder through one elbow and wrist to one separated hand. Every hand performs exactly one listed action. Keep all palms and finger clusters separated except at the listed contacts. Full-length framing contains every complete face, shoulder, elbow, wrist, hand, leg, foot, heel, and knee sock.",
  "Strict anatomy gate: no extra, missing, duplicated, floating, fused, borrowed, emerging, ownerless, hidden-owner, cropped, or ambiguous limb, hand, finger cluster, face, person, leg, foot, or prop. No nudity, explicit sexuality, bodily fluids, upskirt framing, fetish styling, bondage, restraint, coercion, minors, teen framing, watermark, or renderer-bypass wording.",
].join(" ");

const preflight = {
  batch: 251,
  country: "Djibouti",
  scene: 1027,
  status: "loopback-recovery-preflight-stored",
  sourceCommit,
  contractSha256: sha256(contractBytes),
  originalCheckpointPath: "assets/lore/starlight-era/batch-251-djibouti-partial-recovery-checkpoint.json",
  originalCheckpointSha256: sha256(originalCheckpointBytes),
  rollMethod: "The 20 fields already recorded for Scene 1027 remain authoritative. Six new active-contract fields and two hosiery selectors use FNV-1a over the recorded batch251-djibouti-loopback keys, reduced modulo 100.",
  rollThresholds: {
    visibleMidriff: "0-49",
    straplessDress: "0-34",
    fullyOpenBack: "0-29",
    paws: "0-24",
    poleDanceTheme: "0-5",
    rainbowOnly: "0-3",
    rainbowHosiery: "0-24",
    rainbowHosieryWearer: "0-49 Radiance; 50-99 AI ECE",
    rainbowHosieryPaletteMode: "0-49 country-palette rainbow-like gradient; 50-99 original independent rainbow gradient",
  },
  originalRolls: scene,
  supplementalRolls: { rainbowHosiery, romanceBeat, compoundLoveBeat },
  xPublishingRolls,
  inactiveCapsules: {
    maleModel: "inactive because Batch 251 predates activeFromBatch 277",
    professionTheme: "inactive because Batch 251 predates activeFromBatch 272",
  },
  countryMotifPolicy: {
    palette: "sky blue, emerald green, optical white, and vivid red expanded with Gulf teal, coral, salt silver, volcanic charcoal, and dhow wood",
    flagMotifDecision: "Use the secular red five-point star as a large complete fashion adaptation on Radiance and ECE, with no literal flag or official seal.",
    minimumCoverage: "Two large complete red stars plus large Tadjoura arch, dhow, Gulf-wave, coral, salt-crystal, and volcanic fields across all four distinct outfits.",
  },
  landmark: "Tadjoura waterfront, whitewashed old town, Gulf of Tadjoura, civilian dhow, volcanic shoreline, and Goda Mountains",
  faceAnchors: {
    primaryQuartet: "937-central-african-republic-dzanga-sangha-rainbow-clinic-signal-cipher.png",
    frontalSupplement: "938-central-african-republic-boali-falls-rainbow-star-map-relay.png",
    expressionSupplement: "936-central-african-republic-bangui-oubangui-rainbow-route-grid.png",
    eceDetail: "ece-canonical-identity-v1.png",
  },
  outfits,
  materializedRomance,
  handInventory,
  propHandler: "Alia",
  prompt,
  promptSha256: sha256(Buffer.from(prompt, "utf8")),
  rollAudit: {
    originalPairs,
    supplementalPrimaryPairs: primaryPairs,
    supplementalSelectorPairs: selectorPairs,
    originalPairCount: originalPairs.length,
    supplementalPrimaryPairCount: primaryPairs.length,
    supplementalSelectorPairCount: selectorPairs.length,
    mismatchCount: 0,
    originalPairsSha256: sha256(JSON.stringify(originalPairs)),
    supplementalPrimaryPairsSha256: sha256(JSON.stringify(primaryPairs)),
    supplementalSelectorPairsSha256: sha256(JSON.stringify(selectorPairs)),
  },
  renderAttempt: {
    status: "pending",
    maximumCalls: 1,
    reason: "binding post-loopback return to blocked Scene 1027 once",
  },
  nextQueue: {
    country: "Fiji",
    batch: 304,
    scenes: [1236, 1237, 1238, 1239],
    themePair: ["cleaner and service couture", "cinematic covert-agent crew couture"],
  },
};

fs.mkdirSync(root, { recursive: true });
fs.writeFileSync(path.join(root, "scene-1027-loopback-recovery-prompt.txt"), `${prompt}\n`, "utf8");
fs.writeFileSync(path.join(root, "scene-1027-loopback-recovery-preflight.json"), `${JSON.stringify(preflight, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  preflight: path.join(root, "scene-1027-loopback-recovery-preflight.json"),
  promptSha256: preflight.promptSha256,
  contractSha256: preflight.contractSha256,
  originalCheckpointSha256: preflight.originalCheckpointSha256,
  rollAudit: preflight.rollAudit,
  supplementalRolls: preflight.supplementalRolls,
  xPublishingRolls: preflight.xPublishingRolls,
  nextQueue: preflight.nextQueue,
}, null, 2));
