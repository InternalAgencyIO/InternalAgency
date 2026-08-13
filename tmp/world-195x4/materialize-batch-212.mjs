import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const campaignPath = path.resolve("assets/lore/starlight-era/world-195x4-campaign.json");
const videoManifestPath = path.resolve("assets/lore/starlight-era/world-15s-video-manifest.json");
const root = path.resolve("tmp/world-195x4/batch-212");
const checkpointPath = path.join(root, "runtime-checkpoint.json");
const parentCorpusSha256 = "26c0f2251ed253ec70b455a1cce10075851ea8fca73507bcf9c858d2fc6abb26";
const sourcePreflightPath = path.resolve(`tmp/world-195x4/batch-211/preflight/blocklist-transform-${parentCorpusSha256}.json`);
const startedAt = "2026-08-05T09:34:11.987Z";
const characters = ["Radiance", "Ellie", "Alia"];
const baseTraitCount = 13;

const aggregateEvidence = {
  batch: 211,
  sceneNumber: null,
  attempt: 1,
  stage: "four-lane clean foundation generation",
  outcome: "blocked",
  moderationStage: "output",
  moderationCategory: "sexual",
  requestId: "afbb4219-1b2c-410b-8cd7-5c7528b640b6",
  suspectedTermFamilies: [
    "aggregate rendered-pixel risk across one unidentified lane; no prompt term family inferred"
  ],
  exactPrompt: null,
  candidatePromptCount: 4,
  laneOwnership: "unresolved",
  evidence: "No renderer result or file surfaced; all four aggregate results were rejected as ambiguous."
};

function sha(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

const corpusSha256 = sha(JSON.stringify([parentCorpusSha256, aggregateEvidence]));
const preflightRelativePath = `tmp/world-195x4/batch-212/preflight/blocklist-transform-${corpusSha256}.json`;
const preflightPath = path.resolve(preflightRelativePath);

const sceneSpecs = [
  {
    number: 868,
    slug: "democratic-republic-of-the-congo-kinshasa-pool-malebo-route-light-grid",
    title: "Democratic Republic of the Congo — Kinshasa Pool Malebo Aircrew Route-Light Grid",
    location: "an unmistakable Kinshasa Congo River waterfront overlooking broad Pool Malebo and the distant Brazzaville shore at sapphire-and-gold evening, on an empty fictional secure observation deck",
    roles: { Radiance: "captain", Ellie: "first officer", Alia: "cabin host" },
    mission: "align cobalt, copper and pearl route lights into one completed Congo River navigation grid",
    relationship: "Radiance holds the center command control while Ellie and Alia work separate side controls; their warm coordinated glances show trusted professional camaraderie with clear space between bodies and hands",
    fashion: "three different sculptural black-tie gala aircrew silhouettes in cobalt, warm red, optical white, copper and pearl, with Congo River wave seams, contemporary raffia-inspired weave geometry and concise secure opaque tailoring; distinct complete stilettos, platforms and couture flight boots",
    localAccessories: "a contemporary woven evening clutch, a copper route cuff and a pearl river-line collar accent divided across the trio",
    companionAction: "paws-up-request",
    directWomanInteraction: true,
    companionInteraction: "tiny PAWS stands naturally on the ground with both forepaws raised toward Radiance; Radiance notices her and reaches one open hand down while keeping the completed route grid visible",
    triggeredVisuals: "Radiance has one fine metallic route-line seam across a fully opaque rear garment panel plus fixed decorative geometric back-panel lacing. Ellie wears one angular cuff on one wrist. Alia wears one separate cuff on each wrist with her hands spaced apart and fully free, plus an ornate metallic tailored waist belt over her fully opaque principal garment.",
    expectedTriggered: [
      "Radiance.lowBackDressBodyChain",
      "Radiance.corsetBackPanelLacing",
      "Ellie.sculpturalCuff",
      "Alia.pairedWristCuffPose",
      "Alia.metallicCorsetBeltReveal"
    ]
  },
  {
    number: 869,
    slug: "democratic-republic-of-the-congo-lubumbashi-copperbelt-cabin-signal-cipher",
    title: "Democratic Republic of the Congo — Lubumbashi Copperbelt Aircrew Signal Cipher",
    location: "Lubumbashi's broad tree-lined copper-city boulevard and recognizable Art Deco civic skyline at copper-gold blue hour, staged as an empty fictional signal-cabin terrace without readable signs",
    roles: { Radiance: "first officer", Ellie: "cabin host", Alia: "captain" },
    mission: "decode a completed cobalt-and-copper cabin-signal cipher on a compact stable service console",
    relationship: "Ellie and Alia exchange a brief confident smile across separate console stations while Radiance gives an amused side glance from her own route control; all hands remain task-focused and clearly separated",
    fashion: "three different sculptural black-tie gala aircrew silhouettes in copper, cobalt, warm red, optical white, black and pearl, using abstract mineral facets and contemporary woven geometry on secure fully opaque garments; distinct complete heeled sandals, platforms and couture flight boots",
    localAccessories: "a copper-facet clutch, a contemporary woven collar piece and a pearl signal cuff divided across the trio",
    companionAction: "crystal-pounce",
    directWomanInteraction: false,
    companionInteraction: "tiny PAWS makes a very short ground-level hop toward one large stable non-breakable cobalt mission crystal on a broad padded mat; Alia points to the same light and smiles while preserving a clear landing zone",
    triggeredVisuals: "Radiance wears an original swept gala hairstyle, one tiny refined upper-ear gold stud, a coordinated focused gaze toward the cipher, and one fine metallic route-line seam across a fully opaque rear garment panel. Ellie wears a satin visor carried fully above the brow, one abstract removable gold garment applique on the shoulder, fixed geometric back-panel lacing on opaque fabric, and glossy long gloves with small decorative ring hardware. Alia wears an original braided gala hairstyle with one thin woven cord, one abstract removable gold garment applique on the shoulder, one puzzle ring turned by a free hand, and a pearl-trimmed satin collar accent that leaves her face and eyes fully visible.",
    expectedTriggered: [
      "Radiance.hairVariation",
      "Radiance.facePiercing",
      "Radiance.mirroredHeavyLiddedGaze",
      "Radiance.lowBackDressBodyChain",
      "Ellie.maskChainGoldLeafCombo",
      "Ellie.corsetBackPanelLacing",
      "Ellie.ringHardwareOperaGloves",
      "Alia.hairVariation",
      "Alia.braidedCraftCord",
      "Alia.goldLeafShoulderBodyArt",
      "Alia.puzzleRingTwirl",
      "Alia.pearlEyeMaskNeckAccent"
    ]
  },
  {
    number: 870,
    slug: "democratic-republic-of-the-congo-virunga-nyiragongo-star-map-relay",
    title: "Democratic Republic of the Congo — Virunga Nyiragongo Aircrew Star-Map Relay",
    location: "the Virunga rainforest with the distant Nyiragongo volcanic ridge at luminous emerald-and-gold dawn, viewed from a broad secure fictional observation deck far from every hazard",
    roles: { Radiance: "cabin host", Ellie: "captain", Alia: "first officer" },
    mission: "relay three completed emerald, cobalt and copper star-map arcs across a low navigation display",
    relationship: "Radiance and Alia mirror one another at opposite mission stations while Ellie connects the formation from the central command display through matching sight lines; all three remain visibly distinct and task-focused",
    fashion: "three different sculptural black-tie gala aircrew silhouettes in emerald, cobalt, copper, warm red, optical white and black, using abstract rainforest-canopy and volcanic-ridge seam geometry over secure fully opaque construction; distinct complete stilettos, platforms and couture flight boots",
    localAccessories: "a contemporary woven canopy clutch, a copper ridge collar accent and an emerald route cuff divided across the trio",
    companionAction: "ribbon-chase",
    directWomanInteraction: true,
    companionInteraction: "Radiance holds one end of a broad harmless loose mission ribbon in a low slack curve while tiny PAWS actively bats the detached trailing end on the padded deck; Radiance looks down and guides the play away from all footwear",
    triggeredVisuals: "Radiance wears a solid opaque geometric rear-panel design over a matching opaque underlayer. Ellie has an original low-twist gala hairstyle and two separate wide cuffs with no connector, her hands spaced apart and free. Alia wears one angular sculptural cuff on one wrist.",
    expectedTriggered: [
      "Radiance.lowBackOpenPanelGarment",
      "Ellie.hairVariation",
      "Ellie.chainAccentWideCuffDuo",
      "Alia.sculpturalCuff"
    ]
  },
  {
    number: 871,
    slug: "democratic-republic-of-the-congo-kisangani-boyoma-falls-arrival-beacon-finale",
    title: "Democratic Republic of the Congo — Kisangani Boyoma Falls Aircrew Arrival Beacon",
    location: "Boyoma Falls near Kisangani with broad Congo River channels and dense forest at warm sunrise, staged on an empty secure fictional arrival platform well clear of the water",
    roles: { Radiance: "captain", Ellie: "first officer", Alia: "cabin host" },
    mission: "seal one completed pearl, cobalt and copper arrival beacon around a stable glowing console",
    relationship: "the trio forms a balanced close victory triangle around the completed beacon with small clear gaps, three distinct clean faces and shared satisfied smiles",
    fashion: "three different sculptural black-tie gala aircrew silhouettes in pearl, cobalt, copper, warm red, optical white and black, using abstract waterfall ribbons and river-channel geometry on concise secure fully opaque tailoring; distinct complete heeled sandals, platforms and couture flight boots",
    localAccessories: "a contemporary woven river clutch, a pearl falls collar accent and a copper navigation cuff divided across the trio",
    companionAction: "console-inspector",
    directWomanInteraction: false,
    companionInteraction: "tiny PAWS walks beside the low stable beacon console with tail raised and one forepaw reaching toward a harmless pearl light; Ellie notices and points to the same light while making clear space for the kitten",
    triggeredVisuals: "No optional appearance roll triggered; keep this lane deliberately simple and clean.",
    expectedTriggered: []
  }
];

function firstEight(seed) {
  return sha(seed).slice(0, 8);
}

function roll(seed, modulus) {
  return Number.parseInt(firstEight(seed), 16) % modulus;
}

function triggered(trait, result) {
  const match = trait.trigger.match(/0 through (\d+)/);
  if (!match && /roll 0 only/.test(trait.trigger)) return result === 0;
  if (!match) throw new Error(`Unparseable trigger for ${trait.trait}`);
  return result <= Number(match[1]);
}

function matchingClose(source, openIndex) {
  const open = source[openIndex];
  const close = open === "{" ? "}" : open === "[" ? "]" : null;
  if (!close) throw new Error(`Unsupported JSON opener at ${openIndex}`);
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === open) depth += 1;
    else if (char === close && --depth === 0) return index;
  }
  throw new Error(`Unclosed JSON value at ${openIndex}`);
}

function topLevelValueRange(source, key) {
  const marker = `\n  "${key}": `;
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) throw new Error(`Missing top-level key ${key}`);
  const start = markerIndex + marker.length;
  const opener = source[start];
  if (opener === "{" || opener === "[") return [start, matchingClose(source, start) + 1];
  let end = source.indexOf("\n", start);
  if (end < 0) end = source.length;
  if (source[end - 1] === ",") end -= 1;
  return [start, end];
}

function nestedArrayRange(source, key, searchStart = 0) {
  const marker = `"${key}": [`;
  const markerIndex = source.indexOf(marker, searchStart);
  if (markerIndex < 0) throw new Error(`Missing array ${key}`);
  const start = markerIndex + marker.length - 1;
  return [start, matchingClose(source, start) + 1];
}

function replaceTopLevelValue(source, key, value, pretty = false) {
  const [start, end] = topLevelValueRange(source, key);
  let replacement = pretty ? JSON.stringify(value, null, 2) : JSON.stringify(value);
  if (pretty) replacement = replacement.replaceAll("\n", "\n  ");
  return source.slice(0, start) + replacement + source.slice(end);
}

const raw = fs.readFileSync(campaignPath, "utf8");
const campaign = JSON.parse(raw);
const videoManifest = JSON.parse(fs.readFileSync(videoManifestPath, "utf8"));
if (campaign.nextBatch !== 212 || campaign.nextNumber !== 868) throw new Error("Campaign counters moved; refusing stale Batch 212 materialization");
if (campaign.plannedBatches.some((batch) => batch.batch === 212)) throw new Error("Batch 212 already materialized");
const priorBatch = campaign.plannedBatches.find((batch) => batch.batch === 211);
if (!priorBatch || !String(priorBatch.status).startsWith("completed")) throw new Error("Batch 211 is not authoritatively complete");
if (!campaign.companionCast.promotionOverride || campaign.companionCast.promotionOverride.status !== "active") throw new Error("PAWS promotion override is not active");
if (212 < campaign.companionCast.promotionOverride.batchFirst || 212 > campaign.companionCast.promotionOverride.batchLast) throw new Error("Batch 212 is outside the active PAWS promotion range");
if (!fs.existsSync(sourcePreflightPath)) throw new Error("Missing current preflight cache");
if (fs.existsSync(root)) throw new Error("Batch 212 durable root already exists");
if (campaign.rendererCollaborationLexicon.masterAttemptLog.some((item) => item.requestId === aggregateEvidence.requestId)) throw new Error("Aggregate moderation evidence was already appended");

const contract = campaign.expansionPacks[0].appearanceVariationContract;
const characterTraits = contract.traits.filter((trait) => trait.scope !== "trio-static");
const trioTraits = contract.traits.filter((trait) => trait.scope === "trio-static");
if (characterTraits.length !== 84 || trioTraits.length !== 20) throw new Error("Unexpected mutable trait counts");
const oddsAndScopesSha256 = sha(JSON.stringify(contract.traits.map((trait) => [trait.scope ?? "character", trait.trait, trait.rollScale ?? 100, trait.trigger, trait.probability])));
const usedActionIndexes = new Set();

const scenes = sceneSpecs.map((spec) => {
  const appearanceRolls = {};
  const fullTuples = [];
  const triggeredDetails = [];
  for (const character of characters) {
    const stored = {};
    characterTraits.forEach((trait, index) => {
      const modulus = trait.rollScale ?? 100;
      const result = roll(`${spec.number}|${character}|${trait.trait}|mile-high-v1`, modulus);
      fullTuples.push([character, trait.trait, result]);
      const didTrigger = triggered(trait, result);
      if (index < baseTraitCount || didTrigger) stored[trait.trait] = result;
      if (didTrigger) triggeredDetails.push(`${character}.${trait.trait}`);
    });
    appearanceRolls[character] = stored;
  }
  const trioStaticRolls = {};
  for (const trait of trioTraits) {
    const result = roll(`${spec.number}|trio|${trait.trait}|mile-high-v1`, 1000);
    fullTuples.push(["trio", trait.trait, result]);
    if (triggered(trait, result)) {
      trioStaticRolls[trait.trait] = result;
      triggeredDetails.push(`trio.${trait.trait}`);
    }
  }
  if (JSON.stringify(triggeredDetails) !== JSON.stringify(spec.expectedTriggered)) {
    throw new Error(`Triggered roll drift for ${spec.number}: ${JSON.stringify(triggeredDetails)}`);
  }

  const presenceSeed = `${spec.number}|companion|PAWS|mile-high-v1`;
  const actionSeed = `${spec.number}|companion-action|PAWS|mile-high-v2`;
  const presenceRoll = roll(presenceSeed, 100);
  const rawActionRoll = roll(actionSeed, 6);
  let resolvedActionIndex = rawActionRoll;
  while (usedActionIndexes.has(resolvedActionIndex)) resolvedActionIndex = (resolvedActionIndex + 1) % campaign.companionCast.actionContract.actions.length;
  usedActionIndexes.add(resolvedActionIndex);
  const actionName = campaign.companionCast.actionContract.actions[resolvedActionIndex].split(":", 1)[0];
  if (actionName !== spec.companionAction) throw new Error(`Resolved action mismatch for ${spec.number}: ${actionName}`);
  triggeredDetails.push("companion.PAWS", `companion.PAWS.${actionName}`);

  const companionDirective = `PAWS is mandatory. Show exactly one collarless, tagless, text-free, approximately two-month-old female NY11 golden British Shorthair kitten: unmistakably tiny body, oversized round baby face, large green eyes, two small rounded ears, four short legs, one tail, clean readable paws, and baby-soft luminous honey-apricot-gold fur with a pale warm-gold undercoat and fine cinnamon-gold tipping. Action beat: ${spec.companionInteraction}.`;
  const brief = `Create one clean integrated vertical full-length cinematic luxury aviation-fashion photograph at ${spec.location}. Exactly three clearly adult fictional women, using the same three distinct canonical identities as the approved references: blonde Radiance is the STAR RAZE ${spec.roles.Radiance}, short dark-bob Ellie is the STAR RAZE ${spec.roles.Ellie}, and dark-auburn-curled Alia is the STAR RAZE ${spec.roles.Alia}. The first read is a professional three-woman aircrew editorial and a completed harmless mission: they ${spec.mission}. Give each role a visibly distinct couture control cue without literal uniforms. Fashion: ${spec.fashion}. Local secular accessories: ${spec.localAccessories}. Composition: ${spec.relationship}. Integrated deterministic details: ${spec.triggeredVisuals} ${companionDirective} Keep three clean natural photorealistic faces with no glitter, gems, symbols, stickers or metallic flecks on skin; readable natural hands; complete anatomy; all six complete shoes; solid opaque secure coverage; and the recognizable Democratic Republic of the Congo setting. Keep PAWS active, kitten-small and richly golden, with no duplicated feline anatomy and no obstruction of any face, hand, mission device, landmark, garment or shoe. No literal flag, official or sacred emblem, politics, readable text, logo, real airline, extra person, second animal, weapon, watermark, transparent fabric or exposed intimate area.`;
  const file = `${spec.slug}.png`;
  const foundationPlan = {
    country: "Democratic Republic of the Congo",
    location: spec.location,
    roles: spec.roles,
    mission: spec.mission,
    relationship: spec.relationship,
    companionAction: { name: actionName, instruction: spec.companionInteraction, directWomanInteraction: spec.directWomanInteraction },
    triggeredDetails,
    safeTriggeredVisuals: spec.triggeredVisuals,
    cleanFaceGate: true,
    passPolicy: "One clean integrated foundation. Reject a failing lane and restart only that lane from a fresh foundation; do not build an artifact-prone dependent edit chain.",
    technicalInvariants: [
      "vertical full-length composition",
      "exactly three clearly adult canonical fictional women",
      "three distinct aircrew roles and one completed mission",
      "exactly one tiny two-month-old richly golden PAWS kitten",
      "active reciprocal PAWS action",
      "clean natural faces and readable hands",
      "all six complete shoes",
      "solid opaque secure couture",
      "no readable text or logo"
    ]
  };

  return {
    number: spec.number,
    slug: spec.slug,
    title: spec.title,
    location: spec.location,
    brief,
    file,
    companionDirective,
    videoAnchor: false,
    companionRolls: {
      PAWS: {
        seed: presenceSeed,
        firstEightHex: firstEight(presenceSeed),
        baseRoll: presenceRoll,
        baseTriggered: presenceRoll <= 39,
        promotionOverrideTriggered: true,
        effectiveTriggered: true,
        growthStage: campaign.companionCast.growthContinuity.currentStage,
        growthEpoch: campaign.companionCast.growthContinuity.currentEpoch
      }
    },
    companionActionRoll: {
      seed: actionSeed,
      firstEightHex: firstEight(actionSeed),
      rawActionRoll,
      resolvedActionIndex,
      collisionAdjusted: resolvedActionIndex !== rawActionRoll,
      actionName,
      actionContractSha256: campaign.companionCast.actionContractSha256
    },
    appearanceRolls,
    trioStaticRolls,
    rollAudit: {
      characterTraitCount: characterTraits.length,
      trioTraitCount: trioTraits.length,
      oddsAndScopesSha256,
      fullRollsSha256: sha(JSON.stringify(fullTuples)),
      hashEncoding: "SHA-256 of JSON ordered [scope,trait,roll] tuples in canonical character then trait order",
      storage: "base rolls plus every triggered roll; all 84 character and 20 trio-static traits evaluated from the current mutable master"
    },
    renderState: {
      status: "queued-clean-foundation",
      lastValidStage: "planned",
      lastValidAsset: null,
      attempts: 0,
      blocker: null,
      retryVariantRolls: [],
      identityReferences: [
        "468-france-paris-la-defense-prism-intercept.png",
        "471-france-nice-promenade-night-relay.png"
      ],
      preflight: {
        status: "passed",
        blockedCorpusSha256: corpusSha256,
        cache: preflightRelativePath,
        order: "longest-phrase-first"
      },
      foundationPlan,
      stages: {
        foundation: "queued",
        relationship: "integrated-in-foundation",
        silhouette: "integrated-in-foundation",
        refinement: "not-planned",
        triggeredDetails: "integrated-in-foundation",
        companion: "integrated-in-foundation",
        validation: "pending"
      },
      blockedPrompts: [],
      detailProgress: { completed: [], remaining: triggeredDetails }
    },
    status: "planned-clean-foundation"
  };
});

if (new Set(scenes.map((scene) => scene.companionActionRoll.actionName)).size !== 4) throw new Error("Promotion batch requires four distinct PAWS actions");
if (sceneSpecs.filter((scene) => scene.directWomanInteraction).length < 2) throw new Error("Promotion batch requires two direct woman-to-PAWS interactions");

const batch = {
  batch: 212,
  continent: "Africa",
  country: "Democratic Republic of the Congo",
  countrySlug: "democratic-republic-of-the-congo",
  theme: "STAR RAZE Three-Woman Aircrew Editorial — Democratic Republic of the Congo Black-Tie Gala Couture",
  status: "planned-clean-foundation",
  bonusExpansion: true,
  renderTiming: {
    startedAt,
    targetMinutes: 45,
    firstFoundationAt: null,
    validationCompletedAt: null,
    elapsedMinutes: null,
    withinTarget: null,
    overrunReason: null
  },
  preflight: {
    status: "passed",
    blockedCorpusSha256: corpusSha256,
    parentCorpusSha256,
    cache: preflightRelativePath,
    compiledAt: startedAt,
    order: "longest-phrase-first",
    aggregateEvidenceRequestId: aggregateEvidence.requestId
  },
  scenes,
  videoPause: {
    status: "not-scheduled-on-image-wake",
    videoManifestStatus: videoManifest.status,
    videoManifestNextBatch: videoManifest.nextVideoBatch,
    priorFourPngPauseResumeBatch: videoManifest.pause?.resumeBatch ?? null,
    reason: "Image rendering remains the primary lane workload; no duplicate video process is authorized."
  }
};

let updated = raw;
const [plannedStart, plannedEnd] = topLevelValueRange(updated, "plannedBatches");
const plannedArray = JSON.parse(updated.slice(plannedStart, plannedEnd));
if (plannedArray.some((item) => item.batch === 212)) throw new Error("Batch 212 appeared during materialization");
updated = updated.slice(0, plannedEnd - 1) + `,\n    ${JSON.stringify(batch)}\n  ` + updated.slice(plannedEnd - 1);

const lexiconMarker = updated.indexOf('\n  "rendererCollaborationLexicon": ');
if (lexiconMarker < 0) throw new Error("Missing renderer collaboration lexicon");
const [logStart, logEnd] = nestedArrayRange(updated, "masterAttemptLog", lexiconMarker);
const currentLog = JSON.parse(updated.slice(logStart, logEnd));
if (currentLog.some((item) => item.requestId === aggregateEvidence.requestId)) throw new Error("Aggregate evidence appeared during materialization");
updated = updated.slice(0, logEnd - 1) + `,\n      ${JSON.stringify(aggregateEvidence)}\n    ` + updated.slice(logEnd - 1);

updated = replaceTopLevelValue(updated, "activeRenderCheckpoint", {
  batch: 212,
  country: "Democratic Republic of the Congo",
  status: "planned-materialized-clean-foundations",
  updatedAt: startedAt,
  checkpoint: "tmp/world-195x4/batch-212/runtime-checkpoint.json",
  sceneNumbers: scenes.map((scene) => scene.number),
  pawsActions: scenes.map((scene) => ({
    number: scene.number,
    rawActionRoll: scene.companionActionRoll.rawActionRoll,
    resolvedActionIndex: scene.companionActionRoll.resolvedActionIndex,
    collisionAdjusted: scene.companionActionRoll.collisionAdjusted,
    action: scene.companionActionRoll.actionName
  })),
  preflightCorpusSha256: corpusSha256,
  nextAction: "Launch exactly four distinct preflighted Batch 212 clean foundations concurrently; freeze accepted lanes and restart only failed lanes from fresh foundations."
}, true);
JSON.parse(updated);

const preflight = JSON.parse(fs.readFileSync(sourcePreflightPath, "utf8"));
preflight.wakeAt = startedAt;
preflight.batch = 212;
preflight.country = "Democratic Republic of the Congo";
preflight.hashAlgorithm = "SHA-256 of JSON ordered [parentCorpusSha256, aggregateModerationEvidence]";
preflight.parentCorpusSha256 = parentCorpusSha256;
delete preflight.appendedExactPromptCount;
preflight.appendedAggregateBlockCount = 1;
preflight.aggregateModerationEvidence = aggregateEvidence;
preflight.blockedCorpusSha256 = corpusSha256;
preflight.order = "longest-phrase-first";
preflight.transformations = preflight.transformations.map((entry) => {
  if (entry.riskyPhrase === "lowBackDressBodyChain") return { ...entry, safeEquivalent: "fine metallic route-line seam across the fully opaque rear garment panel" };
  if (entry.riskyPhrase === "chainAccentWideCuffDuo") return { ...entry, safeEquivalent: "two separate angular cuffs with no connector and both hands spaced apart" };
  return entry;
}).sort((left, right) => right.riskyPhrase.length - left.riskyPhrase.length || left.riskyPhrase.localeCompare(right.riskyPhrase));
preflight.foundationRule = "Materialize identity, country, location, role, completed mission, professional relationship geometry, silhouette, every deterministic triggered detail, exact PAWS action, clean-face gate and technical invariants once. Use one integrated clean foundation per lane, remove redundant negative vocabulary, and restart only a failed lane from a fresh foundation rather than stacking dependent edits.";
preflight.outputBlockRule = "The new evidence is aggregate output moderation with unresolved lane ownership. It does not blacklist a phrase or scene by itself. Every Batch 212 lane uses conservative task-focused spacing, fully opaque garments, clean natural faces and no exposed-skin, body-mark or intimate-contact wording.";

const checkpoint = {
  schema: "world-195x4-render-checkpoint-v1",
  batch: 212,
  country: "Democratic Republic of the Congo",
  updatedAt: startedAt,
  status: "planned-materialized-clean-foundations",
  preflight: {
    parentCorpusSha256,
    blockedCorpusSha256: corpusSha256,
    cache: preflightRelativePath,
    order: "longest-phrase-first",
    aggregateEvidenceRequestId: aggregateEvidence.requestId,
    recompileRequired: false
  },
  passPolicy: "One integrated foundation per lane. Reject artifacted outputs and restart only the affected lane from a fresh foundation; no incremental detail chain is planned.",
  lanes: scenes.map((scene) => ({
    scene: scene.number,
    file: scene.file,
    status: "queued-clean-foundation",
    attempts: 0,
    lastValidStage: "planned",
    lastValidAsset: null,
    planSha256: sha(JSON.stringify(scene.renderState.foundationPlan)),
    pawsAction: scene.companionActionRoll.actionName,
    collisionAdjusted: scene.companionActionRoll.collisionAdjusted,
    nextStage: "clean-foundation"
  })),
  rejectedCandidates: [],
  publicBuild: {
    status: "pending-foundations",
    commit: null,
    rejectedMediaPublished: false
  },
  moderationBlocks: []
};

fs.mkdirSync(path.dirname(preflightPath), { recursive: true });
fs.mkdirSync(path.join(root, "foundations"), { recursive: true });
fs.writeFileSync(preflightPath, `${JSON.stringify(preflight, null, 2)}\n`, "utf8");
fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
fs.writeFileSync(path.join(root, "scene-plan.json"), `${JSON.stringify(batch, null, 2)}\n`, "utf8");
fs.writeFileSync(campaignPath, updated, "utf8");

console.log(JSON.stringify({
  batch: 212,
  country: "Democratic Republic of the Congo",
  corpusSha256,
  masterAttemptLogCount: campaign.rendererCollaborationLexicon.masterAttemptLog.length + 1,
  scenes: scenes.map((scene) => ({
    number: scene.number,
    file: scene.file,
    pawsAction: scene.companionActionRoll.actionName,
    rawActionRoll: scene.companionActionRoll.rawActionRoll,
    resolvedActionIndex: scene.companionActionRoll.resolvedActionIndex,
    collisionAdjusted: scene.companionActionRoll.collisionAdjusted,
    triggeredDetails: scene.renderState.foundationPlan.triggeredDetails
  })),
  preflight: preflightRelativePath
}, null, 2));
