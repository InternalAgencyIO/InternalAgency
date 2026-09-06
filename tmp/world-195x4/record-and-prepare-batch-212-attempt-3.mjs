import fs from "node:fs";
import path from "node:path";

const campaignPath = path.resolve("assets/lore/starlight-era/world-195x4-campaign.json");
const scenePlanPath = path.resolve("tmp/world-195x4/batch-212/scene-plan.json");
const checkpointPath = path.resolve("tmp/world-195x4/batch-212/runtime-checkpoint.json");
const updatedAt = "2026-08-05T10:15:00.000Z";

const retryData = new Map([
  [868, {
    rejectedAsset: "tmp/world-195x4/batch-212/foundations/868-democratic-republic-of-the-congo-kinshasa-foundation-v2.png",
    bytes: 2356272,
    sha256: "643cbb6cf68ac4175327120c651b82da397ec78977438cd9e17dcb28c3942ceb",
    reason: "Rejected: PAWS still reads oversized and her coat drifts into a stripe-heavy orange-tabby pattern instead of luminous golden-shaded NY11 coloring.",
    prompt: `Fresh independent clean foundation from the approved identity references only. Create a vertical full-length cinematic black-tie aviation-fashion photograph on a broad secure Pool Malebo observation deck at sapphire-and-gold evening. Show the flat open Congo River, Kinshasa's low waterfront skyline on the near shore and a thin distant Brazzaville shore; no bridge. Exactly three clearly adult fictional women: blonde Radiance as STAR RAZE captain at a central route tablet, short dark-bob Ellie as first officer at a separate beacon-key control, and dark-auburn-curled Alia as cabin host at a separate service-arc signal case. They complete one clear cobalt, copper and pearl river navigation grid. Use three distinct concise secure opaque gala silhouettes with hems ending above the ankles so all six separate shoes are fully visible. Add Congo River wave seams and restrained contemporary woven geometry. Radiance has one fine metallic route-line seam and fixed geometric lacing on the fully opaque rear garment panel. Ellie wears one angular wrist cuff. Alia wears two separate wrist cuffs with no connector plus one tailored metallic waist belt; keep both hands apart and free. Show exactly one exceptionally tiny two-month-old female NY11 golden British Shorthair PAWS, smaller than one woman's lower leg: compact baby body, oversized round baby face, very large green eyes, two small rounded ears, four short legs, one tail and clean paws. Her plush coat is luminous pale honey-apricot gold with a warm cream-gold undercoat and only delicate cinnamon-gold tipping, nearly unstriped. PAWS stands on her hind legs and raises both forepaws toward Radiance, reaching only the lower calf; Radiance answers with one lowered open hand. Keep the other women at their own controls. Preserve three distinct clean natural faces, readable natural hands, complete anatomy, all six shoes, the open river location and the completed grid. No face decoration, extra person, second animal, readable text, logo, literal flag, official or sacred emblem, politics, real airline, weapon, watermark or transparent fabric.`
  }],
  [871, {
    rejectedAsset: "tmp/world-195x4/batch-212/foundations/871-democratic-republic-of-the-congo-kisangani-foundation-v2.png",
    bytes: 2392612,
    sha256: "14b4ea41ba103f983b78ce6e064887f00772db21f85f49faedbffd583e1bb1b3",
    reason: "Rejected: the center woman's complete footwear is hidden behind the beacon and PAWS, and PAWS remains too large for the two-month growth epoch.",
    prompt: `Fresh independent clean foundation from the approved identity references only. Create a vertical full-length cinematic black-tie aviation-fashion photograph on a broad dry secure platform overlooking the multi-channel Boyoma Falls near Kisangani and dense Congo River forest at warm sunrise. Exactly three clearly adult fictional women stand in a wide shallow arc with visible floor gaps: blonde Radiance as STAR RAZE captain at a hand-held route tablet, short dark-bob Ellie as first officer pointing to the beacon, and dark-auburn-curled Alia as cabin host holding a compact signal case. Place one low stable pearl, cobalt and copper arrival-beacon console to the right of Ellie, outside the women's footwear line, so every leg and shoe remains unobstructed. Use three distinct concise secure opaque gala silhouettes with hems ending above the ankles and all six separate shoes fully visible. Add restrained abstract waterfall and river-channel seam geometry, one contemporary woven river clutch, one pearl collar accent and one copper navigation cuff divided across the trio. Show exactly one exceptionally tiny two-month-old female NY11 golden British Shorthair PAWS, smaller than one woman's lower leg: compact baby body, oversized round baby face, very large green eyes, two small rounded ears, four short legs, one tail and clean paws. Her plush coat is luminous pale honey-apricot gold with a warm cream-gold undercoat and only delicate cinnamon-gold tipping, nearly unstriped. PAWS stands on all fours beside the console base and places one forepaw directly on a harmless low pearl light button; Ellie points to that same button while leaving a clear open path. Keep PAWS entirely outside the six-shoe footprint. Preserve three distinct clean natural faces, readable natural hands, complete anatomy, the clear falls location and the completed beacon. No face decoration, extra person, second animal, readable text, logo, literal flag, official or sacred emblem, politics, real airline, weapon, watermark or transparent fabric.`
  }]
]);

function matchingClose(source, openIndex) {
  const open = source[openIndex];
  const close = open === "{" ? "}" : open === "[" ? "]" : null;
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

function replaceTopLevelValue(source, key, value) {
  const marker = `\n  "${key}": `;
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) throw new Error(`Missing top-level key ${key}`);
  const start = markerIndex + marker.length;
  const end = matchingClose(source, start) + 1;
  const replacement = JSON.stringify(value, null, 2).replaceAll("\n", "\n  ");
  return source.slice(0, start) + replacement + source.slice(end);
}

const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
if (checkpoint.status !== "two-accepted-two-clean-restarts-active") throw new Error("Unexpected checkpoint state");
checkpoint.updatedAt = updatedAt;
checkpoint.status = "two-accepted-two-clean-restarts-attempt-3-active";
checkpoint.attemptLog.push({
  attempt: 2,
  stage: "two fresh clean replacement foundations",
  outcome: "two renderer successes; both rejected by contract gate",
  rejectedScenes: [868, 871]
});
for (const lane of checkpoint.lanes.filter((item) => retryData.has(item.scene))) {
  const item = retryData.get(lane.scene);
  checkpoint.rejectedCandidates.push({ scene: lane.scene, attempt: 2, asset: item.rejectedAsset, bytes: item.bytes, sha256: item.sha256, reason: item.reason, published: false });
  lane.status = "active-clean-restart-attempt-3";
  lane.attempts = 3;
  lane.blocker = item.reason;
  lane.candidateAsset = item.rejectedAsset;
  lane.candidateBytes = item.bytes;
  lane.candidateSha256 = item.sha256;
  lane.safeRecoveryMethod = "Fresh independent simplified foundation from canonical identity references only, with short clear hems, explicit six-shoe separation and smaller nearly unstriped golden-shaded PAWS.";
  lane.exactPromptAttempt3 = item.prompt;
  lane.nextStage = "await-clean-foundation-v3";
}

let campaignRaw = fs.readFileSync(campaignPath, "utf8");
const campaign = JSON.parse(campaignRaw);
const batch = campaign.plannedBatches.find((item) => item.batch === 212);
const oldBatchText = JSON.stringify(batch);
batch.status = "partial-two-accepted-two-clean-restarts-attempt-3-active";
for (const scene of batch.scenes.filter((item) => retryData.has(item.number))) {
  const item = retryData.get(scene.number);
  scene.status = "clean-restart-attempt-3-active";
  scene.renderState.status = "clean-restart-attempt-3-active";
  scene.renderState.attempts = 3;
  scene.renderState.blocker = item.reason;
  scene.renderState.rejectedCandidates.push({ attempt: 2, asset: item.rejectedAsset, bytes: item.bytes, sha256: item.sha256, reason: item.reason });
  scene.renderState.safeRecoveryMethod = "Fresh independent simplified foundation from canonical identity references only, with short clear hems, explicit six-shoe separation and smaller nearly unstriped golden-shaded PAWS.";
  scene.renderState.retryPrompts.push({ attempt: 3, prompt: item.prompt });
  scene.renderState.stages.validation = "failed-attempt-2";
}
campaignRaw = campaignRaw.replace(oldBatchText, JSON.stringify(batch));
campaignRaw = replaceTopLevelValue(campaignRaw, "activeRenderCheckpoint", {
  ...campaign.activeRenderCheckpoint,
  status: "two-accepted-two-clean-restarts-attempt-3-active",
  updatedAt,
  rejectedCandidates: [
    ...campaign.activeRenderCheckpoint.rejectedCandidates,
    ...[868, 871].map((number) => ({ number, attempt: 2, sha256: retryData.get(number).sha256, reason: retryData.get(number).reason }))
  ],
  nextAction: "Scenes 869 and 870 remain frozen. Simplified fresh foundation attempt 3 is active only for scenes 868 and 871."
});
JSON.parse(campaignRaw);

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
fs.writeFileSync(scenePlanPath, `${JSON.stringify(batch, null, 2)}\n`, "utf8");
fs.writeFileSync(campaignPath, campaignRaw, "utf8");
console.log(JSON.stringify({ status: checkpoint.status, retryScenes: [868, 871] }, null, 2));
