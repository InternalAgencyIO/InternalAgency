#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";

const contractPath = "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json";
const checkpointPath = "assets/lore/starlight-era/batch-392-maldives-orbital-research-station-checkpoint.json";
const rejectedLedgerBindingCheckpointPath = "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json";
const preflightPath = "tmp/world-195x4/batch-392/batch-392-maldives-preflight.json";
const policyEvidencePath = "tmp/world-195x4/batch-392/batch-392-planetary-environment-policy.json";
const promptRoot = "tmp/world-195x4/batch-392";
const requestedAt = "2026-08-20T10:05:02.254Z";
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex").toUpperCase();
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
const fileRecord = (file) => {
  const bytes = fs.readFileSync(file);
  return { sourcePath: file, text: bytes.toString("utf8"), sha256: sha256(bytes), encoding: "utf8", bytes: bytes.length, fidelity: "runtime-launch-byte-exact" };
};
const writePrompt = (file, text) => {
  fs.writeFileSync(file, `${text.trim()}\n`, "utf8");
  return fileRecord(file);
};
const selectEqualFifth = (key) => {
  for (let counter = 0; ; counter += 1) {
    const digest = crypto.createHash("sha256").update(`${key}|${counter}`).digest();
    const firstByte = digest[0];
    if (firstByte === 255) continue;
    return { key, counter, acceptedFirstByte: firstByte, bucketIndex: firstByte % 5, digestSha256: digest.toString("hex").toUpperCase() };
  }
};

const environments = [
  { index: 0, percent: 20, id: "dusk", promptLanguage: "deep violet dusk with a bright horizon band and readable faces" },
  { index: 1, percent: 20, id: "golden-hour-sunrise", promptLanguage: "golden-hour sunrise with long warm rays and readable faces" },
  { index: 2, percent: 20, id: "sunset", promptLanguage: "saturated sunset with a coral-gold horizon and readable faces" },
  { index: 3, percent: 20, id: "night", promptLanguage: "clear night with stars, habitat practical lights and readable faces" },
  { index: 4, percent: 20, id: "extreme-weather-rain-storm", promptLanguage: "severe wind-driven rain and a distant thunderstorm beyond sealed habitat glass, with everyone dry, protected and calm" },
];
const planets = [
  { index: 0, name: "TRAPPIST-1 e", nasaCatalogUrl: "https://science.nasa.gov/exoplanet-catalog/trappist-1-e/" },
  { index: 1, name: "Proxima Centauri b", nasaCatalogUrl: "https://science.nasa.gov/exoplanet-catalog/proxima-centauri-b/" },
  { index: 2, name: "Kepler-186 f", nasaCatalogUrl: "https://science.nasa.gov/exoplanet-catalog/kepler-186-f/" },
  { index: 3, name: "LHS 1140 b", nasaCatalogUrl: "https://science.nasa.gov/exoplanet-catalog/lhs-1140-b/" },
  { index: 4, name: "TOI-700 d", nasaCatalogUrl: "https://science.nasa.gov/exoplanet-catalog/toi-700-d/" },
];
const policy = {
  active: true,
  requestedAt,
  activeFromBatch: 392,
  userDirective: "Use an exact equal fifth chance of dusk, golden-hour sunrise, sunset, night, or severe rain/storm weather, and stage every scene on a distant real planet.",
  exactDistribution: environments,
  selectionAlgorithm: {
    name: "sha256-first-byte-rejection-sampling-equal-fifth",
    environmentKey: "starlight|environment|batch-{batch}|scene-{scene}",
    planetKey: "starlight|planet|batch-{batch}|scene-{scene}",
    method: "Hash key plus a zero-based counter with SHA-256. Reject first byte 255 and rehash with the next counter. For accepted bytes 0 through 254, take byte modulo 5. Each bucket receives exactly 51 accepted byte values, so every listed outcome has exactly 20 percent probability.",
  },
  realPlanetBank: {
    source: "NASA Exoplanet Catalog",
    verifiedAt: "2026-08-20",
    catalogUrl: "https://science.nasa.gov/exoplanets/exoplanet-catalog/",
    orderedPlanets: planets,
    rule: "Select from this fixed verified bank with the separate equal-fifth selector. Never invent, rename, blend or silently substitute a planet.",
  },
  literalSettingRule: "The named real exoplanet is the literal distant setting, shown through a protected surface habitat, sealed research structure, or safe orbital facility physically associated with that planet. The current country remains the cultural and couture identity through large motifs, archive projections, research installations and landmark-derived geometry; never falsely claim the Earth landmark physically exists on the exoplanet.",
  scientificHonestyRule: "Planet names and catalog status are factual. Surface appearance, human habitation, weather and atmospheric lighting are explicitly speculative cinematic art, not claims about measured conditions or habitability.",
  extremeWeatherSafety: "The extreme-weather bucket always reads as rain, wind and storm atmosphere outside sealed protection. Preserve dry stable footing, clear adult faces, complete anatomy, landmark-inspired country reads, mascot safety, and inert-prop isolation. No disaster victims, flooding peril, strikes near people, injury or emergency framing.",
  persistenceRule: "Materialize and store the environment roll, planet roll, keys, counters, accepted bytes, digest hashes, names and prompt language before every provider dispatch. Carry the result through Meta generation, comparison, final ChatGPT clothing edit, archive and publication without rerolling.",
};

const contract = readJson(contractPath);
contract.weatherRolls.active = false;
contract.weatherRolls.supersededProspectivelyAt = requestedAt;
contract.weatherRolls.supersededFromBatch = 392;
contract.weatherRolls.supersededBy = "planetaryEnvironmentEqualFifthPolicy";
contract.planetaryEnvironmentEqualFifthPolicy = policy;
contract.cinematicThemeRotation.locationRule = "From Batch 392 onward, every scene literally occurs in a protected habitat, sealed research structure, or safe orbital facility associated with the stored named real exoplanet. Keep four distinct current-country cultural and landmark-derived reads through large couture motifs, archive projections, research installations and terrain geometry; never claim the Earth landmark physically exists on the exoplanet. Earlier batches retain their historical Earth-location rule.";
contract.cinematicThemeRotation.themeLocationFusion = "Compose the active theme, stored real exoplanet, rolled environment and country cultural identity as a single authored scene. Planet and environment are literal setting and lighting; country identity stays unmistakable through large couture motifs, archive projections, research installations and landmark-derived geometry. Preserve scientific-honesty language for speculative surfaces, weather and habitation.";
contract.cinematicThemeRotation.themeExamples.spaceAndPlanetary = "Use fictional couture inspired by pressure-shell geometry, regolith texture, orbital arcs, solar shielding, rover joints and mission-light systems inside safe infrastructure associated with the stored NASA-catalog planet. The named planet is real; surface, weather and habitation are speculative cinematic art. Never depict unprotected people in hostile conditions or imply measured habitability.";
writeJson(contractPath, contract);
const contractSha256 = sha256(fs.readFileSync(contractPath));
const rejectedLedgerBindingCheckpoint = readJson(rejectedLedgerBindingCheckpointPath);
rejectedLedgerBindingCheckpoint.contractSha256 = contractSha256;
writeJson(rejectedLedgerBindingCheckpointPath, rejectedLedgerBindingCheckpoint);

const sceneBindings = {};
for (const scene of [1588, 1589, 1590, 1591]) {
  const environmentRoll = selectEqualFifth(`starlight|environment|batch-392|scene-${scene}`);
  const planetRoll = selectEqualFifth(`starlight|planet|batch-392|scene-${scene}`);
  sceneBindings[scene] = {
    scene,
    environment: environments[environmentRoll.bucketIndex],
    environmentRoll,
    planet: planets[planetRoll.bucketIndex],
    planetRoll,
    lockedAt: requestedAt,
    rerollAllowed: false,
  };
}

const planetParagraph = (binding) => `Planet and environment lock: this scene literally takes place inside a protected research habitat associated with the real NASA-catalog exoplanet ${binding.planet.name}. Render ${binding.environment.promptLanguage}. Maldives appears as a large cultural research installation and couture motif system derived from the named atoll or island geometry, not as a claim that the Earth location exists on ${binding.planet.name}. The planet is real; its depicted surface, weather and habitation are speculative cinematic art.`;
const promptSources = {
  1588: { primary: `${promptRoot}/scene-1588-meta-successor-c-primary.txt`, fallback: `${promptRoot}/scene-1588-meta-successor-c-fallback.txt`, phase: "successor-c" },
  1589: { primary: `${promptRoot}/scene-1589-meta-successor-c-primary.txt`, fallback: `${promptRoot}/scene-1589-meta-successor-c-fallback.txt`, phase: "successor-c" },
  1590: { primary: null, fallback: `${promptRoot}/scene-1590-meta-successor-b-fallback.txt`, phase: "successor-b-fallback" },
  1591: { primary: `${promptRoot}/scene-1591-meta-successor-c-primary.txt`, fallback: `${promptRoot}/scene-1591-meta-successor-c-fallback.txt`, phase: "successor-c" },
};
const activePrompts = {};
const supersededPromptRecords = [];
for (const scene of [1588, 1589, 1590, 1591]) {
  const source = promptSources[scene];
  activePrompts[scene] = { phase: source.phase, environmentBinding: sceneBindings[scene] };
  for (const role of ["primary", "fallback"]) {
    const sourcePath = source[role];
    if (!sourcePath) continue;
    const oldRecord = fileRecord(sourcePath);
    const paragraphs = oldRecord.text.trim().split(/\r?\n\r?\n/);
    paragraphs.splice(1, 0, planetParagraph(sceneBindings[scene]));
    const destination = sourcePath.replace(/\.txt$/, "-planetary.txt");
    activePrompts[scene][role] = writePrompt(destination, paragraphs.join("\n\n"));
    supersededPromptRecords.push({ scene, phase: source.phase, role, ...oldRecord, disposition: "prepared-undispatched-superseded-by-user-planetary-environment-directive", supersededAt: requestedAt });
  }
}

const checkpoint = readJson(checkpointPath);
checkpoint.contractSha256 = contractSha256;
checkpoint.planetaryEnvironmentPolicy = { contractPath, contractSha256, policy, sceneBindings };
for (const scene of [1588, 1589, 1590, 1591]) checkpoint.scenePlans[String(scene)].planetaryEnvironment = sceneBindings[scene];
checkpoint.supersededPreparedPrompts ??= [];
for (const record of supersededPromptRecords) {
  if (!checkpoint.supersededPreparedPrompts.some((existing) => existing.sha256 === record.sha256)) checkpoint.supersededPreparedPrompts.push(record);
}
checkpoint.preparedRollingPrompts ??= {};
checkpoint.preparedRollingPrompts.planetaryActive = activePrompts;
checkpoint.policy.planetaryEnvironmentDirectiveAt = requestedAt;
checkpoint.policy.planetaryEnvironmentDistribution = "five exact equal-fifth outcomes";
checkpoint.status = "active-continuous-meta-planetary-environment-hard-coded-awaiting-authorized-browser-dispatch";
const policyEventId = "batch-392-planetary-environment-equal-fifth-policy-applied";
if (!checkpoint.events.some((event) => event.eventId === policyEventId)) checkpoint.events.push({
  eventId: policyEventId,
  eventType: "user-policy-applied-before-dispatch",
  occurredAt: requestedAt,
  contractSha256,
  distribution: environments.map(({ id, percent }) => ({ id, percent })),
  sceneBindings,
  supersededPreparedPromptShas: supersededPromptRecords.map((record) => record.sha256),
  activePromptShas: Object.fromEntries(Object.entries(activePrompts).map(([scene, records]) => [scene, Object.fromEntries(["primary", "fallback"].filter((role) => records[role]).map((role) => [role, records[role].sha256]))])),
});
checkpoint.rollingState = {
  recordedAt: requestedAt,
  candidateUnderInspection: "successor B already classified for all four scenes",
  nextCandidateInFlight: "none while the new planetary environment contract is archived, committed, pushed and remote-verified",
  candidateNPlus2Gate: "closed until planetary environment contract/checkpoint/prompt bank reaches remote parity",
  preparedNextDispatch: "planetary successor C for scenes 1588, 1589 and 1591 plus planetary successor-B fallback retry for scene 1590",
};
writeJson(checkpointPath, checkpoint);

const preflight = readJson(preflightPath);
preflight.currentContract = { path: contractPath, sha256: contractSha256, updatedAt: requestedAt };
preflight.planetaryEnvironmentPolicy = { policy, sceneBindings, activePrompts };
for (const scene of [1588, 1589, 1590, 1591]) preflight.scenePlans[String(scene)].planetaryEnvironment = sceneBindings[scene];
writeJson(preflightPath, preflight);

const evidence = {
  schemaVersion: 1,
  batch: 392,
  country: "Maldives",
  requestedAt,
  status: "hard-coded-before-next-provider-dispatch",
  contract: { path: contractPath, sha256: contractSha256 },
  policy,
  sceneBindings,
  supersededPreparedPrompts: supersededPromptRecords,
  activePromptBank: activePrompts,
};
writeJson(policyEvidencePath, evidence);

console.log(JSON.stringify({
  contractSha256,
  policyEvidenceSha256: sha256(fs.readFileSync(policyEvidencePath)),
  checkpointSha256: sha256(fs.readFileSync(checkpointPath)),
  preflightSha256: sha256(fs.readFileSync(preflightPath)),
  sceneBindings: Object.fromEntries(Object.entries(sceneBindings).map(([scene, binding]) => [scene, { environment: binding.environment.id, planet: binding.planet.name }])),
  activePromptShas: Object.fromEntries(Object.entries(activePrompts).map(([scene, records]) => [scene, Object.fromEntries(["primary", "fallback"].filter((role) => records[role]).map((role) => [role, records[role].sha256]))])),
}, null, 2));
