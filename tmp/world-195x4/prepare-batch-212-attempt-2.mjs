import fs from "node:fs";
import path from "node:path";

const campaignPath = path.resolve("assets/lore/starlight-era/world-195x4-campaign.json");
const scenePlanPath = path.resolve("tmp/world-195x4/batch-212/scene-plan.json");
const checkpointPath = path.resolve("tmp/world-195x4/batch-212/runtime-checkpoint.json");

const retryPrompts = new Map([
  [868, `Fresh independent clean foundation; do not edit or imitate any rejected output. Use only the approved identity references. Create a vertical full-length cinematic luxury aviation-fashion photograph on a broad secure observation deck beside the flat open expanse of Pool Malebo at sapphire-and-gold evening, with Kinshasa's low Congo River waterfront skyline nearby and the distant Brazzaville shore across the water. Keep the open river horizon dominant and omit bridges. Exactly three clearly adult fictional women with clean natural faces: blonde Radiance is the STAR RAZE captain at the central route tablet, short dark-bob Ellie is first officer at a separate beacon-key control, and dark-auburn-curled Alia is cabin host at a separate service-arc signal case. The unmistakable first read is a professional three-woman aircrew editorial completing a cobalt, copper and pearl river navigation grid. Give them three different sculptural black-tie gala silhouettes in cobalt, warm red, optical white, copper and pearl, all solid, secure and opaque, with Congo River wave seams and contemporary raffia-inspired weave geometry. Radiance has a fine metallic route-line seam across her fully opaque rear garment panel plus fixed decorative geometric back-panel lacing. Ellie wears one angular wrist cuff. Alia wears two separate wrist cuffs with no connector and an ornate tailored metallic waist belt over her opaque garment; keep her hands spaced apart and free. Show exactly one collarless, tagless, text-free two-month-old female NY11 golden British Shorthair PAWS: extremely kitten-small, tiny body, oversized round baby face, large green eyes, small rounded ears, four short legs, one tail, luminous honey-apricot-gold baby fur with pale warm-gold undercoat and fine cinnamon-gold tipping. PAWS stands naturally on the ground with both forepaws raised toward Radiance, reaching no higher than Radiance's lower calf; Radiance notices and lowers one open hand to answer her. Preserve the completed grid, clear body spacing, readable natural hands, complete anatomy and all six complete shoes. No face decoration, extra person, second animal, readable text, logo, literal flag, official or sacred emblem, politics, real airline, weapon, watermark or transparent fabric.`],
  [871, `Fresh independent clean foundation; do not edit or imitate any rejected output. Use only the approved identity references. Create a vertical full-length cinematic luxury aviation-fashion photograph on a broad dry secure arrival platform overlooking the unmistakable multi-channel Boyoma Falls near Kisangani and dense Congo River forest at warm sunrise. Exactly three clearly adult fictional women with clean natural faces: blonde Radiance is the STAR RAZE captain with a central route tablet, short dark-bob Ellie is first officer at a separate beacon-key control, and dark-auburn-curled Alia is cabin host with a service-arc signal case. The unmistakable first read is a professional three-woman aircrew editorial sealing one completed pearl, cobalt and copper arrival beacon on a low stable console. Give them three different sculptural black-tie gala silhouettes in pearl, cobalt, copper, warm red, optical white and black, all solid, secure and opaque, with abstract waterfall ribbons and river-channel seam geometry. Keep this scene deliberately simple: no optional appearance ornaments beyond one local contemporary woven river clutch, one pearl falls collar accent and one copper navigation cuff divided across the trio. Show exactly one collarless, tagless, text-free two-month-old female NY11 golden British Shorthair PAWS: extremely kitten-small, tiny body, oversized round baby face, large green eyes, small rounded ears, four short legs, one tail, luminous honey-apricot-gold baby fur with pale warm-gold undercoat and fine cinnamon-gold tipping. PAWS walks beside the low console base with tail raised and places one forepaw directly on a harmless pearl light button built into the console; Ellie points to that same button while making room for her. PAWS does not reach toward a person. Preserve the completed beacon, clear body spacing, readable natural hands, complete anatomy and all six complete shoes fully visible beyond every hem. No face decoration, extra person, second animal, readable text, logo, literal flag, official or sacred emblem, politics, real airline, weapon, watermark or transparent fabric.`]
]);

function matchingClose(source, openIndex) {
  const open = source[openIndex];
  const close = open === "{" ? "}" : open === "[" ? "]" : null;
  if (!close) throw new Error(`Unsupported opener at ${openIndex}`);
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
  throw new Error(`Unclosed value at ${openIndex}`);
}

function topLevelValueRange(source, key) {
  const marker = `\n  "${key}": `;
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) throw new Error(`Missing top-level key ${key}`);
  const start = markerIndex + marker.length;
  return [start, matchingClose(source, start) + 1];
}

function replaceTopLevelValue(source, key, value) {
  const [start, end] = topLevelValueRange(source, key);
  const replacement = JSON.stringify(value, null, 2).replaceAll("\n", "\n  ");
  return source.slice(0, start) + replacement + source.slice(end);
}

const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
if (checkpoint.status !== "two-accepted-two-clean-restarts-active") throw new Error("Unexpected checkpoint state");
for (const lane of checkpoint.lanes.filter((item) => retryPrompts.has(item.scene))) {
  lane.safeRecoveryMethod = "Fresh independent foundation from canonical identity references only; simplify geometry and correct only the failed contract gates without using the rejected candidate as an edit source.";
  lane.exactPromptAttempt2 = retryPrompts.get(lane.scene);
}

let campaignRaw = fs.readFileSync(campaignPath, "utf8");
const campaign = JSON.parse(campaignRaw);
const batch = campaign.plannedBatches.find((item) => item.batch === 212);
if (!batch || batch.status !== "partial-two-accepted-two-clean-restarts-active") throw new Error("Unexpected Batch 212 state");
const oldBatchText = JSON.stringify(batch);
for (const scene of batch.scenes.filter((item) => retryPrompts.has(item.number))) {
  scene.renderState.safeRecoveryMethod = "Fresh independent foundation from canonical identity references only; simplify geometry and correct only the failed contract gates without using the rejected candidate as an edit source.";
  scene.renderState.retryPrompts = [{ attempt: 2, prompt: retryPrompts.get(scene.number) }];
}
campaignRaw = campaignRaw.replace(oldBatchText, JSON.stringify(batch));
campaignRaw = replaceTopLevelValue(campaignRaw, "activeRenderCheckpoint", {
  ...campaign.activeRenderCheckpoint,
  updatedAt: "2026-08-05T10:08:00.000Z",
  nextAction: "Scenes 869 and 870 are frozen. Fresh independent foundation attempts are active only for scenes 868 and 871."
});
JSON.parse(campaignRaw);

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
fs.writeFileSync(scenePlanPath, `${JSON.stringify(batch, null, 2)}\n`, "utf8");
fs.writeFileSync(campaignPath, campaignRaw, "utf8");
console.log(JSON.stringify([...retryPrompts].map(([scene, prompt]) => ({ scene, prompt })), null, 2));
