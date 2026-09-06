import fs from "node:fs";
import path from "node:path";

const campaignPath = path.resolve("assets/lore/starlight-era/world-195x4-campaign.json");
const scenePlanPath = path.resolve("tmp/world-195x4/batch-212/scene-plan.json");
const checkpointPath = path.resolve("tmp/world-195x4/batch-212/runtime-checkpoint.json");
const updatedAt = "2026-08-05T10:05:12.000Z";

const outcomes = new Map([
  [868, {
    accepted: false,
    asset: "tmp/world-195x4/batch-212/foundations/868-democratic-republic-of-the-congo-kinshasa-foundation-v1.png",
    bytes: 2568074,
    sha256: "06bddd7c06435ab0d3ab1dd28a9fb2b4a77acd52c2d0c7f4cd6ec4625c3001f5",
    reason: "Rejected: PAWS reads far larger than a two-month-old kitten and the setting is dominated by an invented generic cable bridge instead of a recognizable Pool Malebo/Kinshasa riverfront."
  }],
  [869, {
    accepted: true,
    asset: "tmp/world-195x4/batch-212/foundations/869-democratic-republic-of-the-congo-lubumbashi-foundation-v1.png",
    bytes: 2444047,
    sha256: "8843f2bf0bbed552dc2d145a7409fe3f17283e39bd91d5a3f28937f7f8c74e7c"
  }],
  [870, {
    accepted: true,
    asset: "tmp/world-195x4/batch-212/foundations/870-democratic-republic-of-the-congo-virunga-foundation-v1.png",
    bytes: 2367030,
    sha256: "7b7bfdce0d9a0da3c12de6d25fb000f0dfad848c736f4f2f49d41cfab5bf0f77"
  }],
  [871, {
    accepted: false,
    asset: "tmp/world-195x4/batch-212/foundations/871-democratic-republic-of-the-congo-kisangani-foundation-v1.png",
    bytes: 2495425,
    sha256: "1c1c92d0801eada2c4baab3d306333c5582cf902bbb53f775ecc7c14ecafe1cd",
    reason: "Rejected: PAWS raises her forepaws toward Alia rather than inspecting the low beacon console, and Radiance's far shoe is obscured by the garment train."
  }]
]);

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
  return [start, matchingClose(source, start) + 1];
}

function replaceTopLevelValue(source, key, value) {
  const [start, end] = topLevelValueRange(source, key);
  const replacement = JSON.stringify(value, null, 2).replaceAll("\n", "\n  ");
  return source.slice(0, start) + replacement + source.slice(end);
}

const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
if (checkpoint.batch !== 212 || checkpoint.status !== "four-clean-foundations-active") throw new Error("Unexpected checkpoint state");
checkpoint.updatedAt = updatedAt;
checkpoint.status = "two-accepted-two-clean-restarts-active";
checkpoint.attemptLog = checkpoint.attemptLog ?? [];
checkpoint.attemptLog.push({
  attempt: 1,
  stage: "four clean integrated foundations",
  outcome: "four renderer successes; scenes 869 and 870 accepted and frozen; scenes 868 and 871 rejected by contract gate",
  acceptedScenes: [869, 870],
  rejectedScenes: [868, 871]
});
for (const lane of checkpoint.lanes) {
  const outcome = outcomes.get(lane.scene);
  lane.candidateAsset = outcome.asset;
  lane.candidateBytes = outcome.bytes;
  lane.candidateSha256 = outcome.sha256;
  if (outcome.accepted) {
    lane.status = "accepted-frozen";
    lane.lastValidStage = "clean-foundation";
    lane.lastValidAsset = outcome.asset;
    lane.acceptedBytes = outcome.bytes;
    lane.acceptedSha256 = outcome.sha256;
    lane.nextStage = "complete";
  } else {
    lane.status = "active-clean-restart-attempt-2";
    lane.blocker = outcome.reason;
    lane.attempts = 2;
    lane.nextStage = "await-clean-foundation-v2";
    checkpoint.rejectedCandidates.push({
      scene: lane.scene,
      attempt: 1,
      asset: outcome.asset,
      bytes: outcome.bytes,
      sha256: outcome.sha256,
      reason: outcome.reason,
      published: false
    });
  }
}

let campaignRaw = fs.readFileSync(campaignPath, "utf8");
const campaign = JSON.parse(campaignRaw);
const batch = campaign.plannedBatches.find((item) => item.batch === 212);
if (!batch || batch.status !== "planned-clean-foundation") throw new Error("Unexpected Batch 212 campaign state");
const oldBatchText = JSON.stringify(batch);
batch.status = "partial-two-accepted-two-clean-restarts-active";
batch.renderTiming.firstFoundationAt = "2026-08-05T09:54:41.0967809Z";
for (const scene of batch.scenes) {
  const outcome = outcomes.get(scene.number);
  scene.renderState.attempts = outcome.accepted ? 1 : 2;
  if (outcome.accepted) {
    scene.status = "foundation-accepted-frozen";
    scene.renderState.status = "foundation-accepted-frozen";
    scene.renderState.lastValidStage = "clean-foundation";
    scene.renderState.lastValidAsset = outcome.asset;
    scene.renderState.acceptedBytes = outcome.bytes;
    scene.renderState.acceptedSha256 = outcome.sha256;
    scene.renderState.stages.foundation = "passed";
    scene.renderState.stages.validation = "passed";
    scene.renderState.detailProgress.completed = [...scene.renderState.foundationPlan.triggeredDetails];
    scene.renderState.detailProgress.remaining = [];
  } else {
    scene.status = "clean-restart-active";
    scene.renderState.status = "clean-restart-active";
    scene.renderState.blocker = outcome.reason;
    scene.renderState.stages.foundation = "rejected-at-validation";
    scene.renderState.stages.validation = "failed-attempt-1";
    scene.renderState.rejectedCandidates = [{
      attempt: 1,
      asset: outcome.asset,
      bytes: outcome.bytes,
      sha256: outcome.sha256,
      reason: outcome.reason
    }];
  }
}
campaignRaw = campaignRaw.replace(oldBatchText, JSON.stringify(batch));
if (campaignRaw === fs.readFileSync(campaignPath, "utf8")) throw new Error("Batch replacement failed");
campaignRaw = replaceTopLevelValue(campaignRaw, "activeRenderCheckpoint", {
  batch: 212,
  country: "Democratic Republic of the Congo",
  status: "two-accepted-two-clean-restarts-active",
  updatedAt,
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
  acceptedFoundationCount: 2,
  acceptedFoundationHashes: [869, 870].map((number) => ({ number, sha256: outcomes.get(number).sha256 })),
  rejectedCandidates: [868, 871].map((number) => ({ number, sha256: outcomes.get(number).sha256, reason: outcomes.get(number).reason })),
  nextAction: "Scenes 869 and 870 are frozen. Await the fresh clean-foundation restarts for scenes 868 and 871; do not edit or rerender accepted lanes."
});
JSON.parse(campaignRaw);

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
fs.writeFileSync(scenePlanPath, `${JSON.stringify(batch, null, 2)}\n`, "utf8");
fs.writeFileSync(campaignPath, campaignRaw, "utf8");
console.log(JSON.stringify({ status: checkpoint.status, accepted: [869, 870], restarting: [868, 871] }, null, 2));
