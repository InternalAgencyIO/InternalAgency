import fs from "node:fs";
import path from "node:path";

const source = path.resolve("tmp/world-195x4/batch-380/materialize-batch-380.mjs");
const target = path.resolve("tmp/world-195x4/batch-381/materialize-batch-381.mjs");
let text = fs.readFileSync(source, "utf8");

const replacements = [
  ["gabonPalette, gabonProhibitions, gabonSceneSpecs", "botswanaPalette, botswanaProhibitions, botswanaSceneSpecs"],
  ["./gabon-scene-specs.mjs", "./botswana-scene-specs.mjs"],
  ["const batch = 380;", "const batch = 381;"],
  ["const country = \"Gabon\";", "const country = \"Botswana\";"],
  ["const countrySlug = \"gabon\";", "const countrySlug = \"botswana\";"],
  ["const firstScene = 1540;", "const firstScene = 1544;"],
  ["tmp/world-195x4/batch-380", "tmp/world-195x4/batch-381"],
  ["const palette = gabonPalette;", "const palette = botswanaPalette;"],
  ["const commonProhibitions = gabonProhibitions;", "const commonProhibitions = botswanaProhibitions;"],
  ["const sceneSpecs = gabonSceneSpecs;", "const sceneSpecs = botswanaSceneSpecs;"],
  ["restrained Gabonese estuary-curve and rainforest-waterfall embroidery with subtle orbital-capsule seam tailoring", "restrained Botswana delta-channel, salt-horizon and hill-line embroidery with subtle Mars heat-shield seam tailoring"],
  ["The theme and Gabon location", "The theme and Botswana location"],
  ["#Gabon", "#Botswana"],
  ["batch380-gabon", "batch381-botswana"],
  ["active: \"orbital spaceship couture\",\n    batchOrdinalWithinTheme: 2", "active: \"Mars-surface expedition couture\",\n    batchOrdinalWithinTheme: 1"],
  ["nextQueueCountry: \"Botswana\"", "nextQueueCountry: \"Georgia\""],
  ["nextQueueBatch: 381", "nextQueueBatch: 382"],
  ["nextQueueScenes: [1544, 1545, 1546, 1547]", "nextQueueScenes: [1548, 1549, 1550, 1551]"],
  ["nextCinematicTheme: { active: \"Mars-surface expedition couture\", batchOrdinalWithinTheme: 1 }", "nextCinematicTheme: { active: \"Mars-surface expedition couture\", batchOrdinalWithinTheme: 2 }"],
  ["No literal Gabon flag, coat of arms, official seal, sacred symbol, copied traditional pattern, political messaging, copied military identity, police identity, emergency-service identity, or official service identity is used. Country-led scenes use large dimensional secular waterfront curves, Libreville skyline terraces, forest-savanna bands, river arcs and hill layers instead.", "No literal Botswana flag, coat of arms, official seal, sacred symbol, copied traditional pattern, political messaging, copied military identity, police identity, emergency-service identity, or official service identity is used. Country-led scenes use large dimensional secular delta channels, papyrus ridges, salt horizons, baobab crowns, granite ribs and hill layers instead."],
  ["Scenes 1540 and 1541 each carry hard large Gabon motifs on three women and orbital-spaceship construction language on at least two. Scenes 1542 and 1543 use four different theme-led orbital-spaceship outfits without country map prints while Gabonese landmarks remain equally foregrounded.", "Scenes 1544 and 1545 each carry hard large Botswana motifs on three women and Mars-expedition construction language on at least two. Scenes 1546 and 1547 use four different theme-led Mars-surface outfits without country map prints while Botswana landmarks remain equally foregrounded."],
  ["two Gabon images plus one accepted Qatar image", "two Botswana images plus one accepted Qatar image"],
  ["captionIfEligible: `Gabon ${heartGlyph} Qatar ${hashtags.join(\" \")}`", "captionIfEligible: `Botswana ${heartGlyph} Qatar ${hashtags.join(\" \")}`"],
  ["batch-380-gabon-preflight.json", "batch-381-botswana-preflight.json"]
];

for (const [from, to] of replacements) {
  if (!text.includes(from)) throw new Error(`Missing replacement source: ${from}`);
  text = text.replaceAll(from, to);
}

text = text.replace(/cultureScene: "The scenes foreground Libreville, .*? Kongou Falls\."/, 'cultureScene: "The scenes foreground Okavango Delta, Makgadikgadi Pans, Tsodilo Hills, and Gaborone with Kgale Hill and Gaborone Dam."');

text = text.replaceAll("spacecraft", "Mars-expedition equipment");
text = text.replace(/  researchSources: \[[\s\S]*?\n  \],\n  faceAnchors:/, `  researchSources: [
    { url: "https://www.botswanatourism.co.bw/explore/okavango-delta", usedFor: "Okavango fan channels, papyrus beds, palm islands and empty mokoro setting" },
    { url: "https://www.botswanatourism.co.bw/index.php/explore/makgadikgadi-and-nxai-pans", usedFor: "Makgadikgadi salt pans, Kubu Island baobabs and Kalahari setting" },
    { url: "https://whc.unesco.org/en/list/1021/", usedFor: "Tsodilo Hills landscape and respectful heritage context" },
    { url: "https://www.botswanatourism.co.bw/explore/greater-gaborone", usedFor: "Gaborone Dam, Kgale Hill and Greater Gaborone setting" },
  ],
  faceAnchors:`);

const helper = `
const resolveHardLove = (scene, handler, beat, oddHolder) => {
  const defaultOrders = {
    1544: ["Ellie", "Radiance", "Alia"],
    1545: ["Alia", "Ellie", "Radiance"],
    1546: ["Radiance", "Alia", "Ellie"],
    1547: ["Ellie", "Alia", "Radiance"],
  };
  const hosieryOrders = {
    1544: ["Radiance", "AI ECE", "Ellie"],
    1545: ["AI ECE", "Radiance", "Ellie"],
    1546: ["Radiance", "AI ECE", "Ellie"],
    1547: ["AI ECE", "Radiance", "Ellie"],
  };
  const [lead, recipient, third] = (handler === "Alia" ? hosieryOrders : defaultOrders)[scene];
  let composition;
  let hands;
  if (beat.includes("lap")) {
    composition = recipient + " sits fully clothed and stable across " + lead + "'s lap while " + lead + " supports waist and upper back; " + third + " joins at the shoulder and forearm, and " + handler + " reclaims attention through a direct affectionate eye line from the separate safe lane.";
    hands = [lead + " uses one hand at the recipient's waist and one at the upper back", recipient + " uses one hand on the lead's shoulder and one linked with the third", third + " uses one hand linked with the recipient and one at the recipient's shoulder"];
  } else if (beat.includes("partner dance")) {
    composition = lead + " turns " + recipient + " beneath their linked hands and catches the waist; " + third + " joins shoulder-to-shoulder and catches the recipient's forearm, while " + handler + " moves in through a reclaiming eye line from the separate safe lane.";
    hands = [lead + " uses one linked hand and one waist-support hand", recipient + " uses one linked hand and one hand at the third's upper arm", third + " uses one hand at the recipient's shoulder and one at the forearm"];
  } else if (beat.includes("controlled dance dip")) {
    composition = lead + " supports " + recipient + " through a controlled dip with planted feet and full back support; " + third + " catches the recipient's free hand and shoulder, while " + handler + " answers with a visible invitation from the separate safe lane.";
    hands = [lead + " uses one hand at the recipient's waist and one supporting the upper back", recipient + " uses one hand on the lead's shoulder and one held by the third", third + " uses one hand holding the recipient and one at the shoulder"];
  } else if (beat.includes("seated embrace")) {
    composition = lead + " and " + recipient + " share a face-to-face seated embrace on one stable bench; " + third + " joins at shoulder and clasped hand, while " + handler + " interrupts with a direct affectionate choice from the separate safe lane.";
    hands = [lead + " uses one hand at the recipient's waist and one at the shoulder", recipient + " uses one hand at the lead's upper arm and one clasped with the third", third + " uses one clasped hand and one at the recipient's shoulder"];
  } else if (beat.includes("three-person")) {
    composition = lead + ", " + recipient + " and " + third + " perform a close three-person slow dance with one waist catch, one linked hand and one shoulder join; " + handler + " remains the visibly excluded rival reclaiming attention from the separate safe lane.";
    hands = [lead + " uses one hand at the recipient's waist and one at the third's shoulder", recipient + " uses one hand at the lead's shoulder and one linked with the third", third + " uses one linked hand and one at the recipient's waist"];
  } else if (beat.includes("pulled-away")) {
    composition = lead + " pulls " + recipient + " gently toward a visible choice by linked hand and shoulder; " + third + " interrupts at waist and free hand, while " + handler + " holds the decisive reclaiming eye line from the separate safe lane.";
    hands = [lead + " uses one linked hand and one at the recipient's shoulder", recipient + " uses one hand linked with the lead and one caught by the third", third + " uses one hand holding the recipient and one at the waist"];
  } else {
    composition = recipient + " rises from one stable bench into " + lead + "'s full supportive embrace; " + third + " catches the free hand and gives one gentle cheek kiss, while " + handler + " blocks their route through direct eye line and torso direction from the separate safe lane.";
    hands = [lead + " uses one hand at the recipient's waist and one supporting the forearm", recipient + " uses one hand at the lead's shoulder and one held by the third", third + " uses one hand holding the recipient and one at the shoulder"];
  }
  if (oddHolder && beat.includes("lap")) {
    const [sitter, chooser] = [lead, recipient, third].filter((character) => character !== oddHolder);
    composition = sitter + " sits securely sideways across " + oddHolder + "'s lap on a stable low bench that carries the seated weight. " + oddHolder + " holds the active odd prop with both hands and joins through lap and shoulder-to-shoulder body contact. " + chooser + " draws the sitter into a linked-hand choice and adds a shoulder contact, while " + handler + " interrupts with a clear rival eye line from the separate safe lane.";
    hands = [oddHolder + " uses both existing hands only on the active odd prop", sitter + " uses one hand at the odd holder's shoulder and one linked with the chooser", chooser + " uses one linked hand and one at the sitter's shoulder"];
  } else if (oddHolder) {
    composition += " " + oddHolder + " owns the active odd prop with both hands and integrates it through shoulder-to-shoulder body contact; no extra hand is created.";
    hands = hands.filter((line) => !line.startsWith(oddHolder + " uses"));
    hands.push(oddHolder + " uses both existing hands only on the active odd prop and joins the love beat through body contact");
  }
  hands.unshift(handler + " uses both existing hands only on the inert mission prop");
  return { composition, hands };
};
`;

const insertionPoint = "const scenePlans = {};";
if (!text.includes(insertionPoint)) throw new Error("Missing choreography insertion point");
text = text.replace(insertionPoint, `${helper}\n${insertionPoint}`);

const oldResolution = `  const resolvedHands = spec.hands;
  const mascotPlan = spec.mascotPlan;
  const outfits = Object.fromEntries(characters.map((character, index) => [character, garment(character, characterPlans, spec, index)]));
  if (hasMale) outfits.Male`;
const newResolution = `  const resolvedLove = resolveHardLove(spec.scene, handler, hardLoveBeat.result, interestingProp.active ? interestingPropHolder.result : null);
  const maleGuidesWrist = hasMale && poseTargetRoll.roll >= 60 && poseTargetRoll.roll <= 74;
  const maleContactSentence = hasMale ? (maleGuidesWrist ? " The adult male provides the rolled behind-the-shoulder guidance with one visible hand lightly at ECE's wrist and one at ECE's upper arm, keeps his strongest sustained eye line to ECE, and never touches the trigger or owns the mission prop." : " The adult male places one visible hand at ECE's upper arm and one at ECE's waist, keeps his strongest sustained eye line to ECE, and performs the adult infidelity drama without touching the mission prop.") : "";
  const maleHandInventory = hasMale ? (maleGuidesWrist ? "the male uses one hand for light guidance at ECE's wrist and one at ECE's upper arm" : "the male uses one hand at ECE's upper arm and one at ECE's waist") : null;
  const effectivePropAction = maleGuidesWrist ? propAction.replace("A second woman gives", "The adult male gives") : propAction;
  const resolvedComposition = resolvedLove.composition + maleContactSentence;
  const resolvedHands = [...resolvedLove.hands, ...(maleHandInventory ? [maleHandInventory] : [])];
  const mascotPlan = spec.mascotPlan;
  const outfits = Object.fromEntries(characters.map((character, index) => [character, garment(character, characterPlans, spec, index)]));
  if (hasMale) outfits.Male`;
if (!text.includes(oldResolution)) throw new Error("Missing hand-resolution source");
text = text.replace(oldResolution, newResolution);
text = text.replace("    spec.composition,", "    resolvedComposition,");
text = text.replace("    composition: spec.composition,", "    composition: resolvedComposition,");
text = text.replaceAll("${propAction}", "${effectivePropAction}");
text = text.replace("    materializedPropAction: propAction,", "    materializedPropAction: effectivePropAction,");

fs.writeFileSync(target, text);
console.log(target);
