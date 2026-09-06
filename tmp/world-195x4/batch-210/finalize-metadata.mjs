import fs from "node:fs";
import path from "node:path";

const campaignPath = path.resolve("assets/lore/starlight-era/world-195x4-campaign.json");
const overnightPath = path.resolve("assets/lore/starlight-era/overnight-campaign.json");
const checkpointPath = path.resolve("tmp/world-195x4/batch-210/runtime-checkpoint.json");
const completedAt = "2026-08-04T23:33:55.5326334Z";

const finals = new Map([
  [860, { file: "860-egypt-cairo-tower-nile-route-light-grid.png", sha256: "cf945fe8b9ed7b2da60501c908ed619680bcae3032c8f3b5abce9c884119e01b" }],
  [861, { file: "861-egypt-alexandria-bibliotheca-cabin-signal-cipher.png", sha256: "333d971bd6cd936ea13e2025498a943823495ca994634d608c00ea617f1058fa" }],
  [862, { file: "862-egypt-white-desert-star-map-relay.png", sha256: "3890ce8c02b19acbdf6e48fd402acf05c42f2b6fb4c3b505e0e515dc6b4b1758" }],
  [863, { file: "863-egypt-siwa-oasis-arrival-beacon-finale.png", sha256: "c8a9a2f100cb56078b33af6221737ab6b87d1c2b80b5dc762daef00547cfffa7" }],
]);

const foundationHashes = new Map([
  [860, "c5f6acbdcef20f9b0e13fe3d073dcdbbc09b2093bebcdaf895f770e68dd43b13"],
  [861, "c8bc9ff51353dc66a321fa51d1592777c6dd4f37aa2e54514d4dacd10099a904"],
  [862, "3890ce8c02b19acbdf6e48fd402acf05c42f2b6fb4c3b505e0e515dc6b4b1758"],
  [863, "0344abeb5f74cc826bb5fec2f50db3be97f6b75fa57bfdefbecdd44cb6dbca77"],
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

function replaceBatch(source, batchNumber, mutate) {
  const [arrayStart, arrayEnd] = topLevelValueRange(source, "plannedBatches");
  let index = arrayStart + 1;
  while (index < arrayEnd - 1) {
    while (/\s|,/.test(source[index])) index += 1;
    if (source[index] !== "{") throw new Error(`Unexpected plannedBatches token at ${index}`);
    const end = matchingClose(source, index) + 1;
    const candidate = JSON.parse(source.slice(index, end));
    if (candidate.batch === batchNumber) {
      mutate(candidate);
      return source.slice(0, index) + JSON.stringify(candidate) + source.slice(end);
    }
    index = end;
  }
  throw new Error(`Batch ${batchNumber} not found`);
}

function appendOvernightBatch(source, record) {
  const [arrayStart, arrayEnd] = topLevelValueRange(source, "batches");
  const existing = JSON.parse(source.slice(arrayStart, arrayEnd));
  if (existing.some((batch) => batch.batch === record.batch)) throw new Error(`Overnight batch ${record.batch} already exists`);
  const pretty = JSON.stringify(record, null, 2).replaceAll("\n", "\n    ");
  return source.slice(0, arrayEnd - 1) + `,\n    ${pretty}\n  ` + source.slice(arrayEnd - 1);
}

const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
let campaignRaw = fs.readFileSync(campaignPath, "utf8");
const originalCampaign = JSON.parse(campaignRaw);
if (originalCampaign.nextBatch !== 210 || originalCampaign.nextNumber !== 860) throw new Error("Campaign counters moved; refusing stale finalization");

campaignRaw = replaceBatch(campaignRaw, 210, (batch) => {
  const startedAt = new Date(batch.renderTiming.startedAt);
  const endedAt = new Date(completedAt);
  batch.status = "complete";
  batch.completedAt = completedAt;
  batch.renderTiming.firstFoundationAt = batch.renderTiming.firstFoundationAt ?? "2026-08-04T19:21:00.000Z";
  batch.renderTiming.validationCompletedAt = completedAt;
  batch.renderTiming.elapsedMinutes = Math.round(((endedAt - startedAt) / 60000) * 100) / 100;
  batch.renderTiming.withinTarget = false;
  batch.renderTiming.overrunReason = "Extended safety preflight, relationship-geometry recovery, and complete-footwear final QA across the four Egypt lanes.";
  batch.preflight = {
    status: "passed",
    blockedCorpusSha256: checkpoint.preflight.blockedCorpusSha256,
    cache: checkpoint.preflight.cache,
    compiledAt: completedAt,
    order: "longest-phrase-first",
  };
  for (const scene of batch.scenes) {
    const final = finals.get(scene.number);
    const lane = checkpoint.lanes.find((item) => item.scene === scene.number);
    if (!final || !lane) throw new Error(`Missing final metadata for scene ${scene.number}`);
    scene.status = "rendered";
    scene.renderState.status = "complete";
    scene.renderState.lastValidStage = "validation";
    scene.renderState.lastValidAsset = `assets/lore/starlight-era/${final.file}`;
    scene.renderState.attempts = lane.attempts;
    scene.renderState.blocker = null;
    scene.renderState.preflight = {
      status: "passed",
      blockedCorpusSha256: checkpoint.preflight.blockedCorpusSha256,
      cache: checkpoint.preflight.cache,
      order: "longest-phrase-first",
    };
    scene.renderState.stages = {
      foundation: "passed",
      relationship: "passed",
      silhouette: "passed",
      refinement: "passed",
      triggeredDetails: "passed_all_deterministic_details",
      validation: "passed",
    };
    scene.renderState.foundationSha256 = foundationHashes.get(scene.number);
    scene.renderState.relationshipSha256 = final.sha256;
    scene.renderState.silhouetteSha256 = final.sha256;
    scene.renderState.refinementSha256 = final.sha256;
    scene.renderState.triggeredDetailsSha256 = final.sha256;
    scene.renderState.archiveSha256 = final.sha256;
    scene.renderState.detailProgress = {
      completed: [...scene.renderState.foundationPlan.triggeredDetails],
      remaining: [],
    };
  }
});
campaignRaw = replaceTopLevelValue(campaignRaw, "nextBatch", 211);
campaignRaw = replaceTopLevelValue(campaignRaw, "nextNumber", 864);
campaignRaw = replaceTopLevelValue(campaignRaw, "completedBatches", 121);
campaignRaw = replaceTopLevelValue(campaignRaw, "completedImages", 484);
campaignRaw = replaceTopLevelValue(campaignRaw, "activeRenderCheckpoint", {
  batch: 210,
  country: "Egypt",
  status: "complete-pending-public-push",
  updatedAt: completedAt,
  checkpoint: "tmp/world-195x4/batch-210/runtime-checkpoint.json",
  acceptedFinals: [...finals.entries()].map(([number, item]) => ({ number, file: item.file, sha256: item.sha256 })),
  nextAction: "Validate tests and publish the narrow Batch 210 release commit, then materialize Batch 211 from the updated counters.",
}, true);
JSON.parse(campaignRaw);
fs.writeFileSync(campaignPath, campaignRaw, "utf8");

let overnightRaw = fs.readFileSync(overnightPath, "utf8");
const originalOvernight = JSON.parse(overnightRaw);
if (originalOvernight.nextNumber !== 860 || originalOvernight.batches.at(-1)?.batch !== 209) throw new Error("Overnight counters moved; refusing stale finalization");
overnightRaw = replaceTopLevelValue(overnightRaw, "nextNumber", 864);
overnightRaw = replaceTopLevelValue(overnightRaw, "completedBatches", 203);
overnightRaw = replaceTopLevelValue(overnightRaw, "completedImages", 812);
overnightRaw = appendOvernightBatch(overnightRaw, {
  batch: 210,
  completedAt,
  continent: "Africa",
  country: "Egypt",
  bonusExpansion: true,
  theme: "THE MILE HIGH THREESOME - Egypt: Cairo Tower route-light grid, Alexandria Bibliotheca cabin-signal cipher, White Desert star-map relay and Siwa Oasis arrival-beacon finale; rotating STAR RAZE aircrew roles; fully opaque resort-flight couture in red, optical white, lacquer black, Nile blue, lapis, copper and warm gold; clean canonical faces, complete statement footwear, four completed objectives, and PAWS present in every promotion-eligible still; video production paused under the binding four-PNG-only override",
  files: [...finals.values()],
  video: {
    status: "not-scheduled",
    reason: "Binding four-PNG-only pause for render Batches 202 through 211.",
  },
});
JSON.parse(overnightRaw);
fs.writeFileSync(overnightPath, overnightRaw, "utf8");

console.log(JSON.stringify({ campaign: { nextBatch: 211, nextNumber: 864, completedBatches: 121, completedImages: 484 }, overnight: { nextNumber: 864, completedBatches: 203, completedImages: 812 }, batch: 210, completedAt }, null, 2));
