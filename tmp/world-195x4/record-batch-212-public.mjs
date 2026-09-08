import fs from "node:fs";
import path from "node:path";

const campaignPath = path.resolve("assets/lore/starlight-era/world-195x4-campaign.json");
const scenePlanPath = path.resolve("tmp/world-195x4/batch-212/scene-plan.json");
const checkpointPath = path.resolve("tmp/world-195x4/batch-212/runtime-checkpoint.json");
const commit = "ac68b803b3597fbef043ebc22cacc85759dfbde9";
const url = `https://github.com/InternalAgencyIO/InternalAgency/commit/${commit}`;
const updatedAt = "2026-08-05T10:41:45.1260163Z";

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
if (checkpoint.status !== "completed-four-accepted-foundations") throw new Error("Unexpected checkpoint state");
checkpoint.updatedAt = updatedAt;
checkpoint.status = "completed-and-public-pushed";
checkpoint.publicBuild = {
  status: "complete-pushed",
  commit,
  url,
  rejectedMediaPublished: false
};

let campaignRaw = fs.readFileSync(campaignPath, "utf8");
const campaign = JSON.parse(campaignRaw);
const batch = campaign.plannedBatches.find((item) => item.batch === 212);
if (!batch || batch.status !== "completed-after-clean-foundation-restarts") throw new Error("Unexpected Batch 212 state");
const oldBatchText = JSON.stringify(batch);
batch.publicFinalCommit = commit;
batch.publicFinalUrl = url;
batch.publicBuildStatus = "complete-pushed";
campaignRaw = campaignRaw.replace(oldBatchText, JSON.stringify(batch));
campaignRaw = replaceTopLevelValue(campaignRaw, "activeRenderCheckpoint", {
  ...campaign.activeRenderCheckpoint,
  status: "completed-and-public-pushed",
  updatedAt,
  publicFinalCommit: commit,
  publicFinalUrl: url,
  nextAction: "Batch 212 is complete and publicly pushed. Materialize Batch 213 at the next wake; no Batch 212 render lane remains eligible."
});
JSON.parse(campaignRaw);

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
fs.writeFileSync(scenePlanPath, `${JSON.stringify(batch, null, 2)}\n`, "utf8");
fs.writeFileSync(campaignPath, campaignRaw, "utf8");
console.log(JSON.stringify({ status: checkpoint.status, commit, url }, null, 2));
