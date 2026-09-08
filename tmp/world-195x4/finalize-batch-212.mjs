import fs from "node:fs";
import path from "node:path";

const campaignPath = path.resolve("assets/lore/starlight-era/world-195x4-campaign.json");
const scenePlanPath = path.resolve("tmp/world-195x4/batch-212/scene-plan.json");
const checkpointPath = path.resolve("tmp/world-195x4/batch-212/runtime-checkpoint.json");
const completedAt = "2026-08-05T10:30:58.8757464Z";

const finals = new Map([
  [868, { file: "868-democratic-republic-of-the-congo-kinshasa-pool-malebo-route-light-grid.png", sourceAttempt: 5, bytes: 2014120, sha256: "ecc8fb260bdaaee41f78ff518f40d70ac94f4df68c5a0ef45604528ce61c9578" }],
  [869, { file: "869-democratic-republic-of-the-congo-lubumbashi-copperbelt-cabin-signal-cipher.png", sourceAttempt: 1, bytes: 2444047, sha256: "8843f2bf0bbed552dc2d145a7409fe3f17283e39bd91d5a3f28937f7f8c74e7c" }],
  [870, { file: "870-democratic-republic-of-the-congo-virunga-nyiragongo-star-map-relay.png", sourceAttempt: 1, bytes: 2367030, sha256: "7b7bfdce0d9a0da3c12de6d25fb000f0dfad848c736f4f2f49d41cfab5bf0f77" }],
  [871, { file: "871-democratic-republic-of-the-congo-kisangani-boyoma-falls-arrival-beacon-finale.png", sourceAttempt: 4, bytes: 2351851, sha256: "918bc1371d7f7baa0c84c1dfb7ccd1bed8ac778a4abb7b0ff206c59df76e4c61" }]
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

for (const [number, item] of finals) {
  const target = path.resolve("assets/lore/starlight-era", item.file);
  if (!fs.existsSync(target)) throw new Error(`Missing final asset ${number}`);
  const buffer = fs.readFileSync(target);
  const hash = (await import("node:crypto")).createHash("sha256").update(buffer).digest("hex");
  if (buffer.length !== item.bytes || hash !== item.sha256) throw new Error(`Final asset drift ${number}`);
}

const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
if (checkpoint.status !== "three-accepted-one-clean-restart-attempt-5-active") throw new Error("Unexpected checkpoint state");
checkpoint.updatedAt = completedAt;
checkpoint.completedAt = completedAt;
checkpoint.status = "completed-four-accepted-foundations";
checkpoint.attemptLog.push({
  attempt: 5,
  stage: "single shoe-scale PAWS clean foundation",
  outcome: "scene 868 accepted; Batch 212 completed with four frozen clean foundations",
  acceptedScenes: [868]
});
for (const lane of checkpoint.lanes) {
  const item = finals.get(lane.scene);
  const canonical = `assets/lore/starlight-era/${item.file}`;
  lane.status = "final-accepted-frozen";
  lane.lastValidStage = "final-clean-foundation";
  lane.lastValidAsset = canonical;
  lane.acceptedBytes = item.bytes;
  lane.acceptedSha256 = item.sha256;
  lane.sourceAttempt = item.sourceAttempt;
  lane.blocker = null;
  lane.nextStage = "complete";
}
checkpoint.finalAssets = [...finals].map(([number, item]) => ({ number, ...item, path: `assets/lore/starlight-era/${item.file}` }));
checkpoint.publicBuild.status = "pending-final-release";

let campaignRaw = fs.readFileSync(campaignPath, "utf8");
const campaign = JSON.parse(campaignRaw);
if (campaign.nextBatch !== 212 || campaign.nextNumber !== 868 || campaign.completedBatches !== 122 || campaign.completedImages !== 488) throw new Error("Campaign counters moved before finalization");
const batch = campaign.plannedBatches.find((item) => item.batch === 212);
if (!batch || batch.status !== "partial-three-accepted-one-clean-restart-attempt-5-active") throw new Error("Unexpected Batch 212 state");
const oldBatchText = JSON.stringify(batch);
batch.status = "completed-after-clean-foundation-restarts";
batch.completedAt = completedAt;
batch.renderTiming.validationCompletedAt = completedAt;
batch.renderTiming.elapsedMinutes = 56.78;
batch.renderTiming.withinTarget = false;
batch.renderTiming.overrunReason = "Strict artifact rejection required fresh independent foundations for scenes 868 and 871; accepted lanes remained frozen and no dependent edit chain was used.";
batch.finalAssets = [...finals].map(([number, item]) => ({ number, ...item, path: `assets/lore/starlight-era/${item.file}` }));
for (const scene of batch.scenes) {
  const item = finals.get(scene.number);
  const canonical = `assets/lore/starlight-era/${item.file}`;
  scene.status = "final-accepted-after-clean-foundation";
  scene.renderState.status = "final-accepted-after-clean-foundation";
  scene.renderState.attempts = item.sourceAttempt;
  scene.renderState.lastValidStage = "final-clean-foundation";
  scene.renderState.lastValidAsset = canonical;
  scene.renderState.acceptedBytes = item.bytes;
  scene.renderState.acceptedSha256 = item.sha256;
  scene.renderState.sourceAttempt = item.sourceAttempt;
  scene.renderState.blocker = null;
  scene.renderState.stages.foundation = "passed";
  scene.renderState.stages.relationship = "passed-in-foundation";
  scene.renderState.stages.silhouette = "passed-in-foundation";
  scene.renderState.stages.refinement = "not-required";
  scene.renderState.stages.triggeredDetails = "passed-in-foundation";
  scene.renderState.stages.companion = "passed-in-foundation";
  scene.renderState.stages.validation = "passed";
  scene.renderState.detailProgress.completed = [...scene.renderState.foundationPlan.triggeredDetails];
  scene.renderState.detailProgress.remaining = [];
}
campaignRaw = campaignRaw.replace(oldBatchText, JSON.stringify(batch));
campaignRaw = replaceTopLevelValue(campaignRaw, "nextBatch", 213);
campaignRaw = replaceTopLevelValue(campaignRaw, "nextNumber", 872);
campaignRaw = replaceTopLevelValue(campaignRaw, "completedBatches", 123);
campaignRaw = replaceTopLevelValue(campaignRaw, "completedImages", 492);

const afterCounters = JSON.parse(campaignRaw);
const expansion = afterCounters.expansionPacks[0];
const oldExpansionText = JSON.stringify(expansion);
expansion.completedBatches = 16;
expansion.completedImages = 64;
expansion.lastCompletedBatch = 212;
campaignRaw = campaignRaw.replace(oldExpansionText, JSON.stringify(expansion));
campaignRaw = replaceTopLevelValue(campaignRaw, "activeRenderCheckpoint", {
  batch: 212,
  country: "Democratic Republic of the Congo",
  status: "completed-after-clean-foundation-restarts",
  updatedAt: completedAt,
  completedAt,
  checkpoint: "tmp/world-195x4/batch-212/runtime-checkpoint.json",
  sceneNumbers: [868, 869, 870, 871],
  pawsActions: batch.scenes.map((scene) => ({
    number: scene.number,
    rawActionRoll: scene.companionActionRoll.rawActionRoll,
    resolvedActionIndex: scene.companionActionRoll.resolvedActionIndex,
    collisionAdjusted: scene.companionActionRoll.collisionAdjusted,
    action: scene.companionActionRoll.actionName
  })),
  preflightCorpusSha256: batch.preflight.blockedCorpusSha256,
  acceptedFoundationCount: 4,
  acceptedFoundationHashes: [...finals].map(([number, item]) => ({ number, sha256: item.sha256 })),
  publicFinalCommit: null,
  publicFinalUrl: null,
  nextAction: "Batch 212 is complete. Materialize Batch 213 at the next wake; no Batch 212 render lane remains eligible."
}, true);
const finalCampaign = JSON.parse(campaignRaw);
if (finalCampaign.completedCountries !== 108) throw new Error("Bonus country must not increment unique-country count");
if (finalCampaign.completedCountrySlugs.filter((slug) => slug === "democratic-republic-of-the-congo").length !== 1) throw new Error("Bonus batch must not duplicate the country slug");
if (finalCampaign.nextBatch !== 213 || finalCampaign.nextNumber !== 872 || finalCampaign.completedBatches !== 123 || finalCampaign.completedImages !== 492) throw new Error("Final counters invalid");

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
fs.writeFileSync(scenePlanPath, `${JSON.stringify(batch, null, 2)}\n`, "utf8");
fs.writeFileSync(campaignPath, campaignRaw, "utf8");
console.log(JSON.stringify({
  status: batch.status,
  nextBatch: finalCampaign.nextBatch,
  nextNumber: finalCampaign.nextNumber,
  completedCountries: finalCampaign.completedCountries,
  completedBatches: finalCampaign.completedBatches,
  completedImages: finalCampaign.completedImages,
  expansion: finalCampaign.expansionPacks[0] && {
    completedBatches: finalCampaign.expansionPacks[0].completedBatches,
    completedImages: finalCampaign.expansionPacks[0].completedImages,
    lastCompletedBatch: finalCampaign.expansionPacks[0].lastCompletedBatch
  },
  assets: checkpoint.finalAssets
}, null, 2));
