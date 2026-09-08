#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";

const requestedAt = "2026-08-20T11:40:57.6967568Z";
const contractPath = "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json";
const checkpointPath = "assets/lore/starlight-era/batch-392-maldives-orbital-research-station-checkpoint.json";
const lexiconPath = "C:/Users/A/Documents/ChatGPT/RENDERS/outputs/meta5_blocked_prompt_lexicon.jsonl";
const root = "tmp/world-195x4/batch-392";
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex").toUpperCase();
const writePrompt = (path, text) => {
  fs.writeFileSync(path, `${text.trim()}\n`, "utf8");
  const bytes = fs.readFileSync(path);
  return {
    path,
    text: bytes.toString("utf8"),
    sha256: sha256(bytes),
    bytes: bytes.length,
    encoding: "utf8",
    fidelity: "runtime-launch-byte-exact",
  };
};

const bindings = {
  1588: {
    key: "starlight|setting|batch-392|scene-1588",
    counter: 0,
    acceptedFirstByte: 47,
    digestSha256: "2F5E9A7C960E968930A23FA3E7F3137D1DFF6618CAD352B9A4AED28E5A2C329A",
    bucketIndex: 2,
    setting: "protected-exterior-surface",
  },
  1589: {
    key: "starlight|setting|batch-392|scene-1589",
    counter: 0,
    acceptedFirstByte: 137,
    digestSha256: "895EB1BC6DD4D612067B5383C1F4FAB864CC51AF9D35364E0347D336FFC3E26C",
    bucketIndex: 2,
    setting: "protected-exterior-surface",
  },
  1590: {
    key: "starlight|setting|batch-392|scene-1590",
    counter: 0,
    acceptedFirstByte: 173,
    digestSha256: "ADC6318CFD820B65F6494BF5CE405A34352CF4D2715F010C8868EB85B1137264",
    bucketIndex: 2,
    setting: "protected-exterior-surface",
  },
  1591: {
    key: "starlight|setting|batch-392|scene-1591",
    counter: 0,
    acceptedFirstByte: 179,
    digestSha256: "B34AB10F7C1914C63D1A90441D577B146394AC26D88BA48BDCEE72E82DD2A972",
    bucketIndex: 2,
    setting: "protected-exterior-surface",
  },
};

const policy = {
  active: true,
  requestedAt,
  activeFromBatch: 392,
  supersedes: [
    "cinematicThemeRotation.locationRule requiring every scene inside protected infrastructure",
    "planetaryEnvironmentEqualFifthPolicy.literalSettingRule requiring habitat or sealed structure",
  ],
  userDirective: "Place scenes on exterior planet surfaces with a two-thirds probability and inside a habitat with a one-third probability. Interior habitat scenes add a fluffy bed and closer affectionate fashion beats.",
  selectionAlgorithm: {
    name: "sha256-first-byte-rejection-sampling-equal-thirds",
    settingKey: "starlight|setting|batch-{batch}|scene-{scene}",
    method: "Hash key plus |counter-{counter}, beginning at counter 0. Reject first byte 255 and increment. Accepted bytes 0 through 254 divide evenly into three modulo buckets with 85 values each.",
    bucketMap: {
      0: "habitat-interior",
      1: "protected-exterior-surface",
      2: "protected-exterior-surface",
    },
    probability: {
      habitatInterior: "1/3",
      protectedExteriorSurface: "2/3",
    },
    rerollAllowed: false,
  },
  exteriorRule: "The scene is literally outdoors on the speculative surface of the locked real catalog planet. Planet terrain, sky and horizon dominate. A transparent pressure field, open-sided shield canopy or visibly protective research perimeter keeps the adults safe without making the image read as an interior. Footing stays dry and stable. The country remains unmistakable through large couture motifs, landmark-derived research geometry and cultural installations. Never claim measured habitability or that an Earth landmark physically exists there.",
  interiorRule: "A habitat interior includes a broad fluffy couture lounge bed or deep padded daybed integrated into the research habitat. Choose supported head-on-lap rest, face framed above a lap, hand catch, side cuddle, behind embrace, closed-mouth cheek or temple peck, or a playful complete-heel lift. Every adult remains fully clothed in secure opaque fashion. A raised heel or skirt-side reveal shows the complete shoe, uncovered leg and opaque garment side seam without lifting a hem, revealing underwear or intimate areas, aiming beneath a skirt, centering the pelvis, implying undressing or staging sexual activity.",
  sharedSafety: "Keep unmistakably adult age-21 presentation, calm nonviolent jealousy, stable support, complete anatomy, a clear task for every hand, complete footwear, secure bust/seat/pelvic coverage, mascot safety and harmless isolated mission handling.",
  persistenceRule: "Store setting key, counter, accepted byte, digest, bucket, setting language and UTC before dispatch. Carry the locked setting through every provider comparison, final clothing refinement, archive and publication.",
  lockedBatch392Bindings: bindings,
};

const contract = JSON.parse(fs.readFileSync(contractPath, "utf8"));
contract.planetarySurfaceOrHabitatThirdPolicy = policy;
contract.cinematicThemeRotation.locationRule = "From Batch 392 onward, the separately stored planetarySurfaceOrHabitatThirdPolicy chooses a protected exterior planet-surface location for two modulo buckets and a habitat interior for the remaining bucket. Keep the current country unmistakable through large couture motifs, cultural research installations and landmark-derived geometry; never claim an Earth landmark physically exists on the exoplanet. Earlier batches retain their historical Earth-location rule.";
contract.cinematicThemeRotation.themeLocationFusion = "Compose the active theme, stored real exoplanet, locked exterior-or-interior setting, rolled environment and country identity as a single authored scene. Planet and environment are literal speculative setting and lighting; country identity stays unmistakable through large couture motifs, cultural research installations and landmark-derived geometry. Preserve scientific-honesty language for speculative surfaces, weather and habitation.";
contract.cinematicThemeRotation.themeExamples.spaceAndPlanetary = "Apply fictional couture inspired by pressure-shell geometry, regolith texture, orbital arcs, solar shielding, rover joints and mission-light systems at the locked protected exterior surface or habitat interior associated with the stored NASA-catalog planet. The named planet is real; surface, weather and habitation are speculative cinematic art. Never depict unprotected people in hostile conditions or imply measured habitability.";
contract.planetaryEnvironmentEqualFifthPolicy.literalSettingRule = "The named real exoplanet is the literal distant setting. The separately stored planetarySurfaceOrHabitatThirdPolicy chooses a protected exterior surface location with two-thirds probability or a habitat interior with one-third probability. The current country remains the cultural and couture identity through large motifs, research installations and landmark-derived geometry; never falsely claim an Earth landmark physically exists on the exoplanet.";
contract.planetaryEnvironmentEqualFifthPolicy.extremeWeatherSafety = "The extreme-weather bucket reads as rain, wind and storm atmosphere outside the locked protection system. Exterior scenes remain outdoors beneath a transparent pressure field or open shield perimeter with dry stable footing; interiors retain sealed protection. Preserve clear adult faces, complete anatomy, country reads, mascot safety and inert-prop isolation. No disaster victims, flooding peril, strikes near people, injury or emergency framing.";
contract.planetaryEnvironmentEqualFifthPolicy.persistenceRule = "Materialize and store environment, planet and exterior-or-interior setting rolls with keys, counters, accepted bytes, digest hashes, names and prompt language before every provider dispatch. Carry every result through Meta generation, comparison, final ChatGPT clothing edit, archive and publication without rerolling.";
fs.writeFileSync(contractPath, `${JSON.stringify(contract, null, 2)}\n`, "utf8");
const contractSha256 = sha256(fs.readFileSync(contractPath));

const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
checkpoint.contractSha256 = contractSha256;
checkpoint.policy ??= {};
checkpoint.policy.planetarySurfaceOrHabitatThirdPolicyRequestedAt = requestedAt;
checkpoint.policy.planetarySurfaceOrHabitatThirdPolicy = "active; exact one-third habitat and two-thirds protected exterior surface via stored SHA-256 modulo-three rejection sampling";
checkpoint.policy.soleGuardianAutomationId = "starlight-internalagency-24-7-guardian";
checkpoint.policy.soleGuardianAutomationUpdatedAt = requestedAt;
checkpoint.planetarySurfaceOrHabitatThirdPolicy = policy;
for (const [scene, binding] of Object.entries(bindings)) {
  checkpoint.scenePlans[scene].planetarySetting = {
    ...binding,
    promptLanguage: "outdoors on the speculative planet surface beneath a transparent pressure field and open-sided research shield, with dominant terrain, sky and horizon plus dry stable footing",
    lockedAt: requestedAt,
    rerollAllowed: false,
  };
}

const faceText = "The supplied historical photographs govern faces and name ownership. Scene 938 maps far-left Alia with voluminous natural curls, blonde Radiance second, dark-haired Ellie third and dark-haired ECE far right. Scenes 936 and 937 reinforce those same facial geometries. Radiance, Ellie, Alia and AI ECE are four distinct fictional adult women, each exactly age 21. Keep exactly four women with no duplicate, substitution, merge or age shift.";
const settingText = {
  1588: "The quartet stands outdoors on a protected TRAPPIST-1 e surface research terrace beneath a transparent pressure field and open-sided shield. Severe wind-driven rain and a distant thunderstorm remain beyond the field; everyone is dry and calm. The planet terrain, storm sky and horizon dominate. Hanifaru lagoon curves, faro rings, patch reefs and manta-current arcs appear as a large Maldives cultural installation, never as a claim that Hanifaru Bay physically exists there.",
  1589: "The quartet stands outdoors on a protected Kepler-186 f surface observation platform beneath a transparent pressure field and open-sided shield at deep violet dusk. The planet terrain, bright horizon band and sky dominate. Fuvahmulah, Thoondu white surf, palm rim, kilhi wetland contours and reef arcs appear as a large Maldives cultural installation, never as a claim that the Earth island physically exists there.",
  1590: "The cast stands outdoors on a protected TOI-700 d surface lounge platform beneath a transparent pressure field and open-sided shield at golden-hour sunrise. The planet terrain, long warm rays and horizon dominate. Addu horseshoe lagoon, linked-island causeway, reef passes and seagrass channels appear as a large Maldives cultural installation, never as a claim that the Earth atoll physically exists there.",
  1591: "The quartet stands outdoors on a protected TOI-700 d surface banquette beneath a transparent pressure field and open-sided shield at deep violet dusk. The planet terrain, bright horizon band and sky dominate. Baa micro-atoll rings, lagoon shelves, reef chains and mangrove islets appear as a large Maldives cultural installation, never as a claim that the Earth atoll physically exists there.",
};

const razeText = (plan) => {
  const [first, second] = plan.raze.sockWearers;
  const firstSides = plan.raze.sideAssignments[first];
  const secondSides = plan.raze.sideAssignments[second];
  return `Exactly ${first} and ${second} wear complete opaque rainbow-gradient RAZE knee-high pairs directly on uncovered legs. ${first}: ${firstSides.left} left and ${firstSides.right} right, ${firstSides.wordmarkOrientation}. ${second}: ${secondSides.left} left and ${secondSides.right} right, ${secondSides.wordmarkOrientation}. Each branded sock carries a single restrained outer upper-calf mark. ${plan.raze.bareLegCharacters.join(" and ")} have bare lower legs with no hosiery. Keep uninterrupted skin above every sock band.`;
};
const wardrobeText = (plan) => Object.values(plan.outfits).join(". ");
const safetyText = "All garments are secure, lined and opaque across bust, seat, pelvis and intimate areas. Keep the lens outside garment volume and away from the space between legs. Every person has two traceable arms and hands, two complete legs and feet, separated silhouettes, visible joints, a clear task for every hand and complete footwear. No exposed underwear, accidental exposure, coercion, sexual activity, gross anatomy defect, extra woman, watermark or visible text beyond exact RAZE sock marks.";
const missionText = "ECE holds a small closed gold route lantern safely in both hands. Omit large calibration frames and weapon-like forms.";

const actionText = {
  1588: "A fourteen-degree Dutch tilt and close diagonal depth keep every adult head-to-shoe. Radiance rests sideways across Ellie's stable lap while Alia gives Radiance a brief closed-mouth cheek peck. Ellie supports Radiance and watches Alia with calm visible jealousy; ECE leans close through a warm eye-line. Keep complete heels and zero static lineup.",
  1589: "A safe floor-adjacent front-quarter view reads complete heels, uncovered legs, opaque hem side seams, torsos and faces. Ellie turns inside Radiance's behind hug and gives Radiance a brief closed-mouth cheek peck. Alia catches Ellie's free hand with a calm jealous raised brow; ECE joins through a shoulder-level side-hug eye-line. Keep diagonal motion and zero static lineup.",
  1590: "A close high-oblique view with mild Dutch roll and diagonal foreshortening frames Alia sideways across Radiance's stable lap while Ellie gives Alia a brief closed-mouth temple peck. Radiance supports Alia through a warm side hug. ECE shows calm jealousy; the established clearly adult athletic bearded man stands behind ECE and returns his gaze to her without replacing any woman.",
  1591: "A strong canted moving portrait places Radiance's blonde face and hair in the near foreground with her complete heel and opaque skirt side seam visible. Ellie steps through Alia's behind hug as Alia gives Ellie a brief closed-mouth cheek peck. Radiance catches Alia's free hand with calm jealousy; ECE answers from close diagonal depth. Keep exactly four women and zero static lineup.",
};

const prompts = {};
for (const scene of [1588, 1589, 1590, 1591]) {
  const plan = checkpoint.scenePlans[String(scene)];
  const maleText = plan.maleModel.present ? " The established clearly adult athletic bearded man is an additional fifth figure behind ECE; he does not replace a woman and never wears RAZE socks." : " No male figure appears.";
  const primary = `Render Maldives Scene ${scene} as a vertical 1152 by 2048 realistic cinematic fashion image. ${faceText}${maleText}\n\n${settingText[scene]}\n\n${actionText[scene]} ${missionText}\n\n${razeText(plan)}\n\nWardrobe: ${wardrobeText(plan)}. ${safetyText}`;
  const fallback = `Render a simplified Maldives Scene ${scene} vertical realistic cinematic fashion image. ${faceText}${maleText} ${settingText[scene]} ${actionText[scene]} ${missionText} ${razeText(plan)} Keep secure opaque cocktail minis, skorts, short rompers and cropped sets with large Maldives motifs. ${safetyText}`;
  prompts[scene] = {
    primary: writePrompt(`${root}/scene-${scene}-meta-successor-e-primary-surface.txt`, primary),
    fallback: writePrompt(`${root}/scene-${scene}-meta-successor-e-fallback-surface.txt`, fallback),
  };
}

const lexiconBytes = fs.readFileSync(lexiconPath);
const lexiconRows = lexiconBytes.toString("utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
const blacklist = [...new Set(lexiconRows.filter((row) => row.blacklisted === true && Number(row.suppressionCounter) >= 3 && row.candidate).map((row) => row.candidate.toLowerCase()))].sort();
const tokens = (text) => text.toLowerCase().match(/[a-z0-9]+(?:-[a-z0-9]+)*/g) ?? [];
const hasCandidate = (text, candidate) => {
  const haystack = tokens(text);
  const needle = tokens(candidate);
  for (let index = 0; index <= haystack.length - needle.length; index += 1) {
    if (needle.every((word, offset) => haystack[index + offset] === word)) return true;
  }
  return false;
};
for (const prompt of Object.values(prompts).flatMap((entry) => Object.values(entry))) {
  const conflicts = blacklist.filter((candidate) => hasCandidate(prompt.text, candidate));
  if (conflicts.length) throw new Error(`${prompt.path} contains run-blacklisted terms: ${conflicts.join(", ")}`);
}

checkpoint.preparedRollingPrompts ??= {};
checkpoint.preparedRollingPrompts.surfaceSuccessorE = prompts;
checkpoint.rollingLexiconSnapshot = {
  path: lexiconPath,
  sha256: sha256(lexiconBytes),
  bytes: lexiconBytes.length,
  observedAt: requestedAt,
  blacklist,
};
const eventId = "batch-392-planetary-surface-or-habitat-third-policy-applied";
if (!checkpoint.events.some((event) => event.eventId === eventId)) checkpoint.events.push({
  eventId,
  eventType: "policy-and-prompt-bank-prepared",
  occurredAt: requestedAt,
  contractSha256,
  settingBindings: bindings,
  automationId: "starlight-internalagency-24-7-guardian",
  automationCadence: "five-minute heartbeat",
  preparedPromptShas: Object.fromEntries(Object.entries(prompts).map(([scene, entry]) => [scene, { primary: entry.primary.sha256, fallback: entry.fallback.sha256 }])),
});
checkpoint.status = "active-continuous-meta-successor-e-surface-bank-prepared-awaiting-policy-push";
checkpoint.rollingState = {
  recordedAt: requestedAt,
  candidateUnderInspection: "none; the prior four hard-unusable candidates are archived at remote commit 636efdd42aa9e151211ab20aec044f0fceb36ddb",
  nextCandidateInFlight: "none pending this policy and prompt-bank commit, explicit push and remote verification",
  candidateNPlus2Gate: "closed until the exterior-setting policy and successor-E prompt hashes reach remote parity",
  preparedNextDispatch: "successor-E primary plus fallback for scenes 1588 through 1591, with reference upload retry before text-only continuation",
};
fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  contractSha256,
  checkpointSha256: sha256(fs.readFileSync(checkpointPath)),
  lexiconSha256: checkpoint.rollingLexiconSnapshot.sha256,
  blacklistCount: blacklist.length,
  settings: bindings,
  promptShas: Object.fromEntries(Object.entries(prompts).map(([scene, entry]) => [scene, { primary: entry.primary.sha256, fallback: entry.fallback.sha256 }])),
}, null, 2));
