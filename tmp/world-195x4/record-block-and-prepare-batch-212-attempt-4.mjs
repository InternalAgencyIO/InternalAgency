import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const campaignPath = path.resolve("assets/lore/starlight-era/world-195x4-campaign.json");
const scenePlanPath = path.resolve("tmp/world-195x4/batch-212/scene-plan.json");
const checkpointPath = path.resolve("tmp/world-195x4/batch-212/runtime-checkpoint.json");
const parentCorpusSha256 = "9cc346a09343b2a82c018f4bd78372ba3c12cd7763269b441e66ffa858fdd92c";
const sourcePreflightPath = path.resolve(`tmp/world-195x4/batch-212/preflight/blocklist-transform-${parentCorpusSha256}.json`);
const updatedAt = "2026-08-05T10:25:00.000Z";

function sha(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

const checkpointBefore = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
const lane871Before = checkpointBefore.lanes.find((lane) => lane.scene === 871);
if (!lane871Before?.exactPromptAttempt3) throw new Error("Missing exact scene 871 attempt-3 prompt");

const blockEvidence = {
  batch: 212,
  sceneNumber: 871,
  attempt: 3,
  stage: "simplified fresh clean foundation",
  outcome: "blocked",
  moderationStage: "output",
  moderationCategory: "sexual",
  requestId: "e865b50d-2a50-442b-bb0a-531f8caa9347",
  suspectedTermFamilies: [
    "rendered-pixel risk on a clean three-woman gala tableau; no single prompt phrase inferred"
  ],
  exactPrompt: lane871Before.exactPromptAttempt3
};
const corpusSha256 = sha(JSON.stringify([parentCorpusSha256, blockEvidence.exactPrompt]));
const preflightRelativePath = `tmp/world-195x4/batch-212/preflight/blocklist-transform-${corpusSha256}.json`;
const preflightPath = path.resolve(preflightRelativePath);

const retryPrompts = new Map([
  [868, `Fresh independent clean foundation from the approved identity references only. Vertical full-length cinematic evening photograph on an open Pool Malebo deck with Kinshasa's low riverfront skyline nearby, the flat Congo River filling the background and a thin distant Brazzaville shore; no bridge and no furniture between the camera and the subjects. Exactly three clearly adult fictional women stand in one shallow spaced row, each fully visible head to toe with both separate shoes on open floor. Blonde Radiance is STAR RAZE captain holding a palm-sized cobalt route tablet above her waist; short dark-bob Ellie is first officer holding a small copper beacon key above her waist; dark-auburn-curled Alia is cabin host holding a compact pearl signal case above her waist. The three handheld lights form one completed river navigation grid. Use distinct knee-length or calf-length secure opaque evening command tailoring in cobalt, warm red, optical white, copper and pearl with restrained Congo River wave seams and contemporary woven geometry. Radiance turns three-quarter toward the camera so one fine metallic route-line seam and fixed geometric lacing are readable on her fully opaque rear garment panel. Ellie wears one angular wrist cuff. Alia wears two separate wrist cuffs with no connector plus one tailored metallic waist belt; both hands remain apart and free. Show exactly one exceptionally tiny two-month-old female NY11 golden British Shorthair PAWS at Radiance's ankle: compact baby body, oversized round baby face, large green eyes, two small rounded ears, four short legs, one tail, clean paws and luminous pale honey-apricot-gold plush fur with a cream-gold undercoat and only delicate cinnamon-gold tipping. PAWS rises briefly on her hind legs and lifts both forepaws toward Radiance, reaching below mid-calf; Radiance lowers one open hand to answer her. Preserve three clean natural faces, readable natural hands, complete anatomy, all six unobstructed shoes, the open river location and the completed handheld grid. No face decoration, extra person, second animal, readable text, logo, literal flag, official or sacred emblem, politics, real airline, weapon, watermark or transparent fabric.`],
  [871, `Fresh independent clean foundation from the approved identity references only. Vertical full-length cinematic sunrise photograph on a dry secure platform overlooking the multi-channel Boyoma Falls near Kisangani and dense Congo River forest. Exactly three clearly adult fictional women stand in a wide shallow row on the left two-thirds of the frame, each fully visible head to toe with both separate shoes on open floor. Blonde Radiance is STAR RAZE captain holding a palm-sized route tablet above her waist; short dark-bob Ellie is first officer pointing across open space; dark-auburn-curled Alia is cabin host holding a compact signal case above her waist. Use distinct knee-length secure opaque evening command tailoring in pearl, cobalt, copper, warm red, optical white and black with restrained waterfall and river-channel seam geometry. Place one small low arrival-beacon console at the far right edge, completely outside the women's six-shoe footprint. Show exactly one exceptionally tiny two-month-old female NY11 golden British Shorthair PAWS beside that console: compact baby body smaller than one platform shoe, oversized round baby face, large green eyes, two small rounded ears, four short legs, one tail, clean paws and luminous pale honey-apricot-gold plush fur with a cream-gold undercoat and only delicate cinnamon-gold tipping. PAWS stands on all fours and touches one harmless low pearl light button with one forepaw; Ellie points to that same button while her full body and both shoes remain left of the console. Keep the completed beacon clear and keep PAWS outside every shoe path. Preserve three clean natural faces, readable natural hands, complete anatomy, all six unobstructed shoes and the recognizable falls. No face decoration, extra person, second animal, readable text, logo, literal flag, official or sacred emblem, politics, real airline, weapon, watermark or transparent fabric.`]
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

function nestedArrayRange(source, key, searchStart = 0) {
  const marker = `"${key}": [`;
  const markerIndex = source.indexOf(marker, searchStart);
  if (markerIndex < 0) throw new Error(`Missing array ${key}`);
  const start = markerIndex + marker.length - 1;
  return [start, matchingClose(source, start) + 1];
}

function replaceTopLevelValue(source, key, value) {
  const [start, end] = topLevelValueRange(source, key);
  const replacement = JSON.stringify(value, null, 2).replaceAll("\n", "\n  ");
  return source.slice(0, start) + replacement + source.slice(end);
}

const checkpoint = checkpointBefore;
if (checkpoint.status !== "two-accepted-two-clean-restarts-attempt-3-active") throw new Error("Unexpected checkpoint state");
if (checkpoint.moderationBlocks.some((item) => item.requestId === blockEvidence.requestId)) throw new Error("Block already recorded");
checkpoint.updatedAt = updatedAt;
checkpoint.status = "two-accepted-two-clean-restarts-attempt-4-active";
checkpoint.preflight = {
  parentCorpusSha256,
  blockedCorpusSha256: corpusSha256,
  cache: preflightRelativePath,
  order: "longest-phrase-first",
  appendedBlockRequestId: blockEvidence.requestId,
  recompileRequired: false
};
checkpoint.attemptLog.push({
  attempt: 3,
  stage: "two simplified fresh clean foundations",
  outcome: "scene 868 rendered then failed the six-shoe gate; scene 871 blocked at output moderation",
  rejectedScenes: [868],
  blockedScenes: [871]
});
checkpoint.moderationBlocks.push(blockEvidence);
const scene868 = checkpoint.lanes.find((lane) => lane.scene === 868);
checkpoint.rejectedCandidates.push({
  scene: 868,
  attempt: 3,
  asset: "tmp/world-195x4/batch-212/foundations/868-democratic-republic-of-the-congo-kinshasa-foundation-v3.png",
  bytes: 2458297,
  sha256: "70da9f8a57259e6419c9033086c22b48f323b30bc9c308e29872267b6f9833eb",
  reason: "Rejected: the central route table and side control stations obscure four of the six required shoes.",
  published: false
});
for (const lane of checkpoint.lanes.filter((item) => retryPrompts.has(item.scene))) {
  lane.status = "active-clean-restart-attempt-4";
  lane.attempts = 4;
  lane.blocker = lane.scene === 868 ? "Rejected: the central route table and side control stations obscure four of the six required shoes." : "Output moderation block; exact prompt appended to corpus and no asset surfaced.";
  lane.safeRecoveryMethod = "Fresh independent furniture-free or side-console foundation from canonical identity references only, with the three adults in a shallow row and all six shoes on open floor.";
  lane.exactPromptAttempt4 = retryPrompts.get(lane.scene);
  lane.nextStage = "await-clean-foundation-v4";
  lane.preflightCorpusSha256 = corpusSha256;
}

let campaignRaw = fs.readFileSync(campaignPath, "utf8");
const campaign = JSON.parse(campaignRaw);
if (campaign.rendererCollaborationLexicon.masterAttemptLog.some((item) => item.requestId === blockEvidence.requestId)) throw new Error("Master log already contains block");
const batch = campaign.plannedBatches.find((item) => item.batch === 212);
const oldBatchText = JSON.stringify(batch);
batch.status = "partial-two-accepted-two-clean-restarts-attempt-4-active";
batch.preflight = { ...batch.preflight, parentCorpusSha256, blockedCorpusSha256: corpusSha256, cache: preflightRelativePath, compiledAt: updatedAt, appendedBlockRequestId: blockEvidence.requestId };
for (const scene of batch.scenes.filter((item) => retryPrompts.has(item.number))) {
  scene.status = "clean-restart-attempt-4-active";
  scene.renderState.status = "clean-restart-attempt-4-active";
  scene.renderState.attempts = 4;
  scene.renderState.preflight = { status: "passed", blockedCorpusSha256: corpusSha256, cache: preflightRelativePath, order: "longest-phrase-first" };
  scene.renderState.safeRecoveryMethod = "Fresh independent furniture-free or side-console foundation from canonical identity references only, with the three adults in a shallow row and all six shoes on open floor.";
  scene.renderState.retryPrompts.push({ attempt: 4, prompt: retryPrompts.get(scene.number) });
  if (scene.number === 868) {
    const reason = "Rejected: the central route table and side control stations obscure four of the six required shoes.";
    scene.renderState.blocker = reason;
    scene.renderState.rejectedCandidates.push({ attempt: 3, asset: "tmp/world-195x4/batch-212/foundations/868-democratic-republic-of-the-congo-kinshasa-foundation-v3.png", bytes: 2458297, sha256: "70da9f8a57259e6419c9033086c22b48f323b30bc9c308e29872267b6f9833eb", reason });
    scene.renderState.stages.validation = "failed-attempt-3";
  } else {
    scene.renderState.blocker = "Output moderation block; exact prompt appended to corpus and no asset surfaced.";
    scene.renderState.blockedPrompts.push(blockEvidence);
    scene.renderState.stages.validation = "blocked-attempt-3";
  }
}
campaignRaw = campaignRaw.replace(oldBatchText, JSON.stringify(batch));
const lexiconMarker = campaignRaw.indexOf('\n  "rendererCollaborationLexicon": ');
const [logStart, logEnd] = nestedArrayRange(campaignRaw, "masterAttemptLog", lexiconMarker);
const log = JSON.parse(campaignRaw.slice(logStart, logEnd));
if (log.some((item) => item.requestId === blockEvidence.requestId)) throw new Error("Block appeared during update");
campaignRaw = campaignRaw.slice(0, logEnd - 1) + `,\n      ${JSON.stringify(blockEvidence)}\n    ` + campaignRaw.slice(logEnd - 1);
campaignRaw = replaceTopLevelValue(campaignRaw, "activeRenderCheckpoint", {
  ...campaign.activeRenderCheckpoint,
  status: "two-accepted-two-clean-restarts-attempt-4-active",
  updatedAt,
  preflightCorpusSha256: corpusSha256,
  latestModerationBlock: { scene: 871, requestId: blockEvidence.requestId, stage: "output", category: "sexual" },
  rejectedCandidates: [
    ...campaign.activeRenderCheckpoint.rejectedCandidates,
    { number: 868, attempt: 3, sha256: "70da9f8a57259e6419c9033086c22b48f323b30bc9c308e29872267b6f9833eb", reason: "Rejected: the central route table and side control stations obscure four of the six required shoes." }
  ],
  nextAction: "Scenes 869 and 870 remain frozen. Attempt 4 is active only for scenes 868 and 871 using the recompiled corpus and open-floor staging."
});
JSON.parse(campaignRaw);

const preflight = JSON.parse(fs.readFileSync(sourcePreflightPath, "utf8"));
preflight.wakeAt = updatedAt;
preflight.hashAlgorithm = "SHA-256 of JSON ordered [parentCorpusSha256, appended exact prompt]";
preflight.parentCorpusSha256 = parentCorpusSha256;
preflight.appendedExactPromptCount = 1;
delete preflight.appendedAggregateBlockCount;
delete preflight.aggregateModerationEvidence;
preflight.blockedCorpusSha256 = corpusSha256;
preflight.appendedBlockEvidence = blockEvidence;
preflight.transformations = preflight.transformations.sort((left, right) => right.riskyPhrase.length - left.riskyPhrase.length || left.riskyPhrase.localeCompare(right.riskyPhrase));
preflight.foundationRule = "Use one independent clean foundation from canonical identity references. Put every adult fully head-to-toe on open floor, keep mission devices hand-held or outside the shoe footprint, use opaque command tailoring, and render PAWS exceptionally tiny, golden-shaded and action-specific.";
preflight.outputBlockRule = "The appended exact prompt blocked at output moderation; no single wording family is inferred. The next scene 871 attempt removes gala-tableau language, moves the console to the far edge and uses a wide task-focused row.";

fs.mkdirSync(path.dirname(preflightPath), { recursive: true });
fs.writeFileSync(preflightPath, `${JSON.stringify(preflight, null, 2)}\n`, "utf8");
fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
fs.writeFileSync(scenePlanPath, `${JSON.stringify(batch, null, 2)}\n`, "utf8");
fs.writeFileSync(campaignPath, campaignRaw, "utf8");
console.log(JSON.stringify({ status: checkpoint.status, corpusSha256, blockRequestId: blockEvidence.requestId, retryScenes: [868, 871] }, null, 2));
