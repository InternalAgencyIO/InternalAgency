import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const campaignPath = path.resolve("assets/lore/starlight-era/world-195x4-campaign.json");
const root = path.resolve("tmp/world-195x4/batch-211");
const checkpointPath = path.join(root, "runtime-checkpoint.json");
const corpusHash = "26c0f2251ed253ec70b455a1cce10075851ea8fca73507bcf9c858d2fc6abb26";
const sourcePreflightPath = path.resolve(`tmp/world-195x4/batch-210/preflight/blocklist-transform-${corpusHash}.json`);
const preflightRelativePath = `tmp/world-195x4/batch-211/preflight/blocklist-transform-${corpusHash}.json`;
const preflightPath = path.resolve(preflightRelativePath);
const startedAt = "2026-08-05T00:32:53.272Z";
const characters = ["Radiance", "Ellie", "Alia"];
const baseTraitCount = 13;

const sceneSpecs = [
  {
    number: 864,
    slug: "philippines-manila-bay-gala-route-light-grid",
    title: "Philippines Manila Bay Gala Aircrew Route-Light Grid",
    location: "Manila Bay's unmistakable waterfront promenade, broad bay horizon and modern skyline at sapphire-gold evening, staged as an empty fictional black-tie flight-deck terrace",
    roles: { Radiance: "cabin host", Ellie: "captain", Alia: "first officer" },
    mission: "align three capiz-white, cobalt and warm-red route lights into a compact Manila Bay navigation grid",
    relationship: "Ellie is centered in command while Radiance draws close through a visible linked side-waist-and-hand line; Alia notices with an amused affectionate smile and remains connected at Ellie's opposite side",
    fashion: "three different concise sculptural black-tie gala aircrew silhouettes in cobalt, warm red, optical white, pearl silver and molten gold, using capiz-shell glow, banig-inspired weave geometry and fluid bay-line seams; distinct complete stilettos, platforms and couture flight boots",
    localAccessories: "a capiz-shell collar arc, a fine banig-weave evening clutch and a pearl-and-rattan wrist sculpture, divided across the trio",
    companionAction: "ribbon-chase",
    companionInteraction: "Radiance lifts one harmless loose signal-ribbon end in a broad slack curve while tiny PAWS bats at the trailing end on the ground; Radiance looks down and smiles at her",
    triggeredVisuals: "Radiance wears a sculptural gala headpiece, an original swept luminous hairstyle and fixed decorative back-seam lacing. Ellie shows one small secular shoulder-blade star-facet tattoo, a secure side-waist embrace and a separate satin wrist ribbon whose loose tail meets Alia's only inside their linked hands."
  },
  {
    number: 865,
    slug: "philippines-vigan-calle-crisologo-cabin-signal-cipher",
    title: "Philippines Vigan Calle Crisologo Gala Aircrew Cabin-Signal Cipher",
    location: "Vigan's unmistakable Calle Crisologo heritage street with stone paving, wooden bahay-na-bato facades and warm secular shop-lantern glow at blue hour, staged as an empty fictional cabin-signal gala lane with no readable signs",
    roles: { Radiance: "captain", Ellie: "first officer", Alia: "cabin host" },
    mission: "decode a completed capiz-and-copper cabin-signal cipher inside a compact inabel-pattern service console",
    relationship: "Ellie and Alia share a close private smile and linked shoulder line while Radiance gives a playful jealous look, then all three turn into a coordinated over-shoulder gala glance without breaking the trio",
    fashion: "three different concise sculptural black-tie gala aircrew silhouettes in deep indigo, warm red, optical white, black, capiz pearl and antique gold, using inabel-inspired linear weave, solihiya lattice and heritage-window geometry; distinct complete heeled sandals, platforms and couture flight boots",
    localAccessories: "an inabel evening sash, a capiz fan clutch and a fine solihiya-pattern gold cuff, divided across the trio",
    companionAction: "lap-copilot",
    companionInteraction: "Radiance holds a stable seated captain pose with tiny PAWS securely nestled across her lap, one little paw on her mission card; Radiance steadies the kitten while Ellie and Alia visibly smile toward her",
    triggeredVisuals: "Radiance wears an original sleek gala hairstyle and one compact captain headpiece. Ellie has one angular wrist sculpture, a sharply cut open-back opaque evening panel and an independently fastened chain anklet aligned playfully with Alia's separate anklet. Alia wears a distinct cabin-host headpiece, reaches toward the cipher token, carries a blunt decorative boot-side fashion wand and has one opera-gloved hand adjusting only a loose shoulder strap detail. The trio also holds one loose gold garland in separate hand segments while both side partners adjust the central cropped cape closure; every chain and closure remains slack and removable."
  },
  {
    number: 866,
    slug: "philippines-banaue-rice-terraces-star-map-relay",
    title: "Philippines Banaue Rice Terraces Gala Aircrew Star-Map Relay",
    location: "the unmistakable stepped green Banaue Rice Terraces under luminous misty emerald-gold dawn, staged on an empty broad fictional gala relay platform that never touches the fields",
    roles: { Radiance: "first officer", Ellie: "cabin host", Alia: "captain" },
    mission: "relay three completed pearl-cobalt star-map arcs across a terrace-step navigation display",
    relationship: "Radiance and Alia angle toward Ellie from mirrored sides while Ellie links them together; Radiance gives a playful jealous side-eye as Alia shares a soft mission whisper beside Ellie's ear and Ellie visibly reciprocates both connections",
    fashion: "three different concise sculptural black-tie gala aircrew silhouettes in cobalt, warm red, optical white, deep green, black and molten gold, using abstract terrace-step seam geometry and contemporary handwoven cotton accents without copying ceremonial dress; distinct complete stilettos, reflective platforms and couture flight boots",
    localAccessories: "a contemporary handwoven terrace-step clutch, a fine rattan-and-gold collar piece and a pearl-inlaid route cuff, divided across the trio",
    companionAction: "console-inspector",
    companionInteraction: "tiny PAWS walks beside the low stable star-map console with tail raised and one little paw reaching toward a harmless pearl light; Ellie notices and makes space for her",
    triggeredVisuals: "Radiance has one tiny secular outer-shoulder geometric tattoo and holds a stable low styling pose adjusting only Ellie's visible shoe buckle. Ellie wears a loose runway seam overlay and a comfortably fitted ring-choker with a separate hip-level jewelry accent. Alia wears an original curled gala hairstyle, whispers beside Ellie while keeping interlaced fingers visible and wears a layered easy-release collar necklace with one short slack ornamental connector. The trio forms a readable staggered side-profile jewelry line."
  },
  {
    number: 867,
    slug: "philippines-el-nido-bacuit-bay-arrival-beacon-finale",
    title: "Philippines El Nido Bacuit Bay Gala Aircrew Arrival-Beacon Finale",
    location: "El Nido's unmistakable Bacuit Bay limestone karsts and calm lagoon at luminous cobalt-silver moonrise, staged on an empty stationary fictional black-tie arrival deck",
    roles: { Radiance: "cabin host", Ellie: "captain", Alia: "first officer" },
    mission: "seal a completed pearl-white, cobalt and warm-red arrival beacon around one stable glowing signal orb",
    relationship: "a back-hug interruption resolves into a balanced three-way embrace and tight triangular forehead lean with all three distinct faces visible above the completed beacon",
    fashion: "three different concise sculptural black-tie gala aircrew silhouettes in cobalt, warm red, optical white, black, capiz pearl and moonlit gold, using abstract karst, lagoon-wave and mother-of-pearl geometry; distinct complete sculptural stilettos, platforms and heeled sandals",
    localAccessories: "a capiz-pearl shoulder ornament, a fine rattan evening cuff and a mother-of-pearl lagoon clutch, divided across the trio",
    companionAction: "crew-dash",
    companionInteraction: "tiny PAWS makes a short ground-level kitten scamper beside the trio between two clear pearl floor lights; Ellie looks down and beckons her safely into the group finish",
    triggeredVisuals: "Ellie wears an original glossy gala hairstyle and one tiny secular lower-back star-route mark visible only through the opaque garment's clean open-back architecture. Alia wears a delicate collarbone jewelry line and a comfortable velvet choker with one glowing signal pendant."
  }
];

function sha(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

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

function replaceTopLevelValue(source, key, value, pretty = false) {
  const [start, end] = topLevelValueRange(source, key);
  let replacement = pretty ? JSON.stringify(value, null, 2) : JSON.stringify(value);
  if (pretty) replacement = replacement.replaceAll("\n", "\n  ");
  return source.slice(0, start) + replacement + source.slice(end);
}

const raw = fs.readFileSync(campaignPath, "utf8");
const campaign = JSON.parse(raw);
if (campaign.nextBatch !== 211 || campaign.nextNumber !== 864) throw new Error("Campaign counters moved; refusing stale Batch 211 materialization");
if (campaign.plannedBatches.some((batch) => batch.batch === 211)) throw new Error("Batch 211 already materialized");
if (!fs.existsSync(sourcePreflightPath)) throw new Error("Missing current preflight cache");
if (fs.existsSync(root)) throw new Error("Batch 211 durable root already exists");

const contract = campaign.expansionPacks[0].appearanceVariationContract;
const characterTraits = contract.traits.filter((trait) => trait.scope !== "trio-static");
const trioTraits = contract.traits.filter((trait) => trait.scope === "trio-static");
if (characterTraits.length !== 84 || trioTraits.length !== 20) throw new Error("Unexpected mutable trait counts");
const oddsAndScopesSha256 = sha(JSON.stringify(contract.traits.map((trait) => [trait.scope ?? "character", trait.trait, trait.rollScale ?? 100, trait.trigger, trait.probability])));

const scenes = sceneSpecs.map((spec, sceneIndex) => {
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
  const presenceSeed = `${spec.number}|companion|PAWS|mile-high-v1`;
  const actionSeed = `${spec.number}|companion-action|PAWS|mile-high-v2`;
  const presenceRoll = roll(presenceSeed, 100);
  const rawActionRoll = roll(actionSeed, 6);
  const actionName = campaign.companionCast.actionContract.actions[rawActionRoll].split(":", 1)[0];
  if (actionName !== spec.companionAction) throw new Error(`Stored action mismatch for ${spec.number}: ${actionName}`);
  triggeredDetails.push("companion.PAWS", `companion.PAWS.${actionName}`);

  const companionDirective = `PAWS is mandatory under the active promotion override. Show exactly one tiny approximately two-month-old female NY11 golden British Shorthair kitten with an oversized round baby face, large green eyes, short little legs and luminous honey-apricot-gold baby fur. Action beat: ${spec.companionInteraction}. Reject adult size, passive sitting, dull coat color, unsafe motion, duplicated cat or obscured faces, hands, mission, landmark, garments or footwear.`;
  const brief = `Vertical full-length HQ cinematic luxury aviation-fashion photograph at ${spec.location}. Exactly three clearly adult early-twenties fictional women with the same distinct canonical identities as both approved references. Radiance is fictional STAR RAZE ${spec.roles.Radiance}, Ellie is fictional STAR RAZE ${spec.roles.Ellie}, and Alia is fictional STAR RAZE ${spec.roles.Alia}. Black-tie fashion is the first read: ${spec.fashion}. Local secular accessories: ${spec.localAccessories}. Together they ${spec.mission}. Relationship event: ${spec.relationship}. Triggered-detail integration: ${spec.triggeredVisuals} ${companionDirective} Preserve clean natural faces, readable hands, complete anatomy, all six complete shoes, solid opaque secure coverage and the recognizable Philippines setting. Use no literal flag, official or sacred emblem, politics, readable text, logo, real airline, extra person, second animal, weapon or watermark.`;
  const file = `${spec.slug}.png`;
  const foundationPlan = {
    country: "Philippines",
    location: spec.location,
    roles: spec.roles,
    mission: spec.mission,
    relationship: spec.relationship,
    companionAction: { name: actionName, instruction: spec.companionInteraction },
    triggeredDetails,
    cleanFaceGate: true,
    technicalInvariants: [
      "vertical full-length composition",
      "exactly three clearly adult fictional women",
      "one tiny two-month-old richly golden PAWS kitten only",
      "active reciprocal PAWS interaction",
      "readable hands",
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
      resolvedActionIndex: rawActionRoll,
      collisionAdjusted: false,
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
      status: "queued",
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
        blockedCorpusSha256: corpusHash,
        cache: preflightRelativePath,
        order: "longest-phrase-first"
      },
      foundationPlan,
      stages: {
        foundation: "queued",
        relationship: "planned-in-foundation",
        silhouette: "planned-in-foundation",
        refinement: "planned-in-foundation",
        triggeredDetails: "planned-in-foundation",
        companion: "planned-in-foundation",
        validation: "pending"
      },
      blockedPrompts: [],
      detailProgress: { completed: [], remaining: triggeredDetails }
    },
    status: "planned"
  };
});

if (new Set(scenes.map((scene) => scene.companionActionRoll.actionName)).size !== 4) throw new Error("Promotion batch requires four distinct PAWS actions");

const batch = {
  batch: 211,
  continent: "Asia",
  country: "Philippines",
  countrySlug: "philippines",
  theme: "THE MILE HIGH THREESOME - Philippines Black-Tie Gala Aircrew Couture",
  status: "planned",
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
    blockedCorpusSha256: corpusHash,
    cache: preflightRelativePath,
    compiledAt: startedAt,
    order: "longest-phrase-first"
  },
  scenes,
  videoPause: {
    status: "not-scheduled",
    reason: "Binding four-PNG-only pause for render Batches 202 through 211."
  }
};

let updated = raw;
const [plannedStart, plannedEnd] = topLevelValueRange(updated, "plannedBatches");
const plannedArray = JSON.parse(updated.slice(plannedStart, plannedEnd));
if (plannedArray.some((item) => item.batch === 211)) throw new Error("Batch 211 appeared during materialization");
updated = updated.slice(0, plannedEnd - 1) + `,\n    ${JSON.stringify(batch)}\n  ` + updated.slice(plannedEnd - 1);
updated = replaceTopLevelValue(updated, "activeRenderCheckpoint", {
  batch: 211,
  country: "Philippines",
  status: "planned-materialized",
  updatedAt: startedAt,
  checkpoint: "tmp/world-195x4/batch-211/runtime-checkpoint.json",
  sceneNumbers: scenes.map((scene) => scene.number),
  pawsActions: scenes.map((scene) => ({ number: scene.number, action: scene.companionActionRoll.actionName })),
  preflightCorpusSha256: corpusHash,
  nextAction: "Launch the four distinct preflighted Philippines foundations concurrently and freeze each lane independently."
}, true);
JSON.parse(updated);

fs.mkdirSync(path.dirname(preflightPath), { recursive: true });
const preflight = JSON.parse(fs.readFileSync(sourcePreflightPath, "utf8"));
preflight.wakeAt = startedAt;
preflight.batch = 211;
preflight.country = "Philippines";
preflight.foundationRule = "Materialize identity, Philippines role and mission, black-tie gala relationship geometry, exact triggered details, two-month-old richly golden PAWS action, clean-face gate, secure silhouette and all six shoes once; send only the transformed prompt.";
fs.writeFileSync(preflightPath, `${JSON.stringify(preflight, null, 2)}\n`, "utf8");

const checkpoint = {
  schema: "world-195x4-render-checkpoint-v1",
  batch: 211,
  country: "Philippines",
  updatedAt: startedAt,
  status: "planned-materialized",
  preflight: {
    blockedCorpusSha256: corpusHash,
    cache: preflightRelativePath,
    recompileRequired: false
  },
  lanes: scenes.map((scene) => ({
    scene: scene.number,
    file: scene.file,
    status: "queued",
    attempts: 0,
    lastValidStage: "planned",
    lastValidAsset: null,
    planSha256: sha(JSON.stringify(scene.renderState.foundationPlan)),
    pawsAction: scene.companionActionRoll.actionName,
    nextStage: "foundation"
  })),
  rejectedCandidates: [],
  publicBuild: {
    status: "pending-foundations",
    commit: null,
    rejectedMediaPublished: false
  },
  moderationBlocks: []
};

fs.mkdirSync(root, { recursive: true });
fs.mkdirSync(path.join(root, "foundations"), { recursive: true });
fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
fs.writeFileSync(path.join(root, "scene-plan.json"), `${JSON.stringify(batch, null, 2)}\n`, "utf8");
fs.writeFileSync(campaignPath, updated, "utf8");

console.log(JSON.stringify({ batch: 211, country: "Philippines", scenes: scenes.map((scene) => ({ number: scene.number, file: scene.file, pawsAction: scene.companionActionRoll.actionName, triggeredDetails: scene.renderState.foundationPlan.triggeredDetails })), preflight: preflightRelativePath }, null, 2));
