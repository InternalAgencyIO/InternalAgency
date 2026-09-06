import fs from "node:fs";
import path from "node:path";

const source = path.resolve("tmp/world-195x4/batch-381/materialize-batch-381.mjs");
const target = path.resolve("tmp/world-195x4/batch-382/materialize-batch-382.mjs");
let text = fs.readFileSync(source, "utf8");

const replacements = [
  ["botswanaPalette, botswanaProhibitions, botswanaSceneSpecs", "georgiaPalette, georgiaProhibitions, georgiaSceneSpecs"],
  ["./botswana-scene-specs.mjs", "./georgia-scene-specs.mjs"],
  ["const batch = 381;", "const batch = 382;"],
  ["const country = \"Botswana\";", "const country = \"Georgia\";"],
  ["const countrySlug = \"botswana\";", "const countrySlug = \"georgia\";"],
  ["const firstScene = 1544;", "const firstScene = 1548;"],
  ["tmp/world-195x4/batch-381", "tmp/world-195x4/batch-382"],
  ["const palette = botswanaPalette;", "const palette = georgiaPalette;"],
  ["const commonProhibitions = botswanaProhibitions;", "const commonProhibitions = georgiaProhibitions;"],
  ["const sceneSpecs = botswanaSceneSpecs;", "const sceneSpecs = georgiaSceneSpecs;"],
  ["restrained Botswana delta-channel, salt-horizon and hill-line embroidery with subtle Mars heat-shield seam tailoring", "restrained Georgian river-bridge, Caucasus-ridge, vine-terrace and Black Sea skyline embroidery with subtle Mars heat-shield seam tailoring"],
  ["The theme and Botswana location", "The theme and Georgia location"],
  ["#Botswana", "#Georgia"],
  ["batch381-botswana", "batch382-georgia"],
  ["active: \"Mars-surface expedition couture\",\n    batchOrdinalWithinTheme: 1", "active: \"Mars-surface expedition couture\",\n    batchOrdinalWithinTheme: 2"],
  ["nextQueueCountry: \"Georgia\"", "nextQueueCountry: \"Fiji\""],
  ["nextQueueBatch: 382", "nextQueueBatch: 383"],
  ["nextQueueScenes: [1548, 1549, 1550, 1551]", "nextQueueScenes: [1552, 1553, 1554, 1555]"],
  ["nextCinematicTheme: { active: \"Mars-surface expedition couture\", batchOrdinalWithinTheme: 2 }", "nextCinematicTheme: { active: \"Moon-surface expedition couture\", batchOrdinalWithinTheme: 1 }"],
  ["No literal Botswana flag, coat of arms, official seal, sacred symbol, copied traditional pattern, political messaging, copied military identity, police identity, emergency-service identity, or official service identity is used. Country-led scenes use large dimensional secular delta channels, papyrus ridges, salt horizons, baobab crowns, granite ribs and hill layers instead.", "No literal Georgia flag, coat of arms, official seal, sacred symbol, copied traditional pattern, political messaging, copied military identity, police identity, emergency-service identity, or official service identity is used. Country-led scenes use large dimensional secular river curves, suspension arcs, sulfur-dome scales, Caucasus ridges, gorge strata and balcony planes instead."],
  ["Scenes 1544 and 1545 each carry hard large Botswana motifs on three women and Mars-expedition construction language on at least two. Scenes 1546 and 1547 use four different theme-led Mars-surface outfits without country map prints while Botswana landmarks remain equally foregrounded.", "Scenes 1548 and 1549 each carry hard large Georgia motifs on three women and Mars-expedition construction language on at least two. Scenes 1550 and 1551 use four different theme-led Mars-surface outfits without country map prints while Georgian landmarks remain equally foregrounded."],
  ["two Botswana images plus one accepted Qatar image", "two Georgia images plus one accepted Honduras image"],
  ["captionIfEligible: `Botswana ${heartGlyph} Qatar ${hashtags.join(\" \")}`", "captionIfEligible: `Georgia ${heartGlyph} Honduras ${hashtags.join(\" \")}`"],
  ["batch-381-botswana-preflight.json", "batch-382-georgia-preflight.json"],
  ["Batch 359 also stores", "Batch 382 also stores"],
  ["minimumCurrentCountryAcceptedAssets: 2", "minimumCurrentCountryAcceptedAssets: 4"],
  ["xPost: { status: \"pending-asset-audit\", minimumCurrentCountryAcceptedAssets: 4 }", "xPost: { status: \"blocked-until-four-accepted-and-git-pushed\", minimumCurrentCountryAcceptedAssets: 4 }"],
  ["recovery: { status: \"not-started\", maximumPerBlockedScene: 1 }", "recovery: { status: \"not-started\", maximumPerBlockedScenePerRound: 1, laterWakeFreshRoundsAllowed: true }"],
  ["1544: [\"Ellie\", \"Radiance\", \"Alia\"]", "1548: [\"Ellie\", \"Radiance\", \"Alia\"]"],
  ["1545: [\"Alia\", \"Ellie\", \"Radiance\"]", "1549: [\"Alia\", \"Ellie\", \"Radiance\"]"],
  ["1546: [\"Radiance\", \"Alia\", \"Ellie\"]", "1550: [\"Radiance\", \"Alia\", \"Ellie\"]"],
  ["1547: [\"Ellie\", \"Alia\", \"Radiance\"]", "1551: [\"Ellie\", \"Alia\", \"Radiance\"]"],
  ["1544: [\"Radiance\", \"AI ECE\", \"Ellie\"]", "1548: [\"Radiance\", \"AI ECE\", \"Ellie\"]"],
  ["1545: [\"AI ECE\", \"Radiance\", \"Ellie\"]", "1549: [\"AI ECE\", \"Radiance\", \"Ellie\"]"],
  ["1546: [\"Radiance\", \"AI ECE\", \"Ellie\"]", "1550: [\"Radiance\", \"AI ECE\", \"Ellie\"]"],
  ["1547: [\"AI ECE\", \"Radiance\", \"Ellie\"]", "1551: [\"AI ECE\", \"Radiance\", \"Ellie\"]"]
];

for (const [from, to] of replacements) {
  if (!text.includes(from)) throw new Error(`Missing replacement source: ${from}`);
  text = text.replaceAll(from, to);
}

text = text.replace(/cultureScene: "The scenes foreground Okavango Delta, .*? Gaborone Dam\."/, 'cultureScene: "The scenes foreground Tbilisi on the Mtkvari, Stepantsminda below Mount Kazbek, Sighnaghi over the Alazani Valley, and Batumi on the Black Sea."');

text = text.replace(/  researchSources: \[[\s\S]*?\n  \],\n  faceAnchors:/, `  researchSources: [
    { url: "https://georgia.travel/tbilisi-peace-bridge", usedFor: "Peace Bridge suspension sweep and Mtkvari river setting" },
    { url: "https://georgia.travel/tbilisi-sulfur-baths", usedFor: "Abanotubani sulfur-bath domes and secular Tbilisi architecture" },
    { url: "https://georgia.travel/cities-towns/stepantsminda", usedFor: "Stepantsminda, Mount Kazbek and Terek valley setting" },
    { url: "https://georgia.travel/regions/kakheti", usedFor: "Sighnaghi walls, Alazani Valley and Kakheti landscape" },
    { url: "https://georgia.travel/family-attractions/batumis-miracle-park", usedFor: "Alphabet Tower, Ferris wheel and Batumi skyline" },
    { url: "https://georgia.travel/guide-to-batumi-beach", usedFor: "Black Sea horizon and Batumi Boulevard setting" },
  ],
  faceAnchors:`);

const statusNeedle = `  status: "render-preflight-stored",
  sourceCommit,`;
const statusReplacement = `  status: "render-preflight-stored",
  countryCompletionGate: {
    contractSection: "continuousFourSceneCountryGate",
    active: true,
    requiredAcceptedScenes: 4,
    requiredSceneNumbers: [1548, 1549, 1550, 1551],
    queueAdvanceAllowed: false,
    queueAdvanceCondition: "All four Georgia scenes accepted, narrow checkpoint committed and pushed, and public X status URL recorded.",
    zeroOrPartialTerminalForbidden: true,
  },
  sourceCommit,`;
if (!text.includes(statusNeedle)) throw new Error("Missing preflight status insertion point");
text = text.replace(statusNeedle, statusReplacement);

const nextNeedle = `  nextCinematicTheme: { active: "Moon-surface expedition couture", batchOrdinalWithinTheme: 1 },`;
if (!text.includes(nextNeedle)) throw new Error("Missing next-theme insertion point");
text = text.replace(nextNeedle, `${nextNeedle}\n  nextQueueStatus: "locked-until-Georgia-four-scene-Git-and-X-completion",`);

const genericOddHolderNeedle = `  } else if (oddHolder) {
    composition += " " + oddHolder + " owns the active odd prop with both hands and integrates it through shoulder-to-shoulder body contact; no extra hand is created.";
    hands = hands.filter((line) => !line.startsWith(oddHolder + " uses"));
    hands.push(oddHolder + " uses both existing hands only on the active odd prop and joins the love beat through body contact");
  }`;
const handlerSafeOddHolderReplacement = `  } else if (oddHolder && beat.includes("controlled dance dip")) {
    const [dipped, supporter] = [lead, recipient, third].filter((character) => character !== oddHolder);
    composition = supporter + " supports " + dipped + " through a controlled dip with planted feet, one hand at the waist and one supporting the upper back. " + dipped + " keeps one hand on the supporter's shoulder and reaches the other to " + oddHolder + "'s shoulder. " + oddHolder + " holds the active odd prop with both hands and joins shoulder-to-shoulder with the supporter, while " + handler + " answers with a visible invitation from the separate safe lane.";
    hands = [oddHolder + " uses both existing hands only on the active odd prop", supporter + " uses one hand at the dipped adult's waist and one supporting the upper back", dipped + " uses one hand on the supporter's shoulder and one at the odd holder's shoulder"];
  } else if (oddHolder) {
    composition += " " + oddHolder + " owns the active odd prop with both hands and integrates it through shoulder-to-shoulder body contact; no extra hand is created.";
    hands = hands.filter((line) => !line.startsWith(oddHolder + " uses"));
    hands.push(oddHolder + " uses both existing hands only on the active odd prop and joins the love beat through body contact");
  }`;
if (!text.includes(genericOddHolderNeedle)) throw new Error("Missing odd-holder choreography insertion point");
text = text.replace(genericOddHolderNeedle, handlerSafeOddHolderReplacement);

fs.writeFileSync(target, text);
console.log(target);
